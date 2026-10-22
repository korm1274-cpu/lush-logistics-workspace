// /api/push?action=...   (모두 로그인 필요)
//   key            GET   VAPID 공개키(구독할 때 필요)
//   subscribe      POST  { subscription, standalone:true, deviceId, test } 모바일 PWA 앱만 등록
//   status         POST  { endpoint } 이 기기 구독이 서버에 등록돼 있는지
//   device-state   POST  {deviceId,permission} 모바일 앱에서 확인한 알림 권한 동기화
//   pwa            POST  설치한 모바일 앱(standalone)으로 실행한 기록 남기기
//   settings       GET/POST (관리자) 전체·항목별 푸시알림 ON/OFF
//   devices        GET   (관리자) 사용자별 등록 기기 목록(endpoint·키 값은 내보내지 않음)
//   device-remove  POST  (관리자) { sid } 등록 기기 삭제
//   users          GET   (관리자) 사용자별 앱 설치·알림·마지막 앱 접속
//   initial-status GET   (관리자) 최초 기존 데이터 1회 검증 완료 여부
//   initial-run    POST  (관리자) 최초 기존 데이터 1회 검증 실행(항목별 최근 1건, 완료 후 다시 실행 안 됨)
// 일반 사용자에게는 알림 해제·구독 해지 기능을 제공하지 않습니다.
const A = require('./_lib/auth');
const P = require('./_lib/push');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await A.guard(req, res, {});
  if (!user) return;
  const action = String((req.query && req.query.action) || '');
  let store;
  try { store = A.kv(); } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
  try {
    if (action === 'key') {
      const v = await P.getVapid(store);
      return res.status(200).json({ success: true, publicKey: v.publicKey });
    }
    if (action === 'subscribe' && req.method === 'POST') {
      const b = body(req);
      const { sub } = await P.upsertSub(store, req, user, b.subscription, b.standalone, b.deviceId);
      let test = null;
      if (b.test) test = await P.sendTo(store, [sub], { title: 'LUSH Logistics', body: '모바일 알림이 정상적으로 활성화되었습니다.', url: './', tag: 'lush-push-activated' });
      return res.status(200).json({ success: true, test });
    }
    if (action === 'status' && req.method === 'POST') {
      const b = body(req), endpoint = String(b.endpoint || '');
      const subs = await P.listSubs(store);
      const mine = endpoint ? subs.find(s => P.isMobileAppSub(s) && s.sid === P.sidOf(endpoint) && s.appPermission === 'granted') : null;
      return res.status(200).json({ success: true, registered: !!(mine && mine.userId === user.id) });
    }
    if (action === 'device-state' && req.method === 'POST') {
      const b = body(req);
      if (!P.isMobileRequest(req)) return res.status(400).json({ success: false, error: '모바일 앱에서만 상태를 확인할 수 있습니다.' });
      await P.updateDevicePermission(store, user.id, b.deviceId, b.permission);
      return res.status(200).json({ success: true });
    }
    if (action === 'pwa' && req.method === 'POST') {
      if (!P.isMobileRequest(req) || body(req).standalone !== true) return res.status(400).json({ success: false, error: '설치된 모바일 앱만 기록합니다.' });
      await P.recordPwa(store, user.id);
      return res.status(200).json({ success: true });
    }

    // 여기부터 관리자 전용
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: '관리자만 사용할 수 있습니다.' });
    if (action === 'settings') {
      if (req.method === 'POST') return res.status(200).json({ success: true, settings: await P.saveSettings(store, body(req), user.id) });
      return res.status(200).json({ success: true, settings: await P.getSettings(store), types: P.TYPES });
    }
    if (action === 'devices') {
      const acc = await A.loadAccounts(store);
      const list = (await P.listSubs(store)).filter(P.isMobileAppSub).map(P.publicSub).map(s => ({ ...s, userName: (acc.users[s.userId] && acc.users[s.userId].name) || s.userId, userExists: !!acc.users[s.userId] }));
      list.sort((a, b) => a.userId.localeCompare(b.userId) || String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ success: true, devices: list });
    }
    if (action === 'device-remove' && req.method === 'POST') {
      const sid = String(body(req).sid || '');
      if (!sid) return res.status(400).json({ success: false, error: '삭제할 기기를 선택해 주세요.' });
      await P.removeSub(store, sid);
      return res.status(200).json({ success: true });
    }
    if (action === 'initial-status') return res.status(200).json({ success: true, done: await P.initialStatus(store) });
    if (action === 'initial-run' && req.method === 'POST') {
      const r = await P.runInitialTest(store, user.id);
      return res.status(200).json({ success: r.ok, error: r.error || '', done: r.done || null, results: r.results || (r.done && r.done.results) || [] });
    }
    if (action === 'users') {
      const subs = (await P.listSubs(store)).filter(P.isMobileAppSub), pwa = await P.pwaMap(store);
      const out = {};
      subs.forEach(s => { out[s.userId] = out[s.userId] || { activeSubs: 0 }; if (!s.lastError && s.appPermission === 'granted') out[s.userId].activeSubs++; });
      Object.keys(pwa).forEach(id => { out[id] = { ...(out[id] || { activeSubs: 0 }), ...pwa[id] }; });
      return res.status(200).json({ success: true, users: out });
    }
    return res.status(400).json({ success: false, error: '알 수 없는 요청입니다.' });
  } catch (e) {
    console.error('push error', e);
    return res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
};
