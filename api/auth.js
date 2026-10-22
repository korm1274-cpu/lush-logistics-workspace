// /api/auth?action=...
//   status          GET   계정이 하나도 없는지(최초 관리자 설정 필요 여부)
//   setup           POST  { id, name, password } 계정이 하나도 없을 때만 최초 관리자 생성
//   login           POST  { id, password } → { token, exp, user }
//   me              GET   (로그인 필요) 현재 사용자
//   logout          POST  (로그인 필요)
//   change-password POST  (로그인 필요) { current, next }
//   users           GET   (관리자) 계정 목록
//   create          POST  (관리자) { id, name, role } 초기 비밀번호 1111, 첫 로그인 시 변경 필수
//   update          POST  (관리자) { id, name?, role?, active? }
//   reset           POST  (관리자) { id } 비밀번호를 1111로 초기화(다음 로그인 시 변경 필수)
//   remove          POST  (관리자) { id }
//   logs            GET   (관리자) ?id=&limit= 로그인 기록
const A = require('./_lib/auth');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query && req.query.action) || '');
  let store;
  try { store = A.kv(); } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
  const device = A.deviceOf(req);

  try {
    if (action === 'status') {
      const acc = await A.loadAccounts(store);
      return res.status(200).json({ success: true, needsSetup: Object.keys(acc.users).length === 0 });
    }

    if (action === 'setup' && req.method === 'POST') {
      const acc = await A.loadAccounts(store);
      if (Object.keys(acc.users).length) return res.status(403).json({ success: false, error: '이미 관리자 계정이 있습니다.' });
      const b = body(req), id = A.normId(b.id), name = String(b.name || '').trim() || id;
      if (!A.validId(id)) return res.status(400).json({ success: false, error: '아이디는 영문·숫자·._- 2~30자로 입력해 주세요.' });
      const p = A.passwordProblem(b.password, id); if (p) return res.status(400).json({ success: false, error: p });
      const now = new Date().toISOString();
      acc.users[id] = { id, name, role: 'admin', ...A.hashPassword(b.password), mustChange: false, active: true, fails: 0, createdAt: now, updatedAt: now };
      await A.saveAccounts(store, acc);
      await A.addLog(store, { id, action: 'setup', result: 'success', device });
      const s = await A.createSession(store, acc.users[id]);
      acc.users[id].lastLoginAt = now; await A.saveAccounts(store, acc);
      return res.status(200).json({ success: true, token: s.token, exp: s.exp, user: A.publicUser(acc.users[id]) });
    }

    if (action === 'login' && req.method === 'POST') {
      const b = body(req), id = A.normId(b.id), pw = String(b.password || '');
      const acc = await A.loadAccounts(store);
      const u = acc.users[id];
      const fail = async (msg, result) => { await A.addLog(store, { id: id || '(빈 아이디)', action: 'login', result: result || 'fail', device }); return res.status(401).json({ success: false, error: msg }); };
      if (!u) return fail('아이디 또는 비밀번호가 맞지 않습니다.');
      if (u.active === false) return fail('사용이 중지된 계정입니다. 관리자에게 문의해 주세요.', 'inactive');
      if (u.lockUntil && u.lockUntil > Date.now()) return fail(`비밀번호를 여러 번 틀려 잠시 잠겼습니다. ${Math.ceil((u.lockUntil - Date.now()) / 60000)}분 뒤 다시 시도해 주세요.`, 'locked');
      if (!A.checkPassword(pw, u)) {
        u.fails = (u.fails || 0) + 1;
        if (u.fails >= A.MAX_FAILS) { u.lockUntil = Date.now() + A.LOCK_MS; u.fails = 0; }
        await A.saveAccounts(store, acc);
        return fail('아이디 또는 비밀번호가 맞지 않습니다.');
      }
      u.fails = 0; u.lockUntil = 0; u.lastLoginAt = new Date().toISOString();
      await A.saveAccounts(store, acc);
      const s = await A.createSession(store, u);
      await A.addLog(store, { id, action: 'login', result: 'success', device, role: u.role });
      return res.status(200).json({ success: true, token: s.token, exp: s.exp, user: A.publicUser(u) });
    }

    // 여기부터 로그인 필요
    const me = await A.getSessionUser(req, store);
    if (!me) return res.status(401).json({ success: false, error: '로그인이 필요합니다.', code: 'AUTH' });

    if (action === 'me') { const { tokenKey, ...u } = me; return res.status(200).json({ success: true, user: u }); }

    if (action === 'logout' && req.method === 'POST') {
      await store.del(me.tokenKey);
      await A.addLog(store, { id: me.id, action: 'logout', result: 'success', device });
      return res.status(200).json({ success: true });
    }

    if (action === 'change-password' && req.method === 'POST') {
      const b = body(req), acc = await A.loadAccounts(store), u = acc.users[me.id];
      if (!A.checkPassword(String(b.current || ''), u)) return res.status(400).json({ success: false, error: '현재 비밀번호가 맞지 않습니다.' });
      const p = A.passwordProblem(b.next, me.id); if (p) return res.status(400).json({ success: false, error: p });
      if (String(b.next) === String(b.current)) return res.status(400).json({ success: false, error: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' });
      Object.assign(u, A.hashPassword(b.next), { mustChange: false, updatedAt: new Date().toISOString() });
      await A.saveAccounts(store, acc);
      await A.addLog(store, { id: me.id, action: 'change-password', result: 'success', device });
      return res.status(200).json({ success: true, user: A.publicUser(u) });
    }

    // 여기부터 관리자 전용
    if (me.role !== 'admin' || me.mustChange) return res.status(403).json({ success: false, error: '관리자만 사용할 수 있습니다.' });
    const acc = await A.loadAccounts(store);

    if (action === 'users') return res.status(200).json({ success: true, users: Object.values(acc.users).map(A.publicUser).sort((a, b) => a.id.localeCompare(b.id)) });

    if (action === 'logs') {
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 300));
      const fid = A.normId(req.query.id || '');
      let logs = await A.readLogs(store, fid ? A_LOG_SCAN : limit);
      if (fid) logs = logs.filter(l => l.id === fid).slice(0, limit);
      return res.status(200).json({ success: true, logs });
    }

    const b = body(req), id = A.normId(b.id), now = new Date().toISOString();
    if (action === 'create' && req.method === 'POST') {
      if (!A.validId(id)) return res.status(400).json({ success: false, error: '아이디는 영문·숫자·._- 2~30자로 입력해 주세요.' });
      if (acc.users[id]) return res.status(400).json({ success: false, error: '이미 있는 아이디입니다.' });
      const role = A.ROLES[b.role] ? b.role : 'member';
      acc.users[id] = { id, name: String(b.name || '').trim() || id, role, ...A.hashPassword(A.INITIAL_PASSWORD), mustChange: true, active: true, fails: 0, createdAt: now, updatedAt: now };
      await A.saveAccounts(store, acc);
      await A.addLog(store, { id, action: 'create', result: 'success', device, by: me.id, role });
      return res.status(200).json({ success: true, user: A.publicUser(acc.users[id]) });
    }
    const u = acc.users[id];
    if (!u) return res.status(404).json({ success: false, error: '없는 계정입니다.' });
    const adminsLeft = (excludeId) => Object.values(acc.users).filter(x => x.role === 'admin' && x.active !== false && x.id !== excludeId).length;

    if (action === 'update' && req.method === 'POST') {
      if (b.role && A.ROLES[b.role]) { if (u.role === 'admin' && b.role !== 'admin' && !adminsLeft(id)) return res.status(400).json({ success: false, error: '관리자가 최소 1명은 있어야 합니다.' }); u.role = b.role; }
      if (typeof b.name === 'string' && b.name.trim()) u.name = b.name.trim();
      if (typeof b.active === 'boolean') { if (!b.active && u.role === 'admin' && !adminsLeft(id)) return res.status(400).json({ success: false, error: '관리자가 최소 1명은 있어야 합니다.' }); u.active = b.active; }
      u.updatedAt = now; await A.saveAccounts(store, acc);
      await A.addLog(store, { id, action: 'update', result: 'success', device, by: me.id, role: u.role });
      return res.status(200).json({ success: true, user: A.publicUser(u) });
    }
    if (action === 'reset' && req.method === 'POST') {
      Object.assign(u, A.hashPassword(A.INITIAL_PASSWORD), { mustChange: true, fails: 0, lockUntil: 0, updatedAt: now });
      await A.saveAccounts(store, acc);
      await A.addLog(store, { id, action: 'reset-password', result: 'success', device, by: me.id });
      return res.status(200).json({ success: true, user: A.publicUser(u) });
    }
    if (action === 'remove' && req.method === 'POST') {
      if (id === me.id) return res.status(400).json({ success: false, error: '본인 계정은 삭제할 수 없습니다.' });
      if (u.role === 'admin' && !adminsLeft(id)) return res.status(400).json({ success: false, error: '관리자가 최소 1명은 있어야 합니다.' });
      delete acc.users[id]; await A.saveAccounts(store, acc);
      await A.addLog(store, { id, action: 'remove', result: 'success', device, by: me.id });
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: '알 수 없는 요청입니다.' });
  } catch (e) {
    console.error('auth error', e);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
const A_LOG_SCAN = 5000;
