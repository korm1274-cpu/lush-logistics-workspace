/* <script> (index.html에서 그대로 옮김) */
(function initTodayOutboundRequestCards(){
  const STORAGE_KEY="lush_outbound_requests_v1";
  const pad=n=>String(n).padStart(2,"0");
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const dateKeyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  function thisWeekRange(){
    const now=new Date();
    const start=new Date(now);start.setDate(now.getDate()-now.getDay());
    const end=new Date(start);end.setDate(start.getDate()+6);
    return{start:dateKeyOf(start),end:dateKeyOf(end)};
  }
  const safeText=v=>String(v??"");
  const escText=v=>safeText(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  function getRequests(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(data)?data.map(r=>({...r,status:r?.status==="완료"?"처리완료":(r?.status||"미처리")})):[]}catch{return []}}
  function setRequests(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
  function statusClass(status){return safeText(status).trim()==="처리완료"?"done":"pending"}
  function completeRequest(id){
    const all=getRequests(), idx=all.findIndex(r=>r.id===id);if(idx<0)return;
    all[idx].status="처리완료";all[idx].completedAt=new Date().toISOString();all[idx].updatedAt=new Date().toISOString();setRequests(all);
    if(typeof window.refreshOutboundRequestManager==="function")window.refreshOutboundRequestManager();
    if(typeof toastMsg==="function")toastMsg("처리완료로 변경했습니다.");
  }
  function openOriginal(r){if(r?.url)window.open(r.url,"_blank","noopener");else if(typeof toastMsg==="function")toastMsg("등록된 원본 URL이 없습니다.")}
  function renderType(type){
    const{start,end}=thisWeekRange();
    const all=getRequests().filter(r=>r&&r.type===type&&!["처리완료","완료"].includes(r.status||"미처리"))
      .map(r=>({...r,__weekDate:[...(r.requestDates||[])].sort()[0]||""}))
      .sort((a,b)=>{const A=String(a.__weekDate),B=String(b.__weekDate);return A>B?1:A<B?-1:0});
    const list=document.querySelector(`[data-request-list="${type}"]`),count=document.querySelector(`[data-request-count="${type}"]`);if(count)count.textContent=`${all.length}건`;if(!list)return;
    if(!all.length){list.innerHTML='<button type="button" class="request-empty-card" disabled>미처리 요청이 없습니다.</button>';return}
    list.innerHTML=all.slice(0,6).map(r=>`<div class="request-row" data-request-id="${escText(r.id)}" title="매장명을 클릭하면 등록된 URL로 이동합니다."><button type="button" class="request-link-cell store-name" data-open-original="${escText(r.id)}">${escText(r.storeName||"-")}</button><button type="button" class="request-link-cell doc-no" data-open-original="${escText(r.id)}">${escText(String(r.__weekDate||"").slice(5).replace("-","/"))}</button><span class="status-cell"><button type="button" class="btn complete-btn" data-complete-request="${escText(r.id)}">완료 처리</button></span></div>`).join("");
    list.querySelectorAll("[data-open-original]").forEach(b=>b.onclick=e=>{e.stopPropagation();openOriginal(all.find(r=>r.id===b.dataset.openOriginal))});
    list.querySelectorAll("[data-complete-request]").forEach(b=>b.onclick=e=>{e.stopPropagation();completeRequest(b.dataset.completeRequest)});
  }
  function renderAll(){["bulk","traffic","hq","nozzle"].forEach(renderType)}
  window.renderTodayOutboundRequests=renderAll;window.getTodayOutboundRequestDate=todayKey;renderAll();
})();

