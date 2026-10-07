/* <script id="bubble-pop-script"> (index.html에서 그대로 옮김) */
/* 완료 처리 연출: el을 거품처럼 터뜨린 뒤 done() 실행 (동작 줄이기 설정이면 바로 실행) */
window.__bubblePop=function(el,done){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!el||reduce){done&&done();return}
  var r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,cols=['#e87ba4','#1baf7a','#eda100','#8a6fd1'];
  el.classList.add('bubble-pop');
  for(var i=0;i<14;i++){
    var d=document.createElement('span'),a=(Math.PI*2*i/14)+Math.random()*.4,dist=Math.max(r.width/2,60)*(0.7+Math.random()*.6),sz=5+Math.round(Math.random()*7);
    d.className='bubble-pop-dot';d.style.cssText='left:'+cx+'px;top:'+cy+'px;width:'+sz+'px;height:'+sz+'px;background:'+cols[i%4]+';--dx:'+Math.round(Math.cos(a)*dist)+'px;--dy:'+Math.round(Math.sin(a)*dist*.6)+'px;animation-delay:'+(180+Math.round(Math.random()*80))+'ms';
    document.body.appendChild(d);setTimeout(function(n){return function(){n.remove()}}(d),1200);
  }
  var t=document.createElement('span');t.className='bubble-pop-done';t.textContent='✔ 완료!';t.style.left=cx+'px';t.style.top=cy+'px';document.body.appendChild(t);setTimeout(function(){t.remove()},1000);
  setTimeout(function(){done&&done()},700);
};

