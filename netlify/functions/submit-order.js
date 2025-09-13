// Debug-friendly proxy to Google Apps Script

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const url = (process.env.GAS_WEBAPP_URL || '').trim();
  if (!url) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL not set' }) };
  }
  if (!/^https?:\/\/.+\/exec$/.test(url)) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL must end with /exec' }) };
  }

  try {
    // Use native fetch (Node 18+/20+); if missing, this will throw before hitting Google.
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body || '{}'
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || '';

    // If Apps Script isn’t public or errors, we’ll often see HTML/login.
    if (!upstream.ok || /<html|accounts\.google\.com/i.test(text)) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          ok: false,
          upstreamStatus: upstream.status,
          hint: 'Check Apps Script: Web app "Execute as: Me", "Who has access: Anyone".',
          preview: text.slice(0, 600)
        })
      };
    }

    // Pass through JSON or text
    return {
      statusCode: 200,
      headers: { 'Content-Type': ct.includes('application/json') ? 'application/json' : 'text/plain' },
      body: text
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
}
