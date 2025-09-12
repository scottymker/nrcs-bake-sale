// ---------- Config ----------
const FETCH_URL = '/api/submit-order'; // Netlify Function path

// ---------- Helpers ----------
const fmt = n => `$${n.toFixed(2)}`;

function inferColumnHeader(input) {
  const cat = (input.dataset.category || '').toLowerCase();
  const item = input.dataset.item || '';
  if (cat.startsWith('stroopwafels')) return 'Stroopwafels'; // 1 column; qty = dozens
  if (cat.startsWith('pies')) return `Pie - ${item}`;
  if (cat.startsWith('soup')) return `Soup - ${item} (1/2 Gal)`;
  if (cat.startsWith('pizza (mini')) return `Mini Pizza - ${item}`;
  if (cat.startsWith('pizza (reg'))  return `Reg Pizza - ${item}`;
  return `${input.dataset.category} - ${item}`; // fallback
}

function compute() {
  let total = 0;
  document.querySelectorAll('tr').forEach(row => {
    const qtyInput = row.querySelector('.qty-input');
    const subEl = row.querySelector('.line-subtotal');
    if (!qtyInput || !subEl) return;
    const price = Number(qtyInput.dataset.price);
    const qty = Math.max(0, Number(qtyInput.value || 0));
    const sub = price * qty;
    subEl.textContent = fmt(sub);
    total += sub;
  });
  document.getElementById('grand-total').textContent = fmt(total);
  return total;
}

function collectOrder() {
  const name = document.querySelector('input[name="customerName"]').value.trim();
  const phone = document.querySelector('input[name="phone"]').value.trim();

  // Build the header list and a quantities map for ALL products (0 if not chosen)
  const qtyInputs = Array.from(document.querySelectorAll('.qty-input'));
  const columnHeaders = [];
  const quantities = {};
  const itemsChosen = [];

  qtyInputs.forEach(input => {
    const header = inferColumnHeader(input);
    if (!columnHeaders.includes(header)) columnHeaders.push(header);
  });

  qtyInputs.forEach(input => {
    const header = inferColumnHeader(input);
    const price = Number(input.dataset.price);
    const qty = Math.max(0, Number(input.value || 0));
    if (!(header in quantities)) quantities[header] = 0;
    quantities[header] += qty; // (for stroopwafels there is only one row anyway)
    if (qty > 0) {
      itemsChosen.push({
        category: input.dataset.category,
        item: input.dataset.item,
        unitPrice: price,
        qty,
        subtotal: price * qty
      });
    }
  });

  const total = itemsChosen.reduce((s, it) => s + it.subtotal, 0);

  return {
    formVersion: '2025-09-12',
    timestamp: new Date().toISOString(),
    name,
    phone,
    items: itemsChosen,        // for your records / audits
    total,
    columnHeaders,             // exact order for columns in the Sheet
    quantities                 // { "Stroopwafels": 2, "Pie - Apple": 0, ... }
  };
}

// ---------- Wire up ----------
document.querySelectorAll('.qty-input').forEach(i => i.addEventListener('input', compute));
document.getElementById('reset-btn').addEventListener('click', () => {
  document.querySelectorAll('.qty-input').forEach(i => i.value = '');
  compute();
});
compute();

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('status');
  const btn = document.getElementById('submit-btn');

  const order = collectOrder();
  if (!order.name || !order.phone) {
    status.textContent = 'Please enter your name and phone number.';
    return;
  }
  if (order.items.length === 0) {
    status.textContent = 'Please add at least one item.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Submitting…';

  try {
    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(order)
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json().catch(() => ({}));
    status.textContent = `Thank you! Order ${data.orderId || ''} received.`;
    document.querySelectorAll('.qty-input').forEach(i => i.value = '');
    compute();
  } catch (err) {
    console.error(err);
    status.textContent = 'Sorry—there was a problem sending your order. Please try again.';
  } finally {
    btn.disabled = false;
  }
});
