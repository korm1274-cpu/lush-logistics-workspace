/* <script id="notice-reqtab-script"> (index.html에서 그대로 옮김) */
(function(){
  var $=function(id){return document.getElementById(id)};
  /* 공지 누르면 제목 전체 보기 / 다시 누르면 접기 */
  document.addEventListener('click',function(e){
    var n=e.target.closest&&e.target.closest('#dashboard .notice-board .notice-main');
    if(n){n.classList.toggle('n-open');return}
    var b=e.target.closest&&e.target.closest('#reqMobileTabs [data-req-tab]');
    if(!b)return;
    var t=b.getAttribute('data-req-tab'),on=!b.classList.contains('on');
    document.querySelectorAll('#reqMobileTabs [data-req-tab]').forEach(function(x){x.classList.toggle('on',on&&x===b)});
    document.querySelectorAll('#todayRequestGrid .request-mini-card').forEach(function(c){c.classList.toggle('m-show',on&&c.getAttribute('data-request-type')===t)});
  });
  /* 탭에 종류별 건수 표시 */
  function syncCounts(){
    document.querySelectorAll('#reqMobileTabs [data-req-tab-count]').forEach(function(em){
      var badge=document.querySelector('#todayRequestGrid [data-request-count="'+em.getAttribute('data-req-tab-count')+'"]');
      var n=badge?parseInt(badge.textContent,10)||0:0;em.textContent=n?String(n):'';
    });
  }
  var grid=$('todayRequestGrid');
  if(grid&&window.MutationObserver)new MutationObserver(syncCounts).observe(grid,{subtree:true,childList:true,characterData:true});
  syncCounts();
})();

