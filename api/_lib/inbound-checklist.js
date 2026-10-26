// 입고 · 월별 입고현황 · 입고 상세조회 데이터를 '입고리스트 샘플'(수입팀 상품 입고 체크리스트)로 만듦
//   - 입고 행: [입고일자(실시간 입고 예정일), 차수(예: 142차), 팔렛수(체크리스트 Pallet 수), 제품코드, 제품군, 제품명, 단위(EA/G), 수량(분배 TOTAL)]
//     제품코드·제품군·단위는 PLU 담당자 정보(제품 마스터)에서 PLU로 찾음(없으면 제품코드 빈칸 · 단위 EA)
//   - 팀 공유 데이터(lush_shared_file_data_v1)의 inbound / inboundMonthlySummary를 갱신
//     체크리스트가 있는 달만 교체하고, 체크리스트가 없는 달의 기존 실적(예전 입고량 시트)은 그대로 보존
//   - 호출: api/sync-inbound-sheets.js(새벽 자동·동기화 버튼), api/team-data.js(체크리스트가 반영·삭제될 때)
const SHARED_KEY = 'lush_shared_file_data_v1';
const CHECKLIST_KEY = 'lush_checklists_v1';
const PLU_KEY = 'lush_plu_master_v1';
const RETENTION_MONTHS = 18;

// index.html의 PRODUCT_EA_CONVERSION과 반드시 동일하게 유지
const PRODUCT_EA_CONVERSION = {"T0017390":5,"T0017344":10,"T0017345":10,"T0017391":10,"T0015387":15,"T0015388":15,"T0015389":15,"T0017343":20,"T0012651":50,"T0011245":50,"T0013136":100,"T0004870":100,"T0000157":100,"T0000156":200,"T0002618":250,"T0015067":250,"T0000827":500,"T0000823":500,"T0015619":650,"T0017034":650,"T0017035":650,"T0017323":650,"T0018229":1100,"T0017030":1250,"T0016938":1500,"T0015446":1500,"T0016855":1500,"T0016849":1500,"T0016853":1500,"T0016851":1500,"T0017584":1500,"T0018237":1500,"T0016660":1500,"T0016659":1500,"T0017216":1500,"T0017217":1500,"T0017218":1500,"T0017211":1500,"T0017219":1500,"T0017205":1500,"T0013867":1500,"T0017220":1500,"T0017221":1500,"T0017877":1500,"T0017222":1500,"T0017441":1500,"T0017223":1500,"T0017324":1500,"T0014806":1550,"T0017413":1800,"T0016357":2000,"T0018231":2100,"T0017724":2600,"T0016471":2700,"T0016472":3000,"T0015839":3200,"T0017440":3200,"T0015445":3400,"T0017033":3400,"T0017032":3400,"T0017206":3400,"T0017208":3400,"T0017210":3400,"T0017214":3400,"T0017215":4200,"T0017325":4200,"T0017207":4500,"T0017213":5100,"T0018158":5800,"T0017212":6100,"T0017233":8500,"T0017234":8500,"T0017643":8500,"T0017646":8500,"T0017439":8500,"T0017645":8500,"T0017642":8500,"T0017641":8500,"T0017644":8500,"T0018801":1500,"T0018775":10,"T0017791":10,"T0019180":1400,"T0019314":2000,"T0019381":6000,"T0019379":4500,"T0019382":1650};

function ym(dateStr) { return String(dateStr || '').slice(0, 7); }
function num(v) { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function shiftMonth(m, delta) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

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


// 체크리스트 전체 → 입고 행
function rowsFromChecklists(batches, master) {
  const map = (master && master.map) || {};
  const out = [];
  batches.forEach(b => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.eta || ''))) return; // 입고일(실시간 입고 예정일)이 날짜가 아니면 제외
    const pallets = num(String((b.info && b.info.pallets) || '').replace(/[^\d.]/g, ''));
    const batch = String(b.batchNo || '') + '차';
    (b.rows || []).forEach(r => {
      const m = (map[r.plu] || [])[0] || [];
      const unit = String(m[4] || '').trim().toUpperCase() === 'G' ? 'G' : 'EA';
      out.push([b.eta, batch, pallets, String(m[0] || ''), String(m[3] || ''), String(r.name || ''), unit, num(r.qty)]);
    });
  });
  return out;
}

async function rebuild(store) {
  const arr = await store.cmd(['HGETALL', CHECKLIST_KEY]) || [];
  const batches = [];
  for (let i = 0; i < arr.length; i += 2) { try { batches.push(JSON.parse(arr[i + 1])); } catch (e) { /* 무시 */ } }
  let master = null; try { master = JSON.parse(await store.cmd(['GET', PLU_KEY]) || 'null'); } catch (e) { master = null; }
  let data = {}; try { data = JSON.parse(await store.cmd(['GET', SHARED_KEY]) || '{}') || {}; } catch (e) { data = {}; }
  // 체크리스트에서 만든 행은 9번째 칸에 'ck' 표시(화면은 8칸만 씀)
  const fresh = rowsFromChecklists(batches, master).map(r => r.concat('ck'));
  const etas = fresh.map(r => r[0]).sort();
  const first = etas[0] || '';
  // 체크리스트가 있는 달만 교체: 그 달의 기존 행(예전 입고량 시트 실적)은 체크리스트 행으로 바꾸고,
  // 체크리스트가 없는 달의 기존 실적은 그대로 보존. 예전에 체크리스트로 만든 행('ck')은 항상 새로 만듦
  const old = (data.inbound && Array.isArray(data.inbound.rows)) ? data.inbound.rows : [];
  const months = new Set(fresh.map(r => ym(r[0])));
  const touched = new Set(months);
  old.forEach(r => { if (r && r[8] === 'ck') touched.add(ym(r[0])); });
  const kept = old.filter(r => r && r[8] !== 'ck' && !months.has(ym(r[0])));
  const cutoff = shiftMonth(new Date().toISOString().slice(0, 7), -RETENTION_MONTHS);
  const rows = kept.concat(fresh).filter(r => ym(r[0]) >= cutoff).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  const priceMap = getPriceMap(data.priceList);
  // 월별 요약: 바뀐 달(체크리스트가 있는 달 + 예전에 체크리스트 행이 있던 달)만 다시 계산, 나머지는 그대로
  const summary = computeMonthlySummary(rows.filter(r => touched.has(ym(r[0]))), priceMap);
  const merged = Object.assign({}, data.inboundMonthlySummary || {});
  touched.forEach(m => { delete merged[m]; });
  Object.assign(merged, summary);
  data.inboundMonthlySummary = merged;
  data.inbound = {
    header: ['입고일자', '차수', '팔렛수', '제품코드', '제품군', '제품명', '단위', '수량'],
    rows,
    updatedAt: new Date().toISOString(),
    sourceFile: '입고리스트(수입팀 체크리스트)',
    mode: '입고리스트(수입팀 체크리스트) 자동 반영 — 실시간 입고 예정일 기준'
  };
  await store.cmd(['SET', SHARED_KEY, JSON.stringify(data)]);
  return { batches: batches.length, rows: fresh.length, kept: kept.length, first, noCode: fresh.filter(r => !r[3]).length };
}

module.exports = { rebuild, rowsFromChecklists, computeMonthlySummary, getPriceMap };
