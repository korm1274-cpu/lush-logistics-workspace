/* <script> (index.html에서 그대로 옮김) */
const DATA_KEY="lush-logistics-v4-data";
const INVENTORY_KEY="lush-logistics-v4-inventory";
const MENU_KEY="lush-logistics-v4-menus";
const GROUP_KEY="lush-logistics-v4-groups";
const USER_KEY="lush-logistics-v4-users";
const HIST_KEY="lush-logistics-upload-history";
const ROLE_LABEL={admin:"관리자",leader:"팀 리더",editor:"팀원",restricted:"제한 열람"};
const DEFAULT_GROUPS=[
 {id:"dashboard",label:"메인",icon:"layout-dashboard",visible:true,protected:true},{id:"statusboard",label:"현황판",icon:"monitor-up",visible:true},{id:"inventory",label:"재고",icon:"package-search",visible:true},{id:"inbound",label:"입고",icon:"package-plus",visible:true},{id:"outbound",label:"출고",icon:"truck",visible:true},{id:"traffic",label:"트래픽",icon:"signpost",visible:true},{id:"schedule",label:"일정",icon:"calendar-days",visible:true},{id:"issues",label:"이슈",icon:"triangle-alert",visible:true},{id:"productivity",label:"생산성",icon:"gauge",visible:true},{id:"floorboard",label:"대시보드",icon:"monitor",visible:true},{id:"upload",label:"데이터",icon:"file-up",visible:true},{id:"admin",label:"Admin",icon:"settings-2",visible:true,protected:true}
];
let GROUPS=JSON.parse(localStorage.getItem(GROUP_KEY)||"null")||structuredClone(DEFAULT_GROUPS);
GROUPS=GROUPS.map(g=>({...g,visible:g.visible!==false,protected:g.id==="dashboard"||g.id==="admin"||!!g.protected,icon:g.icon||"folder"}));
for(const def of DEFAULT_GROUPS){
  if(!GROUPS.some(g=>g.id===def.id)){
    const copy=structuredClone(def);
    const prevDefaults=DEFAULT_GROUPS.slice(0,DEFAULT_GROUPS.findIndex(x=>x.id===def.id)).map(x=>x.id);
    let insertAt=-1;
    GROUPS.forEach((g,i)=>{if(prevDefaults.includes(g.id))insertAt=i});
    GROUPS.splice(insertAt+1,0,copy);
  }
}
const GROUP_MIGRATION_KEY="lush-logistics-v4-groups-v3";
if(localStorage.getItem(GROUP_MIGRATION_KEY)!=="1"){
  let outboundGroup=GROUPS.find(g=>g.id==="outbound");
  if(!outboundGroup){
    outboundGroup=structuredClone(DEFAULT_GROUPS.find(g=>g.id==="outbound"));
    const inboundIndex=GROUPS.findIndex(g=>g.id==="inbound");
    GROUPS.splice(inboundIndex>=0?inboundIndex+1:GROUPS.length,0,outboundGroup);
  }
  outboundGroup.label="출고";
  outboundGroup.icon=outboundGroup.icon||"truck";
  outboundGroup.visible=true;
  localStorage.setItem(GROUP_KEY,JSON.stringify(GROUPS));
  localStorage.setItem(GROUP_MIGRATION_KEY,"1");
}
const DEFAULT_MENUS=[
 {id:"dashboard-main",group:"dashboard",label:"메인 대시보드",kind:"view",target:"dashboard",visible:true,roles:["admin","leader","editor","restricted"],protected:true},
 {id:"status-shipping",group:"statusboard",label:"출고 현황",kind:"statusTab",target:"statusBoardView",statusTab:"shipping",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"status-productivity",group:"statusboard",label:"생산성",kind:"statusTab",target:"statusBoardView",statusTab:"productivity",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"status-storehistory",group:"statusboard",label:"매장별 처리이력",kind:"statusTab",target:"statusBoardView",statusTab:"storehistory",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"status-boxcount",group:"statusboard",label:"출고 박스",kind:"statusTab",target:"statusBoardView",statusTab:"boxcount",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"status-products",group:"statusboard",label:"제품별 출고현황",kind:"statusTab",target:"statusBoardView",statusTab:"products",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"status-outbound-analysis",group:"statusboard",label:"출고 분석",kind:"statusTab",target:"statusBoardView",statusTab:"outboundanalysis",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"inv-total",group:"inventory",label:"총 재고파일",kind:"inventoryTotal",visible:true,roles:["admin","leader","editor"]},
 {id:"inv-oos",group:"inventory",label:"품절 재고 분석",kind:"view",target:"inventoryOosView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"inv-time",group:"inventory",label:"TIME (SOILD)",kind:"inventoryOwner",owner:"TIME (SOILD)",visible:true,roles:["admin","leader","editor"]},
 {id:"in-basic",group:"inbound",label:"입고",kind:"view",target:"inboundBasicView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"in-month",group:"inbound",label:"월별 입고현황",kind:"inboundMonthly",visible:true,roles:["admin","leader","editor"]},
 {id:"in-analysis",group:"inbound",label:"입고 상세조회",kind:"view",target:"inboundAnalysis",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"out-request",group:"traffic",label:"트래픽 출고 요청",kind:"requestManager",visible:true,roles:["admin","leader","editor"]},
 {id:"out-daily",group:"outbound",label:"출고",kind:"view",target:"outboundBasicView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"out-analysis",group:"outbound",label:"출고 상세조회",kind:"view",target:"outboundAnalysis",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"out-box",group:"outbound",label:"출고 박스 관리",kind:"view",target:"outboundBoxView",visible:true,roles:["admin","leader","editor"]},
 {id:"out-season",group:"outbound",label:"FS / 시즌 출고",kind:"sheet",cat:"outbound",sheet:"FS / 시즌 출고",visible:true,roles:["admin","leader","editor"]},
 {id:"schedule-main",group:"schedule",label:"통합 일정",kind:"scheduleManager",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"schedule-notice",group:"schedule",label:"공지 등록",kind:"view",target:"noticeManagerView",visible:true,roles:["admin","leader","editor"]},
 {id:"schedule-todo",group:"schedule",label:"제품 확보 등록",kind:"view",target:"todoManagerView",visible:true,roles:["admin","leader","editor"]},
 {id:"issue-wrong",group:"issues",label:"오출고",kind:"view",target:"misshipRecordsView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"issue-damage",group:"issues",label:"파손",kind:"view",target:"damageAnalyticsView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"issue-misship-analysis",group:"issues",label:"오출고 분석",kind:"view",target:"misshipAnalyticsView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"issue-damage-insight",group:"issues",label:"파손 분석",kind:"view",target:"damageInsightView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"issue-defect",group:"issues",label:"제품 불량",kind:"view",target:"defectView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"prod-time",group:"productivity",label:"근무시간 입력",kind:"view",target:"productivityView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"floor-dash",group:"floorboard",label:"현장 대시보드",kind:"view",target:"floorDashView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"upload-main",group:"upload",label:"Excel / CSV 업로드",kind:"view",target:"upload",visible:true,roles:["admin","leader","editor"]},
 {id:"data-archive",group:"upload",label:"지난 데이터 보관함",kind:"view",target:"dataArchiveView",visible:true,roles:["admin","leader","editor","restricted"]},
 {id:"admin-main",group:"admin",label:"사용자 / 메뉴 / 권한 설정",kind:"view",target:"settings",visible:true,roles:["admin"],protected:true}
];
const INVENTORY_SEED={"owners":{"TIME (SOILD)":{"label":"TIME (SOILD)","snapshots":{"2026-08-26":{"categories":["SOLID PERFUME","LIP SCRUB","LIP BALM","LIP GLOSS JELLY","FACIAL CLEANSER","MASCARA","BUBBLE BAR","디지털 전용"],"products":[{"id":"T0017200","name":"AMERICAN CREAM (SOLID PERFUME)","category":"SOLID PERFUME","system":86,"lots":[{"date":"2026-06-26","qty":86}]},{"id":"T0017199","name":"DIRTY (SOLID PERFUME)","category":"SOLID PERFUME","system":104,"lots":[{"date":"2026-06-25","qty":33},{"date":"2026-07-07","qty":71}]},{"id":"T0017197","name":"KARMA (SOLID PERFUME)","category":"SOLID PERFUME","system":83,"lots":[{"date":"2026-06-23","qty":83}]},{"id":"T0017201","name":"LORD OF MISRULE (SOLID PERFUME)","category":"SOLID PERFUME","system":4,"lots":[{"date":"2026-06-24","qty":4}]},{"id":"T0017196","name":"LUST (SOLID PERFUME)","category":"SOLID PERFUME","system":16,"lots":[{"date":"2026-06-12","qty":16}]},{"id":"T0017204","name":"PANSY (SOLID PERFUME)","category":"SOLID PERFUME","system":263,"lots":[{"date":"2026-06-23","qty":120},{"date":"2026-07-10","qty":143}]},{"id":"T0017195","name":"ROSE JAM (SOLID PERFUME)","category":"SOLID PERFUME","system":177,"lots":[{"date":"2026-06-30","qty":42},{"date":"2026-07-14","qty":135}]},{"id":"T0017202","name":"VANILLARY (SOLID PERFUME)","category":"SOLID PERFUME","system":30,"lots":[{"date":"2026-06-24","qty":30}]},{"id":"T0017203","name":"SHADE (SOLID PERFUME)","category":"SOLID PERFUME","system":43,"lots":[{"date":"2026-05-29","qty":40},{"date":"2026-07-08","qty":3}]},{"id":"T0017198","name":"ALINA (SOLID PERFUME)","category":"SOLID PERFUME","system":133,"lots":[{"date":"2026-04-23","qty":26},{"date":"2026-06-01","qty":71},{"date":"2026-07-01","qty":36}]},{"id":"T0017190","name":"CHELSEA MORNING (SOLID PERFUME)","category":"SOLID PERFUME","system":115,"lots":[{"date":"2026-06-05","qty":67},{"date":"2026-07-03","qty":48}]},{"id":"T0017194","name":"FRESH AS (SOLID PERFUME)","category":"SOLID PERFUME","system":75,"lots":[{"date":"2026-07-01","qty":35},{"date":"2026-07-16","qty":40}]},{"id":"T0017192","name":"NO WAY TO SAY GOODBYE (SOLID PERFUME)","category":"SOLID PERFUME","system":184,"lots":[{"date":"2026-07-03","qty":66},{"date":"2026-07-13","qty":118}]},{"id":"T0017191","name":"THE BEE`S KNEES (SOLID PERFUME)","category":"SOLID PERFUME","system":160,"lots":[{"date":"2026-04-24","qty":21},{"date":"2026-06-05","qty":71},{"date":"2026-07-01","qty":68}]},{"id":"T0017193","name":"VEGAN LEATHER JACKET (SOLID PERFUME)","category":"SOLID PERFUME","system":107,"lots":[{"date":"2026-06-05","qty":48},{"date":"2026-07-03","qty":59}]},{"id":"T0011620","name":"BUBBLE GUM (LIP SCRUB)","category":"LIP SCRUB","system":68,"lots":[{"date":"2026-06-30","qty":68}]},{"id":"T0014594","name":"CHERRY (LIP SCRUB)","category":"LIP SCRUB","system":36,"lots":[{"date":"2026-06-22","qty":36}]},{"id":"T0010686","name":"HONEY (LIP SCRUB)","category":"LIP SCRUB","system":89,"lots":[{"date":"2026-06-22","qty":44},{"date":"2026-06-22","qty":45}]},{"id":"T0001371","name":"MINT JULIPS (LIP SCRUB)","category":"LIP SCRUB","system":76,"lots":[{"date":"2026-06-02","qty":76}]},{"id":"T0014494","name":"WATERMELON SUGAR (LIP SCRUB)","category":"LIP SCRUB","system":0,"lots":[]},{"id":"T0016964","name":"STICKY DATES (LIP SCRUB)","category":"LIP SCRUB","system":66,"lots":[{"date":"2026-06-23","qty":21},{"date":"2026-06-23","qty":45}]},{"id":"T0006321","name":"HONEY TRAP (LIP BALM)","category":"LIP BALM","system":12,"lots":[{"date":"2026-07-01","qty":12}]},{"id":"T0018105","name":"KEY LIME PIE 12G (LIP BALM)","category":"LIP BALM","system":58,"lots":[{"date":"2026-06-02","qty":58}]},{"id":"T0006323","name":"LIP SERVICE (LIP BALM)","category":"LIP BALM","system":51,"lots":[{"date":"2026-05-25","qty":22},{"date":"2026-06-22","qty":29}]},{"id":"T0006326","name":"ROSE LOLLIPOP (LIP BALM)","category":"LIP BALM","system":0,"lots":[]},{"id":"T0017480","name":"THE KISS (LIP GLOSS JELLY)","category":"LIP GLOSS JELLY","system":197,"lots":[{"date":"2026-05-29","qty":175},{"date":"2026-06-26","qty":22}]},{"id":"T0017481","name":"SHIMMY SHIMMY (LIP GLOSS JELLY)","category":"LIP GLOSS JELLY","system":12,"lots":[{"date":"2026-05-28","qty":12}]},{"id":"T0017482","name":"SEX BOMB (LIP GLOSS JELLY)","category":"LIP GLOSS JELLY","system":41,"lots":[{"date":"2026-05-29","qty":27},{"date":"2026-06-24","qty":14}]},{"id":"T0019102","name":"ACAI & SACHA INCHI 60G (FACIAL CLEANSER)","category":"FACIAL CLEANSER","system":0,"lots":[]},{"id":"T0019104","name":"HONEY, BEESWAX & ALMOND OIL 60G (FACIAL CLEANSER)","category":"FACIAL CLEANSER","system":0,"lots":[]},{"id":"T0019103","name":"TURMERIC & ARGAN OIL 60G (FACIAL CLEANSER)","category":"FACIAL CLEANSER","system":0,"lots":[]},{"id":"T0019105","name":"OAT 60G (CLEANSING BALM)","category":"FACIAL CLEANSER","system":0,"lots":[]},{"id":"T0016436","name":"EARTH 12g (NAKED MASCARA)","category":"MASCARA","system":25,"lots":[{"date":"2026-03-24","qty":7},{"date":"2026-04-24","qty":2},{"date":"2026-05-18","qty":16}]},{"id":"T0016435","name":"OCEAN 12g (NAKED MASCARA)","category":"MASCARA","system":31,"lots":[{"date":"2026-03-24","qty":12},{"date":"2026-05-11","qty":19}]},{"id":"T0016434","name":"ORCA 12g (NAKED MASCARA)","category":"MASCARA","system":31,"lots":[{"date":"2026-04-17","qty":11},{"date":"2026-05-18","qty":20}]},{"id":"T0016437","name":"REEF 12g (NAKED MASCARA)","category":"MASCARA","system":37,"lots":[{"date":"2026-02-12","qty":7},{"date":"2026-03-12","qty":5},{"date":"2026-03-12","qty":16},{"date":"2026-05-11","qty":9}]},{"id":"T0013672","name":"BIG BOTTLE OF CALM (REUSABLE BUBBLE BAR)","category":"BUBBLE BAR","system":0,"lots":[]},{"id":"T0013665","name":"MILKY BATH BUBBLE BOTTLE (BUBBLE BAR)_NEW","category":"BUBBLE BAR","system":385,"lots":[{"date":"2026-07-02","qty":159},{"date":"2026-07-14","qty":226}]},{"id":"T0014048","name":"RAINBOW (BUBBLE BAR)","category":"BUBBLE BAR","system":228,"lots":[{"date":"2026-07-02","qty":228}]},{"id":"T0019101","name":"29 HIGH STREET (SOLID PERFUME)","category":"디지털 전용","system":0,"lots":[]}]}}}}};
let inventoryDb=JSON.parse(localStorage.getItem(INVENTORY_KEY)||"null")||INVENTORY_SEED;
let currentInventoryOwner=null;
let currentInventoryDate=null;
function normalizeInventoryDb(){
  let changed=false;
  for(const o of Object.values(inventoryDb.owners||{})){
    for(const snap of Object.values(o.snapshots||{})){
      if(!snap.sourceMaster){snap.sourceMaster={};changed=true}
      if(!Object.prototype.hasOwnProperty.call(snap,"sourceFile")){snap.sourceFile=null;changed=true}
      if(Object.prototype.hasOwnProperty.call(snap,"groups")){delete snap.groups;changed=true}
      for(const p of (snap.products||[])){
        if(p&&p.rowType==="blank"){
          p.rowType="manual";
          p.id=p.id||"";p.name=p.name||"";p.sourceCategory="";p.category=p.category||"";p.system=invNum(p.system);p.lots=(p.lots&&p.lots.length)?p.lots:[{date:"",qty:0}];
          if(Object.prototype.hasOwnProperty.call(p,"group"))delete p.group;
          changed=true;
        }
        if(p){
          p.sourceCategory=p.sourceCategory??p.category??"";
          p.category=p.sourceCategory;
          if(Object.prototype.hasOwnProperty.call(p,"group")){delete p.group;changed=true}
        }
      }
    }
  }
  if(changed)localStorage.setItem(INVENTORY_KEY,JSON.stringify(inventoryDb));
}
normalizeInventoryDb();
const INVENTORY_ARCHIVE_KEY="lush-logistics-v4-inventory-archive";
const INVENTORY_RETENTION_DAYS=120;
function readInventoryArchive(){try{return JSON.parse(localStorage.getItem(INVENTORY_ARCHIVE_KEY)||"null")||{owners:{}}}catch{return{owners:{}}}}
function saveInventoryArchive(a){localStorage.setItem(INVENTORY_ARCHIVE_KEY,JSON.stringify(a))}
window.readInventoryArchive=readInventoryArchive;
/* 재고는 스냅샷을 매일 통째로 복제해서 저장하다 보니 오래 쓸수록 용량이 급격히 커집니다.
   현재고 화면은 항상 "최신" 스냅샷만 사용하므로, 오래된 스냅샷은 지우지 않고 보관함으로 옮겨서
   품절 분석 등 매번 자동으로 도는 계산이 최근 데이터만 훑도록 합니다. */
function archiveOldInventorySnapshots(){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-INVENTORY_RETENTION_DAYS);
  const cutoffStr=`${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,"0")}-${String(cutoff.getDate()).padStart(2,"0")}`;
  const archive=readInventoryArchive();
  let changed=false;
  for(const [owner,o] of Object.entries(inventoryDb.owners||{})){
    const dates=Object.keys(o.snapshots||{}).sort();
    if(dates.length<=1)continue;
    const latest=dates[dates.length-1];
    const toMove=dates.filter(d=>d<cutoffStr&&d!==latest);
    if(!toMove.length)continue;
    if(!archive.owners[owner])archive.owners[owner]={label:o.label||owner,snapshots:{}};
    toMove.forEach(d=>{archive.owners[owner].snapshots[d]=o.snapshots[d];delete o.snapshots[d]});
    changed=true;
  }
  if(changed){saveInventoryArchive(archive);localStorage.setItem(INVENTORY_KEY,JSON.stringify(inventoryDb))}
}
archiveOldInventorySnapshots();

const DEFAULT_USERS=[
 {name:"Time",email:"time@company.com",role:"admin",active:true},{name:"Leader",email:"leader@company.com",role:"leader",active:true},{name:"Team Member",email:"member@company.com",role:"editor",active:true},{name:"Restricted",email:"viewer@company.com",role:"restricted",active:true}
];
const DEFAULT_DATA={
 inventory:{"총 재고파일":{cols:["담당","PLU","제품명","카테고리","08/27","08/28","차이","상태","비고"],rows:[["TIME","101894","Sleepy Body Lotion","BODY","336","329","-7","확인 필요",""]] },"TIME":{cols:["PLU","제품명","카테고리","08/27","08/28","차이","비고"],rows:[["101894","Sleepy Body Lotion","BODY","336","329","-7",""]] }},
 inbound:{"일일 입고관리":{cols:["일자","차수","제품수량","SKU","투입인원","소요시간","생산성","비고"],rows:[["2026-08-28","102차","18420","128","8","3.2","719",""]]},"월별 입고현황":{cols:["월","입고수량","입고차수","평균 투입인원","평균 생산성","비고"],rows:[["2026-08","18420","1","8","719",""]]}},
 outbound:{"일일 출고관리":{cols:["일자","구분","출고수량","SKU","투입인원","소요시간","생산성","비고"],rows:[["2026-08-28","매장","31860","224","10","3.0","1062",""]]},"FS / 시즌 출고":{cols:["일자","프로젝트","매장수","수량","상태","비고"],rows:[["2026-08-28","Winter FS","32","12140","진행",""]]}},
 schedule:{"통합 일정":{cols:["일자","구분","업무명","담당자","시작","종료","상태","비고"],rows:[["2026-08-28","입고","102차 입고","TIME","09:00","12:00","완료",""]]}},
 issues:{"오출고":{cols:["일자","매장","제품","수량","금액","담당자","처리상태","비고"],rows:[["2026-08-28","강남역","Sample A","2","32000","TIME","확인중",""]]},"파손":{cols:["일자","제품","입고차수","파손수량","원인","담당자","처리상태","비고"],rows:[["2026-08-28","Sample B","102차","4","운송","BUS","확인중",""]]}}
};
let db=JSON.parse(localStorage.getItem(DATA_KEY)||"null")||structuredClone(DEFAULT_DATA);
if(db&&db.inventory){delete db.inventory.SAND; const total=db.inventory["총 재고파일"]; if(total&&Array.isArray(total.rows)) total.rows=total.rows.filter(r=>String(r?.[0]||"").toUpperCase()!=="SAND"); localStorage.setItem(DATA_KEY,JSON.stringify(db));}
let menus=JSON.parse(localStorage.getItem(MENU_KEY)||"null")||structuredClone(DEFAULT_MENUS);
function normalizeMenus(){
  let cleaned=[]; let totalSeen=false;
  for(const raw of menus){
    if(!raw||raw.id==="inv-gap"||raw.target==="inventoryAnalysis") continue;
    const m={...raw};
    if(!m.adminManaged&&m.id==="schedule-todo"&&String(m.label||"").trim()==="할 일 등록") m.label="제품 확보 등록";
    if(!m.adminManaged&&m.id==="out-request"&&String(m.label||"").trim()==="출고 요청 관리") m.label="트래픽 출고 요청";
    if(m.group==="inventory"){
      const looksTotal=m.id==="inv-total"||m.kind==="inventoryTotal"||String(m.label||"").trim()==="총 재고파일";
      if(looksTotal){
        if(totalSeen) continue;
        totalSeen=true; Object.assign(m,{id:"inv-total",group:"inventory",label:m.adminManaged?(m.label||"총 재고파일"):"총 재고파일",kind:"inventoryTotal"});
        delete m.owner; delete m.target; delete m.cat; delete m.sheet;
      }else if(m.owner||m.kind==="inventoryOwner"){
        m.kind="inventoryOwner"; m.owner=m.owner||m.label; delete m.target; delete m.cat; delete m.sheet;
      }
    }
    cleaned.push(m);
  }
  if(!totalSeen){const base=structuredClone(DEFAULT_MENUS.find(m=>m.id==="inv-total"));const firstInv=cleaned.findIndex(m=>m.group==="inventory");cleaned.splice(firstInv<0?1:firstInv,0,base)}

  /* V52: 제거 대상 메뉴는 기존 localStorage에서도 정리 */
  cleaned = cleaned.filter(m=>m.id!=="inv-sand" && m.group!=="attendance" && m.id!=="att-team" && m.id!=="issue-damage-analysis" && m.id!=="statusboard-main");

  /* V71: 기존 사용자에게도 '파손' 메뉴를 분석 화면으로 전환 */
  const damageMenu=cleaned.find(m=>m.id==="issue-damage");
  if(damageMenu){
    damageMenu.kind="view"; damageMenu.target="damageAnalyticsView"; if(!damageMenu.adminManaged)damageMenu.label="파손";
    damageMenu.roles=["admin","leader","editor","restricted"];
    delete damageMenu.cat; delete damageMenu.sheet;
  }

  /* 오출고: 직접 입력 표 대신 구글시트 연동 기록 화면으로 전환 (기존 사용자 저장 메뉴 포함) */
  const misshipMenu=cleaned.find(m=>m.id==="issue-wrong");
  if(misshipMenu&&misshipMenu.kind==="sheet"){
    misshipMenu.kind="view"; misshipMenu.target="misshipRecordsView";
    misshipMenu.roles=["admin","leader","editor","restricted"];
    delete misshipMenu.cat; delete misshipMenu.sheet;
  }

  /* V35: 이전 버전 localStorage 메뉴에도 새 기본 메뉴를 자동 추가 */
  for(const def of DEFAULT_MENUS){
    if(!cleaned.some(m=>m.id===def.id)){
      const copy=structuredClone(def);
      const sameGroupLast=cleaned.reduce((last,m,i)=>m.group===copy.group?i:last,-1);
      if(sameGroupLast>=0) cleaned.splice(sameGroupLast+1,0,copy);
      else cleaned.push(copy);
    }
  }

  /* V38: 기존 사용자에게도 통합 일정을 전용 일정 관리 화면으로 전환 */
  const scheduleMenu=cleaned.find(m=>m.id==="schedule-main");
  if(scheduleMenu){
    if(!scheduleMenu.adminManaged){scheduleMenu.group="schedule"; scheduleMenu.label="통합 일정"} scheduleMenu.kind="scheduleManager";
    scheduleMenu.visible=true; scheduleMenu.roles=["admin","leader","editor","restricted"];
    delete scheduleMenu.cat; delete scheduleMenu.sheet; delete scheduleMenu.target;
  }

  /* V72: 일일 입고관리 메뉴 제거 + 새 '입고' 메뉴 추가 (기존 사용자에게도 반영) */
  cleaned=cleaned.filter(m=>m.id!=="in-daily");
  let basicMenu=cleaned.find(m=>m.id==="in-basic");
  if(!basicMenu){
    basicMenu={id:"in-basic",group:"inbound",label:"입고",kind:"view",target:"inboundBasicView",visible:true,roles:["admin","leader","editor","restricted"]};
    const firstInboundIdx=cleaned.findIndex(m=>m.group==="inbound");
    cleaned.splice(firstInboundIdx>=0?firstInboundIdx:cleaned.length,0,basicMenu);
  }else if(!basicMenu.adminManaged){
    cleaned=cleaned.filter(m=>m.id!=="in-basic");
    const firstInboundIdx=cleaned.findIndex(m=>m.group==="inbound");
    cleaned.splice(firstInboundIdx>=0?firstInboundIdx:cleaned.length,0,basicMenu);
  }
  /* V73: 과거 기본명만 보정하고, Admin에서 사용자가 변경한 이름·위치는 유지 */
  const inAnalysisMenu2=cleaned.find(m=>m.id==="in-analysis");
  if(inAnalysisMenu2&&!inAnalysisMenu2.adminManaged){inAnalysisMenu2.label="입고 상세조회"}
  const inMonthMenu=cleaned.find(m=>m.id==="in-month");
  if(inMonthMenu){
    if(!inMonthMenu.adminManaged){inMonthMenu.group="inbound";inMonthMenu.label=inMonthMenu.label||"월별 입고현황"}
    inMonthMenu.kind="inboundMonthly";inMonthMenu.visible=true;delete inMonthMenu.cat;delete inMonthMenu.sheet;delete inMonthMenu.target;
  }

  /* V-out: '일일 출고관리' 시트 메뉴를 차수 없는 '출고' 상세화면으로 전환 (기존 사용자에게도 반영) */
  const outDailyMenu=cleaned.find(m=>m.id==="out-daily");
  if(outDailyMenu){
    if(!outDailyMenu.adminManaged)outDailyMenu.label="출고"; outDailyMenu.kind="view"; outDailyMenu.target="outboundBasicView";
    outDailyMenu.visible=true; outDailyMenu.roles=["admin","leader","editor","restricted"];
    delete outDailyMenu.cat; delete outDailyMenu.sheet;
  }

  /* V-out2: '출고 분석' -> '출고 상세조회'로 이름 변경 (기존 사용자에게도 반영) */
  const outAnalysisMenu2=cleaned.find(m=>m.id==="out-analysis");
  if(outAnalysisMenu2&&!outAnalysisMenu2.adminManaged){outAnalysisMenu2.label="출고 상세조회"}

  /* V-out3: 'FS / 시즌 출고'를 '출고 박스 관리' 바로 오른쪽(다음)으로 이동 (기존 사용자에게도 반영) */
  const seasonIndex=cleaned.findIndex(m=>m.id==="out-season");
  if(seasonIndex>=0&&!cleaned[seasonIndex].adminManaged){
    const season=cleaned.splice(seasonIndex,1)[0];
    const boxIndex=cleaned.findIndex(m=>m.id==="out-box");
    cleaned.splice(boxIndex<0?cleaned.length:boxIndex+1,0,season);
  }

  /* V-out4: 이전 Admin 테스트로 출고 기본 메뉴가 다른 대분류로 이동된 저장 상태를 1회 복구 */
  const OUTBOUND_MENU_MIGRATION_KEY="lush-logistics-v4-outbound-menu-v4";
  if(localStorage.getItem(OUTBOUND_MENU_MIGRATION_KEY)!=="1"){
    ["out-daily","out-analysis","out-box","out-season"].forEach(id=>{
      const m=cleaned.find(x=>x.id===id);
      if(m){m.group="outbound";m.visible=true;}
    });
    localStorage.setItem(OUTBOUND_MENU_MIGRATION_KEY,"1");
  }

  /* 출고 요청 관리는 새 '트래픽' 주항목의 첫 번째 메뉴로 이동 (기존 사용자에게도 반영) */
  const reqIndex=cleaned.findIndex(m=>m.id==="out-request");
  if(reqIndex>=0){
    const req=cleaned.splice(reqIndex,1)[0];
    if(!req.adminManaged){req.group="traffic";req.label="트래픽 출고 요청"} req.kind="requestManager";
    req.visible=true; req.roles=["admin","leader","editor"];
    const firstTraffic=cleaned.findIndex(m=>m.group==="traffic");
    if(req.adminManaged){const lastSame=cleaned.reduce((last,m,i)=>m.group===req.group?i:last,-1);cleaned.splice(lastSame<0?cleaned.length:lastSame+1,0,req)}
    else cleaned.splice(firstTraffic<0?cleaned.length:firstTraffic,0,req);
  }

  /* 새 메뉴 '제품 불량'을 이미 저장된 메뉴 목록에도 한 번만 추가(파손 분석 바로 아래). 이후 Admin에서 지우거나 옮겨도 다시 생기지 않음 */
  if(!localStorage.getItem("lush-menu-defect-added-v1")){
    if(!cleaned.some(m=>m.id==="issue-defect")){
      const after=cleaned.findIndex(m=>m.id==="issue-damage-insight");
      const item={id:"issue-defect",group:"issues",label:"제품 불량",kind:"view",target:"defectView",visible:true,roles:["admin","leader","editor","restricted"]};
      cleaned.splice(after<0?cleaned.length:after+1,0,item);
    }
    localStorage.setItem("lush-menu-defect-added-v1","1");
  }

  menus=cleaned;
  localStorage.setItem(MENU_KEY,JSON.stringify(menus));
}
normalizeMenus();
let users=JSON.parse(localStorage.getItem(USER_KEY)||"null")||structuredClone(DEFAULT_USERS);
let currentRole="admin",currentSheet=null,dirty=false;
function saveMenus(){localStorage.setItem(MENU_KEY,JSON.stringify(menus))} function saveGroups(){localStorage.setItem(GROUP_KEY,JSON.stringify(GROUPS))} function saveUsers(){localStorage.setItem(USER_KEY,JSON.stringify(users))} function saveDb(){localStorage.setItem(DATA_KEY,JSON.stringify(db));dirty=false;saveState.textContent="자동 저장됨";saveBadge.textContent="AUTO SAVE"}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"','&quot;')}
function toastMsg(m){toast.textContent=m;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1700)}
function canAccess(m){return currentRole==="admin"||m.roles.includes(currentRole)}
function renderNav(){
  navContainer.innerHTML="";
  const navGroups=GROUPS.slice();
  let outboundGroup=navGroups.find(g=>g.id==="outbound");
  if(!outboundGroup){
    outboundGroup={id:"outbound",label:"출고",icon:"truck",visible:true};
    const inboundIndex=navGroups.findIndex(g=>g.id==="inbound");
    navGroups.splice(inboundIndex>=0?inboundIndex+1:navGroups.length,0,outboundGroup);
  }
  outboundGroup.visible=true;
  outboundGroup.label=outboundGroup.label||"출고";
  let outboundMenus=menus.filter(m=>["out-daily","out-analysis","out-box","out-season"].includes(m.id));
  outboundMenus.filter(m=>!m.adminManaged).forEach(m=>{m.group="outbound";m.visible=true});
  navGroups.filter(g=>g.id==="outbound"||g.visible!==false).forEach((g)=>{let list=menus.filter(m=>m.group===g.id&&m.visible);if(g.id!=="admin")list=list.filter(m=>canAccess(m));else if(currentRole!=="admin")list=[];if(!list.length)return;const box=document.createElement("div");box.className="nav-group";box.dataset.group=g.id;if(g.id==="dashboard"&&list.length===1){box.classList.add("nav-group-direct");box.innerHTML=`<button class="nav-root"><span><span class="nav-root-icon"><i data-lucide="${g.icon}"></i></span>${g.label}</span></button>`;const only=list[0];box.querySelector(".nav-root").onclick=()=>activateMenu(only,box.querySelector(".nav-root"));box.querySelector(".nav-root").dataset.menuId=only.id;navContainer.appendChild(box);return}box.innerHTML=`<button class="nav-root"><span><span class="nav-root-icon"><i data-lucide="${g.icon}"></i></span>${g.label}</span><em>›</em></button><div class="nav-children"></div>`;box.querySelector(".nav-root").onclick=()=>{const willOpen=!box.classList.contains("open");navContainer.querySelectorAll(".nav-group.open").forEach(other=>{if(other!==box){other.classList.remove("open");const em=other.querySelector(":scope > .nav-root em");if(em)em.textContent="›"}});box.classList.toggle("open",willOpen);box.querySelector("em").textContent=willOpen?"⌄":"›"};const holder=box.querySelector(".nav-children");const addMenuButton=(m,target)=>{const b=document.createElement("button");b.className="nav-item";b.innerHTML=`<span class="nav-child-dot" aria-hidden="true"></span><span class="nav-child-label">${esc(m.label)}</span>`;b.dataset.menuId=m.id;b.onclick=()=>activateMenu(m,b);target.appendChild(b)};list.forEach(m=>addMenuButton(m,holder));navContainer.appendChild(box)});if(window.lucide)lucide.createIcons()}
function showView(id,title,el){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(id).classList.add("active");pageTitle.textContent=title;document.querySelectorAll(".nav-item,.nav-group-direct .nav-root").forEach(x=>x.classList.remove("active"));if(el)el.classList.add("active");currentSheet=null;if(id==="upload")renderHistory();if(id==="settings")renderAdmin();window.renderLazyViewIfNeeded?.(id)}
function syncStatusTabLabels(){menus.filter(m=>m.kind==="statusTab").forEach(m=>{const b=document.querySelector('#statusBoardView .status-board-tab[data-status-tab="'+m.statusTab+'"]');if(b)b.textContent=m.label})}
function activateMenu(m,el){if(!canAccess(m)){toastMsg("접근 권한이 없습니다.");return}window.flushBoxPendingSave?.();navContainer.querySelectorAll(".nav-group.open,.nav-folder.open").forEach(x=>x.classList.remove("open"));if(m.kind==="statusTab"){showView("statusBoardView",m.label,el);syncStatusTabLabels();const t=document.querySelector('#statusBoardView .status-board-tab[data-status-tab="'+m.statusTab+'"]');if(t)t.click()}else if(m.kind==="view")showView(m.target,m.label,el);else if(m.kind==="sheet")openSheet(m.cat,m.sheet,m.label,el);else if(m.kind==="inventoryOwner")openInventoryOwner(m.owner||m.label,m.label,el);else if(m.kind==="inventoryTotal")openInventoryTotal(m.label,el);else if(m.kind==="requestManager")openOutboundRequestManager(m.label,el);else if(m.kind==="scheduleManager")openScheduleManager(m.label,el);else if(m.kind==="inboundDaily")window.openInboundDailyView(m.label,el);else if(m.kind==="inboundMonthly")window.openInboundMonthlyView(m.label,el);else{blankTitle.textContent=m.label;showView("blankPage",m.label,el)}}
function openSheet(cat,name,label,el){if(!db[cat])db[cat]={};if(!db[cat][name])db[cat][name]={cols:["항목","내용","비고"],rows:[]};currentSheet={cat,name};document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));sheetView.classList.add("active");pageTitle.textContent=label;document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));if(el)el.classList.add("active");const group=GROUPS.find(g=>g.id===cat);crumb.innerHTML=`${group?group.label:cat} &nbsp;›&nbsp; <b>${label}</b>`;sheetTitle.textContent=label;renderSheet()}
function renderSheet(){const s=db[currentSheet.cat][currentSheet.name];thead.innerHTML="<tr><th class=rownum>#</th>"+s.cols.map(c=>`<th>${esc(c)}</th>`).join("")+`<th style="width:64px">관리</th></tr>`;tbody.innerHTML=s.rows.map((r,ri)=>"<tr><td class=rownum>"+(ri+1)+"</td>"+s.cols.map((c,ci)=>`<td><input class="cell" data-r="${ri}" data-c="${ci}" value="${esc(r[ci])}"></td>`).join("")+`<td><button class="row-delete" data-row-del="${ri}">삭제</button></td></tr>`).join("");document.querySelectorAll(".cell").forEach(i=>i.oninput=()=>{db[currentSheet.cat][currentSheet.name].rows[+i.dataset.r][+i.dataset.c]=i.value;saveDb()});document.querySelectorAll("[data-row-del]").forEach(b=>b.onclick=()=>{const ri=+b.dataset.rowDel;if(!confirm(`${ri+1}행을 삭제할까요?`))return;s.rows.splice(ri,1);saveDb();renderSheet();toastMsg("행을 삭제했습니다.")});rowCount.textContent=`${s.rows.length} rows · ${s.cols.length} columns`;saveState.textContent="자동 저장됨";saveBadge.textContent="AUTO SAVE"}
addRow.onclick=()=>{if(!currentSheet)return;const s=db[currentSheet.cat][currentSheet.name];s.rows.push(Array(s.cols.length).fill(""));saveDb();renderSheet();toastMsg("새 행을 추가했습니다.")};exportCsv.onclick=()=>{if(!currentSheet)return;const s=db[currentSheet.cat][currentSheet.name];const csv=[s.cols,...s.rows].map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");download(currentSheet.name+".csv",new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}))};
function download(name,blob){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
exportBackup.onclick=()=>download("LUSH_Logistics_Workspace_Backup.json",new Blob([JSON.stringify({db,menus,groups:GROUPS,users,inventoryDb},null,2)],{type:"application/json"}));importBackup.onclick=()=>backupInput.click();backupInput.onchange=async()=>{try{const x=JSON.parse(await backupInput.files[0].text());if(x.db)db=x.db;if(x.menus)menus=x.menus;if(Array.isArray(x.groups))GROUPS=x.groups.map(g=>({...g,visible:g.visible!==false,protected:g.id==="dashboard"||g.id==="admin"||!!g.protected,icon:g.icon||"folder"}));if(x.users)users=x.users;if(x.inventoryDb){inventoryDb=x.inventoryDb;normalizeInventoryDb();saveInventoryDb()}localStorage.setItem(DATA_KEY,JSON.stringify(db));saveMenus();saveGroups();saveUsers();renderNav();renderAdmin();toastMsg("백업 데이터를 불러왔습니다.")}catch(e){toastMsg("백업 파일 형식을 확인해주세요.")}};

function saveInventoryDb(){localStorage.setItem(INVENTORY_KEY,JSON.stringify(inventoryDb));dirty=false}
function invNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function ownerSnapshot(owner,date){const o=inventoryDb.owners[owner];return o&&o.snapshots?o.snapshots[date]:null}
function latestOwnerDate(owner){const o=inventoryDb.owners[owner];const ds=o?Object.keys(o.snapshots||{}).sort():[];return ds[ds.length-1]||""}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function ensureTodaySnapshot(owner){const o=ensureOwner(owner),today=todayKey();if(!o.snapshots[today]){const latest=latestOwnerDate(owner);const base=latest&&o.snapshots[latest]?o.snapshots[latest]:{products:[],sourceMaster:{},sourceFile:null};o.snapshots[today]=JSON.parse(JSON.stringify(base));o.snapshots[today].sourceFile=null;saveInventoryDb()}return today}
function productActual(p){return (p.lots||[]).reduce((s,l)=>s+invNum(l.qty),0)}
function productDiff(p){return productActual(p)-invNum(p.system)}
function fmtNum(v){return invNum(v).toLocaleString("ko-KR")}
function diffClass(v){return v>0?"diff-plus":v<0?"diff-minus":"diff-zero"}
function markInventoryDirty(){saveInventoryDb();if(window.inventoryAutoSave){inventoryAutoSave.textContent="자동 저장 완료";clearTimeout(window.__invSaveTimer);window.__invSaveTimer=setTimeout(()=>inventoryAutoSave.textContent="자동 저장",900)}}
function ensureOwner(owner){if(!inventoryDb.owners[owner])inventoryDb.owners[owner]={label:owner,snapshots:{}};return inventoryDb.owners[owner]}
function openInventoryOwner(owner,label,el){ensureOwner(owner);if(typeof clearInventoryUndo==="function")clearInventoryUndo();currentInventoryOwner=owner;currentInventoryDate=ensureTodaySnapshot(owner);const o=inventoryDb.owners[owner];document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));inventoryOwnerView.classList.add("active");pageTitle.textContent=label;document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));if(el)el.classList.add("active");currentSheet=null;inventoryOwnerTitle.textContent=label+" 재고";newInventoryDateValue.value=currentInventoryDate;renderInventoryDates();renderInventoryOwner()}
function renderInventoryDates(){const o=ensureOwner(currentInventoryOwner);const ds=Object.keys(o.snapshots||{}).sort().reverse();inventoryDate.innerHTML=ds.map(d=>`<option value="${d}" ${d===currentInventoryDate?"selected":""}>${d}</option>`).join("")||`<option value="${currentInventoryDate}">${currentInventoryDate}</option>`;newInventoryDateValue.value=currentInventoryDate}
function currentInventoryMaster(){const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);return snap?.sourceMaster||{}}
function lookupInventoryProduct(code){return currentInventoryMaster()[String(code||"").trim()]||null}
function reorderInventoryProduct(fromPi,toPi){
  const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);
  if(!snap||fromPi===toPi)return;
  const item=snap.products[fromPi];
  if(!item)return;
  const [moved]=snap.products.splice(fromPi,1);
  let insert=toPi;
  if(fromPi<toPi)insert--;
  snap.products.splice(Math.max(0,insert),0,moved);
  markInventoryDirty();
  renderInventoryOwner();
}
function isBlankInventoryRow(p){return !!p&&p.rowType==="manual"}
function inventoryProductRows(snap){return (snap?.products||[]).filter(Boolean)}
function renderInventoryOwner(){
  const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);
  if(!snap)return;

  if(snap.sourceFile){
    const t=new Date(snap.sourceFile.uploadedAt);
    const tm=Number.isNaN(t.getTime())?"":t.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false});
    inventorySourceFile.classList.add("uploaded");
    inventorySourceFile.innerHTML=`업로드 완료${tm?` · <b>${tm}</b>`:""}`;
  }else{
    inventorySourceFile.classList.remove("uploaded");
    inventorySourceFile.textContent="미업로드";
  }

  const rows=snap.products||[];
  let tableHtml="";
  rows.forEach((p,pi)=>{
    if(!p)return;
    const manual=isBlankInventoryRow(p);
    const actual=productActual(p);
    const diff=actual-invNum(p.system);
    const lots=(p.lots&&p.lots.length?p.lots:[{date:"",qty:""}]);
    const first=lots[0]||{date:"",qty:""};
    const codeCell=`<input data-product-code data-p="${pi}" value="${esc(p.id||"")}" placeholder="제품코드${manual?"":" 입력"}">`;
    const nameCell=manual?`<input data-manual-name data-p="${pi}" value="${esc(p.name||"")}" placeholder="제품명">`:(esc(p.name)||'<span class="muted">코드 입력 시 자동조회</span>');
    const categoryCell=manual?`<input data-manual-category data-p="${pi}" value="${esc(p.category||"")}" placeholder="카테고리">`:(esc(p.sourceCategory||p.category)||'<span class="muted">파일 기준</span>');
    const systemCell=manual?`<input class="num inventory-number-input" type="text" inputmode="numeric" data-manual-system data-p="${pi}" value="${p.system?fmtNum(p.system):""}" placeholder="0">`:fmtNum(p.system);

    tableHtml+=`<tr draggable="true" data-inventory-row="${pi}" data-product-row="${pi}" class="${manual?"manual-row":""}">
      <td class="order-cell"><span class="drag-handle" title="드래그하여 행 이동">⋮⋮</span><span class="row-number">${pi+1}</span></td>
      <td>${codeCell}</td>
      <td class="product-name">${nameCell}</td>
      <td class="source-category">${categoryCell}</td>
      <td class="num">${systemCell}</td>
      <td class="num"><b>${fmtNum(actual)}</b></td>
      <td class="num ${diffClass(diff)}">${diff>0?"+":""}${fmtNum(diff)}</td>
      <td><div class="lot-date-cell"><input type="text" inputmode="numeric" placeholder="MM/DD" autocomplete="off" data-lot-date data-p="${pi}" data-l="0" value="${esc(first.date||"")}"><span class="lot-actions"><button class="lot-inline-add" data-add-lot="${pi}" title="동일 제품 LOT 추가">＋</button><span class="lot-action-placeholder"></span></span></div></td>
      <td><input class="num inventory-number-input" type="text" inputmode="numeric" data-lot-qty data-p="${pi}" data-l="0" value="${first.qty!==""&&first.qty!=null?fmtNum(first.qty):""}" placeholder="0"></td>
    </tr>`;

    for(let li=1;li<lots.length;li++){
      const l=lots[li];
      tableHtml+=`<tr class="lot-row">
        <td class="order-cell"></td><td>↳</td><td>제조일별 재고</td><td></td><td></td><td></td><td></td>
        <td><div class="lot-date-cell"><input type="text" inputmode="numeric" placeholder="MM/DD" autocomplete="off" data-lot-date data-p="${pi}" data-l="${li}" value="${esc(l.date||"")}"><span class="lot-actions"><button class="lot-inline-add" data-add-lot="${pi}" title="동일 제품 LOT 추가">＋</button><button class="lot-inline-remove" data-del-lot="${pi}:${li}" title="해당 LOT 삭제">−</button></span></div></td>
        <td><input class="num inventory-number-input" type="text" inputmode="numeric" data-lot-qty data-p="${pi}" data-l="${li}" value="${l.qty!==""&&l.qty!=null?fmtNum(l.qty):""}" placeholder="0"></td>
      </tr>`;
    }
  });

  inventoryBody.innerHTML=tableHtml||'<tr><td colspan="9"><div class="inventory-empty">등록된 제품이 없습니다. 표 영역에서 마우스 오른쪽 버튼을 눌러 행을 추가할 수 있습니다.</div></td></tr>';
  invMetricProducts.textContent=fmtNum(rows.length);
  inventoryRowInfo.textContent=`${fmtNum(rows.length)} SKU`;
  renderInventoryMetricsOnly();
  bindInventoryInputs();
  renderInventoryHistory();
  applyInventoryColumnWidths();
}
function parseInventoryNumber(v){return invNum(String(v??"").replace(/,/g,""))}
function formatInventoryNumberInput(el){
  if(!el)return;
  const raw=String(el.value||"").replace(/,/g,"").trim();
  el.value=raw===""?"":fmtNum(parseInventoryNumber(raw));
  syncCompletedField(el);
}
function bindInventoryInputs(){
  const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);if(!snap)return;
  const commitText=e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur()}};

  inventoryBody.querySelectorAll("[data-product-code]").forEach(x=>{
    x.addEventListener("keydown",commitText);
    x.onchange=()=>{
      const p=snap.products[+x.dataset.p];if(!p)return;
      p.id=x.value.trim();
      const m=snap.sourceMaster?.[p.id];
      if(m&&!isBlankInventoryRow(p)){p.name=m.name;p.sourceCategory=m.category;p.category=m.category;p.system=m.system}
      markInventoryDirty();renderInventoryOwner();
    };
  });

  inventoryBody.querySelectorAll("[data-manual-name]").forEach(x=>{
    x.addEventListener("keydown",commitText);
    x.onchange=()=>{const p=snap.products[+x.dataset.p];if(!p)return;p.name=x.value.trim();markInventoryDirty();syncCompletedField(x)};
  });
  inventoryBody.querySelectorAll("[data-manual-category]").forEach(x=>{
    x.addEventListener("keydown",commitText);
    x.onchange=()=>{const p=snap.products[+x.dataset.p];if(!p)return;p.category=x.value.trim();p.sourceCategory="";markInventoryDirty();syncCompletedField(x)};
  });
  inventoryBody.querySelectorAll("[data-manual-system]").forEach(x=>{
    x.addEventListener("focus",()=>{x.value=String(x.value||"").replace(/,/g,"")});
    x.addEventListener("keydown",commitText);
    x.onblur=()=>{const p=snap.products[+x.dataset.p];if(!p)return;p.system=parseInventoryNumber(x.value);formatInventoryNumberInput(x);markInventoryDirty();renderInventoryMetricsOnly()};
  });

  inventoryBody.querySelectorAll("[data-lot-date]").forEach(x=>{
    x.addEventListener("keydown",commitText);
    x.onblur=()=>{
      const p=snap.products[+x.dataset.p];if(!p)return;
      const li=+x.dataset.l;
      const normalized=normalizeManufactureDate(x.value);
      if(normalized===null){x.setCustomValidity("MM/DD 또는 YYYY-MM-DD 형식으로 입력해주세요.");x.reportValidity();x.setCustomValidity("");return}
      p.lots[li].date=normalized;x.value=normalized;markInventoryDirty();syncCompletedField(x);
    };
  });

  inventoryBody.querySelectorAll("[data-lot-qty]").forEach(x=>{
    x.addEventListener("focus",()=>{x.value=String(x.value||"").replace(/,/g,"")});
    x.addEventListener("keydown",commitText);
    x.onblur=()=>{
      const p=snap.products[+x.dataset.p];if(!p)return;
      p.lots[+x.dataset.l].qty=parseInventoryNumber(x.value);
      formatInventoryNumberInput(x);markInventoryDirty();renderInventoryMetricsOnly();
    };
  });

  inventoryBody.querySelectorAll("[data-add-lot]").forEach(b=>b.onclick=()=>{const p=snap.products[+b.dataset.addLot];if(!p)return;p.lots.push({date:"",qty:0});markInventoryDirty();renderInventoryOwner()});
  inventoryBody.querySelectorAll("[data-del-lot]").forEach(b=>b.onclick=()=>{const [pi,li]=b.dataset.delLot.split(":").map(Number);const p=snap.products[pi];if(!p)return;p.lots.splice(li,1);markInventoryDirty();renderInventoryOwner()});

  let dragIndex=null;
  inventoryBody.querySelectorAll("tr[data-product-row]").forEach(tr=>{
    tr.addEventListener("dragstart",()=>{dragIndex=+tr.dataset.productRow;tr.classList.add("dragging")});
    tr.addEventListener("dragend",()=>{dragIndex=null;tr.classList.remove("dragging")});
    tr.addEventListener("dragover",e=>e.preventDefault());
    tr.addEventListener("drop",e=>{e.preventDefault();const to=+tr.dataset.productRow;if(dragIndex===null||dragIndex===to)return;reorderInventoryProduct(dragIndex,to)});
  });
}
function renderInventoryMetricsOnly(){const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);const all=(snap.products||[]),act=all.reduce((s,p)=>s+productActual(p),0),gap=all.reduce((s,p)=>s+productDiff(p),0);invMetricActual.textContent=fmtNum(act);invMetricGap.textContent=(gap>0?"+":"")+fmtNum(gap);invMetricGap.className=diffClass(gap);document.querySelectorAll("[data-product-code]").forEach(x=>{const p=(snap.products||[])[+x.dataset.p];if(!p)return;const tr=x.closest("tr"),nums=tr.querySelectorAll("td.num");if(nums[1])nums[1].innerHTML=`<b>${fmtNum(productActual(p))}</b>`;if(nums[2]){const d=productDiff(p);nums[2].className=`num ${diffClass(d)} ${d!==0?"gap-cell":""}`;nums[2].textContent=(d>0?"+":"")+fmtNum(d)}})}
inventoryDate.onchange=()=>{currentInventoryDate=inventoryDate.value;renderInventoryDates();renderInventoryOwner()};

