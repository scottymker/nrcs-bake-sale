// netlify/functions/submit-order.js
import fetch from 'node-fetch'; // ensures fetch even if runtime lacks global fetch

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const url = process.env.GAS_WEBAPP_URL;
  if (!url) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL not set' }) };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body
    });

    const ct = res.headers.get('content-type') || '';
    let body;
    if (ct.includes('application/json')) {
      body = JSON.stringify(await res.json());
    } else {
      body = await res.text();
    }

    // Surface common Apps Script misconfigs (login page / permissions)
    if (!res.ok || body.includes('accounts.google.com')) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          upstreamStatus: res.status,
          hint: 'Ensure your Apps Script is deployed as a Web app with "Anyone" access and the URL ends with /exec.',
          body: body.slice(0, 4000) // trim for safety
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': ct.includes('application/json') ? 'application/json' : 'text/plain' },
      body
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
}
