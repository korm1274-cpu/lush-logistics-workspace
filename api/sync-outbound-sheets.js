// api/sync-outbound-sheets.js
// 매일 새벽 4시(KST), 구글시트(웹에 게시 CSV)에서 출고량/출고제외 수량을 읽어와
// 실제 출고수량(주문출고_수량 - 실제출고량)을 계산하고, EA환산·금액까지 반영한 뒤
// 팀 공유 저장소(Vercel KV)의 outbound / outboundMonthlySummary를 갱신합니다.
//
// 필요한 환경변수(Vercel 프로젝트 Settings → Environment Variables):
//   OUTBOUND_SHEET_CSV_URL          - "출고" 시트를 CSV로 내보낸 주소
//   OUTBOUND_EXCLUDE_SHEET_CSV_URL  - "출고 제외 수량" 시트를 CSV로 내보낸 주소
//
// 시트 형식(현재 샘플 기준):
//   출고 시트      : A 출고일자 | B 제품코드 | C 제품군 | D 제품명 | E 단위 | F 주문출고_수량
//   출고제외 시트  : A 출고일자 | B 제품코드 | ... | I 실제출고량  (A+B로 매칭해서 F에서 뺌)

const KV_TIMEOUT_MS = 8000;
const SHARED_KEY = 'lush_shared_file_data_v1';
const RETENTION_MONTHS = 18; // 원본 상세 데이터는 최근 18개월치만 보관 (그 이전은 요약만 남김, 클라이언트와 동일한 정책)

// 제품코드별 중량→EA 환산 계수 (index.html의 PRODUCT_EA_CONVERSION과 반드시 동일하게 유지해야 합니다)
const PRODUCT_EA_CONVERSION = {"T0017390":5,"T0017344":10,"T0017345":10,"T0017391":10,"T0015387":15,"T0015388":15,"T0015389":15,"T0017343":20,"T0012651":50,"T0011245":50,"T0013136":100,"T0004870":100,"T0000157":100,"T0000156":200,"T0002618":250,"T0015067":250,"T0000827":500,"T0000823":500,"T0015619":650,"T0017034":650,"T0017035":650,"T0017323":650,"T0018229":1100,"T0017030":1250,"T0016938":1500,"T0015446":1500,"T0016855":1500,"T0016849":1500,"T0016853":1500,"T0016851":1500,"T0017584":1500,"T0018237":1500,"T0016660":1500,"T0016659":1500,"T0017216":1500,"T0017217":1500,"T0017218":1500,"T0017211":1500,"T0017219":1500,"T0017205":1500,"T0013867":1500,"T0017220":1500,"T0017221":1500,"T0017877":1500,"T0017222":1500,"T0017441":1500,"T0017223":1500,"T0017324":1500,"T0014806":1550,"T0017413":1800,"T0016357":2000,"T0018231":2100,"T0017724":2600,"T0016471":2700,"T0016472":3000,"T0015839":3200,"T0017440":3200,"T0015445":3400,"T0017033":3400,"T0017032":3400,"T0017206":3400,"T0017208":3400,"T0017210":3400,"T0017214":3400,"T0017215":4200,"T0017325":4200,"T0017207":4500,"T0017213":5100,"T0018158":5800,"T0017212":6100,"T0017233":8500,"T0017234":8500,"T0017643":8500,"T0017646":8500,"T0017439":8500,"T0017645":8500,"T0017642":8500,"T0017641":8500,"T0017644":8500,"T0018801":1500,"T0018775":10,"T0017791":10,"T0019180":1400,"T0019314":2000};

function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// 쉼표로 구분된 값 안에 콤마·줄바꿈이 큰따옴표로 감싸져 있는 경우까지 처리하는 간단한 CSV 파서
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

