/* ================= CONFIG ================= */
const CONFIG = {
  // NOTE: these admin credentials are visible to anyone who views the source.
  // Fine for a demo; move to a real backend before going live (see README).
  adminId: 'admin',
  adminPassword: 'crescent@admin',

  // Set enforceCutoff to true to stop orders after cutoffHour (24h clock).
  enforceCutoff: false,
  cutoffHour: 10,

  menu: [
    { id: 'half',  name: 'Half Biriyani', price: 100, emoji: '🍛', desc: 'Fragrant biriyani, a lighter portion' },
    { id: 'full',  name: 'Full Biriyani', price: 180, emoji: '🍲', desc: 'Full plate, extra filling' },
    { id: 'meals', name: 'Meals',         price: 60,  emoji: '🍱', desc: 'Rice, curries, sides' }
  ],
  classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  divisions: ['A', 'B', 'C', 'D', 'E', 'F']
};

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rupees = (n) => '₹' + n.toLocaleString('en-IN');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const itemById = (id) => CONFIG.menu.find((m) => m.id === id);

/* ================= STORAGE =================
   Orders are kept in this browser's localStorage so the site works on
   GitHub Pages with no server. That means the admin only sees orders placed
   from the SAME browser. For real use across phones, replace the methods in
   Store with calls to Firebase / Supabase / Google Sheets (same 3 methods). */
const Store = {
  key: 'crescent_orders_v1',
  async all() {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  },
  async add(order) {
    const list = await this.all();
    list.push(order);
    localStorage.setItem(this.key, JSON.stringify(list));
  },
  async update(id, patch) {
    const list = await this.all();
    const o = list.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
    localStorage.setItem(this.key, JSON.stringify(list));
  }
};

/* ================= PAYMENT =================
   Placeholder. When adding Razorpay, create a Razorpay order on your server,
   open Razorpay Checkout here, and resolve with { method:'razorpay', status:'paid', paymentId }. */
const Payment = {
  async pay(order) {
    await sleep(900);
    return { method: 'cash', status: 'pending' };
  }
};

/* ================= STATE ================= */
let students = [];
let session = null;               // { role:'student'|'admin', id, profile }
let cart = {};                    // { half: 1, ... }
let adminMode = false;

/* ================= VIEWS ================= */
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = $('view-' + name);
  void el.offsetWidth;            // restart animation
  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const openModal = (id) => $(id).classList.add('open');
const closeModal = (id) => $(id).classList.remove('open');

/* ================= CSV ================= */
function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    head.forEach((h, i) => (row[h] = cells[i] || ''));
    return row;
  });
}
async function loadStudents() {
  try {
    const res = await fetch('students.csv', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    students = parseCSV(await res.text());
  } catch (e) {
    $('loginError').textContent = 'Could not load students.csv. If testing locally, run a local server (see README).';
  }
}

/* ================= LOGIN ================= */
$('toggleAdmin').addEventListener('click', () => {
  adminMode = !adminMode;
  $('loginTitle').textContent = adminMode ? 'Admin 🔐' : 'Welcome 👋';
  $('loginSub').textContent = adminMode ? 'Log in to view and collect orders.' : 'Log in with the student ID and password to order lunch.';
  $('toggleAdmin').textContent = adminMode ? 'Student login' : 'Admin login';
  $('loginId').placeholder = adminMode ? 'Admin ID' : 'e.g. CPS1001';
  $('loginError').textContent = '';
});

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('loginId').value.trim();
  const pass = $('loginPass').value;

  if (adminMode) {
    if (id === CONFIG.adminId && pass === CONFIG.adminPassword) return startSession({ role: 'admin', id });
    return fail();
  }
  const s = students.find((x) => (x.student_id || '').toLowerCase() === id.toLowerCase());
  if (s && s.password === pass) return startSession({ role: 'student', id: s.student_id, profile: s });
  fail();

  function fail() {
    $('loginError').textContent = 'Incorrect ID or password.';
    const card = document.querySelector('.login-card');
    card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }], { duration: 300 });
  }
});

