/* Design Preview v4 — non-invasive presentation layer */
(function(){
  'use strict';

  var STORAGE_KEY='lush-design-preview-v1';
  var button=document.getElementById('designPreviewToggle');
  var stateLabel=document.getElementById('designPreviewToggleState');
  var lastView='';
  var chartTimer=0;
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
          '<linearGradient id="pv4sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8f4"/><stop offset=".56" stop-color="#e7dde0"/><stop offset="1" stop-color="#b6c1ca"/></linearGradient>'+
          '<linearGradient id="pv4wall" x1="0" y1="0" x2="1" y2=".2"><stop offset="0" stop-color="#f1efeb"/><stop offset="1" stop-color="#c8cacb"/></linearGradient>'+
          '<linearGradient id="pv4road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9c8c4"/><stop offset="1" stop-color="#9da5aa"/></linearGradient>'+
          '<linearGradient id="pv4box" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5c799"/><stop offset="1" stop-color="#a8734f"/></linearGradient>'+
          '<filter id="pv4blur"><feGaussianBlur stdDeviation="18"/></filter>'+
        '</defs>'+
        '<rect width="900" height="460" fill="url(#pv4sky)"/>'+
        '<circle class="pv-orb" cx="718" cy="65" r="120" fill="#ffd7e5" opacity=".48" filter="url(#pv4blur)"/>'+
        '<path d="M0 322 L900 254 L900 460 L0 460Z" fill="url(#pv4road)"/>'+
        '<path d="M235 145 L790 98 L850 130 L850 314 L235 333Z" fill="url(#pv4wall)"/>'+
        '<path d="M235 145 L790 98 L790 121 L235 168Z" fill="#bfc1c2"/>'+
        '<text x="586" y="158" font-size="42" font-weight="900" fill="#3e3936" opacity=".84">LUSH</text>'+
        '<g fill="#44484a"><rect x="337" y="225" width="78" height="92" rx="4"/><rect x="452" y="214" width="78" height="94" rx="4"/><rect x="567" y="203" width="78" height="96" rx="4"/><rect x="682" y="192" width="78" height="98" rx="4"/></g>'+
        '<g class="pv-light" fill="#fff7dd" opacity=".82"><rect x="274" y="184" width="43" height="17"/><rect x="774" y="157" width="48" height="18"/></g>'+
        '<g transform="translate(110 255)">'+
          '<g transform="translate(0 38)"><polygon points="0,22 54,0 112,25 57,48" fill="#efc391"/><polygon points="0,22 57,48 57,104 0,77" fill="#bf875f"/><polygon points="57,48 112,25 112,79 57,104" fill="#d49b70"/></g>'+
          '<g transform="translate(92 0) scale(.82)"><polygon points="0,22 54,0 112,25 57,48" fill="#f6d1a9"/><polygon points="0,22 57,48 57,104 0,77" fill="#c58c65"/><polygon points="57,48 112,25 112,79 57,104" fill="#dda679"/></g>'+
        '</g>'+
        '<g class="pv-truck3d" transform="translate(455 295)">'+
          '<ellipse cx="112" cy="92" rx="110" ry="16" fill="#46484a" opacity=".16"/>'+
          '<rect x="0" y="17" width="132" height="58" rx="9" fill="#f6f4ef"/><rect x="105" y="31" width="66" height="44" rx="8" fill="#e2e4e3"/><path d="M132 33h28l15 21v21h-43z" fill="#d3d8da"/><rect x="138" y="37" width="20" height="14" rx="2" fill="#70919b"/><text x="18" y="52" font-size="18" font-weight="900" fill="#292826">LUSH</text>'+
          '<circle class="pv-wheel3d" cx="36" cy="79" r="14" fill="#242424"/><circle cx="36" cy="79" r="6" fill="#9b9b9b"/><circle class="pv-wheel3d" cx="139" cy="79" r="14" fill="#242424"/><circle cx="139" cy="79" r="6" fill="#9b9b9b"/>'+
        '</g>'+
        '<g fill="#fff" opacity=".35"><ellipse cx="620" cy="390" rx="175" ry="14"/><ellipse cx="745" cy="367" rx="90" ry="9"/></g>'+
      '</svg></div>';
  }

  function ensureDecor(){
    var hero=document.querySelector('#dashboard .lush-hero');
    if(hero&&!hero.querySelector('.pv-hero-scene'))hero.insertAdjacentHTML('beforeend',heroSceneMarkup());
    document.querySelectorAll('#designPreviewDashboard,#designPreviewStatusHeader').forEach(function(el){el.remove();});
  }

  function backupDataset(ds){
    return {
      borderColor:ds.borderColor,backgroundColor:ds.backgroundColor,fill:ds.fill,
      borderWidth:ds.borderWidth,pointRadius:ds.pointRadius,pointHoverRadius:ds.pointHoverRadius,
      pointBackgroundColor:ds.pointBackgroundColor,pointBorderColor:ds.pointBorderColor,
      pointBorderWidth:ds.pointBorderWidth,tension:ds.tension,borderRadius:ds.borderRadius,
      borderSkipped:ds.borderSkipped,hoverOffset:ds.hoverOffset
    };
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
        chart.$pvBackup={
          datasets:chart.data.datasets.map(backupDataset),
          animation:chart.options?chart.options.animation:undefined,
          interaction:chart.options?chart.options.interaction:undefined
        };
      }

      var ctx=canvas.getContext('2d');
      var h=Math.max(canvas.height||0,canvas.clientHeight||280);
      var pink=ctx.createLinearGradient(0,0,0,h);
      pink.addColorStop(0,'rgba(237,88,141,.42)');
      pink.addColorStop(.55,'rgba(237,88,141,.16)');
      pink.addColorStop(1,'rgba(237,88,141,.015)');
      var green=ctx.createLinearGradient(0,0,0,h);
      green.addColorStop(0,'rgba(21,150,108,.36)');
      green.addColorStop(1,'rgba(21,150,108,.02)');
      var bar=ctx.createLinearGradient(0,0,0,h);
      bar.addColorStop(0,'#ff86ae');
      bar.addColorStop(.55,'#ed588d');
      bar.addColorStop(1,'#a73362');

      chart.data.datasets.forEach(function(ds,i){
        var type=ds.type||chart.config.type||'line';
        if(type==='line'){
          ds.borderColor=i%2===0?'#ed588d':'#15966c';
          ds.backgroundColor=i%2===0?pink:green;
          ds.fill=true;
          ds.borderWidth=3;
          ds.pointRadius=0;
          ds.pointHoverRadius=7;
          ds.pointBackgroundColor=i%2===0?'#ed588d':'#15966c';
          ds.pointBorderColor='#fff';
          ds.pointBorderWidth=3;
          ds.tension=.38;
        }else if(type==='bar'){
          ds.backgroundColor=bar;
          ds.borderColor='rgba(255,255,255,.25)';
          ds.borderWidth=1;
          ds.borderRadius=10;
          ds.borderSkipped=false;
        }else if(type==='doughnut'||type==='pie'){
          ds.borderWidth=0;
          ds.hoverOffset=12;
          if(!Array.isArray(ds.backgroundColor))ds.backgroundColor=['#ed588d','#15966c','#d98a22','#8f78c7','#64a8c7','#a9b2b8'];
        }
      });

      if(chart.options){
        chart.options.animation={duration:650,easing:'easeOutQuart'};
        chart.options.interaction={mode:'index',intersect:false};
        if(chart.options.plugins&&chart.options.plugins.tooltip){
          chart.options.plugins.tooltip.backgroundColor='rgba(25,24,22,.92)';
          chart.options.plugins.tooltip.titleColor='#fff';
          chart.options.plugins.tooltip.bodyColor='#f5f2ee';
          chart.options.plugins.tooltip.padding=12;
          chart.options.plugins.tooltip.cornerRadius=10;
        }
        if(chart.options.plugins&&chart.options.plugins.legend&&chart.options.plugins.legend.labels){
          chart.options.plugins.legend.labels.usePointStyle=true;
          chart.options.plugins.legend.labels.boxWidth=8;
          chart.options.plugins.legend.labels.boxHeight=8;
        }
        if(chart.options.scales){
          Object.keys(chart.options.scales).forEach(function(key){
            var scale=chart.options.scales[key];
            if(scale.grid)scale.grid.color=key==='x'?'rgba(0,0,0,0)':'rgba(35,31,28,.065)';
            if(scale.border)scale.border.display=false;
            if(scale.ticks)scale.ticks.color='#88817a';
          });
        }
      }
      chart.$pvStyled=true;
      try{chart.update();}catch(e){}
    });
  }

  function scheduleChartTheme(){
    clearTimeout(chartTimer);
    chartTimer=setTimeout(applyChartTheme,70);
    setTimeout(applyChartTheme,320);
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
    button.title=on?'디자인 미리보기 ON · 메인 및 현황판 분석 탭에 적용 중':'디자인 미리보기 OFF';

    if(statusDetail)scheduleChartTheme();
    else restoreCharts();
  }

  button.addEventListener('click',function(){
    var next=!enabled();
    try{localStorage.setItem(STORAGE_KEY,next?'on':'off');}catch(e){}
    sync();
  });

  document.addEventListener('click',function(e){
    var tab=e.target.closest&&e.target.closest('#statusBoardView .status-board-tab,.productivity-subtab,.boxcount-subtab,.product-outbound-tab,.store-mode-btn,[data-status-tab]');
    var nav=e.target.closest&&e.target.closest('[data-menu-id]');
    if(tab||nav){
      setTimeout(sync,0);
      setTimeout(sync,90);
      setTimeout(scheduleChartTheme,260);
    }
  },true);

  var observer=new MutationObserver(function(mutations){
    var view=activeView();
    var changed=view!==lastView;
    if(changed)lastView=view;
    var relevant=changed||mutations.some(function(m){
      return m.type==='attributes'&&m.attributeName==='class';
    });
    if(relevant){
      clearTimeout(observer._t);
      observer._t=setTimeout(sync,35);
    }
  });
  document.querySelectorAll('.view,#statusBoardView .status-board-tab,#statusBoardView .status-panel,#statusBoardView .productivity-section,#statusBoardView .boxcount-section').forEach(function(el){
    observer.observe(el,{attributes:true,attributeFilter:['class']});
  });

  window.addEventListener('resize',function(){if(enabled())scheduleChartTheme();});
  window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY)sync();});

  lastView=activeView();
  ensureDecor();
  sync();
})();