/* <script id="defect-view-script"> (index.html에서 그대로 옮김) */
(function(){
  var KEY='lush-product-defects-v1';
  var $=function(id){return document.getElementById(id)};
  var editingId=null;
  var searched=false; // 불량 기록은 [조회]·[전체]를 누른 뒤에만 보여 줌
  function showTab(t){
    document.querySelectorAll('#defectView [data-df-tab]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-df-tab')===t)});
    document.querySelectorAll('#defectView [data-df-pane]').forEach(function(p){p.hidden=p.getAttribute('data-df-pane')!==t});
  }
  function loadAll(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function load(){return loadAll().filter(function(x){return x&&!x.deleted})}
  function store(list){localStorage.setItem(KEY,JSON.stringify(list))}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function num(n){var v=Number(n)||0;return v.toLocaleString('ko-KR')}
  var FIELDS=[['year','dfYear'],['category','dfCategory'],['batch','dfBatch'],['plu','dfPlu'],['code','dfCode'],['name','dfName'],['lot','dfLot'],['mfgDate','dfMfg'],['qty','dfQtyInput'],['note','dfNote'],['done','dfDone']];

  function resetForm(){
    FIELDS.forEach(function(f){var el=$(f[1]);if(el)el.value=''});
    $('dfYear').value=new Date().getFullYear();$('dfDone').value='N';
    if(window.__dfFitNote)setTimeout(window.__dfFitNote,0);
    editingId=null;$('dfSave').textContent='등록';$('dfCancel').hidden=true;$('dfFormTitle').textContent='불량 등록';
    render();
  }
  function save(){
    var item={};FIELDS.forEach(function(f){item[f[0]]=String($(f[1]).value||'').trim()});
    item.qty=item.qty===''?'':Number(item.qty);
    if(!item.year){alert('년도를 입력해 주세요.');$('dfYear').focus();return}
    if(!item.name&&!item.code){alert('제품코드나 제품명 중 하나는 입력해 주세요.');$('dfName').focus();return}
    var list=loadAll(),now=new Date().toISOString();
    if(editingId){
      var i=list.findIndex(function(x){return x.id===editingId});
      if(i>=0)list[i]=Object.assign({},list[i],item,{updatedAt:now});
    }else{
      list.unshift(Object.assign({id:'df'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),createdAt:now,updatedAt:now},item));
    }
    store(list);resetForm();showTab('list');
  }
  function edit(id){
    var it=load().find(function(x){return x.id===id});if(!it)return;
    FIELDS.forEach(function(f){$(f[1]).value=it[f[0]]==null?'':it[f[0]]});
    if(!it.done)$('dfDone').value='N';
    if(window.__dfFitNote)setTimeout(window.__dfFitNote,0);
    editingId=id;$('dfSave').textContent='수정 저장';$('dfCancel').hidden=false;$('dfFormTitle').textContent='불량 수정';
    render();
    showTab('form');
    var p=document.querySelector('#defectView .df-tabs');if(p)p.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function del(id){
    var it=load().find(function(x){return x.id===id});if(!it)return;
    if(!confirm('['+(it.name||it.code||'')+'] 불량 건을 삭제할까요?'))return;
    var all=loadAll(),now=new Date().toISOString();
    all.forEach(function(x){if(x.id===id){x.deleted=true;x.updatedAt=now}});
    store(all);
    if(editingId===id)resetForm();else render();
  }
  function toggle(id){
    var list=loadAll(),it=list.find(function(x){return x.id===id});if(!it)return;
    it.done=it.done==='Y'?'N':'Y';it.updatedAt=new Date().toISOString();store(list);render();
  }
  // 등록일(한국 시간 날짜). 기간 조회는 등록일 기준
  function regDate(x){var t=Date.parse(x.createdAt||'');return isNaN(t)?'':new Date(t+9*3600e3).toISOString().slice(0,10)}
  function todayKst(){return new Date(Date.now()+9*3600e3).toISOString().slice(0,10)}
  // 회계연도 시작일(7월 1일) — 오출고 기록과 같은 기준
  function fyStart(){var t=todayKst(),y=Number(t.slice(0,4)),m=Number(t.slice(5,7));return (m>=7?y:y-1)+'-07-01'}
  function sortDesc(a,b){return (String(b.createdAt||'')).localeCompare(String(a.createdAt||''))}
  function rowHtml(x){
      var done=x.done==='Y';
      return '<tr data-id="'+esc(x.id)+'"'+(x.id===editingId?' class="df-editing"':'')+'>'+
        '<td data-label="등록일">'+esc(regDate(x))+'</td>'+
        '<td data-label="년도">'+esc(x.year)+'</td>'+
        '<td data-label="카테고리">'+esc(x.category)+'</td>'+
        '<td data-label="차수">'+esc(x.batch)+'</td>'+
        '<td data-label="PLU">'+esc(x.plu)+'</td>'+
        '<td data-label="제품코드">'+esc(x.code)+'</td>'+
        '<td data-label="제품명" class="df-wide">'+esc(x.name)+'</td>'+
        '<td data-label="LOT번호">'+esc(x.lot)+'</td>'+
        '<td data-label="제조일자">'+esc(x.mfgDate)+'</td>'+
        '<td data-label="수량" class="num">'+(x.qty===''||x.qty==null?'':num(x.qty))+'</td>'+
        '<td data-label="내용" class="df-note df-wide">'+esc(x.note)+'</td>'+
        '<td data-label="처리 여부"><button type="button" class="df-status '+(done?'done':'open')+'" data-act="toggle" title="눌러서 처리 여부 변경">'+(done?'처리':'미처리')+'</button></td>'+
        '<td data-label="관리"><div class="df-manage"><button type="button" data-act="edit">수정</button><button type="button" class="del" data-act="del">삭제</button></div></td>'+
      '</tr>';
  }
  function emptyRow(msg){return '<tr class="df-row-empty"><td class="df-empty" colspan="13">'+msg+'</td></tr>'}
  function render(){
    if(!$('dfBody'))return;
    var list=load();
    var cats={"미입고":1,"중량미달":1};list.forEach(function(x){if(x.category)cats[x.category]=1});
    $('dfCategoryList').innerHTML=Object.keys(cats).sort().map(function(c){return '<option value="'+esc(c)+'">'}).join('');
    // 요약·미완료 불량(기간과 관계없이 처리 안 된 건 전부)
    var open=list.filter(function(x){return x.done!=='Y'}).sort(sortDesc);
    $('dfTotal').textContent=num(list.length);
    $('dfOpen').textContent=num(open.length);$('dfTabOpen').textContent=open.length?open.length:'';
    var tc=$('dfPendingTitleCount');tc.textContent=num(open.length)+'건';tc.classList.toggle('ux-blink',open.length>0);
    $('dfPendingBody').innerHTML=open.length?open.map(rowHtml).join(''):emptyRow('미완료 불량이 없습니다.');
    // 불량 기록: 기간(등록일)·처리여부·검색 — 조회 전에는 안내만
    if(!searched){$('dfCount').hidden=true;$('dfBody').innerHTML=emptyRow('기간을 확인하고 [조회]를 눌러 주세요.');return}
    var st=$('dfStart').value,en=$('dfEnd').value,fd=$('dfFilterDone').value,q=$('dfFilterQuery').value.trim().toLowerCase();
    var rows=list.filter(function(x){
      var d=regDate(x);
      if(st&&d<st)return false;
      if(en&&d>en)return false;
      if(fd&&(x.done==='Y'?'Y':'N')!==fd)return false;
      if(q&&[x.category,x.batch,x.plu,x.code,x.name,x.lot,x.note].join(' ').toLowerCase().indexOf(q)<0)return false;
      return true;
    }).sort(sortDesc);
    $('dfCount').hidden=false;$('dfCount').textContent=rows.length+'건';
    $('dfBody').innerHTML=rows.length?rows.map(rowHtml).join(''):emptyRow(!list.length?'등록된 불량 건이 없습니다.':'조건에 맞는 불량 건이 없습니다.');
  }
  function init(){
    if(!$('defectView'))return;
    $('dfYear').value=new Date().getFullYear();
    $('dfSave').addEventListener('click',save);
    $('dfCancel').addEventListener('click',function(){resetForm();showTab('list')});
    document.querySelectorAll('#defectView [data-df-tab]').forEach(function(b){b.addEventListener('click',function(){
      var t=b.getAttribute('data-df-tab');
      if(t==='form'&&editingId)resetForm(); /* 탭으로 직접 열면 새 등록 */
      showTab(t);
    })});
    $('dfStart').value=fyStart();$('dfEnd').value=todayKst();
    ['dfStart','dfEnd','dfFilterDone'].forEach(function(id){$(id).addEventListener('change',render)});
    $('dfFilterQuery').addEventListener('keydown',function(e){if(e.key==='Enter'){searched=true;render()}});
    $('dfRun').addEventListener('click',function(){searched=true;render()});
    $('dfReset').addEventListener('click',function(){searched=true;['dfStart','dfEnd','dfFilterQuery','dfFilterDone'].forEach(function(id){$(id).value=''});render()});
    var note=$('dfNote');
    function fitNote(){note.style.height='auto';note.style.height=Math.max(84,note.scrollHeight+2)+'px'}
    note.addEventListener('keydown',function(e){if(e.key==='Enter')e.stopPropagation()});
    note.addEventListener('input',fitNote);
    window.__dfFitNote=fitNote;
    ['dfBody','dfPendingBody'].forEach(function(tb){$(tb).addEventListener('click',function(e){
      var b=e.target.closest('button[data-act]');if(!b)return;
      var id=b.closest('tr').getAttribute('data-id');
      if(b.dataset.act==='edit')edit(id);else if(b.dataset.act==='del')del(id);else if(b.dataset.act==='toggle')toggle(id);
    })});
    document.addEventListener('team-data-updated',render);
    window.addEventListener('storage',function(e){if(e.key===KEY)render()});
    render();
  }
  window.renderProductDefects=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

