// DAS 운영 시스템 시제품 테스트 — 실행: node --test tests/das-ops.test.js
//  1) 업무 규칙(api/_lib/das-proto.js)  2) API 핸들러(api/das-proto.js: 권한·잠금·저장, 메모리 KV 사용)  3) Code 128 라벨 바코드
// 예시 데이터만 사용하며 운영 서버·KV에 접속하지 않습니다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const P = require('../api/_lib/das-proto.js');
const H = P.helpers;

const NOW = Date.UTC(2026, 10, 27, 1);
function run(s, op, role) { return P.apply(s, op, role || 'member'); }
function flow() {
  let s = P.seedState(NOW);
  const A = (op, role) => { const r = run(s, op, role); s = r.state; return r.result; };
  A({ action: 'wave.create' });
  for (const t of s.wave.tasks) {
    const k = s.skus.find(x => x.code === t.sku), locs = [k.loc, ...k.alt];
    for (let i = 0; i < locs.length; i++) {
      const tt = s.wave.tasks.find(x => x.id === t.id); if (tt.status !== 'wait') break;
      const st = s.stock[locs[i]], q = Math.min(tt.need - tt.picked, st ? st.qty : 0), last = i === locs.length - 1;
      A({ action: 'pick.confirm', taskId: t.id, loc: locs[i], qty: q, short: last && q < tt.need - tt.picked, reason: '재고 부족' });
    }
  }
  for (const o of s.orders) for (const l of o.lines) { const q = Math.min(l.qty, H.picked(s, l.sku) - H.putTotal(s, l.sku)); if (q > 0) A({ action: 'das.put', sku: l.sku, store: o.store, qty: q }); }
  for (const t of s.wave.tasks) if (!s.wave.dasDone[t.sku]) A({ action: 'das.close', sku: t.sku });
  return { get s() { return s; }, A };
}
function packStore(f, store) {
  const { boxId } = f.A({ action: 'box.create', store });
  const items = {}; f.s.orders.find(o => o.store === store).lines.forEach(l => { const q = H.putQty(f.s, l.sku, store); if (q) items[l.sku] = q; });
  f.A({ action: 'box.items', boxId, items });
  return boxId;
}

/* ───────── 1. 업무 규칙 ───────── */
test('예시 데이터: 같은 날짜면 같은 샘플, 매장 12곳·제품 12종, 바코드 체크디지트', () => {
  assert.deepEqual(P.seedState(NOW).orders, P.seedState(NOW).orders);
  const s = P.seedState(NOW);
  assert.equal(s.stores.length, 12); assert.equal(s.skus.length, 12); assert.equal(s.date, '2026-11-27');
  for (const k of s.skus) { const d = k.barcode.split('').map(Number); assert.equal((10 - d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0) % 10) % 10, d[12]); }
  assert.ok(s.log.every(l => !('user' in l) && !('id' in l)), '작업 기록에 계정 정보 없음');
});

test('출고 작업 생성: 수요 합계 보존, 로케이션 순, DAS 셀 1매장 1셀, 중복 생성 차단', () => {
  let s = P.seedState(NOW); s = run(s, { action: 'wave.create' }).state;
  const d = H.demandOf(s);
  assert.equal(s.wave.tasks.reduce((a, t) => a + t.need, 0), Object.values(d).reduce((a, b) => a + b, 0));
  assert.deepEqual(s.wave.tasks.map(t => t.loc), s.wave.tasks.map(t => t.loc).slice().sort());
  const cells = s.wave.das.flatMap(x => x.cells).filter(Boolean);
  assert.equal(new Set(cells).size, s.orders.length);
  assert.throws(() => run(s, { action: 'wave.create' }), /이미 출고 작업/);
});

