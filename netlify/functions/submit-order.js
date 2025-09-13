// netlify/functions/submit-order.js

// ==== Order cutoff ====
// 12:00 AM Central Time on 2025-09-27  -> 05:00:00 UTC
const CUTOFF_UTC = '2025-09-27T05:00:00Z';
const CUTOFF_UTC_MS = Date.parse(CUTOFF_UTC);
const CLOSED_MSG = 'Pre-orders are closed as of Sat, Sept 27 at 12:00 AM CT. Thank you!';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Hard-close on/after the cutoff
  if (Date.now() >= CUTOFF_UTC_MS) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, closed: true, cutoff: CUTOFF_UTC, message: CLOSED_MSG })
    };
  }

  const url = (process.env.GAS_WEBAPP_URL || '').trim();
  if (!url) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL not set' })
    };
  }
  if (!/^https?:\/\/.+\/exec$/.test(url)) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL must end with /exec' })
    };
  }

  try {
    // Use native fetch (Node 18+/20+)
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body || '{}'
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || '';

    // If Apps Script isn’t public or errors, we’ll often see HTML/login content.
    if (!upstream.ok || /<html|accounts\.google\.com/i.test(text)) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          upstreamStatus: upstream.status,
          hint: 'Check Apps Script: Web app "Execute as: Me", "Who has access: Anyone".',
          preview: text.slice(0, 600)
        })
      };
    }

    // Pass through JSON or text from Apps Script
    return {
      statusCode: 200,
      headers: { 'Content-Type': ct.includes('application/json') ? 'application/json' : 'text/plain' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error: String(err) })
    };
  }
}
