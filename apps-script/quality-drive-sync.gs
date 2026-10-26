/**
 * 구글 드라이브 → 웹앱 자동 반영 (품질리스트 · 입고리스트)
 *
 * 하는 일
 *  - 아래 FOLDERS의 폴더(안의 하위 폴더 포함)를 10분마다 살펴보고, 새로 올라왔거나 수정된 엑셀/구글시트를 찾습니다.
 *  - 파일을 임시 구글시트로 바꿔 읽은 뒤 웹앱으로 보냅니다. (임시 구글시트는 바로 휴지통으로. 원본 파일은 건드리지 않습니다.)
 *      품질리스트(시험의뢰서)   → '(PLU)' 칸이 있는 시트(단품·GIFT)만 → 입고 › 품질리스트
 *      입고리스트 샘플(체크리스트) → Checklist + 주문 시트 전부      → 입고 › 입고리스트 샘플
 *  - 웹앱은 데이터 › 업로드에서 직접 올릴 때와 같은 규칙으로 반영합니다. 같은 차수가 이미 있으면 새 파일 내용으로 바꿉니다.
 *    (입고리스트 샘플은 실시간 입고 예정일이 바뀌면 변경 이력을 남기고, 더 오래된 파일이 늦게 와도 덮어쓰지 않습니다.)
 *  - 한 번 보낸 파일은 기억해 두고, 파일이 수정되었을 때만 다시 보냅니다. → 체크리스트 파일의 입고 예정일을 고치면 자동 반영
 *
 * 설치 방법 (폴더 주인 계정에서 한 번) — 이미 설치했다면 코드만 바꿔 붙여 넣고 저장하면 됩니다(2~3단계·트리거 그대로)
 *  1) https://script.google.com → 새 프로젝트 → 이 코드를 붙여 넣고 저장
 *  2) 왼쪽 '서비스' + → 'Drive API' 추가 (엑셀 → 구글시트 변환에 필요)
 *  3) 왼쪽 '프로젝트 설정'(톱니) → 스크립트 속성 → 속성 추가
 *       이름: QUALITY_SYNC_SECRET   값: Vercel 환경변수 QUALITY_SYNC_SECRET과 같은 값(16자 이상 임의 문자열)
 *  4) 함수 선택에서 previewFiles 실행 → 권한 허용 → 실행 로그에 보낼 파일 목록이 나오는지 확인(실제 전송 없음)
 *  5) syncQualityFolder 실행 → 실행 로그에 '반영' 결과 확인 → 웹앱 확인
 *     (파일별 상태·건너뛴 이유·차수 겹침은 showStatus 실행 → 실행 로그)
 *  6) installTrigger 실행 → 이후 10분마다 자동 실행 (끄려면 removeTriggers)
 *
 * 처음부터 다시 보내려면 resetSent 실행(보낸 기록 지움) → syncQualityFolder
 */

// ─── 설정 ───────────────────────────────────────────────
var API_BASE = 'https://lush-logistics-workspace.vercel.app/api/team-data?part=';
var FOLDERS = [
  { id: '1blRex8mwLJt38vNT_q6XaVIjzlkfWpla', part: 'quality-lists', label: '품질리스트' },
  { id: '1XtEqqHXjKss_NJUc33C7fnRdTaJmfl6C', part: 'checklists', label: '입고리스트' }
];
var MAX_FILES_PER_RUN = 40;     // 한 번 실행에 보낼 최대 파일 수
var TIME_BUDGET_MS = 4.5 * 60 * 1000; // 실행 시간 6분 제한 전에 멈추고 나머지는 다음 실행(10분 뒤)에
var MAX_ROWS = 6000, MAX_COLS = 60;

