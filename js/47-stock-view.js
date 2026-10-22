/* 재고 > 재고 (샘플 재고 화면)
   - 항목: 제품코드·제품군·제품명·제조일자·수량·PLU·바코드·로케이션 — 표에서 바로 추가·수정·삭제
   - 팀 공유 저장(team-data의 stock, 건(id)별 병합). 나중에 회사 프로그램과 연동할 때 아래 영문 필드 이름 그대로 사용
     { id, code, category, name, mfgDate(YYYY-MM-DD), qty(숫자), plu, barcode, location, createdAt, updatedAt, deleted? } */
(function(){
  var KEY='lush-stock-items-v1';
  var FIELDS=[['code','제품코드','text'],['category','제품군','text'],['name','제품명','text'],['mfgDate','제조일자','date'],['qty','수량','number'],['plu','PLU','text'],['barcode','바코드','text'],['location','로케이션','text']];
  var $=function(id){return document.getElementById(id)};
  var pendingRender=false;
  function loadAll(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function load(){return loadAll().filter(function(x){return x&&!x.deleted})}
  function store(list){localStorage.setItem(KEY,JSON.stringify(list))}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function num(n){var v=Number(n)||0;return v.toLocaleString('ko-KR')}
  function editing(){var a=document.activeElement;return !!(a&&a.closest&&a.closest('#stBody'))}

  function render(){
    if(!$('stBody'))return;
    if(editing()){pendingRender=true;return}
    pendingRender=false;
    var list=load();
    // 제품군 목록(필터·추천)
    var cats={};list.forEach(function(x){if(x.category)cats[x.category]=1});
    var sel=$('stFilterCat'),cur=sel.value;
    sel.innerHTML='<option value="">전체 제품군</option>'+Object.keys(cats).sort().map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
    if(cur&&cats[cur])sel.value=cur;
    $('stCatList').innerHTML=Object.keys(cats).sort().map(function(c){return '<option value="'+esc(c)+'">'}).join('');
    var fc=sel.value,q=$('stSearch').value.trim().toLowerCase();
    var rows=list.filter(function(x){
      if(fc&&x.category!==fc)return false;
      if(q&&[x.code,x.name,x.plu,x.barcode,x.location,x.category].join(' ').toLowerCase().indexOf(q)<0)return false;
      return true;
    });
    $('stMetricRows').textContent=num(list.length);
    $('stMetricQty').textContent=num(list.reduce(function(s,x){return s+(Number(x.qty)||0)},0));
    $('stCount').textContent=rows.length+'건';
    if(!rows.length){
      $('stBody').innerHTML='<tr class="st-empty-row"><td colspan="'+(FIELDS.length+1)+'" class="st-empty">'+(list.length?'조건에 맞는 재고가 없습니다.':'등록된 재고가 없습니다. [+ 행 추가]를 눌러 입력해 주세요.')+'</td></tr>';
      return;
    }
    $('stBody').innerHTML=rows.map(function(x){
      return '<tr data-id="'+esc(x.id)+'">'+FIELDS.map(function(f){
        var v=x[f[0]]==null?'':x[f[0]];
        var extra=f[0]==='category'?' list="stCatList"':'';
        return '<td class="st-'+f[0]+'"><input type="'+f[2]+'" data-f="'+f[0]+'" value="'+esc(v)+'"'+extra+(f[2]==='number'?' step="1" inputmode="numeric"':'')+' aria-label="'+f[1]+'"></td>';
      }).join('')+'<td class="st-manage"><button type="button" class="st-del" data-act="del" title="삭제" aria-label="삭제">삭제</button></td></tr>';
    }).join('');
  }
  function saveField(input){
    var tr=input.closest('tr'),id=tr&&tr.getAttribute('data-id');if(!id)return;
    var f=input.getAttribute('data-f'),v=input.value;
    if(f==='qty')v=v===''?'':Number(v);else v=String(v).trim();
    var all=loadAll(),it=all.find(function(x){return x.id===id});if(!it)return;
    if(it[f]===v)return;
    it[f]=v;it.updatedAt=new Date().toISOString();
    store(all);
    var list=load();
    $('stMetricQty').textContent=num(list.reduce(function(s,x){return s+(Number(x.qty)||0)},0));
  }
  function addRow(){
    var now=new Date().toISOString();
    var all=loadAll();
    var item={id:'st'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),code:'',category:$('stFilterCat').value||'',name:'',mfgDate:'',qty:'',plu:'',barcode:'',location:'',createdAt:now,updatedAt:now};
    all.unshift(item);store(all);
    $('stSearch').value='';
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    pendingRender=false;render();
    var first=document.querySelector('#stBody tr[data-id="'+item.id+'"] input[data-f="code"]');
    if(first){first.focus();first.closest('tr').classList.add('st-new');}
  }
  function delRow(id){
    var all=loadAll(),it=all.find(function(x){return x.id===id});if(!it)return;
    var label=[it.code,it.name].filter(Boolean).join(' ')||'이 행';
    if(!confirm('['+label+'] 재고 행을 삭제할까요?'))return;
    it.deleted=true;it.updatedAt=new Date().toISOString();store(all);
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    pendingRender=false;render();
  }
  function init(){
    if(!$('stockView'))return;
    $('stAdd').addEventListener('click',addRow);
    $('stFilterCat').addEventListener('change',render);
    $('stSearch').addEventListener('input',render);
    var body=$('stBody');
    body.addEventListener('change',function(e){var i=e.target.closest('input[data-f]');if(i)saveField(i)});
    body.addEventListener('keydown',function(e){
      var i=e.target.closest('input[data-f]');if(!i||e.key!=='Enter')return;
      e.preventDefault();saveField(i);
      // Enter: 아래 행 같은 칸으로 이동(마지막 행이면 그대로)
      var tr=i.closest('tr').nextElementSibling,f=i.getAttribute('data-f');
      var next=tr&&tr.querySelector('input[data-f="'+f+'"]');if(next)next.focus();else i.blur();
    });
    body.addEventListener('click',function(e){var b=e.target.closest('button[data-act="del"]');if(b)delRow(b.closest('tr').getAttribute('data-id'))});
    body.addEventListener('focusout',function(){setTimeout(function(){if(pendingRender&&!editing())render()},0)});
    document.addEventListener('team-data-updated',render);
    window.addEventListener('storage',function(e){if(e.key===KEY)render()});
    render();
  }
  window.renderStockView=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
