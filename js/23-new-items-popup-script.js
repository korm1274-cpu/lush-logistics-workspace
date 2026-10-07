/* <script id="new-items-popup-script"> (index.html에서 그대로 옮김) */
/* 새 공지·제품 확보 건 팝업: 이 기기에서 아직 확인하지 않은 항목이 있으면 화면을 처음 열 때 한 번 보여 줌 */
(function(){
  var SEEN_KEY='lush_popup_seen_v1',NOTICE='lush-v51-notices',TODO='lush-v51-todos';
  function read(k){try{var a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
  function readSeen(){try{return JSON.parse(localStorage.getItem(SEEN_KEY)||'null')}catch(e){return null}}
  function ids(){return read(NOTICE).map(function(x){return 'n:'+x.id}).concat(read(TODO).map(function(x){return 't:'+x.id}))}
  function saveSeen(list){try{var cur=ids(),set={};list.forEach(function(i){set[i]=1});localStorage.setItem(SEEN_KEY,JSON.stringify({ids:cur.filter(function(i){return set[i]})}))}catch(e){}}
  function addSeen(more){var s=readSeen();saveSeen(((s&&s.ids)||[]).concat(more))}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  var shown=false,startedAt=Date.now();
  function check(){
    if(shown)return;
    var s=readSeen();
    /* 처음 쓰는 기기: 서버 동기화를 기다린 뒤 기존 항목은 모두 확인한 것으로 처리 */
    if(!s){var wait=6000-(Date.now()-startedAt);if(wait>0){setTimeout(check,wait);return}saveSeen(ids());return}
    var seen={};(s.ids||[]).forEach(function(i){seen[i]=1});
    var ns=read(NOTICE).filter(function(x){return !seen['n:'+x.id]});
    var ts=read(TODO).filter(function(x){return !seen['t:'+x.id]&&!x.done});
    if(!ns.length&&!ts.length)return;
    var html='';
    if(ns.length)html+='<div class="nip-sec"><b>📢 새 공지 '+ns.length+'건</b>'+ns.map(function(x){return '<div class="nip-item">'+esc(x.title)+(x.author?'<small>'+esc(x.author)+'</small>':'')+'</div>'}).join('')+'</div>';
    if(ts.length)html+='<div class="nip-sec"><b>📦 새 제품 확보 '+ts.length+'건</b>'+ts.map(function(x){var sub=[x.inDate?'입고요청 '+x.inDate:'',x.note||''].filter(Boolean).join('\n');return '<div class="nip-item">'+esc(x.content)+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'}).join('')+'</div>';
    document.getElementById('nipBody').innerHTML=html;
    document.getElementById('newItemsPopup').hidden=false;shown=true;
  }
  /* 닫기: 이번 화면에서만 닫고, 다음에 화면을 열면 다시 보여 줌 */
  document.getElementById('nipClose').addEventListener('click',function(){document.getElementById('newItemsPopup').hidden=true});
  /* 더 이상 보지 않음: 지금 보여 준 항목을 확인한 것으로 기억 */
  document.getElementById('nipOk').addEventListener('click',function(){addSeen(ids());document.getElementById('newItemsPopup').hidden=true});
  /* 이 기기에서 직접 등록한 항목은 팝업에 띄우지 않음 */
  document.addEventListener('click',function(e){
    if(!(e.target.closest&&e.target.closest('#noticeMgrAdd,#todoMgrAdd')))return;
    var before={};ids().forEach(function(i){before[i]=1});
    setTimeout(function(){var s=readSeen();if(s)addSeen(ids().filter(function(i){return !before[i]}))},0);
  },true);
  /* 서버 동기화가 끝난 뒤 확인(처음 연 뒤 15초 안의 동기화까지만) */
  document.addEventListener('team-data-updated',function(){if(Date.now()-startedAt<15000)check()});
  setTimeout(check,2500);
})();

