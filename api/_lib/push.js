// api/_lib/push.js
// 모바일 Push 알림 공통: VAPID 키, 구독(기기) 저장, 관리자 설정, 신규 등록 자동 발송
//
// 저장 키 (Upstash KV)
//   lush_push_vapid_v1        → { publicKey, privateJwk, createdAt }  환경변수 VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY가 있으면 그것을 우선 사용
//   lush_push_subs_v1 (hash)  → 필드 sid → { sid, userId, endpoint, keys:{p256dh,auth}, os, browser, standalone, createdAt, updatedAt, lastOkAt, lastError }
//   lush_push_settings_v1     → { enabled, types:{ notice, todo, bulk, traffic, hq, nozzle }, updatedAt, by }
//   lush_push_pwa_v1 (hash)   → 필드 userId → { pwaDetected:true, lastPwaAccessAt }
//   lush_push_once_v1:<종류>:<id> → 이미 보낸 건 표시(7일 보관, 같은 건 두 번 발송 방지 — 동시 요청도 SET NX로 한 번만)
//   push_initial_existing_test_v1 → 최초 기존 데이터 1회 검증 발송 완료 기록(영구, 다시 보내지 않음)
// endpoint·p256dh·auth 는 서버에만 두고 화면(API 응답)에는 내보내지 않습니다.

const A = require('./auth');
const W = require('./webpush');

const VAPID_KEY = 'lush_push_vapid_v1';
const SUBS_KEY = 'lush_push_subs_v1';
const SETTINGS_KEY = 'lush_push_settings_v1';
const PWA_KEY = 'lush_push_pwa_v1';
const SENT_PREFIX = 'lush_push_once_v1:';
const SENT_TTL_SEC = 7 * 24 * 3600;
const INITIAL_KEY = 'push_initial_existing_test_v1';

const TYPES = { notice: '팀 공지사항', todo: '제품 확보 현황', bulk: '대량 주문', traffic: '트래픽', hq: '본사 출고', nozzle: '노즐/비닐' };
const DEFAULT_SETTINGS = { enabled: true, types: { notice: true, todo: true, bulk: true, traffic: true, hq: true, nozzle: true } };

async function getVapid(store) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return W.vapidFromRaw(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  let v = await store.getJSON(VAPID_KEY);
  if (v && v.publicKey && v.privateJwk) return v;
  const fresh = await W.generateVapidKeys();
  // 동시에 두 요청이 만들면 먼저 저장된 것을 사용(NX)
  await store.cmd(['SET', VAPID_KEY, JSON.stringify({ ...fresh, createdAt: new Date().toISOString() }), 'NX']);
  v = await store.getJSON(VAPID_KEY);
  return v || fresh;
}

async function getSettings(store) {
  const s = await store.getJSON(SETTINGS_KEY);
  return { enabled: s && typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled, types: { ...DEFAULT_SETTINGS.types, ...((s && s.types) || {}) }, updatedAt: (s && s.updatedAt) || '', by: (s && s.by) || '' };
}
async function saveSettings(store, input, by) {
  const cur = await getSettings(store);
  const next = { enabled: typeof input.enabled === 'boolean' ? input.enabled : cur.enabled, types: { ...cur.types }, updatedAt: new Date().toISOString(), by };
  Object.keys(TYPES).forEach(k => { if (input.types && typeof input.types[k] === 'boolean') next.types[k] = input.types[k]; });
  await store.setJSON(SETTINGS_KEY, next);
  return next;
}

const sidOf = endpoint => A.sha256(endpoint).slice(0, 24);
function parseHash(arr) {
  const out = [];
  for (let i = 0; arr && i < arr.length; i += 2) { try { out.push(JSON.parse(arr[i + 1])); } catch (e) { /* 깨진 항목 무시 */ } }
  return out;
}
async function listSubs(store) { return parseHash(await store.cmd(['HGETALL', SUBS_KEY])); }
async function saveSub(store, sub) { await store.cmd(['HSET', SUBS_KEY, sub.sid, JSON.stringify(sub)]); }
async function removeSub(store, sid) { return store.cmd(['HDEL', SUBS_KEY, sid]); }

