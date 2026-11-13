/* 제품 정렬 순서 (입고리스트·품질리스트)
   - 엑셀 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터 순서로(숫자 없는 제목 칸·빈칸·중복 건너뜀). 파일은 브라우저에서만 읽고 제품코드 목록만 서버로
   - 저장: /api/team-data?part=product-order (관리자만 저장, 게스트는 빈 목록 → 정렬 미적용)
   - 정렬: 순서표에 있는 제품은 그 순서대로, 없는 제품(제품코드 없음 포함)은 맨 아래(그 안에서는 원래 순서)
   - 담당자 탭·전체 인쇄 페이지 순서: 각 담당자 제품이 순서표에서 처음 나오는 위치 순(담당자 이름은 저장하지 않고 화면에서 계산)
   - 다른 화면에서 쓰는 것: window.LushProductOrder.sortRows(행, 제품코드 꺼내는 함수) · sortMgrKeys(담당자 목록, 행, 담당자 함수, 제품코드 함수, 건수) */
(function(){
  var API='/api/team-data?part=product-order';
  var $=function(id){return document.getElementById(id)};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function role(){var u=window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user();return u&&u.role||''}
  var NONE='담당자 없음';
  var P={codes:[],meta:null,idx:{}};
  function norm(c){return String(c==null?'':c).trim().toUpperCase()}
  function setCodes(list){P.codes=list.slice();P.idx={};P.codes.forEach(function(c,i){var k=norm(c);if(!(k in P.idx))P.idx[k]=i})}
  P.active=function(){return P.codes.length>0};
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
    if(role()==='guest'){setCodes([]);return Promise.resolve(P.codes)}
    if(loading)return loading;
    loading=fetch(API).then(function(r){return r.json()}).then(function(j){
      var o=j&&j.success&&j.order||{};setCodes(Array.isArray(o.codes)?o.codes:[]);P.meta=o;
      return P.codes;
    }).catch(function(){return P.codes}).then(function(v){loading=null;return v});
    return loading;
  };
  window.LushProductOrder=P;

  /* ===== 정렬 순서 화면 ===== */
  var draft=[],back=null,fileName='';
  /* 화면 표시용 제품명·담당자: 서버의 PLU 담당자 정보(/api/team-data?part=plu-master)에서 제품코드로 찾아 붙임(저장하지 않음).
     정책 재설정(2026-11-13): 입고·품질리스트 담당자 순서의 편집 화면 표시 허용 범위 */
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
  function infoOf(code){var o=info[norm(code)];return{name:o&&o.name||'',mgr:o?o.mgrs.join(' / '):''}}
  function isAdmin(){return role()==='admin'}
  function canEditOrder(){return isAdmin()} // 저장 권한(서버도 같은 규칙)
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
    el.textContent=(status.msg?status.msg+' · ':'')+meta+(canEditOrder()?' · 바꾸면 자동 저장됩니다.':' · 순서 변경은 관리자만 할 수 있습니다.');
  }
  function renderView(){
    var box=$('moList');if(!box)return;
    var edit=canEditOrder();
    $('moUpload').hidden=!edit;
    renderStatus();
    if(!draft.length){box.innerHTML='<p class="mo-empty">'+(edit?'[엑셀 올리기]로 순서 파일을 올려 주세요. 올리면 바로 저장됩니다. 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터 순서로 읽습니다.':'저장된 정렬 순서가 없습니다.')+'</p>';return}
    // 담당자가 바뀌는 줄마다 '담당자 · N개' 소제목(연속된 묶음 기준)
    var rows=draft.map(function(c){return infoOf(c)}),html='',i=0;
    while(i<draft.length){
      var m=rows[i].mgr,j=i;while(j<draft.length&&rows[j].mgr===m)j++;
      html+='<li class="mo-group"><b>'+esc(m||'담당자 정보 없음')+'</b> <span>'+(j-i)+'개</span></li>';
      for(var k=i;k<j;k++){
        html+='<li><span class="mo-no">'+(k+1)+'</span><span class="mo-code">'+esc(draft[k])+'</span><span class="mo-pname">'+(rows[k].name?esc(rows[k].name):'<span class="mo-dash">-</span>')+'</span><span class="mo-mgr">'+(rows[k].mgr?esc(rows[k].mgr):'<span class="mo-dash">-</span>')+'</span>'+
          (edit?'<span class="mo-btns"><button type="button" data-mo-up="'+k+'"'+(k?'':' disabled')+' aria-label="위로">↑</button><button type="button" data-mo-down="'+k+'"'+(k<draft.length-1?'':' disabled')+' aria-label="아래로">↓</button><button type="button" class="mo-del" data-mo-del="'+k+'" aria-label="목록에서 빼기">✕</button></span>':'')+'</li>';
      }
      i=j;
    }
    box.innerHTML='<ol class="mo-ol">'+html+'</ol>';
  }
  function readExcel(file){
    if(!file)return;
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
      draft=out.slice(0,10000);fileName=file.name;renderView();
      return save().then(function(){if(status.kind==='ok')toast('제품코드 '+draft.length+'개를 읽어 저장했습니다.')});
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){var inp=$('moFile');if(inp)inp.value=''});
  }
  // 입고리스트·품질리스트의 [정렬 순서] 버튼 → 이 화면, [← 돌아가기] → 보던 화면
  function openView(){
    if(role()==='guest'){toast('게스트는 볼 수 없습니다.');return}
    var cur=document.querySelector('.view.active');
    back={id:cur&&cur.id,title:($('pageTitle')||{}).textContent||'',el:document.querySelector('#navContainer .nav-item.active')};
    if(typeof showView==='function')showView('productOrderView','제품 정렬 순서',null);
    window.scrollTo(0,0);status={kind:'',msg:''};
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
    $('moList').addEventListener('click',function(e){
      var b=e.target.closest('[data-mo-up],[data-mo-down],[data-mo-del]');if(!b||!canEditOrder())return;
      var up=b.getAttribute('data-mo-up'),dn=b.getAttribute('data-mo-down'),del=b.getAttribute('data-mo-del');
      if(up!=null){var i=+up;if(i>0){var t=draft[i-1];draft[i-1]=draft[i];draft[i]=t}}
      else if(dn!=null){var j=+dn;if(j<draft.length-1){var u=draft[j+1];draft[j+1]=draft[j];draft[j]=u}}
      else if(del!=null){draft.splice(+del,1)}
      renderView();saveSoon();
    });
    // 메뉴로 다른 화면에 가도 남은 저장은 바로 보냄
    new MutationObserver(function(){if(!view.classList.contains('active')&&saveTimer)save()}).observe(view,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pagehide',function(){if(saveTimer)save()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
