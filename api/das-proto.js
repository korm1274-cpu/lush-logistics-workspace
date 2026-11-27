// api/das-proto.js — DAS 운영 시스템 시제품 API (출고 작업 · 피킹 · DAS · 박스·출고 · 매장 입고 검수)
//  - 로그인 필요(api/_lib/auth.js guard). 조회(GET)는 로그인한 모두, 변경(POST)은 관리자·팀원만(게스트 불가)
//  - 저장: Vercel KV(Upstash) 'lush_dasproto_v1:state' 한 키만 사용 — 기존 운영 데이터 키와 분리, ERP·운영 재고와 연결 없음
//  - 동시에 여러 기기가 저장해도 덮어쓰지 않도록 짧은 잠금(SET NX PX) 안에서 읽기→규칙 적용→저장
//  - 업무 규칙은 api/_lib/das-proto.js(apply)에서 검사. 오류 응답에 내부 정보·받은 값 원문을 넣지 않음
'use strict';
const crypto = require('crypto');
const auth = require('./_lib/auth');
const P = require('./_lib/das-proto');

const KEY = 'lush_dasproto_v1:state';
const LOCK = 'lush_dasproto_v1:lock';
const MAX_BODY = 64 * 1024;
const UNLOCK_LUA = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";

async function withLock(store, fn) {
  const token = crypto.randomBytes(12).toString('hex');
  for (let i = 0; i < 25; i++) {
    const ok = await store.cmd(['SET', LOCK, token, 'NX', 'PX', '5000']);
    if (ok === 'OK') {
      try { return await fn(); } finally { try { await store.cmd(['EVAL', UNLOCK_LUA, '1', LOCK, token]); } catch (e) { /* 5초 뒤 자동 해제 */ } }
    }
    await new Promise(r => setTimeout(r, 120 + Math.random() * 80));
  }
  const e = new Error('다른 작업을 저장하는 중입니다. 잠시 후 다시 시도해 주세요.'); e.status = 503; throw e;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { if (b.length > MAX_BODY) return null; try { b = JSON.parse(b); } catch (e) { return null; } }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  if (JSON.stringify(b).length > MAX_BODY) return null;
  return b;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await auth.guard(req, res, { write: r => r.method !== 'GET' });
  if (!user) return;
  let store;
  try { store = auth.kv(); } catch (e) { return res.status(500).json({ success: false, error: '저장소 설정을 확인해 주세요.' }); }

  try {
    if (req.method === 'GET') {
      const state = await store.getJSON(KEY);
      const action = String((req.query && req.query.action) || 'state');
      if (action === 'rev') return res.status(200).json({ success: true, rev: state ? state.rev : 0 });
      if (action === 'box') {
        const q = String((req.query && req.query.id) || '').trim().toUpperCase().slice(0, 30);
        const storeCode = String((req.query && req.query.store) || '').trim().toUpperCase().slice(0, 10);
        if (!state) return res.status(404).json({ success: false, error: '출고 데이터가 없습니다.' });
        const box = state.boxes[q] || Object.values(state.boxes).find(b => b.no === q && (!storeCode || b.store === storeCode));
        if (!box) return res.status(404).json({ success: false, error: '박스를 찾을 수 없습니다. 바코드나 박스번호를 확인해 주세요.' });
        if (storeCode && box.store !== storeCode) return res.status(403).json({ success: false, error: '다른 매장의 박스입니다.', code: 'OTHER_STORE' });
        return res.status(200).json({ success: true, box, rev: state.rev });
      }
      return res.status(200).json({ success: true, data: state });
    }

    if (req.method !== 'POST') return res.status(405).json({ success: false, error: '허용되지 않는 요청입니다.' });
    const op = readBody(req);
    if (!op || typeof op.action !== 'string') return res.status(400).json({ success: false, error: '잘못된 요청 본문입니다.' });

    const out = await withLock(store, async () => {
      const cur = await store.getJSON(KEY);
      if (op.action === 'seed') {
        if (cur && cur.wave && !(op.reset && user.role === 'admin')) { const e = new Error('이미 진행 중인 출고 작업이 있습니다. 초기화는 관리자만 할 수 있습니다.'); e.status = 409; throw e; }
        const s = P.seedState(); if (cur) s.rev = (cur.rev || 0) + 1;
        await store.setJSON(KEY, s);
        return { state: s, result: {} };
      }
      if (op.action === 'reset') {
        if (user.role !== 'admin') { const e = new Error('초기화는 관리자만 할 수 있습니다.'); e.status = 403; throw e; }
        await store.del(KEY);
        return { state: null, result: {} };
      }
      const r = P.apply(cur, op, user.role);
      await store.setJSON(KEY, r.state);
      return r;
    });
    return res.status(200).json({ success: true, data: out.state, result: out.result });
  } catch (e) {
    const status = e instanceof P.RuleError || (e.status && e.status < 600) ? (e.status || 400) : 500;
    return res.status(status).json({ success: false, error: status === 500 ? '저장 중 오류가 발생했습니다.' : e.message });
  }
};