function uaInfo(req) {
  const ua = String((req.headers && req.headers['user-agent']) || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : '기타';
  const model = (ua.match(/Android [\d.]+; ([^;)]+)\)/) || [])[1];
  const browser = /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '기타';
  return { os: model && model !== 'K' ? `${os} (${model.trim()})` : os, browser };
}

// 구독 등록/갱신. 같은 기기(endpoint)를 다른 사람이 로그인해 쓰면 마지막 로그인 사용자로 연결
async function upsertSub(store, req, user, subscription, standalone) {
  const endpoint = String((subscription && subscription.endpoint) || '');
  const keys = (subscription && subscription.keys) || {};
  if (!/^https:\/\//.test(endpoint) || !keys.p256dh || !keys.auth) throw new Error('구독 정보가 올바르지 않습니다.');
  const sid = sidOf(endpoint);
  const all = await listSubs(store);
  const prev = all.find(s => s.sid === sid);
  const now = new Date().toISOString();
  const sub = { ...(prev || {}), sid, userId: user.id, endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, ...uaInfo(req), standalone: !!standalone, createdAt: (prev && prev.createdAt) || now, updatedAt: now };
  await saveSub(store, sub);
  return { sub, isNew: !prev };
}

// 구독 여러 건에 같은 알림 발송(만료 404/410은 자동 정리) → 성공 건수
async function sendTo(store, subs, payload) {
  if (!subs.length) return { sent: 0, failed: 0 };
  const vapid = await getVapid(store);
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async s => {
    const r = await W.sendPush({ endpoint: s.endpoint, keys: s.keys }, payload, vapid);
    if (r.ok) { sent++; s.lastOkAt = new Date().toISOString(); s.lastError = ''; await saveSub(store, s).catch(() => {}); return; }
    failed++;
    if (r.gone) await removeSub(store, s.sid).catch(() => {});
    else { s.lastError = `${r.status || ''} ${r.error || ''}`.trim(); s.lastErrorAt = new Date().toISOString(); await saveSub(store, s).catch(() => {}); }
  }));
  return { sent, failed };
}

const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// 공지 내용 속 [글자](주소) 링크는 글자만 남김
const plainNote = s => String(s || '').replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s]*?)\)/g, '$1');

// 신규 등록 1건 → 알림 내용(실제 등록 내용 일부를 그대로 사용)
function messageOf(kind, r) {
  if (kind === 'notice') return { title: '팀 공지사항이 신규 등록되었습니다.', body: clip([r.title, plainNote(r.note)].filter(Boolean).join(' — '), 120) };
  if (kind === 'todo') return { title: '제품 확보 현황이 신규 등록되었습니다.', body: clip([r.content, r.note].filter(Boolean).join(' — '), 120) };
  const dates = Array.isArray(r.requestDates) ? r.requestDates.join(', ') : '';
  const REQ_TITLE = { bulk: '대량 주문 출고 요청이 신규 등록되었습니다.', traffic: '트래픽 출고 요청이 신규 등록되었습니다.', hq: '본사 출고 요청이 신규 등록되었습니다.', nozzle: '노즐/비닐 출고 요청이 신규 등록되었습니다.' };
  return { title: REQ_TITLE[kind], body: clip(`매장명 ${r.storeName || '-'} · 요청일자 ${dates || '-'} · 처리 ${r.status || '미처리'}`, 140) };
}

// team-data 저장 직후 호출: 서버에 없던 id만 받아 설정 확인 → 중복 확인 → 발송
// items: [{ kind, item }]
async function notifyNew(store, items) {
  if (!items.length) return { sent: 0 };
  const settings = await getSettings(store);
  if (!settings.enabled) return { sent: 0, skipped: 'off' };
  const targets = items.filter(x => TYPES[x.kind] && settings.types[x.kind]);
  if (!targets.length) return { sent: 0, skipped: 'type-off' };
  // 사용 중인 계정에 연결된 기기만
  const acc = await A.loadAccounts(store);
  const subs = (await listSubs(store)).filter(s => acc.users[s.userId] && acc.users[s.userId].active !== false);
  let sent = 0;
  for (const { kind, item } of targets.slice(0, 10)) { // 한 번 저장에 최대 10건
    const fresh = await store.cmd(['SET', `${SENT_PREFIX}${kind}:${item.id}`, '1', 'NX', 'EX', String(SENT_TTL_SEC)]);
    if (fresh !== 'OK') continue; // 이미 보낸 건
    const m = messageOf(kind, item);
    const r = await sendTo(store, subs, { ...m, url: './', tag: `lush-${kind}-${item.id}` });
    sent += r.sent;
  }
  return { sent };
}

