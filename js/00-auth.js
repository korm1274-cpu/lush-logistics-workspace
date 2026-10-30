/* 로그인 관문 (head에서 가장 먼저 실행)
   - 로그인 전에는 앱을 가리고 로그인 화면 표시(시즌별 디자인: 할로윈·크리스마스·새해)
   - 모든 /api 요청에 로그인 토큰을 붙이고, 401(로그인 필요)·403(임시 비밀번호 변경 필요)을 받으면 해당 화면으로
   - 관리자·팀원: 브라우저에 로그인 유지(새로고침·재실행해도 유지) / 게스트: 로그인 1시간 뒤 다시 로그인
   - 임시 비밀번호(1111)로 로그인하면 비밀번호를 바꾸기 전까지 앱 사용 불가 */
(function(){
  var KEY='lush_auth_v1';
  var html=document.documentElement;html.classList.add('auth-pending');
  function read(){try{var v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.token?v:null}catch(e){return null}}
  function write(v){try{v?localStorage.setItem(KEY,JSON.stringify(v)):localStorage.removeItem(KEY)}catch(e){}}
  var auth=read();
  var origFetch=window.fetch.bind(window);
  function apiPath(u){try{var url=new URL(typeof u==='string'?u:u.url,location.href);return url.origin===location.origin&&url.pathname.indexOf('/api/')===0?url.pathname+url.search:''}catch(e){return''}}
  var publicAuth=/^\/api\/auth\?action=(login|setup|status)\b/;
  window.fetch=function(input,init){
    var p=apiPath(input),sent=false;
    if(p&&auth&&auth.token&&!publicAuth.test(p)){sent=true;
      init=Object.assign({},init||{});
      var h=new Headers(init.headers||(typeof input!=='string'&&input.headers)||undefined);
      if(!h.has('Authorization'))h.set('Authorization','Bearer '+auth.token);
      init.headers=h;
    }
    return origFetch(input,init).then(function(r){
      /* 로그인 정보를 보낸 요청만 처리(로그인 전 앱이 보내는 요청의 401로 새로고침이 반복되지 않게) */
      if(sent&&p&&!publicAuth.test(p)&&(r.status===401||r.status===403)){
        r.clone().json().then(function(j){
          if(j&&j.code==='AUTH')expire('로그인이 만료되었습니다. 다시 로그인해 주세요.');
          else if(j&&j.code==='MUST_CHANGE')showChangePassword(true);
        }).catch(function(){});
      }
      return r;
    });
  };
  function authFetch(action,opts){
    opts=opts||{};
    var init={method:opts.method||(opts.body?'POST':'GET'),headers:{'Content-Type':'application/json'}};
    if(opts.body)init.body=JSON.stringify(opts.body);
    return window.fetch('/api/auth?action='+action+(opts.qs||''),init).then(function(r){return r.json().catch(function(){return{success:false,error:'서버 응답 오류'}})});
  }

  /* ===== 시즌 ===== */
  function season(){
    var q=(location.search.match(/[?&]season=(\w+)/)||[])[1];if(q)return q;
    var d=new Date(Date.now()+9*3600e3),m=d.getUTCMonth()+1,day=d.getUTCDate();
    if((m===10&&day>=15)||(m===11&&day===1))return'halloween';
    if(m===12&&day<=26)return'christmas';
    if((m===12&&day>=27)||(m===1&&day<=15))return'newyear';
    return'default';
  }
  var SEASON={
    halloween:{tag:'HAPPY HALLOWEEN',title:'오늘도 무사히,<br>트릭 없이 출고 완료!',cargo:'🎃',deco:['🎃','🦇','🍬','🕸️','🦇','🎃']},
    christmas:{tag:'MERRY CHRISTMAS',title:'산타보다 빠른<br>러쉬 물류팀',cargo:'🎁',deco:['❄️','🎄','❄️','⭐','❄️','🎁']},
    newyear:{tag:'HAPPY NEW YEAR',title:'새해에도<br>안전하게, 정확하게',cargo:'☀️',deco:['✨','✦','✨','✦','✨','✦']},
    default:{tag:'LUSH LOGISTICS',title:'오늘의 물류를<br>신선하게 연결합니다',cargo:'📦',deco:[]}
  };
  var LOGO='<svg viewBox="2.5 2.3 19 19" width="18" height="18" aria-hidden="true"><path d="M4.6 9h14.8l-1.2 10.4a2 2 0 0 1-2 1.8H7.8a2 2 0 0 1-2-1.8z" fill="currentColor"/><path d="M4.6 9c0-2 1.4-3.2 3.2-3.2 1-1.8 2.6-2.6 4.2-2.6s3.2.8 4.2 2.6c1.8 0 3.2 1.2 3.2 3.2z" fill="#4bbf83" stroke="currentColor" stroke-width="1"/><circle cx="9.4" cy="6.4" r=".6" fill="#fff"/><circle cx="14.2" cy="5.4" r=".5" fill="#fff"/><rect x="8" y="12.4" width="8" height="4.6" rx=".5" fill="#fff"/><path d="M9.4 14.7h5.2" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/></svg>';

  var screen=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function build(){
    if(screen)return screen;
    var s=season(),S=SEASON[s]||SEASON.default;
    screen=document.createElement('div');screen.id='authScreen';screen.setAttribute('data-season',s);
    screen.innerHTML=
      '<div class="au-brand">'+
        '<div class="au-deco" aria-hidden="true">'+S.deco.map(function(e,i){return '<span style="--i:'+i+'">'+e+'</span>'}).join('')+'</div>'+
        (s==='christmas'?'<div class="au-snow" aria-hidden="true"></div>':'')+(s==='newyear'?'<div class="au-sunrise" aria-hidden="true"><span class="au-sun"></span></div>':'')+
        '<div class="au-logo"><span class="au-logo-mark">'+LOGO+'</span><b>LUSH</b><small>LOGISTICS WORKSPACE</small></div>'+
        '<div class="au-copy"><span class="au-tag">'+S.tag+'</span><h1>'+S.title+'</h1><p>입고 · 출고 · 재고 · 일정을 한 곳에서.</p></div>'+
        '<div class="au-scene" aria-hidden="true"><div class="au-pallet"><i></i><i></i><i></i></div><div class="au-truck"><div class="au-cargo">'+S.cargo+'</div><div class="au-box-load"></div><div class="au-cab"></div><span class="au-wheel w1"></span><span class="au-wheel w2"></span></div><div class="au-road"></div></div>'+
      '</div>'+
      '<div class="au-panel"><div class="au-card" id="auCard"></div><p class="au-foot">© LUSH KOREA Logistics</p></div>';
    document.body.appendChild(screen);
    return screen;
  }
  function card(){return document.getElementById('auCard')}
  function busy(btn,on,label){if(!btn)return;btn.disabled=on;if(label)btn.textContent=on?'잠시만요…':label}
  function showLogin(message){
    build();screen.hidden=false;html.classList.add('auth-pending');html.classList.remove('auth-ready');
    authFetch('status').then(function(j){
      if(j&&j.needsSetup)return renderSetup();
      card().innerHTML=
        '<div class="au-card-head"><h2>로그인</h2><p>러쉬 물류팀 업무 공간입니다.</p></div>'+
        (message?'<div class="au-msg">'+esc(message)+'</div>':'')+
        '<form id="auLoginForm" autocomplete="on" novalidate>'+
          '<label class="au-field"><span>아이디</span><input id="auId" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>'+
          '<label class="au-field"><span>비밀번호</span><input id="auPw" type="password" name="password" autocomplete="current-password" required></label>'+
          '<div class="au-err" id="auErr" role="alert"></div>'+
          '<button class="au-btn" id="auSubmit" type="submit">로그인</button>'+
        '</form>'+
        '<p class="au-help">계정이 없으신가요? 관리자에게 계정 생성을 요청해 주세요.</p>';
      var f=document.getElementById('auLoginForm');setTimeout(function(){var i=document.getElementById('auId');if(i)i.focus()},50);
      f.addEventListener('submit',function(e){
        e.preventDefault();
        var id=document.getElementById('auId').value.trim(),pw=document.getElementById('auPw').value,btn=document.getElementById('auSubmit'),err=document.getElementById('auErr');
        if(!id||!pw){err.textContent='아이디와 비밀번호를 입력해 주세요.';return}
        busy(btn,true,'로그인');err.textContent='';
        authFetch('login',{body:{id:id,password:pw}}).then(function(j){
          busy(btn,false,'로그인');
          if(!j||!j.success){err.textContent=(j&&j.error)||'로그인하지 못했습니다.';return}
          auth={token:j.token,exp:j.exp,user:j.user};write(auth);
          if(j.user.mustChange){window.__auTempPw=pw;showChangePassword(true);return}
          location.reload();
        }).catch(function(){busy(btn,false,'로그인');err.textContent='서버에 연결하지 못했습니다.'});
      });
    });
  }
  function renderSetup(){
    card().innerHTML=
      '<div class="au-card-head"><h2>최초 관리자 설정</h2><p>아직 계정이 없습니다. 관리자 계정을 먼저 만들어 주세요. (처음 한 번만)</p></div>'+
      '<form id="auSetupForm" novalidate>'+
        '<label class="au-field"><span>아이디</span><input id="auSId" autocapitalize="none" spellcheck="false" placeholder="영문·숫자 2~30자"></label>'+
        '<label class="au-field"><span>이름</span><input id="auSName" placeholder="예: Time"></label>'+
        '<label class="au-field"><span>비밀번호</span><input id="auSPw" type="password" autocomplete="new-password" placeholder="8자 이상"></label>'+
        '<label class="au-field"><span>비밀번호 확인</span><input id="auSPw2" type="password" autocomplete="new-password"></label>'+
        '<div class="au-err" id="auErr" role="alert"></div><button class="au-btn" id="auSubmit" type="submit">관리자 계정 만들기</button>'+
      '</form>';
    document.getElementById('auSetupForm').addEventListener('submit',function(e){
      e.preventDefault();
      var err=document.getElementById('auErr'),btn=document.getElementById('auSubmit'),pw=document.getElementById('auSPw').value;
      if(pw!==document.getElementById('auSPw2').value){err.textContent='비밀번호 확인이 맞지 않습니다.';return}
      busy(btn,true,'관리자 계정 만들기');
      authFetch('setup',{body:{id:document.getElementById('auSId').value,name:document.getElementById('auSName').value,password:pw}}).then(function(j){
        busy(btn,false,'관리자 계정 만들기');
        if(!j||!j.success){err.textContent=(j&&j.error)||'만들지 못했습니다.';return}
        auth={token:j.token,exp:j.exp,user:j.user};write(auth);location.reload();
      });
    });
  }
  /* 비밀번호 변경 창: required=true면 닫을 수 없음(임시 비밀번호) */
  function showChangePassword(required){
    var old=document.getElementById('auPwModal');if(old){if(old.getAttribute('data-required')==='1')return;old.remove()}
    var m=document.createElement('div');m.id='auPwModal';m.className='au-modal';if(required)m.setAttribute('data-required','1');
    m.innerHTML='<div class="au-modal-box" role="dialog" aria-modal="true" aria-labelledby="auPwTitle">'+
      (required?'<div class="au-modal-badge">🔒 임시 비밀번호</div><h3 id="auPwTitle">비밀번호를 변경해 주세요</h3><p>지금 사용하신 비밀번호는 <b>임시 비밀번호</b>입니다.<br>보안을 위해 새 비밀번호로 변경한 뒤 이용할 수 있어요.</p>'
               :'<h3 id="auPwTitle">비밀번호 변경</h3><p>새 비밀번호는 8자 이상으로 입력해 주세요.</p>')+
      '<form id="auPwForm" novalidate>'+
        '<label class="au-field"><span>현재 비밀번호</span><input id="auCur" type="password" autocomplete="current-password"></label>'+
        '<label class="au-field"><span>새 비밀번호</span><input id="auNew" type="password" autocomplete="new-password" placeholder="8자 이상"></label>'+
        '<label class="au-field"><span>새 비밀번호 확인</span><input id="auNew2" type="password" autocomplete="new-password"></label>'+
        '<div class="au-err" id="auPwErr" role="alert"></div>'+
        '<div class="au-modal-actions">'+(required?'<button type="button" class="au-btn ghost" id="auPwLogout">로그아웃</button>':'<button type="button" class="au-btn ghost" id="auPwCancel">취소</button>')+'<button class="au-btn" id="auPwSave" type="submit">변경하기</button></div>'+
      '</form></div>';
    document.body.appendChild(m);
    if(window.__auTempPw){document.getElementById('auCur').value=window.__auTempPw;window.__auTempPw='';setTimeout(function(){document.getElementById('auNew').focus()},50)}
    else setTimeout(function(){document.getElementById('auCur').focus()},50);
    var c=document.getElementById('auPwCancel');if(c)c.onclick=function(){m.remove()};
    var lo=document.getElementById('auPwLogout');if(lo)lo.onclick=function(){logout()};
    document.getElementById('auPwForm').addEventListener('submit',function(e){
      e.preventDefault();
      var err=document.getElementById('auPwErr'),btn=document.getElementById('auPwSave'),nw=document.getElementById('auNew').value;
      if(nw!==document.getElementById('auNew2').value){err.textContent='새 비밀번호 확인이 맞지 않습니다.';return}
      busy(btn,true,'변경하기');
      authFetch('change-password',{body:{current:document.getElementById('auCur').value,next:nw}}).then(function(j){
        busy(btn,false,'변경하기');
        if(!j||!j.success){err.textContent=(j&&j.error)||'변경하지 못했습니다.';return}
        if(auth){auth.user=Object.assign({},auth.user,{mustChange:false});write(auth)}
        m.remove();
        if(required)location.reload();else if(typeof window.toastMsg==='function')window.toastMsg('비밀번호를 변경했습니다.');
      });
    });
  }
  function logout(){
    var t=auth;auth=null;write(null);
    var done=function(){location.reload()};
    if(t&&t.token)origFetch('/api/auth?action=logout',{method:'POST',headers:{Authorization:'Bearer '+t.token}}).then(done,done);else done();
  }
  var expiring=false;
  function expire(msg){if(expiring)return;expiring=true;auth=null;write(null);try{sessionStorage.setItem('lush_auth_msg',msg||'')}catch(e){}location.reload()}

  /* 게스트: 로그인 1시간이 지나면 다시 로그인 */
  setInterval(function(){if(auth&&auth.user&&auth.user.role==='guest'&&auth.exp&&Date.now()>auth.exp)expire('게스트 이용 시간(1시간)이 지나 다시 로그인해 주세요.')},20000);

  var readyResolve;window.LUSH_AUTH={ready:new Promise(function(r){readyResolve=r}),user:function(){return auth&&auth.user},logout:logout,changePassword:function(){showChangePassword(false)},fetch:authFetch};

  function start(){
    var msg='';try{msg=sessionStorage.getItem('lush_auth_msg')||'';sessionStorage.removeItem('lush_auth_msg')}catch(e){}
    if(!auth||(auth.exp&&Date.now()>auth.exp)){if(auth&&auth.user&&auth.user.role==='guest')msg=msg||'게스트 이용 시간(1시간)이 지나 다시 로그인해 주세요.';auth=null;write(null);showLogin(msg);return}
    authFetch('me').then(function(j){
      if(!j||!j.success){auth=null;write(null);showLogin(msg||'다시 로그인해 주세요.');return}
      auth.user=j.user;auth.exp=j.user.exp||auth.exp;write(auth);
      if(j.user.mustChange){build();screen.hidden=false;showChangePassword(true);return}
      html.classList.remove('auth-pending');html.classList.add('auth-ready');
      if(screen)screen.hidden=true;
      readyResolve(j.user);
    }).catch(function(){
      /* 서버 연결 실패: 저장된 로그인으로 일단 열어 둠(네트워크 복구 후 데이터 요청에서 다시 확인) */
      html.classList.remove('auth-pending');html.classList.add('auth-ready');readyResolve(auth.user);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