// "2026-09-01" / "2026.09.01" / "9/1/2026" 등을 "YYYY-MM-DD"로 통일
function normDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
  if (m) return `${m[3]}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
  return s;
}
function ym(dateStr) { return String(dateStr || '').slice(0, 7); }
function num(v) { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function pct(cur, prev) {
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / Math.abs(prev);
}

function getPriceMap(priceList) {
  const map = {};
  if (!priceList || !Array.isArray(priceList.rows)) return map;
  const header = (priceList.header || []).map(h => String(h || '').trim());
  const norm = s => String(s || '').replace(/\s+/g, '');
  const find = (...labels) => {
    for (const lbl of labels) { const i = header.findIndex(h => norm(h) === norm(lbl)); if (i >= 0) return i; }
    for (const lbl of labels) { const i = header.findIndex(h => norm(h).includes(norm(lbl))); if (i >= 0) return i; }
    return -1;
  };
  const ci = find('제품코드', '코드', 'PLU'); const pi = find('단가');
  const codeIdx = ci >= 0 ? ci : 0, priceIdx = pi >= 0 ? pi : 10;
  priceList.rows.forEach(r => { const code = String(r[codeIdx] || '').trim(); if (code) map[code] = num(r[priceIdx]); });
  return map;
}

function computeMonthlySummary(rows, priceMap) {
  const map = {};
  rows.forEach(r => {
    const m = ym(r[0]); if (!m) return;
    if (!map[m]) map[m] = { skusG: new Set(), skusEA: new Set(), qtyG: 0, qtyEA: 0, qtyTotalEA: 0, amountEA: 0, amountG: 0 };
    const code = String(r[1] || '').trim();
    const unit = String(r[4] || '').trim().toUpperCase();
    const qty = num(r[5]);
    const price = priceMap[code] || 0;
    if (code && unit === 'G') map[m].skusG.add(code);
    if (code && unit === 'EA') map[m].skusEA.add(code);
    if (unit === 'G') {
      map[m].qtyG += qty;
      const factor = PRODUCT_EA_CONVERSION[code];
      if (factor) { const eaEquiv = qty / factor; map[m].qtyTotalEA += eaEquiv; map[m].amountG += eaEquiv * price; }
    } else if (unit === 'EA') {
      map[m].qtyEA += qty; map[m].qtyTotalEA += qty; map[m].amountEA += qty * price;
    }
  });
  const out = {};
  Object.entries(map).forEach(([m, v]) => {
    out[m] = { skuG: v.skusG.size, skuEA: v.skusEA.size, qtyG: v.qtyG, qtyEA: v.qtyEA, qtyTotalEA: v.qtyTotalEA, amountEA: v.amountEA, amountG: v.amountG };
  });
  return out;
}

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const OUT_URL = process.env.OUTBOUND_SHEET_CSV_URL;
  const EXC_URL = process.env.OUTBOUND_EXCLUDE_SHEET_CSV_URL;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  if (!OUT_URL || !EXC_URL) return res.status(500).json({ success: false, error: 'OUTBOUND_SHEET_CSV_URL / OUTBOUND_EXCLUDE_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.' });

  try {
    // 1) 구글시트 2개를 CSV로 받아옵니다.
    const [outRes, excRes] = await Promise.all([
      fetchWithTimeout(OUT_URL, {}),
      fetchWithTimeout(EXC_URL, {})
    ]);
    if (!outRes.ok) throw new Error(`출고 시트를 불러오지 못했습니다 (HTTP ${outRes.status}). 링크 공유 설정을 확인해주세요.`);
    if (!excRes.ok) throw new Error(`출고제외 시트를 불러오지 못했습니다 (HTTP ${excRes.status}). 링크 공유 설정을 확인해주세요.`);
    const outCsv = await outRes.text();
    const excCsv = await excRes.text();

    const outRows = parseCSV(outCsv).slice(1); // 헤더 제외
    const excRows = parseCSV(excCsv).slice(1);

    // 2) 출고제외 시트: (날짜, 제품코드)별 실제출고량(I열=index 8) 합계
    const excludeMap = {};
    excRows.forEach(r => {
      const date = normDate(r[0]); const code = String(r[1] || '').trim();
      if (!date || !code) return;
      const key = `${date}|${code}`;
      excludeMap[key] = (excludeMap[key] || 0) + num(r[8]);
    });

    // 3) 출고 시트: 주문출고_수량(F열=index 5)에서 제외 수량을 뺀 최종 수량으로 행을 만듭니다.
    let clampedCount = 0;
    const finalRows = outRows.map(r => {
      const date = normDate(r[0]); const code = String(r[1] || '').trim();
      const category = String(r[2] || '').trim(); const name = String(r[3] || '').trim();
      const unit = String(r[4] || '').trim(); const ordered = num(r[5]);
      const excluded = excludeMap[`${date}|${code}`] || 0;
      let finalQty = ordered - excluded;
      if (finalQty < 0) { finalQty = 0; clampedCount++; }
      return [date, code, category, name, unit, finalQty];
    }).filter(r => r[0]); // 날짜 없는 행 제외

    // 4) 팀 공유 저장소(KV)에서 현재 데이터를 읽어옵니다 (priceList, 기존 outboundMonthlySummary 등을 보존하기 위해).
    const getR = await fetchWithTimeout(`${KV_URL}/get/${SHARED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const getJ = await getR.json();
    let data = {};
    if (getJ && getJ.result) { try { data = JSON.parse(getJ.result) || {}; } catch { data = {}; } }

    const priceMap = getPriceMap(data.priceList);

    // 5) 이번에 받은 전체 출고 데이터를 기준으로 월별 요약을 새로 계산해, 기존 요약과 병합합니다.
    //    (오래된 달의 수동 입력 요약이나 이전 달 계산은 그대로 두고, 이번 시트가 다루는 달만 새로 덮어씁니다.)
    const freshSummary = computeMonthlySummary(finalRows, priceMap);
    data.outboundMonthlySummary = { ...(data.outboundMonthlySummary || {}), ...freshSummary };

    // 6) 원본 상세 행은 최근 18개월치만 보관합니다 (그 이전은 위 요약에만 남습니다).
    const cutoff = shiftMonth(new Date().toISOString().slice(0, 7), -RETENTION_MONTHS);
    const recentRows = finalRows.filter(r => ym(r[0]) >= cutoff);
    data.outbound = {
      header: ['출고일자', '제품코드', '제품군', '제품명', '단위', '수량'],
      rows: recentRows,
      updatedAt: new Date().toISOString(),
      sourceFile: '구글시트 자동연동',
      mode: '구글시트 자동연동 (매일 새벽 4시)'
    };

    // 7) 저장
    const setR = await fetchWithTimeout(`${KV_URL}/set/${SHARED_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!setR.ok) { const t = await setR.text(); throw new Error(`KV 저장 실패: ${t}`); }

    return res.status(200).json({
      success: true,
      출고시트_행수: outRows.length,
      출고제외시트_행수: excRows.length,
      최종반영행수: finalRows.length,
      보관되는최근행수: recentRows.length,
      제외수량_적용후_0으로_보정된_행수: clampedCount,
      갱신된월: Object.keys(freshSummary).sort(),
      실행시각: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};