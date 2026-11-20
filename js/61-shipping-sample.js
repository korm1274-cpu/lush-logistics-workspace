/* 현황판 > 출고 현황 샘플 (data-status-panel="shippingsample")
   - 가로 모니터에서 잘 보이는지 확인하는 디자인 시안 화면. 기존 '출고 현황'(js/17)은 그대로 두고 따로 그림
   - 데이터: 아래 데모 값만 사용(서버·실데이터를 읽지 않음)
   - 매장 한 줄 = 굵은 진행 막대, 매장명·진행률을 막대 안에 크게 / 완료는 초록, 대기는 회색, 완료 매장은 맨 아래 */
(function(){
  var panel=document.querySelector('[data-status-panel="shippingsample"]');if(!panel)return;
  var $=function(id){return document.getElementById(id)};
  var fmt=function(n){return Number(n||0).toLocaleString('ko-KR')};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var DEMO={qty:68400,goal:100000,eta:'16:40'};
  var STORES=[
    {name:'강남역점',total:9000,done:9000},{name:'홍대점',total:8000,done:7600},{name:'명동점',total:7500,done:6500},
    {name:'잠실점',total:7200,done:6100},{name:'여의도점',total:7000,done:5600},{name:'대학로점',total:6800,done:5000},
    {name:'신촌점',total:6500,done:4500},{name:'건대점',total:6400,done:4200},{name:'영등포점',total:6200,done:3900},
    {name:'가로수길점',total:6100,done:3500},{name:'수원점',total:6000,done:3200},{name:'판교점',total:5900,done:2800},
    {name:'부산점',total:5800,done:2400},{name:'대전점',total:5700,done:2000},{name:'인천점',total:5900,done:0}
  ];
  function render(){
    var rows=STORES.map(function(s,i){var pct=s.total?Math.min(100,s.done/s.total*100):0;return{name:s.name,total:s.total,done:s.done,pct:pct,i:i,state:pct>=100?'done':pct<=0?'wait':'run'}});
    // 진행 중 → 대기 → 완료 순, 같은 상태 안에서는 원래 순서
    var rank={run:0,wait:1,done:2};
    rows.sort(function(a,b){return rank[a.state]-rank[b.state]||a.i-b.i});
    var cnt={run:0,wait:0,done:0};rows.forEach(function(r){cnt[r.state]++});
    $('ssStoreCount').textContent=fmt(rows.length);
    $('ssLegend').innerHTML='<span class="run">진행 '+cnt.run+'</span><span class="wait">대기 '+cnt.wait+'</span><span class="done">완료 '+cnt.done+'</span>';
    $('ssStoreList').innerHTML=rows.map(function(r){
      var right=r.state==='done'?'완료 ✓':r.state==='wait'?'대기':Math.round(r.pct)+'%';
      return '<div class="ss-row '+r.state+'"><span class="ss-fill" style="width:'+(r.state==='done'?100:r.pct.toFixed(1))+'%"></span>'+
        '<span class="ss-name">'+esc(r.name)+'</span>'+
        '<span class="ss-qty">'+fmt(r.done)+' / '+fmt(r.total)+'</span>'+
        '<span class="ss-pct">'+right+'</span></div>';
    }).join('');
    var pct=DEMO.goal?Math.min(100,DEMO.qty/DEMO.goal*100):0;
    $('ssRing').style.setProperty('--p',pct.toFixed(1));
    $('ssPct').textContent=Math.round(pct)+'%';
    $('ssRemain').textContent=fmt(Math.max(0,DEMO.goal-DEMO.qty));
    $('ssGoal').textContent=fmt(DEMO.goal);
    $('ssEta').textContent=DEMO.eta;
    clock();
  }
  function clock(){
    var n=new Date(),w=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    $('ssDate').textContent=n.getFullYear()+'년 '+(n.getMonth()+1)+'월 '+n.getDate()+'일 '+w[n.getDay()];
    $('ssTime').textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  }
  setInterval(function(){if(panel.classList.contains('active'))clock()},30000);
  // 전체화면
  var board=$('ssBoard'),btn=$('ssFullBtn');
  function isFull(){return document.fullscreenElement===board||document.webkitFullscreenElement===board}
  function syncBtn(){btn.textContent=isFull()?'× 전체화면 종료':'⛶ 전체화면'}
  btn.addEventListener('click',function(){
    if(isFull()){var x=document.exitFullscreen||document.webkitExitFullscreen;if(x)x.call(document);return}
    var r=board.requestFullscreen||board.webkitRequestFullscreen;if(r){var p=r.call(board);if(p&&p.catch)p.catch(function(){})}
  });
  document.addEventListener('fullscreenchange',syncBtn);document.addEventListener('webkitfullscreenchange',syncBtn);
  // 탭을 열 때(탭 전환·새로고침 후 복원 모두 탭 버튼 클릭으로 들어옴) 그림
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-status-tab="shippingsample"]');if(b)setTimeout(render,0)});
  render();
})();
