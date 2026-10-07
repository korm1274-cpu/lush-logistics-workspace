// api/outbound.js
// 출고 상세 데이터는 양이 많아(월 약 7~8천 줄) 팀 공유 데이터 한 덩어리에 넣으면
// Vercel 함수가 한 번에 주고받을 수 있는 크기(약 4.5MB)를 곧 넘습니다.
// 그래서 출고는 달(YYYY-MM)별로 따로 저장하고, 화면은 '목록표'를 보고 바뀐 달만 받아갑니다.
//
//   GET  /api/outbound                → 목록표 { meta, months: { 'YYYY-MM': { hash, count, updatedAt } } }
//   GET  /api/outbound?month=YYYY-MM  → 그 달의 행 { month, rows }
//   POST /api/outbound  { month, rows, meta? }  → 그 달을 저장(화면에서 출고 Excel을 올린 경우)
//
// 시트 자동 연동(api/sync-outbound-sheets.js)도 같은 함수(outbound-store.js)로 저장합니다.
const store = require('./_lib/outbound-store');

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  const kv = store.client(KV_URL, KV_TOKEN);
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const month = String((req.query && req.query.month) || '').trim();
      if (!month) {
        const index = await store.readIndex(kv);
        return res.status(200).json({ success: true, index });
      }
      if (!store.isMonth(month)) return res.status(400).json({ success: false, error: 'month는 YYYY-MM 형식이어야 합니다.' });
      const rows = await store.readMonth(kv, month);
      return res.status(200).json({ success: true, month, rows });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || !store.isMonth(body.month) || !Array.isArray(body.rows)) {
        return res.status(400).json({ success: false, error: '{ month: "YYYY-MM", rows: [...] } 형식으로 보내주세요.' });
      }
      const result = await store.writeMonths(kv, { [body.month]: body.rows }, body.meta || null);
      return res.status(200).json({ success: true, ...result });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};
