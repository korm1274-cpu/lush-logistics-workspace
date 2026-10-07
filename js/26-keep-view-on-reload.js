/* <script id="keep-view-on-reload"> (index.html에서 그대로 옮김) */
/* 새로고침해도 보던 메뉴 화면 유지: 마지막으로 연 메뉴를 이 탭의 sessionStorage에 기억했다가 다시 열어 줌 */
(function(){
  var KEY='lush_last_menu_v1';
  function remember(v){try{sessionStorage.setItem(KEY,v)}catch(e){}}
  function wrap(){
    var a=window.activateMenu;
    if(typeof a==='function'&&!a.__keep){
      window.activateMenu=activateMenu=function(m){var r=a.apply(this,arguments);if(m&&m.id)remember(m.id);return r};
      window.activateMenu.__keep=true;
    }
    var s=window.showView;
    if(typeof s==='function'&&!s.__keep){
      window.showView=showView=function(id){var r=s.apply(this,arguments);if(id==='dashboard')remember('__dashboard');return r};
      window.showView.__keep=true;
    }
  }
  function restore(){
    var id;try{id=sessionStorage.getItem(KEY)}catch(e){}
    wrap();
    if(!id||id==='__dashboard')return;
    /* 현황판은 탭(출고 현황·생산성·매장별 처리이력·제품별 출고현황)까지 복원 */
    if(id.indexOf('__status:')===0){
      try{window.showView('statusBoardView')}catch(e){}
      var tb=document.querySelector('#statusBoardView .status-board-tab[data-status-tab="'+id.slice(9)+'"]');if(tb)tb.click();
      return;
    }
    var list=(typeof menus!=='undefined'&&Array.isArray(menus))?menus:[];
    var m=list.find(function(x){return x&&x.id===id});if(!m)return;
    var el=document.querySelector('#navContainer [data-menu-id="'+id+'"]');
    try{window.activateMenu(m,el||undefined)}catch(e){}
  }
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-status-tab]');if(b)setTimeout(function(){remember('__status:'+b.getAttribute('data-status-tab'))},0)});
  if(document.readyState==='complete')setTimeout(restore,0);
  else window.addEventListener('load',function(){setTimeout(restore,0)});
})();

