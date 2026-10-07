/* <script id="file-data-engine"> (index.html에서 그대로 옮김) */
(function(){
  const STORE_KEY='lush-logistics-file-datasets-v2';
  /* 제품군/제품명 목록이 수천 개일 때 매번 a.localeCompare(b,'ko')로 정렬하면 비교마다 로케일 객체를
     새로 만들어서 눈에 띄게 느려집니다. 하나만 만들어 재사용하면 훨씬 빠릅니다. */
  const KO_COLLATOR=new Intl.Collator('ko');
  const LEGACY_KEY='lush-logistics-file-datasets-v1';
  const ARCHIVE_KEY='lush-logistics-data-archive-v1';
  const HIST_KEY_LOCAL=(typeof HIST_KEY!=='undefined'?HIST_KEY:'lush-logistics-upload-history');
  const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const SHARED_API='/api/shared-data';
  /* 공유 데이터(입고·출고·오출고·파손·출고박스 등, 약 2.4MB)는 localStorage(사이트당 약 5MB)에 담기에 너무 커서
     저장 공간 부족이 생겼습니다. 이제는 메모리(__mem)를 기준으로 쓰고, 브라우저 IndexedDB(수백 MB 이상)에 보관합니다.
     - 처음 열 때 IndexedDB에서 불러오고(hydrate), 예전 localStorage 사본이 있으면 IndexedDB로 옮긴 뒤 지워 공간을 비웁니다.
     - IndexedDB를 쓸 수 없는 브라우저에서는 예전처럼 localStorage에 저장합니다. */
  const IDB_NAME='lush-logistics-store',IDB_STORE='kv';
  let __mem=null,__memVersion=0,__hydrated=false,__idbOk=false;
  let __readCacheRaw=null,__readCacheObj=null; // (예전 코드 호환용)
  function idbOpen(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('IndexedDB 미지원'));const r=indexedDB.open(IDB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(IDB_STORE))r.result.createObjectStore(IDB_STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  function idbGet(k){return idbOpen().then(db=>new Promise((res,rej)=>{const q=db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}))}
  function idbSet(k,v){return idbOpen().then(db=>new Promise((res,rej)=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)}))}
  function readLocalCopy(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null')||JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')}catch{return null}}
  const read=()=>{if(!__mem)__mem=readLocalCopy()||{};return __mem};
  function persist(d){
    if(__idbOk)return idbSet(STORE_KEY,d).catch(e=>{console.error('IndexedDB 저장 실패:',e);window.showSyncIssue?.('이 브라우저에 데이터를 저장하지 못했습니다. 화면과 서버에는 반영되며, 계속되면 담당자에게 알려주세요.')});
    try{localStorage.setItem(STORE_KEY,JSON.stringify(d))}catch(e){console.error('로컬 저장 실패(저장 공간 부족 가능):',e);window.showSyncIssue?.('이 브라우저의 저장 공간이 부족해 데이터를 이 PC에 저장하지 못했습니다. 화면과 서버에는 반영되며, 계속되면 담당자에게 알려주세요.')}
    return Promise.resolve();
  }
  // 화면 데이터를 바꾸는 곳(pull 등)에서 쓰는 공통 진입점
  function setData(d){__mem=d;__memVersion++;return persist(d)}
  const __ready=(async()=>{
    const startVersion=__memVersion;
    try{
      let v=await idbGet(STORE_KEY);__idbOk=true;
      if(!v||typeof v!=='object'){const local=readLocalCopy();if(local){v=local;await idbSet(STORE_KEY,local)}}
      if(v&&__memVersion===startVersion)__mem=v;
      try{localStorage.removeItem(STORE_KEY);localStorage.removeItem(LEGACY_KEY)}catch{}
    }catch(e){console.warn('IndexedDB를 쓸 수 없어 localStorage로 저장합니다:',e);__idbOk=false}
    __hydrated=true;
    const rerender=()=>{try{renderAll()}catch(e){console.error(e)}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rerender);else rerender();
  })();
  const readArchive=()=>{try{return JSON.parse(localStorage.getItem(ARCHIVE_KEY)||'{}')||{}}catch{return{}}};
  const saveArchive=a=>localStorage.setItem(ARCHIVE_KEY,JSON.stringify(a));
  function save(d){
    // 불러오기 전(빈 데이터)에 저장이 일어나 서버의 공유 데이터를 빈 값으로 덮어쓰는 일이 없도록 막음
    if(!__hydrated&&(!d||!Object.keys(d).length))return;
    setData(d);
    // 단가표는 자주 바뀌지 않고 용량이 커서, 매번 서버로 동기화되는 공유 데이터에서는 제외하고 이 기기에만 저장합니다.
    // (서버 저장 용량 한도를 아끼기 위함이며, 단가표는 각 기기에서 직접 업로드해서 씁니다.)
    const{priceList,...shared}=d;
    if(Object.keys(readObHashes()).length){const{outbound,...rest}=shared;pushSharedData(rest);pushOutboundMonths(outbound)}
    else pushSharedData(shared);
  }

  /* 출고 데이터에 '제품군' 컬럼이 새로 추가되어 기존 5컬럼 형식의 출고 데이터는 더 이상 맞지 않으므로 한 번만 자동으로 비웁니다. */
  (function migrateOutboundSchema(){
    const DONE_KEY='lush-outbound-schema-migrated-v1';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      if(d&&d.outbound&&Array.isArray(d.outbound.header)&&d.outbound.header.length<6){
        delete d.outbound;
        save(d);
      }
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  /* 출고 원본의 '제품군' 칸 위치가 여러 번 바뀌면서, 예전에 잘못된 위치로 읽어들인 데이터가
     계속 남아 제품군 자리에 제품명이 섞여 보이는 문제가 있었습니다. 이번에 한 번만,
     출고 원본 데이터만 깨끗하게 비웁니다. (전에 업로드해주신 과거 요약 데이터나 다른 데이터는
     그대로 두며, 출고 엑셀 파일을 다시 업로드하시면 이번에 고친 방식으로 다시 정확하게 채워집니다.)*/
  (function resetOutboundDataOnce(){
    const DONE_KEY='lush-outbound-data-reset-v3';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      if(d.outbound){delete d.outbound;save(d)}
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  /* 출고를 앞으로 구글시트 자동연동으로 받기로 하면서, 엑셀로 올렸던 출고 원본 상세 데이터는 정리합니다.
     월별 요약(outboundMonthlySummary)은 절대 건드리지 않고 그대로 남깁니다. */
  (function clearOutboundRawForSheetsSyncOnce(){
    const DONE_KEY='lush-outbound-cleared-for-sheets-sync-v1';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      if(d.outbound){delete d.outbound;save(d)}
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  /* 입고 데이터 구조에 '팔렛수' 칸이 새로 추가되면서, 예전 형식(팔렛수 없이 저장된) 입고 원본은
     칸 위치가 한 칸씩 밀려 보이게 됩니다. 입고도 곧 구글시트 자동연동으로 받을 예정이라,
     기존 입고 원본만 한 번 비웁니다. 월별 요약(inboundMonthlySummary)은 그대로 둡니다. */
  (function clearInboundRawForPalletFieldOnce(){
    const DONE_KEY='lush-inbound-cleared-for-pallet-field-v1';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      if(d.inbound){delete d.inbound;save(d)}
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  /* 입고는 출고와 달리 별도로 수동 입력해둔 과거 요약이 없고, 이제부터는 구글시트 자동연동이
     매일 새로 계산해서 채워주므로, 예전(엑셀 업로드 시절) 형식으로 남아있던 월별 요약을
     한 번 깨끗하게 비웁니다. 앞으로는 시트 동기화가 알아서 다시 채웁니다. */
  (function clearInboundSummaryForSheetsSyncOnce(){
    const DONE_KEY='lush-inbound-summary-cleared-for-sheets-sync-v1';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      if(d.inboundMonthlySummary){delete d.inboundMonthlySummary;save(d)}
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  let __sharedSyncing=false;
  let __suppressPullUntil=0;
  function pushSharedData(d){
    __suppressPullUntil=Date.now()+4000;
    fetch(SHARED_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
      .then(r=>r.json())
      .then(j=>{if(!j||!j.success)console.error('공유 저장 실패:',j&&j.error)})
      .catch(err=>console.error('공유 저장 실패:',err))
      .finally(()=>{__suppressPullUntil=Date.now()+2000});
  }
  /* 동기화 실패를 조용히 넘기지 않도록 화면 위쪽에 알림 띠를 띄움 (성공하면 자동으로 사라짐).
     자동 동기화(5분마다)도 같은 띠를 쓰므로, 실패가 계속되면 사용자가 바로 알 수 있음 */
  function showSyncIssue(msg){
    let bar=document.getElementById('syncIssueBar');
    if(!bar){bar=document.createElement('div');bar.id='syncIssueBar';bar.setAttribute('role','alert');bar.style.cssText='position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:10050;max-width:min(720px,calc(100vw - 32px));background:#fff4f4;color:#9b1c1c;border:1.5px solid #f3b4b4;border-radius:12px;padding:10px 40px 10px 14px;font-size:13px;font-weight:700;line-height:1.5;box-shadow:0 8px 24px rgba(20,30,40,.14)';bar.innerHTML='<span></span><button type="button" aria-label="닫기" style="position:absolute;right:8px;top:6px;border:0;background:transparent;font-size:16px;cursor:pointer;color:#9b1c1c">×</button>';bar.querySelector('button').onclick=()=>bar.remove();document.body.appendChild(bar)}
    bar.querySelector('span').textContent=msg;
  }
  function clearSyncIssue(){document.getElementById('syncIssueBar')?.remove()}
  window.showSyncIssue=showSyncIssue;window.clearSyncIssue=clearSyncIssue;
  // 반환값: 'updated' | 'same' | 'memory'(저장 공간 부족으로 이번 접속에서만 표시) | 'busy' | 'error'
  /* ── 출고는 달(YYYY-MM)별로 따로 저장(api/outbound.js) ──
     공유 데이터 한 덩어리에 출고까지 넣으면 크기 한도(약 4.5MB)를 넘게 되어, 출고만 달별로 나눠 둡니다.
     화면은 '목록표'(달마다 지문 hash)를 먼저 받고, 이 기기에 없는 달·바뀐 달만 새로 받아 합칩니다.
     합친 결과는 예전과 같은 모양(read().outbound.rows)이라 출고를 쓰는 화면들은 그대로 동작합니다. */
  /* var: 이 아래보다 먼저 실행되는 저장(save)에서도 쓰일 수 있어 선언을 끌어올림 */
  var OUTBOUND_API='/api/outbound',OB_HASH_KEY='lush-outbound-month-hashes-v1';
  var __lastObRef=null;
  function obHash(rows){const s=JSON.stringify(rows||[]);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)+':'+(rows||[]).length}
  function obSplit(rows){const m={};(rows||[]).forEach(r=>{const k=String((r&&r[0])||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(k))(m[k]=m[k]||[]).push(r)});return m}
  function readObHashes(){try{return JSON.parse(localStorage.getItem(OB_HASH_KEY)||'{}')||{}}catch{return{}}}
  function writeObHashes(h){try{localStorage.setItem(OB_HASH_KEY,JSON.stringify(h))}catch{}}
  // 서버의 달별 출고를 받아 merged.outbound를 채움. 달별 저장소가 아직 없으면 false(예전 방식 그대로 둠)
  async function attachOutbound(merged){
    const r=await fetch(OUTBOUND_API,{cache:'no-store'});
    if(!r.ok)throw new Error('출고 목록표 HTTP '+r.status);
    const j=await r.json(),idx=(j&&j.index)||{},months=idx.months||{},keys=Object.keys(months).sort();
    if(!keys.length)return false;
    const cur=read().outbound,local=cur&&Array.isArray(cur.rows)?obSplit(cur.rows):{},known=readObHashes(),got={},need=[];
    keys.forEach(k=>{if(local[k]&&known[k]===months[k].hash)got[k]=local[k];else need.push(k)});
    for(let i=0;i<need.length;i+=3){
      const part=need.slice(i,i+3);
      const res=await Promise.all(part.map(k=>fetch(OUTBOUND_API+'?month='+encodeURIComponent(k),{cache:'no-store'}).then(x=>{if(!x.ok)throw new Error('출고 '+k+' HTTP '+x.status);return x.json()})));
      res.forEach((g,n)=>{got[part[n]]=Array.isArray(g&&g.rows)?g.rows:[]});
    }
    const rows=[];keys.forEach(k=>{const a=got[k]||[];for(let i=0;i<a.length;i++)rows.push(a[i])});
    const meta=idx.meta||{};
    merged.outbound={header:meta.header||['출고일자','제품코드','제품군','제품명','단위','수량'],rows,updatedAt:meta.updatedAt||'',sourceFile:meta.sourceFile||'',mode:meta.mode||''};
    const h={};keys.forEach(k=>{h[k]=months[k].hash});writeObHashes(h);
    __lastObRef=merged.outbound;
    return true;
  }
  // 이 기기에서 출고를 바꾼 경우(출고 Excel 업로드 등) 바뀐 달만 서버에 올림
  var __obPushing=false;
  async function pushOutboundMonths(outbound){
    if(!outbound||!Array.isArray(outbound.rows)||outbound===__lastObRef||__obPushing)return;
    __obPushing=true;__suppressPullUntil=Date.now()+15000;
    try{
      const known=readObHashes(),parts=obSplit(outbound.rows),meta={sourceFile:outbound.sourceFile||'',mode:outbound.mode||''};
      for(const k of Object.keys(parts).sort()){
        const hash=obHash(parts[k]);if(known[k]===hash)continue;
        const r=await fetch(OUTBOUND_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month:k,rows:parts[k],meta})});
        const j=await r.json().catch(()=>null);
        if(!r.ok||!j||!j.success)throw new Error((j&&j.error)||('HTTP '+r.status));
        known[k]=hash;writeObHashes(known);
      }
      __lastObRef=outbound;
    }catch(e){console.error('출고 달별 저장 실패:',e);window.showSyncIssue?.('출고 데이터를 서버에 저장하지 못했습니다: '+(e&&e.message||e)+' — 잠시 후 다시 업로드해주세요.')}
    finally{__obPushing=false;__suppressPullUntil=Date.now()+2000}
  }
  window.LUSH_OUTBOUND_STORE={active:()=>Object.keys(readObHashes()).length>0};

  async function pullSharedData(silent){
    if(__sharedSyncing)return'busy';
    // 처음 불러오기(IndexedDB)가 끝나기 전에 받으면 이 기기에만 있는 단가표를 잃을 수 있어 먼저 기다림
    await __ready;
    if(Date.now()<__suppressPullUntil){if(!silent)toastMsg('방금 저장한 내용이 서버에 반영되는 중입니다. 잠시 후 다시 시도해주세요.');return'busy'}
    __sharedSyncing=true;
    try{
      const res=await fetch(SHARED_API,{cache:'no-store'});
      if(!res.ok){showSyncIssue(`팀 공유 데이터 동기화 실패: 서버 응답 오류 (HTTP ${res.status}). 잠시 후 동기화 버튼을 다시 눌러주세요.`);return'error'}
      const j=await res.json();
      if(j&&j.success&&j.data){
        const localPriceList=read().priceList;
        const current=JSON.stringify(read());
        const merged=localPriceList?{...j.data,priceList:localPriceList}:{...j.data};
        // 출고: 달별 저장소에서 받아 붙임(실패하면 이 기기에 있던 출고를 그대로 씀)
        try{await attachOutbound(merged)}catch(e){console.error('출고 달별 불러오기 실패:',e);if(!merged.outbound&&read().outbound)merged.outbound=read().outbound}
        const incoming=JSON.stringify(merged);
        if(current!==incoming){
          const status='updated';
          setData(merged);
          renderAll();
          clearSyncIssue();
          if(!silent&&status==='updated')toastMsg('팀 공유 데이터를 최신 상태로 불러왔습니다.');
          return status;
        }
        clearSyncIssue();
        if(!silent)toastMsg('이미 최신 상태입니다. (서버에 저장된 데이터와 동일)');
        return'same';
      }
      showSyncIssue('팀 공유 데이터 동기화 실패: 서버에 공유 데이터가 없습니다. 담당자에게 알려주세요.');
      return'error';
    }catch(err){
      console.error('공유 데이터 불러오기 실패:',err);
      showSyncIssue('팀 공유 데이터 동기화 실패: '+(err?.message||'네트워크 오류')+' — 인터넷 연결을 확인한 뒤 동기화 버튼을 다시 눌러주세요.');
      return'error';
    }finally{
      __sharedSyncing=false;
    }
  }

  window.pullSharedData=pullSharedData;
  const normDate=v=>{if(v===null||v===undefined||v==='')return'';if(v instanceof Date&&!isNaN(v))return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(v);const t=String(v).trim();const m=t.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(t);return isNaN(d)?t:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
  const num=v=>{const n=Number(String(v??'').replaceAll(',','').replace(/[₩원]/g,'').trim());return Number.isFinite(n)?n:0};
  const fillMerged=(rows,idxs)=>{const last={};return rows.map(r=>{const x=[...r];idxs.forEach(i=>{if(x[i]!==''&&x[i]!=null)last[i]=x[i];else if(last[i]!==undefined)x[i]=last[i]});return x})};
  /* 오출고 업로드도 구글시트 '오출고'를 내려받은 파일 형식으로 받아 시트 연동과 같은 행 형식으로 변환
     (api/sync-misship-sheet.js의 MISSHIP_COLUMNS와 동일: H열 '정리 문장'은 제외) */
  const MISSHIP_COLUMNS=[['접수시각',0],['점포|매장',1],['제품명',2],['전산',3],['실입고',4],['미입고',5],['과입고',6],['담당자',8],['처리여부',9],['처리일',10],['처리내용',12],['사유',13]];
  const cleanMisship=rows=>{
    const nz=s=>String(s??'').replace(/\s+/g,'');
    const hi=rows.findIndex(r=>r.some(x=>nz(x)==='접수시각'));
    const header=hi>=0?rows[hi].map(nz):[];
    const idx=MISSHIP_COLUMNS.map(([names,fb])=>{const i=header.findIndex(h=>names.split('|').includes(h));return i>=0?i:fb});
    return rows.slice(hi+1).map(r=>idx.map(i=>r[i]instanceof Date?r[i]:String(r[i]??'').trim())).filter(r=>/^\d{4}-\d{2}-\d{2}/.test(normDate(r[0]))&&(r[1]||r[2]));
  };
  /* 파손 업로드도 구글시트 '입고 파손'을 내려받은 파일 형식으로 받아 시트 연동(api/sync-damage-sheet.js)과 같은 행으로 변환.
     저장 행: [No, 기안 작성 일자, 매장명, 출고 방식, 제품명, (미사용), 파손 수량, 파손 합계, 제품군, 담당자]
     열은 헤더 이름으로 찾고, 병합된 No.·일자·매장명·출고 방식은 위 품목 값을 이어받음 */
  const DAMAGE_COLUMNS=[[0,'No.|No|번호',0],[1,'기안작성일자|작성일자|일자',1],[2,'매장명|매장',2],[3,'출고방식',3],[4,'제품명',4],[6,'파손수량',8],[7,'파손합계|파손금액',9],[8,'제품군',11],[9,'담당자',12]];
  const cleanDamage=rows=>{
    const nz=s=>String(s??'').replace(/\s+/g,'');
    const hi=rows.findIndex(r=>r.some(x=>nz(x)==='기안작성일자')||(r.some(x=>nz(x)==='매장명')&&r.some(x=>nz(x)==='제품명')));
    if(hi<0)return fillMerged(rows.map(r=>r.slice(0,10)),[0,1,2,3]).filter(r=>r[4]); // 예전 업로드 형식
    const header=rows[hi].map(nz);
    const idx=DAMAGE_COLUMNS.map(([,names,fb])=>{const i=header.findIndex(h=>names.split('|').includes(h));return i>=0?i:fb});
    const out=[];let last=null;
    rows.slice(hi+1).forEach(r=>{
      const row=['','','','','','',0,0,'',''];
      DAMAGE_COLUMNS.forEach(([o],k)=>{const v=r[idx[k]];row[o]=v instanceof Date?v:String(v??'').trim()});
      if(!row[4])return;
      if(last)[0,1,2,3].forEach(o=>{if(row[o]===''||row[o]==null)row[o]=last[o]});
      if(!/^\d{4}-\d{2}-\d{2}/.test(normDate(row[1])))return;
      row[6]=num(row[6]);row[7]=num(row[7]);
      out.push(row);last=row;
    });
    return out;
  };
  const upsertByDate=(existing,incoming,dateIndex=0)=>{const dates=new Set(incoming.map(r=>normDate(r[dateIndex])));return (existing||[]).filter(r=>!dates.has(normDate(r[dateIndex]))).concat(incoming)};
  const upsertByKey=(existing,incoming,keyFn)=>{const keys=new Set(incoming.map(r=>keyFn(r)).filter(k=>k!==''&&k!=null));return (existing||[]).filter(r=>{const k=keyFn(r);return !(k!==''&&k!=null&&keys.has(k))}).concat(incoming)};
  /* 18개월보다 오래된 행은 지우지 않고 별도 보관함으로 옮겨서, 평소 화면은 최근 데이터만 빠르게 처리하도록 합니다. */
  function splitByRetention(rows,dateIdx,months=18){
    if(dateIdx==null||!Array.isArray(rows)||!rows.length)return{recent:rows,old:[]};
    const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-months);
    const cutoffStr=`${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
    const recent=[],old=[];
    rows.forEach(r=>{
      const d=normDate(r[dateIdx]);
      if(!d||d>=cutoffStr)recent.push(r);else old.push(r);
    });
    return{recent,old};
  }
  function archiveOldRows(key,header,mergedRows,dateIdx){
    const{recent,old}=splitByRetention(mergedRows,dateIdx);
    if(old.length){
      const archive=readArchive();
      if(!archive[key])archive[key]={header,rows:[]};
      archive[key].header=header;
      archive[key].rows=upsertByDate(archive[key].rows||[],old,dateIdx);
      saveArchive(archive);
    }
    return recent;
  }
  /* 이미 쌓여있던 18개월 이전 데이터도 한 번만 보관함으로 옮겨서, 지금 당장 화면 속도를 개선합니다. (삭제 아님) */
  (function archiveExistingOldDataOnce(){
    const DONE_KEY='lush-data-archive-migrated-v1';
    try{
      if(localStorage.getItem(DONE_KEY))return;
      const d=read();
      const dateIdxByKey={inbound:0,outbound:0,box:0,misship:0,damage:1};
      let changed=false;
      Object.entries(dateIdxByKey).forEach(([key,dateIdx])=>{
        const entry=d[key];
        if(!entry||!Array.isArray(entry.rows)||!entry.rows.length)return;
        const recent=archiveOldRows(key,entry.header,entry.rows,dateIdx);
        if(recent.length!==entry.rows.length){entry.rows=recent;changed=true}
      });
      if(changed)save(d);
      localStorage.setItem(DONE_KEY,'1');
    }catch(e){}
  })();
  const fmt=n=>num(n).toLocaleString('ko-KR'); const ym=d=>normDate(d).slice(0,7); const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function eaEquivQty(r){
    const u=inboundUnit(r);
    if(u==='EA')return num(r[7]);
    if(u==='G'){const f=PRODUCT_EA_CONVERSION[String(r[3]||'').trim()];return f?num(r[7])/f:0;}
    return 0;
  }
  function monthStats(rows,qtyFn){
    const cur=today().slice(0,7),a=(rows||[]).filter(r=>ym(r[0])===cur);
    return{count:new Set(a.map(r=>normDate(r[0])).filter(Boolean)).size,qty:a.reduce((z,r)=>z+qtyFn(r),0),rows:a.length,ym:cur};
  }
  function renderDashboard(){if($('dashboardMonth')&&!$('dashboardMonth').textContent){const n=new Date();$('dashboardMonth').textContent=`${n.getFullYear()}년 ${n.getMonth()+1}월`}const d=read(),i=monthStats(d.inbound?.rows,eaEquivQty),o=monthStats(d.outbound?.rows,r=>num(r[outboundColIndex().qty]));if($('fileInboundCount'))$('fileInboundCount').textContent=fmt(i?.count);if($('fileInboundQty'))$('fileInboundQty').textContent=fmt(Math.round(i?.qty||0));if($('fileOutboundCount'))$('fileOutboundCount').textContent=fmt(o?.count);if($('fileOutboundQty'))$('fileOutboundQty').textContent=fmt(Math.round(o?.qty||0));if($('fileInboundFoot'))$('fileInboundFoot').textContent=i?.rows?`${i.ym} · 누적 ${fmt(i.rows)}행`:'파일 업로드 데이터 누적';if($('fileOutboundFoot'))$('fileOutboundFoot').textContent=o?.rows?`${o.ym} · 누적 ${fmt(o.rows)}행`:'파일 업로드 데이터 누적'}
  function trendHtml(rows,qtyIdx=4){const map={};(rows||[]).forEach(r=>{const m=ym(r[0]);if(m)map[m]=(map[m]||0)+num(r[qtyIdx])});const arr=Object.entries(map).sort().slice(-12),max=Math.max(1,...arr.map(x=>x[1]));return arr.length?arr.map(([m,v])=>`<div class="mini-bar-row"><span>${m}</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Math.max(2,v/max*100)}%"></div></div><b class="mini-bar-value">${fmt(v)}</b></div>`).join(''):'<div class="data-empty">업로드된 데이터가 없습니다.</div>'}
  function inboundUnit(r){return String(r[6]||'').trim().toUpperCase()}
  window.inboundUnit=inboundUnit;
  function renderInboundBasic(){
    if(!$('ibQtyG'))return;
    const d=read(),all=d.inbound?.rows||[];
    const start=$('ibStart')?.value||'',end=$('ibEnd')?.value||'';
    const batchQ=($('ibBatchQuery')?.value||'').trim().toLowerCase();
    const q=($('ibQuery')?.value||'').trim().toLowerCase();
    const rows=all.filter(r=>{
      const rd=normDate(r[0]);
      return(!start||rd>=start)&&(!end||rd<=end)
        &&(!batchQ||String(r[1]||'').toLowerCase().includes(batchQ))
        &&(!q||String(r[3]||'').toLowerCase().includes(q)||String(r[5]||'').toLowerCase().includes(q));
    });
    /* 입고 행 형식: [입고일자, 차수, 팔렛수, 제품코드, 제품군, 제품명, 단위, 수량] (구글시트 연동 기준) */
    const gRows=rows.filter(r=>inboundUnit(r)==='G'),eaRows=rows.filter(r=>inboundUnit(r)==='EA');
    const gTotal=gRows.reduce((a,r)=>a+num(r[7]),0);
    const eaTotal=eaRows.reduce((a,r)=>a+num(r[7]),0);
    const gConvertedToEA=gRows.reduce((a,r)=>{const factor=PRODUCT_EA_CONVERSION[String(r[3]||'').trim()];return factor?a+num(r[7])/factor:a},0);
    $('ibQtyTotal').textContent=fmt(Math.round(eaTotal+gConvertedToEA));
    $('ibQtyG').textContent=fmt(gTotal);
    $('ibQtyEA').textContent=fmt(eaTotal);
    $('ibSkuG').textContent=fmt(new Set(gRows.map(r=>String(r[3]||'')).filter(Boolean)).size);
    $('ibSkuEA').textContent=fmt(new Set(eaRows.map(r=>String(r[3]||'')).filter(Boolean)).size);
    $('ibBatch').textContent=fmt(new Set(rows.map(r=>String(r[1]||'')).filter(Boolean)).size);
    const map={};
    rows.forEach(r=>{
      const key=normDate(r[0])+'|'+String(r[1]||'');
      if(!map[key])map[key]={date:normDate(r[0]),batch:r[1]||'',pallets:0,skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0};
      // 같은 차수의 팔렛수는 행마다 반복 기재되므로 더하지 않고 한 번만 반영
      if(r[2]!==''&&r[2]!=null)map[key].pallets=num(r[2]);
      const u=inboundUnit(r);
      if(r[3]&&u==='G')map[key].skusG.add(String(r[3]));
      if(r[3]&&u==='EA')map[key].skusEA.add(String(r[3]));
      if(u==='G'){
        map[key].qtyG+=num(r[7]);
        const factor=PRODUCT_EA_CONVERSION[String(r[3]||'').trim()];
        if(factor)map[key].qtyTotalEA+=num(r[7])/factor;
      }else if(u==='EA'){
        map[key].qtyEA+=num(r[7]);
        map[key].qtyTotalEA+=num(r[7]);
      }
    });
    const entries=Object.values(map).sort((a,b)=>b.date>a.date?1:b.date<a.date?-1:0);
    $('ibBody').innerHTML=entries.length?entries.map(e=>`<tr><td>${esc(e.date)}</td><td>${esc(e.batch)}</td><td class="num">${fmt(e.pallets)}</td><td class="num">${fmt(Math.round(e.qtyTotalEA))}</td><td class="num">${fmt(e.skusG.size)}</td><td class="num">${fmt(e.skusEA.size)}</td><td class="num">${fmt(e.qtyG)}</td><td class="num">${fmt(e.qtyEA)}</td></tr>`).join(''):'<tr><td colspan="8" class="data-empty">데이터가 없습니다.</td></tr>';
  }
  const OUT_LABOR_KEY='lush-logistics-outbound-labor-v1';
  function getOutLabor(){try{return JSON.parse(localStorage.getItem(OUT_LABOR_KEY)||'{}')||{}}catch{return{}}}
  function setOutLabor(v){localStorage.setItem(OUT_LABOR_KEY,JSON.stringify(v))}
  function outboundColIndex(headerOverride){
    const header=headerOverride||(read().outbound?.header)||[];
    const norm=s=>String(s||'').replace(/\s+/g,'');
    const find=(...labels)=>{
      for(const lbl of labels){
        const i=header.findIndex(h=>norm(h)===norm(lbl));
        if(i>=0)return i;
      }
      for(const lbl of labels){
        const i=header.findIndex(h=>norm(h).includes(norm(lbl)));
        if(i>=0)return i;
      }
      return -1;
    };
    const date=find('출고일','일자','날짜');
    const code=find('제품코드','코드','PLU');
    const category=find('제품군','카테고리','제품분류','분류');
    const name=find('제품명');
    const unit=find('단위');
    const qty=find('수량');
    const store=find('매장명','매장','출고처','거래처');
    return{
      date:date>=0?date:0,
      code:code>=0?code:1,
      category:category>=0?category:2,
      name:name>=0?name:3,
      unit:unit>=0?unit:4,
      qty:qty>=0?qty:5,
      store:store
    };
  }
  window.outboundColIndex=outboundColIndex;
  function outboundUnit(r,cols){return String(r[(cols||outboundColIndex()).unit]||'').trim().toUpperCase()}
  function priceColIndex(header){
    const norm=s=>String(s||'').replace(/\s+/g,'');
    const find=(...labels)=>{
      for(const lbl of labels){
        const i=(header||[]).findIndex(h=>norm(h)===norm(lbl));
        if(i>=0)return i;
      }
      for(const lbl of labels){
        const i=(header||[]).findIndex(h=>norm(h).includes(norm(lbl)));
        if(i>=0)return i;
      }
      return -1;
    };
    const code=find('제품코드','코드','PLU');
    const price=find('단가');
    return{code:code>=0?code:0,price:price>=0?price:10};
  }
  function getPriceMap(){
    const pl=read().priceList;
    if(!pl||!Array.isArray(pl.rows))return{};
    const cols=priceColIndex(pl.header||[]);
    const map={};
    pl.rows.forEach(r=>{
      const code=String(r[cols.code]||'').trim();
      if(!code)return;
      map[code]=num(r[cols.price]);
    });
    return map;
  }
  function shiftMonth(m,delta){
    const parts=m.split('-').map(Number);
    const d=new Date(parts[0],parts[1]-1+delta,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  /* 출고 데이터에서 월별 요약(SKU/수량/금액)을 미리 계산해 저장해둡니다.
     이렇게 하면 화면을 열 때마다(자동 동기화 포함) 원본 데이터 전체를 다시 훑지 않고,
     이 작은 요약표만 읽어서 바로 증감률까지 보여줄 수 있어 훨씬 가볍고 빠릅니다.
     제품군·검색으로 필터링해서 볼 때만 원본 데이터를 그때그때 다시 계산합니다. */
  function computeOutboundMonthlySummary(rows,cols,priceMap){
    const map={};
    rows.forEach(r=>{
      const m=ym(r[cols.date]);if(!m)return;
      if(!map[m])map[m]={skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0,amountEA:0,amountG:0};
      const u=outboundUnit(r,cols);
      const code=String(r[cols.code]||'').trim();
      const price=priceMap[code]||0;
      if(code&&u==='G')map[m].skusG.add(code);
      if(code&&u==='EA')map[m].skusEA.add(code);
      if(u==='G'){
        map[m].qtyG+=num(r[cols.qty]);
        const factor=PRODUCT_EA_CONVERSION[code];
        if(factor){
          const eaEquiv=num(r[cols.qty])/factor;
          map[m].qtyTotalEA+=eaEquiv;
          map[m].amountG+=eaEquiv*price;
        }
      }else if(u==='EA'){
        map[m].qtyEA+=num(r[cols.qty]);
        map[m].qtyTotalEA+=num(r[cols.qty]);
        map[m].amountEA+=num(r[cols.qty])*price;
      }
    });
    const out={};
    Object.entries(map).forEach(([m,v])=>{
      out[m]={skuG:v.skusG.size,skuEA:v.skusEA.size,qtyG:v.qtyG,qtyEA:v.qtyEA,qtyTotalEA:v.qtyTotalEA,amountEA:v.amountEA,amountG:v.amountG};
    });
    return out;
  }
  function rebuildOutboundMonthlySummary(){
    const d=read();
    const rows=d.outbound?.rows||[];
    const cols=outboundColIndex(d.outbound?.header);
    const priceMap=getPriceMap();
    const freshSummary=computeOutboundMonthlySummary(rows,cols,priceMap);
    // 이미 보관함으로 옮겨진(예전) 달의 요약은 그대로 두고, 지금 남아있는 최근 데이터에 해당하는 달만 새로 계산해 덮어씁니다.
    d.outboundMonthlySummary={...(d.outboundMonthlySummary||{}),...freshSummary};
    save(d);
  }
  /* 입고 쪽도 출고와 동일한 방식(단가 곱해서 금액, 월별 요약 미리 계산해서 저장)으로 처리합니다. */
  function computeInboundMonthlySummary(rows,priceMap){
    const map={};
    rows.forEach(r=>{
      const m=ym(r[0]);if(!m)return;
      if(!map[m])map[m]={batches:new Set(),batchPallets:new Map(),skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0,amountEA:0,amountG:0};
      if(r[1]){map[m].batches.add(String(r[1]));if(r[2]!==''&&r[2]!=null)map[m].batchPallets.set(String(r[1]),num(r[2]))}
      const u=inboundUnit(r);
      const code=String(r[3]||'').trim();
      const price=priceMap[code]||0;
      if(code&&u==='G')map[m].skusG.add(code);
      if(code&&u==='EA')map[m].skusEA.add(code);
      if(u==='G'){
        map[m].qtyG+=num(r[7]);
        const factor=PRODUCT_EA_CONVERSION[code];
        if(factor){
          const eaEquiv=num(r[7])/factor;
          map[m].qtyTotalEA+=eaEquiv;
          map[m].amountG+=eaEquiv*price;
        }
      }else if(u==='EA'){
        map[m].qtyEA+=num(r[7]);
        map[m].qtyTotalEA+=num(r[7]);
        map[m].amountEA+=num(r[7])*price;
      }
    });
    const out={};
    Object.entries(map).forEach(([m,v])=>{
      let pallets=0; v.batchPallets.forEach(p=>pallets+=p);
      out[m]={batches:v.batches.size,pallets,skuG:v.skusG.size,skuEA:v.skusEA.size,qtyG:v.qtyG,qtyEA:v.qtyEA,qtyTotalEA:v.qtyTotalEA,amountEA:v.amountEA,amountG:v.amountG};
    });
    return out;
  }
  function rebuildInboundMonthlySummary(){
    const d=read();
    const rows=d.inbound?.rows||[];
    const priceMap=getPriceMap();
    const freshSummary=computeInboundMonthlySummary(rows,priceMap);
    d.inboundMonthlySummary={...(d.inboundMonthlySummary||{}),...freshSummary};
    save(d);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    try{
      const d=read();
      const FIX_KEY='lush-inbound-summary-init-v1';
      if(d.inbound?.rows?.length&&(!d.inboundMonthlySummary||!localStorage.getItem(FIX_KEY))){
        rebuildInboundMonthlySummary();
        localStorage.setItem(FIX_KEY,'1');
      }
    }catch(e){}
  });
  /* 원본 출고 데이터 없이 '요약값'만으로 과거 달을 채워 넣는 기능입니다.
     같은 달에 실제 출고 원본이 나중에 업로드되면 rebuildOutboundMonthlySummary()가
     그 달을 다시 계산해 덮어쓰므로, 가져온 요약값보다 원본 데이터가 항상 우선합니다. */
  function summaryColIndex(header){
    const norm=s=>String(s||'').replace(/\s+/g,'');
    const find=(...labels)=>{
      for(const lbl of labels){const i=(header||[]).findIndex(h=>norm(h)===norm(lbl));if(i>=0)return i}
      for(const lbl of labels){const i=(header||[]).findIndex(h=>norm(h).includes(norm(lbl)));if(i>=0)return i}
      return -1;
    };
    return{
      month:find('월'),
      skuEA:find('SKU(EA)'),
      skuG:find('SKU(G)'),
      qtyEA:find('출고량(EA)'),
      qtyG:find('출고량(G)'),
      qtyTotal:find('출고량합계'),
      amountEA:find('출고금액(EA)'),
      amountG:find('출고금액(G)'),
      amountTotal:find('출고금액합계')
    };
  }
  function normalizeMonthLabel(v){
    const s=String(v||'').trim();
    const m=s.match(/(\d{4})[.\-\/년]?\s*(\d{1,2})/);
    if(!m)return'';
    return`${m[1]}-${String(+m[2]).padStart(2,'0')}`;
  }
  function importOutboundMonthlySummary(header,rows){
    const cols=summaryColIndex(header);
    const d=read();
    const summary=d.outboundMonthlySummary||{};
    const outCols=outboundColIndex(d.outbound?.header);
    const rawMonths=new Set((d.outbound?.rows||[]).map(r=>ym(r[outCols.date])).filter(Boolean));
    let count=0,skipped=0;
    rows.forEach(r=>{
      const m=normalizeMonthLabel(r[cols.month]);
      if(!m)return;
      if(rawMonths.has(m)){skipped++;return} // 실제 출고 원본이 이미 있는 달은 그쪽 계산이 우선이라 덮어쓰지 않습니다.
      const skuEA=num(r[cols.skuEA]),skuG=num(r[cols.skuG]);
      const qtyEA=num(r[cols.qtyEA]),qtyG=num(r[cols.qtyG]);
      const amountEA=num(r[cols.amountEA]),amountG=num(r[cols.amountG]);
      const qtyTotalEA=cols.qtyTotal>=0&&r[cols.qtyTotal]!==''?num(r[cols.qtyTotal]):qtyEA+qtyG;
      summary[m]={skuG,skuEA,qtyG,qtyEA,qtyTotalEA,amountEA,amountG};
      count++;
    });
    d.outboundMonthlySummary=summary;
    save(d);
    return{count,skipped};
  }
  document.addEventListener('DOMContentLoaded',()=>{
    try{
      const d=read();
      const FIX_KEY='lush-outbound-summary-colfix-v3';
      if(d.outbound?.rows?.length&&(!d.outboundMonthlySummary||!localStorage.getItem(FIX_KEY))){
        rebuildOutboundMonthlySummary();
        localStorage.setItem(FIX_KEY,'1');
      }
    }catch(e){}
  });
  function renderOutboundBasic(){
    if(!$('obQtyG'))return;
    const d=read(),all=d.outbound?.rows||[];
    const cols=outboundColIndex();
    const start=$('obStart')?.value||'',end=$('obEnd')?.value||'';
    const q=($('obQuery')?.value||'').trim().toLowerCase();
    const rows=all.filter(r=>{
      const rd=normDate(r[cols.date]);
      return(!start||rd>=start)&&(!end||rd<=end)
        &&(!q||String(r[cols.code]||'').toLowerCase().includes(q)||String(r[cols.name]||'').toLowerCase().includes(q));
    });
    const gRows=rows.filter(r=>outboundUnit(r,cols)==='G'),eaRows=rows.filter(r=>outboundUnit(r,cols)==='EA');
    const gTotal=gRows.reduce((a,r)=>a+num(r[cols.qty]),0);
    const eaTotal=eaRows.reduce((a,r)=>a+num(r[cols.qty]),0);
    const gConvertedToEA=gRows.reduce((a,r)=>{const factor=PRODUCT_EA_CONVERSION[String(r[cols.code]||'').trim()];return factor?a+num(r[cols.qty])/factor:a},0);
    $('obQtyTotal').textContent=fmt(Math.round(eaTotal+gConvertedToEA));
    $('obQtyG').textContent=fmt(gTotal);
    $('obQtyEA').textContent=fmt(eaTotal);
    $('obSkuG').textContent=fmt(new Set(gRows.map(r=>String(r[cols.code]||'')).filter(Boolean)).size);
    $('obSkuEA').textContent=fmt(new Set(eaRows.map(r=>String(r[cols.code]||'')).filter(Boolean)).size);
    const map={};
    rows.forEach(r=>{
      const key=normDate(r[cols.date]);
      if(!key)return;
      if(!map[key])map[key]={date:key,skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0};
      const u=outboundUnit(r,cols);
      if(r[cols.code]&&u==='G')map[key].skusG.add(String(r[cols.code]));
      if(r[cols.code]&&u==='EA')map[key].skusEA.add(String(r[cols.code]));
      if(u==='G'){
        map[key].qtyG+=num(r[cols.qty]);
        const factor=PRODUCT_EA_CONVERSION[String(r[cols.code]||'').trim()];
        if(factor)map[key].qtyTotalEA+=num(r[cols.qty])/factor;
      }else if(u==='EA'){
        map[key].qtyEA+=num(r[cols.qty]);
        map[key].qtyTotalEA+=num(r[cols.qty]);
      }
    });
    const labor=getOutLabor();
    const entries=Object.values(map).sort((a,b)=>b.date>a.date?1:b.date<a.date?-1:0);
    $('obBody').innerHTML=entries.length?entries.map(e=>{
      const lab=labor[e.date]||{};
      const staff=num(lab.staff),hours=num(lab.hours);
      const totalEA=Math.round(e.qtyTotalEA);
      const prod=(staff>0&&hours>0)?Math.round(totalEA/(staff*hours)):null;
      return `<tr><td>${esc(e.date)}</td><td class="num">${fmt(totalEA)}</td><td><input class="cell" type="number" min="0" data-ob-staff="${esc(e.date)}" value="${lab.staff??''}"></td><td><input class="cell" type="number" min="0" step="0.1" data-ob-hours="${esc(e.date)}" value="${lab.hours??''}"></td><td class="num">${prod!==null?fmt(prod):'-'}</td><td class="num">${fmt(e.skusG.size)}</td><td class="num">${fmt(e.skusEA.size)}</td><td class="num">${fmt(e.qtyG)}</td><td class="num">${fmt(e.qtyEA)}</td></tr>`;
    }).join(''):'<tr><td colspan="9" class="data-empty">데이터가 없습니다.</td></tr>';
    $('obBody').querySelectorAll('[data-ob-staff],[data-ob-hours]').forEach(inp=>{
      inp.onchange=()=>{
        const dt=inp.dataset.obStaff||inp.dataset.obHours;
        const lab2=getOutLabor();if(!lab2[dt])lab2[dt]={staff:'',hours:''};
        if(inp.dataset.obStaff!==undefined)lab2[dt].staff=inp.value;
        if(inp.dataset.obHours!==undefined)lab2[dt].hours=inp.value;
        setOutLabor(lab2);renderOutboundBasic();
      };
    });
  }
  function exportOutboundDailyCsv(){
    const rows=[['출고일','총 출고수량(EA환산)','인원','소요시간','생산성','SKU(G)','SKU(EA)','수량(G)','수량(EA)']];
    document.querySelectorAll('#obBody tr').forEach(tr=>{
      const tds=tr.querySelectorAll('td');if(!tds.length||tds.length<9)return;
      const staffInput=tr.querySelector('[data-ob-staff]'),hoursInput=tr.querySelector('[data-ob-hours]');
      rows.push([tds[0].textContent,tds[1].textContent,staffInput?staffInput.value:'',hoursInput?hoursInput.value:'',tds[4].textContent,tds[5].textContent,tds[6].textContent,tds[7].textContent,tds[8].textContent]);
    });
    download('날짜별_출고현황.csv',new Blob(['\ufeff'+rows.map(r=>r.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));
  }
  const PRODUCT_EA_CONVERSION_SEED={"T0017390":5,"T0017344":10,"T0017345":10,"T0017391":10,"T0015387":15,"T0015388":15,"T0015389":15,"T0017343":20,"T0012651":50,"T0011245":50,"T0013136":100,"T0004870":100,"T0000157":100,"T0000156":200,"T0002618":250,"T0015067":250,"T0000827":500,"T0000823":500,"T0015619":650,"T0017034":650,"T0017035":650,"T0017323":650,"T0018229":1100,"T0017030":1250,"T0016938":1500,"T0015446":1500,"T0016855":1500,"T0016849":1500,"T0016853":1500,"T0016851":1500,"T0017584":1500,"T0018237":1500,"T0016660":1500,"T0016659":1500,"T0017216":1500,"T0017217":1500,"T0017218":1500,"T0017211":1500,"T0017219":1500,"T0017205":1500,"T0013867":1500,"T0017220":1500,"T0017221":1500,"T0017877":1500,"T0017222":1500,"T0017441":1500,"T0017223":1500,"T0017324":1500,"T0014806":1550,"T0017413":1800,"T0016357":2000,"T0018231":2100,"T0017724":2600,"T0016471":2700,"T0016472":3000,"T0015839":3200,"T0017440":3200,"T0015445":3400,"T0017033":3400,"T0017032":3400,"T0017206":3400,"T0017208":3400,"T0017210":3400,"T0017214":3400,"T0017215":4200,"T0017325":4200,"T0017207":4500,"T0017213":5100,"T0018158":5800,"T0017212":6100,"T0017233":8500,"T0017234":8500,"T0017643":8500,"T0017646":8500,"T0017439":8500,"T0017645":8500,"T0017642":8500,"T0017641":8500,"T0017644":8500,"T0018801":1500,"T0018775":10,"T0017791":10,"T0019180":1400,"T0019314":2000};
  const UNIT_CONV_KEY='lush-logistics-unit-conversion-v1';
  const UNIT_CONV_HISTORY_KEY='lush-logistics-unit-conversion-history-v1';
  const UNIT_CONV_META_KEY='lush-logistics-unit-conversion-meta-v1';
  function readUnitConversion(){try{const v=JSON.parse(localStorage.getItem(UNIT_CONV_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return{}}}
  function readUnitConversionMeta(){try{const v=JSON.parse(localStorage.getItem(UNIT_CONV_META_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return{}}}
  function readUnitConversionHistory(){try{const v=JSON.parse(localStorage.getItem(UNIT_CONV_HISTORY_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  const PRODUCT_EA_CONVERSION=Object.assign({},PRODUCT_EA_CONVERSION_SEED,readUnitConversion());
  window.PRODUCT_EA_CONVERSION=PRODUCT_EA_CONVERSION;
  function currentUnitConversionUser(){return (document.querySelector('.profile b')?.textContent||'현재 사용자').trim()||'현재 사용자'}
  function saveUnitConversionValue(code,name,nextValue){
    code=String(code||'').trim();if(!code)return;
    const before=Number(PRODUCT_EA_CONVERSION[code]||0),after=Number(nextValue||0);
    if(!(after>0))return;
    PRODUCT_EA_CONVERSION[code]=after;
    const saved=readUnitConversion();saved[code]=after;localStorage.setItem(UNIT_CONV_KEY,JSON.stringify(saved));
    const meta=readUnitConversionMeta();meta[code]={updatedAt:new Date().toISOString(),updatedBy:currentUnitConversionUser(),name:name||''};localStorage.setItem(UNIT_CONV_META_KEY,JSON.stringify(meta));
    if(before!==after){
      const hist=readUnitConversionHistory();hist.unshift({at:new Date().toISOString(),code:code,name:name||'',before:before||null,after:after,user:currentUnitConversionUser()});
      localStorage.setItem(UNIT_CONV_HISTORY_KEY,JSON.stringify(hist.slice(0,1000)));
    }
    renderUnitConversionAdmin();
    if(typeof renderOutboundBasic==='function')renderOutboundBasic();
    if(typeof renderOutboundAnalysis==='function')renderOutboundAnalysis();
    if(typeof renderInboundBasic==='function')renderInboundBasic();
    if(typeof renderInboundAnalysis==='function')renderInboundAnalysis();
    if(typeof window.renderStatusProductivity==='function')window.renderStatusProductivity();
  }
  function discoverGProducts(){
    const products={};
    const d=read();
    const outRows=d.outbound?.rows||[],cols=outboundColIndex(d.outbound?.header);
    outRows.forEach(r=>{if(outboundUnit(r,cols)!=='G')return;const code=String(r[cols.code]||'').trim();if(!code)return;products[code]={code,name:String(r[cols.name]||'').trim(),unit:'G',seen:true}});
    (d.inbound?.rows||[]).forEach(r=>{if(inboundUnit(r)!=='G')return;const code=String(r[3]||'').trim();if(!code)return;products[code]=products[code]||{code,name:String(r[5]||'').trim(),unit:'G',seen:true}});
    Object.keys(PRODUCT_EA_CONVERSION).forEach(code=>{if(!products[code])products[code]={code,name:'',unit:'G',seen:false}});
    return Object.values(products).sort((a,b)=>a.code.localeCompare(b.code));
  }
  function renderUnitConversionAdmin(){
    const body=document.getElementById('unitConvBody');if(!body)return;
    const qv=(document.getElementById('unitConvQuery')?.value||'').trim().toLowerCase();
    const status=document.getElementById('unitConvStatus')?.value||'all';
    const all=discoverGProducts(),missing=all.filter(p=>p.seen&&!(Number(PRODUCT_EA_CONVERSION[p.code])>0));
    const registered=all.filter(p=>Number(PRODUCT_EA_CONVERSION[p.code])>0);
    document.getElementById('unitConvAllCount').textContent=String(all.filter(p=>p.seen).length);
    document.getElementById('unitConvRegisteredCount').textContent=String(registered.filter(p=>p.seen).length);
    document.getElementById('unitConvMissingCount').textContent=String(missing.length);
    const meta=readUnitConversionMeta();
    const rows=all.filter(p=>{
      const has=Number(PRODUCT_EA_CONVERSION[p.code])>0;
      if(status==='registered'&&!has)return false;
      if(status==='missing'&&(!p.seen||has))return false;
      return !qv||p.code.toLowerCase().includes(qv)||p.name.toLowerCase().includes(qv);
    });
    body.innerHTML=rows.length?rows.map(p=>{
      const factor=Number(PRODUCT_EA_CONVERSION[p.code]||0),has=factor>0,m=meta[p.code]||{};
      const updated=m.updatedAt?new Date(m.updatedAt).toLocaleString('ko-KR'):'-';
      return '<tr><td><b>'+esc(p.code)+'</b></td><td>'+esc(p.name||'-')+'</td><td>G</td><td><input type="number" min="1" step="1" value="'+(has?factor:'')+'" placeholder="미등록" data-unit-conv="'+esc(p.code)+'" data-unit-name="'+esc(p.name||'')+'"></td><td><span class="unit-conversion-status '+(has?'registered':'missing')+'">'+(has?'등록 완료':'미등록')+'</span></td><td><span class="unit-conversion-updated">'+updated+'</span></td></tr>';
    }).join(''):'<tr><td colspan="6" class="data-empty">조회 결과가 없습니다.</td></tr>';
    body.querySelectorAll('[data-unit-conv]').forEach(inp=>{
      inp.onchange=()=>{const n=Number(inp.value);if(!(n>0)){inp.value=PRODUCT_EA_CONVERSION[inp.dataset.unitConv]||'';if(typeof toastMsg==='function')toastMsg('환산계수는 1 이상으로 입력해주세요.');return}saveUnitConversionValue(inp.dataset.unitConv,inp.dataset.unitName,n)};
    });
    renderUnitConversionHistory();
  }
  function renderUnitConversionHistory(){
    const body=document.getElementById('unitConvHistoryBody');if(!body)return;
    const start=document.getElementById('unitConvHistStart')?.value||'',end=document.getElementById('unitConvHistEnd')?.value||'',code=(document.getElementById('unitConvHistCode')?.value||'').trim().toLowerCase();
    const rows=readUnitConversionHistory().filter(h=>{const d=String(h.at||'').slice(0,10);return(!start||d>=start)&&(!end||d<=end)&&(!code||String(h.code||'').toLowerCase().includes(code))});
    body.innerHTML=rows.length?rows.map(h=>'<tr><td>'+esc(new Date(h.at).toLocaleString('ko-KR'))+'</td><td>'+esc(h.code)+'</td><td>'+esc(h.name||'-')+'</td><td>'+esc(h.before==null?'-':h.before)+'</td><td>'+esc(h.after)+'</td><td>'+esc(h.user||'-')+'</td></tr>').join(''):'<tr><td colspan="6" class="data-empty">변경 이력이 없습니다.</td></tr>';
  }
  ['unitConvQuery','unitConvStatus','unitConvHistStart','unitConvHistEnd','unitConvHistCode'].forEach(id=>document.getElementById(id)?.addEventListener(id==='unitConvStatus'?'change':'input',()=>{if(id.indexOf('Hist')>=0)renderUnitConversionHistory();else renderUnitConversionAdmin()}));
  renderUnitConversionAdmin();
  window.renderOutboundBasic=renderOutboundBasic;
  const NAKED_MERGE_SET=new Set(['BATH BOMB','BUBBLE BAR','SHAMPOO BAR','MASSAGE BAR','SOAP']);
  const CATEGORY_EXCLUDE_SET=new Set(['리미티드','SPA','스파','VM','ACCESSORIES','ACCESSORY','RAW MAT','KNOT WRAP','LOKTA WRAP','MERCH','액세서리','악세서리','악세사리','엑세서리','데모','DEMO','디지털부자재','디지털사은품']);
  const CATEGORY_EXCLUDE_PATTERN=/^(19|20)?\d{2}년/;
  const CATEGORY_EXCLUDE_KEYWORDS=['SPA','스파','VM','ACCESSOR','RAWMAT','KNOTWRAP','LOKTAWRAP','MERCH','악세','엑세','액세','데모','DEMO','디지털부자재','디지털사은품','부자재','사은품'];
  function categoryDisplay(raw){
    const v=String(raw||'').trim().toUpperCase();
    if(!v)return null;
    const vNorm=v.replace(/\s+/g,'');
    if(CATEGORY_EXCLUDE_SET.has(v)||CATEGORY_EXCLUDE_SET.has(vNorm))return null;
    if(CATEGORY_EXCLUDE_PATTERN.test(v))return null;
    if(v.includes('XMAS')||v.includes('크리스마스'))return null;
    if(CATEGORY_EXCLUDE_KEYWORDS.some(k=>vNorm.includes(k)))return null;
    if(NAKED_MERGE_SET.has(v))return 'NAKED';
    return String(raw).trim();
  }
  function populateCategorySelect(){
    const dl=$('inCatSelectList');if(!dl)return new Set();
    const all=read().inbound?.rows||[];
    const cats=new Set();
    all.forEach(r=>{const cat=categoryDisplay(r[4]);if(cat)cats.add(cat)});
    dl.innerHTML=[...cats].sort(KO_COLLATOR.compare).map(c=>`<option value="${esc(c)}">`).join('');
    return cats;
  }
  function populateInProductList(){
    const dl=$('inAnaProductList');if(!dl)return;
    const all=read().inbound?.rows||[];
    const names=new Set();
    all.forEach(r=>{const n=String(r[5]||'').trim();if(n)names.add(n)});
    dl.innerHTML=[...names].sort(KO_COLLATOR.compare).slice(0,500).map(n=>`<option value="${esc(n)}">`).join('');
  }
  function renderCategoryTrend(){
    if(!$('inCatTrendCanvas'))return;
    const knownCats=populateCategorySelect();
    const all=read().inbound?.rows||[];
    const start=$('inAnaStart')?.value||'',end=$('inAnaEnd')?.value||'';
    const catFilterRaw=($('inCatSelect')?.value||'').trim();
    const catFilter=knownCats.has(catFilterRaw)?catFilterRaw:'';
    const monthCatQty={};
    const cats=new Set();
    all.forEach(r=>{
      const cat=categoryDisplay(r[4]);
      if(!cat)return;
      if(catFilter&&cat!==catFilter)return;
      const rd=normDate(r[0]);
      if(start&&rd<start)return;
      if(end&&rd>end)return;
      const u=inboundUnit(r);
      let eaQty=0;
      if(u==='EA'){
        eaQty=num(r[7]);
      }else if(u==='G'){
        const code=String(r[3]||'').trim();
        const factor=PRODUCT_EA_CONVERSION[code];
        if(!factor)return;
        eaQty=num(r[7])/factor;
      }else{
        return;
      }
      const m=ym(r[0]);if(!m)return;
      if(!monthCatQty[m])monthCatQty[m]={};
      monthCatQty[m][cat]=(monthCatQty[m][cat]||0)+eaQty;
      cats.add(cat);
    });
    const months=Object.keys(monthCatQty).sort();
    const catList=[...cats].sort((a,b)=>{
      const ta=months.reduce((s,m)=>s+(monthCatQty[m]?.[a]||0),0);
      const tb=months.reduce((s,m)=>s+(monthCatQty[m]?.[b]||0),0);
      return tb-ta;
    }).slice(0,10);
    const canvas=$('inCatTrendCanvas');
    if(!canvas)return;
    if(typeof Chart==='undefined'){
      window.ensureChart?.().then(()=>renderCategoryTrend());
      return;
    }
    if(!months.length||!catList.length){
      if(window.__inCatChart){window.__inCatChart.destroy();window.__inCatChart=null}
      return;
    }
    const colors=['#2f6fed','#e0446b','#2f9b59','#f28b22','#7651b6','#3978c5','#c0392b','#16a085','#8c6d31','#4d5b6a'];
    const datasets=catList.map((cat,ci)=>{
      const color=colors[ci%colors.length];
      const vals=months.map(m=>Math.round(monthCatQty[m]?.[cat]||0));
      return{
        label:cat,data:vals,borderColor:color,backgroundColor:color,
        borderWidth:2.5,tension:0.25,pointRadius:3,pointHoverRadius:5,fill:false
      };
    });
    const pointLabelPlugin={
      id:'pointLabelPlugin',
      afterDatasetsDraw(chart){
        const ctx=chart.ctx;
        chart.data.datasets.forEach((ds,di)=>{
          const meta=chart.getDatasetMeta(di);
          if(meta.hidden)return;
          const vals=ds.data;
          const maxV=Math.max(...vals),minV=Math.min(...vals);
          const maxIdx=vals.indexOf(maxV),minIdx=vals.indexOf(minV);
          [maxIdx,minIdx].forEach((idx,k)=>{
            if(idx<0)return;
            if(k===1&&minIdx===maxIdx)return;
            const pt=meta.data[idx];if(!pt)return;
            ctx.save();
            ctx.font='bold 11px inherit';
            ctx.fillStyle=ds.borderColor;
            ctx.textAlign='center';
            ctx.fillText(fmt(vals[idx]),pt.x,pt.y-10);
            ctx.restore();
          });
        });
      }
    };
    if(window.__inCatChart){window.__inCatChart.destroy()}
    window.__inCatChart=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{labels:months.map(m=>m.slice(5)+'월'),datasets},
      plugins:[pointLabelPlugin],
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)?{display:false}:{position:'bottom',labels:{font:{size:13,weight:'700'},boxWidth:12,boxHeight:12,padding:14}},
          tooltip:{enabled:true}
        },
        scales:{
          y:{beginAtZero:true,ticks:{font:{size:10}}},
          x:{ticks:{font:{size:11}}}
        }
      }
    });
    window.__mobileChartLegend&&window.__mobileChartLegend(window.__inCatChart,canvas);
  }
  let __inAnaDetailSearched=false;
  function runInAnaSearch(){__inAnaDetailSearched=true;renderInbound()}
  function renderInbound(){
    if(!$('inAnaBody'))return;
    populateInProductList();
    const d=read(),all=d.inbound?.rows||[];
    const priceMap=getPriceMap();
    const start=$('inAnaStart')?.value||'',end=$('inAnaEnd')?.value||'';
    const batchQ=($('inAnaBatchQuery')?.value||'').trim().toLowerCase();
    const q=($('inAnaQuery')?.value||'').trim().toLowerCase();
    const noFilter=!batchQ&&!q;
    const rows=all.filter(r=>{
      const rd=normDate(r[0]);
      return(!start||rd>=start)&&(!end||rd<=end)
        &&(!batchQ||String(r[1]||'').toLowerCase().includes(batchQ))
        &&(!q||String(r[3]||'').toLowerCase().includes(q)||String(r[5]||'').toLowerCase().includes(q));
    });
    // 필터가 없는 '전체' 조회일 때는 업로드 시점에 미리 계산해둔 요약을 그대로 써서 매번 다시 훑지 않습니다.
    let monthMapAll;
    if(noFilter&&d.inboundMonthlySummary){
      monthMapAll=d.inboundMonthlySummary;
    }else{
      const raw={};
      all.filter(r=>(!batchQ||String(r[1]||'').toLowerCase().includes(batchQ))&&(!q||String(r[3]||'').toLowerCase().includes(q)||String(r[5]||'').toLowerCase().includes(q))).forEach(r=>{
        const m=ym(r[0]);if(!m)return;
        if(!raw[m])raw[m]={batches:new Set(),batchPallets:new Map(),skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0,amountEA:0,amountG:0};
        if(r[1]){raw[m].batches.add(String(r[1]));if(r[2]!==''&&r[2]!=null)raw[m].batchPallets.set(String(r[1]),num(r[2]))}
        const u=inboundUnit(r);
        const code=String(r[3]||'').trim();
        const price=priceMap[code]||0;
        if(code&&u==='G')raw[m].skusG.add(code);
        if(code&&u==='EA')raw[m].skusEA.add(code);
        if(u==='G'){
          raw[m].qtyG+=num(r[7]);
          const factor=PRODUCT_EA_CONVERSION[code];
          if(factor){
            const eaEquiv=num(r[7])/factor;
            raw[m].qtyTotalEA+=eaEquiv;
            raw[m].amountG+=eaEquiv*price;
          }
        }else if(u==='EA'){
          raw[m].qtyEA+=num(r[7]);
          raw[m].qtyTotalEA+=num(r[7]);
          raw[m].amountEA+=num(r[7])*price;
        }
      });
      monthMapAll={};
      Object.entries(raw).forEach(([m,v])=>{
        let pallets=0; v.batchPallets.forEach(p=>pallets+=p);
        monthMapAll[m]={batches:v.batches.size,pallets,skuG:v.skusG.size,skuEA:v.skusEA.size,qtyG:v.qtyG,qtyEA:v.qtyEA,qtyTotalEA:v.qtyTotalEA,amountEA:v.amountEA,amountG:v.amountG};
      });
    }
    let displayMonths;
    if(noFilter){
      const rawMonths=rows.map(r=>ym(r[0])).filter(Boolean);
      const summaryMonths=Object.keys(monthMapAll);
      const startYM=start?start.slice(0,7):'',endYM=end?end.slice(0,7):'';
      displayMonths=[...new Set([...rawMonths,...summaryMonths])]
        .filter(m=>(!startYM||m>=startYM)&&(!endYM||m<=endYM))
        .sort();
    }else{
      displayMonths=[...new Set(rows.map(r=>ym(r[0])).filter(Boolean))].sort();
    }
    const pctLabel=v=>{
      if(v===null||v===undefined)return '-';
      const cls=v>=0?'pct-up':'pct-down';
      return `<span class="${cls}">${v>=0?'+':''}${v.toFixed(1)}%</span>`;
    };
    $('inAnaTrendBody').innerHTML=displayMonths.length?displayMonths.map(m=>{
      const v=monthMapAll[m];
      if(!v)return `<tr><td class="grp-key">${esc(m)}</td><td colspan="9" class="data-empty">데이터가 없습니다.</td></tr>`;
      const amountTotal=v.amountEA+v.amountG;
      const prev=monthMapAll[shiftMonth(m,-1)];
      const yoy=monthMapAll[shiftMonth(m,-12)];
      const qtyMoM=prev?pct(v.qtyTotalEA,prev.qtyTotalEA):null;
      const amtMoM=prev?pct(amountTotal,prev.amountEA+prev.amountG):null;
      const qtyYoy=yoy?pct(v.qtyTotalEA,yoy.qtyTotalEA):null;
      const amtYoy=yoy?pct(amountTotal,yoy.amountEA+yoy.amountG):null;
      return `<tr><td class="grp-key grp-key-start">${esc(m)}</td><td class="num grp-key">${fmt(v.batches)}</td><td class="num grp-key">${fmt(v.pallets)}</td><td class="num grp-key grp-key-end">${fmt(Math.round(v.qtyTotalEA))}</td><td class="num">${fmt(v.skuG)}</td><td class="num">${fmt(v.skuEA)}</td><td class="num">${fmt(v.qtyG)}</td><td class="num">${fmt(v.qtyEA)}</td><td class="num grp-mom grp-mom-start grp-mom-end">${pctLabel(qtyMoM)}</td><td class="num grp-yoy grp-yoy-start grp-yoy-end">${pctLabel(qtyYoy)}</td></tr>`;
    }).join(''):'<tr><td colspan="10" class="data-empty">데이터가 없습니다.</td></tr>';
    if(!__inAnaDetailSearched){
      $('inAnaBody').innerHTML='<tr><td colspan="8" class="data-empty">"조회"를 누르면 결과가 표시됩니다.</td></tr>';
    }else{
      $('inAnaBody').innerHTML=rows.length?rows.slice().sort((a,b)=>{const A=normDate(a[0]),B=normDate(b[0]);return B>A?1:B<A?-1:0}).slice(0,1000).map(r=>`<tr><td>${esc(normDate(r[0]))}</td><td>${esc(r[1])}</td><td class="num">${fmt(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[6])}</td><td class="num">${fmt(r[7])}</td></tr>`).join(''):'<tr><td colspan="8" class="data-empty">조회 결과가 없습니다.</td></tr>';
    }
    renderCategoryTrend();
  }
  function populateOutCategorySelect(){
    const all=read().outbound?.rows||[];
    const cols=outboundColIndex();
    const cats=new Set();
    all.forEach(r=>{const cat=categoryDisplay(r[cols.category]);if(cat)cats.add(cat)});
    const sortedCats=[...cats].sort(KO_COLLATOR.compare);
    const outCatSel=$('outCatSelect');
    if(outCatSel){
      // outCatSelect is now an autocomplete text input paired with a datalist; keep its typed value as-is.
    }
    const outCatDl=$('outCatSelectList');
    if(outCatDl)outCatDl.innerHTML=sortedCats.map(c=>`<option value="${esc(c)}">`).join('');
    const catDl=$('outAnaCatQueryList');
    if(catDl)catDl.innerHTML=sortedCats.map(c=>`<option value="${esc(c)}">`).join('');
    return cats;
  }
  function populateOutProductList(){
    const all=read().outbound?.rows||[];
    const cols=outboundColIndex();
    const names=new Set();
    all.forEach(r=>{const n=String(r[cols.name]||'').trim();if(n)names.add(n)});
    const dl=$('outAnaProductList');
    if(dl)dl.innerHTML=[...names].sort(KO_COLLATOR.compare).slice(0,500).map(n=>`<option value="${esc(n)}">`).join('');
  }
  function renderOutCategoryTrend(precomputedCats){
    if(!$('outCatTrendCanvas'))return;
    const knownCats=(precomputedCats instanceof Set)?precomputedCats:populateOutCategorySelect();
    const all=read().outbound?.rows||[];
    const cols=outboundColIndex();
    const start=$('outAnaStart')?.value||'',end=$('outAnaEnd')?.value||'';
    const catFilterRaw=($('outCatSelect')?.value||'').trim();
    const catFilter=knownCats.has(catFilterRaw)?catFilterRaw:'';
    const monthCatQty={};
    const cats=new Set();
    all.forEach(r=>{
      const cat=categoryDisplay(r[cols.category]);
      if(!cat)return;
      if(catFilter&&cat!==catFilter)return;
      const rd=normDate(r[cols.date]);
      if(start&&rd<start)return;
      if(end&&rd>end)return;
      const u=outboundUnit(r,cols);
      let eaQty=0;
      if(u==='EA'){
        eaQty=num(r[cols.qty]);
      }else if(u==='G'){
        const code=String(r[cols.code]||'').trim();
        const factor=PRODUCT_EA_CONVERSION[code];
        if(!factor)return;
        eaQty=num(r[cols.qty])/factor;
      }else{
        return;
      }
      const m=ym(r[cols.date]);if(!m)return;
      if(!monthCatQty[m])monthCatQty[m]={};
      monthCatQty[m][cat]=(monthCatQty[m][cat]||0)+eaQty;
      cats.add(cat);
    });
    const months=Object.keys(monthCatQty).sort();
    const catList=[...cats].sort((a,b)=>{
      const ta=months.reduce((s,m)=>s+(monthCatQty[m]?.[a]||0),0);
      const tb=months.reduce((s,m)=>s+(monthCatQty[m]?.[b]||0),0);
      return tb-ta;
    }).slice(0,10);
    const canvas=$('outCatTrendCanvas');
    if(!canvas)return;
    if(typeof Chart==='undefined'){
      window.ensureChart?.().then(()=>renderOutCategoryTrend());
      return;
    }
    if(!months.length||!catList.length){
      if(window.__outCatChart){window.__outCatChart.destroy();window.__outCatChart=null}
      return;
    }
    const colors=['#2f6fed','#e0446b','#2f9b59','#f28b22','#7651b6','#3978c5','#c0392b','#16a085','#8c6d31','#4d5b6a'];
    const datasets=catList.map((cat,ci)=>{
      const color=colors[ci%colors.length];
      const vals=months.map(m=>Math.round(monthCatQty[m]?.[cat]||0));
      return{
        label:cat,data:vals,borderColor:color,backgroundColor:color,
        borderWidth:2.5,tension:0.25,pointRadius:3,pointHoverRadius:5,fill:false
      };
    });
    const pointLabelPlugin={
      id:'pointLabelPluginOut',
      afterDatasetsDraw(chart){
        const ctx=chart.ctx;
        chart.data.datasets.forEach((ds,di)=>{
          const meta=chart.getDatasetMeta(di);
          if(meta.hidden)return;
          const vals=ds.data;
          const maxV=Math.max(...vals),minV=Math.min(...vals);
          const maxIdx=vals.indexOf(maxV),minIdx=vals.indexOf(minV);
          [maxIdx,minIdx].forEach((idx,k)=>{
            if(idx<0)return;
            if(k===1&&minIdx===maxIdx)return;
            const pt=meta.data[idx];if(!pt)return;
            ctx.save();
            ctx.font='bold 11px inherit';
            ctx.fillStyle=ds.borderColor;
            ctx.textAlign='center';
            ctx.fillText(fmt(vals[idx]),pt.x,pt.y-10);
            ctx.restore();
          });
        });
      }
    };
    if(window.__outCatChart){window.__outCatChart.destroy()}
    window.__outCatChart=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{labels:months.map(m=>m.slice(5)+'월'),datasets},
      plugins:[pointLabelPlugin],
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)?{display:false}:{position:'bottom',labels:{font:{size:13,weight:'700'},boxWidth:12,boxHeight:12,padding:14}},
          tooltip:{enabled:true}
        },
        scales:{
          y:{beginAtZero:true,ticks:{font:{size:10}}},
          x:{ticks:{font:{size:11}}}
        }
      }
    });
    window.__mobileChartLegend&&window.__mobileChartLegend(window.__outCatChart,canvas);
  }
  function renderOutbound(){
    if(!$('outAnaBody'))return;
    const d=read(),all=d.outbound?.rows||[];
    const cols=outboundColIndex();
    const priceMap=getPriceMap();
    const knownCats=populateOutCategorySelect();
    populateOutProductList();
    const start=$('outAnaStart')?.value||'',end=$('outAnaEnd')?.value||'';
    const catQRaw=($('outAnaCatQuery')?.value||'').trim();
    const catQ=knownCats.has(catQRaw)?catQRaw:'';
    const q=($('outAnaQuery')?.value||'').trim().toLowerCase();
    const catSearchMatch=r=>{
      const cat=categoryDisplay(r[cols.category]);
      return(!catQ||cat===catQ)&&(!q||String(r[cols.code]||'').toLowerCase().includes(q)||String(r[cols.name]||'').toLowerCase().includes(q));
    };
    const rows=all.filter(r=>{
      const rd=normDate(r[cols.date]);
      return(!start||rd>=start)&&(!end||rd<=end)&&catSearchMatch(r);
    });
    // 전월/전년 동월 대비 증감률을 구하려면 화면에 보이는 기간 밖의 달도 필요하므로,
    // 월별 집계는 (제품군·검색 조건만 적용한) 전체 데이터를 기준으로 만듭니다.
    // 필터가 없는 '전체' 조회일 때는 업로드 시점에 미리 계산해둔 요약을 그대로 사용해서
    // 매번 원본 데이터를 다시 훑지 않도록 합니다. 제품군·검색으로 좁혀볼 때만 그때그때 다시 계산합니다.
    const noFilter=!catQ&&!q;
    let monthMapAll;
    if(noFilter&&d.outboundMonthlySummary){
      monthMapAll=d.outboundMonthlySummary;
    }else{
      const raw={};
      all.filter(catSearchMatch).forEach(r=>{
        const m=ym(r[cols.date]);if(!m)return;
        if(!raw[m])raw[m]={skusG:new Set(),skusEA:new Set(),qtyG:0,qtyEA:0,qtyTotalEA:0,amountEA:0,amountG:0};
        const u=outboundUnit(r,cols);
        const code=String(r[cols.code]||'').trim();
        const price=priceMap[code]||0;
        if(code&&u==='G')raw[m].skusG.add(code);
        if(code&&u==='EA')raw[m].skusEA.add(code);
        if(u==='G'){
          raw[m].qtyG+=num(r[cols.qty]);
          const factor=PRODUCT_EA_CONVERSION[code];
          if(factor){
            const eaEquiv=num(r[cols.qty])/factor;
            raw[m].qtyTotalEA+=eaEquiv;
            raw[m].amountG+=eaEquiv*price;
          }
        }else if(u==='EA'){
          raw[m].qtyEA+=num(r[cols.qty]);
          raw[m].qtyTotalEA+=num(r[cols.qty]);
          raw[m].amountEA+=num(r[cols.qty])*price;
        }
      });
      monthMapAll={};
      Object.entries(raw).forEach(([m,v])=>{
        monthMapAll[m]={skuG:v.skusG.size,skuEA:v.skusEA.size,qtyG:v.qtyG,qtyEA:v.qtyEA,qtyTotalEA:v.qtyTotalEA,amountEA:v.amountEA,amountG:v.amountG};
      });
    }
    let displayMonths;
    if(noFilter){
      // 원본 행이 없는 달(요약값만 가져온 과거 달)도 함께 보여줍니다.
      const rawMonths=rows.map(r=>ym(r[cols.date])).filter(Boolean);
      const summaryMonths=Object.keys(monthMapAll);
      const startYM=start?start.slice(0,7):'',endYM=end?end.slice(0,7):'';
      displayMonths=[...new Set([...rawMonths,...summaryMonths])]
        .filter(m=>(!startYM||m>=startYM)&&(!endYM||m<=endYM))
        .sort();
    }else{
      displayMonths=[...new Set(rows.map(r=>ym(r[cols.date])).filter(Boolean))].sort();
    }
    const pctLabel=v=>{
      if(v===null||v===undefined)return '-';
      const cls=v>=0?'pct-up':'pct-down';
      return `<span class="${cls}">${v>=0?'+':''}${v.toFixed(1)}%</span>`;
    };
    $('outAnaTrendBody').innerHTML=displayMonths.length?displayMonths.map(m=>{
      const v=monthMapAll[m];
      if(!v)return `<tr><td>${esc(m)}</td><td colspan="7" class="data-empty">데이터가 없습니다.</td></tr>`;
      const amountTotal=v.amountEA+v.amountG;
      const prev=monthMapAll[shiftMonth(m,-1)];
      const yoy=monthMapAll[shiftMonth(m,-12)];
      const qtyMoM=prev?pct(v.qtyTotalEA,prev.qtyTotalEA):null;
      const amtMoM=prev?pct(amountTotal,prev.amountEA+prev.amountG):null;
      const qtyYoy=yoy?pct(v.qtyTotalEA,yoy.qtyTotalEA):null;
      const amtYoy=yoy?pct(amountTotal,yoy.amountEA+yoy.amountG):null;
      return `<tr><td class="grp-key grp-key-start">${esc(m)}</td><td class="num grp-key grp-key-end">${fmt(Math.round(v.qtyTotalEA))}</td><td class="num">${fmt(v.skuG)}</td><td class="num">${fmt(v.skuEA)}</td><td class="num">${fmt(v.qtyG)}</td><td class="num">${fmt(v.qtyEA)}</td><td class="num grp-mom grp-mom-start grp-mom-end">${pctLabel(qtyMoM)}</td><td class="num grp-yoy grp-yoy-start grp-yoy-end">${pctLabel(qtyYoy)}</td></tr>`;
    }).join(''):'<tr><td colspan="8" class="data-empty">데이터가 없습니다.</td></tr>';
    $('outAnaBody').innerHTML=rows.length?rows.slice().sort((a,b)=>{const A=normDate(a[cols.date]),B=normDate(b[cols.date]);return B>A?1:B<A?-1:0}).slice(0,1000).map(r=>`<tr><td>${esc(normDate(r[cols.date]))}</td><td>${esc(r[cols.code])}</td><td>${esc(r[cols.category])}</td><td>${esc(r[cols.name])}</td><td>${esc(r[cols.unit])}</td><td class="num">${fmt(r[cols.qty])}</td></tr>`).join(''):'<tr><td colspan="6" class="data-empty">조회 결과가 없습니다.</td></tr>';
    renderOutCategoryTrend(knownCats);
  }
  const pct=(cur,prev)=>prev===0?(cur===0?0:null):((cur-prev)/prev*100);
  /* 오출고 건수 집계 규칙 (행 형식: [접수시각, 매장, 제품명, 전산, 실입고, 미입고, 과입고, 담당자, 처리여부, 처리일, 처리 내용, 사유])
     - 오출고 1건 = 접수 날짜(시각 제외) + 매장이 같은 행 묶음 (같은 날 같은 매장이면 품목이 여러 줄이어도 1건)
     - 담당자별 1건 = 날짜 + 매장 + 담당자, 사유별 1건 = 날짜 + 매장 + 사유
     - 묶음 안의 행이 모두 '완료'일 때만 처리완료 */
  const MS_UNSET='(미지정)';
  // 공란 표시명: 담당자(7열) 공란 = 매장 귀책이거나 확인 불가, 사유(11열) 공란 = 아직 확인 중
  const MS_BLANK={7:'기타(매장, 확인불가)',11:'사유 확인 중'};
  const msLabel=(v,blank)=>String(v??'').trim()||blank||MS_UNSET;
  const msCaseKey=r=>normDate(r[0])+'|'+String(r[1]??'').trim();
  function misshipCases(rows){const m=new Map();rows.forEach(r=>{const k=msCaseKey(r);const c=m.get(k)||{key:k,date:normDate(r[0]),store:msLabel(r[1]),rows:[],done:true};c.rows.push(r);if(!String(r[8]??'').includes('완료'))c.done=false;m.set(k,c)});return[...m.values()]}
  function misshipCountBy(rows,idx){const seen=new Set(),out={};rows.forEach(r=>{const label=msLabel(r[idx],MS_BLANK[idx]),k=msCaseKey(r)+'|'+label;if(seen.has(k))return;seen.add(k);out[label]=(out[label]||0)+1});return out}
  function shiftYm(m,delta){const[y,mo]=m.split('-').map(Number),d=new Date(y,mo-1+delta,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function msPctCell(cur,base){const p=pct(cur,base);if(p===null)return'<td class="num" style="color:#8a949e">신규</td>';if(p===0)return'<td class="num" style="color:#8a949e">0.0%</td>';return`<td class="num" style="font-weight:800;color:${p>0?'#d64545':'#2f7de1'}">${p>0?'▲':'▼'} ${Math.abs(p).toFixed(1)}%</td>`}
  /* 담당자별 / 사유별 비중 도넛 (같은 그리기 함수 사용).
     - 모든 담당자·사유를 묶지 않고 범례에 전부 표시
     - 범례는 Top 5만 보이므로 색은 그 달 순위 1-5위에 서로 다른 범주 색, 나머지는 그 외(회색)
     - 공란 항목(기타(매장, 확인불가) / 사유 확인 중)은 색 슬롯을 쓰지 않고 연회색 */
  const MS_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7'],MS_REST='#9aa0a6',MS_BLANK_COLOR='#c9cdd2';
  function msColorMap(all,idx){const tot=misshipCountBy(all,idx),blank=MS_BLANK[idx];const order=Object.keys(tot).filter(k=>k!==blank).sort((a,b)=>tot[b]-tot[a]||a.localeCompare(b,'ko'));const map={};order.forEach((k,i)=>map[k]=MS_COLORS[i]||MS_REST);if(blank)map[blank]=MS_BLANK_COLOR;return map}
  function msTip(e,html){const t=$('msTip');if(!t)return;if(!html){t.hidden=true;return}t.innerHTML=html;t.hidden=false;const x=Math.min(e.clientX+14,innerWidth-t.offsetWidth-8),y=Math.max(8,e.clientY-t.offsetHeight-10);t.style.left=x+'px';t.style.top=y+'px'}
  function renderMsDonut(donutId,legendId,counts,colors,totalCur,ariaLabel){
    const donut=$(donutId),legend=$(legendId);if(!donut||!legend)return;
    const pctOf=c=>totalCur?(c/totalCur*100).toFixed(1)+'%':'-';
    // 범례는 Top 5만 표시하고, 나머지는 도넛에서 회색 '그 외' 한 조각으로 묶음 (전체 목록은 아래 표)
    const MS_TOP=5;
    const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([k,v])=>({k,v})); let ci=0; ranked.forEach(x=>{x.c=(x.k===MS_BLANK[7]||x.k===MS_BLANK[11])?MS_BLANK_COLOR:(MS_COLORS[ci++]||MS_REST)});
    const items=ranked.slice(0,MS_TOP),rest=ranked.slice(MS_TOP);
    if(rest.length)items.push({k:'그 외',v:rest.reduce((a,x)=>a+x.v,0),c:'#dfe2e6',other:rest.map(x=>x.k)});
    const sum=items.reduce((a,x)=>a+x.v,0);
    legend.classList.remove('two-col');
    if(!sum){donut.innerHTML='';legend.innerHTML='<div class="ms-empty">해당 월 데이터가 없습니다.</div>';return}
    const R=46,SW=18,C=2*Math.PI*R,GAP=items.length>1?2:0;let off=0;
    const segs=items.map((x,i)=>{const len=x.v/sum*C,s=`<circle class="seg" data-i="${i}" cx="60" cy="60" r="${R}" fill="none" stroke="${x.c}" stroke-width="${SW}" stroke-dasharray="${Math.max(len-GAP,0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"></circle>`;off+=len;return s}).join('');
    donut.innerHTML=`<svg viewBox="0 0 120 120" role="img" aria-label="${esc(ariaLabel)}"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#f2f4f6" stroke-width="${SW}"></circle>${segs}</svg><div class="ms-donut-center"><small>총 오출고</small><b>${fmt(totalCur)}건</b></div>`;
    legend.innerHTML=items.map((x,i)=>x.other?`<div class="ms-legend-more" data-i="${i}">그 외 ${fmt(x.other.length)}개 항목 · ${fmt(x.v)}건 (전체는 아래 표 참고)</div>`:`<div class="ms-legend-row" data-i="${i}"><i style="background:${x.c}"></i><span title="${esc(x.k)}">${esc(x.k)}</span><small>${fmt(x.v)}건</small><b>${pctOf(x.v)}</b></div>`).join('');
    const hot=i=>{donut.classList.toggle('dim',i!=null);donut.querySelectorAll('.seg').forEach(s=>s.classList.toggle('hot',String(i)===s.dataset.i))};
    donut.querySelectorAll('.seg').forEach(s=>{const x=items[s.dataset.i];s.onmousemove=e=>{hot(s.dataset.i);msTip(e,`<b>${esc(x.k)}</b> · ${fmt(x.v)}건 · ${pctOf(x.v)}${x.other?`<br><small>${esc(x.other.slice(0,6).join(', '))}${x.other.length>6?` 외 ${x.other.length-6}개`:''}</small>`:''}`)};s.onmouseleave=e=>{hot(null);msTip(e,null)}});
    legend.querySelectorAll('.ms-legend-row,.ms-legend-more').forEach(r=>{r.onmouseenter=()=>hot(r.dataset.i);r.onmouseleave=()=>hot(null)});
  }
  function renderMisshipVisuals(all,curRows,label,totalCur){
    document.querySelectorAll('#misshipAnalyticsView .ms-month-label').forEach(el=>el.textContent=label);
    renderMsDonut('msMgrDonut','msMgrLegend',misshipCountBy(curRows,7),msColorMap(all,7),totalCur,`${label} 담당자별 오출고 비중`);
    renderMsDonut('msRsnDonut','msRsnLegend',misshipCountBy(curRows,11),msColorMap(all,11),totalCur,`${label} 사유별 오출고 비중`);
  }
  // 기준월이 비어 있으면 전체 기간 분석(기본값). 월을 고르면 그 달 + 전월 대비, [전체]로 다시 전체 기간
  function renderMisshipCompare(all){
    if(!$('msMgrBody'))return;
    const m=$('msMonth').value,isAll=!m,pm=isAll?'':shiftYm(m,-1);
    const curRows=isAll?all:all.filter(r=>ym(r[0])===m),prevRows=isAll?[]:all.filter(r=>ym(r[0])===pm);
    const label=isAll?'전체 기간':m;
    [['msMgrCurHead',label],['msMgrPrevHead',pm],['msRsnCurHead',label],['msRsnPrevHead',pm]].forEach(([id,v])=>{if($(id))$(id).textContent=v});
    $('msMgrBody').closest('.panel')?.classList.toggle('ms-all-mode',isAll);
    $('msAllBtn')?.classList.toggle('primary',isAll);
    // 비중의 분모 = 기준 기간 총 오출고 건수(날짜+매장 기준)
    const totalCur=misshipCases(curRows).length,totalPrev=misshipCases(prevRows).length;
    const share=c=>totalCur?`${(c/totalCur*100).toFixed(1)}%`:'-';
    const table=(idx,bodyId)=>{
      const cur=misshipCountBy(curRows,idx),prv=misshipCountBy(prevRows,idx);
      const labels=[...new Set([...Object.keys(cur),...Object.keys(prv)])].sort((a,b)=>(cur[b]||0)-(cur[a]||0)||(prv[b]||0)-(prv[a]||0)||a.localeCompare(b,'ko'));
      const row=(lbl,c,p,bold)=>`<tr${bold?' style="font-weight:800;background:#f8f9fa"':''}><td>${esc(lbl)}</td><td class="num">${share(c)}</td><td class="num">${fmt(c)}</td><td class="num">${fmt(p)}</td>${(c||p)?msPctCell(c,p):'<td class="num">-</td>'}</tr>`;
      $(bodyId).innerHTML=labels.length?row('총 오출고 건수',totalCur,totalPrev,true)+labels.map(l=>row(l,cur[l]||0,prv[l]||0)).join(''):`<tr><td colspan="5" class="data-empty">${isAll?'데이터가 없습니다.':'해당 월 데이터가 없습니다.'}</td></tr>`;
    };
    table(7,'msMgrBody');table(11,'msRsnBody');
    renderMisshipVisuals(all,curRows,label,totalCur);
  }

  function renderMisship(){renderMisshipCompare(read().misship?.rows||[])}


  /* 오출고 기록: 구글시트 열 순서 그대로(H열 '정리 문장' 제외) 보여주는 조회 전용 화면.
     행 형식: [접수시각, 매장, 제품명, 전산, 실입고, 미입고, 과입고, 담당자, 처리여부, 처리일, 처리 내용, 사유] (api/sync-misship-sheet.js와 동일) */
  function renderMisshipRecords(){
    if(!$('mrBody'))return;
    // 처음 열 때 기본 조회 기간: 2026-07-01 ~ 오늘
    if(!renderMisshipRecords.inited){renderMisshipRecords.inited=true;if(!$('mrStart').value)$('mrStart').value='2026-07-01';if(!$('mrEnd').value)$('mrEnd').value=today()}
    const d=read(),all=d.misship?.rows||[],st=$('mrStart').value,en=$('mrEnd').value,status=$('mrStatus').value,q=$('mrQuery').value.trim().toLowerCase();
    // 처리여부는 줄이 아니라 건(날짜+매장) 단위로 판단: 건 안의 모든 줄이 완료여야 완료. 일부만 완료된 건이 완료로 잘못 잡히지 않도록
    const inRange=all.filter(r=>{const dt=normDate(r[0]);return(!st||dt>=st)&&(!en||dt<=en)});
    const caseDone=new Map(misshipCases(inRange).map(c=>[c.key,c.done]));
    const rows=inRange.filter(r=>{const isDone=caseDone.get(msCaseKey(r));return(!status||(status==='done'?isDone:!isDone))&&(!q||r.some(x=>String(x??'').toLowerCase().includes(q)))}).sort((a,b)=>String(b[0])>String(a[0])?1:String(b[0])<String(a[0])?-1:0);
    const cases=misshipCases(rows),done=cases.filter(c=>caseDone.get(c.key)).length;
    $('mrCount').textContent=fmt(cases.length);$('mrDone').textContent=fmt(done);$('mrPending').textContent=fmt(cases.length-done);$('mrItems').textContent=`품목 ${fmt(rows.length)}줄`;
    $('mrUpdated').textContent=d.misship?.updatedAt?`마지막 연동: ${new Date(d.misship.updatedAt).toLocaleString('ko-KR')}`:'아직 연동된 데이터가 없습니다. 상단 동기화 버튼을 눌러주세요.';
    /* 접수시각은 날짜(년-월-일)까지만 표시 */
    const mrDateOnly=v=>{const s=String(v??'').trim(),m=s.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:s};
    const numCell=v=>`<td class="num">${String(v??'')===''?'':fmt(v)}</td>`,rowHtml=r=>`<tr><td style="white-space:nowrap">${esc(mrDateOnly(r[0]))}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td>${numCell(r[3])}${numCell(r[4])}${numCell(r[5])}${numCell(r[6])}<td>${esc(r[7])}</td><td>${esc(r[8])}</td><td style="white-space:nowrap">${esc(mrDateOnly(r[9]))}</td><td>${esc(r[10])}</td><td>${esc(r[11])}</td></tr>`;
    // 미완료 카드: 기간·검색과 상관없이 전체 데이터에서 아직 완료되지 않은 건(날짜+매장)을 항상 표시
    const allCases=misshipCases(all),pendingKeys=new Set(allCases.filter(c=>!c.done).map(c=>c.key));
    const pendingRows=all.filter(r=>pendingKeys.has(msCaseKey(r))).sort((a,b)=>String(b[0])>String(a[0])?1:String(b[0])<String(a[0])?-1:0);
    // 담당자 선택: 미완료 건에 있는 담당자로 목록을 만들고(공란은 기타(매장, 확인불가)), 고른 담당자의 줄만 표시
    const mgrOf=r=>String(r[7]??'').trim()||'기타(매장, 확인불가)',sel=$('mrPendingMgr'),picked=sel.value;
    const mgrCounts={};pendingRows.forEach(r=>{const k=mgrOf(r);(mgrCounts[k]=mgrCounts[k]||new Set()).add(msCaseKey(r))});
    sel.innerHTML='<option value="">전체 담당자</option>'+Object.keys(mgrCounts).sort((a,b)=>mgrCounts[b].size-mgrCounts[a].size||a.localeCompare(b,'ko')).map(k=>`<option value="${esc(k)}">${esc(k)} (${mgrCounts[k].size}건)</option>`).join('');
    sel.value=mgrCounts[picked]?picked:'';
    const shownRows=sel.value?pendingRows.filter(r=>mgrOf(r)===sel.value):pendingRows;
    $('mrPendingTitleCount').textContent=`${fmt(new Set(shownRows.map(msCaseKey)).size)}건`+(sel.value?` · ${sel.value}`:'');
    $('mrPendingBody').innerHTML=shownRows.length?shownRows.map(rowHtml).join(''):'<tr><td colspan="12" class="data-empty">미완료 오출고가 없습니다. 모두 처리 완료되었습니다.</td></tr>';
    // 오출고 기록: [조회] 또는 [전체]를 누른 뒤에만 표시
    $('mrBody').innerHTML=!renderMisshipRecords.searched?'<tr><td colspan="12" class="data-empty">기간·처리여부를 정한 뒤 "조회"를 누르면 기록이 표시됩니다.</td></tr>':rows.length?rows.slice(0,2000).map(rowHtml).join(''):'<tr><td colspan="12" class="data-empty">조회 결과가 없습니다.</td></tr>';
  }
  function damageFY(baseDate){
    const d=baseDate||new Date(),y=d.getFullYear(),m=d.getMonth()+1;
    const fyEndYear=m>=7?y+1:y;
    return{label:`FY${String(fyEndYear).slice(2)}`,start:`${fyEndYear-1}-07-01`,end:`${fyEndYear}-06-30`};
  }
  /* 파손 건수 = 기안(No.) 단위: 같은 No.(같은 날짜·매장)는 품목이 여러 줄이어도 1건. 금액은 줄별 파손 합계를 그대로 더함 */
  const dmCaseKey=r=>String(r[0]??'').trim()+'|'+normDate(r[1]??r[0])+'|'+String(r[2]??'').trim();
  const damageCaseCount=rows=>new Set(rows.map(dmCaseKey)).size;
  function renderDamageFY(){
    if(!$('dmFyBody'))return;
    const all=read().damage?.rows||[],fy=damageFY();
    $('dmFyCountLabel').textContent=`${fy.label} 총 파손 건수`;
    $('dmFyAmountLabel').textContent=`${fy.label} 총 파손 금액`;
    const rows=all.filter(r=>{const d=normDate(r[1]??r[0]);return d>=fy.start&&d<=fy.end});
    $('dmFyCount').textContent=fmt(damageCaseCount(rows));
    $('dmFyAmount').textContent=fmt(rows.reduce((a,r)=>a+num(r[7]),0))+'원';
    const group=$('dmFyGroup').value;
    const idx=group==='store'?2:group==='method'?3:group==='manager'?9:group==='category'?8:null,map={},amountOnly=group==='category';
    rows.forEach(r=>{const k=group==='month'?ym(r[1]??r[0]):(String(r[idx]??'').trim()||'(미지정)');if(!map[k])map[k]={cases:new Set(),a:0};map[k].cases.add(dmCaseKey(r));map[k].a+=num(r[7])});Object.values(map).forEach(v=>v.c=v.cases.size);
    // 표: 항목 | 건수 | 금액 | 금액 비중 (월별은 FY 순서, 그 외는 금액 순)
    const totalA=rows.reduce((a,r)=>a+num(r[7]),0),shareA=a=>totalA?(a/totalA*100).toFixed(1)+'%':'-';
    $('dmFyTableHead').innerHTML=`<th>${group==='month'?'월':group==='manager'?'담당자':group==='store'?'매장':group==='category'?'제품군':'출고방식'}</th>${amountOnly?'':'<th class="num">건수</th>'}<th class="num">금액</th><th class="num">금액 비중</th>`;
    const entries=Object.entries(map).sort((a,b)=>group==='month'?(a[0]>b[0]?1:a[0]<b[0]?-1:0):b[1].a-a[1].a);
    $('dmFyBody').innerHTML=entries.length?entries.map(([k,v])=>`<tr><td>${esc(k)}</td>${amountOnly?'':`<td class="num">${fmt(v.c)}건</td>`}<td class="num">${fmt(v.a)}원</td><td class="num">${shareA(v.a)}</td></tr>`).join(''):`<tr><td colspan="${amountOnly?3:4}" class="data-empty">데이터가 없습니다.</td></tr>`;
    renderDamageFYCharts(group,map,fy,amountOnly);
  }
  /* 파손 현황 그래프: 금액과 건수를 축 하나짜리 그래프 두 개로 분리(이중 축 사용 안 함).
     월별 = FY 7월~다음 해 6월 세로 막대, 그 외 = 상위 10개 가로 막대(금액 그래프는 금액 순, 건수 그래프는 건수 순). 제품군은 금액만 */
  const FY_TOP=10;
  function fyTip(e,html){const t=$('dmFyTip');if(!t)return;if(!html){t.hidden=true;return}t.innerHTML=html;t.hidden=false;const x=Math.min(e.clientX+14,innerWidth-t.offsetWidth-8),y=Math.max(8,e.clientY-t.offsetHeight-10);t.style.left=x+'px';t.style.top=y+'px'}
  const wonCompact=v=>{v=Math.round(v);if(Math.abs(v)>=1e8)return(v/1e8).toFixed(1).replace(/\.0$/,'')+'억';if(Math.abs(v)>=1e4)return fmt(Math.round(v/1e4))+'만';return fmt(v)};
  function renderDamageFYCharts(group,map,fy,amountOnly){
    const amtEl=$('dmFyAmtChart'),cntEl=$('dmFyCntChart');if(!amtEl||!cntEl)return;
    $('dmFyCntWrap').hidden=amountOnly;$('dmFyCharts').classList.toggle('single',amountOnly);
    const bindTips=el=>el.querySelectorAll('[data-tip]').forEach(n=>{n.onmousemove=e=>fyTip(e,n.dataset.tip);n.onmouseleave=e=>fyTip(e,null)});
    if(group==='month'){
      const months=[];for(let i=0;i<12;i++){const d=new Date(+fy.start.slice(0,4),6+i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
      const cols=(val,fmtV,unit)=>{const max=Math.max(1,...months.map(m=>val(map[m])));return`<div class="fy-cols">${months.map(m=>{const v=val(map[m]);return`<div class="fy-col" data-tip="${esc(`<b>${m}</b> · ${fmt(map[m]?.c||0)}건 · ${fmt(map[m]?.a||0)}원`)}"><span class="fy-col-val">${v?fmtV(v):''}</span><div class="fy-col-bar" style="height:${v?Math.max(v/max*170,3):0}px"></div></div>`}).join('')}</div><div class="fy-col-labels">${months.map(m=>`<span>${+m.slice(5)}월</span>`).join('')}</div>`};
      amtEl.innerHTML=cols(x=>x?.a||0,wonCompact,'원');cntEl.innerHTML=cols(x=>x?.c||0,fmt,'건');
      $('dmFyAmtSub').textContent=`${fy.label} 월별 · 단위 원`;$('dmFyCntSub').textContent=`${fy.label} 월별 · 기안(No.) 기준`;
    }else{
      const ent=Object.entries(map);
      const rowsHtml=(key,fmtV)=>{const s=[...ent].sort((a,b)=>b[1][key]-a[1][key]||a[0].localeCompare(b[0],'ko')),top=s.slice(0,FY_TOP),max=Math.max(1,...top.map(x=>x[1][key]));if(!top.length)return'<div class="fy-empty">데이터가 없습니다.</div>';return`<div class="fy-rows">${top.map(([k,v])=>`<div class="fy-row" data-tip="${esc(`<b>${esc(k)}</b>${amountOnly?'':` · ${fmt(v.c)}건`} · ${fmt(v.a)}원`)}"><span class="fy-row-name" title="${esc(k)}">${esc(k)}</span><div class="fy-row-track"><div class="fy-row-bar" style="width:${v[key]/max*100}%"></div></div><span class="fy-row-val">${fmtV(v[key])}</span></div>`).join('')}</div>${s.length>FY_TOP?`<div class="fy-more">상위 ${FY_TOP}개 표시 · 전체 ${fmt(s.length)}개는 아래 '전체 표 보기'</div>`:''}`};
      amtEl.innerHTML=rowsHtml('a',v=>fmt(v)+'원');cntEl.innerHTML=amountOnly?'':rowsHtml('c',v=>fmt(v)+'건');
      $('dmFyAmtSub').textContent=`${fy.label} · 금액 순 상위 ${FY_TOP}`;$('dmFyCntSub').textContent=`${fy.label} · 건수 순 상위 ${FY_TOP}`;
    }
    bindTips(amtEl);bindTips(cntEl);
  }

  function populateDamageDatalists(){
    const all=read().damage?.rows||[];
    const fill=(id,idx)=>{
      const el=$(id);if(!el)return;
      const vals=[...new Set(all.map(r=>String(r[idx]||'').trim()).filter(Boolean))].sort(KO_COLLATOR.compare);
      el.innerHTML=vals.map(v=>`<option value="${esc(v)}">`).join('');
    };
    fill('dmStoreDatalist',2);
    fill('dmManagerDatalist',9);
    fill('dmCategoryDatalist',8);
    fill('dmMethodDatalist',3);
  }
  let __damageHasSearched=false;
  function runDamageSearch(){__damageHasSearched=true;renderDamageRecords()}
  function renderDamageRecords(){
    if(!$('dmBody'))return;
    populateDamageDatalists();
    if(!__damageHasSearched){
      $('dmRecordSummary').textContent='기간·조건을 확인한 뒤 "조회"를 눌러주세요.';
      $('dmBody').innerHTML='<tr><td colspan="8" class="data-empty">"조회"를 누르면 결과가 표시됩니다.</td></tr>';
      return;
    }
    const all=read().damage?.rows||[];
    const st=$('dmStart').value,en=$('dmEnd').value;
    const storeQ=($('dmStoreQuery').value||'').trim().toLowerCase();
    const mgrQ=($('dmManagerQuery').value||'').trim().toLowerCase();
    const catQ=($('dmCategoryQuery').value||'').trim().toLowerCase();
    const methodQ=($('dmMethodQuery').value||'').trim().toLowerCase();
    const rows=all.filter(r=>{
      const d=normDate(r[1]??r[0]);
      return(!st||d>=st)&&(!en||d<=en)
        &&(!storeQ||String(r[2]||'').toLowerCase().includes(storeQ))
        &&(!mgrQ||String(r[9]||'').toLowerCase().includes(mgrQ))
        &&(!catQ||String(r[8]||'').toLowerCase().includes(catQ))
        &&(!methodQ||String(r[3]||'').toLowerCase().includes(methodQ));
    });
    const totalQty=rows.reduce((a,r)=>a+num(r[6]),0),totalAmt=rows.reduce((a,r)=>a+num(r[7]),0);
    $('dmRecordSummary').textContent=`${fmt(damageCaseCount(rows))}건 (품목 ${fmt(rows.length)}줄), 파손수량 합계 ${fmt(totalQty)}, 파손금액 합계 ${fmt(totalAmt)}원`;
    $('dmBody').innerHTML=rows.length?rows.slice(0,1000).map(r=>`<tr><td>${esc(normDate(r[1]??r[0]))}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[8])}</td><td>${esc(r[9])}</td><td class="num">${fmt(r[6])}</td><td class="num">${fmt(r[7])}원</td></tr>`).join(''):'<tr><td colspan="8" class="data-empty">조회 결과가 없습니다.</td></tr>';
  }
  function shiftMonth(ymStr,delta){
    const[y,m]=ymStr.split('-').map(Number),d=new Date(y,m-1+delta,1);
    return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function damageStatsForMonth(all,ymStr){
    const rows=all.filter(r=>ym(r[1]??r[0])===ymStr);
    return{amount:rows.reduce((a,r)=>a+num(r[7]),0),count:damageCaseCount(rows)};
  }
  function pctBadge(v){
    if(v===null)return'-';
    return`<span class="badge ${v<0?'danger':''}" style="font-size:15px;padding:7px 11px">${v<0?'▼':'▲'} ${Math.abs(v).toFixed(1)}%</span>`;
  }
  function renderDamageMoM(){
    if(!$('dmMomCurAmount'))return;
    const all=read().damage?.rows||[];
    const monthVal=$('dmMomMonth').value||today().slice(0,7);
    const cur=damageStatsForMonth(all,monthVal);
    const prevMonth=shiftMonth(monthVal,-1),prev=damageStatsForMonth(all,prevMonth);
    const yoyMonth=shiftMonth(monthVal,-12),yoy=damageStatsForMonth(all,yoyMonth);
    $('dmMomCurTitle').textContent=`${monthVal} 파손 현황`;
    $('dmMomCurAmount').textContent=fmt(cur.amount)+'원';
    $('dmMomCurCount').textContent=fmt(cur.count)+'건';
    $('dmMomPrevTitle').textContent=`전월대비`;
    $('dmMomPrevAmountPct').innerHTML=pctBadge(pct(cur.amount,prev.amount));
    $('dmMomPrevDetailLine').textContent=`${prevMonth} · ${fmt(prev.count)}건 · ${fmt(prev.amount)}원`;
    $('dmMomYoyTitle').textContent=`전년동월대비`;
    $('dmMomYoyAmountPct').innerHTML=pctBadge(pct(cur.amount,yoy.amount));
    $('dmMomYoyDetailLine').textContent=`${yoyMonth} · ${fmt(yoy.count)}건 · ${fmt(yoy.amount)}원`;
  }
  function renderDamage(){renderDamageFY();renderDamageRecords();renderDamageMoM()}
  /* 파손 분석: 매장·출고방식·담당자·제품군별 금액 비중 도넛(범례 Top 5) + 전월 대비 표.
     행 형식: [No, 기안 작성 일자, 매장명, 출고 방식, 제품명, (미사용), 파손 수량, 파손 합계, 제품군, 담당자]
     건수 = 기안(No.) 단위(dmCaseKey), 금액 = 품목별 파손 합계. 제품군은 금액만 집계.
     범례가 Top 5뿐이라 색은 그 달 순위 1-5위에 서로 다른 범주 색을 주고, 나머지는 그 외(회색)로 묶음 */
  const DI_DIMS=[{key:'manager',idx:9,label:'담당자',listAll:true},{key:'category',idx:8,label:'제품군',amountOnly:true,listAll:true},{key:'store',idx:2,label:'매장'},{key:'method',idx:3,label:'출고방식'}];
  const DI_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7'],DI_REST='#9aa0a6',DI_TOP=5;
  const diLabel=v=>String(v??'').trim()||'(미지정)';
  const wonShort=v=>{v=Math.round(v);if(Math.abs(v)>=1e8)return(v/1e8).toFixed(1).replace(/\.0$/,'')+'억원';if(Math.abs(v)>=1e4)return fmt(Math.round(v/1e4))+'만원';return fmt(v)+'원'};
  function diGroup(rows,idx){const m={};rows.forEach(r=>{const k=diLabel(r[idx]);if(!m[k])m[k]={a:0,cases:new Set()};m[k].a+=num(r[7]);m[k].cases.add(dmCaseKey(r))});Object.values(m).forEach(v=>v.c=v.cases.size);return m}
  function diTip(e,html){const t=$('dmTip');if(!t)return;if(!html){t.hidden=true;return}t.innerHTML=html;t.hidden=false;const x=Math.min(e.clientX+14,innerWidth-t.offsetWidth-8),y=Math.max(8,e.clientY-t.offsetHeight-10);t.style.left=x+'px';t.style.top=y+'px'}
  function diMoveCell(cur,base){const p=pct(cur,base);if(p===null)return'<td class="num" style="color:#8a949e">신규</td>';if(p===0)return'<td class="num" style="color:#8a949e">0.0%</td>';return`<td class="num" style="font-weight:800;color:${p>0?'#d64545':'#2f7de1'}">${p>0?'▲':'▼'} ${Math.abs(p).toFixed(1)}%</td>`}
  function diDonut(host,dim,cur,colors,totalAmt,totalCases,m){
    const donut=host.querySelector('.ms-donut'),legend=host.querySelector('.ms-legend');
    const share=a=>totalAmt?(a/totalAmt*100).toFixed(1)+'%':'-';
    const ranked=Object.entries(cur).sort((a,b)=>b[1].a-a[1].a||a[0].localeCompare(b[0],'ko')).map(([k,v],i)=>({k,a:v.a,c:v.c,col:DI_COLORS[i]||DI_REST}));
    const items=ranked.slice(0,DI_TOP),rest=ranked.slice(DI_TOP);
    if(rest.length)items.push({k:'그 외',a:rest.reduce((s,x)=>s+x.a,0),col:'#dfe2e6',other:rest.map(x=>x.k)});
    const sum=items.reduce((s,x)=>s+x.a,0);
    if(!sum){donut.innerHTML='';legend.innerHTML='<div class="ms-empty">해당 월 데이터가 없습니다.</div>';return}
    const R=46,SW=18,C=2*Math.PI*R,GAP=items.length>1?2:0;let off=0;
    const segs=items.map((x,i)=>{const len=x.a/sum*C,s=`<circle class="seg" data-i="${i}" cx="60" cy="60" r="${R}" fill="none" stroke="${x.col}" stroke-width="${SW}" stroke-dasharray="${Math.max(len-GAP,0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"></circle>`;off+=len;return s}).join('');
    donut.innerHTML=`<svg viewBox="0 0 120 120" role="img" aria-label="${esc(m)} ${esc(dim.label)}별 파손 금액 비중"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#f2f4f6" stroke-width="${SW}"></circle>${segs}</svg><div class="ms-donut-center"><small>총 파손 금액</small><b style="font-size:17px">${wonShort(totalAmt)}</b><small>${fmt(totalCases)}건</small></div>`;
    legend.innerHTML=items.map((x,i)=>x.other?`<div class="ms-legend-more" data-i="${i}">그 외 ${fmt(x.other.length)}개 항목 · ${wonShort(x.a)} (전체는 아래 표 참고)</div>`:`<div class="ms-legend-row" data-i="${i}"><i style="background:${x.col}"></i><span title="${esc(x.k)}">${esc(x.k)}</span><small>${fmt(x.a)}원</small><b>${share(x.a)}</b></div>`).join('');
    const hot=i=>{donut.classList.toggle('dim',i!=null);donut.querySelectorAll('.seg').forEach(s=>s.classList.toggle('hot',String(i)===s.dataset.i))};
    donut.querySelectorAll('.seg').forEach(s=>{const x=items[s.dataset.i];s.onmousemove=e=>{hot(s.dataset.i);diTip(e,`<b>${esc(x.k)}</b> · ${fmt(x.a)}원 · ${share(x.a)}${!dim.amountOnly&&x.c!=null?` · ${fmt(x.c)}건`:''}${x.other?`<br><small>${esc(x.other.slice(0,6).join(', '))}${x.other.length>6?` 외 ${x.other.length-6}개`:''}</small>`:''}`)};s.onmouseleave=e=>{hot(null);diTip(e,null)}});
    legend.querySelectorAll('.ms-legend-row,.ms-legend-more').forEach(r=>{r.onmouseenter=()=>hot(r.dataset.i);r.onmouseleave=()=>hot(null)});
  }
  function renderDamageInsight(){
    const host=$('diSections');if(!host)return;
    // 기준월이 비어 있으면 전체 기간 분석(기본값). 월을 고르면 그 달 + 전월 대비, [전체]로 다시 전체 기간
    const all=read().damage?.rows||[],m=$('diMonth').value,isAll=!m,pm=isAll?'':shiftMonth(m,-1),label=isAll?'전체 기간':m;
    const inM=x=>all.filter(r=>ym(r[1]??r[0])===x),curRows=isAll?all:inM(m),prvRows=isAll?[]:inM(pm);
    host.closest('.panel')?.classList.toggle('ms-all-mode',isAll);$('diAllBtn')?.classList.toggle('primary',isAll);
    const totalAmt=curRows.reduce((s,r)=>s+num(r[7]),0),prevAmt=prvRows.reduce((s,r)=>s+num(r[7]),0);
    const totalCases=damageCaseCount(curRows),prevCases=damageCaseCount(prvRows);
    host.innerHTML=DI_DIMS.map(dim=>`<div class="ms-section" data-dim="${dim.key}"><h4 class="ms-section-title">${dim.label}별${dim.amountOnly?' <small style="font-size:12px;color:#8a949e;font-weight:600">(금액 기준)</small>':''}</h4><div class="ms-section-grid"><div class="ms-card"><div class="ms-card-head"><b>${dim.label}별 파손 금액 비중</b><span>${esc(label)}</span></div><div class="ms-donut-wrap"><div class="ms-donut"></div><div class="ms-legend"></div></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${dim.label}</th><th class="num">비중</th><th class="num">${esc(label)} 금액</th>${dim.amountOnly?'':`<th class="num">건수</th>`}<th class="num">${esc(pm)} 금액</th><th class="num">전월 대비</th></tr></thead><tbody></tbody></table></div></div></div>`).join('');
    DI_DIMS.forEach(dim=>{
      const sec=host.querySelector(`[data-dim="${dim.key}"]`),cur=diGroup(curRows,dim.idx),prv=diGroup(prvRows,dim.idx);
      // 휴대폰: 상단 탭에서 고른 항목만 표시(기본 담당자별). 데스크톱은 CSS에서 모두 표시
      sec.classList.toggle('di-off',dim.key!==(renderDamageInsight.mobileDim||'manager'));
      diDonut(sec,dim,cur,null,totalAmt,totalCases,label);
      const share=a=>totalAmt?(a/totalAmt*100).toFixed(1)+'%':'-';
      const row=(k,a,c,pa,bold)=>`<tr${bold?' style="font-weight:800;background:#f8f9fa"':''}><td>${esc(k)}</td><td class="num">${share(a)}</td><td class="num">${fmt(a)}원</td>${dim.amountOnly?'':`<td class="num">${fmt(c)}건</td>`}<td class="num">${fmt(pa)}원</td>${(a||pa)?diMoveCell(a,pa):'<td class="num">-</td>'}</tr>`;
      // 담당자·제품군(listAll)은 전체 기간에 나온 항목을 0원이어도 모두 표시, 매장·출고방식은 조회월에 금액이 있는 항목만
      const labels=(dim.listAll?Object.keys(diGroup(all,dim.idx)):Object.keys(cur).filter(k=>cur[k].a>0)).sort((a,b)=>(cur[b]?.a||0)-(cur[a]?.a||0)||(prv[b]?.a||0)-(prv[a]?.a||0)||a.localeCompare(b,'ko'));
      sec.querySelector('tbody').innerHTML=labels.length?row('총 파손',totalAmt,totalCases,prevAmt,true)+labels.map(k=>row(k,cur[k]?.a||0,cur[k]?.c||0,prv[k]?.a||0)).join(''):`<tr><td colspan="${dim.amountOnly?5:6}" class="data-empty">${isAll?'데이터가 없습니다.':'해당 월 데이터가 없습니다.'}</td></tr>`;
    });
  }

  function boxRows(){return read().box?.rows||[]}
  function saveBoxRows(rows){const d=read();d.box={header:['날짜','요일','담당자','매장','수량'],rows,updatedAt:new Date().toISOString(),mode:'표 직접 입력'};save(d)}
  function weekday(d){try{return ['일','월','화','수','목','금','토'][new Date(d+'T12:00:00').getDay()]}catch{return''}}
  function boxAutoSaveTick(){const el=$('boxAutoSaveState');if(!el)return;el.textContent='자동 저장 완료';clearTimeout(window.__boxSaveTimer);window.__boxSaveTimer=setTimeout(()=>el.textContent='자동 저장',900)}
  function boxTodayKey(){try{return typeof todayKey==='function'?todayKey():new Date().toISOString().slice(0,10)}catch{return new Date().toISOString().slice(0,10)}}
  let boxHasSearched=false;
  function isoWeekKey(dateStr){
    const d=new Date(dateStr+'T00:00:00');
    if(isNaN(d))return'';
    const t=new Date(d.valueOf());
    const dayNr=(d.getDay()+6)%7;
    t.setDate(t.getDate()-dayNr+3);
    const firstThursday=new Date(t.getFullYear(),0,4);
    const diff=t-firstThursday;
    const week=1+Math.round(diff/(7*24*60*60*1000));
    return `${t.getFullYear()}-W${String(week).padStart(2,'0')}`;
  }
  function populateBoxFilterDropdowns(){
    const mgrList=$('boxManagerDatalist'),storeList=$('boxStoreDatalist');
    if(mgrList&&!mgrList.dataset.filled){
      mgrList.innerHTML=BOX_MANAGERS.map(m=>`<option value="${esc(m)}">`).join('');
      mgrList.dataset.filled='1';
    }
    if(storeList){
      const map=getBoxStoreMap();
      const allStores=[...new Set(Object.values(map).flat())].sort(KO_COLLATOR.compare);
      storeList.innerHTML=allStores.map(s=>`<option value="${esc(s)}">`).join('');
    }
  }
  function runBoxSearch(){
    boxHasSearched=true;
    renderBox();
  }
  function renderBox(){
    if(!$('boxBody'))return;
    if(!boxHasSearched){
      $('boxBody').innerHTML='<tr><td colspan="5" class="data-empty">기간·담당자·매장 중 하나 이상 선택한 뒤 "조회"를 눌러주세요.</td></tr>';
      $('boxResultSummary').textContent='-';
      $('boxSumQty').textContent='-';$('boxSumManagers').textContent='-';$('boxSumWeeklyAvg').textContent='-';$('boxSumMonthlyAvg').textContent='-';
      return;
    }
    const st=$('boxStart').value,en=$('boxEnd').value,mgr=$('boxManagerFilter').value.trim().toLowerCase(),store=$('boxStoreFilter').value.trim().toLowerCase();
    const rows=boxRows().filter(r=>(!st||!r[0]||normDate(r[0])>=st)&&(!en||!r[0]||normDate(r[0])<=en)&&(!mgr||String(r[2]||'').toLowerCase().includes(mgr))&&(!store||String(r[3]||'').toLowerCase().includes(store))&&num(r[4])>0);
    const sorted=rows.slice().sort((a,b)=>{const A=normDate(a[0]||''),B=normDate(b[0]||'');return B>A?1:B<A?-1:0});
    const totalQty=sorted.reduce((a,r)=>a+num(r[4]),0);
    const managerCount=new Set(sorted.map(r=>r[2]).filter(Boolean)).size;
    const monthCount=new Set(sorted.map(r=>normDate(r[0]||'').slice(0,7)).filter(Boolean)).size||1;
    const weekCount=new Set(sorted.map(r=>isoWeekKey(normDate(r[0]||''))).filter(Boolean)).size||1;
    $('boxSumQty').textContent=fmt(totalQty);
    $('boxSumManagers').textContent=fmt(managerCount);
    $('boxSumWeeklyAvg').textContent=fmt(Math.round(totalQty/weekCount));
    $('boxSumMonthlyAvg').textContent=fmt(Math.round(totalQty/monthCount));
    $('boxResultSummary').textContent=`${fmt(sorted.length)}건`;
    $('boxBody').innerHTML=sorted.length?sorted.map(r=>`<tr>
      <td>${esc(normDate(r[0]||''))}</td>
      <td>${esc(r[1]||(r[0]?weekday(normDate(r[0])):''))}</td>
      <td>${esc(r[2]||'')}</td>
      <td>${esc(r[3]||'')}</td>
      <td class="num">${fmt(r[4])}</td>
    </tr>`).join(''):'<tr><td colspan="5" class="data-empty">조회 결과가 없습니다.</td></tr>';
  }

  const BOX_MANAGERS=['Sand','Black','Furze','Volcano','Star','Blue','Time','Art','Amazon','New','Tarot','Bus','Hanami','Luxe'];
  const BOX_STOREMAP_KEY='lush-logistics-box-storemap-v1';
  const BOX_STOREMAP_DEFAULT={
    '월':['월드몰','압1','강남','코엑스','청량리','아산','안성','청주'],
    '화':['신림','영등포','동탄','롯강남','신강남','노원','롯수원','수지','AK수원','신대전','롯대전','타임월드'],
    '수':['고양','일산','명동','신본','광교','스수','평촌','홍대','타임SQ','롯본','인천'],
    '목':['성수','롯미아','현미아','송도','현중동','롯중동','신촌','IFC','하남','천호','두물머리'],
    '금':['잠실','스페원','의정부','AK분당','경기','판교','목동','마곡','김포','용산','이태원'],
    '토':[],
    '일':[]
  };
  const BOX_DOW_ORDER=['월','화','수','목','금','토','일'];
  function getBoxStoreMap(){
    try{
      const v=JSON.parse(localStorage.getItem(BOX_STOREMAP_KEY)||'null');
      if(v&&typeof v==='object')return v;
    }catch{}
    return JSON.parse(JSON.stringify(BOX_STOREMAP_DEFAULT));
  }
  function saveBoxStoreMap(m){localStorage.setItem(BOX_STOREMAP_KEY,JSON.stringify(m))}
  function dowOf(dateStr){
    if(!dateStr)return'';
    const d=new Date(dateStr+'T12:00:00');
    if(isNaN(d))return'';
    return ['일','월','화','수','목','금','토'][d.getDay()];
  }
  let __boxPendingRows=null;
  let __boxSaveTimer=null;
  function flushBoxPendingSave(){
    if(__boxSaveTimer){clearTimeout(__boxSaveTimer);__boxSaveTimer=null}
    if(__boxPendingRows){saveBoxRows(__boxPendingRows);__boxPendingRows=null}
  }
  window.flushBoxPendingSave=flushBoxPendingSave;
  window.addEventListener('beforeunload',flushBoxPendingSave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushBoxPendingSave()});
  function upsertBoxQty(date,dow,manager,store,qty){
    if(!__boxPendingRows)__boxPendingRows=boxRows();
    const rows=__boxPendingRows;
    const idx=rows.findIndex(r=>r[0]===date&&r[2]===manager&&r[3]===store);
    if(qty>0){
      if(idx>=0)rows[idx]=[date,dow,manager,store,qty];
      else rows.push([date,dow,manager,store,qty]);
    }else if(idx>=0){
      rows.splice(idx,1);
    }
    boxAutoSaveTick();
    clearTimeout(__boxSaveTimer);
    __boxSaveTimer=setTimeout(flushBoxPendingSave,600);
  }
  function boxQtyLookup(date){
    const map={};
    boxRows().forEach(r=>{if(r[0]===date)map[`${r[2]}|${r[3]}`]=r[4]});
    return map;
  }
  function renderBoxGrid(date,dow,stores){
    const wrap=$('boxGridWrap'),empty=$('boxGridEmpty'),head=$('boxGridHeadRow'),body=$('boxGridBody');
    if(!wrap||!empty||!head||!body)return;
    if(!stores||!stores.length){
      wrap.hidden=true;
      empty.style.display='block';
      empty.textContent=`${dow}요일에 등록된 매장이 없습니다. "요일별 매장 설정"에서 추가해주세요.`;
      return;
    }
    empty.style.display='none';
    wrap.hidden=false;
    const qtyMap=boxQtyLookup(date);
    head.innerHTML='<th>담당자</th>'+stores.map(s=>`<th>${esc(s)}</th>`).join('');
    const totalRow=`<tr class="box-grid-total-row"><th>합계</th>${stores.map(store=>{
      const sum=BOX_MANAGERS.reduce((a,mgr)=>a+num(qtyMap[`${mgr}|${store}`]),0);
      return `<td data-box-total-store="${esc(store)}">${fmt(sum)}</td>`;
    }).join('')}</tr>`;
    const managerRows=BOX_MANAGERS.map(mgr=>`<tr><th>${esc(mgr)}</th>${stores.map(store=>{
      const v=qtyMap[`${mgr}|${store}`];
      return `<td><input type="number" min="0" data-box-grid-manager="${esc(mgr)}" data-box-grid-store="${esc(store)}" value="${v!=null&&v!==''?v:''}" placeholder="0"></td>`;
    }).join('')}</tr>`).join('');
    body.innerHTML=totalRow+managerRows;
    function refreshBoxGridTotals(){
      stores.forEach(store=>{
        let sum=0;
        body.querySelectorAll(`input[data-box-grid-store="${CSS.escape(store)}"]`).forEach(i=>sum+=num(i.value));
        const cell=body.querySelector(`[data-box-total-store="${CSS.escape(store)}"]`);
        if(cell)cell.textContent=fmt(sum);
      });
    }
    let __boxResultsRenderTimer=null;
    body.querySelectorAll('input[data-box-grid-manager]').forEach(inp=>{
      inp.oninput=()=>{
        upsertBoxQty(date,dow,inp.dataset.boxGridManager,inp.dataset.boxGridStore,num(inp.value));
        refreshBoxGridTotals();
        clearTimeout(__boxResultsRenderTimer);
        __boxResultsRenderTimer=setTimeout(renderBox,500);
      };
      inp.addEventListener('keydown',e=>{
        const key=e.key;
        if(key!=='ArrowRight'&&key!=='ArrowLeft'&&key!=='ArrowUp'&&key!=='ArrowDown')return;
        e.preventDefault();
        const td=inp.closest('td'),tr=td.parentElement;
        const cellIndex=Array.prototype.indexOf.call(tr.children,td);
        let targetTr=tr,targetIndex=cellIndex;
        if(key==='ArrowRight')targetIndex=cellIndex+1;
        else if(key==='ArrowLeft')targetIndex=cellIndex-1;
        else if(key==='ArrowDown')targetTr=tr.nextElementSibling;
        else if(key==='ArrowUp')targetTr=tr.previousElementSibling;
        if(!targetTr)return;
        const targetTd=targetTr.children[targetIndex];
        const targetInput=targetTd&&targetTd.querySelector('input');
        if(targetInput){targetInput.focus();targetInput.select()}
      });
    });
  }
  function loadBoxGrid(){
    flushBoxPendingSave();
    const date=$('boxGridDate')?.value||'';
    if(!date){toastMsg('출고일을 선택해주세요.');return}
    const dow=dowOf(date);
    $('boxGridDow').textContent=`${date} (${dow}요일)`;
    renderBoxGrid(date,dow,getBoxStoreMap()[dow]||[]);
  }
  function openBoxStoreMapDialog(){
    const map=getBoxStoreMap(),holder=$('boxStoreMapFields');
    holder.innerHTML=BOX_DOW_ORDER.map(d=>`<div class="field" style="margin-bottom:9px"><label>${d}요일</label><input type="text" data-storemap-day="${d}" value="${esc((map[d]||[]).join(', '))}" placeholder="매장명을 쉼표로 구분해 입력"></div>`).join('');
    $('boxStoreMapDialog').style.display='grid';
  }
  function closeBoxStoreMapDialog(){$('boxStoreMapDialog').style.display='none'}
  function saveBoxStoreMapDialog(){
    const map={};
    $('boxStoreMapFields').querySelectorAll('[data-storemap-day]').forEach(inp=>{
      map[inp.dataset.storemapDay]=inp.value.split(',').map(s=>s.trim()).filter(Boolean);
    });
    saveBoxStoreMap(map);
    closeBoxStoreMapDialog();
    toastMsg('요일별 매장 설정을 저장했습니다.');
    populateBoxFilterDropdowns();
    const date=$('boxGridDate')?.value||'';
    if(date)loadBoxGrid();
  }
  function renderOos(){if(!$('oosBody')||typeof inventoryDb==='undefined')return;const st=$('oosStart').value,en=$('oosEnd').value,owner=$('oosOwner').value,min=Math.max(1,num($('oosMin').value)||1),q=$('oosQuery').value.trim().toLowerCase();const result=[];let snapshotCount=0;for(const [on,o] of Object.entries(inventoryDb.owners||{})){if(owner&&on!==owner)continue;const dates=Object.keys(o.snapshots||{}).sort().filter(d=>(!st||d>=st)&&(!en||d<=en));snapshotCount+=dates.length;const prodMap={};dates.forEach(d=>{(o.snapshots[d]?.products||[]).forEach(p=>{const key=p.id||p.name;if(!key)return;if(!prodMap[key])prodMap[key]={owner:on,id:p.id,name:p.name,cat:p.sourceCategory||p.category||'',out:[]};const actual=(p.lots||[]).reduce((a,l)=>a+num(l.qty),0);if(actual===0)prodMap[key].out.push(d)})});Object.values(prodMap).forEach(x=>{if(x.out.length>=min&&(!q||String(x.id).toLowerCase().includes(q)||String(x.name).toLowerCase().includes(q)))result.push(x)})}result.sort((a,b)=>b.out.length-a.out.length);$('oosSku').textContent=fmt(result.length);$('oosDays').textContent=fmt(result.reduce((a,x)=>a+x.out.length,0));$('oosMax').textContent=fmt(result[0]?.out.length||0);$('oosSnapshots').textContent=fmt(snapshotCount);$('oosBody').innerHTML=result.length?result.map(x=>`<tr><td>${esc(x.owner)}</td><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${esc(x.cat)}</td><td class="num">${fmt(x.out.length)}</td><td>${esc(x.out.join(', '))}</td></tr>`).join(''):'<tr><td colspan="6" class="data-empty">조회 결과가 없습니다.</td></tr>';window.__OOS_ROWS=result}
  function excelSerialToLocalStr(serial){
    const utcDays=Math.floor(serial-25569);
    const d=new Date(utcDays*86400*1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  function fixDateCell(v){
    if(v instanceof Date&&!isNaN(v)){
      return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
    }
    if(typeof v==='number'&&v>15000&&v<80000){
      return excelSerialToLocalStr(v);
    }
    return v;
  }
  function fixDateCellsToLocal(rows,dateColIdx){
    return rows.map(r=>{
      const x=[...r];
      if(dateColIdx!=null&&dateColIdx<x.length)x[dateColIdx]=fixDateCell(x[dateColIdx]);
      return x.map(v=>v instanceof Date?fixDateCell(v):v);
    });
  }
  function readRawColumn(ws,colIdx,rowCount,startRow){
    const colLetter=XLSX.utils.encode_col(colIdx);
    const out=[];
    for(let i=0;i<rowCount;i++){
      const addr=colLetter+(startRow+i);
      const cell=ws[addr];
      out.push(cell?cell.v:'');
    }
    return out;
  }
  async function handle(inp){const f=inp.files?.[0];if(!f)return;try{await window.ensureXLSX();const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];const values=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});if(values.length<2)throw new Error('데이터가 없습니다.');const typeForDate=inp.dataset.type;const dateColIdx=({'입고':0,'출고':0,'오출고':0,'파손':1,'출고박스':0})[typeForDate];
    const dataRowCount=values.length-1;
    const rawDateCol=(dateColIdx!=null)?readRawColumn(ws,dateColIdx,dataRowCount,2):null;
    if(rawDateCol){for(let i=0;i<dataRowCount;i++){if(values[i+1])values[i+1][dateColIdx]=rawDateCol[i]}}
    const header=values[0].map(x=>String(x??'').trim()),raw=fixDateCellsToLocal(values.slice(1).filter(r=>r.some(x=>x!==''&&x!=null)),dateColIdx);const type=inp.dataset.type;
    /* 엑셀에서 중간 칸이 비어있는 행은 그 칸을 건너뛰고 뒤 칸들이 한 칸씩 앞으로 당겨져서 읽히는 경우가 있습니다.
       모든 행의 길이를 헤더 길이에 맞춰 채워서, 칸 위치가 행마다 어긋나지 않도록 합니다. */
    raw.forEach(r=>{while(r.length<header.length)r.push('')});
    /* 출고 원본 파일의 '제품군' 칸은 이름이 비어있거나 자리가 매번 달라져서 헤더 이름만으로는 찾을 수 없었습니다.
       엑셀에 제품코드↔제품군 매핑표가 2번째 시트로 같이 들어있으면, 그걸로 제품코드마다 제품군을 정확히 찾아
       '제품군'이라는 이름표를 붙인 새 칸으로 맨 뒤에 추가합니다. (Sheet1의 애매한 칸은 그대로 두고 건드리지 않습니다.) */
    if(type==='출고'&&wb.SheetNames.length>1){
      try{
        const ws2=wb.Sheets[wb.SheetNames[1]];
        const catRows=XLSX.utils.sheet_to_json(ws2,{header:1,defval:'',raw:true});
        if(catRows.length>1){
          const catHeader=catRows[0].map(x=>String(x??'').trim());
          const normC=s=>String(s||'').replace(/\s+/g,'');
          const findCatCol=(...labels)=>{
            for(const lbl of labels){const i=catHeader.findIndex(h=>normC(h)===normC(lbl));if(i>=0)return i}
            for(const lbl of labels){const i=catHeader.findIndex(h=>normC(h).includes(normC(lbl)));if(i>=0)return i}
            return -1;
          };
          const ci=findCatCol('제품코드','코드'),cg=findCatCol('제품군','카테고리');
          if(ci>=0&&cg>=0){
            const catMap={};
            catRows.slice(1).forEach(r=>{const code=String(r[ci]??'').trim();if(code)catMap[code]=String(r[cg]??'').trim()});
            const codeIdx=outboundColIndex(header).code;
            // 원본 Sheet1에 이미 '제품군'이라는 이름표가 있으면(값이 안 맞을 수 있어서) 이름표만 바꿔서
            // 헤더에 '제품군'이 중복으로 남지 않게 하고, 방금 매핑한 새 칸이 확실히 쓰이도록 합니다.
            header.forEach((h,i)=>{if(String(h||'').trim()==='제품군')header[i]='제품군(원본,미사용)'});
            header.push('제품군');
            let matched=0;
            raw.forEach(r=>{const code=String(r[codeIdx]??'').trim();const c=catMap[code]||'';if(c)matched++;r.push(c)});
            window.__lastOutboundCatMapInfo=`2번째 시트(${wb.SheetNames[1]})에서 제품군 매핑 ${fmt(Object.keys(catMap).length)}건을 찾았고, 이번 업로드 ${fmt(raw.length)}행 중 ${fmt(matched)}행에 제품군을 붙였습니다.`;
          }else{
            window.__lastOutboundCatMapInfo=`2번째 시트(${wb.SheetNames[1]})에서 '제품코드'/'제품군' 컬럼을 찾지 못해 매핑을 적용하지 못했습니다. (헤더: ${catHeader.join(', ')})`;
          }
        }else{
          window.__lastOutboundCatMapInfo=`2번째 시트(${wb.SheetNames[1]})에 데이터가 없어 매핑을 적용하지 못했습니다.`;
        }
      }catch(e){
        console.error('제품군 매핑 시트 처리 실패:',e);
        window.__lastOutboundCatMapInfo=`제품군 매핑 시트를 읽는 중 오류가 발생했습니다: ${e.message}`;
      }
    }else{
      window.__lastOutboundCatMapInfo=type==='출고'?'이 파일에는 2번째 시트(제품군 매핑표)가 없습니다.':null;
    }
    const key=({'입고':'inbound','출고':'outbound','오출고':'misship','파손':'damage','출고박스':'box','단가표':'priceList','출고요약':'summaryImport'})[type];const data=read();if(key==='priceList'){
      data.priceList={header,rows:raw,updatedAt:new Date().toISOString(),sourceFile:f.name,mode:'전체 교체'};save(data);
      rebuildOutboundMonthlySummary();
      rebuildInboundMonthlySummary();
    }else if(key==='summaryImport'){
      const{count,skipped}=importOutboundMonthlySummary(header,raw);
      window.renderOutbound?.();
      const hist=JSON.parse(localStorage.getItem(HIST_KEY_LOCAL)||'[]');
      hist.unshift({time:new Date().toLocaleString('ko-KR'),name:f.name,type,rows:count,mode:`요약 반영${skipped?` (건너뜀 ${skipped}개월)`:''}`});
      localStorage.setItem(HIST_KEY_LOCAL,JSON.stringify(hist.slice(0,50)));
      if(typeof renderHistory==='function')renderHistory();
      if(typeof toastMsg==='function')toastMsg(`출고 요약 ${fmt(count)}개월치를 반영했습니다.${skipped?` (원본 데이터가 이미 있는 ${fmt(skipped)}개월은 건너뜀)`:''}`);
      inp.value='';
      return;
    }else if(key){let rows=raw;if(key==='misship')rows=cleanMisship(raw);if(key==='damage')rows=cleanDamage(raw);if(key==='inbound'){rows=upsertByKey(data[key]?.rows||[],rows,r=>String(r[1]||'').trim());}else{const dateMergeIdx=({'출고':0,'box':0,'misship':0,'damage':1})[key];rows=upsertByDate(data[key]?.rows||[],rows,dateMergeIdx);}
    const archiveDateIdx=({inbound:0,outbound:0,box:0,misship:0,damage:1})[key];
    rows=archiveOldRows(key,header,rows,archiveDateIdx);
    data[key]={header,rows,updatedAt:new Date().toISOString(),sourceFile:f.name,mode:'날짜 기준 누적/교체'};save(data);if(key==='outbound')rebuildOutboundMonthlySummary();if(key==='inbound')rebuildInboundMonthlySummary();}const hist=JSON.parse(localStorage.getItem(HIST_KEY_LOCAL)||'[]');hist.unshift({time:new Date().toLocaleString('ko-KR'),name:f.name,type,rows:raw.length,mode:key?(data[key]?.mode||'반영'):'읽기'});localStorage.setItem(HIST_KEY_LOCAL,JSON.stringify(hist.slice(0,50)));if(typeof renderHistory==='function')renderHistory();renderAll();if(typeof BASE_NOTIFY==='function')BASE_NOTIFY(`${type} 데이터 업데이트`,`${f.name} · ${fmt(raw.length)}행 반영`);if(typeof toastMsg==='function')toastMsg(`${type} 파일 ${fmt(raw.length)}행을 반영했습니다.`)}catch(e){console.error(e);if(typeof toastMsg==='function')toastMsg('파일을 읽는 중 오류가 발생했습니다: '+e.message)}finally{inp.value=''}}
  function exportOos(){const rows=window.__OOS_ROWS||[];if(!rows.length)return;const csv='\ufeff'+[['담당자','제품코드','제품명','제품군','품절일','품절 기준일'],...rows.map(x=>[x.owner,x.id,x.name,x.cat,x.out.length,x.out.join(' / ')])].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='품절재고_분석.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  const ARCHIVE_DATE_IDX={inbound:0,outbound:0,box:0,misship:0,damage:1};
  const INVENTORY_ARCHIVE_HEADER=['담당자','날짜','제품코드','제품명','제품군','시스템재고','실사재고'];
  function inventoryArchiveRows(start,end){
    const archive=window.readInventoryArchive?window.readInventoryArchive():{owners:{}};
    const out=[];
    Object.entries(archive.owners||{}).forEach(([owner,o])=>{
      Object.entries(o.snapshots||{}).forEach(([d,snap])=>{
        if(start&&d<start)return;
        if(end&&d>end)return;
        (snap.products||[]).forEach(p=>{
          const actual=(p.lots||[]).reduce((a,l)=>a+num(l.qty),0);
          out.push([owner,d,p.id||'',p.name||'',p.sourceCategory||p.category||'',p.system??'',actual]);
        });
      });
    });
    return out;
  }
  function renderDataArchive(){
    if(!$('archiveBody'))return;
    const type=$('archiveType')?.value||'inbound';
    const start=$('archiveStart')?.value||'',end=$('archiveEnd')?.value||'';
    if(type==='inventory'){
      const header=INVENTORY_ARCHIVE_HEADER;
      const rows=inventoryArchiveRows(start,end);
      $('archiveTableHead').innerHTML=`<tr>${header.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>`;
      $('archiveBody').innerHTML=rows.length?rows.slice().sort((a,b)=>{const A=String(a[1]),B=String(b[1]);return B>A?1:B<A?-1:0}).slice(0,2000).map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${header.length}" class="data-empty">보관된 데이터가 없습니다.</td></tr>`;
      $('archiveRowCount').textContent=`${fmt(rows.length)}행`;
      return;
    }
    const archive=readArchive();
    const entry=archive[type];
    const dateIdx=ARCHIVE_DATE_IDX[type];
    const header=entry?.header||[];
    const rows=(entry?.rows||[]).filter(r=>{
      const rd=normDate(r[dateIdx]);
      return(!start||!rd||rd>=start)&&(!end||!rd||rd<=end);
    });
    $('archiveTableHead').innerHTML=header.length?`<tr>${header.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>`:'';
    $('archiveBody').innerHTML=rows.length?rows.slice().sort((a,b)=>{const A=normDate(a[dateIdx]),B=normDate(b[dateIdx]);return B>A?1:B<A?-1:0}).slice(0,2000).map(r=>`<tr>${header.map((_,i)=>`<td>${esc(r[i])}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${Math.max(1,header.length)}" class="data-empty">보관된 데이터가 없습니다.</td></tr>`;
    $('archiveRowCount').textContent=`${fmt(rows.length)}행`;
  }
  function exportArchiveCsv(){
    const type=$('archiveType')?.value||'inbound';
    const start=$('archiveStart')?.value||'',end=$('archiveEnd')?.value||'';
    if(type==='inventory'){
      const header=INVENTORY_ARCHIVE_HEADER;
      const rows=inventoryArchiveRows(start,end);
      if(!rows.length){if(typeof toastMsg==='function')toastMsg('내보낼 보관 데이터가 없습니다.');return}
      const csvRows=[header,...rows];
      const csv='\ufeff'+csvRows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
      download(`보관함_재고.csv`,new Blob([csv],{type:'text/csv;charset=utf-8'}));
      return;
    }
    const archive=readArchive();
    const entry=archive[type];
    if(!entry||!entry.rows?.length){if(typeof toastMsg==='function')toastMsg('내보낼 보관 데이터가 없습니다.');return}
    const dateIdx=ARCHIVE_DATE_IDX[type];
    const header=entry.header||[];
    const rows=(entry.rows||[]).filter(r=>{const rd=normDate(r[dateIdx]);return(!start||!rd||rd>=start)&&(!end||!rd||rd<=end)});
    const csvRows=[header,...rows.map(r=>header.map((_,i)=>r[i]??''))];
    const csv='\ufeff'+csvRows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    download(`보관함_${type}.csv`,new Blob([csv],{type:'text/csv;charset=utf-8'}));
  }
  const LAZY_VIEWS={
    inboundBasicView:()=>renderInboundBasic(),
    inboundAnalysis:()=>renderInbound(),
    outboundBasicView:()=>renderOutboundBasic(),
    outboundAnalysis:()=>renderOutbound(),
    misshipAnalyticsView:()=>renderMisship(),
    misshipRecordsView:()=>renderMisshipRecords(),
    damageInsightView:()=>renderDamageInsight(),
    damageAnalyticsView:()=>renderDamage(),
    outboundBoxView:()=>renderBox(),
    inventoryOosView:()=>renderOos()
  };
  const lazyDirty=new Set(Object.keys(LAZY_VIEWS));
  window.renderLazyViewIfNeeded=function(id){
    if(LAZY_VIEWS[id]&&lazyDirty.has(id)){LAZY_VIEWS[id]();lazyDirty.delete(id)}
  };
  /* 처음 페이지를 열 때 보이지도 않는 다른 탭들(입고/출고/오출고/파손/출고박스/품절분석)까지
     전부 미리 계산하느라 초기 로딩이 느려지는 문제가 있었습니다.
     이제는 지금 실제로 보고 있는 탭만 바로 계산하고, 나머지는 그 탭을 열 때 그제서야 계산합니다. */
  function renderAll(){
    renderDashboard();
    const activeId=document.querySelector('.view.active')?.id;
    Object.keys(LAZY_VIEWS).forEach(id=>{
      if(id===activeId){LAZY_VIEWS[id]();lazyDirty.delete(id)}
      else lazyDirty.add(id);
    });
    window.renderInboundDailyView?.();window.renderInboundMonthlyView?.()
  }
  window.FILE_DATA_ENGINE={handle,getData:read,renderDashboard,renderAll,renderInbound,renderOutbound,renderMisship,renderDamage,renderBox,renderOos};
  document.addEventListener('DOMContentLoaded',()=>{if($('oosOwner')&&typeof inventoryDb!=='undefined')$('oosOwner').innerHTML='<option value="">전체</option>'+Object.keys(inventoryDb.owners||{}).map(x=>`<option>${esc(x)}</option>`).join('');[['inAnaRun',runInAnaSearch],['outAnaRun',renderOutbound],['msRun',renderMisship],['dmRun',runDamageSearch],['dmMomRun',renderDamageMoM],['boxRun',runBoxSearch],['oosRun',renderOos],['archiveRun',renderDataArchive]].forEach(([id,fn])=>$(id)?.addEventListener('click',fn));
    $('archiveType')?.addEventListener('change',renderDataArchive);
    $('diMonth')?.addEventListener('change',renderDamageInsight);
    document.querySelectorAll('#diMobileTabs [data-di-dim]').forEach(b=>b.addEventListener('click',()=>{renderDamageInsight.mobileDim=b.dataset.diDim;document.querySelectorAll('#diMobileTabs [data-di-dim]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('#diSections .ms-section').forEach(s=>s.classList.toggle('di-off',s.dataset.dim!==b.dataset.diDim))}));
    $('diAllBtn')?.addEventListener('click',()=>{$('diMonth').value='';renderDamageInsight()});
    $('msAllBtn')?.addEventListener('click',()=>{$('msMonth').value='';renderMisshipCompare(read().misship?.rows||[])});
    document.querySelectorAll('.fy-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.fy-tab').forEach(x=>x.classList.toggle('active',x===b));$('dmFyGroup').value=b.dataset.fyGroup;renderDamageFY()}));
    $('msMonth')?.addEventListener('change',()=>renderMisshipCompare(read().misship?.rows||[]));
    $('mrPendingMgr')?.addEventListener('change',renderMisshipRecords);
    $('mrRun')?.addEventListener('click',()=>{renderMisshipRecords.searched=true;renderMisshipRecords()});
    ['mrStatus','mrStart','mrEnd'].forEach(id=>$(id)?.addEventListener('change',renderMisshipRecords));
    $('mrQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){renderMisshipRecords.searched=true;renderMisshipRecords()}});
    $('mrReset')?.addEventListener('click',()=>{['mrStart','mrEnd','mrQuery','mrStatus'].forEach(id=>{if($(id))$(id).value=''});renderMisshipRecords.searched=true;renderMisshipRecords()});
    $('archiveExportCsv')?.addEventListener('click',exportArchiveCsv);
    renderDataArchive();
$('inCatSelect')?.addEventListener('change',renderCategoryTrend);
$('outCatSelect')?.addEventListener('change',renderOutCategoryTrend);
if($('inAnaStart')&&!$('inAnaStart').value){
  const now=new Date();
  const first=new Date(now.getFullYear()-1,now.getMonth(),1);
  const fmtD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('inAnaStart').value=fmtD(first);
  $('inAnaEnd').value=today();
}$('dmFyGroup')?.addEventListener('change',renderDamageFY);if($('dmMomMonth')&&!$('dmMomMonth').value)$('dmMomMonth').value=today().slice(0,7);populateBoxFilterDropdowns();

if($('dmStart')&&!$('dmStart').value){
  const fy=damageFY();
  $('dmStart').value=fy.start;
  $('dmEnd').value=today();
}
$('ibRun')?.addEventListener('click',renderInboundBasic);
$('ibReset')?.addEventListener('click',()=>{$('ibBatchQuery').value='';$('ibQuery').value='';const now=new Date();const first=new Date(now.getFullYear(),now.getMonth(),1);const last=new Date(now.getFullYear(),now.getMonth()+1,0);const fmtD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;$('ibStart').value=fmtD(first);$('ibEnd').value=fmtD(last);renderInboundBasic()});
$('obRun')?.addEventListener('click',renderOutboundBasic);
$('obReset')?.addEventListener('click',()=>{$('obQuery').value='';const now=new Date();const first=new Date(now.getFullYear(),now.getMonth(),1);const last=new Date(now.getFullYear(),now.getMonth()+1,0);const fmtD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;$('obStart').value=fmtD(first);$('obEnd').value=fmtD(last);renderOutboundBasic()});
$('exportOutboundDailyCsv')?.addEventListener('click',exportOutboundDailyCsv);
if($('obStart')&&!$('obStart').value){
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth(),1);
  const last=new Date(now.getFullYear(),now.getMonth()+1,0);
  const fmtD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('obStart').value=fmtD(first);
  $('obEnd').value=fmtD(last);
}
if($('ibStart')&&!$('ibStart').value){
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth(),1);
  const last=new Date(now.getFullYear(),now.getMonth()+1,0);
  const fmtD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('ibStart').value=fmtD(first);
  $('ibEnd').value=fmtD(last);
}if($('outAnaStart')&&!$('outAnaStart').value){
  const now=new Date();
  const first=new Date(now.getFullYear()-1,now.getMonth(),1);
  const fmtD2=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('outAnaStart').value=fmtD2(first);
  $('outAnaEnd').value=today();
}
if($('oosStart')&&!$('oosStart').value){
  /* 재고 스냅샷이 매일 쌓이므로, 품절 분석을 기본으로 전체 기간이 아니라 최근 90일만 보도록 해서
     페이지가 열릴 때마다 전체 이력을 다시 계산하느라 느려지는 것을 막습니다. 필요하면 직접 기간을 넓혀 조회할 수 있습니다. */
  const now=new Date();
  const from=new Date(now);from.setDate(from.getDate()-90);
  const fmtD3=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('oosStart').value=fmtD3(from);
  $('oosEnd').value=fmtD3(now);
}
$('oosExport')?.addEventListener('click',exportOos);$('boxGridLoadBtn')?.addEventListener('click',loadBoxGrid);$('boxStoreMapBtn')?.addEventListener('click',openBoxStoreMapDialog);$('boxStoreMapCancel')?.addEventListener('click',closeBoxStoreMapDialog);$('boxStoreMapSave')?.addEventListener('click',saveBoxStoreMapDialog);if($('boxGridDate')&&!$('boxGridDate').value){const tmr=new Date();const addDays=tmr.getDay()===5?3:1;tmr.setDate(tmr.getDate()+addDays);$('boxGridDate').value=`${tmr.getFullYear()}-${String(tmr.getMonth()+1).padStart(2,'0')}-${String(tmr.getDate()).padStart(2,'0')}`;}$('exportBoxCsv')?.addEventListener('click',()=>{const st=$('boxStart').value,en=$('boxEnd').value,mgr=$('boxManagerFilter').value.trim().toLowerCase(),store=$('boxStoreFilter').value.trim().toLowerCase();const rows=boxRows().filter(r=>(!st||!r[0]||normDate(r[0])>=st)&&(!en||!r[0]||normDate(r[0])<=en)&&(!mgr||String(r[2]||'').toLowerCase().includes(mgr))&&(!store||String(r[3]||'').toLowerCase().includes(store))&&num(r[4])>0);const csvRows=[['날짜','요일','담당자','매장','수량'],...rows.map(r=>[normDate(r[0]||''),r[1]||(r[0]?weekday(normDate(r[0])):''),r[2]||'',r[3]||'',r[4]||0])];const csv='\ufeff'+csvRows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='출고박스_기록.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});$('exportBoxExcel')?.addEventListener('click',async()=>{const st=$('boxStart').value,en=$('boxEnd').value,mgr=$('boxManagerFilter').value.trim().toLowerCase(),store=$('boxStoreFilter').value.trim().toLowerCase();const rows=boxRows().filter(r=>(!st||!r[0]||normDate(r[0])>=st)&&(!en||!r[0]||normDate(r[0])<=en)&&(!mgr||String(r[2]||'').toLowerCase().includes(mgr))&&(!store||String(r[3]||'').toLowerCase().includes(store))&&num(r[4])>0);if(!rows.length){toastMsg('내려받을 조회 결과가 없습니다. 먼저 조회를 실행해주세요.');return}await window.ensureXLSX();const aoa=[['날짜','요일','담당자','매장','수량'],...rows.map(r=>[normDate(r[0]||''),r[1]||(r[0]?weekday(normDate(r[0])):''),r[2]||'',r[3]||'',r[4]||0])];const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[{wch:12},{wch:6},{wch:10},{wch:14},{wch:8}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'출고박스');XLSX.writeFile(wb,'출고박스_조회결과.xlsx')});renderAll();pullSharedData(true);setInterval(()=>{if(!document.hidden)pullSharedData(true)},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullSharedData(true)});});setTimeout(renderAll,600);
})();

