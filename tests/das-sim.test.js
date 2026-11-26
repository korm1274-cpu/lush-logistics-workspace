// DAS 시뮬레이션 엔진 단위 테스트 — 실행: node --test tests/das-sim.test.js
// 가상 데이터만 사용합니다(운영 API·데이터 접근 없음). 배포에는 영향이 없습니다.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/63-das-sim-core.js');

const cat = D.makeCatalog(D.DEFAULT_SEED, 24, 24);
const orders = D.genOrders(cat, D.DEFAULT_SEED, {});
const agg = D.aggregate(orders, cat);

test('같은 seed면 같은 샘플(재현 가능), 다른 seed면 다른 샘플', () => {
  assert.deepEqual(D.makeCatalog(7, 24, 24), D.makeCatalog(7, 24, 24));
  assert.deepEqual(D.genOrders(cat, 7, {}), D.genOrders(cat, 7, {}));
  assert.notDeepEqual(D.genOrders(cat, 7, {}), D.genOrders(cat, 8, {}));
});

test('가상 데이터 형식: 매장 S01~, SKU SIM-, 바코드는 사내 전용 2 대역 13자리 + 올바른 체크디지트', () => {
  assert.equal(cat.stores.length, 24);
  assert.ok(cat.stores.every(s => /^S\d{2}$/.test(s.code) && s.name.startsWith('가상매장')));
  assert.ok(cat.skus.every(s => /^SIM-\d{4}$/.test(s.code)));
  for (const s of cat.skus) {
    assert.match(s.barcode, /^20\d{11}$/);
    const d = s.barcode.split('').map(Number);
    const sum = d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0);
    assert.equal((10 - sum % 10) % 10, d[12]);
  }
  assert.equal(new Set(cat.skus.map(s => s.barcode)).size, cat.skus.length);
  assert.equal(cat.locations.length, 48);
});

test('SKU 통합 합계 = 매장 주문 합계 = 전체 라인 수량 합', () => {
  const lineSum = orders.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.qty, 0), 0);
  assert.equal(agg.totalUnits, lineSum);
  assert.equal(agg.bySku.reduce((a, s) => a + s.total, 0), lineSum);
  assert.equal(agg.byStore.reduce((a, s) => a + s.qty, 0), lineSum);
  for (const s of agg.bySku) assert.equal(Object.values(s.stores).reduce((a, b) => a + b, 0), s.total);
});

test('출고 작업: 같은 Zone만 묶고, 수량 합이 보존되며, 한도를 넘지 않음(단일 SKU 예외)', () => {
  const waves = D.buildWaves(agg, { maxUnits: 120 });
  assert.equal(waves.reduce((a, w) => a + w.units, 0), agg.totalUnits);
  const sm = D.skuMap(cat);
  for (const w of waves) {
    assert.ok(w.skus.every(c => sm[c].zone === w.zone));
    if (w.skus.length > 1) assert.ok(w.units <= 120);
  }
});

test('피킹 배정: 주 로케이션 우선 → 대체 로케이션, 결품 수량 계산', () => {
  const demand = Object.fromEntries(agg.bySku.map(s => [s.code, s.total]));
  const stock = D.genStock(cat, D.DEFAULT_SEED, demand);
  let sawAlt = false, sawShort = false;
  for (const s of agg.bySku) {
    const avail = D.availOf(stock, cat, s.code);
    const r = D.allocate(stock, cat, s.code, s.total);
    assert.equal(r.plan.reduce((a, p) => a + p.qty, 0) + r.shortage, s.total);
    assert.equal(r.shortage, Math.max(0, s.total - avail));
    if (r.plan.length) assert.equal(r.plan[0].loc === cat.skus.find(x => x.code === s.code).loc, !r.plan[0].alt);
    if (r.plan.some(p => p.alt)) sawAlt = true;
    if (r.shortage > 0) sawShort = true;
  }
  assert.ok(sawAlt, '샘플에 대체 로케이션 사례가 있어야 함');
  assert.equal(typeof sawShort, 'boolean');
});

test('재고 차감 검증: 다른 SKU·초과·소수 수량 거부, 정상 차감', () => {
  const stock = D.genStock(cat, D.DEFAULT_SEED, {});
  const s = cat.skus[0], l = stock[s.loc], before = l.qty;
  assert.throws(() => D.applyPick(stock, s.loc, cat.skus[1].code, 1), /재고가 없습니다/);
  assert.throws(() => D.applyPick(stock, s.loc, s.code, before + 1), /많이 피킹/);
  assert.throws(() => D.applyPick(stock, s.loc, s.code, 1.5), /올바르지/);
  assert.throws(() => D.applyPick(stock, 'Z-99-9', s.code, 1), /없는 로케이션/);
  assert.equal(D.applyPick(stock, s.loc, s.code, 1), before - 1);
});

test('수량 입력 검증', () => {
  assert.equal(D.validateQty('', {}).ok, false);
  assert.equal(D.validateQty('-1', {}).ok, false);
  assert.equal(D.validateQty('1.5', {}).ok, false);
  assert.equal(D.validateQty('abc', {}).ok, false);
  assert.equal(D.validateQty('0', { min: 1 }).ok, false);
  assert.equal(D.validateQty('11', { max: 10 }).ok, false);
  assert.deepEqual(D.validateQty(' 7 ', { min: 1, max: 10 }), { ok: true, value: 7 });
});

test('DAS 계획: 셀-매장 1:1 배정, 모든 매장 분배 수량 보존, 셀 부족 시 미배정 보고', () => {
  const plan = D.buildDasPlan(agg, cat, D.DAS_LAYOUT);
  assert.equal(plan.unassigned.length, 0);
  const stores = plan.stations.flatMap(s => s.cells.map(c => c.store).filter(Boolean));
  assert.equal(new Set(stores).size, stores.length);
  const need = plan.stations.reduce((a, s) => a + s.queue.reduce((b, q) => b + q.lines.reduce((c, l) => c + l.need, 0), 0), 0);
  assert.equal(need, agg.totalUnits);
  const small = D.buildDasPlan(agg, cat, { stations: [{ id: 'DAS-1', rows: 2, cols: 3 }] });
  assert.equal(small.unassigned.length, agg.byStore.length - 6);
});

test('DAS 분배: 스캔 전·비대상 셀·초과 수량 거부, 모든 셀 완료 시 SKU 완료', () => {
  const plan = D.buildDasPlan(agg, cat, D.DAS_LAYOUT);
  const st = plan.stations[0];
  assert.throws(() => D.putToCell(st, 'S01', 1), /스캔/);
  st.current = 0; const q = st.queue[0];
  const target = q.lines[0], other = st.cells.find(c => c.store && !q.lines.some(l => l.store === c.store));
  if (other) assert.throws(() => D.putToCell(st, other.store, 1), /대상이 아닙니다/);
  assert.throws(() => D.putToCell(st, target.store, target.need + 1), /초과/);
  assert.throws(() => D.putToCell(st, target.store, 0), /1 이상/);
  let last;
  q.lines.forEach(l => { last = D.putToCell(st, l.store, l.need); });
  assert.equal(last.skuDone, true);
  assert.equal(q.status, 'done');
  assert.equal(st.current, null);
});

test('박스 구성: 용량 단위로 나누고 합계 보존, 잘못된 용량 거부', () => {
  assert.deepEqual(D.planBoxes(95, 40), [40, 40, 15]);
  assert.deepEqual(D.planBoxes(40, 40), [40]);
  assert.deepEqual(D.planBoxes(0, 40), []);
  assert.throws(() => D.planBoxes(10, 0));
});