function startSession(s) {
  session = s;
  sessionStorage.setItem('crescent_session', JSON.stringify(s));
  $('loginForm').reset();
  $('loginError').textContent = '';
  $('userLabel').textContent = s.role === 'admin' ? 'Admin' : s.id;
  $('userChip').classList.remove('hidden');
  if (s.role === 'admin') { initAdmin(); showView('admin'); }
  else { cart = {}; renderMenu(); updateCart(); showView('menu'); }
}

$('logoutBtn').addEventListener('click', () => {
  session = null; cart = {};
  sessionStorage.removeItem('crescent_session');
  $('userChip').classList.add('hidden');
  closeModal('modalAdded'); closeModal('modalCheckout');
  showView('login');
});

/* ================= MENU & CART ================= */
function isClosed() {
  return CONFIG.enforceCutoff && new Date().getHours() >= CONFIG.cutoffHour;
}

function renderMenu() {
  $('cutoffNote').textContent = isClosed()
    ? 'Ordering is closed for today (cut-off 10:00 AM).'
    : 'Order before 10:00 AM — no need to inform the class teacher.';
  $('menuGrid').innerHTML = CONFIG.menu.map((m) => `
    <article class="food-card" data-id="${m.id}">
      <div class="food-emoji">${m.emoji}</div>
      <h3>${m.name}</h3>
      <p class="desc">${m.desc}</p>
      <div class="price">${rupees(m.price)}</div>
      <div class="action"></div>
    </article>`).join('');
  CONFIG.menu.forEach((m) => renderAction(m.id));
}

function renderAction(id) {
  const holder = document.querySelector(`.food-card[data-id="${id}"] .action`);
  const q = cart[id] || 0;
  if (!q) {
    holder.innerHTML = `<button class="btn-primary" ${isClosed() ? 'disabled' : ''}>Add</button>`;
    holder.querySelector('button').onclick = () => { changeQty(id, 1); showAdded(id); };
  } else {
    holder.innerHTML = `<div class="stepper"><button aria-label="Less">−</button><span>${q}</span><button aria-label="More">+</button></div>`;
    const [minus, plus] = holder.querySelectorAll('button');
    minus.onclick = () => changeQty(id, -1);
    plus.onclick = () => changeQty(id, 1);
  }
}

function changeQty(id, delta) {
  const next = Math.max(0, Math.min(20, (cart[id] || 0) + delta));
  if (next) cart[id] = next; else delete cart[id];
  renderAction(id);
  const span = document.querySelector(`.food-card[data-id="${id}"] .stepper span`);
  if (span) span.classList.add('qty-bump');
  updateCart();
}

function cartLines() {
  return Object.entries(cart).map(([id, qty]) => ({ id, name: itemById(id).name, qty, price: itemById(id).price, sub: qty * itemById(id).price }));
}
const cartTotal = () => cartLines().reduce((s, l) => s + l.sub, 0);
const cartCount = () => cartLines().reduce((s, l) => s + l.qty, 0);

function updateCart() {
  const n = cartCount();
  $('cartCount').textContent = n + (n === 1 ? ' item' : ' items');
  $('cartTotal').textContent = rupees(cartTotal());
  $('cartBar').classList.toggle('show', n > 0);
}

function linesHTML(lines, total) {
  return lines.map((l) => `<div class="line"><span>${esc(l.name)} × ${l.qty}</span><span>${rupees(l.sub)}</span></div>`).join('')
    + `<div class="line total"><span>Total</span><span>${rupees(total)}</span></div>`;
}

/* ---- "Added" popup ---- */
function showAdded(id) {
  $('addedTitle').textContent = itemById(id).name + ' added!';
  $('addedLines').innerHTML = linesHTML(cartLines(), cartTotal());
  openModal('modalAdded');
}
$('addMoreBtn').addEventListener('click', () => closeModal('modalAdded'));
$('proceedBtn').addEventListener('click', () => { closeModal('modalAdded'); openCheckout(); });
$('cartCheckout').addEventListener('click', openCheckout);

