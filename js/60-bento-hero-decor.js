/* 메인 벤토 그리드: 배너 장식(거품·거품 터짐·도로·트럭·시즌 장식·새해 해돋이)을 왼쪽 인사 타일 안으로 옮겨
   타일 사이로 흩어지지 않고 인사 타일 안에서만 움직이게 함. 나중에 추가되는 장식도 따라 옮김 */
(function(){
  var hero=document.querySelector('#dashboard .lush-hero');if(!hero)return;
  var tile=hero.querySelector('.lush-hero-text');if(!tile)return;
  var SEL='.hero-bubble,.hero-fizz,.hero-road,.hero-truck,.season-flake,.hero-sunrise';
  function move(){
    [].slice.call(hero.children).forEach(function(el){
      if(el!==tile&&el.matches&&el.matches(SEL))tile.insertBefore(el,tile.firstChild);
    });
  }
  move();
  new MutationObserver(move).observe(hero,{childList:true});
})();
