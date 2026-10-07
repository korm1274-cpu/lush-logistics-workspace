/* <script> (index.html에서 그대로 옮김) */
(function(){
  const tip=document.createElement.bind(document);
  let box=document.getElementById('globalHoverTip');
  function escTip(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function show(el,x,y){
    let items=[];
    try{items=JSON.parse(el.dataset.tip||'[]')}catch(e){items=[]}
    box.innerHTML=items.map(it=>`<div style="color:${it.c}">${escTip(it.t)}</div>`).join('')||'';
    box.style.display='block';
    const r=box.getBoundingClientRect();
    let left=x+12,top=y+12;
    if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8;
    if(top+r.height>window.innerHeight-8)top=y-r.height-12;
    box.style.left=left+'px';
    box.style.top=top+'px';
  }
  function hide(){box.style.display='none'}
  document.addEventListener('mouseover',e=>{
    const t=e.target.closest('.hover-tip-target');
    if(t)show(t,e.clientX,e.clientY);
  });
  document.addEventListener('mousemove',e=>{
    if(box.style.display==='block'&&e.target.closest('.hover-tip-target'))show(e.target.closest('.hover-tip-target'),e.clientX,e.clientY);
  });
  document.addEventListener('mouseout',e=>{
    if(e.target.closest('.hover-tip-target')&&!e.relatedTarget?.closest?.('.hover-tip-target'))hide();
  });
})();

