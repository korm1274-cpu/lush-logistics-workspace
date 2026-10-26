// api/sync-inbound-sheets.js
// 입고 · 월별 입고현황 · 입고 상세조회 데이터 갱신 (매일 새벽 4시 KST 자동 + 화면 '동기화' 버튼)
// 예전에는 "입고량" 구글시트(INBOUND_SHEET_CSV_URL)를 읽었지만, 이제는 '입고리스트 샘플'(수입팀 상품 입고 체크리스트,
// 구글 드라이브 자동 반영)로 만듭니다 → api/_lib/inbound-checklist.js
//   입고 행: [입고일자(실시간 입고 예정일), 차수, 팔렛수(Pallet 수), 제품코드, 제품군, 제품명, 단위, 수량]
//   체크리스트가 있는 달만 교체, 체크리스트가 없는 달의 기존 실적은 그대로 보존
// 체크리스트가 반영·삭제될 때도(api/team-data.js) 같은 갱신이 자동으로 돌기 때문에, 이 주소는 확인·보정용입니다.

module.exports = async (req, res) => {
  if (!(await require('./_lib/auth').guard(req, res, { allowCron: true, write: true }))) return;
  try {
    const store = require('./_lib/auth').kv();
    const r = await require('./_lib/inbound-checklist').rebuild(store);
    return res.status(200).json({
      success: true,
      source: '입고리스트 샘플(체크리스트)',
      차수: r.batches,
      최종반영행수: r.rows,
      보존한_이전행수: r.kept,
      체크리스트_시작일: r.first,
      제품코드_없음: r.noCode,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: String((e && e.message) || e) });
  }
};
