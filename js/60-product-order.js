/* 제품 정렬 순서 (입고리스트·품질리스트) + 제품코드별 담당 지정(신규 제품 추가)
   - 순서: 엑셀 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터(숫자 없는 제목 칸·빈칸·중복 건너뜀).
     파일은 브라우저에서만 읽고 제품코드 목록만 서버로. 저장: /api/team-data?part=product-order (관리자·팀원, 게스트는 빈 목록)
   - 담당 지정: /api/team-data?part=product-extra — 제품코드별 { code, plu, name, mgr }. 입고·품질리스트·정렬 순서에서 PLU 담당자 정보보다 먼저 씀
   - 정렬: 순서표 순서대로, 없는 제품(제품코드 없음 포함)은 맨 아래(그 안에서는 원래 순서)
   - 담당자 탭·전체 인쇄 페이지 순서: 각 담당 제품이 순서표에서 처음 나오는 위치 순
   - 다른 화면에서 쓰는 것: window.LushProductOrder.sortRows · sortMgrKeys · extraByCode · extraByPlu */
(function(){
  var API='/api/team-data?part=product-order',XAPI='/api/team-data?part=product-extra';
  var $=function(id){return document.getElementById(id)};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function role(){var u=window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user();return u&&u.role||''}
  var NONE='담당자 없음',NOINFO='담당 정보 없음';
  var P={codes:[],meta:null,idx:{},xCode:{},xPlu:{}};
  function norm(c){return String(c==null?'':c).trim().toUpperCase()}
  function setCodes(list){P.codes=list.slice();P.idx={};P.codes.forEach(function(c,i){var k=norm(c);if(!(k in P.idx))P.idx[k]=i})}
  function setExtras(items){P.xCode={};P.xPlu={};(items||[]).forEach(putExtra)}
  function putExtra(x){if(!x||!x.code)return;P.xCode[norm(x.code)]=x;if(x.plu)P.xPlu[String(x.plu).trim()]=x}
  P.active=function(){return P.codes.length>0};
  // 제품코드별 담당 지정('A / B'처럼 여러 코드면 지정된 첫 코드)
  P.extraByCode=function(code){var hit=null;String(code==null?'':code).split('/').some(function(c){var x=P.xCode[norm(c)];if(x){hit=x;return true}return false});return hit};
  P.extraByPlu=function(plu){return P.xPlu[String(plu==null?'':plu).trim()]||null};
  // 제품코드 칸이 'A / B'처럼 여럿이면 가장 앞 순서. 순서표에 없으면 맨 아래(목록 길이)
  P.rank=function(code){
    var best=P.codes.length;
    String(code==null?'':code).split('/').forEach(function(c){var k=norm(c);if(k&&k in P.idx&&P.idx[k]<best)best=P.idx[k]});
    return best;
  };
  P.sortRows=function(arr,codeOf){
    if(!P.active())return arr;
    return arr.map(function(r,i){return [r,i,P.rank(codeOf(r))]}).sort(function(a,b){return a[2]-b[2]||a[1]-b[1]}).map(function(x){return x[0]});
  };
  // 순서표가 없으면 null(각 화면의 원래 정렬 사용)
  P.sortMgrKeys=function(keys,rows,mgrOf,codeOf,count){
    if(!P.active())return null;
    var first={};rows.forEach(function(r){var m=mgrOf(r),k=P.rank(codeOf(r));if(!(m in first)||k<first[m])first[m]=k});
    return keys.slice().sort(function(a,b){
      var fa=first[a]==null?P.codes.length:first[a],fb=first[b]==null?P.codes.length:first[b];
      return (a===NONE)-(b===NONE)||fa-fb||(count[b]||0)-(count[a]||0)||String(a).localeCompare(String(b));
    });
  };
  var loading=null;
  P.load=function(){
    if(role()==='guest'){setCodes([]);setExtras([]);return Promise.resolve(P.codes)}
    if(loading)return loading;
    loading=Promise.all([
      fetch(API).then(function(r){return r.json()}).catch(function(){return null}),
      fetch(XAPI).then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(res){
      var j=res[0],x=res[1];
      if(j&&j.success){var o=j.order||{};setCodes(Array.isArray(o.codes)?o.codes:[]);P.meta=o}
      if(x&&x.success)setExtras(x.items);
      return P.codes;
    }).then(function(v){loading=null;return v},function(){loading=null;return P.codes});
    return loading;
  };
  window.LushProductOrder=P;

  /* ===== 정렬 순서 화면 =====
     처음엔 맨 위 담당 목록만, 담당을 고르면 그 담당 제품만 나열. ↑↓는 같은 담당 제품끼리 자리 바꿈(다른 담당 자리는 그대로) */
  var draft=[],back=null,fileName='',picked=null;
  /* 화면 표시용 제품명·담당: ① 제품코드별 담당 지정 ② PLU 담당자 정보(수기 지정 포함) — 화면에만, 정렬 순서 저장소엔 제품코드만 */
  var info={};
  function loadInfo(){
    return fetch('/api/team-data?part=plu-master').then(function(r){return r.json()}).then(function(j){
      info={};if(!j||!j.success||!j.master||!j.master.map)return;
      var ov=j.overrides||{};pluCodes={};
      Object.keys(j.master.map).forEach(function(plu){
        (j.master.map[plu]||[]).forEach(function(x){
          var k=norm(x&&x[0]);if(!k)return;
          (pluCodes[plu]=pluCodes[plu]||[]).push(k);
          var mgr=String((x&&x[1])||'').trim()||(ov[plu]&&ov[plu].mgr)||'',o=info[k]||(info[k]={name:'',mgrs:[]});
          if(!o.name&&x[2])o.name=String(x[2]);
          if(mgr&&o.mgrs.indexOf(mgr)<0)o.mgrs.push(mgr);
        });
      });
    }).catch(function(){info={}});
  }
  /* 입고 이력 있는 제품만 보기: 입고리스트(모든 차수)·품질리스트(모든 차수)에 한 번이라도 나온 제품코드만 화면에 표시.
     나머지는 순서표에는 그대로 두고 화면에서만 숨김([숨긴 제품 N개 보기]). 이 화면에서 [추가]로 넣은 제품은 바로 보이게 예외.
     불러오기에 실패하면(seen=null) 예전처럼 모두 표시 */
  var pluCodes={},lists=null,seen=null,addedNow={},showHidden=false;
  function loadLists(){
    return Promise.all([
      fetch('/api/team-data?part=checklists').then(function(r){return r.json()}),
      fetch('/api/team-data?part=quality-lists').then(function(r){return r.json()})
    ]).then(function(res){
      if(!res[0]||!res[0].success||!res[1]||!res[1].success){lists=null;return}
      lists={ck:res[0].batches||[],ql:res[1].batches||[]};
    }).catch(function(){lists=null});
  }
  function buildSeen(){
    if(!lists){seen=null;return}
    seen={};
    var addPlu=function(plu){plu=String(plu==null?'':plu).trim();if(!plu)return;(pluCodes[plu]||[]).forEach(function(k){seen[k]=1});var x=P.xPlu[plu];if(x)seen[norm(x.code)]=1};
    lists.ck.forEach(function(b){(b.rows||[]).forEach(function(r){addPlu(r.plu)})});
    lists.ql.forEach(function(b){(b.rows||[]).forEach(function(r){addPlu(r.plu);if(r.code)seen[norm(r.code)]=1;(r.items||[]).forEach(function(it){addPlu(it.plu)})})});
  }
  function isSeen(code){return !seen||!!seen[norm(code)]||!!addedNow[norm(code)]}
  function visible(code){return showHidden||isSeen(code)}
  function infoOf(code){
    var o=info[norm(code)],x=P.xCode[norm(code)];
    return{name:(x&&x.name)||(o&&o.name)||'',mgr:(x&&x.mgr)||(o?o.mgrs.join(' / '):''),extra:!!x};
  }
  function mgrKey(code){return infoOf(code).mgr||NOINFO}
  function allMgrs(){var s={};draft.forEach(function(c){var m=infoOf(c).mgr;if(m)s[m]=1});Object.keys(P.xCode).forEach(function(k){if(P.xCode[k].mgr)s[P.xCode[k].mgr]=1});return Object.keys(s).sort(function(a,b){return a.localeCompare(b)})}
  function isAdmin(){return role()==='admin'}
  // 관리자·팀원: 엑셀 올리기·↑↓·✕·제품 추가·담당 지정(서버도 같은 규칙), 게스트는 화면 진입 불가
  function canEditOrder(){var r=role();return r==='admin'||r==='member'}
  /* 자동 저장: 엑셀을 올리면 바로, ↑↓✕로 바꾸면 1초 뒤(연달아 누르면 마지막 1번만). 화면을 떠나면 남은 저장을 바로 보냄 */
  var saveTimer=null,saving=false,again=false,status={kind:'',msg:''};
  function hhmm(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
  function save(){
    clearTimeout(saveTimer);saveTimer=null;
    if(!canEditOrder())return Promise.resolve();
    if(saving){again=true;return Promise.resolve()}
    saving=true;status={kind:'saving',msg:'저장 중…'};renderStatus();
    var codes=draft.slice();
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',codes:codes,fileName:fileName})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success)throw new Error((j&&j.error)||'서버가 저장하지 않았습니다.');
      setCodes(codes);P.meta={codes:codes,updatedAt:new Date().toISOString(),fileName:fileName};
      status={kind:'ok',msg:'저장됨 '+hhmm(new Date())};
    }).catch(function(e){
      status={kind:'err',msg:'저장 실패 — '+String((e&&e.message)||e).slice(0,80)+' · 다시 시도해 주세요.'};
      toast('정렬 순서를 저장하지 못했습니다.');
    }).then(function(){saving=false;renderStatus();if(again){again=false;return save()}});
  }
  function saveSoon(){clearTimeout(saveTimer);status={kind:'saving',msg:'변경 사항 저장 대기…'};renderStatus();saveTimer=setTimeout(save,1000)}
  function renderStatus(){
    var el=$('moInfo');if(!el)return;
    var meta=P.meta&&P.meta.updatedAt?'제품 '+P.codes.length+'개 · '+String(P.meta.updatedAt).slice(0,10)+' 저장'+(P.meta.fileName?' · '+P.meta.fileName:''):'아직 저장된 순서가 없습니다.';
    el.className='mo-info'+(status.kind?' '+status.kind:'');
    el.textContent=(status.msg?status.msg+' · ':'')+meta+(canEditOrder()?' · 바꾸면 자동 저장됩니다.':' · 순서 변경 권한이 없습니다.');
  }
  // 맨 위 담당 목록: 순서표에서 처음 나오는 순서대로 '담당 N개'. 누르면 그 담당 제품만 아래에 나열
  function renderMgrs(){
    var el=$('moMgrs');if(!el)return;
    var order=[],cnt={},hidden=0;
    draft.forEach(function(c){if(!isSeen(c))hidden++;if(!visible(c))return;var m=mgrKey(c);if(!(m in cnt)){cnt[m]=0;order.push(m)}cnt[m]++});
    order.sort(function(a,b){return (a===NOINFO)-(b===NOINFO)});
    if(picked&&!(picked in cnt))picked=null;
    el.hidden=!order.length&&!hidden;
    el.innerHTML='<span class="mo-mgrs-label">담당 '+order.length+'개</span>'+order.map(function(m){return '<button type="button" class="mo-mgr-chip'+(m===NOINFO?' none':'')+(m===picked?' on':'')+'" data-mo-pick="'+esc(m)+'">'+esc(m)+' <em>'+cnt[m]+'</em></button>'}).join('')+
      (hidden?'<button type="button" class="mo-hidden-toggle'+(showHidden?' on':'')+'" data-mo-hidden title="입고리스트·품질리스트에 한 번도 나오지 않은 제품(순서표에는 그대로 있음)">'+(showHidden?'입고 이력 없는 제품 숨기기':'숨긴 제품 '+hidden+'개 보기')+'</button>':'');
  }
  function renderDatalist(){
    var dl=$('moMgrOptions');if(!dl)return;
    dl.innerHTML=allMgrs().map(function(m){return '<option value="'+esc(m)+'">'}).join('');
  }
  function renderView(){
    var box=$('moList');if(!box)return;
    var edit=canEditOrder();
    if($('productOrderView').classList.contains('active'))remember(); // 고른 담당까지 새로고침 대비 기억
    $('moUpload').hidden=!edit;var add=$('moAdd');if(add)add.hidden=!edit;var xu=$('moXUpload');if(xu)xu.hidden=!edit;
    renderStatus();renderMgrs();renderDatalist();
    if(!draft.length){box.innerHTML='<p class="mo-empty">'+(edit?'[엑셀 올리기]로 순서 파일을 올려 주세요. 올리면 바로 저장됩니다. 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터 순서로 읽습니다.':'저장된 정렬 순서가 없습니다.')+'</p>';return}
    // 검색 중: 담당과 상관없이 맞는 제품 모두(숨긴 제품 포함, 회색). ↑↓·끌기는 끄고, 담당 바꾸기·✕·[이 담당에서 보기]만
    var q=(($('moSearch')||{}).value||'').trim().toLowerCase();
    if(q){
      var hits=[];draft.forEach(function(c,k){var r=infoOf(c);if([c,r.name,r.mgr].join(' ').toLowerCase().indexOf(q)>=0)hits.push(k)});
      if(!hits.length){box.innerHTML='<p class="mo-empty">"'+esc(q)+'"에 맞는 제품이 없습니다.</p>';return}
      var sh='<li class="mo-group"><b>검색 결과</b> <span>'+hits.length+'개'+(hits.length>300?' (앞 300개만 표시)':'')+'</span></li>';
      hits.slice(0,300).forEach(function(k){
        var r=infoOf(draft[k]),off=!isSeen(draft[k]),m=mgrKey(draft[k]);
        sh+='<li data-k-search="'+k+'" class="mo-search-row'+(off?' mo-unseen':'')+'"><span class="mo-no">'+(k+1)+'</span><span class="mo-code">'+esc(draft[k])+'</span><span class="mo-pname">'+(r.name?esc(r.name):'<span class="mo-dash">-</span>')+(off?' <small class="mo-unseen-tag">입고 이력 없음</small>':'')+'</span>'+
          (edit?'<button type="button" class="mo-mgr mo-mgr-edit" data-mo-setmgr="'+esc(draft[k])+'" title="이 제품 담당 바꾸기">'+(r.mgr?esc(r.mgr):'담당 지정')+(r.extra?' <small>지정</small>':'')+'</button>':'<span class="mo-mgr">'+(r.mgr?esc(r.mgr):'<span class="mo-dash">-</span>')+'</span>')+
          '<span class="mo-btns"><button type="button" class="mo-goto" data-mo-goto="'+k+'" data-mo-goto-mgr="'+esc(m)+'">이 담당에서 보기</button>'+(edit?'<button type="button" class="mo-del" data-mo-del="'+k+'" aria-label="목록에서 빼기">✕</button>':'')+'</span></li>';
      });
      box.innerHTML='<ol class="mo-ol">'+sh+'</ol>';return;
    }
    if(!picked){box.innerHTML='<p class="mo-empty">위에서 담당을 고르면 그 담당 제품이 정렬 순서대로 나옵니다.</p>';return}
    var idx=[];draft.forEach(function(c,k){if(mgrKey(c)===picked&&visible(c))idx.push(k)});
    var html='<li class="mo-group"><b>'+esc(picked)+'</b> <span>'+idx.length+'개</span></li>';
    idx.forEach(function(k,n){
      var r=infoOf(draft[k]),off=!isSeen(draft[k]);
      html+='<li data-k="'+k+'" class="'+(edit?'mo-draggable':'')+(off?' mo-unseen':'')+'">'+(edit?'<span class="mo-handle" aria-hidden="true" title="눌러서 끌어 옮기기">⠿</span>':'')+'<span class="mo-no">'+(k+1)+'</span><span class="mo-code">'+esc(draft[k])+'</span><span class="mo-pname">'+(r.name?esc(r.name):'<span class="mo-dash">-</span>')+(off?' <small class="mo-unseen-tag">입고 이력 없음</small>':'')+'</span>'+
        (edit?'<button type="button" class="mo-mgr mo-mgr-edit" data-mo-setmgr="'+esc(draft[k])+'" title="이 제품 담당 바꾸기">'+(r.mgr?esc(r.mgr):'담당 지정')+(r.extra?' <small>지정</small>':'')+'</button>':'<span class="mo-mgr">'+(r.mgr?esc(r.mgr):'<span class="mo-dash">-</span>')+'</span>')+
        (edit?'<span class="mo-btns"><button type="button" data-mo-up="'+k+'"'+(n?'':' disabled')+' aria-label="위로">↑</button><button type="button" data-mo-down="'+k+'"'+(n<idx.length-1?'':' disabled')+' aria-label="아래로">↓</button><button type="button" class="mo-del" data-mo-del="'+k+'" aria-label="목록에서 빼기">✕</button></span>':'')+'</li>';
    });
    box.innerHTML='<ol class="mo-ol">'+html+'</ol>';
  }
  /* ===== 끌어 옮기기 =====
     PC: 줄을 누른 채 5px 이상 움직이면 시작 / 휴대폰: 0.3초 꾹 누르면 시작(그 전에 움직이면 그냥 스크롤)
     보이는 목록(고른 담당 제품) 안에서만 옮기고, 놓으면 그 담당 제품들이 있던 자리에 새 순서로 넣음(다른 담당 자리는 그대로) → 자동 저장
     ↑↓·✕·담당 칸 버튼에서는 시작하지 않음. 화면 위·아래 끝에서는 자동 스크롤 */
  var drag=null;
  function rowsInList(){return Array.prototype.slice.call(document.querySelectorAll('#moList li[data-k]'))}
  function dragStart(li,y){
    var rows=rowsInList();
    drag={li:li,rows:rows,from:rows.indexOf(li),to:rows.indexOf(li),startY:y,y:y,scroll0:window.scrollY,timer:null,raf:0};
    li.classList.add('mo-dragging');document.body.classList.add('mo-drag-on');
    if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}
    var loop=function(){if(!drag)return;var edge=60,v=drag.y<edge+56?-14:drag.y>window.innerHeight-edge?14:0;if(v){window.scrollBy(0,v);dragMove(drag.y)}drag.raf=requestAnimationFrame(loop)};
    drag.raf=requestAnimationFrame(loop);
  }
  function dragMove(y){
    if(!drag)return;drag.y=y;
    var dy=y-drag.startY+(window.scrollY-drag.scroll0);
    drag.li.style.transform='translateY('+dy+'px)';
    // 놓을 자리: 끄는 줄을 뺀 나머지 줄들의 가운데선 기준
    var to=drag.rows.length-1;
    for(var i=0;i<drag.rows.length;i++){
      if(drag.rows[i]===drag.li)continue;
      var b=drag.rows[i].getBoundingClientRect();
      if(y<b.top+b.height/2){to=i>drag.from?i-1:i;break}
    }
    drag.to=to;
    drag.rows.forEach(function(r,i){r.classList.toggle('mo-drop-before',i===to&&to<drag.from);r.classList.toggle('mo-drop-after',i===to&&to>drag.from)});
  }
  function dragEnd(cancel){
    if(!drag)return;var d=drag;drag=null;
    cancelAnimationFrame(d.raf);document.body.classList.remove('mo-drag-on');
    d.rows.forEach(function(r){r.classList.remove('mo-dragging','mo-drop-before','mo-drop-after');r.style.transform=''});
    if(cancel||d.to===d.from||d.to<0)return;
    var slots=d.rows.map(function(r){return +r.getAttribute('data-k')}),codes=slots.map(function(k){return draft[k]});
    var moved=codes.splice(d.from,1)[0];codes.splice(d.to,0,moved);
    slots.forEach(function(k,i){draft[k]=codes[i]});
    renderView();saveSoon();
  }
  function bindDrag(list){
    var pend=null; // 시작 전(누름) 상태
    function startable(e){var li=e.target.closest('li[data-k]');return li&&canEditOrder()&&!e.target.closest('button,input,a')?li:null}
    // PC 마우스
    list.addEventListener('mousedown',function(e){
      if(e.button!==0)return;var li=startable(e);if(!li)return;
      pend={li:li,x:e.clientX,y:e.clientY};
    });
    document.addEventListener('mousemove',function(e){
      if(drag){e.preventDefault();dragMove(e.clientY);return}
      if(pend&&Math.abs(e.clientY-pend.y)+Math.abs(e.clientX-pend.x)>5){e.preventDefault();var p=pend;pend=null;dragStart(p.li,p.y);dragMove(e.clientY)}
    });
    document.addEventListener('mouseup',function(){pend=null;if(drag)dragEnd(false)});
    // 휴대폰 터치: 0.3초 꾹 누르면 시작, 그 전에 8px 넘게 움직이면 스크롤로 보고 취소
    list.addEventListener('touchstart',function(e){
      if(e.touches.length!==1)return;var li=startable(e);if(!li)return;
      var t=e.touches[0];pend={li:li,x:t.clientX,y:t.clientY,timer:setTimeout(function(){if(pend){var p=pend;pend=null;dragStart(p.li,p.y)}},300)};
    },{passive:true});
    list.addEventListener('touchmove',function(e){
      var t=e.touches[0];
      if(drag){e.preventDefault();dragMove(t.clientY);return}
      if(pend&&Math.abs(t.clientY-pend.y)+Math.abs(t.clientX-pend.x)>8){clearTimeout(pend.timer);pend=null}
    },{passive:false});
    list.addEventListener('touchend',function(){if(pend){clearTimeout(pend.timer);pend=null}if(drag)dragEnd(false)});
    list.addEventListener('touchcancel',function(){if(pend){clearTimeout(pend.timer);pend=null}dragEnd(true)});
    list.addEventListener('contextmenu',function(e){if(drag||e.target.closest('li[data-k]'))e.preventDefault()}); // 꾹 누를 때 메뉴 안 뜨게
    document.addEventListener('keydown',function(e){if(e.key==='Escape')dragEnd(true)});
  }
  // 같은 담당 안에서 위·아래로 가장 가까운 제품의 자리
  // (보이는 제품끼리만 — 숨긴 제품 자리는 그대로)
  function sameNeighbor(k,dir){var m=mgrKey(draft[k]);for(var t=k+dir;t>=0&&t<draft.length;t+=dir)if(mgrKey(draft[t])===m&&visible(draft[t]))return t;return -1}
  /* 제품코드별 담당 지정 저장(신규 추가·담당 변경 공통) */
  function setExtra(code,plu,name,mgr){
    return fetch(XAPI,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set',code:code,plu:plu,name:name,mgr:mgr})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success)throw new Error((j&&j.error)||'담당을 저장하지 못했습니다.');
      putExtra(j.item);return j.item;
    });
  }
  // [추가]: 처음 보는 제품코드면 그 담당 제품들 맨 뒤에 넣고, 이미 있으면 담당만 바꿈
  function addProduct(){
    var code=($('moAddCode').value||'').trim(),plu=($('moAddPlu').value||'').trim(),name=($('moAddName').value||'').trim(),mgr=($('moAddMgr').value||'').trim();
    if(!code){toast('제품코드를 넣어 주세요.');$('moAddCode').focus();return}
    if(!mgr&&!plu){toast('담당 또는 PLU를 넣어 주세요. (신제품은 PLU만 넣어도 제품코드가 등록됩니다)');$('moAddMgr').focus();return}
    var btn=$('moAddBtn');btn.disabled=true;
    setExtra(code,plu,name,mgr).then(function(item){
      var exists=draft.some(function(c){return norm(c)===norm(code)}),m=(item&&item.mgr)||mgrKey(code);
      if(!exists){
        var last=-1;draft.forEach(function(c,k){if(mgrKey(c)===m)last=k});
        draft.splice(last<0?draft.length:last+1,0,code);
      }
      addedNow[norm(code)]=1; // 막 추가한 제품은 입고 이력이 없어도 보이게
      picked=m;['moAddCode','moAddPlu','moAddName'].forEach(function(id){$(id).value=''});
      renderView();
      toast((plu?'PLU '+plu+' → 제품코드 '+code+' 등록. ':'')+(mgr?(exists?code+' 담당을 '+mgr+'(으)로 바꿨습니다.':code+'을(를) '+mgr+' 담당에 추가했습니다.'):'담당은 나중에 지정할 수 있습니다.'));
      return exists?null:save();
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){btn.disabled=false});
  }
  /* 제품코드·PLU·제품명·담당 엑셀 일괄 반영
     첫 시트 1행 제목으로 칸 찾기(제품코드|코드 · PLU · 제품명|품명 · 담당), 제목이 없으면 A=제품코드 B=PLU C=제품명 D=담당.
     빈칸은 기존 값 유지. 미리보기(반영·새 제품·담당 변경·건너뜀) 확인 후 저장, 새 제품코드는 그 담당 제품들 맨 뒤에 정렬 순서로 추가 */
  var CODE_RE=/^[A-Za-z0-9][A-Za-z0-9\-_.]{0,39}$/;
  function readExtraExcel(file){
    if(!file)return;
    if(!canEditOrder()){toast('엑셀 올리기 권한이 없습니다.');return}
    (window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)).then(function(){return file.arrayBuffer()}).then(function(buf){
      var wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
      var aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
      var head=(aoa[0]||[]).map(function(x){return String(x).replace(/\s+/g,'')}),col={code:-1,plu:-1,name:-1,mgr:-1};
      head.forEach(function(h,i){
        if(col.code<0&&/제품코드|^코드$|^CODE$/i.test(h))col.code=i;
        else if(col.plu<0&&/^PLU/i.test(h))col.plu=i;
        else if(col.name<0&&/제품명|품명|^NAME$/i.test(h))col.name=i;
        else if(col.mgr<0&&/담당/.test(h))col.mgr=i;
      });
      var hasHead=col.code>=0,start=hasHead?1:0;
      if(!hasHead)col={code:0,plu:1,name:2,mgr:3};
      var cell=function(r,i){return i<0?'':String((r&&r[i])==null?'':r[i]).replace(/\s+/g,' ').trim()};
      var items=[],skipped=[],seen={};
      for(var ri=start;ri<aoa.length&&items.length<2000;ri++){
        var r=aoa[ri],row=ri+1,c=cell(r,col.code),p=cell(r,col.plu).replace(/\.0+$/,''),n=cell(r,col.name).slice(0,120),m=cell(r,col.mgr).slice(0,40);
        if(!c&&!p&&!n&&!m)continue; // 빈 줄
        if(!CODE_RE.test(c)){skipped.push(row+'행 제품코드');continue}
        if(p&&!/^\d{1,20}$/.test(p)){skipped.push(row+'행 PLU');continue}
        var old=P.xCode[norm(c)];
        if(!p&&!m&&!(old&&(old.plu||old.mgr))){skipped.push(row+'행 PLU·담당 없음');continue}
        if(seen[norm(c)]!=null)items[seen[norm(c)]]={row:row,code:c,plu:p,name:n,mgr:m}; // 같은 코드가 또 나오면 아래 줄 기준
        else{seen[norm(c)]=items.length;items.push({row:row,code:c,plu:p,name:n,mgr:m})}
      }
      if(!items.length)throw new Error('반영할 줄이 없습니다.'+(skipped.length?' (건너뜀: '+skipped.slice(0,5).join(', ')+')':''));
      var inOrder={};draft.forEach(function(c){inOrder[norm(c)]=1});
      var fresh=items.filter(function(x){return !inOrder[norm(x.code)]}).length;
      var changed=items.filter(function(x){return x.mgr&&inOrder[norm(x.code)]&&infoOf(x.code).mgr!==x.mgr}).length;
      var msg='반영 '+items.length+'줄 · 새 제품 '+fresh+'개 · 담당 변경 '+changed+'개'+(skipped.length?' · 건너뜀 '+skipped.length+'줄('+skipped.slice(0,6).join(', ')+(skipped.length>6?' …':'')+')':'')+'\n\n반영할까요?';
      if(!confirm(msg))return;
      return fetch(XAPI,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bulkSet',items:items})}).then(function(r){return r.json()}).then(function(j){
        if(!j||!j.success)throw new Error((j&&j.error)||'반영하지 못했습니다.');
        (j.items||[]).forEach(putExtra);buildSeen(); // 새로 이은 PLU가 입고리스트에 있으면 바로 보이게
        var added=0;
        (j.items||[]).forEach(function(x){
          if(draft.some(function(c){return norm(c)===norm(x.code)}))return;
          var m=x.mgr||NOINFO,last=-1;draft.forEach(function(c,k){if(mgrKey(c)===m)last=k});
          draft.splice(last<0?draft.length:last+1,0,x.code);added++;
        });
        renderView();
        var sk=(j.skipped||[]).length;
        toast('제품코드·담당 '+j.saved+'건 반영'+(added?', 정렬 순서에 새 제품 '+added+'개 추가':'')+(sk?' · 서버에서 건너뜀 '+sk+'줄':''));
        return added?save():null;
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){var inp=$('moXFile');if(inp)inp.value=''});
  }
  function editMgr(btn){
    var code=btn.getAttribute('data-mo-setmgr'),cur=infoOf(code).mgr;
    var span=document.createElement('span');span.className='mo-mgr mo-mgr-form';
    span.innerHTML='<input list="moMgrOptions" value="'+esc(cur)+'" aria-label="'+esc(code)+' 담당"><button type="button" class="mo-ok">저장</button><button type="button" class="mo-cancel" aria-label="취소">✕</button>';
    btn.replaceWith(span);
    var inp=span.querySelector('input');inp.focus();inp.select();
    var done=false,commit=function(){
      if(done)return;done=true;var v=inp.value.trim();
      if(!v||v===cur){renderView();return}
      setExtra(code,'','',v).then(function(){picked=v;renderView();toast(code+' 담당을 '+v+'(으)로 바꿨습니다.')}).catch(function(e){toast(String((e&&e.message)||e));renderView()});
    };
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();commit()}else if(e.key==='Escape'){done=true;renderView()}});
    span.querySelector('.mo-ok').addEventListener('click',commit);
    span.querySelector('.mo-cancel').addEventListener('click',function(){done=true;renderView()});
  }
  function readExcel(file){
    if(!file)return;
    if(!canEditOrder()){toast('엑셀 올리기 권한이 없습니다.');return}
    (window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)).then(function(){return file.arrayBuffer()}).then(function(buf){
      var wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
      var aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
      // 모든 열을 왼쪽(A)부터 차례로, 각 열은 위에서 아래로(예: 담당별로 한 열씩 적은 표 → A열 전체, B열 전체, …)
      // 숫자가 없는 칸(1행 제목 등)·빈칸·중복은 건너뜀 — 제목 칸 글자는 서버에 보내지 않음
      var width=aoa.reduce(function(m,r){return Math.max(m,(r||[]).length)},0),seen={},out=[];
      for(var c=0;c<width;c++){
        aoa.forEach(function(r){
          var s=String((r&&r[c])==null?'':r[c]).replace(/\s+/g,' ').trim().slice(0,40),k=s.toUpperCase();
          if(!s||!/\d/.test(s)||seen[k])return;
          seen[k]=1;out.push(s);
        });
      }
      if(!out.length)throw new Error('첫 시트에서 제품코드를 찾지 못했습니다.');
      if(P.codes.length&&!confirm('지금 저장된 순서(제품 '+P.codes.length+'개)를 새 파일 순서(제품 '+Math.min(out.length,10000)+'개)로 바꿀까요?'))return;
      draft=out.slice(0,10000);fileName=file.name;picked=null;renderView();
      return save().then(function(){if(status.kind==='ok')toast('제품코드 '+draft.length+'개를 읽어 저장했습니다.')});
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){var inp=$('moFile');if(inp)inp.value=''});
  }
  // 입고리스트·품질리스트의 [정렬 순서] 버튼 → 이 화면, [← 돌아가기] → 보던 화면
  /* 새로고침해도 이 화면 유지: 이 창(sessionStorage)에 '정렬 순서 화면 · 들어온 메뉴 · 고른 담당'을 기억
     (js/26-keep-view-on-reload.js가 '__order'를 보면 들어온 메뉴를 연 뒤 LushProductOrder.restore로 이 화면을 다시 엶) */
  var LAST_MENU_KEY='lush_last_menu_v1',STATE_KEY='lush_order_view_v1';
  function remember(){try{sessionStorage.setItem(LAST_MENU_KEY,'__order');sessionStorage.setItem(STATE_KEY,JSON.stringify({menu:back&&back.menu||'',view:back&&back.id||'',title:back&&back.title||'',picked:picked||''}))}catch(e){}}
  function forget(){try{sessionStorage.removeItem(STATE_KEY);if(back&&back.menu)sessionStorage.setItem(LAST_MENU_KEY,back.menu)}catch(e){}}
  function openView(state){
    if(role()==='guest'){toast('게스트는 볼 수 없습니다.');return}
    var cur=document.querySelector('.view.active'),nav=document.querySelector('#navContainer .nav-item.active');
    back=state&&state.view?{id:state.view,title:state.title||'',el:nav,menu:state.menu||''}:{id:cur&&cur.id,title:($('pageTitle')||{}).textContent||'',el:nav,menu:nav&&nav.getAttribute('data-menu-id')||''};
    if(typeof showView==='function')showView('productOrderView','제품 정렬 순서',null);
    window.scrollTo(0,0);status={kind:'',msg:''};picked=state&&state.picked||null;
    showHidden=false;if($('moSearch'))$('moSearch').value='';
    remember();
    Promise.all([P.load(),loadInfo(),loadLists()]).then(function(){buildSeen();if(!saveTimer&&!saving){draft=P.codes.slice();fileName=(P.meta&&P.meta.fileName)||''}renderView()});
  }
  P.restore=function(state){openView(state||{})};
  P.savedState=function(){try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')}catch(e){return null}};
  function goBack(){
    if(saveTimer)save(); // 남은 저장을 바로
    forget();
    if(back&&back.id&&typeof showView==='function'){showView(back.id,back.title,back.el||null)}
  }
  // [이 담당에서 보기]: 검색을 지우고 그 담당 목록으로, 그 제품 줄로 이동해 잠깐 강조(숨긴 제품이면 숨긴 제품도 보이게)
  function gotoRow(k,m){
    $('moSearch').value='';picked=m;if(!isSeen(draft[k]))showHidden=true;remember();renderView();
    var li=document.querySelector('#moList li[data-k="'+k+'"]');
    if(li){li.scrollIntoView({block:'center'});li.classList.add('mo-flash');setTimeout(function(){li.classList.remove('mo-flash')},1600)}
  }
  function init(){
    document.addEventListener('click',function(e){if(e.target.closest('[data-product-order-open]'))openView()});
    var view=$('productOrderView');if(!view)return;
    $('moBack').addEventListener('click',goBack);
    $('moFile').addEventListener('change',function(){var f=this.files&&this.files[0];if(f)readExcel(f)});
    if($('moXFile'))$('moXFile').addEventListener('change',function(){var f=this.files&&this.files[0];if(f)readExtraExcel(f)});
    if($('moAddBtn'))$('moAddBtn').addEventListener('click',addProduct);
    ['moAddCode','moAddPlu','moAddName','moAddMgr'].forEach(function(id){var el=$(id);if(el)el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addProduct()}})});
    $('moList').addEventListener('click',function(e){
      var gt=e.target.closest('[data-mo-goto]');if(gt){gotoRow(+gt.getAttribute('data-mo-goto'),gt.getAttribute('data-mo-goto-mgr'));return}
      var sm=e.target.closest('[data-mo-setmgr]');if(sm&&canEditOrder()){editMgr(sm);return}
      var b=e.target.closest('[data-mo-up],[data-mo-down],[data-mo-del]');if(!b||!canEditOrder())return;
      var up=b.getAttribute('data-mo-up'),dn=b.getAttribute('data-mo-down'),del=b.getAttribute('data-mo-del');
      if(up!=null||dn!=null){
        var i=+(up!=null?up:dn),t=sameNeighbor(i,up!=null?-1:1);if(t<0)return;
        var x=draft[t];draft[t]=draft[i];draft[i]=x;
      }else if(del!=null){draft.splice(+del,1)}
      renderView();saveSoon();
    });
    bindDrag($('moList'));
    // 맨 위 담당 목록: 누르면 그 담당 제품만 나열(다시 누르면 접기)
    var mg=$('moMgrs');
    if(mg)mg.addEventListener('click',function(e){
      if(e.target.closest('[data-mo-hidden]')){showHidden=!showHidden;renderView();return}
      var c=e.target.closest('[data-mo-pick]');if(!c)return;
      var m=c.getAttribute('data-mo-pick');picked=picked===m?null:m;if($('moSearch'))$('moSearch').value='';remember();renderView();
    });
    // 검색: 입력할 때마다(0.2초 쉬면) 다시 그림
    var st=null;if($('moSearch'))$('moSearch').addEventListener('input',function(){clearTimeout(st);st=setTimeout(renderView,200)});
    // 메뉴로 다른 화면에 가도 남은 저장은 바로 보냄
    new MutationObserver(function(){if(!view.classList.contains('active')&&saveTimer)save()}).observe(view,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pagehide',function(){if(saveTimer)save()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
