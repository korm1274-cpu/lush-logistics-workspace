/* DAS 운영 시제품 6 — 출고·입고 통합 현황판 (물류센터) — js/69-das-ops-board.js
   KPI(전체 출고 박스 · 출고 확정 · 매장 입고 완료 · 입고 대기 · 차이 발생) + 박스별 상세 표(매장·날짜·입고 상태·검색 필터)
   행을 누르면 박스 내품의 출고 수량 vs 매장 입고 수량, 차이 사유, 정정 이력을 보여줍니다. */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var ui = { store: '', date: '', status: '', q: '' };
  var STATUS = [['', '전체 상태'], ['closed', '출고 대기'], ['shipped', '입고 대기'], ['received', '입고 완료'], ['diff', '차이 발생']];

  function day(ts) { if (!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + O.pad(d.getMonth() + 1) + '-' + O.pad(d.getDate()); }
  function rowOf(s, b) {
    var st = D.store(s, b.store), rc = b.receipt && b.receipt.status === 'confirmed' ? b.receipt.summary : null, diff = rc ? rc.received - rc.shipped : null;
    var stt = b.status === 'received' ? (rc.diffItems ? ['차이 발생', 'warn'] : ['입고 완료', 'ok']) : b.status === 'shipped' ? (b.receipt && b.receipt.status === 'draft' ? ['검수 중', 'run'] : ['입고 대기', 'wait']) : b.status === 'closed' ? ['출고 대기', ''] : ['패킹 중', 'run'];
    return { b: b, date: day(b.shippedAt) || s.date, store: b.store, name: st ? st.name : '', skus: Object.keys(b.items).length, qty: D.boxTotal(b), recv: rc ? rc.received : null, diff: diff, diffItems: rc ? rc.diffItems : 0, stt: stt, done: rc ? b.receipt.confirmedAt : null };
  }
  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root">' + O.appbar('board') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s) return O.emptyState(el, 'board', null, true);
    var all = D.boxes(s).filter(function (b) { return b.status !== 'open'; }).map(function (b) { return rowOf(s, b); });
    var k = { all: all.length, shipped: all.filter(function (r) { return r.b.status === 'shipped' || r.b.status === 'received'; }).length, recv: all.filter(function (r) { return r.b.status === 'received'; }).length, wait: all.filter(function (r) { return r.b.status === 'shipped'; }).length, diff: all.filter(function (r) { return r.diffItems > 0; }).length };
    var q = ui.q.trim().toUpperCase();
    var rows = all.filter(function (r) {
      if (ui.store && r.store !== ui.store) return false;
      if (ui.date && r.date !== ui.date) return false;
      if (ui.status === 'diff' ? !r.diffItems : ui.status && r.b.status !== ui.status) return false;
      if (q && (r.b.no + ' ' + r.b.id + ' ' + r.store + ' ' + r.name).toUpperCase().indexOf(q) < 0) return false;
      return true;
    });
    var dates = {}; all.forEach(function (r) { dates[r.date] = 1; });
    el.innerHTML = '<div class="do-root">' + O.appbar('board') +
      '<div class="do-page-head"><div><h2>출고·입고 통합 현황판</h2><p>매장별 박스 출고와 매장 입고 검수 결과를 한 화면에서 확인합니다. 다른 기기의 변경은 자동으로 반영됩니다.</p></div><div class="do-actions"><button class="do-btn" data-act="refresh"><i data-lucide="refresh-cw"></i>새로고침</button></div></div>' +
      '<div class="do-kpis">' + O.kpi('전체 출고 박스', k.all, '', '패킹 완료 기준') + O.kpi('출고 확정 박스', k.shipped, 'primary') + O.kpi('매장 입고 완료', k.recv, 'ok') + O.kpi('입고 대기', k.wait, k.wait ? 'wait' : '') + O.kpi('차이 발생 박스', k.diff, k.diff ? 'err' : '') + '</div>' +
      '<div class="do-card"><div class="do-filters">' +
      '<select data-f="store"><option value="">전체 매장</option>' + s.stores.map(function (x) { return '<option value="' + esc(x.code) + '"' + (ui.store === x.code ? ' selected' : '') + '>' + esc(x.code) + ' · ' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<select data-f="date"><option value="">전체 출고일</option>' + Object.keys(dates).sort().reverse().map(function (d) { return '<option' + (ui.date === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select>' +
      '<select data-f="status">' + STATUS.map(function (x) { return '<option value="' + x[0] + '"' + (ui.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<input data-f="q" placeholder="박스번호 · 박스 ID · 매장 검색" value="' + esc(ui.q) + '"><span class="do-muted">' + rows.length + ' / ' + all.length + '건</span></div>' +
      '<div class="do-table-wrap tall"><table class="do-table"><thead><tr><th>출고일자</th><th>매장코드</th><th>매장명</th><th>박스번호</th><th class="num">출고 SKU</th><th class="num">출고 수량</th><th class="num">입고 수량</th><th class="num">차이</th><th>입고 상태</th><th>검수 완료</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr class="click" data-box="' + esc(r.b.id) + '"><td>' + esc(r.date) + '</td><td><span class="do-code">' + esc(r.store) + '</span></td><td>' + esc(r.name) + '</td><td><b>' + esc(r.b.no) + '</b><small class="do-block do-mono">' + esc(r.b.id) + '</small></td><td class="num">' + r.skus + '</td><td class="num">' + fmt(r.qty) + '</td><td class="num">' + (r.recv == null ? '-' : fmt(r.recv)) + '</td><td class="num ' + (r.diff ? 'warn' : '') + '">' + (r.diff == null ? '-' : (r.diff > 0 ? '+' : '') + r.diff) + '</td><td>' + O.chip(r.stt[0], r.stt[1]) + '</td><td>' + (r.done ? O.dt(r.done, true) : '-') + '</td></tr>'; }).join('') : '<tr><td colspan="10" class="do-muted center">조건에 맞는 박스가 없습니다.</td></tr>') +
      '</tbody></table></div></div></div>';
    bind(el); O.icons();
  }
  function detail(b) {
    var s = O.S.state, rc = b.receipt && b.receipt.status === 'confirmed' ? b.receipt : null;
    O.modal('<div class="do-modal-head"><b>' + esc(b.no) + ' <span class="do-mono">' + esc(b.id) + '</span></b><button class="do-x" data-do-close>×</button></div><div class="do-modal-body"><p><span class="do-code">' + esc(b.store) + '</span> ' + esc(D.store(s, b.store).name) + ' · 출고 ' + O.dt(b.shippedAt, true) + (rc ? ' · 검수 ' + O.dt(rc.confirmedAt, true) : '') + '</p>' +
      '<table class="do-table"><thead><tr><th>제품</th><th class="num">출고</th><th class="num">입고</th><th class="num">파손</th><th class="num">차이</th><th>사유</th></tr></thead><tbody>' + Object.keys(b.items).sort().map(function (k) { var it = rc ? rc.items[k] : null, df = it ? it.received - b.items[k] : null; return '<tr><td><span class="do-code">' + esc(k) + '</span> ' + esc(D.sku(s, k).name) + '</td><td class="num">' + b.items[k] + '</td><td class="num">' + (it ? it.received : '-') + '</td><td class="num">' + (it ? it.damaged : '-') + '</td><td class="num ' + (df ? 'warn' : '') + '">' + (df == null ? '-' : (df > 0 ? '+' : '') + df) + '</td><td>' + esc(it ? (it.reason || '') + (it.memo ? ' · ' + it.memo : '') : '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      (b.corrections && b.corrections.length ? '<div class="do-corr"><b>정정 이력</b>' + b.corrections.map(function (c) { return '<div><time>' + O.dt(c.at, true) + '</time><span class="do-role">관리자</span><span>' + esc(c.reason) + '</span></div>'; }).join('') + '</div>' : '') +
      '</div><div class="do-modal-foot"><button class="do-btn" data-do-close>닫기</button></div>', { cls: 'wide' });
  }
  function bind(el) {
    if (el.__doBoard) return; el.__doBoard = true;
    el.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-box]'); if (tr) return detail(O.S.state.boxes[tr.dataset.box]);
      if (e.target.closest('[data-act="refresh"]')) O.load();
    });
    el.addEventListener('change', function (e) { var f = e.target.dataset.f; if (f && f !== 'q') { ui[f] = e.target.value; render(el); } });
    el.addEventListener('input', function (e) { if (e.target.dataset.f === 'q') { ui.q = e.target.value; var pos = e.target.selectionStart; render(el); var n = el.querySelector('[data-f="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* 무시 */ } } } });
  }
  O.register({ id: 'board', viewId: 'dsBoardView', menuId: 'sim-board', label: '통합 현황판', icon: 'monitor-dot', render: render });
})();
