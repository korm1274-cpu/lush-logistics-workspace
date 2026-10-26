/* 입고 > 입고리스트 샘플 (수입팀 '상품 입고 CHECKLIST' 엑셀 — 구글 드라이브 자동 반영 + 데이터 › 업로드)
   - 해석: js/checklist-parse.js (서버 드라이브 반영과 같은 코드)
   - 표: PLU | 제품코드 | 품명 | 담당자 | 수량 | 분배처(리테일·디지털…) | 품질 | 제조일자 | LOT넘버 | REF넘버 | 케이스넘버
     제조일자·LOT·REF·케이스는 시트 오른쪽 팔레트 상세(C 구역)를 PLU로 붙인 값. 여러 건이면 [+N]으로 펼침
   - 제품코드·담당자: PLU 담당자 정보(+품질리스트에서 수기로 지정한 담당자)
   - 품질: 같은 차수 품질리스트(Q-차수)에 있는 PLU면 '품질' 표시(품질 시료로 빠질 제품)
   - 입고일: Checklist 시트의 실시간 입고 예정일. 바뀌면 이력(이전 → 새 날짜) 표시
   - 저장: /api/team-data?part=checklists */
(function(){
  var API='/api/team-data?part=checklists',MASTER_API='/api/team-data?part=plu-master',QUALITY_API='/api/team-data?part=quality-lists';
  var $=function(id){return document.getElementById(id)};
  var batches=[],master=null,overrides={},quality={},sheetFilter='',mgrFilter='',qOnly=false,busy=false,open={},lastView=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fmt(n){return (Number(n)||0).toLocaleString('ko-KR')}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function user(){return window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user()}
  function isAdmin(){var u=user();return !!(u&&u.role==='admin')}
  function canEdit(){var u=user();return !!(u&&u.role!=='guest')}
  function xlsx(){return window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)}
  function pad(n){return String(n).padStart(2,'0')}
  var DOW=['일','월','화','수','목','금','토'];
  function dayLabel(d){var m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return d||'-';var w=new Date(+m[1],+m[2]-1,+m[3]).getDay();return +m[2]+'월 '+(+m[3])+'일 ('+DOW[w]+')'}
  function md(d){var m=String(d||'').match(/^\d{4}-(\d{2})-(\d{2})$/);return m?m[1]+'/'+m[2]:d}
  function uniq(a){return a.filter(function(x,i){return x&&a.indexOf(x)===i})}

  /* ===== 제품코드·담당자 / 품질 ===== */
  function infoOf(plu,fallbackName){
    var l=(master&&master.map&&master.map[plu])||[];
    var code=uniq(l.map(function(x){return x[0]})).join(' / ');
    var mgr=uniq(l.map(function(x){return x[1]})).join(' / '),manual=false;
    if(!mgr&&overrides[plu]&&overrides[plu].mgr){mgr=overrides[plu].mgr;manual=true}
    return{code:code,mgr:mgr,manual:manual};
  }
  /* 같은 차수 품질리스트와 맞추기: 품질리스트 한 줄(단품 1줄 · 기프트 1개) = 품질 1개
     입고리스트에서 PLU + LOT번호 + 제조일자가 모두 맞는 줄에 1씩 더함(그 제품에 LOT·제조일자 정보가 아예 없으면 PLU만으로 더함). 하나라도 안 맞으면 '불일치'로 따로 모음(사유 포함)
     → 품질리스트 총 품질 수량 = 입고리스트 품질 합계 + 불일치 수 */
  function normLot(s){return String(s==null?'':s).replace(/[^0-9A-Za-z]/g,'').toUpperCase()}
  function qualityMatch(batchNo,rows){
    var qb=quality['Q-'+batchNo];if(!qb)return null;
    var res={total:0,matched:0,unmatched:[]};
    rows.forEach(function(r){r.qn=0;r.qEntries=[]});
    (qb.rows||[]).forEach(function(e){
      res.total++;
      var lot=normLot(e.lot),date=e.date||'',cands=rows.filter(function(r){return e.plu&&r.plu===e.plu});
      var hit=null;
      cands.some(function(r){if((r.details||[]).some(function(d){return normLot(d.lot)===lot&&d.date===date})){hit=r;return true}return false});
      if(hit){hit.qn++;hit.qEntries.push(e);res.matched++;return}
      var det=[];cands.forEach(function(r){det=det.concat(r.details||[])});
      // 입고리스트에 그 제품의 LOT·제조일자 정보 자체가 없으면(예: Whoosh DP 시트) 맞출 수 없으니 PLU만으로 반영
      if(cands.length&&!det.length){var h0=cands[0];h0.qn++;h0.qEntries.push(Object.assign({noInfo:true},e));res.matched++;return}
      var lotHit=det.filter(function(d){return normLot(d.lot)===lot}),dateHit=det.filter(function(d){return d.date===date});
      var reason=!cands.length?'입고리스트에 PLU 없음':!det.length?'입고리스트에 LOT·제조일자 정보 없음':lotHit.length?'제조일자 불일치':dateHit.length?'LOT 불일치':'LOT·제조일자 불일치';
      res.unmatched.push({kind:e.kind,plu:e.plu,name:e.name,lot:e.lot,date:date,reason:reason,
        ckLots:uniq((lotHit.length?lotHit:dateHit.length?dateHit:det).map(function(d){return d.lot})).slice(0,4).join(', '),
        ckDates:uniq((lotHit.length?lotHit:dateHit.length?dateHit:det).map(function(d){return d.date})).slice(0,4).join(', ')});
    });
    return res;
  }

  /* ===== 불러오기 ===== */
  function load(){
    return Promise.all([
      fetch(API).then(function(r){return r.json()}),
      fetch(MASTER_API).then(function(r){return r.json()}).catch(function(){return null}),
      fetch(QUALITY_API).then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(res){
      var j=res[0],m=res[1],q=res[2];
      if(!j||!j.success){toast((j&&j.error)||'입고리스트 샘플을 불러오지 못했습니다.');return}
      batches=j.batches||[];
      master=m&&m.success?m.master:null;overrides=(m&&m.success&&m.overrides)||{};
      quality={};((q&&q.success&&q.batches)||[]).forEach(function(b){quality[b.id]=b});
      renderBatches();render();
    }).catch(function(){toast('입고리스트 샘플을 불러오지 못했습니다.')});
  }
  function current(){var v=$('ckBatch').value;return batches.find(function(b){return b.id===v})||null}
  function renderBatches(keep){
    var sel=$('ckBatch'),cur=keep||sel.value;
    sel.innerHTML=batches.length?batches.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+' · '+esc(md(b.eta)||'-')+' 입고</option>'}).join(''):'<option value="">차수 없음</option>';
    if(cur&&batches.some(function(b){return b.id===cur}))sel.value=cur;
    $('ckDelete').hidden=!(isAdmin()&&current());
  }
  function renderInfo(b){
    var el=$('ckInfo');
    if(!b){el.innerHTML='';el.hidden=true;return}
    el.hidden=false;
    var hist=(b.etaHistory||[]).slice(-3).map(function(h){return '<span class="ck-eta-h" title="'+esc((h.at||'').slice(0,16).replace('T',' '))+' 반영 · '+esc(h.file||'')+'">'+esc(md(h.from))+' → '+esc(md(h.to))+'</span>'}).join('');
    var info=b.info||{};
    el.innerHTML='<div class="ck-eta"><span>실시간 입고 예정일</span><b>'+esc(dayLabel(b.eta))+'</b>'+(hist?'<div class="ck-eta-hist"><small>변경</small>'+hist+'</div>':'')+'</div>'+
      '<dl class="ck-meta">'+
        '<div><dt>출발 · 주문</dt><dd>'+esc([b.country,b.orders].filter(Boolean).join(' · ')||'-')+'</dd></div>'+
        '<div><dt>Order Number</dt><dd>'+esc(info.orders||'-')+'</dd></div>'+
        '<div><dt>Pallet 수</dt><dd>'+esc(info.pallets||'-')+'</dd></div>'+
        '<div><dt>주요 입고 제품</dt><dd>'+esc(info.products||'-')+'</dd></div>'+
        (info.changes?'<div class="ck-changes"><dt>수정내역</dt><dd>'+esc(info.changes)+'</dd></div>':'')+
      '</dl>'+
      '<div class="ck-src">'+(b.source==='drive'?'구글 드라이브 자동 반영':'직접 업로드')+' · '+esc(b.fileName||'')+(b.uploadedAt?' · '+esc(b.uploadedAt.slice(0,16).replace('T',' '))+' 반영':'')+'</div>';
  }
  function render(){
    if(!$('ckList'))return;
    var b=current();renderInfo(b);
    if(!batches.length){$('ckSheets').innerHTML='';$('ckMgrs').innerHTML='';$('ckList').innerHTML='<p class="ck-empty">'+(canEdit()?'구글 드라이브 폴더에 체크리스트를 올리면 자동으로 반영됩니다. (데이터 › 업로드의 [입고리스트 샘플 Excel]로 직접 올릴 수도 있습니다.)':'아직 반영된 입고리스트 샘플이 없습니다.')+'</p>';['ckCount','ckQty','ckQuality'].forEach(function(k){$(k).textContent='0'});return}
    if(!b)return;
    var q=($('ckSearch').value||'').trim().toLowerCase();
    var all=(b.rows||[]).map(function(r,i){var inf=infoOf(r.plu);return Object.assign({key:b.id+'#'+i},r,inf)});
    var qr=qualityMatch(b.batchNo,all);
    all.forEach(function(r){r.q=r.qn>0});
    $('ckQualityNote').textContent=qr?'품질리스트 '+b.batchNo+'차와 연결됨':'같은 차수 품질리스트 없음 — 품질리스트가 올라오면 자동으로 맞춥니다';
    var match=function(r){return !q||[r.plu,r.code,r.name,r.mgr,r.sheet,(r.details||[]).map(function(d){return d.lot+' '+d.ref+' '+d.cs}).join(' ')].join(' ').toLowerCase().indexOf(q)>=0};
    var qAll=all.filter(match);
    var sheets=b.sheets||[],sc={};qAll.forEach(function(r){sc[r.sheet]=(sc[r.sheet]||0)+1});
    if(sheetFilter&&sheets.indexOf(sheetFilter)<0)sheetFilter='';
    $('ckSheets').innerHTML=sheets.length>1?'<button type="button" class="ck-chip'+(sheetFilter?'':' on')+'" data-ck-sheet="">전체 주문 <em>'+qAll.length+'</em></button>'+sheets.map(function(s){return '<button type="button" class="ck-chip'+(sheetFilter===s?' on':'')+(sc[s]?'':' zero')+'" data-ck-sheet="'+esc(s)+'">'+esc(s)+' <em>'+(sc[s]||0)+'</em></button>'}).join(''):'';
    var inSheet=qAll.filter(function(r){return !sheetFilter||r.sheet===sheetFilter});
    var mgrName=function(r){return r.mgr||'담당자 없음'},mc={};inSheet.forEach(function(r){var k=mgrName(r);mc[k]=(mc[k]||0)+1});
    var mk=Object.keys(mc).sort(function(a,c){return (a==='담당자 없음')-(c==='담당자 없음')||mc[c]-mc[a]||a.localeCompare(c)});
    if(mgrFilter&&!mc[mgrFilter])mgrFilter='';
    var qCount=inSheet.reduce(function(s,r){return s+(r.qn||0)},0);
    $('ckMgrs').innerHTML='<button type="button" class="ck-chip'+(mgrFilter?'':' on')+'" data-ck-mgr="">전체 담당 <em>'+inSheet.length+'</em></button>'+mk.map(function(k){return '<button type="button" class="ck-chip'+(mgrFilter===k?' on':'')+(k==='담당자 없음'?' none':'')+'" data-ck-mgr="'+esc(k)+'">'+esc(k)+' <em>'+mc[k]+'</em></button>'}).join('')+
      '<button type="button" class="ck-chip ck-qchip'+(qOnly?' on':'')+(qCount?'':' zero')+'" data-ck-qonly>품질 대상만 <em>'+qCount+'</em></button>';
    var list=inSheet.filter(function(r){return (!mgrFilter||mgrName(r)===mgrFilter)&&(!qOnly||r.q)});
    var cols=[];(b.cols||[]).forEach(function(k){if(list.some(function(r){return r.values&&r.values[k]}))cols.push(k)});
    lastView={list:list,batch:b,cols:cols,q:q};
    var qtySum=list.reduce(function(s,r){return s+(Number(r.qty)||0)},0);
    var qSum=list.reduce(function(s,r){return s+(r.qn||0)},0);
    $('ckCount').textContent=fmt(list.length);$('ckQty').textContent=fmt(qtySum);
    // 품질 수량: 입고리스트 품질 합계 / 품질리스트 총 수량 (필터 없이 전체 기준)
    $('ckQuality').textContent=qr?fmt(qr.matched)+' / '+fmt(qr.total):'-';
    var kq=$('ckQuality').closest('.kpi');if(kq){kq.classList.toggle('ck-q-ok',!!qr&&!qr.unmatched.length);kq.classList.toggle('ck-q-bad',!!qr&&!!qr.unmatched.length)}
    $('ckTitle').textContent='입고리스트 샘플 · '+b.label+(sheetFilter?' · '+sheetFilter:'')+(mgrFilter?' · '+mgrFilter:'')+(qOnly?' · 품질 대상':'');
    // 품질 맞춤 결과: 같으면 한 줄, 다르면 불일치 목록(품질리스트 LOT·제조일자 vs 입고리스트 값, 사유)
    var qbox='';
    if(qr){
      qbox=qr.unmatched.length
        ?'<div class="ck-qsum bad"><b>품질 수량 불일치</b> 품질리스트 '+b.batchNo+'차 <strong>'+fmt(qr.total)+'</strong>개 · 입고리스트 반영 <strong>'+fmt(qr.matched)+'</strong>개 · 따로 확인 <strong>'+fmt(qr.unmatched.length)+'</strong>개'+
          '<div class="ck-qmiss-wrap"><table class="ck-qmiss"><thead><tr><th>구분</th><th>PLU</th><th>품명</th><th>품질 LOT</th><th>품질 제조일자</th><th>사유</th><th>입고리스트 LOT</th><th>입고리스트 제조일자</th></tr></thead><tbody>'+
          qr.unmatched.map(function(u){return '<tr><td>'+esc(u.kind)+'</td><td>'+esc(u.plu||'-')+'</td><td class="n">'+esc(u.name)+'</td><td>'+esc(u.lot||'-')+'</td><td>'+esc(u.date||'-')+'</td><td class="r">'+esc(u.reason)+'</td><td>'+esc(u.ckLots||'-')+'</td><td>'+esc(u.ckDates||'-')+'</td></tr>'}).join('')+'</tbody></table></div></div>'
        :'<div class="ck-qsum ok"><b>✓ 품질 수량 일치</b> 품질리스트 '+b.batchNo+'차 '+fmt(qr.total)+'개 = 입고리스트 '+fmt(qr.matched)+'개 (PLU · LOT · 제조일자 기준)</div>';
    }
    if(!list.length){$('ckList').innerHTML=qbox+'<p class="ck-empty">조건에 맞는 제품이 없습니다.</p>';return}
    var td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="ck-dash">-</span>':esc(v))+'</td>'};
    var sum={};
    var body=list.map(function(r){
      var d=r.details||[],first=d[0]||{},more=d.length>1,isOpen=!!open[r.key];
      var multi=function(k){var u=uniq(d.map(function(x){return x[k]}));return u.length>1?u[0]+' 외 '+(u.length-1):(u[0]||'')};
      var qcell=r.qn?'<td class="ck-num ck-q"><span class="ck-qbadge" title="'+esc(r.qEntries.map(function(x){return x.kind+' · '+x.name+' · LOT '+(x.lot||'-')+' · 제조 '+(x.date||'-')+(x.noInfo?' (입고리스트에 LOT 정보 없어 PLU로 반영)':'')}).join('\n'))+'">'+r.qn+'</span></td>':'<td class="ck-num ck-q"><span class="ck-dash">-</span></td>';
      var main='<tr class="'+(r.q?'ck-has-q':'')+'">'+td(r.plu,'ck-plu')+td(r.code,'ck-code')+'<td class="ck-name"><b>'+esc(r.name)+'</b>'+(sheets.length>1&&!sheetFilter?'<small>'+esc(r.sheet)+'</small>':'')+'</td>'+
        '<td class="ck-mgr'+(r.mgr?'':' ck-nomgr')+'">'+(r.mgr?esc(r.mgr)+(r.manual?' <span class="ck-manual">수기</span>':''):'<span class="ck-dash">-</span>')+'</td>'+
        '<td class="ck-num ck-tot">'+fmt(r.qty)+'</td>'+qcell+
        cols.map(function(k){var v=r.values&&r.values[k];if(v){sum[k]=(sum[k]||0)+v;return '<td class="ck-num">'+fmt(v)+'</td>'}return '<td class="ck-num ck-zero">-</td>'}).join('')+
        td(multi('date'),'ck-date')+'<td class="ck-lot">'+(first.lot?esc(multi('lot')):'<span class="ck-dash">-</span>')+(more?' <button type="button" class="ck-more" data-ck-open="'+esc(r.key)+'" aria-expanded="'+isOpen+'">'+(isOpen?'접기':'+'+(d.length-1))+'</button>':'')+'</td>'+
        td(multi('ref'),'ck-ref')+td(multi('cs'),'ck-case')+'</tr>';
      if(!more||!isOpen)return main;
      // 펼친 줄: 케이스(팔레트)별 수량 · 제조일자 · LOT · REF · 케이스
      var blanks=cols.map(function(){return '<td></td>'}).join('');
      return main+d.map(function(x){return '<tr class="ck-sub"><td></td><td></td><td class="ck-name"><span class="ck-sub-mark">└</span> 케이스 '+esc(x.cs||'-')+' · '+fmt(x.qty)+'개</td><td></td><td class="ck-num">'+(x.qty?fmt(x.qty):'')+'</td><td></td>'+blanks+td(x.date,'ck-date')+td(x.lot,'ck-lot')+td(x.ref,'ck-ref')+td(x.cs,'ck-case')+'</tr>'}).join('');
    }).join('');
    $('ckList').innerHTML=qbox+'<div class="ck-table-wrap"><table class="ck-table"><thead><tr><th class="ck-plu">PLU</th><th class="ck-code">제품코드</th><th class="ck-name">품명</th><th class="ck-mgr">담당자</th><th class="ck-num ck-tot">수량</th><th class="ck-num ck-q">품질</th>'+cols.map(function(k){return '<th class="ck-num">'+esc(k)+'</th>'}).join('')+'<th class="ck-date">제조일자</th><th class="ck-lot">LOT넘버</th><th class="ck-ref">REF넘버</th><th class="ck-case">케이스넘버</th></tr></thead><tbody>'+body+'</tbody>'+
      '<tfoot><tr><td></td><td></td><th class="ck-name">합계 <small>'+fmt(list.length)+'개 제품</small></th><td></td><td class="ck-num ck-tot">'+fmt(qtySum)+'</td><td class="ck-num ck-q">'+(qSum?fmt(qSum):'-')+'</td>'+cols.map(function(k){return '<td class="ck-num">'+fmt(sum[k]||0)+'</td>'}).join('')+'<td></td><td></td><td></td><td></td></tr></tfoot></table></div>';
  }

  /* ===== 직접 업로드(데이터 › 업로드) ===== */
  function upload(file,inp){
    if(!file||busy)return;
    busy=true;toast(file.name+' 읽는 중…');
    xlsx().then(function(){return file.arrayBuffer()}).then(function(buf){
      var CP=window.ChecklistParse,wb=XLSX.read(buf,{type:'array',cellNF:true});
      var p=CP.parseSheets(wb.SheetNames.map(function(n){return{name:n,aoa:CP.aoaFromSheetJS(wb.Sheets[n],XLSX)}}),file.name);
      if(!p.batchNo)throw new Error('파일명에서 차수를 찾지 못했습니다. (예: … - 142차)_….xlsx)');
      if(!p.rows.length)throw new Error('분배 표(PLU · Description · 수량 · 리테일 …)를 찾지 못했습니다.');
      var modified=new Date(file.lastModified||Date.now()).toISOString();
      return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',parsed:p,fileName:file.name,modified:modified})}).then(function(r){return r.json()}).then(function(s){
        if(!s||!s.success)throw new Error((s&&s.error)||'저장하지 못했습니다.');
        if(s.skipped){toast(s.reason||'이미 더 최근 파일이 반영되어 있습니다.');return}
        toast(s.batch.label+' 입고리스트 샘플 반영: '+fmt(s.batch.rows)+'건 · 입고 예정일 '+md(s.batch.eta)+(s.batch.etaChanged?' (변경됨)':''));
        return load().then(function(){renderBatches(s.batch.id);render()});
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;if(inp)inp.value=''});
  }

  /* ===== 복사 · 엑셀 · 삭제 ===== */
  function flat(v){
    var head=['PLU','제품코드','품명','담당자','수량','품질'].concat(v.cols).concat(['제조일자','LOT넘버','REF넘버','케이스넘버']),out=[head];
    v.list.forEach(function(r){var d=r.details||[];var j=function(k){return uniq(d.map(function(x){return x[k]})).join(', ')};
      out.push([r.plu,r.code,r.name,r.mgr,r.qty,r.qn||''].concat(v.cols.map(function(k){return (r.values&&r.values[k])||''})).concat([j('date'),j('lot'),j('ref'),j('cs')]))});
    return out;
  }
  function copyText(){
    var v=lastView;if(!v||!v.list.length){toast('복사할 목록이 없습니다.');return}
    var clean=function(x){return String(x==null?'':x).replace(/[\t\r\n]+/g,' ').trim()};
    var text=flat(v).map(function(r){return r.map(clean).join('\t')}).join('\n');
    var done=function(){toast(fmt(v.list.length)+'개 제품을 복사했습니다.')};
    var fallback=function(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-1000px;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();if(ok)done();else toast('복사하지 못했습니다. 다시 시도해 주세요.')};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function exportExcel(){
    var v=lastView;if(!v||!v.list.length){toast('내보낼 목록이 없습니다.');return}
    xlsx().then(function(){
      var rows=flat(v),title=v.batch.label+' 입고리스트 샘플 · 입고 예정일 '+v.batch.eta+(sheetFilter?' · '+sheetFilter:'')+(mgrFilter?' · '+mgrFilter:'')+(qOnly?' · 품질 대상':'');
      var ws=XLSX.utils.aoa_to_sheet([[title]].concat(rows));
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:rows[0].length-1}}];
      ws['!cols']=rows[0].map(function(h){return{wch:h==='품명'?42:/LOT|REF|제조일자|케이스/.test(h)?16:h==='제품코드'?12:10}});
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:rows.length,c:rows[0].length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'입고리스트 샘플');
      var d=new Date(),name='입고리스트샘플_'+v.batch.label.replace(/\s+/g,'')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  function remove(){
    var b=current();if(!b)return;
    if(!isAdmin()){toast('차수 삭제는 관리자만 할 수 있습니다.');return}
    if(!confirm(b.label+' 입고리스트 샘플을 삭제할까요? (팀 전체에서 사라집니다. 드라이브 파일이 수정되면 다시 들어올 수 있습니다)'))return;
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:b.id})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'삭제하지 못했습니다.');return}
      toast(b.label+' 입고리스트 샘플을 삭제했습니다.');load();
    });
  }

  function init(){
    document.querySelectorAll('.ckUploadFile').forEach(function(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;if(!canEdit()){toast('게스트는 업로드할 수 없습니다.');inp.value='';return}upload(f,inp)})});
    var view=$('checklistView');if(!view)return;
    $('ckBatch').addEventListener('change',function(){sheetFilter='';mgrFilter='';$('ckDelete').hidden=!(isAdmin()&&current());render()});
    $('ckSearch').addEventListener('input',render);
    $('ckDelete').addEventListener('click',remove);
    $('ckCopy').addEventListener('click',copyText);
    $('ckExport').addEventListener('click',exportExcel);
    $('ckSheets').addEventListener('click',function(e){var c=e.target.closest('[data-ck-sheet]');if(!c)return;sheetFilter=c.getAttribute('data-ck-sheet');render()});
    $('ckMgrs').addEventListener('click',function(e){
      if(e.target.closest('[data-ck-qonly]')){qOnly=!qOnly;render();return}
      var c=e.target.closest('[data-ck-mgr]');if(!c)return;mgrFilter=c.getAttribute('data-ck-mgr');render();
    });
    $('ckList').addEventListener('click',function(e){var t=e.target.closest('[data-ck-open]');if(!t)return;var k=t.getAttribute('data-ck-open');open[k]=!open[k];render()});
    var was=false;
    var opened=function(){var on=view.classList.contains('active');if(on&&!was)load();was=on};
    new MutationObserver(opened).observe(view,{attributes:true,attributeFilter:['class']});
    opened();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
