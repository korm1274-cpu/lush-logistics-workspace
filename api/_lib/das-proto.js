// DAS 운영 시스템 시제품 — 업무 규칙(순수 함수). api/das-proto.js가 KV 저장과 함께 사용하고,
// tests/das-ops.test.js가 같은 규칙을 그대로 검증합니다.
//  - 실제 ERP·운영 재고와 연결하지 않는 테스트용 데이터만 다룹니다(예시 매장·예시 제품, 코드도 예시).
//  - 작업 기록에는 계정 ID·이름을 남기지 않고 역할(관리자/팀원)만 남깁니다.
//  - 모든 변경은 apply(state, op, role)로만 일어나며, 규칙 위반은 RuleError로 거부합니다.
'use strict';

const VERSION = 1;
const STORES = [
  ['S001', '명동점'], ['S002', '잠실점'], ['S003', '강남점'], ['S004', '홍대점'], ['S005', '신촌점'], ['S006', '여의도점'],
  ['S007', '판교점'], ['S008', '수원점'], ['S009', '대전점'], ['S010', '대구점'], ['S011', '서면점'], ['S012', '광주점']
];
const PRODUCTS = [
  ['L-1001', '인터갈락틱 배쓰 밤', '배쓰밤'], ['L-1003', '버터 베어 배쓰 밤', '배쓰밤'], ['L-1004', '씽크 핑크 배쓰 밤', '배쓰밤'],
  ['L-1005', '슬리피 바디로션', '보디'], ['L-1007', '더티 스프레이', '퍼퓸'], ['L-1008', '카마 솝', '솝'],
  ['L-1010', '허니 아이 워시드 더 키즈 솝', '솝'], ['L-1012', '로즈 잼', '샤워'], ['L-1013', '스노우 페어리 샤워젤', '샤워'],
  ['L-1015', '슬리피 바디워시', '샤워'], ['L-1017', '씨솔트 바디스크럽', '보디'], ['L-1019', '마스크 오브 매그너민티', '페이스']
];
const ZONES = ['A', 'B', 'C', 'D'];
const DAS_LAYOUT = [{ id: 'DAS-1', rows: 2, cols: 3 }, { id: 'DAS-2', rows: 2, cols: 3 }];
const DIFF_REASONS = ['수량 부족', '수량 초과', '파손', '제품 불일치', '기타'];
const SHORT_REASONS = ['재고 부족', '제품 파손', '로케이션 불일치', '기타'];
const MAX_QTY = 9999;

class RuleError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }
const fail = (msg, status) => { throw new RuleError(msg, status); };

function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pad = (n, w) => String(n).padStart(w || 2, '0');
const int = v => (typeof v === 'number' && Number.isInteger(v)) ? v : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN);
function qty(v, name, max) { const n = int(v); if (!Number.isInteger(n) || n < 0) fail((name || '수량') + '은(는) 0 이상의 정수여야 합니다.'); if (n > (max == null ? MAX_QTY : max)) fail((name || '수량') + '이(가) 허용 범위(' + (max == null ? MAX_QTY : max) + ')를 넘습니다.'); return n; }
function str(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }

// 바코드(제품 13자리, 사내 전용 2 대역 · 체크디지트 포함)
function ean(n) { const b = '20' + pad(n, 10); let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - s % 10) % 10); }

function kstDate(now) { const d = new Date((now || Date.now()) + 9 * 3600e3); return d.toISOString().slice(0, 10); }