// ─── 실행 ───────────────────────────────────────────────
function syncQualityFolder() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('이미 실행 중이라 건너뜀'); return; }
  var started = Date.now(), sent = 0;
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('QUALITY_SYNC_SECRET');
    if (!secret) throw new Error('스크립트 속성 QUALITY_SYNC_SECRET을 먼저 넣어 주세요.');
    var todo = pendingFiles_();
    if (!todo.length) { Logger.log('새로 보낼 파일 없음'); return; }
    Logger.log('보낼 파일 ' + todo.length + '개');
    for (var i = 0; i < todo.length && i < MAX_FILES_PER_RUN; i++) {
      if (Date.now() - started > TIME_BUDGET_MS) { Logger.log('시간 제한으로 여기서 멈춤 — 남은 ' + (todo.length - i) + '개는 다음 실행 때 보냄'); break; }
      var f = todo[i].file, fd = todo[i].folder, tag = '[' + fd.label + '] ' + f.getName();
      try {
        var sheets = readSheets_(f, fd.part);
        if (!sheets.length) { markSent_(f, 'skip', '읽을 시트 없음'); Logger.log('건너뜀(읽을 시트 없음): ' + tag); continue; }
        var res = UrlFetchApp.fetch(API_BASE + fd.part, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-sync-secret': secret },
          payload: JSON.stringify({ action: 'import', fileName: f.getName(), modified: f.getLastUpdated().toISOString(), sheets: sheets })
        });
        var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) { j = {}; }
        if (res.getResponseCode() === 200 && j.success) {
          sent++;
          var b = j.batch || {};
          var note = j.skipped ? (b.label || '') + ' 그대로(더 최근 파일 있음)' : (b.label || '') + ' ' + (b.rows || 0) + '건' + (b.eta ? ' · 입고 ' + b.eta + (b.etaChanged ? '(변경)' : '') : '');
          markSent_(f, 'ok', note);
          Logger.log('반영: ' + tag + ' → ' + note);
        } else if (res.getResponseCode() === 200) {
          markSent_(f, 'skip', j.error || '형식 다름'); // 형식이 다른 파일 등: 파일이 수정될 때까지 다시 보내지 않음
          Logger.log('반영 안 됨: ' + tag + ' — ' + (j.error || res.getContentText().slice(0, 200)));
        } else {
          Logger.log('서버 오류(다음 실행 때 다시 시도): ' + tag + ' — HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
        }
      } catch (e) {
        Logger.log('실패(다음 실행 때 다시 시도): ' + tag + ' — ' + e);
      }
    }
    Logger.log('이번 실행에서 반영 ' + sent + '개');
  } finally {
    lock.releaseLock();
  }
}

// 보낼 파일 목록만 보기(실제 전송 없음)
function previewFiles() {
  var list = pendingFiles_();
  Logger.log('보낼 파일 ' + list.length + '개');
  list.forEach(function (x) { Logger.log('- [' + x.folder.label + '] ' + x.file.getName() + ' (' + x.file.getLastUpdated() + ')'); });
}