test('피킹: 로케이션 불일치·재고 초과·사유 없는 결품 거부, 재고 차감, 대체 로케이션', () => {
  let s = run(P.seedState(NOW), { action: 'wave.create' }).state;
  const t = s.wave.tasks.find(x => s.skus.find(k => k.code === x.sku).alt.length && s.stock[x.loc].qty < x.need);
  assert.ok(t, '샘플에 대체 로케이션 사례 필요');
  const k = s.skus.find(x => x.code === t.sku), primary = s.stock[t.loc].qty;
  assert.throws(() => run(s, { action: 'pick.confirm', taskId: t.id, loc: 'Z-99-9', qty: 1 }), /불일치/);
  assert.throws(() => run(s, { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: primary + 1 }), /허용 범위/);
  assert.throws(() => run(s, { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: '1.5' }), /정수/);
  assert.throws(() => run(s, { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: primary, short: true }), /결품 사유/);
  s = run(s, { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: primary }).state;
  assert.equal(s.stock[t.loc].qty, 0); assert.equal(s.wave.tasks.find(x => x.id === t.id).status, 'wait');
  s = run(s, { action: 'pick.confirm', taskId: t.id, loc: 'loc-' + k.alt[0].toLowerCase(), qty: t.need - primary }).state;
  const t2 = s.wave.tasks.find(x => x.id === t.id);
  assert.equal(t2.status, 'done'); assert.deepEqual(t2.picks.map(p => p.loc), [t.loc, k.alt[0]]);
  assert.throws(() => run(s, { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: 0 }), /이미 확정/);
});

test('DAS: 피킹 수량·매장 주문 초과 분배 거부, 결품 제품은 결품 마감', () => {
  const f = flow(), s = f.s;
  assert.ok(Object.values(s.wave.dasDone).includes('short'), '결품 마감 사례');
  for (const sku of Object.keys(H.demandOf(s))) assert.ok(H.putTotal(s, sku) <= H.picked(s, sku));
  for (const o of s.orders) for (const l of o.lines) assert.ok(H.putQty(s, l.sku, o.store) <= l.qty);
  let s0 = run(P.seedState(NOW), { action: 'wave.create' }).state;
  const l0 = s0.orders[0].lines[0];
  assert.throws(() => run(s0, { action: 'das.put', sku: l0.sku, store: s0.orders[0].store, qty: 1 }), /피킹 수량이 없습니다|허용 범위/);
  const other = s0.stores.find(st => !s0.orders.find(o => o.store === st.code).lines.some(l => l.sku === l0.sku));
  if (other) assert.throws(() => run(s0, { action: 'das.put', sku: l0.sku, store: other.code, qty: 1 }), /주문이 없습니다/);
  assert.throws(() => run(s0, { action: 'das.close', sku: l0.sku }), /피킹이 끝나지 않은/);
});

test('박스: 내품 없는 마감 거부, 마감 후 수정 금지, 라벨 전 출고 금지, 재출력 시 같은 ID', () => {
  const f = flow();
  const { boxId } = f.A({ action: 'box.create', store: 'S002' });
  assert.match(boxId, /^LB261127\d{4}$/); assert.equal(f.s.boxes[boxId].no, 'BOX-001');
  assert.throws(() => f.A({ action: 'box.create', store: 'S002' }), /패킹 중인 박스/);
  assert.throws(() => f.A({ action: 'box.close', boxId }), /내품이 등록되지 않은/);
  const sku = f.s.orders.find(o => o.store === 'S002').lines.find(l => H.putQty(f.s, l.sku, 'S002') > 0).sku, max = H.putQty(f.s, sku, 'S002');
  assert.throws(() => f.A({ action: 'box.items', boxId, items: { [sku]: max + 1 } }), /허용 범위/);
  assert.throws(() => f.A({ action: 'box.items', boxId, items: { 'L-9999': 1 } }), /등록되지 않은/);
  f.A({ action: 'box.items', boxId, items: { [sku]: max } });
  assert.throws(() => f.A({ action: 'box.label', boxId }), /패킹 완료 후/);
  f.A({ action: 'box.close', boxId });
  assert.throws(() => f.A({ action: 'box.items', boxId, items: { [sku]: 1 } }), /마감된 박스/);
  assert.throws(() => f.A({ action: 'box.ship', boxId }), /라벨을 출력한 뒤/);
  f.A({ action: 'box.label', boxId }); f.A({ action: 'box.label', boxId });
  assert.equal(f.s.boxes[boxId].labelCount, 2); assert.equal(Object.keys(f.s.boxes).length, 1, '재출력해도 새 박스 없음');
  f.A({ action: 'box.ship', boxId });
  assert.throws(() => f.A({ action: 'box.ship', boxId }), /이미 출고/);
  // 다른 박스에 같은 제품을 다시 담을 수 없음(이미 모두 패킹)
  const b2 = f.A({ action: 'box.create', store: 'S002' }).boxId;
  assert.throws(() => f.A({ action: 'box.items', boxId: b2, items: { [sku]: 1 } }), /허용 범위/);
});

