/* <script id="dash-intro-script"> (index.html에서 그대로 옮김) */
(function(){
  var hero=document.querySelector('#dashboard .lush-hero');if(!hero)return;
  /* 배너 동그라미를 실제 요소로 바꿔 움직일 수 있게 함(모양·위치·색은 기존과 같음) */
  ['b1','b2','b3'].forEach(function(c){var s=document.createElement('span');s.className='hero-bubble '+c;s.setAttribute('aria-hidden','true');hero.insertBefore(s,hero.firstChild)});
  hero.classList.add('has-bubbles');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY='lush_dash_intro_v1';
  function seen(){try{return sessionStorage.getItem(KEY)==='1'}catch(e){return false}}
  function markSeen(){try{sessionStorage.setItem(KEY,'1')}catch(e){}}
  function countUp(el){
    var target=String(el.textContent||'').trim(),n=parseInt(target.replace(/,/g,''),10);
    if(!/^[\d,]+$/.test(target)||!(n>0))return;
    var start=performance.now(),dur=750,last='0';el.textContent='0';
    /* 탭이 뒤에 있어 그리기가 멈춰도 숫자가 0에 머물지 않도록 1초 뒤 실제 값으로 맞춤 */
    setTimeout(function(){if(el.textContent===last&&last!==target){last=target;el.textContent=target}},1000);
    function step(t){
      if(el.textContent!==last)return; /* 그 사이 화면이 새 값으로 바뀌었으면 그대로 둠 */
      var p=Math.min(1,(t-start)/dur),v=Math.round(n*(1-Math.pow(1-p,3)));
      last=v.toLocaleString('ko-KR');el.textContent=p<1?last:target;last=el.textContent;
      if(p<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function play(){
    if(seen()||reduce)return;
    var dash=document.getElementById('dashboard');if(!dash||!dash.classList.contains('active'))return;
    markSeen();
    /* A: 배너 → 각 영역 순서대로 떠오르기 */
    var parts=[hero].concat([].slice.call(dash.children).filter(function(el){return el!==hero&&el.offsetParent!==null}));
    parts.forEach(function(el,i){el.classList.add('intro-rise');el.style.animationDelay=(i*70)+'ms'});
    /* C: 배스밤처럼 작은 거품이 퍼짐 */
    var cols=['rgba(232,123,164,.7)','rgba(27,175,122,.6)','rgba(237,161,0,.6)'];
    for(var i=0;i<10;i++){var f=document.createElement('span');f.className='hero-fizz';f.setAttribute('aria-hidden','true');var a=Math.random()*Math.PI*2,d=40+Math.random()*60;f.style.cssText='left:calc(90% - 4px);top:calc(40% - 4px);background:'+cols[i%3]+';--fx:'+Math.round(Math.cos(a)*d)+'px;--fy:'+Math.round(Math.sin(a)*d)+'px;animation-delay:'+(150+i*35)+'ms';hero.insertBefore(f,hero.firstChild)}
    document.documentElement.classList.add('dash-intro');
    /* B: 숫자 카운트업 */
    setTimeout(function(){['heroPallet','heroReq','heroTodo','heroStaff'].forEach(function(id){var el=document.getElementById(id);if(el)countUp(el)})},250);
    setTimeout(function(){document.documentElement.classList.remove('dash-intro');parts.forEach(function(el){el.classList.remove('intro-rise');el.style.animationDelay=''});[].slice.call(hero.querySelectorAll('.hero-fizz')).forEach(function(f){f.remove()})},2200);
  }
  if(document.readyState==='complete')setTimeout(play,60);else window.addEventListener('load',function(){setTimeout(play,60)});
})();

