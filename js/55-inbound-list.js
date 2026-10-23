/* 입고 > 입고리스트 (엑셀 '입고 분배리스트' 업로드)
   - 차수: 파일명에서 읽음. 예) "2026.10.21 입고 분배리스트 (JP 141차).xlsx" → 제조국 JP · 141차 → "141차 JP" (날짜 2026-10-21)
   - 담당 시트: 'PLU | 제품코드 | 제품군 | 제품명 | TOTAL | 매장 구분…' 형식의 시트만(제조·SPA리스트는 제외, 전체·CHECK·DATA 같은 집계 시트는 형식이 달라 자동 제외)
   - TOTAL이 0보다 큰 행만 반영, A열 PLU·C열 제품군을 뺀 나머지 칸(제품코드·제품명·TOTAL·리테일·디지털…)은 모두 저장
   - 화면: 차수 선택 + 담당(시트) 필터 + 검색(아마존·퍼즈처럼 한글 이름도 가능)
     "ULTRAPLANT 45G — TOTAL 25 중 리테일 20 · 디지털 4 · 수원스파 1"
   - 업로드: 데이터 › 업로드의 '입고리스트 Excel' 카드에서만
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
    return{rows:rows,sheets:sheets,cols:cols,check:parseCheck(wb)};
  }
  /* CHECK 시트(담당별 TOTAL·전체 합계) → 합계는 이 기준으로 표시(시트끼리 겹치는 행이 있어도 파일과 같은 숫자) */
  function parseCheck(wb){
    var name=wb.SheetNames.find(function(n){return String(n).trim().toUpperCase()==='CHECK'});if(!name)return null;
    var aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true});
    var h=(aoa[0]||[]).map(function(x){return String(x).trim()});
    var ti=h.findIndex(function(x){return x.toUpperCase()==='TOTAL'}),ai=h.indexOf('전체');if(ti<0)return null;
    var bySheet={},total=ai>=0?num((aoa[1]||[])[ai]):0;
    aoa.slice(1).forEach(function(r){var s=String(r[1]==null?'':r[1]).trim();if(s&&typeof r[ti]==='number')bySheet[s.toUpperCase()]=r[ti]});
    return total||Object.keys(bySheet).length?{total:total,bySheet:bySheet}:null;
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
  /* 총 입고수량: 검색어가 없으면 파일 CHECK 시트 기준(전체·담당별 TOTAL), 검색 중이거나 CHECK가 없으면 보이는 행 합계 */
  function totalOf(list,q){
    var rowSum=list.reduce(function(s,r){return s+(Number(r.total)||0)},0);
    var bs=current()?[current()]:batches;
    var note=$('ilTotalNote');
    if(q||!bs.length||bs.some(function(b){return !b.check})){if(note)note.textContent=q?'검색 결과 합계':'EA';return rowSum}
    var sum=0,ok=true;
    bs.forEach(function(b){
      if(sheetFilter){var v=b.check.bySheet[String(sheetFilter).toUpperCase()];if(typeof v==='number')sum+=v;else if((b.sheets||[]).indexOf(sheetFilter)>=0)ok=false}
      else{if(b.check.total)sum+=b.check.total;else ok=false}
    });
    if(!ok){if(note)note.textContent='EA';return rowSum}
    if(note)note.textContent='EA · CHECK 시트 기준';
    return sum;
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
    lastView={list:list,batch:b,q:q};
    $('ilCount').textContent=fmt(list.length);
    $('ilTotal').textContent=fmt(totalOf(list,q));
    $('ilOwners').textContent=fmt(Object.keys(list.reduce(function(o,r){o[r.sheet]=1;return o},{})).length);
    $('ilTitle').textContent=(sheetFilter?label(sheetFilter)+' ':'')+'입고리스트'+(b?' · '+b.label:batches.length?' · 전체 차수':'');
    $('ilMeta').textContent=b?(b.fileName?b.fileName:'')+(b.uploadedAt?' · '+b.uploadedAt.slice(0,10)+' 업로드':''):'';
    $('ilMeta').hidden=!b;
    if(!batches.length){$('ilList').innerHTML='<p class="il-empty">'+(canEdit()?'데이터 › 업로드의 [입고리스트 Excel]에서 입고 분배리스트를 올려 주세요.':'아직 업로드된 입고리스트가 없습니다.')+'</p>';return}
    $('ilList').innerHTML=list.length?list.map(function(r){
      return '<div class="il-item"><div class="il-item-top"><span class="il-owner" title="'+esc(r.sheet)+'">'+esc(label(r.sheet))+'</span>'+(b?'':'<span class="il-batch">'+esc(r.batch.label)+'</span>')+'<b class="il-name">'+esc(r.name)+'</b></div>'+
        '<div class="il-item-sub"><code>'+esc(r.code)+'</code><span class="il-total">TOTAL <b>'+fmt(r.total)+'</b>개</span></div>'+
        '<div class="il-split">'+(breakdown(r)||'<span class="il-muted">매장 구분 수량 없음</span>')+'</div></div>';
    }).join(''):'<p class="il-empty">조건에 맞는 제품이 없습니다.</p>';
  }

  function upload(file,srcInput){
    if(!file||busy)return;
    var meta=parseName(file.name);
    if(!meta){if(srcInput)srcInput.value='';toast('파일명에서 차수를 찾지 못했습니다. 예: "2026.10.21 입고 분배리스트 (JP 141차).xlsx"');return}
    if(batches.some(function(b){return b.id===meta.id})&&!confirm(meta.label+' 입고리스트가 이미 있습니다. 새 파일로 바꿀까요?')){if(srcInput)srcInput.value='';return}
    busy=true;toast(meta.label+' 입고리스트를 읽는 중…');
    (window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)).then(function(){return file.arrayBuffer()}).then(function(buf){
      var p=parseBook(XLSX.read(buf,{type:'array'}));
      if(!p.sheets.length)throw new Error('담당자 시트(PLU·제품코드·제품군·제품명·TOTAL 형식)를 찾지 못했습니다.');
      var batch=Object.assign({},meta,{fileName:file.name,sheets:p.sheets,cols:p.cols,rows:p.rows,check:p.check});
      return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',batch:batch})}).then(function(r){return r.json()}).then(function(j){
        if(!j||!j.success)throw new Error((j&&j.error)||'저장하지 못했습니다.');
        toast(meta.label+' 입고리스트 '+fmt(p.rows.length)+'건 반영 (담당 '+p.sheets.length+'명)');
        sheetFilter='';return load().then(function(){renderBatches(meta.id);render()});
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;if(srcInput)srcInput.value=''});
  }
  /* 엑셀 내보내기: 지금 화면에 보이는 목록(차수·담당 필터·검색 반영) → A4 가로, 폭 1페이지에 맞춤, 제목 행 반복 인쇄 */
  var lastView=null;
  function exportExcel(){
    var v=lastView;if(!v||!v.list.length){toast('내보낼 입고리스트가 없습니다.');return}
    (window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)).then(function(){
      var cols=[];v.list.forEach(function(r){Object.keys(r.values||{}).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});
      var multi=!v.batch;
      var head=(multi?['차수']:[]).concat(['담당','제품코드','제품명','TOTAL']).concat(cols);
      var title=(v.batch?v.batch.label:'전체 차수')+' 입고리스트'+(sheetFilter?' · '+label(sheetFilter)+' ('+sheetFilter+')':'')+(v.q?' · 검색 "'+v.q+'"':'');
      var info=(v.batch&&v.batch.date?'입고일 '+v.batch.date+' · ':'')+'품목 '+v.list.length+'건 · 총 입고수량 '+fmt(totalOf(v.list,v.q))+'개'+(document.getElementById('ilTotalNote')&&/CHECK/.test($('ilTotalNote').textContent)?' (CHECK 시트 기준)':'')+' · 출력 '+new Date().toLocaleDateString('ko-KR');
      var aoa=[[title],[info],head];
      v.list.forEach(function(r){aoa.push((multi?[r.batch.label]:[]).concat([label(r.sheet),r.code,r.name,Number(r.total)||0]).concat(cols.map(function(k){var x=r.values?r.values[k]:'';return typeof x==='number'?(x||''):(x==null?'':x)})))});
      var ws=XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:head.length-1}},{s:{r:1,c:0},e:{r:1,c:head.length-1}}];
      ws['!cols']=head.map(function(h){return{wch:h==='제품명'?44:h==='제품코드'?12:h==='담당'||h==='차수'?10:Math.max(8,String(h).length*1.6)}});
      ws['!margins']={left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2};
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:2,c:0},e:{r:aoa.length-1,c:head.length-1}})};
      var wb=XLSX.utils.book_new(),sheetName='입고리스트';
      XLSX.utils.book_append_sheet(wb,ws,sheetName);
      wb.Workbook={Names:[{Name:'_xlnm.Print_Titles',Sheet:0,Ref:"'"+sheetName+"'!$3:$3"}]};
      var out=a4Landscape(XLSX.write(wb,{bookType:'xlsx',type:'array'}));
      var d=new Date(),p=function(n){return String(n).padStart(2,'0')};
      var name='입고리스트_'+(v.batch?v.batch.label.replace(/\s+/g,''):'전체차수')+(sheetFilter?'_'+label(sheetFilter):'')+'_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.xlsx';
      var blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
      toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  /* SheetJS 무료판은 인쇄 설정을 쓰지 못해, 만든 xlsx(zip) 안 시트 XML에 A4(9)·가로·폭 1페이지 맞춤을 직접 넣음 */
  function a4Landscape(buf){
    try{
      var CFB=XLSX.CFB,zip=CFB.read(new Uint8Array(buf),{type:'array'});
      var path=zip.FullPaths.find(function(p){return /xl\/worksheets\/sheet1\.xml$/.test(p)});if(!path)return buf;
      var file=CFB.find(zip,path),xml=new TextDecoder().decode(file.content);
      if(!/<sheetPr[ >]/.test(xml))xml=xml.replace(/(<worksheet[^>]*>)/,'$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
      else if(!/fitToPage/.test(xml))xml=xml.replace(/<sheetPr([^>]*)\/>/,'<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>').replace(/<sheetPr([^>]*)>(?!<pageSetUpPr)/,'<sheetPr$1><pageSetUpPr fitToPage="1"/>');
      var setup='<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
      xml=/<pageMargins[^>]*\/>/.test(xml)?xml.replace(/(<pageMargins[^>]*\/>)/,'$1'+setup):xml.replace('</worksheet>',setup+'</worksheet>');
      file.content=new TextEncoder().encode(xml);file.size=file.content.length;
      return CFB.write(zip,{fileType:'zip',type:'array'});
    }catch(e){return buf}
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
    $('ilBatch').addEventListener('change',function(){$('ilDelete').hidden=!(canEdit()&&current());render()});
    $('ilSearch').addEventListener('input',render);
    $('ilDelete').addEventListener('click',remove);
    $('ilExport').addEventListener('click',exportExcel);
    // 업로드는 데이터 › 업로드 화면의 '입고리스트 Excel' 카드에서만(입고리스트 화면에는 업로드 칸 없음)
    document.querySelectorAll('.ilUploadFile').forEach(function(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;if(!canEdit()){toast('게스트는 업로드할 수 없습니다.');inp.value='';return}upload(f,inp)})});
    $('ilSheets').addEventListener('click',function(e){var c=e.target.closest('[data-il-sheet]');if(!c)return;sheetFilter=c.getAttribute('data-il-sheet');render()});
    // 화면이 열릴 때마다 새로 받기
    new MutationObserver(function(){if(view.classList.contains('active')){load()}}).observe(view,{attributes:true,attributeFilter:['class']});
    if(view.classList.contains('active'))load()
  }
  window.parseInboundListName=parseName; // 시험용
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
