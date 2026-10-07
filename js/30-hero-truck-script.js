/* <script id="hero-truck-script"> (index.html에서 그대로 옮김) */
(function(){
  var hero=document.querySelector('#dashboard .lush-hero');if(!hero)return;
  var road=document.createElement('span');road.className='hero-road';road.setAttribute('aria-hidden','true');
  var truck=document.createElement('span');truck.className='hero-truck';truck.setAttribute('aria-hidden','true');
  truck.innerHTML='<span class="puff"></span><span class="puff p2"></span>'+
    '<svg viewBox="0 0 72 34" xmlns="http://www.w3.org/2000/svg">'+
      /* 짐칸 */'<rect x="1" y="2" width="44" height="22" rx="3" fill="#f3eee6"/>'+
      /* 러쉬 분홍 띠 + 상자 */'<rect x="1" y="17" width="44" height="3" fill="#e87ba4"/>'+
      '<rect x="8" y="7" width="9" height="7" rx="1" fill="none" stroke="#c9b99f" stroke-width="1.4"/><rect x="21" y="7" width="9" height="7" rx="1" fill="none" stroke="#c9b99f" stroke-width="1.4"/>'+
      /* 운전석 */'<path d="M47 8h12l8 9v7H47z" fill="#e4d9c7"/><path d="M50 11h8l5 6H50z" fill="#1d1d1b" opacity=".75"/>'+
      '<rect x="65" y="19" width="4" height="2" rx="1" fill="#eda100"/>'+
      /* 바퀴 */'<g class="wheel"><circle cx="13" cy="27" r="5" fill="#1d1d1b" stroke="#e4d9c7" stroke-width="2"/><path d="M13 23v8M9 27h8" stroke="#e4d9c7" stroke-width="1"/></g>'+
      '<g class="wheel"><circle cx="56" cy="27" r="5" fill="#1d1d1b" stroke="#e4d9c7" stroke-width="2"/><path d="M56 23v8M52 27h8" stroke="#e4d9c7" stroke-width="1"/></g>'+
    '</svg>';
  hero.insertBefore(truck,hero.firstChild);hero.insertBefore(road,hero.firstChild);
})();

