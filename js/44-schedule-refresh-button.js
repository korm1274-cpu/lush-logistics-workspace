/* 스케줄 새로고침 버튼: ↻ 글자 대신 아이콘, 불러오는 동안 회전, 끝나면 잠깐 초록 표시 */
(function(){
  var ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  var BTNS=[['dashRefreshImportScheduleBtn',''],['refreshImportScheduleBtn','<span>새로고침</span>']];
  var STATUS=['dashboardCalendarSync','calendarSyncStatus'];
  var spinStart=0,doneTimer=null;
  function each(fn){BTNS.forEach(function(b){var el=document.getElementById(b[0]);if(el)fn(el,b[1])})}
  function loading(){return STATUS.some(function(id){var el=document.getElementById(id);return el&&/불러오는 중/.test(el.textContent)})}
  function finish(){
    var wait=Math.max(0,700-(Date.now()-spinStart));
    setTimeout(function(){
      each(function(el){el.classList.remove('sr-spin');el.classList.add('sr-done')});
      clearTimeout(doneTimer);doneTimer=setTimeout(function(){each(function(el){el.classList.remove('sr-done')})},1200);
    },wait);
  }
  function init(){
    each(function(el,label){
      el.innerHTML=ICON+label;
      el.setAttribute('aria-label','일정 새로고침');el.title='일정 새로고침';
      // 기존 onclick(일정 불러오기)은 그대로 두고, 회전 표시만 추가
      el.addEventListener('click',function(){spinStart=Date.now();each(function(b){b.classList.remove('sr-done');b.classList.add('sr-spin')});setTimeout(function(){if(!loading())finish()},50)},true);
    });
    STATUS.forEach(function(id){
      var el=document.getElementById(id);
      if(el&&window.MutationObserver)new MutationObserver(function(){if(!loading()&&document.querySelector('.sr-spin'))finish()}).observe(el,{childList:true,characterData:true,subtree:true});
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
