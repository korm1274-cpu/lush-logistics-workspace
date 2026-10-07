// api/sync-inbound-sheets.js
// 매일 새벽 4시(KST), "입고량" 구글시트(웹에 게시 CSV)를 읽어와
// EA환산·차수별 팔렛수까지 반영한 뒤 팀 공유 저장소(Vercel KV)의
// inbound / inboundMonthlySummary를 갱신합니다.
//
// 필요한 환경변수:
//   INBOUND_SHEET_CSV_URL - "입고량" 시트를 CSV로 내보낸 주소
//
// 시트 형식(현재 샘플 기준, 헤더 1행 + 2행부터 데이터):
//   A 입고 일자 | B 차수 | C 팔렛(예: "4팔렛") | D 제품코드 | E 제품군 | F 제품명(영문) | G 한글명 | H 단위 | I 입고_수량
//   -> 화면에는 영문 제품명(F)을 씁니다.
//   같은 차수(B열)의 팔렛수(C열)는 여러 행에 똑같이 반복 기재되어 있으므로,
//   월별 합산 팔렛수는 "차수당 한 번만" 더합니다 (행 개수만큼 중복으로 더하면 안 됨).

const KV_TIMEOUT_MS = 8000;
const SHARED_KEY = 'lush_shared_file_data_v1';
const RETENTION_MONTHS = 18;

// index.html의 PRODUCT_EA_CONVERSION과 반드시 동일하게 유지
const PRODUCT_EA_CONVERSION = {"T0017390":5,"T0017344":10,"T0017345":10,"T0017391":10,"T0015387":15,"T0015388":15,"T0015389":15,"T0017343":20,"T0012651":50,"T0011245":50,"T0013136":100,"T0004870":100,"T0000157":100,"T0000156":200,"T0002618":250,"T0015067":250,"T0000827":500,"T0000823":500,"T0015619":650,"T0017034":650,"T0017035":650,"T0017323":650,"T0018229":1100,"T0017030":1250,"T0016938":1500,"T0015446":1500,"T0016855":1500,"T0016849":1500,"T0016853":1500,"T0016851":1500,"T0017584":1500,"T0018237":1500,"T0016660":1500,"T0016659":1500,"T0017216":1500,"T0017217":1500,"T0017218":1500,"T0017211":1500,"T0017219":1500,"T0017205":1500,"T0013867":1500,"T0017220":1500,"T0017221":1500,"T0017877":1500,"T0017222":1500,"T0017441":1500,"T0017223":1500,"T0017324":1500,"T0014806":1550,"T0017413":1800,"T0016357":2000,"T0018231":2100,"T0017724":2600,"T0016471":2700,"T0016472":3000,"T0015839":3200,"T0017440":3200,"T0015445":3400,"T0017033":3400,"T0017032":3400,"T0017206":3400,"T0017208":3400,"T0017210":3400,"T0017214":3400,"T0017215":4200,"T0017325":4200,"T0017207":4500,"T0017213":5100,"T0018158":5800,"T0017212":6100,"T0017233":8500,"T0017234":8500,"T0017643":8500,"T0017646":8500,"T0017439":8500,"T0017645":8500,"T0017642":8500,"T0017641":8500,"T0017644":8500,"T0018801":1500,"T0018775":10,"T0017791":10,"T0019180":1400,"T0019314":2000};

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
// "4팔렛" / "245 팔렛" 등에서 숫자만 추출
function numPallet(v) { const m = String(v ?? '').match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; }
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

// rows: [날짜, 차수, 팔렛수, 코드, 제품군, 제품명, 단위, 수량]
function computeMonthlySummary(rows, priceMap) {
  const map = {};
  rows.forEach(r => {
    const m = ym(r[0]); if (!m) return;
    if (!map[m]) map[m] = { batches: new Set(), batchPallets: new Map(), skusG: new Set(), skusEA: new Set(), qtyG: 0, qtyEA: 0, qtyTotalEA: 0, amountEA: 0, amountG: 0 };
    if (r[1]) { map[m].batches.add(String(r[1])); if (r[2] !== '' && r[2] != null) map[m].batchPallets.set(String(r[1]), num(r[2])); }
    const code = String(r[3] || '').trim();
    const unit = String(r[6] || '').trim().toUpperCase();
    const qty = num(r[7]);
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
    let pallets = 0; v.batchPallets.forEach(p => pallets += p);
    out[m] = { batches: v.batches.size, pallets, skuG: v.skusG.size, skuEA: v.skusEA.size, qtyG: v.qtyG, qtyEA: v.qtyEA, qtyTotalEA: v.qtyTotalEA, amountEA: v.amountEA, amountG: v.amountG };
  });
  return out;
}

