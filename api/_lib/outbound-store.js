// api/_lib/outbound-store.js
// 출고 상세를 달(YYYY-MM)별 키로 나눠 Vercel KV(Upstash)에 저장·조회하는 공통 함수.
// (파일 이름이 _ 로 시작하는 폴더는 Vercel이 API 주소로 만들지 않습니다.)
//
// 키 구성
//   lush_outbound_index_v1          → { meta, months: { 'YYYY-MM': { hash, count, updatedAt } } }
//   lush_outbound_month_v1:YYYY-MM  → [[출고일자, 제품코드, 제품군, 제품명, 단위, 수량], ...]
//
// hash는 그 달 행 내용으로 계산한 값입니다. 내용이 같으면 다시 저장하지 않고 updatedAt도 바꾸지 않아서,
// 화면은 hash가 달라진 달만 새로 받으면 됩니다.

const INDEX_KEY = 'lush_outbound_index_v1';
const MONTH_PREFIX = 'lush_outbound_month_v1:';
const TIMEOUT_MS = 8000;
const HEADER = ['출고일자', '제품코드', '제품군', '제품명', '단위', '수량'];

function isMonth(m) { return /^\d{4}-\d{2}$/.test(String(m || '')); }

// 행 내용으로 만드는 짧은 지문(FNV-1a 32bit). 화면(index.html)에서도 같은 방식으로 계산합니다.
function hashRows(rows) {
  const s = JSON.stringify(rows || []);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ':' + (rows || []).length;
}

function client(url, token) {
  const call = (path, options = {}) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(`${url}/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }, signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
  };
  return {
    async get(key) {
      const r = await call(`get/${encodeURIComponent(key)}`);
      const j = await r.json();
      if (!j || j.result == null) return null;
      try { return JSON.parse(j.result); } catch { return null; }
    },
    async set(key, value) {
      const r = await call(`set/${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(value) });
      if (!r.ok) throw new Error(`KV 저장 실패(${key}): ${await r.text()}`);
    },
    async del(key) {
      await call(`del/${encodeURIComponent(key)}`, { method: 'POST' });
    }
  };
}

async function readIndex(kv) {
  const idx = await kv.get(INDEX_KEY);
  return idx && typeof idx === 'object' ? { meta: idx.meta || null, months: idx.months || {} } : { meta: null, months: {} };
}

async function readMonth(kv, month) {
  const rows = await kv.get(MONTH_PREFIX + month);
  return Array.isArray(rows) ? rows : [];
}

// monthsMap: { 'YYYY-MM': rows[] } 를 저장. 내용이 바뀐 달만 씁니다.
// options.keepOnly: 이 목록에 없는 달은 목록표와 저장소에서 지웁니다(시트 전체 동기화 때 사용).
async function writeMonths(kv, monthsMap, meta, options = {}) {
  const index = await readIndex(kv);
  const now = new Date().toISOString();
  const written = [], unchanged = [], removed = [];
  for (const month of Object.keys(monthsMap).sort()) {
    if (!isMonth(month)) continue;
    const rows = monthsMap[month] || [];
    const hash = hashRows(rows);
    const prev = index.months[month];
    if (prev && prev.hash === hash) { unchanged.push(month); continue; }
    await kv.set(MONTH_PREFIX + month, rows);
    index.months[month] = { hash, count: rows.length, updatedAt: now };
    written.push(month);
  }
  // options.pruneBefore('YYYY-MM'): 이 달보다 오래된 달만 지움(시트에서 보관함으로 옮긴 최근 달은 유지)
  if (options.pruneBefore && isMonth(options.pruneBefore)) {
    for (const month of Object.keys(index.months)) {
      if (month >= options.pruneBefore) continue;
      await kv.del(MONTH_PREFIX + month);
      delete index.months[month];
      removed.push(month);
    }
  }
  if (Array.isArray(options.keepOnly)) {
    const keep = new Set(options.keepOnly);
    for (const month of Object.keys(index.months)) {
      if (keep.has(month)) continue;
      await kv.del(MONTH_PREFIX + month);
      delete index.months[month];
      removed.push(month);
    }
  }
  index.meta = { header: HEADER, ...(index.meta || {}), ...(meta || {}), updatedAt: (written.length || removed.length) ? now : ((index.meta && index.meta.updatedAt) || now) };
  await kv.set(INDEX_KEY, index);
  return { written, unchanged, removed };
}

// 행 배열을 달별로 나눔
function splitByMonth(rows) {
  const map = {};
  (rows || []).forEach(r => {
    const m = String((r && r[0]) || '').slice(0, 7);
    if (!isMonth(m)) return;
    (map[m] = map[m] || []).push(r);
  });
  return map;
}

module.exports = { INDEX_KEY, MONTH_PREFIX, HEADER, isMonth, hashRows, client, readIndex, readMonth, writeMonths, splitByMonth };
