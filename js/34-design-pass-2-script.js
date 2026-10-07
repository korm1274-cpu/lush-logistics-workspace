/* <script id="design-pass-2-script"> (index.html에서 그대로 옮김) */
(function(){
  var root=document.documentElement;

  /* 불러오는 중 표시: 첫 동기화가 끝나거나 2.5초가 지나면 해제 */
  root.classList.add('ux-loading');
  var done=function(){root.classList.remove('ux-loading')};
  document.addEventListener('team-data-updated',function(){setTimeout(done,150)});
  window.addEventListener('load',function(){setTimeout(done,1300)});
  setTimeout(done,2500);

  /* 시즌 테마 (주소 뒤에 ?season=xmas 처럼 붙이면 미리보기 가능) */
  var SEASONS={halloween:['🎃 Happy Halloween','🦇'],xmas:['🎄 Merry Christmas','❄'],newyear:['✨ Happy New Year','✦'],hanbok:['🌕 즐거운 명절 보내세요','✿']};
  /* 설·추석은 해마다 날짜가 달라 연도별로 지정(앞뒤 하루 포함) */
  var HOLIDAYS=[['2026-09-23','2026-09-27'],['2027-02-05','2027-02-09'],['2027-09-13','2027-09-17'],['2028-01-25','2028-01-29'],['2028-10-01','2028-10-05']];
  function seasonFor(d){
    var md=d.slice(5);
    if(HOLIDAYS.some(function(r){return d>=r[0]&&d<=r[1]}))return'hanbok';
    if(md>='10-20'&&md<='10-31')return'halloween';
    if(md>='12-01'&&md<='12-26')return'xmas';
    if(md>='12-27'||md<='01-03')return'newyear';
    return'';
  }
  var q=(location.search.match(/[?&]season=([a-z]+)/)||[])[1];
  var today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  var season=q&&SEASONS[q]?q:seasonFor(today);
  if(season){
    root.setAttribute('data-season',season);
    var hero=document.querySelector('#dashboard .lush-hero'),sub=hero&&hero.querySelector('.lush-hero-date');
    if(sub){var b=document.createElement('span');b.className='season-badge';b.textContent=SEASONS[season][0];sub.appendChild(b)}
    if(hero){for(var i=0;i<14;i++){var f=document.createElement('span');f.className='season-flake';f.setAttribute('aria-hidden','true');f.textContent=SEASONS[season][1];f.style.left=(Math.random()*100)+'%';f.style.fontSize=(9+Math.random()*9)+'px';f.style.animationDuration=(7+Math.random()*7)+'s';f.style.animationDelay=(-Math.random()*12)+'s';f.style.opacity=(.35+Math.random()*.5).toFixed(2);hero.insertBefore(f,hero.firstChild)}}
  }

  /* 다크 모드 버튼(상단 도구줄) — 이 기기에 기억 */
  var KEY='lush_dark_mode_v1',tools=document.getElementById('baseTools');
  try{if(localStorage.getItem(KEY)==='1')root.classList.add('ux-dark')}catch(e){}
  if(tools){
    var dm=document.createElement('button');dm.type='button';dm.className='base-tool';dm.id='uxDarkBtn';
    var label=function(){dm.innerHTML=root.classList.contains('ux-dark')?'☀️<span class="ux-lbl"> 라이트</span>':'🌙<span class="ux-lbl"> 다크</span>';dm.title=root.classList.contains('ux-dark')?'밝은 화면으로':'어두운 화면으로'};
    label();dm.addEventListener('click',function(){var on=root.classList.toggle('ux-dark');try{localStorage.setItem(KEY,on?'1':'0')}catch(e){}label()});
    tools.insertBefore(dm,tools.firstChild);
  }
})();