// 폴더 안 모든 파일의 상태: 반영됨(어느 차수로) / 건너뜀(이유) / 대기(아직 안 보냄 또는 수정됨)
// 같은 차수로 반영된 파일이 여러 개면 '차수 겹침'으로 표시 — 품질리스트는 마지막에 보낸 파일, 입고리스트 샘플은 가장 최근 수정 파일만 남습니다
function showStatus() {
  var props = PropertiesService.getScriptProperties();
  FOLDERS.forEach(function (fd) {
    var rows = [], byBatch = {};
    allFiles_(fd).forEach(function (f) {
      var s = props.getProperty(sentKey_(f)) || '', parts = s.split(':'), how = parts[1] || '', note = parts.slice(2).join(':');
      var fresh = parts[0] === String(f.getLastUpdated().getTime());
      var state = !s ? '대기(아직 안 보냄)' : !fresh ? '대기(파일 수정됨)' : how === 'ok' ? '반영됨 → ' + note : '건너뜀 — ' + (note || '형식 다름');
      if (fresh && how === 'ok') { var b = note.split(' ')[0]; (byBatch[b] = byBatch[b] || []).push(f.getName()); }
      rows.push([f.getName(), state]);
    });
    rows.sort(function (a, b) { return a[0].localeCompare(b[0]); });
    Logger.log('━━ ' + fd.label + ' 파일 ' + rows.length + '개');
    rows.forEach(function (r) { Logger.log('- ' + r[0] + ' : ' + r[1]); });
    Object.keys(byBatch).forEach(function (b) { if (byBatch[b].length > 1) Logger.log('※ 차수 겹침 ' + b + ': ' + byBatch[b].join(', ')); });
  });
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
function markSent_(f, how, note) { PropertiesService.getScriptProperties().setProperty(sentKey_(f), String(f.getLastUpdated().getTime()) + ':' + how + ':' + String(note || '').replace(/\s+/g, ' ').slice(0, 200)); }
// 폴더(하위 폴더 포함)의 대상 파일 전부. 바로가기(단축키)로 넣은 파일은 원본 파일로 따라감
function allFiles_(fd) {
  var out = [], seen = {};
  (function walk(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if (f.getMimeType() === MimeType.SHORTCUT) { try { f = DriveApp.getFileById(f.getTargetId()); } catch (e) { continue; } }
      if (!isTarget_(f) || seen[f.getId()]) continue;
      seen[f.getId()] = 1; out.push(f);
    }
    var subs = folder.getFolders();
    while (subs.hasNext()) walk(subs.next());
  })(DriveApp.getFolderById(fd.id));
  return out;
}
function pendingFiles_() {
  var props = PropertiesService.getScriptProperties(), out = [];
  FOLDERS.forEach(function (fd) {
    allFiles_(fd).forEach(function (f) {
      var sent = props.getProperty(sentKey_(f));
      if (!(sent && sent.split(':')[0] === String(f.getLastUpdated().getTime()))) out.push({ file: f, folder: fd });
    });
  });
  out.sort(function (a, b) { return a.file.getLastUpdated() - b.file.getLastUpdated(); }); // 오래된 것부터 → 같은 차수면 최신 파일이 마지막
  return out;
}
// 파일 → [{ name, aoa }]
//  품질리스트: '(PLU)' 칸이 위쪽 30줄 안에 있는 시트만, 보이는 글자 그대로
//  입고리스트 샘플: 모든 시트, 날짜 칸은 yyyy-mm-dd · 숫자는 원래 값(LOT 번호가 8.26E+11처럼 깨지지 않게)
function readSheets_(f, part) {
  var tmpId = null, ss;
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
    ss = SpreadsheetApp.openById(f.getId());
  } else {
    var tmp = Drive.Files.create({ name: '[임시] ' + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
    tmpId = tmp.id;
    ss = SpreadsheetApp.openById(tmpId);
  }
  try {
    var out = [], tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
    ss.getSheets().forEach(function (sh) {
      var lastRow = Math.min(sh.getLastRow(), MAX_ROWS), lastCol = Math.min(sh.getLastColumn(), MAX_COLS);
      if (lastRow < 1 || lastCol < 1) return;
      var range = sh.getRange(1, 1, lastRow, lastCol);
      if (part === 'checklists') {
        var vals = range.getValues(), disp = range.getDisplayValues();
        out.push({ name: sh.getName(), aoa: vals.map(function (r, i) { return r.map(function (v, k) {
          if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
          if (typeof v === 'number') return String(v);
          return disp[i][k];
        }); }) });
        return;
      }
      var head = sh.getRange(1, 1, Math.min(30, lastRow), lastCol).getDisplayValues();
      var hasPlu = head.some(function (r) { return r.some(function (c) { return String(c).replace(/\s+/g, ' ').trim() === '(PLU)'; }); });
      if (!hasPlu) return;
      out.push({ name: sh.getName(), aoa: range.getDisplayValues() });
    });
    return out;
  } finally {
    if (tmpId) DriveApp.getFileById(tmpId).setTrashed(true);
  }
}
