/* <script id="v75-team-data-sync"> (index.html에서 그대로 옮김) */
(function(){
  const TEAM_API='/api/team-data';
  const KEYS={notices:'lush-v51-notices',todos:'lush-v51-todos',requests:'lush_outbound_requests_v1',productivity:'lush-logistics-productivity-v1',defects:'lush-product-defects-v1',requestsDeleted:'lush_outbound_requests_deleted_v1',noticesDeleted:'lush-v51-notices-deleted',todosDeleted:'lush-v51-todos-deleted'};
  /* 건(id)별로 합치는 목록과 그 '지운 id' 기록 키: 출고 요청·공지·제품 확보 */
  const MERGE_LISTS=[['requests','requestsDeleted'],['notices','noticesDeleted'],['todos','todosDeleted']];
  function readLocal(k){try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
  function readLocalObj(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return(v&&typeof v==='object'&&!Array.isArray(v))?v:def}catch{return def}}
  function normalizeProd(v){const d={people:[],entries:{}};if(!v||typeof v!=='object')return d;return{people:Array.isArray(v.people)?v.people:[],entries:(v.entries&&typeof v.entries==='object')?v.entries:{}}}
  function snapshot(){return {notices:readLocal(KEYS.notices),todos:readLocal(KEYS.todos),requests:readLocal(KEYS.requests),productivity:normalizeProd(readLocalObj(KEYS.productivity,{people:[],entries:{}})),defects:readLocal(KEYS.defects),requestsDeleted:readLocal(KEYS.requestsDeleted),noticesDeleted:readLocal(KEYS.noticesDeleted),todosDeleted:readLocal(KEYS.todosDeleted)}}
  const LAST_SAVE_KEY='__team_data_last_local_save__';
  let pushTimer=null,pulling=false,applyingServer=false;
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
    pushTimer=setTimeout(()=>{pushTimer=null;attemptPush(0)},900);
  }
  /* 저장 직후 앱을 내리거나 화면을 끄면(특히 휴대폰) 0.9초 뒤 올리기 전에 멈춰 저장이 사라질 수 있어,
     화면이 가려지는 순간 기다리던 저장을 바로 올립니다(keepalive: 페이지가 닫혀도 전송 마무리). */
  function flushPendingPush(){
    if(!pushTimer)return;
    clearTimeout(pushTimer);pushTimer=null;
    const body=JSON.stringify(snapshot());
    if(body.length<60000){
      try{fetch(TEAM_API,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).then(r=>r.json()).then(j=>{if(j&&j.success){markLocalSave();window.__teamPushFailed=false}}).catch(()=>attemptPush(1));return}catch(e){}
    }
    attemptPush(0);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingPush()});
  window.addEventListener('pagehide',flushPendingPush);
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
      // 출고 요청·공지·제품 확보: 이 기기에만 있고 서버에서 지운 기록도 없는 건은 지우지 않고 서버로 올립니다(서버에서 건별로 합쳐짐).
      const hasLocalOnly=MERGE_LISTS.some(([k,dk])=>{
        const ids=new Set((j.data[k]||[]).map(r=>r&&r.id)),del=new Set(j.data[dk]||[]);
        return readLocal(KEYS[k]).some(r=>r&&r.id&&!ids.has(r.id)&&!del.has(r.id));
      });
      if(hasLocalOnly){
        pulling=false;
        pushTeamData();
        return;
      }
      const cur=JSON.stringify(snapshot());
      const incoming=JSON.stringify({notices:j.data.notices||[],todos:j.data.todos||[],requests:j.data.requests||[],productivity:serverProd,defects:j.data.defects||[],requestsDeleted:j.data.requestsDeleted||[],noticesDeleted:j.data.noticesDeleted||[],todosDeleted:j.data.todosDeleted||[]});
      if(cur!==incoming){
        applyingServer=true;
        try{
        localStorage.setItem(KEYS.notices,JSON.stringify(j.data.notices||[]));
        localStorage.setItem(KEYS.todos,JSON.stringify(j.data.todos||[]));
        localStorage.setItem(KEYS.requests,JSON.stringify(j.data.requests||[]));
        localStorage.setItem(KEYS.productivity,JSON.stringify(serverProd));
        localStorage.setItem(KEYS.defects,JSON.stringify(j.data.defects||[]));
        localStorage.setItem(KEYS.requestsDeleted,JSON.stringify(j.data.requestsDeleted||[]));
        localStorage.setItem(KEYS.noticesDeleted,JSON.stringify(j.data.noticesDeleted||[]));
        localStorage.setItem(KEYS.todosDeleted,JSON.stringify(j.data.todosDeleted||[]));
        }finally{applyingServer=false}
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
    /* 출고 요청·공지·제품 확보를 이 기기에서 저장할 때(서버에서 받은 내용으로 바꾸는 경우 제외)
       - 지운 건: id를 따로 기록해 서버에 알려 줌 → 서버가 건별로 합칠 때 다시 살아나지 않음
       - 새로 생기거나 내용이 바뀐 건: updatedAt을 지금 시각으로 → 서버가 더 최근 수정본을 고를 수 있음 */
    const ml=!applyingServer&&MERGE_LISTS.find(([lk])=>KEYS[lk]===k);
    if(ml){
      try{
        const dk=KEYS[ml[1]];
        const beforeArr=readLocal(k),beforeMap=new Map(beforeArr.filter(r=>r&&r.id).map(r=>[r.id,r]));
        const strip=r=>{const o=Object.assign({},r);delete o.updatedAt;return JSON.stringify(o)};
        let arr=null;try{const a=JSON.parse(v||'[]');arr=Array.isArray(a)?a:null}catch(e){}
        if(arr){
          const now=new Date().toISOString();let touched=false;
          arr.forEach(r=>{if(!r||!r.id)return;const p=beforeMap.get(r.id);if((!p||strip(p)!==strip(r))&&(!p||r.updatedAt===p.updatedAt||!r.updatedAt)){r.updatedAt=now;touched=true}});
          if(touched)v=JSON.stringify(arr);
          const keep=new Set(arr.map(r=>r&&r.id).filter(Boolean)),removed=[...beforeMap.keys()].filter(id=>!keep.has(id));
          if(removed.length){const del=readLocal(dk);removed.forEach(id=>{if(!del.includes(id))del.push(id)});origSetItem(dk,JSON.stringify(del.slice(-2000)))}
        }
      }catch(e){}
    }
    origSetItem(k,v);
    if(k===KEYS.notices||k===KEYS.todos||k===KEYS.requests||k===KEYS.productivity||k===KEYS.defects)pushTeamData();
  };
  window.pullTeamData=pullTeamData;
  pullTeamData(true);
})();

