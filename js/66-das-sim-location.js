/* DAS 시뮬레이션 3 — 로케이션 및 재고 관리 (js/66-das-sim-location.js)
   Zone별 랙 맵(로케이션 재고) · SKU별 재고 현황 · 피킹에 따른 가상 재고 변화 · 부족/대체 로케이션 확인 */
(function () {
  'use strict';
  var D = window.DasSim; if (!D) return;
  var ID = 'loc', VIEW = 'dsLocView';
  var PICK_SEC = 0.7;

  function build(seed) {
    var cat = D.makeCatalog(seed, 24, 24);
    var agg = D.aggregate(D.genOrders(cat, seed, {}), cat);
    var demand = {}; agg.bySku.forEach(function (s) { demand[s.code] = s.total; });
    var stock = D.genStock(cat, seed, demand);
    var r = D.rng(seed * 31 + 9), queue = [], n = 0;
    agg.bySku.forEach(function (s) {
      var parts = D.randInt(r, 1, 3), left = s.total;
      for (var i = 0; i < parts && left > 0; i++) { var q = i === parts - 1 ? left : Math.max(1, Math.round(left / (parts - i) * (0.7 + r() * 0.6))); q = Math.min(q, left); left -= q; queue.push({ id: 'PO-' + D.pad(++n, 3), sku: s.code, qty: q, status: 'wait' }); }
    });
    queue = D.shuffle(r, queue);
    return { stock: stock, queue: queue, demand: demand };
  }
  function fresh() { var b = build(D.DEFAULT_SEED); return { v: 1, phase: 'idle', elapsed: 0, seed: D.DEFAULT_SEED, stock: b.stock, initial: D.clone(b.stock), queue: b.queue, demand: b.demand, zone: 'A', selSku: null, selLoc: null, pickT: 0, moves: [], shortEvents: 0, workers: 1, log: [] }; }
  var st = D.restore(ID, fresh);
  var cat = D.makeCatalog(st.seed, 24, 24);

  function pendingDemand(code) { return D.sum(st.queue.filter(function (q) { return q.sku === code && q.status === 'wait'; }), function (q) { return q.qty; }); }
  function skuRows() {
    return cat.skus.map(function (s) {
      var locs = D.locsOfSku(st.stock, cat, s.code), total = D.sum(locs, function (l) { return l.qty; }), need = pendingDemand(s.code);
      var primary = st.stock[s.loc] ? st.stock[s.loc].qty : 0;
      var status = total === 0 ? 'out' : total < need ? 'short' : primary < need ? 'alt' : 'ok';
      return { s: s, locs: locs, total: total, need: need, primary: primary, status: status };
    });
  }
  var STATUS = { ok: ['정상', 'ok'], alt: ['대체 필요', 'warn'], short: ['부족', 'err'], out: ['품절', 'err'] };

  function doPick(code, qty, source) {
    var plan = D.allocate(st.stock, cat, code, qty);
    if (plan.error) throw new Error(plan.error);
    plan.plan.forEach(function (p) { D.applyPick(st.stock, p.loc, code, p.qty); st.moves.unshift({ t: Math.round(st.elapsed || 0), sku: code, loc: p.loc, qty: p.qty, alt: p.alt, source: source }); });
    if (st.moves.length > 80) st.moves.length = 80;
    var txt = plan.plan.map(function (p) { return p.loc + (p.alt ? '(대체)' : '') + ' ' + p.qty; }).join(', ');
    if (plan.shortage > 0) { st.shortEvents++; D.log(st, code + ' ' + qty + '개 중 ' + plan.shortage + '개 부족 · ' + (txt || '출고 가능 재고 없음'), 'err'); }
    else D.log(st, code + ' ' + qty + '개 피킹 → ' + txt, plan.plan.some(function (p) { return p.alt; }) ? 'warn' : 'ok');
    return plan;
  }

  var m = D.register({
    id: ID, viewId: VIEW, label: '로케이션·재고', icon: 'warehouse',
    state: function () { return st; },
    start: function () { if (st.phase === 'done') return; st.phase = 'running'; D.log(st, st.elapsed ? '피킹 반영을 재개했습니다.' : '피킹 주문을 순서대로 재고에 반영합니다.'); },
    pause: function () { if (st.phase === 'running') { st.phase = 'paused'; D.log(st, '일시정지했습니다.', 'warn'); } },
    reset: function () { var w = st.workers; st = fresh(); st.workers = w; cat = D.makeCatalog(st.seed, 24, 24); D.log(st, '초기화했습니다. 가상 재고를 처음 상태로 되돌렸습니다.'); },
    tick: function (dt) {
      st.pickT += dt;
      while (st.pickT >= PICK_SEC && st.phase === 'running') {
        st.pickT -= PICK_SEC;
        var q = st.queue.filter(function (x) { return x.status === 'wait'; })[0];
        if (!q) { st.phase = 'done'; D.log(st, '모든 피킹 주문을 반영했습니다.', 'ok'); return; }
        var p = doPick(q.sku, q.qty, q.id);
        q.status = p.shortage > 0 ? 'short' : 'done'; q.picked = q.qty - p.shortage;
      }
    },
    summary: function () {
      var total = D.sum(st.queue, function (q) { return q.qty; }), done = D.sum(st.queue, function (q) { return q.status === 'wait' ? 0 : (q.picked || 0); });
      return { total: total, done: done, unit: '개', taskTotal: st.queue.length, taskDone: st.queue.filter(function (q) { return q.status !== 'wait'; }).length, short: st.shortEvents };
    },
    detail: function () { return skuRows(); },
    render: render
  });

  function rackMap() {
    var html = '';
    for (var rack = 1; rack <= 4; rack++) {
      html += '<div class="ds-rack"><div class="ds-rack-name">RACK ' + D.pad(rack) + '</div>';
      for (var lv = 3; lv >= 1; lv--) {
        var code = st.zone + '-' + D.pad(rack) + '-' + lv, l = st.stock[code], s = l.sku ? D.skuMap(cat)[l.sku] : null;
        var fill = l.cap ? l.qty / l.cap : 0, isAlt = s && s.loc !== code;
        var need = l.sku ? pendingDemand(l.sku) : 0;
        var tone = !l.sku ? 'empty' : l.qty === 0 ? 'zero' : (st.stock[s.loc].qty < need && !isAlt) ? 'low' : fill < 0.2 ? 'low' : 'ok';
        var cls = ['ds-bin', tone, st.selLoc === code ? 'sel' : '', st.selSku && l.sku === st.selSku ? 'hl' : ''].join(' ');
        html += '<button class="' + cls + '" data-act="bin" data-v="' + code + '"><span class="ds-bin-code">' + code + (isAlt ? '<em>대체</em>' : '') + '</span>' +
          (l.sku ? '<b>' + D.esc(l.sku) + '</b><span class="ds-bin-qty">' + D.fmt(l.qty) + '<i>/' + D.fmt(l.cap) + '</i></span>' + D.progress(fill * 100, 'thin') : '<span class="ds-bin-empty">빈 로케이션</span>') + '</button>';
      }
      html += '</div>';
    }
    return '<div class="ds-racks">' + html + '</div>';
  }

  function skuTable(rows) {
    return '<div class="ds-table-wrap tall"><table class="ds-table" data-table="sku"><thead><tr><th>SKU</th><th>품명</th><th>주 로케이션</th><th class="num">총 재고</th><th class="num">남은 피킹</th><th>상태</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var stt = STATUS[r.status];
        return '<tr data-sku="' + r.s.code + '" data-q="' + D.esc((r.s.code + ' ' + r.s.name + ' ' + r.s.loc).toLowerCase()) + '" class="' + (st.selSku === r.s.code ? 'sel' : '') + '"><td><b>' + r.s.code + '</b></td><td>' + D.esc(r.s.name) + '</td><td><span class="ds-loc">' + r.s.loc + '</span>' + (r.s.alt.length ? '<small class="ds-alt-n">+' + r.s.alt.length + '</small>' : '') + '</td><td class="num"><b>' + D.fmt(r.total) + '</b></td><td class="num">' + D.fmt(r.need) + '</td><td><span class="ds-tag ' + stt[1] + '">' + stt[0] + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function skuDetail(rows) {
    var r = rows.filter(function (x) { return x.s.code === st.selSku; })[0];
    if (!r) return '<div class="ds-empty">랙 맵의 로케이션이나 SKU 행을 선택하면 로케이션별 재고와 대체 로케이션을 보여줍니다.</div>';
    var init = D.sum(D.locsOfSku(st.initial, cat, r.s.code), function (l) { return l.qty; });
    var preview = r.need ? D.allocate(st.stock, cat, r.s.code, r.need) : null;
    return '<div class="ds-skud"><div class="ds-skud-head"><div><small>' + r.s.code + ' · ' + D.esc(r.s.cat) + '</small><b>' + D.esc(r.s.name) + '</b></div>' + D.barcodeSvg(r.s.barcode, 24) + '</div>' +
      '<div class="ds-skud-nums"><div><small>시작 재고</small><b>' + D.fmt(init) + '</b></div><div><small>현재 재고</small><b>' + D.fmt(r.total) + '</b></div><div><small>남은 피킹</small><b>' + D.fmt(r.need) + '</b></div></div>' +
      '<ul class="ds-mini-list">' + r.locs.map(function (l) { return '<li><b>' + l.loc + '</b><span>' + (l.loc === r.s.loc ? '주 로케이션' : '대체 로케이션') + '</span><em class="' + (l.qty ? 'ok' : 'err') + '">' + D.fmt(l.qty) + '개</em></li>'; }).join('') + '</ul>' +
      (preview ? '<div class="ds-alloc ' + (preview.shortage ? 'bad' : preview.plan.length > 1 ? 'warn' : 'ok') + '"><b>남은 피킹 ' + r.need + '개 배정 미리보기</b><span>' + (preview.plan.map(function (p) { return p.loc + (p.alt ? '(대체)' : '') + ' ' + p.qty + '개'; }).join(' → ') || '배정 가능한 재고 없음') + (preview.shortage ? ' · <b>' + preview.shortage + '개 부족</b>' : '') + '</span></div>' : '') +
      '<form class="ds-form inline" data-act="manual"><label>수동 피킹 수량<input name="qty" inputmode="numeric" placeholder="1~' + Math.max(1, r.total) + '"></label><button class="btn primary ds-btn"' + (r.total ? '' : ' disabled') + '><i data-lucide="minus-circle"></i>재고 차감</button></form></div>';
  }

  function render() {
    var el = document.getElementById(VIEW); if (!el) return;
    var rows = skuRows(), s = m.summary();
    var used = Object.keys(st.stock).filter(function (k) { return st.stock[k].sku; }).length;
    var totalQty = D.sum(Object.keys(st.stock), function (k) { return st.stock[k].qty; });
    var bad = rows.filter(function (r) { return r.status === 'short' || r.status === 'out'; }).length;
    var search = el.querySelector('[data-act="search"]'); var q = search ? search.value : '';
    el.innerHTML = '<div class="data-workbench ds-root">' + D.head({ icon: 'warehouse', no: '03', title: '로케이션 · 재고 관리', desc: '로케이션별 가상 재고를 조회하고, 피킹에 따라 재고가 줄어드는 과정을 확인합니다.' }) + D.controls(m) +
      '<div class="kpis data-kpis ds-kpis">' + D.kpi('사용 로케이션', used + ' / ' + Object.keys(st.stock).length, '칸') + D.kpi('현재 총 재고', D.fmt(totalQty), '개', 'accent') + D.kpi('피킹 반영', s.taskDone + ' / ' + s.taskTotal, '건') + D.kpi('부족·품절 SKU', bad, '종', bad ? 'err' : '') + D.kpi('결품 발생', st.shortEvents, '회', st.shortEvents ? 'err' : '') + '</div>' +
      '<div class="ds-grid-2 wide-left"><div class="panel ds-panel"><div class="panel-head"><div><h3>랙 맵</h3><p class="ds-sub">Zone · 랙 · 단(위가 3단). 색: 정상 / 부족 / 0개 / 빈 칸</p></div><div class="ds-seg">' + D.ZONES.map(function (z) { return '<button class="' + (st.zone === z ? 'on' : '') + '" data-act="zone" data-v="' + z + '">Zone ' + z + '</button>'; }).join('') + '</div></div>' + rackMap() +
      '<div class="ds-legend"><span class="ok">정상</span><span class="low">부족 주의</span><span class="zero">재고 0</span><span class="empty">빈 칸</span><span class="hl">선택 SKU</span></div></div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>SKU 상세</h3></div></div>' + skuDetail(rows) + '</div></div>' +
      '<div class="ds-grid-2"><div class="panel ds-panel"><div class="panel-head"><div><h3>SKU별 재고 현황</h3></div><div class="field ds-search"><input data-act="search" placeholder="SKU · 품명 · 로케이션 검색" value="' + D.esc(q) + '"></div></div>' + skuTable(rows) + '</div>' +
      '<div class="panel ds-panel"><div class="panel-head"><div><h3>재고 이동 기록</h3><p class="ds-sub">피킹으로 줄어든 재고(최근 순)</p></div></div>' + movesHtml() + '<div class="panel-head mt14"><div><h3>작업 기록</h3></div></div>' + D.logHtml(st, 6) + '</div></div></div>';
    D.bindControls(el, m); bind(el); applySearch(el, q); D.icons();
  }
  function movesHtml() {
    if (!st.moves.length) return '<div class="ds-empty">[작업 시작] 또는 수동 피킹을 하면 재고 이동이 기록됩니다.</div>';
    return '<ul class="ds-mini-list">' + st.moves.slice(0, 10).map(function (mv) { return '<li><b>' + mv.loc + '</b><span>' + mv.sku + ' · ' + D.esc(mv.source) + '</span><em class="' + (mv.alt ? 'warn' : '') + '">−' + mv.qty + (mv.alt ? ' 대체' : '') + '</em></li>'; }).join('') + '</ul>';
  }
  function applySearch(el, q) {
    q = String(q || '').trim().toLowerCase();
    el.querySelectorAll('table[data-table="sku"] tbody tr').forEach(function (tr) { tr.hidden = !!q && tr.dataset.q.indexOf(q) < 0; });
  }

  function bind(el) {
    if (el.__dsLoc) return; el.__dsLoc = true;
    el.addEventListener('click', function (e) {
      var row = e.target.closest('tr[data-sku]');
      if (row) { st.selSku = row.dataset.sku; var s = D.skuMap(cat)[st.selSku]; st.selLoc = s.loc; st.zone = s.zone; D.persist(m); return render(); }
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'FORM') return;
      if (b.dataset.act === 'zone') st.zone = b.dataset.v;
      else if (b.dataset.act === 'bin') { st.selLoc = b.dataset.v; st.selSku = st.stock[st.selLoc].sku || null; }
      else return;
      D.persist(m); render();
    });
    el.addEventListener('input', function (e) { if (e.target.dataset.act === 'search') applySearch(el, e.target.value); });
    el.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-act="manual"]')) return;
      e.preventDefault();
      if (!st.selSku) return;
      var avail = D.availOf(st.stock, cat, st.selSku);
      var v = D.validateQty(e.target.qty.value, { min: 1 });
      if (!v.ok) { e.target.qty.classList.add('ds-invalid'); return D.toast(v.error); }
      if (v.value > avail) { e.target.qty.classList.add('ds-invalid'); return D.toast('출고 가능 재고(' + avail + '개)보다 많습니다. 대체 로케이션까지 합친 재고만 피킹할 수 있습니다.'); }
      try { doPick(st.selSku, v.value, '수동'); } catch (err) { return D.toast(err.message); }
      D.persist(m); render();
    });
  }
})();
