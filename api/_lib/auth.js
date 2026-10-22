// api/_lib/auth.js
// 로그인 계정·세션·로그인 기록 공통 함수 (Vercel KV / Upstash REST)
//
// 저장 키
//   lush_accounts_v1            → { users: { [아이디]: { id, name, role, salt, hash, mustChange, active, fails, lockUntil, createdAt, updatedAt, lastLoginAt } } }
//   lush_session_v1:<토큰해시>   → { id, role, exp }  (KV 만료시간 EX로 자동 삭제)
//   lush_auth_log_v1            → 리스트(최신이 앞). { at, id, action, result, device, by? }
//
// 보안 기준
//   - 비밀번호는 scrypt(무작위 salt)로 해시만 저장, 원문 저장·로그 기록 없음
//   - 세션 토큰은 무작위 32바이트, KV에는 SHA-256 해시만 저장
//   - 로그인 기록에는 시각·아이디·결과·기기 종류만(IP 등 개인정보 기록 안 함)
//   - 같은 아이디 10회 연속 실패 시 10분 잠금

const crypto = require('crypto');

const ACCOUNTS_KEY = 'lush_accounts_v1';
const SESSION_PREFIX = 'lush_session_v1:';
const LOG_KEY = 'lush_auth_log_v1';
const LOG_MAX = 5000;
const TIMEOUT_MS = 8000;

const ROLES = { admin: '관리자', member: '팀원', guest: '게스트' };
const INITIAL_PASSWORD = '1111'; // 관리자가 계정을 만들거나 비밀번호를 초기화할 때의 임시 비밀번호(첫 로그인 시 변경 필수)
const MEMBER_SESSION_SEC = 365 * 24 * 3600; // 관리자·팀원: 사실상 제한 없음(사용할 때마다 연장)
const GUEST_SESSION_SEC = 3600;             // 게스트: 로그인 후 1시간
const MAX_FAILS = 10, LOCK_MS = 10 * 60 * 1000;

function kv() {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV 환경변수가 설정되지 않았습니다.');
  const cmd = async (args) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: ctrl.signal });
      const j = await r.json();
      if (j && j.error) throw new Error(j.error);
      return j ? j.result : null;
    } finally { clearTimeout(timer); }
  };
  return {
    cmd,
    async getJSON(key) { const v = await cmd(['GET', key]); if (v == null) return null; try { return JSON.parse(v); } catch { return null; } },
    async setJSON(key, value, exSec) { return exSec ? cmd(['SET', key, JSON.stringify(value), 'EX', String(exSec)]) : cmd(['SET', key, JSON.stringify(value)]); },
    async del(key) { return cmd(['DEL', key]); }
  };
}

const normId = id => String(id || '').trim().toLowerCase();
const validId = id => /^[a-z0-9._-]{2,30}$/.test(id);
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  const h = crypto.scryptSync(String(password), user.salt, 64);
  const stored = Buffer.from(user.hash, 'hex');
  return stored.length === h.length && crypto.timingSafeEqual(stored, h);
}
// 새 비밀번호 규칙: 8자 이상, 임시 비밀번호(1111)·아이디와 같으면 안 됨
function passwordProblem(pw, id) {
  pw = String(pw || '');
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (pw === INITIAL_PASSWORD) return '임시 비밀번호는 사용할 수 없습니다.';
  if (id && pw.toLowerCase() === String(id).toLowerCase()) return '아이디와 같은 비밀번호는 사용할 수 없습니다.';
  return '';
}

async function loadAccounts(store) { const a = await store.getJSON(ACCOUNTS_KEY); return a && a.users ? a : { users: {} }; }
async function saveAccounts(store, a) { await store.setJSON(ACCOUNTS_KEY, a); }
function publicUser(u) { return u ? { id: u.id, name: u.name || u.id, role: u.role, roleLabel: ROLES[u.role] || u.role, mustChange: !!u.mustChange, active: u.active !== false, createdAt: u.createdAt || '', lastLoginAt: u.lastLoginAt || '' } : null; }

