/* <script id="v114-outbound-analysis-script"> (index.html에서 그대로 옮김) */
(function(){
  var root=document.querySelector('[data-status-panel="outboundanalysis"]');if(!root)return;
  var q=function(s,r){return(r||root).querySelector(s)},qa=function(s,r){return Array.prototype.slice.call((r||root).querySelectorAll(s))};
  var fmt=function(n){return Number(n||0).toLocaleString('ko-KR')};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})};
  var months=['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'];
  function monthIndex(m){return Math.max(0,months.indexOf(m))}
  function monthFactor(m){var i=monthIndex(m);return .78+(i%12)*.018+(i>=12?.06:0)}
  function rangeMonths(start,end){var s=monthIndex(start||'2026-01'),e=monthIndex(end||'2026-10');if(s>e){var t=s;s=e;e=t}return months.slice(s,e+1)}
  function previousYearMonth(m){var p=String(m||'').split('-');return (Number(p[0])-1)+'-'+p[1]}
  function priorMonth(m){var p=String(m||'').split('-'),d=new Date(Number(p[0]),Number(p[1])-2,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

  var storeNames=['강남역','롯데 월드몰','스타필드 코엑스','압구정1호','신세계 강남','롯데 청량리','천안아산','스타필드 안성','커넥트 청주','현대 충청','제주 송당','롯데 부산본점','롯데 광복','신세계 광주','타임스트림','롯데 영등포','롯데 동탄','롯데 강남','롯데 노원','롯데 수지몰','타임빌라스 수원','AK수원','신세계 대전','롯데 대전','갤러리아 타임월드','신세계 김해','신세계 마산','본사','롯데 잠실','롯데 인천','신세계 본점','신세계 경기','현대 무역센터','현대 판교','현대 목동','현대 중동','롯데 미아','롯데 건대','롯데 평촌','롯데 일산','스타필드 하남','스타필드 고양','스타필드 수원','IFC몰','더현대 서울','신세계 센텀시티','롯데 센텀시티','신세계 대구','현대 대구','롯데 대구','롯데 울산','현대 울산','롯데 창원','신세계 천안아산','갤러리아 광교','롯데 전주','신세계 의정부','롯데 수원','현대 킨텍스','롯데 김포공항','현대 디큐브','롯데 분당','신세계 사우스시티','스타필드 시티 위례','스타필드 시티 명지','롯데 구리','스페이스원','강릉','제주','부산 서면'];
  var stores=storeNames.map(function(name,i){
    var conv=Math.max(1200,98500-i*1180+((i*791)%6400));
    var ea=Math.round(conv*(.58+((i%5)*.025))),g=Math.max(0,Math.round((conv-ea)*9.4)),sku=Math.max(32,205-(i%23)*4);
    return{name:name,conv:conv,ea:ea,g:g,sku:sku,index:i};
  });

  var catDefs=[
    {cat:'Bath',type:'EA',prefix:'배쓰밤',count:12},{cat:'Body',type:'EA',prefix:'바디',count:10},{cat:'Gift',type:'EA',prefix:'기프트',count:8},
    {cat:'Bath',type:'G',prefix:'배쓰 G',count:8},{cat:'Soap',type:'G',prefix:'솝',count:10},{cat:'Hair',type:'G',prefix:'헤어',count:8},
    {cat:'부자재',type:'부자재',prefix:'부자재',count:14}
  ];
  var products=[],seq=1;
  catDefs.forEach(function(d,di){for(var j=1;j<=d.count;j++){var conv=Math.max(600,28600-seq*250+((seq*431)%2600)),orig=d.type==='G'?conv*10:conv;products.push({sku:String(100000+seq),name:(j===1&&d.prefix==='배쓰 G'?'INTERGALACTIC':d.prefix+' '+String(j).padStart(2,'0')),type:d.type,cat:d.cat,orig:orig,conv:conv,index:seq});seq++}});
  var categoryOrder=['Bath','Body','Gift','Soap','Hair','부자재'];

  function monthValue(base,m,index){var f=monthFactor(m),wave=1+((((monthIndex(m)+index*3)%7)-3)*.018);return Math.max(0,Math.round(base*f*wave/10))}
  function storeMonth(x,m){return monthValue(x.conv,m,x.index)}
  function productMonthConverted(x,m){return monthValue(x.conv,m,x.index)}
  function productMonthOriginal(x,m){var cv=productMonthConverted(x,m);return x.type==='G'?cv*10:cv}
  function totalForMonths(ms,getter,arr){return arr.map(function(x){return{x:x,value:ms.reduce(function(s,m){return s+getter(x,m)},0)}})}

  function rankHtml(rows,valueFn,extraFn){
    return rows.map(function(row,i){var x=row.x||row;return '<div><b>'+(i+1)+'</b><span>'+esc(x.name)+'</span><strong>'+esc(valueFn(row))+(extraFn?'<small style="display:block;margin-top:2px;font-size:9px;color:#8a918c;font-weight:800">'+esc(extraFn(row))+'</small>':'')+'</strong></div>'}).join('')||'<div class="data-empty">데이터가 없습니다.</div>';
  }
  function radialHtml(name,value,total,color,small){
    var pct=total?Math.max(0,Math.min(100,value/total*100)):0;
    return '<div class="boxcount-radial-item"><div class="boxcount-radial-gauge" style="--radial:'+pct.toFixed(1)+'%;--radial-color:'+color+'"><div><b>'+pct.toFixed(1)+'%</b><small>'+esc(small||fmt(value)+' EA')+'</small></div></div><strong>'+esc(name)+'</strong></div>';
  }
  var radialColors=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8','#9a8f83'];

  function fastLine(el,labels,values,unit){
    if(!el)return;
    if(typeof Chart==='undefined'){
      if(window.ensureChart)window.ensureChart().then(function(){fastLine(el,labels,values,unit)});
      return;
    }
    if(el._outboundChart){try{el._outboundChart.destroy()}catch(e){}}
    el.innerHTML='<canvas></canvas>';
    var canvas=el.querySelector('canvas');
    el._outboundChart=new Chart(canvas,{
      type:'line',
      data:{
        labels:labels.map(function(v){return String(v||'').replace('-','.')}),
        datasets:[{data:values,borderWidth:2,pointRadius:3,tension:.25}]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){return fmt(ctx.raw)+' '+(unit||'EA')}}}
        },
        scales:{
          y:{beginAtZero:true,grid:{color:'#eeeeea'}},
          x:{grid:{display:false},ticks:{autoSkip:true,maxTicksLimit:12}}
        }
      }
    });
  }

  function normalizeMonthInputs(a,b){
    var s=q(a).value||'2026-01',e=q(b).value||'2026-10';if(s>e){var t=s;s=e;e=t;q(a).value=s;q(b).value=e}return rangeMonths(s,e)
  }

  function renderOverview(){
    var ms=normalizeMonthInputs('#outboundOverviewStart','#outboundOverviewEnd');
    var vals=ms.map(function(m){return stores.reduce(function(s,x){return s+storeMonth(x,m)},0)});
    var total=vals.reduce(function(a,b){return a+b},0),ea=Math.round(total*.64),g=Math.round(total*3.46),sku=Math.min(products.length,Math.round(products.length*(.72+ms.length*.02))),days=Math.max(1,ms.length*22),avg=Math.round(total/days),max=Math.max.apply(null,vals),maxI=vals.indexOf(max),maxDaily=Math.round(max/18.4),maxEa=Math.round(maxDaily*.65),maxG=Math.round(maxDaily*3.5);
    q('#outOverviewTotal').textContent=fmt(total);q('#outOverviewOriginal').textContent='EA '+fmt(ea)+' · G '+fmt(g);q('#outOverviewAvg').textContent=fmt(avg);q('#outOverviewSku').textContent=fmt(sku);q('#outOverviewMaxDate').textContent=(ms[maxI]||'2026-10').replace('-','.')+'.08';q('#outOverviewMaxQty').textContent=fmt(maxDaily);q('#outOverviewMaxOriginal').textContent='EA '+fmt(maxEa)+' · G '+fmt(maxG);
    q('#outOverviewMonthBody').innerHTML=ms.map(function(m,i){var v=vals[i];return '<tr><td>'+m.replace('-','.')+'</td><td>'+fmt(v)+'</td><td>EA '+fmt(Math.round(v*.64))+' · G '+fmt(Math.round(v*3.46))+'</td><td>총 '+Math.min(products.length,42+i*2)+' · EA '+Math.min(30,22+i)+' · G '+Math.min(26,14+i)+'</td></tr>'}).join('');
    fastLine(q('#outOverviewTrendFast'),ms,vals,'환산 EA');
  }

  var storeMonths=null,storeReturnY=null;
  function renderStore(){
    var ms=normalizeMonthInputs('#outStoreStart','#outStoreEnd');storeMonths=ms;
    var rows=totalForMonths(ms,storeMonth,stores).filter(function(r){return r.value>0}),grand=rows.reduce(function(a,r){return a+r.value},0),top=rows.slice().sort(function(a,b){return b.value-a.value}).slice(0,5),bottom=rows.slice().sort(function(a,b){return a.value-b.value}).slice(0,5);
    q('#outStoreTop').innerHTML=rankHtml(top,function(r){return fmt(r.value)+' EA'},function(r){return (r.value/grand*100).toFixed(1)+'% · '+r.x.sku+' SKU'});
    q('#outStoreBottom').innerHTML=rankHtml(bottom,function(r){return fmt(r.value)+' EA'},function(r){return (r.value/grand*100).toFixed(1)+'% · '+r.x.sku+' SKU'});
    var topSum=top.reduce(function(a,r){return a+r.value},0);
    q('#outStoreComposition').innerHTML=top.map(function(r,i){return radialHtml(r.x.name,r.value,grand,radialColors[i%radialColors.length],fmt(r.value)+' EA')}).join('');
    q('#outStoreOtherShare').textContent=Math.max(0,100-topSum/grand*100).toFixed(1)+'%';
    var high=top[0],low=bottom[0];
    q('#outStoreMajor').innerHTML='<div><span>최고 출고 매장</span><b>'+esc(high.x.name)+' · '+fmt(high.value)+' EA</b></div><div><span>상위 5개 매장 비중</span><b>'+(topSum/grand*100).toFixed(1)+'%</b></div><div><span>출고 매장 수</span><b>'+rows.length+'개</b></div><div><span>최저 출고 매장</span><b>'+esc(low.x.name)+' · '+fmt(low.value)+' EA</b></div>';
    renderStoreTable();
  }
  function renderStoreTable(){
    var ms=storeMonths||normalizeMonthInputs('#outStoreStart','#outStoreEnd'),kw=(q('#outStoreSearch').value||'').trim().toLowerCase(),rows=totalForMonths(ms,storeMonth,stores).filter(function(r){return r.value>0}),grand=rows.reduce(function(a,r){return a+r.value},0);
    rows.sort(function(a,b){return a.x.name.localeCompare(b.x.name,'ko')});if(kw)rows=rows.filter(function(r){return r.x.name.toLowerCase().includes(kw)});
    q('#outStoreCompareCount').textContent=rows.length+'개 매장';
    q('#outStoreCompareBody').innerHTML=rows.map(function(r){var x=r.x;return '<tr><td>'+esc(x.name)+'</td><td>'+fmt(r.value)+'</td><td>EA '+fmt(Math.round(r.value*.62))+' · G '+fmt(Math.round(r.value*3.72))+'</td><td>'+x.sku+'</td><td>'+(r.value/grand*100).toFixed(1)+'%</td><td><button type="button" class="btn sm out-store-detail" data-store="'+esc(x.name)+'">상세보기</button></td></tr>'}).join('');
    qa('.out-store-detail',q('#outStoreCompareBody')).forEach(function(b){b.onclick=function(){openStoreDetail(b.dataset.store)}});
  }
  function openStoreDetail(name){
    var x=stores.find(function(s){return s.name===name});if(!x)return;var ms=storeMonths||normalizeMonthInputs('#outStoreStart','#outStoreEnd'),vals=ms.map(function(m){return storeMonth(x,m)}),total=vals.reduce(function(a,b){return a+b},0);
    storeReturnY=window.scrollY;q('#outStoreDetailPanel').hidden=false;q('#outStoreDetailTitle').textContent=x.name+' 상세';q('#outStoreDetailMeta').textContent=ms[0]+' ~ '+ms[ms.length-1];q('#outStoreDetailTotal').textContent=fmt(total);q('#outStoreDetailAvg').textContent=fmt(Math.round(total/Math.max(1,ms.length*22)));q('#outStoreDetailSku').textContent=x.sku;q('#outStoreDetailMax').textContent=(ms[vals.indexOf(Math.max.apply(null,vals))]||ms[0])+'.08';
    q('#outStoreDetailMonthBody').innerHTML=ms.map(function(m,i){return '<tr><td>'+m.replace('-','.')+'</td><td>'+fmt(vals[i])+'</td><td>EA '+fmt(Math.round(vals[i]*.62))+' · G '+fmt(Math.round(vals[i]*3.72))+'</td><td>'+Math.max(12,Math.round(x.sku*(.72+i*.015)))+'</td></tr>'}).join('');
    fastLine(q('#outStoreDetailTrend'),ms,vals,'환산 EA');q('#outStoreDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  var productMonths=null,productReturnY=null;
  function renderProduct(){
    var ms=normalizeMonthInputs('#outProductStart','#outProductEnd');productMonths=ms;
    var rows=totalForMonths(ms,productMonthConverted,products).filter(function(r){return r.value>0}),grand=rows.reduce(function(a,r){return a+r.value},0);
    function topType(type){return rows.filter(function(r){return r.x.type===type}).sort(function(a,b){return b.value-a.value}).slice(0,5)}
    q('#outProductEaTop').innerHTML=rankHtml(topType('EA'),function(r){return fmt(ms.reduce(function(s,m){return s+productMonthOriginal(r.x,m)},0))+' EA'},function(r){return '비중 '+(r.value/grand*100).toFixed(1)+'%'});
    q('#outProductGTop').innerHTML=rankHtml(topType('G'),function(r){return fmt(ms.reduce(function(s,m){return s+productMonthOriginal(r.x,m)},0))+' G'},function(r){return '환산 '+fmt(r.value)+' EA · '+(r.value/grand*100).toFixed(1)+'%'});
    q('#outProductMaterialTop').innerHTML=rankHtml(topType('부자재'),function(r){return fmt(ms.reduce(function(s,m){return s+productMonthOriginal(r.x,m)},0))+' EA'},function(r){return '비중 '+(r.value/grand*100).toFixed(1)+'%'});
    var cats=categoryOrder.map(function(cat){var catRows=rows.filter(function(r){return r.x.cat===cat}),val=catRows.reduce(function(a,r){return a+r.value},0);return{cat:cat,value:val,sku:catRows.length}}).filter(function(x){return x.value>0});
    q('#outProductComposition').innerHTML=cats.map(function(x,i){return radialHtml(x.cat,x.value,grand,radialColors[i%radialColors.length],x.sku+' SKU')}).join('');
    renderProductTable();
  }
  function renderProductTable(){
    var ms=productMonths||normalizeMonthInputs('#outProductStart','#outProductEnd'),kw=(q('#outProductSearch').value||'').trim().toLowerCase(),type=q('#outProductType').value||'',rows=products.map(function(x){var conv=ms.reduce(function(s,m){return s+productMonthConverted(x,m)},0),orig=ms.reduce(function(s,m){return s+productMonthOriginal(x,m)},0);return{x:x,conv:conv,orig:orig}}).filter(function(r){return r.conv>0}),grand=rows.reduce(function(a,r){return a+r.conv},0);
    rows.sort(function(a,b){return a.x.name.localeCompare(b.x.name,'ko')});rows=rows.filter(function(r){return(!kw||(r.x.name+' '+r.x.sku).toLowerCase().includes(kw))&&(!type||r.x.type===type)});
    q('#outProductCompareCount').textContent=rows.length+' SKU';
    q('#outProductCompareBody').innerHTML=rows.map(function(r){var x=r.x;return '<tr><td>'+x.sku+'</td><td>'+esc(x.name)+'</td><td>'+x.type+'</td><td>'+x.cat+'</td><td>'+fmt(r.orig)+' '+(x.type==='G'?'G':'EA')+'</td><td>'+fmt(r.conv)+'</td><td>'+(r.conv/grand*100).toFixed(1)+'%</td><td><button type="button" class="btn sm out-product-detail" data-sku="'+x.sku+'">상세보기</button></td></tr>'}).join('');
    qa('.out-product-detail',q('#outProductCompareBody')).forEach(function(b){b.onclick=function(){openProductDetail(b.dataset.sku)}});
  }
  function openProductDetail(sku){
    var x=products.find(function(p){return p.sku===sku});if(!x)return;var ms=productMonths||normalizeMonthInputs('#outProductStart','#outProductEnd'),converted=ms.map(function(m){return productMonthConverted(x,m)}),original=ms.map(function(m){return productMonthOriginal(x,m)}),totalC=converted.reduce(function(a,b){return a+b},0),totalO=original.reduce(function(a,b){return a+b},0),unit=x.type==='G'?'G':'EA';
    productReturnY=window.scrollY;q('#outProductDetailPanel').hidden=false;q('#outProductDetailTitle').textContent=x.name+' 상세';q('#outProductDetailMeta').textContent=x.type+' · '+x.cat+' · '+ms[0]+' ~ '+ms[ms.length-1];q('#outProductDetailOriginal').textContent=fmt(totalO)+' '+unit;q('#outProductDetailConverted').textContent=fmt(totalC);q('#outProductDetailAvg').textContent=fmt(Math.round(totalO/Math.max(1,ms.length*22)))+' '+unit;q('#outProductDetailMax').textContent=(ms[original.indexOf(Math.max.apply(null,original))]||ms[0])+'.18';q('#outProductDetailTrendUnit').textContent='원본 '+unit+' 기준';
    q('#outProductDetailMonthBody').innerHTML=ms.map(function(m,i){return '<tr><td>'+m.replace('-','.')+'</td><td>'+fmt(original[i])+' '+unit+'</td><td>'+fmt(converted[i])+'</td><td>'+((converted[i]/Math.max(1,totalC))*100).toFixed(1)+'%</td></tr>'}).join('');
    fastLine(q('#outProductDetailTrend'),ms,original,unit);q('#outProductDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function moverHtml(rows){
    return rows.map(function(r){return '<div class="outbound-monthly-mover-row"><span>'+esc(r.x.name)+'</span><div class="outbound-monthly-mover-value"><b>'+(r.pct>0?'+':'')+r.pct.toFixed(1)+'%</b><small>'+(r.diff>0?'+':'')+fmt(r.diff)+' EA</small></div></div>'}).join('')||'<div class="data-empty">해당 항목이 없습니다.</div>';
  }
  function renderMonthly(){
    var base=q('#outMonthlyBase').value||'2026-10',compare=q('#outMonthlyCompare').value||priorMonth(base),yoy=previousYearMonth(base);q('#outMonthlyCompare').value=compare;
    var storeCur=stores.map(function(x){var cur=storeMonth(x,base),old=storeMonth(x,compare);return{x:x,cur:cur,old:old,diff:cur-old,pct:old?(cur-old)/old*100:0}}),positive=storeCur.filter(function(r){return r.cur>0}),total=positive.reduce(function(a,r){return a+r.cur},0),oldTotal=stores.reduce(function(a,x){return a+storeMonth(x,compare)},0),yoyTotal=stores.reduce(function(a,x){return a+storeMonth(x,yoy)},0),delta=oldTotal?(total-oldTotal)/oldTotal*100:0,yoyDelta=yoyTotal?(total-yoyTotal)/yoyTotal*100:0;
    q('#outMonthlyTotal').textContent=fmt(total);q('#outMonthlyOriginal').textContent='EA '+fmt(Math.round(total*.64))+' · G '+fmt(Math.round(total*3.46));q('#outMonthlyAvg').textContent=fmt(Math.round(total/22));q('#outMonthlySku').textContent=products.length;q('#outMonthlyMaxDate').textContent=base+'.08';q('#outMonthlyDelta').textContent=(delta>0?'+':'')+delta.toFixed(1);q('#outMonthlyCompareLabel').textContent=base+' vs '+compare;q('#outMonthlyYoY').textContent=(yoyDelta>0?'+':'')+yoyDelta.toFixed(1);q('#outMonthlyYoYLabel').textContent=base+' vs '+yoy;
    var top=positive.slice().sort(function(a,b){return b.cur-a.cur}).slice(0,5),bottom=positive.slice().sort(function(a,b){return a.cur-b.cur}).slice(0,5),up=storeCur.filter(function(r){return r.cur>0&&r.old>0&&r.diff>0}).sort(function(a,b){return b.pct-a.pct}).slice(0,5),down=storeCur.filter(function(r){return r.cur>0&&r.old>0&&r.diff<0}).sort(function(a,b){return a.pct-b.pct}).slice(0,5);
    q('#outMonthlyStoreTop').innerHTML=rankHtml(top,function(r){return fmt(r.cur)+' EA'});q('#outMonthlyStoreBottom').innerHTML=rankHtml(bottom,function(r){return fmt(r.cur)+' EA'});q('#outMonthlyStoreUp').innerHTML=moverHtml(up);q('#outMonthlyStoreDown').innerHTML=moverHtml(down);
    var topTotal=top.reduce(function(a,r){return a+r.cur},0);q('#outMonthlyStoreComposition').innerHTML=top.map(function(r,i){return radialHtml(r.x.name,r.cur,total,radialColors[i],fmt(r.cur)+' EA')}).join('');
    var productRows=products.map(function(x){return{x:x,conv:productMonthConverted(x,base),orig:productMonthOriginal(x,base),old:productMonthConverted(x,compare)}}),prodTotal=productRows.reduce(function(a,r){return a+r.conv},0);
    function ptop(type){return productRows.filter(function(r){return r.x.type===type&&r.conv>0}).sort(function(a,b){return b.conv-a.conv}).slice(0,5)}
    q('#outMonthlyEa').innerHTML=rankHtml(ptop('EA'),function(r){return fmt(r.orig)+' EA'});q('#outMonthlyG').innerHTML=rankHtml(ptop('G'),function(r){return fmt(r.orig)+' G'});q('#outMonthlyMaterial').innerHTML=rankHtml(ptop('부자재'),function(r){return fmt(r.orig)+' EA'});
    var cats=categoryOrder.map(function(cat){var rs=productRows.filter(function(r){return r.x.cat===cat}),v=rs.reduce(function(a,r){return a+r.conv},0);return{cat:cat,value:v,sku:rs.length}}).filter(function(x){return x.value>0});q('#outMonthlyProductComposition').innerHTML=cats.map(function(x,i){return radialHtml(x.cat,x.value,prodTotal,radialColors[i],x.sku+' SKU')}).join('');
    q('#outMonthlyNew').textContent='EA 8 · G 4 · 부자재 3 SKU';q('#outMonthlyException').textContent='EA 5 · G 2 · 부자재 1 SKU';
    q('#outMonthlyStoreBody').innerHTML=storeCur.slice().sort(function(a,b){return a.x.name.localeCompare(b.x.name,'ko')}).map(function(r){var pct=r.old?(r.diff/r.old*100):0;return '<tr><td>'+esc(r.x.name)+'</td><td>'+fmt(r.cur)+'</td><td>'+(r.old?((pct>0?'+':'')+pct.toFixed(1)+'%'):'신규')+'</td><td>'+(r.diff>0?'+':'')+fmt(r.diff)+' EA</td></tr>'}).join('');
    q('#outMonthlyProductBody').innerHTML=productRows.slice().sort(function(a,b){return a.x.name.localeCompare(b.x.name,'ko')}).map(function(r){return '<tr><td>'+esc(r.x.name)+'</td><td>'+r.x.type+'</td><td>'+fmt(r.orig)+' '+(r.x.type==='G'?'G':'EA')+'</td><td>'+fmt(r.conv)+'</td></tr>'}).join('');
  }

  var rawRows=[];
  function buildRaw(){
    if(rawRows.length)return rawRows;var sampleStores=stores.slice(0,28),sampleProducts=products.slice(0,42),days=['01','02','03','05','06','07','08','09','12','13','14','15','16','19','20','21','22','23','26','27','28','29','30'];sampleStores.forEach(function(s,si){for(var k=0;k<3;k++){var p=sampleProducts[(si*3+k*5)%sampleProducts.length],day=days[(si+k*4)%days.length],qty=p.type==='G'?(2400+((si+k)*700)%14800):(48+((si+k)*37)%720);rawRows.push({date:'2026-10-'+day,store:s.name,sku:p.sku,name:p.name,type:p.type,cat:p.cat,unit:p.type==='G'?'G':'EA',qty:qty})}});return rawRows.sort(function(a,b){return a.date.localeCompare(b.date)||a.store.localeCompare(b.store,'ko')});
  }
  function renderRaw(){
    var s=q('#outDetailStart').value||'',e=q('#outDetailEnd').value||'',store=(q('#outDetailStore').value||'').trim().toLowerCase(),prod=(q('#outDetailProduct').value||'').trim().toLowerCase(),type=q('#outDetailType').value||'',cat=q('#outDetailCategory').value||'';
    if(s&&e&&s>e){var t=s;s=e;e=t;q('#outDetailStart').value=s;q('#outDetailEnd').value=e}
    var rows=buildRaw().filter(function(x){return(!s||x.date>=s)&&(!e||x.date<=e)&&(!store||x.store.toLowerCase().includes(store))&&(!prod||(x.name+' '+x.sku).toLowerCase().includes(prod))&&(!type||x.type===type)&&(!cat||x.cat===cat)});
    q('#outDetailBody').innerHTML=rows.map(function(x){return '<tr><td>'+x.date+'</td><td>'+esc(x.store)+'</td><td>'+x.sku+'</td><td>'+esc(x.name)+'</td><td>'+x.type+'</td><td>'+x.cat+'</td><td>'+x.unit+'</td><td>'+fmt(x.qty)+'</td></tr>'}).join('')||'<tr><td colspan="8" class="data-empty">조회 결과가 없습니다.</td></tr>';q('#outDetailResultLabel').textContent='원본 처리이력 · '+fmt(rows.length)+'건 · 환산값 미표시';q('#outDetailResults').hidden=false;
  }

  function switchView(view){
    qa('[data-outbound-analysis-view]').forEach(function(b){b.classList.toggle('active',b.dataset.outboundAnalysisView===view)});
    qa('[data-outbound-analysis-section]').forEach(function(s){s.classList.toggle('active',s.dataset.outboundAnalysisSection===view)});
    if(view==='overview')renderOverview();else if(view==='store')renderStore();else if(view==='product')renderProduct();else if(view==='monthly')renderMonthly();
  }
  document.addEventListener('click',function(e){var tab=e.target.closest&&e.target.closest('[data-outbound-analysis-view]');if(tab&&root.contains(tab)){switchView(tab.dataset.outboundAnalysisView);return}});
  q('#outboundOverviewRun').onclick=renderOverview;q('#outboundOverviewAll').onclick=function(){q('#outboundOverviewStart').value='2025-01';q('#outboundOverviewEnd').value='2026-10';renderOverview()};
  q('#outStoreRun').onclick=renderStore;q('#outStoreAll').onclick=function(){q('#outStoreStart').value='2025-01';q('#outStoreEnd').value='2026-10';renderStore()};
  q('#outProductRun').onclick=renderProduct;q('#outProductAll').onclick=function(){q('#outProductStart').value='2025-01';q('#outProductEnd').value='2026-10';renderProduct()};
  q('#outMonthlyRun').onclick=renderMonthly;q('#outDetailRun').onclick=renderRaw;q('#outDetailClose').onclick=function(){q('#outDetailResults').hidden=true};
  q('#outStoreCompareToggle').onclick=function(){var p=q('#outStoreComparePanel');p.hidden=!p.hidden;this.querySelector('span').textContent=p.hidden?'전체 매장 비교 조회':'전체 매장 비교 닫기';this.querySelector('b').textContent=p.hidden?'⌄':'⌃';if(!p.hidden)renderStoreTable()};
  q('#outProductCompareToggle').onclick=function(){var p=q('#outProductComparePanel');p.hidden=!p.hidden;this.querySelector('span').textContent=p.hidden?'전체 제품 비교 조회':'전체 제품 비교 닫기';this.querySelector('b').textContent=p.hidden?'⌄':'⌃';if(!p.hidden)renderProductTable()};
  q('#outStoreSearch').oninput=renderStoreTable;q('#outProductSearch').oninput=renderProductTable;q('#outProductType').onchange=renderProductTable;
  q('#outStoreDetailClose').onclick=function(){q('#outStoreDetailPanel').hidden=true;if(storeReturnY!=null){var y=storeReturnY;storeReturnY=null;window.scrollTo({top:y,behavior:'smooth'})}};
  q('#outProductDetailClose').onclick=function(){q('#outProductDetailPanel').hidden=true;if(productReturnY!=null){var y=productReturnY;productReturnY=null;window.scrollTo({top:y,behavior:'smooth'})}};
  renderOverview();
})();

