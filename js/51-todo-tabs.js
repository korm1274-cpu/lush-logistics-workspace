/* 제품 확보 등록·공지 등록: [목록] [등록] 탭으로 나눔(제품 불량 화면과 같은 방식)
   - 기본은 목록, 수정을 누르면 등록 탭에서 고치고, 등록·수정 저장·취소 후에는 목록으로 돌아감
   - 목록 탭 옆 숫자: 제품 확보는 미완료 건수, 공지는 전체 건수 */
(function(){
  var $=function(id){return document.getElementById(id)};
  var SETUPS=[
    {view:'todoManagerView',key:'lush-v51-todos',body:'todoMgrBody',add:'todoMgrAdd',cancel:'todoMgrCancel',input:'todoMgrContent',edit:'[data-todo-edit]',count:function(a){return a.filter(function(x){return x&&!x.done}).length}},
    {view:'noticeManagerView',key:'lush-v51-notices',body:'noticeMgrBody',add:'noticeMgrAdd',cancel:'noticeMgrCancel',input:'noticeMgrTitle',edit:'[data-notice-edit]',count:function(a){return a.filter(Boolean).length}}
  ];
  function setup(s){
    var view=$(s.view);if(!view||!view.querySelector('[data-td-tab]'))return;
    function showTab(t){
      view.querySelectorAll('[data-td-tab]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-td-tab')===t)});
      view.querySelectorAll('[data-td-pane]').forEach(function(p){p.hidden=p.getAttribute('data-td-pane')!==t});
      if(t==='form')setTimeout(function(){var c=$(s.input);if(c)c.focus()},30);
    }
    function count(){
      var el=view.querySelector('.td-count');if(!el)return;
      var a=[];try{a=JSON.parse(localStorage.getItem(s.key)||'[]')}catch(e){}
      var n=Array.isArray(a)?s.count(a):0;
      el.textContent=n?String(n):'';
    }
    view.querySelectorAll('[data-td-tab]').forEach(function(b){b.addEventListener('click',function(){
      var t=b.getAttribute('data-td-tab');
      // 수정 중에 목록으로 나가면 수정 취소
      if(t==='list'){var c=$(s.cancel);if(c&&!c.hidden)c.click()}
      showTab(t);
    })});
    var body=$(s.body);
    if(body){
      body.addEventListener('click',function(e){if(e.target.closest(s.edit))showTab('form')});
      new MutationObserver(count).observe(body,{childList:true});
    }
    var add=$(s.add);
    if(add)add.addEventListener('click',function(){setTimeout(function(){var c=$(s.input);if(c&&!c.value.trim())showTab('list')},0)});
    var cancel=$(s.cancel);
    if(cancel)cancel.addEventListener('click',function(){showTab('list')});
    count();
  }
  function init(){SETUPS.forEach(setup)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
