/* DAS 시뮬레이션 6 — 작업 현황판 (js/69-das-sim-board.js)
   각 모듈의 시뮬레이션 상태를 읽기 전용으로 모아 진행률·수량·SKU별 상태·작업 인원·처리량·생산성을 보여줍니다.
   (모듈들은 서로 독립적으로 동작하며, 현황판은 시뮬레이션 상태만 읽습니다. 운영 데이터는 사용하지 않습니다.) */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'board', VIEW = 'dsBoardView';
  var WORK = ['wave', 'pda', 'loc', 'das', 'pack'];
  var MENU = { wave: 'sim-wave', pda: 'sim-pda', loc: 'sim-location', das: 'sim-das', pack: 'sim-pack' };

  var st = { v: 1, phase: 'idle', elapsed: 0, sort: 'code' };

  function mods() { return WORK.map(function (id) { return D.modules[id]; }).filter(Boolean); }
  function metrics(mod) {
    var s = mod.summary(), ms = mod.state(), hrs = (ms.elapsed || 0) / 3600, workers = Math.max(1, ms.workers || 1);
    var uph = hrs > 0 ? s.done / hrs : 0;
    var remain = uph > 0 ? (s.total - s.done) / uph * 3600 : null;
    return { mod: mod, s: s, phase: ms.phase, elapsed: ms.elapsed || 0, workers: workers, uph: uph, uphw: uph / workers, remain: remain, p: D.pct(s.done, s.total) };
  }

  function skuStatus() {
    var cat = D.makeCatalog(D.DEFAULT_SEED, 24, 24), rows = {};
    cat.skus.forEach(function (s) { rows[s.code] = { code: s.code, name: s.name, order: 0, need: 0, picked: 0, pickShort: false, dNeed: 0, dPut: 0 }; });
    var w = D.modules.wave, wst = w && w.state();
    if (wst && wst.orders && wst.orders.length) D.aggregate(wst.orders, D.makeCatalog(wst.seed, 24, 24)).bySku.forEach(function (a) { if (rows[a.code]) rows[a.code].order = a.total; });
    var p = D.modules.pda; if (p) p.detail().forEach(function (t) { var r = rows[t.sku]; if (!r) return; r.need += t.need; r.picked += t.picked; if (t.status === 'short') r.pickShort = true; });
    var d = D.modules.das; if (d) d.detail().forEach(function (s) { s.queue.forEach(function (q) { var r = rows[q.sku]; if (!r) return; q.lines.forEach(function (l) { r.dNeed += l.need; r.dPut += l.put; }); }); });
    return Object.keys(rows).map(function (k) {
      var r = rows[k];
      r.state = r.pickShort ? ['결품', 'err'] : r.dNeed && r.dPut >= r.dNeed ? ['분배 완료', 'ok'] : r.dPut > 0 ? ['분배 중', 'run'] : r.need && r.picked >= r.need ? ['피킹 완료', 'ok'] : r.picked > 0 ? ['피킹 중', 'run'] : ['대기', ''];
      return r;
    }).filter(function (r) { return r.need || r.dNeed || r.order; });
  }

  function goto(id) {
    var menuId = MENU[id];
    try {
      /* eslint-disable no-undef */
      var list = typeof menus !== 'undefined' ? menus : [];
      var mm = list.filter(function (x) { return x.id === menuId; })[0];
      var nav = document.querySelector('[data-menu-id="' + menuId + '"]');
      if (mm && typeof activateMenu === 'function') { activateMenu(mm, nav); return; }
      if (typeof showView === 'function') showView(D.modules[id].viewId, D.modules[id].label, nav);
      /* eslint-enable no-undef */
    } catch (e) { D.toast('화면을 열지 못했습니다: ' + e.message); }
  }

  function bars(list) {
    var max = Math.max.apply(null, list.map(function (x) { return x.uph; }).concat([1]));
    return '<div class="ds-vbars">' + list.map(function (x) {
      return '<div class="ds-vbar"><div class="ds-vbar-track"><i style="height:' + (x.uph / max * 100) + '%"></i><u style="height:' + (x.uphw / max * 100) + '%"></u></div><b>' + D.fmt(Math.round(x.uph)) + '</b><span>' + D.esc(x.mod.label) + '</span></div>';
    }).join('') + '</div><div class="ds-legend"><span class="bar">모듈 처리량(개/시간)</span><span class="bar2">작업자 1인당</span></div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var list = mods().map(metrics);
    var total = D.sum(list, function (x) { return x.s.total; }), done = D.sum(list, function (x) { return x.s.done; });
    var running = list.filter(function (x) { return x.phase === 'running'; }).length;
    var workers = D.sum(list, function (x) { return x.workers; });
    var maxElapsed = Math.max.apply(null, list.map(function (x) { return x.elapsed; }).concat([0]));
    var uph = maxElapsed > 0 ? done / (maxElapsed / 3600) : 0;
    var skus = skuStatus();
    if (st.sort === 'state') skus.sort(function (a, b) { return String(a.state[0]).localeCompare(String(b.state[0])) || a.code.localeCompare(b.code); });
    var spd = D.getSpeed(), wid = 0;

    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'monitor-dot', no: '06', title: '작업 현황판', desc: '각 시뮬레이션의 진행률·처리량·생산성을 한눈에 봅니다. 시뮬레이션 결과만 집계합니다.' }) +
      '<div class="ds-controls"><div class="ds-controls-main"><button class="btn primary ds-btn" data-act="start-all"><i data-lucide="play"></i>전체 시작</button><button class="btn ds-btn" data-act="pause-all"' + (running ? '' : ' disabled') + '><i data-lucide="pause"></i>전체 일시정지</button><button class="btn ds-btn ds-btn-ghost" data-act="reset-all"><i data-lucide="rotate-ccw"></i>시뮬레이션 결과 초기화</button></div>' +
      '<div class="ds-controls-side"><span class="ds-chip ds-chip-' + (running ? 'running' : 'idle') + '"><i></i>' + (running ? '가동 ' + running + '개' : '정지') + '</span><label class="ds-speed">배속<select data-act="speed">' + [1, 2, 5, 10].map(function (v) { return '<option value="' + v + '"' + (v === spd ? ' selected' : '') + '>' + v + 'x</option>'; }).join('') + '</select></label></div></div>' +
      '<div class="ds-board-hero"><div class="ds-board-ring" style="--p:' + D.pct(done, total) + '"><b>' + D.pct(done, total) + '<i>%</i></b><span>전체 진행률</span></div>' +
      '<div class="ds-board-kpis">' + D.kpi('총 작업 수량', D.fmt(total), '개') + D.kpi('완료 수량', D.fmt(done), '개', 'ok') + D.kpi('가상 작업 인원', workers, '명') + D.kpi('전체 처리량', D.fmt(Math.round(uph)), '개/시간', 'accent') + D.kpi('최장 가동 시간', D.fmtDur(maxElapsed), '') + D.kpi('결품', D.sum(list, function (x) { return x.s.short || 0; }), '건', '') + '</div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>작업별 진행률</h3><p class="ds-sub">작업 인원을 바꾸면 처리량(1인당)이 다시 계산됩니다. 박스·출고는 인원에 따라 패킹 속도도 바뀝니다.</p></div></div><div class="ds-mod-grid">' +
      list.map(function (x) {
        var ws = []; for (var i = 0; i < x.workers; i++) ws.push('W' + D.pad(++wid));
        return '<div class="ds-mod"><div class="ds-mod-top"><span class="ds-mod-icon"><i data-lucide="' + x.mod.icon + '"></i></span><div><b>' + D.esc(x.mod.label) + '</b>' + D.phaseChip(x.phase) + '</div><button class="ds-link" data-act="goto" data-v="' + x.mod.id + '">열기<i data-lucide="arrow-up-right"></i></button></div>' +
          '<div class="ds-mod-p"><b>' + x.p + '%</b><span>' + D.fmt(x.s.done) + ' / ' + D.fmt(x.s.total) + ' ' + x.s.unit + ' · 작업 ' + x.s.taskDone + '/' + x.s.taskTotal + '</span></div>' + D.progress(x.p) +
          '<div class="ds-mod-nums"><div><small>가동 시간</small><b>' + D.fmtDur(x.elapsed) + '</b></div><div><small>처리량</small><b>' + D.fmt(Math.round(x.uph)) + '<i>/h</i></b></div><div><small>1인당</small><b>' + D.fmt(Math.round(x.uphw)) + '<i>/h</i></b></div><div><small>남은 시간</small><b>' + (x.p >= 100 ? '완료' : x.remain == null ? '-' : D.fmtDur(x.remain)) + '</b></div></div>' +
          '<div class="ds-mod-workers"><label>작업 인원<select data-act="workers" data-v="' + x.mod.id + '">' + [1, 2, 3, 4, 5, 6].map(function (v) { return '<option' + (v === x.workers ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label><span>' + ws.map(function (w) { return '<i>' + w + '</i>'; }).join('') + '</span></div></div>';
      }).join('') + '</div></div>' +
      '<div class="ds-grid-2"><div class="panel ds-panel"><div class="panel-head"><div><h3>생산성 분석</h3><p class="ds-sub">시뮬레이션 시간 기준 시간당 처리 수량</p></div></div>' + bars(list) +
      '<table class="ds-table compact"><thead><tr><th>작업</th><th class="num">인원</th><th class="num">완료</th><th class="num">개/시간</th><th class="num">1인당</th></tr></thead><tbody>' + list.map(function (x) { return '<tr><td>' + D.esc(x.mod.label) + '</td><td class="num">' + x.workers + '</td><td class="num">' + D.fmt(x.s.done) + '</td><td class="num">' + D.fmt(Math.round(x.uph)) + '</td><td class="num">' + D.fmt(Math.round(x.uphw)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>SKU별 처리 상태</h3><p class="ds-sub">주문(작업 생성) · 피킹(PDA) · 분배(DAS) 시뮬레이션 기준</p></div><div class="ds-seg"><button class="' + (st.sort === 'code' ? 'on' : '') + '" data-act="sort" data-v="code">SKU순</button><button class="' + (st.sort === 'state' ? 'on' : '') + '" data-act="sort" data-v="state">상태순</button></div></div>' +
      '<div class="ds-table-wrap tall"><table class="ds-table"><thead><tr><th>SKU</th><th class="num">주문</th><th>피킹</th><th>분배</th><th>상태</th></tr></thead><tbody>' +
      skus.map(function (r) { return '<tr><td><b>' + r.code + '</b><small class="ds-block">' + D.esc(r.name) + '</small></td><td class="num">' + (r.order ? D.fmt(r.order) : '-') + '</td><td>' + (r.need ? D.progress(D.pct(r.picked, r.need), 'thin') + '<small>' + r.picked + '/' + r.need + '</small>' : '-') + '</td><td>' + (r.dNeed ? D.progress(D.pct(r.dPut, r.dNeed), 'thin') + '<small>' + r.dPut + '/' + r.dNeed + '</small>' : '-') + '</td><td><span class="ds-tag ' + r.state[1] + '">' + r.state[0] + '</span></td></tr>'; }).join('') +
      '</tbody></table></div></div></div></div>';
    bind(el); D.icons();
  }

  function bind(el) {
    if (el.__dsBoard) return; el.__dsBoard = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || b.disabled) return;
      var a = b.dataset.act;
      if (a === 'start-all') mods().forEach(function (mod) {
        var s = mod.state();
        if (s.phase === 'done') return;
        if (mod.id === 'wave' && !s.orders.length) { D.toast('출고 작업 생성: 샘플 주문이 없어 시작하지 않았습니다. 해당 화면에서 샘플 주문을 먼저 생성하세요.'); return; }
        mod.start();
        if ('auto' in s && (mod.id === 'pda' || mod.id === 'das')) { s.auto = true; s.autoT = 0; }
        D.persist(mod);
      });
      else if (a === 'pause-all') mods().forEach(function (mod) { mod.pause(); D.persist(mod); });
      else if (a === 'reset-all') { if (!window.confirm('모든 시뮬레이션 결과를 초기화할까요? (가상 데이터만 지워지며 운영 데이터에는 영향이 없습니다)')) return; mods().forEach(function (mod) { mod.reset(); D.persist(mod); }); D.toast('시뮬레이션 결과를 초기화했습니다.'); }
      else if (a === 'goto') return goto(b.dataset.v);
      else if (a === 'sort') st.sort = b.dataset.v;
      else return;
      render();
    });
    el.addEventListener('change', function (e) {
      var a = e.target.dataset.act;
      if (a === 'speed') return D.setSpeed(Number(e.target.value));
      if (a === 'workers') { var mod = D.modules[e.target.dataset.v]; if (!mod) return; var v = Number(e.target.value); if (!(v >= 1 && v <= 6)) return; mod.state().workers = v; mod.state().log && D.log(mod.state(), '작업 인원을 ' + v + '명으로 바꿨습니다.'); D.persist(mod); render(); }
    });
  }

  D.register({ id: ID, viewId: VIEW, label: '작업 현황판', icon: 'monitor-dot', state: function () { return st; }, tick: function () {}, start: function () {}, pause: function () {}, reset: function () {}, summary: function () { return { total: 0, done: 0 }; }, render: render });
})();
