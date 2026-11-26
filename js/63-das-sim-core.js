/* DAS 시뮬레이션 — 공통 엔진 (js/63-das-sim-core.js)
   - 운영 데이터와 완전히 분리된 가상 데이터만 사용합니다(GREEN).
     · 매장 S01~ / SKU SIM-1001~ / 바코드 20…(사내 전용 대역) / 작업자 W01~
     · 서버 API·운영 KV·기존 localStorage 키를 읽거나 쓰지 않습니다. 저장은 'lush_dassim_v1:' 키만 사용합니다.
   - 6개 모듈(js/64~69)은 서로 독립된 상태를 가지며, 이 파일의 순수 함수(데이터 생성·집계·배정·검증)와
     타이머 엔진·화면 공통 요소를 함께 씁니다.
   - 순수 함수는 Node 단위 테스트(tests/das-sim.test.js)에서도 require 할 수 있습니다. */
(function (root) {
  'use strict';

  var STORE_PREFIX = 'lush_dassim_v1:';
  var ZONES = ['A', 'B', 'C', 'D'];
  var CATS = ['배쓰밤', '버블바', '솝', '샤워젤', '샴푸바', '보디로션', '페이스마스크', '기프트'];
  var REGIONS = ['수도권', '수도권', '수도권', '영남', '호남', '충청', '강원'];
  var DEFAULT_SEED = 1101;

  /* ───────── 기본 유틸 ───────── */
  function rng(seed) { // mulberry32: 같은 seed → 같은 샘플
    var a = (Number(seed) >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(r, min, max) { return min + Math.floor(r() * (max - min + 1)); }
  function shuffle(r, arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sum(arr, fn) { var s = 0; for (var i = 0; i < arr.length; i++) s += fn ? fn(arr[i]) : arr[i]; return s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function pct(done, total) { return total > 0 ? Math.min(100, Math.round(done / total * 1000) / 10) : 0; }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + '시간 ' + pad(m) + '분' : m ? m + '분 ' + pad(s) + '초' : s + '초';
  }

  /* 수량 입력 검증: 0 이상 정수, 범위 확인 → { ok, value, error } */
  function validateQty(raw, opt) {
    opt = opt || {};
    var min = opt.min == null ? 0 : opt.min, max = opt.max;
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: false, error: '수량을 입력해 주세요.' };
    if (!/^\d+$/.test(s)) return { ok: false, error: '수량은 0 이상의 정수로 입력해 주세요.' };
    var v = parseInt(s, 10);
    if (v < min) return { ok: false, error: min + ' 이상으로 입력해 주세요.' };
    if (max != null && v > max) return { ok: false, error: '최대 ' + max + '까지 입력할 수 있습니다.' };
    return { ok: true, value: v };
  }

  /* 가상 바코드(사내 전용 2로 시작하는 13자리, 마지막 자리는 EAN 체크디지트) */
  function barcodeOf(n) {
    var body = '20' + pad(n, 10);
    var s = 0;
    for (var i = 0; i < 12; i++) s += Number(body[i]) * (i % 2 ? 3 : 1);
    return body + ((10 - s % 10) % 10);
  }

  /* ───────── 샘플 데이터 ───────── */
  // 기준 카탈로그: 매장·SKU·로케이션(Zone A~D × 랙 01~04 × 단 1~3 = 48칸)
  function makeCatalog(seed, nStores, nSkus) {
    seed = seed || DEFAULT_SEED; nStores = nStores || 24; nSkus = Math.min(nSkus || 24, 40);
    var r = rng(seed);
    var stores = [];
    for (var i = 1; i <= nStores; i++) stores.push({ code: 'S' + pad(i), name: '가상매장 ' + pad(i), region: REGIONS[randInt(r, 0, REGIONS.length - 1)] });
    var locations = [];
    ZONES.forEach(function (z) { for (var k = 1; k <= 4; k++) for (var l = 1; l <= 3; l++) locations.push({ code: z + '-' + pad(k) + '-' + l, zone: z, rack: k, level: l }); });
    var shuffled = shuffle(r, locations.map(function (x) { return x.code; }));
    var skus = [];
    for (var j = 0; j < nSkus; j++) {
      var cat = CATS[j % CATS.length];
      var primary = shuffled[j];
      var alt = [];
      if (r() < 0.55 && shuffled[nSkus + j]) alt.push(shuffled[nSkus + j]);
      skus.push({ code: 'SIM-' + (1001 + j), name: cat + ' 샘플 ' + String.fromCharCode(65 + Math.floor(j / CATS.length)) + (j % CATS.length + 1), cat: cat, barcode: barcodeOf(1001 + j), loc: primary, zone: primary.charAt(0), alt: alt, unitsPerCase: [6, 12, 24][j % 3] });
    }
    return { seed: seed, stores: stores, skus: skus, locations: locations };
  }
  function skuMap(catalog) { var m = {}; catalog.skus.forEach(function (s) { m[s.code] = s; }); return m; }
  function storeMap(catalog) { var m = {}; catalog.stores.forEach(function (s) { m[s.code] = s; }); return m; }

  // 매장별 주문 생성
  function genOrders(catalog, seed, opt) {
    opt = opt || {};
    var r = rng((seed || DEFAULT_SEED) * 7 + 3);
    var stores = catalog.stores.slice(0, opt.storeCount || catalog.stores.length);
    var skus = catalog.skus.slice(0, opt.skuCount || catalog.skus.length);
    var minL = opt.linesMin || 4, maxL = Math.min(opt.linesMax || 10, skus.length);
    return stores.map(function (st, i) {
      var n = randInt(r, Math.min(minL, maxL), maxL);
      var picks = shuffle(r, skus).slice(0, n);
      return {
        id: 'ORD-' + pad(i + 1, 3), store: st.code,
        lines: picks.map(function (s) { return { sku: s.code, qty: randInt(r, 1, 6) * (r() < 0.25 ? 6 : 2) }; })
      };
    });
  }

  // SKU 통합 + 매장별 비교
  function aggregate(orders, catalog) {
    var sm = skuMap(catalog), bySku = {}, byStore = [];
    orders.forEach(function (o) {
      var q = 0;
      o.lines.forEach(function (l) {
        var s = sm[l.sku]; if (!s) return;
        var a = bySku[l.sku] || (bySku[l.sku] = { code: s.code, name: s.name, cat: s.cat, zone: s.zone, loc: s.loc, total: 0, storeCount: 0, stores: {} });
        if (!a.stores[o.store]) a.storeCount++;
        a.stores[o.store] = (a.stores[o.store] || 0) + l.qty;
        a.total += l.qty; q += l.qty;
      });
      byStore.push({ code: o.store, lines: o.lines.length, qty: q });
    });
    var list = Object.keys(bySku).map(function (k) { return bySku[k]; }).sort(function (a, b) { return b.total - a.total || a.code.localeCompare(b.code); });
    return { bySku: list, byStore: byStore, totalUnits: sum(list, function (x) { return x.total; }), totalLines: sum(orders, function (o) { return o.lines.length; }) };
  }

  // Zone별 출고 작업(웨이브) 생성 — 한 작업은 최대 maxUnits개
  function buildWaves(agg, opt) {
    var maxUnits = (opt && opt.maxUnits) || 400, waves = [];
    ZONES.forEach(function (z) {
      var items = agg.bySku.filter(function (s) { return s.zone === z; }).sort(function (a, b) { return a.loc.localeCompare(b.loc); });
      var cur = null, n = 0;
      items.forEach(function (s) {
        if (!cur || cur.units + s.total > maxUnits && cur.skus.length) { n++; cur = { id: 'WV-' + z + pad(n), zone: z, skus: [], lines: 0, units: 0, status: 'wait', progress: 0 }; waves.push(cur); }
        cur.skus.push(s.code); cur.lines += s.storeCount; cur.units += s.total;
      });
    });
    return waves;
  }

  // 로케이션 재고 생성: 일부 SKU는 일부러 주 로케이션 부족(대체 로케이션으로 보완) / 1~2개는 실제 결품
  function genStock(catalog, seed, demand) {
    var r = rng((seed || DEFAULT_SEED) * 13 + 5), stock = {};
    catalog.locations.forEach(function (l) { stock[l.code] = { loc: l.code, zone: l.zone, sku: null, qty: 0, cap: 0 }; });
    var hardShort = 0;
    catalog.skus.forEach(function (s, i) {
      var d = (demand && demand[s.code]) || randInt(r, 20, 60);
      var mode = r();
      var p = stock[s.loc]; p.sku = s.code; p.cap = Math.max(120, d * 2);
      if (s.alt.length && mode < 0.35) {
        p.qty = Math.max(0, Math.floor(d * (0.35 + r() * 0.3)));
        s.alt.forEach(function (a) { var x = stock[a]; x.sku = s.code; x.cap = Math.max(80, d); x.qty = d + randInt(r, 5, 30); });
      } else if (!s.alt.length && mode < 0.2 && hardShort < 2) {
        hardShort++; p.qty = Math.max(0, Math.floor(d * 0.6));
      } else {
        p.qty = d + randInt(r, 4, 50);
        s.alt.forEach(function (a) { var x = stock[a]; x.sku = s.code; x.cap = 80; x.qty = randInt(r, 10, 60); });
      }
    });
    return stock;
  }
  function locsOfSku(stock, catalog, code) {
    var s = skuMap(catalog)[code]; if (!s) return [];
    return [s.loc].concat(s.alt).map(function (l) { return stock[l]; }).filter(function (x) { return x && x.sku === code; });
  }
  function availOf(stock, catalog, code) { return sum(locsOfSku(stock, catalog, code), function (x) { return x.qty; }); }

  // 피킹 배정: 주 로케이션 → 대체 로케이션(재고 많은 순)
  function allocate(stock, catalog, code, qty) {
    var locs = locsOfSku(stock, catalog, code);
    if (!locs.length) return { plan: [], shortage: qty, error: '등록되지 않은 SKU입니다.' };
    var primary = locs[0], alts = locs.slice(1).sort(function (a, b) { return b.qty - a.qty; });
    var plan = [], left = qty;
    [primary].concat(alts).forEach(function (l) { if (left <= 0 || l.qty <= 0) return; var take = Math.min(l.qty, left); plan.push({ loc: l.loc, qty: take, alt: l !== primary }); left -= take; });
    return { plan: plan, shortage: left };
  }
  function applyPick(stock, loc, code, qty) {
    var l = stock[loc];
    if (!l) throw new Error('없는 로케이션입니다: ' + loc);
    if (l.sku !== code) throw new Error(loc + '에는 ' + code + ' 재고가 없습니다.');
    if (!(qty >= 0) || Math.floor(qty) !== qty) throw new Error('수량이 올바르지 않습니다.');
    if (qty > l.qty) throw new Error(loc + ' 재고(' + l.qty + ')보다 많이 피킹할 수 없습니다.');
    l.qty -= qty;
    return l.qty;
  }

  /* DAS 레이아웃: 실제 장비 구조에 맞춰 stations 배열(행·열)만 바꾸면 셀 배치가 다시 계산됩니다. */
  var DAS_LAYOUT = { stations: [{ id: 'DAS-1', rows: 3, cols: 4 }, { id: 'DAS-2', rows: 3, cols: 4 }] };
  function buildDasPlan(agg, catalog, layout) {
    layout = layout || DAS_LAYOUT;
    var stores = catalog.stores.map(function (s) { return s.code; });
    var used = {};
    agg.byStore.forEach(function (b) { used[b.code] = 1; });
    stores = stores.filter(function (c) { return used[c]; });
    var idx = 0, sm = skuMap(catalog);
    var stations = layout.stations.map(function (st) {
      var n = st.rows * st.cols, cells = [];
      for (var i = 0; i < n; i++) cells.push({ idx: i, label: st.id.replace('DAS-', '') + '-' + pad(i + 1), store: stores[idx + i] || null });
      idx += n;
      var mine = {}; cells.forEach(function (c) { if (c.store) mine[c.store] = c.idx; });
      var queue = agg.bySku.map(function (s) {
        var lines = Object.keys(s.stores).filter(function (st2) { return mine[st2] != null; }).map(function (st2) { return { store: st2, cell: mine[st2], need: s.stores[st2], put: 0 }; });
        return lines.length ? { sku: s.code, name: s.name, barcode: sm[s.code].barcode, lines: lines, status: 'wait' } : null;
      }).filter(Boolean);
      return { id: st.id, rows: st.rows, cols: st.cols, cells: cells, queue: queue, current: null };
    });
    return { stations: stations, unassigned: stores.slice(idx) };
  }
  function putToCell(station, store, qty) {
    var cur = station.current == null ? null : station.queue[station.current];
    if (!cur) throw new Error('먼저 제품 바코드를 스캔해 주세요.');
    var line = cur.lines.filter(function (l) { return l.store === store; })[0];
    if (!line) throw new Error('이 셀은 현재 SKU의 분배 대상이 아닙니다.');
    var left = line.need - line.put;
    if (left <= 0) throw new Error('이미 분배가 끝난 셀입니다.');
    if (!(qty >= 1) || Math.floor(qty) !== qty) throw new Error('분배 수량은 1 이상의 정수여야 합니다.');
    if (qty > left) throw new Error('필요 수량(' + left + ')을 초과했습니다.');
    line.put += qty;
    var done = cur.lines.every(function (l) { return l.put >= l.need; });
    if (done) { cur.status = 'done'; station.current = null; }
    return { line: line, skuDone: done };
  }

  // 박스 구성: 매장별 수량을 용량(capacity) 단위로 나눔
  function planBoxes(units, capacity) {
    if (!(capacity > 0)) throw new Error('박스 용량은 1 이상이어야 합니다.');
    var out = [], left = units;
    while (left > 0) { var q = Math.min(capacity, left); out.push(q); left -= q; }
    return out;
  }

  /* ───────── 상태 저장(시뮬레이션 전용 키) ───────── */
  function load(id) { try { var v = root.localStorage && root.localStorage.getItem(STORE_PREFIX + id); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(id, v) { try { root.localStorage && root.localStorage.setItem(STORE_PREFIX + id, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function remove(id) { try { root.localStorage && root.localStorage.removeItem(STORE_PREFIX + id); } catch (e) { /* 무시 */ } }

  var api = {
    STORE_PREFIX: STORE_PREFIX, ZONES: ZONES, DEFAULT_SEED: DEFAULT_SEED, DAS_LAYOUT: DAS_LAYOUT,
    rng: rng, randInt: randInt, shuffle: shuffle, pad: pad, clone: clone, sum: sum, esc: esc, fmt: fmt, pct: pct, fmtDur: fmtDur,
    validateQty: validateQty, barcodeOf: barcodeOf, makeCatalog: makeCatalog, skuMap: skuMap, storeMap: storeMap,
    genOrders: genOrders, aggregate: aggregate, buildWaves: buildWaves, genStock: genStock, locsOfSku: locsOfSku, availOf: availOf,
    allocate: allocate, applyPick: applyPick, buildDasPlan: buildDasPlan, putToCell: putToCell, planBoxes: planBoxes,
    load: load, save: save, remove: remove
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ───────── 브라우저 전용: 모듈 등록·타이머 엔진·공통 화면 요소 ───────── */
  var doc = root.document;
  var modules = {}, order = [];
  var speed = Number((load('speed') || {}).v) || 1;

  // 모듈 등록: { id, viewId, label, icon, state(), tick(dtSim), render(), summary(), start(), pause(), reset() }
  function register(m) { modules[m.id] = m; if (order.indexOf(m.id) < 0) order.push(m.id); return m; }
  function isVisible(m) { var el = doc.getElementById(m.viewId); return !!(el && el.classList.contains('active')); }
  // 입력 중(포커스가 화면 안 입력칸)이면 자동 다시 그리기를 건너뜀 → 입력값·커서가 지워지지 않게
  function isTyping(m) { var a = doc.activeElement, el = doc.getElementById(m.viewId); return !!(a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }

  var saveTimers = {};
  function persist(m) { clearTimeout(saveTimers[m.id]); saveTimers[m.id] = setTimeout(function () { save(m.id, m.state()); }, 500); }

  // 엔진: 200ms마다 실행 중인 모듈만 진행, 보이는 화면만 다시 그림. 화면이 숨겨지면(탭 전환) 멈춤
  //  - 내용이 바뀐 경우에만 다시 그리고(경과 시간만 바뀌면 시간 글자만 갱신)
  //  - 누르는 중(pointerdown~up)에는 다시 그리지 않음 → 버튼·셀 클릭이 다시 그리기에 묻혀 사라지지 않게
  var last = Date.now(), pressing = false;
  if (doc) {
    doc.addEventListener('pointerdown', function () { pressing = true; }, true);
    ['pointerup', 'pointercancel', 'dragend'].forEach(function (ev) { doc.addEventListener(ev, function () { setTimeout(function () { pressing = false; }, 0); }, true); });
    if (root.addEventListener) root.addEventListener('blur', function () { pressing = false; });
  }
  var VOLATILE = { elapsed: 1, autoT: 1, pickT: 1, carry: 1 };
  function signature(st) { try { return JSON.stringify(st, function (k, v) { return VOLATILE[k] ? undefined : v; }); } catch (e) { return String(Math.random()); } }
  function refresh(m, force) {
    if (!isVisible(m) || isTyping(m) || pressing) return;
    var sig = signature(m.state());
    if (force || sig !== m.__sig) { m.__sig = sig; m.render(); return; }
    var el = doc.getElementById(m.viewId), t = el && el.querySelector('.ds-elapsed b');
    if (t) t.textContent = fmtDur(m.state().elapsed);
  }
  function loop() {
    var now = Date.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    if (doc.hidden) return;
    order.forEach(function (id) {
      var m = modules[id], st = m.state();
      if (st && st.phase === 'running') {
        try { m.tick(dt * speed); } catch (e) { st.phase = 'paused'; toast('[' + m.label + '] ' + e.message); }
        st.elapsed = (st.elapsed || 0) + dt * speed;
        persist(m);
        refresh(m);
      }
    });
    // 현황판은 다른 모듈이 하나라도 움직일 때만 갱신(1초에 한 번)
    var b = modules.board;
    if (b && isVisible(b) && !isTyping(b) && !pressing && order.some(function (id) { return modules[id].state().phase === 'running'; }) && now - (b.__last || 0) > 1000) { b.__last = now; b.render(); }
  }

  function toast(msg) { if (typeof root.toastMsg === 'function') root.toastMsg(msg); else if (root.console) root.console.warn(msg); }
  function icons() { try { if (root.lucide && root.lucide.createIcons) root.lucide.createIcons(); } catch (e) { /* 무시 */ } }

  var PHASE_LABEL = { idle: '대기', ready: '준비됨', running: '진행 중', paused: '일시정지', done: '완료' };
  function phaseChip(phase) { return '<span class="ds-chip ds-chip-' + esc(phase || 'idle') + '"><i></i>' + esc(PHASE_LABEL[phase] || phase) + '</span>'; }
  function progress(p, tone) { return '<div class="ds-progress ' + (tone || '') + '"><span style="width:' + Math.max(0, Math.min(100, p)) + '%"></span></div>'; }

  // 화면 머리(공통): 제목 + 가상 데이터 표시 + 제어 버튼(시작/일시정지/초기화/배속)
  function head(opt) {
    return '<div class="data-workbench-head ds-head"><span class="ds-head-icon"><i data-lucide="' + esc(opt.icon || 'boxes') + '"></i></span><div class="ds-head-text"><div class="ds-eyebrow">DAS SIMULATION · ' + esc(opt.no) + '</div><h2>' + esc(opt.title) + '</h2><p>' + esc(opt.desc) + '</p></div>' +
      '<span class="ds-sim-badge" title="운영 데이터와 분리된 가상 데이터입니다"><i data-lucide="flask-conical"></i>가상 데이터 · 운영 영향 없음</span></div>';
  }
  function controls(m, extra) {
    var st = m.state(), ph = st.phase;
    return '<div class="ds-controls">' +
      '<div class="ds-controls-main">' +
      '<button class="btn primary ds-btn" data-ds="start" ' + (ph === 'running' || ph === 'done' ? 'disabled' : '') + '><i data-lucide="play"></i>' + (ph === 'paused' ? '재개' : '작업 시작') + '</button>' +
      '<button class="btn ds-btn" data-ds="pause" ' + (ph !== 'running' ? 'disabled' : '') + '><i data-lucide="pause"></i>일시정지</button>' +
      '<button class="btn ds-btn ds-btn-ghost" data-ds="reset"><i data-lucide="rotate-ccw"></i>초기화</button>' +
      (extra || '') + '</div>' +
      '<div class="ds-controls-side">' + phaseChip(ph) +
      '<span class="ds-elapsed" title="시뮬레이션 경과 시간"><i data-lucide="timer"></i><b>' + fmtDur(st.elapsed) + '</b></span>' +
      '<label class="ds-speed">배속<select data-ds="speed">' + [1, 2, 5, 10].map(function (v) { return '<option value="' + v + '"' + (v === speed ? ' selected' : '') + '>' + v + 'x</option>'; }).join('') + '</select></label>' +
      '</div></div>';
  }
  // 공통 제어 버튼 연결(모듈 화면 루트에 위임)
  function bindControls(rootEl, m) {
    if (rootEl.__dsBound) return; rootEl.__dsBound = true;
    rootEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ds]'); if (!b || b.tagName === 'SELECT' || b.disabled) return;
      var act = b.getAttribute('data-ds');
      if (act === 'start') m.start(); else if (act === 'pause') m.pause();
      else if (act === 'reset') { if (root.confirm('[' + m.label + '] 시뮬레이션을 초기화할까요? (가상 데이터만 지워집니다)')) m.reset(); }
      else return;
      persist(m); m.render();
    });
    rootEl.addEventListener('change', function (e) {
      if (e.target.matches('[data-ds="speed"]')) { setSpeed(Number(e.target.value)); }
    });
  }
  function setSpeed(v) { if ([1, 2, 5, 10].indexOf(v) < 0) return; speed = v; save('speed', { v: v }); order.forEach(function (id) { if (isVisible(modules[id])) modules[id].render(); }); }
  function kpi(label, value, unit, tone) { return '<div class="kpi ds-kpi ' + (tone || '') + '"><span>' + esc(label) + '</span><b>' + value + '</b><small>' + esc(unit || '') + '</small></div>'; }
  function log(st, msg, tone) { st.log = st.log || []; st.log.unshift({ t: Math.round(st.elapsed || 0), msg: msg, tone: tone || '' }); if (st.log.length > 60) st.log.length = 60; }
  function logHtml(st, n) {
    var list = (st.log || []).slice(0, n || 12);
    return list.length ? '<ul class="ds-log">' + list.map(function (l) { return '<li class="' + esc(l.tone) + '"><time>' + fmtDur(l.t) + '</time><span>' + esc(l.msg) + '</span></li>'; }).join('') + '</ul>' : '<div class="ds-empty">아직 기록이 없습니다.</div>';
  }
  // 선(바) 형태 가상 바코드 SVG
  function barcodeSvg(text, h) {
    var s = String(text), x = 0, bars = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var k = 0; k < 4; k++) { var w = ((c >> k) & 1) + 1; if (k % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="' + (h || 40) + '"/>'; x += w + 1; } }
    return '<svg class="ds-barcode" viewBox="0 0 ' + x + ' ' + (h || 40) + '" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
  }

  // 메뉴로 화면이 열리면 그 모듈을 그림(화면 class 'active' 변화를 감시 — 기존 코드 수정 없음)
  function watchView(m) {
    var el = doc.getElementById(m.viewId); if (!el) return;
    var was = false;
    new MutationObserver(function () { var on = el.classList.contains('active'); if (on && !was) { m.render(); } was = on; }).observe(el, { attributes: true, attributeFilter: ['class'] });
    if (el.classList.contains('active')) m.render();
  }

  // 모듈 공통 동작 묶음: 상태 복원(새로고침 후에는 실행 중이던 작업을 일시정지로)
  function restore(id, fresh) {
    var st = load(id);
    if (!st || st.v !== fresh().v) st = fresh();
    if (st.phase === 'running') st.phase = 'paused';
    return st;
  }

  function init() {
    order.forEach(function (id) { watchView(modules[id]); });
    setInterval(loop, 200);
  }

  api.register = register; api.modules = modules; api.order = order; api.persist = persist;
  api.toast = toast; api.icons = icons; api.phaseChip = phaseChip; api.progress = progress; api.head = head; api.controls = controls;
  api.bindControls = bindControls; api.kpi = kpi; api.log = log; api.logHtml = logHtml; api.barcodeSvg = barcodeSvg; api.restore = restore;
  api.getSpeed = function () { return speed; }; api.setSpeed = setSpeed; api.isVisible = isVisible;
  root.DasSim = api;
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); }); else setTimeout(init, 0); }
})(typeof window !== 'undefined' ? window : globalThis);
