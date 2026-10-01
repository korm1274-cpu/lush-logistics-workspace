// api/sync-misship-sheet.js
// 매일 새벽 4시 30분(KST), "오출고" 구글시트(웹에 게시 CSV)를 읽어와
// 팀 공유 저장소(Vercel KV)의 misship을 갱신합니다. 화면의 '동기화' 버튼으로도 즉시 실행됩니다.
//
// 필요한 환경변수:
//   MISSHIP_SHEET_CSV_URL - "오출고" 시트를 CSV로 내보낸 주소
//
// 시트 형식(1행 제목 "오출고", 2행 헤더, 3행부터 데이터):
//   A 접수시각 | B 점포 | C 제품명 | D 전산 | E 실입고 | F 미입고 | G 과입고 | H 정리 문장 | I 담당자
//   J 처리여부 | K 처리일 | (L 숨김) | M 처리 내용 | N 사유
//   -> H(정리 문장)는 쓰지 않습니다. 열 위치는 헤더 이름으로 찾고, 못 찾으면 위 기본 위치를 씁니다.
//   저장 행 형식: [접수시각, 매장, 제품명, 전산, 실입고, 미입고, 과입고, 담당자, 처리여부, 처리일, 처리내용, 사유]
//   (index.html의 MISSHIP_COLUMNS와 반드시 동일하게 유지)

const KV_TIMEOUT_MS = 8000;
const SHARED_KEY = 'lush_shared_file_data_v1';
const RETENTION_MONTHS = 18;

const MISSHIP_COLUMNS = [
  { label: '접수시각', names: ['접수시각'], fallback: 0 },
  { label: '매장', names: ['점포', '매장'], fallback: 1 },
  { label: '제품명', names: ['제품명'], fallback: 2 },
  { label: '전산', names: ['전산'], fallback: 3 },
  { label: '실입고', names: ['실입고'], fallback: 4 },
  { label: '미입고', names: ['미입고'], fallback: 5 },
  { label: '과입고', names: ['과입고'], fallback: 6 },
  { label: '담당자', names: ['담당자'], fallback: 8 },
  { label: '처리여부', names: ['처리여부'], fallback: 9 },
  { label: '처리일', names: ['처리일'], fallback: 10 },
  { label: '처리 내용', names: ['처리내용'], fallback: 12 },
  { label: '사유', names: ['사유'], fallback: 13 }
];

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => String(x || '').trim() !== ''));
}

const norm = s => String(s ?? '').replace(/\s+/g, '');

// "2026-09-30 14:29:28" / "2026. 9. 30 오후 2:29:28" 등 -> "2026-09-30 14:29:28" (시각이 없으면 날짜만)
function normDateTime(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\.?\s*(?:(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (!m) return s;
  const date = `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  if (m[5] === undefined) return date;
  let h = +m[5];
  const ampm = (m[4] || m[8] || '').toUpperCase();
  if ((ampm === '오후' || ampm === 'PM') && h < 12) h += 12;
  if ((ampm === '오전' || ampm === 'AM') && h === 12) h = 0;
  return `${date} ${String(h).padStart(2, '0')}:${m[6]}:${m[7] || '00'}`;
}

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function convert(values) {
  const headerIdx = values.findIndex(r => r.some(x => norm(x) === '접수시각'));
  const header = headerIdx >= 0 ? values[headerIdx].map(norm) : [];
  const idx = MISSHIP_COLUMNS.map(c => {
    const i = header.findIndex(h => c.names.some(n => h === norm(n)));
    return i >= 0 ? i : c.fallback;
  });
  const body = values.slice(headerIdx >= 0 ? headerIdx + 1 : 2);
  const rows = body
    .map(r => idx.map((i, k) => {
      const v = String(r[i] ?? '').trim();
      return k === 0 ? normDateTime(v) : v;
    }))
    .filter(r => /^\d{4}-\d{2}-\d{2}/.test(r[0]) && (r[1] || r[2]));
  return { rows, headerFound: headerIdx >= 0, columnIndex: idx };
}

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SHEET_URL = process.env.MISSHIP_SHEET_CSV_URL;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  // 아직 시트 주소를 등록하지 않은 상태는 오류가 아니라 '미설정'으로 알려서 동기화 버튼이 실패로 표시하지 않게 함
  if (!SHEET_URL) return res.status(200).json({ success: false, notConfigured: true, error: 'MISSHIP_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.' });

  try {
    const sheetRes = await fetchWithTimeout(SHEET_URL, {});
    if (!sheetRes.ok) throw new Error(`오출고 시트를 불러오지 못했습니다 (HTTP ${sheetRes.status}). 공유 설정을 확인해주세요.`);
    const values = parseCSV(await sheetRes.text());
    const { rows, headerFound, columnIndex } = convert(values);

    const getR = await fetchWithTimeout(`${KV_URL}/get/${SHARED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const getJ = await getR.json();
    let data = {};
    if (getJ && getJ.result) { try { data = JSON.parse(getJ.result) || {}; } catch { data = {}; } }

    const cutoff = shiftMonth(new Date().toISOString().slice(0, 7), -RETENTION_MONTHS);
    const recentRows = rows.filter(r => r[0].slice(0, 7) >= cutoff);
    data.misship = {
      header: MISSHIP_COLUMNS.map(c => c.label),
      rows: recentRows,
      updatedAt: new Date().toISOString(),
      sourceFile: '구글시트 자동연동',
      mode: '구글시트 자동연동 (매일 새벽 4시 30분)'
    };

    const setR = await fetchWithTimeout(`${KV_URL}/set/${SHARED_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!setR.ok) { const t = await setR.text(); throw new Error(`KV 저장 실패: ${t}`); }

    return res.status(200).json({
      success: true,
      시트_행수: values.length,
      헤더_인식: headerFound,
      열_위치: columnIndex,
      최종반영행수: rows.length,
      보관되는최근행수: recentRows.length,
      진단_변환후첫행: recentRows[0] || null,
      실행시각: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};
