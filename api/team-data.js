// /api/team-data.js
// 공지사항 / TODO / 출고요청처럼 용량이 작은 데이터를 팀 전체가 공유하기 위한 API입니다.
// 입고·출고 파일 데이터(api/shared-data.js)와는 별도의 KV 키를 사용해서,
// 큰 파일 데이터 동기화와 사용량 한도(quota)를 나눠 씁니다.
// 환경변수는 api/shared-data.js와 동일한 KV_REST_API_URL / KV_REST_API_TOKEN을 그대로 사용합니다.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'lush_team_data_v1';
const KV_TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function kvGet() {
  const res = await fetchWithTimeout(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

async function kvSet(value) {
  const res = await fetchWithTimeout(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  return res.ok;
}

// 입고리스트 저장소(hash): 필드 = 차수 id(예: JP-141) → { id, country, batchNo, label, date, fileName, sheets, cols, rows, uploadedAt, uploadedBy }
//   GET               차수 전체 목록(행 포함)
//   POST {action:'save', batch}  같은 차수면 새 파일로 교체
//   POST {action:'delete', id}
const LIST_KEY = 'lush_inbound_lists_v1';
async function inboundLists(req, res, user) {
  const store = require('./_lib/auth').kv();
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  try {
    if (req.method === 'GET') {
      const arr = await store.cmd(['HGETALL', LIST_KEY]) || [];
      const batches = [];
      for (let i = 0; i < arr.length; i += 2) { try { batches.push(JSON.parse(arr[i + 1])); } catch (e) { /* 깨진 항목 무시 */ } }
      batches.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.batchNo) || 0) - (Number(a.batchNo) || 0));
      return res.status(200).json({ success: true, batches });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    if (body.action === 'delete') {
      const id = clip(body.id, 40);
      if (!id) return res.status(200).json({ success: false, error: '삭제할 차수를 선택해 주세요.' });
      await store.cmd(['HDEL', LIST_KEY, id]);
      return res.status(200).json({ success: true });
    }
    if (body.action === 'save') {
      const b = body.batch || {};
      const id = clip(b.id, 40);
      // 예: JP-141, 같은 차수의 구분 리스트는 JP-130-AYR · JP-130-시즌
      if (!/^[A-Z]{2,3}-\d{1,4}(-[0-9A-Za-z가-힣_]{1,20})?$/.test(id)) return res.status(200).json({ success: false, error: '차수 정보가 올바르지 않습니다. (예: JP-141)' });
      const cols = (Array.isArray(b.cols) ? b.cols : []).slice(0, 40).map(c => clip(c, 40));
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 20000).map(r => ({
        sheet: clip(r.sheet, 40), code: clip(r.code, 40), name: clip(r.name, 200), total: Number(r.total) || 0,
        values: Object.fromEntries(Object.entries(r.values || {}).slice(0, 40).map(([k, v]) => [clip(k, 40), typeof v === 'number' ? v : clip(v, 100)])),
      }));
      const rec = {
        id, country: clip(b.country, 3), batchNo: clip(b.batchNo, 4), part: clip(b.part, 20), label: clip(b.label, 40), date: clip(b.date, 10), fileName: clip(b.fileName, 200),
        sheets: (Array.isArray(b.sheets) ? b.sheets : []).slice(0, 60).map(s => clip(s, 40)), cols, rows,
        // 파일 CHECK 시트 합계(전체·담당별) — 화면 합계는 이 기준
        check: b.check && typeof b.check === 'object' ? { total: Number(b.check.total) || 0, bySheet: Object.fromEntries(Object.entries(b.check.bySheet || {}).slice(0, 60).map(([k, v]) => [clip(k, 40), Number(v) || 0])) } : null,
        uploadedAt: new Date().toISOString(), uploadedBy: user.id,
      };
      const existed = await store.cmd(['HEXISTS', LIST_KEY, id]);
      await store.cmd(['HSET', LIST_KEY, id, JSON.stringify(rec)]);
      // 새 차수를 처음 올렸을 때만 모바일 Push(같은 차수 다시 올려 교체할 때는 보내지 않음). 실패해도 저장 결과는 그대로
      if (!existed) {
        try {
          const owners = new Set(rows.map(r => r.sheet)).size;
          await Promise.race([
            require('./_lib/push').notifyNew(store, [{ kind: 'inboundList', item: { id, label: rec.label, date: rec.date, rows: rows.length, owners } }]),
            new Promise(r => setTimeout(r, 7000)),
          ]);
        } catch (e) { console.error('inbound list push error', e); }
      }
      return res.status(200).json({ success: true, batch: { id, label: rec.label, rows: rows.length } });
    }
    return res.status(200).json({ success: false, error: 'Unsupported action' });
  } catch (e) {
    return res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
}

module.exports = async (req, res) => {
  // 로그인한 사람만(api/_lib/auth.js). 게스트는 보기만, 새벽 자동 동기화(Vercel cron)는 허용
  const authUser = await require('./_lib/auth').guard(req, res, { write: r => r.method !== 'GET' });
  if (!authUser) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  // 입고리스트(엑셀 입고 분배리스트)는 차수별로 따로 보관: /api/team-data?part=inbound-lists (팀 공유 데이터를 무겁게 하지 않도록 분리)
  if (req.query && req.query.part === 'inbound-lists') return inboundLists(req, res, authUser);
  if (!KV_URL || !KV_TOKEN) {
    res.status(200).json({ success: false, error: 'KV_REST_API_URL/KV_REST_API_TOKEN 환경변수가 설정되지 않았습니다.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const data = await kvGet();
      res.status(200).json({ success: true, data: data || { notices: [], todos: [], requests: [] } });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body) {
        res.status(200).json({ success: false, error: '잘못된 요청 본문입니다.' });
        return;
      }
      // 화면 버전에 따라 일부 항목(예: 제품 불량 defects)을 모르고 올리는 경우가 있어,
      // 보낸 데이터에 없는 항목은 서버에 있던 값을 그대로 유지합니다.
      const freshItems = []; // 모바일 Push: 서버에 없던 신규 id만(수정·상태 변경·삭제·재저장은 제외)
      try {
        const current = await kvGet();
        if (current && typeof current === 'object' && body && typeof body === 'object') {
          try {
            const recent = r => { const t = Date.parse(r.createdAt || r.date || ''); return isNaN(t) || Date.now() - t < 3 * 24 * 3600 * 1000; };
            [['notices', 'noticesDeleted'], ['todos', 'todosDeleted'], ['requests', 'requestsDeleted']].forEach(([key, delKey]) => {
              if (!Array.isArray(body[key]) || !Array.isArray(current[key])) return; // 서버에 목록 자체가 없으면(최초 저장) 보내지 않음
              const had = new Set(current[key].map(r => r && r.id).filter(Boolean));
              const gone = new Set([].concat(current[delKey] || [], body[delKey] || []));
              body[key].forEach(r => {
                if (!r || !r.id || had.has(r.id) || gone.has(r.id) || !recent(r)) return;
                const kind = key === 'notices' ? 'notice' : key === 'todos' ? 'todo' : r.type;
                freshItems.push({ kind, item: r });
              });
            });
          } catch (e) { /* 신규 판정 실패는 저장에 영향 없음 */ }
          Object.keys(current).forEach(k => { if (!(k in body)) body[k] = current[k]; });
          // 제품 불량(defects)은 누적 기록: 여러 사람이 동시에 올려도 서로 지우지 않도록 건(id)별로 합칩니다.
          // 같은 건이면 updatedAt이 더 최근인 쪽을 남기고, 삭제는 deleted 표시로 전달됩니다.
          // 출고 요청(requests): 목록을 통째로 올리면 다른 기기에서 막 등록한 요청이 덮여 사라지므로 건(id)별로 합칩니다.
          // 같은 건이면 updatedAt(없으면 createdAt)이 더 최근인 쪽, 지운 요청은 requestsDeleted(id 목록)로 전달돼 다시 살아나지 않음.
          // 공지(notices)·제품 확보(todos)도 같은 방식(지운 건은 noticesDeleted·todosDeleted).
          [['requests', 'requestsDeleted'], ['notices', 'noticesDeleted'], ['todos', 'todosDeleted']].forEach(([key, delKey]) => {
            if (!Array.isArray(current[key]) || !Array.isArray(body[key])) return;
            const deleted = new Set([].concat(current[delKey] || [], body[delKey] || []).filter(Boolean));
            const stamp = r => String(r.updatedAt || r.createdAt || '');
            const byId = new Map();
            const put = r => {
              if (!r || !r.id) return;
              const prev = byId.get(r.id);
              if (!prev || stamp(r) > stamp(prev)) byId.set(r.id, r);
            };
            body[key].forEach(put);    // 보낸 쪽 순서를 먼저 유지
            current[key].forEach(put); // 서버에만 있거나 서버 쪽이 더 최신인 건 반영
            const noId = body[key].filter(r => r && !r.id); // id 없는 예전 기록은 그대로 둠
            body[key] = Array.from(byId.values()).filter(r => !deleted.has(r.id)).concat(noId);
            body[delKey] = Array.from(deleted).slice(-2000);
          });
          // 메뉴 설정(menuConfig): 관리자만 바꿀 수 있고, 더 최신(updatedAt) 것만 반영
          if (body.menuConfig !== undefined) {
            const cur = current.menuConfig, inc = body.menuConfig;
            if (authUser.role !== 'admin' || !inc || !Array.isArray(inc.menus)) { if (cur) body.menuConfig = cur; else delete body.menuConfig; }
            else if (cur && String(cur.updatedAt || '') > String(inc.updatedAt || '')) body.menuConfig = cur;
          }
          // 재고(stock, 화면 '재고'): 제품 불량과 같이 건(id)별 병합, 삭제는 deleted 표시로 전달
          if (Array.isArray(current.stock) && Array.isArray(body.stock)) {
            const byId = new Map();
            const put = d => {
              if (!d || !d.id) return;
              const prev = byId.get(d.id);
              if (!prev || String(d.updatedAt || '') >= String(prev.updatedAt || '')) byId.set(d.id, d);
            };
            current.stock.forEach(put);
            body.stock.forEach(put);
            body.stock = Array.from(byId.values());
          }
          if (Array.isArray(current.defects) && Array.isArray(body.defects)) {
            const byId = new Map();
            const put = d => {
              if (!d || !d.id) return;
              const prev = byId.get(d.id);
              if (!prev || String(d.updatedAt || '') >= String(prev.updatedAt || '')) byId.set(d.id, d);
            };
            current.defects.forEach(put);
            body.defects.forEach(put);
            body.defects = Array.from(byId.values());
          }
        }
      } catch (e) { /* 병합 실패 시 받은 그대로 저장 */ }
      const ok = await kvSet(body);
      // 저장이 끝난 신규 건만 자동 Push(관리자 설정·중복 확인은 api/_lib/push.js). 실패해도 저장 결과는 그대로
      if (ok && freshItems.length) {
        try {
          const P = require('./_lib/push'), A = require('./_lib/auth');
          await Promise.race([P.notifyNew(A.kv(), freshItems), new Promise(r => setTimeout(r, 7000))]);
        } catch (e) { console.error('push notify error', e); }
      }
      res.status(200).json({ success: ok });
      return;
    }
    res.status(200).json({ success: false, error: 'Unsupported method' });
  } catch (e) {
    res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
};
