/* 입고 > Pallet 조회: 차수별 REF넘버 · 케이스넘버 안에 어떤 제품이 들었는지
   - 데이터: 입고리스트(수입팀 체크리스트, /api/team-data?part=checklists)의 팔렛 상세(제품 줄의 details: lot·date·ref·cs·qty)
   - REF → 케이스 → 제품(PLU · 제품코드 · 품명 · 담당자 · LOT · 제조일자 · 수량) 순으로 묶어 보여 줌
   - 제품코드·담당자: PLU 담당자 정보(+품질리스트에서 수기 지정한 담당자) */
(function(){
  var API='/api/team-data?part=checklists',MASTER_API='/api/team-data?part=plu-master';
  var $=function(id){return document.getElementById(id)};
  var batches=[],master=null,overrides={},lastView=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fmt(n){return (Number(n)||0).toLocaleString('ko-KR')}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function xlsx(){return window.ensureXLSX?window.ensureXLSX():Promise.resolve(window.XLSX)}
  function pad(n){return String(n).padStart(2,'0')}
  function isDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||''))}
  function md(d){var m=String(d||'').match(/^\d{4}-(\d{2})-(\d{2})$/);return m?m[1]+'/'+m[2]:d}
  function uniq(a){return a.filter(function(x,i){return x&&a.indexOf(x)===i})}
  function nat(a,b){return String(a).localeCompare(String(b),'ko',{numeric:true})}
  function infoOf(plu){
    var l=(master&&master.map&&master.map[plu])||[];
    var mgr=uniq(l.map(function(x){return x[1]})).join(' / ');
    if(!mgr&&overrides[plu]&&overrides[plu].mgr)mgr=overrides[plu].mgr;
    return{code:uniq(l.map(function(x){return x[0]})).join(' / '),mgr:mgr};
  }
  function load(){
    return Promise.all([
      fetch(API).then(function(r){return r.json()}),
      fetch(MASTER_API).then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(res){
      var j=res[0],m=res[1];
      if(!j||!j.success){toast((j&&j.error)||'케이스 정보를 불러오지 못했습니다.');return}
      batches=j.batches||[];master=m&&m.success?m.master:null;overrides=(m&&m.success&&m.overrides)||{};
      renderBatches();renderRefs();render();
    }).catch(function(){toast('케이스 정보를 불러오지 못했습니다.')});
  }
  // 차수 번호 입력: '6'이면 6으로 시작하는 차수 전부(6차 · 61차 · 62차 … , 국가 상관없이). 정확히 같은 번호가 맨 앞. 비우면 전체 목록
  function typedNo(){return String($('csNo').value||'').replace(/[^\d]/g,'').replace(/^0+(?=\d)/,'')}
  function scope(){
    var n=typedNo();if(!n)return batches;
    return batches.filter(function(b){return String(Number(b.batchNo)).indexOf(n)===0})
      .sort(function(a,b){var ea=String(Number(a.batchNo))===n,eb=String(Number(b.batchNo))===n;return (eb-ea)||(Number(a.batchNo)-Number(b.batchNo))||String(b.eta||'').localeCompare(String(a.eta||''))});
  }
  function selected(){var v=$('csBatch').value,list=scope();if(v==='*')return list;var b=list.find(function(x){return x.id===v});return b?[b]:[]}
  function renderBatches(){
    var sel=$('csBatch'),cur=sel.value,list=scope(),typed=!!String($('csNo').value||'').trim();
    sel.innerHTML=list.length?list.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.label)+' · '+(isDay(b.eta)?md(b.eta)+' 입고':'입고일 미정')+'</option>'}).join('')+(list.length>1?'<option value="*">'+(typed?'일치하는 차수 전체':'전체 차수')+' ('+list.length+')</option>':''):'<option value="">'+(typed?'일치하는 차수 없음':'차수 없음')+'</option>';
    // 번호를 입력하면 목록 맨 앞(정확히 같은 번호 → 없으면 가장 가까운 번호) 차수를 먼저 보여 줌. 목록에서 61차·62차 등을 고르거나 '일치하는 차수 전체'로 함께 보기
    if(typed)sel.value=list.length?list[0].id:'';
    else if(cur&&(cur==='*'?list.length>1:list.some(function(b){return b.id===cur})))sel.value=cur;
  }
  function renderMgrs(all){
    var sel=$('csMgr'),cur=sel.value,c={};
    all.forEach(function(x){var k=x.mgr||'담당자 없음';c[k]=(c[k]||0)+1});
    var keys=Object.keys(c).sort(function(a,b){return (a==='담당자 없음')-(b==='담당자 없음')||c[b]-c[a]||a.localeCompare(b)});
    sel.innerHTML='<option value="">전체 담당자</option>'+keys.map(function(k){return '<option value="'+esc(k)+'">'+esc(k)+' ('+c[k]+')</option>'}).join('');
    sel.value=keys.indexOf(cur)>=0?cur:'';
  }
  // 케이스 줄 만들기: 차수 · REF · 케이스 · 제품
  function items(){
    var out=[],seen={};
    selected().forEach(function(b){
      (b.rows||[]).forEach(function(r){
        (r.details||[]).forEach(function(d){
          // 같은 PLU가 여러 주문 시트에 나뉘어 있으면 팔렛 상세가 줄마다 똑같이 붙어 있으므로 한 번만
          var key=[b.id,d.ref,d.cs,r.plu,d.lot,d.date,d.qty].join('|');if(seen[key])return;seen[key]=1;
          out.push({batch:b,ref:d.ref||'(REF 없음)',cs:d.cs||'(케이스 없음)',plu:r.plu,name:r.name,lot:d.lot,date:d.date,qty:Number(d.qty)||0,sheet:r.sheet});
        });
      });
    });
    return out;
  }
  function renderRefs(){
    var sel=$('csRef'),cur=sel.value,refs=uniq(items().map(function(x){return x.ref})).sort(nat);
    sel.innerHTML='<option value="">전체 REF ('+refs.length+')</option>'+refs.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>'}).join('');
    if(cur&&refs.indexOf(cur)>=0)sel.value=cur;
  }
  function render(){
    if(!$('csList'))return;
    var multi=$('csBatch').value==='*';
    if(!batches.length){$('csList').innerHTML='<p class="cs-empty">입고리스트(수입팀 체크리스트)가 반영되면 차수별 REF · 케이스 안의 제품을 볼 수 있습니다.</p>';['csRefs','csCases','csItems','csQty'].forEach(function(k){$(k).textContent='0'});return}
    var ref=$('csRef').value,q=($('csSearch').value||'').trim().toLowerCase();
    var all=items().map(function(x){return Object.assign(x,infoOf(x.plu))});
    renderMgrs(all.filter(function(x){return !ref||x.ref===ref}));
    var mgr=$('csMgr').value,mgrOk=function(x){return !mgr||(x.mgr||'담당자 없음')===mgr};
    var list=all.filter(function(x){return (!ref||x.ref===ref)&&mgrOk(x)&&(!q||[x.cs,x.ref,x.plu,x.code,x.name,x.mgr,x.lot].join(' ').toLowerCase().indexOf(q)>=0)});
    // 검색어가 케이스·REF와 맞으면 그 케이스 전체를 보여 줌(케이스 안 다른 제품까지, 담당자를 골랐으면 그 담당자 제품만)
    if(q){var keys={};list.forEach(function(x){keys[x.batch.id+'|'+x.ref+'|'+x.cs]=1});list=all.filter(function(x){return (!ref||x.ref===ref)&&mgrOk(x)&&keys[x.batch.id+'|'+x.ref+'|'+x.cs]})}
    var groups={},order=[];
    list.forEach(function(x){var k=x.batch.id+'|'+x.ref+'|'+x.cs;if(!groups[k]){groups[k]={batch:x.batch,ref:x.ref,cs:x.cs,items:[]};order.push(k)}groups[k].items.push(x)});
    order.sort(function(a,b){var A=groups[a],B=groups[b];return String(B.batch.eta||'').localeCompare(String(A.batch.eta||''))||nat(A.ref,B.ref)||nat(A.cs,B.cs)});
    var refCount=uniq(order.map(function(k){return groups[k].batch.id+'|'+groups[k].ref})).length,qty=list.reduce(function(s,x){return s+x.qty},0);
    $('csRefs').textContent=fmt(refCount);$('csCases').textContent=fmt(order.length);$('csItems').textContent=fmt(list.length);$('csQty').textContent=fmt(qty);
    var b1=selected();$('csTitle').textContent='Pallet 조회 · '+(multi?(String($('csNo').value||'').trim()?b1.map(function(x){return x.label}).join(' · '):'전체 차수'):(b1[0]?b1[0].label:''))+(ref?' · REF '+ref:'')+($('csMgr').value?' · '+$('csMgr').value:'');
    lastView={order:order,groups:groups,multi:multi,ref:ref};
    if(!order.length){$('csList').innerHTML='<p class="cs-empty">'+(all.length?'조건에 맞는 케이스가 없습니다.':'이 차수에는 팔렛·케이스 상세(LOT·REF·케이스 칸)가 없습니다.')+'</p>';return}
    var td=function(v,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+(v===''||v==null?'<span class="cs-dash">-</span>':esc(v))+'</td>'};
    var body=order.map(function(k){
      var g=groups[k],sum=g.items.reduce(function(s,x){return s+x.qty},0);
      g.items.sort(function(a,b){return nat(a.plu,b.plu)});
      return '<tbody class="cs-group"><tr class="cs-head"><th colspan="7"><span class="cs-case">케이스 '+esc(g.cs)+'</span><span class="cs-ref">REF '+esc(g.ref)+'</span>'+(multi?'<span class="cs-batch">'+esc(g.batch.label)+'</span>':'')+'<span class="cs-sum">제품 '+g.items.length+'개 · 수량 '+fmt(sum)+'</span></th></tr>'+
        g.items.map(function(x){return '<tr>'+td(x.plu,'cs-plu')+td(x.code,'cs-code')+'<td class="cs-name">'+esc(x.name)+'</td>'+td(x.mgr,'cs-mgr')+td(x.lot,'cs-lot')+td(x.date,'cs-date')+'<td class="cs-num">'+(x.qty?fmt(x.qty):'<span class="cs-dash">-</span>')+'</td></tr>'}).join('')+'</tbody>';
    }).join('');
    $('csList').innerHTML='<div class="cs-table-wrap"><table class="cs-table"><thead><tr><th class="cs-plu">PLU</th><th class="cs-code">제품코드</th><th class="cs-name">품명</th><th class="cs-mgr">담당자</th><th class="cs-lot">LOT넘버</th><th class="cs-date">제조일자</th><th class="cs-num">수량</th></tr></thead>'+body+'</table></div>';
  }
  function flat(v){
    var head=['차수','REF넘버','케이스넘버','PLU','제품코드','품명','담당자','LOT넘버','제조일자','수량'],out=[head];
    v.order.forEach(function(k){var g=v.groups[k];g.items.forEach(function(x){out.push([g.batch.label,g.ref,g.cs,x.plu,x.code,x.name,x.mgr,x.lot,x.date,x.qty])})});
    return out;
  }
  function copyText(){
    var v=lastView;if(!v||!v.order.length){toast('복사할 케이스가 없습니다.');return}
    var clean=function(x){return String(x==null?'':x).replace(/[\t\r\n]+/g,' ').trim()};
    var text=flat(v).map(function(r){return r.map(clean).join('\t')}).join('\n');
    var done=function(){toast('케이스 '+fmt(v.order.length)+'개를 복사했습니다.')};
    var fallback=function(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-1000px;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();if(ok)done();else toast('복사하지 못했습니다. 다시 시도해 주세요.')};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function exportExcel(){
    var v=lastView;if(!v||!v.order.length){toast('내보낼 케이스가 없습니다.');return}
    xlsx().then(function(){
      var rows=flat(v),ws=XLSX.utils.aoa_to_sheet([[$('csTitle').textContent]].concat(rows));
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:rows[0].length-1}}];
      ws['!cols']=[{wch:10},{wch:14},{wch:12},{wch:9},{wch:12},{wch:40},{wch:10},{wch:16},{wch:12},{wch:9}];
      ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:1,c:0},e:{r:rows.length,c:rows[0].length-1}})};
      var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Pallet 조회');
      var d=new Date(),b=selected(),name='Pallet조회_'+(v.multi?'전체차수':(b[0]?b[0].label.replace(/\s+/g,''):''))+(v.ref?'_'+v.ref:'')+'_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb,name);toast(name+' 저장');
    }).catch(function(e){toast('엑셀 내보내기에 실패했습니다. '+((e&&e.message)||''))});
  }
  function init(){
    var view=$('caseLookupView');if(!view)return;
    $('csBatch').addEventListener('change',function(){$('csRef').value='';renderRefs();render()});
    $('csRef').addEventListener('change',render);
    $('csMgr').addEventListener('change',render);
    // 차수 번호 입력: 칠 때마다 일치하는 차수로 목록을 좁힘
    $('csNo').addEventListener('input',function(){$('csRef').value='';renderBatches();renderRefs();render()});
    $('csSearch').addEventListener('input',render);
    $('csCopy').addEventListener('click',copyText);
    $('csExport').addEventListener('click',exportExcel);
    var was=false;
    var opened=function(){var on=view.classList.contains('active');if(on&&!was)load();was=on};
    new MutationObserver(opened).observe(view,{attributes:true,attributeFilter:['class']});
    opened();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
