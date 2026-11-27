/* DAS 운영 시제품 5 — 매장 입고 (매장 직원 · 모바일 우선) — js/68-das-ops-receive.js
   C. 입고 메인: 로그인 매장 · 큰 스캔 영역(카메라 / 외부 스캐너 / 박스번호 직접 입력) · 입고 대기 목록
   D. 박스 내품 명세서: 제품별 출고 수량 vs 실제 입고 수량(큰 ± 버튼 + 숫자 입력) · 차이 · 사유 · 파손 수량
   E. 입고 검수 확정: 요약(출고·입고·정상·부족·초과·파손) 확인 후 서버 저장, 중복 확정 차단
   * 시제품: '로그인 매장'은 이 기기에서 선택합니다(실제 운영에서는 매장 계정에 매장코드를 연결). */
(function () {
  'use strict';
  var O = window.DasOps; if (!O) return;
  var D = O.D, esc = O.esc, fmt = O.fmt;
  var REASONS = ['수량 부족', '수량 초과', '파손', '제품 불일치', '기타'];
  var STORE_KEY = 'lush_dasproto_store_v1';
  var ui = { screen: 'main', box: null, scan: '', err: '', drafts: {}, lookup: false };
  function myStore() { try { return localStorage.getItem(STORE_KEY) || 'S002'; } catch (e) { return 'S002'; } }
  function setStore(c) { try { localStorage.setItem(STORE_KEY, c); } catch (e) { /* 무시 */ } }

  function draft(b) {
    if (ui.drafts[b.id]) return ui.drafts[b.id];
    var src = b.receipt && b.receipt.items ? b.receipt.items : {}, d = {};
    Object.keys(b.items).forEach(function (k) { var x = src[k]; d[k] = x ? { received: String(x.received), damaged: String(x.damaged || 0), reason: x.reason || '', memo: x.memo || '' } : { received: String(b.items[k]), damaged: '0', reason: '', memo: '' }; });
    ui.drafts[b.id] = d; return d;
  }
  function num(v) { return O.intOrNaN(v); }
  function lineState(sh, it) {
    var r = num(it.received), dmg = num(it.damaged || '0');
    if (isNaN(r) || isNaN(dmg) || dmg > r) return { tone: 'err', label: '입력 오류', diff: 0, bad: true };
    var diff = r - sh;
    if (diff === 0 && dmg === 0) return { tone: 'ok', label: '일치', diff: 0 };
    return { tone: diff < 0 ? 'warn' : diff > 0 ? 'warn' : 'err', label: dmg > 0 ? '파손 ' + dmg : diff < 0 ? '부족 ' + (-diff) : '초과 ' + diff, diff: diff, need: true };
  }
  function summary(b, d) {
    var r = { shipped: 0, received: 0, normal: 0, short: 0, over: 0, damaged: 0, diffItems: 0 };
    Object.keys(b.items).forEach(function (k) { var sh = b.items[k], it = d[k], rc = num(it.received) || 0, dm = num(it.damaged || '0') || 0; r.shipped += sh; r.received += rc; r.damaged += dm; r.normal += Math.max(0, Math.min(sh, rc) - dm); if (rc < sh) r.short += sh - rc; if (rc > sh) r.over += rc - sh; if (rc !== sh || dm > 0) r.diffItems++; });
    return r;
  }
  function validate(b, d) {
    for (var k in b.items) { var it = d[k], ls = lineState(b.items[k], it); if (ls.bad) return k + ': 수량을 확인해 주세요(파손 수량은 입고 수량 이하).'; if (ls.need && !it.reason) return k + ': 수량 차이(또는 파손) 사유를 선택해 주세요.'; }
    return '';
  }
  function payload(b, d) { var out = {}; Object.keys(b.items).forEach(function (k) { var it = d[k]; out[k] = { received: it.received, damaged: it.damaged || '0', reason: it.reason, memo: it.memo }; }); return out; }

  function header(s) {
    var st = D.store(s, myStore()) || { code: myStore(), name: '' };
    return '<div class="rc-top"><div class="rc-brand"><b>LUSH</b><span>매장 입고</span></div><label class="rc-store"><small>로그인 매장</small><select data-act="store">' + s.stores.map(function (x) { return '<option value="' + esc(x.code) + '"' + (x.code === st.code ? ' selected' : '') + '>' + esc(x.code) + ' · ' + esc(x.name) + '</option>'; }).join('') + '</select></label></div>';
  }
  function mainScreen(s) {
    var mine = D.boxes(s, myStore()).filter(function (b) { return b.status === 'shipped' || b.status === 'received'; });
    var wait = mine.filter(function (b) { return b.status === 'shipped'; }), done = mine.filter(function (b) { return b.status === 'received'; });
    var row = function (b) { var draftMark = b.receipt && b.receipt.status === 'draft'; return '<button class="rc-boxrow" data-act="open" data-v="' + esc(b.id) + '"><div><b>' + esc(b.no) + '</b><span class="do-mono">' + esc(b.id) + '</span><small>출고 ' + O.dt(b.shippedAt, true) + '</small></div><div class="rc-boxrow-r"><b>' + fmt(D.boxTotal(b)) + ' EA</b>' + (b.status === 'received' ? O.chip(b.receipt.summary.diffItems ? '차이 ' + b.receipt.summary.diffItems + '건' : '입고 완료', b.receipt.summary.diffItems ? 'warn' : 'ok') : O.chip(draftMark ? '검수 중' : '검수 대기', draftMark ? 'run' : 'wait')) + '<span class="do-link">' + (b.status === 'received' ? '결과 보기' : '입고 검수') + '</span></div></button>'; };
    return '<div class="rc-scan-card"><i data-lucide="scan-barcode" class="rc-scan-ic"></i><b>박스 바코드를 스캔해 주세요</b><span>스캔 후 박스 내품 내역을 조회합니다.</span>' +
      '<div class="rc-scan-input ' + (ui.err ? 'bad' : '') + '"><input data-act="scan-input" placeholder="바코드 스캐너 입력 또는 박스번호(BOX-001)" value="' + esc(ui.scan) + '" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="do-btn primary" data-act="lookup"' + (ui.lookup ? ' disabled' : '') + '>조회</button></div>' +
      '<button class="do-btn rc-cam" data-act="camera"><i data-lucide="camera"></i>카메라로 스캔' + (O.cameraSupported() ? '' : ' (이 브라우저 미지원)') + '</button>' +
      (ui.err ? '<div class="do-alert err"><i data-lucide="circle-x"></i>' + esc(ui.err) + '</div>' : '') + '</div>' +
      '<div class="rc-sec"><h3>입고 대기 <em>' + wait.length + '</em></h3>' + (wait.length ? wait.map(row).join('') : '<div class="do-muted rc-none">입고 대기 중인 박스가 없습니다.</div>') + '</div>' +
      (done.length ? '<div class="rc-sec"><h3>입고 완료 <em>' + done.length + '</em></h3>' + done.map(row).join('') + '</div>' : '');
  }
  function sheetScreen(s, b) {
    var st = D.store(s, b.store), locked = b.status === 'received', d = draft(b), codes = Object.keys(b.items).sort();
    var res = locked ? b.receipt.items : null;
    var cards = codes.map(function (k) {
      var kk = D.sku(s, k), sh = b.items[k];
      if (locked) { var x = res[k], df = x.received - sh; return '<div class="rc-item"><div class="rc-item-h"><div><b>' + esc(kk.name) + '</b><span class="do-code">' + esc(k) + '</span></div>' + O.chip(df === 0 && !x.damaged ? '일치' : (x.damaged ? '파손 ' + x.damaged + ' ' : '') + (df < 0 ? '부족 ' + (-df) : df > 0 ? '초과 ' + df : ''), df === 0 && !x.damaged ? 'ok' : 'warn') + '</div><div class="rc-nums"><div><small>출고 수량</small><b>' + sh + ' EA</b></div><div><small>실제 입고</small><b>' + x.received + ' EA</b></div><div><small>차이</small><b class="' + (df ? 'warn' : '') + '">' + (df > 0 ? '+' : '') + df + '</b></div></div>' + (x.reason ? '<div class="rc-reason-view">사유: <b>' + esc(x.reason) + '</b>' + (x.memo ? ' · ' + esc(x.memo) : '') + '</div>' : '') + '</div>'; }
      var it = d[k], ls = lineState(sh, it);
      return '<div class="rc-item ' + ls.tone + '"><div class="rc-item-h"><div><b>' + esc(kk.name) + '</b><span class="do-code">' + esc(k) + '</span></div>' + O.chip(ls.label, ls.tone) + '</div>' +
        '<div class="rc-nums"><div><small>출고 수량</small><b>' + sh + ' EA</b></div><div><small>수량 차이</small><b class="' + (ls.diff ? 'warn' : '') + '">' + (ls.diff > 0 ? '+' : '') + ls.diff + '</b></div></div>' +
        '<div class="rc-stepper"><small>실제 입고 수량</small><div><button data-act="minus" data-v="' + esc(k) + '" aria-label="1 빼기">−</button><input data-act="recv" data-v="' + esc(k) + '" inputmode="numeric" value="' + esc(it.received) + '" aria-label="' + esc(kk.name) + ' 실제 입고 수량"><button data-act="plus" data-v="' + esc(k) + '" aria-label="1 더하기">+</button></div></div>' +
        (ls.need || it.reason ? '<div class="rc-reason"><label>차이 사유<select data-act="reason" data-v="' + esc(k) + '"><option value="">선택</option>' + REASONS.map(function (r) { return '<option' + (it.reason === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label>' +
          '<label>파손 수량<input data-act="damaged" data-v="' + esc(k) + '" inputmode="numeric" value="' + esc(it.damaged) + '"></label><label class="full">메모<input data-act="memo" data-v="' + esc(k) + '" maxlength="200" value="' + esc(it.memo) + '" placeholder="선택 입력"></label></div>' : '') + '</div>';
    }).join('');
    var sm = locked ? b.receipt.summary : summary(b, d);
    return '<div class="rc-sheet-head"><button class="pda-back" data-act="back"><i data-lucide="chevron-left"></i></button><div><small>박스 내품 명세서</small><b>' + esc(b.no) + '</b><span class="do-mono">' + esc(b.id) + '</span></div>' + (locked ? O.chip('입고 완료', 'ok') : O.chip(b.receipt && b.receipt.status === 'draft' ? '검수 중' : '검수 대기', 'wait')) + '</div>' +
      '<div class="rc-info"><div><small>매장</small><b>' + esc(b.store) + ' · ' + esc(st.name) + '</b></div><div><small>출고일시</small><b>' + O.dt(b.shippedAt, true) + '</b></div><div><small>제품 종류</small><b>' + codes.length + ' SKU</b></div><div><small>출고 수량</small><b>' + fmt(sm.shipped) + ' EA</b></div>' + (locked ? '<div><small>검수 확정</small><b>' + O.dt(b.receipt.confirmedAt, true) + '</b></div><div><small>실제 입고</small><b>' + fmt(sm.received) + ' EA</b></div>' : '') + '</div>' +
      '<div class="rc-sec"><h3>내품 검수</h3>' + cards + '</div>' +
      (ui.err ? '<div class="do-alert err"><i data-lucide="circle-x"></i>' + esc(ui.err) + '</div>' : '') +
      (locked ? '<div class="rc-foot"><button class="do-btn" data-act="back">목록으로</button></div>' : '<div class="rc-foot sticky"><button class="do-btn" data-act="save"' + (O.S.busy ? ' disabled' : '') + '>임시 저장</button><button class="do-btn primary" data-act="to-confirm"><i data-lucide="clipboard-check"></i>입고 검수 확정</button></div>');
  }
  function confirmScreen(s, b) {
    var d = draft(b), sm = summary(b, d), diffs = Object.keys(b.items).filter(function (k) { return lineState(b.items[k], d[k]).need; });
    return '<div class="rc-sheet-head"><button class="pda-back" data-act="to-sheet"><i data-lucide="chevron-left"></i></button><div><small>입고 검수 확정</small><b>' + esc(b.no) + '</b><span class="do-mono">' + esc(b.id) + '</span></div></div>' +
      '<div class="rc-sum">' + [['출고 총수량', sm.shipped, ''], ['실제 입고 총수량', sm.received, 'primary'], ['정상 입고', sm.normal, 'ok'], ['부족', sm.short, sm.short ? 'warn' : ''], ['초과', sm.over, sm.over ? 'warn' : ''], ['파손', sm.damaged, sm.damaged ? 'err' : '']].map(function (x) { return '<div class="' + x[2] + '"><small>' + x[0] + '</small><b>' + fmt(x[1]) + '<i> EA</i></b></div>'; }).join('') + '</div>' +
      (diffs.length ? '<div class="rc-sec"><h3>차이 발생 <em>' + diffs.length + '</em></h3>' + diffs.map(function (k) { var it = d[k], df = num(it.received) - b.items[k]; return '<div class="rc-diffrow"><b>' + esc(D.sku(s, k).name) + '</b><span>출고 ' + b.items[k] + ' → 입고 ' + it.received + (num(it.damaged) ? ' (파손 ' + it.damaged + ')' : '') + '</span><em>' + (df > 0 ? '+' : '') + df + '</em><small>' + esc(it.reason || '사유 미선택') + (it.memo ? ' · ' + esc(it.memo) : '') + '</small></div>'; }).join('') + '</div>' : '<div class="do-callout ok"><i data-lucide="check-circle-2"></i>출고 수량과 실제 입고 수량이 모두 일치합니다.</div>') +
      '<button class="do-btn ghost rc-photo" disabled title="확장 예정"><i data-lucide="image-plus"></i>사진 첨부 (확장 예정)</button>' +
      (ui.err ? '<div class="do-alert err"><i data-lucide="circle-x"></i>' + esc(ui.err) + '</div>' : '') +
      '<div class="rc-foot sticky"><button class="do-btn" data-act="to-sheet">수량 다시 확인</button><button class="do-btn primary" data-act="confirm"' + (O.S.busy ? ' disabled' : '') + '><i data-lucide="check"></i>입고 확정</button></div><p class="do-hint">확정하면 서버에 저장되며 다시 확정하거나 수정할 수 없습니다.</p>';
  }

  function render(el) {
    var s = O.S.state;
    if (!O.S.loaded) { el.innerHTML = '<div class="do-root rc">' + O.appbar('receive') + '<div class="do-card do-loading">불러오는 중…</div></div>'; O.icons(); return; }
    if (!s) return O.emptyState(el, 'receive', '조회할 출고 데이터가 없습니다', false);
    var b = ui.box && s.boxes[ui.box];
    if (ui.screen !== 'main' && (!b || b.store !== myStore())) { ui.screen = 'main'; ui.box = null; }
    if (b && ui.screen === 'confirm' && b.status === 'received') ui.screen = 'sheet';
    var body = ui.screen === 'main' ? mainScreen(s) : ui.screen === 'sheet' ? sheetScreen(s, b) : confirmScreen(s, b);
    el.innerHTML = '<div class="do-root rc">' + O.appbar('receive') + '<div class="rc-wrap">' + header(s) + body + '</div></div>';
    bind(el); O.icons();
  }

  function lookup(el, raw) {
    var v = String(raw || '').trim().toUpperCase();
    ui.err = ''; ui.scan = '';
    if (!v) { ui.err = '박스 바코드를 스캔하거나 박스번호를 입력해 주세요.'; return render(el); }
    ui.lookup = true; render(el);
    fetch('/api/das-proto?action=box&id=' + encodeURIComponent(v) + '&store=' + encodeURIComponent(myStore()), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      ui.lookup = false;
      if (!j.success) { ui.err = j.error || '박스를 찾을 수 없습니다.'; return render(el); }
      var b = j.box;
      if (b.status === 'open' || b.status === 'closed') { ui.err = b.no + '은(는) 아직 출고 확정되지 않은 박스입니다.'; return render(el); }
      var go = function () { ui.box = b.id; ui.screen = 'sheet'; render(el); };
      if (!O.S.state || !O.S.state.boxes[b.id] || O.S.state.rev !== j.rev) O.load().then(go); else go();
    }).catch(function () { ui.lookup = false; ui.err = '서버에 연결하지 못했습니다.'; render(el); });
  }
  function bind(el) {
    if (el.__doRc) return; el.__doRc = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var s = O.S.state, box = ui.box && s.boxes[ui.box], a = b.dataset.act, d = box && draft(box);
      if (a === 'lookup') return lookup(el, el.querySelector('[data-act="scan-input"]').value);
      if (a === 'camera') return O.scanCamera(function (code) { lookup(el, code); });
      if (a === 'open') { ui.box = b.dataset.v; ui.screen = 'sheet'; ui.err = ''; }
      else if (a === 'back') { ui.screen = 'main'; ui.box = null; ui.err = ''; }
      else if (a === 'minus' || a === 'plus') { var it = d[b.dataset.v], n = num(it.received); n = (isNaN(n) ? 0 : n) + (a === 'plus' ? 1 : -1); it.received = String(Math.max(0, n)); ui.err = ''; }
      else if (a === 'save') { O.op('receipt.save', { boxId: box.id, store: myStore(), items: payload(box, d) }).then(function () { ui.err = ''; O.toast('검수 내용을 임시 저장했습니다. 다른 기기에서도 이어서 할 수 있습니다.'); }).catch(function (e2) { ui.err = e2.message; render(el); }); return; }
      else if (a === 'to-confirm') { var v = validate(box, d); if (v) { ui.err = v; } else { ui.err = ''; ui.screen = 'confirm'; } }
      else if (a === 'to-sheet') { ui.screen = 'sheet'; ui.err = ''; }
      else if (a === 'confirm') { var v2 = validate(box, d); if (v2) { ui.err = v2; ui.screen = 'sheet'; return render(el); } O.op('receipt.confirm', { boxId: box.id, store: myStore(), items: payload(box, d) }).then(function () { delete ui.drafts[box.id]; ui.err = ''; ui.screen = 'sheet'; render(el); O.toast('입고 검수를 확정했습니다.'); }).catch(function (e3) { ui.err = e3.message; render(el); }); return; }
      else return;
      render(el);
    });
    el.addEventListener('input', function (e) {
      var a = e.target.dataset.act, s = O.S.state, box = ui.box && s.boxes[ui.box];
      if (a === 'scan-input') { ui.scan = e.target.value; return; }
      if (!box || !/^(recv|damaged|memo)$/.test(a)) return;
      var it = draft(box)[e.target.dataset.v];
      if (a === 'recv') it.received = e.target.value; else if (a === 'damaged') it.damaged = e.target.value; else it.memo = e.target.value;
      ui.err = '';
      if (a !== 'memo') e.target.classList.toggle('do-invalid', !/^\d+$/.test(e.target.value));
    });
    el.addEventListener('change', function (e) {
      var a = e.target.dataset.act, s = O.S.state, box = ui.box && s.boxes[ui.box];
      var later = function () { setTimeout(function () { render(el); }, 0); }; // 화면 갱신 중 발생하는 change와 겹치지 않게
      if (a === 'store') { setStore(e.target.value); ui.screen = 'main'; ui.box = null; ui.err = ''; return later(); }
      if (a === 'reason' && box) { draft(box)[e.target.dataset.v].reason = e.target.value; ui.err = ''; return later(); }
      if ((a === 'recv' || a === 'damaged') && box) later();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset.act === 'scan-input') { e.preventDefault(); lookup(el, e.target.value); } });
  }
  O.register({ id: 'receive', viewId: 'dsReceiveView', menuId: 'sim-receive', label: '매장 입고', icon: 'store', render: render });
})();
