/* <script id="shared-size-card"> (index.html에서 그대로 옮김) */
/* 데이터 업로드 화면: 팀 공유 데이터 용량(서버가 한 번에 주고받을 수 있는 한도 약 4.5MB 대비) 표시 */
(function(){
  var LIMIT=4.5*1024*1024,NAMES={outbound:'출고',inbound:'입고',misship:'오출고',damage:'파손',box:'출고박스',outboundMonthlySummary:'출고 월요약',inboundMonthlySummary:'입고 월요약'};
  function bytes(v){try{return new Blob([JSON.stringify(v)]).size}catch(e){return 0}}
  function fmt(b){return b>=1048576?(b/1048576).toFixed(2)+'MB':Math.round(b/1024)+'KB'}
  function render(){
    var host=document.getElementById('upload');if(!host||!window.FILE_DATA_ENGINE)return;
    var d=window.FILE_DATA_ENGINE.getData()||{},shared={};Object.keys(d).forEach(function(k){if(k!=='priceList')shared[k]=d[k]});
    /* 출고를 달별로 따로 저장하는 중이면, 한도에 걸리는 '한 덩어리'에서는 출고를 빼고 계산 */
    var split=window.LUSH_OUTBOUND_STORE&&window.LUSH_OUTBOUND_STORE.active(),blob={};Object.keys(shared).forEach(function(k){if(!(split&&k==='outbound'))blob[k]=shared[k]});
    var total=bytes(blob),pct=Math.round(total/LIMIT*100);
    var card=document.getElementById('sharedSizeCard');
    if(!card){card=document.createElement('div');card.id='sharedSizeCard';var head=host.querySelector('.lush-page-head');(head&&head.nextSibling)?host.insertBefore(card,head.nextSibling):host.insertBefore(card,host.firstChild)}
    card.className=pct>=85?'danger':pct>=65?'warn':'';
    var rows=Object.keys(shared).map(function(k){return[k,bytes(shared[k]),shared[k]&&shared[k].rows?shared[k].rows.length:null]}).sort(function(a,b){return b[1]-a[1]});
    card.innerHTML='<div class="ss-head"><b>팀 공유 데이터 용량</b><span>'+fmt(total)+' / 4.5MB ('+pct+'%)</span></div>'+
      '<div class="ss-bar"><i style="width:'+Math.min(100,pct)+'%"></i></div>'+
      '<div class="ss-note">'+(split?'출고는 달별로 따로 저장되어 한도에 포함되지 않습니다. 나머지 공유 데이터가 약 4.5MB를 넘으면 불러오기·저장이 실패할 수 있습니다.':'공유 데이터는 한 번에 주고받아서 약 4.5MB를 넘으면 불러오기·저장이 실패할 수 있습니다.')+' 65% 이상 노랑, 85% 이상 빨강.</div>'+
      '<div class="ss-list">'+rows.map(function(r){return '<div><span>'+(NAMES[r[0]]||r[0])+(r[2]!=null?'<small>'+r[2].toLocaleString('ko-KR')+'줄</small>':'')+(split&&r[0]==='outbound'?'<em>달별 저장</em>':'')+'</span><b>'+fmt(r[1])+'</b></div>'}).join('')+'</div>';
  }
  document.addEventListener('team-data-updated',function(){setTimeout(render,300)});
  if(window.MutationObserver){var up=document.getElementById('upload');if(up)new MutationObserver(function(){if(up.classList.contains('active'))render()}).observe(up,{attributes:true,attributeFilter:['class']})}
  window.addEventListener('load',function(){setTimeout(render,2500)});
})();

