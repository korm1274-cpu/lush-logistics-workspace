/**
 * 지난 달 행을 보관함 시트로 자동 이동 (출고량 · 출고 제외 수량 · 입고량)
 *
 * 하는 일
 *  - 아래 SHEETS에 적은 시트에서, 날짜(A열)가 '보관 기준 달'보다 오래된 행을 찾아
 *    같은 파일 안의 '시트이름_보관함' 시트로 옮기고 원본에서는 지웁니다.
 *  - 보관함 시트가 없으면 원본과 같은 머리글로 새로 만듭니다.
 *  - 실행 결과는 '보관함_기록' 시트에 남깁니다.
 *
 * 보관 기준 (KEEP_MONTHS = 1)
 *  - 이번 달과 지난 1개월은 원본에 남기고, 그보다 오래된 달을 옮깁니다.
 *    예) 11월 1일 실행 → 10월·11월은 남기고 9월 이전 행을 보관함으로 이동
 *  - 지난 달은 늦게 수정되는 경우가 많아 한 달을 더 남겨 둡니다. 이번 달만 남기려면 0으로 바꾸세요.
 *
 * 웹앱(LUSH Logistics Workspace)과의 관계
 *  - 웹앱은 '웹에 게시'된 원본 시트만 읽습니다. 보관함 시트는 게시하지 않으면 읽지 않습니다.
 *  - 원본에서 사라진 지난 달 데이터는 웹앱 서버에 이미 저장된 내용이 그대로 유지됩니다(최근 18개월).
 *  - 단, 보관함으로 옮긴 뒤에 그 행을 고쳐도 웹앱에는 반영되지 않습니다. 수정은 옮기기 전에 해 주세요.
 *
 * 설치 방법 (한 번만)
 *  1) 구글시트 → 확장 프로그램 → Apps Script → 이 코드를 붙여 넣고 저장
 *  2) 위쪽 함수 선택에서 previewArchive 실행 → 권한 허용 → '보관함_기록'에 옮길 줄 수만 기록됨(실제 이동 없음)
 *  3) 결과가 맞으면 installMonthlyTrigger 실행 → 매달 1일 새벽 1~2시에 자동 실행
 *     (바로 한 번 옮기려면 archiveOldRows 실행)
 *
 * 출고량과 출고 제외 수량은 반드시 같은 기준으로 함께 옮겨야 합니다(웹앱이 둘을 날짜·제품코드로 맞춰 계산).
 * 그래서 두 시트를 한 번의 실행에서 같이 처리합니다.
 */

// ─── 설정 ───────────────────────────────────────────────
// 원본 시트 탭 이름을 실제 이름에 맞게 고쳐 주세요. (dateCol: 날짜가 있는 열, A열=1 / headerRows: 머리글 줄 수)
var SHEETS = [
  { name: '출고',           dateCol: 1, headerRows: 1 },
  { name: '출고 제외 수량', dateCol: 1, headerRows: 1 },
  { name: '입고',           dateCol: 1, headerRows: 1 }
];
var KEEP_MONTHS = 1;               // 이번 달 + 지난 N개월은 원본에 남김
var ARCHIVE_SUFFIX = '_보관함';     // 보관함 시트 이름 = 원본 이름 + 이 글자
var LOG_SHEET = '보관함_기록';
var TIMEZONE = 'Asia/Seoul';
// ────────────────────────────────────────────────────────

/** 실제로 옮기기 (트리거가 매달 실행하는 함수) */
function archiveOldRows() { run_(false); }

/** 미리보기: 옮길 줄 수만 기록하고 실제로는 옮기지 않음 */
function previewArchive() { run_(true); }

/** 매달 1일 새벽 1시대에 자동 실행되도록 등록 (같은 트리거가 있으면 지우고 다시 만듦) */
function installMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'archiveOldRows') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archiveOldRows').timeBased().onMonthDay(1).atHour(1).inTimezone(TIMEZONE).create();
  log_('트리거', '매달 1일 01시 자동 실행 등록', '', '');
}

function run_(dryRun) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { log_('건너뜀', '다른 실행이 진행 중', '', ''); return; }
  try {
    var cutoff = cutoffMonth_(); // 이 달(YYYY-MM)보다 오래된 행을 옮김
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
    var m = monthOf_(row[cfg.dateCol - 1]);
    if (m && m < cutoff) oldIdx.push(i);
  });
  if (!oldIdx.length) return '옮길 행 없음';
  if (dryRun) return oldIdx.length + '줄 이동 예정';

  // 원본에 수식이 있으면 값만 다시 쓰는 방식은 수식을 지워 버리므로, 그 경우는 연속된 앞부분만 행 삭제로 처리
  var contiguousFromTop = oldIdx[oldIdx.length - 1] === oldIdx.length - 1;
  var hasFormulas = range.getFormulas().some(function (r) { return r.some(function (f) { return f; }); });
  if (hasFormulas && !contiguousFromTop) {
    return '중단: 원본에 수식이 있고 지난 행이 위쪽에 모여 있지 않음(날짜순 정렬 후 다시 실행해 주세요)';
  }

  // 1) 보관함에 먼저 추가 (실패하면 원본은 그대로 남음)
  var archive = ensureArchive_(ss, sh, cfg, lastCol);
  var oldRows = oldIdx.map(function (i) { return values[i]; });
  archive.getRange(archive.getLastRow() + 1, 1, oldRows.length, lastCol).setValues(oldRows);
  SpreadsheetApp.flush();

  // 2) 원본에서 지우기
  if (contiguousFromTop) {
    sh.deleteRows(first, oldIdx.length); // 수식·서식이 있는 아래쪽 행은 그대로 유지
  } else {
    var keep = values.filter(function (row, i) { return oldIdx.indexOf(i) < 0; });
    range.clearContent();
    if (keep.length) sh.getRange(first, 1, keep.length, lastCol).setValues(keep);
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

/** 이 달보다 오래된 행을 옮김: 이번 달에서 KEEP_MONTHS만큼 뺀 달 (YYYY-MM) */
function cutoffMonth_() {
  var now = new Date();
  var y = Number(Utilities.formatDate(now, TIMEZONE, 'yyyy'));
  var m = Number(Utilities.formatDate(now, TIMEZONE, 'M')) - KEEP_MONTHS;
  while (m < 1) { m += 12; y -= 1; }
  return y + '-' + (m < 10 ? '0' + m : m);
}

/** 셀 값(날짜 또는 '2026-10-01', '2026. 10. 1', '2026/10/1' 같은 글자)을 'YYYY-MM'으로 */
function monthOf_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})\D+(\d{1,2})/);
  if (!m) return '';
  var mm = Number(m[2]);
  return m[1] + '-' + (mm < 10 ? '0' + mm : mm);
}

function log_(sheetName, action, result, cutoff) {
  var ss = SpreadsheetApp.getActive();
  var log = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
  if (log.getLastRow() === 0) log.appendRow(['실행 시각', '시트', '작업', '결과', '기준(이 달보다 오래된 행)']);
  log.appendRow([Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'), sheetName, action, result, cutoff]);
}
