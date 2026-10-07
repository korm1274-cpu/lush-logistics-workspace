/* Design Preview v3 — alternate preview UI for Main + presentation layer for Status Board */
(function(){
  'use strict';

  var STORAGE_KEY='lush-design-preview-v1';
  var button=document.getElementById('designPreviewToggle');
  var stateLabel=document.getElementById('designPreviewToggleState');
  var lastActiveId='';
  var dataObserver=null;
  if(!button)return;

  function enabled(){
    try{return localStorage.getItem(STORAGE_KEY)==='on';}
    catch(e){return false;}
  }
  function activeView(){
    var el=document.querySelector('.view.active');
    return el ? el.id : '';
  }
  function textOf(id,fallback){
    var el=document.getElementById(id);
    var v=el ? (el.textContent||'').trim() : '';
    return v || fallback || '-';
  }
  function shortText(value,max){
    value=(value||'').replace(/\s+/g,' ').trim();
    return value.length>max ? value.slice(0,max-1)+'…' : value;
  }
  function numberFrom(value){
    var n=parseInt(String(value||'').replace(/[^\d-]/g,''),10);
    return Number.isFinite(n) ? n : 0;
  }
  function menuClick(id){
    var el=document.querySelector('[data-menu-id="'+id+'"]');
    if(el){el.click();return true;}
    return false;
  }

  function warehouseSvg(){
    return '<svg class="pv-hero-svg" viewBox="0 0 760 390" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+
      '<defs><linearGradient id="pvSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8f1"/><stop offset=".58" stop-color="#ead9d4"/><stop offset="1" stop-color="#bcc8d0"/></linearGradient><linearGradient id="pvGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d3cc"/><stop offset="1" stop-color="#a8afb2"/></linearGradient><linearGradient id="pvWall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e7e6e2"/><stop offset="1" stop-color="#c7c9c9"/></linearGradient></defs>'+
      '<rect width="760" height="390" fill="url(#pvSky)"/><circle cx="596" cy="74" r="62" fill="#fff4d8" opacity=".55"/>'+
      '<path d="M0 276 L760 230 L760 390 L0 390Z" fill="url(#pvGround)"/><path d="M0 313 L760 270" stroke="#f4eee7" stroke-width="3" opacity=".7"/>'+
      '<g opacity=".27" stroke="#70777c"><path d="M80 95v110M175 85v118M676 83v102"/><path d="M61 112h39M155 102h42M656 101h40"/></g>'+
      '<g><path d="M175 122 L680 86 L721 117 L721 263 L175 280Z" fill="url(#pvWall)"/><path d="M175 122 L680 86 L680 106 L175 141Z" fill="#c1c2c1"/><text x="475" y="139" font-size="34" font-weight="900" fill="#4b433f" opacity=".84">LUSH</text>'+
      '<g fill="#484a4b"><rect x="259" y="190" width="62" height="75" rx="3"/><rect x="353" y="181" width="62" height="77" rx="3"/><rect x="447" y="172" width="62" height="78" rx="3"/><rect x="541" y="162" width="62" height="80" rx="3"/></g>'+
      '<g fill="#faf6ee" opacity=".76"><rect class="pv-window-glow" x="205" y="153" width="38" height="16"/><rect class="pv-window-glow" x="619" y="132" width="46" height="17"/></g></g>'+
      '<g class="pv-hero-truck" transform="translate(350 233)"><rect x="0" y="14" width="120" height="50" rx="8" fill="#f6f4ef"/><rect x="90" y="28" width="58" height="36" rx="7" fill="#eceae6"/><path d="M112 30h26l12 18v16h-38z" fill="#dadede"/><rect x="117" y="34" width="19" height="12" rx="2" fill="#78909b"/><text x="18" y="45" font-size="16" font-weight="900" fill="#292826">LUSH</text><circle class="pv-wheel" cx="32" cy="67" r="12" fill="#232323"/><circle cx="32" cy="67" r="5" fill="#969696"/><circle class="pv-wheel" cx="120" cy="67" r="12" fill="#232323"/><circle cx="120" cy="67" r="5" fill="#969696"/></g>'+
      '<g fill="#fff" opacity=".42"><ellipse cx="475" cy="326" rx="122" ry="11"/><ellipse cx="570" cy="308" rx="82" ry="8"/></g></svg>';
  }

  function actionArt(kind){
    if(kind==='outbound')return '<svg viewBox="0 0 420 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="a1" x1="0" x2="1"><stop stop-color="#604539"/><stop offset="1" stop-color="#c49672"/></linearGradient></defs><rect width="420" height="180" fill="url(#a1)"/><g transform="translate(200 35)" fill="#d9b38d" stroke="#8b674c" stroke-width="2"><rect x="0" y="36" width="70" height="54"/><rect x="60" y="14" width="82" height="63"/><rect x="128" y="43" width="75" height="52"/><path d="M0 36l35-20 35 20M60 14l41-19 41 19M128 43l38-20 37 20" fill="#e3c09c"/></g><path d="M40 137h335" stroke="#f2dfc7" stroke-width="3" stroke-dasharray="8 8" opacity=".55"/></svg>';
    if(kind==='inbound')return '<svg viewBox="0 0 420 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="a2" x1="0" x2="1"><stop stop-color="#c7c5be"/><stop offset="1" stop-color="#efeee9"/></linearGradient></defs><rect width="420" height="180" fill="url(#a2)"/><g transform="translate(232 22) rotate(14)"><rect x="0" y="0" width="70" height="118" rx="13" fill="#313438"/><rect x="8" y="9" width="54" height="58" rx="6" fill="#86b6b0"/><rect x="19" y="78" width="31" height="48" rx="7" fill="#24272a"/><path d="M22 24h26M18 35h34M24 46h22" stroke="#d7fff8" stroke-width="3"/></g><g fill="#b48a66"><rect x="73" y="80" width="85" height="57"/><path d="M73 80l42-24 43 24" fill="#cda47f"/></g></svg>';
    if(kind==='inventory')return '<svg viewBox="0 0 420 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="a3" x1="0" x2="1"><stop stop-color="#d7c7b3"/><stop offset="1" stop-color="#8d765e"/></linearGradient></defs><rect width="420" height="180" fill="url(#a3)"/><g stroke="#6d5947" stroke-width="5"><path d="M180 18v145M270 18v145M360 18v145"/><path d="M155 52h230M155 101h230M155 150h230"/></g><g fill="#d6a979"><rect x="172" y="59" width="55" height="35"/><rect x="282" y="60" width="64" height="34"/><rect x="190" y="108" width="68" height="36"/><rect x="287" y="108" width="55" height="36"/></g></svg>';
    return '';
  }

  function mainMarkup(){
    return '<div id="designPreviewDashboard" class="pv-home">'+
      '<section class="pv-hero"><div class="pv-hero-grid">'+
        '<div class="pv-hero-copy"><div class="pv-kicker">LUSH LOGISTICS · LIVE OPERATIONS</div><h2>오늘도 원활한<br>운영을 이어가고 있어요.</h2><p>현재 물류 현황에서 필요한 정보만 먼저 확인하고, 필요한 업무로 바로 이동할 수 있습니다.</p><div class="pv-hero-actions"><button class="pv-btn primary" data-pv-menu="status-shipping">출고 현황 보기 <span>→</span></button><button class="pv-btn" data-pv-menu="schedule-main">오늘 일정 보기</button></div></div>'+
        '<div class="pv-hero-visual">'+warehouseSvg()+'<div class="pv-live-card"><div class="pv-live-top"><span class="pv-live-title">운영 대시보드</span><span class="pv-live-state"><i class="pv-live-dot"></i>LIVE VIEW</span></div><div class="pv-live-date" data-pv="date">-</div></div></div>'+
      '</div></section>'+
      '<section class="pv-kpis">'+
        '<article class="pv-kpi primary"><div class="pv-kpi-head"><span class="pv-kpi-label">오늘 입고</span><span class="pv-kpi-icon">◫</span></div><div class="pv-kpi-value"><strong data-pv="pallet">0</strong><small data-pv="pallet-unit">팔렛</small></div><div class="pv-kpi-foot">금일 입고 예정 기준</div></article>'+
        '<article class="pv-kpi"><div class="pv-kpi-head"><span class="pv-kpi-label">미처리 출고 요청</span><span class="pv-kpi-icon">↗</span></div><div class="pv-kpi-value"><strong data-pv="request">0</strong><small>건</small></div><div class="pv-kpi-foot warn">처리 필요 항목</div></article>'+
        '<article class="pv-kpi"><div class="pv-kpi-head"><span class="pv-kpi-label">제품 확보 요청</span><span class="pv-kpi-icon">◇</span></div><div class="pv-kpi-value"><strong data-pv="todo">0</strong><small>건</small></div><div class="pv-kpi-foot">현재 등록 기준</div></article>'+
        '<article class="pv-kpi"><div class="pv-kpi-head"><span class="pv-kpi-label">TODAY STAFF</span><span class="pv-kpi-icon">○</span></div><div class="pv-kpi-value"><strong data-pv="staff">-</strong><small>명</small></div><div class="pv-kpi-foot good">금일 운영 인원</div></article>'+
      '</section>'+
      '<section class="pv-ops-grid">'+
        '<article class="pv-panel"><div class="pv-panel-head"><div><h3>출고 요청 현황</h3><p>현재 미처리 요청의 구성</p></div><button class="pv-link-btn" data-pv-menu="out-request">요청 관리 →</button></div><div class="pv-request-body"><div class="pv-request-summary">'+
          '<div class="pv-request-item"><b>대량 주문</b><div class="pv-request-num"><strong data-pv-req="bulk">0</strong><small>건</small></div><div class="pv-bar"><i data-pv-bar="bulk"></i></div></div>'+
          '<div class="pv-request-item"><b>트래픽</b><div class="pv-request-num"><strong data-pv-req="traffic">0</strong><small>건</small></div><div class="pv-bar"><i data-pv-bar="traffic"></i></div></div>'+
          '<div class="pv-request-item"><b>본사</b><div class="pv-request-num"><strong data-pv-req="hq">0</strong><small>건</small></div><div class="pv-bar"><i data-pv-bar="hq"></i></div></div>'+
          '<div class="pv-request-item"><b>노즐 / 비닐</b><div class="pv-request-num"><strong data-pv-req="nozzle">0</strong><small>건</small></div><div class="pv-bar"><i data-pv-bar="nozzle"></i></div></div>'+
        '</div></div></article>'+
        '<article class="pv-panel"><div class="pv-panel-head"><div><h3>운영 알림</h3><p>공지와 제품 확보</p></div><button class="pv-link-btn" data-pv-menu="schedule-main">일정 보기 →</button></div><div class="pv-notice-list"><div class="pv-notice"><span class="pv-notice-tag">NOTICE</span><b data-pv="notice-title">등록된 공지가 없습니다.</b><p data-pv="notice-text">최근 공지 내용을 표시합니다.</p></div><div class="pv-notice"><span class="pv-notice-tag">PRODUCT</span><b>제품 확보 요청 <span data-pv="todo-inline">0</span>건</b><p data-pv="todo-text">현재 제품 확보 등록 현황을 확인하세요.</p></div></div></article>'+
      '</section>'+
      '<div class="pv-actions-title"><div><h3>빠른 업무</h3><p>이미지를 눌러 자주 사용하는 업무로 바로 이동합니다.</p></div></div>'+
      '<section class="pv-action-grid">'+
        '<button class="pv-action" data-pv-menu="status-shipping"><span class="pv-action-art">'+actionArt('outbound')+'</span><span class="pv-action-copy"><b>출고 현황</b><span>실시간 출고 진행률과 매장 상태를 확인합니다.</span></span><i class="pv-action-arrow">→</i></button>'+
        '<button class="pv-action light" data-pv-menu="in-basic"><span class="pv-action-art">'+actionArt('inbound')+'</span><span class="pv-action-copy"><b>입고 현황</b><span>입고 데이터와 검수 흐름을 빠르게 확인합니다.</span></span><i class="pv-action-arrow">→</i></button>'+
        '<button class="pv-action light" data-pv-menu="inv-total"><span class="pv-action-art">'+actionArt('inventory')+'</span><span class="pv-action-copy"><b>재고 현황</b><span>현재 재고와 품목 현황을 조회합니다.</span></span><i class="pv-action-arrow">→</i></button>'+
        '<button class="pv-action report" data-pv-menu="status-outbound-analysis"><span class="pv-report-bars"><i></i><i></i><i></i></span><span class="pv-action-copy"><b>출고 분석</b><span>매장·제품 기준의 핵심 흐름을 분석합니다.</span></span><i class="pv-action-arrow">→</i></button>'+
      '</section>'+
      '<section class="pv-context"><div class="pv-context-card"><span>최근 주요 공지</span><b data-pv="context-notice">등록된 주요 공지사항이 없습니다.</b></div><div class="pv-context-card"><span>이번 달 입고 수량</span><b class="pv-context-metric"><span data-pv="monthly-in">0</span> <small>EA</small></b></div><div class="pv-context-card"><span>이번 달 출고 수량</span><b class="pv-context-metric"><span data-pv="monthly-out">0</span> <small>EA</small></b></div></section>'+
    '</div>';
  }

  function ensureMain(){
    var dashboard=document.getElementById('dashboard');
    if(!dashboard)return null;
    var preview=document.getElementById('designPreviewDashboard');
    if(!preview){
      dashboard.insertAdjacentHTML('beforeend',mainMarkup());
      preview=document.getElementById('designPreviewDashboard');
      preview.querySelectorAll('[data-pv-menu]').forEach(function(el){
        el.addEventListener('click',function(){menuClick(el.getAttribute('data-pv-menu'));});
      });
    }
    return preview;
  }

  function setPreviewText(key,value){
    var preview=document.getElementById('designPreviewDashboard');
    if(!preview)return;
    preview.querySelectorAll('[data-pv="'+key+'"]').forEach(function(el){el.textContent=value;});
  }

  function syncMain(){
    var preview=ensureMain();
    if(!preview)return;

    setPreviewText('date',textOf('heroDate','오늘'));
    setPreviewText('pallet',textOf('heroPallet','0'));
    setPreviewText('pallet-unit',textOf('heroPalletUnit','팔렛'));
    setPreviewText('request',textOf('heroReq','0'));
    setPreviewText('todo',textOf('heroTodo','0'));
    setPreviewText('todo-inline',textOf('heroTodo','0'));
    setPreviewText('staff',textOf('heroStaff','-'));
    setPreviewText('notice-title',shortText(textOf('dashNoticeTitle','등록된 주요 공지가 없습니다.'),64));
    setPreviewText('notice-text',shortText(textOf('dashNoticeText','최근 공지 내용을 표시합니다.'),88));
    setPreviewText('context-notice',shortText(textOf('dashNoticeTitle','등록된 주요 공지사항이 없습니다.'),72));
    setPreviewText('monthly-in',textOf('fileInboundQty','0'));
    setPreviewText('monthly-out',textOf('fileOutboundQty','0'));

    var todo=document.getElementById('dashTodoList');
    var todoText=todo ? shortText(todo.textContent,90) : '현재 제품 확보 등록 현황을 확인하세요.';
    if(!todoText || /등록된 제품 확보 건이 없습니다/.test(todoText))todoText='현재 제품 확보 등록 현황을 확인하세요.';
    setPreviewText('todo-text',todoText);

    var types=['bulk','traffic','hq','nozzle'];
    var counts={}; var max=1;
    types.forEach(function(type){
      var src=document.querySelector('[data-request-count="'+type+'"]');
      var n=numberFrom(src ? src.textContent : 0);
      counts[type]=n;if(n>max)max=n;
    });
    types.forEach(function(type){
      var countEl=preview.querySelector('[data-pv-req="'+type+'"]');
      var bar=preview.querySelector('[data-pv-bar="'+type+'"]');
      if(countEl)countEl.textContent=counts[type];
      if(bar)bar.style.width=(counts[type] ? Math.max(10,Math.round(counts[type]/max*100)) : 0)+'%';
    });
  }

  function statusMarkup(){
    return '<div id="designPreviewStatusHeader"><div class="pv-status-head"><div class="pv-status-title"><div class="pv-kicker">OPERATIONS STATUS BOARD</div><h2>현황판</h2><p><span data-pvs="tab">출고 현황</span> · <span data-pvs="date">-</span> <span data-pvs="time"></span></p></div><div class="pv-status-kpis"><div class="pv-status-kpi"><span>출고 진행률</span><b data-pvs="pct">0%</b></div><div class="pv-status-kpi"><span>오늘 주문 매장</span><b><span data-pvs="stores">0</span>개</b></div><div class="pv-status-kpi"><span>잔여 물량</span><b><span data-pvs="remain">0</span> EA</b></div><div class="pv-status-kpi"><span>예상 완료</span><b data-pvs="eta">--:--</b></div></div></div></div>';
  }
  function ensureStatus(){
    var shell=document.querySelector('#statusBoardView .status-board-shell');
    if(!shell)return null;
    var header=document.getElementById('designPreviewStatusHeader');
    if(!header){
      shell.insertAdjacentHTML('afterbegin',statusMarkup());
      header=document.getElementById('designPreviewStatusHeader');
    }
    return header;
  }
  function syncStatus(){
    var header=ensureStatus();if(!header)return;
    function set(key,val){var el=header.querySelector('[data-pvs="'+key+'"]');if(el)el.textContent=val;}
    var tab=document.querySelector('#statusBoardView .status-board-tab.active');
    set('tab',tab ? tab.textContent.trim() : '현황판');
    set('date',textOf('statusCurrentDate','-'));
    set('time',textOf('statusCurrentTime',''));
    set('pct',textOf('statusShippingPct','0%'));
    set('stores',textOf('statusStoreCount','0'));
    set('remain',textOf('statusShipQtyRemain','0'));
    set('eta',textOf('statusEta','--:--'));
  }

  function apply(){
    var on=enabled();
    var id=activeView();
    var home=on && id==='dashboard';
    var status=on && id==='statusBoardView';
    document.body.classList.toggle('design-preview-enabled',on);
    document.body.classList.toggle('design-preview-scope',home||status);
    document.body.classList.toggle('design-preview-home',home);
    document.body.classList.toggle('design-preview-status',status);
    button.classList.toggle('is-on',on);
    button.setAttribute('aria-pressed',on?'true':'false');
    if(stateLabel)stateLabel.textContent=on?'ON':'OFF';
    button.title=on?'디자인 미리보기 ON · 메인과 현황판에 적용 중':'디자인 미리보기 OFF · 클릭하면 메인과 현황판에 적용';
    if(home)syncMain();
    if(status)syncStatus();
  }

  button.addEventListener('click',function(){
    var next=!enabled();
    try{localStorage.setItem(STORAGE_KEY,next?'on':'off');}catch(e){}
    apply();
  });

  document.addEventListener('click',function(e){
    if(!enabled())return;
    if(e.target.closest && e.target.closest('#statusBoardView .status-board-tab')){
      window.setTimeout(syncStatus,0);
    }
  });

  var viewObserver=new MutationObserver(function(){
    var id=activeView();
    if(id===lastActiveId)return;
    lastActiveId=id;
    apply();
  });
  document.querySelectorAll('.view').forEach(function(view){
    viewObserver.observe(view,{attributes:true,attributeFilter:['class']});
  });

  var dashboard=document.getElementById('dashboard');
  if(dashboard){
    dataObserver=new MutationObserver(function(mutations){
      if(!enabled())return;
      var external=mutations.some(function(m){
        var t=m.target && (m.target.nodeType===1 ? m.target : m.target.parentElement);
        return !t || !t.closest || !t.closest('#designPreviewDashboard');
      });
      if(external && activeView()==='dashboard')syncMain();
    });
    dataObserver.observe(dashboard,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
  }
  var statusView=document.getElementById('statusBoardView');
  if(statusView){
    var statusObserver=new MutationObserver(function(mutations){
      if(!enabled() || activeView()!=='statusBoardView')return;
      var external=mutations.some(function(m){
        var t=m.target && (m.target.nodeType===1 ? m.target : m.target.parentElement);
        return !t || !t.closest || !t.closest('#designPreviewStatusHeader');
      });
      if(external)syncStatus();
    });
    statusObserver.observe(statusView,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY)apply();});
  lastActiveId=activeView();
  ensureMain();
  ensureStatus();
  apply();
})();