/* DAS 시뮬레이션 1 — 출고 작업 생성 (js/64-das-sim-wave.js)
   매장별 가상 주문 생성 → SKU 통합 → 매장별 수량 비교 → Zone별 출고 작업(웨이브) 생성·상태 표시 */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'wave', VIEW = 'dsWaveView';
  var STAGES = ['주문 검증', 'SKU 통합', '로케이션 배정', '출고 작업 생성'];
  var STAGE_SEC = 1.2; // 앞의 3단계는 각각 1.2초(1x 기준)

  function fresh() { return { v: 1, phase: 'idle', elapsed: 0, seed: D.DEFAULT_SEED, storeCount: 24, skuCount: 24, orders: [], waves: [], stage: -1, stageProg: 0, sel: null, sort: 'store', workers: 2, log: [] }; }
  var st = D.restore(ID, fresh);
  var cat = null, agg = null;
  function rebuild() { cat = D.makeCatalog(st.seed, 24, 24); agg = st.orders.length ? D.aggregate(st.orders, cat) : null; }
  rebuild();

  function genSample() {
    if (st.phase === 'running') return D.toast('작업 생성 중에는 주문을 바꿀 수 없습니다. 먼저 일시정지하거나 초기화해 주세요.');
    var keep = { storeCount: st.storeCount, skuCount: st.skuCount, seed: st.seed, workers: st.workers };
    st = Object.assign(fresh(), keep);
    st.orders = D.genOrders(D.makeCatalog(st.seed, 24, 24), st.seed, { storeCount: st.storeCount, skuCount: st.skuCount });
    st.phase = 'ready';
    rebuild();
    D.log(st, '샘플 주문 ' + st.orders.length + '건(' + D.fmt(agg.totalLines) + '라인, ' + D.fmt(agg.totalUnits) + '개)을 생성했습니다.');
  }

  var m = D.register({
    id: ID, viewId: VIEW, label: '출고 작업 생성', icon: 'clipboard-list',
    state: function () { return st; },
    start: function () {
      if (!st.orders.length) return D.toast('먼저 [샘플 주문 생성]으로 주문을 만들어 주세요.');
      if (st.phase === 'done') return D.toast('이미 작업 생성이 끝났습니다. 초기화 후 다시 실행해 주세요.');
      if (st.stage < 0) { st.stage = 0; st.stageProg = 0; st.waves = []; D.log(st, '출고 작업 생성을 시작했습니다.'); }
      else D.log(st, '작업 생성을 재개했습니다.');
      st.phase = 'running';
    },
    pause: function () { if (st.phase === 'running') { st.phase = 'paused'; D.log(st, '일시정지했습니다.', 'warn'); } },
    reset: function () { var keep = { storeCount: st.storeCount, skuCount: st.skuCount, seed: st.seed, workers: st.workers }; st = Object.assign(fresh(), keep); rebuild(); D.log(st, '초기화했습니다. 샘플 주문을 다시 생성해 주세요.'); },
    tick: function (dt) {
      if (st.stage < 3) {
        st.stageProg += dt / STAGE_SEC * 100;
        if (st.stageProg >= 100) {
          D.log(st, STAGES[st.stage] + ' 완료' + (st.stage === 1 ? ' — SKU ' + agg.bySku.length + '종으로 통합' : st.stage === 0 ? ' — 오류 없음' : ''), 'ok');
          st.stage++; st.stageProg = 0;
          if (st.stage === 3) { st.waves = D.buildWaves(agg, { maxUnits: 360 }); D.log(st, 'Zone별 출고 작업 ' + st.waves.length + '건을 만들었습니다.'); }
        }
        return;
      }
      var w = st.waves.filter(function (x) { return x.status !== 'done'; })[0];
      if (!w) { st.phase = 'done'; st.stageProg = 100; D.log(st, '모든 출고 작업 생성이 끝났습니다.', 'ok'); return; }
      w.status = 'run';
      w.progress = Math.min(100, w.progress + dt * 45);
      if (w.progress >= 100) { w.status = 'done'; D.log(st, w.id + ' 생성 완료 · ' + w.skus.length + ' SKU / ' + D.fmt(w.units) + '개', 'ok'); }
      var done = st.waves.filter(function (x) { return x.status === 'done'; }).length;
      st.stageProg = D.pct(done + (w.status === 'done' ? 0 : w.progress / 100), st.waves.length);
    },
    summary: function () {
      var total = agg ? agg.totalUnits : 0;
      var done = st.waves.filter(function (w) { return w.status === 'done'; }).reduce(function (s, w) { return s + w.units; }, 0);
      return { total: total, done: done, unit: '개', taskTotal: st.waves.length || (agg ? 1 : 0), taskDone: st.waves.filter(function (w) { return w.status === 'done'; }).length };
    },
    render: render
  });

  function stagesHtml() {
    return '<div class="ds-stages">' + STAGES.map(function (s, i) {
      var cls = st.stage > i || st.phase === 'done' ? 'done' : st.stage === i ? 'run' : '';
      var p = cls === 'done' ? 100 : cls === 'run' ? st.stageProg : 0;
      return '<div class="ds-stage ' + cls + '"><div class="ds-stage-top"><b>' + (i + 1) + '</b><span>' + s + '</span>' + (cls === 'done' ? '<i data-lucide="check"></i>' : '') + '</div>' + D.progress(p) + '</div>';
    }).join('') + '</div>';
  }

  function skuTable() {
    if (!agg) return '<div class="ds-empty">샘플 주문을 생성하면 SKU별 통합 수량이 표시됩니다.</div>';
    var max = agg.bySku[0] ? agg.bySku[0].total : 1;
    return '<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>SKU</th><th>품명</th><th>로케이션</th><th class="num">매장</th><th class="num">총 수량</th><th class="ds-col-bar"></th></tr></thead><tbody>' +
      agg.bySku.map(function (s) {
        return '<tr class="' + (st.sel === s.code ? 'sel' : '') + '" data-sku="' + D.esc(s.code) + '"><td><b>' + D.esc(s.code) + '</b></td><td>' + D.esc(s.name) + '</td><td><span class="ds-loc">' + D.esc(s.loc) + '</span></td><td class="num">' + s.storeCount + '</td><td class="num"><b>' + D.fmt(s.total) + '</b></td><td class="ds-col-bar">' + D.progress(s.total / max * 100, 'thin') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function storeCompare() {
    if (!agg) return '<div class="ds-empty">매장별 주문 수량 비교가 여기에 표시됩니다.</div>';
    var rows, title;
    if (st.sel) {
      var s = agg.bySku.filter(function (x) { return x.code === st.sel; })[0];
      rows = s ? Object.keys(s.stores).map(function (k) { return { code: k, qty: s.stores[k] }; }) : [];
      title = D.esc(st.sel) + ' 매장별 수량';
    } else { rows = agg.byStore.map(function (b) { return { code: b.code, qty: b.qty, lines: b.lines }; }); title = '매장별 총 주문 수량'; }
    if (st.sort === 'qty') rows.sort(function (a, b) { return b.qty - a.qty; }); else rows.sort(function (a, b) { return a.code.localeCompare(b.code); });
    var max = Math.max.apply(null, rows.map(function (r) { return r.qty; }).concat([1]));
    var avg = rows.length ? D.sum(rows, function (r) { return r.qty; }) / rows.length : 0;
    var hi = rows.reduce(function (a, r) { return !a || r.qty > a.qty ? r : a; }, null), lo = rows.reduce(function (a, r) { return !a || r.qty < a.qty ? r : a; }, null);
    return '<div class="ds-compare-head"><b>' + title + '</b><span>평균 ' + D.fmt(Math.round(avg)) + '개' + (st.sel ? ' · <button class="ds-link" data-act="clear-sel">전체 보기</button>' : '') + '</span>' +
      '<div class="ds-seg"><button class="' + (st.sort === 'store' ? 'on' : '') + '" data-act="sort" data-v="store">매장순</button><button class="' + (st.sort === 'qty' ? 'on' : '') + '" data-act="sort" data-v="qty">수량순</button></div></div>' +
      '<div class="ds-hbars">' + rows.map(function (r) {
        var tag = r === hi ? '<em class="hi">최대</em>' : r === lo && rows.length > 1 ? '<em class="lo">최소</em>' : '';
        return '<div class="ds-hbar"><span class="ds-hbar-label">' + D.esc(r.code) + tag + '</span><div class="ds-hbar-track"><i style="width:' + (r.qty / max * 100) + '%"></i><u style="left:' + (avg / max * 100) + '%"></u></div><b>' + D.fmt(r.qty) + '</b></div>';
      }).join('') + '</div>';
  }

  function wavesHtml() {
    if (!st.waves.length) return '<div class="ds-empty">작업을 시작하면 Zone별 출고 작업이 여기에 생성됩니다.</div>';
    var label = { wait: '대기', run: '생성 중', done: '생성 완료' };
    return '<div class="ds-wave-grid">' + st.waves.map(function (w) {
      return '<div class="ds-wave ' + w.status + '"><div class="ds-wave-top"><span class="ds-zone z' + w.zone + '">Zone ' + w.zone + '</span><b>' + D.esc(w.id) + '</b><span class="ds-chip ds-chip-' + (w.status === 'done' ? 'done' : w.status === 'run' ? 'running' : 'idle') + '"><i></i>' + label[w.status] + '</span></div>' +
        '<div class="ds-wave-nums"><div><small>SKU</small><b>' + w.skus.length + '</b></div><div><small>라인</small><b>' + w.lines + '</b></div><div><small>수량</small><b>' + D.fmt(w.units) + '</b></div></div>' + D.progress(w.progress) + '</div>';
    }).join('') + '</div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var c = D.makeCatalog(st.seed, 24, 24);
    var locked = st.phase === 'running' || st.phase === 'done';
    var extra = '<span class="ds-sep"></span><label class="ds-mini">매장<select data-act="stores" ' + (locked ? 'disabled' : '') + '>' + [8, 12, 16, 24].map(function (v) { return '<option' + (v === st.storeCount ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
      '<label class="ds-mini">SKU<select data-act="skus" ' + (locked ? 'disabled' : '') + '>' + [8, 12, 16, 24].map(function (v) { return '<option' + (v === st.skuCount ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn ds-btn" data-act="gen" ' + (st.phase === 'running' ? 'disabled' : '') + '><i data-lucide="sparkles"></i>샘플 주문 생성</button>';
    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'clipboard-list', no: '01', title: '출고 작업 생성', desc: '매장별 주문을 SKU 기준으로 통합하고, Zone별 출고 작업을 만듭니다.' }) + D.controls(m, extra) +
      '<div class="kpis data-kpis ds-kpis">' + D.kpi('주문 매장', agg ? agg.byStore.length : 0, '곳') + D.kpi('주문 라인', agg ? D.fmt(agg.totalLines) : 0, '라인') + D.kpi('총 주문 수량', agg ? D.fmt(agg.totalUnits) : 0, '개', 'accent') + D.kpi('통합 SKU', agg ? agg.bySku.length : 0, '종') + D.kpi('출고 작업', st.waves.length, '건') + '</div>' +
      stagesHtml() +
      '<div class="ds-grid-2"><div class="panel ds-panel"><div class="panel-head"><div><h3>SKU별 전체 주문 수량</h3><p class="ds-sub">행을 누르면 그 SKU의 매장별 수량을 비교합니다.</p></div><span class="badge">' + (agg ? agg.bySku.length : 0) + '종</span></div>' + skuTable() + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>매장별 주문 수량 비교</h3><p class="ds-sub">세로선은 평균입니다.</p></div></div>' + storeCompare() + '</div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>출고 작업</h3><p class="ds-sub">Zone별로 최대 360개 단위로 나눠 생성합니다.</p></div><span class="badge">' + st.waves.filter(function (w) { return w.status === 'done'; }).length + ' / ' + st.waves.length + '</span></div>' + wavesHtml() + '</div>' +
      '<div class="ds-grid-2"><div class="panel ds-panel"><div class="panel-head"><div><h3>주문 라인 추가</h3><p class="ds-sub">가상 주문에 라인을 직접 더해 결과를 비교해 볼 수 있습니다.</p></div></div>' +
      '<form class="ds-form" data-act="add-line"><label>매장<select name="store" ' + (locked ? 'disabled' : '') + '>' + c.stores.slice(0, st.storeCount).map(function (s) { return '<option value="' + s.code + '">' + s.code + ' · ' + D.esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>SKU<select name="sku" ' + (locked ? 'disabled' : '') + '>' + c.skus.slice(0, st.skuCount).map(function (s) { return '<option value="' + s.code + '">' + s.code + ' · ' + D.esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>수량<input name="qty" inputmode="numeric" placeholder="1~500" ' + (locked ? 'disabled' : '') + '></label><button class="btn primary ds-btn" ' + (locked ? 'disabled' : '') + '><i data-lucide="plus"></i>추가</button></form>' +
      '<p class="ds-hint">' + (locked ? '작업 생성이 시작된 뒤에는 주문을 바꿀 수 없습니다. 초기화 후 다시 시도해 주세요.' : '같은 매장·SKU가 이미 있으면 수량이 더해집니다.') + '</p></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>작업 기록</h3></div></div>' + D.logHtml(st, 10) + '</div></div></div>';
    D.bindControls(el, m); bind(el); D.icons();
  }

  function bind(el) {
    if (el.__dsWave) return; el.__dsWave = true;
    el.addEventListener('click', function (e) {
      var row = e.target.closest('tr[data-sku]');
      if (row) { st.sel = st.sel === row.dataset.sku ? null : row.dataset.sku; D.persist(m); return render(); }
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'FORM') return;
      var a = b.dataset.act;
      if (a === 'gen') genSample();
      else if (a === 'sort') st.sort = b.dataset.v;
      else if (a === 'clear-sel') st.sel = null;
      else return;
      D.persist(m); render();
    });
    el.addEventListener('change', function (e) {
      var a = e.target.dataset.act;
      if (a === 'stores' || a === 'skus') {
        if (st.phase === 'running' || st.phase === 'done') return;
        st[a === 'stores' ? 'storeCount' : 'skuCount'] = Number(e.target.value);
        if (st.orders.length) genSample();
        D.persist(m); render();
      }
    });
    el.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-act="add-line"]')) return;
      e.preventDefault();
      if (st.phase === 'running' || st.phase === 'done') return D.toast('작업 생성이 시작된 뒤에는 주문을 바꿀 수 없습니다.');
      var f = e.target, v = D.validateQty(f.qty.value, { min: 1, max: 500 });
      if (!v.ok) { f.qty.classList.add('ds-invalid'); f.qty.focus(); return D.toast(v.error); }
      var o = st.orders.filter(function (x) { return x.store === f.store.value; })[0];
      if (!o) { o = { id: 'ORD-' + D.pad(st.orders.length + 1, 3), store: f.store.value, lines: [] }; st.orders.push(o); }
      var l = o.lines.filter(function (x) { return x.sku === f.sku.value; })[0];
      if (l) l.qty += v.value; else o.lines.push({ sku: f.sku.value, qty: v.value });
      if (st.phase === 'idle') st.phase = 'ready';
      rebuild();
      D.log(st, f.store.value + ' · ' + f.sku.value + ' ' + v.value + '개를 추가했습니다.');
      D.persist(m); render();
    });
  }
})();
