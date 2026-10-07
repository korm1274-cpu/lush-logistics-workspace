/* <script id="floor-dash"> (index.html에서 그대로 옮김) */
/* 현장 대시보드: 메인 배너와 같은 오늘의 숫자(getTodayOpsStats) + 금주 출고 요청 종류별 건수.
   현장 모니터에 하루 종일 띄워두는 용도라, 이 화면이 열려 있는 동안 스스로 갱신함
   (숫자 30초, 팀 공유 데이터 1분, 캘린더 10분마다) */
(function(){
  var $=function(id){return document.getElementById(id)};
  var isOpen=function(){return!!document.querySelector('#floorDashView.active')};
  function render(){
    if(!$('floorPallet')||!window.getTodayOpsStats)return;
    var s=window.getTodayOpsStats();
    $('floorPallet').textContent=window.formatPalletCount(s);
    $('floorPalletUnit').textContent='팔렛'+(s.boxes?' + '+s.boxes+'박스':'');
    $('floorInboundTile').title=window.inboundEventsTitle(s);
    $('floorTodo').textContent=s.todo;$('floorStaff').textContent=s.staff;
    var md=function(d){return(+d.slice(5,7))+'/'+(+d.slice(8,10))};
    $('floorWeek').textContent='(미처리)';
    Object.keys(s.byType).forEach(function(t){var v=s.byType[t],b=document.querySelector('[data-floor-type="'+t+'"]'),p=document.querySelector('[data-floor-pending="'+t+'"]');if(b)b.textContent=v.total;if(p){p.textContent=!v.total?'모두 처리 완료':v.late?'지연 '+v.late+'건':v.today?'오늘 '+v.today+'건':'처리 대기';p.classList.toggle('alert',v.late>0)}});
    $('floorUpdated').textContent='마지막 갱신 '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  }
  function tick(){
    if(!$('floorClock')||!isOpen())return;
    var now=new Date();
    $('floorClock').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
    $('floorDate').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);
  }
  window.renderFloorDash=function(){if(isOpen())render()};
  setInterval(tick,1000);
  setInterval(function(){if(isOpen())render()},30000);
  setInterval(function(){if(isOpen()){window.pullTeamData&&window.pullTeamData(true);setTimeout(render,3000)}},60000);
  // 캘린더(입고 일정)는 메인 스케줄의 새로고침 버튼과 같은 경로로 다시 불러옴
  setInterval(function(){if(isOpen()){var b=$('dashRefreshImportScheduleBtn');if(b)b.click()}},600000);
  document.addEventListener('DOMContentLoaded',function(){
    var fb=$('floorFullBtn');
    if(fb)fb.addEventListener('click',function(){var el=$('floorBoard');if(document.fullscreenElement){document.exitFullscreen&&document.exitFullscreen()}else if(el&&el.requestFullscreen){el.requestFullscreen().catch(function(){})}});
    document.addEventListener('fullscreenchange',function(){if(fb)fb.textContent=document.fullscreenElement?'✕ 전체 화면 끝내기':'⛶ 전체 화면'});
  });
  // 메뉴로 이 화면을 열 때 즉시 그리기
  var mo=new MutationObserver(function(){if(isOpen()){tick();render()}});
  document.addEventListener('DOMContentLoaded',function(){var v=$('floorDashView');if(v)mo.observe(v,{attributes:true,attributeFilter:['class']})});
})();

