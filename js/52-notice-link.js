/* 공지 내용 링크 (일정 > 공지 등록 · 공지 수정의 '내용' 칸 #noticeMgrNote 에서만 동작)
   - 글자 선택 후 Ctrl+K(맥 Cmd+K) 또는 우클릭 → [링크 추가] / 링크 글자에서 우클릭 → [링크 열기·수정·제거]
   - 저장 형식: 공지 내용(note) 글자 안에 [보일 글자](https://주소) — 일반 글자로 저장되므로 기존 공지·팀 공유 동기화와 그대로 호환
   - 표시: window.noticeNoteHtml(note) → 링크 글자만 보이고, 누르면 새 탭(rel="noopener noreferrer")
   - 다른 입력칸(일정 등록, 검색, 메모 등)에는 연결하지 않음: ENABLED_IDS 에 있는 칸만 */
(function(){
  var ENABLED_IDS=['noticeMgrNote'];
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}

  /* [글자](http(s)://주소) 찾기 — 주소 안의 괄호는 짝이 맞으면 그대로 허용, 주소는 공백 전까지 전부(길이 제한 없음) */
  function parse(s){
    var out=[],i=0;s=String(s||'');
    for(;;){
      var a=s.indexOf('[',i);if(a<0)break;
      var b=s.indexOf('](',a+1);if(b<0)break;
      var text=s.slice(a+1,b);
      if(!text||/[\[\]\n]/.test(text)){i=a+1;continue}
      var us=b+2;
      if(!/^https?:\/\//i.test(s.slice(us,us+8))){i=a+1;continue}
      var depth=0,end=-1;
      for(var j=us;j<s.length;j++){
        var c=s.charAt(j);
        if(/\s/.test(c))break;
        if(c==='(')depth++;
        else if(c===')'){if(depth===0){end=j;break}depth--}
      }
      if(end<0){i=a+1;continue}
      out.push({start:a,end:end+1,text:text,url:s.slice(us,end)});
      i=end+1;
    }
    return out;
  }
  function validUrl(u){
    if(!/^https?:\/\/\S+$/i.test(u))return false;
    try{var x=new URL(u);return (x.protocol==='http:'||x.protocol==='https:')&&!!x.hostname}catch(e){return false}
  }
  /* 주소 안 괄호 짝이 안 맞을 때만 그 괄호를 %28/%29로 바꿔 저장 형식이 깨지지 않게(같은 주소로 열림). 그 외에는 입력한 주소 그대로 */
  function safeUrl(u){
    var d=0,ok=true;for(var i=0;i<u.length;i++){var c=u.charAt(i);if(c==='(')d++;else if(c===')'){d--;if(d<0){ok=false;break}}}
    if(ok&&d===0)return u;
    return u.replace(/\(/g,'%28').replace(/\)/g,'%29');
  }

  /* 화면 표시용 HTML: 글자는 모두 이스케이프, 링크는 http/https 주소만 */
  window.noticeNoteHtml=function(note){
    var s=String(note||''),tk=parse(s),html='',p=0;
    tk.forEach(function(t){
      html+=esc(s.slice(p,t.start))+'<a class="notice-link" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(t.url)+'">'+esc(t.text)+'</a>';
      p=t.end;
    });
    return html+esc(s.slice(p));
  };
  /* 링크 표시 글자만 남긴 일반 글자(알림 등 HTML을 못 쓰는 곳용) */
  window.noticeNotePlain=function(note){
    var s=String(note||''),tk=parse(s),out='',p=0;
    tk.forEach(function(t){out+=s.slice(p,t.start)+t.text;p=t.end});
    return out+s.slice(p);
  };
  /* 공지 카드(메인 등)를 누르면 펼쳐지는 동작보다 링크 열기가 먼저: 링크 클릭은 다른 클릭 동작으로 전달하지 않음(새 탭 이동은 그대로) */
  document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a.notice-link'))e.stopPropagation()},true);

  /* ===== 편집: 공지 내용 칸 ===== */
  function replaceRange(ta,start,end,str){
    ta.focus();ta.setSelectionRange(start,end);
    var ok=false;try{ok=document.execCommand('insertText',false,str)}catch(e){}
    if(!ok||ta.value.slice(start,start+str.length)!==str){ta.setRangeText(str,start,end,'end');ta.dispatchEvent(new Event('input',{bubbles:true}))}
  }
  function context(ta){
    var ss=ta.selectionStart,se=ta.selectionEnd,tk=parse(ta.value);
    var link=null;
    tk.forEach(function(t){if(ss>=t.start&&se<=t.end&&!(ss===t.end&&se===t.end)&&!(ss===se&&ss===t.start))link=t});
    var overlap=!link&&tk.some(function(t){return ss<t.end&&se>t.start});
    return{ss:ss,se:se,link:link,overlap:overlap,text:ta.value.slice(ss,se)};
  }
  var pop=null,menu=null;
  function closeAll(){if(pop){pop.remove();pop=null}if(menu){menu.remove();menu=null}document.removeEventListener('mousedown',outside,true)}
  function outside(e){if((pop&&pop.contains(e.target))||(menu&&menu.contains(e.target)))return;closeAll()}
  function place(el,x,y){
    document.body.appendChild(el);
    var r=el.getBoundingClientRect(),W=window.innerWidth,H=window.innerHeight;
    el.style.left=Math.max(8,Math.min(x,W-r.width-8))+'px';
    el.style.top=Math.max(8,Math.min(y,H-r.height-8))+'px';
    setTimeout(function(){document.addEventListener('mousedown',outside,true)},0);
  }
  function openPopup(ta,ctx,x,y){
    closeAll();
    var edit=!!ctx.link,label=edit?ctx.link.text:ctx.text;
    pop=document.createElement('div');pop.className='nl-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','링크 주소 입력');
    pop.innerHTML='<div class="nl-pop-head"><b>'+(edit?'링크 수정':'링크 추가')+'</b><span class="nl-pop-text">'+esc(label)+'</span></div>'+
      '<input type="url" class="nl-pop-input" placeholder="https://" spellcheck="false" autocomplete="off">'+
      '<p class="nl-pop-err" hidden></p>'+
      '<div class="nl-pop-actions"><button type="button" class="nl-cancel">취소</button><button type="button" class="nl-ok">확인</button></div>';
    var input=pop.querySelector('input'),err=pop.querySelector('.nl-pop-err');
    input.value=edit?ctx.link.url:'';
    function done(){
      var u=input.value.trim();
      if(!validUrl(u)){err.textContent='http:// 또는 https:// 로 시작하는 주소를 입력해 주세요. (띄어쓰기 없이)';err.hidden=false;input.focus();return}
      u=safeUrl(u);
      if(edit){var t=ctx.link;replaceRange(ta,t.start,t.end,'['+t.text+']('+u+')')}
      else replaceRange(ta,ctx.ss,ctx.se,'['+ctx.text+']('+u+')');
      closeAll();ta.focus();
    }
    input.addEventListener('input',function(){err.hidden=true});
    input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();done()}else if(e.key==='Escape'){e.preventDefault();closeAll();ta.focus()}});
    pop.querySelector('.nl-ok').onclick=done;
    pop.querySelector('.nl-cancel').onclick=function(){closeAll();ta.focus()};
    if(x==null){var r=ta.getBoundingClientRect();x=r.left;y=r.bottom+6}
    place(pop,x,y);
    setTimeout(function(){input.focus();input.select()},0);
  }
  function addCheck(ctx){
    if(ctx.overlap){toast('링크가 걸린 글자와 겹치게 선택했습니다. 링크 글자 안을 우클릭해 수정해 주세요.');return false}
    if(!ctx.text.trim()){toast('링크를 걸 글자를 먼저 선택해 주세요.');return false}
    if(/[\n\[\]]/.test(ctx.text)){toast('링크 글자는 한 줄 안에서, [ ] 없이 선택해 주세요.');return false}
    return true;
  }
  function openMenu(ta,ctx,x,y){
    closeAll();
    menu=document.createElement('div');menu.className='nl-menu';menu.setAttribute('role','menu');
    var items=ctx.link?[['open','링크 열기'],['edit','링크 수정'],['remove','링크 제거']]:[['add','링크 추가']];
    menu.innerHTML=items.map(function(it){return '<button type="button" role="menuitem" data-nl="'+it[0]+'">'+it[1]+(it[0]==='add'||it[0]==='edit'?'<kbd>'+(/Mac|iPhone|iPad/.test(navigator.platform)?'⌘K':'Ctrl+K')+'</kbd>':'')+'</button>'}).join('');
    menu.addEventListener('click',function(e){
      var b=e.target.closest('[data-nl]');if(!b)return;
      var act=b.getAttribute('data-nl');closeAll();
      if(act==='open')window.open(ctx.link.url,'_blank','noopener,noreferrer');
      else if(act==='remove'){replaceRange(ta,ctx.link.start,ctx.link.end,ctx.link.text);ta.focus()}
      else if(act==='edit')openPopup(ta,ctx,x,y);
      else if(act==='add'&&addCheck(ctx))openPopup(ta,ctx,x,y);
    });
    place(menu,x,y);
  }
  function bind(ta){
    if(!ta||ta.dataset.linkInsert==='on')return;
    ta.dataset.linkInsert='on';
    ta.addEventListener('keydown',function(e){
      if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;
      if(!(e.code==='KeyK'||String(e.key).toLowerCase()==='k'))return;
      e.preventDefault();
      var ctx=context(ta);
      if(ctx.link){openPopup(ta,ctx);return}
      if(addCheck(ctx))openPopup(ta,ctx);
    });
    ta.addEventListener('contextmenu',function(e){
      var ctx=context(ta);
      if(!ctx.link&&!(ctx.se>ctx.ss))return; // 선택한 글자도, 링크도 없으면 브라우저 기본 메뉴
      e.preventDefault();
      openMenu(ta,ctx,e.clientX,e.clientY);
    });
  }
  function init(){ENABLED_IDS.forEach(function(id){bind(document.getElementById(id))})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
