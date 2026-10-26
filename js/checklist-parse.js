/* 입고리스트 샘플(수입팀 '상품 입고 CHECKLIST' 엑셀) 해석 — 화면(js/59-checklist.js)과 서버(api/team-data.js, 구글 드라이브 자동 반영)가 같이 씀
   입력: sheets = [{ name, aoa }] (aoa = 줄×칸 값. 날짜 칸은 yyyy-mm-dd, 숫자는 그대로/글자), fileName
   파일명: "Check List.10월 27일 입고 (UK Jun-Fragrance …, Spa Sundries - 142차)_20260820.xlsx" → 142차, UK, 주문 구분
   Checklist 시트: 실시간 입고 예정일(입고일) · Order Number · Pallet 수 · 주요 입고 제품 · 현재 수정내역
   주문 시트: 한 줄에 표 3개가 빈 칸을 사이에 두고 나란히 있음
     A 원본 주문(해외 PLU…) | B 한국 분배(PLU · Description · 수량 · 리테일 · 디지털 … 분배처) | C 팔레트/케이스 상세(PLU별 LOT·제조일자·REF·케이스)
     → B를 그대로 쓰고, C는 PLU로 묶어 B 줄에 붙임 (C는 B와 줄이 맞지 않는 별개 목록)
   PLU: 뒤 KR·앞 0을 빼고 숫자만(07320KR → 7320, 1,829.00 → 1829) */
