/* <script id="lush-hero"> (index.html에서 그대로 옮김) */
/* 메인 인사 배너(물류팀 공용) + 현장 대시보드: 오늘의 숫자는 getTodayOpsStats() 하나로 계산해 두 화면이 같은 값을 보여줌 */
(function(){
  var $=function(id){return document.getElementById(id)};
  function readArr(k){try{var a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
  function ymd(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  // 금주 = 일요일~토요일 (메인 '금주 출고 요청'과 같은 기준)
  function weekRangeKST(){var t=ymd(new Date()),p=t.split('-').map(Number),base=new Date(Date.UTC(p[0],p[1]-1,p[2])),dow=base.getUTCDay(),s=new Date(base);s.setUTCDate(base.getUTCDate()-dow);var e=new Date(s);e.setUTCDate(s.getUTCDate()+6);var f=function(d){return d.toISOString().slice(0,10)};return{start:f(s),end:f(e)}}
  function stats(){
    var today=ymd(new Date()),reqs=readArr('lush_outbound_requests_v1'),isDone=function(r){return r.status==='처리완료'||r.status==='완료'};
    var req=reqs.filter(function(r){return!isDone(r)&&(r.requestDates||[]).indexOf(today)>=0}).length;
    // 미처리 출고 요청 전체(요청일자 무관) — 메인 배너 '출고 요청' 카드
    var pendingAll=reqs.filter(function(r){return r&&!isDone(r)}).length;
    var todo=readArr('lush-v51-todos').filter(function(t){return!t.done}).length;
    // 오늘 입고 팔렛: 캘린더 일정 중 오늘 날짜 + 제목에 '입고'가 있는 것(예: "132차-JP-1팔렛-9시 입고")의 팔렛 수 합계.
    // '입항'(항구 도착)은 제외. 박스만 있는 입고는 팔렛에 넣지 않고 박스로 따로 표시
    var ev=(window.getImportEvents?window.getImportEvents():[]).filter(function(e){return today>=(e.startDate||'')&&today<=(e.endDate||e.startDate||'')&&/입고/.test(e.title||'')});
    var pallets=0,boxes=0;
    ev.forEach(function(e){var t=e.title||'',m,re=/(\d+(?:\.\d+)?)\s*(?:팔렛|파렛|PLT)/gi;while((m=re.exec(t)))pallets+=parseFloat(m[1]);var b=/(\d+)\s*박스/g;while((m=b.exec(t)))boxes+=parseInt(m[1],10)});
    var staffEl=$('todayOperatingCount');
    var wk=weekRangeKST(),byType={};
    /* 메인 '출고 요청'과 같은 기준: 요청일과 상관없이 미처리 전체. 지연(요청일이 모두 지남)·오늘 요청 건수도 함께 */
    ['bulk','traffic','hq','nozzle'].forEach(function(type){var rows=reqs.filter(function(r){return r&&r.type===type&&!isDone(r)});byType[type]={total:rows.length,late:rows.filter(function(r){var ds=(r.requestDates||[]).slice().sort();return ds.length&&ds[ds.length-1]<today}).length,today:rows.filter(function(r){return(r.requestDates||[]).indexOf(today)>=0}).length}});
    return{today:today,req:req,pendingAll:pendingAll,todo:todo,pallets:pallets,boxes:boxes,inboundEvents:ev,staff:staffEl?staffEl.textContent.trim():'-',week:wk,byType:byType};
  }
  window.getTodayOpsStats=stats;
  function fmtPallet(s){return Number.isInteger(s.pallets)?s.pallets:s.pallets.toFixed(1)}
  window.formatPalletCount=fmtPallet;
  function inboundTitle(s){return s.inboundEvents.length?'오늘 입고 '+s.inboundEvents.length+'건\n'+s.inboundEvents.map(function(e){return'· '+e.title.trim()}).join('\n'):'오늘 캘린더에 입고 일정이 없습니다.'}
  window.inboundEventsTitle=inboundTitle;
  function update(){
    if(!$('heroDate'))return;
    $('heroDate').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());
    var s=stats();
    $('heroReq').textContent=s.pendingAll;$('heroTodo').textContent=s.todo;
    $('heroPallet').textContent=fmtPallet(s);
    $('heroPalletUnit').textContent='팔렛'+(s.boxes?' + '+s.boxes+'박스':'');
    $('heroInboundCard').title=inboundTitle(s);
    $('heroStaff').textContent=s.staff;
    window.renderFloorDash?.();
  }
  window.updateLushHero=update;
  update();
  // 공지·할 일·출고 요청은 팀 동기화로 수시로 바뀌므로 주기적으로 다시 계산
  setInterval(function(){if(!document.hidden&&document.querySelector('#dashboard.active'))update()},30000);
})();

