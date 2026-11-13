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
  var draft=[],dirty=false,back=null,fileName='';
  function isAdmin(){return role()==='admin'}
  function renderView(){
    var box=$('moList');if(!box)return;
    var admin=isAdmin();
    $('moUpload').hidden=!admin;$('moSave').hidden=!admin;$('moReset').hidden=!admin;
    $('moSave').disabled=!dirty;$('moReset').disabled=!dirty;
    var meta=P.meta&&P.meta.updatedAt?'저장된 순서: 제품 '+P.codes.length+'개 · '+String(P.meta.updatedAt).slice(0,10)+' 저장'+(P.meta.fileName?' · '+P.meta.fileName:''):'아직 저장된 순서가 없습니다.';
    $('moInfo').textContent=(dirty?'저장하지 않은 변경이 있습니다 (제품 '+draft.length+'개). · ':'')+meta+(admin?'':' · 순서 변경은 관리자만 할 수 있습니다.');
    if(!draft.length){box.innerHTML='<p class="mo-empty">'+(admin?'[엑셀 올리기]로 순서 파일을 올려 주세요. 첫 시트의 제품코드를 왼쪽 열부터(A열 전체 → B열 전체 → …), 각 열은 위에서부터 순서로 읽습니다.':'저장된 정렬 순서가 없습니다.')+'</p>';return}
    box.innerHTML='<ol class="mo-ol">'+draft.map(function(c,i){
      return '<li><span class="mo-no">'+(i+1)+'</span><span class="mo-name">'+esc(c)+'</span>'+(admin?'<span class="mo-btns"><button type="button" data-mo-up="'+i+'"'+(i?'':' disabled')+' aria-label="위로">↑</button><button type="button" data-mo-down="'+i+'"'+(i<draft.length-1?'':' disabled')+' aria-label="아래로">↓</button><button type="button" class="mo-del" data-mo-del="'+i+'" aria-label="목록에서 빼기">✕</button></span>':'')+'</li>';
    }).join('')+'</ol>';
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
      draft=out.slice(0,10000);dirty=true;fileName=file.name;renderView();
      toast('제품코드 '+draft.length+'개를 읽었습니다. 확인 후 [저장]을 눌러 주세요.');
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){var inp=$('moFile');if(inp)inp.value=''});
  }
  function save(){
    if(!isAdmin()){toast('정렬 순서 저장은 관리자만 할 수 있습니다.');return}
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',codes:draft,fileName:fileName})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'저장하지 못했습니다.');return}
      dirty=false;toast('정렬 순서를 저장했습니다. (제품 '+j.count+'개)');
      return P.load().then(function(){draft=P.codes.slice();renderView()});
    }).catch(function(){toast('저장하지 못했습니다.')});
  }
  // 입고리스트·품질리스트의 [정렬 순서] 버튼 → 이 화면, [← 돌아가기] → 보던 화면
  function openView(){
    if(role()==='guest'){toast('게스트는 볼 수 없습니다.');return}
    var cur=document.querySelector('.view.active');
    back={id:cur&&cur.id,title:($('pageTitle')||{}).textContent||'',el:document.querySelector('#navContainer .nav-item.active')};
    if(typeof showView==='function')showView('productOrderView','제품 정렬 순서',null);
    window.scrollTo(0,0);
    P.load().then(function(){if(!dirty){draft=P.codes.slice();fileName=(P.meta&&P.meta.fileName)||''}renderView()});
  }
  function goBack(){
    if(dirty&&!confirm('저장하지 않은 변경이 있습니다. 그래도 나갈까요?'))return;
    if(dirty){dirty=false;draft=P.codes.slice()}
    if(back&&back.id&&typeof showView==='function'){showView(back.id,back.title,back.el||null)}
  }
  function init(){
    document.addEventListener('click',function(e){if(e.target.closest('[data-product-order-open]'))openView()});
    var view=$('productOrderView');if(!view)return;
    $('moBack').addEventListener('click',goBack);
    $('moFile').addEventListener('change',function(){var f=this.files&&this.files[0];if(f)readExcel(f)});
    $('moSave').addEventListener('click',save);
    $('moReset').addEventListener('click',function(){draft=P.codes.slice();dirty=false;renderView()});
    $('moList').addEventListener('click',function(e){
      var b=e.target.closest('[data-mo-up],[data-mo-down],[data-mo-del]');if(!b||!isAdmin())return;
      var up=b.getAttribute('data-mo-up'),dn=b.getAttribute('data-mo-down'),del=b.getAttribute('data-mo-del');
      if(up!=null){var i=+up;if(i>0){var t=draft[i-1];draft[i-1]=draft[i];draft[i]=t}}
      else if(dn!=null){var j=+dn;if(j<draft.length-1){var u=draft[j+1];draft[j+1]=draft[j];draft[j]=u}}
      else if(del!=null){draft.splice(+del,1)}
      dirty=true;renderView();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
