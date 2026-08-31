// Vercel Serverless Function: /api/calendar
// Proxies the Google Apps Script calendar feed so the browser only calls the same origin.

const APPS_SCRIPT_URL =
  'https://script.google.com/a/macros/lush.co.kr/s/AKfycbw4ZD7eut8s_OlPOU2sD5muS8D8Wp3KXD8D4HKkIAP0TgR5DMywfuIezz0H4janU4vT/exec';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json'
      }
    });

    const body = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        error: 'Calendar upstream request failed',
        status: upstream.status
      });
    }

    let data;

    try {
      data = JSON.parse(body);
    } catch (error) {
      return res.status(502).json({
        success: false,
        error: 'Calendar upstream returned invalid JSON'
      });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Calendar proxy error:', error);

    return res.status(500).json({
      success: false,
      error: 'Calendar proxy request failed'
    });
  }
};
