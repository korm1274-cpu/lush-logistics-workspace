/* <script id="hide-english-captions-script"> (index.html에서 그대로 옮김) */
/* 카드 머리글의 작은 영어 글씨(예: MONTHLY TREND·CATEGORY TREND·DETAIL)를 찾아 숨김. 한글이 섞인 설명은 그대로 둠 */
(function(){
  var RE=/^[A-Z][A-Z0-9 ·&\/\-().,'+]*$/;
  function scan(root){
    (root||document).querySelectorAll('#appShell .main .panel-head small, #appShell .main .panel-head > div > small, #appShell .main .status-card-title small, #appShell .main .request-form-head span').forEach(function(el){
      var t=(el.textContent||'').trim();
      if(t.length>=3&&RE.test(t)&&/[A-Z]{3}/.test(t))el.classList.add('ux-en-caption');
    });
  }
  scan();
  if(window.MutationObserver){var pending=false;new MutationObserver(function(){if(pending)return;pending=true;setTimeout(function(){pending=false;scan()},200)}).observe(document.querySelector('#appShell .main')||document.body,{childList:true,subtree:true})}
})();

