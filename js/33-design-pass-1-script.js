/* <script id="design-pass-1-script"> (index.html에서 그대로 옮김) */
(function(){
  /* 제목 이모지 → 선 아이콘 */
  var MAP={'📢':['megaphone','#fde7f0','#c2477a'],'📦':['package','#e3f5ec','#11795a'],'📅':['calendar-days','#fff3d6','#9a6400'],'📊':['bar-chart-3','#ece6fb','#6a4fc0'],'⚠️':['triangle-alert','#fdecec','#c93838'],'💥':['package-x','#fdecec','#c93838']};
  document.querySelectorAll('h2,h3').forEach(function(h){
    var first=h.firstChild;if(!first||first.nodeType!==3)return;
    var txt=first.nodeValue.replace(/^\s+/,'');
    Object.keys(MAP).some(function(em){
      if(txt.indexOf(em)!==0)return false;
      var m=MAP[em];first.nodeValue=txt.slice(em.length).replace(/^\s+/,'');
      var s=document.createElement('span');s.className='ux-ico';s.style.setProperty('--ico-bg',m[1]);s.style.setProperty('--ico-fg',m[2]);s.innerHTML='<i data-lucide="'+m[0]+'"></i>';
      h.insertBefore(s,h.firstChild);return true;
    });
  });
  /* 재고·입고·트래픽·일정 화면 제목에도 같은 아이콘(메뉴 아이콘과 같은 모양) */
  var TITLE_ICONS={'총 재고파일':['package-search','#e3f5ec','#11795a'],'담당자 재고파일':['package-search','#e3f5ec','#11795a'],'품절 재고 분석':['package-minus','#fdecec','#c93838'],
    '입고':['package-plus','#fde7f0','#c2477a'],'월별 입고현황':['calendar-range','#fde7f0','#c2477a'],'일일 입고관리':['clipboard-list','#fde7f0','#c2477a'],'입고 상세조회':['search','#fde7f0','#c2477a'],
    '트래픽 출고 요청':['signpost','#e3f5ec','#11795a'],'통합 일정':['calendar-days','#fff3d6','#9a6400'],'공지 등록':['megaphone','#fde7f0','#c2477a'],'제품 확보 등록':['package-check','#e3f5ec','#11795a'],'제품 불량':['package-x','#fdecec','#c93838'],'불량 등록':['clipboard-plus','#fdecec','#c93838'],'불량 목록':['list-checks','#fdecec','#c93838']};
  function addTitleIcon(h){
    if(h.querySelector('.ux-ico'))return;
    var key=h.textContent.trim(),m=TITLE_ICONS[key];
    if(!m&&h.id==='inventoryOwnerTitle')m=TITLE_ICONS['담당자 재고파일'];
    if(!m)return;
    var sp=document.createElement('span');sp.className='ux-ico';sp.style.setProperty('--ico-bg',m[1]);sp.style.setProperty('--ico-fg',m[2]);sp.innerHTML='<i data-lucide="'+m[0]+'"></i>';
    h.insertBefore(sp,h.firstChild);
    if(window.lucide&&lucide.createIcons)try{lucide.createIcons()}catch(e){}
  }
  /* 메인화면 '출고 요청'·'이번 달 입출고 현황' 제목에도 같은 동그라미 아이콘 */
  TITLE_ICONS['출고 요청']=['truck','#ece6fb','#6a4fc0'];
  TITLE_ICONS['출고']=['truck','#ece6fb','#6a4fc0'];
  TITLE_ICONS['출고 상세조회']=['search','#ece6fb','#6a4fc0'];
  TITLE_ICONS['출고 박스 관리']=['boxes','#ece6fb','#6a4fc0'];
  TITLE_ICONS['이번 달 입출고 현황']=['arrow-down-up','#fff3d6','#9a6400'];
  document.querySelectorAll('#dashboard .dash-section-head h3').forEach(function(h){addTitleIcon(h)});
  document.querySelectorAll('.view h2').forEach(function(h){
    addTitleIcon(h);
    /* 제목 글씨가 바뀌면(담당자 재고파일 등) 아이콘을 다시 붙임 */
    if(window.MutationObserver)new MutationObserver(function(){addTitleIcon(h)}).observe(h,{childList:true});
  });

  /* lucide 스크립트가 늦게 올라올 수 있어 준비될 때까지 몇 번 다시 그림 */
  (function draw(n){try{if(window.lucide&&lucide.createIcons){lucide.createIcons();if(!document.querySelector('.ux-ico i[data-lucide]'))return}}catch(e){}if(n<20)setTimeout(function(){draw(n+1)},250)})(0);

  /* 현장 대시보드 아래 트럭 도로(메인 배너 트럭과 같은 그림) */
  var board=document.getElementById('floorBoard'),src=document.querySelector('#dashboard .hero-truck');
  if(board&&src){
    var lane=document.createElement('div');lane.className='floor-truck-lane';lane.setAttribute('aria-hidden','true');
    lane.innerHTML='<span class="hero-road"></span>';
    var t1=src.cloneNode(true),t2=src.cloneNode(true);t2.classList.add('t2');
    lane.appendChild(t1);lane.appendChild(t2);board.appendChild(lane);
  }
})();

