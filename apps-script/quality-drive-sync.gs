/**
 * 품질리스트(시험의뢰서) 구글 드라이브 → 웹앱 자동 반영
 *
 * 하는 일
 *  - FOLDER_ID 폴더(안의 하위 폴더 포함)를 10분마다 살펴보고, 새로 올라왔거나 수정된 엑셀/구글시트를 찾습니다.
 *  - 파일을 임시 구글시트로 바꿔 '(PLU)' 칸이 있는 시트(단품·GIFT)만 글자 값 그대로 읽어 웹앱으로 보냅니다.
 *    (임시 구글시트는 읽은 뒤 바로 휴지통으로 보냅니다. 원본 파일은 건드리지 않습니다.)
 *  - 웹앱은 데이터 › 업로드의 [품질리스트 Excel]과 같은 규칙으로 입고 › 품질리스트에 반영합니다.
 *    같은 차수가 이미 있으면 새 파일 내용으로 바꿉니다.
 *  - 한 번 보낸 파일은 기억해 두고, 파일이 수정되었을 때만 다시 보냅니다.
 *
 * 설치 방법 (폴더 주인 계정에서 한 번)
 *  1) https://script.google.com → 새 프로젝트 → 이 코드를 붙여 넣고 저장 (프로젝트 이름 예: 품질리스트 자동 반영)
 *  2) 왼쪽 '서비스' + → 'Drive API' 추가 (엑셀 → 구글시트 변환에 필요)
 *  3) 왼쪽 '프로젝트 설정'(톱니) → 스크립트 속성 → 속성 추가
 *       이름: QUALITY_SYNC_SECRET   값: Vercel 환경변수 QUALITY_SYNC_SECRET과 같은 값(16자 이상 임의 문자열)
 *  4) 함수 선택에서 previewFiles 실행 → 권한 허용 → 실행 로그에 보낼 파일 목록이 나오는지 확인(실제 전송 없음)
 *  5) syncQualityFolder 실행 → 실행 로그에 '반영' 결과 확인 → 웹앱 입고 › 품질리스트 확인
 *  6) installTrigger 실행 → 이후 10분마다 자동 실행 (끄려면 removeTriggers)
 *
 * 처음부터 다시 보내려면 resetSent 실행(보낸 기록 지움) → syncQualityFolder
 */

// ─── 설정 ───────────────────────────────────────────────
var FOLDER_ID = '1blRex8mwLJt38vNT_q6XaVIjzlkfWpla';
var API_URL = 'https://lush-logistics-workspace.vercel.app/api/team-data?part=quality-lists';
var MAX_FILES_PER_RUN = 5;      // 한 번 실행에 보낼 최대 파일 수(실행 시간 6분 제한)
var MAX_ROWS = 6000, MAX_COLS = 40;

