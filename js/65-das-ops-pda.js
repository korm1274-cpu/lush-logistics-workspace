/* DAS 운영 시제품 2 — PDA 피킹 (현장 작업자 · 휴대 단말) — js/65-das-ops-pda.js
   Zone 선택 → Zone별 피킹 리스트 → 로케이션 바코드 스캔 → 제품 상세(피킹/필요 수량) → 수량 입력·확정 → 리스트 복귀
   재고 부족 시 대체 로케이션 안내, 대체가 없으면 사유 선택 후 결품 확정. 모든 확정은 서버에 저장 */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var SHORT_REASONS = ['재고 부족', '제품 파손', '로케이션 불일치', '기타'];
  var ui = { screen: 'zones', zone: 'A', taskId: null, loc: null, qty: '', err: '', reason: '', scan: '' };

  function task(s) { return s.wave && s.wave.tasks.filter(function (t) { return t.id === ui.taskId; })[0]; }
  function locs(s, t) { var k = D.sku(s, t.sku); return [k.loc].concat(k.alt); }
  function locStock(s, loc, sku) { var x = s.stock[loc]; return x && x.sku === sku ? x.qty : 0; }
  function nextLoc(s, t) { var l = locs(s, t).filter(function (x) { return locStock(s, x, t.sku) > 0; })[0]; return l || t.loc; }
  function statusOf(t) { return t.status === 'done' ? ['완료', 'ok'] : t.status === 'short' ? ['결품', 'err'] : t.picked ? ['부분', 'warn'] : ['대기', '']; }

  function screen(s) {
    var top = '<div class="pda-bar"><span>LUSH PDA</span><span>피킹 · ' + esc(s.wave.id) + '</span><span><i data-lucide="wifi"></i><i data-lucide="battery-medium"></i></span></div>', body = '';
    if (ui.screen === 'zones') {
      body = '<div class="pda-h">Zone 선택</div><div class="pda-zones">' + ['A', 'B', 'C', 'D'].map(function (z) {
        var list = s.wave.tasks.filter(function (t) { return t.zone === z; }), done = list.filter(function (t) { return t.status !== 'wait'; }).length;
        var need = O.sum(list, function (t) { return t.need; }), pk = O.sum(list, function (t) { return t.picked; });
        return '<button class="pda-zone" data-act="zone" data-v="' + z + '"' + (list.length ? '' : ' disabled') + '><b>Zone ' + z + '</b><span>' + done + ' / ' + list.length + ' 작업</span><small>' + fmt(pk) + ' / ' + fmt(need) + ' EA</small>' + O.bar(O.pct(pk, need), done === list.length && list.length ? 'ok' : '') + '</button>';
      }).join('') + '</div>';
    } else if (ui.screen === 'list') {
      var list = s.wave.tasks.filter(function (t) { return t.zone === ui.zone; });
      body = '<div class="pda-h"><button class="pda-back" data-act="back-zones"><i data-lucide="chevron-left"></i></button>Zone ' + esc(ui.zone) + ' 피킹 리스트<em>' + list.filter(function (t) { return t.status !== 'wait'; }).length + '/' + list.length + '</em></div><div class="pda-list">' +
        list.map(function (t) { var st = statusOf(t), k = D.sku(s, t.sku); return '<button class="pda-row ' + st[1] + '" data-act="task" data-v="' + t.id + '"' + (t.status !== 'wait' ? ' aria-disabled="true"' : '') + '><span class="pda-loc">' + esc(t.loc) + '</span><span class="pda-row-main"><b>' + esc(k.name) + '</b><small>' + esc(t.sku) + ' · ' + esc(t.id) + '</small></span><span class="pda-row-q">' + t.picked + '<i>/' + t.need + '</i></span>' + O.chip(st[0], st[1]) + '</button>'; }).join('') + '</div>';
    } else if (ui.screen === 'scan') {
      var t = task(s), k = D.sku(s, t.sku), alt = ui.loc !== t.loc;
      body = '<div class="pda-h"><button class="pda-back" data-act="back-list"><i data-lucide="chevron-left"></i></button>로케이션 스캔</div>' +
        '<div class="pda-target"><small>이동할 로케이션' + (alt ? ' · 대체' : '') + '</small><b>' + esc(ui.loc) + '</b><span>' + esc(k.name) + ' · ' + esc(t.sku) + '</span></div>' +
        '<label class="pda-scan ' + (ui.err ? 'bad' : '') + '"><i data-lucide="scan-line"></i><input data-act="scan-input" placeholder="로케이션 바코드 스캔 또는 입력" value="' + esc(ui.scan) + '" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
        (ui.err ? '<div class="pda-err">' + esc(ui.err) + '</div>' : '<p class="pda-tip">스캐너로 로케이션 라벨을 읽으면 자동으로 확인합니다.</p>') +
        '<div class="pda-foot"><button class="pda-btn" data-act="scan-ok">확인</button></div>';
    } else {
      var t2 = task(s), k2 = D.sku(s, t2.sku), avail = locStock(s, ui.loc, t2.sku), left = t2.need - t2.picked;
      var others = locs(s, t2).filter(function (l) { return l !== ui.loc && locStock(s, l, t2.sku) > 0; });
      var short = avail < left, r = t2.picked / t2.need;
      body = '<div class="pda-h"><button class="pda-back" data-act="back-list"><i data-lucide="chevron-left"></i></button>피킹 상세</div>' +
        '<div class="pda-prod"><small>' + esc(t2.id) + ' · <span class="pda-loc">' + esc(ui.loc) + '</span></small><b>' + esc(k2.name) + '</b><span>' + esc(t2.sku) + ' · ' + esc(k2.barcode) + '</span></div>' +
        '<div class="pda-count ' + (r >= 1 ? 'ok' : r > 0 ? 'warn' : '') + '"><small>피킹 / 필요</small><b>' + t2.picked + '<i> / ' + t2.need + '</i></b><span>남은 수량 ' + left + ' EA · 이 로케이션 재고 ' + avail + ' EA</span></div>' +
        (short ? '<div class="pda-warn"><b><i data-lucide="triangle-alert"></i>재고 부족 ' + (left - avail) + ' EA</b>' + (others.length ? '<span>이 로케이션에서 ' + avail + ' EA 확정 후 대체 로케이션으로 이동하세요.</span>' + others.map(function (l) { return '<span class="pda-alt"><b>' + esc(l) + '</b>재고 ' + locStock(s, l, t2.sku) + ' EA</span>'; }).join('') : '<span>대체 로케이션이 없습니다. 피킹 가능한 수량만 확정하고 결품 사유를 선택하세요.</span><select data-act="reason"><option value="">결품 사유 선택</option>' + SHORT_REASONS.map(function (x) { return '<option' + (ui.reason === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>') + '</div>' : '') +
        '<div class="pda-qty"><button data-act="minus" aria-label="1 빼기">−</button><input data-act="qty" inputmode="numeric" value="' + esc(ui.qty) + '" aria-label="피킹 수량"><button data-act="plus" aria-label="1 더하기">+</button></div>' +
        (ui.err ? '<div class="pda-err">' + esc(ui.err) + '</div>' : '') +
        '<div class="pda-foot">' + (short && !others.length ? '<button class="pda-btn warn" data-act="confirm-short">결품 확정</button>' : '<button class="pda-btn" data-act="confirm"' + (O.S.busy ? ' disabled' : '') + '><i data-lucide="check"></i>피킹 확정</button>') + '</div>';
    }
    return '<div class="pda-device"><div class="pda-screen">' + top + '<div class="pda-body">' + body + '</div></div></div>';
  }

  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root">' + O.appbar('pda') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s || !s.wave) return O.emptyState(el, 'pda', s ? '출고 작업이 생성되지 않았습니다' : null, !s);
    if (ui.taskId && !task(s)) { ui.screen = 'list'; ui.taskId = null; }
    var tasks = s.wave.tasks, done = tasks.filter(function (t) { return t.status !== 'wait'; }).length;
    var need = O.sum(tasks, function (t) { return t.need; }), pk = O.sum(tasks, function (t) { return t.picked; });
    var shortList = tasks.filter(function (t) { return t.status === 'short'; });
    el.innerHTML = '<div class="do-root">' + O.appbar('pda') +
      '<div class="do-page-head"><div><h2>PDA 피킹</h2><p>Zone별 피킹 리스트를 처리합니다. 로케이션을 스캔한 뒤 실제 피킹 수량을 확정하세요.</p></div><div class="do-actions">' + O.chip(done === tasks.length ? '피킹 완료' : '피킹 진행 중', done === tasks.length ? 'ok' : 'run') + '</div></div>' +
      '<div class="do-pda-layout"><div class="do-pda-stage">' + screen(s) + '</div><div class="do-pda-side">' +
      '<div class="do-kpis two">' + O.kpi('확정 작업', done + ' / ' + tasks.length) + O.kpi('피킹 수량', fmt(pk) + ' / ' + fmt(need), 'primary') + O.kpi('결품', shortList.length + '건', shortList.length ? 'err' : '') + O.kpi('결품 수량', fmt(O.sum(shortList, function (t) { return t.need - t.picked; })) + ' EA', shortList.length ? 'err' : '') + '</div>' +
      '<div class="do-card"><div class="do-card-head"><h3>Zone별 진행</h3></div>' + ['A', 'B', 'C', 'D'].map(function (z) { var l = tasks.filter(function (t) { return t.zone === z; }), n = O.sum(l, function (t) { return t.need; }), p = O.sum(l, function (t) { return t.picked; }); return '<div class="do-row-bar"><span class="do-zone z' + z + '">' + z + '</span>' + O.bar(O.pct(p, n), l.every(function (t) { return t.status !== 'wait'; }) ? 'ok' : '') + '<b>' + l.filter(function (t) { return t.status !== 'wait'; }).length + '/' + l.length + '</b></div>'; }).join('') + '</div>' +
      '<div class="do-card"><div class="do-card-head"><h3>결품 내역</h3></div>' + (shortList.length ? '<ul class="do-mini">' + shortList.map(function (t) { return '<li><span class="do-code">' + esc(t.sku) + '</span><span>' + esc(D.sku(s, t.sku).name) + '</span><b class="err">−' + (t.need - t.picked) + ' EA</b><small>' + esc(t.reason) + '</small></li>'; }).join('') + '</ul>' : '<div class="do-muted">결품 없음</div>') + '</div></div></div></div>';
    bind(el); O.icons();
    var f = el.querySelector('[data-act="scan-input"]'); if (f && ui.screen === 'scan') setTimeout(function () { if (document.activeElement === document.body || !document.activeElement) f.focus(); }, 0);
  }

  function doScan(el, raw) {
    var s = O.S.state, t = task(s), v = String(raw || '').trim().toUpperCase().replace(/^LOC-/, '');
    ui.scan = '';
    if (!v) { ui.err = '로케이션 바코드를 스캔하거나 입력해 주세요.'; return render(el); }
    if (v !== ui.loc) { ui.err = '로케이션 불일치: ' + v + ' (이동할 곳 ' + ui.loc + ')'; return render(el); }
    ui.err = ''; ui.screen = 'detail';
    ui.qty = String(Math.min(t.need - t.picked, locStock(s, ui.loc, t.sku)));
    render(el);
  }
  function confirm(el, short) {
    var s = O.S.state, t = task(s), avail = locStock(s, ui.loc, t.sku), left = t.need - t.picked;
    var q = O.intOrNaN(ui.qty);
    if (isNaN(q)) { ui.err = '수량은 0 이상의 정수로 입력해 주세요.'; return render(el); }
    if (q > left) { ui.err = '남은 수량(' + left + ')보다 많이 피킹할 수 없습니다.'; return render(el); }
    if (q > avail) { ui.err = '이 로케이션 재고(' + avail + ')보다 많이 피킹할 수 없습니다.'; return render(el); }
    if (short && !ui.reason) { ui.err = '결품 사유를 선택해 주세요.'; return render(el); }
    if (!short && q === 0) { ui.err = '피킹 수량을 입력해 주세요.'; return render(el); }
    var id = t.id;
    O.op('pick.confirm', { taskId: id, loc: ui.loc, qty: q, short: !!short, reason: ui.reason }).then(function () {
      var s2 = O.S.state, t2 = s2.wave.tasks.filter(function (x) { return x.id === id; })[0];
      ui.err = ''; ui.reason = '';
      if (t2.status === 'wait') { ui.loc = nextLoc(s2, t2); ui.screen = 'scan'; O.toast(q + ' EA 확정 · 남은 ' + (t2.need - t2.picked) + ' EA는 ' + ui.loc + '에서 피킹하세요.'); }
      else { ui.screen = 'list'; ui.taskId = null; O.toast(t2.status === 'done' ? '피킹을 확정했습니다. 리스트로 돌아갑니다.' : '결품으로 확정했습니다.'); }
      render(el);
    }).catch(function (e) { ui.err = e.message; render(el); });
  }
  function bind(el) {
    if (el.__doPda) return; el.__doPda = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var s = O.S.state, a = b.dataset.act;
      if (a === 'zone') { ui.zone = b.dataset.v; ui.screen = 'list'; }
      else if (a === 'back-zones') ui.screen = 'zones';
      else if (a === 'back-list') { ui.screen = 'list'; ui.taskId = null; ui.err = ''; }
      else if (a === 'task') { var t = s.wave.tasks.filter(function (x) { return x.id === b.dataset.v; })[0]; if (t.status !== 'wait') { O.toast('이미 확정된 작업입니다.'); return; } ui.taskId = t.id; ui.loc = nextLoc(s, t); ui.screen = 'scan'; ui.err = ''; ui.scan = ''; }
      else if (a === 'scan-ok') return doScan(el, el.querySelector('[data-act="scan-input"]').value);
      else if (a === 'minus' || a === 'plus') { var v = O.intOrNaN(ui.qty); v = (isNaN(v) ? 0 : v) + (a === 'plus' ? 1 : -1); ui.qty = String(Math.max(0, v)); ui.err = ''; }
      else if (a === 'confirm') return confirm(el, false);
      else if (a === 'confirm-short') return confirm(el, true);
      else return;
      render(el);
    });
    el.addEventListener('input', function (e) { var a = e.target.dataset.act; if (a === 'qty') { ui.qty = e.target.value; e.target.classList.toggle('do-invalid', !/^\d*$/.test(e.target.value)); } if (a === 'scan-input') ui.scan = e.target.value; });
    el.addEventListener('change', function (e) { if (e.target.dataset.act === 'reason') ui.reason = e.target.value; });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.dataset.act === 'scan-input') { e.preventDefault(); doScan(el, e.target.value); }
      else if (e.target.dataset.act === 'qty') { e.preventDefault(); ui.qty = e.target.value; confirm(el, false); }
    });
  }
  O.register({ id: 'pda', viewId: 'dsPdaView', menuId: 'sim-pda', label: 'PDA 피킹', icon: 'scan-barcode', render: render });
})();
