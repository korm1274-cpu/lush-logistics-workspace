/* Design Preview v1 — Main + Status Board only */
(function(){
  'use strict';
  var STORAGE_KEY='lush-design-preview-v1';
  var button=document.getElementById('designPreviewToggle');
  var stateLabel=document.getElementById('designPreviewToggleState');
  if(!button)return;

  function isEnabled(){
    try{return localStorage.getItem(STORAGE_KEY)==='on';}
    catch(e){return false;}
  }
  function getActiveView(){
    var active=document.querySelector('.view.active');
    return active ? active.id : '';
  }
  function animateCurrentView(){
    var view=document.querySelector('.view.active');
    if(!view || (view.id!=='dashboard' && view.id!=='statusBoardView'))return;
    view.classList.remove('design-preview-enter');
    void view.offsetWidth;
    view.classList.add('design-preview-enter');
    window.setTimeout(function(){view.classList.remove('design-preview-enter');},450);
  }
  function sync(){
    var enabled=isEnabled();
    var activeId=getActiveView();
    var home=enabled && activeId==='dashboard';
    var status=enabled && activeId==='statusBoardView';
    var inScope=home || status;

    document.body.classList.toggle('design-preview-enabled',enabled);
    document.body.classList.toggle('design-preview-scope',inScope);
    document.body.classList.toggle('design-preview-home',home);
    document.body.classList.toggle('design-preview-status',status);

    button.classList.toggle('is-on',enabled);
    button.setAttribute('aria-pressed',enabled ? 'true' : 'false');
    button.title=enabled
      ? '디자인 미리보기 ON · 메인과 현황판에만 적용됩니다.'
      : '디자인 미리보기 OFF · 클릭하면 메인과 현황판에 적용됩니다.';
    if(stateLabel)stateLabel.textContent=enabled ? 'ON' : 'OFF';
  }

  button.addEventListener('click',function(){
    var next=!isEnabled();
    try{localStorage.setItem(STORAGE_KEY,next ? 'on' : 'off');}catch(e){}
    sync();
    animateCurrentView();
  });

  var observer=new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      if(mutations[i].type==='attributes'){
        sync();
        if(isEnabled())animateCurrentView();
        break;
      }
    }
  });
  document.querySelectorAll('.view').forEach(function(view){
    observer.observe(view,{attributes:true,attributeFilter:['class']});
  });
  window.addEventListener('storage',function(event){
    if(event.key===STORAGE_KEY)sync();
  });
  sync();
})();