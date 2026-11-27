/* DAS 운영 시제품 3 — DAS 분류 (분배 작업대 화면) — js/66-das-ops-sorter.js
   DAS 선택 → 제품 바코드 스캔 → 매장 셀 점등(분배 수량) → 셀 터치로 분배 확정 → 셀 완료 → SKU 분배 완료
   분배 가능 수량 = 피킹 확정 수량 − 이미 분배한 수량. 피킹 결품으로 다 채울 수 없으면 '결품 마감' */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var ui = { station: 'DAS-1', sku: null, scan: '', qty: '', err: '', flash: null };

  function station(s) { return s.wave.das.filter(function (x) { return x.id === ui.station; })[0] || s.wave.das[0]; }
  function lines(s, st, sku) { return st.cells.map(function (store, i) { if (!store) return null; var need = D.orderQty(s, store, sku); return need ? { store: store, idx: i, need: need, put: D.putQty(s, sku, store) } : null; }).filter(Boolean); }
  function avail(s, sku) { return D.picked(s, sku) - D.putTotal(s, sku); }
  function pickDone(s, sku) { return s.wave.tasks.filter(function (t) { return t.sku === sku; }).every(function (t) { return t.status !== 'wait'; }); }
  function skuState(s, st, sku) {
    var ls = lines(s, st, sku), need = O.sum(ls, function (l) { return l.need; }), put = O.sum(ls, function (l) { return l.put; });
    var closed = s.wave.dasDone[sku];
    var tone = put >= need ? ['완료', 'ok'] : closed === 'short' ? ['결품 마감', 'err'] : put > 0 ? ['분배 중', 'run'] : avail(s, sku) > 0 ? ['분배 가능', 'wait'] : ['피킹 대기', ''];
    return { ls: ls, need: need, put: put, tone: tone };
  }

  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root">' + O.appbar('das') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s || !s.wave) return O.emptyState(el, 'das', s ? '출고 작업이 생성되지 않았습니다' : null, !s);
    var st = station(s); ui.station = st.id;
    var skus = Object.keys(D.demand(s)).filter(function (k) { return lines(s, st, k).length; }).sort();
    var cur = ui.sku && skus.indexOf(ui.sku) >= 0 ? skuState(s, st, ui.sku) : null;
    if (cur && cur.put >= cur.need) { /* 완료 표시는 유지, 다음 스캔 가능 */ }
    var k = ui.sku ? D.sku(s, ui.sku) : null, av = ui.sku ? avail(s, ui.sku) : 0;
    var lit = {}; if (cur) cur.ls.forEach(function (l) { lit[l.store] = l; });
    var stAll = O.sum(skus, function (x) { return skuState(s, st, x).need; }), stPut = O.sum(skus, function (x) { return skuState(s, st, x).put; });

    var tabs = '<div class="do-seg big">' + s.wave.das.map(function (x) {
      var ks = Object.keys(D.demand(s)).filter(function (kk) { return lines(s, x, kk).length; }), n = O.sum(ks, function (kk) { return skuState(s, x, kk).need; }), p = O.sum(ks, function (kk) { return skuState(s, x, kk).put; });
      return '<button class="' + (x.id === st.id ? 'on' : '') + '" data-act="station" data-v="' + x.id + '"><b>' + x.id + '</b><span>' + x.rows + '×' + x.cols + ' 셀 · ' + O.pct(p, n) + '%</span></button>';
    }).join('') + '</div>';

    var curCard = cur ? '<div class="do-das-cur"><div><small>현재 제품 · ' + esc(st.id) + '</small><b>' + esc(k.name) + '</b><span><span class="do-code inv">' + esc(k.code) + '</span> 점등 ' + cur.ls.filter(function (l) { return l.put < l.need; }).length + '셀 · 분배 ' + cur.put + ' / ' + cur.need + ' EA · 분배 가능 ' + av + ' EA</span></div>' +
      (cur.put >= cur.need ? O.chip('이 DAS 분배 완료', 'ok') : av <= 0 && pickDone(s, ui.sku) && !s.wave.dasDone[ui.sku] ? '<button class="do-btn danger" data-act="close-short">결품 마감</button>' : av <= 0 ? O.chip('피킹 대기', 'warn') : O.chip('분배 중', 'run')) + '</div>'
      : '<div class="do-das-cur idle"><div><small>' + esc(st.id) + '</small><b>제품 바코드를 스캔하세요</b><span>스캔하면 분배할 매장 셀에 불이 켜집니다.</span></div></div>';

    var wall = '<div class="do-wall" style="--cols:' + st.cols + '">' + st.cells.map(function (store, i) {
      var l = store && lit[store], name = store ? (D.store(s, store) || {}).name : '';
      var cls = !store ? 'off' : l ? (l.put >= l.need ? 'lit done' : 'lit') : '';
      if (ui.flash && ui.flash.store === store) cls += ui.flash.ok ? ' flash-ok' : ' flash-bad';
      return '<button class="do-cell ' + cls + '" ' + (store ? 'data-act="cell" data-v="' + esc(store) + '"' : 'disabled') + '><span class="no">' + esc(st.id.replace('DAS-', '')) + '-' + O.pad(i + 1) + '</span><span class="st">' + esc(store || '미배정') + '</span><span class="nm">' + esc(name) + '</span>' +
        (l ? '<b class="need">' + (l.need - l.put) + '</b><span class="put">' + l.put + ' / ' + l.need + '</span>' : '') + '<i class="lamp"></i></button>';
    }).join('') + '</div>';

    el.innerHTML = '<div class="do-root">' + O.appbar('das') +
      '<div class="do-page-head"><div><h2>DAS 분류</h2><p>제품을 스캔하면 매장 셀이 점등됩니다. 실제로 넣은 뒤 셀을 눌러 분배를 확정하세요.</p></div><div class="do-actions">' + tabs + '</div></div>' +
      '<div class="do-das-layout"><div class="do-card do-das-main">' +
      '<div class="do-scanbar ' + (ui.err ? 'bad' : '') + '"><i data-lucide="scan-barcode"></i><input data-act="scan-input" placeholder="제품 바코드 스캔 또는 제품코드 입력" value="' + esc(ui.scan) + '" autocomplete="off" spellcheck="false"><button class="do-btn" data-act="scan-ok">스캔 확인</button><label class="do-inline">분배 수량<input data-act="qty" inputmode="numeric" placeholder="전량" value="' + esc(ui.qty) + '"></label></div>' +
      (ui.err ? '<div class="do-alert err"><i data-lucide="circle-x"></i>' + esc(ui.err) + '</div>' : '') + curCard + wall +
      '<p class="do-hint">셀 번호는 장비 위치, 굵은 글자는 매장코드입니다. 분배 수량을 비워 두면 남은 수량(분배 가능 수량 한도) 전체를 확정합니다.</p></div>' +
      '<div class="do-card do-das-side"><div class="do-card-head"><h3>' + esc(st.id) + ' 분배 대상</h3><span class="do-muted">' + O.pct(stPut, stAll) + '% · ' + fmt(stPut) + '/' + fmt(stAll) + ' EA</span></div><div class="do-table-wrap tall"><table class="do-table"><thead><tr><th>제품</th><th class="num">셀</th><th class="num">분배</th><th class="num">가능</th><th>상태</th></tr></thead><tbody>' +
      skus.map(function (x) { var ss = skuState(s, st, x), kk = D.sku(s, x); return '<tr class="click' + (ui.sku === x ? ' sel' : '') + '" data-sku="' + esc(x) + '"><td><span class="do-code">' + esc(x) + '</span><small class="do-block">' + esc(kk.name) + '</small></td><td class="num">' + ss.ls.length + '</td><td class="num">' + ss.put + '/' + ss.need + '</td><td class="num">' + avail(s, x) + '</td><td>' + O.chip(ss.tone[0], ss.tone[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="do-hint">행을 눌러도 스캔과 같은 효과입니다(바코드가 훼손된 경우 등).</p></div></div></div>';
    ui.flash = null;
    bind(el); O.icons();
  }

  function scan(el, raw) {
    var s = O.S.state, st = station(s), v = String(raw || '').trim();
    ui.scan = ''; ui.err = '';
    if (!v) { ui.err = '제품 바코드를 스캔하거나 제품코드를 입력해 주세요.'; return render(el); }
    var k = s.skus.filter(function (x) { return x.barcode === v || x.code === v.toUpperCase(); })[0];
    if (!k) { ui.err = '등록되지 않은 바코드입니다: ' + v; return render(el); }
    if (ui.sku && ui.sku !== k.code) { var c = skuState(s, st, ui.sku); if (c.put < c.need && avail(s, ui.sku) > 0) { ui.err = '현재 제품(' + ui.sku + ')의 분배 가능 수량을 먼저 모두 분배해 주세요.'; return render(el); } }
    if (!lines(s, st, k.code).length) { var other = s.wave.das.filter(function (x) { return lines(s, x, k.code).length; })[0]; ui.err = other ? '이 제품은 ' + other.id + ' 분배 대상입니다.' : '이 제품은 분배 대상 매장이 없습니다.'; return render(el); }
    var ss = skuState(s, st, k.code);
    if (ss.put >= ss.need) { ui.sku = k.code; ui.err = k.code + '은(는) 이 DAS에서 이미 분배가 끝났습니다.'; return render(el); }
    if (avail(s, k.code) <= 0 && !pickDone(s, k.code)) { ui.sku = k.code; ui.err = '아직 피킹되지 않은 제품입니다(피킹 ' + D.picked(s, k.code) + ' / ' + D.demand(s)[k.code] + ').'; return render(el); }
    ui.sku = k.code; render(el);
  }
  function put(el, store) {
    var s = O.S.state, st = station(s);
    if (!ui.sku) { ui.err = '먼저 제품 바코드를 스캔해 주세요.'; ui.flash = { store: store, ok: false }; return render(el); }
    var l = lines(s, st, ui.sku).filter(function (x) { return x.store === store; })[0];
    if (!l) { ui.err = '이 셀(' + store + ')은 현재 제품의 분배 대상이 아닙니다.'; ui.flash = { store: store, ok: false }; return render(el); }
    if (l.put >= l.need) { ui.err = '이미 분배가 끝난 셀입니다.'; ui.flash = { store: store, ok: false }; return render(el); }
    var av = avail(s, ui.sku), q;
    if (String(ui.qty).trim()) { q = O.intOrNaN(ui.qty); if (isNaN(q) || q < 1) { ui.err = '분배 수량은 1 이상의 정수로 입력해 주세요.'; return render(el); } if (q > l.need - l.put) { ui.err = '이 셀의 남은 수량(' + (l.need - l.put) + ')을 넘었습니다.'; return render(el); } }
    else q = Math.min(l.need - l.put, av);
    if (av <= 0 || q > av) { ui.err = '분배 가능한 피킹 수량이 부족합니다(가능 ' + av + ' EA).'; ui.flash = { store: store, ok: false }; return render(el); }
    O.op('das.put', { sku: ui.sku, store: store, qty: q }).then(function () { ui.err = ''; ui.qty = ''; ui.flash = { store: store, ok: true }; render(el); }).catch(function (e) { ui.err = e.message; render(el); });
  }
  function bind(el) {
    if (el.__doDas) return; el.__doDas = true;
    el.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-sku]'); if (tr) return scan(el, tr.dataset.sku);
      var b = e.target.closest('[data-act]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
      var a = b.dataset.act;
      if (a === 'station') { ui.station = b.dataset.v; ui.sku = null; ui.err = ''; render(el); }
      else if (a === 'scan-ok') scan(el, el.querySelector('[data-act="scan-input"]').value);
      else if (a === 'cell') put(el, b.dataset.v);
      else if (a === 'close-short') O.confirmBox('결품 마감', '<p>' + esc(ui.sku) + '은(는) 피킹 결품으로 주문 수량을 모두 분배할 수 없습니다.</p><p>분배한 수량까지만 출고하고 이 제품의 분배를 마감할까요?</p>', '결품 마감', 'danger').then(function (ok) { if (ok) O.op('das.close', { sku: ui.sku }).then(function () { O.toast('결품 마감했습니다.'); }).catch(function () {}); });
    });
    el.addEventListener('input', function (e) { if (e.target.dataset.act === 'scan-input') ui.scan = e.target.value; if (e.target.dataset.act === 'qty') { ui.qty = e.target.value; e.target.classList.toggle('do-invalid', !/^\d*$/.test(e.target.value)); } });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset.act === 'scan-input') { e.preventDefault(); scan(el, e.target.value); } });
  }
  O.register({ id: 'das', viewId: 'dsDasView', menuId: 'sim-das', label: 'DAS 분류', icon: 'grid-3x3', render: render });
})();
