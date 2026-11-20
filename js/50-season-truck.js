/* 메인 배너·현장 대시보드 트럭을 로그인 화면 트럭처럼(LUSH 짐칸 + 시즌 색 운전석 + 짐칸 위 시즌 짐)
   시즌은 메인 시즌 테마(js/34)가 정한 html[data-season] 그대로: halloween · xmas · newyear · hanbok(명절) · 평소 */
(function(){
  var THEME={
    halloween:{cab:'#ff7a1a',stripe:'#8a4fd1',cargo:'🎃',tail:'🦇'},
    xmas:{cab:'#d6453d',stripe:'#1f8a50',cargo:'🎁',tail:'❄️'},
    newyear:{cab:'#d4a017',stripe:'#e8894a',cargo:'☀️',tail:'✨'},
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
  /* 크리스마스: 짐칸 위 선물 상자 더미(빨강·초록·노랑), 이모지 대신 그림이라 기기마다 같은 모습 */
  var GIFTS='<svg viewBox="0 0 62 38" xmlns="http://www.w3.org/2000/svg">'+
    '<rect x="16" y="0" width="30" height="17" rx="2.5" fill="#1f8a50"/><rect x="28.5" y="0" width="5" height="17" fill="#ffd34d"/>'+
    '<rect x="1" y="16" width="28" height="21" rx="2.5" fill="#d6453d"/><rect x="12.5" y="16" width="5" height="21" fill="#ffd34d"/><rect x="1" y="24" width="28" height="4" fill="#ffd34d"/>'+
    '<rect x="32" y="16" width="29" height="21" rx="2.5" fill="#ffd34d"/><rect x="44" y="16" width="5" height="21" fill="#d6453d"/><rect x="32" y="24" width="29" height="4" fill="#d6453d"/>'+
    '<path d="M31 1c-6-7-12-3-6 0M31 1c6-7 12-3 6 0" stroke="#ffd34d" stroke-width="2.2" fill="none" stroke-linecap="round"/>'+
  '</svg>';
  function apply(){
    var season=document.documentElement.getAttribute('data-season')||'';
    var t=THEME[season]||THEME[''];
    document.querySelectorAll('.hero-truck').forEach(function(tr){
      if(tr.getAttribute('data-season-truck')===season)return;
      tr.setAttribute('data-season-truck',season);
      tr.classList.add('st-truck');
      var cargo=season==='xmas'?'<span class="st-gifts">'+GIFTS+'</span>':(t.cargo?'<span class="st-cargo">'+t.cargo+'</span>':'');
      tr.innerHTML='<span class="puff"></span><span class="puff p2"></span>'+svg(t)+cargo+(t.tail?'<span class="st-tail">'+t.tail+'</span>':'');
    });
  }
  /* 크리스마스: 현장 대시보드 아래 구석 장식(왼쪽 트리+선물, 오른쪽 눈사람+선물) */
  var TREE='<svg viewBox="-6 -14 100 160" xmlns="http://www.w3.org/2000/svg">'+
    '<rect x="34" y="122" width="14" height="22" fill="#6b4a2b"/>'+
    '<polygon points="41,0 6,52 24,52 0,88 22,88 -4,124 86,124 60,88 82,88 58,52 76,52" fill="#1f8a50"/>'+
    '<polygon points="41,-12 44.5,-3 54,-3 46.5,2.5 49,11.5 41,6 33,11.5 35.5,2.5 28,-3 37.5,-3" fill="#ffd34d"/>'+
    '<g class="xd-lights"><circle cx="30" cy="44" r="4" fill="#e8453c"/><circle cx="52" cy="70" r="4" fill="#ffd34d"/><circle cx="24" cy="100" r="4" fill="#ffd34d"/><circle cx="62" cy="108" r="4" fill="#e8453c"/><circle cx="44" cy="84" r="3.5" fill="#cfe6f3"/><circle cx="48" cy="30" r="3" fill="#cfe6f3"/></g>'+
  '</svg>';
  var SNOWMAN='<svg viewBox="0 -14 90 146" xmlns="http://www.w3.org/2000/svg">'+
    '<circle cx="44" cy="96" r="34" fill="#f5f2ec"/><circle cx="44" cy="44" r="24" fill="#f5f2ec"/>'+
    '<rect x="24" y="14" width="40" height="6" rx="2" fill="#2b2a27"/><rect x="31" y="-10" width="26" height="26" rx="3" fill="#2b2a27"/><rect x="31" y="8" width="26" height="5" fill="#d6453d"/>'+
    '<circle cx="36" cy="40" r="3" fill="#1d1d1b"/><circle cx="52" cy="40" r="3" fill="#1d1d1b"/><polygon points="44,46 62,50 44,52" fill="#ff8a2a"/>'+
    '<path d="M22 64q22 12 44 0l2 8q-24 12-48 0z" fill="#d6453d"/><rect x="54" y="68" width="9" height="20" rx="2" fill="#d6453d"/>'+
    '<circle cx="44" cy="88" r="3" fill="#1d1d1b"/><circle cx="44" cy="102" r="3" fill="#1d1d1b"/>'+
  '</svg>';
  function box(c1,c2,w,h){return '<svg viewBox="-3 -10 '+(w+6)+' '+(h+10)+'" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px">'+
    '<rect x="0" y="4" width="'+w+'" height="'+(h-4)+'" rx="3" fill="'+c1+'"/><rect x="'+(w/2-3)+'" y="4" width="6" height="'+(h-4)+'" fill="'+c2+'"/>'+
    '<rect x="-2" y="0" width="'+(w+4)+'" height="8" rx="2" fill="'+c1+'" style="filter:brightness(1.12)"/>'+
    '<path d="M'+(w/2)+' 0c-8-10-16-4-8 0M'+(w/2)+' 0c8-10 16-4 8 0" stroke="'+c2+'" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';}
  function xmasCorners(layer){
    if(layer.querySelector('.xd-corner'))return;
    var l=document.createElement('div');l.className='xd-corner xd-left';
    l.innerHTML='<span class="xd-tree">'+TREE+'</span><span class="xd-gifts">'+box('#d6453d','#ffd34d',36,34)+box('#1f8a50','#f5f0e6',28,24)+'</span>';
    var r=document.createElement('div');r.className='xd-corner xd-right';
    r.innerHTML='<span class="xd-gifts">'+box('#ffd34d','#d6453d',38,36)+'</span><span class="xd-snowman">'+SNOWMAN+'</span>';
    layer.appendChild(l);layer.appendChild(r);
  }
  /* 새해: 메인 배너 뒤로 해가 떠오르는 장면 */
  function sunrise(){
    if(document.documentElement.getAttribute('data-season')!=='newyear')return;
    var hero=document.querySelector('#dashboard .lush-hero');if(!hero||hero.querySelector('.hero-sunrise'))return;
    var s=document.createElement('span');s.className='hero-sunrise';s.setAttribute('aria-hidden','true');s.innerHTML='<span class="hero-sun"></span>';
    hero.insertBefore(s,hero.firstChild);
  }
  /* 현장 대시보드(floorBoard)도 메인 배너와 같은 시즌 장식: 새해는 해 뜨는 장면, 그 외 시즌은 떨어지는 장식 */
  var FLAKE={halloween:'🦇',xmas:'❄',newyear:'✦',hanbok:'✿'};
  function floorSeason(){
    var season=document.documentElement.getAttribute('data-season')||'';
    var board=document.getElementById('floorBoard');if(!board||!season||board.querySelector('.floor-season'))return;
    var layer=document.createElement('div');layer.className='floor-season';layer.setAttribute('aria-hidden','true');
    var html='';
    if(season==='newyear')html+='<span class="floor-sun"></span>';
    for(var i=0;i<18;i++)html+='<span class="season-flake" style="left:'+(Math.random()*100).toFixed(1)+'%;font-size:'+(11+Math.random()*12).toFixed(0)+'px;animation-duration:'+(9+Math.random()*10).toFixed(1)+'s;animation-delay:-'+(Math.random()*15).toFixed(1)+'s">'+(FLAKE[season]||'✦')+'</span>';
    layer.innerHTML=html;
    if(season==='xmas')xmasCorners(layer);
    board.insertBefore(layer,board.firstChild);
  }
  function init(){apply();sunrise();floorSeason();setTimeout(function(){apply();sunrise();floorSeason()},600);setTimeout(apply,2000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