test('내품 정정: 관리자만·사유 필수·이력 보존, 입고 확정 후 불가', () => {
  const f = flow(); const boxId = packStore(f, 'S003'); f.A({ action: 'box.close', boxId });
  const items = Object.assign({}, f.s.boxes[boxId].items), k = Object.keys(items)[0]; items[k] -= 1;
  assert.throws(() => f.A({ action: 'box.correct', boxId, items, reason: '재검수' }, 'member'), /관리자 승인/);
  assert.throws(() => f.A({ action: 'box.correct', boxId, items, reason: '' }, 'admin'), /정정 사유/);
  f.A({ action: 'box.correct', boxId, items, reason: '재검수 1EA 누락' }, 'admin');
  const c = f.s.boxes[boxId].corrections[0];
  assert.equal(c.role, 'admin'); assert.equal(c.before[k] - 1, c.after[k]); assert.ok(!('user' in c));
  f.A({ action: 'box.label', boxId }); f.A({ action: 'box.ship', boxId });
  const ri = {}; Object.keys(f.s.boxes[boxId].items).forEach(x => { ri[x] = { received: f.s.boxes[boxId].items[x] }; });
  f.A({ action: 'receipt.confirm', boxId, store: 'S003', items: ri });
  assert.throws(() => f.A({ action: 'box.correct', boxId, items, reason: '사후 정정' }, 'admin'), /입고가 확정된/);
});

test('매장 입고: 출고 전·다른 매장 거부, 차이 사유 필수, 요약 계산, 중복 확정 차단(409)', () => {
  const f = flow(); const boxId = packStore(f, 'S002'); f.A({ action: 'box.close', boxId });
  const b = () => f.s.boxes[boxId], skus = Object.keys(b().items);
  assert.throws(() => f.A({ action: 'receipt.save', boxId, store: 'S002', items: {} }), /출고 확정되지 않은/);
  f.A({ action: 'box.label', boxId }); f.A({ action: 'box.ship', boxId });
  assert.throws(() => f.A({ action: 'receipt.confirm', boxId, store: 'S001', items: {} }), /다른 매장/);
  const items = {}; skus.forEach(k => { items[k] = { received: b().items[k], damaged: 0, reason: '' }; });
  items[skus[0]].received = b().items[skus[0]] - 1;
  if (skus[1]) { items[skus[1]].damaged = 1; }
  assert.throws(() => f.A({ action: 'receipt.confirm', boxId, store: 'S002', items }), /사유를 선택/);
  f.A({ action: 'receipt.save', boxId, store: 'S002', items });
  assert.equal(b().receipt.status, 'draft'); assert.equal(b().status, 'shipped');
  items[skus[0]].reason = '수량 부족'; if (skus[1]) items[skus[1]].reason = '파손';
  assert.throws(() => f.A({ action: 'receipt.confirm', boxId, store: 'S002', items: Object.assign({}, items, { [skus[0]]: Object.assign({}, items[skus[0]], { damaged: 999 }) }) }), /허용 범위/);
  f.A({ action: 'receipt.confirm', boxId, store: 'S002', items });
  const sm = b().receipt.summary, shipped = Object.values(b().items).reduce((a, n) => a + n, 0);
  assert.equal(b().status, 'received'); assert.equal(sm.shipped, shipped); assert.equal(sm.received, shipped - 1);
  assert.equal(sm.short, 1); assert.equal(sm.over, 0); assert.equal(sm.damaged, skus[1] ? 1 : 0);
  assert.equal(sm.normal, shipped - 1 - sm.damaged); assert.equal(sm.diffItems, skus[1] ? 2 : 1);
  try { f.A({ action: 'receipt.confirm', boxId, store: 'S002', items }); assert.fail('중복 확정'); } catch (e) { assert.equal(e.status, 409); assert.match(e.message, /이미 입고 검수가 확정/); }
});