// 예시 데이터(출고일 기준으로 항상 같은 샘플)
function seedState(now) {
  now = now || Date.now();
  const date = kstDate(now), seed = +date.replace(/-/g, '');
  const r = rng(seed);
  const locs = []; ZONES.forEach(z => { for (let k = 1; k <= 3; k++) for (let l = 1; l <= 2; l++) locs.push(z + '-' + pad(k) + '-' + l); });
  const skus = PRODUCTS.map((p, i) => ({ code: p[0], name: p[1], cat: p[2], barcode: ean(1000 + i + 1), loc: locs[i * 2], alt: i % 3 === 0 ? [locs[i * 2 + 1]] : [] }));
  const orders = STORES.map(([code]) => {
    const pool = skus.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const picks = pool.slice(0, ri(r, 4, 7));
    return { store: code, lines: picks.map(s => ({ sku: s.code, qty: ri(r, 2, 12) })).sort((a, b) => a.sku.localeCompare(b.sku)) };
  });
  const demand = {}; orders.forEach(o => o.lines.forEach(l => { demand[l.sku] = (demand[l.sku] || 0) + l.qty; }));
  const stock = {};
  skus.forEach((s, i) => {
    const d = demand[s.code] || 0;
    if (s.alt.length && i % 2 === 0) { stock[s.loc] = { sku: s.code, qty: Math.floor(d * 0.6) }; stock[s.alt[0]] = { sku: s.code, qty: d + 10 }; }
    else if (i === 4) stock[s.loc] = { sku: s.code, qty: Math.max(0, d - 3) }; // 결품 사례 1건(대체 로케이션 없음)
    else { stock[s.loc] = { sku: s.code, qty: d + ri(r, 5, 30) }; s.alt.forEach(a => { stock[a] = { sku: s.code, qty: ri(r, 10, 30) }; }); }
  });
  return {
    v: VERSION, rev: 1, date, createdAt: now, updatedAt: now,
    stores: STORES.map(([code, name]) => ({ code, name })), skus, stock, orders,
    wave: null, boxes: {}, seq: { box: 0 }, log: [{ at: now, role: 'system', action: 'seed', ref: date }]
  };
}

/* ───────── 조회 도우미 ───────── */
const skuOf = (s, code) => s.skus.find(x => x.code === code);
const storeOf = (s, code) => s.stores.find(x => x.code === code);
function demandOf(s) { const d = {}; s.orders.forEach(o => o.lines.forEach(l => { d[l.sku] = (d[l.sku] || 0) + l.qty; })); return d; }
function orderQty(s, store, sku) { const o = s.orders.find(x => x.store === store); const l = o && o.lines.find(x => x.sku === sku); return l ? l.qty : 0; }
function picked(s, sku) { return s.wave ? s.wave.tasks.filter(t => t.sku === sku).reduce((a, t) => a + t.picked, 0) : 0; }
function putQty(s, sku, store) { return (s.wave && s.wave.put[sku + '|' + store]) || 0; }
function putTotal(s, sku) { if (!s.wave) return 0; let n = 0; for (const k in s.wave.put) if (k.startsWith(sku + '|')) n += s.wave.put[k]; return n; }
function packed(s, store, sku, exceptBox) { let n = 0; for (const id in s.boxes) { const b = s.boxes[id]; if (b.store === store && id !== exceptBox) n += b.items[sku] || 0; } return n; }
function cellOf(s, store) { if (!s.wave) return null; for (const st of s.wave.das) { const i = st.cells.indexOf(store); if (i >= 0) return { station: st.id, idx: i }; } return null; }
function boxTotal(b) { return Object.values(b.items).reduce((a, n) => a + n, 0); }

function log(s, role, action, ref) { s.log.unshift({ at: Date.now(), role, action, ref }); if (s.log.length > 300) s.log.length = 300; }

