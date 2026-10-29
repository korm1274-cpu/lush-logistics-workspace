/* <script id="v75-team-data-sync"> (index.html에서 그대로 옮김) */
(function(){
  const TEAM_API='/api/team-data';
  const KEYS={notices:'lush-v51-notices',todos:'lush-v51-todos',requests:'lush_outbound_requests_v1',productivity:'lush-logistics-productivity-v1',defects:'lush-product-defects-v1',stock:'lush-stock-items-v1',requestsDeleted:'lush_outbound_requests_deleted_v1',noticesDeleted:'lush-v51-notices-deleted',todosDeleted:'lush-v51-todos-deleted'};
  /* 건(id)별로 합치는 목록과 그 '지운 id' 기록 키: 출고 요청·공지·제품 확보 */
  /* 메뉴 설정(Admin > 메뉴 관리) 팀 공유: { menus, groups, updatedAt, by } — 관리자만 바꿀 수 있음(서버에서도 확인) */
  const MENU_CFG_KEY='lush-menu-config-v1',MENU_KEY_LOCAL='lush-logistics-v4-menus',GROUP_KEY_LOCAL='lush-logistics-v4-groups';
  function isAdminUser(){try{const u=window.LUSH_AUTH&&window.LUSH_AUTH.user();return !!u&&u.role==='admin'}catch(e){return false}}
  function readMenuCfg(){const v=readLocalObj(MENU_CFG_KEY,null);return v&&Array.isArray(v.menus)?v:null}
  function writeMenuCfgFromLocal(){
    let ms=[],gs=null;try{ms=JSON.parse(localStorage.getItem(MENU_KEY_LOCAL)||'[]')}catch(e){}try{gs=JSON.parse(localStorage.getItem(GROUP_KEY_LOCAL)||'null')}catch(e){}
    const u=window.LUSH_AUTH&&window.LUSH_AUTH.user(),prev=readMenuCfg();
    // 한 번만 적용하는 정리 기록(migrations)은 유지 — 관리자가 다시 바꾼 메뉴 표시를 덮어쓰지 않게
    localStorage.setItem(MENU_CFG_KEY,JSON.stringify({menus:ms,groups:gs,updatedAt:new Date().toISOString(),by:u&&u.id||'',migrations:(prev&&prev.migrations)||[]}));
  }
  /* 처음 공유할 때 지금 보이는 메뉴가 그대로 유지되도록 권한 칸을 옮겨 담음:
     관리자(leader) = Admin 외 전체, 팀원(editor) = 관리자가 보는 메뉴 전체, 게스트(restricted) = 메인·현황판만 */
  function migrateRoles(list){
    return (list||[]).map(m=>{
      if(!m||m.group==='admin')return m;
      const r=new Set(m.roles||[]);r.add('admin');r.add('leader');r.add('editor');
      if(m.group==='dashboard'||m.group==='statusboard')r.add('restricted');else r.delete('restricted');
      return Object.assign({},m,{roles:['admin','leader','editor','restricted'].filter(x=>r.has(x))});
    });
  }
  function applyMenuCfg(cfg){
    try{
      origSetItem(MENU_CFG_KEY,JSON.stringify(cfg));
      origSetItem(MENU_KEY_LOCAL,JSON.stringify(cfg.menus));
      if(cfg.groups)origSetItem(GROUP_KEY_LOCAL,JSON.stringify(cfg.groups));
      try{menus=cfg.menus}catch(e){}
      try{if(cfg.groups)GROUPS=cfg.groups}catch(e){}
      try{if(typeof normalizeMenus==='function')normalizeMenus()}catch(e){}
      try{if(typeof renderNav==='function')renderNav()}catch(e){}
      try{const s=document.getElementById('settings');if(s&&s.classList.contains('active')&&typeof renderAdmin==='function')renderAdmin()}catch(e){}
    }catch(e){}
  }
  /* 팀 공유 메뉴 설정에 한 번만 적용하는 정리(적용한 이름을 cfg.migrations에 남겨, 이후 Admin에서 다시 바꾼 설정은 그대로 둠)
     - issues-defect-only-v1: 대분류 '이슈'는 보이게, 그 안의 오출고·파손·오출고 분석·파손 분석은 숨기고 제품 불량만 보이게
     관리자가 열면 적용 후 서버로 공유, 팀원은 관리자가 공유하기 전까지 이 기기에서만 같은 모양으로 보이게 */
  const MENU_MIGRATIONS=[{id:'issues-defect-only-v1',run:function(cfg){
    (cfg.groups||[]).forEach(function(g){if(g&&g.id==='issues')g.visible=true});
    var hide={'issue-wrong':1,'issue-damage':1,'issue-misship-analysis':1,'issue-damage-insight':1};
    (cfg.menus||[]).forEach(function(m){if(!m)return;if(hide[m.id])m.visible=false;if(m.id==='issue-defect')m.visible=true});
  }}];
  function applyMenuMigrations(){
    try{
      var cfg=readMenuCfg(),local=false;
      if(!cfg){local=true;var ms=[],gs=null;try{ms=JSON.parse(localStorage.getItem(MENU_KEY_LOCAL)||'[]')}catch(e){}try{gs=JSON.parse(localStorage.getItem(GROUP_KEY_LOCAL)||'null')}catch(e){}cfg={menus:ms,groups:gs,migrations:JSON.parse(localStorage.getItem('lush-menu-migrations-local')||'[]')}}
      var done=Array.isArray(cfg.migrations)?cfg.migrations:[],todo=MENU_MIGRATIONS.filter(function(x){return done.indexOf(x.id)<0});
      if(!todo.length)return;
      todo.forEach(function(x){x.run(cfg)});
      var ids=done.concat(todo.map(function(x){return x.id}));
      if(local){origSetItem('lush-menu-migrations-local',JSON.stringify(ids));origSetItem(MENU_KEY_LOCAL,JSON.stringify(cfg.menus));if(cfg.groups)origSetItem(GROUP_KEY_LOCAL,JSON.stringify(cfg.groups));try{menus=cfg.menus;if(cfg.groups)GROUPS=cfg.groups;if(typeof renderNav==='function')renderNav()}catch(e){}return}
      if(isAdminUser()){
        // 관리자: 표시를 남기고 최신 시각으로 저장 → localStorage 저장이 서버 공유(pushTeamData)로 이어짐
        var u=window.LUSH_AUTH&&window.LUSH_AUTH.user();
        cfg.migrations=ids;cfg.updatedAt=new Date().toISOString();cfg.by=u&&u.id||cfg.by||'';
        applyMenuCfg(cfg);localStorage.setItem(MENU_CFG_KEY,JSON.stringify(cfg));
      }else{
        // 팀원: 이 기기에서만 같은 모양으로(공유 설정 시각은 그대로 두어, 관리자가 공유한 설정이 오면 그걸 따름)
        applyMenuCfg(cfg);
      }
    }catch(e){}
  }
  const MERGE_LISTS=[['requests','requestsDeleted'],['notices','noticesDeleted'],['todos','todosDeleted']];
  function readLocal(k){try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
  function readLocalObj(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return(v&&typeof v==='object'&&!Array.isArray(v))?v:def}catch{return def}}
  function normalizeProd(v){const d={people:[],entries:{}};if(!v||typeof v!=='object')return d;return{people:Array.isArray(v.people)?v.people:[],entries:(v.entries&&typeof v.entries==='object')?v.entries:{}}}
  function snapshot(){return {notices:readLocal(KEYS.notices),todos:readLocal(KEYS.todos),requests:readLocal(KEYS.requests),productivity:normalizeProd(readLocalObj(KEYS.productivity,{people:[],entries:{}})),defects:readLocal(KEYS.defects),stock:readLocal(KEYS.stock),menuConfig:readMenuCfg()||undefined,requestsDeleted:readLocal(KEYS.requestsDeleted),noticesDeleted:readLocal(KEYS.noticesDeleted),todosDeleted:readLocal(KEYS.todosDeleted)}}
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
      /* 이 기기에만 있고 서버에서 지운 기록도 없는 건(제품 불량·출고 요청·공지·제품 확보)은 지우지 않고,
         서버에서 받은 내용에 붙여 화면에 바로 보여 준 뒤 서버로도 올립니다(서버에서 건별로 합쳐짐).
         (예전에는 이런 건이 있으면 받은 내용을 반영하지 않고 넘어가서, 다른 기기에서 등록한 건이 바로 안 보였음) */
      const sd=Object.assign({},j.data);let needPush=false;
      {const ids=new Set((sd.defects||[]).map(d=>d&&d.id));const lo=readLocal(KEYS.defects).filter(d=>d&&d.id&&!ids.has(d.id));if(lo.length){sd.defects=(sd.defects||[]).concat(lo);needPush=true}}
      {const ids=new Set((sd.stock||[]).map(d=>d&&d.id));const lo=readLocal(KEYS.stock).filter(d=>d&&d.id&&!ids.has(d.id));if(lo.length){sd.stock=(sd.stock||[]).concat(lo);needPush=true}}
      MERGE_LISTS.forEach(([k,dk])=>{
        const ids=new Set((sd[k]||[]).map(r=>r&&r.id)),del=new Set(sd[dk]||[]);
        const lo=readLocal(KEYS[k]).filter(r=>r&&r.id&&!ids.has(r.id)&&!del.has(r.id));
        if(lo.length){sd[k]=(sd[k]||[]).concat(lo);needPush=true}
      });
      /* 메뉴 설정: 서버 것이 더 최신이면 적용 / 서버에 아직 없고 관리자면 지금 메뉴(권한 옮겨 담음)를 처음 공유 */
      {const sc=j.data.menuConfig,lc=readMenuCfg();
        if(sc&&Array.isArray(sc.menus)){if(!lc||String(sc.updatedAt||'')>String(lc.updatedAt||''))applyMenuCfg(sc)}
        else if(isAdminUser()){
          try{const ms=migrateRoles(JSON.parse(localStorage.getItem(MENU_KEY_LOCAL)||'[]'));origSetItem(MENU_KEY_LOCAL,JSON.stringify(ms));try{menus=ms}catch(e){}}catch(e){}
          writeMenuCfgFromLocal();try{if(typeof renderNav==='function')renderNav()}catch(e){}
        }
        applyMenuMigrations();}
      const cur=JSON.stringify(snapshot());
      const incoming=JSON.stringify({notices:sd.notices||[],todos:sd.todos||[],requests:sd.requests||[],productivity:serverProd,defects:sd.defects||[],stock:sd.stock||[],requestsDeleted:sd.requestsDeleted||[],noticesDeleted:sd.noticesDeleted||[],todosDeleted:sd.todosDeleted||[]});
      if(cur!==incoming){
        applyingServer=true;
        try{
        localStorage.setItem(KEYS.notices,JSON.stringify(sd.notices||[]));
        localStorage.setItem(KEYS.todos,JSON.stringify(sd.todos||[]));
        localStorage.setItem(KEYS.requests,JSON.stringify(sd.requests||[]));
        localStorage.setItem(KEYS.productivity,JSON.stringify(serverProd));
        localStorage.setItem(KEYS.defects,JSON.stringify(sd.defects||[]));
        localStorage.setItem(KEYS.stock,JSON.stringify(sd.stock||[]));
        localStorage.setItem(KEYS.requestsDeleted,JSON.stringify(sd.requestsDeleted||[]));
        localStorage.setItem(KEYS.noticesDeleted,JSON.stringify(sd.noticesDeleted||[]));
        localStorage.setItem(KEYS.todosDeleted,JSON.stringify(sd.todosDeleted||[]));
        }finally{applyingServer=false}
        if(needPush)pushTeamData();
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
    if(k===KEYS.notices||k===KEYS.todos||k===KEYS.requests||k===KEYS.productivity||k===KEYS.defects||k===KEYS.stock||k===MENU_CFG_KEY)pushTeamData();
  };
  window.pullTeamData=pullTeamData;
  /* 관리자가 메뉴 관리에서 저장(saveMenus·saveGroups)하면 공유 메뉴 설정도 갱신 → 서버로 */
  ['saveMenus','saveGroups'].forEach(fn=>{const o=window[fn];if(typeof o!=='function')return;window[fn]=function(){const r=o.apply(this,arguments);if(isAdminUser())writeMenuCfgFromLocal();return r}});
  pullTeamData(true);
  /* 화면을 오래 켜 두면(특히 PC) 처음 열 때만 받아서 다른 기기에서 등록한 공지·요청이 안 보이던 문제:
     화면이 보이는 동안 1분마다, 그리고 다른 창/앱을 보다 돌아올 때마다 새로 받음.
     앞서 저장이 실패해 받기가 멈춘 상태면 먼저 저장을 다시 시도(성공하면 다음부터 정상적으로 받음) */
  function refreshWhenVisible(){
    if(document.visibilityState!=='visible')return;
    if(window.__teamPushFailed){if(Date.now()-(window.__lastRetryPush||0)>30000){window.__lastRetryPush=Date.now();attemptPush(0)}return}
    pullTeamData(true);
  }
  setInterval(refreshWhenVisible,60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshWhenVisible()});
  window.addEventListener('focus',refreshWhenVisible);
})();

