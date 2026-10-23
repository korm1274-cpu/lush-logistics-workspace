/* 입고 > 입고리스트 (엑셀 '입고 분배리스트' 업로드)
   - 차수: 파일명에서 읽음. 예) "2026.10.21 입고 분배리스트 (JP 141차).xlsx" → 제조국 JP · 141차 → "141차 JP" (날짜 2026-10-21)
     괄호 뒤에 구분 이름이 있으면 따로 보관: "(JP 130차) AYR" → "130차 JP AYR", "(JP 130차) 시즌" → "130차 JP 시즌"
   - 담당 시트: 'PLU | 제품코드 | 제품군 | 제품명 | TOTAL | 매장 구분…' 형식의 시트만(제조·SPA리스트는 제외, 전체·CHECK·DATA 같은 집계 시트는 형식이 달라 자동 제외)
   - TOTAL이 0보다 큰 행만 반영, A열 PLU·C열 제품군을 뺀 나머지 칸(제품코드·제품명·TOTAL·리테일·디지털…)은 모두 저장
   - 화면: 차수 선택 + 담당(시트) 필터 + 검색(아마존·퍼즈처럼 한글 이름도 가능)
     목록은 표: 왼쪽 열 제품명, 위쪽 행 분배 매장명(리테일·디지털…), 칸에 수량, 맨 아래 합계
   - 업로드: 데이터 › 업로드의 '입고리스트 Excel' 카드에서만
   - 저장: /api/team-data?part=inbound-lists (차수별 보관, 팀 공유) */
