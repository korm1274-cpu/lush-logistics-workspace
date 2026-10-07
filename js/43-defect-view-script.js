/* <script id="defect-view-script"> (index.html에서 그대로 옮김) */
(function(){
  var KEY='lush-product-defects-v1';
  var $=function(id){return document.getElementById(id)};
  var editingId=null;
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
  function sortKey(x){return [String(x.year||''),String(x.mfgDate||''),String(x.createdAt||'')].join('|')}
  function render(){
    if(!$('dfBody'))return;
    var list=load();
    // 년도 필터·카테고리 추천 목록
    var years={},cats={"미입고":1,"중량미달":1};list.forEach(function(x){if(x.year)years[x.year]=1;if(x.category)cats[x.category]=1});
    var ySel=$('dfFilterYear'),yCur=ySel.value;
    ySel.innerHTML='<option value="">전체</option>'+Object.keys(years).sort().reverse().map(function(y){return '<option value="'+esc(y)+'">'+esc(y)+'</option>'}).join('');
    if(yCur&&years[yCur])ySel.value=yCur;
    $('dfCategoryList').innerHTML=Object.keys(cats).sort().map(function(c){return '<option value="'+esc(c)+'">'}).join('');
    var fy=ySel.value,fd=$('dfFilterDone').value,q=$('dfFilterQuery').value.trim().toLowerCase();
    var rows=list.filter(function(x){
      if(fy&&String(x.year)!==fy)return false;
      if(fd&&(x.done==='Y'?'Y':'N')!==fd)return false;
      if(q&&[x.category,x.batch,x.plu,x.code,x.name,x.lot,x.note].join(' ').toLowerCase().indexOf(q)<0)return false;
      return true;
    }).sort(function(a,b){return sortKey(b).localeCompare(sortKey(a))});
    $('dfTotal').textContent=num(list.length);
    var openN=list.filter(function(x){return x.done!=='Y'}).length;
    $('dfOpen').textContent=num(openN);$('dfTabOpen').textContent=openN?openN:'';
    $('dfCount').textContent=rows.length+'건';
    if(!rows.length){$('dfBody').innerHTML='<tr class="df-row-empty"><td class="df-empty" colspan="12">'+(!list.length?'등록된 불량 건이 없습니다.':(fd==='N'&&!fy&&!q)?'미처리 불량 건이 없습니다. 처리된 건은 처리 여부에서 \x27처리\x27나 \x27전체\x27를 선택해 보세요.':'조건에 맞는 불량 건이 없습니다.')+'</td></tr>';return}
    $('dfBody').innerHTML=rows.map(function(x){
      var done=x.done==='Y';
      return '<tr data-id="'+esc(x.id)+'"'+(x.id===editingId?' class="df-editing"':'')+'>'+
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
    }).join('');
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
    ['dfFilterYear','dfFilterDone'].forEach(function(id){$(id).addEventListener('change',render)});
    $('dfFilterQuery').addEventListener('input',render);
    var note=$('dfNote');
    function fitNote(){note.style.height='auto';note.style.height=Math.max(84,note.scrollHeight+2)+'px'}
    note.addEventListener('keydown',function(e){if(e.key==='Enter')e.stopPropagation()});
    note.addEventListener('input',fitNote);
    window.__dfFitNote=fitNote;
    $('dfBody').addEventListener('click',function(e){
      var b=e.target.closest('button[data-act]');if(!b)return;
      var id=b.closest('tr').getAttribute('data-id');
      if(b.dataset.act==='edit')edit(id);else if(b.dataset.act==='del')del(id);else if(b.dataset.act==='toggle')toggle(id);
    });
    document.addEventListener('team-data-updated',render);
    window.addEventListener('storage',function(e){if(e.key===KEY)render()});
    render();
  }
  window.renderProductDefects=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

