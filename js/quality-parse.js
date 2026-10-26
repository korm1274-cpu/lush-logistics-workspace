/* 품질리스트(시험의뢰서) 해석 — 화면(js/58-quality-list.js)과 서버(api/team-data.js, 구글 드라이브 자동 반영)가 같이 씀
   입력: sheets = [{ name, aoa }] (aoa = 시트의 줄×칸 글자 값), fileName
   출력: { batchNo, rows: [{ kind:'단품'|'GIFT', plu, name, lot, date, qty, code, items? }] }
   - 단품 시트: No.|(PLU)|Lot No.|제조일자|품명/용량(g)|…|입고수량|제품코드|INVOICE|차수
   - GIFT 시트: 기프트명|GIFT LOT No.|(PLU)|품명/용량(g)|용도|Lot No.|제조일자|…|차수 — 기프트명이 적힌 줄부터 다음 기프트명 전까지가 구성품
   - 차수: 차수 칸 → '해 당 차 수' 칸 → 파일명 "142차"
   - PLU: 뒤 KR과 앞 0을 뺌(09214KR → 9214). GIFT LOT(65565260914I2401) → 기프트 PLU 65565 · 제조일자 2026-09-14 */
(function(root){
  function pad(n){return String(n).padStart(2,'0')}
  function normPlu(v){var s=String(v==null?'':v).trim().replace(/\s+/g,'').replace(/KR$/i,'');return /^\d+$/.test(s)?String(Number(s)):s.toUpperCase()}
  function num(v){if(typeof v==='number')return isFinite(v)?v:null;var s=String(v==null?'':v).replace(/,/g,'').trim();if(!s)return null;var n=parseFloat(s);return isFinite(n)?n:null}
  function normDate(v){
    var s=String(v==null?'':v).trim(),m;
    if((m=s.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)))return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)))return (m[3].length===2?'20'+m[3]:m[3])+'-'+pad(m[1])+'-'+pad(m[2]); // 엑셀 미국식 m/d/yy
    if((m=s.match(/^(\d{4})(\d{2})(\d{2})$/)))return m[1]+'-'+m[2]+'-'+m[3];
    return s;
  }
  function giftLot(lot){var m=String(lot||'').trim().match(/^(\d+)(\d{2})(\d{2})(\d{2})[A-Za-z]/);if(!m)return null;var mm=+m[3],dd=+m[4];if(mm<1||mm>12||dd<1||dd>31)return null;return{plu:String(Number(m[1])),date:'20'+m[2]+'-'+m[3]+'-'+m[4]}}
  function headOf(r){return (r||[]).map(function(x){return String(x==null?'':x).replace(/\s+/g,' ').trim()})}
  function cell(h,names){for(var i=0;i<names.length;i++){var k=h.indexOf(names[i]);if(k>=0)return k}return -1}
  // 목록 시트인지(위쪽 30줄 안에 '(PLU)' 칸이 있는지) — 드라이브 연동에서 보낼 시트를 고를 때도 씀
  function headerRow(aoa){for(var i=0;i<Math.min(30,aoa.length);i++){if(headOf(aoa[i]).indexOf('(PLU)')>=0)return i}return -1}
  function parseSheets(sheets,fileName){
    var rows=[],batchNo='';
    (sheets||[]).forEach(function(sh){
      var aoa=sh.aoa||[],hi=headerRow(aoa);
      if(hi<0)return; // Category·POS 정보 같은 참고 시트
      if(!batchNo)for(var j=0;j<hi;j++){var r0=headOf(aoa[j]);var t=r0.findIndex(function(x){return x.replace(/\s/g,'')==='해당차수'});if(t>=0){var v=r0.slice(t+1).find(function(x){return x});var m0=v&&v.match(/(\d{1,4})/);if(m0){batchNo=String(Number(m0[1]));break}}}
      var h=headOf(aoa[hi]);
      var c={plu:cell(h,['(PLU)']),lot:cell(h,['Lot No.','LOT No.','Lot No','LOT NO.']),date:cell(h,['제조일자']),name:cell(h,['품명/용량(g)','품명/용량','품명','제품명']),qty:cell(h,['입고수량']),code:cell(h,['제품코드']),no:cell(h,['차수']),gift:cell(h,['기프트명']),glot:cell(h,['GIFT LOT No.','GIFT LOT No','GIFT LOT NO.'])};
      var isGift=c.gift>=0;
      var get=function(r,k){return k>=0?String(r[k]==null?'':r[k]).trim():''};
      var cur=null;
      aoa.slice(hi+1).forEach(function(r){
        var plu=get(r,c.plu),no=get(r,c.no);
        if(no&&!batchNo){var mn=no.match(/(\d{1,4})/);if(mn)batchNo=String(Number(mn[1]))}
        var item={plu:normPlu(plu),name:get(r,c.name),lot:get(r,c.lot),date:normDate(get(r,c.date))};
        if(isGift){
          var gname=get(r,c.gift);
          if(gname){
            var glot=get(r,c.glot),gl=giftLot(glot);
            cur={kind:'GIFT',plu:gl?gl.plu:'',name:gname,lot:glot,date:gl?gl.date:item.date,qty:c.qty>=0?num(get(r,c.qty)):null,code:'',items:[]};
            rows.push(cur);
          }
          if(cur&&plu)cur.items.push(item);
          return;
        }
        if(!plu)return;
        var code=get(r,c.code);
        rows.push({kind:'단품',plu:item.plu,name:item.name,lot:item.lot,date:item.date,qty:c.qty>=0?num(get(r,c.qty)):null,code:/^#|^N\/A$/i.test(code)?'':code});
      });
    });
    // GIFT 날짜를 LOT에서 못 읽으면 구성품 중 가장 늦은 제조일자
    rows.forEach(function(r){if(r.kind==='GIFT'&&!/^\d{4}-/.test(r.date||'')){var ds=r.items.map(function(x){return x.date}).filter(function(d){return /^\d{4}-/.test(d)}).sort();r.date=ds[ds.length-1]||''}});
    if(!batchNo){var fm=String(fileName||'').match(/(\d{1,4})\s*차/);if(fm)batchNo=String(Number(fm[1]))}
    return{batchNo:batchNo,rows:rows};
  }
  var api={parseSheets:parseSheets,normPlu:normPlu,normDate:normDate,giftLot:giftLot,headerRow:headerRow};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QualityParse=api;
})(typeof window!=='undefined'?window:this);
