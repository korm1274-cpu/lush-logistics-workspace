/* <script id="v80-statusboard-patch"> (index.html에서 그대로 옮김) */
(function(){
  var STATUS_KEY='lush_productivity_daily_v1';
  var REQUEST_KEY='lush_outbound_requests_v1';
  var HOURS=['0~30분','30분~1시간','1~2시간','2~3시간','3~4시간','4~5시간','5~6시간','6시간+'];
  var BUCKET_HOURS={'0~30분':0.5,'30분~1시간':0.5,'1~2시간':1,'2~3시간':1,'3~4시간':1,'4~5시간':1,'5~6시간':1,'6시간+':1};
  var q=function(s,r){return (r||document).querySelector(s)}, qa=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var pad=function(n){return String(n).padStart(2,'0')};
  var dateKey=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
  var today=dateKey(new Date());
  var fmt=function(n){return Number(n||0).toLocaleString('ko-KR')};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})};
  var readDaily=function(){try{var x=JSON.parse(localStorage.getItem(STATUS_KEY)||'{}');return x&&typeof x==='object'?x:{}}catch(e){return{}}};
  var saveDaily=function(x){localStorage.setItem(STATUS_KEY,JSON.stringify(x))};
  var getRecord=function(dt){var all=readDaily();return all[dt]||{date:dt,staff:0,hours:{}}};
  var calcRecord=function(r){
    var qty=0,labor=0;
    HOURS.forEach(function(h){var row=(r.hours&&r.hours[h])||{};var qn=Number(row.qty||0),sn=Number(r.staff||0),duration=Number(BUCKET_HOURS[h]||1);qty+=qn;if(qn>0&&sn>0)labor+=sn*duration});
    return {qty:qty,labor:labor,rate:labor>0?qty/labor:0};
  };

  /* Demo data is isolated from saved operational data and is overridden by real local data when available. */
  var DEMO_MODE=true;
  var demoRecord=function(dt,staff,qtys,startTime,endTime){
    var hours={};HOURS.forEach(function(h,i){hours[h]={qty:Number(qtys[i]||0),staff:staff}});
    return{date:dt,staff:staff,startTime:startTime||'08:40',endTime:endTime||'11:40',hours:hours,__demo:true};
  };
  var DEMO_DAILY={};
  var demoYear=Number(today.slice(0,4));
  [910,945,972,1018,1041,1067].forEach(function(rate,i){
    var month=i+3,dt=demoYear+'-'+pad(month)+'-15';
    DEMO_DAILY[dt]=demoRecord(dt,8,HOURS.map(function(){return rate*8}));
  });
  var demoMonth=today.slice(0,7);
  DEMO_DAILY[demoMonth+'-28']=demoRecord(demoMonth+'-28',8,[6200,6500,6100,6800,7100,6900,7200,7480]);
  DEMO_DAILY[demoMonth+'-29']=demoRecord(demoMonth+'-29',8,[7200,7600,6900,7800,7900,8000,7900,8120]);
  DEMO_DAILY[today]=demoRecord(today,8,[4200,4550,8650,9200,7350,8120,7840,7560],'08:40','15:40');
  var readDailyDisplay=function(){
    var merged=Object.assign({},DEMO_MODE?DEMO_DAILY:{});
    var saved=readDaily();
    Object.keys(saved).forEach(function(dt){
      var demo=merged[dt],real=saved[dt]||{};
      if(DEMO_MODE&&demo){
        var realStaff=Number(real.staff||0);
        var hasRealHours=real.hours&&Object.values(real.hours).some(function(row){return Number(row&&row.qty||0)>0});
        merged[dt]={
          date:dt,
          staff:realStaff>0?realStaff:Number(demo.staff||0),
          startTime:real.startTime||demo.startTime||'',
          endTime:real.endTime||demo.endTime||'',
          hours:hasRealHours?real.hours:demo.hours,
          __demo:true
        };
      }else{
        merged[dt]=real;
      }
    });
    return merged;
  };
  getRecord=function(dt){
    if(DEMO_MODE){
      return demoRecord(dt,8,[4200,4550,8650,9200,7350,8120,7840,7560],'08:40','15:40');
    }
    var all=readDailyDisplay(),record=all[dt];
    if(record)return record;
    return{date:dt,staff:0,startTime:'',endTime:'',hours:{}};
  };
  var DEMO_SHIPPING={convertedQty:68400,convertedGoal:100000,lastHourConverted:12600,eta:'16:40'};
  var DEMO_STORES=[
    {name:'강남역점',box:23,total:9000,done:9000,sku:48},
    {name:'홍대점',box:20,total:8000,done:7600,sku:44},
    {name:'명동점',box:18,total:7500,done:6500,sku:41},
    {name:'잠실점',box:17,total:7200,done:6100,sku:39},
    {name:'여의도점',box:16,total:7000,done:5600,sku:37},
    {name:'대학로점',box:15,total:6800,done:5000,sku:35},
    {name:'신촌점',box:15,total:6500,done:4500,sku:34},
    {name:'건대점',box:14,total:6400,done:4200,sku:33},
    {name:'영등포점',box:14,total:6200,done:3900,sku:31},
    {name:'가로수길점',box:13,total:6100,done:3500,sku:30},
    {name:'수원점',box:13,total:6000,done:3200,sku:29},
    {name:'판교점',box:12,total:5900,done:2800,sku:27},
    {name:'부산점',box:12,total:5800,done:2400,sku:26},
    {name:'대전점',box:11,total:5700,done:2000,sku:25},
    {name:'인천점',box:11,total:5900,done:0,sku:28}
  ];
  var DEMO_STORE_HISTORY=[];
  (function(){
    var names=DEMO_STORES.map(function(s){return s.name});
    for(var dayOffset=6;dayOffset>=0;dayOffset--){
      var d=new Date();d.setDate(d.getDate()-dayOffset);var dt=dateKey(d);
      names.forEach(function(name,idx){
        var total=4200+((idx*730+dayOffset*410)%6400);
        var startHour=7+((idx+dayOffset)%3),startMin=((idx*7+dayOffset*5)%4)*10;
        var duration=135+((idx*17+dayOffset*23)%190);
        var startM=startHour*60+startMin,endM=startM+duration;
        var hh=function(m){return pad(Math.floor(m/60)%24)+':'+pad(m%60)};
        DEMO_STORE_HISTORY.push({date:dt,store:name,total:total,done:total,start:hh(startM),end:hh(endM),duration:duration,status:'완료'});
      });
    }
  })();

  /* 현황판 세부 화면은 실제 메뉴 항목(statusTab)으로 관리되어 Admin에서 이름·순서·상위 메뉴를 바꿀 수 있습니다. */
  if(typeof syncStatusTabLabels==='function')syncStatusTabLabels();
  if(typeof renderNav==='function')renderNav();

  function activateTab(name){
    qa('.status-board-tab').forEach(function(b){b.classList.toggle('active',b.dataset.statusTab===name)});
    qa('.status-panel').forEach(function(p){p.classList.toggle('active',p.dataset.statusPanel===name)});
    if(name==='productivity'){setProductivityView('today');renderCumulative();}
    if(name==='storehistory')renderStoreHistory();
    if(name==='boxcount')renderBoxcountCumulative();
    if(name==='products')renderProductOutboundAnalysis();
  }
  qa('.status-board-tab').forEach(function(b){b.addEventListener('click',function(){activateTab(b.dataset.statusTab)})});

  var BOXCOUNT_DEFAULT_SCHEDULE={
    '월요일':{'1호차':[{name:'롯데 월드몰'},{name:'압구정 1호'}],'2호차':[{name:'강남역'},{name:'본사'}],'3호차':[{name:'스타필드 코엑스'},{name:'롯데 청량리'}],'4호차':[{name:'천안 아산'},{name:'스타필드 안성'},{name:'커넥트 청주'}],'택배':[{name:'현대 충청'},{name:'제주 송당'},{name:'롯데 부산본점'},{name:'롯데 광복'},{name:'신세계 광주'}]},
    '화요일':{'1호차':[{name:'타임스트림',note:'1·3주차 격주 배송'},{name:'롯데 영등포'},{name:'롯데 동탄'}],'2호차':[{name:'롯데 강남'},{name:'신세계 강남'},{name:'롯데 노원'},{name:'본사'}],'3호차':[{name:'롯데 수지몰'},{name:'타임빌라스 수원'},{name:'AK수원'}],'4호차':[{name:'신세계 대전'},{name:'롯데 대전'},{name:'갤러리아 타임월드'}],'택배':[{name:'신세계 김해'},{name:'신세계 마산'},{name:'롯데 창원'},{name:'제주 산방산'}]},
    '수요일':{'1호차':[{name:'스타필드 고양'},{name:'롯데 일산'},{name:'본사'}],'2호차':[{name:'명동'},{name:'신세계 본점'}],'3호차':[{name:'스타필드 수원'},{name:'갤러리아 광교'},{name:'롯데 평촌'}],'4호차':[{name:'타임스퀘어',note:'1·3주차'},{name:'롯데 인천',note:'1·3주차'},{name:'홍대',note:'2·4주차'},{name:'롯데 본점',note:'2·4주차'}],'택배':[{name:'현대 울산'},{name:'롯데 울산'},{name:'롯데 동부산'},{name:'신세계 센텀'}]},
    '목요일':{'1호차':[{name:'성수'},{name:'롯데 미아'},{name:'현대 미아'}],'2호차':[{name:'현대 송도'},{name:'현대 중동'},{name:'롯데 중동'}],'3호차':[{name:'현대 신촌'},{name:'IFC'},{name:'본사'}],'4호차':[{name:'두물머리'},{name:'스타필드 하남'},{name:'현대 천호'}],'택배':[{name:'롯데 광주'},{name:'롯데 전주'},{name:'신세계 대구'},{name:'롯데 대구'},{name:'현대 대구'}]},
    '금요일':{'1호차':[{name:'롯데 잠실'},{name:'현대 스페이스원'},{name:'신세계 의정부'}],'2호차':[{name:'AK분당'},{name:'신세계 사우스시티'},{name:'현대 판교'}],'3호차':[{name:'현대 목동'},{name:'마곡 원그르브'},{name:'롯데 김포'}],'4호차':[{name:'용산 아이파크'},{name:'이태원'},{name:'본사'}],'택배':[]}
  };
  var BOXCOUNT_SCHEDULE=(function(){
    try{
      var saved=JSON.parse(localStorage.getItem('lushBoxcountScheduleV1')||'null');
      return saved&&typeof saved==='object'?saved:JSON.parse(JSON.stringify(BOXCOUNT_DEFAULT_SCHEDULE));
    }catch(e){return JSON.parse(JSON.stringify(BOXCOUNT_DEFAULT_SCHEDULE))}
  })();
  var BOXCOUNT_SCHEDULE_KEY='lushBoxcountScheduleV1';
  var BOXCOUNT_ALIASES={'스타필드 수원 스파':'스타필드 수원','압구정 스파':'압구정 1호'};
  var BOXCOUNT_MANUAL_NAMES_KEY='lushBoxcountManualNamesV1',BOXCOUNT_MANUAL_ROWS_KEY='lushBoxcountManualRowsV1';
  var boxcountCharts={cumulative:null,weekday:null,weekdayDonut:null,storeDetail:null,detailTrend:null};
  var boxcountPeriod={start:'',end:''},boxcountViewMode='year';
  var boxWeekdayPeriod={start:'',end:''},boxWeekdayViewMode='year';
  var boxStorePeriod={start:'',end:''},boxStoreViewMode='year';
  var boxStoreCompareOpen=false;
  var boxStoreDetailReturnY=null,boxDetailExpandedReturnY=null;

  function boxcountRead(key,fallback){try{var v=JSON.parse(localStorage.getItem(key)||'null');return v==null?fallback:v}catch(e){return fallback}}
  function boxcountWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
  function boxcountAllStores(){
    var set={};Object.keys(BOXCOUNT_SCHEDULE).forEach(function(day){Object.keys(BOXCOUNT_SCHEDULE[day]).forEach(function(route){BOXCOUNT_SCHEDULE[day][route].forEach(function(x){set[x.name]=true})})});
    return Object.keys(set).sort();
  }
  function boxcountStoreMeta(name){
    var meta={day:'-',route:'-',note:'매주'};
    Object.keys(BOXCOUNT_SCHEDULE).some(function(day){return Object.keys(BOXCOUNT_SCHEDULE[day]).some(function(route){return BOXCOUNT_SCHEDULE[day][route].some(function(x){if(x.name===name){meta={day:day,route:route,note:x.note||'매주'};return true}return false})})});
    return meta;
  }
  function boxcountAvailableMonths(){
    var set={},y=today.slice(0,4),cur=Number(today.slice(5,7));
    for(var m=1;m<=cur;m++)set[y+'-'+String(m).padStart(2,'0')]=true;
    try{boxRows().forEach(function(r){var d=normDate(r[0]||'');if(/^\\d{4}-\\d{2}/.test(d))set[d.slice(0,7)]=true})}catch(e){}
    boxcountRead(BOXCOUNT_MANUAL_ROWS_KEY,[]).forEach(function(r){var d=String(r.date||'');if(/^\\d{4}-\\d{2}/.test(d))set[d.slice(0,7)]=true});
    return Object.keys(set).sort();
  }
  function boxcountMonthsFor(period,mode){
    var all=boxcountAvailableMonths(),year=today.slice(0,4);
    if(mode==='all')return all;
    if(mode==='custom'&&(period.start||period.end))return all.filter(function(x){return(!period.start||x>=period.start)&&(!period.end||x<=period.end)});
    return all.filter(function(x){return x.slice(0,4)===year});
  }
  function boxcountMonths(){return boxcountMonthsFor(boxcountPeriod,boxcountViewMode)}
  function boxcountPeriodText(period,mode){
    if(mode==='all')return '전체 누계';
    if(mode==='custom'&&(period.start||period.end))return (period.start||'최초 월')+' ~ '+(period.end||'최신 월');
    return today.slice(0,4)+'년';
  }
  function boxcountPrevMonth(month){
    var d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()-1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
  function boxcountBase(name){
    var n=0;for(var i=0;i<name.length;i++)n+=name.charCodeAt(i);return 8+(n%15);
  }
  function boxcountStoreMonthQty(name,month){
    var m=Number(month.slice(5,7)),meta=boxcountStoreMeta(name),d=['월요일','화요일','수요일','목요일','금요일'].indexOf(meta.day)+1;
    var qv=boxcountBase(name)+(m*3+d*2)%18;
    if(meta.note.indexOf('격주')>=0||meta.note.indexOf('주차')>=0)qv=Math.max(4,Math.round(qv*.55));
    return qv;
  }
  function boxcountMonthStats(month){
    var stores=boxcountAllStores(),total=0,top='-',topQty=0;
    stores.forEach(function(name){var qty=boxcountStoreMonthQty(name,month);total+=qty;if(qty>topQty){topQty=qty;top=name}});
    return{month:month,total:total,stores:stores.length,avg:stores.length?Math.round(total/stores.length):0,top:top,topQty:topQty};
  }
  function boxcountDraw(key,canvasId,emptyId,labels,values,datasets){
    var canvas=q('#'+canvasId),empty=q('#'+emptyId);if(!canvas)return;
    var has=(datasets||[{data:values}]).some(function(ds){return(ds.data||[]).some(function(v){return Number(v)>0})});if(empty)empty.style.display=has?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(function(){setBoxcountView('cumulative')});return}
    if(boxcountCharts[key])boxcountCharts[key].destroy();
    var sets=datasets||[{data:values,borderWidth:2,pointRadius:3,tension:.25}];
    var xTicks={autoSkip:true,maxTicksLimit:key==='detailTrend'?(labels.length<=14?labels.length:labels.length<=45?10:12):12};
    boxcountCharts[key]=new Chart(canvas,{type:'line',data:{labels:labels,datasets:sets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:sets.length>1,position:'bottom'},tooltip:{callbacks:key==='detailTrend'?{title:function(items){return items&&items[0]?labels[items[0].dataIndex]:''},label:function(ctx){return fmt(ctx.raw)+' BOX'}}:{}}},scales:{y:{beginAtZero:true,grid:{color:'#eeeeea'}},x:{grid:{display:false},ticks:xTicks}}}});
  }
  function boxcountDrawDonut(key,canvasId,emptyId,labels,values){
    var canvas=q('#'+canvasId),empty=q('#'+emptyId);if(!canvas)return;
    var has=values.some(function(v){return Number(v)>0});if(empty)empty.style.display=has?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(function(){});return}
    if(boxcountCharts[key])boxcountCharts[key].destroy();
    var palette=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8','#b8ada0','#8ca7a0','#c7b784'];
    boxcountCharts[key]=new Chart(canvas,{type:'doughnut',data:{labels:labels,datasets:[{data:values,backgroundColor:labels.map(function(_,i){return palette[i%palette.length]}),borderWidth:2,borderColor:'#fff',hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:8,boxHeight:8,usePointStyle:true,font:{size:10}}}}}});
  }
  function boxcountPct(diff,base){
    if(!base)return diff>0?100:diff<0?-100:0;
    return Math.round(diff/base*1000)/10;
  }
  function boxcountSigned(n,suffix){
    n=Number(n)||0;return(n>0?'+':'')+fmt(n)+(suffix||'');
  }
  function boxcountRadialHtml(name,value,total,color){
    var pct=total?Math.max(0,Math.min(100,value/total*100)):0;
    return '<div class="boxcount-radial-item">'+
      '<div class="boxcount-radial-gauge" style="--radial:'+pct.toFixed(1)+'%;--radial-color:'+color+'"><div><b>'+pct.toFixed(1)+'%</b><small>'+fmt(value)+' BOX</small></div></div>'+
      '<strong>'+esc(name)+'</strong>'+
    '</div>';
  }
  function boxcountArcGradient(rows,grand){
    var palette=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8'],deg=0,stops=[];
    rows.forEach(function(x,i){
      var span=grand?x.total/grand*180:0,next=deg+span;
      stops.push(palette[i]+' '+deg.toFixed(2)+'deg '+next.toFixed(2)+'deg');deg=next;
    });
    if(deg<180)stops.push('#ecece8 '+deg.toFixed(2)+'deg 180deg');
    stops.push('transparent 180deg 360deg');
    return{gradient:'conic-gradient(from 270deg,'+stops.join(',')+')',colors:palette};
  }
  function boxcountDrawWeekdayDonut(labels,values){
    var canvas=q('#boxWeekdayDonut'),empty=q('#boxWeekdayDonutEmpty');if(!canvas)return;
    var total=values.reduce(function(a,b){return a+(Number(b)||0)},0),has=total>0;
    if(empty)empty.style.display=has?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(function(){renderBoxcountWeekday()});return}
    if(boxcountCharts.weekdayDonut)boxcountCharts.weekdayDonut.destroy();
    var palette=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8'];
    var directLabelPlugin={
      id:'boxcountWeekdayDirectLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx,meta=chart.getDatasetMeta(0),sum=chart.data.datasets[0].data.reduce(function(a,b){return a+(Number(b)||0)},0);
        ctx.save();
        meta.data.forEach(function(arc,i){
          var v=Number(chart.data.datasets[0].data[i])||0,pct=sum?(v/sum*100):0;
          if(pct<3)return;
          var p=arc.tooltipPosition(),label=chart.data.labels[i]+' '+pct.toFixed(1)+'%';
          ctx.font='700 11px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.95)';ctx.strokeText(label,p.x,p.y);
          ctx.fillStyle='#1f2421';ctx.fillText(label,p.x,p.y);
        });
        ctx.restore();
      }
    };
    boxcountCharts.weekdayDonut=new Chart(canvas,{type:'pie',data:{labels:labels,datasets:[{data:values,backgroundColor:labels.map(function(_,i){return palette[i%palette.length]}),borderWidth:3,borderColor:'#fff',hoverOffset:5}]},plugins:[directLabelPlugin],options:{responsive:true,maintainAspectRatio:false,layout:{padding:14},plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){var v=Number(ctx.raw)||0,pct=total?(v/total*100):0;return ctx.label+' · '+fmt(v)+' BOX · '+pct.toFixed(1)+'%'}}}}}});
  }
  function boxcountRankRows(rows,mode){
    if(!rows.length)return '<div class="data-empty">데이터가 없습니다.</div>';
    return rows.map(function(x,i){
      var extra=x.extra||'';
      return '<button type="button" class="boxcount-rank-row '+(x.tone?('is-'+x.tone+' '):'')+(x.store?'box-store-detail-link':'')+'" '+(x.store?'data-store-detail="'+esc(x.store)+'"':'')+'><span class="boxcount-rank-no">'+(i+1)+'</span><b>'+esc(x.name)+'</b><strong>'+esc(x.value)+'</strong>'+(extra?'<small>'+esc(extra)+'</small>':'')+'</button>';
    }).join('');
  }
  function bindStoreDetailLinks(root){
    qa('.box-store-detail-link',root||document).forEach(function(btn){btn.onclick=function(){var name=btn.dataset.storeDetail;if(name){boxStoreDetailReturnY=window.scrollY;renderBoxStoreDetail(name)}}});
  }

  function renderBoxcountCumulative(){
    var months=boxcountMonths(),stats=months.map(boxcountMonthStats),stores=boxcountAllStores(),total=stats.reduce(function(a,x){return a+x.total},0),top='-',topQty=0,storeTotals={};
    stores.forEach(function(name){storeTotals[name]=months.reduce(function(a,m){return a+boxcountStoreMonthQty(name,m)},0);if(storeTotals[name]>topQty){topQty=storeTotals[name];top=name}});
    var label=boxcountPeriodText(boxcountPeriod,boxcountViewMode);
    q('#boxcountPeriodLabel').textContent=label+' · 월별 누계';q('#boxcountChartHint').textContent=label+' · BOX';q('#boxcountTableHint').textContent=label+' · 월별 누계';
    q('#boxcountTotal').textContent=fmt(total);q('#boxcountStores').textContent=fmt(stores.length);q('#boxcountAvg').textContent=fmt(stores.length?Math.round(total/stores.length):0);q('#boxcountTopStore').textContent=top;q('#boxcountTopValue').textContent=fmt(topQty)+' BOX';
    q('#boxcountMonthBody').innerHTML=stats.map(function(x){return '<tr><td>'+x.month.replace('-','.')+'</td><td>'+fmt(x.total)+'</td><td>'+fmt(x.stores)+'</td><td>'+fmt(x.avg)+'</td></tr>'}).join('')||'<tr><td colspan="4" class="data-empty">데이터가 없습니다.</td></tr>';
    boxcountDraw('cumulative','boxcountMonthChart','boxcountMonthEmpty',stats.map(function(x){return x.month.replace('-','.')}),stats.map(function(x){return x.total}));
  }

  function boxcountDayMonthQty(day,month){
    var schedule=BOXCOUNT_SCHEDULE[day]||{},total=0;
    Object.keys(schedule).forEach(function(route){(schedule[route]||[]).forEach(function(x){total+=boxcountStoreMonthQty(x.name,month)})});
    return total;
  }
  function renderBoxcountWeekday(){
    var months=boxcountMonthsFor(boxWeekdayPeriod,boxWeekdayViewMode),days=Object.keys(BOXCOUNT_SCHEDULE),routes=['1호차','2호차','3호차','4호차','택배'],label=boxcountPeriodText(boxWeekdayPeriod,boxWeekdayViewMode);
    q('#boxWeekdayPeriodLabel').textContent=label+' · 요일별 운영 패턴';q('#boxWeekdayDonutHint').textContent=label+' · BOX';
    var rows=days.map(function(day){
      var vals=months.map(function(m){return boxcountDayMonthQty(day,m)}),total=vals.reduce(function(a,b){return a+b},0),avg=vals.length?Math.round(total/vals.length):0,max=vals.length?Math.max.apply(null,vals):0,min=vals.length?Math.min.apply(null,vals):0;
      return{day:day,vals:vals,total:total,avg:avg,range:max-min};
    });
    var weekdayGrand=rows.reduce(function(a,x){return a+x.total},0),weekdayColors=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8'];
    q('#boxWeekdayRadialGrid').innerHTML=rows.length?rows.map(function(x,i){return boxcountRadialHtml(x.day.replace('요일',''),x.total,weekdayGrand,weekdayColors[i%weekdayColors.length])}).join(''):'<div class="data-empty">박스 데이터가 없습니다.</div>';
    var ordered=rows.slice().sort(function(a,b){return b.total-a.total}),max=ordered[0]||{},min=ordered[ordered.length-1]||{},avgMax=rows.slice().sort(function(a,b){return b.avg-a.avg})[0]||{},vol=rows.slice().sort(function(a,b){return b.range-a.range})[0]||{};
    q('#boxWeekdayMaxDay').textContent=max.day||'-';q('#boxWeekdayMaxQty').textContent=fmt(max.total||0)+' BOX';
    q('#boxWeekdayMinDay').textContent=min.day||'-';q('#boxWeekdayMinQty').textContent=fmt(min.total||0)+' BOX';
    q('#boxWeekdayMaxAvgDay').textContent=avgMax.day||'-';q('#boxWeekdayMaxAvg').textContent=fmt(avgMax.avg||0)+' BOX';
    q('#boxWeekdayVolatileDay').textContent=vol.day||'-';q('#boxWeekdayVolatileValue').textContent='변동폭 '+fmt(vol.range||0)+' BOX';
    q('#boxWeekdayAvgList').innerHTML=boxcountRankRows(rows.slice().sort(function(a,b){return b.avg-a.avg}).map(function(x){return{name:x.day,value:fmt(x.avg)+' BOX'}}));

    var routeRows=[];
    days.forEach(function(day){routes.forEach(function(route){var stores=(BOXCOUNT_SCHEDULE[day]||{})[route]||[];if(!stores.length)return;var total=stores.reduce(function(sum,x){return sum+months.reduce(function(t,m){return t+boxcountStoreMonthQty(x.name,m)},0)},0);routeRows.push({day:day,route:route,stores:stores.length,total:total})})});
    routeRows.sort(function(a,b){return b.total-a.total});
    q('#boxWeekdayRouteList').innerHTML=boxcountRankRows(routeRows.slice(0,5).map(function(x){return{name:x.day.replace('요일','')+' · '+x.route,value:fmt(x.total)+' BOX',extra:fmt(x.stores)+'개 매장'}}));
    q('#boxWeekdayRouteBody').innerHTML=rows.map(function(x){var storeSet={};var schedule=BOXCOUNT_SCHEDULE[x.day]||{};Object.keys(schedule).forEach(function(route){(schedule[route]||[]).forEach(function(s){storeSet[s.name]=true})});return '<tr><td>'+x.day+'</td><td>'+fmt(Object.keys(storeSet).length)+'</td><td>'+fmt(x.total)+'</td><td>'+fmt(x.avg)+'</td></tr>'}).join('')||'<tr><td colspan="4" class="data-empty">데이터가 없습니다.</td></tr>';

    var latest=months[months.length-1]||today.slice(0,7),prev=boxcountPrevMonth(latest),changes=days.map(function(day){var cur=boxcountDayMonthQty(day,latest),old=boxcountDayMonthQty(day,prev),diff=cur-old,pct=boxcountPct(diff,old);return{day:day,cur:cur,old:old,diff:diff,pct:pct}});
    var inc=changes.slice().sort(function(a,b){return b.pct-a.pct})[0]||{},dec=changes.slice().sort(function(a,b){return a.pct-b.pct})[0]||{},curTotal=changes.reduce(function(a,x){return a+x.cur},0),oldTotal=changes.reduce(function(a,x){return a+x.old},0),totalPct=boxcountPct(curTotal-oldTotal,oldTotal);
    q('#boxWeekdayChangeHint').textContent=latest.replace('-','.')+' vs '+prev.replace('-','.');
    q('#boxWeekdayIncrease').textContent=inc.day||'-';q('#boxWeekdayIncreaseValue').textContent=boxcountSigned(inc.pct||0,'%');
    q('#boxWeekdayDecrease').textContent=dec.day||'-';q('#boxWeekdayDecreaseValue').textContent=boxcountSigned(dec.pct||0,'%');
    q('#boxWeekdayTotalChange').textContent=boxcountSigned(totalPct,'%');

    var sets=days.map(function(day){var r=rows.find(function(x){return x.day===day});return{label:day.replace('요일',''),data:r?r.vals:[],borderWidth:2,pointRadius:2,tension:.25,fill:false}});
    boxcountDraw('weekday','boxWeekdayChart','boxWeekdayEmpty',months.map(function(m){return m.replace('-','.')}),[],sets);
  }

  function renderBoxcountStore(){
    var months=boxcountMonthsFor(boxStorePeriod,boxStoreViewMode),stores=boxcountAllStores(),label=boxcountPeriodText(boxStorePeriod,boxStoreViewMode),grand=0;
    q('#boxStorePeriodLabel').textContent=label+' · 전체 매장 비교';
    var totals=stores.map(function(name){var total=months.reduce(function(a,m){return a+boxcountStoreMonthQty(name,m)},0);grand+=total;return{name:name,total:total,meta:boxcountStoreMeta(name)}});
    totals.sort(function(a,b){return b.total-a.total});
    var top5=totals.slice(0,5),bottom5=totals.slice().sort(function(a,b){return a.total-b.total}).slice(0,5),other=Math.max(0,grand-top5.reduce(function(a,x){return a+x.total},0));
    var arc=boxcountArcGradient(top5,grand),top5Total=top5.reduce(function(a,x){return a+x.total},0),top5Pct=grand?(top5Total/grand*100):0,otherPct=Math.max(0,100-top5Pct);
    q('#boxStoreArcRing').style.background=arc.gradient;
    q('#boxStoreTop5Share').textContent=top5Pct.toFixed(1)+'%';
    q('#boxStoreOtherShare').textContent=otherPct.toFixed(1)+'%';
    q('#boxStoreArcRanking').innerHTML=top5.map(function(x,i){var pct=grand?(x.total/grand*100):0;return '<div class="boxcount-arc-rank"><span class="boxcount-arc-dot" style="background:'+arc.colors[i]+'"></span><b>'+esc(x.name)+'</b><strong>'+pct.toFixed(1)+'%</strong><small>'+fmt(x.total)+' BOX</small></div>'}).join('');
    q('#boxStoreTopList').innerHTML=boxcountRankRows(top5.map(function(x){return{name:x.name,value:fmt(x.total)+' BOX',store:x.name}}));
    q('#boxStoreBottomList').innerHTML=boxcountRankRows(bottom5.map(function(x){return{name:x.name,value:fmt(x.total)+' BOX',store:x.name}}));

    var latest=months[months.length-1]||today.slice(0,7),prev=boxcountPrevMonth(latest);
    var changes=stores.map(function(name){var cur=boxcountStoreMonthQty(name,latest),old=boxcountStoreMonthQty(name,prev),diff=cur-old,pct=boxcountPct(diff,old);return{name:name,cur:cur,old:old,diff:diff,pct:pct,meta:boxcountStoreMeta(name)}});
    var inc=changes.filter(function(x){return x.diff>0}).sort(function(a,b){return b.pct-a.pct||b.diff-a.diff}).slice(0,5),dec=changes.filter(function(x){return x.diff<0}).sort(function(a,b){return a.pct-b.pct||a.diff-b.diff}).slice(0,5);
    q('#boxStoreIncreaseHint').textContent=latest.replace('-','.')+' vs '+prev.replace('-','.');
    q('#boxStoreDecreaseHint').textContent=latest.replace('-','.')+' vs '+prev.replace('-','.');
    q('#boxStoreIncreaseList').innerHTML=boxcountRankRows(inc.map(function(x){return{name:x.name,value:boxcountSigned(x.pct,'%'),extra:boxcountSigned(x.diff,' BOX'),store:x.name,tone:'up'}}));
    q('#boxStoreDecreaseList').innerHTML=boxcountRankRows(dec.map(function(x){return{name:x.name,value:boxcountSigned(x.pct,'%'),extra:boxcountSigned(x.diff,' BOX'),store:x.name,tone:'down'}}));
    var highest=totals[0],maxInc=inc[0],maxDec=dec[0];
    q('#boxStoreHighestShare').textContent=highest?highest.name:'-';q('#boxStoreHighestShareValue').textContent=highest&&grand?((highest.total/grand*100).toFixed(1)+'%'):'-';
    q('#boxStoreMaxIncrease').textContent=maxInc?maxInc.name:'-';q('#boxStoreMaxIncreaseValue').textContent=maxInc?boxcountSigned(maxInc.pct,'%'):'-';
    q('#boxStoreMaxDecrease').textContent=maxDec?maxDec.name:'-';q('#boxStoreMaxDecreaseValue').textContent=maxDec?boxcountSigned(maxDec.pct,'%'):'-';

    q('#boxStoreCompareHint').textContent=label+' · '+fmt(stores.length)+'개 매장';
    var compareRows=totals.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ko')});
    function renderStoreCompareRows(){
      var keyword=(q('#boxStoreCompareSearch')?q('#boxStoreCompareSearch').value:'').trim().toLowerCase();
      var filtered=keyword?compareRows.filter(function(x){return x.name.toLowerCase().includes(keyword)}):compareRows;
      q('#boxStoreCompareBody').innerHTML=filtered.map(function(x){var share=grand?(x.total/grand*100).toFixed(1):'0.0';return '<tr><td>'+esc(x.name)+'</td><td>'+esc(x.meta.day)+'</td><td>'+esc(x.meta.route)+'</td><td>'+fmt(x.total)+'</td><td>'+share+'%</td><td><button type="button" class="btn sm box-store-detail-link" data-store-detail="'+esc(x.name)+'">상세보기</button></td></tr>'}).join('')||'<tr><td colspan="6" class="data-empty">검색 결과가 없습니다.</td></tr>';
      bindStoreDetailLinks(q('#boxStoreComparePanel'));
    }
    renderStoreCompareRows();
    if(q('#boxStoreCompareSearch'))q('#boxStoreCompareSearch').oninput=renderStoreCompareRows;
    q('#boxStoreComparePanel').hidden=!boxStoreCompareOpen;
    q('#boxStoreCompareToggle').innerHTML='<span>'+(boxStoreCompareOpen?'전체 매장 비교 닫기':'전체 매장 비교 조회')+'</span><b aria-hidden="true">'+(boxStoreCompareOpen?'⌃':'⌄')+'</b>';
    bindStoreDetailLinks(q('[data-boxcount-section="store"]'));
  }

  function boxcountActualStoreRows(name,months){
    var allowed={};months.forEach(function(m){allowed[m]=true});
    try{return boxRows().map(function(r){var date=normDate(r[0]||''),store=String(r[3]||'');return{date:date,day:(r[1]||weekday(date))+'요일',store:store,qty:Number(r[4])||0}}).filter(function(r){return r.store===name&&allowed[r.date.slice(0,7)]&&r.qty>0})}catch(e){return[]}
  }
  function renderBoxStoreDetail(name){
    var months=boxcountMonthsFor(boxStorePeriod,boxStoreViewMode),meta=boxcountStoreMeta(name),vals=months.map(function(m){return boxcountStoreMonthQty(name,m)}),total=vals.reduce(function(a,b){return a+b},0),avg=vals.length?Math.round(total/vals.length):0,max=vals.length?Math.max.apply(null,vals):0,maxI=vals.indexOf(max),actual=boxcountActualStoreRows(name,months);
    q('#boxStoreDetailPanel').hidden=false;q('#boxStoreDetailTitle').textContent=name+' 상세';q('#boxStoreDetailMeta').textContent=meta.day+' · '+meta.route+' · '+meta.note+' · '+boxcountPeriodText(boxStorePeriod,boxStoreViewMode);
    q('#boxStoreDetailSummary').innerHTML='<div><span>총 박스수</span><b>'+fmt(total)+' BOX</b></div><div><span>월 평균</span><b>'+fmt(avg)+' BOX</b></div><div><span>최고 월</span><b>'+(months[maxI]?months[maxI].replace('-','.'):'-')+'</b></div><div><span>실제 출고 이력</span><b>'+fmt(actual.length)+'건</b></div>';
    q('#boxStoreHistoryBody').innerHTML=actual.length?actual.sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(r){return '<tr><td>'+r.date+'</td><td>'+r.day+'</td><td>'+meta.route+'</td><td>'+fmt(r.qty)+'</td></tr>'}).join(''):'<tr><td colspan="4" class="data-empty">등록된 실제 출고 이력이 없습니다.</td></tr>';
    boxcountDraw('storeDetail','boxStoreDetailChart','boxStoreDetailEmpty',months.map(function(m){return m.replace('-','.')}),vals);
    q('#boxStoreDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function updateBoxDetailRouteOptions(){
    var dDay=q('#boxDetailDay'),dRoute=q('#boxDetailRoute');if(!dRoute)return;
    var day=dDay?dDay.value:'',routes=['1호차','2호차','3호차','4호차','택배'],current=dRoute.value;
    if(day){routes=routes.filter(function(r){return((BOXCOUNT_SCHEDULE[day]||{})[r]||[]).length})}
    dRoute.innerHTML='<option value="">전체 호차</option>'+routes.map(function(x){return '<option value="'+x+'">'+x+'</option>'}).join('');
    if(current&&routes.indexOf(current)>=0)dRoute.value=current;
  }
  function updateBoxDetailStoreOptions(){
    var dDay=q('#boxDetailDay'),dRoute=q('#boxDetailRoute'),dStore=q('#boxDetailStore');if(!dStore)return;
    var day=dDay?dDay.value:'',route=dRoute?dRoute.value:'',set={};
    Object.keys(BOXCOUNT_SCHEDULE).forEach(function(dayName){
      if(day&&dayName!==day)return;
      Object.keys(BOXCOUNT_SCHEDULE[dayName]).forEach(function(routeName){
        if(route&&routeName!==route)return;
        (BOXCOUNT_SCHEDULE[dayName][routeName]||[]).forEach(function(x){set[x.name]=true});
      });
    });
    var current=dStore.value,stores=Object.keys(set).sort();
    dStore.innerHTML='<option value="">전체 매장</option>'+stores.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');
    if(current&&stores.indexOf(current)>=0)dStore.value=current;
  }
  function initBoxcountFilters(){
    var days=Object.keys(BOXCOUNT_SCHEDULE),dDay=q('#boxDetailDay');
    var keepDetailDay=dDay?dDay.value:'';
    if(dDay){dDay.innerHTML='<option value="">전체 요일</option>'+days.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');if(days.indexOf(keepDetailDay)>=0)dDay.value=keepDetailDay}
    updateBoxDetailRouteOptions();updateBoxDetailStoreOptions();
    if(dDay)dDay.onchange=function(){updateBoxDetailRouteOptions();updateBoxDetailStoreOptions()};
    if(q('#boxDetailRoute'))q('#boxDetailRoute').onchange=updateBoxDetailStoreOptions;
  }
  function setBoxcountView(view){
    qa('.boxcount-subtab').forEach(function(b){b.classList.toggle('active',b.dataset.boxcountView===view)});
    qa('.boxcount-section').forEach(function(p){p.classList.toggle('active',p.dataset.boxcountSection===view)});
    if(view==='cumulative')renderBoxcountCumulative();
    if(view==='monthly')renderBoxcountMonthly();
    if(view==='weekday')renderBoxcountWeekday();
    if(view==='store')renderBoxcountStore();
    if(view==='settings')renderBoxcountSettings();
    if(view==='manual')renderBoxcountManual();
  }
  qa('.boxcount-subtab').forEach(function(b){b.addEventListener('click',function(){setBoxcountView(b.dataset.boxcountView)})});

  function boxMonthlyRankHtml(rows,valueFn){
    return rows.map(function(x,i){return '<div><b>'+(i+1)+'</b><span>'+esc(x.name||'-')+'</span><strong>'+esc(valueFn(x))+'</strong></div>'}).join('')||'<div class="data-empty">데이터가 없습니다.</div>';
  }
  function renderBoxcountMonthly(){
    var base=q('#boxMonthlyBase');if(!base)return;if(!base.value)base.value=today.slice(0,7);
    var cmp=q('#boxMonthlyCompare');if(!cmp.value)cmp.value=boxcountPrevMonth(base.value);
    var stores=boxcountAllStores(),cur=stores.map(function(name){return{name:name,value:boxcountStoreMonthQty(name,base.value)}}).filter(function(x){return x.value>0}),old={};stores.forEach(function(name){old[name]=boxcountStoreMonthQty(name,cmp.value)});
    var total=cur.reduce(function(a,x){return a+x.value},0),oldTotal=stores.reduce(function(a,n){return a+(old[n]||0)},0),avg=cur.length?Math.round(total/cur.length):0,top=cur.slice().sort(function(a,b){return b.value-a.value})[0],delta=oldTotal?((total-oldTotal)/oldTotal*100):0;
    q('#boxMonthlyTotal').textContent=fmt(total);q('#boxMonthlyStores').textContent=fmt(cur.length);q('#boxMonthlyAvg').textContent=fmt(avg);q('#boxMonthlyTopStore').textContent=top?top.name:'-';q('#boxMonthlyTopQty').textContent=fmt(top?top.value:0)+' BOX';q('#boxMonthlyDelta').textContent=(delta>0?'+':'')+delta.toFixed(1);q('#boxMonthlyCompareLabel').textContent=base.value+' vs '+cmp.value;
    var top5=cur.slice().sort(function(a,b){return b.value-a.value}).slice(0,5),bottom5=cur.slice().sort(function(a,b){return a.value-b.value}).slice(0,5);
    q('#boxMonthlyTop').innerHTML=boxMonthlyRankHtml(top5.map(function(x){return{name:x.name,value:x.value}}),function(x){return fmt(x.value)+' BOX'});
    q('#boxMonthlyBottom').innerHTML=boxMonthlyRankHtml(bottom5.map(function(x){return{name:x.name,value:x.value}}),function(x){return fmt(x.value)+' BOX'});
    var days=Object.keys(BOXCOUNT_SCHEDULE),dayVals=days.map(function(day){return{name:day,value:boxcountDayMonthQty(day,base.value)}}),dayTotal=dayVals.reduce(function(a,x){return a+x.value},0),colors=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8'];
    q('#boxMonthlyWeekday').innerHTML=dayVals.map(function(x,i){return boxcountRadialHtml(x.name.replace('요일',''),x.value,dayTotal,colors[i%colors.length])}).join('');
    var changes=stores.map(function(name){var a=boxcountStoreMonthQty(name,base.value),b=boxcountStoreMonthQty(name,cmp.value),diff=a-b,pct=b?diff/b*100:0;return{name:name,a:a,b:b,diff:diff,pct:pct}}).filter(function(x){return x.a>0&&x.b>0});
    var inc=changes.filter(function(x){return x.diff>0}).sort(function(a,b){return b.pct-a.pct}).slice(0,5),dec=changes.filter(function(x){return x.diff<0}).sort(function(a,b){return a.pct-b.pct}).slice(0,5),lab=base.value+' vs '+cmp.value;
    q('#boxMonthlyIncreaseHint').textContent=lab;q('#boxMonthlyDecreaseHint').textContent=lab;
    q('#boxMonthlyIncrease').innerHTML=boxMonthlyRankHtml(inc,function(x){return '+'+x.pct.toFixed(1)+'% / +'+fmt(x.diff)+' BOX'});
    q('#boxMonthlyDecrease').innerHTML=boxMonthlyRankHtml(dec,function(x){return x.pct.toFixed(1)+'% / '+fmt(x.diff)+' BOX'});
  }
  if(q('#boxMonthlyRun'))q('#boxMonthlyRun').addEventListener('click',renderBoxcountMonthly);

  function applyMonthFilter(startId,endId,period,modeSetter,render){
    var s1=q('#'+startId).value||'',e=q('#'+endId).value||'';
    if(s1&&e&&s1>e){var t=s1;s1=e;e=t;q('#'+startId).value=s1;q('#'+endId).value=e}
    period.start=s1;period.end=e;modeSetter(s1||e?'custom':'year');render();
  }
  if(q('#boxcountPeriodSearch'))q('#boxcountPeriodSearch').addEventListener('click',function(){applyMonthFilter('boxcountStartMonth','boxcountEndMonth',boxcountPeriod,function(v){boxcountViewMode=v},renderBoxcountCumulative)});
  if(q('#boxcountAll'))q('#boxcountAll').addEventListener('click',function(){q('#boxcountStartMonth').value='';q('#boxcountEndMonth').value='';boxcountPeriod={start:'',end:''};boxcountViewMode='all';renderBoxcountCumulative()});
  if(q('#boxWeekdaySearch'))q('#boxWeekdaySearch').addEventListener('click',function(){applyMonthFilter('boxWeekdayStartMonth','boxWeekdayEndMonth',boxWeekdayPeriod,function(v){boxWeekdayViewMode=v},renderBoxcountWeekday)});
  if(q('#boxWeekdayAll'))q('#boxWeekdayAll').addEventListener('click',function(){q('#boxWeekdayStartMonth').value='';q('#boxWeekdayEndMonth').value='';boxWeekdayPeriod={start:'',end:''};boxWeekdayViewMode='all';renderBoxcountWeekday()});
  if(q('#boxStoreSearch'))q('#boxStoreSearch').addEventListener('click',function(){applyMonthFilter('boxStoreStartMonth','boxStoreEndMonth',boxStorePeriod,function(v){boxStoreViewMode=v},renderBoxcountStore)});
  if(q('#boxStoreAll'))q('#boxStoreAll').addEventListener('click',function(){q('#boxStoreStartMonth').value='';q('#boxStoreEndMonth').value='';boxStorePeriod={start:'',end:''};boxStoreViewMode='all';renderBoxcountStore()});
  if(q('#boxStoreCompareToggle'))q('#boxStoreCompareToggle').addEventListener('click',function(){boxStoreCompareOpen=!boxStoreCompareOpen;renderBoxcountStore();if(boxStoreCompareOpen)q('#boxStoreComparePanel').scrollIntoView({behavior:'smooth',block:'nearest'})});
  if(q('#boxStoreDetailClose'))q('#boxStoreDetailClose').addEventListener('click',function(){
    q('#boxStoreDetailPanel').hidden=true;
    if(boxStoreDetailReturnY!=null){var y=boxStoreDetailReturnY;boxStoreDetailReturnY=null;requestAnimationFrame(function(){window.scrollTo({top:y,behavior:'smooth'})})}
  });

  function boxcountGenerateDetailRows(start,end,dayFilter,routeFilter,storeFilter){
    var actual=[];
    try{
      actual=boxRows().map(function(r){var date=normDate(r[0]||''),store=String(r[3]||''),meta=boxcountStoreMeta(store),dayLong=meta.day!=='-'?meta.day:((r[1]||weekday(date))+'요일');return{date:date,day:dayLong,route:meta.route,store:store,qty:Number(r[4])||0,note:meta.note}}).filter(function(r){return r.date>=start&&r.date<=end&&r.qty>0&&(!dayFilter||r.day===dayFilter)&&(!routeFilter||r.route===routeFilter)&&(!storeFilter||r.store===storeFilter)})}
    catch(e){}
    if(actual.length)return actual.sort(function(a,b){return b.date.localeCompare(a.date)});
    var rows=[],days=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    for(var d=new Date(start+'T00:00:00'),last=new Date(end+'T00:00:00');d<=last;d.setDate(d.getDate()+1)){
      var day=days[d.getDay()];if(!BOXCOUNT_SCHEDULE[day])continue;if(dayFilter&&day!==dayFilter)continue;
      Object.keys(BOXCOUNT_SCHEDULE[day]).forEach(function(route){if(routeFilter&&route!==routeFilter)return;(BOXCOUNT_SCHEDULE[day][route]||[]).forEach(function(x){if(storeFilter&&x.name!==storeFilter)return;var dt=dateKey(d),qty=Math.max(1,Math.round(boxcountStoreMonthQty(x.name,dt.slice(0,7))/4));rows.push({date:dt,day:day,route:route,store:x.name,qty:qty,note:x.note||'매주'})})});
      if(rows.length>260)break;
    }
    return rows.sort(function(a,b){return b.date.localeCompare(a.date)});
  }
  function renderBoxcountDetail(){
    var start=q('#boxDetailStart').value||'',end=q('#boxDetailEnd').value||'',dayFilter=q('#boxDetailDay').value||'',routeFilter=q('#boxDetailRoute').value||'',storeFilter=q('#boxDetailStore').value||'';
    if(!start||!end){if(typeof toastMsg==='function')toastMsg('시작일과 종료일을 선택해주세요.');return}
    if(start>end){var t=start;start=end;end=t;q('#boxDetailStart').value=start;q('#boxDetailEnd').value=end}
    var rows=boxcountGenerateDetailRows(start,end,dayFilter,routeFilter,storeFilter),total=rows.reduce(function(a,r){return a+r.qty},0),stores=new Set(rows.map(function(r){return r.store})).size;
    var grouped={};rows.forEach(function(r){if(!grouped[r.date])grouped[r.date]={date:r.date,day:r.day,qty:0,rows:[]};grouped[r.date].qty+=r.qty;grouped[r.date].rows.push(r)});
    var dayRows=Object.keys(grouped).sort().map(function(k){return grouped[k]}),avg=dayRows.length?Math.round(total/dayRows.length):0;
    q('#boxDetailTotal').textContent=fmt(total);q('#boxDetailCount').textContent=fmt(dayRows.length);q('#boxDetailStores').textContent=fmt(stores);q('#boxDetailAvg').textContent=fmt(avg);
    q('#boxDetailResultLabel').textContent=start+' ~ '+end+' · '+fmt(dayRows.length)+'일';
    var dates=dayRows.map(function(r){return r.date});
    q('#boxDetailTrendHint').textContent=start+' ~ '+end;
    boxcountDraw('detailTrend','boxDetailTrendChart','boxDetailTrendEmpty',dates,dates.map(function(d){return grouped[d].qty}));
    var byRoute={};rows.forEach(function(r){byRoute[r.route]=(byRoute[r.route]||0)+r.qty});
    var routeNames=Object.keys(byRoute).sort(function(a,b){return byRoute[b]-byRoute[a]}),routeTotal=routeNames.reduce(function(a,r){return a+byRoute[r]},0),routeColors=['#2f6f62','#6e9f8f','#d2a86d','#bd765f','#7b86a8'];
    q('#boxDetailRouteRadialGrid').innerHTML=routeNames.length?routeNames.map(function(r,i){return boxcountRadialHtml(r,byRoute[r],routeTotal,routeColors[i%routeColors.length])}).join(''):'<div class="data-empty">조회 결과가 없습니다.</div>';
    q('#boxDetailBody').innerHTML=dayRows.map(function(r,i){return '<tr><td>'+r.date+'</td><td>'+r.day+'</td><td>'+fmt(r.qty)+'</td><td><button type="button" class="btn sm box-detail-view" data-box-detail="'+i+'">상세보기</button></td></tr>'}).join('')||'<tr><td colspan="4" class="data-empty">조회 결과가 없습니다.</td></tr>';
    qa('.box-detail-view',q('#boxDetailBody')).forEach(function(btn){btn.onclick=function(){
      var dayRow=dayRows[Number(btn.dataset.boxDetail)],detailMap={};
      dayRow.rows.forEach(function(r){var key=r.route+'|'+r.store;if(!detailMap[key])detailMap[key]={route:r.route,store:r.store,qty:0};detailMap[key].qty+=r.qty});
      var detailRows=Object.keys(detailMap).map(function(k){return detailMap[k]}).sort(function(a,b){var rc=a.route.localeCompare(b.route,'ko');return rc||a.store.localeCompare(b.store,'ko')});
      q('#boxDetailExpandedTitle').textContent=dayRow.date+' · '+dayRow.day+' · '+fmt(dayRow.qty)+' BOX';
      q('#boxDetailExpandedBody').innerHTML='<div class="boxcount-expanded-table"><table class="status-data-table"><thead><tr><th>호차</th><th>매장</th><th>박스수</th></tr></thead><tbody>'+detailRows.map(function(r){return '<tr><td>'+esc(r.route)+'</td><td>'+esc(r.store)+'</td><td>'+fmt(r.qty)+'</td></tr>'}).join('')+'</tbody></table></div>';
      boxDetailExpandedReturnY=window.scrollY;
      q('#boxDetailExpanded').hidden=false;q('#boxDetailExpanded').scrollIntoView({behavior:'smooth',block:'nearest'});
    }});
  }
  if(q('#boxDetailSearch'))q('#boxDetailSearch').addEventListener('click',renderBoxcountDetail);
  if(q('#boxDetailReset'))q('#boxDetailReset').addEventListener('click',function(){
    ['boxDetailStart','boxDetailEnd'].forEach(function(id){q('#'+id).value=''});q('#boxDetailDay').value='';updateBoxDetailRouteOptions();updateBoxDetailStoreOptions();
    q('#boxDetailTotal').textContent='-';q('#boxDetailCount').textContent='-';q('#boxDetailStores').textContent='-';q('#boxDetailAvg').textContent='-';q('#boxDetailResultLabel').textContent='조회 조건을 선택해주세요.';q('#boxDetailBody').innerHTML='<tr><td colspan="4" class="data-empty">조회 조건을 선택해주세요.</td></tr>';
    if(boxcountCharts.detailTrend){boxcountCharts.detailTrend.destroy();boxcountCharts.detailTrend=null}q('#boxDetailTrendEmpty').style.display='grid';q('#boxDetailRouteRadialGrid').innerHTML='<div class="data-empty">조회 조건을 선택해주세요.</div>';
  });
  if(q('#boxDetailExpandedClose'))q('#boxDetailExpandedClose').addEventListener('click',function(){
    q('#boxDetailExpanded').hidden=true;
    if(boxDetailExpandedReturnY!=null){var y=boxDetailExpandedReturnY;boxDetailExpandedReturnY=null;requestAnimationFrame(function(){window.scrollTo({top:y,behavior:'smooth'})})}
  });

  var boxSettingsEditing=null;
  function saveBoxcountSchedule(){
    boxcountWrite(BOXCOUNT_SCHEDULE_KEY,BOXCOUNT_SCHEDULE);
    initBoxcountFilters();
  }
  function resetBoxSettingsEditor(){
    boxSettingsEditing=null;
    if(q('#boxSettingsEditorTitle'))q('#boxSettingsEditorTitle').textContent='매장 추가';
    if(q('#boxSettingsEditStore'))q('#boxSettingsEditStore').value='';
    if(q('#boxSettingsEditNote'))q('#boxSettingsEditNote').value='매주';
    if(q('#boxSettingsCustomNote'))q('#boxSettingsCustomNote').value='';
    if(q('#boxSettingsCustomNoteWrap'))q('#boxSettingsCustomNoteWrap').hidden=true;
    if(q('#boxSettingsCancel'))q('#boxSettingsCancel').hidden=true;
  }
  function initBoxSettingsControls(){
    var days=Object.keys(BOXCOUNT_SCHEDULE),routes=['1호차','2호차','3호차','4호차','택배'];
    var viewDay=q('#boxSettingsDay'),editDay=q('#boxSettingsEditDay'),editRoute=q('#boxSettingsEditRoute');
    if(viewDay){
      var keep=viewDay.value||days[0];
      viewDay.innerHTML=days.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');
      viewDay.value=days.indexOf(keep)>=0?keep:days[0];
      viewDay.onchange=renderBoxcountSettings;
    }
    if(editDay){
      var keepEdit=editDay.value||days[0];
      editDay.innerHTML=days.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');
      editDay.value=days.indexOf(keepEdit)>=0?keepEdit:days[0];
    }
    if(editRoute){
      var keepRoute=editRoute.value||routes[0];
      editRoute.innerHTML=routes.map(function(x){return '<option value="'+x+'">'+x+'</option>'}).join('');
      editRoute.value=routes.indexOf(keepRoute)>=0?keepRoute:routes[0];
    }
  }
  function renderBoxcountSettings(){
    initBoxSettingsControls();
    var day=q('#boxSettingsDay')?q('#boxSettingsDay').value:'월요일',routes=['1호차','2호차','3호차','4호차','택배'],grid=q('#boxSettingsRouteGrid');if(!grid)return;
    var schedule=BOXCOUNT_SCHEDULE[day]||{};
    grid.innerHTML=routes.map(function(route){
      var stores=schedule[route]||[];
      var rows=stores.length?stores.map(function(x,index){
        return '<div class="boxcount-setting-store-row">'+
          '<div class="boxcount-setting-store-main"><b>'+esc(x.name)+'</b><small>'+esc(x.note||'매주')+'</small></div>'+
          '<div class="boxcount-setting-store-actions"><button type="button" class="btn sm" data-box-setting-edit="'+day+'|'+route+'|'+index+'">수정</button><button type="button" class="btn sm" data-box-setting-delete="'+day+'|'+route+'|'+index+'">삭제</button></div>'+
        '</div>';
      }).join(''):'<div class="boxcount-setting-empty">등록된 매장이 없습니다.</div>';
      return '<div class="table-card boxcount-setting-route-card">'+
        '<div class="status-card-title"><h3>'+route+'</h3><small>'+fmt(stores.length)+'개 매장</small></div>'+
        '<div class="boxcount-setting-store-list">'+rows+'</div>'+
        '<button type="button" class="boxcount-setting-add" data-box-setting-add="'+day+'|'+route+'">＋ 매장 추가</button>'+
      '</div>';
    }).join('');
    qa('[data-box-setting-edit]',grid).forEach(function(btn){btn.onclick=function(){
      var p=btn.dataset.boxSettingEdit.split('|'),d=p[0],r=p[1],i=Number(p[2]),item=(BOXCOUNT_SCHEDULE[d]&&BOXCOUNT_SCHEDULE[d][r]||[])[i];if(!item)return;
      boxSettingsEditing={day:d,route:r,index:i};
      q('#boxSettingsEditorTitle').textContent='배송 설정 수정';
      q('#boxSettingsEditDay').value=d;q('#boxSettingsEditRoute').value=r;q('#boxSettingsEditStore').value=item.name||'';
      var note=item.note||'매주',known=['매주','1·3주차','2·4주차','1·3주차 격주 배송'];
      if(known.indexOf(note)>=0){q('#boxSettingsEditNote').value=note;q('#boxSettingsCustomNoteWrap').hidden=true;q('#boxSettingsCustomNote').value=''}
      else{q('#boxSettingsEditNote').value='직접 입력';q('#boxSettingsCustomNoteWrap').hidden=false;q('#boxSettingsCustomNote').value=note}
      q('#boxSettingsCancel').hidden=false;
      q('#boxSettingsEditStore').focus();
    }});
    qa('[data-box-setting-delete]',grid).forEach(function(btn){btn.onclick=function(){
      var p=btn.dataset.boxSettingDelete.split('|'),d=p[0],r=p[1],i=Number(p[2]),arr=BOXCOUNT_SCHEDULE[d]&&BOXCOUNT_SCHEDULE[d][r];if(!arr||!arr[i])return;
      if(!confirm(arr[i].name+' 배송 설정을 삭제할까요?'))return;
      arr.splice(i,1);saveBoxcountSchedule();renderBoxcountSettings();if(typeof toastMsg==='function')toastMsg('배송 설정이 삭제되었습니다.');
    }});
    qa('[data-box-setting-add]',grid).forEach(function(btn){btn.onclick=function(){
      var p=btn.dataset.boxSettingAdd.split('|');resetBoxSettingsEditor();q('#boxSettingsEditDay').value=p[0];q('#boxSettingsEditRoute').value=p[1];q('#boxSettingsEditStore').focus();
    }});
  }
  if(q('#boxSettingsEditNote'))q('#boxSettingsEditNote').onchange=function(){
    q('#boxSettingsCustomNoteWrap').hidden=this.value!=='직접 입력';
    if(this.value!=='직접 입력')q('#boxSettingsCustomNote').value='';
  };
  if(q('#boxSettingsSave'))q('#boxSettingsSave').onclick=function(){
    var day=q('#boxSettingsEditDay').value,route=q('#boxSettingsEditRoute').value,name=(q('#boxSettingsEditStore').value||'').trim(),note=q('#boxSettingsEditNote').value;
    if(note==='직접 입력')note=(q('#boxSettingsCustomNote').value||'').trim();
    if(!day||!route||!name||!note){if(typeof toastMsg==='function')toastMsg('요일, 호차, 매장명, 배송 기준을 입력해주세요.');return}
    if(!BOXCOUNT_SCHEDULE[day])BOXCOUNT_SCHEDULE[day]={};
    if(!BOXCOUNT_SCHEDULE[day][route])BOXCOUNT_SCHEDULE[day][route]=[];
    if(boxSettingsEditing){
      var old=boxSettingsEditing,oldArr=BOXCOUNT_SCHEDULE[old.day]&&BOXCOUNT_SCHEDULE[old.day][old.route];
      if(oldArr&&oldArr[old.index])oldArr.splice(old.index,1);
    }
    BOXCOUNT_SCHEDULE[day][route].push({name:name,note:note==='매주'?undefined:note});
    saveBoxcountSchedule();
    if(q('#boxSettingsDay'))q('#boxSettingsDay').value=day;
    resetBoxSettingsEditor();renderBoxcountSettings();
    if(typeof toastMsg==='function')toastMsg('배송 설정이 저장되었습니다.');
  };
  if(q('#boxSettingsCancel'))q('#boxSettingsCancel').onclick=resetBoxSettingsEditor;
  if(q('#boxSettingsReset'))q('#boxSettingsReset').onclick=function(){
    if(!confirm('배송 설정을 처음 기본값으로 복원할까요?'))return;
    BOXCOUNT_SCHEDULE=JSON.parse(JSON.stringify(BOXCOUNT_DEFAULT_SCHEDULE));
    saveBoxcountSchedule();resetBoxSettingsEditor();renderBoxcountSettings();
    if(typeof toastMsg==='function')toastMsg('기본 배송 설정으로 복원되었습니다.');
  };

  function renderBoxcountManual(){
    var names=boxcountRead(BOXCOUNT_MANUAL_NAMES_KEY,[]),rows=boxcountRead(BOXCOUNT_MANUAL_ROWS_KEY,[]),sel=q('#boxManualName'),list=q('#boxManualNameList'),body=q('#boxManualBody');
    if(sel)sel.innerHTML='<option value="">고정 네임 선택</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');
    if(list)list.innerHTML=names.length?names.map(function(n){return '<span class="boxcount-name-chip">'+esc(n)+'<button type="button" data-box-name-remove="'+esc(n)+'">×</button></span>'}).join(''):'<span class="muted">등록된 고정 네임이 없습니다.</span>';
    if(body)body.innerHTML=rows.length?rows.slice().reverse().map(function(r,idx){var real=rows.length-1-idx;return '<tr><td>'+esc(r.date)+'</td><td>'+esc(r.name)+'</td><td>'+fmt(r.qty)+'</td><td>'+esc(r.memo||'-')+'</td><td><button type="button" class="btn sm" data-box-row-remove="'+real+'">삭제</button></td></tr>'}).join(''):'<tr><td colspan="5" class="data-empty">등록된 기타 박스가 없습니다.</td></tr>';
    qa('[data-box-name-remove]',list||document).forEach(function(btn){btn.onclick=function(){boxcountWrite(BOXCOUNT_MANUAL_NAMES_KEY,boxcountRead(BOXCOUNT_MANUAL_NAMES_KEY,[]).filter(function(n){return n!==btn.dataset.boxNameRemove}));renderBoxcountManual()}});
    qa('[data-box-row-remove]',body||document).forEach(function(btn){btn.onclick=function(){var arr=boxcountRead(BOXCOUNT_MANUAL_ROWS_KEY,[]),i=Number(btn.dataset.boxRowRemove);if(i>=0&&i<arr.length){arr.splice(i,1);boxcountWrite(BOXCOUNT_MANUAL_ROWS_KEY,arr);renderBoxcountManual()}}});
  }
  if(q('#boxManualNameAdd'))q('#boxManualNameAdd').addEventListener('click',function(){var input=q('#boxManualNewName'),name=(input.value||'').trim();if(!name)return;var names=boxcountRead(BOXCOUNT_MANUAL_NAMES_KEY,[]);if(names.indexOf(name)<0){names.push(name);boxcountWrite(BOXCOUNT_MANUAL_NAMES_KEY,names)}input.value='';renderBoxcountManual()});
  if(q('#boxManualSave'))q('#boxManualSave').addEventListener('click',function(){var date=q('#boxManualDate').value||'',name=q('#boxManualName').value||'',qty=Number(q('#boxManualQty').value||0),memo=(q('#boxManualMemo').value||'').trim();if(!date||!name||qty<=0){if(typeof toastMsg==='function')toastMsg('일자, 고정 네임, 박스수를 입력해주세요.');return}var rows=boxcountRead(BOXCOUNT_MANUAL_ROWS_KEY,[]);rows.push({date:date,name:name,qty:qty,memo:memo});boxcountWrite(BOXCOUNT_MANUAL_ROWS_KEY,rows);q('#boxManualQty').value='';q('#boxManualMemo').value='';renderBoxcountManual();if(typeof toastMsg==='function')toastMsg('기타 박스가 등록되었습니다.')});
  initBoxcountFilters();renderBoxcountManual();

  var shippingProgressFrame=null,shippingProgressTimer=null;
  function animateShippingProgress(target){
    target=Math.max(0,Math.min(100,Number(target)||0));
    var ring=q('#statusShippingRing'),label=q('#statusShippingPct');
    if(!ring||!label)return;
    if(shippingProgressFrame)cancelAnimationFrame(shippingProgressFrame);
    if(shippingProgressTimer)clearTimeout(shippingProgressTimer);
    ring.classList.remove('is-animating');
    ring.style.setProperty('--shipping-pct','0');
    label.textContent='0%';
    void ring.offsetWidth;
    ring.classList.add('is-animating');
    shippingProgressTimer=setTimeout(function(){
      var duration=1400,startTime=null;
      function step(ts){
        if(startTime===null)startTime=ts;
        var t=Math.min(1,(ts-startTime)/duration);
        var eased=1-Math.pow(1-t,3);
        var value=target*eased;
        ring.style.setProperty('--shipping-pct',value.toFixed(2));
        label.textContent=Math.round(value)+'%';
        if(t<1){
          shippingProgressFrame=requestAnimationFrame(step);
        }else{
          shippingProgressFrame=null;
          shippingProgressTimer=null;
          ring.style.setProperty('--shipping-pct',String(target));
          label.textContent=Math.round(target)+'%';
          ring.classList.remove('is-animating');
          ring.classList.toggle('is-complete',target>=100);
        }
      }
      shippingProgressFrame=requestAnimationFrame(step);
    },120);
  }

  function renderShipping(){
    var qty=DEMO_MODE?DEMO_SHIPPING.convertedQty:0;
    var qtyGoal=DEMO_MODE?DEMO_SHIPPING.convertedGoal:100000;
    var progress=Math.min(100,qtyGoal?qty/qtyGoal*100:0);

    animateShippingProgress(progress);

    q('#statusShipQtyGoal').textContent=fmt(qtyGoal);
    q('#statusShipQtyRemain').textContent=fmt(Math.max(0,qtyGoal-qty));

    var eta=DEMO_MODE?DEMO_SHIPPING.eta:'--:--';
    var etaNote=DEMO_MODE?'데모 처리 속도 기준':'처리 속도 데이터 연동 후 계산';
    q('#statusEta').textContent=eta;
    q('#statusEtaNote').textContent=etaNote;

    var stores=(DEMO_MODE?DEMO_STORES:[]).map(function(store,index){
      var total=Math.max(0,Number(store.total||0)),done=Math.max(0,Math.min(total,Number(store.done||0)));
      var pct=total?Math.min(100,done/total*100):0;
      return Object.assign({},store,{__order:index,__pct:pct});
    }).sort(function(a,b){
      var aDone=a.__pct>=100,bDone=b.__pct>=100;
      if(aDone!==bDone)return aDone?1:-1;
      return a.__order-b.__order;
    });
    var storeCount=q('#statusStoreCount');
    var storeList=q('#statusStoreProgressList');
    if(storeCount)storeCount.textContent=fmt(stores.length);
    if(storeList){
      storeList.innerHTML=stores.length?stores.map(function(store){
        var total=Math.max(0,Number(store.total||0)),done=Math.max(0,Math.min(total,Number(store.done||0)));
        var pct=Number(store.__pct||0);
        var state=pct>=100?'complete':pct<=0?'waiting':'active';
        var statusLabel=state==='complete'?'완료':state==='waiting'?'대기':'진행';
        return '<div class="shipping-store-row '+state+'">'+
          '<div class="shipping-store-topline">'+
            '<span class="shipping-store-name">'+esc(store.name||'-')+'</span>'+
            '<span class="shipping-store-state-wrap"><span class="shipping-store-status '+state+'">'+statusLabel+'</span><strong class="shipping-store-pct">'+Math.round(pct)+'%</strong></span>'+
          '</div>'+
          '<div class="shipping-store-inline-info"><span class="shipping-store-inline-left"><strong class="shipping-store-sku">'+fmt(store.sku||0)+' SKU</strong><span>·</span><strong>'+fmt(store.box||0)+' BOX</strong></span><span class="shipping-store-qty">'+fmt(done)+' / '+fmt(total)+' EA</span></div>'+
          '<div class="shipping-store-track"><span class="shipping-store-fill" style="width:'+pct.toFixed(1)+'%"></span></div>'+
        '</div>';
      }).join(''):'<div class="shipping-store-empty">오늘 주문 매장 데이터 연동 전입니다.</div>';
    }
  }
  function renderStatusClock(){
    var timeEl=q('#statusCurrentTime'),dateEl=q('#statusCurrentDate');if(!timeEl&&!dateEl)return;
    var now=new Date();
    if(timeEl)timeEl.textContent=pad(now.getHours())+':'+pad(now.getMinutes());
    if(dateEl){
      var weekdays=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
      dateEl.textContent=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 '+weekdays[now.getDay()];
    }
  }
  renderStatusClock();setInterval(renderStatusClock,60000);
  var prodChart=null,cumChart=null;
  function drawChart(canvasId,labels,values,holderName){
    var empty=q(holderName),has=values.some(function(v){return Number(v)>0});
    if(empty)empty.style.display=has?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(function(){if(canvasId==='prodHourChart')renderProductivity();else renderCumulative()});return null}
    var canvas=q('#'+canvasId);if(!canvas)return null;
    if(canvasId==='prodHourChart'&&prodChart)prodChart.destroy();
    if(canvasId==='cumMonthChart'&&cumChart)cumChart.destroy();
    var chart=new Chart(canvas,{type:'line',data:{labels:labels,datasets:[{label:'생산성',data:values,borderWidth:2,pointRadius:3,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#eeeeea'}},x:{grid:{display:false}}}}});
    if(canvasId==='prodHourChart')prodChart=chart;else cumChart=chart;
    return chart;
  }

  function timeToMinutes(v){if(!v||String(v).indexOf(':')<0)return null;var p=String(v).split(':');return Number(p[0])*60+Number(p[1])}
  function productiveMinutesBetween(startMin,endMin){
    if(startMin==null||endMin==null||!isFinite(startMin)||!isFinite(endMin))return 0;
    if(endMin<startMin)endMin+=1440;
    var total=Math.max(0,endMin-startMin);
    var lunchStart=12*60,lunchEnd=13*60;
    var overlap=Math.max(0,Math.min(endMin,lunchEnd)-Math.max(startMin,lunchStart));
    return Math.max(0,total-overlap);
  }
  function minutesToTime(m){if(m==null||!isFinite(m))return '-';m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)}
  function bucketActualTime(startTime,index){var start=timeToMinutes(startTime);if(start==null)return '-';var starts=[0,.5,1,2,3,4,5,6],ends=[.5,1,2,3,4,5,6,7];return minutesToTime(start+starts[index]*60)+'~'+minutesToTime(start+ends[index]*60)}
  var productivityView='today';
  function setProductivityView(name){
    productivityView=name||'today';
    qa('.productivity-subtab').forEach(function(b){b.classList.toggle('active',b.dataset.productivityView===productivityView)});
    qa('.productivity-section').forEach(function(p){p.classList.toggle('active',p.dataset.productivitySection===productivityView)});
    if(productivityView==='today')renderProductivity();
    if(productivityView==='cumulative')renderCumulative();
    if(productivityView==='monthly')renderProductivityMonthly();
    if(productivityView==='analysis')renderProductivityAnalysis();
  }
  qa('.productivity-subtab').forEach(function(b){b.addEventListener('click',function(){setProductivityView(b.dataset.productivityView)})});

  function effectiveRecord(dt){
    var all=readDailyDisplay(),record=all[dt];
    if(record)return record;
    var demo=DEMO_MODE?demoRecord(dt,8,[4200,4550,8650,9200,7350,8120,7840,7560],'08:40','15:40'):{date:dt,staff:0,startTime:'',endTime:'',hours:{}};
    var saved=readDaily()[dt];
    if(saved){
      if(Number(saved.staff||0)>0)demo.staff=Number(saved.staff);
      if(saved.startTime)demo.startTime=saved.startTime;
      if(saved.endTime)demo.endTime=saved.endTime;
      if(saved.hours&&Object.values(saved.hours).some(function(row){return Number(row&&row.qty||0)>0}))demo.hours=saved.hours;
    }
    return demo;
  }

  function saveStaffForDate(dt,raw){
    if(!dt)return false;
    var n=Number(raw);
    if(!Number.isInteger(n)||n<1){if(typeof toastMsg==='function')toastMsg('투입 인원은 1명 이상 숫자로 입력해주세요.');return false}
    var all=readDaily();if(!all[dt])all[dt]={date:dt};all[dt].staff=n;saveDaily(all);return true;
  }

  function productivityElapsedMinutes(startTime,endTime){
    if(!startTime||!endTime)return 0;
    var sm=/^(\d{1,2}):(\d{2})$/.exec(startTime),em=/^(\d{1,2}):(\d{2})$/.exec(endTime);
    if(!sm||!em)return 0;
    var start=(Number(sm[1])*60)+Number(sm[2]),end=(Number(em[1])*60)+Number(em[2]);
    if(end<start)end+=24*60;
    return Math.max(0,end-start);
  }
  function productivityElapsedLabel(minutes){
    if(!minutes)return '-';
    var h=Math.floor(minutes/60),m=minutes%60;
    if(h&&m)return h+'시간 '+m+'분';
    if(h)return h+'시간';
    return m+'분';
  }
  function renderProductivity(){
    var dt=today,r=effectiveRecord(dt);
    var startDisplay=q('#prodStartTimeDisplay'),endDisplay=q('#prodEndTimeDisplay'),staffInput=q('#prodStaffInput');
    if(startDisplay)startDisplay.textContent=r.startTime||'--:--';
    if(endDisplay)endDisplay.textContent=r.endTime||'--:--';
    if(staffInput)staffInput.value=Number(r.staff||0)>0?String(Number(r.staff)):'';
    if(q('#prodTodayLabel'))q('#prodTodayLabel').textContent=dt+' · 오늘 기준';
    q('#prodTableDate').textContent=dt;
    var values=[],body='';
    HOURS.forEach(function(h,i){
      var row=(r.hours&&r.hours[h])||{},qty=Number(row.qty||0),staff=Number(r.staff||0),duration=Number(BUCKET_HOURS[h]||1),rate=(qty>0&&staff>0)?qty/(staff*duration):0;
      values.push(rate);
      body+='<tr><td>'+h+'</td><td>'+bucketActualTime(r.startTime,i)+'</td><td>'+(qty?fmt(qty):'-')+'</td><td>'+(staff?fmt(staff):'-')+'</td><td>'+(rate?fmt(Math.round(rate)):'-')+'</td></tr>';
    });
    q('#prodHourBody').innerHTML=body;
    var sum=calcRecord(r),elapsedMinutes=productivityElapsedMinutes(r.startTime,r.endTime),staff=Number(r.staff||0);
    var totalLaborHours=(elapsedMinutes>0&&staff>0)?(elapsedMinutes/60)*staff:0;
    var todayRate=totalLaborHours>0?sum.qty/totalLaborHours:0;
    if(q('#prodElapsedDisplay'))q('#prodElapsedDisplay').textContent=productivityElapsedLabel(elapsedMinutes);
    if(q('#prodTodayQty'))q('#prodTodayQty').textContent=fmt(sum.qty);
    if(q('#prodTodayRate'))q('#prodTodayRate').textContent=todayRate>0?fmt(Math.round(todayRate)):'-';
    drawChart('prodHourChart',HOURS,values,'#prodHourEmpty');
  }

  q('#prodStaffInput').addEventListener('change',function(){
    var raw=this.value.trim();
    if(raw===''){var all=readDaily();if(!all[today])all[today]={date:today};all[today].staff=null;saveDaily(all);renderProductivity();renderCumulative();return}
    if(saveStaffForDate(today,raw)){renderProductivity();renderCumulative();if(!q('#detailResults').hidden)renderDailyDetail()}
  });

  q('#openPastStaffEditor').addEventListener('click',function(){
    var editor=q('#pastStaffEditor');editor.hidden=!editor.hidden;
    if(!editor.hidden){
      var d=new Date();d.setDate(d.getDate()-1);q('#pastStaffDate').value=dateKey(d);
      var r=effectiveRecord(q('#pastStaffDate').value);q('#pastStaffCount').value=Number(r.staff||0)>0?String(Number(r.staff)):'';
    }
  });
  q('#pastStaffDate').addEventListener('change',function(){var r=effectiveRecord(this.value);q('#pastStaffCount').value=Number(r.staff||0)>0?String(Number(r.staff)):''});
  q('#pastStaffSave').addEventListener('click',function(){
    var dt=q('#pastStaffDate').value,raw=q('#pastStaffCount').value.trim();
    if(saveStaffForDate(dt,raw)){
      if(typeof toastMsg==='function')toastMsg(dt+' 투입 인원을 저장했습니다.');
      renderCumulative();if(!q('#detailResults').hidden)renderDailyDetail();
    }
  });
  q('#pastStaffClose').addEventListener('click',function(){q('#pastStaffEditor').hidden=true});


  var shippingFullscreenBtn=q('#shippingFullscreenBtn'),shippingDisplayBoard=q('#shippingDisplayBoard');
  function shippingFullscreenActive(){
    return document.fullscreenElement===shippingDisplayBoard||document.webkitFullscreenElement===shippingDisplayBoard;
  }
  function updateShippingFullscreenButton(){
    if(!shippingFullscreenBtn)return;
    var active=shippingFullscreenActive();
    shippingFullscreenBtn.innerHTML='<span aria-hidden="true">'+(active?'×':'⛶')+'</span> '+(active?'전체화면 종료':'전체화면');
    shippingFullscreenBtn.setAttribute('aria-label',active?'금일 출고 현황 전체화면 종료':'금일 출고 현황 전체화면');
  }
  if(shippingFullscreenBtn&&shippingDisplayBoard){
    shippingFullscreenBtn.addEventListener('click',function(){
      if(shippingFullscreenActive()){
        var exit=document.exitFullscreen||document.webkitExitFullscreen;
        if(exit)exit.call(document);
        return;
      }
      var request=shippingDisplayBoard.requestFullscreen||shippingDisplayBoard.webkitRequestFullscreen;
      if(request){
        var result=request.call(shippingDisplayBoard);
        if(result&&typeof result.catch==='function')result.catch(function(){});
      }
    });
    document.addEventListener('fullscreenchange',updateShippingFullscreenButton);
    document.addEventListener('webkitfullscreenchange',updateShippingFullscreenButton);
    updateShippingFullscreenButton();
  }

  window.renderStatusProductivity=function(){renderProductivity();renderCumulative();if(!q('#detailResults').hidden)renderDailyDetail()};

  function dateRowsInRange(start,end){
    var all=readDailyDisplay(),dates=Object.keys(all).sort();
    return dates.filter(function(dt){return(!start||dt>=start)&&(!end||dt<=end)}).map(function(dt){return{date:dt,record:all[dt],summary:calcRecord(all[dt])}});
  }
  function normalizeDateRange(startInput,endInput){
    var s=q(startInput).value||'',e=q(endInput).value||'';
    if(s&&e&&s>e){var t=s;s=e;e=t;q(startInput).value=s;q(endInput).value=e}
    return{s:s,e:e};
  }
  var cumulativeViewMode='year';
  function cumulativeAddBucket(bucket,x){
    var staff=Number(x.record&&x.record.staff||0);
    var elapsedMinutes=productivityElapsedMinutes(x.record&&x.record.startTime,x.record&&x.record.endTime);
    var labor=(elapsedMinutes>0&&staff>0)?(elapsedMinutes/60)*staff:Number(x.summary.labor||0);
    bucket.qty+=Number(x.summary.qty||0);
    bucket.labor+=labor;
    bucket.elapsedMinutes+=elapsedMinutes;
    bucket.staff+=staff;
  }
  function renderCumulative(){
    var startMonth=q('#cumStartDate').value||'';
    var endMonth=q('#cumEndDate').value||'';
    if(startMonth&&endMonth&&startMonth>endMonth){
      var swap=startMonth;startMonth=endMonth;endMonth=swap;
      q('#cumStartDate').value=startMonth;q('#cumEndDate').value=endMonth;
    }

    var currentYear=today.slice(0,4);
    var allRows=dateRowsInRange('','');
    var buckets={};
    var groupByYear=cumulativeViewMode==='all';

    allRows.forEach(function(x){
      var month=x.date.slice(0,7),year=x.date.slice(0,4);

      if(cumulativeViewMode==='year'){
        if(year!==currentYear)return;
      }else if(cumulativeViewMode==='custom'){
        if(startMonth&&month<startMonth)return;
        if(endMonth&&month>endMonth)return;
        if(!startMonth&&!endMonth&&year!==currentYear)return;
      }

      var key=groupByYear?year:month;
      if(!buckets[key])buckets[key]={qty:0,labor:0,elapsedMinutes:0,staff:0};
      cumulativeAddBucket(buckets[key],x);
    });

    var labels=[],values=[],body='',sumQty=0,sumLabor=0,sumElapsedMinutes=0,sumStaff=0;
    Object.keys(buckets).sort().forEach(function(key){
      var m=buckets[key];
      var rate=m.labor>0?m.qty/m.labor:0;
      sumQty+=m.qty;
      sumLabor+=m.labor;
      sumElapsedMinutes+=m.elapsedMinutes;
      sumStaff+=m.staff;
      labels.push(groupByYear?key:key.replace('-','.'));
      values.push(rate);
      body+='<tr><td>'+(groupByYear?key:key.replace('-','.'))+'</td><td>'+fmt(m.qty)+'</td><td>'+productivityElapsedLabel(m.elapsedMinutes)+'</td><td>'+fmt(m.staff)+'</td><td>'+(rate?fmt(Math.round(rate)):'-')+'</td></tr>';
    });

    var periodText='';
    if(cumulativeViewMode==='all'){
      periodText='전체 누계';
      q('#cumChartTitle').textContent='연도별 평균 생산성 추이';
      q('#cumChartHint').textContent='연도 평균 · EA/인·시간';
      q('#cumTableTitle').textContent='연도별 생산성 현황';
      q('#cumPeriodColumn').textContent='연도';
      q('#cumPeriodLabel').textContent='전체 누계 · 연도 기준';
      if(q('#cumViewLabel'))q('#cumViewLabel').textContent='전체 누계 · 연도 기준';
    }else{
      if(cumulativeViewMode==='custom'&&(startMonth||endMonth)){
        periodText=(startMonth||currentYear+'-01')+' ~ '+(endMonth||currentYear+'-12');
      }else{
        periodText=currentYear+'년';
      }
      q('#cumChartTitle').textContent='월별 생산성 추이';
      q('#cumChartHint').textContent='월 평균 · EA/인·시간';
      q('#cumTableTitle').textContent='월별 생산성 현황';
      q('#cumPeriodColumn').textContent='월';
      q('#cumPeriodLabel').textContent=periodText+' · 월 기준';
      if(q('#cumViewLabel'))q('#cumViewLabel').textContent=periodText+' · 월 기준';
    }

    q('#cumMonthBody').innerHTML=body||'<tr><td colspan="5" class="data-empty">누계 데이터가 없습니다.</td></tr>';
    q('#cumElapsed').textContent=productivityElapsedLabel(sumElapsedMinutes);
    q('#cumStaff').textContent=fmt(sumStaff);
    q('#cumQty').textContent=fmt(sumQty);
    q('#cumRate').textContent=fmt(sumLabor>0?Math.round(sumQty/sumLabor):0);
    drawChart('cumMonthChart',labels,values,'#cumMonthEmpty');
  }
  q('#cumSearchBtn').addEventListener('click',function(){
    cumulativeViewMode='custom';
    renderCumulative();
  });
  q('#cumAllBtn').addEventListener('click',function(){
    q('#cumStartDate').value='';
    q('#cumEndDate').value='';
    cumulativeViewMode='all';
    renderCumulative();
  });

  var prodMonthlyChartRef=null,prodAnalysisChartRef=null;
  function monthBefore(m){var p=String(m||'').split('-'),d=new Date(Number(p[0]),Number(p[1]||1)-2,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)}
  function prodMonthRows(month){if(!month)return[];return dateRowsInRange(month+'-01',month+'-31')}
  function prodMetricsForRows(rows){
    return rows.map(function(x){var m=detailRowMetrics(x.record);return{date:x.date,qty:m.qty,rate:m.rate,staff:m.staff,labor:m.labor}}).filter(function(x){return x.rate>0});
  }
  function prodRankHtml(rows,valueFn){
    return rows.map(function(x,i){return '<div><b>'+(i+1)+'</b><span>'+esc(x.name||x.date||'-')+'</span><strong>'+esc(valueFn(x))+'</strong></div>'}).join('')||'<div class="data-empty">데이터가 없습니다.</div>';
  }
  function prodDrawAnalysisChart(canvasId,emptyId,refName,rows){
    var canvas=q('#'+canvasId),empty=q('#'+emptyId);if(!canvas)return;
    if(empty)empty.style.display=rows.length?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(function(){if(refName==='monthly')renderProductivityMonthly();else renderProductivityAnalysis()});return}
    if(refName==='monthly'&&prodMonthlyChartRef)prodMonthlyChartRef.destroy();
    if(refName==='analysis'&&prodAnalysisChartRef)prodAnalysisChartRef.destroy();
    var chart=new Chart(canvas,{type:'line',data:{labels:rows.map(function(x){return x.date.slice(5).replace('-','/')}),datasets:[{data:rows.map(function(x){return Math.round(x.rate)}),borderWidth:2,pointRadius:2,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#eeeeea'}},x:{grid:{display:false},ticks:{autoSkip:true,maxTicksLimit:12}}}}});
    if(refName==='monthly')prodMonthlyChartRef=chart;else prodAnalysisChartRef=chart;
  }
  function productivityAggregateMonth(month){
    var rows=prodMetricsForRows(prodMonthRows(month)),qty=rows.reduce(function(a,x){return a+x.qty},0),labor=rows.reduce(function(a,x){return a+x.labor},0);
    return{rows:rows,qty:qty,rate:labor>0?qty/labor:0};
  }
  function renderProductivityMonthly(){
    var base=q('#prodMonthlyBase');if(!base)return;
    if(!base.value)base.value=today.slice(0,7);
    var cmp=q('#prodMonthlyCompare');if(!cmp.value)cmp.value=monthBefore(base.value);
    var a=productivityAggregateMonth(base.value),b=productivityAggregateMonth(cmp.value),ordered=a.rows.slice().sort(function(x,y){return y.rate-x.rate}),high=ordered[0],low=ordered[ordered.length-1],delta=b.rate?((a.rate-b.rate)/b.rate*100):0;
    q('#prodMonthlyQty').textContent=fmt(a.qty);q('#prodMonthlyRate').textContent=fmt(Math.round(a.rate||0));q('#prodMonthlyHigh').textContent=fmt(Math.round(high?high.rate:0));q('#prodMonthlyLow').textContent=fmt(Math.round(low?low.rate:0));q('#prodMonthlyHighDate').textContent=high?high.date:'-';q('#prodMonthlyLowDate').textContent=low?low.date:'-';q('#prodMonthlyDelta').textContent=(delta>0?'+':'')+delta.toFixed(1);q('#prodMonthlyCompareLabel').textContent=base.value+' vs '+cmp.value;q('#prodMonthlyTrendHint').textContent=base.value;
    var wd=['일','월','화','수','목','금','토'],map={};a.rows.forEach(function(x){var d=new Date(x.date+'T00:00:00').getDay(),k=wd[d];if(!map[k])map[k]=[];map[k].push(x.rate)});
    var wk=Object.keys(map).map(function(k){return{name:k+'요일',value:map[k].reduce(function(s,v){return s+v},0)/map[k].length}}).filter(function(x){return x.value>0}).sort(function(x,y){return y.value-x.value});
    q('#prodMonthlyWeekday').innerHTML=prodRankHtml(wk,function(x){return fmt(Math.round(x.value))+' EA/인·시간'});
    prodDrawAnalysisChart('prodMonthlyChart','prodMonthlyEmpty','monthly',a.rows);
  }
  function renderProductivityAnalysis(){
    var s=q('#prodAnalysisStart'),e=q('#prodAnalysisEnd');if(!s)return;
    if(!s.value)s.value=today.slice(0,4)+'-01-01';if(!e.value)e.value=today;
    if(s.value>e.value){var t=s.value;s.value=e.value;e.value=t}
    var rows=prodMetricsForRows(dateRowsInRange(s.value,e.value)),rates=rows.map(function(x){return x.rate}),avg=rates.length?rates.reduce(function(a,b){return a+b},0)/rates.length:0,high=rows.slice().sort(function(a,b){return b.rate-a.rate})[0],low=rows.slice().sort(function(a,b){return a.rate-b.rate})[0];
    q('#prodAnalysisAvg').textContent=fmt(Math.round(avg));q('#prodAnalysisHigh').textContent=fmt(Math.round(high?high.rate:0));q('#prodAnalysisLow').textContent=fmt(Math.round(low?low.rate:0));q('#prodAnalysisRange').textContent=fmt(Math.round((high?high.rate:0)-(low?low.rate:0)));q('#prodAnalysisHighDate').textContent=high?high.date:'-';q('#prodAnalysisLowDate').textContent=low?low.date:'-';
    var wd=['일','월','화','수','목','금','토'],map={};rows.forEach(function(x){var k=wd[new Date(x.date+'T00:00:00').getDay()]+'요일';if(!map[k])map[k]=[];map[k].push(x.rate)});var wk=Object.keys(map).map(function(k){return{name:k,value:map[k].reduce(function(a,b){return a+b},0)/map[k].length}}).sort(function(a,b){return b.value-a.value});q('#prodAnalysisWeekday').innerHTML=prodRankHtml(wk,function(x){return fmt(Math.round(x.value))+' EA/인·시간'});
    var changes=[];for(var i=1;i<rows.length;i++){var diff=rows[i].rate-rows[i-1].rate,pct=rows[i-1].rate?diff/rows[i-1].rate*100:0;changes.push({date:rows[i].date,diff:diff,pct:pct})}
    var up=changes.filter(function(x){return x.diff>0}).sort(function(a,b){return b.pct-a.pct}).slice(0,5),down=changes.filter(function(x){return x.diff<0}).sort(function(a,b){return a.pct-b.pct}).slice(0,5);
    q('#prodAnalysisUp').innerHTML=prodRankHtml(up,function(x){return '+'+x.pct.toFixed(1)+'% / +'+fmt(Math.round(x.diff))});
    q('#prodAnalysisDown').innerHTML=prodRankHtml(down,function(x){return x.pct.toFixed(1)+'% / '+fmt(Math.round(x.diff))});
    prodDrawAnalysisChart('prodAnalysisChart','prodAnalysisEmpty','analysis',rows);
  }
  if(q('#prodMonthlyRun'))q('#prodMonthlyRun').addEventListener('click',renderProductivityMonthly);
  if(q('#prodAnalysisRun'))q('#prodAnalysisRun').addEventListener('click',renderProductivityAnalysis);

  var selectedDetailDate='';
  function detailRowMetrics(r){
    var summary=calcRecord(r),staff=Number(r&&r.staff||0),elapsedMinutes=productivityElapsedMinutes(r&&r.startTime,r&&r.endTime);
    var labor=(elapsedMinutes>0&&staff>0)?(elapsedMinutes/60)*staff:Number(summary.labor||0);
    return{qty:Number(summary.qty||0),staff:staff,elapsedMinutes:elapsedMinutes,labor:labor,rate:labor>0?Number(summary.qty||0)/labor:0};
  }
  function renderDailyDetail(){
    var range=normalizeDateRange('#detailStartDate','#detailEndDate'),rows=dateRowsInRange(range.s,range.e);
    q('#detailRangeLabel').textContent=(range.s||'-')+' ~ '+(range.e||'-');

    var sumQty=0,sumStaff=0,sumElapsed=0,sumLabor=0,body='';
    rows.forEach(function(x){
      var m=detailRowMetrics(x.record);
      sumQty+=m.qty;sumStaff+=m.staff;sumElapsed+=m.elapsedMinutes;sumLabor+=m.labor;
      body+='<tr data-detail-row="'+esc(x.date)+'"><td>'+x.date+'</td><td>'+fmt(m.qty)+'</td><td>'+productivityElapsedLabel(m.elapsedMinutes)+'</td><td>'+fmt(m.staff)+'</td><td>'+(m.rate?fmt(Math.round(m.rate)):'-')+'</td><td><button type="button" class="btn sm detail-view-btn" data-detail-date="'+esc(x.date)+'">상세보기</button></td></tr>';
    });

    q('#detailElapsed').textContent=productivityElapsedLabel(sumElapsed);
    q('#detailPeriodStaff').textContent=fmt(sumStaff);
    q('#detailPeriodQty').textContent=fmt(sumQty);
    q('#detailPeriodRate').textContent=fmt(sumLabor>0?Math.round(sumQty/sumLabor):0);
    q('#detailDayBody').innerHTML=body||'<tr><td colspan="6" class="data-empty" style="text-align:center">해당 기간의 데이터가 없습니다.</td></tr>';

    qa('.detail-view-btn',q('#detailDayBody')).forEach(function(btn){
      btn.addEventListener('click',function(){
        selectedDetailDate=btn.dataset.detailDate||'';
        qa('[data-detail-row]',q('#detailDayBody')).forEach(function(tr){tr.classList.toggle('active',tr.dataset.detailRow===selectedDetailDate)});
        renderSelectedDay();
        q('#detailHourPanel').hidden=false;
        q('#detailHourPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
      });
    });

    if(!rows.length){
      selectedDetailDate='';
      q('#detailHourPanel').hidden=true;
      q('#detailHourLabel').textContent='날짜를 선택해주세요.';
      q('#detailHourBody').innerHTML='<tr><td colspan="5" class="data-empty" style="text-align:center">일자별 상세보기를 선택해주세요.</td></tr>';
    }
  }
  function renderSelectedDay(){
    var all=readDailyDisplay(),r=selectedDetailDate?all[selectedDetailDate]:null;
    if(!r){
      q('#detailHourLabel').textContent='날짜를 선택해주세요.';
      q('#detailHourBody').innerHTML='<tr><td colspan="5" class="data-empty" style="text-align:center">일자별 상세보기를 선택해주세요.</td></tr>';
      return;
    }
    q('#detailHourLabel').textContent=selectedDetailDate+' · '+(r.startTime||'-')+' ~ '+(r.endTime||'-');
    q('#detailHourBody').innerHTML=HOURS.map(function(h,i){
      var row=(r.hours&&r.hours[h])||{},qty=Number(row.qty||0),staff=Number(r.staff||0),duration=Number(BUCKET_HOURS[h]||1),rate=(qty>0&&staff>0)?qty/(staff*duration):0;
      return '<tr><td>'+h+'</td><td>'+bucketActualTime(r.startTime,i)+'</td><td>'+(qty?fmt(qty):'-')+'</td><td>'+(staff?fmt(staff):'-')+'</td><td>'+(rate?fmt(Math.round(rate)):'-')+'</td></tr>';
    }).join('');
  }
  q('#detailSearchBtn').addEventListener('click',function(){
    var range=normalizeDateRange('#detailStartDate','#detailEndDate');
    if(!range.s||!range.e){if(typeof toastMsg==='function')toastMsg('시작일과 종료일을 선택해주세요.');return}
    q('#detailResults').hidden=false;
    selectedDetailDate='';
    q('#detailHourPanel').hidden=true;
    renderDailyDetail();
  });
  q('#detailHourClose').addEventListener('click',function(){
    q('#detailHourPanel').hidden=true;
    selectedDetailDate='';
    qa('[data-detail-row]',q('#detailDayBody')).forEach(function(tr){tr.classList.remove('active')});
  });
  q('#detailResultsClose').addEventListener('click',function(){
    q('#detailResults').hidden=true;
    q('#detailHourPanel').hidden=true;
    selectedDetailDate='';
  });

  var storeHistoryChart=null,storeHistoryMode='compare';
  function initStoreHistoryControls(){
    var sel=q('#storeHistoryStore');if(!sel)return;
    sel.innerHTML=DEMO_STORES.map(function(s){return '<option value="'+esc(s.name)+'">'+esc(s.name)+'</option>'}).join('');
    if(sel.options.length)sel.selectedIndex=0;
    var end=new Date(),start=new Date(end);start.setDate(end.getDate()-6);
    q('#storeHistoryStart').value=dateKey(start);q('#storeHistoryEnd').value=dateKey(end);q('#storeHistoryDetailDate').value=dateKey(end);
    updateStoreHistoryModeUI();
  }
  function updateStoreHistoryModeUI(){
    qa('.store-mode-btn').forEach(function(b){b.classList.toggle('active',b.dataset.storeMode===storeHistoryMode)});
    var field=q('#storeHistoryStoreField');if(field)field.hidden=storeHistoryMode!=='detail';
  }
  function filteredStoreHistory(){
    var start=q('#storeHistoryStart').value||'',end=q('#storeHistoryEnd').value||'',store=storeHistoryMode==='detail'?(q('#storeHistoryStore').value||''):'';
    return (DEMO_MODE?DEMO_STORE_HISTORY:[]).filter(function(r){return(!start||r.date>=start)&&(!end||r.date<=end)&&(!store||r.store===store)}).sort(function(a,b){return b.date.localeCompare(a.date)||a.store.localeCompare(b.store)});
  }
  function drawStoreHistoryChart(rows){
    var empty=q('#storeHistoryChartEmpty'),canvas=q('#storeHistoryChart');if(!canvas)return;
    var has=rows.length>0;if(empty)empty.style.display=has?'none':'grid';
    if(typeof Chart==='undefined'){if(window.ensureChart)window.ensureChart().then(renderStoreHistory);return}
    if(storeHistoryChart)storeHistoryChart.destroy();if(!has)return;
    var labels=[],values=[],store=storeHistoryMode==='detail'?(q('#storeHistoryStore').value||''):'';
    if(storeHistoryMode==='detail'){
      var byDate={};rows.forEach(function(r){byDate[r.date]=(byDate[r.date]||0)+Number(r.total||0)});
      var ds=Object.keys(byDate).sort();labels=ds.map(function(d){return d.slice(5).replace('-','/')});values=ds.map(function(d){return byDate[d]});
    }else{
      var byStore={};rows.forEach(function(r){byStore[r.store]=(byStore[r.store]||0)+Number(r.total||0)});
      var ordered=Object.keys(byStore).sort(function(a,b){return byStore[b]-byStore[a]});labels=ordered;values=ordered.map(function(name){return byStore[name]});
    }
    /* 모바일 전체 비교: 매장명이 잘 보이도록 가로 막대로 표시 */
    var mBars=storeHistoryMode!=='detail'&&window.matchMedia&&window.matchMedia('(max-width:900px)').matches,wrap=canvas.parentElement;
    if(wrap){wrap.classList.toggle('m-bars',mBars);if(mBars)wrap.style.setProperty('height',(labels.length*30+40)+'px','important');else wrap.style.removeProperty('height')}
    if(mBars){storeHistoryChart=new Chart(canvas,{type:'bar',data:{labels:labels,datasets:[{label:'출고물량',data:values,backgroundColor:'#e87ba4',borderRadius:4,barThickness:16}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f0f1ef'},ticks:{maxTicksLimit:4,callback:function(v){return v>=1000?Math.round(v/1000)+'k':v}}},y:{grid:{display:false},ticks:{autoSkip:false,font:{size:12}}}}}});return}
    storeHistoryChart=new Chart(canvas,{
      type:'line',
      data:{labels:labels,datasets:[{label:'출고물량',data:values,borderWidth:2,pointRadius:4,pointHoverRadius:5,tension:.28,fill:false}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true,grid:{color:'#f0f1ef'}},
          x:{grid:{display:false},ticks:{maxRotation:45,minRotation:0,autoSkip:false}}
        }
      }
    });
  }
  function renderStoreHistory(){
    var rows=filteredStoreHistory(),store=storeHistoryMode==='detail'?(q('#storeHistoryStore').value||''):'';
    q('#storeHistoryChartTitle').textContent=storeHistoryMode==='detail'?(store+' 출고물량 추이'):'매장별 출고물량 비교';
    q('#storeHistoryChartHint').textContent=storeHistoryMode==='detail'?'일자별 출고량 · 실제 단위 기준':'선택 기간 출고량 비교 · 실제 단위 기준';
    q('#storeHistorySummaryName').textContent=storeHistoryMode==='detail'?(store||'매장 상세'):'전체 비교';
    var total=rows.reduce(function(a,r){return a+Number(r.total||0)},0),dates={};
    rows.forEach(function(r){dates[r.date]=(dates[r.date]||0)+Number(r.total||0)});
    var keys=Object.keys(dates),avg=keys.length?total/keys.length:0,maxDate='-',maxQty=0;
    keys.forEach(function(d){if(dates[d]>maxQty){maxQty=dates[d];maxDate=d}});
    q('#storeHistoryTotalQty').textContent=fmt(total);q('#storeHistoryAvgQty').textContent=fmt(Math.round(avg));
    q('#storeHistoryMaxDate').textContent=maxDate==='-'?'-':maxDate.slice(5).replace('-','/');q('#storeHistoryMaxQty').textContent=fmt(maxQty)+' EA';q('#storeHistoryCount').textContent=fmt(rows.length);
    drawStoreHistoryChart(rows);
    var panel=q('#storeHistoryDetailPanel');if(panel&&!panel.hidden)renderStoreHistoryDailyDetail();
  }
  function renderStoreHistoryDailyDetail(){
    var date=q('#storeHistoryDetailDate').value||'',store=storeHistoryMode==='detail'?(q('#storeHistoryStore').value||''):'';
    var rows=(DEMO_MODE?DEMO_STORE_HISTORY:[]).filter(function(r){return(!date||r.date===date)&&(!store||r.store===store)}).sort(function(a,b){return a.store.localeCompare(b.store)});
    q('#storeHistoryDetailTitle').textContent=(date||'선택 일자')+' 처리이력'+(store?' · '+store:'');
    q('#storeHistoryBody').innerHTML=rows.length?rows.map(function(r){
      return '<tr><td>'+r.date+'</td><td><b>'+esc(r.store)+'</b></td><td>'+fmt(r.total)+' EA</td><td>'+fmt(r.done)+' EA</td><td>'+esc(r.start||'-')+'</td><td>'+esc(r.end||'-')+'</td><td>'+fmt(r.duration||0)+'분</td><td><span class="store-history-status '+(r.status==='완료'?'done':'progress')+'">'+esc(r.status||'-')+'</span></td></tr>';
    }).join(''):'<tr><td colspan="8" class="data-empty" style="text-align:center">해당 날짜의 처리이력이 없습니다.</td></tr>';
  }
  initStoreHistoryControls();
  qa('.store-mode-btn').forEach(function(b){b.addEventListener('click',function(){
    storeHistoryMode=b.dataset.storeMode||'compare';updateStoreHistoryModeUI();renderStoreHistory();
  })});
  q('#storeHistorySearchBtn').addEventListener('click',renderStoreHistory);
  q('#storeHistoryStore').addEventListener('change',renderStoreHistory);
  q('#storeHistoryDetailBtn').addEventListener('click',function(){
    q('#storeHistoryDetailPanel').hidden=false;renderStoreHistoryDailyDetail();
  });
  q('#storeHistoryDetailClose').addEventListener('click',function(){q('#storeHistoryDetailPanel').hidden=true});
  q('#storeHistoryDetailDate').addEventListener('change',function(){if(!q('#storeHistoryDetailPanel').hidden)renderStoreHistoryDailyDetail()});

  /* Product outbound analysis: actual outbound upload data first, demo fallback only when there is no uploaded outbound data. */
  var productDonutChart=null,productTrendChart=null,productOutboundMode='analysis';
  var DEMO_PRODUCT_ROWS=[
    {date:'2026-07-04',store:'강남역점',code:'DEMO001',category:'BATH BOMB',name:'INTERGALACTIC',unit:'EA',qty:8200},
    {date:'2026-07-12',store:'홍대점',code:'DEMO002',category:'BODY',name:'SLEEPY BODY LOTION',unit:'EA',qty:6100},
    {date:'2026-07-18',store:'명동점',code:'DEMO003',category:'SHOWER',name:'ROSE JAM BULK',unit:'G',qty:76000},
    {date:'2026-08-03',store:'잠실점',code:'DEMO001',category:'BATH BOMB',name:'INTERGALACTIC',unit:'EA',qty:9600},
    {date:'2026-08-14',store:'강남역점',code:'DEMO004',category:'HAIR',name:'SHAMPOO BULK',unit:'G',qty:81000},
    {date:'2026-08-24',store:'홍대점',code:'DEMO005',category:'SKINCARE',name:'FRESH MASK',unit:'EA',qty:5300},
    {date:'2026-09-02',store:'강남역점',code:'DEMO001',category:'BATH BOMB',name:'INTERGALACTIC',unit:'EA',qty:11200},
    {date:'2026-09-07',store:'홍대점',code:'DEMO006',category:'BODY',name:'DREAM CREAM',unit:'EA',qty:8900},
    {date:'2026-09-11',store:'명동점',code:'DEMO003',category:'SHOWER',name:'ROSE JAM BULK',unit:'G',qty:94500},
    {date:'2026-09-16',store:'잠실점',code:'DEMO004',category:'HAIR',name:'SHAMPOO BULK',unit:'G',qty:84200},
    {date:'2026-09-22',store:'여의도점',code:'DEMO007',category:'SKINCARE',name:'ULTRABLAND',unit:'EA',qty:6100},
    {date:'2026-09-28',store:'강남역점',code:'DEMO008',category:'SOAP',name:'KARMA SOAP',unit:'EA',qty:7400}
  ];
  function statusOutboundRows(){
    try{
      var d=typeof read==='function'?read():{},src=d&&d.outbound;
      if(src&&Array.isArray(src.rows)&&src.rows.length){
        var cols=outboundColIndex(src.header||[]);
        return src.rows.map(function(r){
          return{
            date:String(r[cols.date]||'').slice(0,10),
            store:cols.store>=0?String(r[cols.store]||'').trim():'',
            code:String(r[cols.code]||'').trim(),
            category:String(r[cols.category]||'').trim()||'기타',
            name:String(r[cols.name]||'').trim()||String(r[cols.code]||'').trim(),
            unit:outboundUnit(r,cols),
            qty:Number(String(r[cols.qty]||0).replace(/,/g,''))||0
          };
        }).filter(function(r){return r.date&&r.code&&(r.unit==='EA'||r.unit==='G')});
      }
    }catch(e){}
    return DEMO_MODE?DEMO_PRODUCT_ROWS.slice():[];
  }
  function pctChange(cur,base){
    cur=Number(cur||0);base=Number(base||0);
    if(!base)return cur>0?'신규':'-';
    var v=(cur-base)/base*100;return(v>0?'+':'')+v.toFixed(1)+'%';
  }
  function shiftYmKey(key,delta){
    var p=String(key||'').split('-').map(Number),d=new Date(p[0],p[1]-1+delta,1);
    return d.getFullYear()+'-'+pad(d.getMonth()+1);
  }
  function productRowsInRange(rows,start,end){return rows.filter(function(r){return(!start||r.date>=start)&&(!end||r.date<=end)})}
  function productAllRangeLabel(rows){
    if(!rows.length)return'전체 기간';
    var dates=rows.map(function(r){return r.date}).sort();return'전체 기간 · '+dates[0]+' ~ '+dates[dates.length-1];
  }
  function renderProductOutboundAnalysis(){
    var rows=statusOutboundRows(),start=q('#productAnalysisStart')?.value||'',end=q('#productAnalysisEnd')?.value||'',filtered=productRowsInRange(rows,start,end);
    q('#productAnalysisPeriod').textContent=start||end?((start||'처음')+' ~ '+(end||'현재')):productAllRangeLabel(rows);
    var catMap={},skuSet=new Set(),storeSet=new Set();
    filtered.forEach(function(r){
      if(r.code)skuSet.add(r.code);if(r.store)storeSet.add(r.store);
      var cat=r.category||'기타';if(!catMap[cat])catMap[cat]=new Set();if(r.code)catMap[cat].add(r.code);
    });
    var cats=Object.keys(catMap).map(function(k){return{name:k,value:catMap[k].size}}).sort(function(a,b){return b.value-a.value});
    var totalSku=cats.reduce(function(a,x){return a+x.value},0);
    if(productDonutChart)productDonutChart.destroy();
    var canvas=q('#productCategoryDonut'),empty=q('#productDonutEmpty');if(empty)empty.style.display=cats.length?'none':'grid';
    if(cats.length&&canvas&&typeof Chart!=='undefined'){
      productDonutChart=new Chart(canvas,{type:'doughnut',data:{labels:cats.map(function(x){return x.name}),datasets:[{data:cats.map(function(x){return x.value}),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'64%',plugins:{legend:{position:'right',labels:{boxWidth:10,usePointStyle:true,font:{size:10}}},tooltip:{callbacks:{label:function(ctx){var v=Number(ctx.raw||0),p=totalSku?v/totalSku*100:0;return ctx.label+' · '+v+' SKU · '+p.toFixed(1)+'%'}}}}}});
    }
    q('#productTopCategory').textContent=cats[0]?cats[0].name:'-';
    q('#productTopCategoryPct').textContent=cats[0]&&totalSku?(cats[0].value/totalSku*100).toFixed(1)+'%':'0%';
    q('#productCategoryCount').textContent=fmt(cats.length);q('#productSkuCount').textContent=fmt(skuSet.size);q('#productStoreCount').textContent=fmt(storeSet.size);

    var months={};rows.forEach(function(r){var m=r.date.slice(0,7);if(!months[m])months[m]={EA:0,G:0};months[m][r.unit]+=r.qty});
    var monthKeys=Object.keys(months).sort(),latest=monthKeys[monthKeys.length-1]||'',prev=latest?shiftYmKey(latest,-1):'',yoy=latest?shiftYmKey(latest,-12):'';
    var cur=months[latest]||{EA:0,G:0},pm=months[prev]||{EA:0,G:0},py=months[yoy]||{EA:0,G:0};
    q('#productLatestMonth').textContent=latest||'-';q('#productEaQty').textContent=fmt(cur.EA);q('#productGQty').textContent=fmt(cur.G);
    q('#productEaMom').textContent=pctChange(cur.EA,pm.EA);q('#productEaYoy').textContent=pctChange(cur.EA,py.EA);
    q('#productGMom').textContent=pctChange(cur.G,pm.G);q('#productGYoy').textContent=pctChange(cur.G,py.G);

    function topRows(unit){
      var map={};filtered.filter(function(r){return r.unit===unit}).forEach(function(r){if(!map[r.code])map[r.code]={name:r.name,category:r.category,qty:0};map[r.code].qty+=r.qty});
      return Object.values(map).sort(function(a,b){return b.qty-a.qty}).slice(0,5);
    }
    function topHtml(items,unit){return items.length?items.map(function(x){return'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.category)+'</td><td>'+fmt(x.qty)+' '+unit+'</td></tr>'}).join(''):'<tr><td colspan="3" class="data-empty">데이터가 없습니다.</td></tr>'}
    q('#productTopEaBody').innerHTML=topHtml(topRows('EA'),'EA');q('#productTopGBody').innerHTML=topHtml(topRows('G'),'G');
    initProductDetailOptions(rows);initProductDateStores(rows);
  }
  function initProductDetailOptions(rows){
    var map={};rows.forEach(function(r){map[r.code]=r});
    var dl=q('#productDetailList');if(dl)dl.innerHTML=Object.values(map).sort(function(a,b){return a.name.localeCompare(b.name)}).map(function(r){return'<option value="'+esc(r.code+' · '+r.name)+'"></option>'}).join('');
  }
  function initProductDateStores(rows){
    var stores=Array.from(new Set(rows.map(function(r){return r.store}).filter(Boolean))).sort(),sel=q('#productDateDetailStore');if(!sel)return;
    var current=sel.value;sel.innerHTML='<option value="">전체 매장</option>'+stores.map(function(s){return'<option value="'+esc(s)+'">'+esc(s)+'</option>'}).join('');if(stores.indexOf(current)>=0)sel.value=current;
  }
  function activateProductOutbound(name){
    productOutboundMode=name;
    qa('.product-outbound-tab').forEach(function(b){b.classList.toggle('active',b.dataset.productOutboundTab===name)});
    qa('.product-outbound-panel').forEach(function(p){p.classList.toggle('active',p.dataset.productOutboundPanel===name)});
    if(name==='analysis')renderProductOutboundAnalysis();
  }
  qa('.product-outbound-tab').forEach(function(b){b.addEventListener('click',function(){activateProductOutbound(b.dataset.productOutboundTab)})});
  q('#productAnalysisSearch').addEventListener('click',renderProductOutboundAnalysis);
  q('#productAnalysisAll').addEventListener('click',function(){q('#productAnalysisStart').value='';q('#productAnalysisEnd').value='';renderProductOutboundAnalysis()});

  function resolveProductQuery(rows,value){
    var v=String(value||'').trim(),code=v.split(' · ')[0].trim();
    return rows.find(function(r){return r.code===code})||rows.find(function(r){return r.name.toLowerCase()===v.toLowerCase()})||null;
  }
  q('#productDetailSearch').addEventListener('click',function(){
    var rows=statusOutboundRows(),picked=resolveProductQuery(rows,q('#productDetailQuery').value);
    if(!picked){if(typeof toastMsg==='function')toastMsg('조회할 제품을 선택해주세요.');return}
    var start=q('#productDetailStart').value||'',end=q('#productDetailEnd').value||'';
    var filtered=productRowsInRange(rows,start,end).filter(function(r){return r.code===picked.code});
    q('#productDetailCategory').textContent=picked.category||'-';q('#productDetailName').textContent=picked.name||'-';q('#productDetailCode').textContent=picked.code||'-';q('#productDetailUnit').textContent=picked.unit||'-';
    q('#productDetailQty').textContent=fmt(filtered.reduce(function(a,r){return a+r.qty},0));
    q('#productDetailStores').textContent=fmt(new Set(filtered.map(function(r){return r.store}).filter(Boolean)).size);
    q('#productDetailDays').textContent=fmt(new Set(filtered.map(function(r){return r.date})).size);
    var byDate={};filtered.forEach(function(r){byDate[r.date]=(byDate[r.date]||0)+r.qty});var dates=Object.keys(byDate).sort();
    if(productTrendChart)productTrendChart.destroy();var empty=q('#productDetailTrendEmpty');if(empty)empty.style.display=dates.length?'none':'grid';
    if(dates.length&&typeof Chart!=='undefined'){productTrendChart=new Chart(q('#productDetailTrend'),{type:'line',data:{labels:dates.map(function(d){return d.slice(5).replace('-','/')}),datasets:[{data:dates.map(function(d){return byDate[d]}),borderWidth:2,pointRadius:3,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true},x:{grid:{display:false}}}}})}
    q('#productDetailTrendHint').textContent=(start||'전체')+' ~ '+(end||'전체')+' · '+picked.unit;
    var byStore={};filtered.forEach(function(r){var s=r.store||'매장 미분류';byStore[s]=(byStore[s]||0)+r.qty});
    var stores=Object.keys(byStore).sort(function(a,b){return byStore[b]-byStore[a]});
    q('#productDetailStoreBody').innerHTML=stores.length?stores.map(function(s){return'<tr><td>'+esc(s)+'</td><td>'+fmt(byStore[s])+' '+picked.unit+'</td></tr>'}).join(''):'<tr><td colspan="2" class="data-empty">매장별 데이터가 없습니다.</td></tr>';
  });

  q('#productDateDetailSearch').addEventListener('click',function(){
    var rows=statusOutboundRows(),dt=q('#productDateDetailDate').value||'',store=q('#productDateDetailStore').value||'',query=(q('#productDateDetailQuery').value||'').trim().toLowerCase();
    if(!dt){if(typeof toastMsg==='function')toastMsg('조회일자를 선택해주세요.');return}
    var filtered=rows.filter(function(r){return r.date===dt&&(!store||r.store===store)&&(!query||r.code.toLowerCase().includes(query)||r.name.toLowerCase().includes(query))});
    var byKey={};filtered.forEach(function(r){var k=[r.date,r.store,r.code,r.unit].join('|');if(!byKey[k])byKey[k]=Object.assign({},r);else byKey[k].qty+=r.qty});
    var list=Object.values(byKey).sort(function(a,b){return(a.store||'').localeCompare(b.store||'')||a.name.localeCompare(b.name)});
    q('#productDateDetailCount').textContent=fmt(list.length)+'건';
    q('#productDateDetailBody').innerHTML=list.length?list.map(function(r){return'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.store||'-')+'</td><td>'+esc(r.code)+'</td><td><b>'+esc(r.name)+'</b></td><td>'+esc(r.category||'-')+'</td><td>'+esc(r.unit)+'</td><td>'+fmt(r.qty)+'</td></tr>'}).join(''):'<tr><td colspan="7" class="data-empty" style="text-align:center">해당 조건의 출고 데이터가 없습니다.</td></tr>';
  });
  q('#productDateDetailDate').value=today;

  /* Weekly outbound requests: keep rows compact, show status explicitly, confirm before state changes. */
  function getRequests(){try{var x=JSON.parse(localStorage.getItem(REQUEST_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
  function saveRequests(x){localStorage.setItem(REQUEST_KEY,JSON.stringify(x))}
  function weekRange(){var n=new Date(),s=new Date(n);s.setDate(n.getDate()-n.getDay());var e=new Date(s);e.setDate(s.getDate()+6);return{start:dateKey(s),end:dateKey(e)}}
  function renderWeeklyRequests(){
    var range=weekRange(),all=getRequests();
    ['bulk','traffic','hq','nozzle'].forEach(function(type){
      /* 메인 출고 요청: 미처리 건은 요청일과 상관없이 모두 표시(완료 건은 숨김) */
      var rows=all.filter(function(r){return r&&r.type===type&&r.status!=='처리완료'&&r.status!=='완료'}).map(function(r){var ds=(Array.isArray(r.requestDates)?r.requestDates:[]).slice().sort();var copy=Object.assign({},r);copy.__weekDate=ds[0]||'';return copy}).sort(function(a,b){return String(a.__weekDate).localeCompare(String(b.__weekDate))});
      var list=q('[data-request-list="'+type+'"]'),count=q('[data-request-count="'+type+'"]');if(count)count.textContent=rows.length+'건';if(!list)return;
      if(!rows.length){list.innerHTML='<button type="button" class="request-empty-card" disabled>미처리 요청이 없습니다.</button>';return}
      list.innerHTML=rows.map(function(r){var done=r.status==='처리완료'||r.status==='완료';return '<div class="request-row"><button type="button" class="request-link-cell store-name" data-v80-open="'+esc(r.id)+'">'+esc(r.storeName||'-')+'</button><span class="doc-no">'+esc(String(r.__weekDate||'').slice(5).replace('-','/'))+'</span><span class="status-cell"><button type="button" class="request-state-btn '+(done?'done':'')+'" data-v80-state="'+esc(r.id)+'">'+(done?'완료':'미완료')+'</button></span></div>'}).join('');
      qa('[data-v80-open]',list).forEach(function(b){b.onclick=function(){var r=rows.find(function(x){return String(x.id)===String(b.dataset.v80Open)});if(r&&r.url)window.open(r.url,'_blank','noopener');else if(typeof toastMsg==='function')toastMsg('등록된 원본 URL이 없습니다.')}});
      qa('[data-v80-state]',list).forEach(function(b){b.onclick=function(){
        var data=getRequests(),idx=data.findIndex(function(x){return String(x.id)===String(b.dataset.v80State)});if(idx<0)return;var done=data[idx].status==='처리완료'||data[idx].status==='완료';
        var ok=confirm(done?'해당 요청을 미완료 상태로 되돌리시겠습니까?':'해당 요청을 완료 처리하시겠습니까?');if(!ok)return;
        var go=function(){
        data[idx].status=done?'미처리':'처리완료';data[idx].updatedAt=new Date().toISOString();if(done)delete data[idx].completedAt;else data[idx].completedAt=new Date().toISOString();saveRequests(data);renderWeeklyRequests();renderShipping();
        if(typeof window.refreshOutboundRequestManager==='function')window.refreshOutboundRequestManager();if(typeof toastMsg==='function')toastMsg(done?'미완료로 변경했습니다.':'완료 처리했습니다.');
        };
        /* 완료 처리하면 줄이 거품처럼 톡 터지며 사라진 뒤 반영 */
        if(!done&&window.__bubblePop)window.__bubblePop(b.closest('.request-row')||b,go);else go();
      }});
    });
  }
  window.renderTodayOutboundRequests=renderWeeklyRequests;

  renderShipping();renderProductivity();renderCumulative();renderDailyDetail();renderStoreHistory();renderProductOutboundAnalysis();renderWeeklyRequests();
  if(window.lucide)lucide.createIcons();
})();

