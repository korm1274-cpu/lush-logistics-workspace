/* <script id="ux-effects-script"> (index.html에서 그대로 옮김) */
(function(){
  /* 메인 인사말: 시간대별로 바뀌고, 문구 묶음은 매주 월요일(한국 시간)마다 다음 묶음으로(6주마다 처음으로).
     2026-11-02(월) 주가 1주차(예전 문구). 같은 주에는 모두에게 같은 문구. 휴대폰 줄바꿈 위치 유지.
     묶음 순서: [아침 05~11시, 점심 11~14시, 오후 14~17시, 저녁 17~05시] */
  var GREET_SETS=[
    [['좋은 아침이에요,','오늘도 힘차게 시작해요!'],['오늘도 힘차게,','우리 함께 화이팅해요!'],['오후도 힘내요,','조금만 더 화이팅!'],['오늘도 수고 많으셨어요,','조심히 들어가세요!']],
    [['상쾌한 아침이에요,','오늘도 안전하게 시작해요!'],['든든하게 드셨나요?','오후도 함께 힘내요!'],['오늘 일도 반 넘게 왔어요,','끝까지 힘내요!'],['오늘도 고생 많으셨어요,','푹 쉬세요!']],
    [['반가운 아침이에요,','오늘 하루도 잘 부탁해요!'],['점심 맛있게 드셨나요?','오후도 화이팅!'],['조금만 더 힘내면,','오늘도 마무리예요!'],['하루 동안 애쓰셨어요,','편안한 저녁 되세요!']],
    [['좋은 하루의 시작,','오늘도 정확하게, 안전하게!'],['바쁜 오전 수고했어요,','잠깐 숨 돌리고 가요!'],['마지막까지 꼼꼼하게,','오늘도 잘하고 있어요!'],['오늘도 덕분에 잘 마쳤어요,','조심히 들어가세요!']],
    [['활기찬 아침이에요,','오늘도 웃으면서 시작해요!'],['오전도 수고 많았어요,','오후도 같이 가요!'],['오후도 거뜬하게,','조금만 더 힘내요!'],['수고하셨어요,','내일 또 반갑게 만나요!']],
    [['오늘도 좋은 아침,','무리하지 말고 천천히 가요!'],['한숨 돌리는 시간,','물 한 잔 챙겨 드세요!'],['오늘 하루도 거의 다 왔어요,','끝까지 안전하게!'],['오늘 하루도 고마웠어요,','따뜻한 저녁 보내세요!']]
  ];
  var GREET_BASE_MONDAY=Date.UTC(2026,10,2); // 2026-11-02(월) = 1주차
  function greetSet(now){
    var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-');
    var weeks=Math.floor((Date.UTC(+p[0],+p[1]-1,+p[2])-GREET_BASE_MONDAY)/(7*86400000));
    return GREET_SETS[((weeks%GREET_SETS.length)+GREET_SETS.length)%GREET_SETS.length];
  }
  function greet(){
    var h=document.querySelector('#dashboard .lush-hero-hello');if(!h)return;
    var now=new Date(),set=greetSet(now);
    var hr=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',hour12:false}).format(now))%24;
    var g=hr>=5&&hr<11?set[0]:hr>=11&&hr<14?set[1]:hr>=14&&hr<17?set[2]:set[3];
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

