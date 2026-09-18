// api/shared-data.js
// Vercel KV(Upstash Redis) 기반 팀 공유 저장소 — 입고/출고/오출고/파손/출고박스 데이터를 저장합니다.
const KEY = 'lush_shared_file_data_v1';

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${KV_URL}/get/${KEY}`, {
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
      const value = JSON.stringify(body || {});
      const r = await fetch(`${KV_URL}/set/${KEY}`, {
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
