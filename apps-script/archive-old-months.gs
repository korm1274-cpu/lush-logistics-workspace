/**
 * 지난 행을 보관함 시트로 자동 이동 (출고 · 출고 제외 · 입고 파일에 각각 설치)
 *
 * 하는 일
 *  - 아래 SHEETS에 적은 시트에서, 날짜(A열)가 '오늘로부터 7일 전' 이전인 행을 찾아
 *    같은 파일 안의 '시트이름_보관함' 시트로 옮기고 원본에서는 지웁니다.
 *  - 보관함 시트가 없으면 원본과 같은 머리글로 새로 만듭니다.
 *  - 실행 결과는 '보관함_기록' 시트에 남깁니다.
 *
 * 보관 기준 (KEEP_DAYS = 7)
 *  - 오늘 날짜에서 7일을 뺀 날까지(그날 포함) 옮깁니다.
 *    예) 10/7 실행 → 9/30 이전 행 모두 이동, 10/1~10/7은 원본에 남김
 *
 * 웹앱(LUSH Logistics Workspace)과의 관계
 *  - 웹앱은 매일 새벽 4시(또는 '동기화' 버튼)에 '웹에 게시'된 원본 시트만 읽습니다. 보관함은 게시하지 마세요.
 *  - 원본에서 사라진 날짜의 데이터는 웹앱 서버에 이미 저장된 내용이 그대로 유지됩니다(최근 18개월).
 *  - 그래서 '웹앱이 한 번도 읽지 않은 행'을 바로 옮기면 웹앱에는 들어가지 않습니다.
 *    지난 데이터(예: 7월)를 새로 붙여 넣었다면 → 웹앱에서 '동기화'를 먼저 누른 뒤 → archiveOldRows 실행.
 *  - 보관함으로 옮긴 뒤에 그 행을 고쳐도 웹앱에는 반영되지 않습니다.
 *
 * 설치 방법 (파일마다 한 번)
 *  1) 구글시트 → 확장 프로그램 → Apps Script → 이 코드를 붙여 넣고 아래 SHEETS의 탭 이름을 맞춘 뒤 저장
 *  2) 함수 선택에서 previewArchive 실행 → 권한 허용 → '보관함_기록'에 옮길 줄 수만 기록됨(실제 이동 없음)
 *  3) 결과가 맞으면 installDailyTrigger 실행 → 매일 새벽 1시대에 자동 실행
 *     (바로 한 번 옮기려면 archiveOldRows 실행)
 *
 * 출고와 출고 제외는 같은 기준(KEEP_DAYS)으로, 같은 날 옮겨야 합니다(웹앱이 둘을 날짜·제품코드로 맞춰 계산).
 */

// ─── 설정 ───────────────────────────────────────────────
// 원본 시트 탭 이름을 실제 이름에 맞게 고쳐 주세요. (dateCol: 날짜가 있는 열, A열=1 / headerRows: 머리글 줄 수)
//  - 출고량 파일:         [ { name: '출고',      dateCol: 1, headerRows: 1 } ]
//  - 출고 제외 수량 파일: [ { name: '출고 제외', dateCol: 1, headerRows: 1 } ]
//  - 입고량 파일:         [ { name: '입고',      dateCol: 1, headerRows: 1 } ]
var SHEETS = [
  { name: '출고', dateCol: 1, headerRows: 1 }
];
var KEEP_DAYS = 7;                 // 오늘 - 7일 (그날 포함) 이전 행을 옮김
var ARCHIVE_SUFFIX = '_보관함';     // 보관함 시트 이름 = 원본 이름 + 이 글자
var LOG_SHEET = '보관함_기록';
var TIMEZONE = 'Asia/Seoul';
// ────────────────────────────────────────────────────────

/** 실제로 옮기기 (트리거가 매일 실행하는 함수, 직접 실행해도 됨) */
function archiveOldRows() { run_(false); }

/** 미리보기: 옮길 줄 수만 기록하고 실제로는 옮기지 않음 */
function previewArchive() { run_(true); }

/** 매일 새벽 1시대에 자동 실행되도록 등록 (같은 함수의 예전 트리거는 지우고 다시 만듦) */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'archiveOldRows') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archiveOldRows').timeBased().everyDays(1).atHour(1).inTimezone(TIMEZONE).create();
  log_('트리거', '매일 01시 자동 실행 등록', '', '');
}

function run_(dryRun) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { log_('건너뜀', '다른 실행이 진행 중', '', ''); return; }
  try {
    var cutoff = cutoffDate_(); // 이 날짜(YYYY-MM-DD)까지(포함) 옮김
    var ss = SpreadsheetApp.getActive();
    SHEETS.forEach(function (cfg) {
      var sh = ss.getSheetByName(cfg.name);
      if (!sh) { log_(cfg.name, '시트를 찾을 수 없음 — SHEETS의 이름을 확인하세요', '', cutoff); return; }
      var result = archiveSheet_(ss, sh, cfg, cutoff, dryRun);
      log_(cfg.name, dryRun ? '미리보기' : '이동', result, cutoff);
    });
  } finally {
    lock.releaseLock();
  }
}

