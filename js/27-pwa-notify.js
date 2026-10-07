/* <script> (index.html에서 그대로 옮김) */
(function(){
  var btn=document.getElementById('pwaTestNotifyBtn');
  if(!btn)return;
  btn.addEventListener('click', async function(){
    if(!('Notification' in window)){
      alert('이 기기에서는 알림을 지원하지 않습니다.');
      return;
    }
    var permission=Notification.permission;
    if(permission!=='granted'){
      permission=await Notification.requestPermission();
    }
    if(permission!=='granted'){
      alert('알림 권한을 허용해야 테스트할 수 있습니다.');
      return;
    }
    try{
      var reg=await navigator.serviceWorker.ready;
      await reg.showNotification('LUSH Logistics', {
        body:'테스트알람 입니다.',
        icon:'./app-icon.svg',
        badge:'./app-icon.svg',
        tag:'lush-test-notification'
      });
    }catch(e){
      new Notification('LUSH Logistics',{body:'테스트알람 입니다.',icon:'./app-icon.svg'});
    }
  });
})();

