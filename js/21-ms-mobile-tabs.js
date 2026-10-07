/* <script id="ms-mobile-tabs"> (index.html에서 그대로 옮김) */
(function(){
  function apply(i){var secs=document.querySelectorAll('#msSections > .ms-section');secs.forEach(function(s,k){s.classList.toggle('ms-off',k!==i)});document.querySelectorAll('#msMobileTabs [data-ms-dim]').forEach(function(b){b.classList.toggle('active',+b.getAttribute('data-ms-dim')===i)})}
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#msMobileTabs [data-ms-dim]');if(b)apply(+b.getAttribute('data-ms-dim'))});
  apply(0);
})();

