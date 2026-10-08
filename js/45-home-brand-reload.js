/* 왼쪽 위 LUSH 로고: 누르면 메인 화면으로 가면서 페이지를 새로고침(최신 데이터로 다시 불러오기).
   - 새로고침 후 '보던 화면 유지' 기능이 다른 메뉴를 다시 열지 않도록 마지막 화면을 메인으로 기억시킴
   - 방금 저장한 내용이 서버로 올라가는 중이면(약 1초) 끝날 때까지 잠깐 기다렸다가 새로고침 */
(function(){
  var LAST_MENU_KEY='lush_last_menu_v1',LAST_SAVE_KEY='__team_data_last_local_save__';
  function recentSaveAge(){try{var t=Number(sessionStorage.getItem(LAST_SAVE_KEY)||0);return t?Date.now()-t:Infinity}catch(e){return Infinity}}
  function goHomeAndReload(e){
    if(e){e.preventDefault();e.stopPropagation();}
    try{sessionStorage.setItem(LAST_MENU_KEY,'__dashboard')}catch(err){}
    try{localStorage.setItem('lush_active_menu_v1','dashboard-main')}catch(err){} /* 왼쪽 메뉴가 기억하는 마지막 메뉴도 메인으로 */
    var start=Date.now();
    (function wait(){
      if(recentSaveAge()<1500&&Date.now()-start<4000){setTimeout(wait,250);return}
      try{window.scrollTo(0,0)}catch(err){}
      location.reload();
    })();
  }
  function init(){
    var brand=document.getElementById('homeBrand');if(!brand)return;
    brand.onclick=null;
    brand.addEventListener('click',goHomeAndReload);
    brand.style.cursor='pointer';
    var logo=brand.querySelector('.logo');if(logo){logo.title='메인으로 이동 · 새로고침';logo.setAttribute('aria-label','메인으로 이동하고 새로고침');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
