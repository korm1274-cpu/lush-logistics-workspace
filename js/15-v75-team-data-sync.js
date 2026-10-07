/* <script id="v75-team-data-sync"> (index.html에서 그대로 옮김) */
(function(){
  const TEAM_API='/api/team-data';
  const KEYS={notices:'lush-v51-notices',todos:'lush-v51-todos',requests:'lush_outbound_requests_v1',productivity:'lush-logistics-productivity-v1',defects:'lush-product-defects-v1'};
  function readLocal(k){try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
  function readLocalObj(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return(v&&typeof v==='object'&&!Array.isArray(v))?v:def}catch{return def}}
  function normalizeProd(v){const d={people:[],entries:{}};if(!v||typeof v!=='object')return d;return{people:Array.isArray(v.people)?v.people:[],entries:(v.entries&&typeof v.entries==='object')?v.entries:{}}}
  function snapshot(){return {notices:readLocal(KEYS.notices),todos:readLocal(KEYS.todos),requests:readLocal(KEYS.requests),productivity:normalizeProd(readLocalObj(KEYS.productivity,{people:[],entries:{}})),defects:readLocal(KEYS.defects)}}
  const LAST_SAVE_KEY='__team_data_last_local_save__';
  let pushTimer=null,pulling=false;
  function markLocalSave(){try{sessionStorage.setItem(LAST_SAVE_KEY,String(Date.now()))}catch(e){}}
  function recentlySavedLocally(){
    try{
      const t=Number(sessionStorage.getItem(LAST_SAVE_KEY)||0);
      return t&&(Date.now()-t<6000);
    }catch(e){return false}
  }
  function pushTeamData(){
    clearTimeout(pushTimer);
    markLocalSave();
    pushTimer=setTimeout(()=>attemptPush(0),900);
  }
  function attemptPush(attempt){
    fetch(TEAM_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot())})
      .then(r=>r.json()).then(j=>{
        if(!j||!j.success){
          console.error('team-data 저장 실패:',j&&j.error);
          retryPush(attempt);
        }else{
          markLocalSave();
          window.__teamPushFailed=false;
        }
      })
      .catch(err=>{
        console.error('team-data 저장 실패:',err);
        retryPush(attempt);
      });
  }
  function retryPush(attempt){
    const delays=[3000,8000,20000];
    if(attempt<delays.length){
      window.__teamPushFailed=true;
      setTimeout(()=>attemptPush(attempt+1),delays[attempt]);
    }else{
      window.__teamPushFailed=true;
      if(typeof window.toastMsg==='function')window.toastMsg('공지·할 일·출고 요청 서버 동기화에 실패했습니다. 잠시 후 다시 저장해주세요.');
    }
  }
  async function pullTeamData(silent){
    if(pulling)return;
    if(recentlySavedLocally()){setTimeout(()=>pullTeamData(silent),2000);return}
    if(window.__teamPushFailed){return}
    pulling=true;
    try{
      const res=await fetch(TEAM_API);
      const j=await res.json();
      if(!j||!j.success||!j.data){pulling=false;return}
      const localProd=normalizeProd(readLocalObj(KEYS.productivity,{people:[],entries:{}}));
      const serverProd=normalizeProd(j.data.productivity);
      const localProdEmpty=localProd.people.length===0&&Object.keys(localProd.entries).length===0;
      const serverProdEmpty=serverProd.people.length===0&&Object.keys(serverProd.entries).length===0;
      if(serverProdEmpty&&!localProdEmpty){
        // 서버에는 아직 생산성 데이터가 없는데 이 기기에는 있는 경우: 예전 데이터를 지우지 않고 서버로 올려줍니다.
        pulling=false;
        pushTeamData();
        return;
      }
      const serverDefectIds=new Set((j.data.defects||[]).map(d=>d&&d.id));
      if(readLocal(KEYS.defects).some(d=>d&&d.id&&!serverDefectIds.has(d.id))){
        // 이 기기에만 있는 제품 불량 기록은 지우지 않고 서버로 올립니다(서버에서 건별로 합쳐짐).
        pulling=false;
        pushTeamData();
        return;
      }
      const cur=JSON.stringify(snapshot());
      const incoming=JSON.stringify({notices:j.data.notices||[],todos:j.data.todos||[],requests:j.data.requests||[],productivity:serverProd,defects:j.data.defects||[]});
      if(cur!==incoming){
        localStorage.setItem(KEYS.notices,JSON.stringify(j.data.notices||[]));
        localStorage.setItem(KEYS.todos,JSON.stringify(j.data.todos||[]));
        localStorage.setItem(KEYS.requests,JSON.stringify(j.data.requests||[]));
        localStorage.setItem(KEYS.productivity,JSON.stringify(serverProd));
        localStorage.setItem(KEYS.defects,JSON.stringify(j.data.defects||[]));
        window.renderTodayOutboundRequests?.();
        window.refreshOutboundRequestManager?.();
        window.populatePersonSelect?.();
        window.renderProductivity?.();
        window.renderOutboundBasic?.();
        document.dispatchEvent(new CustomEvent('team-data-updated'));
        if(typeof window.renderOpsDashboard==='function')window.renderOpsDashboard();
      }
    }catch(e){console.error('team-data pull failed',e)}
    pulling=false;
  }
  const origSetItem=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){
    origSetItem(k,v);
    if(k===KEYS.notices||k===KEYS.todos||k===KEYS.requests||k===KEYS.productivity||k===KEYS.defects)pushTeamData();
  };
  window.pullTeamData=pullTeamData;
  pullTeamData(true);
})();