test('잘못된 요청: 지원하지 않는 작업, 데이터 없음, 이상한 입력', () => {
  assert.throws(() => P.apply(P.seedState(NOW), { action: 'drop.all' }, 'admin'), /지원하지 않는/);
  assert.throws(() => P.apply(null, { action: 'wave.create' }, 'admin'), /예시 출고 데이터/);
  const s = run(P.seedState(NOW), { action: 'wave.create' }).state;
  assert.throws(() => P.apply(s, { action: 'box.items', boxId: 'X', items: [] }, 'member'), /박스를 찾을 수 없습니다/);
  const before = JSON.stringify(s); try { P.apply(s, { action: 'pick.confirm', taskId: s.wave.tasks[0].id, loc: s.wave.tasks[0].loc, qty: -1 }, 'member'); } catch (e) { /* 거부 */ }
  assert.equal(JSON.stringify(s), before, '실패한 요청은 상태를 바꾸지 않음');
});

/* ───────── 2. API 핸들러(메모리 KV + 가짜 로그인) ───────── */
function memKv() {
  const m = new Map();
  const cmd = async (a) => {
    await new Promise(r => setImmediate(r));
    const [c, k] = a;
    if (c === 'GET') return m.has(k) ? m.get(k) : null;
    if (c === 'SET') { if (a.includes('NX') && m.has(k)) return null; m.set(k, a[2]); return 'OK'; }
    if (c === 'DEL') { m.delete(k); return 1; }
    if (c === 'EVAL') { const key = a[3], tok = a[4]; if (m.get(key) === tok) { m.delete(key); return 1; } return 0; }
    throw new Error('unsupported ' + c);
  };
  return { m, store: { cmd, async getJSON(k) { const v = await cmd(['GET', k]); return v == null ? null : JSON.parse(v); }, async setJSON(k, v) { return cmd(['SET', k, JSON.stringify(v)]); }, async del(k) { return cmd(['DEL', k]); } } };
}
function loadHandler(kv) {
  const authPath = path.join(__dirname, '..', 'api', '_lib', 'auth.js'), hPath = path.join(__dirname, '..', 'api', 'das-proto.js');
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
    kv: () => kv.store,
    guard: async (req, res, opts) => { const role = req.headers['x-role']; if (!role) { res.status(401).json({ success: false }); return null; } const w = typeof opts.write === 'function' ? opts.write(req) : opts.write; if (w && role === 'guest') { res.status(403).json({ success: false, error: '게스트는 저장할 수 없습니다.' }); return null; } return { id: 'x', role }; }
  } };
  delete require.cache[hPath];
  return require(hPath);
}
function call(h, method, role, body, query) {
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(j) { resolve({ status: this.code, body: j }); return this; } };
    h({ method, headers: role ? { 'x-role': role } : {}, body, query: query || {} }, res);
  });
}

test('API: 로그인·권한(게스트 저장 불가, 초기화는 관리자만), 저장·조회, 박스 조회', async () => {
  const kv = memKv(), h = loadHandler(kv);
  assert.equal((await call(h, 'GET', null)).status, 401);
  assert.equal((await call(h, 'POST', 'guest', { action: 'seed' })).status, 403);
  const seeded = await call(h, 'POST', 'member', { action: 'seed' });
  assert.equal(seeded.status, 200); assert.ok(kv.m.has('lush_dasproto_v1:state'));
  assert.deepEqual([...kv.m.keys()].filter(k => !k.startsWith('lush_dasproto_v1:')), [], '전용 키만 사용');
  assert.equal((await call(h, 'POST', 'member', { action: 'wave.create' })).status, 200);
  const again = await call(h, 'POST', 'member', { action: 'seed' }); assert.equal(again.status, 409);
  assert.equal((await call(h, 'POST', 'member', { action: 'reset' })).status, 403);
  const g = await call(h, 'GET', 'guest'); assert.equal(g.status, 200); assert.ok(g.body.data.wave);
  const bad = await call(h, 'POST', 'member', 'x'.repeat(70000)); assert.equal(bad.status, 400);
  const bad2 = await call(h, 'POST', 'member', { action: 'pick.confirm', taskId: 'nope' }); assert.equal(bad2.status, 404); assert.match(bad2.body.error, /찾을 수 없습니다/);
  const created = await call(h, 'POST', 'member', { action: 'box.create', store: 'S002' });
  const id = created.body.result.boxId;
  const byId = await call(h, 'GET', 'member', null, { action: 'box', id, store: 'S002' }); assert.equal(byId.body.box.id, id);
  const byNo = await call(h, 'GET', 'member', null, { action: 'box', id: 'box-001', store: 'S002' }); assert.equal(byNo.body.box.id, id);
  const other = await call(h, 'GET', 'member', null, { action: 'box', id, store: 'S001' }); assert.equal(other.status, 403);
  const rev = await call(h, 'GET', 'member', null, { action: 'rev' }); assert.equal(rev.body.rev, created.body.data.rev);
  assert.equal((await call(h, 'POST', 'admin', { action: 'reset' })).status, 200); assert.ok(!kv.m.has('lush_dasproto_v1:state'));
});

