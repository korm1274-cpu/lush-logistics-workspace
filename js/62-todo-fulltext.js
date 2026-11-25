/* 메인 '제품 확보 현황'(#dashTodoList): 제품명(한 줄 말줄임)·메모(두 줄)가 잘린 항목의 전체 내용 보기
   - 마우스: 잘린 항목에 올리면 말풍선으로 제품명·메모 전체
   - 터치(휴대폰): 잘린 항목의 글자를 누르면 그 줄을 펼침, 다시 누르면 접힘
   - 오른쪽 [미완료/완료] 버튼 동작은 그대로(글자를 눌러도 완료 처리하지 않음) */
(function(){
  var tip=null;
  function cut(el){return !!el&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)}
  function truncated(item){var c=item.querySelector('.todo-content');return cut(c)||cut(item.querySelector('.todo-note'))}
  function parts(item){
    var c=item.querySelector('.todo-content'),n=item.querySelector('.todo-note');
    var name='';if(c)c.childNodes.forEach(function(x){if(x.nodeType===3)name+=x.textContent});
    return{name:name.trim(),note:n?n.textContent.trim():''};
  }
  function showTip(item){
    if(!tip){tip=document.createElement('div');tip.className='todo-full-tip';tip.setAttribute('role','tooltip');document.body.appendChild(tip)}
    var p=parts(item);tip.textContent='';
    var b=document.createElement('b');b.textContent=p.name;tip.appendChild(b);
    if(p.note){var s=document.createElement('span');s.textContent=p.note;tip.appendChild(s)}
    tip.style.display='block';
    var r=item.getBoundingClientRect(),t=tip.getBoundingClientRect();
    var left=Math.min(Math.max(8,r.left),window.innerWidth-t.width-8),top=r.bottom+6;
    if(top+t.height>window.innerHeight-8)top=r.top-t.height-6;
    tip.style.left=left+'px';tip.style.top=Math.max(8,top)+'px';
  }
  function hideTip(){if(tip)tip.style.display='none'}
  var hover=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  document.addEventListener('mouseover',function(e){
    if(!hover)return;
    var item=e.target.closest&&e.target.closest('#dashTodoList .ops-todo-item');
    if(!item||e.target.closest('[data-dash-todo-toggle]')){hideTip();return}
    if(truncated(item))showTip(item);else hideTip();
  });
  document.addEventListener('mouseout',function(e){
    var item=e.target.closest&&e.target.closest('#dashTodoList .ops-todo-item');
    if(item&&!(e.relatedTarget&&item.contains(e.relatedTarget)))hideTip();
  });
  window.addEventListener('scroll',hideTip,true);
  document.addEventListener('click',function(e){
    if(hover)return;
    var c=e.target.closest&&e.target.closest('#dashTodoList .todo-content');if(!c)return;
    var item=c.closest('.ops-todo-item');if(!item)return;
    if(item.classList.contains('todo-expanded')){item.classList.remove('todo-expanded');return}
    if(truncated(item))item.classList.add('todo-expanded');
  });
})();
