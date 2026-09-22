// /api/calendar.js
// 구글 캘린더 3개(수입일정 / 물류연차일정 / 출고일정)의 iCal(.ics) 피드를 가져와
// 하나로 합쳐서 { success, events:[{id,title,start,end,source}] } 형태로 돌려줍니다.
// 프론트엔드(loadImportSchedule)가 정확히 이 모양을 기대하고 있습니다.

const CALENDARS = [
  { key: 'import', label: '수입일정', envVar: 'CAL_ICS_IMPORT' },
  { key: 'leave', label: '물류연차일정', envVar: 'CAL_ICS_LEAVE' },
  { key: 'outbound', label: '출고일정', envVar: 'CAL_ICS_OUTBOUND' },
];

// ---- 아주 가벼운 ICS(iCalendar) 파서 (외부 라이브러리 없이 VEVENT만 추출) ----
function unfoldLines(text) {
  // RFC5545: 다음 줄이 공백/탭으로 시작하면 이전 줄과 이어붙임(line folding)
  return text.replace(/\r\n/g, '\n').split('\n').reduce((lines, line) => {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
    return lines;
  }, []);
}

function parseIcsDate(raw) {
  if (!raw) return null;
  const value = raw.trim();
  // 날짜만 있는 경우 (전일 일정): YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00`;
  }
  // 날짜+시간: YYYYMMDDTHHMMSS(Z)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    return z ? iso + 'Z' : iso;
  }
  return null;
}

function unescapeIcsText(v) {
  return String(v || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseIcs(icsText, source) {
  const lines = unfoldLines(icsText);
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      cur = {};
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (cur && cur.dtstart) {
        events.push({
          id: cur.uid || `${source}_${cur.dtstart}_${events.length}`,
          title: cur.summary || '(제목 없음)',
          start: cur.dtstart,
          end: cur.dtend || cur.dtstart,
          source,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const rawKey = line.slice(0, idx);
    const rawVal = line.slice(idx + 1);
    const key = rawKey.split(';')[0].toUpperCase();

    if (key === 'UID') cur.uid = rawVal.trim();
    else if (key === 'SUMMARY') cur.summary = unescapeIcsText(rawVal);
    else if (key === 'DTSTART') cur.dtstart = parseIcsDate(rawVal);
    else if (key === 'DTEND') cur.dtend = parseIcsDate(rawVal);
  }
  return events;
}

async function fetchOne(cal) {
  const url = process.env[cal.envVar];
  if (!url) return { cal, events: [], error: `환경변수 ${cal.envVar} 미설정` };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return { cal, events: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    const events = parseIcs(text, cal.label);
    return { cal, events, error: null };
  } catch (e) {
    return { cal, events: [], error: String(e && e.message || e) };
  }
}

module.exports = async (req, res) => {
  try {
    const results = await Promise.all(CALENDARS.map(fetchOne));
    const events = results.flatMap((r) => r.events);
    const errors = results.filter((r) => r.error).map((r) => `${r.cal.label}: ${r.error}`);

    res.status(200).json({
      success: true,
      events,
      meta: {
        calendars: CALENDARS.map((c) => c.label),
        counts: Object.fromEntries(results.map((r) => [r.cal.label, r.events.length])),
        errors,
      },
    });
  } catch (e) {
    res.status(200).json({ success: false, events: [], error: String(e && e.message || e) });
  }
};