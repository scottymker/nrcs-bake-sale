// ---------- Config ----------
const FETCH_URL = '/api/submit-order'; // Netlify Function path (see functions code below)

// ---------- Helpers ----------
const fmt = n => `$${n.toFixed(2)}`;
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

  const items = [];
  document.querySelectorAll('.qty-input').forEach(input => {
    const qty = Number(input.value || 0);
    if (qty > 0) {
      items.push({
        category: input.dataset.category,
        item: input.dataset.item,
        unitPrice: Number(input.dataset.price),
        qty,
        subtotal: Number(input.dataset.price) * qty
      });
    }
  });

  return {
    formVersion: '2025-09-12',
    timestamp: new Date().toISOString(),
    name, phone,
    items,
    total: items.reduce((s, it) => s + it.subtotal, 0)
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
    // Clear quantities but keep contact info so they can tweak and resubmit if needed.
    document.querySelectorAll('.qty-input').forEach(i => i.value = '');
    compute();
  } catch (err) {
    console.error(err);
    status.textContent = 'Sorry—there was a problem sending your order. Please try again.';
  } finally {
    btn.disabled = false;
  }
});
