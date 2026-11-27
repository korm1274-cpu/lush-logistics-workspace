/* DAS 운영 시제품 1 — 출고 작업 (관리자 PC) — js/64-das-ops-wave.js
   주문 확인(매장별·SKU 통합) → 출고 작업 생성(Zone·로케이션 순 피킹 작업 + DAS 셀 배정) → 단계별 진행 현황 */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var ui = { store: null };

  function stages(s) {
    var w = s.wave, demand = D.demand(s), skus = Object.keys(demand);
    var boxes = D.boxes(s), putAll = O.sum(skus, function (k) { return D.putTotal(s, k); });
    var packedAll = O.sum(boxes.filter(function (b) { return b.status !== 'open'; }), D.boxTotal);
    var list = [
      ['피킹', w ? w.tasks.filter(function (t) { return t.status !== 'wait'; }).length : 0, w ? w.tasks.length : 0, '작업'],
      ['DAS 분류', w ? Object.keys(w.dasDone).length : 0, skus.length, 'SKU'],
      ['박스 패킹', packedAll, putAll, 'EA'],
      ['출고 확정', boxes.filter(function (b) { return b.status === 'shipped' || b.status === 'received'; }).length, boxes.length, '박스'],
      ['매장 입고', boxes.filter(function (b) { return b.status === 'received'; }).length, boxes.filter(function (b) { return b.status === 'shipped' || b.status === 'received'; }).length, '박스']
    ];
    return '<div class="do-steps">' + list.map(function (x, i) {
      var p = O.pct(x[1], x[2]), tone = x[2] && x[1] >= x[2] ? 'ok' : x[1] > 0 ? 'run' : '';
      return '<div class="do-step ' + tone + '"><div class="do-step-top"><b>' + (i + 1) + '</b><span>' + x[0] + '</span>' + (tone === 'ok' ? '<i data-lucide="check"></i>' : '') + '</div><div class="do-step-num">' + fmt(x[1]) + '<i> / ' + fmt(x[2]) + ' ' + x[3] + '</i></div>' + O.bar(p, tone) + '</div>';
    }).join('') + '</div>';
  }
  function waveStatus(s) {
    if (!s.wave) return ['작업 생성 전', ''];
    var boxes = D.boxes(s);
    if (boxes.length && boxes.every(function (b) { return b.status === 'received'; })) return ['입고 완료', 'done'];
    if (boxes.some(function (b) { return b.status === 'shipped' || b.status === 'received'; })) return ['출고 중', 'ok'];
    if (boxes.length) return ['패킹 중', 'run'];
    if (Object.keys(s.wave.put).length) return ['DAS 분류 중', 'run'];
    if (s.wave.tasks.some(function (t) { return t.status !== 'wait' || t.picked; })) return ['피킹 중', 'run'];
    return ['작업 생성됨', 'wait'];
  }

  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root">' + O.appbar('wave') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s) return O.emptyState(el, 'wave', '오늘 출고 주문이 없습니다', true);
    var demand = D.demand(s), skus = Object.keys(demand), total = O.sum(skus, function (k) { return demand[k]; });
    var lines = O.sum(s.orders, function (o) { return o.lines.length; }), ws = waveStatus(s), admin = O.role() === 'admin';
    var head = '<div class="do-page-head"><div><h2>출고 작업</h2><p>매장 주문을 확인하고 출고 작업을 생성합니다. 생성된 작업은 PDA 피킹 · DAS 분류 화면으로 전달됩니다.</p></div><div class="do-actions">' +
      (s.wave ? '<span class="do-wave-id">' + esc(s.wave.id) + '</span>' + O.chip(ws[0], ws[1]) : '<button class="do-btn primary" data-act="create"' + (O.S.busy ? ' disabled' : '') + '><i data-lucide="play-circle"></i>출고 작업 생성</button>') +
      (admin ? '<button class="do-btn ghost" data-act="reset"><i data-lucide="rotate-ccw"></i>시제품 데이터 초기화</button>' : '') + '</div></div>';
    var kpis = '<div class="do-kpis">' + O.kpi('출고일', esc(s.date)) + O.kpi('주문 매장', s.orders.length + '곳') + O.kpi('주문 라인', fmt(lines)) + O.kpi('총 주문 수량', fmt(total) + ' EA', 'primary') + O.kpi('SKU', skus.length + '종') + O.kpi('피킹 작업', s.wave ? s.wave.tasks.length + '건' : '-') + '</div>';
    var left = '<div class="do-card"><div class="do-card-head"><h3>매장별 주문</h3><span class="do-muted">행을 누르면 매장 주문 상세</span></div><div class="do-table-wrap"><table class="do-table"><thead><tr><th>매장코드</th><th>매장명</th><th class="num">라인</th><th class="num">주문 수량</th><th>DAS 셀</th><th class="num">분류 완료</th></tr></thead><tbody>' +
      s.orders.map(function (o) {
        var st = D.store(s, o.store), cell = cellLabel(s, o.store), q = O.sum(o.lines, function (l) { return l.qty; }), put = D.storePut(s, o.store);
        return '<tr class="click' + (ui.store === o.store ? ' sel' : '') + '" data-store="' + esc(o.store) + '"><td><span class="do-code">' + esc(o.store) + '</span></td><td>' + esc(st.name) + '</td><td class="num">' + o.lines.length + '</td><td class="num"><b>' + fmt(q) + '</b></td><td>' + (cell ? '<span class="do-cell-tag">' + esc(cell) + '</span>' : '<span class="do-muted">생성 전</span>') + '</td><td class="num">' + (s.wave ? fmt(put) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    var right;
    if (ui.store) {
      var o = s.orders.filter(function (x) { return x.store === ui.store; })[0], st = D.store(s, ui.store);
      right = '<div class="do-card"><div class="do-card-head"><h3><span class="do-code">' + esc(ui.store) + '</span> ' + esc(st.name) + ' 주문</h3><button class="do-link" data-act="clear">SKU 통합 보기</button></div><div class="do-table-wrap"><table class="do-table"><thead><tr><th>제품코드</th><th>제품명</th><th class="num">주문</th><th class="num">분류 완료</th></tr></thead><tbody>' +
        o.lines.map(function (l) { var k = D.sku(s, l.sku), p = D.putQty(s, l.sku, ui.store); return '<tr><td><span class="do-code">' + esc(l.sku) + '</span></td><td>' + esc(k.name) + '</td><td class="num">' + fmt(l.qty) + '</td><td class="num ' + (s.wave && p >= l.qty ? 'ok' : '') + '">' + (s.wave ? fmt(p) : '-') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    } else {
      right = '<div class="do-card"><div class="do-card-head"><h3>SKU 통합</h3><span class="do-muted">전 매장 합계 · 로케이션 순</span></div><div class="do-table-wrap"><table class="do-table"><thead><tr><th>제품코드</th><th>제품명</th><th>로케이션</th><th class="num">매장</th><th class="num">총 수량</th><th class="num">피킹</th><th class="num">분류</th></tr></thead><tbody>' +
        skus.map(function (k) { return D.sku(s, k); }).sort(function (a, b) { return a.loc.localeCompare(b.loc); }).map(function (k) {
          var storesN = s.orders.filter(function (o) { return o.lines.some(function (l) { return l.sku === k.code; }); }).length, pk = D.picked(s, k.code), pt = D.putTotal(s, k.code);
          return '<tr><td><span class="do-code">' + esc(k.code) + '</span></td><td>' + esc(k.name) + '</td><td><span class="do-loc">' + esc(k.loc) + '</span></td><td class="num">' + storesN + '</td><td class="num"><b>' + fmt(demand[k.code]) + '</b></td><td class="num">' + (s.wave ? fmt(pk) : '-') + '</td><td class="num">' + (s.wave ? fmt(pt) : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    el.innerHTML = '<div class="do-root">' + O.appbar('wave') + head + kpis + (s.wave ? '<div class="do-card"><div class="do-card-head"><h3>작업 진행 현황</h3><span class="do-muted">생성 ' + O.dt(s.wave.createdAt) + ' · 각 단계는 직원 조작으로만 진행됩니다</span></div>' + stages(s) + '</div>' : '<div class="do-callout"><i data-lucide="info"></i>주문을 확인한 뒤 <b>출고 작업 생성</b>을 누르면 Zone·로케이션 순 피킹 작업과 매장별 DAS 셀 배정이 만들어집니다.</div>') +
      '<div class="do-split">' + left + right + '</div>' + logCard(s) + '</div>';
    bind(el); O.icons();
  }
  function cellLabel(s, store) { if (!s.wave) return ''; for (var i = 0; i < s.wave.das.length; i++) { var st = s.wave.das[i], j = st.cells.indexOf(store); if (j >= 0) return st.id + ' · ' + O.pad(j + 1); } return ''; }
  var ACTION = { 'wave.create': '출고 작업 생성', 'pick.confirm': '피킹 확정', 'das.put': 'DAS 분배', 'das.close': 'DAS 결품 마감', 'box.create': '박스 생성', 'box.items': '박스 수량 확정', 'box.close': '박스 패킹 완료', 'box.label': '라벨 출력', 'box.ship': '출고 확정', 'box.correct': '내품 정정', 'receipt.save': '입고 검수 임시저장', 'receipt.confirm': '입고 검수 확정', seed: '예시 주문 불러오기' };
  function logCard(s) {
    var list = (s.log || []).slice(0, 12);
    return '<div class="do-card"><div class="do-card-head"><h3>작업 이력</h3><span class="do-muted">최근 12건 · 작업자는 역할만 기록</span></div>' + (list.length ? '<ul class="do-log">' + list.map(function (l) { return '<li><time>' + O.dt(l.at) + '</time><span class="do-role">' + (l.role === 'admin' ? '관리자' : l.role === 'member' ? '팀원' : '시스템') + '</span><b>' + esc(ACTION[l.action] || l.action) + '</b><span>' + esc(l.ref || '') + '</span></li>'; }).join('') + '</ul>' : '<div class="do-muted">기록 없음</div>') + '</div>';
  }
  function bind(el) {
    if (el.__doWave) return; el.__doWave = true;
    el.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-store]'); if (tr) { ui.store = ui.store === tr.dataset.store ? null : tr.dataset.store; return render(el); }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = b.dataset.act;
      if (a === 'clear') { ui.store = null; render(el); }
      else if (a === 'create') O.confirmBox('출고 작업 생성', '<p>주문 ' + O.S.state.orders.length + '개 매장으로 출고 작업을 생성합니다.</p><p class="do-muted">생성 후에는 주문을 바꿀 수 없습니다.</p>', '생성').then(function (ok) { if (ok) O.op('wave.create').then(function () { O.toast('출고 작업을 생성했습니다. PDA 피킹을 시작할 수 있습니다.'); }).catch(function () {}); });
      else if (a === 'reset') O.confirmBox('시제품 데이터 초기화', '<p>출고 작업 · 박스 · 입고 검수 등 <b>시제품 데이터 전체</b>를 지웁니다. 모든 기기에 반영됩니다.</p><p class="do-muted">운영 데이터와는 무관합니다.</p>', '초기화', 'danger').then(function (ok) { if (ok) O.op('reset').then(function () { ui.store = null; O.toast('시제품 데이터를 초기화했습니다.'); }).catch(function () {}); });
    });
  }
  O.register({ id: 'wave', viewId: 'dsWaveView', menuId: 'sim-wave', label: '출고 작업', icon: 'clipboard-list', render: render });
})();
