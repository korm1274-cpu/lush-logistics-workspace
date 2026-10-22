/* Admin > 계정 관리 (관리자 전용)
   - 계정 만들기: 아이디·이름·역할 → 초기 비밀번호 1111(첫 로그인 시 변경 필수)
   - 계정 목록: 역할 변경, 사용 중지/재사용, 비밀번호 초기화(1111), 삭제
   - 로그인 기록: 계정별 로그인 성공·실패·로그아웃·비밀번호 변경 등 */
(function(){
  var $=function(id){return document.getElementById(id)};
  var ROLE_NAME={admin:'관리자',member:'팀원',guest:'게스트'};
  var ACTION_NAME={login:'로그인',logout:'로그아웃','change-password':'비밀번호 변경',create:'계정 생성',update:'계정 수정','reset-password':'비밀번호 초기화',remove:'계정 삭제',setup:'최초 관리자 설정'};
  var RESULT_NAME={success:'성공',fail:'실패',locked:'잠김',inactive:'중지 계정'};
  var users=[];
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function when(iso){if(!iso)return'-';var d=new Date(iso);if(isNaN(d))return'-';var p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}
  function api(action,opts){return window.LUSH_AUTH.fetch(action,opts)}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}

  function loadUsers(){
    return api('users').then(function(j){
      if(!j||!j.success){$('acBody').innerHTML='<tr><td colspan="7" class="ac-empty">'+esc((j&&j.error)||'불러오지 못했습니다.')+'</td></tr>';return}
      users=j.users||[];renderUsers();renderLogFilter();
    });
  }
  function renderUsers(){
    var me=(window.LUSH_AUTH.user()||{}).id;
    $('acCount').textContent=users.length+'명';
    $('acBody').innerHTML=users.length?users.map(function(u){
      return '<tr data-id="'+esc(u.id)+'" class="'+(u.active?'':'ac-off')+'">'+
        '<td class="ac-id"><b>'+esc(u.id)+'</b>'+(u.id===me?'<span class="ac-me">나</span>':'')+'</td>'+
        '<td>'+esc(u.name)+'</td>'+
        '<td><select data-act="role"'+(u.id===me?' disabled title="본인 역할은 바꿀 수 없습니다"':'')+'>'+['admin','member','guest'].map(function(r){return '<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+ROLE_NAME[r]+'</option>'}).join('')+'</select></td>'+
        '<td>'+(u.active?'<span class="ac-badge on">사용 중</span>':'<span class="ac-badge off">중지</span>')+(u.mustChange?' <span class="ac-badge temp">임시 비밀번호</span>':'')+'</td>'+
        '<td class="ac-when">'+when(u.lastLoginAt)+'</td>'+
        '<td class="ac-when">'+when(u.createdAt)+'</td>'+
        '<td class="ac-manage">'+(u.id===me?'':'<button type="button" data-act="reset">비밀번호 초기화</button><button type="button" data-act="active">'+(u.active?'사용 중지':'다시 사용')+'</button><button type="button" data-act="remove" class="del">삭제</button>')+'</td>'+
      '</tr>';
    }).join(''):'<tr><td colspan="7" class="ac-empty">계정이 없습니다.</td></tr>';
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
      if(!j||!j.success){toast((j&&j.error)||'만들지 못했습니다.');return}
      $('acNewId').value='';$('acNewName').value='';
      toast('['+j.user.id+'] 계정을 만들었습니다. 초기 비밀번호는 1111이며, 첫 로그인 때 변경해야 합니다.');
      loadUsers();loadLogs();
    });
  }
  function onTable(e){
    var tr=e.target.closest('tr[data-id]');if(!tr)return;var id=tr.getAttribute('data-id'),u=users.find(function(x){return x.id===id});if(!u)return;
    var b=e.target.closest('button[data-act]');if(!b)return;
    var act=b.dataset.act,req=null;
    if(act==='reset'){if(!confirm('['+id+'] 비밀번호를 1111로 초기화할까요?\n다음 로그인 때 새 비밀번호로 변경해야 합니다.'))return;req=api('reset',{body:{id:id}})}
    else if(act==='active'){if(!confirm('['+id+'] 계정을 '+(u.active?'사용 중지':'다시 사용')+'할까요?'))return;req=api('update',{body:{id:id,active:!u.active}})}
    else if(act==='remove'){if(!confirm('['+id+'] 계정을 삭제할까요? 되돌릴 수 없습니다.'))return;req=api('remove',{body:{id:id}})}
    if(req)req.then(function(j){if(!j||!j.success){toast((j&&j.error)||'처리하지 못했습니다.');return}toast('처리했습니다.');loadUsers();loadLogs()});
  }
  function onRole(e){
    var s=e.target.closest('select[data-act="role"]');if(!s)return;
    var id=s.closest('tr').getAttribute('data-id');
    if(!confirm('['+id+'] 역할을 '+ROLE_NAME[s.value]+'(으)로 바꿀까요?')){renderUsers();return}
    api('update',{body:{id:id,role:s.value}}).then(function(j){if(!j||!j.success){toast((j&&j.error)||'바꾸지 못했습니다.');renderUsers();return}toast('역할을 바꿨습니다.');loadUsers();loadLogs()});
  }
  var loaded=false;
  function refresh(){loadUsers().then(loadLogs);loaded=true}
  function init(){
    var v=$('accountsView');if(!v)return;
    $('acCreate').addEventListener('click',create);
    $('acNewId').addEventListener('keydown',function(e){if(e.key==='Enter')create()});
    $('acBody').addEventListener('click',onTable);
    $('acBody').addEventListener('change',onRole);
    $('acLogUser').addEventListener('change',loadLogs);
    $('acRefresh').addEventListener('click',refresh);
    /* 화면을 열 때마다 새로 불러오기 */
    new MutationObserver(function(){if(v.classList.contains('active'))refresh()}).observe(v,{attributes:true,attributeFilter:['class']});
    if(v.classList.contains('active'))refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
