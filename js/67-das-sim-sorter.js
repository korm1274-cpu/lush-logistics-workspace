/* DAS 시뮬레이션 4 — DAS 분류 (js/67-das-sim-sorter.js)
   DAS-1 / DAS-2 셀 벽: 제품 바코드 스캔 → 해당 매장 셀 점등(필요 수량) → 분배 수량 반영 → 셀 완료 → 모든 셀 완료 시 SKU 완료
   셀 배치는 DasSim.DAS_LAYOUT 형식({ stations:[{id, rows, cols}] })만 바꾸면 실제 장비 구조에 맞춰 다시 계산됩니다. */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'das', VIEW = 'dsDasView';
  var AUTO_SEC = 0.45;

  function plan(seed, layout) {
    var cat = D.makeCatalog(seed, 24, 24);
    var agg = D.aggregate(D.genOrders(cat, seed, {}), cat);
    return D.buildDasPlan(agg, cat, layout);
  }
  function fresh(layout) {
    layout = layout || D.clone(D.DAS_LAYOUT);
    var p = plan(D.DEFAULT_SEED, layout);
    return { v: 1, phase: 'idle', elapsed: 0, seed: D.DEFAULT_SEED, layout: layout, stations: p.stations, unassigned: p.unassigned, active: layout.stations[0].id, auto: false, autoT: 0, putQty: '', scanDraft: '', flash: null, err: '', workers: 2, log: [] };
  }
  var st = D.restore(ID, fresh);

  function station(id) { return st.stations.filter(function (s) { return s.id === (id || st.active); })[0]; }
  function cur(s) { return s && s.current != null ? s.queue[s.current] : null; }
  function stStats(s) {
    var need = 0, put = 0; s.queue.forEach(function (q) { q.lines.forEach(function (l) { need += l.need; put += l.put; }); });
    return { need: need, put: put, done: s.queue.filter(function (q) { return q.status === 'done'; }).length, total: s.queue.length };
  }
  function requireRunning() { if (st.phase !== 'running') { D.toast(st.phase === 'done' ? '모든 분배가 끝났습니다.' : '[작업 시작]을 누른 뒤 스캔할 수 있습니다.'); return false; } return true; }

  function scan(raw) {
    var s = station(), code = String(raw || '').trim();
    st.err = '';
    if (!code) { st.err = '제품 바코드를 스캔하거나 입력해 주세요.'; return false; }
    var c = cur(s);
    if (c) { st.err = '현재 SKU(' + c.sku + ') 분배를 먼저 끝내 주세요.'; return false; }
    var idx = -1;
    s.queue.forEach(function (q, i) { if (q.barcode === code || q.sku === code.toUpperCase()) idx = i; });
    if (idx < 0) {
      var other = st.stations.filter(function (o) { return o !== s && o.queue.some(function (q) { return q.barcode === code || q.sku === code.toUpperCase(); }); })[0];
      st.err = other ? '이 제품은 ' + other.id + ' 분배 대상입니다.' : '등록되지 않은 바코드입니다: ' + code;
      D.log(st, s.id + ' 스캔 오류 — ' + st.err, 'err'); return false;
    }
    if (s.queue[idx].status === 'done') { st.err = s.queue[idx].sku + '는 이미 분배가 끝났습니다.'; return false; }
    s.current = idx; s.queue[idx].status = 'run';
    D.log(st, s.id + ' 스캔 ' + s.queue[idx].sku + ' → 셀 ' + s.queue[idx].lines.length + '개 점등');
    return true;
  }
  function nextBarcode(s) { var q = s.queue.filter(function (x) { return x.status === 'wait'; })[0]; return q ? q.barcode : ''; }
  function put(store, qty) {
    var s = station(), c = cur(s);
    try {
      var line = c && c.lines.filter(function (l) { return l.store === store; })[0];
      var q = qty == null ? (line ? line.need - line.put : 1) : qty;
      var r = D.putToCell(s, store, q);
      st.flash = { store: store, ok: true };
      if (r.line.put >= r.line.need) D.log(st, s.id + ' ' + c.sku + ' → ' + store + ' ' + r.line.need + '개 분배 완료', 'ok');
      if (r.skuDone) {
        D.log(st, s.id + ' ' + c.sku + ' 모든 셀 분배 완료', 'ok');
        if (st.stations.every(function (x) { return x.queue.every(function (y) { return y.status === 'done'; }); })) { st.phase = 'done'; st.auto = false; D.log(st, 'DAS-1·DAS-2 분배가 모두 끝났습니다.', 'ok'); }
      }
      return true;
    } catch (e) { st.flash = { store: store, ok: false }; st.err = e.message; return false; }
  }

  var m = D.register({
    id: ID, viewId: VIEW, label: 'DAS 분류', icon: 'grid-3x3',
    state: function () { return st; },
    start: function () { if (st.phase === 'done') return; st.phase = 'running'; D.log(st, st.elapsed ? '분배를 재개했습니다.' : 'DAS 분배를 시작했습니다.'); },
    pause: function () { if (st.phase === 'running') { st.phase = 'paused'; D.log(st, '일시정지했습니다.', 'warn'); } },
    reset: function () { var w = st.workers, layout = st.layout; st = fresh(layout); st.workers = w; D.log(st, '초기화했습니다.'); },
    tick: function (dt) {
      if (!st.auto) return;
      st.autoT += dt;
      while (st.autoT >= AUTO_SEC && st.phase === 'running') {
        st.autoT -= AUTO_SEC;
        // 두 DAS를 번갈아 처리(작업자 2명 가정)
        st.stations.forEach(function (s) {
          if (st.phase !== 'running') return;
          var prev = st.active; st.active = s.id;
          var c = cur(s);
          if (!c) { var bc = nextBarcode(s); if (bc) scan(bc); }
          else { var l = c.lines.filter(function (x) { return x.put < x.need; })[0]; if (l) put(l.store, null); }
          st.active = prev;
        });
      }
    },
    summary: function () {
      var need = 0, done = 0, t = 0, td = 0;
      st.stations.forEach(function (s) { var x = stStats(s); need += x.need; done += x.put; t += x.total; td += x.done; });
      return { total: need, done: done, unit: '개', taskTotal: t, taskDone: td };
    },
    detail: function () { return st.stations; },
    render: render
  });

  function wall(s) {
    var c = cur(s), lit = {};
    if (c) c.lines.forEach(function (l) { lit[l.store] = l; });
    var doneStores = {};
    s.queue.forEach(function (q) { q.lines.forEach(function (l) { doneStores[l.store] = (doneStores[l.store] || 0) + l.put; }); });
    return '<div class="ds-wall" style="--cols:' + s.cols + '">' + s.cells.map(function (cell) {
      var l = cell.store && lit[cell.store];
      var cls = ['ds-cell', !cell.store ? 'off' : l ? (l.put >= l.need ? 'lit done' : 'lit') : '', st.flash && st.flash.store === cell.store && s.id === st.active ? (st.flash.ok ? 'flash-ok' : 'flash-bad') : ''].join(' ');
      return '<button class="' + cls + '" ' + (cell.store ? 'data-act="cell" data-v="' + cell.store + '"' : 'disabled') + '><span class="ds-cell-no">' + cell.label + '</span><span class="ds-cell-store">' + (cell.store || '미배정') + '</span>' +
        (l ? '<b class="ds-cell-need">' + (l.need - l.put) + '</b><span class="ds-cell-put">' + l.put + ' / ' + l.need + '</span>' : cell.store ? '<span class="ds-cell-total">누적 ' + (doneStores[cell.store] || 0) + '</span>' : '') + '<i class="ds-lamp"></i></button>';
    }).join('') + '</div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var s = station(), c = cur(s), x = stStats(s), sum = m.summary();
    var extra = '<span class="ds-sep"></span><label class="ds-switch"><input type="checkbox" data-act="auto" ' + (st.auto ? 'checked' : '') + ' ' + (st.phase === 'done' ? 'disabled' : '') + '><span></span>자동 분배</label>';
    var started = st.stations.some(function (o) { return o.queue.some(function (q) { return q.status !== 'wait'; }); });
    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'grid-3x3', no: '04', title: 'DAS 분류', desc: '제품 바코드를 스캔하면 분배할 매장 셀에 불이 켜집니다. 셀을 눌러 분배 수량을 반영하세요.' }) + D.controls(m, extra) +
      '<div class="kpis data-kpis ds-kpis">' + D.kpi('분배 SKU', sum.taskDone + ' / ' + sum.taskTotal, '종') + D.kpi('분배 수량', D.fmt(sum.done) + ' / ' + D.fmt(sum.total), '개', 'accent') + st.stations.map(function (o) { var y = stStats(o); return D.kpi(o.id + ' 진행률', D.pct(y.put, y.need) + '%', y.done + '/' + y.total + ' SKU'); }).join('') + '</div>' +
      '<div class="ds-station-tabs">' + st.stations.map(function (o) { var y = stStats(o); return '<button class="' + (o.id === st.active ? 'on' : '') + '" data-act="station" data-v="' + o.id + '"><b>' + o.id + '</b><span>' + o.rows + '×' + o.cols + ' 셀 · ' + y.done + '/' + y.total + ' SKU</span>' + D.progress(D.pct(y.put, y.need), 'thin') + '</button>'; }).join('') + '</div>' +
      (st.unassigned.length ? '<div class="ds-alert err"><i data-lucide="triangle-alert"></i>셀이 부족해 매장 ' + st.unassigned.length + '곳(' + st.unassigned.slice(0, 6).join(', ') + (st.unassigned.length > 6 ? '…' : '') + ')을 배정하지 못했습니다. 레이아웃의 행·열을 늘려 주세요.</div>' : '') +
      '<div class="ds-das-layout"><div class="panel ds-panel ds-das-main">' +
      '<div class="ds-scanner ' + (st.err ? 'bad' : '') + '"><i data-lucide="scan-barcode"></i><input data-act="scan-input" placeholder="제품 바코드 (예: ' + (nextBarcode(s) || '20…') + ')" value="' + D.esc(st.scanDraft) + '" autocomplete="off" spellcheck="false">' +
      '<button class="btn ds-btn" data-act="scan-typed">스캔 확인</button><button class="btn primary ds-btn" data-act="scan-next"><i data-lucide="zap"></i>다음 SKU 스캔</button>' +
      '<label class="ds-mini">분배 수량<input data-act="put-qty" inputmode="numeric" placeholder="전량" value="' + D.esc(st.putQty) + '"></label></div>' +
      (st.err ? '<div class="ds-alert err"><i data-lucide="circle-x"></i>' + D.esc(st.err) + '</div>' : '') +
      '<div class="ds-current">' + (c ? '<div class="ds-current-info"><small>현재 SKU · ' + s.id + '</small><b>' + D.esc(c.sku) + ' ' + D.esc(c.name) + '</b><span>점등 셀 ' + c.lines.length + '개 · 완료 ' + c.lines.filter(function (l) { return l.put >= l.need; }).length + '개 · 남은 수량 ' + D.sum(c.lines, function (l) { return l.need - l.put; }) + '개</span></div>' + D.barcodeSvg(c.barcode, 30) : '<div class="ds-current-info idle"><small>' + s.id + '</small><b>대기 중</b><span>제품을 스캔하면 분배할 셀이 점등됩니다.</span></div>') + '</div>' +
      wall(s) + '<p class="ds-hint">점등된 셀을 누르면 남은 수량 전체(또는 입력한 분배 수량)가 반영됩니다. 셀 번호 = 장비 셀 위치, 아래 글자 = 매장.</p></div>' +
      '<div class="ds-das-side"><div class="panel ds-panel"><div class="panel-head"><div><h3>' + s.id + ' SKU 대기열</h3></div><span class="badge">' + x.done + '/' + x.total + '</span></div><div class="ds-table-wrap tall"><table class="ds-table"><thead><tr><th>SKU</th><th class="num">셀</th><th class="num">수량</th><th>상태</th></tr></thead><tbody>' +
      s.queue.map(function (q) { var need = D.sum(q.lines, function (l) { return l.need; }), p = D.sum(q.lines, function (l) { return l.put; }); return '<tr class="' + (q.status === 'run' ? 'sel' : '') + '"><td><b>' + q.sku + '</b><small class="ds-block">' + D.esc(q.name) + '</small></td><td class="num">' + q.lines.length + '</td><td class="num">' + p + '/' + need + '</td><td><span class="ds-tag ' + (q.status === 'done' ? 'ok' : q.status === 'run' ? 'run' : '') + '">' + (q.status === 'done' ? '완료' : q.status === 'run' ? '분배 중' : '대기') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>장비 레이아웃</h3><p class="ds-sub">실제 DAS 구조에 맞춰 행·열을 바꿀 수 있습니다.</p></div></div><form class="ds-layout-form" data-act="layout">' +
      st.layout.stations.map(function (o, i) { return '<div><b>' + o.id + '</b><label>행<select name="r' + i + '">' + [2, 3, 4, 5, 6].map(function (v) { return '<option' + (v === o.rows ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label><label>열<select name="c' + i + '">' + [3, 4, 5, 6, 8].map(function (v) { return '<option' + (v === o.cols ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label></div>'; }).join('') +
      '<button class="btn ds-btn"><i data-lucide="layout-grid"></i>레이아웃 적용</button></form>' + (started ? '<p class="ds-hint">적용하면 분배 진행 상황이 초기화됩니다.</p>' : '') + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>작업 기록</h3></div></div>' + D.logHtml(st, 8) + '</div></div></div></div>';
    st.flash = null;
    D.bindControls(el, m); bind(el); D.icons();
  }

  function bind(el) {
    if (el.__dsDas) return; el.__dsDas = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'FORM' || b.tagName === 'SELECT') return;
      var a = b.dataset.act;
      if (a === 'station') { st.active = b.dataset.v; st.err = ''; D.persist(m); return render(); }
      if (a === 'auto') return;
      if (!requireRunning()) return;
      if (st.auto && /^(scan-typed|scan-next|cell)$/.test(a)) return D.toast('자동 분배 중입니다. 자동 분배를 끄고 직접 처리해 주세요.');
      if (a === 'scan-next') { var bc = nextBarcode(station()); if (!bc) { st.err = '이 DAS의 분배 대상 SKU가 모두 끝났습니다.'; } else { st.scanDraft = ''; scan(bc); } }
      else if (a === 'scan-typed') { if (scan(el.querySelector('[data-act="scan-input"]').value)) st.scanDraft = ''; }
      else if (a === 'cell') {
        var qty = null;
        if (String(st.putQty).trim()) { var v = D.validateQty(st.putQty, { min: 1 }); if (!v.ok) { st.err = v.error; D.persist(m); return render(); } qty = v.value; }
        if (put(b.dataset.v, qty)) st.err = '';
      }
      else return;
      D.persist(m); render();
    });
    el.addEventListener('input', function (e) {
      if (e.target.dataset.act === 'scan-input') st.scanDraft = e.target.value;
      if (e.target.dataset.act === 'put-qty') { st.putQty = e.target.value; e.target.classList.toggle('ds-invalid', !/^\d*$/.test(e.target.value)); }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.dataset.act === 'scan-input') { e.preventDefault(); if (!requireRunning()) return; if (st.auto) return D.toast('자동 분배 중입니다.'); if (scan(e.target.value)) st.scanDraft = ''; D.persist(m); render(); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.dataset.act === 'auto') {
        if (e.target.checked && st.phase !== 'running') { e.target.checked = false; return D.toast('[작업 시작] 후 자동 분배를 켤 수 있습니다.'); }
        st.auto = e.target.checked; st.autoT = 0; D.log(st, '자동 분배 ' + (st.auto ? '켬' : '끔')); D.persist(m); render();
      }
    });
    el.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-act="layout"]')) return;
      e.preventDefault();
      if (st.phase === 'running') return D.toast('진행 중에는 레이아웃을 바꿀 수 없습니다. 일시정지 후 적용해 주세요.');
      var f = e.target, layout = { stations: st.layout.stations.map(function (o, i) { return { id: o.id, rows: Number(f['r' + i].value), cols: Number(f['c' + i].value) }; }) };
      var started = st.stations.some(function (o) { return o.queue.some(function (q) { return q.status !== 'wait'; }); });
      if (started && !window.confirm('레이아웃을 바꾸면 분배 진행 상황이 초기화됩니다. 계속할까요?')) return;
      var w = st.workers; st = fresh(layout); st.workers = w;
      D.log(st, '레이아웃 적용: ' + layout.stations.map(function (o) { return o.id + ' ' + o.rows + '×' + o.cols; }).join(', ') + (st.unassigned.length ? ' (미배정 매장 ' + st.unassigned.length + '곳)' : ''), st.unassigned.length ? 'warn' : 'ok');
      D.persist(m); render();
    });
  }
})();