(function(root){
  function pad(n){return String(n).padStart(2,'0')}
  function normPlu(v){var s=String(v==null?'':v).trim().replace(/\s+/g,'').replace(/KR$/i,'');if(/^[\d,]+(\.0+)?$/.test(s))s=s.replace(/,/g,'').replace(/\.0+$/,'');return /^\d+$/.test(s)?String(Number(s)):s.toUpperCase()}
  function num(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v==null?'':v).replace(/,/g,'').trim();if(!s||s==='-')return 0;var n=parseFloat(s);return isFinite(n)?n:0}
  function txt(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function normDate(v){
    var s=txt(v),m;
    // 엑셀 날짜 일련번호(46311 → 2026-10-16)
    if(/^\d{5}(\.\d+)?$/.test(s)&&+s>30000&&+s<80000){var d=new Date(Math.round((+s-25569)*86400000));return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
    if((m=s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)))return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);
    if((m=s.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)))return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);
    if((m=s.match(/^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})$/)))return m[3]+'-'+pad(m[2])+'-'+pad(m[1]); // 27-07-2026 (일-월-년)
    if((m=s.match(/^(\d{2})[-.](\d{1,2})[-.](\d{1,2})$/)))return '20'+m[1]+'-'+pad(m[2])+'-'+pad(m[3]); // 26-07-08 (년-월-일)
    if((m=s.match(/^(\d{4})(\d{2})(\d{2})$/)))return m[1]+'-'+m[2]+'-'+m[3];
    // 손으로 친 오타 보정: 숫자 0 대신 영문 O, 구분자 빠짐(27/082026, 0109/2026) → 숫자 8자리로 일-월-년(또는 년월일)
    var dg=s.replace(/[oO]/g,'0').replace(/\D/g,'');
    if(/^\d{8}$/.test(dg)&&!/[a-np-zA-NP-Z]/.test(s)){
      var y,mo,da;
      if(/^20\d{2}/.test(dg)){y=dg.slice(0,4);mo=dg.slice(4,6);da=dg.slice(6,8)}else{da=dg.slice(0,2);mo=dg.slice(2,4);y=dg.slice(4,8)}
      if(/^20\d{2}$/.test(y)&&+mo>=1&&+mo<=12&&+da>=1&&+da<=31)return y+'-'+mo+'-'+da;
    }
    return s;
  }
  function low(s){return txt(s).toLowerCase().replace(/[:：]$/,'').trim()}
  // 머리글 줄을 빈 칸 기준으로 묶음: [[시작,끝], …]
  function groups(h){var out=[],st=-1;for(var i=0;i<=h.length;i++){var on=i<h.length&&txt(h[i]);if(on&&st<0)st=i;if(!on&&st>=0){out.push([st,i-1]);st=-1}}return out}
  function findIn(h,range,names){for(var n=0;n<names.length;n++)for(var i=range[0];i<=range[1];i++)if(low(h[i])===names[n])return i;return -1}
  // 정확한 이름이 없으면 비슷한 이름으로(예: 'Date Made', 'Mfg Date', 'Batch No')
  function findLike(h,range,re,not){for(var i=range[0];i<=range[1];i++){var l=low(h[i]);if(l&&re.test(l)&&!(not&&not.test(l)))return i}return -1}

  /* Checklist 시트 → 입고 정보 */
  function parseInfo(aoa){
    var info={eta:'',orders:'',pallets:'',products:'',changes:''};
    var after=function(r,i){for(var k=i+1;k<r.length;k++){var t=txt(r[k]);if(t)return t}return ''};
    (aoa||[]).forEach(function(r){
      (r||[]).forEach(function(c,i){
        var t=txt(c),k=t.replace(/\s/g,'');
        if(!t)return;
        // 입고일: '실시간 입고 예정일' 우선, 날짜가 아니면(예전 양식은 'SEA' 등) '물류센터 입고 예정일'
        if(/^(실시간|물류센터)?입고예정일$/.test(k)){var dv=normDate(after(r,i));if(/^\d{4}-\d{2}-\d{2}$/.test(dv)){if(/^실시간/.test(k))info.eta=dv;else if(!info.etaAlt)info.etaAlt=dv}}
        else if(/^ordernumber$/i.test(k)&&!info.orders)info.orders=after(r,i);
        else if(k==='Pallet수'&&!info.pallets)info.pallets=after(r,i);
        else if(k==='주요입고제품'&&!info.products)info.products=String(after(r,i)).replace(/^-\s*/,'').split(/\s*-\s+/).join(' · ');
        else if(/현재\s*수정내역/.test(t)&&!info.changes){var m=String(c).split(/현재\s*수정내역\s*[:：]?/)[1];info.changes=String(m||'').replace(/\r/g,'').trim().slice(0,1000)}
      });
    });
    if(!info.eta)info.eta=info.etaAlt||'';delete info.etaAlt;
    return info;
  }
  function parseName(fileName){
    var base=String(fileName||'').replace(/\.(xlsx|xls|xlsm)$/i,'');
    var bm=base.match(/(\d{1,4})\s*차/g),batchNo=bm?String(Number(bm[bm.length-1].replace(/\D/g,''))):'';
    var pm=base.match(/\(([^)]*\d+\s*차[^)]*)\)/)||base.match(/\((.*)\)/),inside=pm?pm[1]:'';
    var country=(inside.match(/^\s*([A-Z]{2,3})\b/)||[])[1]||'';
    var orders=inside.replace(/^\s*[A-Z]{2,3}\s*/,'').replace(/\s*-\s*\d{1,4}\s*차.*$/,'').trim();
    var dm=base.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/),ym=base.match(/_(20\d{2})\d{2,4}/);
    var date=dm?(ym?ym[1]:String(new Date().getFullYear()))+'-'+pad(dm[1])+'-'+pad(dm[2]):'';
    return{batchNo:batchNo,country:country,orders:orders.slice(0,200),fileDate:date};
  }
  /* 주문 시트 → B 줄 + C 상세 */
  var C_PLU=['結果plu','plu','item code','item number'],C_LOT=['lot no','lot no.','lot/serial','serial','lot'],C_DATE=['manu date','date made','made date','manufacture date','manufacturing date','mfg date','production date','date'],C_GDATE=['gift manu date'],C_REF=['ref no','ref no.','order number','sales order'],C_CASE=['case no','case no.','pallet n.','pallet no','pallet number','pallet','master pack'],C_QTY=['qty','pallet qty (ea)','quantity'];
  function parseOrderSheet(name,aoa){
    var hi=-1;for(var i=0;i<Math.min(10,aoa.length);i++){var g0=groups(aoa[i]||[]);if(g0.length>=2&&/^(plu|item number|item code)$/.test(low((aoa[i]||[])[g0[1][0]])))(hi=i);if(hi>=0)break}
    if(hi<0)return null;
    var h=aoa[hi].map(txt),gs=groups(h),B=gs[1];
    var bPlu=B[0],bDesc=-1,bQty=-1;
    for(var k=B[0]+1;k<=B[1];k++){var l=low(h[k]);if(bDesc<0&&/^(description|description 1|item|product)$/.test(l))bDesc=k;else if(bQty<0&&/^(qty|quantity|quantity shipped)$/.test(l))bQty=k}
    if(bQty<0)return null;
    var dist=[];for(var d=bQty+1;d<=B[1];d++)dist.push({i:d,name:h[d]});
    // C: B 뒤의 묶음 전부
    var C=gs.length>2?[gs[2][0],gs[gs.length-1][1]]:null,c={};
    if(C){c.plu=findIn(h,C,C_PLU);c.lot=findIn(h,C,C_LOT);if(c.lot<0)c.lot=findLike(h,C,/lot|serial|batch/);c.date=findIn(h,C,C_DATE);if(c.date<0)c.date=findLike(h,C,/manu|made|mfg|manufactur|production|제조/,/gift/);c.gdate=findIn(h,C,C_GDATE);c.ref=findIn(h,C,C_REF);c.cs=findIn(h,C,C_CASE);c.qty=findIn(h,C,C_QTY)}
    var rows=[],details={};
    aoa.slice(hi+1).forEach(function(r){
      r=r||[];
      var plu=normPlu(r[bPlu]);
      if(plu){
        var qty=num(r[bQty]),values={};
        dist.forEach(function(x){var v=num(r[x.i]);if(v)values[x.name]=v});
        if(qty||Object.keys(values).length)rows.push({sheet:name,plu:plu,name:txt(bDesc>=0?r[bDesc]:''),qty:qty,values:values});
      }
      if(C&&c.plu>=0){
        var cp=normPlu(r[c.plu]);if(!cp)return;
        var date=normDate(c.date>=0?r[c.date]:'')||normDate(c.gdate>=0?r[c.gdate]:'');
        (details[cp]=details[cp]||[]).push({lot:txt(c.lot>=0?r[c.lot]:''),date:date,ref:txt(c.ref>=0?r[c.ref]:''),cs:txt(c.cs>=0?r[c.cs]:'').replace(/\.0+$/,''),qty:c.qty>=0?num(r[c.qty]):0});
      }
    });
    return{name:name,cols:dist.map(function(x){return x.name}),rows:rows,details:details};
  }
  function parseSheets(sheets,fileName){
    var meta=parseName(fileName),info={eta:'',orders:'',pallets:'',products:'',changes:''},rows=[],cols=[],sheetNames=[],details={};
    (sheets||[]).forEach(function(sh){
      var aoa=sh.aoa||[];
      if(/checklist/i.test(sh.name)){info=parseInfo(aoa);return}
      var p=parseOrderSheet(sh.name,aoa);if(!p)return;
      if(p.rows.length)sheetNames.push(sh.name);
      p.cols.forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)});
      rows=rows.concat(p.rows);
      Object.keys(p.details).forEach(function(k){details[k]=(details[k]||[]).concat(p.details[k])});
    });
    // C 상세를 PLU로 붙임(같은 LOT·날짜·REF·케이스는 하나로)
    rows.forEach(function(r){
      var seen={},list=[];
      (details[r.plu]||[]).forEach(function(x){var key=[x.lot,x.date,x.ref,x.cs].join('|');if(seen[key]){seen[key].qty+=x.qty;return}var y={lot:x.lot,date:x.date,ref:x.ref,cs:x.cs,qty:x.qty};seen[key]=y;list.push(y)});
      r.details=list.slice(0,60);
    });
    return{batchNo:meta.batchNo,country:meta.country,orders:meta.orders,fileDate:meta.fileDate,eta:info.eta||meta.fileDate,info:info,sheets:sheetNames,cols:cols,rows:rows};
  }
  // 브라우저(SheetJS) 시트 → aoa: 날짜 칸은 yyyy-mm-dd, 숫자는 원래 값(지수 표기·천 단위 쉼표 없이), 나머지는 보이는 글자
  function aoaFromSheetJS(ws,XLSX){
    if(!ws||!ws['!ref'])return [];
    var rg=XLSX.utils.decode_range(ws['!ref']),out=[];
    for(var R=rg.s.r;R<=rg.e.r;R++){var row=[];for(var C=0;C<=rg.e.c;C++){
      var cell=ws[XLSX.utils.encode_cell({r:R,c:C})],v='';
      if(cell){
        if(cell.t==='n'&&cell.z&&XLSX.SSF.is_date(cell.z))v=XLSX.SSF.format('yyyy-mm-dd',cell.v);
        else if(cell.t==='d')v=cell.v instanceof Date?cell.v.getFullYear()+'-'+pad(cell.v.getMonth()+1)+'-'+pad(cell.v.getDate()):String(cell.v);
        else if(cell.t==='n')v=String(cell.v);
        else v=cell.w!=null?cell.w:String(cell.v==null?'':cell.v);
      }
      row.push(v);
    }out.push(row)}
    return out;
  }
  var api={parseSheets:parseSheets,normPlu:normPlu,normDate:normDate,parseName:parseName,aoaFromSheetJS:aoaFromSheetJS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChecklistParse=api;
})(typeof window!=='undefined'?window:this);
