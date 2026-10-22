// /api/team-data.js
// 공지사항 / TODO / 출고요청처럼 용량이 작은 데이터를 팀 전체가 공유하기 위한 API입니다.
// 입고·출고 파일 데이터(api/shared-data.js)와는 별도의 KV 키를 사용해서,
// 큰 파일 데이터 동기화와 사용량 한도(quota)를 나눠 씁니다.
// 환경변수는 api/shared-data.js와 동일한 KV_REST_API_URL / KV_REST_API_TOKEN을 그대로 사용합니다.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'lush_team_data_v1';
const KV_TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function kvGet() {
  const res = await fetchWithTimeout(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

async function kvSet(value) {
  const res = await fetchWithTimeout(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  return res.ok;
}

module.exports = async (req, res) => {
  // 로그인한 사람만(api/_lib/auth.js). 게스트는 보기만, 새벽 자동 동기화(Vercel cron)는 허용
  const authUser = await require('./_lib/auth').guard(req, res, { write: r => r.method !== 'GET' });
  if (!authUser) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (!KV_URL || !KV_TOKEN) {
    res.status(200).json({ success: false, error: 'KV_REST_API_URL/KV_REST_API_TOKEN 환경변수가 설정되지 않았습니다.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const data = await kvGet();
      res.status(200).json({ success: true, data: data || { notices: [], todos: [], requests: [] } });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body) {
        res.status(200).json({ success: false, error: '잘못된 요청 본문입니다.' });
        return;
      }
      // 화면 버전에 따라 일부 항목(예: 제품 불량 defects)을 모르고 올리는 경우가 있어,
      // 보낸 데이터에 없는 항목은 서버에 있던 값을 그대로 유지합니다.
      try {
        const current = await kvGet();
        if (current && typeof current === 'object' && body && typeof body === 'object') {
          Object.keys(current).forEach(k => { if (!(k in body)) body[k] = current[k]; });
          // 제품 불량(defects)은 누적 기록: 여러 사람이 동시에 올려도 서로 지우지 않도록 건(id)별로 합칩니다.
          // 같은 건이면 updatedAt이 더 최근인 쪽을 남기고, 삭제는 deleted 표시로 전달됩니다.
          // 출고 요청(requests): 목록을 통째로 올리면 다른 기기에서 막 등록한 요청이 덮여 사라지므로 건(id)별로 합칩니다.
          // 같은 건이면 updatedAt(없으면 createdAt)이 더 최근인 쪽, 지운 요청은 requestsDeleted(id 목록)로 전달돼 다시 살아나지 않음.
          // 공지(notices)·제품 확보(todos)도 같은 방식(지운 건은 noticesDeleted·todosDeleted).
          [['requests', 'requestsDeleted'], ['notices', 'noticesDeleted'], ['todos', 'todosDeleted']].forEach(([key, delKey]) => {
            if (!Array.isArray(current[key]) || !Array.isArray(body[key])) return;
            const deleted = new Set([].concat(current[delKey] || [], body[delKey] || []).filter(Boolean));
            const stamp = r => String(r.updatedAt || r.createdAt || '');
            const byId = new Map();
            const put = r => {
              if (!r || !r.id) return;
              const prev = byId.get(r.id);
              if (!prev || stamp(r) > stamp(prev)) byId.set(r.id, r);
            };
            body[key].forEach(put);    // 보낸 쪽 순서를 먼저 유지
            current[key].forEach(put); // 서버에만 있거나 서버 쪽이 더 최신인 건 반영
            const noId = body[key].filter(r => r && !r.id); // id 없는 예전 기록은 그대로 둠
            body[key] = Array.from(byId.values()).filter(r => !deleted.has(r.id)).concat(noId);
            body[delKey] = Array.from(deleted).slice(-2000);
          });
          // 메뉴 설정(menuConfig): 관리자만 바꿀 수 있고, 더 최신(updatedAt) 것만 반영
          if (body.menuConfig !== undefined) {
            const cur = current.menuConfig, inc = body.menuConfig;
            if (authUser.role !== 'admin' || !inc || !Array.isArray(inc.menus)) { if (cur) body.menuConfig = cur; else delete body.menuConfig; }
            else if (cur && String(cur.updatedAt || '') > String(inc.updatedAt || '')) body.menuConfig = cur;
          }
          // 재고(stock, 화면 '재고'): 제품 불량과 같이 건(id)별 병합, 삭제는 deleted 표시로 전달
          if (Array.isArray(current.stock) && Array.isArray(body.stock)) {
            const byId = new Map();
            const put = d => {
              if (!d || !d.id) return;
              const prev = byId.get(d.id);
              if (!prev || String(d.updatedAt || '') >= String(prev.updatedAt || '')) byId.set(d.id, d);
            };
            current.stock.forEach(put);
            body.stock.forEach(put);
            body.stock = Array.from(byId.values());
          }
          if (Array.isArray(current.defects) && Array.isArray(body.defects)) {
            const byId = new Map();
            const put = d => {
              if (!d || !d.id) return;
              const prev = byId.get(d.id);
              if (!prev || String(d.updatedAt || '') >= String(prev.updatedAt || '')) byId.set(d.id, d);
            };
            current.defects.forEach(put);
            body.defects.forEach(put);
            body.defects = Array.from(byId.values());
          }
        }
      } catch (e) { /* 병합 실패 시 받은 그대로 저장 */ }
      const ok = await kvSet(body);
      res.status(200).json({ success: ok });
      return;
    }
    res.status(200).json({ success: false, error: 'Unsupported method' });
  } catch (e) {
    res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
};
