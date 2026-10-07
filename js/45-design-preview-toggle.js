/* Design Preview v6 — safe visual layer, no DOM movement */
(function(){
  'use strict';

  var STORAGE_KEY='lush-design-preview-v1';
  var button=document.getElementById('designPreviewToggle');
  var stateLabel=document.getElementById('designPreviewToggleState');
  var chartTimer=0;
  var revealObserver=null;
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

  function initReveal(){
    if(revealObserver)revealObserver.disconnect();
    var items=document.querySelectorAll('#dashboard > .lush-hero,#dashboard > .dash-section');
    if(!('IntersectionObserver' in window)){
      items.forEach(function(el){el.classList.add('pv-in');});
      return;
    }
    revealObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('pv-in');
          revealObserver.unobserve(entry.target);
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -8% 0px'});
    items.forEach(function(el){
      el.classList.remove('pv-in');
      revealObserver.observe(el);
    });
  }

  function clearReveal(){
    if(revealObserver){revealObserver.disconnect();revealObserver=null;}
    document.querySelectorAll('#dashboard > .lush-hero,#dashboard > .dash-section').forEach(function(el){el.classList.remove('pv-in');});
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
      try{chart.update('none');}catch(e){try{chart.update();}catch(_){}}
      delete chart.$pvBackup;
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
      var h=Math.max(canvas.height||0,canvas.clientHeight||300);
      var pink=ctx.createLinearGradient(0,0,0,h);
      pink.addColorStop(0,'rgba(237,88,141,.48)');
      pink.addColorStop(.52,'rgba(237,88,141,.18)');
      pink.addColorStop(1,'rgba(237,88,141,.015)');
      var green=ctx.createLinearGradient(0,0,0,h);
      green.addColorStop(0,'rgba(21,150,108,.40)');
      green.addColorStop(1,'rgba(21,150,108,.015)');
      var bar=ctx.createLinearGradient(0,0,0,h);
      bar.addColorStop(0,'#ff93b8');
      bar.addColorStop(.5,'#ed588d');
      bar.addColorStop(1,'#9d315d');

      chart.data.datasets.forEach(function(ds,i){
        var type=ds.type||chart.config.type||'line';
        if(type==='line'){
          ds.borderColor=i%2===0?'#ed588d':'#15966c';
          ds.backgroundColor=i%2===0?pink:green;
          ds.fill=true;
          ds.borderWidth=3;
          ds.pointRadius=0;
          ds.pointHoverRadius=8;
          ds.pointBackgroundColor=i%2===0?'#ed588d':'#15966c';
          ds.pointBorderColor='#fff';
          ds.pointBorderWidth=3;
          ds.tension=.42;
        }else if(type==='bar'){
          ds.backgroundColor=bar;
          ds.borderColor='rgba(255,255,255,.28)';
          ds.borderWidth=1;
          ds.borderRadius=12;
          ds.borderSkipped=false;
        }else if(type==='doughnut'||type==='pie'){
          ds.borderWidth=0;
          ds.hoverOffset=13;
        }
      });

      if(chart.options){
        chart.options.animation={duration:720,easing:'easeOutQuart'};
        chart.options.interaction={mode:'index',intersect:false};
        if(chart.options.plugins&&chart.options.plugins.tooltip){
          chart.options.plugins.tooltip.backgroundColor='rgba(24,23,21,.94)';
          chart.options.plugins.tooltip.titleColor='#fff';
          chart.options.plugins.tooltip.bodyColor='#f7f4ef';
          chart.options.plugins.tooltip.padding=12;
          chart.options.plugins.tooltip.cornerRadius=11;
        }
        if(chart.options.scales){
          Object.keys(chart.options.scales).forEach(function(key){
            var scale=chart.options.scales[key];
            if(scale.grid)scale.grid.color=key==='x'?'rgba(0,0,0,0)':'rgba(35,31,28,.055)';
            if(scale.border)scale.border.display=false;
            if(scale.ticks)scale.ticks.color='#8a827a';
          });
        }
      }
      try{chart.update();}catch(e){}
    });
  }

  function scheduleCharts(){
    clearTimeout(chartTimer);
    chartTimer=setTimeout(applyChartTheme,80);
    setTimeout(applyChartTheme,300);
  }


  function cinematicMarkup(){
    function cube(cls){
      return '<div class="pv-cube '+cls+'"><div class="pv-cube-inner">'+
        '<i class="pv-face front"></i><i class="pv-face back"></i><i class="pv-face right"></i>'+
        '<i class="pv-face left"></i><i class="pv-face top"></i><i class="pv-face bottom"></i>'+
      '</div></div>';
    }
    return '<div class="pv-cinematic-scene" aria-hidden="true">'+
      '<div class="pv-photo-layer"></div><div class="pv-depth-haze"></div>'+
      '<div class="pv-glass-orbit"></div>'+
      '<div class="pv-3d-stage">'+cube('c1')+cube('c2')+cube('c3')+'</div>'+
    '</div>';
  }

  function ensureCinematic(){
    var hero=document.querySelector('#dashboard>.lush-hero');
    if(!hero)return;
    if(!hero.querySelector('.pv-cinematic-scene'))hero.insertAdjacentHTML('afterbegin',cinematicMarkup());
  }

  function resetCinematic(){
    var hero=document.querySelector('#dashboard>.lush-hero');
    if(!hero)return;
    hero.style.setProperty('--pv-x','0');
    hero.style.setProperty('--pv-y','0');
    hero.style.setProperty('--pv-scroll','0');
  }

  function sync(){
    var on=enabled();
    var view=activeView();
    var home=on&&view==='dashboard';
    var status=on&&view==='statusBoardView';
    var detail=status&&activeStatusTab()!=='shipping';

    document.body.classList.toggle('design-preview-enabled',on);
    document.body.classList.toggle('design-preview-scope',home||status);
    document.body.classList.toggle('design-preview-home',home);
    document.body.classList.toggle('design-preview-status',status);
    document.body.classList.toggle('design-preview-status-detail',detail);

    button.classList.toggle('is-on',on);
    button.setAttribute('aria-pressed',on?'true':'false');
    if(stateLabel)stateLabel.textContent=on?'ON':'OFF';

    if(home){ensureCinematic();initReveal();}else{clearReveal();resetCinematic();}
    if(detail)scheduleCharts();else restoreCharts();
  }

  button.addEventListener('click',function(){
    var next=!enabled();
    try{localStorage.setItem(STORAGE_KEY,next?'on':'off');}catch(e){}
    sync();
  });

  document.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('#statusBoardView .status-board-tab,.productivity-subtab,.boxcount-subtab,.product-outbound-tab,.store-mode-btn,[data-menu-id]')){
      setTimeout(sync,0);
      setTimeout(sync,90);
      setTimeout(scheduleCharts,330);
    }
  },true);

  var observer=new MutationObserver(function(){
    clearTimeout(observer._pv);
    observer._pv=setTimeout(sync,45);
  });
  document.querySelectorAll('.view,#statusBoardView .status-board-tab,#statusBoardView .status-panel,#statusBoardView .productivity-section,#statusBoardView .boxcount-section,#statusBoardView .product-outbound-panel').forEach(function(el){
    observer.observe(el,{attributes:true,attributeFilter:['class']});
  });

  /* independent depth parallax — decoration only */
  document.addEventListener('pointermove',function(e){
    if(!document.body.classList.contains('design-preview-home'))return;
    var hero=document.querySelector('#dashboard>.lush-hero');
    if(!hero)return;
    var r=hero.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){
      hero.style.setProperty('--pv-x','0');
      hero.style.setProperty('--pv-y','0');
      return;
    }
    var x=((e.clientX-r.left)/r.width-.5)*2;
    var y=((e.clientY-r.top)/r.height-.5)*2;
    hero.style.setProperty('--pv-x',String(x.toFixed(3)));
    hero.style.setProperty('--pv-y',String(y.toFixed(3)));
  },{passive:true});

  var scrollRaf=0;
  window.addEventListener('scroll',function(){
    if(!document.body.classList.contains('design-preview-home'))return;
    if(scrollRaf)return;
    scrollRaf=requestAnimationFrame(function(){
      scrollRaf=0;
      var hero=document.querySelector('#dashboard>.lush-hero');
      if(!hero)return;
      var r=hero.getBoundingClientRect();
      var offset=Math.max(-320,Math.min(320,-r.top));
      hero.style.setProperty('--pv-scroll',String(offset));
    });
  },{passive:true});

  window.addEventListener('resize',function(){if(enabled())scheduleCharts();});
  window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY)sync();});
  sync();
})();