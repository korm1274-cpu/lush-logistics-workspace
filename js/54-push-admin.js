/* Admin > 푸시알림 (관리자 전용) — 모바일 설치형 PWA의 상태만 표시
   - 설정: 전체 ON/OFF + 항목별(팀 공지사항·제품 확보 현황·대량 주문·트래픽·본사 출고·노즐/비닐·입고리스트) ON/OFF
   - 최초 기존 데이터 1회 검증: 항목별 최근 기존 건 1개씩 실제 알림으로 발송, 완료 후 다시 실행 안 됨
   - 등록 기기: 사용자·기기/OS·브라우저·상태·등록일, 관리자만 삭제(endpoint·키 값은 표시하지 않음) */
(function(){
  var $=function(id){return document.getElementById(id)};
  var ORDER=['notice','todo','bulk','traffic','hq','nozzle','inboundList'];
  var LABEL={notice:'팀 공지사항',todo:'제품 확보 현황',bulk:'대량 주문',traffic:'트래픽',hq:'본사 출고',nozzle:'노즐/비닐',inboundList:'입고리스트'};
  var settings=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function when(iso){if(!iso)return'-';var d=new Date(iso);if(isNaN(d))return'-';var p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function api(action,body){
    var a=null;try{a=JSON.parse(localStorage.getItem('lush_auth_v1')||'null')}catch(e){}
    var h={};if(a&&a.token)h.Authorization='Bearer '+a.token;if(body)h['Content-Type']='application/json';
    return fetch('/api/push?action='+action,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){return r.json()}).catch(function(){return{success:false,error:'네트워크 연결을 확인해 주세요.'}});
  }
  function isAdmin(){var u=window.LUSH_AUTH&&window.LUSH_AUTH.user&&window.LUSH_AUTH.user();return !!(u&&u.role==='admin')}

  function toggle(key,on,label,sub,disabled){
    return '<label class="pa-row'+(disabled?' pa-dim':'')+'"><span><b>'+esc(label)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span>'+
      '<button type="button" class="pa-switch'+(on?' on':'')+'" data-pa-key="'+key+'" role="switch" aria-checked="'+(on?'true':'false')+'"><i></i><em>'+(on?'ON':'OFF')+'</em></button></label>';
  }
  function renderSettings(){
    var box=$('paSettings');if(!box)return;
    if(!settings){box.innerHTML='<p class="pa-empty">불러오지 못했습니다.</p>';return}
    var all=settings.enabled;
    box.innerHTML='<div class="pa-card-head"><b>푸시알림 설정</b><small>신규 등록 시 자동 발송 · 순서: 신규 → 전체 ON → 항목 ON → 중복 확인 → 발송</small></div>'+
      toggle('all',all,'전체 푸시알림','끄면 아래 항목 설정과 상관없이 보내지 않습니다.')+
      '<div class="pa-sub">'+ORDER.map(function(k){return toggle(k,settings.types[k],LABEL[k],'',!all)}).join('')+'</div>'+
      (settings.updatedAt?'<p class="pa-note">마지막 변경 '+when(settings.updatedAt)+(settings.by?' · '+esc(settings.by):'')+'</p>':'');
  }
  function loadSettings(){
    return api('settings').then(function(j){settings=j&&j.success?j.settings:null;renderSettings()});
  }
  function saveSetting(key,on){
    var body=key==='all'?{enabled:on}:{types:{}};if(key!=='all')body.types[key]=on;
    return api('settings',body).then(function(j){
      if(!j||!j.success){toast((j&&j.error)||'저장하지 못했습니다.');return}
      settings=j.settings;renderSettings();toast((key==='all'?'전체 푸시알림':LABEL[key])+' '+(on?'ON':'OFF'));
    });
  }

  function renderInitial(done,results,error){
    var box=$('paInitial');if(!box)return;
    var rows=(results||[]).map(function(r){return '<li><b>'+esc(r.label)+'</b> '+(r.skipped?'<span class="pa-muted">'+esc(r.skipped)+'</span>':'<span>'+esc(r.body||'')+'</span> <em class="'+(r.sent?'ok':'err')+'">'+(r.sent?'전달 '+r.sent+'대':'전달 실패')+'</em>')+'</li>'}).join('');
    box.innerHTML='<div class="pa-card-head"><b>최초 기존 데이터 1회 검증</b><small>항목별로 지금 저장된 최근 1건씩(최대 6건) 실제 알림으로 보내 확인합니다.</small></div>'+
      (done?'<p class="pa-done">✅ 완료 '+when(done.completedAt)+' · '+esc(done.by||'')+' · 기기 '+esc(done.devices)+'대 — 다시 보내지 않습니다.</p>':
        '<button type="button" class="btn primary" id="paInitialRun">기존 데이터로 1회 검증 발송</button>')+
      (error?'<p class="pa-err">'+esc(error)+'</p>':'')+
      (rows?'<ul class="pa-results">'+rows+'</ul>':'');
    var run=$('paInitialRun');
    if(run)run.onclick=function(){
      if(!confirm('항목별 최근 기존 건 1개씩(최대 6건) 알림을 등록된 모든 기기로 보냅니다.\n완료되면 다시 실행할 수 없습니다. 진행할까요?'))return;
      run.disabled=true;run.textContent='발송 중…';
      api('initial-run',{}).then(function(j){renderInitial(j&&j.done,j&&j.results,j&&!j.success?(j.error||'실패했습니다.'):'')});
    };
  }
  function loadInitial(){return api('initial-status').then(function(j){renderInitial(j&&j.done,j&&j.done&&j.done.results,j&&!j.success?j.error:'')})}

  function loadDevices(){
    var body=$('paDevBody');if(!body)return;
    body.innerHTML='<tr><td colspan="6" class="ac-empty">불러오는 중…</td></tr>';
    return api('devices').then(function(j){
      var list=(j&&j.success&&j.devices)||[];
      $('paDevCount').textContent=list.length?String(list.length):'';
      body.innerHTML=list.length?list.map(function(d){
        var st=d.status==='active'?'<span class="ac-badge on">활성</span>':d.status==='inactive'?'<span class="ac-badge off">비활성</span>':d.status==='error'?'<span class="ac-badge off">발송 오류</span>':'<span class="ac-badge temp">앱 확인 전</span>';
        return '<tr data-sid="'+esc(d.sid)+'"><td><b>'+esc(d.userName)+'</b><small class="pa-muted"> '+esc(d.userId)+'</small>'+(d.userExists?'':' <span class="ac-badge off">삭제된 계정</span>')+'</td>'+
          '<td>'+esc(d.os)+(d.standalone?' <span class="ac-badge temp">앱</span>':'')+'</td><td>'+esc(d.browser)+'</td><td>'+st+'</td><td class="ac-when">'+when(d.createdAt)+'</td>'+
          '<td class="ac-manage"><button type="button" class="del" data-pa-del="'+esc(d.sid)+'">삭제</button></td></tr>';
      }).join(''):'<tr><td colspan="6" class="ac-empty">'+(j&&j.success?'알림을 등록한 모바일 앱이 없습니다.':esc((j&&j.error)||'불러오지 못했습니다.'))+'</td></tr>';
    });
  }

  function showTab(t){
    document.querySelectorAll('#admin-push [data-pa]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-pa')===t)});
    document.querySelectorAll('#admin-push [data-pa-pane]').forEach(function(p){p.hidden=p.getAttribute('data-pa-pane')!==t});
    if(t==='devices')loadDevices();
  }
  function refreshAll(){if(!isAdmin())return;loadSettings();loadInitial();loadDevices()}
  function init(){
    var sec=$('admin-push');if(!sec)return;
    sec.querySelectorAll('[data-pa]').forEach(function(b){b.addEventListener('click',function(){showTab(b.getAttribute('data-pa'))})});
    sec.addEventListener('click',function(e){
      var sw=e.target.closest('[data-pa-key]');
      if(sw){e.preventDefault();if(sw.closest('.pa-dim'))return;saveSetting(sw.getAttribute('data-pa-key'),!sw.classList.contains('on'));return}
      var del=e.target.closest('[data-pa-del]');
      if(del){if(!confirm('이 기기를 Push 등록 목록에서 삭제할까요?\n삭제하면 이 기기로 알림이 가지 않습니다.'))return;
        api('device-remove',{sid:del.getAttribute('data-pa-del')}).then(function(j){if(!j||!j.success){toast((j&&j.error)||'삭제하지 못했습니다.');return}toast('삭제했습니다.');loadDevices()})}
    });
    var r=$('paRefresh');if(r)r.addEventListener('click',loadDevices);
    var tab=document.querySelector('.admin-tab[data-admin="push"]');if(tab)tab.addEventListener('click',refreshAll);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
