/* <script id="v113-tab-reorder"> (index.html에서 그대로 옮김) */
(function(){
  var configs=[
    {container:'.productivity-subtabs',tab:'.productivity-subtab',attr:'productivityView',key:'lush_tab_order_productivity_v1'},
    {container:'.boxcount-subtabs',tab:'.boxcount-subtab',attr:'boxcountView',key:'lush_tab_order_boxcount_v1'},
    {container:'.outbound-analysis-subtabs',tab:'.outbound-analysis-subtab',attr:'outboundAnalysisView',key:'lush_tab_order_outbound_v1'}
  ];

  function setup(cfg){
    var box=document.querySelector(cfg.container);if(!box)return;
    var saved=[];
    try{saved=JSON.parse(localStorage.getItem(cfg.key)||'[]')}catch(e){}
    if(Array.isArray(saved)&&saved.length){
      saved.forEach(function(v){
        var el=Array.prototype.find.call(box.querySelectorAll(cfg.tab),function(x){return x.dataset[cfg.attr]===v});
        if(el)box.appendChild(el);
      });
    }

    var state={el:null,pointerId:null,startX:0,startY:0,lastX:0,moved:false};

    function saveOrder(){
      var order=Array.prototype.map.call(box.querySelectorAll(cfg.tab),function(x){return x.dataset[cfg.attr]});
      try{localStorage.setItem(cfg.key,JSON.stringify(order))}catch(e){}
    }

    function begin(tab,e){
      if(e.pointerType==='mouse'&&e.button!==0)return;
      state.el=tab;
      state.pointerId=e.pointerId;
      state.startX=e.clientX;
      state.startY=e.clientY;
      state.lastX=e.clientX;
      state.moved=false;
      try{tab.setPointerCapture&&tab.setPointerCapture(e.pointerId)}catch(err){}
    }

    function move(e){
      if(!state.el||e.pointerId!==state.pointerId)return;
      var dx=e.clientX-state.startX,dy=e.clientY-state.startY;
      if(!state.moved){
        if(Math.abs(dx)<3&&Math.abs(dy)<6)return;
        if(Math.abs(dy)>Math.abs(dx)*1.8)return;
        state.moved=true;
        state.el.classList.add('tab-dragging');
      }
      e.preventDefault();
      state.lastX=e.clientX;

      var tabs=Array.prototype.filter.call(box.querySelectorAll(cfg.tab),function(x){return x!==state.el});
      if(!tabs.length)return;

      tabs.forEach(function(tab){tab.classList.remove('tab-drop-before','tab-drop-after')});

      var x=e.clientX;
      var nearest=tabs[0],nearestDist=Infinity;
      tabs.forEach(function(tab){
        var r=tab.getBoundingClientRect(),center=r.left+r.width/2,dist=Math.abs(x-center);
        if(dist<nearestDist){nearestDist=dist;nearest=tab}
      });

      var rect=nearest.getBoundingClientRect(),after=x>=rect.left+rect.width/2;
      nearest.classList.add(after?'tab-drop-after':'tab-drop-before');

      if(!after){
        if(state.el.nextElementSibling!==nearest)box.insertBefore(state.el,nearest);
      }else{
        if(nearest.nextElementSibling!==state.el)box.insertBefore(state.el,nearest.nextElementSibling);
      }

      var br=box.getBoundingClientRect(),edge=34;
      if(x<br.left+edge)box.scrollLeft-=14;
      else if(x>br.right-edge)box.scrollLeft+=14;
    }

    function end(e){
      if(!state.el||e.pointerId!==state.pointerId)return;
      var tab=state.el;
      try{tab.releasePointerCapture&&tab.releasePointerCapture(e.pointerId)}catch(err){}
      tab.classList.remove('tab-dragging');
      Array.prototype.forEach.call(box.querySelectorAll(cfg.tab),function(x){x.classList.remove('tab-drop-before','tab-drop-after')});
      if(state.moved){
        saveOrder();
        tab.dataset.dragJustEnded='1';
        setTimeout(function(){delete tab.dataset.dragJustEnded},180);
      }
      state.el=null;
      state.pointerId=null;
      state.moved=false;
    }

    Array.prototype.forEach.call(box.querySelectorAll(cfg.tab),function(tab){
      tab.classList.add('draggable-tab');
      tab.addEventListener('pointerdown',function(e){begin(tab,e)});
    });
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);

    box.addEventListener('click',function(e){
      var t=e.target.closest&&e.target.closest(cfg.tab);
      if(t&&t.dataset.dragJustEnded==='1'){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },true);
  }

  configs.forEach(setup);
})();

