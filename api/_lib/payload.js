// 팀 공유 데이터 저장(POST) 공통 검사: api/team-data.js, api/shared-data.js
//   - 본문은 객체({})만 허용(배열·문자열·빈 값으로 전체를 덮어쓰지 않도록), 항목은 최대 100개
//   - 항목 이름이 영문·숫자·_·- 64자 이내가 아니면 그 항목은 저장하지 않음
//   - 서버에 이미 있는 항목인데 종류(목록/객체/문자열/숫자)가 다르면 그 항목은 서버 값을 유지
//     (예전 화면 버전 등으로 형식이 어긋나도 나머지 저장은 막지 않음)
// 본문 전체를 거부해야 하면 오류 문구, 아니면 ''를 돌려줍니다. 받은 값 내용은 오류 문구에 넣지 않습니다.
const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_KEYS = 100;

function kind(v) {
  if (v === null || v === undefined) return 'empty';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function checkTopLevel(body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '잘못된 요청 본문입니다.';
  const keys = Object.keys(body);
  if (keys.length > MAX_KEYS) return '저장 항목이 너무 많습니다.';
  const cur = current && typeof current === 'object' && !Array.isArray(current) ? current : null;
  for (const k of keys) {
    if (!KEY_RE.test(k)) { delete body[k]; continue; }
    if (cur && k in cur) {
      const a = kind(cur[k]), b = kind(body[k]);
      if (a !== 'empty' && b !== 'empty' && a !== b) body[k] = cur[k];
    }
  }
  return '';
}

// 링크는 http(s)만 허용(javascript: 등은 빈칸으로)
function httpUrl(u) {
  const s = String(u == null ? '' : u).trim();
  return /^https?:\/\//i.test(s) ? s.slice(0, 2000) : '';
}

module.exports = { checkTopLevel, httpUrl };
