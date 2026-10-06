// api/sync-damage-sheet.js
// 매일 새벽 4시 40분(KST), "입고 파손" 구글시트(웹에 게시 CSV)를 읽어와
// 팀 공유 저장소(Vercel KV)의 damage를 갱신합니다. 화면의 '동기화' 버튼으로도 즉시 실행됩니다.
//
// 필요한 환경변수:
//   DAMAGE_SHEET_CSV_URL - "입고 파손" 시트를 CSV로 내보낸 주소
//
// 시트 형식: 1행 제목("입고 파손"), 2~3행 헤더(3행은 합계), 4행부터 데이터.
//   No. | 기안 작성 일자 | 매장명 | 출고 방식 | 제품명 | 단가 | 출고 수량 | 출고 합계 | 파손 수량 | 파손 합계 | 출고 대비 % | 제품군 | 담당자
//   -> 단가·출고 수량·출고 합계·출고 대비 %는 쓰지 않습니다. 열 위치는 헤더 이름으로 찾습니다(중간 열을 지워도 동작).
//   No.·일자·매장명·출고 방식은 여러 품목에 걸쳐 병합되어 있어, CSV에서는 첫 줄에만 값이 있으므로 아래 줄에 채워 넣습니다.
//   저장 행 형식(index.html 파손 분석과 동일):
//   [No, 기안 작성 일자, 매장명, 출고 방식, 제품명, (미사용), 파손 수량, 파손 합계, 제품군, 담당자]

const KV_TIMEOUT_MS = 8000;
const SHARED_KEY = 'lush_shared_file_data_v1';
const RETENTION_MONTHS = 18;

// out: 저장 행에서의 위치, fallback: D·E열을 지운 뒤의 시트 기준 위치
const DAMAGE_COLUMNS = [
  { out: 0, names: ['No.', 'No', '번호'], fallback: 0 },
  { out: 1, names: ['기안작성일자', '작성일자', '일자'], fallback: 1 },
  { out: 2, names: ['매장명', '매장'], fallback: 2 },
  { out: 3, names: ['출고방식'], fallback: 3 },
  { out: 4, names: ['제품명'], fallback: 4 },
  { out: 6, names: ['파손수량'], fallback: 8 },
  { out: 7, names: ['파손합계', '파손금액'], fallback: 9 },
  { out: 8, names: ['제품군'], fallback: 11 },
  { out: 9, names: ['담당자'], fallback: 12 }
];
const MERGED_OUT = [0, 1, 2, 3]; // 병합 셀: 비어 있으면 위 품목의 값을 이어받음
const HEADER = ['No.', '기안 작성 일자', '매장명', '출고 방식', '제품명', '', '파손 수량', '파손 합계', '제품군', '담당자'];

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// 구글 '웹에 게시' CSV가 캐시된 예전 내용을 주지 않도록 매번 다른 주소로 요청
function noCache(url) {
  return url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
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
const num = v => { const n = parseFloat(String(v ?? '').replace(/[,원\s]/g, '')); return isNaN(n) ? 0 : n; };

function normDate(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
  return m ? `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}` : '';
}

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function convert(values) {
  const headerIdx = values.findIndex(r => r.some(x => norm(x) === '기안작성일자') || (r.some(x => norm(x) === '매장명') && r.some(x => norm(x) === '제품명')));
  const header = headerIdx >= 0 ? values[headerIdx].map(norm) : [];
  const idx = DAMAGE_COLUMNS.map(c => {
    const i = header.findIndex(h => c.names.some(n => h === norm(n)));
    return i >= 0 ? i : c.fallback;
  });
  const out = [];
  let last = null;
  values.slice(headerIdx >= 0 ? headerIdx + 1 : 3).forEach(r => {
    const row = ['', '', '', '', '', '', 0, 0, '', ''];
    DAMAGE_COLUMNS.forEach((c, k) => { row[c.out] = String(r[idx[k]] ?? '').trim(); });
    if (!row[4]) return; // 제품명이 없는 줄(합계 줄 등)은 건너뜀
    if (last) MERGED_OUT.forEach(o => { if (!row[o]) row[o] = last[o]; });
    row[1] = normDate(row[1]);
    if (!row[1]) return;
    row[6] = num(row[6]);
    row[7] = num(row[7]);
    out.push(row);
    last = row;
  });
  return { rows: out, headerFound: headerIdx >= 0, columnIndex: idx };
}

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SHEET_URL = process.env.DAMAGE_SHEET_CSV_URL;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  // 시트 주소를 아직 등록하지 않았으면 '미설정'으로 알려서 동기화 버튼이 실패로 표시하지 않게 함
  if (!SHEET_URL) return res.status(200).json({ success: false, notConfigured: true, error: 'DAMAGE_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.' });

  try {
    const sheetRes = await fetchWithTimeout(noCache(SHEET_URL), { cache: 'no-store' });
    if (!sheetRes.ok) throw new Error(`파손 시트를 불러오지 못했습니다 (HTTP ${sheetRes.status}). 공유 설정을 확인해주세요.`);
    const values = parseCSV(await sheetRes.text());
    const { rows, headerFound, columnIndex } = convert(values);

    const getR = await fetchWithTimeout(`${KV_URL}/get/${SHARED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const getJ = await getR.json();
    let data = {};
    if (getJ && getJ.result) { try { data = JSON.parse(getJ.result) || {}; } catch { data = {}; } }

    const cutoff = shiftMonth(new Date().toISOString().slice(0, 7), -RETENTION_MONTHS);
    const recentRows = rows.filter(r => r[1].slice(0, 7) >= cutoff);
    data.damage = {
      header: HEADER,
      rows: recentRows,
      updatedAt: new Date().toISOString(),
      sourceFile: '구글시트 자동연동',
      mode: '구글시트 자동연동 (매일 새벽 4시 40분)'
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