module.exports = async (req, res) => {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const IN_URL = process.env.INBOUND_SHEET_CSV_URL;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ success: false, error: 'KV 환경변수가 설정되지 않았습니다.' });
  if (!IN_URL) return res.status(500).json({ success: false, error: 'INBOUND_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.' });

  try {
    const inRes = await fetchWithTimeout(noCache(IN_URL), { cache: 'no-store' });
    if (!inRes.ok) throw new Error(`입고 시트를 불러오지 못했습니다 (HTTP ${inRes.status}). 공유 설정을 확인해주세요.`);
    const csv = await inRes.text();
    const csvRows = parseCSV(csv).slice(1); // 헤더 제외

    // A일자 B차수 C팔렛 D코드 E제품군 F제품명(영문) G한글명 H단위 I수량
    const finalRows = csvRows.map(r => {
      const date = normDate(r[0]);
      const batch = String(r[1] || '').trim();
      const pallet = numPallet(r[2]);
      const code = String(r[3] || '').trim();
      const category = String(r[4] || '').trim();
      const name = String(r[5] || '').trim(); // 영문 제품명
      const unit = String(r[7] || '').trim();
      const qty = num(r[8]);
      return [date, batch, pallet, code, category, name, unit, qty];
    }).filter(r => r[0]);

    const getR = await fetchWithTimeout(`${KV_URL}/get/${SHARED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const getJ = await getR.json();
    let data = {};
    if (getJ && getJ.result) { try { data = JSON.parse(getJ.result) || {}; } catch { data = {}; } }

    const priceMap = getPriceMap(data.priceList);

    const cutoff = shiftMonth(new Date().toISOString().slice(0, 7), -RETENTION_MONTHS);
    // 시트에는 최근 며칠치만 남기고 나머지는 보관함 시트로 옮기므로(apps-script/archive-old-months.gs),
    // '시트에 있는 날짜'만 새 내용으로 바꾸고, 시트에 없는 날짜는 이미 저장된 행을 그대로 둡니다.
    const sheetDates = new Set(finalRows.map(r => r[0]));
    const keptRows = ((data.inbound && Array.isArray(data.inbound.rows)) ? data.inbound.rows : []).filter(r => r && !sheetDates.has(r[0]));
    const recentRows = keptRows.concat(finalRows).filter(r => ym(r[0]) >= cutoff).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    // 월별 요약은 합친 결과로, 시트에 날짜가 있는 달만 다시 계산
    const sheetMonths = new Set(finalRows.map(r => ym(r[0])));
    const freshSummary = computeMonthlySummary(recentRows.filter(r => sheetMonths.has(ym(r[0]))), priceMap);
    data.inboundMonthlySummary = { ...(data.inboundMonthlySummary || {}), ...freshSummary };
    data.inbound = {
      header: ['입고일자', '차수', '팔렛수', '제품코드', '제품군', '제품명', '단위', '수량'],
      rows: recentRows,
      updatedAt: new Date().toISOString(),
      sourceFile: '구글시트 자동연동',
      mode: '구글시트 자동연동 (매일 새벽 4시)'
    };

    const setR = await fetchWithTimeout(`${KV_URL}/set/${SHARED_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!setR.ok) { const t = await setR.text(); throw new Error(`KV 저장 실패: ${t}`); }

    return res.status(200).json({
      success: true,
      입고시트_행수: csvRows.length,
      최종반영행수: finalRows.length,
      보관되는최근행수: recentRows.length,
      갱신된월: Object.keys(freshSummary).sort(),
      진단_원본첫행: csvRows[0] || null,
      진단_변환후첫행_날짜_차수_팔렛_코드_제품군_제품명_단위_수량: finalRows[0] || null,
      실행시각: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
};