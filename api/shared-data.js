// api/shared-data.js
// Vercel KV(Upstash Redis) 기반 팀 공유 저장소 — 입고/출고/오출고/파손/출고박스 데이터를 저장합니다.
const KEY = 'lush_shared_file_data_v1';
const outboundStore = require('./_lib/outbound-store');
const KV_TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

module.exports = async (req, res) => {
  // 로그인한 사람만(api/_lib/auth.js). 게스트는 보기만, 새벽 자동 동기화(Vercel cron)는 허용
  if (!(await require('./_lib/auth').guard(req, res, { write: r => r.method !== 'GET' }))) return;
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetchWithTimeout(`${KV_URL}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const j = await r.json();
      let data = null;
      if (j && j.result) {
        try { data = JSON.parse(j.result); } catch { data = null; }
      }
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }
      body = body && typeof body === 'object' ? body : {};
      // 출고 상세는 달별로 따로 저장합니다(api/outbound.js). 달별 저장소가 생긴 뒤에는
      // 화면이 보낸 출고를 한 덩어리에 다시 넣지 않아 크기 한도(약 4.5MB)를 넘지 않게 합니다.
      if (body.outbound) {
        try {
          const idx = await outboundStore.readIndex(outboundStore.client(KV_URL, KV_TOKEN));
          if (Object.keys(idx.months).length) delete body.outbound;
        } catch (e) { /* 확인 실패 시 그대로 둠 */ }
      }
      // 구글시트 자동연동 항목(오출고·파손·입고·출고 등)은 다른 기기가 예전 사본을 통째로 올려도
      // 서버에 있는 더 최신 데이터(updatedAt 기준)가 지워지지 않도록 항목별로 최신 쪽을 유지합니다.
      try {
        const cr = await fetchWithTimeout(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const cj = await cr.json();
        const current = cj && cj.result ? JSON.parse(cj.result) : null;
        if (current && typeof current === 'object') {
          const SHEET_KEYS = ['misship', 'damage', 'inbound', 'outbound', 'inboundMonthlySummary', 'outboundMonthlySummary'];
          SHEET_KEYS.filter(k => k in body).forEach(k => {
            const cur = current[k], inc = body[k];
            const ct = cur && typeof cur === 'object' ? Date.parse(cur.updatedAt || '') : NaN;
            const it = inc && typeof inc === 'object' ? Date.parse(inc.updatedAt || '') : NaN;
            if (Number.isFinite(ct) && Number.isFinite(it) && ct > it) body[k] = cur;
          });
          // 월요약(입고·출고)에는 updatedAt이 없어 위 비교가 적용되지 않습니다. 화면은 처음 열 때 기기에 있는
          // 일부 데이터로 요약을 다시 계산해 올리기도 해서, 동기화가 새로 계산한 서버 요약을 덮어쓰는 일이 있었습니다.
          // → 서버에 원본이 있는 달의 요약은 서버 값을 유지하고, 원본이 없는 달(직접 입력한 과거 요약 등)만 받은 값을 씁니다.
          const keepServerMonths = (key, serverMonths) => {
            const cur = current[key];
            if (!(key in body) || !cur || typeof cur !== 'object') return;
            const merged = { ...(body[key] && typeof body[key] === 'object' ? body[key] : {}) };
            serverMonths.forEach(m => { if (cur[m]) merged[m] = cur[m]; });
            body[key] = merged;
          };
          const ym = d => String(d || '').slice(0, 7);
          // 입고: 이 기기가 입고 원본을 새로 올린 경우(받은 쪽 updatedAt이 더 최신)는 받은 요약을 그대로 씁니다.
          const ict = Date.parse((current.inbound && current.inbound.updatedAt) || '');
          const iit = Date.parse((body.inbound && body.inbound.updatedAt) || '');
          if (!(Number.isFinite(iit) && (!Number.isFinite(ict) || iit > ict))) {
            const rows = current.inbound && Array.isArray(current.inbound.rows) ? current.inbound.rows : [];
            keepServerMonths('inboundMonthlySummary', new Set(rows.map(r => ym(r && r[0]))));
          }
          // 출고: 원본은 달별 저장소에 있으므로 그 목록의 달은 서버 요약 유지
          try {
            const oidx = await outboundStore.readIndex(outboundStore.client(KV_URL, KV_TOKEN));
            keepServerMonths('outboundMonthlySummary', new Set(Object.keys(oidx.months || {})));
          } catch (e) { /* 확인 실패 시 받은 그대로 */ }
        }
      } catch (e) { /* 비교 실패 시에는 받은 그대로 저장 */ }
      const value = JSON.stringify(body);
      const r = await fetchWithTimeout(`${KV_URL}/set/${KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: value
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`KV 저장 실패: ${t}`);
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};
