/* DAS 시뮬레이션 5 — 박스 및 출고 (js/68-das-sim-pack.js)
   매장별 박스 구성 → 만재 시 마감 → 출고 라벨 발행 → 컨베이어 이동 → 출고 도크 도착(패킹·출고 완료) */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'pack', VIEW = 'dsPackView';
  var PACK_RATE = 14;     // 초당 담는 수량(1x, 작업자 2명 기준)
  var CONVEYOR_SEC = 5;   // 컨베이어 이동 시간(1x)

  function build(seed) {
    var cat = D.makeCatalog(seed, 24, 24);
    var agg = D.aggregate(D.genOrders(cat, seed, {}), cat);
    var sm = D.storeMap(cat);
    return agg.byStore.map(function (b) { return { code: b.code, name: sm[b.code].name, region: sm[b.code].region, units: b.qty, packed: 0, boxes: [], done: false }; });
  }
  function fresh(cap) { return { v: 1, phase: 'idle', elapsed: 0, seed: D.DEFAULT_SEED, capacity: cap || 40, stores: build(D.DEFAULT_SEED), sel: null, labelBox: null, carry: 0, workers: 2, auto: true, log: [] }; }
  var st = D.restore(ID, fresh);

  function store(code) { return st.stores.filter(function (s) { return s.code === code; })[0]; }
  function openBox(s) { return s.boxes.filter(function (b) { return b.status === 'open'; })[0]; }
  function allBoxes() { var out = []; st.stores.forEach(function (s) { s.boxes.forEach(function (b) { out.push(b); }); }); return out; }

  function newBox(s) { var b = { id: s.code + '-' + D.pad(s.boxes.length + 1), store: s.code, no: s.boxes.length + 1, qty: 0, status: 'open', t: 0 }; s.boxes.push(b); return b; }
  function close(s, b, why) {
    if (!b || b.status !== 'open') throw new Error('마감할 열린 박스가 없습니다.');
    if (b.qty <= 0) throw new Error('빈 박스는 마감할 수 없습니다.');
    b.status = 'labeled'; b.closedAt = Math.round(st.elapsed || 0); st.labelBox = b.id;
    D.log(st, b.id + ' ' + why + ' 마감 · ' + b.qty + '개 · 라벨 발행', why === '만재' ? 'ok' : '');
    b.status = 'moving'; b.t = 0;
  }
  function packStep(units) {
    var s = st.stores.filter(function (x) { return x.packed < x.units; })[0];
    if (!s) return 0;
    var b = openBox(s) || newBox(s);
    var q = Math.min(units, st.capacity - b.qty, s.units - s.packed);
    b.qty += q; s.packed += q;
    if (b.qty >= st.capacity) close(s, b, '만재');
    else if (s.packed >= s.units) close(s, b, '매장 완료');
    return q;
  }
  function moveConveyor(dt) {
    allBoxes().forEach(function (b) {
      if (b.status !== 'moving') return;
      b.t = Math.min(1, b.t + dt / CONVEYOR_SEC);
      if (b.t >= 1) {
        b.status = 'shipped';
        var s = store(b.store);
        if (!s.done && s.packed >= s.units && s.boxes.every(function (x) { return x.status === 'shipped'; })) { s.done = true; D.log(st, s.code + ' 출고 완료 · 박스 ' + s.boxes.length + '개 · ' + s.units + '개', 'ok'); }
      }
    });
  }

  var m = D.register({
    id: ID, viewId: VIEW, label: '박스·출고', icon: 'package-check',
    state: function () { return st; },
    start: function () { if (st.phase === 'done') return; st.phase = 'running'; D.log(st, st.elapsed ? '패킹을 재개했습니다.' : '패킹을 시작했습니다. 박스 용량 ' + st.capacity + '개'); },
    pause: function () { if (st.phase === 'running') { st.phase = 'paused'; D.log(st, '일시정지했습니다. (컨베이어 정지)', 'warn'); } },
    reset: function () { var w = st.workers, cap = st.capacity; st = fresh(cap); st.workers = w; D.log(st, '초기화했습니다.'); },
    tick: function (dt) {
      if (st.auto) {
        st.carry += dt * PACK_RATE * Math.max(1, st.workers) / 2;
        var n = Math.floor(st.carry); st.carry -= n;
        while (n > 0) { var q = packStep(n); if (!q) break; n -= q; }
      }
      moveConveyor(dt);
      if (st.stores.every(function (s) { return s.done; })) { st.phase = 'done'; D.log(st, '모든 매장 패킹·출고가 끝났습니다.', 'ok'); }
    },
    summary: function () {
      var total = D.sum(st.stores, function (s) { return s.units; });
      var shipped = D.sum(allBoxes().filter(function (b) { return b.status === 'shipped'; }), function (b) { return b.qty; });
      return { total: total, done: shipped, unit: '개', taskTotal: st.stores.length, taskDone: st.stores.filter(function (s) { return s.done; }).length, packed: D.sum(st.stores, function (s) { return s.packed; }), boxes: allBoxes().filter(function (b) { return b.status !== 'open'; }).length };
    },
    detail: function () { return st.stores; },
    render: render
  });

  function label(b) {
    if (!b) return '<div class="ds-empty">박스가 마감되면 출고 라벨이 여기에 발행됩니다.</div>';
    var s = store(b.store);
    return '<div class="ds-label"><div class="ds-label-top"><b>LUSH LOGISTICS</b><span>출고 라벨 · SIMULATION</span></div>' +
      '<div class="ds-label-main"><div><small>도착 매장</small><b>' + D.esc(s.code) + '</b><span>' + D.esc(s.name) + ' · ' + D.esc(s.region) + '</span></div><div class="ds-label-box"><small>BOX</small><b>' + b.no + '</b></div></div>' +
      '<div class="ds-label-grid"><div><small>박스 번호</small><b>' + b.id + '</b></div><div><small>수량</small><b>' + b.qty + '개</b></div><div><small>마감</small><b>' + D.fmtDur(b.closedAt) + '</b></div><div><small>상태</small><b>' + (b.status === 'shipped' ? '출고 완료' : '이동 중') + '</b></div></div>' +
      D.barcodeSvg('SIM' + b.id, 44) + '<code>SIM' + b.id.replace('-', '') + '</code></div>';
  }
  function conveyor() {
    var moving = allBoxes().filter(function (b) { return b.status === 'moving'; });
    var shipped = allBoxes().filter(function (b) { return b.status === 'shipped'; });
    return '<div class="ds-conveyor ' + (st.phase === 'running' ? 'on' : '') + '"><div class="ds-conv-start"><i data-lucide="tag"></i>라벨</div><div class="ds-conv-belt">' +
      moving.map(function (b) { return '<div class="ds-conv-box" style="left:calc(' + (b.t * 100) + '% - ' + (b.t * 62) + 'px)" title="' + b.id + '"><b>' + b.store + '</b><span>#' + b.no + ' · ' + b.qty + '</span></div>'; }).join('') +
      '</div><div class="ds-conv-dock"><i data-lucide="truck"></i><b>' + shipped.length + '</b><span>출고 박스</span></div></div>';
  }
  function storeGrid() {
    return '<div class="ds-store-grid">' + st.stores.map(function (s) {
      var ob = openBox(s), p = D.pct(s.packed, s.units);
      var state = s.done ? 'done' : s.packed >= s.units ? 'moving' : s.packed > 0 ? 'run' : '';
      return '<button class="ds-store ' + state + (st.sel === s.code ? ' sel' : '') + '" data-act="store" data-v="' + s.code + '"><div class="ds-store-top"><b>' + s.code + '</b><span>' + (s.done ? '출고 완료' : s.packed >= s.units ? '컨베이어' : s.packed ? '패킹 중' : '대기') + '</span></div>' +
        '<div class="ds-store-qty">' + s.packed + '<i>/' + s.units + '</i></div>' + D.progress(p, 'thin') +
        '<div class="ds-boxchips">' + s.boxes.map(function (b) { return '<i class="' + b.status + '" title="' + b.id + ' ' + b.qty + '개"></i>'; }).join('') + (ob ? '<em style="--f:' + (ob.qty / st.capacity) + '"></em>' : '') + '</div></button>';
    }).join('') + '</div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var s = m.summary(), sel = st.sel ? store(st.sel) : null, ob = sel ? openBox(sel) : null;
    var lb = st.labelBox ? allBoxes().filter(function (b) { return b.id === st.labelBox; })[0] : null;
    var extra = '<span class="ds-sep"></span><label class="ds-mini">박스 용량<select data-act="cap" ' + (st.phase === 'idle' ? '' : 'disabled') + '>' + [20, 30, 40, 50, 60].map(function (v) { return '<option value="' + v + '"' + (v === st.capacity ? ' selected' : '') + '>' + v + '개</option>'; }).join('') + '</select></label>' +
      '<label class="ds-switch"><input type="checkbox" data-act="auto" ' + (st.auto ? 'checked' : '') + '><span></span>자동 패킹</label>';
    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'package-check', no: '05', title: '박스 · 출고', desc: '매장별로 박스를 구성하고, 만재되면 마감·라벨 발행 후 컨베이어로 출고합니다.' }) + D.controls(m, extra) +
      '<div class="kpis data-kpis ds-kpis">' + D.kpi('출고 매장', s.taskDone + ' / ' + s.taskTotal, '곳') + D.kpi('패킹 수량', D.fmt(s.packed) + ' / ' + D.fmt(s.total), '개', 'accent') + D.kpi('마감 박스', s.boxes, '개') + D.kpi('출고 완료 수량', D.fmt(s.done), '개', 'ok') + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>컨베이어</h3><p class="ds-sub">라벨이 붙은 박스가 출고 도크로 이동합니다.</p></div><span class="badge">이동 중 ' + allBoxes().filter(function (b) { return b.status === 'moving'; }).length + '</span></div>' + conveyor() + '</div>' +
      '<div class="ds-grid-2 wide-left"><div class="panel ds-panel"><div class="panel-head"><div><h3>매장별 박스 구성</h3><p class="ds-sub">매장을 누르면 열린 박스를 직접 마감할 수 있습니다.</p></div></div>' + storeGrid() + '</div>' +
      '<div class="ds-stack"><div class="panel ds-panel"><div class="panel-head"><div><h3>' + (sel ? D.esc(sel.code) + ' 작업대' : '작업대') + '</h3></div></div>' +
      (sel ? '<div class="ds-bench"><div class="ds-boxviz"><div class="ds-boxviz-fill" style="height:' + (ob ? ob.qty / st.capacity * 100 : 0) + '%"></div><b>' + (ob ? ob.qty : 0) + '<i>/' + st.capacity + '</i></b><span>' + (ob ? ob.id + ' 열림' : '열린 박스 없음') + '</span></div>' +
        '<div class="ds-bench-info"><span>패킹 ' + sel.packed + ' / ' + sel.units + '개</span><span>박스 ' + sel.boxes.length + '개</span><button class="btn ds-btn" data-act="close-box"' + (ob && ob.qty ? '' : ' disabled') + '><i data-lucide="package-check"></i>박스 마감·라벨</button>' +
        (st.auto ? '' : '<button class="btn primary ds-btn" data-act="pack-one"' + (sel.packed < sel.units ? '' : ' disabled') + '><i data-lucide="plus"></i>' + Math.min(5, sel.units - sel.packed || 0) + '개 담기</button>') + '</div></div>'
        : '<div class="ds-empty">매장을 선택하세요.</div>') + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>출고 라벨</h3></div></div>' + label(lb) + '</div></div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>작업 기록</h3></div></div>' + D.logHtml(st, 8) + '</div></div>';
    D.bindControls(el, m); bind(el); D.icons();
  }

  function bind(el) {
    if (el.__dsPack) return; el.__dsPack = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var a = b.dataset.act;
      if (a === 'store') { st.sel = b.dataset.v; var ob = openBox(store(st.sel)); var last = store(st.sel).boxes.slice(-1)[0]; if (last && !ob) st.labelBox = last.id; }
      else if (a === 'close-box' || a === 'pack-one') {
        if (st.phase !== 'running') return D.toast('[작업 시작] 후 처리할 수 있습니다.');
        var s = store(st.sel);
        try {
          if (a === 'close-box') close(s, openBox(s), '수동');
          else {
            if (s.packed >= s.units) throw new Error('이 매장은 모두 담았습니다.');
            var bx = openBox(s) || newBox(s), q = Math.min(5, st.capacity - bx.qty, s.units - s.packed);
            bx.qty += q; s.packed += q;
            if (bx.qty >= st.capacity) close(s, bx, '만재'); else if (s.packed >= s.units) close(s, bx, '매장 완료');
          }
        } catch (err) { return D.toast(err.message); }
      } else return;
      D.persist(m); render();
    });
    el.addEventListener('change', function (e) {
      var a = e.target.dataset.act;
      if (a === 'cap') { if (st.phase !== 'idle') return D.toast('박스 용량은 작업 시작 전에만 바꿀 수 있습니다.'); st.capacity = Number(e.target.value); D.log(st, '박스 용량을 ' + st.capacity + '개로 정했습니다.'); }
      else if (a === 'auto') { st.auto = e.target.checked; D.log(st, '자동 패킹 ' + (st.auto ? '켬' : '끔 — 작업대에서 직접 담고 마감하세요')); }
      else return;
      D.persist(m); render();
    });
  }
})();