function deviceOf(req) {
  const ua = String((req.headers && req.headers['user-agent']) || '');
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : '기타';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return br ? `${os} · ${br}` : os;
}
async function addLog(store, entry) {
  try {
    await store.cmd(['LPUSH', LOG_KEY, JSON.stringify({ at: new Date().toISOString(), ...entry })]);
    await store.cmd(['LTRIM', LOG_KEY, '0', String(LOG_MAX - 1)]);
  } catch (e) { /* 기록 실패는 로그인 자체를 막지 않음 */ }
}
async function readLogs(store, limit) {
  const arr = await store.cmd(['LRANGE', LOG_KEY, '0', String(Math.max(0, (limit || 300) - 1))]);
  return (arr || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

async function createSession(store, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = user.role === 'guest' ? GUEST_SESSION_SEC : MEMBER_SESSION_SEC;
  const exp = Date.now() + ttl * 1000;
  await store.setJSON(SESSION_PREFIX + sha256(token), { id: user.id, role: user.role, exp }, ttl);
  return { token, exp };
}
function tokenOf(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  const m = h.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return m ? m[1] : '';
}
// 요청의 로그인 사용자 확인. 없거나 만료면 null. 관리자·팀원 세션은 쓸 때마다 만료를 연장(사실상 제한 없음)
async function getSessionUser(req, store) {
  const token = tokenOf(req); if (!token) return null;
  store = store || kv();
  const key = SESSION_PREFIX + sha256(token);
  const s = await store.getJSON(key);
  if (!s || !s.id || (s.exp && s.exp < Date.now())) return null;
  const acc = await loadAccounts(store);
  const u = acc.users[s.id];
  if (!u || u.active === false) { await store.del(key); return null; }
  if (u.role !== 'guest' && s.exp - Date.now() < 300 * 24 * 3600 * 1000) {
    s.exp = Date.now() + MEMBER_SESSION_SEC * 1000; s.role = u.role;
    await store.setJSON(key, s, MEMBER_SESSION_SEC);
  }
  return { ...publicUser(u), exp: s.exp, tokenKey: key };
}
const isCron = req => /vercel-cron/i.test(String((req.headers && req.headers['user-agent']) || ''));

// 데이터 API 공통 문지기: 로그인 필요. write=true면 관리자·팀원만(게스트는 보기만), 비밀번호 변경 전 계정은 거부
async function guard(req, res, opts = {}) {
  if (opts.allowCron && isCron(req)) return { id: 'cron', role: 'admin', cron: true };
  let user = null;
  try { user = await getSessionUser(req); } catch (e) { user = null; }
  if (!user) { res.status(401).json({ success: false, error: '로그인이 필요합니다.', code: 'AUTH' }); return null; }
  if (user.mustChange) { res.status(403).json({ success: false, error: '임시 비밀번호를 먼저 변경해 주세요.', code: 'MUST_CHANGE' }); return null; }
  const write = typeof opts.write === 'function' ? opts.write(req) : opts.write;
  if (write && user.role === 'guest') { res.status(403).json({ success: false, error: '게스트는 저장할 수 없습니다.', code: 'FORBIDDEN' }); return null; }
  if (opts.adminOnly && user.role !== 'admin') { res.status(403).json({ success: false, error: '관리자만 사용할 수 있습니다.', code: 'FORBIDDEN' }); return null; }
  return user;
}

module.exports = { ROLES, INITIAL_PASSWORD, MAX_FAILS, LOCK_MS, SESSION_PREFIX, kv, normId, validId, sha256, hashPassword, checkPassword, passwordProblem, loadAccounts, saveAccounts, publicUser, deviceOf, addLog, readLogs, createSession, tokenOf, getSessionUser, guard, isCron };
