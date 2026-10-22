/* 메인 배너·현장 대시보드 트럭을 로그인 화면 트럭처럼(LUSH 짐칸 + 시즌 색 운전석 + 짐칸 위 시즌 짐)
   시즌은 메인 시즌 테마(js/34)가 정한 html[data-season] 그대로: halloween · xmas · newyear · hanbok(명절) · 평소 */
(function(){
  var THEME={
    halloween:{cab:'#ff7a1a',stripe:'#8a4fd1',cargo:'🎃',tail:'🦇'},
    xmas:{cab:'#d6453d',stripe:'#1f8a50',cargo:'🎁',tail:'❄️'},
    newyear:{cab:'#d4a017',stripe:'#e87ba4',cargo:'🎉',tail:'✨'},
    hanbok:{cab:'#c2477a',stripe:'#eda100',cargo:'🌕',tail:''},
    '':{cab:'#e87ba4',stripe:'#1baf7a',cargo:'',tail:''}
  };
  function svg(t){
    return '<svg viewBox="0 0 86 40" xmlns="http://www.w3.org/2000/svg">'+
      /* 짐칸 */'<rect x="1" y="4" width="54" height="26" rx="4" fill="#ffffff"/><rect x="1" y="26" width="54" height="4" rx="1" fill="#ece6db"/>'+
      '<text x="8" y="17.5" font-size="9.5" font-weight="900" letter-spacing="1.2" fill="#1d1d1b" font-family="inherit">LUSH</text>'+
      '<rect x="8" y="21" width="26" height="2.6" rx="1.3" fill="'+t.stripe+'"/>'+
      /* 운전석 */'<path d="M57 10h17c2 0 3.4.8 4.6 2.3l4.4 6.2c.6.9.9 1.9.9 3V30H57z" fill="'+t.cab+'"/>'+
      '<path d="M66 13h7.5c1 0 1.8.4 2.3 1.2l3 4.4H66z" fill="#cfe6f3"/><rect x="81" y="24" width="3" height="2.4" rx="1" fill="#ffd34d"/>'+
      /* 바퀴 */'<g class="wheel"><circle cx="15" cy="32" r="6" fill="#2b2a27" stroke="#55534d" stroke-width="2.4"/><circle cx="15" cy="32" r="1.6" fill="#8a8a85"/></g>'+
      '<g class="wheel"><circle cx="70" cy="32" r="6" fill="#2b2a27" stroke="#55534d" stroke-width="2.4"/><circle cx="70" cy="32" r="1.6" fill="#8a8a85"/></g>'+
    '</svg>';
  }
  function apply(){
    var season=document.documentElement.getAttribute('data-season')||'';
    var t=THEME[season]||THEME[''];
    document.querySelectorAll('.hero-truck').forEach(function(tr){
      if(tr.getAttribute('data-season-truck')===season)return;
      tr.setAttribute('data-season-truck',season);
      tr.classList.add('st-truck');
      tr.innerHTML='<span class="puff"></span><span class="puff p2"></span>'+svg(t)+
        (t.cargo?'<span class="st-cargo">'+t.cargo+'</span>':'')+(t.tail?'<span class="st-tail">'+t.tail+'</span>':'');
    });
  }
  function init(){apply();setTimeout(apply,600);setTimeout(apply,2000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
