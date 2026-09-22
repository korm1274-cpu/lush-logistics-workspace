// /api/calendar.js
// Google Apps Script로 배포한 웹앱(캘린더 3개를 읽어 JSON으로 반환)을 그대로 가져와 전달합니다.
// 환경변수 CALENDAR_APPS_SCRIPT_URL 에 배포된 웹앱 URL을 넣어주세요.
// 예: https://script.google.com/macros/s/AKfycb.../exec

module.exports = async (req, res) => {
  const url = process.env.CALENDAR_APPS_SCRIPT_URL;
  if (!url) {
    res.status(200).json({ success: false, events: [], error: 'CALENDAR_APPS_SCRIPT_URL 환경변수가 설정되지 않았습니다.' });
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const upstream = await fetch(url, { redirect: 'follow', signal: ctrl.signal }).finally(() => clearTimeout(timer));
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      res.status(200).json({ success: false, events: [], error: 'Apps Script 응답이 JSON이 아닙니다: ' + text.slice(0, 200) });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ success: false, events: [], error: String((e && e.message) || e) });
  }
};