// ─── 실행 ───────────────────────────────────────────────
function syncQualityFolder() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('이미 실행 중이라 건너뜀'); return; }
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('QUALITY_SYNC_SECRET');
    if (!secret) throw new Error('스크립트 속성 QUALITY_SYNC_SECRET을 먼저 넣어 주세요.');
    var todo = pendingFiles_();
    if (!todo.length) { Logger.log('새로 보낼 파일 없음'); return; }
    todo.slice(0, MAX_FILES_PER_RUN).forEach(function (f) {
      try {
        var sheets = readSheets_(f);
        if (!sheets.length) { markSent_(f, 'skip'); Logger.log('건너뜀(목록 시트 없음): ' + f.getName()); return; }
        var res = UrlFetchApp.fetch(API_URL, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-sync-secret': secret },
          payload: JSON.stringify({ action: 'import', fileName: f.getName(), sheets: sheets })
        });
        var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) { j = {}; }
        if (res.getResponseCode() === 200 && j.success) {
          markSent_(f, 'ok');
          Logger.log('반영: ' + f.getName() + ' → ' + (j.batch && j.batch.label) + ' ' + (j.batch && j.batch.rows) + '건');
        } else if (res.getResponseCode() === 200) {
          markSent_(f, 'skip'); // 형식이 다른 파일 등: 파일이 수정될 때까지 다시 보내지 않음
          Logger.log('반영 안 됨: ' + f.getName() + ' — ' + (j.error || res.getContentText().slice(0, 200)));
        } else {
          Logger.log('서버 오류(다음 실행 때 다시 시도): ' + f.getName() + ' — HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
        }
      } catch (e) {
        Logger.log('실패(다음 실행 때 다시 시도): ' + f.getName() + ' — ' + e);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

// 보낼 파일 목록만 보기(실제 전송 없음)
function previewFiles() {
  var list = pendingFiles_();
  Logger.log('보낼 파일 ' + list.length + '개');
  list.forEach(function (f) { Logger.log('- ' + f.getName() + ' (' + f.getLastUpdated() + ')'); });
}

function installTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('syncQualityFolder').timeBased().everyMinutes(10).create();
  Logger.log('10분마다 자동 실행을 켰습니다.');
}
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncQualityFolder') ScriptApp.deleteTrigger(t); });
}
function resetSent() {
  var p = PropertiesService.getScriptProperties(), all = p.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf('sent_') === 0) p.deleteProperty(k); });
  Logger.log('보낸 기록을 지웠습니다.');
}

// ─── 내부 ───────────────────────────────────────────────
var XLSX_TYPES = [MimeType.MICROSOFT_EXCEL, MimeType.MICROSOFT_EXCEL_LEGACY];
function isTarget_(f) {
  var t = f.getMimeType();
  return t === MimeType.GOOGLE_SHEETS || XLSX_TYPES.indexOf(t) >= 0 || /\.xlsx?$/i.test(f.getName());
}
function sentKey_(f) { return 'sent_' + f.getId(); }
function markSent_(f, how) { PropertiesService.getScriptProperties().setProperty(sentKey_(f), String(f.getLastUpdated().getTime()) + ':' + how); }
function pendingFiles_() {
  var props = PropertiesService.getScriptProperties(), out = [];
  (function walk(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if (!isTarget_(f)) continue;
      var sent = props.getProperty(sentKey_(f));
      if (sent && sent.split(':')[0] === String(f.getLastUpdated().getTime())) continue;
      out.push(f);
    }
    var subs = folder.getFolders();
    while (subs.hasNext()) walk(subs.next());
  })(DriveApp.getFolderById(FOLDER_ID));
  out.sort(function (a, b) { return a.getLastUpdated() - b.getLastUpdated(); }); // 오래된 것부터
  return out;
}
// 파일 → [{ name, aoa }] ('(PLU)' 칸이 위쪽 30줄 안에 있는 시트만)
function readSheets_(f) {
  var tmpId = null, ss;
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
    ss = SpreadsheetApp.openById(f.getId());
  } else {
    var tmp = Drive.Files.create({ name: '[임시] ' + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
    tmpId = tmp.id;
    ss = SpreadsheetApp.openById(tmpId);
  }
  try {
    var out = [];
    ss.getSheets().forEach(function (sh) {
      var lastRow = Math.min(sh.getLastRow(), MAX_ROWS), lastCol = Math.min(sh.getLastColumn(), MAX_COLS);
      if (lastRow < 1 || lastCol < 1) return;
      var head = sh.getRange(1, 1, Math.min(30, lastRow), lastCol).getDisplayValues();
      var hasPlu = head.some(function (r) { return r.some(function (c) { return String(c).replace(/\s+/g, ' ').trim() === '(PLU)'; }); });
      if (!hasPlu) return;
      out.push({ name: sh.getName(), aoa: sh.getRange(1, 1, lastRow, lastCol).getDisplayValues() });
    });
    return out;
  } finally {
    if (tmpId) DriveApp.getFileById(tmpId).setTrashed(true);
  }
}