// 최초 기존 데이터 1회 검증(관리자가 푸시알림 설정에서 실행)
//   - 6개 항목마다 지금 저장된 기존 건 중 가장 최근 1건만(최대 6건) 실제 알림과 같은 제목·본문으로 발송
//   - 등록 기기가 0대이거나 한 건도 전달되지 않으면 완료로 기록하지 않음
//   - 완료되면 INITIAL_KEY에 영구 기록 → 새로고침·재배포·동기화 후에도 다시 보내지 않음
async function initialStatus(store) { return (await store.getJSON(INITIAL_KEY)) || null; }
async function runInitialTest(store, by) {
  const done = await initialStatus(store);
  if (done) return { ok: false, error: '이미 초기 검증을 완료했습니다.', done };
  const lock = await store.cmd(['SET', INITIAL_KEY + ':lock', by, 'NX', 'EX', '120']);
  if (lock !== 'OK') return { ok: false, error: '다른 관리자가 초기 검증을 실행 중입니다. 잠시 후 다시 확인해 주세요.' };
  try {
    const acc = await A.loadAccounts(store);
    const subs = (await listSubs(store)).filter(s => acc.users[s.userId] && acc.users[s.userId].active !== false);
    if (!subs.length) return { ok: false, error: '알림을 허용한 기기가 없어 실행하지 않았습니다. 먼저 휴대폰에서 알림을 허용해 주세요.' };
    const data = (await store.getJSON('lush_team_data_v1')) || {};
    const stamp = r => String((r && (r.createdAt || r.updatedAt || r.date)) || '');
    const latest = arr => (Array.isArray(arr) ? arr.filter(r => r && r.id) : []).reduce((best, r) => (!best || stamp(r) > stamp(best) ? r : best), null);
    const picks = [
      ['notice', latest(data.notices)],
      ['todo', latest(data.todos)],
      ...['bulk', 'traffic', 'hq', 'nozzle'].map(k => [k, latest((data.requests || []).filter(r => r && r.type === k))]),
    ];
    const results = [];
    for (const [kind, item] of picks) {
      if (!item) { results.push({ kind, label: TYPES[kind], skipped: '기존 데이터 없음' }); continue; }
      const m = messageOf(kind, item);
      const r = await sendTo(store, subs, { ...m, url: './', tag: `lush-initial-${kind}` });
      results.push({ kind, label: TYPES[kind], title: m.title, body: m.body, sent: r.sent, failed: r.failed });
    }
    const sent = results.reduce((n, r) => n + (r.sent || 0), 0);
    if (!sent) return { ok: false, error: '알림이 한 건도 전달되지 않아 완료로 기록하지 않았습니다.', results };
    const record = { completedAt: new Date().toISOString(), by, devices: subs.length, results };
    await store.setJSON(INITIAL_KEY, record);
    return { ok: true, done: record };
  } finally { await store.del(INITIAL_KEY + ':lock').catch(() => {}); }
}

async function recordPwa(store, userId) {
  await store.cmd(['HSET', PWA_KEY, userId, JSON.stringify({ pwaDetected: true, lastPwaAccessAt: new Date().toISOString() })]);
}
async function pwaMap(store) {
  const arr = await store.cmd(['HGETALL', PWA_KEY]);
  const out = {};
  for (let i = 0; arr && i < arr.length; i += 2) { try { out[arr[i]] = JSON.parse(arr[i + 1]); } catch (e) { /* 무시 */ } }
  return out;
}

// 화면용(민감 값 제외)
const publicSub = s => ({ sid: s.sid, userId: s.userId, os: s.os || '', browser: s.browser || '', standalone: !!s.standalone, createdAt: s.createdAt || '', updatedAt: s.updatedAt || '', lastOkAt: s.lastOkAt || '', status: s.lastError ? 'error' : 'active' });

module.exports = { TYPES, getVapid, getSettings, saveSettings, listSubs, removeSub, upsertSub, sendTo, notifyNew, recordPwa, pwaMap, publicSub, sidOf, messageOf, initialStatus, runInitialTest };
