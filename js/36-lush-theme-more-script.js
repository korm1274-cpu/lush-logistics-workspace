/* <script id="lush-theme-more-script"> (index.html에서 그대로 옮김) */
(function(){
  /* 배너가 없는 데이터·Admin 화면에 같은 칠판 배너 추가 */
  [['upload','DATA','데이터 업로드','Excel·CSV 파일을 올려 입고·출고·오출고·파손 등 팀 공유 데이터를 갱신합니다.','file-up'],
   ['settings','ADMIN','Admin','사용자·메뉴·권한과 단위 환산을 관리합니다.','settings-2']].forEach(function(c){
    var v=document.getElementById(c[0]);if(!v||v.querySelector('.lush-page-head'))return;
    var h=document.createElement('div');h.className='lush-page-head';
    h.innerHTML='<div><div class="eyebrow">'+c[1]+'</div><h2><span class="ux-ico" style="--ico-bg:rgba(255,255,255,.14);--ico-fg:#fff"><i data-lucide="'+c[4]+'"></i></span>'+c[2]+'</h2><p>'+c[3]+'</p></div>';
    v.insertBefore(h,v.firstChild);
  });
  try{window.lucide&&lucide.createIcons()}catch(e){}
  /* 러쉬 테마 화면 목록에 재고·생산성·데이터·Admin 추가 */
  var more=['inventoryTotalView','inventoryOwnerView','inventoryOosView','productivityView','upload','dataArchiveView','settings','outboundBasicView','outboundAnalysis','outboundBoxView','sheetView','defectView'];
  function sync(){var a=document.querySelector('.view.active'),sh=document.getElementById('appShell');if(a&&sh&&more.indexOf(a.id)>=0){sh.classList.add('on-lush');sh.classList.remove('on-dashboard')}}
  if(window.MutationObserver)document.querySelectorAll('.view').forEach(function(v){new MutationObserver(function(){if(v.classList.contains('active'))setTimeout(sync,0)}).observe(v,{attributes:true,attributeFilter:['class']})});
  sync();
})();

