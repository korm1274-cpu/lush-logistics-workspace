/* <script> (index.html에서 그대로 옮김) */
(function initV30Dashboard(){
  const now=new Date(), pad=n=>String(n).padStart(2,"0");
  const today=document.getElementById("dashboardToday"), month=document.getElementById("dashboardMonth"), cal=document.getElementById("twoWeekCalendar");
  if(today)today.textContent=`${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}`;
  if(month)month.textContent=`${now.getFullYear()}년 ${now.getMonth()+1}월`;
  if(cal){
    const dows=["일","월","화","수","목","금","토"];let s="";
    for(let i=0;i<14;i++){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i),w=d.getDay();s+=`<div class="cal-day ${w===0||w===6?"weekend":""} ${i===0?"today":""}"><span class="dow">${dows[w]}</span><span class="date">${d.getMonth()+1}/${d.getDate()}</span><span class="empty-event"></span></div>`}
    cal.innerHTML=s;
  }
  if(window.lucide)lucide.createIcons();
})();