/* ───────── 업무 동작 ───────── */
const OPS = {
  // 출고 작업 생성: Zone·로케이션 순 피킹 작업 + DAS 셀 배정
  'wave.create'(s, op, role) {
    if (s.wave) fail('이미 출고 작업이 생성되어 있습니다.', 409);
    if (!s.orders.length) fail('주문이 없습니다.');
    const d = demandOf(s), n = s.date.slice(2).replace(/-/g, '');
    const tasks = Object.keys(d).map(code => { const k = skuOf(s, code); return { id: '', sku: code, zone: k.loc[0], loc: k.loc, need: d[code], picked: 0, picks: [], status: 'wait', reason: '' }; })
      .sort((a, b) => a.loc.localeCompare(b.loc)).map((t, i) => Object.assign(t, { id: 'PK-' + pad(i + 1, 3) }));
    const stores = s.orders.map(o => o.store); let idx = 0;
    const das = DAS_LAYOUT.map(l => { const cells = []; for (let i = 0; i < l.rows * l.cols; i++) cells.push(stores[idx++] || null); return { id: l.id, rows: l.rows, cols: l.cols, cells }; });
    if (idx < stores.length) fail('DAS 셀이 부족합니다.');
    s.wave = { id: 'WV-' + n + '-01', createdAt: Date.now(), tasks, das, put: {}, dasDone: {} };
    log(s, role, 'wave.create', s.wave.id);
  },
  // 피킹 확정: 로케이션 재고에서 차감. short=true면 남은 수량을 결품으로 확정
  'pick.confirm'(s, op, role) {
    if (!s.wave) fail('출고 작업이 없습니다.');
    const t = s.wave.tasks.find(x => x.id === op.taskId); if (!t) fail('피킹 작업을 찾을 수 없습니다.', 404);
    if (t.status !== 'wait') fail('이미 확정된 피킹 작업입니다.', 409);
    const k = skuOf(s, t.sku), locs = [k.loc].concat(k.alt);
    const loc = str(op.loc, 20).toUpperCase().replace(/^LOC-/, '');
    if (!locs.includes(loc)) fail('로케이션 불일치: ' + loc + ' 에는 ' + t.sku + '이(가) 없습니다.');
    const st = s.stock[loc] || { qty: 0 };
    const q = qty(op.qty, '피킹 수량', Math.min(t.need - t.picked, st.qty));
    if (q > 0) { st.qty -= q; t.picked += q; t.picks.push({ loc, qty: q }); }
    if (t.picked >= t.need) t.status = 'done';
    else if (op.short) { const rs = str(op.reason, 20); if (!SHORT_REASONS.includes(rs)) fail('결품 사유를 선택해 주세요.'); t.status = 'short'; t.reason = rs; }
    log(s, role, 'pick.confirm', t.id + ' ' + loc + ' ' + q + (t.status === 'short' ? ' 결품' : ''));
  },
  // DAS 분배: 매장 셀에 투입. 피킹된 수량·매장 주문 수량을 넘을 수 없음
  'das.put'(s, op, role) {
    if (!s.wave) fail('출고 작업이 없습니다.');
    const sku = str(op.sku, 20), store = str(op.store, 10);
    if (!skuOf(s, sku)) fail('등록되지 않은 제품입니다.', 404);
    if (!cellOf(s, store)) fail('DAS 셀에 배정되지 않은 매장입니다.');
    if (s.wave.dasDone[sku]) fail('이미 분배가 마감된 제품입니다.', 409);
    const need = orderQty(s, store, sku); if (!need) fail('이 매장은 해당 제품 주문이 없습니다.');
    const leftStore = need - putQty(s, sku, store), leftPicked = picked(s, sku) - putTotal(s, sku);
    if (leftStore <= 0) fail('이미 분배가 끝난 셀입니다.', 409);
    const q = qty(op.qty, '분배 수량', Math.min(leftStore, leftPicked)); if (q < 1) fail('분배할 수 있는 피킹 수량이 없습니다.');
    s.wave.put[sku + '|' + store] = putQty(s, sku, store) + q;
    const d = demandOf(s)[sku];
    if (putTotal(s, sku) >= d) s.wave.dasDone[sku] = 'done';
    log(s, role, 'das.put', sku + ' → ' + store + ' ' + q);
  },
  // 피킹 결품 등으로 다 채울 수 없는 제품의 분배 마감
  'das.close'(s, op, role) {
    if (!s.wave) fail('출고 작업이 없습니다.');
    const sku = str(op.sku, 20); if (!skuOf(s, sku)) fail('등록되지 않은 제품입니다.', 404);
    if (s.wave.dasDone[sku]) fail('이미 분배가 마감된 제품입니다.', 409);
    const tasks = s.wave.tasks.filter(t => t.sku === sku);
    if (tasks.some(t => t.status === 'wait')) fail('피킹이 끝나지 않은 제품은 마감할 수 없습니다.');
    if (picked(s, sku) - putTotal(s, sku) > 0) fail('피킹된 수량을 먼저 모두 분배해 주세요.');
    s.wave.dasDone[sku] = 'short';
    log(s, role, 'das.close', sku + ' 결품 마감');
  },
  'box.create'(s, op, role) {
    if (!s.wave) fail('출고 작업이 없습니다.');
    const store = str(op.store, 10); if (!storeOf(s, store)) fail('없는 매장입니다.', 404);
    if (Object.values(s.boxes).some(b => b.store === store && b.status === 'open')) fail('이미 패킹 중인 박스가 있습니다. 먼저 마감해 주세요.', 409);
    s.seq.box++;
    const id = 'LB' + s.date.slice(2).replace(/-/g, '') + pad(s.seq.box, 4);
    s.boxes[id] = { id, no: 'BOX-' + pad(s.seq.box, 3), store, waveId: s.wave.id, kind: '정기 출고', status: 'open', items: {}, createdAt: Date.now(), closedAt: null, labelCount: 0, labeledAt: null, shippedAt: null, corrections: [], receipt: null };
    log(s, role, 'box.create', id + ' ' + store);
    return { boxId: id };
  },
  // 제품 수량 확정(열린 박스만): 매장 DAS 분류 수량 − 다른 박스에 담긴 수량까지
  'box.items'(s, op, role) {
    const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
    if (b.status !== 'open') fail('마감된 박스는 내품을 바꿀 수 없습니다. 관리자 정정을 이용해 주세요.', 409);
    b.items = checkItems(s, b, op.items);
    log(s, role, 'box.items', b.id + ' ' + boxTotal(b) + 'EA');
  },
  'box.close'(s, op, role) {
    const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
    if (b.status !== 'open') fail('이미 마감된 박스입니다.', 409);
    if (boxTotal(b) < 1) fail('내품이 등록되지 않은 박스는 마감할 수 없습니다.');
    b.status = 'closed'; b.closedAt = Date.now();
    log(s, role, 'box.close', b.id);
  },
  // 라벨 출력/재출력: 같은 박스 ID 유지, 출력 횟수만 증가
  'box.label'(s, op, role) {
    const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
    if (b.status === 'open') fail('박스 패킹 완료 후 라벨을 출력할 수 있습니다.');
    b.labelCount++; b.labeledAt = Date.now();
    log(s, role, 'box.label', b.id + (b.labelCount > 1 ? ' 재출력 ' + b.labelCount + '회' : ''));
  },
  'box.ship'(s, op, role) {
    const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
    if (b.status === 'open') fail('박스 패킹 완료 후 출고할 수 있습니다.');
    if (b.status !== 'closed') fail('이미 출고된 박스입니다.', 409);
    if (b.labelCount < 1) fail('라벨을 출력한 뒤 출고 확정할 수 있습니다.');
    b.status = 'shipped'; b.shippedAt = Date.now();
    log(s, role, 'box.ship', b.id);
  },
  // 마감 후 내품 정정: 관리자만, 사유 필수, 정정 이력 보존. 매장 입고 확정 후에는 불가
  'box.correct'(s, op, role) {
    if (role !== 'admin') fail('내품 정정은 관리자 승인이 필요합니다.', 403);
    const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
    if (b.status === 'open') fail('열린 박스는 정정 대신 수량 확정을 이용해 주세요.');
    if (b.status === 'received') fail('매장 입고가 확정된 박스는 정정할 수 없습니다.', 409);
    const reason = str(op.reason, 200); if (reason.length < 2) fail('정정 사유를 입력해 주세요.');
    const before = Object.assign({}, b.items), after = checkItems(s, b, op.items);
    if (Object.values(after).reduce((a, n) => a + n, 0) < 1) fail('정정 후 내품이 비어 있을 수 없습니다.');
    b.items = after;
    b.corrections.push({ at: Date.now(), role, reason, before, after });
    if (b.receipt && b.receipt.status === 'draft') b.receipt = null;
    log(s, role, 'box.correct', b.id);
  },
  // 매장 입고 검수 임시 저장
  'receipt.save'(s, op, role) {
    const b = receivable(s, op);
    b.receipt = Object.assign(b.receipt || {}, { status: 'draft', items: checkReceipt(s, b, op.items, false), attachments: [], savedAt: Date.now() });
    log(s, role, 'receipt.save', b.id);
  },
  // 매장 입고 검수 확정: 차이 사유 필수, 중복 확정 차단
  'receipt.confirm'(s, op, role) {
    const b = receivable(s, op);
    const items = checkReceipt(s, b, op.items, true);
    b.receipt = { status: 'confirmed', items, attachments: [], savedAt: Date.now(), confirmedAt: Date.now(), summary: summarize(b, items) };
    b.status = 'received';
    log(s, role, 'receipt.confirm', b.id + (b.receipt.summary.diffItems ? ' 차이 ' + b.receipt.summary.diffItems + '건' : ''));
  }
};