function archiveSheet_(ss, sh, cfg, cutoff, dryRun) {
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var first = cfg.headerRows + 1;
  if (lastRow < first) return '옮길 행 없음';
  var range = sh.getRange(first, 1, lastRow - cfg.headerRows, lastCol);
  var values = range.getValues();

  var oldIdx = [];
  values.forEach(function (row, i) {
    var d = dateOf_(row[cfg.dateCol - 1]);
    if (d && d <= cutoff) oldIdx.push(i);
  });
  if (!oldIdx.length) return '옮길 행 없음';
  if (dryRun) return oldIdx.length + '줄 이동 예정';

  // 데이터 전체를 수식(IMPORTRANGE·QUERY 등)으로 불러오는 시트는 행을 지우면 안 되므로 멈춤
  var formulas = range.getFormulas();
  if (/^=\s*(ARRAYFORMULA|IMPORTRANGE|QUERY|FILTER|SORT|UNIQUE|\{)/i.test(formulas[0][0] || '')) {
    return '중단: 이 시트는 수식(IMPORTRANGE·QUERY 등)으로 데이터를 불러오고 있어 옮길 수 없습니다';
  }
  var hasFormulas = formulas.some(function (r) { return r.some(function (f) { return f; }); });

  // 1) 보관함에 먼저 추가 (실패하면 원본은 그대로 남음). 수식이 있는 칸은 계산된 값으로 저장
  var archive = ensureArchive_(ss, sh, cfg, lastCol);
  var oldRows = oldIdx.map(function (i) { return values[i]; });
  archive.getRange(archive.getLastRow() + 1, 1, oldRows.length, lastCol).setValues(oldRows);
  SpreadsheetApp.flush();

  // 2) 원본에서 지우기 — 날짜 순서가 섞여 있어도 해당 행만 지움
  //    연속된 행끼리 묶어 아래쪽부터 행 삭제(수식·서식은 남은 행에 그대로 유지).
  //    수식이 없고 흩어진 묶음이 아주 많으면, 남길 행만 다시 써서 빠르게 처리.
  var runs = [], start = oldIdx[0], prev = oldIdx[0];
  for (var k = 1; k < oldIdx.length; k++) {
    if (oldIdx[k] === prev + 1) { prev = oldIdx[k]; continue; }
    runs.push([start, prev]); start = prev = oldIdx[k];
  }
  runs.push([start, prev]);
  if (!hasFormulas && runs.length > 200) {
    var oldSet = {}; oldIdx.forEach(function (i) { oldSet[i] = true; });
    var keep = values.filter(function (row, i) { return !oldSet[i]; });
    range.clearContent();
    if (keep.length) sh.getRange(first, 1, keep.length, lastCol).setValues(keep);
  } else {
    for (var r = runs.length - 1; r >= 0; r--) sh.deleteRows(first + runs[r][0], runs[r][1] - runs[r][0] + 1);
  }
  return oldIdx.length + '줄 이동';
}

function ensureArchive_(ss, sh, cfg, lastCol) {
  var name = cfg.name + ARCHIVE_SUFFIX;
  var archive = ss.getSheetByName(name);
  if (!archive) {
    archive = ss.insertSheet(name);
    if (cfg.headerRows > 0) {
      var header = sh.getRange(1, 1, cfg.headerRows, lastCol).getValues();
      archive.getRange(1, 1, cfg.headerRows, lastCol).setValues(header);
      archive.setFrozenRows(cfg.headerRows);
    }
  }
  return archive;
}

/** 오늘(한국 시간)에서 KEEP_DAYS일을 뺀 날짜 'YYYY-MM-DD' — 이 날짜까지(포함) 옮김 */
function cutoffDate_() {
  var today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  var p = today.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) - KEEP_DAYS));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

/** 셀 값(날짜 또는 '2026-10-01', '2026. 10. 1', '2026/10/1 14:00' 같은 글자)을 'YYYY-MM-DD'로 */
function dateOf_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  var mm = Number(m[2]), dd = Number(m[3]);
  return m[1] + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
}

function log_(sheetName, action, result, cutoff) {
  var ss = SpreadsheetApp.getActive();
  var log = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
  if (log.getLastRow() === 0) log.appendRow(['실행 시각', '시트', '작업', '결과', '기준(이 날짜까지 이동)']);
  log.appendRow([Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'), sheetName, action, result, cutoff]);
}
