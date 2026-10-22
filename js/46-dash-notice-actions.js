/* 메인 팀 공지사항
   - 공지 개수 제한 없이 모두 표시: 1·2번째는 기존 칸(#dashNoticeTitle/#dashNotice2), 3번째부터는 #dashNoticeMore에 같은 모양으로 추가
   - 각 공지 오른쪽 ⋯ 버튼 → '수정'(공지 등록 화면으로 이동해 바로 수정) / '공지 내리기'(삭제)
     공지 등록 메뉴에 접근할 수 있는 사람에게만 보임 */
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function noticeMenu(){
    var list=(typeof menus!=='undefined'&&Array.isArray(menus))?menus:[];
    return list.find(function(m){return m&&m.target==='noticeManagerView'});
  }
  function canManage(){
    var m=noticeMenu();if(!m)return false;
    try{return typeof canAccess!=='function'||canAccess(m)}catch(e){return false}
  }
  /* 메뉴는 카드 밖(body)에 띄워서 카드 테두리에 잘리지 않게, 아래 공간이 모자라면 버튼 위로 엶 */
  function closeMenus(except){document.querySelectorAll('.dn-menu').forEach(function(x){if(x!==except)x.remove()})}
  function placeMenu(m,btn){
    var r=btn.getBoundingClientRect(),mh=m.offsetHeight,mw=m.offsetWidth,gap=6;
    var top=r.bottom+gap;if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-gap-mh);
    var left=Math.min(window.innerWidth-mw-8,Math.max(8,r.right-mw));
    m.style.top=top+'px';m.style.left=left+'px';
  }
  function openMenu(btn,id){
    var cur=document.querySelector('.dn-menu[data-for="'+id+'"]');
    closeMenus(cur);if(cur){cur.remove();return}
    var m=document.createElement('div');m.className='dn-menu';m.setAttribute('data-for',id);
    m.innerHTML='<button type="button" data-dn="edit">수정</button><button type="button" data-dn="del" class="del">공지 내리기</button>';
    document.body.appendChild(m);placeMenu(m,btn);
    m.addEventListener('click',function(e){
      e.stopPropagation();
      var b=e.target.closest('button[data-dn]');if(!b)return;
      closeMenus();
      if(b.dataset.dn==='edit')editNotice(id);else removeNotice(id);
    });
  }
  function editNotice(id){
    var m=noticeMenu();
    try{if(m&&typeof activateMenu==='function')activateMenu(m,document.querySelector('#navContainer [data-menu-id="'+m.id+'"]')||undefined);else if(typeof showView==='function')showView('noticeManagerView')}catch(e){}
    setTimeout(function(){
      if(window.__noticeOps)window.__noticeOps.startEdit(id);
      var tab=document.querySelector('#noticeManagerView [data-td-tab="form"]');if(tab)tab.click();
      var f=document.querySelector('#noticeManagerView .box-entry-card');if(f)f.scrollIntoView({behavior:'smooth',block:'center'});
    },60);
  }
  function removeNotice(id){
    var list=[];try{list=JSON.parse(localStorage.getItem('lush-v51-notices')||'[]')}catch(e){}
    var x=list.find(function(v){return v&&v.id===id});
    if(!confirm('['+((x&&x.title)||'공지')+'] 공지를 내릴까요?\n(공지 목록에서 삭제됩니다)'))return;
    if(window.__noticeOps)window.__noticeOps.remove(id);
  }
  function ensureButton(item,id,allow){
    var btn=item.querySelector(':scope > .dn-act');
    if(!id||!allow){if(btn)btn.remove();return}
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='dn-act';btn.setAttribute('aria-label','공지 수정·내리기');btn.title='수정 · 공지 내리기';
      btn.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
      btn.addEventListener('click',function(e){e.stopPropagation();openMenu(btn,item.dataset.noticeId)});
      item.appendChild(btn);
    }
  }
  window.__renderDashNotices=function(n){
    var t1=document.getElementById('dashNoticeTitle');if(!t1)return;
    var board=t1.closest('.notice-board'),first=t1.closest('.notice-main'),second=document.getElementById('dashNotice2');
    n=Array.isArray(n)?n:[];
    var more=document.getElementById('dashNoticeMore');
    if(!more){more=document.createElement('div');more.id='dashNoticeMore';more.className='dn-more';board.appendChild(more)}
    more.innerHTML=n.slice(2).map(function(x){
      return '<div class="notice-main notice-second dn-extra" data-notice-id="'+esc(x.id)+'"><span class="notice-pin">공지</span><div><b class="dn-title">'+esc(x.title)+'</b>'+(x.note?'<p class="dn-text">'+(window.noticeNoteHtml?window.noticeNoteHtml(x.note):esc(x.note))+'</p>':'')+'</div></div>';
    }).join('');
    if(first)first.dataset.noticeId=n[0]?n[0].id:'';
    if(second)second.dataset.noticeId=n[1]?n[1].id:'';
    var allow=canManage();
    board.querySelectorAll('.notice-main').forEach(function(it){ensureButton(it,it.dataset.noticeId,allow)});
    closeMenus();
  };
  document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.dn-menu,.dn-act'))closeMenus()});
  window.addEventListener('scroll',function(){closeMenus()},true);
  window.addEventListener('resize',function(){closeMenus()});
  function init(){if(typeof window.renderOpsDashboard==='function')window.renderOpsDashboard()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