function renderInventoryHistory(){
  const monthEl=document.getElementById("inventoryHistoryMonth");
  const dateEl=document.getElementById("inventoryHistoryDate");
  if(!monthEl||!dateEl)return;

  const dates=Object.keys(ensureOwner(currentInventoryOwner).snapshots||{}).sort().reverse();
  const months=[...new Set(dates.map(d=>d.slice(0,7)))];

  const previousMonth=monthEl.value;
  monthEl.innerHTML='<option value="">월 선택</option>'+months.map(m=>{
    const [y,mo]=m.split("-");
    return `<option value="${m}">${y}년 ${Number(mo)}월</option>`;
  }).join("");

  if(months.includes(previousMonth)) monthEl.value=previousMonth;

  const selectedMonth=monthEl.value;
  const monthDates=selectedMonth ? dates.filter(d=>d.startsWith(selectedMonth+"-")) : [];

  dateEl.innerHTML='<option value="">기준일 선택</option>'+monthDates.map(d=>{
    const [,mo,day]=d.split("-");
    return `<option value="${d}">${mo}/${day}</option>`;
  }).join("");
  dateEl.disabled=!selectedMonth;
  dateEl.value=monthDates.includes(currentInventoryDate) ? currentInventoryDate : "";
}

function switchInventoryDate(d){if(!d)return;const o=ensureOwner(currentInventoryOwner);if(!o.snapshots[d]){const latest=latestOwnerDate(currentInventoryOwner);const base=ownerSnapshot(currentInventoryOwner,latest)||{products:[],sourceMaster:{},sourceFile:null};o.snapshots[d]=JSON.parse(JSON.stringify(base));o.snapshots[d].sourceFile=null;markInventoryDirty();toastMsg(`${d.replaceAll("-",".")} 기준 재고를 생성했습니다.`)}currentInventoryDate=d;renderInventoryDates();renderInventoryOwner()}
newInventoryDateValue.onchange=()=>{clearInventoryUndo();switchInventoryDate(newInventoryDateValue.value)};
newInventoryDate.onclick=()=>switchInventoryDate(newInventoryDateValue.value);
const inventoryHistoryMonth=document.getElementById("inventoryHistoryMonth");
const inventoryHistoryDateEl=document.getElementById("inventoryHistoryDate");