/* ================= CHECKOUT ================= */
function fillSelect(sel, values) {
  values.forEach((v) => sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
}
fillSelect($('coClass'), CONFIG.classes);
fillSelect($('coDiv'), CONFIG.divisions);
fillSelect($('adminClass'), CONFIG.classes.map((c) => c));

function openCheckout() {
  if (!cartCount()) return;
  const p = (session && session.profile) || {};
  $('coName').value = $('coName').value || p.name || '';
  if (p.class && !$('coClass').value) $('coClass').value = p.class;
  if (p.division && !$('coDiv').value) $('coDiv').value = p.division.toUpperCase();
  $('coLines').innerHTML = linesHTML(cartLines(), cartTotal());
  checkConfirmReady();
  openModal('modalCheckout');
}
$('coCancel').addEventListener('click', () => closeModal('modalCheckout'));

function checkConfirmReady() {
  const ok = $('coName').value.trim() && $('coClass').value && $('coDiv').value;
  $('confirmWrap').classList.toggle('show', !!ok);
}
['coName', 'coClass', 'coDiv'].forEach((id) => {
  $(id).addEventListener('input', checkConfirmReady);
  $(id).addEventListener('change', checkConfirmReady);
});

$('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isClosed()) { alert('Ordering is closed for today.'); return; }
  const btn = $('confirmBtn');
  btn.disabled = true; btn.textContent = 'Placing order…';

  const lines = cartLines();
  const order = {
    id: 'CF' + todayStr().replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    date: todayStr(),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    studentId: session.id,
    name: $('coName').value.trim(),
    cls: $('coClass').value,
    division: $('coDiv').value,
    items: lines.map(({ id, name, qty, price }) => ({ id, name, qty, price })),
    total: cartTotal(),
    collected: false
  };
  const pay = await Payment.pay(order);
  order.paymentMethod = pay.method;
  order.paymentStatus = pay.status;
  await Store.add(order);

  closeModal('modalCheckout');
  btn.disabled = false; btn.textContent = 'Confirm order';
  showSuccess(order);
  cart = {}; updateCart(); renderMenu();
  $('checkoutForm').reset(); $('confirmWrap').classList.remove('show');
});

function showSuccess(order) {
  $('sOrderId').textContent = order.id;
  $('sAmount').textContent = rupees(order.total);
  $('sSummary').innerHTML =
    `<div class="line"><span>${esc(order.name)}</span><span>Class ${esc(order.cls)}-${esc(order.division)}</span></div>` +
    linesHTML(order.items.map((i) => ({ ...i, sub: i.qty * i.price })), order.total);
  showView('success');
  // pulse ring behind the tick
  const old = document.querySelector('.tick-ring'); if (old) old.remove();
  const ring = document.createElement('span'); ring.className = 'tick-ring';
  const tick = document.querySelector('.success-card .tick');
  tick.parentNode.style.position = 'relative';
  tick.insertAdjacentElement('beforebegin', ring);
  ring.style.left = tick.offsetLeft + 'px';
}
$('newOrderBtn').addEventListener('click', () => { showView('menu'); });

/* ================= ADMIN ================= */
function initAdmin() {
  $('adminDate').value = todayStr();
  renderAdmin();
}
['adminDate', 'adminClass'].forEach((id) => $(id).addEventListener('change', renderAdmin));

async function filteredOrders() {
  const date = $('adminDate').value;
  const cls = $('adminClass').value;
  return (await Store.all()).filter((o) => (!date || o.date === date) && (!cls || String(o.cls) === cls));
}

