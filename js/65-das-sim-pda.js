/* DAS 시뮬레이션 2 — PDA 피킹 (js/65-das-sim-pda.js)
   가상 PDA 화면: Zone 선택 → Zone별 피킹 리스트 → 로케이션 바코드 스캔 → 제품 상세(필요/피킹 수량) → 확정 → 리스트 복귀
   재고 부족 시 대체 로케이션 안내, 자동 피킹(가상 작업자) 지원 */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'pda', VIEW = 'dsPdaView';

  function build(seed) {
    var cat = D.makeCatalog(seed, 24, 24);
    var agg = D.aggregate(D.genOrders(cat, seed, {}), cat);
    var demand = {}; agg.bySku.forEach(function (s) { demand[s.code] = s.total; });
    var stock = D.genStock(cat, seed, demand);
    var sm = D.skuMap(cat);
    var tasks = agg.bySku.map(function (s, i) {
      return { id: 'PK-' + D.pad(i + 1, 3), zone: s.zone, sku: s.code, name: s.name, barcode: sm[s.code].barcode, loc: s.loc, need: s.total, picked: 0, picks: [], status: 'wait' };
    }).sort(function (a, b) { return a.zone.localeCompare(b.zone) || a.loc.localeCompare(b.loc); });
    return { cat: cat, stock: stock, tasks: tasks };
  }
  function fresh() {
    var b = build(D.DEFAULT_SEED);
    return { v: 1, phase: 'idle', elapsed: 0, seed: D.DEFAULT_SEED, stock: b.stock, tasks: b.tasks, screen: 'zones', zone: 'A', taskId: null, at: null, scanTarget: null, scanDraft: '', qtyDraft: '', err: '', auto: false, autoT: 0, workers: 1, log: [] };
  }
  var st = D.restore(ID, fresh);
  var cat = D.makeCatalog(st.seed, 24, 24);

  function task() { return st.tasks.filter(function (t) { return t.id === st.taskId; })[0] || null; }
  function remaining(t) { return t.need - t.picked; }
  function locStock(loc, sku) { var l = st.stock[loc]; return l && l.sku === sku ? l.qty : 0; }
  function altsFor(t) {
    var s = D.skuMap(cat)[t.sku]; if (!s) return [];
    return [s.loc].concat(s.alt).filter(function (l) { return l !== st.at; }).map(function (l) { return { loc: l, qty: locStock(l, t.sku), primary: l === s.loc }; }).filter(function (x) { return x.qty > 0; }).sort(function (a, b) { return b.qty - a.qty; });
  }
  function requireRunning() { if (st.phase !== 'running') { D.toast(st.phase === 'done' ? '모든 피킹이 끝났습니다.' : '[작업 시작]을 누른 뒤 PDA를 사용할 수 있습니다.'); return false; } return true; }

  function openTask(id) {
    var t = st.tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    if (t.status === 'done' || t.status === 'short') return D.toast('이미 확정된 작업입니다.');
    st.taskId = id; st.scanTarget = t.picked > 0 ? (altsFor(t)[0] || { loc: t.loc }).loc : t.loc; st.screen = 'scan'; st.scanDraft = ''; st.err = '';
  }
  function scan(code) {
    var t = task(); if (!t) return;
    code = String(code || '').trim().toUpperCase();
    if (!code) { st.err = '로케이션 바코드를 스캔하거나 입력해 주세요.'; return; }
    if (code.replace(/^LOC-/, '') !== st.scanTarget) { st.err = '로케이션 불일치: ' + code + ' (이동할 곳 ' + st.scanTarget + ')'; D.log(st, t.id + ' 로케이션 불일치 스캔 ' + code, 'warn'); return; }
    st.at = st.scanTarget; st.screen = 'detail'; st.err = '';
    var can = Math.min(remaining(t), locStock(st.at, t.sku));
    st.qtyDraft = String(can);
    t.status = 'doing';
  }
  function confirm(raw, forceShort) {
    var t = task(); if (!t) return false;
    var avail = locStock(st.at, t.sku), left = remaining(t);
    var v = D.validateQty(raw, { min: 0, max: Math.min(left, avail) });
    if (!v.ok) { st.err = v.error + (avail < left ? ' (이 로케이션 재고 ' + avail + '개)' : ''); return false; }
    if (v.value > 0) { D.applyPick(st.stock, st.at, t.sku, v.value); t.picked += v.value; t.picks.push({ loc: st.at, qty: v.value }); }
    if (t.picked >= t.need) { t.status = 'done'; D.log(st, t.id + ' ' + t.sku + ' 피킹 확정 ' + t.picked + '/' + t.need, 'ok'); }
    else if (forceShort || !altsFor(t).length) { t.status = 'short'; D.log(st, t.id + ' ' + t.sku + ' 결품 확정 ' + t.picked + '/' + t.need + ' (부족 ' + remaining(t) + ')', 'err'); }
    else { t.status = 'doing'; D.log(st, t.id + ' ' + t.sku + ' 부분 피킹 ' + t.picked + '/' + t.need + ' — 대체 로케이션 필요', 'warn'); }
    st.screen = 'list'; st.taskId = null; st.at = null; st.err = ''; st.qtyDraft = '';
    if (st.tasks.every(function (x) { return x.status === 'done' || x.status === 'short'; })) { st.phase = 'done'; st.auto = false; D.log(st, '모든 Zone 피킹이 끝났습니다.', 'ok'); }
    return true;
  }
  function goAlt(loc) { st.scanTarget = loc; st.screen = 'scan'; st.scanDraft = ''; st.err = ''; st.at = null; }

  // 자동 피킹: 0.6초(1x)마다 한 동작
  function autoStep() {
    if (st.screen === 'zones' || st.screen === 'list') {
      var z = st.tasks.filter(function (t) { return t.status === 'wait' || t.status === 'doing'; })[0];
      if (!z) return;
      st.zone = z.zone; st.screen = 'list'; openTask(z.id); return;
    }
    if (st.screen === 'scan') { scan(st.scanTarget); return; }
    if (st.screen === 'detail') {
      var t = task(), q = Math.min(remaining(t), locStock(st.at, t.sku));
      var short = q < remaining(t), alts = altsFor(t);
      if (short && alts.length && q === 0) { goAlt(alts[0].loc); return; }
      confirm(String(q), false);
      if (short && alts.length) { var t2 = st.tasks.filter(function (x) { return x.id === t.id; })[0]; st.taskId = t2.id; goAlt(alts[0].loc); }
    }
  }

  var m = D.register({
    id: ID, viewId: VIEW, label: 'PDA 피킹', icon: 'scan-barcode',
    state: function () { return st; },
    start: function () { if (st.phase === 'done') return; st.phase = 'running'; D.log(st, st.elapsed ? '피킹을 재개했습니다.' : '피킹 작업을 시작했습니다. (작업자 W01)'); },
    pause: function () { if (st.phase === 'running') { st.phase = 'paused'; D.log(st, '일시정지했습니다.', 'warn'); } },
    reset: function () { var w = st.workers; st = fresh(); st.workers = w; cat = D.makeCatalog(st.seed, 24, 24); D.log(st, '초기화했습니다. 가상 재고와 피킹 리스트를 다시 만들었습니다.'); },
    tick: function (dt) { if (!st.auto) return; st.autoT += dt; while (st.autoT >= 0.6 && st.phase === 'running') { st.autoT -= 0.6; autoStep(); } },
    summary: function () {
      var need = D.sum(st.tasks, function (t) { return t.need; }), picked = D.sum(st.tasks, function (t) { return t.picked; });
      return { total: need, done: picked, unit: '개', taskTotal: st.tasks.length, taskDone: st.tasks.filter(function (t) { return t.status === 'done' || t.status === 'short'; }).length, short: st.tasks.filter(function (t) { return t.status === 'short'; }).length };
    },
    detail: function () { return st.tasks; },
    render: render
  });

  /* ───────── 화면 ───────── */
  function zoneStats(z) {
    var list = st.tasks.filter(function (t) { return t.zone === z; });
    var done = list.filter(function (t) { return t.status === 'done' || t.status === 'short'; }).length;
    return { list: list, done: done, need: D.sum(list, function (t) { return t.need; }), picked: D.sum(list, function (t) { return t.picked; }) };
  }
  function statusIcon(t) { return t.status === 'done' ? '<i data-lucide="check-circle-2" class="ok"></i>' : t.status === 'short' ? '<i data-lucide="alert-octagon" class="err"></i>' : t.status === 'doing' ? '<i data-lucide="loader" class="run"></i>' : '<i data-lucide="circle" class="wait"></i>'; }

  function pdaScreen() {
    var bar = '<div class="pda-status"><span>LUSH PDA</span><span>W01 · ' + (st.phase === 'running' ? (st.auto ? '자동' : '작업 중') : '대기') + '</span><span><i data-lucide="wifi"></i><i data-lucide="battery-medium"></i></span></div>';
    var body = '';
    if (st.screen === 'zones') {
      body = '<div class="pda-title">Zone 선택</div><div class="pda-zones">' + D.ZONES.map(function (z) {
        var s = zoneStats(z), p = D.pct(s.picked, s.need);
        return '<button class="pda-zone" data-act="zone" data-v="' + z + '"><b>Zone ' + z + '</b><span>' + s.done + ' / ' + s.list.length + ' 작업</span><div class="pda-ring" style="--p:' + p + '"><em>' + Math.round(p) + '%</em></div></button>';
      }).join('') + '</div>';
    } else if (st.screen === 'list') {
      var zs = zoneStats(st.zone);
      body = '<div class="pda-title"><button class="pda-back" data-act="back-zones"><i data-lucide="chevron-left"></i></button>Zone ' + st.zone + ' 피킹 리스트<span>' + zs.done + '/' + zs.list.length + '</span></div><div class="pda-list">' +
        zs.list.map(function (t) {
          return '<button class="pda-row ' + t.status + '" data-act="task" data-v="' + t.id + '">' + statusIcon(t) + '<span class="pda-row-main"><b>' + t.loc + '</b><small>' + D.esc(t.sku) + ' · ' + D.esc(t.name) + '</small></span><span class="pda-row-qty">' + t.picked + '<i>/' + t.need + '</i></span></button>';
        }).join('') + '</div>';
    } else if (st.screen === 'scan') {
      var t = task();
      body = '<div class="pda-title"><button class="pda-back" data-act="back-list"><i data-lucide="chevron-left"></i></button>로케이션 스캔</div>' +
        '<div class="pda-target"><small>이동할 로케이션</small><b>' + D.esc(st.scanTarget) + '</b><span>' + D.esc(t ? t.sku + ' · ' + t.name : '') + '</span>' + (t && st.scanTarget !== t.loc ? '<em>대체 로케이션</em>' : '') + '</div>' +
        '<div class="pda-scanbox ' + (st.err ? 'bad' : '') + '"><i data-lucide="scan-line"></i><input data-act="scan-input" placeholder="로케이션 바코드" value="' + D.esc(st.scanDraft) + '" autocomplete="off" spellcheck="false"></div>' +
        (st.err ? '<div class="pda-err">' + D.esc(st.err) + '</div>' : '') +
        '<div class="pda-actions"><button class="pda-btn ghost" data-act="scan-typed">입력 확인</button><button class="pda-btn" data-act="scan-sim"><i data-lucide="zap"></i>스캔</button></div>';
    } else if (st.screen === 'detail') {
      var t2 = task(), avail = locStock(st.at, t2.sku), left = remaining(t2), short = avail < left, alts = altsFor(t2);
      var ratio = t2.picked / t2.need;
      body = '<div class="pda-title"><button class="pda-back" data-act="back-list"><i data-lucide="chevron-left"></i></button>피킹 상세</div>' +
        '<div class="pda-prod"><div><small>' + D.esc(t2.id) + ' · ' + D.esc(st.at) + '</small><b>' + D.esc(t2.name) + '</b><span>' + D.esc(t2.sku) + '</span></div>' + D.barcodeSvg(t2.barcode, 26) + '<code>' + D.esc(t2.barcode) + '</code></div>' +
        '<div class="pda-count ' + (ratio >= 1 ? 'full' : ratio > 0 ? 'part' : '') + '"><small>피킹 / 필요</small><b>' + t2.picked + '<i>/' + t2.need + '</i></b><span>남은 수량 ' + left + ' · 이 로케이션 재고 ' + avail + '</span></div>' +
        (short ? '<div class="pda-warn"><b><i data-lucide="triangle-alert"></i>재고 부족 ' + (left - avail) + '개</b>' + (alts.length ? '<span>대체 로케이션</span>' + alts.map(function (a) { return '<button class="pda-alt" data-act="alt" data-v="' + a.loc + '"><b>' + a.loc + '</b><span>' + (a.primary ? '주 로케이션' : '대체') + ' · 재고 ' + a.qty + '</span><i data-lucide="arrow-right"></i></button>'; }).join('') : '<span>대체 로케이션이 없습니다. 결품으로 확정됩니다.</span>') + '</div>' : '') +
        '<div class="pda-qty"><button data-act="minus">−</button><input data-act="qty-input" inputmode="numeric" value="' + D.esc(st.qtyDraft) + '"><button data-act="plus">+</button></div>' +
        (st.err ? '<div class="pda-err">' + D.esc(st.err) + '</div>' : '') +
        '<div class="pda-actions">' + (short && !alts.length ? '<button class="pda-btn warn" data-act="confirm-short">결품 확정</button>' : '') + '<button class="pda-btn" data-act="confirm"><i data-lucide="check"></i>피킹 확정</button></div>';
    }
    var overlay = st.phase !== 'running' ? '<div class="pda-overlay"><i data-lucide="' + (st.phase === 'done' ? 'party-popper' : 'pause-circle') + '"></i><b>' + (st.phase === 'done' ? '피킹 완료' : st.phase === 'paused' ? '일시정지' : '작업 시작 전') + '</b><span>' + (st.phase === 'done' ? '현황을 확인하거나 초기화하세요.' : '[작업 시작]을 누르면 PDA를 사용할 수 있습니다.') + '</span></div>' : '';
    return '<div class="pda-device"><div class="pda-notch"></div><div class="pda-screen">' + bar + '<div class="pda-body">' + body + '</div>' + overlay + '</div><div class="pda-trigger" title="스캔 버튼">SCAN</div></div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var s = m.summary();
    var extra = '<span class="ds-sep"></span><label class="ds-switch"><input type="checkbox" data-act="auto" ' + (st.auto ? 'checked' : '') + ' ' + (st.phase === 'done' ? 'disabled' : '') + '><span></span>자동 피킹</label>';
    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'scan-barcode', no: '02', title: 'PDA 피킹', desc: 'Zone별 피킹 리스트를 PDA로 처리합니다. 로케이션을 스캔하고 수량을 확정하세요.' }) + D.controls(m, extra) +
      '<div class="kpis data-kpis ds-kpis">' + D.kpi('피킹 작업', s.taskTotal, '건') + D.kpi('확정', s.taskDone, '건', 'ok') + D.kpi('피킹 수량', D.fmt(s.done) + ' / ' + D.fmt(s.total), '개', 'accent') + D.kpi('결품', s.short, '건', s.short ? 'err' : '') + '</div>' +
      '<div class="ds-pda-layout"><div class="ds-pda-stage">' + pdaScreen() + '</div><div class="ds-pda-side">' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>Zone별 진행</h3></div></div><div class="ds-zone-bars">' + D.ZONES.map(function (z) { var zs = zoneStats(z); return '<div class="ds-zone-bar"><span class="ds-zone z' + z + '">' + z + '</span>' + D.progress(D.pct(zs.picked, zs.need)) + '<b>' + zs.done + '/' + zs.list.length + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>재고 부족 작업</h3><p class="ds-sub">주 로케이션 재고가 필요 수량보다 적은 작업</p></div></div>' + shortList() + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>작업 기록</h3></div></div>' + D.logHtml(st, 8) + '</div></div></div></div>';
    D.bindControls(el, m); bind(el); D.icons();
  }
  function shortList() {
    var rows = st.tasks.filter(function (t) { return t.status !== 'done' && locStock(t.loc, t.sku) < remaining(t); });
    if (!rows.length) return '<div class="ds-empty">부족 예상 작업이 없습니다.</div>';
    return '<ul class="ds-mini-list">' + rows.slice(0, 8).map(function (t) { var alts = altsFor(t); return '<li><b>' + t.loc + '</b><span>' + D.esc(t.sku) + ' 필요 ' + remaining(t) + ' · 재고 ' + locStock(t.loc, t.sku) + '</span><em class="' + (alts.length ? 'warn' : 'err') + '">' + (alts.length ? '대체 ' + alts.map(function (a) { return a.loc; }).join(', ') : '결품 예상') + '</em></li>'; }).join('') + '</ul>';
  }

  function bind(el) {
    if (el.__dsPda) return; el.__dsPda = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
      var a = b.dataset.act;
      if (a === 'auto') return;
      if (!requireRunning()) return;
      if (st.auto && /^(zone|task|scan-sim|scan-typed|confirm|confirm-short|alt|minus|plus)$/.test(a)) { D.toast('자동 피킹 중입니다. 자동 피킹을 끄고 직접 처리해 주세요.'); return; }
      var t = task();
      if (a === 'zone') { st.zone = b.dataset.v; st.screen = 'list'; }
      else if (a === 'back-zones') st.screen = 'zones';
      else if (a === 'back-list') { if (t && t.status === 'doing' && !t.picked) t.status = 'wait'; st.screen = 'list'; st.taskId = null; st.at = null; st.err = ''; }
      else if (a === 'task') openTask(b.dataset.v);
      else if (a === 'scan-sim') scan(st.scanTarget);
      else if (a === 'scan-typed') scan(el.querySelector('[data-act="scan-input"]').value);
      else if (a === 'alt') goAlt(b.dataset.v);
      else if (a === 'minus' || a === 'plus') { var v = parseInt(st.qtyDraft, 10) || 0; v += a === 'plus' ? 1 : -1; var max = Math.min(remaining(t), locStock(st.at, t.sku)); st.qtyDraft = String(Math.max(0, Math.min(max, v))); st.err = ''; }
      else if (a === 'confirm') { if (confirm(st.qtyDraft, false)) D.toast('피킹을 확정했습니다. 리스트로 돌아갑니다.'); }
      else if (a === 'confirm-short') { if (confirm(st.qtyDraft, true)) D.toast('결품으로 확정했습니다.'); }
      else return;
      D.persist(m); render();
    });
    el.addEventListener('input', function (e) {
      if (e.target.dataset.act === 'qty-input') { st.qtyDraft = e.target.value; st.err = ''; e.target.classList.toggle('ds-invalid', !/^\d*$/.test(e.target.value)); }
      if (e.target.dataset.act === 'scan-input') st.scanDraft = e.target.value;
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var a = e.target.dataset.act;
      if ((a === 'scan-input' || a === 'qty-input') && requireRunning()) {
        e.preventDefault();
        if (st.auto) return D.toast('자동 피킹 중입니다.');
        if (a === 'scan-input') scan(e.target.value); else confirm(e.target.value, false);
        D.persist(m); render();
      }
    });
    el.addEventListener('change', function (e) {
      if (e.target.dataset.act === 'auto') {
        if (e.target.checked && st.phase !== 'running') { e.target.checked = false; return D.toast('[작업 시작] 후 자동 피킹을 켤 수 있습니다.'); }
        st.auto = e.target.checked; st.autoT = 0; D.log(st, '자동 피킹 ' + (st.auto ? '켬' : '끔'));
        D.persist(m); render();
      }
    });
  }
})();
