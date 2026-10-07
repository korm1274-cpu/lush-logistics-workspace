/* <script id="box-detail-mobile-labels"> (index.html에서 그대로 옮김) */
/* 휴대폰 박스수량 상세조회: 칸이 좁아 이름표를 숨기므로, 선택 전 문구를 '요일·호차·매장'으로 짧게 */
(function(){
  var MAP={boxDetailDay:['전체 요일','요일'],boxDetailRoute:['전체 호차','호차'],boxDetailStore:['전체 매장','매장'],boxManualName:['고정 네임 선택','고정 네임']};
  var mq=window.matchMedia&&window.matchMedia('(max-width:900px)');
  function apply(){Object.keys(MAP).forEach(function(id){var sel=document.getElementById(id),o=sel&&sel.querySelector('option[value=""]');if(o)o.textContent=mq&&mq.matches?MAP[id][1]:MAP[id][0]})}
  apply();if(mq&&mq.addEventListener)mq.addEventListener('change',apply);
  /* 선택지를 다시 채우는 경우에도 짧은 문구 유지 */
  Object.keys(MAP).forEach(function(id){var sel=document.getElementById(id);if(sel&&window.MutationObserver)new MutationObserver(function(){var o=sel.querySelector('option[value=""]');var want=mq&&mq.matches?MAP[id][1]:MAP[id][0];if(o&&o.textContent!==want)o.textContent=want}).observe(sel,{childList:true})});
})();

