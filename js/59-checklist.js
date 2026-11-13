/* 입고 > 입고리스트 (수입팀 '상품 입고 CHECKLIST' 엑셀 — 구글 드라이브 자동 반영 + 데이터 › 업로드)
   - 해석: js/checklist-parse.js (서버 드라이브 반영과 같은 코드)
   - 표: PLU | 제품코드 | 품명 | 담당자 | 수량 | 분배처(리테일·디지털…) | 품질 | 제조일자 | LOT넘버 | REF넘버 | Pallet
     제조일자·LOT·REF·케이스는 시트 오른쪽 팔레트 상세(C 구역)를 PLU로 붙인 값. 여러 건이면 [+N]으로 펼침
   - 제품코드·담당자: PLU 담당자 정보(+품질리스트에서 수기로 지정한 담당자)
   - 품질: 같은 차수 품질리스트(Q-차수)에 있는 PLU면 '품질' 표시(품질 시료로 빠질 제품)
   - 입고일: Checklist 시트의 실시간 입고 예정일. 바뀌면 이력(이전 → 새 날짜) 표시
   - 저장: /api/team-data?part=checklists */
(function(){
  var API='/api/team-data?part=checklists',MASTER_API='/api/team-data?part=plu-master',QUALITY_API='/api/team-data?part=quality-lists';
  var $=function(id){return document.getElementById(id)};
  var batches=[],master=null,overrides={},quality={},sheetFilter='',mgrFilter='',colFilter='',qOnly=false,busy=false,open={},qOpen={},missOpen=false,lastView=null,colChoices=[];
  var sumMode=false; // 여러 차수를 볼 때 [제품별 합계]: 제품 한 줄에 합계 수량·입고 횟수·입고일
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
  /* 담당자 수기 지정(품질리스트와 같은 저장소 — PLU별·팀 공유): 마스터에 담당자가 없을 때만
     [+ 담당자 지정] → 담당자 드롭다운에서 고르거나 직접 입력 → 저장. 수기 값은 '수기' 표시, 눌러서 변경·삭제 */
  function mgrOptions(){
    var s={};
    Object.keys((master&&master.map)||{}).forEach(function(k){master.map[k].forEach(function(x){if(x[1])s[x[1]]=1})});
    Object.keys(overrides).forEach(function(k){if(overrides[k].mgr)s[overrides[k].mgr]=1});
    return Object.keys(s).sort(function(a,b){return a.localeCompare(b)});
  }
  function mgrCell(r){
    if(r.mgr&&!r.manual)return '<td class="ck-mgr">'+esc(r.mgr)+'</td>';
    if(!r.plu||!canEdit())return r.mgr?'<td class="ck-mgr">'+esc(r.mgr)+' <span class="ck-manual">수기</span></td>':'<td class="ck-mgr ck-nomgr"><span class="ck-dash">-</span></td>';
    return r.mgr?'<td class="ck-mgr"><button type="button" class="ck-mgr-edit" data-ck-mgr-edit="'+esc(r.plu)+'" title="PLU '+esc(r.plu)+' 담당자 변경 (수기 지정)">'+esc(r.mgr)+' <span class="ck-manual">수기</span></button></td>'
      :'<td class="ck-mgr ck-nomgr"><button type="button" class="ck-mgr-add" data-ck-mgr-edit="'+esc(r.plu)+'" title="PLU '+esc(r.plu)+' 담당자를 직접 지정">+ 담당자 지정</button></td>';
  }
  function editMgr(btn){
    var plu=btn.getAttribute('data-ck-mgr-edit'),td=btn.closest('td'),cur=(overrides[plu]&&overrides[plu].mgr)||'';
    var opts=mgrOptions();
    td.innerHTML='<span class="ck-mgr-form"><select class="ck-mgr-select" aria-label="담당자 선택"><option value="">담당자 선택</option>'+opts.map(function(m){return '<option value="'+esc(m)+'"'+(m===cur?' selected':'')+'>'+esc(m)+'</option>'}).join('')+'</select>'+
      '<input class="ck-mgr-input" value="'+esc(cur)+'" placeholder="직접 입력" aria-label="PLU '+esc(plu)+' 담당자 직접 입력"><button type="button" class="ck-mgr-save">저장</button><button type="button" class="ck-mgr-cancel" title="취소">✕</button></span>';
    var sel=td.querySelector('select'),inp=td.querySelector('input'),done=false;
    sel.addEventListener('change',function(){if(sel.value)inp.value=sel.value;inp.focus()});
    inp.focus();
    var save=function(){
      if(done)return;done=true;
      var v=inp.value.trim().slice(0,40);
      if(v===cur){render();return}
      fetch(MASTER_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'override',plu:plu,mgr:v})}).then(function(r){return r.json()}).then(function(j){
        if(!j||!j.success){toast((j&&j.error)||'저장하지 못했습니다.');render();return}
        if(v)overrides[plu]={mgr:v,by:(user()||{}).id,at:new Date().toISOString()};else delete overrides[plu];
        toast(v?'PLU '+plu+' 담당자를 '+v+'(으)로 지정했습니다. (품질리스트에도 같이 적용)':'PLU '+plu+' 수기 담당자를 지웠습니다.');
        render();
      }).catch(function(){toast('저장하지 못했습니다.');render()});
    };
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();save()}else if(e.key==='Escape'){done=true;render()}});
    td.querySelector('.ck-mgr-save').addEventListener('click',save);
    td.querySelector('.ck-mgr-cancel').addEventListener('click',function(){done=true;render()});
  }
  // Pallet 번호가 REF와 이어진 긴 번호면 끝 숫자만: REF SAL-ORD-2026-17685 · PLT-SO-2026-17685-03 → 3
  // (REF의 3자리 이상 숫자(17685)가 Pallet 번호 안에도 있을 때만. 1·2·17 같은 짧은 번호는 그대로)
  function palletNo(cs,ref){
    var s=String(cs==null?'':cs).trim(),m=s.match(/[-_\s](\d+)$/);
    if(!m||!/[A-Za-z]/.test(s))return s;
    var inPal=s.match(/\d+/g)||[],inRef=String(ref||'').match(/\d+/g)||[];
    return inRef.some(function(n){return n.length>=3&&inPal.indexOf(n)>=0})?String(Number(m[1])):s;
  }
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
  // LOT 비교: 기호·대소문자만 무시(UK-144024-1 = uk-144024-1). 앞 영문(LS 등)이 다르면 불일치 — 수입팀 리스트 수정 대상
  function normLot(s){return String(s==null?'':s).replace(/[^0-9A-Za-z]/g,'').toUpperCase()}
  // 앞의 0만 다른 LOT을 같다고 보는 경우(엑셀에서 숫자로 저장되면 앞 0이 빠짐) — 이 두 경우만, 나머지(UK 등·JP 4자리 PLU)는 그대로 불일치
  //   - 제조국 AU: 숫자 LOT 앞 0 무시(0701401092651 = 701401092651)
  //   - 제조국 JP + PLU 3자리: 숫자 LOT 앞 0 무시(020226090741 = 20226090741)
  function lotEq(a,b,country,plu){
    var x=normLot(a),y=normLot(b);if(x===y)return true;
    if(!/^\d+$/.test(x)||!/^\d+$/.test(y))return false;
    var c=String(country||'').toUpperCase(),ok=c==='AU'||(c==='JP'&&/^\d{3}$/.test(String(plu||'')));
    return ok&&x.replace(/^0+/,'')===y.replace(/^0+/,'');
  }
  function isDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||''))}
  function qualityMatch(batchNo,rows){
    var qb=quality['Q-'+batchNo];if(!qb)return null;
    var res={total:0,matched:0,unmatched:[]};
    rows.forEach(function(r){r.qn=0;r.qEntries=[]});
    (qb.rows||[]).forEach(function(e){
      res.total++;
      var lot=normLot(e.lot),date=e.date||'',cands=rows.filter(function(r){return e.plu&&r.plu===e.plu});
      var hit=null;
      cands.some(function(r){if((r.details||[]).some(function(d){return lotEq(d.lot,e.lot,r.batch&&r.batch.country,e.plu)&&d.date===date})){hit=r;return true}return false});
      if(hit){hit.qn++;hit.qEntries.push(e);res.matched++;return}
      var det=[];cands.forEach(function(r){det=det.concat(r.details||[])});
      // 입고리스트에 그 제품의 LOT·제조일자 정보 자체가 없으면(예: Whoosh DP 시트) 맞출 수 없으니 PLU만으로 반영
      if(cands.length&&!det.length){var h0=cands[0];h0.qn++;h0.qEntries.push(Object.assign({noInfo:true},e));res.matched++;return}
      var ctry=cands[0]&&cands[0].batch&&cands[0].batch.country,lotHit=det.filter(function(d){return lotEq(d.lot,e.lot,ctry,e.plu)}),dateHit=det.filter(function(d){return d.date===date});
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
      fetch(QUALITY_API).then(function(r){return r.json()}).catch(function(){return null}),
      window.LushProductOrder?window.LushProductOrder.load().catch(function(){return null}):null // 제품 정렬 순서(js/60-product-order.js)
    ]).then(function(res){
      var j=res[0],m=res[1],q=res[2];
      if(!j||!j.success){toast((j&&j.error)||'입고리스트을 불러오지 못했습니다.');return}
      batches=j.batches||[];
      batches.forEach(function(b){(b.rows||[]).forEach(function(r){(r.details||[]).forEach(function(d){d.cs=palletNo(d.cs,d.ref)})})});
      master=m&&m.success?m.master:null;overrides=(m&&m.success&&m.overrides)||{};
      quality={};((q&&q.success&&q.batches)||[]).forEach(function(b){quality[b.id]=b});
      renderBatches();render();
    }).catch(function(){toast('입고리스트을 불러오지 못했습니다.')});
  }
  /* 입고일(실시간 입고 예정일) 필터: 비우면 전체 날짜, 하루 또는 기간(시작~종료)을 고르면 그 사이 입고 차수만.
     ckDate 값: '' / 'YYYY-MM-DD' / 'YYYY-MM-DD~YYYY-MM-DD'. 여러 차수면 '전체 차수'로 함께 보기 */
  function dateRange(){var v=$('ckDate').value;if(!v)return null;var p=v.split('~');return{s:p[0],e:p[1]||p[0]}}
  // 제목·파일 이름용: '10/21 ' / '10/01~10/31 ' / ''
  function rangeText(full){var r=dateRange();if(!r)return '';var f=full?function(x){return x}:md;return (r.s===r.e?f(r.s):f(r.s)+'~'+f(r.e))+' '}
  function scope(){var r=dateRange();return r?batches.filter(function(b){return isDay(b.eta)&&b.eta>=r.s&&b.eta<=r.e}):batches}
  function current(){var v=$('ckBatch').value;return !v||v==='*'?null:scope().find(function(b){return b.id===v})||null}
  function selected(){var b=current();return b?[b]:($('ckBatch').value==='*'?scope():[])}
  function renderBatches(keep){
    var sel=$('ckBatch'),cur=keep||sel.value,list=scope();
    // '전체 차수'는 맨 위(눈에 잘 띄게). 따로 고른 게 없으면 지금처럼 첫 차수(가장 최근)부터
    sel.innerHTML=list.length?(list.length>1?'<option value="*">전체 차수 ('+list.length+')</option>':'')+list.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+' · '+(isDay(b.eta)?esc(md(b.eta))+' 입고':'입고일 미정')+'</option>'}).join(''):'<option value="">'+($('ckDate').value?'이 기간 입고 없음':'차수 없음')+'</option>';
    if(cur&&(cur==='*'?list.length>1:list.some(function(b){return b.id===cur})))sel.value=cur;
    else if(list.length)sel.value=list[0].id;
    $('ckDelete').hidden=!(isAdmin()&&current());
  }
  /* ===== 입고일 달력(입고리스트와 같은 모양: 입고 예정일에 점, 마우스를 올리면 그날 차수) ===== */
  var calMonth='';
  function etaLabels(){var c={};batches.forEach(function(b){if(isDay(b.eta))(c[b.eta]=c[b.eta]||[]).push(b.label)});return c}
  function syncDateBtn(){var r=dateRange(),t=$('ckDateBtn');if(t)t.querySelector('span').textContent=!r?'전체 날짜':r.s===r.e?r.s.replace(/-/g,'.'):r.s.replace(/-/g,'.')+' ~ '+r.e.replace(/-/g,'.')}
  // 기간 고르기: 한 번 누르면 그날 하루(달력은 열린 채), 이어서 다른 날을 누르면 두 날 사이 기간으로 정하고 닫힘
  var calStart='';
  function calInfo(key){
    if(calStart&&!key)return '<b>'+esc(md(calStart))+'</b> 부터 · 기간으로 보려면 종료일을 누르세요';
    var l=key&&etaLabels()[key];return l?'<b>'+esc(key.slice(5).replace('-','/'))+'</b> '+esc(l.join(' · ')):(key?'<b>'+esc(md(key))+'</b> 입고 예정 없음':'<i></i>입고 예정일 · 두 날을 누르면 기간')}
  function buildCal(){
    var pop=$('ckCal');if(!pop)return;
    var labels=etaLabels(),dates=Object.keys(labels).sort(),r=dateRange();
    if(!calMonth)calMonth=((r&&r.e)||dates[dates.length-1]||new Date().toISOString().slice(0,10)).slice(0,7);
    var y=+calMonth.slice(0,4),m=+calMonth.slice(5,7),startDow=new Date(y,m-1,1).getDay(),last=new Date(y,m,0).getDate();
    var t=new Date(),todayKey=t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());
    var cells='';for(var i=0;i<startDow;i++)cells+='<span class="lc-day empty"></span>';
    for(var d=1;d<=last;d++){
      var key=y+'-'+pad(m)+'-'+pad(d),l=labels[key],dow=(startDow+d-1)%7;
      var on=r&&(key===r.s||key===r.e),inR=r&&r.s!==r.e&&key>r.s&&key<r.e;
      // 기간의 시작·끝은 입고 예정이 없는 날도 고를 수 있음(점은 입고 예정일만)
      cells+='<button type="button" class="lc-day'+(l?' has':'')+(on?' on':'')+(inR?' in-range':'')+(key===todayKey?' today':'')+(dow===0?' sun':dow===6?' sat':'')+'" data-cal-day="'+key+'"'+(l?' title="'+esc(l.join(' · '))+'"':'')+'>'+d+(l?'<i></i>':'')+'</button>';
    }
    var hasPrev=true,hasNext=true; // 기간은 어느 달이든 고를 수 있게 앞뒤 달 이동 허용
    pop.innerHTML='<div class="lc-head"><button type="button" data-cal-nav="-1" aria-label="이전 달"'+(hasPrev?'':' disabled')+'>‹</button><b>'+y+'년 '+m+'월</b><button type="button" data-cal-nav="1" aria-label="다음 달"'+(hasNext?'':' disabled')+'>›</button></div>'+
      '<div class="lc-week"><span class="sun">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span class="sat">토</span></div>'+
      '<div class="lc-grid">'+cells+'</div>'+
      '<div class="lc-foot"><span class="lc-info" id="ckCalInfo">'+calInfo(calStart?'':(r&&r.s===r.e?r.s:''))+'</span><span class="lc-btns"><button type="button" data-cal-all="1"'+(r?'':' class="on"')+'>전체 날짜</button></span></div>';
  }
  function openCal(){var pop=$('ckCal');if(!pop)return;calMonth='';calStart='';buildCal();pop.hidden=false;$('ckDateBtn').setAttribute('aria-expanded','true')}
  function closeCal(){calStart='';var pop=$('ckCal');if(pop&&!pop.hidden){pop.hidden=true;$('ckDateBtn').setAttribute('aria-expanded','false')}}
  function setDate(v,keepOpen){palFocus=null;$('ckDate').value=v||'';syncDateBtn();if(keepOpen)buildCal();else closeCal();sheetFilter='';mgrFilter='';renderBatches(v&&scope().length>1?'*':'');render()}
  function pickDay(key){
    if(!calStart){calStart=key;setDate(key,true);return} // 첫 번째: 그날 하루, 달력은 열어 둠
    var a=calStart<key?calStart:key,b=calStart<key?key:calStart;
    calStart='';setDate(a===b?a:a+'~'+b);
  }
  // 매장(분배처) 선택: 수량(TOTAL) 머리글 'TOTAL ▾' 또는 매장 이름 머리글 클릭 → 그 매장 수량만
  function qtyOf(r){if(!colFilter)return Number(r.qty)||0;var v=r.values&&r.values[colFilter];return Number(v)||0}
  function totalHeadHtml(){
    if(!colChoices.length)return esc(colFilter||'TOTAL');
    return '<select class="ck-th-col" data-ck-col aria-label="수량 칸에 표시할 분배 매장"><option value="">TOTAL</option>'+colChoices.map(function(k){return '<option value="'+esc(k)+'"'+(k===colFilter?' selected':'')+'>'+esc(k)+'</option>'}).join('')+'</select>';
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
    var sel=selected(),b=sel.length===1?sel[0]:null,multi=sel.length>1;
    renderInfo(b);
    var sb=$('ckSumBtn');if(sb){sb.hidden=!multi;sb.classList.toggle('on',multi&&sumMode);sb.setAttribute('aria-pressed',String(multi&&sumMode))}
    if(!batches.length||!sel.length){renderPallet([],false);$('ckSheets').innerHTML='';$('ckMgrs').innerHTML='';$('ckList').innerHTML='<p class="ck-empty">'+(!batches.length?(canEdit()?'구글 드라이브 폴더에 체크리스트를 올리면 자동으로 반영됩니다. (데이터 › 업로드의 [입고리스트 Excel]로 직접 올릴 수도 있습니다.)':'아직 반영된 입고리스트이 없습니다.'):'이 날짜에 입고 예정인 차수가 없습니다.')+'</p>';['ckCount','ckQty','ckQuality'].forEach(function(k){$(k).textContent='0'});$('ckQualityNote').textContent='';$('ckTitle').textContent='입고리스트';return}
    var q=($('ckSearch').value||'').trim().toLowerCase();
    // 차수별로 줄을 만들고 품질은 차수마다 따로 맞춤(같은 차수 품질리스트)
    var all=[],qr=null,linked=[];
    sel.forEach(function(x){
      var rows=(x.rows||[]).map(function(r,i){var inf=infoOf(r.plu);return Object.assign({key:x.id+'#'+i,batch:x},r,inf)});
      var res=qualityMatch(x.batchNo,rows);
      if(res){linked.push(x.batchNo+'차');qr=qr||{total:0,matched:0,unmatched:[]};qr.total+=res.total;qr.matched+=res.matched;res.unmatched.forEach(function(u){qr.unmatched.push(Object.assign({batch:x.label},u))})}
      all=all.concat(rows);
    });
    all.forEach(function(r){r.q=r.qn>0});
    // 여러 차수: 입고일 최신순(같은 날은 차수 순서 그대로) → 제품을 검색하면 언제 들어왔는지 위에서부터
    if(multi){var ord={};sel.forEach(function(x,i){ord[x.id]=i});all.sort(function(a,c){var ea=isDay(a.batch.eta)?a.batch.eta:'',ec=isDay(c.batch.eta)?c.batch.eta:'';return ec<ea?-1:ec>ea?1:ord[a.batch.id]-ord[c.batch.id]})}
    // 제품 정렬 순서(제품코드 순서표)가 있으면 그 순서로, 순서표에 없는 제품은 맨 아래(같은 순위끼리는 위 순서 유지)
    var PO=window.LushProductOrder;if(PO)all=PO.sortRows(all,function(r){return r.code});
    $('ckQualityNote').textContent=linked.length?'품질리스트 '+linked.join(' · ')+'와 연결됨':'같은 차수 품질리스트 없음 — 품질리스트가 올라오면 자동으로 맞춥니다';
    var match=function(r){return !q||[r.plu,r.code,r.name,r.mgr,r.sheet,(r.details||[]).map(function(d){return d.lot+' '+d.ref+' '+d.cs}).join(' ')].join(' ').toLowerCase().indexOf(q)>=0};
    var qAll=all.filter(match);
    // 매장 목록(수량이 있는 매장만, 파일 칸 순서)
    var order=[];sel.forEach(function(x){(x.cols||[]).forEach(function(k){if(order.indexOf(k)<0)order.push(k)})});
    // TOTAL ▾ 매장 목록: 주문·담당자·품질 대상·검색 필터가 걸린 제품에 수량이 있는 매장만(담당자를 고르면 그 담당자가 보낼 매장만)
    var choiceBase=qAll.filter(function(r){return (!sheetFilter||r.sheet===sheetFilter)&&(!mgrFilter||(r.mgr||'담당자 없음')===mgrFilter)&&(!qOnly||r.q)});
    colChoices=order.filter(function(k){return choiceBase.some(function(r){return r.values&&r.values[k]})});
    if(colFilter&&colChoices.indexOf(colFilter)<0)colFilter='';
    var sheets=multi?[]:(b.sheets||[]),sc={};qAll.forEach(function(r){sc[r.sheet]=(sc[r.sheet]||0)+1});
    if(sheetFilter&&sheets.indexOf(sheetFilter)<0)sheetFilter='';
    $('ckSheets').innerHTML=sheets.length>1?'<button type="button" class="ck-chip'+(sheetFilter?'':' on')+'" data-ck-sheet="">전체 주문 <em>'+qAll.length+'</em></button>'+sheets.map(function(s){return '<button type="button" class="ck-chip'+(sheetFilter===s?' on':'')+(sc[s]?'':' zero')+'" data-ck-sheet="'+esc(s)+'">'+esc(s)+' <em>'+(sc[s]||0)+'</em></button>'}).join(''):'';
    var inSheet=qAll.filter(function(r){return (!sheetFilter||r.sheet===sheetFilter)&&(!colFilter||qtyOf(r)>0)});
    var mgrName=function(r){return r.mgr||'담당자 없음'},mc={};inSheet.forEach(function(r){var k=mgrName(r);mc[k]=(mc[k]||0)+1});
    var mk=Object.keys(mc).sort(function(a,c){return (a==='담당자 없음')-(c==='담당자 없음')||mc[c]-mc[a]||a.localeCompare(c)});
    if(PO){var mk2=PO.sortMgrKeys(mk,inSheet,mgrName,function(r){return r.code},mc);if(mk2)mk=mk2} // 순서표에서 각 담당자 제품이 처음 나오는 순
    if(mgrFilter&&!mc[mgrFilter])mgrFilter='';
    // [전체 인쇄]는 '전체 담당'일 때만(특정 담당자 탭에서는 [인쇄]로 그 담당자만)
    if($('ckPrintAll'))$('ckPrintAll').hidden=!!mgrFilter;
    var qCount=inSheet.reduce(function(s,r){return s+(r.qn||0)},0);
    $('ckMgrs').innerHTML='<button type="button" class="ck-chip'+(mgrFilter?'':' on')+'" data-ck-mgr="">전체 담당 <em>'+inSheet.length+'</em></button>'+mk.map(function(k){return '<button type="button" class="ck-chip'+(mgrFilter===k?' on':'')+(k==='담당자 없음'?' none':'')+'" data-ck-mgr="'+esc(k)+'">'+esc(k)+' <em>'+mc[k]+'</em></button>'}).join('')+
      '<button type="button" class="ck-chip ck-qchip'+(qOnly?' on':'')+(qCount?'':' zero')+'" data-ck-qonly>품질 대상만 <em>'+qCount+'</em></button>';
    var list=inSheet.filter(function(r){return (!mgrFilter||mgrName(r)===mgrFilter)&&(!qOnly||r.q)});
    var cols=colFilter?[]:colChoices.filter(function(k){return list.some(function(r){return r.values&&r.values[k]})});
    lastView={list:list,all:all,batch:b,batches:sel,cols:cols,q:q,qr:qr,qname:linked.join(' · ')};
    renderPallet(list,multi);
    var qtySum=list.reduce(function(s,r){return s+qtyOf(r)},0);
    var qSum=list.reduce(function(s,r){return s+(r.qn||0)},0);
    $('ckCount').textContent=fmt(list.length);$('ckQty').textContent=fmt(qtySum);
    // 품질 수량: 입고리스트 품질 합계 / 품질리스트 총 수량 (필터 없이 고른 차수 전체 기준)
    $('ckQuality').textContent=qr?fmt(qr.matched)+' / '+fmt(qr.total):'-';
    var kq=$('ckQuality').closest('.kpi');if(kq){kq.classList.toggle('ck-q-ok',!!qr&&!qr.unmatched.length);kq.classList.toggle('ck-q-bad',!!qr&&!!qr.unmatched.length)}
    $('ckTitle').textContent='입고리스트 · '+(b?b.label:rangeText()+'전체 차수')+(colFilter?' · '+colFilter:'')+(sheetFilter?' · '+sheetFilter:'')+(mgrFilter?' · '+mgrFilter:'')+(qOnly?' · 품질 대상':'')+(multi&&sumMode?' · 제품별 합계':'');
    // 품질 맞춤 결과: 같으면 한 줄, 다르면 불일치 목록(품질리스트 LOT·제조일자 vs 입고리스트 값, 사유)
    var qbox='',qname=linked.join(' · ');
    if(qr){
      qbox=qr.unmatched.length
        ?'<div class="ck-qsum bad"><div class="ck-qsum-head"><span class="ck-qsum-text"><b>품질 수량 불일치</b> 품질리스트 '+esc(qname)+' <strong>'+fmt(qr.total)+'</strong>개 · 입고리스트 반영 <strong>'+fmt(qr.matched)+'</strong>개 · 따로 확인 <strong>'+fmt(qr.unmatched.length)+'</strong>개</span>'+
          '<span class="ck-qsum-btns"><button type="button" class="ck-miss-toggle" data-ck-miss-toggle aria-expanded="'+missOpen+'">'+(missOpen?'목록 접기 ▴':'목록 펼치기 ▾')+'</button><button type="button" class="ck-miss-export" data-ck-miss-export title="수입팀 수정 요청용으로 불일치 목록을 엑셀로 저장">불일치 목록 엑셀</button></span></div>'+
          (missOpen?'<div class="ck-qmiss-wrap"><table class="ck-qmiss"><thead><tr>'+(multi?'<th>차수</th>':'')+'<th>구분</th><th>PLU</th><th>품명</th><th>품질 LOT</th><th>품질 제조일자</th><th>사유</th><th>입고리스트 LOT</th><th>입고리스트 제조일자</th></tr></thead><tbody>'+
          qr.unmatched.map(function(u){return '<tr>'+(multi?'<td>'+esc(u.batch)+'</td>':'')+'<td>'+esc(u.kind)+'</td><td>'+esc(u.plu||'-')+'</td><td class="n">'+esc(u.name)+'</td><td>'+esc(u.lot||'-')+'</td><td>'+esc(u.date||'-')+'</td><td class="r">'+esc(u.reason)+'</td><td>'+esc(u.ckLots||'-')+'</td><td>'+esc(u.ckDates||'-')+'</td></tr>'}).join('')+'</tbody></table></div>':'')+'</div>'
        :'<div class="ck-qsum ok"><b>✓ 품질 수량 일치</b> 품질리스트 '+esc(qname)+' '+fmt(qr.total)+'개 = 입고리스트 '+fmt(qr.matched)+'개 (PLU · LOT · 제조일자 기준)</div>';
    }
    if(!list.length){$('ckList').innerHTML=qbox+'<p class="ck-empty">조건에 맞는 제품이 없습니다.</p>';return}
    // [제품별 합계](여러 차수일 때): 제품 한 줄 = 합계 수량 · 입고 횟수(차수 수) · 입고일 목록. 담당자 열은 넣지 않음
    if(multi&&sumMode){
      var g={},gk=[],td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="ck-dash">-</span>':esc(v))+'</td>'};
      list.forEach(function(r){
        var k=r.plu||((r.code||'')+'|'+r.name);
        if(!g[k]){g[k]={plu:r.plu,code:r.code,name:r.name,qty:0,ids:{},n:0,dates:[]};gk.push(k)}
        var x=g[k];x.qty+=qtyOf(r);
        if(!x.ids[r.batch.id]){x.ids[r.batch.id]=1;x.n++;x.dates.push(isDay(r.batch.eta)?r.batch.eta:'')}
      });
      var rowsS=gk.map(function(k){var x=g[k];x.dates=uniq(x.dates.filter(Boolean)).sort();x.undated=x.dates.length<x.n;return x}).sort(function(a,c){return c.qty-a.qty||String(a.name).localeCompare(String(c.name))});
      lastView.summary=rowsS;
      $('ckList').innerHTML=qbox+'<div class="ck-table-wrap"><table class="ck-table ck-sum-table"><thead><tr><th class="ck-plu">PLU</th><th class="ck-code">제품코드</th><th class="ck-name">품명</th><th class="ck-num ck-tot">'+esc(colFilter?colFilter+' 합계':'합계 수량')+'</th><th class="ck-num">입고 횟수</th><th class="ck-sum-dates">입고일</th></tr></thead><tbody>'+
        rowsS.map(function(x){return '<tr>'+td(x.plu,'ck-plu')+td(x.code,'ck-code')+'<td class="ck-name"><b>'+esc(x.name)+'</b></td><td class="ck-num ck-tot">'+fmt(x.qty)+'</td><td class="ck-num">'+fmt(x.n)+'회</td><td class="ck-sum-dates">'+esc(x.dates.map(md).join(', ')+(x.undated?(x.dates.length?', ':'')+'입고일 미정':''))+'</td></tr>'}).join('')+
        '</tbody><tfoot><tr><td></td><td></td><th class="ck-name">합계 <small>'+fmt(rowsS.length)+'개 제품</small></th><td class="ck-num ck-tot">'+fmt(qtySum)+'</td><td></td><td></td></tr></tfoot></table></div>';
      return;
    }
    var td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="ck-dash">-</span>':esc(v))+'</td>'};
    var sum={};
    var body=list.map(function(r){
      var d=r.details||[],first=d[0]||{},more=d.length>1,isOpen=!!open[r.key];
      var multiV=function(k){var u=uniq(d.map(function(x){return x[k]}));return u.length>1?u[0]+' 외 '+(u.length-1):(u[0]||'')};
      var qOpenNow=!!qOpen[r.key];
      var qcell=r.qn?'<td class="ck-num ck-q"><button type="button" class="ck-qbadge'+(qOpenNow?' on':'')+'" data-ck-q="'+esc(r.key)+'" aria-expanded="'+qOpenNow+'" title="눌러서 품질로 뺄 목록 보기">'+r.qn+'</button></td>':'<td class="ck-num ck-q"><span class="ck-dash">-</span></td>';
      var sub=[sheets.length>1&&!sheetFilter?esc(r.sheet):'',multi?esc(r.batch.label)+' · '+(isDay(r.batch.eta)?esc(md(r.batch.eta))+' 입고':'입고일 미정'):''].filter(Boolean).join(' · ');
      var main='<tr class="'+(r.q?'ck-has-q':'')+'">'+td(r.plu,'ck-plu')+td(r.code,'ck-code')+'<td class="ck-name"><b>'+esc(r.name)+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</td>'+
        mgrCell(r)+
        '<td class="ck-num ck-tot">'+fmt(qtyOf(r))+'</td>'+qcell+
        cols.map(function(k){var v=r.values&&r.values[k];if(v){sum[k]=(sum[k]||0)+v;return '<td class="ck-num">'+fmt(v)+'</td>'}return '<td class="ck-num ck-zero">-</td>'}).join('')+
        td(multiV('date'),'ck-date')+'<td class="ck-lot">'+(first.lot?esc(multiV('lot')):'<span class="ck-dash">-</span>')+(more?' <button type="button" class="ck-more" data-ck-open="'+esc(r.key)+'" aria-expanded="'+isOpen+'">'+(isOpen?'접기':'+'+(d.length-1))+'</button>':'')+'</td>'+
        td(multiV('ref'),'ck-ref')+(d.length?'<td class="ck-case"><button type="button" class="ck-pal-link" data-ck-pal="'+esc(r.key)+'" title="눌러서 아래 Pallet 조회에서 이 제품이 든 Pallet 보기">'+esc(multiV('cs')||'-')+'</button></td>':td('','ck-case'))+'</tr>';
      // 품질 숫자를 누르면: 이 제품에서 품질로 뺄 목록(품질리스트의 구분 · 품명 · LOT · 제조일자 · 수량 1개씩)
      if(qOpenNow&&r.qn){
        main+='<tr class="ck-qsub"><td colspan="'+(10+cols.length)+'"><div class="ck-qlist"><b>품질로 뺄 목록 · '+r.qn+'개</b><table><thead><tr><th>구분</th><th>품명(품질리스트)</th><th>LOT넘버</th><th>제조일자</th><th class="n">빼는 수량</th><th>Pallet</th></tr></thead><tbody>'+
          r.qEntries.map(function(x){
            var pals=uniq(d.filter(function(y){return lotEq(y.lot,x.lot,r.batch&&r.batch.country,r.plu)&&y.date===x.date}).map(function(y){return y.cs}));
            return '<tr><td>'+esc(x.kind)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.lot||'-')+'</td><td>'+esc(x.date||'-')+'</td><td class="n">1</td><td>'+(x.noInfo?'<span class="ck-qnote2">LOT 정보 없음 · PLU로 반영</span>':esc(pals.join(', ')||'-'))+'</td></tr>'}).join('')+
          '</tbody></table></div></td></tr>';
      }
      if(!more||!isOpen)return main;
      // 펼친 줄: 케이스(팔레트)별 수량 · 제조일자 · LOT · REF · 케이스
      var blanks=cols.map(function(){return '<td></td>'}).join('');
      return main+d.map(function(x,i){return '<tr class="ck-sub"><td></td><td></td><td class="ck-name"><span class="ck-sub-mark">└</span> Pallet '+esc(x.cs||'-')+' · '+fmt(x.qty)+'개</td><td></td><td class="ck-num">'+(x.qty?fmt(x.qty):'')+'</td><td></td>'+blanks+td(x.date,'ck-date')+td(x.lot,'ck-lot')+td(x.ref,'ck-ref')+'<td class="ck-case"><button type="button" class="ck-pal-link" data-ck-pal="'+esc(r.key)+'" data-ck-pal-i="'+i+'" title="눌러서 아래 Pallet 조회에서 이 Pallet 보기">'+esc(x.cs||'-')+'</button></td></tr>'}).join('');
    }).join('');
    // 다시 그려도 표 안 스크롤 위치 유지('외 N'·품질·담당자 등을 눌렀을 때 맨 위로 튀지 않게)
    var oldWrap=$('ckList').querySelector('.ck-table-wrap'),keepTop=oldWrap?oldWrap.scrollTop:0,keepLeft=oldWrap?oldWrap.scrollLeft:0;
    $('ckList').innerHTML=qbox+'<div class="ck-table-wrap"><table class="ck-table'+(colFilter?' ck-one':'')+'"><thead><tr><th class="ck-plu">PLU</th><th class="ck-code">제품코드</th><th class="ck-name">품명</th><th class="ck-mgr">담당자</th><th class="ck-num ck-tot">'+totalHeadHtml()+'</th><th class="ck-num ck-q">품질</th>'+cols.map(function(k){return '<th class="ck-num ck-col-pick" data-ck-col-pick="'+esc(k)+'" title="눌러서 '+esc(k)+' 수량만 보기">'+esc(k)+'</th>'}).join('')+'<th class="ck-date">제조일자</th><th class="ck-lot">LOT넘버</th><th class="ck-ref">REF넘버</th><th class="ck-case">Pallet</th></tr></thead><tbody>'+body+'</tbody>'+
      '<tfoot><tr><td></td><td></td><th class="ck-name">합계 <small>'+fmt(list.length)+'개 제품</small></th><td></td><td class="ck-num ck-tot">'+fmt(qtySum)+'</td><td class="ck-num ck-q">'+(qSum?fmt(qSum):'-')+'</td>'+cols.map(function(k){return '<td class="ck-num">'+fmt(sum[k]||0)+'</td>'}).join('')+'<td></td><td></td><td></td><td></td></tr></tfoot></table></div>';
    var newWrap=$('ckList').querySelector('.ck-table-wrap');if(newWrap&&(keepTop||keepLeft)){newWrap.scrollTop=keepTop;newWrap.scrollLeft=keepLeft}
  }

  /* ===== Pallet 조회(입고리스트 맨 아래, 접었다 폈다) =====
     위에서 고른 입고일·차수와 필터(주문·매장·담당자·품질 대상·검색)가 걸린 제품 목록의 팔렛 상세를
     REF → 케이스 → 제품(PLU · 제품코드 · 품명 · 담당자 · LOT · 제조일자 · 수량)으로 묶어 보여 줌 */
  var PALLET_OPEN_KEY='lush_ck_pallet_open_v1',palletView=null;
  function nat(a,b){return String(a).localeCompare(String(b),'ko',{numeric:true})}
  function palletItems(list){
    var out=[],seen={};
    (list||[]).forEach(function(r){
      (r.details||[]).forEach(function(d){
        // 같은 PLU가 여러 주문 시트에 있으면 팔렛 상세가 겹칠 수 있어 한 번만
        var key=[r.batch.id,d.ref,d.cs,r.plu,d.lot,d.date,d.qty].join('|');if(seen[key])return;seen[key]=1;
        out.push({batch:r.batch,ref:d.ref||'(REF 없음)',cs:d.cs||'(Pallet 없음)',plu:r.plu,code:r.code,name:r.name,mgr:r.mgr,lot:d.lot,date:d.date,qty:Number(d.qty)||0});
      });
    });
    return out;
  }
  // 표에서 Pallet 번호를 누르면: 그 Pallet들만(안에 든 다른 제품까지 — 위 필터와 상관없이 고른 차수 전체에서)
  var palFocus=null; // {keys:{'차수id|REF|Pallet':1}, label}
  function focusPallet(r,one){
    var keys={},n=0;
    (one?[one]:(r.details||[])).forEach(function(d){var k=r.batch.id+'|'+(d.ref||'(REF 없음)')+'|'+(d.cs||'(Pallet 없음)');if(!keys[k]){keys[k]=1;n++}});
    if(!n)return;
    palFocus={keys:keys,label:'PLU '+r.plu+' '+r.name+(one?' · Pallet '+(one.cs||'-'):'')+'의 Pallet '+n+'개',back:r.key};
    $('ckPalRef').value='';$('ckPalSearch').value='';
    var box=$('ckPallet');box.open=true; // toggle 이벤트로도 다시 그림
    renderPallet(lastView.list,(lastView.batches||[]).length>1);
    setTimeout(function(){box.scrollIntoView({block:'start'})},30);
  }
  // Pallet 보기를 끝낼 때(✕ 해제 · 접기): 누르기 전에 보던 제품 줄로 돌아감
  function endPalletFocus(){
    var back=palFocus&&palFocus.back;palFocus=null;
    if(lastView)renderPallet(lastView.list,(lastView.batches||[]).length>1);
    if(!back)return;
    var el=null;$('ckList').querySelectorAll('[data-ck-pal]').forEach(function(b){if(!el&&b.getAttribute('data-ck-pal')===back)el=b});
    if(el)setTimeout(function(){el.closest('tr').scrollIntoView({block:'center'})},30);
  }
  function renderPallet(list,multi){
    var box=$('ckPallet');if(!box)return;
    var all=palFocus?palletItems(lastView&&lastView.all||list).filter(function(x){return palFocus.keys[x.batch.id+'|'+x.ref+'|'+x.cs]}):palletItems(list);
    var fb=$('ckPalFocus');if(fb){fb.hidden=!palFocus;fb.innerHTML=palFocus?'<span>'+esc(palFocus.label)+'만 보는 중</span><button type="button" data-ck-pal-clear title="원래 목록으로">✕ 해제</button>':''}
    var refSel=$('ckPalRef'),cur=refSel.value,refs=uniq(all.map(function(x){return x.ref})).sort(nat);
    refSel.innerHTML='<option value="">전체 REF ('+refs.length+')</option>'+refs.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>'}).join('');
    refSel.value=refs.indexOf(cur)>=0?cur:'';
    var ref=refSel.value,q=($('ckPalSearch').value||'').trim().toLowerCase();
    var items=all.filter(function(x){return (!ref||x.ref===ref)&&(!q||[x.cs,x.ref,x.plu,x.code,x.name,x.mgr,x.lot].join(' ').toLowerCase().indexOf(q)>=0)});
    // 케이스·REF로 검색하면 그 케이스 전체(위 필터에 맞는 제품 안에서)
    if(q){var keys={};items.forEach(function(x){keys[x.batch.id+'|'+x.ref+'|'+x.cs]=1});items=all.filter(function(x){return (!ref||x.ref===ref)&&keys[x.batch.id+'|'+x.ref+'|'+x.cs]})}
    var groups={},order=[];
    items.forEach(function(x){var k=x.batch.id+'|'+x.ref+'|'+x.cs;if(!groups[k]){groups[k]={batch:x.batch,ref:x.ref,cs:x.cs,items:[]};order.push(k)}groups[k].items.push(x)});
    order.sort(function(a,b){var A=groups[a],B=groups[b];return String(B.batch.eta||'').localeCompare(String(A.batch.eta||''))||nat(A.ref,B.ref)||nat(A.cs,B.cs)});
    var refCount=uniq(order.map(function(k){return groups[k].batch.id+'|'+groups[k].ref})).length,qty=items.reduce(function(s,x){return s+x.qty},0);
    $('ckPalSummary').textContent=order.length?'REF '+fmt(refCount)+'개 · Pallet '+fmt(order.length)+'개 · 제품 '+fmt(items.length)+'줄 · 수량 '+fmt(qty):'팔렛 상세 없음';
    palletView={order:order,groups:groups,multi:multi};
    if(!box.open)return; // 접혀 있으면 표는 그리지 않음(펼칠 때 그림)
    if(!order.length){$('ckPalList').innerHTML='<p class="ck-empty">'+(all.length?'조건에 맞는 Pallet이 없습니다.':'지금 목록의 제품에는 팔렛 상세(LOT·REF·케이스 칸)가 없습니다.')+'</p>';return}
    var td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="ck-dash">-</span>':esc(v))+'</td>'};
    var body=order.map(function(k){
      var g=groups[k],sum=g.items.reduce(function(s,x){return s+x.qty},0);
      g.items.sort(function(a,b){return nat(a.plu,b.plu)});
      return '<tbody class="cs-group"><tr class="cs-head"><th colspan="7"><span class="cs-case">Pallet '+esc(g.cs)+'</span><span class="cs-ref">'+esc(g.ref)+'</span>'+(multi?'<span class="cs-batch">'+esc(g.batch.label)+'</span>':'')+'<span class="cs-sum">제품 '+g.items.length+'개 · 수량 '+fmt(sum)+'</span></th></tr>'+
        g.items.map(function(x){return '<tr>'+td(x.plu,'cs-plu')+td(x.code,'cs-code')+'<td class="cs-name">'+esc(x.name)+'</td>'+td(x.mgr,'cs-mgr')+td(x.lot,'cs-lot')+td(x.date,'cs-date')+'<td class="cs-num">'+(x.qty?fmt(x.qty):'<span class="ck-dash">-</span>')+'</td></tr>'}).join('')+'</tbody>';
    }).join('');
    $('ckPalList').innerHTML='<div class="cs-table-wrap"><table class="cs-table"><thead><tr><th class="cs-plu">PLU</th><th class="cs-code">제품코드</th><th class="cs-name">품명</th><th class="cs-mgr">담당자</th><th class="cs-lot">LOT넘버</th><th class="cs-date">제조일자</th><th class="cs-num">수량</th></tr></thead>'+body+'</table></div>';
  }
  function palletFlat(v){
    var head=['차수','REF넘버','Pallet','PLU','제품코드','품명','담당자','LOT넘버','제조일자','수량'],out=[head];
    v.order.forEach(function(k){var g=v.groups[k];g.items.forEach(function(x){out.push([g.batch.label,g.ref,g.cs,x.plu,x.code,x.name,x.mgr,x.lot,x.date,x.qty])})});
    return out;
  }
  function palletCopy(){
    var v=palletView;if(!v||!v.order.length){toast('복사할 팔렛이 없습니다.');return}
    var clean=function(x){return String(x==null?'':x).replace(/[\t\r\n]+/g,' ').trim()};
    var text=palletFlat(v).map(function(r){return r.map(clean).join('\t')}).join('\n');
    var done=function(){toast('Pallet '+fmt(v.order.length)+'개를 복사했습니다.')};
    var fallback=function(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-1000px;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();if(ok)done();else toast('복사하지 못했습니다. 다시 시도해 주세요.')};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function palletExport(){
    var v=palletView;if(!v||!v.order.length){toast('내보낼 팔렛이 없습니다.');return}
    xlsx().then(function(){
      var rows=palletFlat(v),title='Pallet 조회 · '+$('ckTitle').textContent.replace(/^입고리스트 · /,'')+($('ckPalRef').value?' · REF '+$('ckPalRef').value:'');
      var ws=XLSX.utils.aoa_to_sheet([[title]].concat(rows));
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:rows[0].length-1}}];
      ws['!cols']=[{wch:10},{wch:14},{wch:12},{wch:9},{wch:12},{wch:40},{wch:10},{wch:16},{wch:12},{wch:9}];
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:rows.length,c:rows[0].length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Pallet 조회');
      var d=new Date(),b=lastView&&lastView.batch,name='Pallet조회_'+(b?b.label.replace(/\s+/g,''):'전체차수')+(mgrFilter?'_'+mgrFilter:'')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
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
        toast(s.batch.label+' 입고리스트 반영: '+fmt(s.batch.rows)+'건 · 입고 예정일 '+md(s.batch.eta)+(s.batch.etaChanged?' (변경됨)':''));
        return load().then(function(){renderBatches(s.batch.id);render()});
      });
    }).catch(function(e){toast(String((e&&e.message)||e))}).then(function(){busy=false;if(inp)inp.value=''});
  }

  /* ===== 복사 · 엑셀 · 삭제 ===== */
  /* 텍스트 복사·엑셀 공통 표
     - 텍스트 복사: 제품코드 | 제품명 | 매장별 수량
     - 엑셀(withTotal): 제품코드 | 제품명 | TOTAL | 매장별 수량
     - 매장을 하나 고르면(TOTAL ▾) 그 매장 수량 한 칸만. 여러 차수면 맨 앞에 차수
     - 담당자·품질·PLU·제조일자·LOT·REF·Pallet은 넣지 않음 */
  function flat(v,withTotal){
    var multi=(v.batches||[]).length>1;
    // 제품별 합계 화면이면 합계표 그대로(담당자 열 없음)
    if(multi&&sumMode&&v.summary){
      return [['PLU','제품코드','품명',colFilter?colFilter+' 합계':'합계 수량','입고 횟수','입고일']].concat(v.summary.map(function(x){return [x.plu,x.code,x.name,x.qty,x.n,x.dates.join(', ')+(x.undated?(x.dates.length?', ':'')+'입고일 미정':'')]}));
    }
    var stores=colFilter?[colFilter]:v.cols,total=withTotal&&!colFilter;
    var head=(multi?['차수']:[]).concat(['제품코드','제품명']).concat(total?['TOTAL']:[]).concat(stores),out=[head];
    v.list.forEach(function(r){
      out.push((multi?[r.batch.label]:[]).concat([r.code,r.name]).concat(total?[qtyOf(r)]:[]).concat(stores.map(function(k){return (r.values&&r.values[k])||''})));
    });
    return out;
  }
  function copyText(){
    var v=lastView;if(!v||!v.list.length){toast('복사할 목록이 없습니다.');return}
    var clean=function(x){return String(x==null?'':x).replace(/[\t\r\n]+/g,' ').trim()};
    var rowsT=flat(v),text=rowsT.map(function(r){return r.map(clean).join('\t')}).join('\n');
    var done=function(){toast(fmt(rowsT.length-1)+'개 제품을 복사했습니다.')};
    var fallback=function(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-1000px;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();if(ok)done();else toast('복사하지 못했습니다. 다시 시도해 주세요.')};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function exportExcel(){
    var v=lastView;if(!v||!v.list.length){toast('내보낼 목록이 없습니다.');return}
    xlsx().then(function(){
      var isSum=(v.batches||[]).length>1&&sumMode&&v.summary;
      var name0=v.batch?v.batch.label+' 입고리스트 · 입고 예정일 '+v.batch.eta:rangeText(true)+'전체 차수 입고리스트'+(isSum?' · 제품별 합계':'');
      // 제목·파일 이름에는 담당자 이름을 넣지 않음
      var rows=flat(v,true),title=name0+(colFilter?' · '+colFilter:'')+(sheetFilter?' · '+sheetFilter:'')+(qOnly?' · 품질 대상':'')+(v.q?' · 검색 "'+v.q+'"':'');
      var ws=XLSX.utils.aoa_to_sheet([[title]].concat(rows));
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:rows[0].length-1}}];
      ws['!cols']=rows[0].map(function(h){return{wch:h==='품명'||h==='제품명'?42:/LOT|REF|제조일자|Pallet|입고일/.test(h)?16:h==='제품코드'?12:10}});
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:rows.length,c:rows[0].length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'입고리스트');
      var d=new Date(),name='입고리스트샘플_'+(v.batch?v.batch.label.replace(/\s+/g,''):'전체차수'+(dateRange()?'_'+rangeText(true).trim().replace(/-/g,''):'')+(isSum?'_제품별합계':''))+(colFilter?'_'+colFilter:'')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  /* ===== 인쇄 =====
     공통: A4 가로, 폭 1페이지에 맞춤(넓으면 자동 축소), 제목 행 회색·페이지마다 반복
     열: 제품코드 | 품명 | 품질 | 총 입고수량 | 매장별 수량 | 제조일자 (제품별 합계 화면이면 그 합계표)
     - [인쇄]: 지금 보이는 목록(차수·기간·검색·주문·담당자 탭·품질 대상 필터 반영)
     - [전체 인쇄]: 고른 차수(기간이면 그 안의 전체 차수)의 모든 제품을 담당자별로 페이지를 나눠서
     담당자 이름: 정보보안팀 승인에 따른 정책 재설정(2026-11-13)으로 '입고리스트 사내 인쇄물'에 한해
     페이지 나눔·페이지 제목 표시만 허용. 텍스트 복사·엑셀 등 다른 출력에는 넣지 않음 */
  function printSection(list,multi,cols,useCol){
    var q=function(r){return useCol?qtyOf(r):(Number(r.qty)||0)};
    var head=['제품코드','품명','품질',useCol&&colFilter?colFilter+' 수량':'총 입고수량'].concat(cols).concat(['제조일자']);
    var rows=list.map(function(r){
      var dts=uniq((r.details||[]).map(function(d){return d.date})).join(', ');
      return [r.code,{name:r.name,sub:multi?r.batch.label+' · '+(isDay(r.batch.eta)?md(r.batch.eta)+' 입고':'입고일 미정'):''},r.qn?{n:r.qn}:'',{n:q(r)}]
        .concat(cols.map(function(k){var x=r.values&&r.values[k];return x?{n:x}:''})).concat([dts]);
    });
    return{head:head,rows:rows,total:list.reduce(function(s,r){return s+q(r)},0)};
  }
  function printDoc(docTitle,sections){
    var cell=function(x,i){
      if(x&&typeof x==='object'&&'n' in x)return '<td class="n">'+fmt(x.n)+'</td>';
      if(x&&typeof x==='object'&&'name' in x)return '<td class="nm">'+esc(x.name)+(x.sub?'<small>'+esc(x.sub)+'</small>':'')+'</td>';
      return '<td'+(i===1?' class="nm"':'')+'>'+esc(x==null?'':x)+'</td>';
    };
    var html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(docTitle)+'</title><style>'+
      '@page{size:A4 landscape;margin:8mm}'+
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      'html,body{margin:0;background:#fff;color:#111;font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'+
      '.page{width:1060px}.page+.page{break-before:page;page-break-before:always}'+
      'h1{font-size:16px;margin:0 0 4px}p.info{font-size:11px;color:#444;margin:0 0 8px}'+
      'table{width:100%;border-collapse:collapse;font-size:11px}'+
      'thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}'+
      'th,td{border:1px solid #9a9a9a;padding:4px 6px;vertical-align:middle}'+
      'thead th{background:#d9d9d9;font-weight:700;text-align:center;white-space:nowrap}'+
      'td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.nm small{display:block;color:#555;font-size:9.5px}'+
      '</style></head><body>'+
      sections.map(function(s){
        return '<div class="page"><h1>'+esc(s.title)+'</h1><p class="info">'+esc(s.info)+'</p><table><thead><tr>'+s.head.map(function(h){return '<th>'+esc(h)+'</th>'}).join('')+'</tr></thead><tbody>'+
          s.rows.map(function(r){return '<tr>'+r.map(cell).join('')+'</tr>'}).join('')+'</tbody></table></div>';
      }).join('')+'</body></html>';
    var old=document.getElementById('ckPrintFrame');if(old)old.remove();
    var fr=document.createElement('iframe');fr.id='ckPrintFrame';fr.setAttribute('aria-hidden','true');fr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    var doc=fr.contentWindow.document;doc.open();doc.write(html);doc.close();
    var go=function(){
      try{
        // 폭 1페이지: A4 가로 인쇄 폭(약 1060px)보다 가장 넓은 표가 넓으면 그만큼 축소(모든 페이지 같은 배율)
        var w=0;doc.querySelectorAll('.page').forEach(function(pg){var tb=pg.querySelector('table');w=Math.max(w,tb.getBoundingClientRect().width,tb.scrollWidth,pg.scrollWidth)});
        if(w>1060)doc.body.style.zoom=String(Math.floor(1060/w*0.98*1000)/1000); // 테두리 몫으로 2% 여유
        fr.contentWindow.focus();fr.contentWindow.print();
      }catch(e){toast('인쇄 창을 열지 못했습니다.')}
    };
    setTimeout(go,150);
  }
  function printDate(){return '출력 '+new Date().toLocaleDateString('ko-KR')}
  function batchTitle(v){return v.batch?v.batch.label+' 입고리스트':rangeText()+'전체 차수 입고리스트'}
  function printList(){
    var v=lastView;if(!v||!v.list.length){toast('인쇄할 목록이 없습니다.');return}
    var multi=(v.batches||[]).length>1,isSum=multi&&sumMode&&v.summary,s;
    if(isSum){
      s={head:['제품코드','품명',colFilter?colFilter+' 합계':'합계 수량','입고 횟수','입고일'],
        rows:v.summary.map(function(x){return [x.code,x.name,{n:x.qty},{n:x.n},x.dates.map(md).join(', ')+(x.undated?(x.dates.length?', ':'')+'입고일 미정':'')]}),
        total:v.summary.reduce(function(a,x){return a+x.qty},0)};
    }else s=printSection(v.list,multi,v.cols,true);
    // 담당자 탭을 고른 상태면 페이지 제목에 담당자 표시(사내 인쇄물 허용 범위)
    s.title=batchTitle(v)+(isSum?' · 제품별 합계':'')+(mgrFilter?' · '+(mgrFilter==='담당자 없음'?mgrFilter:'담당 '+mgrFilter):'')+(sheetFilter?' · '+sheetFilter:'')+(colFilter?' · '+colFilter:'')+(qOnly?' · 품질 대상':'')+(v.q?' · 검색 "'+v.q+'"':'');
    s.info=(v.batch&&isDay(v.batch.eta)?'입고 예정일 '+v.batch.eta+' · ':'')+'품목 '+fmt(s.rows.length)+'건 · 총 입고수량 '+fmt(s.total)+' · '+printDate();
    printDoc(s.title,[s]);
  }
  // [전체 인쇄]: 필터(담당자 탭·검색·주문·품질 대상·매장 선택)와 상관없이 고른 차수의 모든 제품 → 담당자별 페이지
  function printAllByMgr(){
    var v=lastView;if(!v||!(v.all||[]).length){toast('인쇄할 목록이 없습니다.');return}
    var multi=(v.batches||[]).length>1,name=function(r){return r.mgr||'담당자 없음'};
    var groups={},keys=[];
    v.all.forEach(function(r){var k=name(r);if(!groups[k]){groups[k]=[];keys.push(k)}groups[k].push(r)});
    // 순서: 화면 담당자 탭과 같게(제품 많은 순, '담당자 없음'은 맨 뒤)
    keys.sort(function(a,c){return (a==='담당자 없음')-(c==='담당자 없음')||groups[c].length-groups[a].length||a.localeCompare(c)});
    // 제품 정렬 순서가 있으면 페이지도 그 순서(담당자 탭과 같게)
    var PO=window.LushProductOrder;if(PO){var cnt={};keys.forEach(function(k){cnt[k]=groups[k].length});var k2=PO.sortMgrKeys(keys,v.all,name,function(r){return r.code},cnt);if(k2)keys=k2}
    var order=[];(v.batches||[]).forEach(function(x){(x.cols||[]).forEach(function(k){if(order.indexOf(k)<0)order.push(k)})});
    var base=batchTitle(v),eta=v.batch&&isDay(v.batch.eta)?'입고 예정일 '+v.batch.eta+' · ':'';
    var sections=keys.map(function(k){
      var list=groups[k],cols=order.filter(function(c){return list.some(function(r){return r.values&&r.values[c]})});
      var s=printSection(list,multi,cols,false);
      s.title=base+' · '+(k==='담당자 없음'?k:'담당 '+k)+' ('+fmt(list.length)+'건)';
      s.info=eta+'품목 '+fmt(list.length)+'건 · 총 입고수량 '+fmt(s.total)+' · '+printDate();
      return s;
    });
    printDoc(base+' · 담당자별 전체 인쇄',sections);
  }
  // 품질 불일치 목록 → 엑셀(수입팀 리스트 수정 요청용): 차수 · 구분 · PLU · 품명 · 품질 LOT/제조일자 · 사유 · 입고리스트 LOT/제조일자
  function exportMismatch(){
    var v=lastView,qr=v&&v.qr;if(!qr||!qr.unmatched.length){toast('품질 불일치 목록이 없습니다.');return}
    xlsx().then(function(){
      var multi=(v.batches||[]).length>1;
      var head=['차수','구분','PLU','품명','품질리스트 LOT','품질리스트 제조일자','사유','입고리스트 LOT','입고리스트 제조일자'];
      var rows=qr.unmatched.map(function(u){return [multi?u.batch:(v.batch?v.batch.label:''),u.kind,u.plu,u.name,u.lot,u.date,u.reason,u.ckLots,u.ckDates]});
      var title='품질 불일치 목록 · 품질리스트 '+(v.qname||'')+' '+fmt(qr.total)+'개 / 입고리스트 반영 '+fmt(qr.matched)+'개 / 불일치 '+fmt(qr.unmatched.length)+'개';
      var ws=XLSX.utils.aoa_to_sheet([[title],head].concat(rows));
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:head.length-1}}];
      ws['!cols']=[{wch:10},{wch:8},{wch:9},{wch:40},{wch:16},{wch:14},{wch:22},{wch:34},{wch:22}];
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:rows.length+1,c:head.length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'품질 불일치');
      var d=new Date(),name='품질불일치_'+(v.batch?v.batch.label.replace(/\s+/g,''):'전체차수')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  function remove(){
    var b=current();if(!b)return;
    if(!isAdmin()){toast('차수 삭제는 관리자만 할 수 있습니다.');return}
    if(!confirm(b.label+' 입고리스트을 삭제할까요? (팀 전체에서 사라집니다. 드라이브 파일이 수정되면 다시 들어올 수 있습니다)'))return;
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:b.id})}).then(function(r){return r.json()}).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'삭제하지 못했습니다.');return}
      toast(b.label+' 입고리스트을 삭제했습니다.');load();
    });
  }

  function init(){
    document.querySelectorAll('.ckUploadFile').forEach(function(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;if(!canEdit()){toast('게스트는 업로드할 수 없습니다.');inp.value='';return}upload(f,inp)})});
    var view=$('checklistView');if(!view)return;
    $('ckBatch').addEventListener('change',function(){sheetFilter='';mgrFilter='';palFocus=null;var w=$('ckList').querySelector('.ck-table-wrap');if(w)w.scrollTop=0;$('ckDelete').hidden=!(isAdmin()&&current());render()});
    // 입고일 달력
    $('ckDateBtn').addEventListener('click',function(){var pop=$('ckCal');if(pop.hidden)openCal();else closeCal()});
    $('ckCal').addEventListener('mouseover',function(e){var d=e.target.closest('[data-cal-day]');var info=$('ckCalInfo'),r=dateRange();if(info)info.innerHTML=calInfo(d?d.getAttribute('data-cal-day'):(calStart?'':(r&&r.s===r.e?r.s:'')))});
    $('ckCal').addEventListener('click',function(e){
      var nav=e.target.closest('[data-cal-nav]');if(nav){var y=+calMonth.slice(0,4),m=+calMonth.slice(5,7)+Number(nav.getAttribute('data-cal-nav'));if(m<1){m=12;y--}if(m>12){m=1;y++}calMonth=y+'-'+pad(m);buildCal();return}
      var day=e.target.closest('[data-cal-day]');if(day){pickDay(day.getAttribute('data-cal-day'));return}
      if(e.target.closest('[data-cal-all]'))setDate('');
    });
    document.addEventListener('mousedown',function(e){if(!e.target.closest||!e.target.closest('.ck-date-field'))closeCal()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeCal()});
    // 매장 선택: 수량(TOTAL) 머리글 TOTAL ▾ / 매장 이름 머리글 클릭
    $('ckList').addEventListener('change',function(e){var s=e.target.closest('[data-ck-col]');if(!s)return;colFilter=s.value;render()});
    $('ckList').addEventListener('click',function(e){if(e.target.closest('[data-ck-miss-export]')){exportMismatch();return}var th=e.target.closest('[data-ck-col-pick]');if(!th)return;colFilter=th.getAttribute('data-ck-col-pick');render()});
    $('ckSearch').addEventListener('input',render);
    $('ckDelete').addEventListener('click',remove);
    $('ckCopy').addEventListener('click',copyText);
    if($('ckPrint'))$('ckPrint').addEventListener('click',printList);
    if($('ckPrintAll'))$('ckPrintAll').addEventListener('click',printAllByMgr);
    if($('ckSumBtn'))$('ckSumBtn').addEventListener('click',function(){sumMode=!sumMode;render()});
    $('ckExport').addEventListener('click',exportExcel);
    $('ckSheets').addEventListener('click',function(e){var c=e.target.closest('[data-ck-sheet]');if(!c)return;sheetFilter=c.getAttribute('data-ck-sheet');render()});
    $('ckMgrs').addEventListener('click',function(e){
      if(e.target.closest('[data-ck-qonly]')){qOnly=!qOnly;render();return}
      var c=e.target.closest('[data-ck-mgr]');if(!c)return;mgrFilter=c.getAttribute('data-ck-mgr');render();
    });
    $('ckList').addEventListener('click',function(e){if(e.target.closest('[data-ck-miss-toggle]')){missOpen=!missOpen;render();return}var qb=e.target.closest('[data-ck-q]');if(qb){var qk=qb.getAttribute('data-ck-q');qOpen[qk]=!qOpen[qk];render();return}var pl=e.target.closest('[data-ck-pal]');if(pl){var row=(lastView.list||[]).find(function(x){return x.key===pl.getAttribute('data-ck-pal')});if(row){var i=pl.getAttribute('data-ck-pal-i');focusPallet(row,i!=null?(row.details||[])[+i]:null)}return}var ed=e.target.closest('[data-ck-mgr-edit]');if(ed){editMgr(ed);return}var t=e.target.closest('[data-ck-open]');if(!t)return;var k=t.getAttribute('data-ck-open');open[k]=!open[k];render()});
    // Pallet 조회(맨 아래): 펼침 상태는 이 기기에 기억, REF·검색·복사·엑셀
    var pal=$('ckPallet');
    if(pal){
      try{pal.open=localStorage.getItem(PALLET_OPEN_KEY)==='1'}catch(e){}
      pal.addEventListener('toggle',function(){try{localStorage.setItem(PALLET_OPEN_KEY,pal.open?'1':'0')}catch(e){}if(pal.open&&lastView)renderPallet(lastView.list,(lastView.batches||[]).length>1);else if(!pal.open&&palFocus)endPalletFocus()}); // 접으면 보던 줄로
      $('ckPalRef').addEventListener('change',function(){if(lastView)renderPallet(lastView.list,(lastView.batches||[]).length>1)});
      $('ckPalSearch').addEventListener('input',function(){if(lastView)renderPallet(lastView.list,(lastView.batches||[]).length>1)});
      pal.addEventListener('click',function(e){if(e.target.closest('[data-ck-pal-clear]'))endPalletFocus()});
      $('ckPalCopy').addEventListener('click',palletCopy);
      $('ckPalExport').addEventListener('click',palletExport);
    }
    var was=false;
    // 화면을 새로 열면 전체 날짜·가장 최근 입고 예정 차수부터
    var opened=function(){var on=view.classList.contains('active');if(on&&!was){$('ckDate').value='';syncDateBtn();colFilter='';load()}was=on};
    new MutationObserver(opened).observe(view,{attributes:true,attributeFilter:['class']});
    opened();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
