/* Admin > 사용자 관리 (관리자 전용) — [사용자 목록] [사용자 추가] [로그인 기록]
   - 사용자 추가: 아이디·이름·역할 → 초기 비밀번호 1111(첫 로그인 시 변경 필수)
   - 사용자 목록: 역할 변경, 사용 중지/다시 사용, 비밀번호 초기화(1111), 삭제
   - 로그인 기록: 계정별 로그인 성공·실패·잠김·로그아웃·비밀번호 변경 등 */
(function(){
  var $=function(id){return document.getElementById(id)};
  var ROLE_NAME={admin:'관리자',member:'팀원',guest:'게스트'};
  var ACTION_NAME={login:'로그인',logout:'로그아웃','change-password':'비밀번호 변경',create:'사용자 추가',update:'사용자 수정','reset-password':'비밀번호 초기화',remove:'사용자 삭제',setup:'최초 관리자 설정'};
  var RESULT_NAME={success:'성공',fail:'실패',locked:'잠김',inactive:'중지 계정'};
  var users=[];
  var pushUsers={}; // 사용자별 앱 설치(PWA 실행 기록)·알림(유효 구독 수)·마지막 앱 접속 — /api/push?action=users
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function when(iso){if(!iso)return'-';var d=new Date(iso);if(isNaN(d))return'-';var p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}
  function api(action,opts){return window.LUSH_AUTH.fetch(action,opts)}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function showTab(t){
    document.querySelectorAll('#admin-users .us-tab').forEach(function(b){b.classList.toggle('on',b.dataset.us===t)});
    document.querySelectorAll('#admin-users [data-us-pane]').forEach(function(p){p.hidden=p.dataset.usPane!==t});
    if(t==='add')setTimeout(function(){$('acNewId').focus()},30);
    if(t==='logs')loadLogs();
  }

  function loadUsers(){
    var pushReq=fetch('/api/push?action=users',{headers:{Authorization:'Bearer '+((function(){try{return JSON.parse(localStorage.getItem('lush_auth_v1')||'null').token}catch(e){return ''}})())}}).then(function(r){return r.json()}).then(function(j){pushUsers=(j&&j.success&&j.users)||{}}).catch(function(){pushUsers={}});
    return Promise.all([api('users'),pushReq]).then(function(rs){var j=rs[0];
      if(!j||!j.success){$('acBody').innerHTML='<tr><td colspan="8" class="ac-empty">'+esc((j&&j.error)||'불러오지 못했습니다.')+'</td></tr>';return}
      users=j.users||[];renderUsers();renderLogFilter();
    });
  }
  function renderUsers(){
    var me=(window.LUSH_AUTH.user()||{}).id,q=($('acSearch').value||'').trim().toLowerCase();
    $('acCount').textContent=users.length?String(users.length):'';
    var list=users.filter(function(u){return !q||(u.id+' '+u.name).toLowerCase().indexOf(q)>=0});
    $('acBody').innerHTML=list.length?list.map(function(u){
      return '<tr data-id="'+esc(u.id)+'" class="'+(u.active?'':'ac-off')+'">'+
        '<td class="ac-id"><b>'+esc(u.id)+'</b>'+(u.id===me?'<span class="ac-me">나</span>':'')+'</td>'+
        '<td>'+esc(u.name)+'</td>'+
        '<td><select data-act="role"'+(u.id===me?' disabled title="본인 역할은 바꿀 수 없습니다"':'')+'>'+['admin','member','guest'].map(function(r){return '<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+ROLE_NAME[r]+'</option>'}).join('')+'</select></td>'+
        '<td>'+(u.active?'<span class="ac-badge on">사용 중</span>':'<span class="ac-badge off">중지</span>')+(u.mustChange?' <span class="ac-badge temp">임시 비밀번호</span>':'')+'</td>'+
        pushCells(u.id)+
        '<td class="ac-manage">'+(u.id===me?'<span class="ac-self">본인 비밀번호는 오른쪽 위 프로필에서 변경</span>':'<button type="button" data-act="reset">비밀번호 초기화</button><button type="button" data-act="active">'+(u.active?'사용 중지':'다시 사용')+'</button><button type="button" data-act="remove" class="del">삭제</button>')+'</td>'+
      '</tr>';
    }).join(''):'<tr><td colspan="8" class="ac-empty">'+(users.length?'검색 결과가 없습니다.':'사용자가 없습니다.')+'</td></tr>';
  }
  // 모바일에 설치된 PWA가 확인한 알림 상태만 표시합니다. 일반 브라우저의 구독은 서버에서 제외됩니다.
  function pushCells(id){
    var p=pushUsers[id]||{},installed=!!p.pwaDetected,active=(p.activeSubs||0)>0;
    var app=installed?'<span class="ac-badge on">설치 완료</span>':'<span class="ac-muted">미확인</span>';
    var noti=active?'<span class="ac-badge on">활성</span>'+(p.activeSubs>1?' <small class="ac-muted">'+p.activeSubs+'대</small>':''):installed?'<span class="ac-badge off">비활성</span>':'<span class="ac-muted">-</span>';
    return '<td>'+app+'</td><td>'+noti+'</td><td class="ac-when">'+(p.lastPwaAccessAt?when(p.lastPwaAccessAt):'-')+'</td>';
  }
  function renderLogFilter(){
    var sel=$('acLogUser'),cur=sel.value;
    sel.innerHTML='<option value="">전체 계정</option>'+users.map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.id+' · '+u.name)+'</option>'}).join('');
    if(cur)sel.value=cur;
  }
  function loadLogs(){
    var id=$('acLogUser').value;
    $('acLogBody').innerHTML='<tr><td colspan="5" class="ac-empty">불러오는 중…</td></tr>';
    return api('logs',{qs:'&limit=300'+(id?'&id='+encodeURIComponent(id):'')}).then(function(j){
      var logs=(j&&j.success&&j.logs)||[];
      $('acLogCount').textContent=logs.length+'건';
      $('acLogBody').innerHTML=logs.length?logs.map(function(l){
        var ok=l.result==='success';
        return '<tr><td class="ac-when">'+when(l.at)+'</td><td><b>'+esc(l.id)+'</b></td><td>'+esc(ACTION_NAME[l.action]||l.action)+' <span class="ac-badge '+(ok?'on':'off')+'">'+esc(RESULT_NAME[l.result]||l.result)+'</span></td><td>'+esc(l.device||'-')+'</td><td>'+esc(l.by||'')+'</td></tr>';
      }).join(''):'<tr><td colspan="5" class="ac-empty">기록이 없습니다.</td></tr>';
    });
  }
  function create(){
    var id=$('acNewId').value.trim(),name=$('acNewName').value.trim(),role=$('acNewRole').value,btn=$('acCreate');
    if(!id){toast('아이디를 입력해 주세요.');$('acNewId').focus();return}
    btn.disabled=true;
    api('create',{body:{id:id,name:name,role:role}}).then(function(j){
      btn.disabled=false;
      if(!j||!j.success){toast((j&&j.error)||'추가하지 못했습니다.');return}
      $('acNewId').value='';$('acNewName').value='';
      var c=$('acCreated');c.hidden=false;
      c.innerHTML='<b>✓ 사용자를 추가했습니다</b><div class="us-created-grid"><span>아이디</span><code>'+esc(j.user.id)+'</code><span>이름</span><em>'+esc(j.user.name)+'</em><span>역할</span><em>'+esc(ROLE_NAME[j.user.role]||j.user.role)+'</em><span>초기 비밀번호</span><code>1111</code></div><small>본인에게 아이디와 초기 비밀번호를 전달해 주세요. 첫 로그인 때 비밀번호를 변경하게 됩니다.</small><button type="button" class="btn" id="acGoList">사용자 목록 보기</button>';
      $('acGoList').onclick=function(){showTab('list')};
      loadUsers();
    });
  }
  function onTable(e){
    var tr=e.target.closest('tr[data-id]');if(!tr)return;var id=tr.getAttribute('data-id'),u=users.find(function(x){return x.id===id});if(!u)return;
    var b=e.target.closest('button[data-act]');if(!b)return;
    var act=b.dataset.act,req=null;
    if(act==='reset'){if(!confirm('['+id+'] 비밀번호를 1111로 초기화할까요?\n다음 로그인 때 새 비밀번호로 변경해야 합니다.'))return;req=api('reset',{body:{id:id}})}
    else if(act==='active'){if(!confirm('['+id+'] 계정을 '+(u.active?'사용 중지':'다시 사용')+'할까요?'))return;req=api('update',{body:{id:id,active:!u.active}})}
    else if(act==='remove'){if(!confirm('['+id+'] 사용자를 삭제할까요? 되돌릴 수 없습니다.'))return;req=api('remove',{body:{id:id}})}
    if(req)req.then(function(j){if(!j||!j.success){toast((j&&j.error)||'처리하지 못했습니다.');return}toast(act==='reset'?'['+id+'] 비밀번호를 1111로 초기화했습니다.':'처리했습니다.');loadUsers()});
  }
  function onRole(e){
    var s=e.target.closest('select[data-act="role"]');if(!s)return;
    var id=s.closest('tr').getAttribute('data-id');
    if(!confirm('['+id+'] 역할을 '+ROLE_NAME[s.value]+'(으)로 바꿀까요?')){renderUsers();return}
    api('update',{body:{id:id,role:s.value}}).then(function(j){if(!j||!j.success){toast((j&&j.error)||'바꾸지 못했습니다.');renderUsers();return}toast('역할을 바꿨습니다.');loadUsers()});
  }
  function visible(){var v=$('settings'),sec=$('admin-users');return !!(v&&sec&&v.classList.contains('active')&&sec.classList.contains('active'))}
  function refresh(){if(!(window.LUSH_AUTH&&window.LUSH_AUTH.user()&&window.LUSH_AUTH.user().role==='admin'))return;loadUsers();var lp=document.querySelector('#admin-users [data-us-pane="logs"]');if(lp&&!lp.hidden)loadLogs()}
  function init(){
    if(!$('admin-users')||!$('acBody'))return;
    document.querySelectorAll('#admin-users .us-tab').forEach(function(b){b.addEventListener('click',function(){showTab(b.dataset.us)})});
    $('acCreate').addEventListener('click',create);
    ['acNewId','acNewName'].forEach(function(id){$(id).addEventListener('keydown',function(e){if(e.key==='Enter')create()})});
    $('acSearch').addEventListener('input',renderUsers);
    $('acBody').addEventListener('click',onTable);
    $('acBody').addEventListener('change',onRole);
    $('acLogUser').addEventListener('change',loadLogs);
    $('acRefresh').addEventListener('click',refresh);
    /* Admin 화면·사용자 관리 탭이 열릴 때마다 새로 불러오기 */
    var was=false;var check=function(){var v=visible();if(v&&!was)refresh();was=v};
    var mo=new MutationObserver(check);[$('settings'),$('admin-users')].forEach(function(el){if(el)mo.observe(el,{attributes:true,attributeFilter:['class']})});
    if(window.LUSH_AUTH)window.LUSH_AUTH.ready.then(check);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
