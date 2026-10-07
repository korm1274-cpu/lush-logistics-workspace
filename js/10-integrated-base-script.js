/* <script id="integrated-base-script"> (index.html에서 그대로 옮김) */
(function(){
 const KEY='lush-base-notes';const $=id=>document.getElementById(id);const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch{return[]}},save=v=>localStorage.setItem(KEY,JSON.stringify(v));let notes=read();
 const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function toast(msg){if(typeof toastMsg==='function')toastMsg(msg)}
 function renderCounts(){if($('baseNoticeCount'))$('baseNoticeCount').textContent=notes.filter(n=>!n.read).length}
 function showPopup(title,text){let p=$('alarmPopup');if(!p){p=document.createElement('div');p.id='alarmPopup';p.className='alarm-popup';document.body.appendChild(p)}p.innerHTML=`<div class="alarm-popup-icon">🔔</div><div><b>${esc(title||'알림')}</b><span>${esc(text||'')}</span></div><button type="button" aria-label="닫기">×</button>`;p.classList.add('show');p.querySelector('button').onclick=()=>p.classList.remove('show');clearTimeout(window.__alarmTimer);window.__alarmTimer=setTimeout(()=>p.classList.remove('show'),5000)}
 function noticePanel(){const drawer=$('baseDrawer'),title=$('baseDrawerTitle'),body=$('baseDrawerBody');if(!drawer)return;title.textContent='알림센터';body.innerHTML=`<button class="btn" id="baseReadAll">모두 읽음 처리</button><div class="base-section">${notes.length?notes.map(n=>`<div class="base-list-item${n.read?'':' unread'}"><b>${esc(n.title||'알림')}</b><div>${esc(n.text||'')}</div><div class="base-muted">${esc(n.time||'')}</div></div>`).join(''):'<div class="base-muted">새로운 알림이 없습니다.</div>'}</div>`;drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');$('baseReadAll').onclick=()=>{notes=notes.map(n=>({...n,read:true}));save(notes);renderCounts();drawer.classList.remove('open')}}
 function exportCurrent(){const view=document.querySelector('.view.active'),table=view?.querySelector('table');if(!table){toast('현재 화면에 내보낼 표가 없습니다.');return}const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(c=>c.innerText.trim()));const csv='\ufeff'+rows.map(r=>r.map(x=>`"${x.replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=(view.id||'export')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 window.BASE_MENU_REORDER=function(index,dir){if(typeof menus==='undefined')return;const m=menus[index],same=menus.map((x,i)=>({x,i})).filter(o=>o.x.group===m.group),pos=same.findIndex(o=>o.i===index),target=same[pos+dir];if(!target)return;[menus[index],menus[target.i]]=[menus[target.i],menus[index]];saveMenus();renderNav();renderMenusTable()}
 function patchMenuTable(){if(typeof renderMenusTable!=='function'||renderMenusTable.__basePatched)return;const original=renderMenusTable;window.renderMenusTable=function(){original();document.querySelectorAll('#menuRows tr').forEach((tr,i)=>{const cell=tr.firstElementChild;if(!cell||cell.querySelector('.base-menu-order'))return;const order=document.createElement('div');order.className='base-menu-order';order.innerHTML='<span class="base-drag">⋮⋮</span><button type="button" class="base-order-btn">↑</button><button type="button" class="base-order-btn">↓</button>';order.querySelectorAll('button')[0].onclick=()=>BASE_MENU_REORDER(i,-1);order.querySelectorAll('button')[1].onclick=()=>BASE_MENU_REORDER(i,1);cell.prepend(order)})};window.renderMenusTable.__basePatched=true;window.renderMenusTable()}
 document.addEventListener('DOMContentLoaded',()=>{$('baseNoticeBtn')?.addEventListener('click',noticePanel);$('baseExportBtn')?.addEventListener('click',exportCurrent);$('baseSyncBtn')?.addEventListener('click',async()=>{
  /* 새벽 4시 자동 연동을 기다리지 않고, 버튼을 누르면 구글시트(입고·출고·출고요약)를 바로 서버에 반영한 뒤 불러옴.
     세 동기화가 같은 공유 저장소를 고쳐 쓰므로 동시에 돌리지 않고 순서대로 실행 */
  const btn=$('baseSyncBtn');if(btn.disabled)return;
  const label=btn.textContent;btn.disabled=true;btn.textContent='↻ 시트 연동 중…';
  const jobs=[['입고','/api/sync-inbound-sheets'],['출고','/api/sync-outbound-sheets'],['출고요약','/api/sync-outbound-summary-sheet'],['오출고','/api/sync-misship-sheet'],['파손','/api/sync-damage-sheet']];
  const failed=[];
  try{
    for(const [name,url] of jobs){
      // 시트 주소가 아직 등록되지 않은 연동(notConfigured)은 실패로 치지 않고 건너뜀
      try{const r=await fetch(url,{cache:'no-store'});const j=await r.json().catch(()=>null);if(j&&j.notConfigured)continue;if(!r.ok||!j||!j.success)failed.push(name)}
      catch(e){failed.push(name)}
    }
  }finally{
    btn.disabled=false;btn.textContent=label;
    let pulled=window.pullSharedData?await window.pullSharedData(true):'error';
    if(pulled==='busy'){await new Promise(r=>setTimeout(r,1500));pulled=window.pullSharedData?await window.pullSharedData(true):'error'}
    window.pullTeamData&&window.pullTeamData(true);
    if(pulled==='error'){toastMsg('시트 연동 후 공유 데이터를 불러오지 못했습니다. 화면 위 알림을 확인해주세요.');return}
    if(pulled==='memory'){toastMsg('최신 데이터를 불러왔지만 저장 공간 부족으로 이번 접속에서만 보입니다.');return}
    toastMsg(!failed.length?'구글시트 최신 데이터를 반영했습니다.':failed.length===jobs.length?'시트 연동에 실패했습니다. 잠시 후 다시 시도해주세요.':`시트 연동 일부 실패: ${failed.join(', ')} (나머지는 반영됨)`);
  }
});document.querySelectorAll('[data-base-close]').forEach(x=>x.addEventListener('click',()=>{$('baseDrawer')?.classList.remove('open')}));renderCounts();setTimeout(patchMenuTable,500);setTimeout(patchMenuTable,1200)});
 window.BASE_NOTIFY=function(title,text){notes.unshift({title,text,time:new Date().toLocaleString('ko-KR'),read:false});notes=notes.slice(0,50);save(notes);renderCounts();showPopup(title,text)};
 window.BASE_EXPORT_CURRENT=exportCurrent;
})();

