/* 제품 확보 등록: [목록] [등록] 탭(제품 불량 화면과 같은 방식) + 목록은 기본 미완료만, [전체]를 누르면 완료 건까지
   - 수정을 누르면 등록 탭에서 고치고, 등록·수정 저장·취소 후에는 목록으로 돌아감
   - 목록 탭 옆 숫자는 미완료 건수
   공지 등록: 탭 없이 등록칸 + 목록 한 화면(카드 꾸미기만 같이 사용) */
(function(){
  var $=function(id){return document.getElementById(id)};
  var SETUPS=[
    {view:'todoManagerView',key:'lush-v51-todos',body:'todoMgrBody',add:'todoMgrAdd',cancel:'todoMgrCancel',input:'todoMgrContent',edit:'[data-todo-edit]',filter:true,count:function(a){return a.filter(function(x){return x&&!x.done}).length},meta:[1,2],decorate:function(tr){var b=tr.querySelector('[data-todo-toggle]');tr.classList.toggle('td-done',!!b&&b.textContent.trim()==='완료');var d=tr.children[1];if(d)d.classList.toggle('td-hide',d.textContent.trim()==='-'||!d.textContent.trim())}},
    {view:'noticeManagerView',key:'lush-v51-notices',body:'noticeMgrBody',add:'noticeMgrAdd',cancel:'noticeMgrCancel',input:'noticeMgrTitle',edit:'[data-notice-edit]',count:function(a){return a.filter(Boolean).length},meta:[1,3]}
  ];
  function setup(s){
    var view=$(s.view);if(!view)return;
    var hasTabs=!!view.querySelector('[data-td-tab]');
    var showAll=false;
    function showTab(t){
      if(!hasTabs)return;
      view.querySelectorAll('[data-td-tab]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-td-tab')===t)});
      view.querySelectorAll('[data-td-pane]').forEach(function(p){p.hidden=p.getAttribute('data-td-pane')!==t});
      if(t==='form')setTimeout(function(){var c=$(s.input);if(c)c.focus()},30);
    }
    // 카드 목록 꾸미기: 날짜·작성자 칸은 작은 칩, 완료된 제품 확보 건은 흐리게(기본 보기에서는 숨김)
    function decorate(){
      var body=$(s.body);if(!body)return;
      var shown=0,rows=0;
      body.querySelectorAll(':scope>tr').forEach(function(tr){
        if(tr.querySelector('td[colspan]'))return;
        rows++;
        (s.meta||[]).forEach(function(i){var td=tr.children[i-1];if(td)td.classList.add('td-meta')});
        if(s.decorate)s.decorate(tr);
        if(s.filter){var hide=!showAll&&tr.classList.contains('td-done');tr.classList.toggle('td-filtered',hide);if(!hide)shown++}
      });
      if(s.filter){var none=view.querySelector('.td-none');if(none)none.hidden=!(rows&&!shown)}
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
    view.querySelectorAll('[data-td-filter]').forEach(function(b){b.addEventListener('click',function(){
      showAll=b.getAttribute('data-td-filter')==='all';
      view.querySelectorAll('[data-td-filter]').forEach(function(x){x.classList.toggle('on',x===b)});
      decorate();
    })});
    var body=$(s.body);
    if(body){
      body.addEventListener('click',function(e){if(e.target.closest(s.edit))showTab('form')});
      new MutationObserver(function(){count();decorate()}).observe(body,{childList:true});
    }
    var add=$(s.add);
    if(add)add.addEventListener('click',function(){setTimeout(function(){var c=$(s.input);if(c&&!c.value.trim())showTab('list')},0)});
    var cancel=$(s.cancel);
    if(cancel)cancel.addEventListener('click',function(){showTab('list')});
    count();decorate();
  }
  function init(){SETUPS.forEach(setup)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