async function renderAdmin() {
  const orders = await filteredOrders();
  const total = orders.reduce((s, o) => s + o.total, 0);
  const collected = orders.filter((o) => o.collected).reduce((s, o) => s + o.total, 0);
  const count = (id) => orders.reduce((s, o) => s + o.items.filter((i) => i.id === id).reduce((a, i) => a + i.qty, 0), 0);

  $('adminStats').innerHTML = [
    ['Orders', orders.length],
    ...CONFIG.menu.map((m) => [m.name, count(m.id)]),
    ['Total cash to collect', rupees(total), 'highlight'],
    ['Collected', rupees(collected)],
    ['Pending', rupees(total - collected)]
  ].map(([label, val, cls], i) => `<div class="stat ${cls || ''}" style="animation-delay:${i * 50}ms"><small>${label}</small><b>${val}</b></div>`).join('');

  // by class + division
  const groups = {};
  orders.forEach((o) => {
    const k = `${o.cls}-${o.division}`;
    const g = (groups[k] = groups[k] || { orders: 0, amount: 0, items: {} });
    g.orders++; g.amount += o.total;
    o.items.forEach((i) => (g.items[i.id] = (g.items[i.id] || 0) + i.qty));
  });
  const keys = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
  $('classTable').innerHTML = keys.length
    ? `<thead><tr><th>Class</th><th>Orders</th>${CONFIG.menu.map((m) => `<th>${m.name}</th>`).join('')}<th>Amount</th></tr></thead><tbody>` +
      keys.map((k) => `<tr><td>${esc(k)}</td><td>${groups[k].orders}</td>${CONFIG.menu.map((m) => `<td>${groups[k].items[m.id] || 0}</td>`).join('')}<td>${rupees(groups[k].amount)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="empty">No orders for this selection.</td></tr></tbody>';

  // all orders
  $('orderTable').innerHTML = orders.length
    ? `<thead><tr><th>Time</th><th>Student ID</th><th>Name</th><th>Class</th><th>Items</th><th>Amount</th><th>Collected</th></tr></thead><tbody>` +
      orders.slice().reverse().map((o, i) => `<tr style="animation-delay:${i * 30}ms">
        <td>${esc(o.time)}</td><td>${esc(o.studentId)}</td><td>${esc(o.name)}</td>
        <td>${esc(o.cls)}-${esc(o.division)}</td>
        <td>${o.items.map((it) => `${esc(it.name)} × ${it.qty}`).join(', ')}</td>
        <td>${rupees(o.total)}</td>
        <td><input type="checkbox" data-id="${esc(o.id)}" ${o.collected ? 'checked' : ''}> <span class="badge ${o.collected ? 'done' : 'pending'}">${o.collected ? 'Collected' : 'Pending'}</span></td>
      </tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="empty">No orders yet.</td></tr></tbody>';

  $('orderTable').querySelectorAll('input[type=checkbox]').forEach((cb) =>
    cb.addEventListener('change', async () => { await Store.update(cb.dataset.id, { collected: cb.checked }); renderAdmin(); }));
}

$('exportBtn').addEventListener('click', async () => {
  const orders = await filteredOrders();
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Order ID', 'Date', 'Time', 'Student ID', 'Name', 'Class', 'Division', 'Items', 'Amount', 'Collected']]
    .concat(orders.map((o) => [o.id, o.date, o.time, o.studentId, o.name, o.cls, o.division, o.items.map((i) => `${i.name} x${i.qty}`).join('; '), o.total, o.collected ? 'Yes' : 'No']));
  const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `crescent-orders-${$('adminDate').value || 'all'}.csv`;
  a.click();
});

/* close popups on backdrop click */
document.querySelectorAll('.modal-backdrop').forEach((b) =>
  b.addEventListener('mousedown', (e) => { if (e.target === b) b.classList.remove('open'); }));

/* ================= INIT ================= */
(async function init() {
  await loadStudents();
  const saved = sessionStorage.getItem('crescent_session');
  if (saved) { try { startSession(JSON.parse(saved)); } catch {} }
})();
