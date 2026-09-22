// /api/team-data.js
// 공지사항 / TODO / 출고요청처럼 용량이 작은 데이터를 팀 전체가 공유하기 위한 API입니다.
// 입고·출고 파일 데이터(api/shared-data.js)와는 별도의 KV 키를 사용해서,
// 큰 파일 데이터 동기화와 사용량 한도(quota)를 나눠 씁니다.
// 환경변수는 api/shared-data.js와 동일한 KV_REST_API_URL / KV_REST_API_TOKEN을 그대로 사용합니다.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'lush_team_data_v1';

async function kvGet() {
  const res = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

async function kvSet(value) {
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
  return res.ok;
}

module.exports = async (req, res) => {
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
      const ok = await kvSet(body);
      res.status(200).json({ success: ok });
      return;
    }
    res.status(200).json({ success: false, error: 'Unsupported method' });
  } catch (e) {
    res.status(200).json({ success: false, error: String((e && e.message) || e) });
  }
};
