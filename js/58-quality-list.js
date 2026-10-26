/* 입고 > 품질리스트 (엑셀 '시험의뢰서' 업로드)
   - 파일: "142차 시험의뢰서.xlsx" — 단품 시트(No.|(PLU)|Lot No.|제조일자|품명/용량(g)|…|입고수량|제품코드|INVOICE|차수)
           GIFT 시트(기프트명|GIFT LOT No.|(PLU)|품명/용량(g)|용도|Lot No.|제조일자|…|차수) — 기프트명이 적힌 줄부터 아래 빈 줄까지가 한 기프트의 구성품
   - 차수: 차수 칸 → '해 당 차 수' 칸 → 파일명 "142차" 순서로 읽음 (같은 차수를 다시 올리면 교체)
   - PLU: 뒤에 붙은 KR은 빼고 숫자만(앞의 0도 뺌: 09214KR → 9214). GIFT는 GIFT LOT 앞자리(65565260914I2401 → 65565)가 기프트 PLU, 그다음 6자리가 제조일자
   - 제품코드·담당자: 데이터 › 업로드의 'PLU 담당자 정보'(제품 마스터 엑셀)에서 PLU로 찾음. 마스터에 없으면 파일의 제품코드(#N/A 제외)
   - 표: PLU | 제품코드 | 제품명 | 담당자 | LOT넘버 | 제조일자 | 입고수량 | 차수 (GIFT는 한 줄, 누르면 구성품 펼침)
   - 저장: /api/team-data?part=quality-lists (차수별), /api/team-data?part=plu-master (마스터 통째로) */
