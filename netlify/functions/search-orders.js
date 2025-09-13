// netlify/functions/search-orders.js
// Proxies admin search to Apps Script, injecting ADMIN key server-side.

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const base = (process.env.GAS_WEBAPP_URL || '').trim();
  const key  = (process.env.ADMIN_SEARCH_KEY || '').trim(); // same value as ADMIN_KEY in Apps Script

  if (!base || !/\/exec$/.test(base)) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'GAS_WEBAPP_URL invalid (must end with /exec)' }) };
  }
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'ADMIN_SEARCH_KEY not set' }) };
  }

  const p = event.queryStringParameters || {};
  const qs = new URLSearchParams({
    action: 'search',
    key,
    q: p.q || '',
    pickup: p.pickup || '',
    since: p.since || '',
    until: p.until || '',
    page: p.page || '1',
    pageSize: p.pageSize || '50'
  }).toString();

  const url = `${base}?${qs}`;

  try {
    const r = await fetch(url, { method: 'GET' });
    const text = await r.text();
    return {
      statusCode: r.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok:false, error:String(err) }) };
  }
}
