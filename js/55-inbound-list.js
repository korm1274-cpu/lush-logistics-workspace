/* 입고 > 입고리스트 (엑셀 '입고 분배리스트' 업로드)
   - 차수: 파일명에서 읽음. 예) "2026.10.21 입고 분배리스트 (JP 141차).xlsx" → 제조국 JP · 141차 → "141차 JP" (날짜 2026-10-21)
   - 담당 시트: 'PLU | 제품코드 | 제품군 | 제품명 | TOTAL | 매장 구분…' 형식의 시트만(제조·SPA리스트는 제외, 전체·CHECK·DATA 같은 집계 시트는 형식이 달라 자동 제외)
   - TOTAL이 0보다 큰 행만 반영, A열 PLU·C열 제품군을 뺀 나머지 칸(제품코드·제품명·TOTAL·리테일·디지털…)은 모두 저장
   - 화면: 차수 선택 + 담당(시트) 필터 + 검색(아마존·퍼즈처럼 한글 이름도 가능)
     "ULTRAPLANT 45G — TOTAL 25 중 리테일 20 · 디지털 4 · 수원스파 1"
   - 저장: /api/team-data?part=inbound-lists (차수별 보관, 팀 공유) */
(function(){
  var API='/api/team-data?part=inbound-lists';
  var EXCLUDE={'제조':1,'SPA리스트':1};
  var ALIAS={AMAZON:'아마존',FURZE:'퍼즈',ART:'아트',BLUE:'블루',VOL:'볼',BUS:'버스',NEW:'뉴',TIME:'타임',STAR:'스타',TAROT:'타로',BLACK:'블랙',SAND:'샌드',HANAMI:'하나미',VM:'VM',LIMITED:'리미티드',SPA:'스파',BOOK:'북'};
  var $=function(id){return document.getElementById(id)};
  var batches=[],sheetFilter='',busy=false;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fmt(n){return (Number(n)||0).toLocaleString('ko-KR')}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function num(v){if(typeof v==='number')return isFinite(v)?v:0;var n=parseFloat(String(v==null?'':v).replace(/,/g,'').trim());return isFinite(n)?n:0}
  function label(sheet){var k=String(sheet||'').toUpperCase();return ALIAS[k]&&ALIAS[k]!==sheet?ALIAS[k]:sheet}
  function canEdit(){var u=window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user();return !!(u&&u.role!=='guest')}

  /* 파일명 → 차수 */
  function parseName(fn){
    var m=fn.match(/\(\s*([A-Za-z]{2,3})\s*(\d{1,4})\s*차\s*\)/)||fn.match(/([A-Za-z]{2,3})\s*(\d{1,4})\s*차/);
    if(!m)return null;
    var d=fn.match(/(\d{4})[.\-_](\d{1,2})[.\-_](\d{1,2})/),p=function(x){return String(x).padStart(2,'0')};
    var country=m[1].toUpperCase(),no=String(Number(m[2]));
    return{id:country+'-'+no,country:country,batchNo:no,label:no+'차 '+country,date:d?d[1]+'-'+p(d[2])+'-'+p(d[3]):''};
  }
  /* 엑셀 → 담당 시트별 TOTAL>0 행 */
  function parseBook(wb){
    var rows=[],sheets=[],cols=[],colSet={};
    wb.SheetNames.forEach(function(raw){
      var name=String(raw).trim();if(EXCLUDE[name])return;
      var aoa=XLSX.utils.sheet_to_json(wb.Sheets[raw],{header:1,defval:'',raw:true});
      var h=(aoa[0]||[]).map(function(x){return String(x).trim()});
      var ti=h.findIndex(function(x){return x.toUpperCase()==='TOTAL'}),ci=h.indexOf('제품코드'),ni=h.indexOf('제품명');
      if(ti<0||ci<0||ni<0||h.indexOf('PLU')<0)return; // 담당 시트 형식이 아니면 건너뜀
      sheets.push(name);
      aoa.slice(1).forEach(function(r){
        var total=num(r[ti]);if(!(total>0))return;
        var values={};
        h.forEach(function(k,i){
          if(!k||i===ci||i===ni||i===ti||k==='PLU'||k==='제품군')return; // A열 PLU·C열 제품군 제외
          var v=r[i],s=String(v).trim();
          values[k]=typeof v==='number'?v:(s===''||s==='-'?0:(/^-?[\d,]+(\.\d+)?$/.test(s)?num(s):s)); // 숫자는 숫자로, 글자(비고 등)는 그대로
          if(!colSet[k]){colSet[k]=1;cols.push(k)}
        });
        rows.push({sheet:name,code:String(r[ci]).trim(),name:String(r[ni]).trim(),total:total,values:values});
      });
    });
    return{rows:rows,sheets:sheets,cols:cols};
  }

  function load(){
    return fetch(API).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'입고리스트를 불러오지 못했습니다.');return}
      batches=j.batches||[];renderBatches();render();
    }).catch(function(){toast('입고리스트를 불러오지 못했습니다.')});
  }
  function current(){var v=$('ilBatch').value;return v==='*'?null:batches.find(function(b){return b.id===v})||null}
  function renderBatches(keep){
    var sel=$('ilBatch'),cur=keep||sel.value;
    sel.innerHTML=batches.length?batches.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+(b.date?' · '+esc(b.date):'')+'</option>'}).join('')+'<option value="*">전체 차수</option>':'<option value="">업로드된 입고리스트 없음</option>';
    if(cur&&(cur==='*'||batches.some(function(b){return b.id===cur})))sel.value=cur;
    $('ilDelete').hidden=!(canEdit()&&current());
  }
  function rowsOf(){
    var b=current();
    if(b)return b.rows.map(function(r){return Object.assign({batch:b},r)});
    var all=[];batches.forEach(function(x){(x.rows||[]).forEach(function(r){all.push(Object.assign({batch:x},r))})});return all;
  }
  function sheetsOf(){
    var b=current(),list=[];
    (b?[b]:batches).forEach(function(x){(x.sheets||[]).forEach(function(s){if(list.indexOf(s)<0)list.push(s)})});
    return list;
  }
  function breakdown(r){
    return Object.keys(r.values||{}).filter(function(k){return typeof r.values[k]==='number'&&r.values[k]>0}).map(function(k){return '<span>'+esc(k)+' <b>'+fmt(r.values[k])+'</b></span>'}).join('');
  }
  function render(){
    if(!$('ilList'))return;
    var q=($('ilSearch').value||'').trim().toLowerCase();
    var all=rowsOf(),sheets=sheetsOf();
    if(sheetFilter&&sheets.indexOf(sheetFilter)<0)sheetFilter='';
    var match=function(r){return !q||[r.sheet,label(r.sheet),r.code,r.name].join(' ').toLowerCase().indexOf(q)>=0};
    var counts={};all.filter(match).forEach(function(r){counts[r.sheet]=(counts[r.sheet]||0)+1});
    var qAll=all.filter(match);
    $('ilSheets').innerHTML='<button type="button" class="il-chip'+(sheetFilter?'':' on')+'" data-il-sheet="">전체 <em>'+qAll.length+'</em></button>'+
      sheets.map(function(s){var c=counts[s]||0;return '<button type="button" class="il-chip'+(sheetFilter===s?' on':'')+(c?'':' zero')+'" data-il-sheet="'+esc(s)+'" title="'+esc(s)+'">'+esc(label(s))+' <em>'+c+'</em></button>'}).join('');
    var list=qAll.filter(function(r){return !sheetFilter||r.sheet===sheetFilter});
    var b=current();
    $('ilCount').textContent=fmt(list.length);
    $('ilTotal').textContent=fmt(list.reduce(function(s,r){return s+(Number(r.total)||0)},0));
    $('ilOwners').textContent=fmt(Object.keys(list.reduce(function(o,r){o[r.sheet]=1;return o},{})).length);
    $('ilTitle').textContent=(sheetFilter?label(sheetFilter)+' ':'')+'입고리스트'+(b?' · '+b.label:batches.length?' · 전체 차수':'');
    $('ilMeta').textContent=b?(b.fileName?b.fileName:'')+(b.uploadedAt?' · '+b.uploadedAt.slice(0,10)+' 업로드':''):'';
    $('ilMeta').hidden=!b;
    if(!batches.length){$('ilList').innerHTML='<p class="il-empty">'+(canEdit()?'위에서 입고 분배리스트 엑셀을 올려 주세요.':'아직 업로드된 입고리스트가 없습니다.')+'</p>';return}
    $('ilList').innerHTML=list.length?list.map(function(r){
      return '<div class="il-item"><div class="il-item-top"><span class="il-owner" title="'+esc(r.sheet)+'">'+esc(label(r.sheet))+'</span>'+(b?'':'<span class="il-batch">'+esc(r.batch.label)+'</span>')+'<b class="il-name">'+esc(r.name)+'</b></div>'+
        '<div class="il-item-sub"><code>'+esc(r.code)+'</code><span class="il-total">TOTAL <b>'+fmt(r.total)+'</b>개</span></div>'+
        '<div class="il-split">'+(breakdown(r)||'<span class="il-muted">매장 구분 수량 없음</span>')+'</div></div>';
    }).join(''):'<p class="il-empty">조건에 맞는 제품이 없습니다.</p>';
  }

  function upload(file){
    if(!file||busy)return;
    var meta=parseName(file.name);
    if(!meta){toast('파일명에서 차수를 찾지 못했습니다. 예: "2026.10.21 입고 분배리스트 (JP 141차).xlsx"');return}
    if(batches.some(function(b){return b.id===meta.id})&&!confirm(meta.label+' 입고리스트가 이미 있습니다. 새 파일로 바꿀까요?'))return;
    busy=true;toast(meta.label+' 입고리스트를 읽는 중…');
    (window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)).then(function(){return file.arrayBuffer()}).then(function(buf){
      var p=parseBook(XLSX.read(buf,{type:'array'}));
      if(!p.sheets.length)throw new Error('담당자 시트(PLU·제품코드·제품군·제품명·TOTAL 형식)를 찾지 못했습니다.');
      var batch=Object.assign({},meta,{fileName:file.name,sheets:p.sheets,cols:p.cols,rows:p.rows});
      return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',batch:batch})}).then(function(r){return r.json()}).then(function(j){
        if(!j||!j.success)throw new Error((j&&j.error)||'저장하지 못했습니다.');
        toast(meta.label+' 입고리스트 '+fmt(p.rows.length)+'건 반영 (담당 '+p.sheets.length+'명)');
        sheetFilter='';return load().then(function(){renderBatches(meta.id);render()});
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;var f=$('ilFile');if(f)f.value=''});
  }
  function remove(){
    var b=current();if(!b)return;
    if(!confirm(b.label+' 입고리스트를 삭제할까요? (팀 전체에서 사라집니다)'))return;
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:b.id})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'삭제하지 못했습니다.');return}
      toast(b.label+' 입고리스트를 삭제했습니다.');load();
    });
  }

  function init(){
    var view=$('inboundListView');if(!view)return;
    $('ilFile').addEventListener('change',function(e){upload(e.target.files&&e.target.files[0])});
    $('ilBatch').addEventListener('change',function(){$('ilDelete').hidden=!(canEdit()&&current());render()});
    $('ilSearch').addEventListener('input',render);
    $('ilDelete').addEventListener('click',remove);
    $('ilSheets').addEventListener('click',function(e){var c=e.target.closest('[data-il-sheet]');if(!c)return;sheetFilter=c.getAttribute('data-il-sheet');render()});
    var up=view.querySelector('.il-upload');
    var sync=function(){if(up)up.hidden=!canEdit()};
    // 화면이 열릴 때마다 새로 받기
    new MutationObserver(function(){if(view.classList.contains('active')){sync();load()}}).observe(view,{attributes:true,attributeFilter:['class']});
    if(view.classList.contains('active')){sync();load()}
  }
  window.parseInboundListName=parseName; // 시험용
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
