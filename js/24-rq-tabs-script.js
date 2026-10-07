/* <script id="rq-tabs-script"> (index.html에서 그대로 옮김) */
/* 출고 요청 관리 탭: ① 처리 대기(미처리만 종류별) ② 요청 등록 ③ 전체 기록 */
(function(){
  var KEY='lush_outbound_requests_v1',TYPES=[['bulk','대량 주문','대량'],['traffic','트래픽','트래픽'],['hq','본사 출고','본사'],['nozzle','노즐/비닐','노즐/비닐']];
  var root=document.getElementById('outboundRequestManager');if(!root)return;
  var filter='';
  function read(){try{var a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function todayKey(){var t=new Date(Date.now()+9*3600e3);return t.toISOString().slice(0,10)}
  function isDone(r){return r.status==='처리완료'||r.status==='완료'}
  function md(d){return String(d||'').slice(5).replace('-','/')}
  function showTab(t){
    root.querySelectorAll('[data-rq-tab]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-rq-tab')===t)});
    root.querySelectorAll('[data-rq-pane]').forEach(function(p){p.hidden=p.getAttribute('data-rq-pane')!==t});
    if(t==='pending')renderBoard();
    if(t==='all'&&window.refreshOutboundRequestManager)window.refreshOutboundRequestManager();
  }
  window.showRequestTab=showTab;
  function renderBoard(){
    var all=read().filter(function(r){return r&&!isDone(r)}),today=todayKey();
    var byType={};TYPES.forEach(function(t){byType[t[0]]=[]});
    all.forEach(function(r){(byType[r.type]||(byType[r.type]=[])).push(r)});
    Object.keys(byType).forEach(function(k){byType[k].sort(function(a,b){var A=(a.requestDates||[]).slice().sort()[0]||'',B=(b.requestDates||[]).slice().sort()[0]||'';return A<B?-1:A>B?1:0})});
    var c=document.getElementById('rqTabPendingCount');if(c)c.textContent=all.length?String(all.length):'';
    var sum=document.getElementById('rqPendingSummary');
    if(sum)sum.innerHTML='<button type="button" data-rq-filter="" class="'+(filter===''?'on':'')+'">전체<b>'+all.length+'</b></button>'+TYPES.map(function(t){return '<button type="button" data-rq-filter="'+t[0]+'" class="'+(filter===t[0]?'on':'')+'">'+t[2]+'<b>'+byType[t[0]].length+'</b></button>'}).join('');
    var board=document.getElementById('rqPendingBoard');if(!board)return;
    if(!all.length){board.classList.add('one');board.innerHTML='<div class="rq-cheer"><span>🛁</span><b>미처리 출고 요청이 없어요!</b><small>오늘 요청 모두 완료 · 수고하셨어요</small></div>';return}
    var shown=TYPES.filter(function(t){return !filter||filter===t[0]});
    board.classList.toggle('one',!!filter);
    board.innerHTML=shown.map(function(t){
      var rows=byType[t[0]];
      return '<div class="rq-col"><div class="rq-col-head '+t[0]+'">'+t[1]+'<span>'+rows.length+'</span></div>'+(rows.length?rows.map(function(r){
        var ds=(r.requestDates||[]).slice().sort(),late=ds.length&&ds[ds.length-1]<today;
        var name=r.url?'<a class="rq-store" href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.storeName||'-')+'</a>':'<span class="rq-store">'+esc(r.storeName||'-')+'</span>';
        return '<div class="rq-item">'+name+'<button type="button" class="rq-done" data-rq-done="'+esc(r.id)+'">완료 처리</button><span class="rq-dates'+(late?' late':'')+'">'+(late?'지연 · ':'')+'요청일 '+(ds.map(md).join(', ')||'-')+'</span>'+(r.note?'<span class="rq-note">'+esc(r.note)+'</span>':'')+'</div>';
      }).join(''):'<div class="rq-empty">미처리 요청이 없습니다.</div>')+'</div>';
    }).join('');
  }
  root.addEventListener('click',function(e){
    var t=e.target.closest('[data-rq-tab]');if(t){showTab(t.getAttribute('data-rq-tab'));return}
    var f=e.target.closest('[data-rq-filter]');if(f){filter=f.getAttribute('data-rq-filter');renderBoard();return}
    var d=e.target.closest('[data-rq-done]');
    if(d){
      if(!confirm('해당 요청을 완료 처리하시겠습니까?'))return;
      var card=d.closest('.rq-item'),doneId=d.getAttribute('data-rq-done');
      if(card&&window.__bubblePop)window.__bubblePop(card,function(){completeRq(doneId)});else completeRq(doneId);
      return;
    }
  });
  function completeRq(id){
      var data=read(),x=data.find(function(r){return String(r.id)===id});if(!x)return;
      x.status='처리완료';x.completedAt=new Date().toISOString();x.updatedAt=x.completedAt;
      localStorage.setItem(KEY,JSON.stringify(data));
      if(window.refreshOutboundRequestManager)window.refreshOutboundRequestManager();
      if(window.renderTodayOutboundRequests)window.renderTodayOutboundRequests();
      renderBoard();if(typeof window.toastMsg==='function')window.toastMsg('완료 처리했습니다.');
  }
  root.addEventListener('click',function(e){
    if(e.target.closest('#newOutboundRequestBtn')){showTab('form');return}
    if(e.target.closest('#requestManagerList [data-edit]')){setTimeout(function(){showTab('form');window.scrollTo(0,0)},0);return}
  });
  /* 저장에 성공하면(입력칸이 초기화되면) 처리 대기 탭으로 이동. 저장 처리보다 먼저 값을 봐야 해서 capture 단계 */
  root.addEventListener('click',function(e){
    if(!e.target.closest('#saveOutboundRequestBtn'))return;
    var before=(document.getElementById('requestStoreName')||{}).value;
    setTimeout(function(){var now=(document.getElementById('requestStoreName')||{}).value;if(before&&!now)showTab('pending')},0);
  },true);
  /* 메뉴를 거치지 않고 열 때도(메인 화면 링크 등) 러쉬 테마 적용 */
  var origOpen=window.openOutboundRequestManager;
  if(typeof origOpen==='function')window.openOutboundRequestManager=function(){var r=origOpen.apply(this,arguments);var sh=document.getElementById('appShell');if(sh){sh.classList.add('on-lush');sh.classList.remove('on-dashboard')}return r};
  /* 저장·동기화로 데이터가 바뀌면 처리 대기도 같이 갱신 */
  var orig=window.renderTodayOutboundRequests;
  if(typeof orig==='function')window.renderTodayOutboundRequests=function(){var r=orig.apply(this,arguments);try{renderBoard()}catch(e){}return r};
  document.addEventListener('team-data-updated',function(){try{renderBoard()}catch(e){}});
  renderBoard();
})();

