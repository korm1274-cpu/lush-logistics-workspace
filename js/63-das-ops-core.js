/* DAS 운영 시스템 시제품 — 공통 코어 (js/63-das-ops-core.js)
   - 서버(api/das-proto.js)에 저장된 출고 작업·박스·입고 검수 데이터를 조회/변경합니다. 자동 진행 기능 없음 — 직원 조작으로만 상태가 바뀝니다.
   - 다른 기기에서 바뀐 내용은 8초마다 버전(rev)만 확인해 새로 불러옵니다(화면이 열려 있을 때만).
   - 예시 데이터만 사용합니다(ERP·운영 재고와 연결 없음). 기존 운영 데이터·저장 키는 읽거나 쓰지 않습니다.
   - 공통 UI: 네이비 앱 헤더 + 6개 업무 탭, 상태 칩, 모달, Code 128 바코드, 라벨 인쇄, 카메라 스캔 */
(function (root) {
  'use strict';
  var API = '/api/das-proto';
  var POLL_MS = 8000;
  var doc = root.document;

  /* ───────── 유틸 ───────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function dt(ts, withDate) { if (!ts) return '-'; var d = new Date(ts); return (withDate ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' : '') + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function pct(a, b) { return b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0; }
  function sum(arr, fn) { var s = 0; (arr || []).forEach(function (x) { s += fn ? fn(x) : x; }); return s; }
  function toast(msg) { if (typeof root.toastMsg === 'function') root.toastMsg(msg); else if (root.console) root.console.warn(msg); }
  function icons() { try { if (root.lucide && root.lucide.createIcons) root.lucide.createIcons(); } catch (e) { /* 무시 */ } }
  function role() { try { var u = root.LUSH_AUTH && root.LUSH_AUTH.user && root.LUSH_AUTH.user(); return u ? u.role : ''; } catch (e) { return ''; } }
  function intOrNaN(v) { var s = String(v == null ? '' : v).trim(); return /^\d+$/.test(s) ? parseInt(s, 10) : NaN; }

  /* ───────── 서버 상태 ───────── */
  var S = { state: null, loaded: false, loading: false, error: '', busy: false, syncedAt: 0 };
  var subs = [];
  function notify() { subs.forEach(function (fn) { try { fn(); } catch (e) { if (root.console) root.console.error(e); } }); }
  function load() {
    if (S.loading) return S.loading;
    S.loading = fetch(API, { cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (!x.ok || !x.j.success) throw new Error((x.j && x.j.error) || '불러오지 못했습니다.');
      S.state = x.j.data || null; S.loaded = true; S.error = ''; S.syncedAt = Date.now();
    }).catch(function (e) { S.error = e.message || '서버에 연결하지 못했습니다.'; S.loaded = true; }).then(function () { S.loading = false; notify(); });
    return S.loading;
  }
  // 변경 요청: 성공하면 서버가 돌려준 최신 상태로 교체
  function op(action, payload) {
    if (S.busy) return Promise.reject(new Error('저장 중입니다. 잠시만 기다려 주세요.'));
    S.busy = true; notify();
    var body = Object.assign({ action: action }, payload || {});
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok || !x.j.success) { var e = new Error((x.j && x.j.error) || '저장하지 못했습니다.'); e.server = true; throw e; }
        S.state = x.j.data || null; S.syncedAt = Date.now(); return x.j.result || {};
      })
      .catch(function (e) { toast(e.message || '저장하지 못했습니다.'); if (e.server) load(); throw e; })
      .then(function (r) { S.busy = false; notify(); return r; }, function (e) { S.busy = false; notify(); throw e; });
  }
  function checkRev() {
    if (!S.loaded || S.busy || doc.hidden || !anyVisible()) return;
    fetch(API + '?action=rev', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.success && (j.rev || 0) !== ((S.state && S.state.rev) || 0)) load();
    }).catch(function () { /* 다음 주기에 다시 */ });
  }

  /* ───────── 파생 값(서버 규칙과 동일) ───────── */
  var D = {
    sku: function (s, c) { return s && s.skus.filter(function (x) { return x.code === c; })[0]; },
    store: function (s, c) { return s && s.stores.filter(function (x) { return x.code === c; })[0]; },
    demand: function (s) { var d = {}; s.orders.forEach(function (o) { o.lines.forEach(function (l) { d[l.sku] = (d[l.sku] || 0) + l.qty; }); }); return d; },
    orderQty: function (s, store, sku) { var o = s.orders.filter(function (x) { return x.store === store; })[0]; var l = o && o.lines.filter(function (x) { return x.sku === sku; })[0]; return l ? l.qty : 0; },
    storeOrderQty: function (s, store) { var o = s.orders.filter(function (x) { return x.store === store; })[0]; return o ? sum(o.lines, function (l) { return l.qty; }) : 0; },
    picked: function (s, sku) { return s.wave ? sum(s.wave.tasks.filter(function (t) { return t.sku === sku; }), function (t) { return t.picked; }) : 0; },
    putQty: function (s, sku, store) { return (s.wave && s.wave.put[sku + '|' + store]) || 0; },
    putTotal: function (s, sku) { if (!s.wave) return 0; var n = 0; for (var k in s.wave.put) if (k.indexOf(sku + '|') === 0) n += s.wave.put[k]; return n; },
    storePut: function (s, store) { if (!s.wave) return 0; var n = 0; for (var k in s.wave.put) if (k.split('|')[1] === store) n += s.wave.put[k]; return n; },
    packed: function (s, store, sku, except) { var n = 0; Object.keys(s.boxes).forEach(function (id) { var b = s.boxes[id]; if (b.store === store && id !== except) n += b.items[sku] || 0; }); return n; },
    boxTotal: function (b) { return sum(Object.keys(b.items), function (k) { return b.items[k]; }); },
    boxes: function (s, store) { return Object.keys(s.boxes).map(function (k) { return s.boxes[k]; }).filter(function (b) { return !store || b.store === store; }).sort(function (a, b) { return a.id.localeCompare(b.id); }); },
    receiptDiff: function (b) { if (!b.receipt || b.receipt.status !== 'confirmed') return null; var sm = b.receipt.summary; return sm.received - sm.shipped; }
  };
  var BOX_STATUS = { open: ['패킹 중', 'run'], closed: ['출고 대기', 'wait'], shipped: ['출고 완료', 'ok'], received: ['입고 완료', 'done'] };

  /* ───────── 공통 화면 요소 ───────── */
  var views = {}, order = [];
  function register(v) { views[v.id] = v; order.push(v.id); return v; }
  function isVisible(v) { var el = doc.getElementById(v.viewId); return !!(el && el.classList.contains('active')); }
  function anyVisible() { return order.some(function (id) { return isVisible(views[id]); }); }
  var pressing = false;
  function isTyping(el) { var a = doc.activeElement; return !!(a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function refreshVisible(force) {
    order.forEach(function (id) {
      var v = views[id], el = doc.getElementById(v.viewId);
      if (!isVisible(v)) return;
      if (!force && (pressing || isTyping(el))) { v.__stale = true; return; }
      v.__stale = false; v.render(el);
    });
  }
  function goTo(menuId) {
    try {
      /* eslint-disable no-undef */
      var m = typeof menus !== 'undefined' ? menus.filter(function (x) { return x.id === menuId; })[0] : null;
      if (m && typeof activateMenu === 'function') return activateMenu(m, doc.querySelector('[data-menu-id="' + menuId + '"]'));
      /* eslint-enable no-undef */
    } catch (e) { /* 아래로 */ }
    var v = order.map(function (id) { return views[id]; }).filter(function (x) { return x.menuId === menuId; })[0];
    if (v && typeof root.showView === 'function') root.showView(v.viewId, v.label);
  }

  function appbar(activeId) {
    var s = S.state;
    return '<header class="do-appbar"><div class="do-brand"><b>LUSH</b><span>물류센터 <i>|</i> DAS 운영 시스템</span></div>' +
      '<nav class="do-tabs">' + order.map(function (id) { var v = views[id]; return '<button class="' + (id === activeId ? 'on' : '') + '" data-do-go="' + v.menuId + '"><i data-lucide="' + v.icon + '"></i><span>' + esc(v.label) + '</span></button>'; }).join('') + '</nav>' +
      '<div class="do-sync" title="서버 저장 데이터 · 다른 기기 변경은 8초마다 반영"><i class="dot ' + (S.error ? 'bad' : '') + '"></i>' + (S.error ? '연결 오류' : s ? '출고일 ' + esc(s.date) + ' · 동기화 ' + dt(S.syncedAt) : '데이터 없음') + '</div></header>' +
      '<div class="do-proto-note"><i data-lucide="flask-conical"></i>업무 화면 시제품 · 예시 데이터로 동작하며 ERP·운영 재고와 연결되어 있지 않습니다.</div>';
  }
  function chip(label, tone) { return '<span class="do-chip ' + (tone || '') + '"><i></i>' + esc(label) + '</span>'; }
  function boxChip(b) { var x = BOX_STATUS[b.status] || [b.status, '']; return chip(x[0], x[1]); }
  function kpi(label, value, tone, sub) { return '<div class="do-kpi ' + (tone || '') + '"><span>' + esc(label) + '</span><b>' + value + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
  function bar(p, tone) { return '<div class="do-bar ' + (tone || '') + '"><span style="width:' + Math.max(0, Math.min(100, p)) + '%"></span></div>'; }
  function emptyState(el, activeId, msg, canSeed) {
    el.innerHTML = '<div class="do-root">' + appbar(activeId) + '<div class="do-card do-empty-card"><i data-lucide="' + (S.error ? 'wifi-off' : 'package-open') + '"></i><b>' + esc(S.error ? '서버에 연결하지 못했습니다' : msg || '오늘 출고 작업 데이터가 없습니다') + '</b><p>' + esc(S.error || '출고 작업 화면에서 예시 주문을 불러온 뒤 출고 작업을 생성하세요.') + '</p>' +
      (S.error ? '<button class="do-btn" data-do-retry>다시 시도</button>' : canSeed ? '<button class="do-btn primary" data-do-seed><i data-lucide="download"></i>예시 주문 불러오기</button>' : '<button class="do-btn" data-do-go="sim-wave">출고 작업으로 이동</button>') + '</div></div>';
    icons();
  }
  // 공통 클릭(탭 이동·다시 시도·예시 불러오기)
  function bindCommon(el) {
    if (el.__doCommon) return; el.__doCommon = true;
    el.addEventListener('click', function (e) {
      var g = e.target.closest('[data-do-go]'); if (g) { goTo(g.getAttribute('data-do-go')); return; }
      if (e.target.closest('[data-do-retry]')) { load(); return; }
      if (e.target.closest('[data-do-seed]')) { op('seed', {}).then(function () { toast('예시 주문을 불러왔습니다.'); }).catch(function () {}); }
    });
  }

  /* ───────── 모달 ───────── */
  function modal(html, opt) {
    close();
    var wrap = doc.createElement('div');
    wrap.className = 'do-modal-wrap'; wrap.id = 'doModal';
    wrap.innerHTML = '<div class="do-modal ' + ((opt && opt.cls) || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    doc.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('[data-do-close]')) { if (opt && opt.onClose) opt.onClose(); close(); } });
    icons();
    return wrap;
  }
  function close() { var m = doc.getElementById('doModal'); if (m) m.remove(); stopCamera(); }
  function confirmBox(title, body, okLabel, tone) {
    return new Promise(function (resolve) {
      var w = modal('<div class="do-modal-head"><b>' + esc(title) + '</b><button class="do-x" data-do-close>×</button></div><div class="do-modal-body">' + body + '</div><div class="do-modal-foot"><button class="do-btn" data-do-close>취소</button><button class="do-btn ' + (tone || 'primary') + '" data-ok>' + esc(okLabel || '확인') + '</button></div>', { onClose: function () { resolve(false); } });
      w.querySelector('[data-ok]').addEventListener('click', function () { close(); resolve(true); });
    });
  }

  /* ───────── Code 128 (B) — 스캔 가능한 바코드 SVG ───────── */
  var C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
  function code128Values(text) {
    var s = String(text), vals = [104], check = 104;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 32 || c > 126) throw new Error('Code 128-B로 표현할 수 없는 문자입니다.'); vals.push(c - 32); check += (c - 32) * (i + 1); }
    vals.push(check % 103); vals.push(106);
    return vals;
  }
  function code128Svg(text, opt) {
    opt = opt || {};
    var vals = code128Values(text), x = 10, rects = '', h = opt.height || 60;
    vals.forEach(function (v) { var p = C128[v]; for (var i = 0; i < p.length; i++) { var w = +p[i]; if (i % 2 === 0) rects += '<rect x="' + x + '" y="0" width="' + w + '" height="' + h + '"/>'; x += w; } });
    x += 10;
    return '<svg class="do-c128" viewBox="0 0 ' + x + ' ' + h + '" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="바코드 ' + esc(text) + '" data-code="' + esc(text) + '">' + rects + '</svg>';
  }

  /* ───────── 라벨(100 × 100mm) 미리보기·인쇄 ───────── */
  function labelHtml(s, b) {
    var st = D.store(s, b.store) || { name: '' };
    return '<div class="do-label"><div class="do-label-top"><b>LUSH</b><span>LOGISTICS CENTER</span></div>' +
      '<div class="do-label-mid"><div><small>매장코드</small><b class="lg">' + esc(b.store) + '</b></div><div><small>매장명</small><b class="lg">' + esc(st.name) + '</b></div>' +
      '<div><small>박스번호</small><b>' + esc(b.no) + '</b></div><div><small>출고 구분</small><b>' + esc(b.kind || '정기 출고') + '</b></div></div>' +
      '<div class="do-label-bc">' + code128Svg(b.id, { height: 70 }) + '<code>' + esc(b.id) + '</code></div>' +
      '<div class="do-label-foot"><span>출고일 ' + esc(s.date) + '</span><span>' + fmt(D.boxTotal(b)) + ' EA</span></div></div>';
  }
  function printLabel(s, b) {
    var area = doc.getElementById('doPrintArea');
    if (!area) { area = doc.createElement('div'); area.id = 'doPrintArea'; doc.body.appendChild(area); }
    area.innerHTML = labelHtml(s, b);
    var page = doc.createElement('style'); page.id = 'doPrintPage';
    page.textContent = '@page{size:100mm 100mm;margin:0}';
    doc.head.appendChild(page); doc.body.classList.add('do-printing');
    var done = function () { doc.body.classList.remove('do-printing'); var p = doc.getElementById('doPrintPage'); if (p) p.remove(); root.removeEventListener('afterprint', done); };
    root.addEventListener('afterprint', done);
    try { root.print(); } catch (e) { /* 인쇄 불가 환경 */ }
    setTimeout(done, 1500);
  }

  /* ───────── 카메라 바코드 스캔(BarcodeDetector 지원 브라우저) ───────── */
  var cam = null;
  function cameraSupported() { return !!(root.BarcodeDetector && root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia); }
  function scanCamera(onCode) {
    if (!cameraSupported()) { toast('이 브라우저는 카메라 바코드 스캔을 지원하지 않습니다. 스캐너나 직접 입력을 이용해 주세요.'); return; }
    var w = modal('<div class="do-modal-head"><b>카메라로 박스 바코드 스캔</b><button class="do-x" data-do-close>×</button></div><div class="do-cam"><video playsinline muted></video><i class="do-cam-frame"></i></div><p class="do-hint">박스 라벨의 바코드를 네모 안에 맞춰 주세요.</p>', { cls: 'cam' });
    var video = w.querySelector('video');
    var detector; try { detector = new root.BarcodeDetector({ formats: ['code_128', 'ean_13', 'qr_code'] }); } catch (e) { detector = new root.BarcodeDetector(); }
    root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      cam = { stream: stream, timer: null }; video.srcObject = stream; return video.play();
    }).then(function () {
      cam.timer = setInterval(function () {
        detector.detect(video).then(function (codes) { if (codes && codes[0] && codes[0].rawValue) { var v = codes[0].rawValue; close(); onCode(v); } }).catch(function () {});
      }, 350);
    }).catch(function () { close(); toast('카메라를 사용할 수 없습니다. 권한을 확인하거나 직접 입력해 주세요.'); });
  }
  function stopCamera() { if (!cam) return; clearInterval(cam.timer); try { cam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* 무시 */ } cam = null; }

  /* ───────── 시작 ───────── */
  function watch(v) {
    var el = doc.getElementById(v.viewId); if (!el) return;
    bindCommon(el);
    var was = false;
    new MutationObserver(function () { var on = el.classList.contains('active'); if (on && !was) { if (!S.loaded) load(); v.render(el); } was = on; }).observe(el, { attributes: true, attributeFilter: ['class'] });
    if (el.classList.contains('active')) { if (!S.loaded) load(); v.render(el); }
  }
  function init() {
    doc.addEventListener('pointerdown', function () { pressing = true; }, true);
    ['pointerup', 'pointercancel'].forEach(function (ev) { doc.addEventListener(ev, function () { setTimeout(function () { pressing = false; order.forEach(function (id) { if (views[id].__stale && isVisible(views[id])) refreshVisible(); }); }, 0); }, true); });
    doc.addEventListener('focusout', function () { setTimeout(function () { if (order.some(function (id) { return views[id].__stale; })) refreshVisible(); }, 0); });
    subs.push(function () { refreshVisible(); });
    order.forEach(function (id) { watch(views[id]); });
    setInterval(checkRev, POLL_MS);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) checkRev(); });
  }

  root.DasOps = {
    S: S, D: D, BOX_STATUS: BOX_STATUS, load: load, op: op, register: register, refresh: refreshVisible, goTo: goTo, role: role,
    esc: esc, fmt: fmt, pad: pad, dt: dt, pct: pct, sum: sum, toast: toast, icons: icons, intOrNaN: intOrNaN,
    appbar: appbar, chip: chip, boxChip: boxChip, kpi: kpi, bar: bar, emptyState: emptyState, modal: modal, closeModal: close, confirmBox: confirmBox,
    code128Values: code128Values, code128Svg: code128Svg, C128: C128, labelHtml: labelHtml, printLabel: printLabel, scanCamera: scanCamera, cameraSupported: cameraSupported
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); }); else setTimeout(init, 0);
})(window);