(function(){
  var API='/api/team-data?part=inbound-lists';
  var EXCLUDE={'제조':1,'SPA리스트':1};
  var ALIAS={AMAZON:'아마존',FURZE:'퍼즈',ART:'아트',BLUE:'블루',VOL:'볼케이노',BUS:'버스',NEW:'뉴',TIME:'타임',STAR:'스타',TAROT:'타로',BLACK:'블랙',SAND:'샌드',HANAMI:'하나미',VM:'VM',LIMITED:'리미티드',SPA:'스파',BOOK:'북'};
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
    // 같은 차수라도 괄호 뒤 구분 이름이 다르면 다른 리스트: "(JP 130차) AYR.xlsx" → 130차 JP AYR / "(JP 130차) 시즌.xlsx" → 130차 JP 시즌
    var rest=fn.slice(m.index+m[0].length).replace(/\.(xlsx|xls|xlsm|csv)$/i,'').replace(/^[\s_\-–·.,]+|[\s_\-–·.,]+$/g,'').replace(/\s+/g,' ').slice(0,20);
    var key=rest.replace(/[^0-9A-Za-z가-힣]+/g,'_').replace(/^_+|_+$/g,'').slice(0,20);
    return{id:country+'-'+no+(key?'-'+key:''),country:country,batchNo:no,part:rest,label:no+'차 '+country+(rest?' '+rest:''),date:d?d[1]+'-'+p(d[2])+'-'+p(d[3]):''};
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
      batches=j.batches||[];renderDates();renderBatches();render();
    }).catch(function(){toast('입고리스트를 불러오지 못했습니다.')});
  }
  /* 필터: 입고일 선택 → 그 날짜에 입고된 차수만 차수 목록에 표시(같은 날 여러 차수면 '전체 차수'로 함께 보기) */
  function scope(){var d=$('ilDate').value;return d?batches.filter(function(b){return (b.date||'')===d}):batches}
  function current(){var v=$('ilBatch').value;return !v||v==='*'?null:scope().find(function(b){return b.id===v})||null}
  function renderDates(keepDate){
    var sel=$('ilDate'),cur=keepDate!=null?keepDate:sel.value,dates=[];
    batches.forEach(function(b){var d=b.date||'';if(dates.indexOf(d)<0)dates.push(d)});
    dates.sort(function(a,c){return c.localeCompare(a)});
    sel.innerHTML=batches.length?'<option value="">전체 날짜</option>'+dates.map(function(d){return '<option value="'+esc(d)+'">'+(d?esc(d):'날짜 없음')+'</option>'}).join(''):'<option value="">업로드된 입고리스트 없음</option>';
    var first=sel.dataset.init!=='1'&&!(keepDate!=null&&dates.indexOf(keepDate)>=0);if(batches.length)sel.dataset.init='1';
    sel.value=first?(dates[0]||''):(cur===''||dates.indexOf(cur)>=0?cur:(dates[0]||'')); // 처음 열 때는 가장 최근 입고일
  }
  function renderBatches(keep){
    var sel=$('ilBatch'),cur=keep||sel.value,list=scope();
    sel.innerHTML=list.length?list.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+'</option>'}).join('')+(list.length>1?'<option value="*">전체 차수 ('+list.length+')</option>':''):'<option value="">차수 없음</option>';
    if(cur&&(cur==='*'?list.length>1:list.some(function(b){return b.id===cur})))sel.value=cur;
    $('ilDelete').hidden=!(canEdit()&&current());
  }
  function rowsOf(){
    var b=current();
    if(b)return b.rows.map(function(r){return Object.assign({batch:b},r)});
    var all=[];scope().forEach(function(x){(x.rows||[]).forEach(function(r){all.push(Object.assign({batch:x},r))})});return all;
  }
  function sheetsOf(){
    var b=current(),list=[];
    (b?[b]:scope()).forEach(function(x){(x.sheets||[]).forEach(function(s){if(list.indexOf(s)<0)list.push(s)})});
    return list;
  }
  /* 표: 행 = 제품(왼쪽 제품명), 열 = 분배 매장(리테일·디지털…), 칸 = 수량. 지금 보이는 목록에서 전부 0인 매장 열은 숨김 */
  function tableHtml(list,b){
    var cols=[];
    list.forEach(function(r){Object.keys(r.values||{}).forEach(function(k){var v=r.values[k];if(typeof v==='number'&&v>0&&cols.indexOf(k)<0)cols.push(k)})});
    var order=[];(b?[b]:scope()).forEach(function(x){(x.cols||[]).forEach(function(k){if(order.indexOf(k)<0)order.push(k)})});
    cols.sort(function(a,c){var ia=order.indexOf(a),ic=order.indexOf(c);return (ia<0?999:ia)-(ic<0?999:ic)});
    var showOwner=!sheetFilter,sum={};
    var body=list.map(function(r){
      return '<tr><th scope="row" class="il-pname"><b>'+esc(r.name)+'</b><small>'+esc(r.code)+(showOwner?' · <span class="il-owner-t" title="'+esc(r.sheet)+'">'+esc(label(r.sheet))+'</span>':'')+(b?'':' · '+esc(r.batch.label))+'</small></th>'+
        '<td class="il-num il-tot">'+fmt(r.total)+'</td>'+
        cols.map(function(k){var v=r.values?r.values[k]:0;if(typeof v==='number'&&v>0){sum[k]=(sum[k]||0)+v;return '<td class="il-num">'+fmt(v)+'</td>'}return '<td class="il-num il-zero">-</td>'}).join('')+'</tr>';
    }).join('');
    return '<div class="il-table-wrap"><table class="il-table"><thead><tr><th scope="col" class="il-pname">제품명</th><th scope="col" class="il-num il-tot">TOTAL</th>'+cols.map(function(k){return '<th scope="col" class="il-num">'+esc(k)+'</th>'}).join('')+'</tr></thead>'+
      '<tbody>'+body+'</tbody><tfoot><tr><th scope="row" class="il-pname">합계 <small>'+fmt(list.length)+'개 제품</small></th><td class="il-num il-tot" title="위 요약의 총 입고수량과 같은 합계">'+fmt(totalOf(list,lastView&&lastView.q||''))+'</td>'+cols.map(function(k){return '<td class="il-num">'+fmt(sum[k]||0)+'</td>'}).join('')+'</tr></tfoot></table></div>';
  }
  /* 총 입고수량: 검색어가 없으면 파일 CHECK 시트 기준(전체·담당별 TOTAL), 검색 중이거나 CHECK가 없으면 보이는 행 합계 */
  function totalOf(list,q){
    var rowSum=list.reduce(function(s,r){return s+(Number(r.total)||0)},0);
    var bs=current()?[current()]:scope();
    var note=$('ilTotalNote');
    if(q||!bs.length||bs.some(function(b){return !b.check})){if(note)note.textContent='EA,G';return rowSum}
    var sum=0,ok=true;
    bs.forEach(function(b){
      if(sheetFilter){var v=b.check.bySheet[String(sheetFilter).toUpperCase()];if(typeof v==='number')sum+=v;else if((b.sheets||[]).indexOf(sheetFilter)>=0)ok=false}
      else{if(b.check.total)sum+=b.check.total;else ok=false}
    });
    if(!ok){if(note)note.textContent='EA,G';return rowSum}
    if(note)note.textContent='EA,G';
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
    $('ilTitle').textContent=(sheetFilter?label(sheetFilter)+' ':'')+'입고리스트'+(b?' · '+b.label:batches.length?' · '+($('ilDate').value?$('ilDate').value+' ':'')+'전체 차수':'');
    $('ilMeta').textContent=b?(b.fileName?b.fileName:'')+(b.uploadedAt?' · '+b.uploadedAt.slice(0,10)+' 업로드':''):'';
    $('ilMeta').hidden=!b;
    if(!batches.length){$('ilList').innerHTML='<p class="il-empty">'+(canEdit()?'데이터 › 업로드의 [입고리스트 Excel]에서 입고 분배리스트를 올려 주세요.':'아직 업로드된 입고리스트가 없습니다.')+'</p>';return}
    $('ilList').innerHTML=list.length?tableHtml(list,b):'<p class="il-empty">조건에 맞는 제품이 없습니다.</p>';
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
        sheetFilter='';return load().then(function(){renderDates(meta.date);renderBatches(meta.id);render()});
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
      var info=(v.batch&&v.batch.date?'입고일 '+v.batch.date+' · ':'')+'품목 '+v.list.length+'건 · 총 입고수량 '+fmt(totalOf(v.list,v.q))+' (EA,G)'+' · 출력 '+new Date().toLocaleDateString('ko-KR');
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
    $('ilDate').addEventListener('change',function(){renderBatches();render()});
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
