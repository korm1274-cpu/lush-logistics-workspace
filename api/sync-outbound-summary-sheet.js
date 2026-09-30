// api/sync-outbound-summary-sheet.js
// 매일 새벽 4시(KST), "출고 요약" 구글시트(웹에 게시 CSV)에서 월별 SKU수·출고량을 읽어와
// outboundMonthlySummary를 채웁니다. 원본 출고 데이터(출고 시트 동기화)가 이미 계산해둔 달은
// 그쪽이 더 정확하므로 건드리지 않고, 원본이 없는 과거 달만 이 시트 값으로 채웁니다.
//
// 필요한 환경변수:
//   OUTBOUND_SUMMARY_SHEET_CSV_URL - "출고 요약" 시트를 CSV로 내보낸 주소
//
// 시트 형식(1~4행은 제목/2줄 헤더/평균 행이라 건너뛰고, 5행부터 데이터):
//   A 월(예: "2024.07월") | B SKU EA | C SKU G | D SKU 합계
//   E 출고량 EA | F 출고량 G(g) | G 출고량 합계(EA전환)
//   H~N 금액·증감률 칸은 이제 화면에서 안 쓰므로 무시합니다.

const KV_TIMEOUT_MS = 8000;
const SHARED_KEY = 'lush_shared_file_data_v1';

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
  return rows;
}

function num(v) {
  const s = String(v ?? '').trim().replace(/,/g, '');
  if (!s || s === '-') return null; // "-"는 아직 값이 없는 달(빈 자리)
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// "2024.07월" -> "2024-07"
function normMonthLabel(v) {
  const s = String(v || '').trim();
  const m = s.match(/(\d{4})[.\-\/년]?\s*(\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
}
function ym(dateStr) { return String(dateStr || '').slice(0, 7); }

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SUMMARY_URL = process.env.OUTBOUND_SUMMARY_SHEET_CSV_URL;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  if (!SUMMARY_URL) return res.status(500).json({ success: false, error: 'OUTBOUND_SUMMARY_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.' });

  try {
    const sumRes = await fetchWithTimeout(SUMMARY_URL, {});
    if (!sumRes.ok) throw new Error(`요약 시트를 불러오지 못했습니다 (HTTP ${sumRes.status}). 공유 설정을 확인해주세요.`);
    const csv = await sumRes.text();
    const allRows = parseCSV(csv);
    const dataRows = allRows.slice(4); // 1~4행(제목/2줄 헤더/평균) 건너뛰기

    // 팀 공유 저장소에서 현재 데이터를 읽어옵니다 (원본 출고 데이터가 이미 있는 달은 건드리지 않기 위해).
    const getR = await fetchWithTimeout(`${KV_URL}/get/${SHARED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const getJ = await getR.json();
    let data = {};
    if (getJ && getJ.result) { try { data = JSON.parse(getJ.result) || {}; } catch { data = {}; } }

    const rawMonths = new Set((data.outbound?.rows || []).map(r => ym(r[0])).filter(Boolean));
    const summary = data.outboundMonthlySummary || {};

    let applied = 0, skippedHasRaw = 0, skippedEmpty = 0;
    dataRows.forEach(r => {
      const m = normMonthLabel(r[0]);
      if (!m) return;
      if (rawMonths.has(m)) { skippedHasRaw++; return; } // 원본 데이터가 이미 있는 달은 그쪽이 우선

      const skuEA = num(r[1]), skuG = num(r[2]);
      const qtyEA = num(r[4]), qtyG = num(r[5]), qtyTotal = num(r[6]);
      if (skuEA === null && skuG === null && qtyEA === null && qtyG === null) { skippedEmpty++; return; } // "-"만 있는 빈 달

      summary[m] = {
        skuG: skuG || 0,
        skuEA: skuEA || 0,
        qtyG: qtyG || 0,
        qtyEA: qtyEA || 0,
        qtyTotalEA: qtyTotal !== null ? qtyTotal : (qtyEA || 0) + (qtyG || 0),
        amountEA: 0,
        amountG: 0
      };
      applied++;
    });

    data.outboundMonthlySummary = summary;

    const setR = await fetchWithTimeout(`${KV_URL}/set/${SHARED_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!setR.ok) { const t = await setR.text(); throw new Error(`KV 저장 실패: ${t}`); }

    return res.status(200).json({
      success: true,
      시트_전체행수: dataRows.length,
      반영된달: applied,
      원본데이터있어건너뛴달: skippedHasRaw,
      빈값이라건너뛴달: skippedEmpty,
      실행시각: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};