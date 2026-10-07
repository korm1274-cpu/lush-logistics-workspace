/* Design Preview v5 — live DOM re-composition, reversible */
(function(){
  'use strict';

  var STORAGE_KEY='lush-design-preview-v1';
  var button=document.getElementById('designPreviewToggle');
  var stateLabel=document.getElementById('designPreviewToggleState');
  var lastView='';
  var chartTimer=0;
  var mainLayoutActive=false;
  var statusLayoutState=null;
  if(!button)return;

  function enabled(){
    try{return localStorage.getItem(STORAGE_KEY)==='on';}
    catch(e){return false;}
  }

  function activeView(){
    var status=document.getElementById('statusBoardView');
    var dashboard=document.getElementById('dashboard');
    if(status&&status.classList.contains('active'))return 'statusBoardView';
    if(dashboard&&dashboard.classList.contains('active'))return 'dashboard';
    var el=document.querySelector('.view.active');
    return el?el.id:'';
  }

  function activeStatusTab(){
    var tab=document.querySelector('#statusBoardView .status-board-tab.active');
    return tab&&tab.dataset?tab.dataset.statusTab||'shipping':'shipping';
  }

  function heroSceneMarkup(){
    return '<div class="pv-hero-scene pv-decor-only" aria-hidden="true">'+
      '<svg viewBox="0 0 900 460" preserveAspectRatio="xMidYMid slice">'+
        '<defs>'+
          '<linearGradient id="pv5sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff9f5"/><stop offset=".55" stop-color="#e7dde0"/><stop offset="1" stop-color="#b5c2cc"/></linearGradient>'+
          '<linearGradient id="pv5wall" x1="0" y1="0" x2="1" y2=".2"><stop offset="0" stop-color="#f3f1ed"/><stop offset="1" stop-color="#c7cbcd"/></linearGradient>'+
          '<linearGradient id="pv5road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cccbc6"/><stop offset="1" stop-color="#9aa2a8"/></linearGradient>'+
          '<filter id="pv5blur"><feGaussianBlur stdDeviation="18"/></filter>'+
        '</defs>'+
        '<rect width="900" height="460" fill="url(#pv5sky)"/>'+
        '<circle class="pv-orb" cx="720" cy="66" r="125" fill="#ffd6e5" opacity=".5" filter="url(#pv5blur)"/>'+
        '<path d="M0 322 L900 252 L900 460 L0 460Z" fill="url(#pv5road)"/>'+
        '<path d="M230 143 L790 96 L850 130 L850 314 L230 333Z" fill="url(#pv5wall)"/>'+
        '<path d="M230 143 L790 96 L790 120 L230 168Z" fill="#bec2c4"/>'+
        '<text x="588" y="157" font-size="42" font-weight="900" fill="#3d3936" opacity=".84">LUSH</text>'+
        '<g fill="#46494b"><rect x="332" y="224" width="80" height="92" rx="4"/><rect x="449" y="213" width="80" height="95" rx="4"/><rect x="566" y="202" width="80" height="98" rx="4"/><rect x="683" y="191" width="80" height="101" rx="4"/></g>'+
        '<g class="pv-light" fill="#fff6d8" opacity=".82"><rect x="270" y="184" width="44" height="17"/><rect x="775" y="157" width="48" height="18"/></g>'+
        '<g transform="translate(95 250)">'+
          '<g transform="translate(0 42)"><polygon points="0,22 55,0 114,25 58,49" fill="#efc492"/><polygon points="0,22 58,49 58,106 0,78" fill="#bd855e"/><polygon points="58,49 114,25 114,80 58,106" fill="#d79f72"/></g>'+
          '<g transform="translate(102 2) scale(.82)"><polygon points="0,22 55,0 114,25 58,49" fill="#f6d1aa"/><polygon points="0,22 58,49 58,106 0,78" fill="#c68c64"/><polygon points="58,49 114,25 114,80 58,106" fill="#dfa97b"/></g>'+
        '</g>'+
        '<g class="pv-truck3d" transform="translate(456 294)">'+
          '<ellipse cx="112" cy="94" rx="112" ry="16" fill="#46484a" opacity=".16"/>'+
          '<rect x="0" y="17" width="132" height="58" rx="9" fill="#f7f5f0"/><rect x="105" y="31" width="66" height="44" rx="8" fill="#e3e5e4"/><path d="M132 33h28l15 21v21h-43z" fill="#d4d9db"/><rect x="138" y="37" width="20" height="14" rx="2" fill="#71929c"/><text x="18" y="52" font-size="18" font-weight="900" fill="#292826">LUSH</text>'+
          '<circle class="pv-wheel3d" cx="36" cy="79" r="14" fill="#242424"/><circle cx="36" cy="79" r="6" fill="#9b9b9b"/><circle class="pv-wheel3d" cx="139" cy="79" r="14" fill="#242424"/><circle cx="139" cy="79" r="6" fill="#9b9b9b"/>'+
        '</g>'+
        '<g fill="#fff" opacity=".34"><ellipse cx="620" cy="391" rx="178" ry="14"/><ellipse cx="746" cy="368" rx="92" ry="9"/></g>'+
      '</svg></div>';
  }

  function ensureDecor(){
    var hero=document.querySelector('#dashboard .lush-hero');
    if(hero&&!hero.querySelector('.pv-hero-scene'))hero.insertAdjacentHTML('beforeend',heroSceneMarkup());
    document.querySelectorAll('#designPreviewDashboard,#designPreviewStatusHeader').forEach(function(el){el.remove();});
  }

  function findMainNodes(){
    var dashboard=document.getElementById('dashboard');
    if(!dashboard)return null;
    var hero=dashboard.querySelector(':scope > .lush-hero');
    var first=dashboard.querySelector(':scope > .dashboard-first-section');
    var request=Array.from(dashboard.querySelectorAll(':scope > .dash-section')).find(function(x){return x.querySelector('#todayRequestGrid');});
    var schedule=dashboard.querySelector(':scope > .schedule-full-card');
    var monthly=Array.from(dashboard.querySelectorAll(':scope > .dash-section')).find(function(x){return x.querySelector('.monthly-grid');});
    if(!hero&&document.getElementById('pvMainLayout')){
      var layout=document.getElementById('pvMainLayout');
      hero=layout.querySelector('.lush-hero');
      first=layout.querySelector('.dashboard-first-section');
      request=layout.querySelector('.pv-main-requests')||Array.from(layout.querySelectorAll('.dash-section')).find(function(x){return x.querySelector('#todayRequestGrid');});
      schedule=layout.querySelector('.schedule-full-card');
      monthly=layout.querySelector('.monthly-grid')?.closest('.dash-section');
    }
    return {dashboard:dashboard,hero:hero,first:first,request:request,schedule:schedule,monthly:monthly};
  }

  function mountMainLayout(){
    if(mainLayoutActive)return;
    var n=findMainNodes();
    if(!n||!n.hero||!n.first||!n.request||!n.schedule||!n.monthly)return;

    var layout=document.createElement('div');
    layout.id='pvMainLayout';
    var stage=document.createElement('div');
    stage.className='pv-main-stage';
    var primary=document.createElement('div');
    primary.className='pv-main-primary';
    var context=document.createElement('aside');
    context.className='pv-main-context';

    n.request.classList.add('pv-main-requests');
    n.dashboard.appendChild(layout);
    layout.appendChild(n.hero);
    layout.appendChild(stage);
    stage.appendChild(primary);
    stage.appendChild(context);
    primary.appendChild(n.schedule);
    context.appendChild(n.first);
    context.appendChild(n.monthly);
    layout.appendChild(n.request);

    mainLayoutActive=true;
  }

  function unmountMainLayout(){
    var layout=document.getElementById('pvMainLayout');
    if(!layout){mainLayoutActive=false;return;}
    var dashboard=document.getElementById('dashboard');
    var hero=layout.querySelector('.lush-hero');
    var first=layout.querySelector('.dashboard-first-section');
    var request=layout.querySelector('.pv-main-requests');
    var schedule=layout.querySelector('.schedule-full-card');
    var monthly=layout.querySelector('.monthly-grid')?.closest('.dash-section');
    if(hero)dashboard.insertBefore(hero,layout);
    if(first)dashboard.insertBefore(first,layout);
    if(request){request.classList.remove('pv-main-requests');dashboard.insertBefore(request,layout);}
    if(schedule)dashboard.insertBefore(schedule,layout);
    if(monthly)dashboard.insertBefore(monthly,layout);
    layout.remove();
    mainLayoutActive=false;
  }

  function pickStatusContainer(){
    var panel=document.querySelector('#statusBoardView .status-panel.active');
    if(!panel)return null;
    return panel.querySelector('.productivity-section.active,.boxcount-section.active,.product-outbound-panel.active')||panel;
  }

  function classifyStatusChild(el,index){
    if(el.matches('.productivity-subtabs,.boxcount-subtabs,.product-outbound-tabs,.store-history-modebar,.status-card.status-toolbar-card,.status-card.analysis-standard-head,.status-card.boxcount-analysis-head,.status-card.detail-overview-card'))return 'pv-full';
    if(el.matches('.chart-card,.store-history-analysis,.boxcount-analysis-layout,.boxcount-feature-grid'))return index%2===0?'pv-wide':'pv-side';
    if(el.matches('.table-card,.store-history-summary,.boxcount-triple-grid'))return 'pv-side';
    return index===0?'pv-full':(index%3===0?'pv-side':'pv-wide');
  }

  function unmountStatusLayout(){
    if(!statusLayoutState)return;
    var state=statusLayoutState;
    state.items.forEach(function(item){
      item.el.classList.remove('pv-full','pv-wide','pv-side','pv-span');
      if(item.next&&item.next.parentNode===state.container){
        state.container.insertBefore(item.el,item.next);
      }else{
        state.container.appendChild(item.el);
      }
    });
    if(state.layout&&state.layout.parentNode)state.layout.remove();
    statusLayoutState=null;
  }

  function mountStatusLayout(){
    if(activeStatusTab()==='shipping'){unmountStatusLayout();return;}
    var container=pickStatusContainer();
    if(!container)return;

    if(statusLayoutState&&statusLayoutState.container===container)return;
    unmountStatusLayout();

    var children=Array.from(container.children).filter(function(el){
      return !el.classList.contains('pv-status-detail-layout');
    });
    if(children.length<2)return;

    var layout=document.createElement('div');
    layout.className='pv-status-detail-layout';
    var items=children.map(function(el,index){
      return {el:el,next:el.nextSibling,index:index};
    });
    container.appendChild(layout);
    children.forEach(function(el,index){
      el.classList.add(classifyStatusChild(el,index));
      layout.appendChild(el);
    });
    statusLayoutState={container:container,layout:layout,items:items};
  }

  function backupDataset(ds){
    return {borderColor:ds.borderColor,backgroundColor:ds.backgroundColor,fill:ds.fill,borderWidth:ds.borderWidth,pointRadius:ds.pointRadius,pointHoverRadius:ds.pointHoverRadius,pointBackgroundColor:ds.pointBackgroundColor,pointBorderColor:ds.pointBorderColor,pointBorderWidth:ds.pointBorderWidth,tension:ds.tension,borderRadius:ds.borderRadius,borderSkipped:ds.borderSkipped,hoverOffset:ds.hoverOffset};
  }

  function restoreCharts(){
    if(typeof Chart==='undefined'||!Chart.getChart)return;
    document.querySelectorAll('#statusBoardView canvas').forEach(function(canvas){
      var chart=Chart.getChart(canvas);
      if(!chart||!chart.$pvBackup)return;
      chart.data.datasets.forEach(function(ds,i){
        var b=chart.$pvBackup.datasets[i]||{};
        Object.keys(b).forEach(function(k){ds[k]=b[k];});
      });
      if(chart.options){
        chart.options.animation=chart.$pvBackup.animation;
        chart.options.interaction=chart.$pvBackup.interaction;
      }
      chart.$pvStyled=false;
      try{chart.update('none');}catch(e){try{chart.update();}catch(_){}}
    });
  }

  function applyChartTheme(){
    if(!enabled()||activeView()!=='statusBoardView'||activeStatusTab()==='shipping'){restoreCharts();return;}
    if(typeof Chart==='undefined'||!Chart.getChart)return;
    var panel=document.querySelector('#statusBoardView .status-panel.active');
    if(!panel)return;

    panel.querySelectorAll('canvas').forEach(function(canvas){
      var chart=Chart.getChart(canvas);
      if(!chart)return;
      if(!chart.$pvBackup){
        chart.$pvBackup={datasets:chart.data.datasets.map(backupDataset),animation:chart.options?chart.options.animation:undefined,interaction:chart.options?chart.options.interaction:undefined};
      }

      var ctx=canvas.getContext('2d');
      var h=Math.max(canvas.height||0,canvas.clientHeight||280);
      var pink=ctx.createLinearGradient(0,0,0,h);
      pink.addColorStop(0,'rgba(237,88,141,.46)');pink.addColorStop(.55,'rgba(237,88,141,.17)');pink.addColorStop(1,'rgba(237,88,141,.012)');
      var green=ctx.createLinearGradient(0,0,0,h);
      green.addColorStop(0,'rgba(21,150,108,.38)');green.addColorStop(1,'rgba(21,150,108,.015)');
      var bar=ctx.createLinearGradient(0,0,0,h);
      bar.addColorStop(0,'#ff8cb2');bar.addColorStop(.52,'#ed588d');bar.addColorStop(1,'#9f315e');

      chart.data.datasets.forEach(function(ds,i){
        var type=ds.type||chart.config.type||'line';
        if(type==='line'){
          ds.borderColor=i%2===0?'#ed588d':'#15966c';
          ds.backgroundColor=i%2===0?pink:green;
          ds.fill=true;ds.borderWidth=3;ds.pointRadius=0;ds.pointHoverRadius=7;
          ds.pointBackgroundColor=i%2===0?'#ed588d':'#15966c';ds.pointBorderColor='#fff';ds.pointBorderWidth=3;ds.tension=.4;
        }else if(type==='bar'){
          ds.backgroundColor=bar;ds.borderColor='rgba(255,255,255,.25)';ds.borderWidth=1;ds.borderRadius=11;ds.borderSkipped=false;
        }else if(type==='doughnut'||type==='pie'){
          ds.borderWidth=0;ds.hoverOffset=12;
          if(!Array.isArray(ds.backgroundColor))ds.backgroundColor=['#ed588d','#15966c','#d98a22','#8f78c7','#64a8c7','#a9b2b8'];
        }
      });

      if(chart.options){
        chart.options.animation={duration:700,easing:'easeOutQuart'};
        chart.options.interaction={mode:'index',intersect:false};
        if(chart.options.plugins&&chart.options.plugins.tooltip){
          chart.options.plugins.tooltip.backgroundColor='rgba(25,24,22,.93)';
          chart.options.plugins.tooltip.titleColor='#fff';
          chart.options.plugins.tooltip.bodyColor='#f5f2ee';
          chart.options.plugins.tooltip.padding=12;
          chart.options.plugins.tooltip.cornerRadius=10;
        }
        if(chart.options.scales){
          Object.keys(chart.options.scales).forEach(function(key){
            var scale=chart.options.scales[key];
            if(scale.grid)scale.grid.color=key==='x'?'rgba(0,0,0,0)':'rgba(35,31,28,.06)';
            if(scale.border)scale.border.display=false;
            if(scale.ticks)scale.ticks.color='#88817a';
          });
        }
      }
      try{chart.update();}catch(e){}
    });
  }

  function scheduleChartTheme(){
    clearTimeout(chartTimer);
    chartTimer=setTimeout(applyChartTheme,90);
    setTimeout(applyChartTheme,350);
  }

  function sync(){
    ensureDecor();
    var on=enabled();
    var view=activeView();
    var home=on&&view==='dashboard';
    var status=on&&view==='statusBoardView';
    var statusDetail=status&&activeStatusTab()!=='shipping';

    document.body.classList.toggle('design-preview-enabled',on);
    document.body.classList.toggle('design-preview-scope',home||status);
    document.body.classList.toggle('design-preview-home',home);
    document.body.classList.toggle('design-preview-status',status);
    document.body.classList.toggle('design-preview-status-detail',statusDetail);
    document.body.dataset.previewStatusTab=status?activeStatusTab():'';

    button.classList.toggle('is-on',on);
    button.setAttribute('aria-pressed',on?'true':'false');
    if(stateLabel)stateLabel.textContent=on?'ON':'OFF';

    if(home)mountMainLayout();else unmountMainLayout();
    if(statusDetail){mountStatusLayout();scheduleChartTheme();}else{unmountStatusLayout();restoreCharts();}
  }

  button.addEventListener('click',function(){
    var next=!enabled();
    try{localStorage.setItem(STORAGE_KEY,next?'on':'off');}catch(e){}
    sync();
  });

  document.addEventListener('click',function(e){
    var hit=e.target.closest&&e.target.closest('#statusBoardView .status-board-tab,.productivity-subtab,.boxcount-subtab,.product-outbound-tab,.store-mode-btn,[data-menu-id]');
    if(hit){
      setTimeout(sync,0);
      setTimeout(sync,110);
      setTimeout(scheduleChartTheme,360);
    }
  },true);

  var observer=new MutationObserver(function(){
    clearTimeout(observer._t);
    observer._t=setTimeout(function(){
      var view=activeView();
      if(view!==lastView)lastView=view;
      sync();
    },45);
  });
  document.querySelectorAll('.view,#statusBoardView .status-board-tab,#statusBoardView .status-panel,#statusBoardView .productivity-section,#statusBoardView .boxcount-section,#statusBoardView .product-outbound-panel').forEach(function(el){
    observer.observe(el,{attributes:true,attributeFilter:['class']});
  });

  window.addEventListener('resize',function(){if(enabled())scheduleChartTheme();});
  window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY)sync();});

  lastView=activeView();
  ensureDecor();
  sync();
})();