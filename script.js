// ==== ORDER WINDOW ====
// Close at 2025-09-27 00:00 Central Time (CDT = UTC-5 on that date).
// Use a UTC timestamp so this works from any browser timezone.
const CUTOFF_UTC_MS = Date.UTC(2025, 8, 27, 5, 0, 0); // months are 0-based: Sept = 8
const CLOSED_MSG = "Pre-orders are closed as of Sat, Sept 27 at 12:00 AM CT. Thank you!";

function orderingClosed() {
  return Date.now() >= CUTOFF_UTC_MS;
}

function lockFormUI() {
  const form = document.getElementById("order-form");
  if (!form) return;
  form.querySelectorAll("input, select, textarea, button").forEach(el => (el.disabled = true));
  const status = document.getElementById("status");
  if (status) status.textContent = CLOSED_MSG;
  document.getElementById("submit-btn")?.classList.add("disabled");
}

// Enforce immediately on load and at the exact cutoff moment if the page is open
document.addEventListener("DOMContentLoaded", () => {
  if (orderingClosed()) {
    lockFormUI();
  } else {
    const ms = CUTOFF_UTC_MS - Date.now();
    if (ms > 0) setTimeout(lockFormUI, ms);
  }
});

// ---------- Config ----------
const FETCH_URL = "/api/submit-order"; // Netlify Function path

// ---------- Helpers ----------
const fmt = (n) => `$${n.toFixed(2)}`;

function inferColumnHeader(input) {
  const cat = (input.dataset.category || "").toLowerCase();
  const item = input.dataset.item || "";
  if (cat.startsWith("stroopwafels")) return "Stroopwafels";
  if (cat.startsWith("pies")) return `Pie - ${item}`;
  if (cat.startsWith("soup")) return `Soup - ${item} (1/2 Gal)`;
  if (cat.startsWith("pizza (mini")) return `Mini Pizza - ${item}`;
  if (cat.startsWith("pizza (reg")) return `Reg Pizza - ${item}`;
  return `${input.dataset.category} - ${item}`; // fallback
}

function compute() {
  let total = 0;
  document.querySelectorAll("tr").forEach((row) => {
    const qtyInput = row.querySelector(".qty-input");
    const subEl = row.querySelector(".line-subtotal");
    if (!qtyInput || !subEl) return;
    const price = Number(qtyInput.dataset.price);
    const qty = Math.max(0, Number(qtyInput.value || 0));
    const sub = price * qty;
    subEl.textContent = fmt(sub);
    total += sub;
  });
  const totalEl = document.getElementById("grand-total");
  if (totalEl) totalEl.textContent = fmt(total);
  return total;
}

function collectOrder() {
  const name = document.querySelector('input[name="customerName"]')?.value.trim() || "";
  const phone = document.querySelector('input[name="phone"]')?.value.trim() || "";

  // Pickup dropdown + optional note
  const pickupSelect = document.getElementById("pickup-select");
  const pickup = pickupSelect ? pickupSelect.value : "";
  const deliveryNote = document.querySelector('textarea[name="deliveryNote"]')?.value.trim() || "";

  // Build the header list and quantities map for ALL products (0 if not chosen)
  const qtyInputs = Array.from(document.querySelectorAll(".qty-input"));
  const columnHeaders = [];
  const quantities = {};
  const itemsChosen = [];

  qtyInputs.forEach((input) => {
    const header = inferColumnHeader(input);
    if (!columnHeaders.includes(header)) columnHeaders.push(header);
  });

  qtyInputs.forEach((input) => {
    const header = inferColumnHeader(input);
    const price = Number(input.dataset.price);
    const qty = Math.max(0, Number(input.value || 0));
    if (!(header in quantities)) quantities[header] = 0;
    quantities[header] += qty;
    if (qty > 0) {
      itemsChosen.push({
        category: input.dataset.category,
        item: input.dataset.item,
        unitPrice: price,
        qty,
        subtotal: price * qty,
      });
    }
  });

  const total = itemsChosen.reduce((s, it) => s + it.subtotal, 0);

  return {
    formVersion: "2025-09-12",
    timestamp: new Date().toISOString(),
    name,
    phone,
    items: itemsChosen,
    total,
    columnHeaders,
    quantities,
    pickup,        // "Yes" | "No" | ""
    deliveryNote,  // required only when pickup === "No"
  };
}

// ---------- UI wiring ----------

// Quantity inputs recalc
document.querySelectorAll(".qty-input").forEach((i) => i.addEventListener("input", compute));

// Reset quantities button
const resetBtn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    document.querySelectorAll(".qty-input").forEach((i) => (i.value = ""));
    compute();
  });
}

// Pickup dropdown conditional note
const pickupSelect = document.getElementById("pickup-select");
const noteWrap = document.getElementById("delivery-note-wrap");
const noteInput = document.querySelector('textarea[name="deliveryNote"]');

function togglePickupNote() {
  const val = pickupSelect ? pickupSelect.value : "";
  if (val === "No") {
    noteWrap?.classList.remove("hidden");
    noteInput?.setAttribute("required", "required");
  } else {
    noteWrap?.classList.add("hidden");
    noteInput?.removeAttribute("required");
    if (noteInput) noteInput.value = "";
  }
}
if (pickupSelect) {
  pickupSelect.addEventListener("change", togglePickupNote);
  togglePickupNote(); // initialize on load
}

// Initial compute
compute();

// Submit handler
document.getElementById("order-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("status");
  const btn = document.getElementById("submit-btn");

  // Cutoff guard on the client
  if (orderingClosed()) {
    if (status) status.textContent = CLOSED_MSG;
    lockFormUI();
    return;
  }

  const order = collectOrder();

  // Validation
  if (!order.name || !order.phone) {
    if (status) status.textContent = "Please enter your name and phone number.";
    return;
  }
  if (!order.pickup) {
    if (status) status.textContent = "Please select if you will pick up and pay at the bake sale on Oct 18.";
    return;
  }
  if (order.pickup === "No" && !order.deliveryNote) {
    if (status) status.textContent = "Please tell us how we can get your items to you.";
    return;
  }
  if (order.items.length === 0) {
    if (status) status.textContent = "Please add at least one item.";
    return;
  }

  if (btn) btn.disabled = true;
  if (status) status.textContent = "Submitting…";

  try {
    const res = await fetch(FETCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });

    // If server says "closed", show message and lock UI.
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (status) status.textContent = data.message || CLOSED_MSG;
      lockFormUI();
      return;
    }

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const data = await res.json().catch(() => ({}));
    if (status) status.textContent = `Thank you! Order ${data.orderId || ""} received.`;

    // Reset selections (keep Name/Phone so they can adjust if needed)
    document.querySelectorAll(".qty-input").forEach((i) => (i.value = ""));
    if (pickupSelect) pickupSelect.value = "";
    togglePickupNote();
    compute();
  } catch (err) {
    console.error(err);
    if (status) status.textContent = "Sorry—there was a problem sending your order. Please try again.";
  } finally {
    if (btn) btn.disabled = false;
  }
});
