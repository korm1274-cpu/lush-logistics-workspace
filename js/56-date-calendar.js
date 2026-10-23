/* 날짜 칸에 공통 달력 붙이기 — 입고리스트 입고일 달력과 같은 디자인(css/40-calendar.css)
   - 대상: 앱의 날짜 칸 전부(재고 표 안 바로 입력 칸만 제외)
   - 칸 자체(input type=date, 값 YYYY-MM-DD)는 그대로 두고, 누르면 기본 달력 대신 이 달력을 띄움 → 기존 조회 코드는 그대로 동작
   - 시작일·종료일이 짝이면 그 사이 날짜를 연하게 표시, min/max가 있으면 범위 밖 날짜는 막음
   - 고르면 input·change 이벤트를 보내 기존 화면이 그대로 반응 */
(function(){
  // 앱의 날짜 칸 전부(조회 기간·일정 등록·입고요청일·출고 요청일·제조일자·박스 발생일·과거 인원 수정 일자 등)
  // 단, 재고 표 안에서 바로 입력하는 제조일자 칸(#stBody)은 표 입력 방식 그대로 둠
  function excluded(inp){return !!inp.closest('#stBody')}
  var pop=null,cur=null,month='';
  var $=function(id){return id?document.getElementById(id):null};
  function pad(n){return String(n).padStart(2,'0')}
  function todayKey(){var t=new Date();return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate())}
  function pair(inp){
    var id=inp.id||'';
    if(/Start(Date)?$/.test(id))return{start:inp,end:$(id.replace(/Start(Date)?$/,'End$1'))};
    if(/End(Date)?$/.test(id))return{start:$(id.replace(/End(Date)?$/,'Start$1')),end:inp};
    return{start:null,end:null};
  }
  function build(){
    var y=+month.slice(0,4),m=+month.slice(5,7),startDow=new Date(y,m-1,1).getDay(),last=new Date(y,m,0).getDate();
    var p=pair(cur),s=p.start&&p.start.value,e=p.end&&p.end.value,v=cur.value,min=cur.min||'',max=cur.max||'',tk=todayKey();
    var cells='';for(var i=0;i<startDow;i++)cells+='<span class="lc-day empty"></span>';
    for(var d=1;d<=last;d++){
      var key=y+'-'+pad(m)+'-'+pad(d),dow=(startDow+d-1)%7,dis=(min&&key<min)||(max&&key>max);
      var cls='lc-day'+(dow===0?' sun':dow===6?' sat':'')+(key===tk?' today':'')+(key===v?' on':'')+(s&&e&&key>s&&key<e?' in':'')+((key===s||key===e)&&key!==v?' edge':'');
      cells+='<button type="button" class="'+cls+'"'+(dis?' disabled':' data-lc-day="'+key+'"')+'>'+d+'</button>';
    }
    var box=cur.closest('.field,.cum-date-card'),lt=box&&box.querySelector('label,span'),label=lt?lt.textContent.trim():''; // 칸 이름(시작일·종료일)
    pop.innerHTML='<div class="lc-head"><button type="button" data-lc-nav="-1" aria-label="이전 달">‹</button><b>'+y+'년 '+m+'월</b><button type="button" data-lc-nav="1" aria-label="다음 달">›</button></div>'+
      '<div class="lc-week"><span class="sun">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span class="sat">토</span></div>'+
      '<div class="lc-grid">'+cells+'</div>'+
      '<div class="lc-foot"><span class="lc-info">'+(label?'<b>'+label.replace(/[<>&]/g,'')+'</b>':'')+(v?' '+v.replace(/-/g,'.'):'')+'</span><span class="lc-btns"><button type="button" data-lc-today="1">오늘</button><button type="button" data-lc-clear="1">지우기</button></span></div>';
  }
  function place(){
    var r=cur.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
    var left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
    var top=r.bottom+6;if(top+h>window.innerHeight-8&&r.top-h-6>8)top=r.top-h-6;
    pop.style.left=left+'px';pop.style.top=Math.max(8,top)+'px';
  }
  function open(inp){
    if(!pop){pop=document.createElement('div');pop.className='lc-cal lc-float';pop.setAttribute('role','dialog');pop.hidden=true;document.body.appendChild(pop);
      pop.addEventListener('mousedown',function(e){e.preventDefault()}); // 달력 누르는 동안 칸 포커스 유지
      pop.addEventListener('click',function(e){
        var nav=e.target.closest('[data-lc-nav]');if(nav){var y=+month.slice(0,4),m=+month.slice(5,7)+Number(nav.getAttribute('data-lc-nav'));if(m<1){m=12;y--}if(m>12){m=1;y++}month=y+'-'+pad(m);build();return}
        var day=e.target.closest('[data-lc-day]');if(day){setVal(day.getAttribute('data-lc-day'));return}
        if(e.target.closest('[data-lc-today]')){setVal(todayKey());return}
        if(e.target.closest('[data-lc-clear]'))setVal('');
      });
    }
    cur=inp;month=(inp.value||todayKey()).slice(0,7);build();pop.hidden=false;place();
  }
  function close(){if(pop&&!pop.hidden){pop.hidden=true;cur=null}}
  function setVal(v){
    var inp=cur;if(!inp)return;
    inp.value=v;close();
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function enhance(inp){
    if(!inp||inp.dataset.lc||excluded(inp))return;
    inp.dataset.lc='1';inp.readOnly=true;inp.setAttribute('inputmode','none');inp.classList.add('lc-input');
    inp.addEventListener('click',function(e){e.preventDefault();if(cur===inp&&pop&&!pop.hidden)close();else open(inp)});
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.key==='ArrowDown'){e.preventDefault();open(inp)}});
  }
  function scan(){document.querySelectorAll('input[type="date"]').forEach(enhance)}
  document.addEventListener('mousedown',function(e){if(!pop||pop.hidden)return;if(pop.contains(e.target)||e.target===cur)return;close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  window.addEventListener('resize',close);
  document.addEventListener('scroll',function(e){if(pop&&!pop.hidden&&!pop.contains(e.target))close()},true);
  function init(){scan();setTimeout(scan,1500);
    // 나중에 그려지는 화면의 날짜 칸도
    var t=null;new MutationObserver(function(){if(t)return;t=setTimeout(function(){t=null;scan()},400)}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
