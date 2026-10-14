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

/* ================= CLOUD STORAGE (FIREBASE FIRESTORE) ================= */
let adminUnsubscribe = null;

const Store = {
  key: 'crescent_orders_v1',

  async all() {
    if (window.db && window.firestoreOps) {
      try {
        const { collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(window.db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), docId: doc.id });
        });
        return list;
      } catch (err) {
        console.error("Firestore read error, falling back to localStorage:", err);
      }
    }
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  },

  async add(order) {
    if (window.db && window.firestoreOps) {
      try {
        const { collection, addDoc, serverTimestamp } = window.firestoreOps;
        const docRef = await addDoc(collection(window.db, "orders"), {
          ...order,
          createdAt: serverTimestamp()
        });
        order.docId = docRef.id;
        return;
      } catch (err) {
        console.error("Firestore write error, falling back to localStorage:", err);
      }
    }
    const list = await this.all();
    list.push(order);
    localStorage.setItem(this.key, JSON.stringify(list));
  },

  async update(orderId, patch) {
    if (window.db && window.firestoreOps) {
      try {
        const { collection, query, where, getDocs, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(window.db, "orders"), where("id", "==", orderId));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => {
          await updateDoc(doc(window.db, "orders", d.id), patch);
        });
        return;
      } catch (err) {
        console.error("Firestore update error, falling back to localStorage:", err);
      }
    }
    const list = await this.all();
    const o = list.find((x) => x.id === orderId);
    if (o) Object.assign(o, patch);
    localStorage.setItem(this.key, JSON.stringify(list));
  }
};

/* ================= PAYMENT ================= */
const Payment = {
  async pay(order) {
    await sleep(900);
    return { method: 'cash', status: 'pending' };
  }
};

/* ================= STATE ================= */
let students = [];
let session = null;                // { role:'student'|'admin', id, profile }
let cart = {};                     // { half: 1, ... }
let adminMode = false;

/* ================= VIEWS ================= */
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el =