(function(){
  var API='/api/team-data?part=quality-lists',MASTER_API='/api/team-data?part=plu-master';
  var $=function(id){return document.getElementById(id)};
  var batches=[],master=null,kindFilter='',mgrFilter='',busy=false,open={},lastView=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fmt(n){return (Number(n)||0).toLocaleString('ko-KR')}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function user(){return window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user()}
  function isAdmin(){var u=user();return !!(u&&u.role==='admin')}
  function canEdit(){var u=user();return !!(u&&u.role!=='guest')}
  function xlsx(){return window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)}
  // 해석 규칙(PLU 정리·날짜·GIFT LOT·차수)은 js/quality-parse.js — 구글 드라이브 자동 반영(서버)과 같은 코드
  var QP=window.QualityParse,normPlu=QP.normPlu,pad=function(n){return String(n).padStart(2,'0')};
  function headOf(r){return (r||[]).map(function(x){return String(x==null?'':x).replace(/\s+/g,' ').trim()})}
  /* ===== 엑셀 → 품질리스트 ===== */
  function parseQuality(wb,fileName){
    return QP.parseSheets(wb.SheetNames.map(function(sn){return{name:sn,aoa:XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false})}}),fileName);
  }
  /* ===== 엑셀 → PLU 마스터 (PLU | 제품코드 | … | 제품명 | 물류 담당자 …) ===== */
  function parseMaster(wb){
    var map={},count=0;
    wb.SheetNames.forEach(function(sn){
      var aoa=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
      var hi=-1,h=null;
      for(var i=0;i<Math.min(15,aoa.length);i++){var x=headOf(aoa[i]);if(x.indexOf('PLU')>=0&&x.indexOf('제품코드')>=0){hi=i;h=x;break}}
      if(hi<0)return;
      var pi=h.indexOf('PLU'),ci=h.indexOf('제품코드'),ni=h.indexOf('제품명'),mi=h.findIndex(function(k){return /담당/.test(k)});
      aoa.slice(hi+1).forEach(function(r){
        var k=normPlu(r[pi]);if(!k)return;
        var e=[String(r[ci]||'').trim(),mi>=0?String(r[mi]||'').trim():'',ni>=0?String(r[ni]||'').trim():''];
        var list=map[k]||(map[k]=[]);
        if(!list.some(function(x){return x[0]===e[0]&&x[1]===e[1]})){list.push(e);count++}
      });
    });
    return{map:map,count:count};
  }
  function look(plu){var l=master&&master.map&&master.map[plu];return Array.isArray(l)?l:[]}
  function uniq(a){return a.filter(function(x,i){return x&&a.indexOf(x)===i})}
  // 담당자: 마스터 값이 우선, 마스터에 담당자가 없으면 화면에서 수기로 지정한 값(overrides, PLU별·팀 공유)
  var overrides={};
  function infoOf(r){
    var l=look(r.plu);
    var code=uniq(l.map(function(x){return x[0]})).join(' / ')||r.code||'';
    var mgr=uniq(l.map(function(x){return x[1]})).join(' / '),manual=false;
    if(!mgr&&r.plu&&overrides[r.plu]&&overrides[r.plu].mgr){mgr=overrides[r.plu].mgr;manual=true}
    return{code:code,mgr:mgr,manual:manual};
  }
  function mgrOptions(){
    var s={};
    Object.keys((master&&master.map)||{}).forEach(function(k){master.map[k].forEach(function(x){if(x[1])s[x[1]]=1})});
    Object.keys(overrides).forEach(function(k){if(overrides[k].mgr)s[overrides[k].mgr]=1});
    return Object.keys(s).sort();
  }
  // 담당자 칸: 마스터 값은 그대로, 비어 있으면 [+ 담당자 지정], 수기로 정한 값은 '수기' 표시 + 눌러서 변경
  function mgrCell(plu,inf){
    if(inf.mgr&&!inf.manual)return '<td class="ql-mgr">'+esc(inf.mgr)+'</td>';
    if(!plu)return '<td class="ql-mgr ql-nomgr"><span class="ql-dash">-</span></td>';
    if(!canEdit())return inf.mgr?'<td class="ql-mgr">'+esc(inf.mgr)+' <span class="ql-manual">수기</span></td>':'<td class="ql-mgr ql-nomgr"><span class="ql-dash">-</span></td>';
    return inf.mgr?'<td class="ql-mgr"><button type="button" class="ql-mgr-edit" data-ql-mgr-edit="'+esc(plu)+'" title="PLU '+esc(plu)+' 담당자 변경 (수기 지정)">'+esc(inf.mgr)+' <span class="ql-manual">수기</span></button></td>'
      :'<td class="ql-mgr ql-nomgr"><button type="button" class="ql-mgr-add" data-ql-mgr-edit="'+esc(plu)+'" title="PLU '+esc(plu)+' 담당자를 직접 지정">+ 담당자 지정</button></td>';
  }
  function editMgr(btn){
    var plu=btn.getAttribute('data-ql-mgr-edit'),td=btn.closest('td'),cur=(overrides[plu]&&overrides[plu].mgr)||'';
    td.innerHTML='<span class="ql-mgr-form"><input class="ql-mgr-input" list="qlMgrOptions" value="'+esc(cur)+'" placeholder="담당자" aria-label="PLU '+esc(plu)+' 담당자"><button type="button" class="ql-mgr-save">저장</button><button type="button" class="ql-mgr-cancel" title="취소">✕</button></span>';
    var dl=$('qlMgrOptions');if(!dl){dl=document.createElement('datalist');dl.id='qlMgrOptions';document.body.appendChild(dl)}
    dl.innerHTML=mgrOptions().map(function(m){return '<option value="'+esc(m)+'">'}).join('');
    var inp=td.querySelector('input');inp.focus();inp.select();
    var done=false;
    var save=function(){
      if(done)return;done=true;
      var v=inp.value.trim().slice(0,40);
      if(v===cur){render();return}
      fetch(MASTER_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'override',plu:plu,mgr:v})}).then(function(r){return r.json()}).then(function(j){
        if(!j||!j.success){toast((j&&j.error)||'저장하지 못했습니다.');render();return}
        if(v)overrides[plu]={mgr:v,by:(user()||{}).id,at:new Date().toISOString()};else delete overrides[plu];
        toast(v?'PLU '+plu+' 담당자를 '+v+'(으)로 지정했습니다.':'PLU '+plu+' 수기 담당자를 지웠습니다.');
        render();
      }).catch(function(){toast('저장하지 못했습니다.');render()});
    };
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();save()}else if(e.key==='Escape'){done=true;render()}});
    td.querySelector('.ql-mgr-save').addEventListener('click',save);
    td.querySelector('.ql-mgr-cancel').addEventListener('click',function(){done=true;render()});
  }

  /* ===== 불러오기 ===== */
  function load(){
    return Promise.all([
      fetch(API).then(function(r){return r.json()}),
      fetch(MASTER_API).then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(res){
      var j=res[0],m=res[1];
      if(!j||!j.success){toast((j&&j.error)||'품질리스트를 불러오지 못했습니다.');return}
      batches=j.batches||[];master=m&&m.success?m.master:null;overrides=(m&&m.success&&m.overrides)||{};
      renderBatches();render();
    }).catch(function(){toast('품질리스트를 불러오지 못했습니다.')});
  }
  function current(){var v=$('qlBatch').value;return !v||v==='*'?null:batches.find(function(b){return b.id===v})||null}
  function renderBatches(keep){
    var sel=$('qlBatch'),cur=keep||sel.value;
    sel.innerHTML=batches.length?batches.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+'</option>'}).join('')+(batches.length>1?'<option value="*">전체 차수 ('+batches.length+')</option>':''):'<option value="">차수 없음</option>';
    if(cur&&(cur==='*'?batches.length>1:batches.some(function(b){return b.id===cur})))sel.value=cur;
    $('qlDelete').hidden=!(isAdmin()&&current());
  }
  function rowsOf(){
    var b=current(),out=[];
    (b?[b]:batches).forEach(function(x){(x.rows||[]).forEach(function(r,i){var inf=infoOf(r);out.push(Object.assign({batch:x,key:x.id+'#'+i},r,inf))})});
    return out;
  }
  function masterNote(){
    var el=$('qlMaster');if(!el)return;
    if(!master){el.innerHTML='<b>PLU 담당자 정보 없음</b> · 데이터 › 업로드의 [PLU 담당자 정보]를 올리면 제품코드·담당자가 채워집니다.';el.classList.add('warn');return}
    el.classList.remove('warn');
    el.innerHTML='PLU 담당자 정보: <b>'+esc(master.fileName||'제품 마스터')+'</b> · PLU '+fmt(master.count)+'개 · '+esc(String(master.updatedAt||'').slice(0,10))+' 업데이트';
  }
  function render(){
    if(!$('qlList'))return;
    masterNote();
    var q=($('qlSearch').value||'').trim().toLowerCase();
    var all=rowsOf();
    var match=function(r){return !q||[r.code,r.plu,r.name,r.mgr,r.lot,(r.items||[]).map(function(x){return x.name+' '+x.plu+' '+x.lot}).join(' ')].join(' ').toLowerCase().indexOf(q)>=0};
    var qAll=all.filter(match);
    var mgrName=function(r){return r.mgr||'담당자 없음'};
    var kinds={'':qAll.length,'단품':0,'GIFT':0};qAll.forEach(function(r){kinds[r.kind]++});
    var inKind=qAll.filter(function(r){return !kindFilter||r.kind===kindFilter});
    var mgrs={};inKind.forEach(function(r){var k=mgrName(r);mgrs[k]=(mgrs[k]||0)+1});
    var mgrKeys=Object.keys(mgrs).sort(function(a,b){return (a==='담당자 없음')-(b==='담당자 없음')||mgrs[b]-mgrs[a]||a.localeCompare(b)});
    if(mgrFilter&&!mgrs[mgrFilter])mgrFilter='';
    $('qlKinds').innerHTML=[['','전체'],['단품','단품'],['GIFT','GIFT']].map(function(k){return '<button type="button" class="ql-chip'+(kindFilter===k[0]?' on':'')+(kinds[k[0]]?'':' zero')+'" data-ql-kind="'+k[0]+'">'+k[1]+' <em>'+kinds[k[0]]+'</em></button>'}).join('');
    $('qlMgrs').innerHTML='<button type="button" class="ql-chip'+(mgrFilter?'':' on')+'" data-ql-mgr="">전체 담당 <em>'+inKind.length+'</em></button>'+mgrKeys.map(function(k){return '<button type="button" class="ql-chip'+(mgrFilter===k?' on':'')+(k==='담당자 없음'?' none':'')+'" data-ql-mgr="'+esc(k)+'">'+esc(k)+' <em>'+mgrs[k]+'</em></button>'}).join('');
    var list=inKind.filter(function(r){return !mgrFilter||mgrName(r)===mgrFilter});
    var b=current();
    lastView={list:list,batch:b,q:q};
    var qtySum=list.reduce(function(s,r){return s+(Number(r.qty)||0)},0);
    $('qlCount').textContent=fmt(list.length);$('qlQty').textContent=fmt(qtySum);
    $('qlNoMgr').textContent=fmt(list.filter(function(r){return !r.mgr}).length);
    $('qlTitle').textContent='품질리스트'+(b?' · '+b.label:batches.length?' · 전체 차수':'')+(kindFilter?' · '+kindFilter:'')+(mgrFilter?' · '+mgrFilter:'');
    $('qlMeta').textContent=b?(b.fileName||'')+(b.uploadedAt?' · '+b.uploadedAt.slice(0,10)+' 업로드':''):'';$('qlMeta').hidden=!b;
    if(!batches.length){$('qlList').innerHTML='<p class="ql-empty">'+(canEdit()?'데이터 › 업로드의 [품질리스트 Excel]에서 시험의뢰서 파일을 올려 주세요.':'아직 업로드된 품질리스트가 없습니다.')+'</p>';return}
    if(!list.length){$('qlList').innerHTML='<p class="ql-empty">조건에 맞는 제품이 없습니다.</p>';return}
    var td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="ql-dash">-</span>':esc(v))+'</td>'};
    var body=list.map(function(r){
      var gift=r.kind==='GIFT',isOpen=!!open[r.key];
      var name='<b>'+esc(r.name)+'</b>'+(gift?' <span class="ql-gift">GIFT</span><button type="button" class="ql-toggle" data-ql-open="'+esc(r.key)+'" aria-expanded="'+isOpen+'">구성 '+(r.items||[]).length+'개 '+(isOpen?'▲':'▼')+'</button>':'');
      var main='<tr class="'+(gift?'ql-giftrow':'')+'">'+td(r.plu,'ql-plu')+td(r.code,'ql-code')+'<td class="ql-name">'+name+'</td>'+mgrCell(r.plu,r)+td(r.lot,'ql-lot')+td(r.date,'ql-date')+'<td class="ql-num">'+(r.qty==null?'<span class="ql-dash">-</span>':fmt(r.qty))+'</td>'+td(r.batch.label,'ql-batch')+'</tr>';
      if(!gift||!isOpen)return main;
      return main+(r.items||[]).map(function(x){var inf=infoOf(x);return '<tr class="ql-sub">'+td(x.plu,'ql-plu')+td(inf.code,'ql-code')+'<td class="ql-name"><span class="ql-sub-mark">└</span> '+esc(x.name)+'</td>'+mgrCell(x.plu,inf)+td(x.lot,'ql-lot')+td(x.date,'ql-date')+'<td class="ql-num"><span class="ql-dash">-</span></td>'+td(r.batch.label,'ql-batch')+'</tr>'}).join('');
    }).join('');
    $('qlList').innerHTML='<div class="ql-table-wrap"><table class="ql-table"><thead><tr><th class="ql-plu">PLU</th><th class="ql-code">제품코드</th><th class="ql-name">제품명</th><th class="ql-mgr">담당자</th><th class="ql-lot">LOT넘버</th><th class="ql-date">제조일자</th><th class="ql-num">입고수량</th><th class="ql-batch">차수</th></tr></thead><tbody>'+body+'</tbody>'+
      '<tfoot><tr><td class="ql-plu"></td><td class="ql-code"></td><th class="ql-name">합계 <small>'+fmt(list.length)+'개</small></th><td></td><td></td><td></td><td class="ql-num">'+fmt(qtySum)+'</td><td></td></tr></tfoot></table></div>';
  }

  /* ===== 업로드 ===== */
  function uploadQuality(file,inp){
    if(!file||busy)return;
    busy=true;toast(file.name+' 읽는 중…');
    xlsx().then(function(){return file.arrayBuffer()}).then(function(buf){
      var p=parseQuality(XLSX.read(buf,{type:'array'}),file.name);
      if(!p.rows.length)throw new Error('목록 시트((PLU) 칸이 있는 단품·GIFT 시트)를 찾지 못했습니다.');
      if(!p.batchNo)throw new Error('차수를 찾지 못했습니다. 파일명에 "142차"처럼 차수를 넣어 주세요.');
      var id='Q-'+p.batchNo,label=p.batchNo+'차';
      return fetch(API).then(function(r){return r.json()}).then(function(j){
        var exist=j&&j.success&&(j.batches||[]).some(function(b){return b.id===id});
        if(exist&&!confirm(label+' 품질리스트가 이미 있습니다. 새 파일로 바꿀까요?'))return null;
        var batch={id:id,batchNo:p.batchNo,label:label,fileName:file.name,rows:p.rows};
        return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',batch:batch})}).then(function(r){return r.json()}).then(function(s){
          if(!s||!s.success)throw new Error((s&&s.error)||'저장하지 못했습니다.');
          var g=p.rows.filter(function(r){return r.kind==='GIFT'}).length;
          toast(label+' 품질리스트 반영: 단품 '+fmt(p.rows.length-g)+'건 · GIFT '+fmt(g)+'건');
          return load().then(function(){renderBatches(id);render()});
        });
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;if(inp)inp.value=''});
  }
  function uploadMaster(file,inp){
    if(!file||busy)return;
    busy=true;toast(file.name+' 읽는 중…');
    xlsx().then(function(){return file.arrayBuffer()}).then(function(buf){
      var p=parseMaster(XLSX.read(buf,{type:'array'}));
      if(!Object.keys(p.map).length)throw new Error('PLU·제품코드 칸이 있는 시트를 찾지 못했습니다.');
      return fetch(MASTER_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',fileName:file.name,map:p.map})}).then(function(r){return r.json()}).then(function(s){
        if(!s||!s.success)throw new Error((s&&s.error)||'저장하지 못했습니다.');
        toast('PLU 담당자 정보 반영: PLU '+fmt(s.count)+'개');
        return load();
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;if(inp)inp.value=''});
  }

  /* ===== 복사 · 엑셀 · 삭제 ===== */
  var HEAD=['PLU','제품코드','제품명','담당자','LOT넘버','제조일자','입고수량','차수'];
  function flat(v){var out=[];v.list.forEach(function(r){
    out.push([r.plu,r.code,r.kind==='GIFT'?r.name+' (GIFT)':r.name,r.mgr,r.lot,r.date,r.qty==null?'':r.qty,r.batch.label]);
    if(r.kind==='GIFT')(r.items||[]).forEach(function(x){var inf=infoOf(x);out.push([x.plu,inf.code,'└ '+x.name,inf.mgr,x.lot,x.date,'',r.batch.label])});
  });return out}
  function copyText(){
    var v=lastView;if(!v||!v.list.length){toast('복사할 품질리스트가 없습니다.');return}
    var clean=function(x){return String(x==null?'':x).replace(/[\t\r\n]+/g,' ').trim()};
    var text=[HEAD].concat(flat(v)).map(function(r){return r.map(clean).join('\t')}).join('\n');
    var done=function(){toast(fmt(v.list.length)+'개 제품을 복사했습니다. (GIFT 구성품 포함)')};
    var fallback=function(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-1000px;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();if(ok)done();else toast('복사하지 못했습니다. 다시 시도해 주세요.')};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function exportExcel(){
    var v=lastView;if(!v||!v.list.length){toast('내보낼 품질리스트가 없습니다.');return}
    xlsx().then(function(){
      var title=(v.batch?v.batch.label:'전체 차수')+' 품질리스트'+(kindFilter?' · '+kindFilter:'')+(mgrFilter?' · '+mgrFilter:'')+(v.q?' · 검색 "'+v.q+'"':'');
      var aoa=[[title],HEAD].concat(flat(v).map(function(r){return r.map(function(x,i){return i===6&&x!==''?Number(x):x})}));
      var ws=XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:HEAD.length-1}}];
      ws['!cols']=[{wch:9},{wch:12},{wch:44},{wch:12},{wch:18},{wch:12},{wch:10},{wch:8}];
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:aoa.length-1,c:HEAD.length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'품질리스트');
      var d=new Date(),name='품질리스트_'+(v.batch?v.batch.label:'전체차수')+(mgrFilter?'_'+mgrFilter:'')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  function remove(){
    var b=current();if(!b)return;
    if(!isAdmin()){toast('차수 삭제는 관리자만 할 수 있습니다.');return}
    if(!confirm(b.label+' 품질리스트를 삭제할까요? (팀 전체에서 사라집니다)'))return;
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:b.id})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'삭제하지 못했습니다.');return}
      toast(b.label+' 품질리스트를 삭제했습니다.');load();
    });
  }

  function init(){
    // 업로드 칸(데이터 › 업로드)은 화면과 상관없이 연결
    document.querySelectorAll('.qlUploadFile').forEach(function(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;if(!canEdit()){toast('게스트는 업로드할 수 없습니다.');inp.value='';return}uploadQuality(f,inp)})});
    document.querySelectorAll('.pluUploadFile').forEach(function(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;if(!canEdit()){toast('게스트는 업로드할 수 없습니다.');inp.value='';return}uploadMaster(f,inp)})});
    var view=$('qualityListView');if(!view)return;
    $('qlBatch').addEventListener('change',function(){$('qlDelete').hidden=!(isAdmin()&&current());render()});
    $('qlSearch').addEventListener('input',render);
    $('qlDelete').addEventListener('click',remove);
    $('qlCopy').addEventListener('click',copyText);
    $('qlExport').addEventListener('click',exportExcel);
    $('qlKinds').addEventListener('click',function(e){var c=e.target.closest('[data-ql-kind]');if(!c)return;kindFilter=c.getAttribute('data-ql-kind');mgrFilter='';render()});
    $('qlMgrs').addEventListener('click',function(e){var c=e.target.closest('[data-ql-mgr]');if(!c)return;mgrFilter=c.getAttribute('data-ql-mgr');render()});
    $('qlList').addEventListener('click',function(e){var ed=e.target.closest('[data-ql-mgr-edit]');if(ed){editMgr(ed);return}var t=e.target.closest('[data-ql-open]');if(!t)return;var k=t.getAttribute('data-ql-open');open[k]=!open[k];render()});
    // 화면이 새로 열릴 때마다 새로 받기
    var was=false;
    var opened=function(){var on=view.classList.contains('active');if(on&&!was)load();was=on};
    new MutationObserver(opened).observe(view,{attributes:true,attributeFilter:['class']});
    opened();
  }
  window.parseQualityList=parseQuality;window.parsePluMaster=parseMaster;window.normQualityPlu=normPlu; // 시험용
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
