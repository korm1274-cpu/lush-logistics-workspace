/* DAS 운영 시제품 4 — 박스·출고 (물류센터 패킹 스테이션) — js/67-das-ops-pack.js
   매장 선택 → 박스 선택(또는 새 박스) → 제품별 패킹 수량 입력·확정 → 박스 패킹 완료(마감) → 고유 박스 ID 확정 → 라벨 출력 → 출고 확정
   마감 후 내품은 바꿀 수 없음(관리자 정정만 가능, 사유·이력 기록). 라벨 재출력은 같은 박스 ID 유지 */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var ui = { store: null, box: null, draft: {}, err: '' };

  function storeStatus(s, code) {
    var bs = D.boxes(s, code), put = D.storePut(s, code), closedQty = O.sum(bs.filter(function (b) { return b.status !== 'open'; }), D.boxTotal);
    if (!bs.length) return put ? ['패킹 대기', ''] : ['분류 대기', ''];
    if (bs.some(function (b) { return b.status === 'open'; })) return ['패킹 중', 'run'];
    if (closedQty < put) return ['패킹 중', 'run'];
    if (bs.every(function (b) { return b.status === 'received'; })) return ['입고 완료', 'done'];
    if (bs.every(function (b) { return b.status === 'shipped' || b.status === 'received'; })) return ['출고 완료', 'ok'];
    return ['출고 대기', 'wait'];
  }
  function itemsOf(s, b) { // 이 매장에 분류된 제품 + 박스에 담긴 제품
    var set = {}; s.orders.filter(function (o) { return o.store === b.store; }).forEach(function (o) { o.lines.forEach(function (l) { if (D.putQty(s, l.sku, b.store) > 0) set[l.sku] = 1; }); });
    Object.keys(b.items).forEach(function (k) { set[k] = 1; });
    return Object.keys(set).sort();
  }
  function draftOf(b) { if (!ui.draft[b.id]) { ui.draft[b.id] = {}; Object.keys(b.items).forEach(function (k) { ui.draft[b.id][k] = String(b.items[k]); }); } return ui.draft[b.id]; }
  function dirty(b) { var d = ui.draft[b.id]; if (!d || b.status !== 'open') return false; var keys = {}; Object.keys(d).concat(Object.keys(b.items)).forEach(function (k) { keys[k] = 1; }); return Object.keys(keys).some(function (k) { var v = O.intOrNaN(d[k] == null || d[k] === '' ? '0' : d[k]); return v !== (b.items[k] || 0); }); }

  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root">' + O.appbar('pack') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s || !s.wave) return O.emptyState(el, 'pack', s ? '출고 작업이 생성되지 않았습니다' : null, !s);
    var all = D.boxes(s), b = ui.box && s.boxes[ui.box];
    if (b && ui.store && b.store !== ui.store) b = null;
    if (!ui.store && b) ui.store = b.store;
    var k = { total: all.length, open: all.filter(function (x) { return x.status === 'open'; }).length, closed: all.filter(function (x) { return x.status !== 'open'; }).length, wait: all.filter(function (x) { return x.status === 'closed'; }).length, shipped: all.filter(function (x) { return x.status === 'shipped' || x.status === 'received'; }).length };
    var head = '<div class="do-page-head"><div><h2>박스 패킹 및 출고 관리</h2><p>매장별 박스 구성 · 내품 확인 · 라벨 발행 · 출고 확정</p></div><div class="do-actions">' + O.chip(k.open ? '작업 중' : k.total && k.wait === 0 && k.shipped === k.total ? '출고 완료' : '대기', k.open ? 'run' : k.shipped && k.shipped === k.total ? 'ok' : '') + '</div></div>';
    var kpis = '<div class="do-kpis">' + O.kpi('총 작업 박스', k.total) + O.kpi('패킹 진행 중', k.open, k.open ? 'run' : '') + O.kpi('패킹 완료', k.closed) + O.kpi('출고 대기', k.wait, k.wait ? 'wait' : '') + O.kpi('출고 완료', k.shipped, 'ok') + '</div>';

    var left = '<div class="do-card"><div class="do-card-head"><h3>매장 및 박스 목록</h3><span class="do-muted">매장을 누르면 박스 목록</span></div><div class="do-table-wrap tall"><table class="do-table"><thead><tr><th>매장코드</th><th>매장명</th><th class="num">예정 출고</th><th class="num">패킹 완료</th><th class="num">박스</th><th>상태</th></tr></thead><tbody>' +
      s.orders.map(function (o) {
        var st = D.store(s, o.store), bs = D.boxes(s, o.store), put = D.storePut(s, o.store), pk = O.sum(bs.filter(function (x) { return x.status !== 'open'; }), D.boxTotal), ss = storeStatus(s, o.store), open = ui.store === o.store;
        var row = '<tr class="click' + (open ? ' sel' : '') + '" data-store="' + esc(o.store) + '"><td><span class="do-code">' + esc(o.store) + '</span></td><td>' + esc(st.name) + '</td><td class="num">' + fmt(put) + '</td><td class="num">' + fmt(pk) + '</td><td class="num">' + bs.length + '</td><td>' + O.chip(ss[0], ss[1]) + '</td></tr>';
        if (open) row += '<tr class="do-subrow"><td colspan="6"><div class="do-boxlist">' + bs.map(function (x) { return '<button class="do-boxitem' + (b && b.id === x.id ? ' on' : '') + '" data-box="' + esc(x.id) + '"><b>' + esc(x.no) + '</b><span class="do-mono">' + esc(x.id) + '</span><span>' + fmt(D.boxTotal(x)) + ' EA</span>' + O.boxChip(x) + '</button>'; }).join('') +
          '<button class="do-boxitem add" data-act="new-box" data-v="' + esc(o.store) + '"' + (bs.some(function (x) { return x.status === 'open'; }) || !put ? ' disabled' : '') + '><i data-lucide="plus"></i>새 박스 생성</button></div></td></tr>';
        return row;
      }).join('') + '</tbody></table></div></div>';

    el.innerHTML = '<div class="do-root">' + O.appbar('pack') + head + kpis + '<div class="do-split">' + left + detail(s, b) + '</div></div>';
    bind(el); O.icons();
  }

  function detail(s, b) {
    if (!b) return '<div class="do-card do-detail-empty"><i data-lucide="package"></i><b>박스를 선택하세요</b><p>왼쪽에서 매장을 누른 뒤 박스를 고르거나 새 박스를 생성합니다.</p></div>';
    var st = D.store(s, b.store), open = b.status === 'open', d = open ? draftOf(b) : null, codes = itemsOf(s, b), admin = O.role() === 'admin';
    var rows = codes.map(function (c) {
      var kk = D.sku(s, c), sorted = D.putQty(s, c, b.store), other = D.packed(s, b.store, c, b.id);
      var inBox = open ? O.intOrNaN(d[c] == null || d[c] === '' ? '0' : d[c]) : (b.items[c] || 0);
      var left = sorted - other - (isNaN(inBox) ? 0 : inBox), bad = isNaN(inBox) || left < 0;
      var stt = bad ? ['수량 오류', 'err'] : left === 0 ? ['패킹 완료', 'ok'] : inBox > 0 ? ['일부', 'run'] : ['남음', 'warn'];
      return '<tr><td><span class="do-code">' + esc(c) + '</span></td><td>' + esc(kk.name) + '</td><td class="num">' + fmt(sorted) + (other ? '<small class="do-block">다른 박스 ' + other + '</small>' : '') + '</td><td class="num">' +
        (open ? '<input class="do-qty-in' + (bad ? ' do-invalid' : '') + '" data-act="item" data-v="' + esc(c) + '" inputmode="numeric" value="' + esc(d[c] == null ? '' : d[c]) + '" placeholder="0">' : '<b>' + fmt(inBox) + '</b>') + '</td><td class="num ' + (left > 0 ? 'warn' : '') + '">' + (isNaN(left) ? '-' : fmt(left)) + '</td><td>' + O.chip(stt[0], stt[1]) + '</td></tr>';
    }).join('');
    var sortedAll = D.storePut(s, b.store), packedAll = O.sum(D.boxes(s, b.store).filter(function (x) { return x.id !== b.id; }), D.boxTotal) + (open ? O.sum(codes, function (c) { var v = O.intOrNaN(d[c] == null || d[c] === '' ? '0' : d[c]); return isNaN(v) ? 0 : v; }) : D.boxTotal(b));
    var boxQty = open ? O.sum(codes, function (c) { var v = O.intOrNaN(d[c] == null || d[c] === '' ? '0' : d[c]); return isNaN(v) ? 0 : v; }) : D.boxTotal(b);
    var isDirty = dirty(b);
    var btn = function (act, label, icon, cls, en, title) { return '<button class="do-btn ' + (cls || '') + '" data-act="' + act + '"' + (en && !O.S.busy ? '' : ' disabled') + (title ? ' title="' + esc(title) + '"' : '') + '><i data-lucide="' + icon + '"></i>' + label + '</button>'; };
    return '<div class="do-card do-detail"><div class="do-detail-head"><div><small><span class="do-code">' + esc(b.store) + '</span> ' + esc(st.name) + '</small><h3>' + esc(b.no) + ' <span class="do-mono">' + esc(b.id) + '</span></h3><span class="do-muted">' + codes.length + '개 SKU · 생성 ' + O.dt(b.createdAt) + (b.closedAt ? ' · 마감 ' + O.dt(b.closedAt) : '') + (b.labelCount ? ' · 라벨 ' + b.labelCount + '회' : '') + (b.shippedAt ? ' · 출고 ' + O.dt(b.shippedAt) : '') + '</span></div>' + O.boxChip(b) + '</div>' +
      (open ? '' : '<div class="do-lock"><i data-lucide="lock"></i>마감된 박스입니다. 내품은 관리자 정정(사유·이력 기록)으로만 바꿀 수 있습니다.</div>') +
      '<div class="do-table-wrap"><table class="do-table"><thead><tr><th>제품코드</th><th>제품명</th><th class="num">DAS 분류 완료</th><th class="num">이 박스 수량</th><th class="num">남은 패킹</th><th>상태</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="do-muted">이 매장에 분류 완료된 제품이 없습니다.</td></tr>') + '</tbody></table></div>' +
      (open ? '<div class="do-fillrow"><button class="do-link" data-act="fill">남은 수량 모두 이 박스에 담기</button>' + (isDirty ? '<span class="do-unsaved"><i data-lucide="circle-alert"></i>확정하지 않은 수량 변경이 있습니다</span>' : '') + '</div>' : '') +
      '<div class="do-progress-box"><div><span>매장 패킹 진행률</span><b>' + fmt(packedAll) + ' / ' + fmt(sortedAll) + ' EA</b></div>' + O.bar(O.pct(packedAll, sortedAll), packedAll >= sortedAll ? 'ok' : '') + '<small>이 박스 ' + fmt(boxQty) + ' EA</small></div>' +
      (ui.err ? '<div class="do-alert err"><i data-lucide="circle-x"></i>' + esc(ui.err) + '</div>' : '') +
      '<div class="do-btnbar">' +
      btn('new-box', '새 박스 생성', 'package-plus', '', !D.boxes(s, b.store).some(function (x) { return x.status === 'open'; }) && sortedAll > 0) +
      btn('save-items', '제품 수량 확정', 'check', '', open && isDirty) +
      btn('close-box', '박스 패킹 완료', 'package-check', 'primary', open && !isDirty && D.boxTotal(b) > 0, isDirty ? '먼저 제품 수량을 확정하세요' : '') +
      btn('label', b.labelCount ? '라벨 재출력' : '라벨 출력', 'printer', b.labelCount ? '' : 'primary', !open) +
      btn('ship', '출고 확정', 'truck', 'success', b.status === 'closed' && b.labelCount > 0, b.labelCount ? '' : '라벨 출력 후 출고 확정') +
      (admin && (b.status === 'closed' || b.status === 'shipped') ? btn('correct', '내품 정정', 'file-pen', 'ghost', true) : '') + '</div>' +
      (b.corrections && b.corrections.length ? '<div class="do-corr"><b>정정 이력</b>' + b.corrections.map(function (c) { return '<div><time>' + O.dt(c.at, true) + '</time><span class="do-role">' + (c.role === 'admin' ? '관리자' : '팀원') + '</span><span>' + esc(c.reason) + '</span><small>' + esc(diffText(c.before, c.after)) + '</small></div>'; }).join('') + '</div>' : '') +
      '<p class="do-hint">수량과 상품은 화면 설계용 예시이며 실제 출고 데이터가 아닙니다.</p></div>';
  }
  function diffText(a, b) { var keys = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { keys[k] = 1; }); return Object.keys(keys).filter(function (k) { return (a[k] || 0) !== (b[k] || 0); }).map(function (k) { return k + ' ' + (a[k] || 0) + '→' + (b[k] || 0); }).join(', '); }

  function itemsPayload(b) { var d = ui.draft[b.id] || {}, out = {}, err = ''; Object.keys(d).forEach(function (k) { var v = String(d[k]).trim(); if (v === '') return; var n = O.intOrNaN(v); if (isNaN(n)) err = k + ' 수량은 0 이상의 정수로 입력해 주세요.'; else if (n > 0) out[k] = n; }); return { items: out, err: err }; }

  function labelModal(el, b) {
    var s = O.S.state, re = b.labelCount > 0;
    var w = O.modal('<div class="do-modal-head"><b>' + (re ? '라벨 재출력' : '라벨 출력') + ' 미리보기 · 100 × 100 mm</b><button class="do-x" data-do-close>×</button></div><div class="do-modal-body do-label-preview">' + O.labelHtml(s, b) + '</div>' +
      '<p class="do-hint">바코드는 고유 박스 ID(' + esc(b.id) + ')를 Code 128로 인코딩합니다. 내품 내역은 바코드에 넣지 않고 박스 ID로 서버에서 조회합니다.' + (re ? ' 재출력해도 같은 박스 ID를 유지합니다(현재 ' + b.labelCount + '회 출력).' : '') + '</p>' +
      '<div class="do-modal-foot"><button class="do-btn" data-do-close>닫기</button><button class="do-btn primary" data-print><i data-lucide="printer"></i>' + (re ? '재출력' : '인쇄') + '</button></div>', { cls: 'wide' });
    w.querySelector('[data-print]').addEventListener('click', function () {
      var id = b.id;
      O.op('box.label', { boxId: id }).then(function () { O.closeModal(); O.printLabel(O.S.state, O.S.state.boxes[id]); O.toast(re ? '같은 박스 ID로 라벨을 다시 출력했습니다.' : '라벨을 출력했습니다. 출고 확정을 진행하세요.'); }).catch(function () {});
    });
  }
  function correctModal(el, b) {
    var s = O.S.state, codes = itemsOf(s, b);
    var w = O.modal('<div class="do-modal-head"><b>내품 정정 · ' + esc(b.no) + ' (관리자)</b><button class="do-x" data-do-close>×</button></div><div class="do-modal-body"><p class="do-muted">마감된 박스의 내품을 바꿉니다. 정정 전·후 수량과 사유가 이력으로 남습니다. 매장 입고 확정 후에는 정정할 수 없습니다.</p>' +
      '<table class="do-table"><thead><tr><th>제품</th><th class="num">현재</th><th class="num">정정 후</th><th class="num">최대</th></tr></thead><tbody>' + codes.map(function (c) { var max = D.putQty(s, c, b.store) - D.packed(s, b.store, c, b.id); return '<tr><td><span class="do-code">' + esc(c) + '</span> ' + esc(D.sku(s, c).name) + '</td><td class="num">' + (b.items[c] || 0) + '</td><td class="num"><input class="do-qty-in" data-c="' + esc(c) + '" inputmode="numeric" value="' + (b.items[c] || 0) + '"></td><td class="num">' + max + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<label class="do-field">정정 사유 (필수)<textarea data-reason rows="2" maxlength="200" placeholder="예: 패킹 후 재검수 결과 1 EA 누락"></textarea></label><div class="do-alert err" data-err hidden></div></div>' +
      '<div class="do-modal-foot"><button class="do-btn" data-do-close>취소</button><button class="do-btn primary" data-ok>정정 승인·저장</button></div>');
    w.querySelector('[data-ok]').addEventListener('click', function () {
      var items = {}, err = '';
      w.querySelectorAll('[data-c]').forEach(function (i) { var n = O.intOrNaN(i.value); if (isNaN(n)) err = '수량은 0 이상의 정수로 입력해 주세요.'; else if (n > 0) items[i.dataset.c] = n; });
      var reason = w.querySelector('[data-reason]').value.trim();
      if (!err && reason.length < 2) err = '정정 사유를 입력해 주세요.';
      var box = w.querySelector('[data-err]');
      if (err) { box.hidden = false; box.textContent = err; return; }
      O.op('box.correct', { boxId: b.id, items: items, reason: reason }).then(function () { O.closeModal(); O.toast('내품을 정정했습니다. 이력이 기록되었습니다.'); }).catch(function (e) { box.hidden = false; box.textContent = e.message; });
    });
  }

  function bind(el) {
    if (el.__doPack) return; el.__doPack = true;
    el.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-store]'); if (tr) { ui.store = ui.store === tr.dataset.store ? null : tr.dataset.store; var bs = ui.store ? D.boxes(O.S.state, ui.store) : []; ui.box = bs.length ? (bs.filter(function (x) { return x.status === 'open'; })[0] || bs[bs.length - 1]).id : null; ui.err = ''; return render(el); }
      var bx = e.target.closest('[data-box]'); if (bx) { ui.box = bx.dataset.box; ui.err = ''; return render(el); }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
      var s = O.S.state, box = ui.box && s.boxes[ui.box], a = b.dataset.act;
      if (a === 'new-box') { var store = b.dataset.v || (box && box.store); O.op('box.create', { store: store }).then(function (r) { ui.store = store; ui.box = r.boxId; ui.err = ''; render(el); O.toast('새 박스를 생성했습니다: ' + O.S.state.boxes[r.boxId].no); }).catch(function () {}); }
      else if (a === 'fill' && box) { var d = draftOf(box); itemsOf(s, box).forEach(function (c) { d[c] = String(Math.max(0, D.putQty(s, c, box.store) - D.packed(s, box.store, c, box.id))); }); render(el); }
      else if (a === 'save-items' && box) { var p = itemsPayload(box); if (p.err) { ui.err = p.err; return render(el); } O.op('box.items', { boxId: box.id, items: p.items }).then(function () { ui.err = ''; delete ui.draft[box.id]; render(el); O.toast('제품 수량을 확정했습니다.'); }).catch(function (e2) { ui.err = e2.message; render(el); }); }
      else if (a === 'close-box' && box) O.confirmBox('박스 패킹 완료', '<p><b>' + esc(box.no) + '</b> (' + fmt(D.boxTotal(box)) + ' EA)을 마감하고 고유 박스 ID <span class="do-mono">' + esc(box.id) + '</span>를 확정합니다.</p><p class="do-muted">마감 후에는 내품을 수정할 수 없습니다(관리자 정정만 가능).</p>', '패킹 완료').then(function (ok) { if (ok) O.op('box.close', { boxId: box.id }).then(function () { O.toast('박스를 마감했습니다. 라벨을 출력하세요.'); labelModal(el, O.S.state.boxes[box.id]); }).catch(function () {}); });
      else if (a === 'label' && box) labelModal(el, box);
      else if (a === 'ship' && box) O.confirmBox('출고 확정', '<p><b>' + esc(box.no) + '</b> → <span class="do-code">' + esc(box.store) + '</span> ' + esc(D.store(s, box.store).name) + ' 출고를 확정합니다.</p><p class="do-muted">출고 확정 후 매장 입고 화면에서 조회됩니다.</p>', '출고 확정', 'success').then(function (ok) { if (ok) O.op('box.ship', { boxId: box.id }).then(function () { O.toast('출고를 확정했습니다.'); }).catch(function () {}); });
      else if (a === 'correct' && box) correctModal(el, box);
    });
    el.addEventListener('input', function (e) { if (e.target.dataset.act === 'item') { var box = O.S.state.boxes[ui.box]; draftOf(box)[e.target.dataset.v] = e.target.value; e.target.classList.toggle('do-invalid', !/^\d*$/.test(e.target.value)); } });
    // change는 입력칸이 화면 갱신으로 사라질 때도 동기로 발생하므로 다음 틱에 다시 그림(중첩 갱신 방지)
    el.addEventListener('change', function (e) { if (e.target.dataset.act === 'item') setTimeout(function () { render(el); }, 0); });
  }
  O.register({ id: 'pack', viewId: 'dsPackView', menuId: 'sim-pack', label: '박스·출고', icon: 'package-check', render: render });
})();
