/* <script id="side-subnav"> (index.html에서 그대로 옮김) */
(function(){
  var shell=document.getElementById('appShell');
  if(!shell||typeof renderNav!=='function'||typeof activateMenu!=='function')return;
  var aside=document.createElement('aside');
  aside.id='sideSubNav';aside.setAttribute('aria-label','하위 메뉴');
  shell.appendChild(aside);
  var current={group:null,menuId:null};
  var ACTIVE_MENU_KEY='lush_active_menu_v1';
  var isDesktop=function(){return window.matchMedia('(min-width:901px)').matches};

  function groupItems(gid){
    var list=menus.filter(function(m){return m.group===gid&&m.visible});
    if(gid!=='admin')return list.filter(function(m){return canAccess(m)});
    return (typeof currentRole!=='undefined'&&currentRole==='admin')?list:[];
  }
  function renderAdminTabs(g){
    var settings=document.getElementById('settings');
    if(!settings||!settings.classList.contains('active'))return false;
    var tabs=settings.querySelectorAll('.admin-tabs .admin-tab');
    if(!tabs.length)return false;
    aside.innerHTML='';
    aside.appendChild(makeTitle(g));
    tabs.forEach(function(t){
      var b=document.createElement('button');
      b.type='button';
      b.className='side-subnav-item'+(t.classList.contains('active')?' active':'');
      b.textContent=t.textContent.trim();
      b.dataset.admin=t.dataset.admin||'';
      b.onclick=function(){
        t.click();
        aside.querySelectorAll('.side-subnav-item').forEach(function(x){x.classList.toggle('active',x===b)});
      };
      aside.appendChild(b);
    });
    shell.classList.add('has-side-subnav');
    markTopTab();
    if(window.lucide)lucide.createIcons();
    return true;
  }
  function makeTitle(g){
    var title=document.createElement('div');
    title.className='side-subnav-title';
    title.innerHTML='<i data-lucide="'+g.icon+'"></i>';
    title.appendChild(document.createTextNode(g.label));
    return title;
  }
  function render(){
    var items=current.group?groupItems(current.group):[];
    var g=GROUPS.find(function(x){return x.id===current.group});
    aside.innerHTML='';
    if(g&&g.id==='admin'&&renderAdminTabs(g))return;
    if(!g||items.length<2){shell.classList.remove('has-side-subnav');markTopTab();return}
    aside.appendChild(makeTitle(g));
    items.forEach(function(m){
      var b=document.createElement('button');
      b.type='button';b.className='side-subnav-item'+(m.id===current.menuId?' active':'');
      b.textContent=m.label;b.dataset.menuId=m.id;
      b.onclick=function(){activateMenu(m,b)};
      aside.appendChild(b);
    });
    shell.classList.add('has-side-subnav');
    markTopTab();
    if(window.lucide)lucide.createIcons();
  }
  function markTopTab(){
    document.querySelectorAll('#navContainer .nav-group:not(.nav-group-direct) > .nav-root').forEach(function(r){
      r.classList.toggle('active',r.parentElement.dataset.group===current.group);
    });
  }
  function patchTopTabs(){
    document.querySelectorAll('#navContainer .nav-group:not(.nav-group-direct)').forEach(function(box){
      var root=box.querySelector(':scope > .nav-root');if(!root)return;
      var original=root.onclick;
      root.onclick=function(e){
        if(!isDesktop())return original&&original.call(root,e);
        var items=groupItems(box.dataset.group);if(!items.length)return;
        var keep=current.group===box.dataset.group&&items.find(function(m){return m.id===current.menuId});
        activateMenu(keep||items[0],null);
      };
    });
    patchStatusBoardMobileMenu();
    markTopTab();
  }
  /* 휴대폰 전체 화면 메뉴: 열 때 지금 보고 있는 메뉴의 그룹을 펼치고 해당 항목을 핑크로 표시 */
  function markMobileCurrent(){
    var nav=document.getElementById('navContainer');if(!nav)return;
    nav.querySelectorAll('.nav-item.m-active').forEach(function(b){b.classList.remove('m-active')});
    nav.querySelectorAll('.nav-group.m-current').forEach(function(g){g.classList.remove('m-current')});
    if(!current.group)return;
    var box=nav.querySelector('.nav-group[data-group="'+current.group+'"]');if(!box)return;
    box.classList.add('m-current');
    var item=current.menuId&&box.querySelector('.nav-item[data-menu-id="'+current.menuId+'"]');if(item)item.classList.add('m-active');
    if(!box.classList.contains('nav-group-direct')){nav.querySelectorAll('.nav-group.open').forEach(function(g){if(g!==box){g.classList.remove('open')}});box.classList.add('open');var em=box.querySelector(':scope > .nav-root em');if(em)em.textContent='⌄'}
  }
  var mBtn=document.getElementById('desktopSidebarBtn');
  if(mBtn)mBtn.addEventListener('click',function(){setTimeout(function(){if(shell.classList.contains('mobile-nav-open')&&!isDesktop())markMobileCurrent()},0)});
  /* 휴대폰 햄버거 메뉴: '현황판' 아래에 화면 안 탭(출고 현황·생산성 등)을 넣어 바로 이동 (데스크톱은 왼쪽 메뉴가 같은 역할) */
  function patchStatusBoardMobileMenu(){/* 현황판도 일반 메뉴 항목으로 관리하므로 별도 하드코딩을 하지 않습니다. */}

  var origActivate=activateMenu;
  window.activateMenu=activateMenu=function(m,el){
    var ok=typeof canAccess!=='function'||canAccess(m);
    /* 모든 메뉴는 동일하게 마지막 선택 menuId를 저장하고 좌측 하위 메뉴를 갱신 */
    try{return origActivate.apply(this,arguments)}
    finally{
      if(ok&&m){
        current={group:m.group,menuId:m.id};
        try{localStorage.setItem(ACTIVE_MENU_KEY,m.id)}catch(e){}
        render();
      }
    }
  };
  /* 대시보드 카드 등에서 메뉴를 거치지 않고 화면을 바로 여는 경우에도 왼쪽 메뉴를 맞춰줌 */
  var origShow=showView;
  window.showView=showView=function(id){
    var r=origShow.apply(this,arguments);
    var m=menus.find(function(x){return x.kind==='view'&&x.target===id&&x.visible});
    if(m&&m.id!==current.menuId){current={group:m.group,menuId:m.id};render()}
    return r;
  };
  var origRenderNav=renderNav;
  window.renderNav=renderNav=function(){var r=origRenderNav.apply(this,arguments);patchTopTabs();render();return r};

  /* 메인 화면 테마는 메인(대시보드)을 보고 있을 때만 적용 */
  var LUSH_THEME_VIEWS=['sheetView','outboundBasicView','outboundAnalysis','outboundBoxView','inventoryTotalView','inventoryOwnerView','inventoryOosView','productivityView','upload','dataArchiveView','settings','inboundBasicView','inboundMonthlyView','inboundDailyView','inboundAnalysis','outboundRequestManager','misshipRecordsView','damageAnalyticsView','misshipAnalyticsView','damageInsightView','scheduleManagerView','noticeManagerView','todoManagerView','defectView'];
  var syncDashTheme=function(){var a=document.querySelector('.view.active');shell.classList.toggle('on-dashboard',!!a&&a.id==='dashboard');shell.classList.toggle('on-lush',!!a&&LUSH_THEME_VIEWS.indexOf(a.id)>=0);if(a&&a.id==='dashboard'&&window.updateLushHero)window.updateLushHero()};
  var origActivate2=activateMenu;
  window.activateMenu=activateMenu=function(){try{return origActivate2.apply(this,arguments)}finally{syncDashTheme()}};
  var origShow2=showView;
  window.showView=showView=function(){var r=origShow2.apply(this,arguments);syncDashTheme();return r};
  syncDashTheme();

  patchTopTabs();
  var savedMenuId='';
  try{savedMenuId=localStorage.getItem(ACTIVE_MENU_KEY)||''}catch(e){}
  var start=savedMenuId&&menus.find(function(x){return x.id===savedMenuId&&x.visible&&canAccess(x)});
  if(start){
    activateMenu(start,null);
  }else{
    var active=document.querySelector('.view.active');
    start=active&&menus.find(function(x){return x.kind==='view'&&x.target===active.id&&x.visible&&canAccess(x)});
    if(start)current={group:start.group,menuId:start.id};
    render();
  }
})();