test('API: 여러 기기가 동시에 저장해도 변경이 사라지지 않음(잠금)', async () => {
  const kv = memKv(), h = loadHandler(kv);
  await call(h, 'POST', 'member', { action: 'seed' }); await call(h, 'POST', 'member', { action: 'wave.create' });
  const s0 = (await call(h, 'GET', 'member')).body.data;
  const ops = s0.wave.tasks.map(t => call(h, 'POST', 'member', { action: 'pick.confirm', taskId: t.id, loc: t.loc, qty: 1 }));
  const res = await Promise.all(ops);
  assert.ok(res.every(r => r.status === 200), res.map(r => r.status).join(','));
  const s1 = (await call(h, 'GET', 'member')).body.data;
  assert.ok(s1.wave.tasks.every(t => t.picked === 1), '동시 피킹 확정 모두 반영');
  assert.equal(s1.rev, s0.rev + s0.wave.tasks.length);
  assert.ok(!kv.m.has('lush_dasproto_v1:lock'), '잠금 해제');
});

/* ───────── 3. Code 128 라벨 바코드 ───────── */
function loadCore() {
  const noop = () => {};
  const doc = { readyState: 'complete', addEventListener: noop, getElementById: () => null, querySelector: () => null, createElement: () => ({}), body: {}, head: {} };
  const win = { document: doc, console, setTimeout: () => 0, setInterval: () => 0, localStorage: { getItem: () => null, setItem: noop } };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', '63-das-ops-core.js'), 'utf8'), Object.assign(win, { window: win, setTimeout: () => 0 }));
  return win.DasOps;
}
// 위키백과 Code 128 표(0~106)에서 옮긴 기준값 — 코어의 표와 독립적으로 대조
const WIKI = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');

test('Code 128: 표가 표준과 일치, 각 심볼 11모듈·바 패리티 짝수, 체크섬, 디코드 왕복', () => {
  const O = loadCore();
  assert.deepEqual(Array.from(O.C128), WIKI);
  O.C128.slice(0, 106).forEach((p, i) => { const w = p.split('').map(Number); assert.equal(w.reduce((a, b) => a + b, 0), 11, 'v' + i); assert.equal((w[0] + w[2] + w[4]) % 2, 0, 'parity v' + i); });
  assert.equal(new Set(O.C128).size, 107);
  const id = 'LB2611270001', vals = O.code128Values(id);
  assert.equal(vals[0], 104); assert.equal(vals[vals.length - 1], 106);
  const body = vals.slice(1, -2), chk = (104 + body.reduce((a, v, i) => a + v * (i + 1), 0)) % 103;
  assert.equal(vals[vals.length - 2], chk);
  // SVG의 막대(rect)만으로 다시 읽기: 막대/공백 폭 → 심볼 → 문자
  const svg = O.code128Svg(id), rects = [...svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)"/g)].map(m => [+m[1], +m[2]]);
  const widths = []; for (let i = 0; i < rects.length; i++) { widths.push(rects[i][1]); if (i < rects.length - 1) widths.push(rects[i + 1][0] - rects[i][0] - rects[i][1]); }
  assert.equal(rects[0][0], 10, '왼쪽 여백 10모듈');
  const syms = []; for (let i = 0; i + 6 <= widths.length; i += 6) syms.push(widths.slice(i, i + 6).join(''));
  const decoded = syms.map(p => WIKI.findIndex(w => w.startsWith(p)));
  assert.equal(decoded[0], 104);
  const text = decoded.slice(1, -2).map(v => String.fromCharCode(v + 32)).join('');
  assert.equal(text, id);
  assert.throws(() => O.code128Values('한글'), /표현할 수 없는/);
});