inventoryHistoryMonth.onchange=()=>{
  const dates=Object.keys(ensureOwner(currentInventoryOwner).snapshots||{}).sort().reverse();
  const month=inventoryHistoryMonth.value;
  const monthDates=month ? dates.filter(d=>d.startsWith(month+"-")) : [];
  inventoryHistoryDateEl.innerHTML='<option value="">기준일 선택</option>'+monthDates.map(d=>{
    const [,mo,day]=d.split("-");
    return `<option value="${d}">${mo}/${day}</option>`;
  }).join("");
  inventoryHistoryDateEl.disabled=!month;
};

inventoryHistoryDateEl.onchange=()=>{
  if(!inventoryHistoryDateEl.value)return;
  clearInventoryUndo();
  currentInventoryDate=inventoryHistoryDateEl.value;
  renderInventoryDates();
  renderInventoryOwner();
};
uploadOwnerInventory.onclick=()=>ownerInventoryFile.click();
ownerInventoryFile.onchange=async()=>{const f=ownerInventoryFile.files?.[0];if(!f)return;try{await ensureXLSX();const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});if(!rows.length)throw new Error("empty");const headers=rows[0].map(x=>String(x||"").trim());const findCol=(names)=>headers.findIndex(h=>names.includes(h));const ciCode=findCol(["제품코드","상품코드","PLU","코드"]),ciGroup=findCol(["제품군","카테고리","상품군"]),ciName=findCol(["제품명","상품명"]),ciStock=findCol(["현재고","전산","전산재고","재고"]);if(ciCode<0||ciName<0||ciStock<0){toastMsg("파일에서 제품코드·제품명·현재고 열을 찾지 못했습니다.");ownerInventoryFile.value="";return}const master={};for(const r of rows.slice(1)){const code=String(r[ciCode]??"").trim();if(!code)continue;master[code]={id:code,name:String(r[ciName]??"").trim(),category:ciGroup>=0?String(r[ciGroup]??"").trim():"",system:invNum(r[ciStock])}}const snap=ownerSnapshot(currentInventoryOwner,currentInventoryDate);snap.sourceMaster=master;snap.sourceFile={name:f.name,uploadedAt:new Date().toISOString(),rows:Object.keys(master).length};let matched=0;for(const p of (snap.products||[])){if(isBlankInventoryRow(p))continue;const m=master[p.id];if(!m)continue;p.name=m.name;p.sourceCategory=m.category;p.category=m.category;p.system=m.system;matched++}markInventoryDirty();renderInventoryOwner();toastMsg(`${currentInventoryDate.replaceAll("-",".")} 기준 파일 ${Object.keys(master).length.toLocaleString("ko-KR")} SKU를 읽었습니다. 관리 중 ${matched} SKU를 갱신했습니다.`)}catch(e){console.error(e);toastMsg("Excel 파일을 읽는 중 오류가 발생했습니다.")}finally{ownerInventoryFile.value=""}};
function inventoryCsvRows(owner,date){
  const snap=ownerSnapshot(owner,date);
  const rows=[["담당자","기준일","카테고리","제품코드","제품명","현재고","실사","차이","제조일","수량"]];
  for(const p of (snap?.products||[])){
    const act=productActual(p),diff=act-invNum(p.system);
    if((p.lots||[]).length){
      p.lots.forEach((l,i)=>rows.push([
        owner,date,p.sourceCategory||p.category,
        i?"":p.id,i?"":p.name,i?"":p.system,i?"":act,i?"":diff,l.date,l.qty
      ]));
    }else{
      rows.push([owner,date,p.sourceCategory||p.category,p.id,p.name,p.system,act,diff,"",""]);
    }
  }
  return rows
}
exportInventoryCsv.onclick=()=>{const rows=inventoryCsvRows(currentInventoryOwner,currentInventoryDate);const csv=rows.map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");download(`${currentInventoryOwner}_${currentInventoryDate}.csv`,new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}))};
const printInventoryBtn=document.getElementById("printInventory");
if(printInventoryBtn)printInventoryBtn.onclick=()=>window.print();
function openInventoryTotal(label,el){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));inventoryTotalView.classList.add("active");pageTitle.textContent=label;document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));if(el)el.classList.add("active");currentSheet=null;renderInventoryTotalFilters();renderInventoryTotal()}
function totalRows(){const rows=[];for(const [owner,o] of Object.entries(inventoryDb.owners||{})){const date=ensureTodaySnapshot(owner);const snap=o.snapshots?.[date];for(const p of (snap?.products||[])){const actual=productActual(p),months={};for(const l of (p.lots||[])){if(!l.date)continue;const month=String(l.date).slice(0,7);if(/^\d{4}-\d{2}$/.test(month))months[month]=(months[month]||0)+invNum(l.qty)}rows.push({owner,date,category:p.sourceCategory||p.category||"",id:p.id,name:p.name,system:invNum(p.system),actual,diff:actual-invNum(p.system),months})}}return rows}
function renderInventoryTotalFilters(){const owners=Object.keys(inventoryDb.owners||{});const cats=[...new Set(totalRows().map(r=>r.category).filter(Boolean))].sort();const prevOwner=totalInventoryOwner.value||"",prevCat=totalInventoryCategory.value||"";totalInventoryOwner.innerHTML='<option value="">전체 담당자</option>'+owners.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("");totalInventoryCategory.innerHTML='<option value="">전체 제품군</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");if(owners.includes(prevOwner))totalInventoryOwner.value=prevOwner;if(cats.includes(prevCat))totalInventoryCategory.value=prevCat}
function monthlyQtyText(months){const entries=Object.entries(months||{}).sort(([a],[b])=>a>b?1:a<b?-1:0);return entries.length?entries.map(([m,q])=>`${m.slice(5)}월 ${fmtNum(q)}개`).join(" · "):"-"}
function monthlyQtyHtml(months){const entries=Object.entries(months||{}).sort(([a],[b])=>a>b?1:a<b?-1:0);return entries.length?`<div class="month-stock-wrap">${entries.map(([m,q])=>`<span class="month-stock-chip"><b>${esc(m.slice(5))}월</b><strong>${fmtNum(q)}개</strong></span>`).join("")}</div>`:`<span class="month-stock-empty">-</span>`}
function renderInventoryTotal(){const of=totalInventoryOwner.value||"",cf=totalInventoryCategory.value||"",q=(totalInventorySearch?.value||"").trim().toLowerCase();const rows=totalRows().filter(r=>(!of||r.owner===of)&&(!cf||r.category===cf)&&(!q||String(r.id||"").toLowerCase().includes(q)||String(r.name||"").toLowerCase().includes(q)));inventoryTotalBody.innerHTML=rows.length?rows.map(r=>`<tr><td><span class="inventory-total-owner">${esc(r.owner)}</span></td><td>${esc(r.id)}</td><td class="product-name">${esc(r.name)}</td><td>${esc(r.category)}</td><td class="num">${fmtNum(r.system)}</td><td class="num">${fmtNum(r.actual)}</td><td class="num ${diffClass(r.diff)} ${r.diff!==0?"gap-cell":""}">${r.diff>0?"+":""}${fmtNum(r.diff)}</td><td>${monthlyQtyHtml(r.months)}</td></tr>`).join(""):'<tr><td colspan="8"><div class="inventory-empty">취합할 재고가 없습니다.</div></td></tr>';const sku=new Set(rows.map(r=>r.id)).size,actual=rows.reduce((a,r)=>a+invNum(r.actual),0),gap=rows.reduce((a,r)=>a+Math.abs(invNum(r.diff)),0);totalMetricSku.textContent=fmtNum(sku);totalMetricActual.textContent=fmtNum(actual);totalMetricGap.textContent=fmtNum(gap);const dates=[...new Set(rows.map(r=>r.date).filter(Boolean))].sort();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const label=dates.length===1?dates[0]:(dates.length>1?`${dates[0]} ~ ${dates[dates.length-1]}`:today);totalInventoryAsOf.textContent=label;totalInventoryDateHint.textContent=dates.length>1?"담당자별 기준일 상이":`${label} 기준`;totalInventoryFootDate.textContent=`현재 표시 재고 기준: ${label}`}
totalInventoryOwner.onchange=renderInventoryTotal;totalInventoryCategory.onchange=renderInventoryTotal;totalInventorySearch.oninput=renderInventoryTotal;exportTotalCsv.onclick=()=>{const rows=[["담당자","기준일","제품군","제품코드","제품명","현재고","실사","차이","제조월별 재고"],...totalRows().map(r=>[r.owner,r.date,r.category,r.id,r.name,r.system,r.actual,r.diff,monthlyQtyText(r.months)])];const csv=rows.map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");download("총재고파일.csv",new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}))};
function renderHistory(){const hist=JSON.parse(localStorage.getItem(HIST_KEY)||"[]");uploadHistory.innerHTML=hist.length?hist.map(x=>`<div class="history-row"><span>${x.time}</span><b>${esc(x.name)}</b><span>${x.type}</span><span>${x.rows} rows</span></div>`).join(""):`<div class="muted" style="font-size:10px">아직 업로드 이력이 없습니다.</div>`}
document.querySelectorAll(".dataFile").forEach(inp=>{inp.onchange=()=>window.FILE_DATA_ENGINE?window.FILE_DATA_ENGINE.handle(inp):null});
function renderAdmin(){renderUsers();renderGroupsTable();renderMenusTable();renderPermissions();const t=document.getElementById("toggleAllPermissions"),c=document.getElementById("menuPermissionCard"),x=document.getElementById("closeAllPermissions"),g=document.getElementById("groupManagerCard"),go=document.getElementById("openGroupManager"),gc=document.getElementById("closeGroupManager");if(t&&c&&!t.dataset.bound){t.dataset.bound="1";t.onclick=()=>{c.hidden=false;g&&(g.hidden=true);c.scrollIntoView({behavior:"smooth",block:"start"})}}if(x&&c&&!x.dataset.bound){x.dataset.bound="1";x.onclick=()=>{c.hidden=true}}if(go&&g&&!go.dataset.bound){go.dataset.bound="1";go.onclick=()=>{g.hidden=false;c&&(c.hidden=true);g.scrollIntoView({behavior:"smooth",block:"start"})}}if(gc&&g&&!gc.dataset.bound){gc.dataset.bound="1";gc.onclick=()=>{g.hidden=true}}}
function renderUsers(){userRows.innerHTML=users.map((u,i)=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select class="roleSel" data-i="${i}"><option value="admin" ${u.role==="admin"?"selected":""}>관리자</option><option value="leader" ${u.role==="leader"?"selected":""}>팀 리더</option><option value="editor" ${u.role==="editor"?"selected":""}>팀원</option><option value="restricted" ${u.role==="restricted"?"selected":""}>제한 열람</option></select></td><td><span class="badge ${u.active?"":"danger"}">${u.active?"사용":"중지"}</span></td></tr>`).join("");document.querySelectorAll(".roleSel").forEach(s=>s.onchange=()=>{users[+s.dataset.i].role=s.value;saveUsers();toastMsg("사용자 역할을 변경했습니다.")})}
addUserBtn.onclick=()=>{const name=newUserName.value.trim(),email=newUserEmail.value.trim();if(!name||!email){toastMsg("이름과 이메일을 입력해주세요.");return}users.push({name,email,role:newUserRole.value,active:true});saveUsers();newUserName.value="";newUserEmail.value="";renderUsers();toastMsg("사용자를 추가했습니다.")};
function kindLabel(m){return m.kind==="statusTab"?"현황판 화면":m.kind==="sheet"?"웹 시트":m.kind==="inventoryOwner"?"재고 담당자 시트":m.kind==="inventoryTotal"?"총 재고":m.kind==="inboundDaily"?"일일 입고 자동집계":m.kind==="inboundMonthly"?"월별 입고 자동집계":m.kind==="view"?"기본 화면":"기본 페이지"}
let adminMenuGroup="statusboard";
function menuGroupOptions(selected,includeAdmin=true){return GROUPS.filter(g=>includeAdmin||g.id!=="admin").map(g=>`<option value="${g.id}" ${g.id===selected?"selected":""}>${esc(g.label)}${g.visible===false?" (숨김)":""}</option>`).join("")}
function moveGroup(id,dir){
  const p=GROUPS.findIndex(g=>g.id===id),q=p+dir;
  if(p<0||q<0||q>=GROUPS.length)return;
  [GROUPS[p],GROUPS[q]]=[GROUPS[q],GROUPS[p]];
  saveGroups();renderNav();renderGroupsTable();renderMenusTable();
}
function renderGroupsTable(){
  const holder=document.getElementById("groupManageList");if(!holder)return;
  holder.innerHTML=GROUPS.map((g,pos)=>`
    <div class="group-manage-row">
      <div class="group-order-controls">
        <button type="button" class="menu-order-btn" data-group-up="${g.id}" ${pos===0?"disabled":""}>↑</button>
        <button type="button" class="menu-order-btn" data-group-down="${g.id}" ${pos===GROUPS.length-1?"disabled":""}>↓</button>
      </div>
      <div><input aria-label="대분류명" title="대분류명" data-group-label="${g.id}" value="${esc(g.label)}" /></div>
      <div class="group-visible"><button class="toggle ${g.visible!==false?"on":""}" data-group-toggle="${g.id}" ${g.protected?"disabled":""}></button><span class="visibility-state ${g.visible!==false?"on":""}">${g.visible!==false?"ON":"OFF"}</span></div>
      <div class="group-actions">${g.protected?'<span class="muted">고정</span>':`<button class="btn remove sm" data-group-del="${g.id}">삭제</button>`}</div>
    </div>`).join("");
  holder.querySelectorAll("[data-group-label]").forEach(input=>input.onchange=()=>{
    const g=GROUPS.find(x=>x.id===input.dataset.groupLabel);if(!g)return;
    const name=input.value.trim();if(!name){input.value=g.label;return}
    g.label=name;saveGroups();renderNav();renderGroupsTable();renderMenusTable();toastMsg("대분류명을 변경했습니다.");
  });
  holder.querySelectorAll("[data-group-toggle]").forEach(btn=>btn.onclick=()=>{
    const g=GROUPS.find(x=>x.id===btn.dataset.groupToggle);if(!g||g.protected)return;
    g.visible=g.visible===false;saveGroups();renderNav();renderGroupsTable();renderMenusTable();toastMsg(g.visible?"대분류를 표시합니다.":"대분류를 숨겼습니다.");
  });
  holder.querySelectorAll("[data-group-up]").forEach(btn=>btn.onclick=()=>moveGroup(btn.dataset.groupUp,-1));
  holder.querySelectorAll("[data-group-down]").forEach(btn=>btn.onclick=()=>moveGroup(btn.dataset.groupDown,1));
  holder.querySelectorAll("[data-group-del]").forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.groupDel,g=GROUPS.find(x=>x.id===id);if(!g||g.protected)return;
    const count=menus.filter(m=>m.group===id).length;
    if(count){toastMsg(`${g.label}에 메뉴 ${count}개가 있어 삭제할 수 없습니다.`);return}
    if(!confirm(`${g.label} 대분류를 삭제할까요?`))return;
    GROUPS=GROUPS.filter(x=>x.id!==id);saveGroups();
    if(adminMenuGroup===id)adminMenuGroup=GROUPS.find(x=>!x.protected)?.id||GROUPS[0]?.id||"dashboard";
    renderNav();renderGroupsTable();renderMenusTable();toastMsg("대분류를 삭제했습니다.");
  });
}
function addGroup(){
  const input=document.getElementById("newGroupName");if(!input)return;
  const name=input.value.trim();if(!name){toastMsg("대분류명을 입력해주세요.");return}
  if(GROUPS.some(g=>g.label.trim().toLowerCase()===name.toLowerCase())){toastMsg("같은 이름의 대분류가 있습니다.");return}
  const g={id:"group-"+Date.now(),label:name,icon:"folder",visible:true,protected:false};
  const adminIndex=GROUPS.findIndex(x=>x.id==="admin");
  GROUPS.splice(adminIndex<0?GROUPS.length:adminIndex,0,g);saveGroups();input.value="";adminMenuGroup=g.id;
  renderNav();renderGroupsTable();renderMenusTable();toastMsg("대분류를 추가했습니다.");
}
setTimeout(()=>{const b=document.getElementById("addGroupBtn"),i=document.getElementById("newGroupName");if(b)b.onclick=addGroup;if(i)i.onkeydown=e=>{if(e.key==="Enter")addGroup()}},0);
function markMenuGroupAdminManaged(group){
  menus.filter(x=>x.group===group).forEach(x=>{x.adminManaged=true});
}
function moveMenuWithinGroup(id,dir){
  const m=menus.find(x=>x.id===id);if(!m)return;
  const ids=menus.filter(x=>x.group===m.group).map(x=>x.id),p=ids.indexOf(id),swap=p+dir;
  if(p<0||swap<0||swap>=ids.length)return;
  const a=menus.findIndex(x=>x.id===id),b=menus.findIndex(x=>x.id===ids[swap]);
  [menus[a],menus[b]]=[menus[b],menus[a]];
  markMenuGroupAdminManaged(m.group);
  saveMenus();renderNav();renderMenusTable();
}
function moveMenuToGroup(id,group){
  const idx=menus.findIndex(x=>x.id===id);if(idx<0)return;
  const m=menus[idx];if(m.protected)return;
  menus.splice(idx,1);m.group=group;m.adminManaged=true;
  let last=-1;menus.forEach((x,i)=>{if(x.group===group)last=i});
  menus.splice(last<0?menus.length:last+1,0,m);saveMenus();adminMenuGroup=group;renderNav();renderGroupsTable();renderMenusTable();renderPermissions();toastMsg("상위 메뉴를 이동했습니다.");
}
function renderMenusTable(){
  if(!GROUPS.some(g=>g.id===adminMenuGroup))adminMenuGroup=GROUPS[0]?.id||"dashboard";
  const tabs=document.getElementById("menuGroupTabs"),g=GROUPS.find(x=>x.id===adminMenuGroup),list=menus.filter(m=>m.group===adminMenuGroup);
  if(tabs){
    tabs.innerHTML=GROUPS.map(x=>`<button type="button" class="menu-group-tab ${x.id===adminMenuGroup?"active":""}" data-menu-group="${x.id}">${esc(x.label)}<small>${menus.filter(m=>m.group===x.id).length}</small></button>`).join("");
    tabs.querySelectorAll("[data-menu-group]").forEach(b=>b.onclick=()=>{adminMenuGroup=b.dataset.menuGroup;renderMenusTable()});
  }
  if(document.getElementById("menuGroupTitle"))document.getElementById("menuGroupTitle").textContent=(g?g.label:adminMenuGroup)+" 메뉴";
  if(document.getElementById("menuGroupCount"))document.getElementById("menuGroupCount").textContent=list.length+"개";
  menuRows.innerHTML=list.length?`<div class="menu-column-head"><span>순서</span><span>메뉴명</span><span>메뉴 활성화</span><span>대분류</span><span>접근 권한</span><span>관리</span></div>`+list.map((m,pos)=>`
    <div class="menu-simple-row" draggable="true" data-menu-drag="${m.id}">
      <div class="menu-simple-main">
        <div class="menu-order-controls">
          <span class="menu-drag-handle" title="드래그하여 순서 변경">⋮⋮</span>
          <button type="button" class="menu-order-btn" data-menu-up="${m.id}" ${pos===0?"disabled":""}>↑</button>
          <button type="button" class="menu-order-btn" data-menu-down="${m.id}" ${pos===list.length-1?"disabled":""}>↓</button>
        </div>
        <input class="menu-simple-name-input" value="${esc(m.label)}" title="${esc(m.label)}" aria-label="메뉴명" data-menu-label="${m.id}">
        <div class="menu-simple-visible">
          <div class="menu-field-body"><button class="toggle ${m.visible?"on":""}" data-menu-toggle="${m.id}"></button><span class="visibility-state ${m.visible?"on":""}">${m.visible?"ON":"OFF"}</span></div>
        </div>
        <div class="menu-inline-group">
          <select aria-label="대분류" data-menu-move="${m.id}" ${m.protected?"disabled":""}>${menuGroupOptions(m.group,true)}</select>
        </div>
        <div class="menu-inline-permissions">${["leader","editor","restricted"].map(r=>`<button type="button" class="permission-mini ${m.roles.includes(r)?"on":""}" data-menu-role-id="${m.id}" data-menu-role="${r}">${r==="leader"?"팀 리더":r==="editor"?"팀원":"제한 열람"}</button>`).join("")}</div>
        <div class="menu-inline-actions">
          ${m.protected?'<span class="muted">고정</span>':`<button class="btn remove" data-menu-del="${m.id}">삭제</button>`}
        </div>
      </div>
    </div>`).join(""):'<div class="menu-manage-empty">이 대분류에 등록된 메뉴가 없습니다.</div>';

  menuRows.querySelectorAll("[data-menu-label]").forEach(input=>{
    input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();input.blur()}};
    input.onchange=()=>{
      const m=menus.find(v=>v.id===input.dataset.menuLabel);if(!m)return;
      const next=input.value.trim();
      if(!next){input.value=m.label;toastMsg("메뉴명은 비워둘 수 없습니다.");return}
      if(next===m.label)return;
      m.label=next;m.adminManaged=true;saveMenus();renderNav();renderMenusTable();toastMsg("메뉴명을 변경했습니다.");
    };
  });
  menuRows.querySelectorAll("[data-menu-toggle]").forEach(b=>b.onclick=()=>{
    const m=menus.find(v=>v.id===b.dataset.menuToggle);if(!m)return;m.visible=!m.visible;m.adminManaged=true;saveMenus();renderNav();renderMenusTable();toastMsg(m.visible?"메뉴를 표시합니다.":"메뉴를 숨겼습니다.");
  });
  menuRows.querySelectorAll("[data-menu-del]").forEach(b=>b.onclick=()=>{
    const i=menus.findIndex(v=>v.id===b.dataset.menuDel);if(i<0)return;if(!confirm(menus[i].label+" 메뉴를 삭제할까요?"))return;
    menus.splice(i,1);saveMenus();renderNav();renderGroupsTable();renderMenusTable();renderPermissions();toastMsg("메뉴를 삭제했습니다.");
  });
  menuRows.querySelectorAll("[data-menu-up]").forEach(b=>b.onclick=()=>moveMenuWithinGroup(b.dataset.menuUp,-1));
  menuRows.querySelectorAll("[data-menu-down]").forEach(b=>b.onclick=()=>moveMenuWithinGroup(b.dataset.menuDown,1));
  menuRows.querySelectorAll("[data-menu-move]").forEach(sel=>sel.onchange=()=>moveMenuToGroup(sel.dataset.menuMove,sel.value));
  menuRows.querySelectorAll("[data-menu-role-id]").forEach(btn=>btn.onclick=()=>{
    const m=menus.find(x=>x.id===btn.dataset.menuRoleId),r=btn.dataset.menuRole;if(!m)return;
    if(m.roles.includes(r))m.roles=m.roles.filter(x=>x!==r);else m.roles.push(r);if(!m.roles.includes("admin"))m.roles.push("admin");
    m.adminManaged=true;saveMenus();renderPermissions();renderNav();renderMenusTable();toastMsg(`${m.label} 권한을 변경했습니다.`);
  });

  let dragId=null;
  menuRows.querySelectorAll("[data-menu-drag]").forEach(row=>{
    row.ondragstart=e=>{dragId=row.dataset.menuDrag;row.classList.add("dragging");if(e.dataTransfer)e.dataTransfer.effectAllowed="move"};
    row.ondragend=()=>{dragId=null;row.classList.remove("dragging")};
    row.ondragover=e=>e.preventDefault();
    row.ondrop=e=>{e.preventDefault();if(!dragId||dragId===row.dataset.menuDrag)return;const from=menus.findIndex(x=>x.id===dragId),to=menus.findIndex(x=>x.id===row.dataset.menuDrag);if(from<0||to<0)return;const moved=menus[from];if(moved.group!==adminMenuGroup)return;menus.splice(from,1);const target=menus.findIndex(x=>x.id===row.dataset.menuDrag);menus.splice(target,0,moved);markMenuGroupAdminManaged(adminMenuGroup);saveMenus();renderNav();renderMenusTable()};
  });
}
function renderPermissions(){permissionRows.innerHTML=menus.filter(m=>m.group!=="admin").map((m,i)=>{const idx=menus.indexOf(m);return `<tr><td><b>${esc(m.label)}</b></td><td><span class="badge">항상 허용</span></td>${["leader","editor","restricted"].map(r=>`<td><button class="role-pill ${m.roles.includes(r)?"on":""}" data-pidx="${idx}" data-role="${r}">${m.roles.includes(r)?"허용":"차단"}</button></td>`).join("")}</tr>`}).join("");document.querySelectorAll("[data-pidx]").forEach(b=>b.onclick=()=>{const m=menus[+b.dataset.pidx],r=b.dataset.role;if(m.roles.includes(r))m.roles=m.roles.filter(x=>x!==r);else m.roles.push(r);if(!m.roles.includes("admin"))m.roles.push("admin");saveMenus();renderPermissions();renderNav();toastMsg(`${ROLE_LABEL[r]} 권한을 변경했습니다.`)})}
document.querySelectorAll(".admin-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById("admin-"+b.dataset.admin).classList.add("active");if(b.dataset.admin==="conversion"&&typeof renderUnitConversionAdmin==="function")renderUnitConversionAdmin();const s=document.getElementById("sideSubNav");if(s&&document.getElementById("settings").classList.contains("active"))s.querySelectorAll("[data-admin]").forEach(x=>x.classList.toggle("active",x.dataset.admin===b.dataset.admin))});
rolePreview.onchange=()=>{currentRole=rolePreview.value;profileRole.textContent=`${ROLE_LABEL[currentRole]} · ${currentRole}`;renderNav();if(currentRole!=="admin"&&document.getElementById("settings").classList.contains("active"))showView("dashboard","메인",null);toastMsg(`${ROLE_LABEL[currentRole]} 권한으로 미리보기 중입니다.`)};
homeBrand.onclick=()=>showView("dashboard","메인",document.querySelector('[data-menu-id="dashboard-main"]'));

const SIDEBAR_STATE_KEY="lush-logistics-sidebar-collapsed";function isMobile(){return window.matchMedia("(max-width:900px)").matches}function closeMobileNav(){appShell.classList.remove("mobile-nav-open");navContainer.style.removeProperty("display")}function initResponsiveNav(){if(!isMobile()&&localStorage.getItem(SIDEBAR_STATE_KEY)==="1")appShell.classList.add("sidebar-collapsed");desktopSidebarBtn.onclick=()=>{if(isMobile()){const willOpen=!appShell.classList.contains("mobile-nav-open");appShell.classList.toggle("mobile-nav-open",willOpen);if(willOpen){navContainer.style.setProperty("display","flex","important")}else{navContainer.style.removeProperty("display")}return}appShell.classList.toggle("sidebar-collapsed");localStorage.setItem(SIDEBAR_STATE_KEY,appShell.classList.contains("sidebar-collapsed")?"1":"0")};sidebarOverlay.onclick=closeMobileNav;
document.addEventListener("click",e=>{
  if(!isMobile())return;
  if(!appShell.classList.contains("mobile-nav-open"))return;
  if(navContainer.contains(e.target)||desktopSidebarBtn.contains(e.target))return;
  closeMobileNav();
},true);
window.addEventListener("resize",()=>{if(!isMobile())closeMobileNav()});navContainer.addEventListener("click",e=>{if(isMobile()&&e.target.closest(".nav-item"))closeMobileNav()})}initResponsiveNav();renderNav();renderHistory();renderAdmin();if(window.lucide)lucide.createIcons();

