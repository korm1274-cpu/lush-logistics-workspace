/* 모바일 Push 알림(웹 푸시) — 메인 앱(index.html)과 앱 설치 가이드(install.html)에서 같이 사용
   - 알림 허용: 로그인 사용자 확인 → 권한 요청 → 서비스워커 준비 → PushManager.subscribe → 서버 저장(로그인 사용자와 연결) → 테스트 알림 자동 발송
   - 앱 실행 때 자동 확인: 정상이면 조용히 서버와 맞춤 / 권한 미결정(default)이면 안내 팝업 / 차단(denied)이면 안내만
   - 헤더 상태: 실제 구독이 있어야 '🔔 알림 활성화', 아니면 '🔕 알림 비활성' (해제 기능은 제공하지 않음)
   - 설치한 앱(standalone)으로 실행하면 서버에 '마지막 앱 접속' 기록 */
(function(){
  var AUTH_KEY='lush_auth_v1';
  function authInfo(){try{var v=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');return v&&v.token?v:null}catch(e){return null}}
  function currentUser(){
    if(window.LUSH_AUTH&&typeof window.LUSH_AUTH.user==='function'){var u=window.LUSH_AUTH.user();if(u)return u}
    var a=authInfo();return a&&a.user||null;
  }
  function api(action,body){
    var a=authInfo();if(!a)return Promise.resolve({success:false,code:'AUTH'});
    var h={Authorization:'Bearer '+a.token};if(body)h['Content-Type']='application/json';
    return fetch('/api/push?action='+action,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined})
      .then(function(r){return r.json()}).catch(function(){return{success:false,error:'네트워크 연결을 확인해 주세요.'}});
  }
  var isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function standalone(){return !!((window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true)}
  function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
  function isMobile(){return /Android|iPhone|iPad|iPod/.test(navigator.userAgent)||standalone()||(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)}
  function keyBytes(b64){var s=b64.replace(/-/g,'+').replace(/_/g,'/');s+='==='.slice((s.length+3)%4);var bin=atob(s),out=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
  function registration(){
    return navigator.serviceWorker.getRegistration().then(function(reg){return reg||navigator.serviceWorker.register('./sw.js')})
      .then(function(){return Promise.race([navigator.serviceWorker.ready,new Promise(function(_,rej){setTimeout(function(){rej(new Error('서비스워커 준비 시간이 초과되었습니다.'))},10000)})])});
  }
  function unsupportedMsg(){return isIOS&&!standalone()?'iPhone은 Safari에서 [홈 화면에 추가]로 설치한 LUSH Logistics 앱에서 알림을 허용할 수 있습니다.':'이 브라우저는 모바일 알림을 지원하지 않습니다.'}

  var state='unknown'; // active | inactive | denied | unsupported | logout
  var listeners=[];
  function setState(s){state=s;listeners.forEach(function(f){try{f(s)}catch(e){}})}

  // 알림 허용(버튼을 누른 직후에 호출해야 권한 창이 뜸)
  function enable(){
    var u=currentUser();
    if(!u||!authInfo())return Promise.resolve({ok:false,msg:'먼저 LUSH Logistics에 로그인해 주세요.'});
    if(!supported()){setState('unsupported');return Promise.resolve({ok:false,msg:unsupportedMsg()})}
    var perm=Notification.permission;
    var ask=perm==='default'?Notification.requestPermission():Promise.resolve(perm);
    return Promise.resolve(ask).then(function(p){
      if(p!=='granted'){setState(p==='denied'?'denied':'inactive');return{ok:false,denied:p==='denied',msg:p==='denied'?'알림이 차단되어 있습니다. 휴대폰 설정에서 LUSH Logistics(또는 브라우저)의 알림을 허용해 주세요.':'알림 권한이 허용되지 않았습니다.'}}
      return registration().then(function(reg){
        return reg.pushManager.getSubscription().then(function(sub){
          if(sub)return sub;
          return api('key').then(function(k){
            if(!k||!k.success||!k.publicKey)throw new Error((k&&k.error)||'알림 키를 받지 못했습니다.');
            return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(k.publicKey)});
          });
        });
      }).then(function(sub){
        return api('subscribe',{subscription:sub.toJSON(),standalone:standalone(),test:true});
      }).then(function(r){
        if(!r||!r.success)throw new Error((r&&r.error)||'알림 등록에 실패했습니다.');
        try{sessionStorage.setItem('lush_push_synced','1')}catch(e){}
        setState('active');
        return{ok:true,msg:'알림이 활성화되었습니다. 잠시 후 테스트 알림이 도착합니다.',test:r.test};
      });
    }).catch(function(e){return{ok:false,msg:String((e&&e.message)||e)}});
  }

  // 앱 실행 때 상태 확인(권한 창은 띄우지 않음)
  function check(){
    if(!currentUser()||!authInfo()){setState('logout');return Promise.resolve(state)}
    if(!supported()){setState('unsupported');return Promise.resolve(state)}
    if(Notification.permission==='denied'){setState('denied');return Promise.resolve(state)}
    if(Notification.permission!=='granted'){setState('inactive');return Promise.resolve(state)}
    return registration().then(function(reg){
      return reg.pushManager.getSubscription().then(function(sub){
        if(sub)return sub;
        // 권한은 있는데 구독이 없으면(앱 재설치 등) 조용히 다시 구독
        return api('key').then(function(k){return k&&k.publicKey?reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(k.publicKey)}):null});
      });
    }).then(function(sub){
      if(!sub){setState('inactive');return state}
      var synced=false;try{synced=sessionStorage.getItem('lush_push_synced')==='1'}catch(e){}
      if(synced){setState('active');return state}
      // 서버에도 같은 기기가 이 사용자로 등록돼 있는지 맞춤(관리자가 지웠거나 다른 계정으로 바꿔 로그인한 경우 다시 연결)
      return api('subscribe',{subscription:sub.toJSON(),standalone:standalone(),test:false}).then(function(r){
        if(r&&r.success){try{sessionStorage.setItem('lush_push_synced','1')}catch(e){}setState('active')}else setState('inactive');
        return state;
      });
    }).catch(function(){setState('inactive');return state});
  }

  function recordPwa(){
    if(!standalone()||!authInfo())return;
    try{if(sessionStorage.getItem('lush_pwa_recorded')==='1')return;sessionStorage.setItem('lush_pwa_recorded','1')}catch(e){}
    api('pwa',{at:Date.now()});
  }

  window.LUSH_PUSH={enable:enable,check:check,state:function(){return state},onChange:function(f){listeners.push(f)},standalone:standalone,supported:supported};

  /* ===== 메인 앱(index.html) 화면: 헤더 상태 + 안내 팝업 ===== */
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toast(m){if(typeof window.toastMsg==='function')window.toastMsg(m);else alert(m)}
  function renderChip(){
    var chip=document.getElementById('pushStatusChip');if(!chip)return;
    var u=currentUser();
    if(!u||state==='logout'||state==='unknown'){chip.hidden=true;return}
    var on=state==='active';
    chip.hidden=false;chip.classList.toggle('on',on);chip.classList.toggle('off',!on);
    chip.innerHTML=(on?'🔔 알림 활성화':'🔕 알림 비활성')+' <i>|</i> '+esc(u.name||u.id);
    chip.title=on?'모바일 알림을 받고 있습니다.':state==='denied'?'알림이 차단되어 있습니다. 기기 설정에서 허용해 주세요.':state==='unsupported'?unsupportedMsg():'눌러서 알림을 허용할 수 있습니다.';
  }
  function closeModal(){var m=document.getElementById('pushPromptModal');if(m)m.remove()}
  function showModal(kind){
    if(document.getElementById('pushPromptModal'))return;
    var m=document.createElement('div');m.id='pushPromptModal';m.className='push-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
    var denied=kind==='denied';
    m.innerHTML='<div class="push-modal-card">'+
      '<b class="push-modal-title">'+(denied?'🔕 모바일 알림이 꺼져 있습니다':'🔔 모바일 알림을 활성화해주세요')+'</b>'+
      '<p>'+(denied?'알림이 차단되어 있어 신규 등록 알림을 받을 수 없습니다.<br>휴대폰 <b>설정 → 알림</b>에서 LUSH Logistics(또는 사용 중인 브라우저)의 알림을 허용해 주세요.':'팀 공지사항, 제품 확보 현황 및<br>출고 요청 신규 등록 알림을<br>모바일에서 받을 수 있습니다.')+'</p>'+
      '<p class="push-modal-msg" hidden></p>'+
      '<div class="push-modal-actions">'+(denied?'<button type="button" class="push-btn primary" data-pm="close">확인</button>':'<button type="button" class="push-btn" data-pm="later">나중에</button><button type="button" class="push-btn primary" data-pm="allow">알림 허용</button>')+'</div></div>';
    m.addEventListener('click',function(e){
      var b=e.target.closest('[data-pm]');if(!b)return;
      var act=b.getAttribute('data-pm');
      if(act!=='allow'){closeModal();return}
      b.disabled=true;b.textContent='설정 중…';
      enable().then(function(r){
        var msg=m.querySelector('.push-modal-msg');msg.hidden=false;msg.textContent=r.msg;msg.classList.toggle('ok',!!r.ok);
        if(r.ok){setTimeout(closeModal,1600)}else{b.disabled=false;b.textContent='알림 허용'}
      });
    });
    document.body.appendChild(m);
  }
  // 다른 팝업(새로 등록된 내용 안내 등)이 떠 있으면 닫힌 뒤에 표시(최대 2분 기다림)
  function otherPopupOpen(){var n=document.getElementById('newItemsPopup');return !!(n&&!n.hidden&&getComputedStyle(n).display!=='none'&&n.getClientRects().length)||!!document.querySelector('#authScreen:not([hidden]),.au-modal')}
  function autoPrompt(tries){
    if(!isMobile())return; // PC는 헤더 상태만 표시
    if(!(state==='inactive'&&supported()&&Notification.permission==='default')&&state!=='denied')return;
    if(otherPopupOpen()){if((tries||0)<120)setTimeout(function(){autoPrompt((tries||0)+1)},1000);return}
    var key='lush_push_prompted_'+state;
    try{if(sessionStorage.getItem(key)==='1')return;sessionStorage.setItem(key,'1')}catch(e){}
    showModal(state==='denied'?'denied':'prompt');
  }
  function initApp(){
    var chip=document.getElementById('pushStatusChip');
    if(chip){
      listeners.push(renderChip);
      chip.addEventListener('click',function(){
        if(state==='active')return; // 해제 기능 없음
        if(state==='unsupported'){toast(unsupportedMsg());return}
        if(state==='denied'){showModal('denied');return}
        showModal('prompt');
      });
    }
    var start=function(){
      if(!currentUser())return;
      var u=currentUser();if(u&&u.mustChange)return;
      recordPwa();
      // '새로 등록된 내용' 팝업(js/23, 2.5~6초 뒤 판단)과 겹치지 않게 7초 뒤에 안내 팝업 여부 확인
      check().then(function(){renderChip();setTimeout(autoPrompt,7000)});
    };
    if(window.LUSH_AUTH&&window.LUSH_AUTH.ready&&typeof window.LUSH_AUTH.ready.then==='function')window.LUSH_AUTH.ready.then(function(){setTimeout(start,800)});
    else setTimeout(start,800);
  }

  /* ===== 앱 설치 가이드(install.html): [알림 허용] 단계 ===== */
  function initInstall(){
    var btn=document.getElementById('pushEnableBtn'),out=document.getElementById('pushEnableStatus');if(!btn)return;
    var show=function(t,ok){if(out){out.textContent=t;out.className='push-status'+(ok===true?' ok':ok===false?' err':'')}};
    var refresh=function(){
      if(!currentUser()){show('앱에서 로그인한 뒤 이 화면을 다시 열어 주세요.',false);return}
      check().then(function(s){
        if(s==='active')show('✅ 알림이 활성화되어 있습니다. ('+(currentUser().name||currentUser().id)+')',true);
        else if(s==='denied')show('알림이 차단되어 있습니다. 휴대폰 설정 → 알림에서 허용해 주세요.',false);
        else if(s==='unsupported')show(unsupportedMsg(),false);
        else show('아래 [알림 허용]을 눌러 주세요.');
      });
    };
    btn.addEventListener('click',function(){
      btn.disabled=true;show('설정 중…');
      enable().then(function(r){btn.disabled=false;show(r.ok?'✅ '+r.msg:r.msg,!!r.ok)});
    });
    recordPwa();
    refresh();
  }
  // Installability: prepare the existing service worker on initial page load,
  // even before login or notification consent. This never requests notification
  // permission and never creates a Push subscription.
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('./sw.js').catch(function(error){
        console.warn('[LUSH PWA] service worker registration failed:',error);
      });
    },{once:true});
  }

  function init(){if(document.getElementById('pushEnableBtn'))initInstall();else initApp()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
