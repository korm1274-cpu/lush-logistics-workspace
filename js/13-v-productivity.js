/* <script id="v-productivity"> (index.html에서 그대로 옮김) */
(function(){
  const PROD_KEY='lush-logistics-productivity-v1';
  const OUT_LABOR_KEY='lush-logistics-outbound-labor-v1';
  const $=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const WORK_TYPES=['정상근무','휴일','연차','오전반차','오후반차','외근'];
  const NO_WORK_TYPES=new Set(['휴일','연차']);

  function getProd(){try{const v=JSON.parse(localStorage.getItem(PROD_KEY)||'null');return(v&&typeof v==='object'&&Array.isArray(v.people))?v:{people:[],entries:{}}}catch{return{people:[],entries:{}}}}
  function setProd(v){localStorage.setItem(PROD_KEY,JSON.stringify(v))}
  function getOutLabor(){try{return JSON.parse(localStorage.getItem(OUT_LABOR_KEY)||'{}')||{}}catch{return{}}}
  function setOutLabor(v){localStorage.setItem(OUT_LABOR_KEY,JSON.stringify(v))}

  function todayYM(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date())}
  function isWeekend(dateStr){const day=new Date(dateStr+'T00:00:00').getDay();return day===0||day===6}
  function isHoliday(dateStr){const year=dateStr.slice(0,4);const list=(window.holidayEvents?window.holidayEvents(year):[])||[];return list.some(h=>dateStr>=h.startDate&&dateStr<=(h.endDate||h.startDate))}
  function defaultWorkType(dateStr){return(isWeekend(dateStr)||isHoliday(dateStr))?'휴일':'정상근무'}
  function dowLabel(dateStr){const dows=['일','월','화','수','목','금','토'];return dows[new Date(dateStr+'T00:00:00').getDay()]}
  function monthDates(ym){if(!/^\d{4}-\d{2}$/.test(ym))return[];const[y,m]=ym.split('-').map(Number);const last=new Date(y,m,0).getDate();const out=[];for(let d=1;d<=last;d++)out.push(`${y}-${pad(m)}-${pad(d)}`);return out}
  function toMinutes(hhmm){if(!hhmm)return null;const m=/^(\d{1,2}):(\d{2})$/.exec(hhmm);if(!m)return null;return(+m[1])*60+(+m[2])}
  function minutesToLabel(mins){if(mins===null||mins===undefined||!Number.isFinite(mins))return'미체크';const h=Math.floor(mins/60),m=Math.round(mins%60);return`${pad(h)}:${pad(m)}`}
  function calcElapsed(rec){if(!rec)return null;const s=toMinutes(rec.s),e=toMinutes(rec.e);if(s===null||e===null)return null;const brk=toMinutes(rec.b)||0;let diff=e-s-brk;if(diff<0)diff=0;return diff}

  function entryKey(person,date){return`${person}|${date}`}
  function getEntry(prod,person,date){return prod.entries[entryKey(person,date)]||{workType:defaultWorkType(date),out:{},in:{},ret:{}}}
  function saveEntry(person,date,entry){const prod=getProd();prod.entries[entryKey(person,date)]=entry;setProd(prod)}

  function sortedPeople(prod){return[...prod.people].sort((a,b)=>a.localeCompare(b,'ko'))}
  function populatePersonSelect(){
    const prod=getProd(),inp=$('prodPerson');if(!inp)return;
    const people=sortedPeople(prod);
    const sel=$('prodPersonSelectList');
    if(sel)sel.innerHTML=people.map(p=>`<option value="${esc(p)}">`).join('');
    const dl=$('prodPersonList');
    if(dl)dl.innerHTML=people.map(p=>`<option value="${esc(p)}">`).join('');
    inp.placeholder=people.length?'담당자 이름 입력 또는 선택':'먼저 담당자를 추가해주세요';
    if(inp.value&&!people.includes(inp.value))inp.value='';
  }
  function addPerson(){
    const inp=$('prodNewPerson'),name=(inp?.value||'').trim();if(!name)return;
    const prod=getProd();
    if(!prod.people.includes(name)){prod.people.push(name);setProd(prod)}
    if(inp)inp.value='';
    populatePersonSelect();
    $('prodPerson').value=name;
    renderProductivity();
  }
  function removePerson(){
    const inp=$('prodPerson'),name=(inp?.value||'').trim();if(!name)return;
    const prod=getProd();
    if(!prod.people.includes(name)){toastMsg2(`"${name}" 담당자를 찾을 수 없습니다.`);return}
    if(!confirm(`"${name}" 담당자를 목록에서 삭제할까요? (입력했던 기록은 남아있습니다)`))return;
    prod.people=prod.people.filter(p=>p!==name);
    setProd(prod);
    inp.value='';
    populatePersonSelect();
    renderProductivity();
  }
  function toastMsg2(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function prodAutoSaveTick(){
    const el=$('prodAutoSaveState');if(!el)return;
    el.textContent='자동 저장 완료';
    clearTimeout(window.__prodSaveTimer);
    window.__prodSaveTimer=setTimeout(()=>el.textContent='자동 저장',900);
  }
  function syncOutboundLabor(date){
    const prod=getProd(),hoursList=[];
    prod.people.forEach(p=>{
      const e=prod.entries[entryKey(p,date)];
      if(!e||NO_WORK_TYPES.has(e.workType))return;
      const mins=calcElapsed(e.out);
      if(mins!==null&&mins>0)hoursList.push(mins/60);
    });
    const labor=getOutLabor();
    if(hoursList.length){const avg=hoursList.reduce((a,b)=>a+b,0)/hoursList.length;labor[date]={staff:hoursList.length,hours:Math.round(avg*10)/10}}
    else{delete labor[date]}
    setOutLabor(labor);
    window.renderOutboundBasic&&window.renderOutboundBasic();
  }
  function timeCellHtml(recPrefix,date,rec,disabled){
    const s=rec.s||'',b=rec.b||'',e=rec.e||'';
    const mins=disabled?null:calcElapsed(rec);
    const dis=disabled?'disabled':'';
    return `<td><input class="cell" type="time" lang="en-GB" ${dis} data-prod-time data-rec="${recPrefix}" data-field="s" data-date="${esc(date)}" value="${esc(s)}"></td>`+
           `<td><input class="cell" type="text" inputmode="numeric" placeholder="0:30" pattern="[0-9]{1,2}:[0-5][0-9]" ${dis} data-prod-time data-rec="${recPrefix}" data-field="b" data-date="${esc(date)}" value="${esc(b)}"></td>`+
           `<td><input class="cell" type="time" lang="en-GB" ${dis} data-prod-time data-rec="${recPrefix}" data-field="e" data-date="${esc(date)}" value="${esc(e)}"></td>`+
           `<td class="num">${disabled?'미체크':minutesToLabel(mins)}</td>`;
  }
  function renderProductivity(){
    const tbody=$('prodBody');if(!tbody)return;
    const ym=$('prodMonth')?.value||todayYM();
    const person=$('prodPerson')?.value||'';
    const prod=getProd();
    if(!person||!prod.people.includes(person)){tbody.innerHTML='<tr><td colspan="15" class="data-empty">담당자를 먼저 추가하거나, 목록에 있는 이름을 선택해주세요.</td></tr>';return}
    const dates=monthDates(ym);
    tbody.innerHTML=dates.map(date=>{
      const entry=getEntry(prod,person,date);
      const disabled=NO_WORK_TYPES.has(entry.workType);
      const wtOptions=WORK_TYPES.map(t=>`<option value="${t}" ${entry.workType===t?'selected':''}>${t}</option>`).join('');
      return `<tr data-prod-row data-date="${esc(date)}"><td>${esc(date)}</td><td>${dowLabel(date)}</td>`+
        `<td><select class="cell prod-worktype wt-${entry.workType}" data-prod-worktype data-date="${esc(date)}">${wtOptions}</select></td>`+
        timeCellHtml('out',date,entry.out,disabled)+timeCellHtml('in',date,entry.in,disabled)+timeCellHtml('ret',date,entry.ret,disabled)+
      `</tr>`;
    }).join('');
    wireRowEvents(person);
  }
  function wireRowEvents(person){
    $('prodBody').querySelectorAll('[data-prod-worktype]').forEach(sel=>{
      sel.onchange=()=>{
        const date=sel.dataset.date,prod=getProd(),entry=getEntry(prod,person,date);
        entry.workType=sel.value;
        saveEntry(person,date,entry);
        prodAutoSaveTick();
        renderProductivity();
        syncOutboundLabor(date);
      };
    });
    $('prodBody').querySelectorAll('[data-prod-time]').forEach(inp=>{
      inp.onchange=()=>{
        const date=inp.dataset.date,rec=inp.dataset.rec,field=inp.dataset.field;
        const prod=getProd(),entry=getEntry(prod,person,date);
        if(!entry[rec])entry[rec]={};
        entry[rec][field]=inp.value;
        saveEntry(person,date,entry);
        prodAutoSaveTick();
        renderProductivity();
        if(rec==='out')syncOutboundLabor(date);
      };
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    populatePersonSelect();
    if($('prodMonth')&&!$('prodMonth').value)$('prodMonth').value=todayYM();
    $('prodRun')?.addEventListener('click',renderProductivity);
    $('prodAddPersonBtn')?.addEventListener('click',addPerson);
    $('prodRemovePersonBtn')?.addEventListener('click',removePerson);
    $('prodPerson')?.addEventListener('change',renderProductivity);
    renderProductivity();
  });
  window.renderProductivity=renderProductivity;
  window.populatePersonSelect=populatePersonSelect;
  window.syncOutboundLabor=syncOutboundLabor;
})();

