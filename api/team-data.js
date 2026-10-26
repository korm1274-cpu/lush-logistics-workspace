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
      if (user.role !== 'admin') return res.status(200).json({ success: false, error: '차수 삭제는 관리자만 할 수 있습니다.' });
      const id = clip(body.id, 60);
      if (!id) return res.status(200).json({ success: false, error: '삭제할 차수를 선택해 주세요.' });
      await store.cmd(['HDEL', LIST_KEY, id]);
      return res.status(200).json({ success: true });
    }
    if (body.action === 'save') {
      const b = body.batch || {};
      const id = clip(b.id, 60);
      // 예: JP-141 · JP-130-AYR · UK-32-33 · JP-110-프세제품 (구분 이름 최대 3개)
      if (!/^[A-Z]{2,3}-\d{1,4}(-[0-9A-Za-z가-힣_]{1,20}){0,3}$/.test(id)) return res.status(200).json({ success: false, error: '차수 정보가 올바르지 않습니다. (예: JP-141)' });
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

// 품질리스트(시험의뢰서 엑셀) 저장소(hash): 필드 = 차수 id(예: Q-142) → { id, batchNo, label, fileName, rows, uploadedAt, uploadedBy }
//   rows: { kind:'단품'|'GIFT', plu, name, lot, date, qty, code(파일 제품코드), items:[GIFT 구성품 {plu,name,lot,date}] }
//   GET / POST {action:'save', batch} / POST {action:'delete', id}(관리자만)
const QUALITY_KEY = 'lush_quality_lists_v1';
async function qualityLists(req, res, user) {
  const store = require('./_lib/auth').kv();
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  try {
    if (req.method === 'GET') {
      const arr = await store.cmd(['HGETALL', QUALITY_KEY]) || [];
      const batches = [];
      for (let i = 0; i < arr.length; i += 2) { try { batches.push(JSON.parse(arr[i + 1])); } catch (e) { /* 깨진 항목 무시 */ } }
      batches.sort((a, b) => (Number(b.batchNo) || 0) - (Number(a.batchNo) || 0) || String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
      return res.status(200).json({ success: true, batches });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    if (body.action === 'delete') {
      if (user.role !== 'admin') return res.status(200).json({ success: false, error: '차수 삭제는 관리자만 할 수 있습니다.' });
      const id = clip(body.id, 60);
      if (!id) return res.status(200).json({ success: false, error: '삭제할 차수를 선택해 주세요.' });
      await store.cmd(['HDEL', QUALITY_KEY, id]);
      return res.status(200).json({ success: true });
    }
    // 구글 드라이브 자동 반영(apps-script/quality-drive-sync.gs): 시트 글자 값을 받아 화면 업로드와 같은 규칙(js/quality-parse.js)으로 해석
    if (body.action === 'import') {
      const sheets = (Array.isArray(body.sheets) ? body.sheets : []).slice(0, 20).map(s => ({
        name: clip(s && s.name, 60),
        aoa: (Array.isArray(s && s.aoa) ? s.aoa : []).slice(0, 6000).map(r => (Array.isArray(r) ? r : []).slice(0, 40).map(v => clip(v, 200))),
      }));
      const fileName = clip(body.fileName, 200);
      const p = require('../js/quality-parse.js').parseSheets(sheets, fileName);
      if (!p.rows.length) return res.status(200).json({ success: false, error: '목록 시트((PLU) 칸이 있는 단품·GIFT 시트)를 찾지 못했습니다.' });
      if (!p.batchNo) return res.status(200).json({ success: false, error: '차수를 찾지 못했습니다. 파일명에 "142차"처럼 차수를 넣어 주세요.' });
      body = { action: 'save', batch: { id: 'Q-' + p.batchNo, batchNo: p.batchNo, label: p.batchNo + '차', fileName, rows: p.rows, source: 'drive' } };
    }
    if (body.action === 'save') {
      const b = body.batch || {};
      const id = clip(b.id, 60);
      if (!/^Q-\d{1,4}(-[0-9A-Za-z가-힣_]{1,20}){0,2}$/.test(id)) return res.status(200).json({ success: false, error: '차수 정보가 올바르지 않습니다. (예: 142차 시험의뢰서.xlsx)' });
      const item = r => ({ plu: clip(r.plu, 20), name: clip(r.name, 200), lot: clip(r.lot, 40), date: clip(r.date, 10) });
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 5000).map(r => ({
        kind: r.kind === 'GIFT' ? 'GIFT' : '단품', ...item(r), qty: r.qty == null || r.qty === '' ? null : Number(r.qty) || 0, code: clip(r.code, 40),
        items: r.kind === 'GIFT' ? (Array.isArray(r.items) ? r.items : []).slice(0, 30).map(item) : undefined,
      }));
      const rec = { id, batchNo: clip(b.batchNo, 4), label: clip(b.label, 40), fileName: clip(b.fileName, 200), rows, source: b.source === 'drive' ? 'drive' : 'upload', uploadedAt: new Date().toISOString(), uploadedBy: user.id };
      await store.cmd(['HSET', QUALITY_KEY, id, JSON.stringify(rec)]);
      return res.status(200).json({ success: true, batch: { id, label: rec.label, rows: rows.length } });
    }
    return res.status(200).json({ success: false, error: 'Unsupported action' });
  } catch (e) {
    return res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
}

// 입고리스트 샘플(수입팀 상품 입고 CHECKLIST) 저장소(hash): 필드 = 차수 id(예: C-142) → { id, batchNo, label, country, orders, eta, info, sheets, cols, rows, etaHistory, fileName, modified, … }
//   rows: { sheet, plu, name, qty, values:{분배처:수량}, details:[{lot,date,ref,cs,qty}] }
//   같은 차수를 다시 받으면 교체. 실시간 입고 예정일이 바뀌면 etaHistory에 남김. 더 오래된 파일(modified가 이전)이 늦게 오면 무시
const CHECKLIST_KEY = 'lush_checklists_v1';
// 체크리스트가 바뀌면 입고 데이터(팀 공유 inbound)도 다시 만듦 — 실패해도 체크리스트 저장은 그대로(새벽 자동·동기화 버튼으로 보정)
async function syncInbound(store) {
  try { await Promise.race([require('./_lib/inbound-checklist').rebuild(store), new Promise(r => setTimeout(r, 8000))]); } catch (e) { console.error('inbound rebuild error', e); }
}
async function checklists(req, res, user) {
  const store = require('./_lib/auth').kv();
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  try {
    if (req.method === 'GET') {
      const arr = await store.cmd(['HGETALL', CHECKLIST_KEY]) || [];
      const batches = [];
      for (let i = 0; i < arr.length; i += 2) { try { batches.push(JSON.parse(arr[i + 1])); } catch (e) { /* 깨진 항목 무시 */ } }
      batches.sort((a, b) => String(b.eta || '').localeCompare(String(a.eta || '')) || (Number(b.batchNo) || 0) - (Number(a.batchNo) || 0));
      return res.status(200).json({ success: true, batches });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    if (body.action === 'delete') {
      if (user.role !== 'admin') return res.status(200).json({ success: false, error: '차수 삭제는 관리자만 할 수 있습니다.' });
      const id = clip(body.id, 60);
      if (!id) return res.status(200).json({ success: false, error: '삭제할 차수를 선택해 주세요.' });
      await store.cmd(['HDEL', CHECKLIST_KEY, id]);
      await syncInbound(store);
      return res.status(200).json({ success: true });
    }
    let p = null;
    if (body.action === 'import') {
      // 구글 드라이브(apps-script/quality-drive-sync.gs) 또는 화면 업로드: 시트 값을 받아 js/checklist-parse.js로 해석
      const sheets = (Array.isArray(body.sheets) ? body.sheets : []).slice(0, 30).map(s => ({
        name: clip(s && s.name, 60),
        aoa: (Array.isArray(s && s.aoa) ? s.aoa : []).slice(0, 4000).map(r => (Array.isArray(r) ? r : []).slice(0, 60).map(v => clip(v, 300))),
      }));
      p = require('../js/checklist-parse.js').parseSheets(sheets, clip(body.fileName, 300));
    } else if (body.action === 'save') {
      p = body.parsed || null; // 화면 업로드: 브라우저에서 해석한 결과
    }
    if (!p) return res.status(200).json({ success: false, error: 'Unsupported action' });
    if (!p.batchNo) return res.status(200).json({ success: false, error: '파일명에서 차수를 찾지 못했습니다. (예: … - 142차)_….xlsx)' });
    if (!Array.isArray(p.rows) || !p.rows.length) return res.status(200).json({ success: false, error: '분배 표(PLU · Description · 수량 · 리테일 …)를 찾지 못했습니다.' });
    const id = 'C-' + clip(p.batchNo, 4);
    const modified = clip(body.modified, 40);
    const oldRaw = await store.cmd(['HGET', CHECKLIST_KEY, id]);
    let old = null; try { old = oldRaw ? JSON.parse(oldRaw) : null; } catch (e) { old = null; }
    // 드라이브 자동 반영만: 더 오래된 파일이 늦게 와도 덮어쓰지 않음. 화면에서 직접 올린 파일은 항상 반영
    // (같은 파일명을 다시 보낸 경우는 해석 규칙이 바뀌었을 수 있으니 항상 반영)
    if (user.drive && old && old.modified && modified && modified < old.modified && old.fileName !== clip(body.fileName, 300)) return res.status(200).json({ success: true, skipped: true, reason: '이미 더 최근 파일이 반영되어 있습니다.', batch: { id, label: old.label } });
    const eta = clip(p.eta, 10);
    const etaHistory = (old && Array.isArray(old.etaHistory) ? old.etaHistory : []).slice(-20);
    if (old && old.eta && eta && old.eta !== eta) etaHistory.push({ from: old.eta, to: eta, at: new Date().toISOString(), file: clip(body.fileName, 200) });
    const num = v => Number(v) || 0;
    const rows = p.rows.slice(0, 5000).map(r => ({
      sheet: clip(r.sheet, 60), plu: clip(r.plu, 20), name: clip(r.name, 200), qty: num(r.qty),
      values: Object.fromEntries(Object.entries(r.values || {}).slice(0, 20).map(([k, v]) => [clip(k, 40), num(v)])),
      details: (Array.isArray(r.details) ? r.details : []).slice(0, 60).map(d => ({ lot: clip(d.lot, 40), date: clip(d.date, 10), ref: clip(d.ref, 40), cs: clip(d.cs, 20), qty: num(d.qty) })),
    }));
    const info = p.info || {};
    const rec = {
      id, batchNo: clip(p.batchNo, 4), label: clip(p.batchNo, 4) + '차' + (p.country ? ' ' + clip(p.country, 3) : ''), country: clip(p.country, 3), orders: clip(p.orders, 200),
      eta, fileDate: clip(p.fileDate, 10), etaHistory,
      info: { orders: clip(info.orders, 300), pallets: clip(info.pallets, 40), products: clip(info.products, 300), changes: clip(info.changes, 1000) },
      sheets: (Array.isArray(p.sheets) ? p.sheets : []).slice(0, 30).map(s => clip(s, 60)), cols: (Array.isArray(p.cols) ? p.cols : []).slice(0, 20).map(s => clip(s, 40)), rows,
      fileName: clip(body.fileName, 300), modified: user.drive || !old || !old.modified || modified > old.modified ? modified : old.modified, source: user.drive ? 'drive' : 'upload', uploadedAt: new Date().toISOString(), uploadedBy: user.id,
    };
    await store.cmd(['HSET', CHECKLIST_KEY, id, JSON.stringify(rec)]);
    await syncInbound(store); // 입고·월별 입고현황·입고 상세조회 데이터도 체크리스트로 다시 만듦
    return res.status(200).json({ success: true, batch: { id, label: rec.label, rows: rows.length, eta, etaChanged: !!(old && old.eta && old.eta !== eta) } });
  } catch (e) {
    return res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
}

// PLU별 제품코드·담당자(제품 마스터 엑셀): { updatedAt, updatedBy, fileName, map: { PLU: [[제품코드, 담당자, 제품명], ...] } } 한 덩어리로 보관
//   GET / POST {action:'save', fileName, map} — 새 파일을 올리면 통째로 교체
const PLU_KEY = 'lush_plu_master_v1';
const PLU_OVERRIDE_KEY = 'lush_plu_override_v1'; // hash: PLU → { mgr, by, at }
async function pluMaster(req, res, user) {
  const store = require('./_lib/auth').kv();
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  try {
    if (req.method === 'GET') {
      const raw = await store.cmd(['GET', PLU_KEY]);
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      // 화면에서 수기로 지정한 담당자(PLU별) — 마스터에 담당자가 없을 때 사용
      const arr = await store.cmd(['HGETALL', PLU_OVERRIDE_KEY]) || [];
      const overrides = {};
      for (let i = 0; i < arr.length; i += 2) { try { overrides[arr[i]] = JSON.parse(arr[i + 1]); } catch (e) { /* 무시 */ } }
      return res.status(200).json({ success: true, master: data, overrides });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    if (body.action === 'override') {
      const plu = clip(body.plu, 20).trim(), mgr = clip(body.mgr, 40).trim();
      if (!plu) return res.status(200).json({ success: false, error: 'PLU가 없습니다.' });
      if (!mgr) await store.cmd(['HDEL', PLU_OVERRIDE_KEY, plu]);
      else await store.cmd(['HSET', PLU_OVERRIDE_KEY, plu, JSON.stringify({ mgr, by: user.id, at: new Date().toISOString() })]);
      return res.status(200).json({ success: true });
    }
    if (body.action === 'save') {
      const map = {};
      Object.entries(body.map || {}).slice(0, 20000).forEach(([k, list]) => {
        const key = clip(k, 20).trim();
        if (!key || !Array.isArray(list)) return;
        map[key] = list.slice(0, 5).map(x => [clip(x && x[0], 40), clip(x && x[1], 40), clip(x && x[2], 120), clip(x && x[3], 60), clip(x && x[4], 10)]); // 제품코드·담당자·제품명·제품군·단위
      });
      if (!Object.keys(map).length) return res.status(200).json({ success: false, error: 'PLU 정보를 찾지 못했습니다.' });
      const rec = { updatedAt: new Date().toISOString(), updatedBy: user.id, fileName: clip(body.fileName, 200), count: Object.keys(map).length, map };
      await store.cmd(['SET', PLU_KEY, JSON.stringify(rec)]);
      await syncInbound(store); // 제품코드·제품군·단위가 바뀌었을 수 있으니 입고 데이터도 다시 만듦
      return res.status(200).json({ success: true, count: rec.count });
    }
    return res.status(200).json({ success: false, error: 'Unsupported action' });
  } catch (e) {
    return res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
}

// 구글 드라이브 자동 반영: Apps Script가 x-sync-secret 머리글로 보낸 품질리스트 'import'만 로그인 없이 허용
// (비밀값은 Vercel 환경변수 QUALITY_SYNC_SECRET과 Apps Script 스크립트 속성에 같은 값으로 넣음, 코드에는 두지 않음)
function driveSyncUser(req) {
  const expected = process.env.QUALITY_SYNC_SECRET || '';
  const given = String((req.headers && req.headers['x-sync-secret']) || '');
  if (!expected || expected.length < 16 || !given || req.method !== 'POST' || !req.query || ['quality-lists', 'checklists'].indexOf(req.query.part) < 0) return null;
  const crypto = require('crypto');
  const a = crypto.createHash('sha256').update(expected).digest(), b = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(a, b) ? { id: 'google-drive', role: 'editor', drive: true } : null;
}

module.exports = async (req, res) => {
  const drive = driveSyncUser(req);
  if (drive) {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    if (!body || body.action !== 'import') return res.status(200).json({ success: false, error: 'import만 허용됩니다.' });
    res.setHeader('Cache-Control', 'no-store');
    return req.query.part === 'checklists' ? checklists(req, res, drive) : qualityLists(req, res, drive);
  }
  // 로그인한 사람만(api/_lib/auth.js). 게스트는 보기만, 새벽 자동 동기화(Vercel cron)는 허용
  const authUser = await require('./_lib/auth').guard(req, res, { write: r => r.method !== 'GET' });
  if (!authUser) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  // 입고리스트(엑셀 입고 분배리스트)는 차수별로 따로 보관: /api/team-data?part=inbound-lists (팀 공유 데이터를 무겁게 하지 않도록 분리)
  if (req.query && req.query.part === 'inbound-lists') return inboundLists(req, res, authUser);
  // 품질리스트(시험의뢰서) · PLU별 제품코드/담당자
  if (req.query && req.query.part === 'quality-lists') return qualityLists(req, res, authUser);
  if (req.query && req.query.part === 'plu-master') return pluMaster(req, res, authUser);
  // 입고리스트 샘플(수입팀 상품 입고 CHECKLIST)
  if (req.query && req.query.part === 'checklists') return checklists(req, res, authUser);
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
