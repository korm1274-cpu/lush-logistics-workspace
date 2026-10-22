/* 로그인한 계정의 역할을 앱에 적용 (js/00-auth.js 로그인 확인 후)
   - 관리자 = 기존 '관리자' 권한(전체) / 팀원 = 기존 '팀 리더' 권한(Admin 제외 전체) / 게스트 = 메인·현황판만
   - 상단 프로필: 이름·역할 표시, 눌러서 비밀번호 변경·로그아웃
   - 권한 미리보기는 관리자에게만 보임 */
(function(){
  if(!window.LUSH_AUTH)return;
  /* 로그인 역할 → 메뉴 권한 칸: 관리자='관리자'(leader) 칸 + Admin 메뉴, 팀원='팀원'(editor) 칸, 게스트='게스트'(restricted) 칸 */
  var ROLE_MAP={admin:'admin',member:'editor',guest:'restricted'};
  window.canAccess=function(m){
    if(!m)return false;var roles=m.roles||[];
    if(currentRole==='admin')return m.group==='admin'||roles.indexOf('leader')>=0;
    return roles.indexOf(currentRole)>=0;
  };
  var ROLE_NAME={admin:'관리자',member:'팀원',guest:'게스트'};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function applyRole(user){
    var role=user.role;
    document.documentElement.classList.toggle('role-guest',role==='guest');
    document.documentElement.classList.toggle('role-admin',role==='admin');
    try{currentRole=ROLE_MAP[role]||'guest'}catch(e){}
    var rp=document.getElementById('rolePreview');
    if(rp){if(role==='admin'){rp.value='admin'}else{rp.style.display='none'}}
    try{if(typeof renderNav==='function')renderNav()}catch(e){}
    enforce(role);
    /* '보던 화면 유지' 복원이 늦게 실행돼도 권한 밖 화면이 열려 있지 않게 한 번 더 확인 */
    if(document.readyState!=='complete')window.addEventListener('load',function(){setTimeout(function(){enforce(role)},400)});
    else setTimeout(function(){enforce(role)},400);
    renderProfile(user);
  }
  /* 지금 화면을 볼 수 없는 역할이면 메인으로 */
  function enforce(role){
    var active=document.querySelector('.view.active');if(!active)return;
    /* 지금 화면의 메뉴를 볼 권한이 없으면 메인으로 */
    var list=(typeof menus!=='undefined'&&Array.isArray(menus))?menus:[];
    var m=list.find(function(x){return x&&x.target===active.id});
    var bad=(role!=='admin'&&active.id==='settings')||(active.id!=='dashboard'&&m&&!canAccess(m));
    if(bad){try{showView('dashboard')}catch(e){}}
  }
  function renderProfile(user){
    var p=document.querySelector('.side-bottom .profile');if(!p)return;
    var name=user.name||user.id;
    var av=p.querySelector('.avatar');if(av)av.textContent=(name.trim()[0]||'?').toUpperCase();
    var b=p.querySelector('b');if(b)b.textContent=name;
    var r=document.getElementById('profileRole');if(r)r.textContent=(ROLE_NAME[user.role]||user.role)+' · '+user.id;
    p.classList.add('au-profile');p.setAttribute('role','button');p.setAttribute('tabindex','0');p.title='비밀번호 변경 · 로그아웃';
    if(p.__auBound)return;p.__auBound=true;
    function toggle(e){
      e.stopPropagation();
      var cur=document.querySelector('.au-profile-menu');if(cur){cur.remove();return}
      var m=document.createElement('div');m.className='au-profile-menu';
      var u=window.LUSH_AUTH.user()||user;
      m.innerHTML='<div class="au-pm-head"><b>'+esc(u.name||u.id)+'</b><small>'+esc((ROLE_NAME[u.role]||u.role)+' · '+u.id)+'</small>'+(u.role==='guest'?'<small class="au-pm-guest">게스트는 로그인 1시간 뒤 다시 로그인</small>':'')+'</div><button type="button" data-pm="pw">비밀번호 변경</button><button type="button" data-pm="out" class="out">로그아웃</button>';
      document.body.appendChild(m);
      var r=p.getBoundingClientRect(),w=m.offsetWidth;
      var top=r.bottom+6;if(top+m.offsetHeight>innerHeight-8)top=Math.max(8,r.top-6-m.offsetHeight);
      m.style.top=top+'px';m.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
      m.addEventListener('click',function(ev){
        var bt=ev.target.closest('button[data-pm]');if(!bt)return;m.remove();
        if(bt.dataset.pm==='pw')window.LUSH_AUTH.changePassword();
        else if(confirm('로그아웃할까요?'))window.LUSH_AUTH.logout();
      });
    }
    p.addEventListener('click',toggle);
    p.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e)}});
    document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.au-profile-menu'))document.querySelectorAll('.au-profile-menu').forEach(function(x){x.remove()})});
  }
  window.LUSH_AUTH.ready.then(function(user){if(user)applyRole(user)});
})();
