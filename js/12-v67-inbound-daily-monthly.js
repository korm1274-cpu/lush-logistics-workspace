/* <script id="v67-inbound-daily-monthly"> (index.html에서 그대로 옮김) */
(function(){
  const LABOR_KEY='lush-logistics-inbound-labor-v1';
  const $=id=>document.getElementById(id);
  const nf=n=>(Number(n)||0).toLocaleString('ko-KR');
  const num=v=>{const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:0};
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function getLabor(){try{return JSON.parse(localStorage.getItem(LABOR_KEY)||'{}')||{}}catch{return{}}}
  function setLabor(v){localStorage.setItem(LABOR_KEY,JSON.stringify(v))}
  function inboundRows(){return (window.FILE_DATA_ENGINE?.getData()?.inbound?.rows)||[]}
  function normInboundDate(v){
    const s=String(v??'').trim();if(!s)return'';
    const t=s.indexOf('T');
    return t>0?s.slice(0,t):s;
  }
  function dailyQtyMap(rows){const map={};rows.forEach(r=>{const d=normInboundDate(r[0]);if(!d)return;map[d]=(map[d]||0)+eaEquivQty(r)});return map}
  function eaEquivQty(r){
    const u=window.inboundUnit?window.inboundUnit(r):String(r[6]||'').trim().toUpperCase();
    if(u==='EA')return num(r[7]);
    if(u==='G'){const f=(window.PRODUCT_EA_CONVERSION||{})[String(r[3]||'').trim()];return f?num(r[7])/f:0;}
    return 0;
  }
  function dailyAgg(start,end){
    const rows=inboundRows(),map={};
    rows.forEach(r=>{
      const date=normInboundDate(r[0]);if(!date)return;
      if(start&&date<start)return;
      if(end&&date>end)return;
      if(!map[date])map[date]={date,qty:0,skus:new Set(),batches:new Set()};
      map[date].qty+=eaEquivQty(r);
      if(r[3])map[date].skus.add(String(r[3]));
      if(r[1])map[date].batches.add(String(r[1]));
    });
    return Object.values(map).map(x=>({date:x.date,qty:x.qty,sku:x.skus.size,batch:x.batches.size})).sort((a,b)=>b.date>a.date?1:b.date<a.date?-1:0);
  }
  function availableInboundYears(){
    const rows=inboundRows();
    const years=new Set(rows.map(r=>normInboundDate(r[0]).slice(0,4)).filter(y=>/^\d{4}$/.test(y)));
    return[...years].sort((a,b)=>b>a?1:b<a?-1:0);
  }
  function monthlyAgg(year){
    const rows=inboundRows(),labor=getLabor(),dailyQty=dailyQtyMap(rows),map={};
    rows.forEach(r=>{
      const date=normInboundDate(r[0]),month=date.slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(month))return;
      if(year&&!month.startsWith(year+'-'))return;
      if(!map[month])map[month]={month,qty:0,qtyG:0,qtyEA:0,batches:new Set(),batchPallets:new Map(),days:new Set()};
      const u=window.inboundUnit?window.inboundUnit(r):String(r[6]||'').trim().toUpperCase();
      map[month].qty+=eaEquivQty(r);
      if(u==='G')map[month].qtyG+=num(r[7]);
      else if(u==='EA')map[month].qtyEA+=num(r[7]);
      if(r[1]){map[month].batches.add(String(r[1]));if(r[2]!==''&&r[2]!=null)map[month].batchPallets.set(String(r[1]),num(r[2]))}
      map[month].days.add(date);
    });
    if(year){
      for(let m=1;m<=12;m++){
        const key=`${year}-${String(m).padStart(2,'0')}`;
        if(!map[key])map[key]={month:key,qty:0,qtyG:0,qtyEA:0,batches:new Set(),batchPallets:new Map(),days:new Set()};
      }
    }
    return Object.values(map).map(x=>{
      let staffSum=0,staffCnt=0,prodSum=0,prodCnt=0;
      x.days.forEach(d=>{
        const lab=labor[d];if(!lab)return;
        const staff=num(lab.staff),hours=num(lab.hours);
        if(staff>0){staffSum+=staff;staffCnt++}
        if(staff>0&&hours>0){prodSum+=(dailyQty[d]||0)/(staff*hours);prodCnt++}
      });
      let pallets=0;x.batchPallets.forEach(p=>pallets+=p);
      return{month:x.month,qty:x.qty,qtyG:x.qtyG,qtyEA:x.qtyEA,batchCount:x.batches.size,pallets,avgStaff:staffCnt?staffSum/staffCnt:null,avgProd:prodCnt?prodSum/prodCnt:null};
    }).sort((a,b)=>year?(a.month>b.month?1:a.month<b.month?-1:0):(b.month>a.month?1:b.month<a.month?-1:0));
  }
  function renderInboundDailyView(){
    const tbody=$('inboundDailyBody');if(!tbody)return;
    const start=$('inboundDailyStart')?.value||'',end=$('inboundDailyEnd')?.value||'';
    const agg=dailyAgg(start,end),labor=getLabor();
    if(!agg.length){tbody.innerHTML='<tr><td colspan="8" class="data-empty">업로드된 입고 데이터가 없습니다. 데이터 업로드 메뉴에서 입고 Excel을 올려주세요.</td></tr>';return}
    tbody.innerHTML=agg.map(r=>{
      const lab=labor[r.date]||{};
      const staff=num(lab.staff),hours=num(lab.hours);
      const prod=(staff>0&&hours>0)?Math.round(r.qty/(staff*hours)):null;
      return `<tr>
        <td>${esc(r.date)}</td>
        <td class="num">${nf(r.qty)}</td>
        <td class="num">${r.sku}</td>
        <td class="num">${r.batch}</td>
        <td><input class="cell" type="number" min="0" data-labor-staff="${esc(r.date)}" value="${lab.staff??''}"></td>
        <td><input class="cell" type="number" min="0" step="0.1" data-labor-hours="${esc(r.date)}" value="${lab.hours??''}"></td>
        <td class="num">${prod!==null?nf(prod):'-'}</td>
        <td><input class="cell" type="text" data-labor-note="${esc(r.date)}" value="${esc(lab.note||'')}"></td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-labor-staff],[data-labor-hours],[data-labor-note]').forEach(inp=>{
      inp.onchange=()=>{
        const d=inp.dataset.laborStaff||inp.dataset.laborHours||inp.dataset.laborNote;
        const lab=getLabor();if(!lab[d])lab[d]={staff:'',hours:'',note:''};
        if(inp.dataset.laborStaff!==undefined)lab[d].staff=inp.value;
        if(inp.dataset.laborHours!==undefined)lab[d].hours=inp.value;
        if(inp.dataset.laborNote!==undefined)lab[d].note=inp.value;
        setLabor(lab);renderInboundDailyView();renderInboundMonthlyView();
      };
    });
  }
  function renderInboundMonthlyView(){
    const tbody=$('inboundMonthlyBody');if(!tbody)return;
    const yearSel=$('inboundMonthlyYear');
    if(yearSel){
      const years=availableInboundYears();
      const cur=yearSel.value;
      yearSel.innerHTML=years.map(y=>`<option value="${y}">${y}년</option>`).join('')||`<option value="">데이터 없음</option>`;
      if(years.includes(cur))yearSel.value=cur;
    }
    const year=yearSel?.value||'';
    const agg=monthlyAgg(year);
    if(!agg.length){tbody.innerHTML='<tr><td colspan="7" class="data-empty">업로드된 입고 데이터가 없습니다.</td></tr>';return}
    tbody.innerHTML=agg.map(r=>`<tr>
      <td>${esc(r.month)}</td>
      <td class="num">${r.batchCount}</td>
      <td class="num">${nf(Math.round(r.pallets))}</td>
      <td class="num">${nf(Math.round(r.qty))}</td>
      <td class="num">${nf(Math.round(r.qtyG))}</td>
      <td class="num">${nf(Math.round(r.qtyEA))}</td>
      <td class="num">${r.avgStaff!==null?r.avgStaff.toFixed(1):'-'}</td>
      <td class="num">${r.avgProd!==null?nf(Math.round(r.avgProd)):'-'}</td>
    </tr>`).join('');
  }
  function exportDailyCsv(){
    const start=$('inboundDailyStart')?.value||'',end=$('inboundDailyEnd')?.value||'';
    const agg=dailyAgg(start,end),labor=getLabor();
    const rows=[['일자','입고수량','SKU','차수','투입인원','소요시간','생산성','비고']];
    agg.forEach(r=>{const lab=labor[r.date]||{};const staff=num(lab.staff),hours=num(lab.hours);const prod=(staff>0&&hours>0)?Math.round(r.qty/(staff*hours)):'';rows.push([r.date,r.qty,r.sku,r.batch,lab.staff||'',lab.hours||'',prod,lab.note||''])});
    download('일일_입고관리.csv',new Blob(['\ufeff'+rows.map(r=>r.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));
  }
  function exportMonthlyCsv(){
    const year=$('inboundMonthlyYear')?.value||'';
    const agg=monthlyAgg(year);
    const rows=[['월','입고차수','총 팔렛수','입고수량(EA환산)','입고수량(G)','입고수량(EA)','평균 투입인원','평균 생산성']];
    agg.forEach(r=>rows.push([r.month,r.batchCount,Math.round(r.pallets),r.qty,r.qtyG,r.qtyEA,r.avgStaff!==null?r.avgStaff.toFixed(1):'',r.avgProd!==null?Math.round(r.avgProd):'']));
    download('월별_입고현황.csv',new Blob(['\ufeff'+rows.map(r=>r.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));
  }
  window.openInboundDailyView=function(label,el){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('inboundDailyView').classList.add('active');pageTitle.textContent=label||'일일 입고관리';document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));if(el)el.classList.add('active');currentSheet=null;renderInboundDailyView()};
  window.openInboundMonthlyView=function(label,el){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('inboundMonthlyView').classList.add('active');pageTitle.textContent=label||'월별 입고현황';document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));if(el)el.classList.add('active');currentSheet=null;renderInboundMonthlyView()};
  window.renderInboundDailyView=renderInboundDailyView;window.renderInboundMonthlyView=renderInboundMonthlyView;
  document.addEventListener('DOMContentLoaded',()=>{
    $('exportInboundDailyCsv')?.addEventListener('click',exportDailyCsv);
    $('exportInboundMonthlyCsv')?.addEventListener('click',exportMonthlyCsv);
    $('inboundMonthlyYearRun')?.addEventListener('click',renderInboundMonthlyView);
    $('inboundDailyFilterRun')?.addEventListener('click',renderInboundDailyView);
    $('inboundDailyFilterReset')?.addEventListener('click',()=>{$('inboundDailyStart').value='';$('inboundDailyEnd').value='';renderInboundDailyView()});
  });
})();