function receivable(s, op) {
  const b = s.boxes[str(op.boxId, 20)]; if (!b) fail('박스를 찾을 수 없습니다.', 404);
  if (str(op.store, 10) !== b.store) fail('다른 매장의 박스입니다. 로그인 매장을 확인해 주세요.', 403);
  if (b.status === 'received') fail('이미 입고 검수가 확정된 박스입니다.', 409);
  if (b.status !== 'shipped') fail('아직 출고 확정되지 않은 박스입니다.', 409);
  return b;
}
function checkItems(s, b, items) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) fail('내품 정보가 올바르지 않습니다.');
  const out = {};
  for (const sku of Object.keys(items).slice(0, 100)) {
    if (!skuOf(s, sku)) fail('등록되지 않은 제품입니다: ' + str(sku, 20));
    const max = putQty(s, sku, b.store) - packed(s, b.store, sku, b.id);
    const q = qty(items[sku], sku + ' 수량', Math.max(0, max));
    if (q > 0) out[sku] = q;
  }
  return out;
}
function checkReceipt(s, b, items, strict) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) fail('검수 정보가 올바르지 않습니다.');
  const out = {};
  for (const sku of Object.keys(b.items)) {
    const it = items[sku] || {}, shipped = b.items[sku];
    const has = it.received !== '' && it.received != null;
    if (!has) { if (strict) fail(sku + ' 실제 입고 수량을 입력해 주세요.'); continue; }
    const received = qty(it.received, sku + ' 입고 수량'), damaged = qty(it.damaged == null || it.damaged === '' ? 0 : it.damaged, sku + ' 파손 수량', received);
    const reason = str(it.reason, 20), memo = str(it.memo, 200);
    if (reason && !DIFF_REASONS.includes(reason)) fail('차이 사유가 올바르지 않습니다.');
    if (strict && (received !== shipped || damaged > 0) && !reason) fail(sku + ' 수량 차이(또는 파손) 사유를 선택해 주세요.');
    out[sku] = { received, damaged, reason, memo };
  }
  return out;
}
function summarize(b, items) {
  const r = { shipped: 0, received: 0, normal: 0, short: 0, over: 0, damaged: 0, diffItems: 0 };
  for (const sku of Object.keys(b.items)) {
    const sh = b.items[sku], it = items[sku] || { received: 0, damaged: 0 };
    r.shipped += sh; r.received += it.received; r.damaged += it.damaged; r.normal += Math.max(0, Math.min(sh, it.received) - it.damaged);
    if (it.received < sh) r.short += sh - it.received; if (it.received > sh) r.over += it.received - sh;
    if (it.received !== sh || it.damaged > 0) r.diffItems++;
  }
  return r;
}

// 하나의 변경 요청 적용(상태 복사본에 적용 → 성공 시에만 반영)
function apply(state, op, role) {
  if (!op || typeof op !== 'object') fail('잘못된 요청입니다.');
  const fn = OPS[op.action]; if (!fn) fail('지원하지 않는 작업입니다.');
  if (!state) fail('먼저 예시 출고 데이터를 불러와 주세요.', 409);
  const s = JSON.parse(JSON.stringify(state));
  const extra = fn(s, op, role === 'admin' ? 'admin' : 'member') || {};
  s.rev = (s.rev || 0) + 1; s.updatedAt = Date.now();
  return { state: s, result: extra };
}

module.exports = { VERSION, STORES, PRODUCTS, DAS_LAYOUT, DIFF_REASONS, SHORT_REASONS, RuleError, seedState, apply, summarize, kstDate, ean, helpers: { demandOf, orderQty, picked, putQty, putTotal, packed, cellOf, boxTotal } };
