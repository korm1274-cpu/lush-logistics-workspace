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
      var ov=j.overrides||{};
      Object.keys(j.master.map).forEach(function(plu){
        (j.master.map[plu]||[]).forEach(function(x){
          var k=norm(x&&x[0]);if(!k)return;
          var mgr=String((x&&x[1])||'').trim()||(ov[plu]&&ov[plu].mgr)||'',o=info[k]||(info[k]={name:'',mgrs:[]});
          if(!o.name&&x[2])o.name=String(x[2]);
          if(mgr&&o.mgrs.indexOf(mgr)<0)o.mgrs.push(mgr);
        });
      });
    }).catch(function(){info={}});
  }
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
    var order=[],cnt={};
    draft.forEach(function(c){var m=mgrKey(c);if(!(m in cnt)){cnt[m]=0;order.push(m)}cnt[m]++});
    order.sort(function(a,b){return (a===NOINFO)-(b===NOINFO)});
    if(picked&&!(picked in cnt))picked=null;
    el.hidden=!order.length;
    el.innerHTML='<span class="mo-mgrs-label">담당 '+order.length+'개</span>'+order.map(function(m){return '<button type="button" class="mo-mgr-chip'+(m===NOINFO?' none':'')+(m===picked?' on':'')+'" data-mo-pick="'+esc(m)+'">'+esc(m)+' <em>'+cnt[m]+'</em></button>'}).join('');
  }
  function renderDatalist(){
    var dl=$('moMgrOptions');if(!dl)return;
    dl.innerHTML=allMgrs().map(function(m){return '<option value="'+esc(m)+'">'}).join('');
  }
  function renderView(){
    var box=$('moList');if(!box)return;
    var edit=canEditOrder();
    $('moUpload').hidden=!edit;var add=$('moAdd');if(add)add.hidden=!edit;
    renderStatus();renderMgrs();renderDatalist();
    if(!draft.length){box.innerHTML='<p class="mo-empty">'+(edit?'[엑셀 올리기]로 순서 파일을 올려 주세요. 올리면 바로 저장됩니다. 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터 순서로 읽습니다.':'저장된 정렬 순서가 없습니다.')+'</p>';return}
    if(!picked){box.innerHTML='<p class="mo-empty">위에서 담당을 고르면 그 담당 제품이 정렬 순서대로 나옵니다.</p>';return}
    var idx=[];draft.forEach(function(c,k){if(mgrKey(c)===picked)idx.push(k)});
    var html='<li class="mo-group"><b>'+esc(picked)+'</b> <span>'+idx.length+'개</span></li>';
    idx.forEach(function(k,n){
      var r=infoOf(draft[k]);
      html+='<li><span class="mo-no">'+(k+1)+'</span><span class="mo-code">'+esc(draft[k])+'</span><span class="mo-pname">'+(r.name?esc(r.name):'<span class="mo-dash">-</span>')+'</span>'+
        (edit?'<button type="button" class="mo-mgr mo-mgr-edit" data-mo-setmgr="'+esc(draft[k])+'" title="이 제품 담당 바꾸기">'+(r.mgr?esc(r.mgr):'담당 지정')+(r.extra?' <small>지정</small>':'')+'</button>':'<span class="mo-mgr">'+(r.mgr?esc(r.mgr):'<span class="mo-dash">-</span>')+'</span>')+
        (edit?'<span class="mo-btns"><button type="button" data-mo-up="'+k+'"'+(n?'':' disabled')+' aria-label="위로">↑</button><button type="button" data-mo-down="'+k+'"'+(n<idx.length-1?'':' disabled')+' aria-label="아래로">↓</button><button type="button" class="mo-del" data-mo-del="'+k+'" aria-label="목록에서 빼기">✕</button></span>':'')+'</li>';
    });
    box.innerHTML='<ol class="mo-ol">'+html+'</ol>';
  }
  // 같은 담당 안에서 위·아래로 가장 가까운 제품의 자리
  function sameNeighbor(k,dir){var m=mgrKey(draft[k]);for(var t=k+dir;t>=0&&t<draft.length;t+=dir)if(mgrKey(draft[t])===m)return t;return -1}
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
      picked=m;['moAddCode','moAddPlu','moAddName'].forEach(function(id){$(id).value=''});
      renderView();
      toast((plu?'PLU '+plu+' → 제품코드 '+code+' 등록. ':'')+(mgr?(exists?code+' 담당을 '+mgr+'(으)로 바꿨습니다.':code+'을(를) '+mgr+' 담당에 추가했습니다.'):'담당은 나중에 지정할 수 있습니다.'));
      return exists?null:save();
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){btn.disabled=false});
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
  function openView(){
    if(role()==='guest'){toast('게스트는 볼 수 없습니다.');return}
    var cur=document.querySelector('.view.active');
    back={id:cur&&cur.id,title:($('pageTitle')||{}).textContent||'',el:document.querySelector('#navContainer .nav-item.active')};
    if(typeof showView==='function')showView('productOrderView','제품 정렬 순서',null);
    window.scrollTo(0,0);status={kind:'',msg:''};picked=null;
    Promise.all([P.load(),loadInfo()]).then(function(){if(!saveTimer&&!saving){draft=P.codes.slice();fileName=(P.meta&&P.meta.fileName)||''}renderView()});
  }
  function goBack(){
    if(saveTimer)save(); // 남은 저장을 바로
    if(back&&back.id&&typeof showView==='function'){showView(back.id,back.title,back.el||null)}
  }
  function init(){
    document.addEventListener('click',function(e){if(e.target.closest('[data-product-order-open]'))openView()});
    var view=$('productOrderView');if(!view)return;
    $('moBack').addEventListener('click',goBack);
    $('moFile').addEventListener('change',function(){var f=this.files&&this.files[0];if(f)readExcel(f)});
    if($('moAddBtn'))$('moAddBtn').addEventListener('click',addProduct);
    ['moAddCode','moAddPlu','moAddName','moAddMgr'].forEach(function(id){var el=$(id);if(el)el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addProduct()}})});
    $('moList').addEventListener('click',function(e){
      var sm=e.target.closest('[data-mo-setmgr]');if(sm&&canEditOrder()){editMgr(sm);return}
      var b=e.target.closest('[data-mo-up],[data-mo-down],[data-mo-del]');if(!b||!canEditOrder())return;
      var up=b.getAttribute('data-mo-up'),dn=b.getAttribute('data-mo-down'),del=b.getAttribute('data-mo-del');
      if(up!=null||dn!=null){
        var i=+(up!=null?up:dn),t=sameNeighbor(i,up!=null?-1:1);if(t<0)return;
        var x=draft[t];draft[t]=draft[i];draft[i]=x;
      }else if(del!=null){draft.splice(+del,1)}
      renderView();saveSoon();
    });
    // 맨 위 담당 목록: 누르면 그 담당 제품만 나열(다시 누르면 접기)
    var mg=$('moMgrs');
    if(mg)mg.addEventListener('click',function(e){
      var c=e.target.closest('[data-mo-pick]');if(!c)return;
      var m=c.getAttribute('data-mo-pick');picked=picked===m?null:m;renderView();
    });
    // 메뉴로 다른 화면에 가도 남은 저장은 바로 보냄
    new MutationObserver(function(){if(!view.classList.contains('active')&&saveTimer)save()}).observe(view,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pagehide',function(){if(saveTimer)save()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
