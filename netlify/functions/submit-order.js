// netlify/functions/submit-order.js
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const url = process.env.GAS_WEBAPP_URL; // set in Netlify env vars
    if (!url) throw new Error('GAS_WEBAPP_URL not set');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body
    });

    const text = await res.text();
    // Apps Script may return text; try JSON first
    try {
      const json = JSON.parse(text);
      return { statusCode: 200, body: JSON.stringify(json) };
    } catch {
      return { statusCode: res.ok ? 200 : 500, body: text };
    }
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: err.message }) };
  }
}
