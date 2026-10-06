// api/shared-data.js
// Vercel KV(Upstash Redis) 기반 팀 공유 저장소 — 입고/출고/오출고/파손/출고박스 데이터를 저장합니다.
const KEY = 'lush_shared_file_data_v1';
const KV_TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

module.exports = async (req, res) => {
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
