/* <script> (index.html에서 그대로 옮김) */
(()=>{
  const KEY='lush_schedule_events_v1',TEAM_SIZE=14;
  const IMPORT_API='/api/calendar';
  const IMPORT_CACHE_KEY='lush_calendar_import_cache_v1';
  const IMPORT_REFRESH_MS=60000;
  const types={annual:'연차',half_am:'오전반차',half_pm:'오후반차',field:'외근',checkup:'건강검진'};
  const absenceTypes=new Set(Object.keys(types)),fullAbsence=new Set(['annual','field','checkup']);
  let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let importEvents=[],importLoadError='',lastImportSuccessAt='';
  // 메인 인사 배너의 '오늘 입고 팔렛' 계산용으로 캘린더(수입일정) 일정을 읽기 전용으로 노출
  window.getImportEvents=()=>importEvents;
  const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
  const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayKey=()=>dateKey(new Date());
  const uid=()=>`sch_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const escHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dows=['일','월','화','수','목','금','토'];

  function getEvents(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
  function setEvents(a){localStorage.setItem(KEY,JSON.stringify(a));renderMasterCalendar();renderDashboardSchedule()}
  function migrateLegacy(){if(localStorage.getItem(KEY)!==null)return;const rows=(typeof db!=='undefined'&&db.schedule?.['통합 일정']?.rows)||[];const mapped=rows.filter(r=>r&&r[0]).map(r=>({id:uid(),startDate:r[0],endDate:r[0],type:({외근:'field',연차:'annual',오전반차:'half_am',오후반차:'half_pm'}[r[1]]||'annual'),person:r[3]||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})).filter(e=>e.person);localStorage.setItem(KEY,JSON.stringify(mapped))}
  function eventCovers(e,date){return date>=(e.startDate||'')&&date<=(e.endDate||e.startDate||'')}
  function isoToSeoulDate(iso){if(!iso)return'';const d=new Date(iso);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function normalizeImport(raw){return (raw||[]).map(e=>({id:e.id||'',title:String(e.title||'').trim(),startDate:isoToSeoulDate(e.start),endDate:isoToSeoulDate(e.end),type:'import',source:String(e.source||'수입일정')})).filter(e=>e.startDate&&e.title)}
  function formatSyncTime(iso){
    if(!iso)return'';
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return'';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function restoreImportCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(IMPORT_CACHE_KEY)||'null');
      if(cached&&Array.isArray(cached.events)){
        importEvents=cached.events;
        lastImportSuccessAt=cached.updatedAt||'';
      }
    }catch(e){}
  }
  function saveImportCache(events){
    lastImportSuccessAt=new Date().toISOString();
    try{localStorage.setItem(IMPORT_CACHE_KEY,JSON.stringify({events,updatedAt:lastImportSuccessAt}))}catch(e){}
  }

  function holidayEvents(year){
    const fixed=[
      [`${year}-01-01`,'신정'],[`${year}-03-01`,'삼일절'],[`${year}-05-05`,'어린이날'],
      [`${year}-06-06`,'현충일'],[`${year}-08-15`,'광복절'],[`${year}-10-03`,'개천절'],
      [`${year}-10-09`,'한글날'],[`${year}-12-25`,'성탄절']
    ];
    const known={
      2026:[['2026-02-16','설날 연휴'],['2026-02-17','설날'],['2026-02-18','설날 연휴'],['2026-03-02','삼일절 대체공휴일'],['2026-05-24','부처님오신날'],['2026-05-25','부처님오신날 대체공휴일'],['2026-09-24','추석 연휴'],['2026-09-25','추석'],['2026-09-26','추석 연휴'],['2026-10-05','개천절 대체공휴일']],
      2027:[]
    };
    return fixed.concat(known[year]||[]).map(([startDate,title],i)=>({id:`holiday_${year}_${i}_${startDate}`,startDate,endDate:startDate,title,type:'holiday'}));
  }
  window.holidayEvents=holidayEvents;

  async function loadImportSchedule(force=false){
    if($('calendarSyncStatus'))$('calendarSyncStatus').textContent='수입 일정을 불러오는 중입니다.';
    if($('dashboardCalendarSync'))$('dashboardCalendarSync').textContent='수입 일정 불러오는 중';
    try{
      const res=await fetch(IMPORT_API,{method:'GET',redirect:'follow',cache:force?'no-store':'default'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(!data.success||!Array.isArray(data.events))throw new Error(data?.error||'응답 형식 오류');
      importEvents=normalizeImport(data.events);importLoadError='';
      saveImportCache(importEvents);
      const stamp=formatSyncTime(lastImportSuccessAt);
      if($('calendarSyncStatus'))$('calendarSyncStatus').textContent=`수입 일정 ${importEvents.length}건 연동 완료 · ${stamp} 기준 · 1분 자동 갱신`;
      if($('dashboardCalendarSync'))$('dashboardCalendarSync').textContent=`수입 일정 연동 완료 · ${stamp}`;
    }catch(err){
      importLoadError=String(err?.message||err);
      const stamp=formatSyncTime(lastImportSuccessAt);
      if($('calendarSyncStatus'))$('calendarSyncStatus').textContent=stamp?`수입 일정 연동 지연 · 마지막 성공 ${stamp} · 기존 일정 유지`:'수입 일정 연결 실패 · 1분 후 자동 재시도';
      if($('dashboardCalendarSync'))$('dashboardCalendarSync').textContent=stamp?`수입 일정 연동 지연 · 마지막 성공 ${stamp}`:'수입 일정 연결 확인 필요';
      console.error('Import calendar load failed:',err);
    }
    renderMasterCalendar();renderDashboardSchedule();
  }

  function showScheduleBoard(){if($('scheduleBoardPanel'))$('scheduleBoardPanel').hidden=false;if($('scheduleEditorPanel'))$('scheduleEditorPanel').hidden=true}
  function showScheduleEditor(reset=true){if($('scheduleBoardPanel'))$('scheduleBoardPanel').hidden=true;if($('scheduleEditorPanel'))$('scheduleEditorPanel').hidden=false;if(reset)resetForm()}
  function resetForm(){if(!$('scheduleRecordId'))return;$('scheduleRecordId').value='';$('scheduleType').value='annual';$('schedulePerson').value='';$('scheduleStartDate').value=todayKey();$('scheduleEndDate').value=todayKey();$('scheduleFormTitle').textContent='연차 일정 등록';$('deleteScheduleBtn').hidden=true}
  function saveSchedule(){const type=$('scheduleType').value,person=$('schedulePerson').value,start=$('scheduleStartDate').value,end=$('scheduleEndDate').value||start;if(!person){toastMsg('대상자를 선택해주세요.');return}if(!start){toastMsg('시작일을 선택해주세요.');return}if(end<start){toastMsg('종료일은 시작일보다 빠를 수 없습니다.');return}const all=getEvents(),id=$('scheduleRecordId').value||uid(),old=all.find(x=>x.id===id),rec={...old,id,type,person,startDate:start,endDate:end,title:`${person} · ${types[type]}`,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const i=all.findIndex(x=>x.id===id);if(i>=0)all[i]=rec;else all.unshift(rec);setEvents(all);toastMsg(i>=0?'일정을 수정했습니다.':'일정을 등록했습니다.');resetForm();showScheduleBoard()}
  function loadSchedule(id){const e=getEvents().find(x=>x.id===id);if(!e)return;showScheduleEditor(false);$('scheduleRecordId').value=e.id;$('scheduleType').value=e.type||'annual';$('schedulePerson').value=e.person||'';$('scheduleStartDate').value=e.startDate||todayKey();$('scheduleEndDate').value=e.endDate||e.startDate||todayKey();$('scheduleFormTitle').textContent='연차 일정 수정';$('deleteScheduleBtn').hidden=false}
  function deleteCurrentSchedule(){const id=$('scheduleRecordId').value;if(!id)return;const e=getEvents().find(x=>x.id===id);if(!e)return;if(!confirm(`${e.person} · ${types[e.type]||'일정'}을 삭제하시겠습니까?`))return;setEvents(getEvents().filter(x=>x.id!==id));resetForm();showScheduleBoard();toastMsg('일정을 삭제했습니다.')}

  function allEventsForYears(years){
    const attendance=getEvents().filter(e=>absenceTypes.has(e.type)).map(e=>({...e,title:`${e.person} · ${types[e.type]}`}));
    const holidays=years.flatMap(y=>holidayEvents(y));
    return attendance.concat(importEvents,holidays);
  }
  function eventColor(e){
    if(e.type==='import'){
      const s=String(e.source||'');
      if(s.includes('연차'))return'#2455b0';
      if(s.includes('출고'))return'#1f7a45';
      return'#c35a00';
    }
    if(e.type==='holiday')return'#667278';
    return'#2455b0';
  }
  function importSourceClass(e){
    if(e.type!=='import')return'';
    const s=String(e.source||'');
    if(s.includes('연차'))return' import-leave';
    if(s.includes('출고'))return' import-outbound';
    return' import-src';
  }
  function eventLabel(e){if(e.type==='import')return[e.source||'수입',e.title];if(e.type==='holiday')return['휴일',e.title];return[types[e.type]||'일정',e.person||e.title||''];}
  function eventSort(a,b){const order={annual:0,half_am:1,half_pm:1,field:2,import:3,holiday:4};return (order[a.type]??9)-(order[b.type]??9)||(a.title||'').localeCompare(b.title||'ko')}

  function renderMasterCalendar(){
    if(!$('masterCalendarGrid'))return;
    const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),first=new Date(y,m,1),gridStart=new Date(y,m,1-first.getDay()),events=allEventsForYears([y-1,y,y+1]);
    $('calendarMonthLabel').textContent=`${y}년 ${m+1}월`;
    let html='';
    for(let i=0;i<42;i++){
      const d=new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+i),key=dateKey(d),list=events.filter(e=>eventCovers(e,key)).sort(eventSort);
      const visible=list.slice(0,5);
      html+=`<div class="master-calendar-day ${list.length?'hover-tip-target':''} ${d.getMonth()!==m?'outside':''} ${key===todayKey()?'today':''}" ${list.length?`data-tip="${escHtml(JSON.stringify(list.map(e=>{const[,t]=eventLabel(e);return{t,c:eventColor(e)}})))}"`:''}><div class="master-day-head"><span class="master-day-num">${d.getDate()}</span><small>${dows[d.getDay()]}</small></div><div class="master-day-events">${visible.map(e=>{const [,title]=eventLabel(e);const inner=`<span class="event-title" title="${escHtml(title)}">${escHtml(title)}</span>`;return absenceTypes.has(e.type)?`<button type="button" class="master-event ${e.type}${importSourceClass(e)}" data-attendance-id="${e.id}">${inner}</button>`:`<div class="master-event ${e.type}${importSourceClass(e)}">${inner}</div>`}).join('')}${list.length>5?`<div class="master-more hover-tip-target" data-tip="${escHtml(JSON.stringify(list.map(e=>{const[,t]=eventLabel(e);return{t,c:eventColor(e)}})))}">+ ${list.length-5}건 더 있음</div>`:''}</div></div>`;
    }
    $('masterCalendarGrid').innerHTML=html;
    $('masterCalendarGrid').querySelectorAll('[data-attendance-id]').forEach(b=>b.onclick=()=>loadSchedule(b.dataset.attendanceId));
  }

  function weekBounds(){const now=new Date(),day=now.getDay(),monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((day+6)%7)),sunday=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+6);return{monday,sunday,start:dateKey(monday),end:dateKey(sunday)}}
  function rangeLabel(a,b){return `${a.getFullYear()}.${pad(a.getMonth()+1)}.${pad(a.getDate())} ~ ${b.getFullYear()}.${pad(b.getMonth()+1)}.${pad(b.getDate())}`}

  function renderDashboardSchedule(){
    /* 메인 화면은 오늘이 포함된 주(일요일 시작) + 다음 주, 총 2주(14일)만 보여줌 */
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    /* 휴대폰은 옆으로 넘겨 보므로 8주(56일)까지 그림 */
    const DAYS=(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)?56:14,gridStart=new Date(y,m,now.getDate()-now.getDay()),gridEnd=new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+DAYS-1);
    const events=allEventsForYears([...new Set([gridStart.getFullYear(),y,gridEnd.getFullYear()])]);
    if($('dashboardWeekRange'))$('dashboardWeekRange').textContent=`${gridStart.getMonth()+1}월 ${gridStart.getDate()}일 ~ ${gridEnd.getMonth()+1}월 ${gridEnd.getDate()}일`;
    const grid=$('dashboardTwoWeekCalendar');
    if(grid){let html='';for(let i=0;i<DAYS;i++){const d=new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+i),key=dateKey(d),list=events.filter(e=>eventCovers(e,key)).sort(eventSort),visible=list;const dayOff=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/864e5);html+=`<div class="dash-two-week-day ${list.length?'hover-tip-target':''} ${key===todayKey()?'today':''} ${(d.getDay()===0||d.getDay()===6)?'weekend':''} ${dayOff<0?'m-hide':''}" ${list.length?`data-tip="${escHtml(JSON.stringify(list.map(e=>{const[,t]=eventLabel(e);return{t,c:eventColor(e)}})))}"`:''}><div class="dash-two-week-date"><b>${d.getDate()}</b><span>${(i===0||d.getDate()===1)?`${d.getMonth()+1}월`:''}</span><em class="dash-dow">${d.getMonth()+1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})</em></div><div class="dash-two-week-events">${visible.map((e,ix)=>{const [,title]=eventLabel(e);return `<div class="dash-two-week-event ${e.type}${importSourceClass(e)}${ix>=2?' dash-extra':''}" title="${escHtml(title)}"><span>${escHtml(title)}</span></div>`}).join('')}${list.length>2?`<small class="dash-more hover-tip-target" data-tip="${escHtml(JSON.stringify(list.map(e=>{const[,t]=eventLabel(e);return{t,c:eventColor(e)}})))}">+${list.length-2}건</small>`:''}</div></div>`}grid.innerHTML=html}
    const attendance=getEvents().filter(e=>absenceTypes.has(e.type)),today=todayKey();
    const importedLeaveToday=(importEvents||[]).filter(e=>e.type==='import'&&String(e.source||'').includes('연차')&&eventCovers(e,today)).map(e=>{
      const m=String(e.title||'').match(/^(.*?)\s*연차\s*$/);
      return m&&m[1].trim()?{...e,person:m[1].trim(),type:'annual'}:null;
    }).filter(Boolean);
    const importedCheckupToday=(importEvents||[]).filter(e=>e.type==='import'&&eventCovers(e,today)).map(e=>{
      const m=String(e.title||'').match(/^(.*?)\s*건강검진\s*$/);
      return m&&m[1].trim()?{...e,person:m[1].trim(),type:'checkup'}:null;
    }).filter(Boolean);
    const todayAbs=attendance.filter(e=>eventCovers(e,today)&&e.person).concat(importedLeaveToday).concat(importedCheckupToday),perPerson=new Map();
    todayAbs.forEach(e=>{const factor=fullAbsence.has(e.type)?1:.5;perPerson.set(e.person,Math.max(perPerson.get(e.person)||0,factor))});
    const excluded=[...perPerson.values()].reduce((a,b)=>a+b,0),available=Math.max(0,TEAM_SIZE-excluded);
    if($('todayOperatingCount'))$('todayOperatingCount').textContent=Number.isInteger(available)?available:available.toFixed(1);
    if($('todayAbsenceCount'))$('todayAbsenceCount').textContent=excluded?`${excluded}명`:'0명';
    if($('todayAbsenceList'))$('todayAbsenceList').innerHTML=todayAbs.length?todayAbs.map(e=>`<div class="absence-item"><b>${escHtml(e.person)}</b><span>${types[e.type]}</span></div>`).join(''):'<div class="absence-empty">금일 제외 인원이 없습니다.</div>';
    if(window.lucide)lucide.createIcons();
    // 캘린더·근무 인원이 갱신되면 메인 인사 배너 숫자(오늘 입고 팔렛, 근무 인원)도 함께 갱신
    window.updateLushHero?.();
  }

  window.openScheduleManager=function(label,el){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('scheduleManagerView').classList.add('active');pageTitle.textContent=label||'통합 일정';document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));if(el)el.classList.add('active');currentSheet=null;showScheduleBoard();renderMasterCalendar();renderDashboardSchedule();if(window.lucide)lucide.createIcons()
  };

  migrateLegacy();
  $('saveScheduleBtn')&&($('saveScheduleBtn').onclick=saveSchedule);
  $('cancelScheduleEditBtn')&&($('cancelScheduleEditBtn').onclick=resetForm);
  $('newScheduleBtn')&&($('newScheduleBtn').onclick=()=>showScheduleEditor(true));
  $('backToCalendarBtn')&&($('backToCalendarBtn').onclick=showScheduleBoard);
  $('deleteScheduleBtn')&&($('deleteScheduleBtn').onclick=deleteCurrentSchedule);
  $('calendarPrevMonth')&&($('calendarPrevMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderMasterCalendar()});
  $('calendarNextMonth')&&($('calendarNextMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderMasterCalendar()});
  $('calendarTodayBtn')&&($('calendarTodayBtn').onclick=()=>{calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderMasterCalendar()});
  $('refreshImportScheduleBtn')&&($('refreshImportScheduleBtn').onclick=()=>loadImportSchedule(true));$('dashRefreshImportScheduleBtn')&&($('dashRefreshImportScheduleBtn').onclick=()=>loadImportSchedule(true));

  restoreImportCache();
  resetForm();showScheduleBoard();renderMasterCalendar();renderDashboardSchedule();loadImportSchedule(true);
  setInterval(()=>loadImportSchedule(true),IMPORT_REFRESH_MS);
})();

