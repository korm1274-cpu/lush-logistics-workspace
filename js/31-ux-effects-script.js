/* <script id="ux-effects-script"> (index.html에서 그대로 옮김) */
(function(){
  /* 메인 인사말: 시간대별로 바뀜 (휴대폰 줄바꿈 위치 유지) */
  function greet(){
    var h=document.querySelector('#dashboard .lush-hero-hello');if(!h)return;
    var hr=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',hour12:false}).format(new Date()))%24;
    var g=hr>=5&&hr<11?['좋은 아침이에요,','오늘도 힘차게 시작해요!']:hr>=11&&hr<14?['오늘도 힘차게,','우리 함께 화이팅해요!']:hr>=14&&hr<17?['오후도 힘내요,','조금만 더 화이팅!']:['오늘도 수고 많으셨어요,','조심히 들어가세요!'];
    var html=g[0]+'<br class="m-only-br"> '+g[1];if(h.innerHTML!==html)h.innerHTML=html;
  }
  greet();setInterval(greet,10*60*1000);

  /* 오출고 미완료 건수: 1건 이상이면 깜빡임 */
  function blinkCheck(){['mrPendingTitleCount','mrPending'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle('ux-blink',(parseInt(String(el.textContent).replace(/,/g,''),10)||0)>0)})}
  ['mrPendingTitleCount','mrPending'].forEach(function(id){var el=document.getElementById(id);if(el&&window.MutationObserver)new MutationObserver(blinkCheck).observe(el,{childList:true,characterData:true,subtree:true})});
  blinkCheck();

  /* 현장 대시보드: 숫자가 바뀐 칸 반짝 */
  var floor=document.getElementById('floorDashView');
  if(floor&&window.MutationObserver){
    var prev=new WeakMap();
    floor.querySelectorAll('.floor-tile b').forEach(function(b){prev.set(b,b.textContent)});
    new MutationObserver(function(){
      floor.querySelectorAll('.floor-tile b').forEach(function(b){
        var before=prev.get(b),now=b.textContent;prev.set(b,now);
        if(floor.__uxReady&&before!==undefined&&before!==now){
          var tile=b.closest('.floor-tile');if(!tile)return;tile.classList.remove('ux-flash');void tile.offsetWidth;tile.classList.add('ux-flash');
        }
      });
    }).observe(floor,{childList:true,characterData:true,subtree:true});
    setTimeout(function(){floor.__uxReady=true},4000); /* 처음 불러오는 동안 바뀌는 숫자는 반짝이지 않음 */
  }

  /* 메뉴를 바꿀 때 새 화면 페이드인 (처음 불러올 때는 제외) */
  var ready=false;setTimeout(function(){ready=true},1500);
  if(window.MutationObserver)document.querySelectorAll('.view').forEach(function(v){
    new MutationObserver(function(){
      if(!ready||!v.classList.contains('active')||v.classList.contains('ux-enter'))return;
      if(v.__wasActive)return;v.__wasActive=true;
      v.classList.add('ux-enter');setTimeout(function(){v.classList.remove('ux-enter')},400);
    }).observe(v,{attributes:true,attributeFilter:['class']});
    new MutationObserver(function(){if(!v.classList.contains('active'))v.__wasActive=false}).observe(v,{attributes:true,attributeFilter:['class']});
    if(v.classList.contains('active'))v.__wasActive=true;
  });

  /* 메인 제품 확보 현황: 남은 건이 없으면 축하 문구 */
  var list=document.getElementById('dashTodoList');
  function todoCheer(){
    if(!list)return;
    var todos;try{todos=JSON.parse(localStorage.getItem('lush-v51-todos')||'[]')}catch(e){todos=[]}
    var open=(Array.isArray(todos)?todos:[]).filter(function(t){return t&&!t.done}).length;
    var cheer=list.querySelector(':scope > .todo-cheer');
    if(!open&&!cheer){var c=document.createElement('div');c.className='todo-cheer';c.innerHTML='<span>🎉</span><div><b>확보할 제품이 없어요!</b> <small>모두 완료</small></div>';list.insertBefore(c,list.firstChild)}
    else if(open&&cheer)cheer.remove();
  }
  if(list&&window.MutationObserver)new MutationObserver(function(){todoCheer()}).observe(list,{childList:true});
  todoCheer();
})();

