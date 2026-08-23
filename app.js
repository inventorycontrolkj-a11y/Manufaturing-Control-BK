import { firebaseConfig } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------------
// Konfigurasi role: menentukan menu, warna, dan label per user
// ---------------------------------------------------------------
const ROLES = {
  lkj:        { label: "Pabrik LKJ",      color: "--lkj",        pabrik: "LKJ",
                menu: ["input-bmb","rekap-bmb","input-do","rekap-do","stock-opname","riwayat-opname","sisa-so","sisa-barang"] },
  jlp:        { label: "Pabrik JLP",      color: "--jlp",        pabrik: "JLP",
                menu: ["input-bmb","rekap-bmb","input-do","rekap-do","stock-opname","riwayat-opname","sisa-so","sisa-barang"] },
  marketing:  { label: "Marketing",       color: "--marketing",
                menu: ["input-so","rekap-so","sisa-barang"] },
  ekspedisi:  { label: "Team Ekspedisi",  color: "--ekspedisi",
                menu: ["input-nodo","rekap-do"] },
  admin:      { label: "Admin",           color: "--danger",
                menu: ["manage-users","master-data","input-so","rekap-so"] },
};

const VIEW_TITLES = {
  "input-bmb": "Input BMB", "rekap-bmb": "Rekap BMB",
  "input-do": "Input DO", "rekap-do": "Rekap DO",
  "sisa-so": "Sisa Sales Order", "sisa-barang": "Sisa Barang",
  "input-so": "Input Sales Order", "rekap-so": "Rekap Sales Order",
  "input-nodo": "Input Nomor DO", "manage-users": "Kelola User & Akses",
  "stock-opname": "Stock Opname", "riwayat-opname": "Riwayat Stock Opname",
  "master-data": "Data Master (Barang · Angkutan · Customer)",
};

// Ikon SVG kecil, dipakai di header form & tombol (tanpa library eksternal)
const ICONS = {
  building: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="9" y1="12" x2="9" y2="12.01"/><line x1="9" y1="15" x2="9" y2="15.01"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  save: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  plus: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  clipboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><rect x="5" y="4" width="14" height="18" rx="2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  box: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8L12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
};

// Koleksi data master & definisi kolomnya (dipakai untuk import Excel, form manual, dan tabel)
const MASTER_LISTS = {
  barang: {
    collection: "masterBarang", label: "Nama Barang",
    namaPatterns: ["SINGKATAN"],
    specCols: [
      { key: "kw", label: "KW", patterns: ["KW"] },
      { key: "ukuran", label: "Ukuran", patterns: ["UKURAN"] },
      { key: "isi", label: "Isi", patterns: ["ISI"] },
      { key: "beratPack", label: "Berat/Pack", patterns: ["BERAT/PACK", "BERAT PACK"] },
      { key: "beratEkspedisi", label: "Berat Ekspedisi", patterns: ["BERAT EKSPEDISI"] },
      { key: "harga", label: "Harga Satuan/Pack", patterns: ["HARGA"] },
      { key: "perIkat", label: "Per Ikat", patterns: ["PER IKAT"] },
      { key: "perBall", label: "Per Ball", patterns: ["PER BALL"] },
    ],
  },
  angkutan: {
    collection: "masterAngkutan", label: "Nama Angkutan",
    namaPatterns: ["NAMA PERUSAHAAN", "PERUSAHAAN ANGKUTAN", "NAMA ANGKUTAN"],
    specCols: [
      { key: "tujuan", label: "Tujuan", patterns: ["TUJUAN"] },
      { key: "harga", label: "Harga", patterns: ["HARGA"] },
      { key: "ongkosKuli", label: "Ongkos Kuli", patterns: ["ONGKOS KULI", "ONGKOS"] },
    ],
  },
  customer: {
    collection: "masterCustomer", label: "Nama Customer",
    namaPatterns: ["CUSTOMER", "NAMA CUSTOMER"],
    specCols: [],
  },
  sales: {
    collection: "masterSales", label: "Nama Sales",
    namaPatterns: ["SALES", "NAMA SALES"],
    specCols: [],
  },
};

let currentUser = null;
let currentRole = null;
let currentView = null;
let unsubscribers = []; // active onSnapshot listeners, cleared on view/logout change

// ---------------------------------------------------------------
// Elemen DOM
// ---------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const loginScreen = $("#login-screen");
const appScreen = $("#app-screen");
const loginForm = $("#login-form");
const loginError = $("#login-error");
const emailInput = $("#email");
const passwordInput = $("#password");
const modeToggle = $("#mode-toggle");
const submitBtn = $("#submit-btn");
const toast = $("#toast");

let mode = "signin"; // signin | signup

modeToggle.addEventListener("click", () => {
  mode = mode === "signin" ? "signup" : "signin";
  submitBtn.textContent = mode === "signin" ? "Masuk" : "Daftar Akun Baru";
  modeToggle.textContent = mode === "signin"
    ? "Belum punya akun? Daftar"
    : "Sudah punya akun? Masuk";
  loginError.style.display = "none";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  try {
    if (mode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Buat dokumen user dengan role "pending" — admin harus set role-nya
      await setDoc(doc(db, "users", cred.user.uid), {
        email, role: "pending", createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    loginError.textContent = friendlyAuthError(err.code);
    loginError.style.display = "block";
  }
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Akun tidak ditemukan.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email sudah terdaftar. Silakan masuk.",
    "auth/weak-password": "Password minimal 6 karakter.",
  };
  return map[code] || "Terjadi kesalahan. Coba lagi.";
}

// ---------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  clearListeners();
  if (!user) {
    currentUser = null; currentRole = null;
    delete document.body.dataset.role;
    loginScreen.style.display = "flex";
    appScreen.classList.remove("active");
    loginForm.reset();
    return;
  }
  currentUser = user;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || !ROLES[snap.data().role]) {
    loginScreen.style.display = "flex";
    appScreen.classList.remove("active");
    loginError.textContent = "Akun Anda belum diberi akses role. Hubungi admin untuk mengaktifkan akun.";
    loginError.style.display = "block";
    return;
  }
  currentRole = snap.data().role;
  loginScreen.style.display = "none";
  appScreen.classList.add("active");
  buildShell();
});

$("#logout-btn").addEventListener("click", () => signOut(auth));

// ---------------------------------------------------------------
// Shell: sidebar + menu per role
// ---------------------------------------------------------------
function buildShell() {
  const cfg = ROLES[currentRole];
  document.documentElement.style.setProperty("--role-color", `var(${cfg.color})`);
  document.body.dataset.role = currentRole; // dipakai CSS untuk aksen warna khusus per role (mis. JLP biru)
  $("#role-badge").textContent = cfg.label;
  $("#who").textContent = currentUser.email;

  const nav = $("#nav-menu");
  nav.innerHTML = "";
  cfg.menu.forEach((viewId, i) => {
    const btn = document.createElement("button");
    btn.textContent = VIEW_TITLES[viewId];
    btn.dataset.view = viewId;
    btn.addEventListener("click", () => switchView(viewId));
    nav.appendChild(btn);
  });
  switchView(cfg.menu[0]);
}

function switchView(viewId) {
  currentView = viewId;
  document.querySelectorAll("#nav-menu button").forEach(b =>
    b.classList.toggle("active", b.dataset.view === viewId));
  $("#view-title").textContent = VIEW_TITLES[viewId];
  clearListeners();
  const main = $("#view-body");
  main.innerHTML = "";
  RENDERERS[viewId](main);
}

function clearListeners() {
  unsubscribers.forEach(u => u());
  unsubscribers = [];
}

function showToast(msg, type = "ok") {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove("show"), 2800);
}

// ---------------------------------------------------------------
// Helpers Firestore
// ---------------------------------------------------------------
function todayStr() { return new Date().toISOString().slice(0, 10); }

function addDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtTanggalPanjang(isoDate) {
  if (!isoDate) return "-";
  const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${bulan[m - 1]} ${y}`;
}

// Parsing angka yang toleran terhadap format Indonesia (koma sebagai desimal,
// mis. dari Excel "1,47"), selain format angka biasa (titik sebagai desimal).
function toNumberID(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === "") return 0;
  const str = String(val).trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function fmtNum(n) {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

function listenCollection(colName, constraints, cb) {
  const q = query(collection(db, colName), ...constraints);
  const unsub = onSnapshot(q, (snap) => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    cb(rows);
  }, (err) => showToast("Gagal memuat data: " + err.message, "err"));
  unsubscribers.push(unsub);
}

// ---------------------------------------------------------------
// Hitung Sisa Stock per produk, dengan Stock Opname sebagai titik pijakan.
// Kalau produk pernah di-opname, hanya BMB/DO SETELAH tanggal opname terakhir
// yang dihitung di atas Stock Awal hasil opname itu (supaya tidak dobel-hitung
// saat opname diulang tiap bulan). Kalau belum pernah di-opname, dihitung dari
// total BMB - total DO seperti biasa (baseline 0).
// ---------------------------------------------------------------
function buildStockMap(opnameRows, bmbRows, doRows) {
  const latestOpname = {}; // produk -> entri opname terbaru
  opnameRows.forEach(r => {
    const existing = latestOpname[r.produk];
    if (!existing || (r.tanggalOpname || "") > (existing.tanggalOpname || "")) {
      latestOpname[r.produk] = r;
    }
  });

  const produkSet = new Set([
    ...bmbRows.map(r => r.produk),
    ...doRows.map(r => r.produk),
    ...Object.keys(latestOpname),
  ]);

  const map = {};
  produkSet.forEach(produk => {
    const opname = latestOpname[produk];
    const baseline = opname ? (Number(opname.stockAwal) || 0) : 0;
    const cutoff = opname ? (opname.tanggalOpname || "") : null;
    const masuk = bmbRows
      .filter(r => r.produk === produk && (!cutoff || (r.tanggal || "") > cutoff))
      .reduce((s, r) => s + (Number(r.jumlah) || 0), 0);
    const keluar = doRows
      .filter(r => r.produk === produk && (!cutoff || (r.tanggal || "") > cutoff))
      .reduce((s, r) => s + (Number(r.jumlah) || 0), 0);
    map[produk] = baseline + masuk - keluar;
  });
  return map;
}

// ---------------------------------------------------------------
// Isi <select> dari salah satu daftar data master (barang/angkutan/customer),
// realtime — otomatis update kalau admin menambah/menghapus data master.
// ---------------------------------------------------------------
function populateMasterSelect(selectEl, masterKey, placeholder) {
  const { collection: colName } = MASTER_LISTS[masterKey];
  listenCollection(colName, [orderBy("nama")], (rows) => {
    const current = selectEl.value;
    // dedupe nama (mis. data Angkutan bisa punya nama sama untuk tujuan berbeda-beda)
    const uniqueNames = [...new Set(rows.map(r => r.nama).filter(Boolean))];
    selectEl.innerHTML = `<option value="" disabled ${!current ? "selected" : ""}>${placeholder}</option>`;
    if (!uniqueNames.length) {
      const opt = document.createElement("option");
      opt.value = ""; opt.disabled = true;
      opt.textContent = "Belum ada data — minta admin tambahkan di menu Data Master";
      selectEl.appendChild(opt);
      return;
    }
    uniqueNames.forEach(nama => {
      const opt = document.createElement("option");
      opt.value = nama; opt.textContent = nama;
      if (nama === current) opt.selected = true;
      selectEl.appendChild(opt);
    });
  });
}

// ---------------------------------------------------------------
// Field ketik + cari (autocomplete). BEDA dari versi sebelumnya: fungsi ini
// TIDAK bikin sambungan Firestore sendiri — dikasih getNames() (fungsi yang
// mengembalikan daftar nama TERKINI) supaya banyak field bisa berbagi SATU
// sambungan data yang sudah dimuat sejak halaman dibuka. Ini menghindari
// bug "saran kadang muncul kadang tidak" yang terjadi kalau tiap baris tabel
// bikin sambungannya sendiri-sendiri (baris baru = sambungan baru = ada jeda
// sebelum datanya siap).
// onPick(nama) dipanggil saat user memilih salah satu saran dari daftar.
// ---------------------------------------------------------------
function buildAutocomplete(getNames, placeholder, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "autocomplete-wrap";
  wrap.innerHTML = `<input type="text" autocomplete="off" placeholder="${placeholder}">`;
  const input = wrap.querySelector("input");

  // Kotak saran ditempel ke <body>, BUKAN di dalam tabel — supaya tidak
  // ikut kepotong oleh area tabel yang overflow-x:auto (batasan CSS bawaan:
  // elemen dengan overflow-x selain 'visible' otomatis ikut membatasi
  // overflow-y juga, walau tidak diminta).
  const listBox = document.createElement("div");
  listBox.className = "suggest-list suggest-list-portal";
  document.body.appendChild(listBox);

  let currentMatches = [];
  let activeIndex = -1;

  function positionList() {
    const r = input.getBoundingClientRect();
    listBox.style.left = r.left + "px";
    listBox.style.top = (r.bottom + 4) + "px";
    listBox.style.width = r.width + "px";
  }

  function pick(n) {
    input.value = n;
    input.classList.remove("invalid-select");
    listBox.classList.remove("show");
    if (onPick) onPick(n);
  }

  function highlight(index) {
    activeIndex = index;
    [...listBox.querySelectorAll(".suggest-item")].forEach((el, i) => {
      el.classList.toggle("active", i === activeIndex);
      if (i === activeIndex) el.scrollIntoView({ block: "nearest" });
    });
  }

  function showSuggestions() {
    positionList();
    const names = getNames() || [];
    const keyword = input.value.trim().toLowerCase();
    currentMatches = names.filter(n => n.toLowerCase().includes(keyword)).slice(0, 50);
    activeIndex = -1;
    listBox.innerHTML = "";
    if (!currentMatches.length) {
      listBox.innerHTML = `<div class="suggest-empty">Tidak ditemukan</div>`;
    } else {
      currentMatches.forEach(n => {
        const item = document.createElement("div");
        item.className = "suggest-item";
        item.textContent = n;
        item.addEventListener("mousedown", (e) => { e.preventDefault(); pick(n); });
        listBox.appendChild(item);
      });
    }
    listBox.classList.add("show");
  }

  input.addEventListener("input", () => { input.classList.remove("invalid-select"); showSuggestions(); });
  input.addEventListener("focus", showSuggestions);
  input.addEventListener("keydown", (e) => {
    if (!listBox.classList.contains("show") || !currentMatches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlight(Math.min(activeIndex + 1, currentMatches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        pick(currentMatches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      listBox.classList.remove("show");
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      listBox.classList.remove("show");
      const val = input.value.trim();
      const names = getNames() || [];
      if (val && !names.includes(val)) {
        input.value = "";
        input.classList.add("invalid-select");
      }
      if (onPick) onPick(input.value);
    }, 150);
  });
  // Sembunyikan kalau HALAMAN yang di-scroll (posisi kotak saran jadi tidak
  // akurat lagi) — tapi biarkan scroll DI DALAM kotak saran itu sendiri jalan
  // normal (sebelumnya ini yang bikin scroll di kotak saran malah menutupnya).
  window.addEventListener("scroll", (e) => {
    if (listBox.contains(e.target)) return;
    listBox.classList.remove("show");
  }, true);

  return {
    wrap, input,
    destroy: () => listBox.remove(), // wajib dipanggil kalau baris/field ini dihapus dari layar
  };
}

// ---------------------------------------------------------------
// Komponen UI generik
// ---------------------------------------------------------------
function card(title) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<h2>${title}</h2>`;
  return el;
}

function makeTable(headers, rows, renderRow, emptyText = "Belum ada data") {
  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody></tbody>`;
  const tbody = table.querySelector("tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${headers.length}">${emptyText}</td></tr>`;
  } else {
    rows.forEach(r => tbody.appendChild(renderRow(r)));
  }
  return table;
}

function statCard(label, value, sub, colorVar) {
  const el = document.createElement("div");
  el.className = "stat";
  if (colorVar) el.style.setProperty("--stat-color", `var(${colorVar})`);
  el.innerHTML = `<div class="label">${label}</div><div class="value mono">${value}</div><div class="sub">${sub || ""}</div>`;
  return el;
}

// ---------------------------------------------------------------
// Nomor BMB otomatis: format YYMM + urutan 3 digit, per pabrik per bulan
// (mis. 2608001 = tahun 2026, bulan 08, urutan ke-1)
// ---------------------------------------------------------------
async function nextBMBNumber(pabrik) {
  const now = new Date();
  const prefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const counterRef = doc(db, "counters", `bmb_${pabrik}_${prefix}`);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? snap.data().seq : 0) + 1;
    tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() });
    return next;
  });
  return prefix + String(seq).padStart(3, "0");
}

// ---------------------------------------------------------------
// VIEW: Input BMB (LKJ / JLP) — form multi-baris ala kertas FORM BMB,
// dengan No. BMB otomatis dan Stock Saat Ini / Stock + BMB terisi sendiri.
// ---------------------------------------------------------------
function renderInputBMB(main) {
  const pabrik = ROLES[currentRole].pabrik;
  const c = card("");
  c.querySelector("h2").remove();

  // --- header ikon: FORM BMB / Pabrik LKJ|JLP ---
  const headerRow = document.createElement("div");
  headerRow.className = "header-icon-row";
  headerRow.innerHTML = `
    <div class="header-icon-box">${ICONS.building}</div>
    <div>
      <div class="header-icon-title">FORM BMB</div>
      <div class="header-icon-sub">Pabrik ${pabrik}</div>
    </div>
  `;
  c.appendChild(headerRow);

  // --- header: No. BMB (otomatis) & Tanggal ---
  const header = document.createElement("div");
  header.className = "form-grid";
  header.style.marginBottom = "18px";
  header.innerHTML = `
    <div class="field"><label>No. BMB</label><input name="noBMB" class="mono" value="Memuat..." disabled></div>
    <div class="field"><label>Tanggal</label><input name="tanggal" type="date" value="${todayStr()}" required></div>
  `;
  c.appendChild(header);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));
  const noBMBInput = header.querySelector("input[name=noBMB]");
  const tanggalInput = header.querySelector("input[name=tanggal]");

  nextBMBNumber(pabrik).then(no => { noBMBInput.value = no; })
    .catch(err => { noBMBInput.value = "-"; showToast("Gagal membuat No. BMB: " + err.message, "err"); });

  // --- stok saat ini, dihitung live dari Stock Opname + BMB & DO pabrik ini ---
  let stockMap = {}; // produk -> sisa stok saat ini
  let opnameRows = [], bmbRowsRaw = [], doRowsRaw = [];
  function recomputeStock() {
    stockMap = buildStockMap(opnameRows, bmbRowsRaw, doRowsRaw);
    refreshAllRows();
  }
  listenCollection("stockOpname", [where("pabrik", "==", pabrik)], (rows) => { opnameRows = rows; recomputeStock(); });
  listenCollection("bmb", [where("pabrik", "==", pabrik)], (rows) => { bmbRowsRaw = rows; recomputeStock(); });
  listenCollection("deliveryOrders", [where("pabrik", "==", pabrik)], (rows) => { doRowsRaw = rows; recomputeStock(); });

  // --- tabel baris input ---
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-bordered-wrap";
  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>
      <th style="width:36px;">No</th>
      <th style="width:280px;max-width:280px;">Nama Barang</th>
      <th style="width:120px;">Qty BMB</th>
      <th style="width:130px;">Stock Saat Ini</th>
      <th style="width:130px;">Stock + BMB</th>
      <th style="width:40px;"></th>
    </tr></thead><tbody></tbody>`;
  table.style.tableLayout = "fixed";
  const tbody = table.querySelector("tbody");
  tableWrap.appendChild(table);
  c.appendChild(tableWrap);

  function refreshAllRows() {
    tbody.querySelectorAll("tr").forEach(updateRowCalc);
  }

  function updateRowCalc(tr) {
    const select = tr.querySelector("select[name=produk]");
    const qtyInput = tr.querySelector("input[name=qty]");
    const stokCell = tr.querySelector(".cell-stok-saat-ini");
    const stokBaruCell = tr.querySelector(".cell-stok-baru");
    const produk = select.value;
    const qty = Number(qtyInput.value) || 0;
    const stokSaatIni = produk ? (stockMap[produk] || 0) : null;
    stokCell.textContent = produk ? fmtNum(stokSaatIni) : "-";
    stokBaruCell.textContent = produk ? fmtNum(stokSaatIni + qty) : "-";
  }

  function addRow() {
    const tr = document.createElement("tr");
    const rowNo = tbody.children.length + 1;
    tr.innerHTML = `
      <td><span class="row-num-badge">${rowNo}</span></td>
      <td data-label="Nama Barang"><select name="produk" style="width:100%;"></select></td>
      <td data-label="Qty BMB"><input name="qty" type="number" min="0" step="any" placeholder="0" style="width:100%;"></td>
      <td class="num cell-stok-saat-ini" data-label="Stock Saat Ini">-</td>
      <td class="num cell-stok-baru" data-label="Stock + BMB">-</td>
      <td><button type="button" class="btn btn-danger" style="width:auto;padding:6px 9px;">${ICONS.trash}</button></td>
    `;
    const select = tr.querySelector("select[name=produk]");
    populateMasterSelect(select, "barang", "Pilih...");
    select.addEventListener("change", () => updateRowCalc(tr));
    tr.querySelector("input[name=qty]").addEventListener("input", () => updateRowCalc(tr));
    tr.querySelector("button").addEventListener("click", () => {
      tr.remove();
      renumberRows();
    });
    tbody.appendChild(tr);
  }

  function renumberRows() {
    [...tbody.children].forEach((tr, i) => { tr.querySelector(".row-num-badge").textContent = i + 1; });
  }

  for (let i = 0; i < 6; i++) addRow();

  const addRowBtn = document.createElement("button");
  addRowBtn.type = "button";
  addRowBtn.className = "btn btn-outline-accent";
  addRowBtn.style.cssText = "width:auto;padding:8px 16px;margin-top:12px;";
  addRowBtn.innerHTML = `${ICONS.plus} Tambah Baris`;
  addRowBtn.addEventListener("click", addRow);
  c.appendChild(addRowBtn);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));

  // --- simpan semua baris yang terisi ---
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.style.cssText = "width:auto;padding:11px 28px;display:block;";
  saveBtn.innerHTML = `${ICONS.save} Simpan Data`;
  saveBtn.addEventListener("click", async () => {
    const noBMB = noBMBInput.value;
    const tanggal = tanggalInput.value;
    if (!tanggal) { showToast("Isi tanggal dulu", "err"); return; }
    const entries = [...tbody.children].map(tr => ({
      produk: tr.querySelector("select[name=produk]").value,
      qty: Number(tr.querySelector("input[name=qty]").value) || 0,
    })).filter(e => e.produk && e.qty > 0);

    if (!entries.length) { showToast("Isi minimal satu baris (produk & qty)", "err"); return; }

    saveBtn.disabled = true; saveBtn.innerHTML = "Menyimpan...";
    try {
      await Promise.all(entries.map(e => addDoc(collection(db, "bmb"), {
        pabrik, produk: e.produk, jumlah: e.qty, tanggal, noBMB,
        stockSaatInput: stockMap[e.produk] || 0,
        stockSetelahBMB: (stockMap[e.produk] || 0) + e.qty,
        createdBy: currentUser.email, createdAt: serverTimestamp(),
      })));
      showToast(`Form BMB ${noBMB} tersimpan (${entries.length} item)`);
      // reset: nomor baru, tanggal hari ini, tabel kosong lagi
      tbody.innerHTML = "";
      for (let i = 0; i < 6; i++) addRow();
      tanggalInput.value = todayStr();
      noBMBInput.value = "Memuat...";
      nextBMBNumber(pabrik).then(no => { noBMBInput.value = no; });
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      saveBtn.disabled = false; saveBtn.innerHTML = `${ICONS.save} Simpan Data`;
    }
  });
  c.appendChild(saveBtn);

  main.appendChild(c);
}

// ---------------------------------------------------------------
// VIEW: Rekap BMB
// ---------------------------------------------------------------
function renderRekapBMB(main) {
  const pabrik = ROLES[currentRole].pabrik;
  const c = card(`Rekap BMB — Pabrik ${pabrik}`);
  const holder = document.createElement("div");
  c.appendChild(holder);
  main.appendChild(c);
  listenCollection("bmb",
    [where("pabrik", "==", pabrik), orderBy("tanggal", "desc")],
    (rows) => {
      holder.innerHTML = "";
      holder.appendChild(makeTable(
        ["No. BMB", "Tanggal", "Produk", "Qty BMB", "Stock Saat Input", "Stock + BMB", "Input Oleh"],
        rows,
        (r) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td class="mono">${r.noBMB || "-"}</td><td>${r.tanggal}</td><td>${r.produk}</td>
            <td class="num">${fmtNum(r.jumlah)}</td>
            <td class="num">${r.stockSaatInput !== undefined ? fmtNum(r.stockSaatInput) : "-"}</td>
            <td class="num">${r.stockSetelahBMB !== undefined ? fmtNum(r.stockSetelahBMB) : "-"}</td>
            <td>${r.createdBy}</td>`;
          return tr;
        }
      ));
    });
}

// ---------------------------------------------------------------
// VIEW: Input DO (LKJ / JLP)
// ---------------------------------------------------------------
function renderInputDO(main) {
  const pabrik = ROLES[currentRole].pabrik;
  const c = card(`Input Delivery Order — Pabrik ${pabrik}`);
  const form = document.createElement("form");
  form.className = "form-grid";
  form.innerHTML = `
    <div class="field"><label>No. DO</label><input name="noDO" required placeholder="mis. DO-0001"></div>
    <div class="field"><label>Produk</label><select name="produk" required></select></div>
    <div class="field"><label>Jumlah</label><input name="jumlah" type="number" min="0" step="any" required></div>
    <div class="field"><label>Tanggal</label><input name="tanggal" type="date" value="${todayStr()}" required></div>
    <div class="field"><label>No. Sales Order (opsional)</label><input name="salesOrderRef" placeholder="referensi SO"></div>
    <button class="btn btn-primary" type="submit">Simpan DO</button>
  `;
  populateMasterSelect(form.produk, "barang", "Pilih produk...");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await addDoc(collection(db, "deliveryOrders"), {
        pabrik, noDO: f.get("noDO").trim(), produk: f.get("produk").trim(),
        jumlah: Number(f.get("jumlah")), tanggal: f.get("tanggal"),
        salesOrderRef: f.get("salesOrderRef") || "",
        shipped: false, tanggalKirim: null,
        createdBy: currentUser.email, createdAt: serverTimestamp(),
      });
      showToast("DO tersimpan");
      form.reset();
      form.tanggal.value = todayStr();
    } catch (err) { showToast(err.message, "err"); }
  });
  c.appendChild(form);
  main.appendChild(c);
}

// ---------------------------------------------------------------
// VIEW: Rekap DO (dipakai LKJ, JLP, Ekspedisi)
// ---------------------------------------------------------------
function renderRekapDO(main) {
  const cfg = ROLES[currentRole];
  const isEkspedisi = currentRole === "ekspedisi";
  const c = card(isEkspedisi ? "Rekap Semua Delivery Order" : `Rekap DO — Pabrik ${cfg.pabrik}`);
  const holder = document.createElement("div");
  c.appendChild(holder);
  main.appendChild(c);

  const constraints = isEkspedisi
    ? [orderBy("tanggal", "desc")]
    : [where("pabrik", "==", cfg.pabrik), orderBy("tanggal", "desc")];

  listenCollection("deliveryOrders", constraints, (rows) => {
    holder.innerHTML = "";
    const headers = isEkspedisi
      ? ["No. DO", "Pabrik", "Produk", "Jumlah", "Tanggal", "Angkutan", "Status Kirim"]
      : ["No. DO", "Produk", "Jumlah", "Tanggal", "Ref. SO", "Status Kirim"];
    holder.appendChild(makeTable(headers, rows, (r) => {
      const tr = document.createElement("tr");
      const statusBadge = r.shipped
        ? `<span class="badge badge-ok">Dikirim ${r.tanggalKirim || ""}</span>`
        : `<span class="badge badge-wait">Menunggu</span>`;
      if (isEkspedisi) {
        tr.innerHTML = `<td>${r.noDO}</td><td>${r.pabrik}</td><td>${r.produk}</td>
          <td class="num">${fmtNum(r.jumlah)}</td><td>${r.tanggal}</td><td>${r.angkutan || "-"}</td><td>${statusBadge}</td>`;
      } else {
        tr.innerHTML = `<td>${r.noDO}</td><td>${r.produk}</td>
          <td class="num">${fmtNum(r.jumlah)}</td><td>${r.tanggal}</td>
          <td>${r.salesOrderRef || "-"}</td><td>${statusBadge}</td>`;
      }
      return tr;
    }));
  });
}

// ---------------------------------------------------------------
// VIEW: Stock Opname (LKJ / JLP) — form multi-baris, hasil hitung fisik
// jadi Stock Awal baru mulai tanggal opname (BMB/DO sebelumnya "dikunci").
// ---------------------------------------------------------------
function renderStockOpname(main) {
  const pabrik = ROLES[currentRole].pabrik;
  const c = card("");
  c.querySelector("h2").remove();

  const headerRow = document.createElement("div");
  headerRow.className = "header-icon-row";
  headerRow.innerHTML = `
    <div class="header-icon-box">${ICONS.building}</div>
    <div>
      <div class="header-icon-title">Stock Opname</div>
      <div class="header-icon-sub">Pabrik ${pabrik}</div>
    </div>
  `;
  c.appendChild(headerRow);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.style.marginBottom = "16px";
  hint.textContent = "Isi hasil hitung fisik gudang di kolom Stock Fisik. Setelah disimpan, angka ini jadi Stock Awal baru — BMB & DO SEBELUM tanggal opname ini tidak lagi memengaruhi Sisa Stock, hanya transaksi SETELAH tanggal ini yang dihitung di atasnya.";
  c.appendChild(hint);

  const header = document.createElement("div");
  header.className = "form-grid";
  header.style.marginBottom = "18px";
  header.innerHTML = `<div class="field"><label>Tanggal Opname</label><input name="tanggalOpname" type="date" value="${todayStr()}" required></div>`;
  c.appendChild(header);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));
  const tanggalInput = header.querySelector("input[name=tanggalOpname]");

  // stok sistem saat ini (sebelum opname baru ini disimpan) — buat pembanding
  let opnameRows = [], bmbRows = [], doRows = [];
  let systemStockMap = {};
  function recomputeSystemStock() {
    systemStockMap = buildStockMap(opnameRows, bmbRows, doRows);
    refreshAllRows();
  }
  listenCollection("stockOpname", [where("pabrik", "==", pabrik)], (rows) => { opnameRows = rows; recomputeSystemStock(); });
  listenCollection("bmb", [where("pabrik", "==", pabrik)], (rows) => { bmbRows = rows; recomputeSystemStock(); });
  listenCollection("deliveryOrders", [where("pabrik", "==", pabrik)], (rows) => { doRows = rows; recomputeSystemStock(); });

  // --- Import dari Excel ---
  const excelCard = document.createElement("div");
  excelCard.style.marginBottom = "18px";
  excelCard.innerHTML = `
    <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">
      Import Hasil Opname dari Excel (.xlsx / .xls)
    </label>
    <div class="hint" style="margin-bottom:8px;">
      Kolom yang dikenali otomatis: Nama Barang, Stock Fisik. Tanggal opname memakai tanggal yang diisi di atas untuk semua baris di file ini. Baris pertama harus judul kolom.
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <input type="file" id="opname-excel-file" accept=".xlsx,.xls" style="color:var(--text-dim);font-size:13px;">
      <button type="button" class="btn btn-primary" id="btn-opname-excel-import" style="width:auto;padding:9px 18px;">${ICONS.save} Import Excel</button>
    </div>
    <div id="opname-excel-status" class="hint" style="margin-top:8px;"></div>
  `;
  c.appendChild(excelCard);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));

  excelCard.querySelector("#btn-opname-excel-import").addEventListener("click", () => {
    const fileInput = excelCard.querySelector("#opname-excel-file");
    const statusEl = excelCard.querySelector("#opname-excel-status");
    const tanggalOpname = tanggalInput.value;
    const file = fileInput.files[0];
    if (!tanggalOpname) { showToast("Isi tanggal opname dulu", "err"); return; }
    if (!file) { showToast("Pilih file Excel dulu", "err"); return; }
    if (typeof XLSX === "undefined") {
      showToast("Library Excel belum termuat, refresh halaman dan coba lagi", "err");
      return;
    }
    statusEl.textContent = "Membaca file...";
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) { statusEl.textContent = "File kosong atau format tidak terbaca."; return; }

        const headers = Object.keys(rows[0]);
        const namaCol = findColumn(headers, ["NAMA BARANG", "SINGKATAN", "BARANG", "NAMA"]);
        const fisikCol = findColumn(headers, ["STOCK FISIK", "STOK FISIK", "QTY", "JUMLAH"]);
        if (!namaCol || !fisikCol) {
          statusEl.textContent = "Kolom 'Nama Barang' dan/atau 'Stock Fisik' tidak ditemukan di file ini — import dibatalkan.";
          return;
        }

        const docs = rows
          .map(r => ({
            produk: String(r[namaCol] || "").trim(),
            fisik: Number(r[fisikCol]),
          }))
          .filter(d => d.produk && !isNaN(d.fisik));

        if (!docs.length) { statusEl.textContent = "Tidak ada baris dengan nama barang & stock fisik yang valid."; return; }

        statusEl.textContent = `Mengimpor ${docs.length} data opname...`;
        await Promise.all(docs.map(d => {
          const sistem = systemStockMap[d.produk] || 0;
          return addDoc(collection(db, "stockOpname"), {
            pabrik, produk: d.produk, tanggalOpname,
            stockAwal: d.fisik, stockSistemSebelum: sistem, selisih: d.fisik - sistem,
            createdBy: currentUser.email, createdAt: serverTimestamp(),
          });
        }));
        statusEl.textContent = `Berhasil import ${docs.length} data opname.`;
        showToast(`${docs.length} hasil Stock Opname berhasil diimport`);
        fileInput.value = "";
      } catch (err) {
        statusEl.textContent = "Gagal membaca file: " + err.message;
        showToast("Import gagal: " + err.message, "err");
      }
    };
    reader.readAsArrayBuffer(file);
  });

  const manualLabel = document.createElement("div");
  manualLabel.className = "hint";
  manualLabel.style.marginBottom = "10px";
  manualLabel.textContent = "Atau isi manual per barang di tabel berikut:";
  c.appendChild(manualLabel);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-bordered-wrap";
  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>
      <th style="width:36px;">No</th>
      <th style="width:260px;max-width:260px;">Nama Barang</th>
      <th style="width:130px;">Stock Sistem</th>
      <th style="width:130px;">Stock Fisik</th>
      <th style="width:110px;">Selisih</th>
      <th style="width:40px;"></th>
    </tr></thead><tbody></tbody>`;
  table.style.tableLayout = "fixed";
  const tbody = table.querySelector("tbody");
  tableWrap.appendChild(table);
  c.appendChild(tableWrap);

  function refreshAllRows() { tbody.querySelectorAll("tr").forEach(updateRowCalc); }

  function updateRowCalc(tr) {
    const produk = tr.querySelector("select[name=produk]").value;
    const fisikInput = tr.querySelector("input[name=fisik]");
    const fisik = fisikInput.value === "" ? null : Number(fisikInput.value);
    const sistemCell = tr.querySelector(".cell-sistem");
    const selisihCell = tr.querySelector(".cell-selisih");
    const sistem = produk ? (systemStockMap[produk] || 0) : null;
    sistemCell.textContent = produk ? fmtNum(sistem) : "-";
    if (produk && fisik !== null) {
      const selisih = fisik - sistem;
      selisihCell.textContent = (selisih > 0 ? "+" : "") + fmtNum(selisih);
      selisihCell.style.color = selisih === 0 ? "var(--text-dim)" : (selisih > 0 ? "var(--ok)" : "var(--danger)");
    } else {
      selisihCell.textContent = "-";
      selisihCell.style.color = "";
    }
  }

  function addRow() {
    const tr = document.createElement("tr");
    const rowNo = tbody.children.length + 1;
    tr.innerHTML = `
      <td><span class="row-num-badge">${rowNo}</span></td>
      <td data-label="Nama Barang"><select name="produk" style="width:100%;"></select></td>
      <td class="num cell-sistem" data-label="Stock Sistem">-</td>
      <td data-label="Stock Fisik"><input name="fisik" type="number" min="0" step="any" placeholder="0" style="width:100%;"></td>
      <td class="num cell-selisih" data-label="Selisih">-</td>
      <td><button type="button" class="btn btn-danger" style="width:auto;padding:6px 9px;">${ICONS.trash}</button></td>
    `;
    const select = tr.querySelector("select[name=produk]");
    populateMasterSelect(select, "barang", "Pilih...");
    select.addEventListener("change", () => updateRowCalc(tr));
    tr.querySelector("input[name=fisik]").addEventListener("input", () => updateRowCalc(tr));
    tr.querySelector("button").addEventListener("click", () => { tr.remove(); renumberRows(); });
    tbody.appendChild(tr);
  }
  function renumberRows() {
    [...tbody.children].forEach((tr, i) => { tr.querySelector(".row-num-badge").textContent = i + 1; });
  }
  for (let i = 0; i < 6; i++) addRow();

  const addRowBtn = document.createElement("button");
  addRowBtn.type = "button";
  addRowBtn.className = "btn btn-outline-accent";
  addRowBtn.style.cssText = "width:auto;padding:8px 16px;margin-top:12px;";
  addRowBtn.innerHTML = `${ICONS.plus} Tambah Baris`;
  addRowBtn.addEventListener("click", addRow);
  c.appendChild(addRowBtn);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.style.cssText = "width:auto;padding:11px 28px;display:block;";
  saveBtn.innerHTML = `${ICONS.save} Simpan Hasil Opname`;
  saveBtn.addEventListener("click", async () => {
    const tanggalOpname = tanggalInput.value;
    if (!tanggalOpname) { showToast("Isi tanggal opname dulu", "err"); return; }
    const entries = [...tbody.children].map(tr => ({
      produk: tr.querySelector("select[name=produk]").value,
      fisik: tr.querySelector("input[name=fisik]").value,
    })).filter(e => e.produk && e.fisik !== "");

    if (!entries.length) { showToast("Isi minimal satu baris (produk & stock fisik)", "err"); return; }

    saveBtn.disabled = true; saveBtn.innerHTML = "Menyimpan...";
    try {
      await Promise.all(entries.map(e => {
        const fisikNum = Number(e.fisik);
        const sistem = systemStockMap[e.produk] || 0;
        return addDoc(collection(db, "stockOpname"), {
          pabrik, produk: e.produk, tanggalOpname,
          stockAwal: fisikNum, stockSistemSebelum: sistem, selisih: fisikNum - sistem,
          createdBy: currentUser.email, createdAt: serverTimestamp(),
        });
      }));
      showToast(`Stock Opname tersimpan (${entries.length} item)`);
      tbody.innerHTML = "";
      for (let i = 0; i < 6; i++) addRow();
      tanggalInput.value = todayStr();
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      saveBtn.disabled = false; saveBtn.innerHTML = `${ICONS.save} Simpan Hasil Opname`;
    }
  });
  c.appendChild(saveBtn);

  main.appendChild(c);
}

// ---------------------------------------------------------------
// VIEW: Riwayat Stock Opname (LKJ / JLP)
// ---------------------------------------------------------------
function renderRiwayatOpname(main) {
  const pabrik = ROLES[currentRole].pabrik;
  const c = card(`Riwayat Stock Opname — Pabrik ${pabrik}`);
  const holder = document.createElement("div");
  holder.style.overflowX = "auto";
  c.appendChild(holder);
  main.appendChild(c);

  listenCollection("stockOpname", [where("pabrik", "==", pabrik), orderBy("tanggalOpname", "desc")], (rows) => {
    holder.innerHTML = "";
    holder.appendChild(makeTable(
      ["Tanggal Opname", "Produk", "Stock Sistem (Sebelum)", "Stock Fisik (Hasil Opname)", "Selisih", "Diinput Oleh"],
      rows,
      (r) => {
        const tr = document.createElement("tr");
        const selisih = r.selisih !== undefined ? r.selisih : (r.stockAwal - (r.stockSistemSebelum || 0));
        const selisihColor = selisih === 0 ? "" : (selisih > 0 ? "color:var(--ok);" : "color:var(--danger);");
        tr.innerHTML = `<td>${r.tanggalOpname}</td><td>${r.produk}</td>
          <td class="num">${fmtNum(r.stockSistemSebelum || 0)}</td>
          <td class="num">${fmtNum(r.stockAwal)}</td>
          <td class="num" style="${selisihColor}">${(selisih > 0 ? "+" : "") + fmtNum(selisih)}</td>
          <td>${r.createdBy}</td>`;
        return tr;
      },
      "Belum ada riwayat Stock Opname"
    ));
  });
}

// ---------------------------------------------------------------
// VIEW: Sisa Barang (LKJ / JLP: stok pabrik sendiri, Marketing: semua pabrik)
// ---------------------------------------------------------------
function renderSisaBarang(main) {
  const isMarketing = currentRole === "marketing";
  const pabrikList = isMarketing ? ["LKJ", "JLP"] : [ROLES[currentRole].pabrik];
  const c = card(isMarketing ? "Sisa Barang — Semua Pabrik" : `Sisa Barang — Pabrik ${pabrikList[0]}`);
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.style.marginBottom = "14px";
  hint.textContent = "Dihitung dari hasil Stock Opname terakhir (kalau ada) ditambah BMB dan dikurangi DO setelah tanggal opname tersebut.";
  c.appendChild(hint);
  const statHolder = document.createElement("div");
  statHolder.className = "stat-grid";
  c.appendChild(statHolder);
  main.appendChild(c);

  let opnameRows = [], bmbRows = [], doRows = [];
  const recompute = () => {
    const entries = [];
    pabrikList.forEach(pabrik => {
      const map = buildStockMap(
        opnameRows.filter(r => r.pabrik === pabrik),
        bmbRows.filter(r => r.pabrik === pabrik),
        doRows.filter(r => r.pabrik === pabrik)
      );
      Object.entries(map).forEach(([produk, sisa]) => entries.push({ pabrik, produk, sisa }));
    });
    entries.sort((a, b) => a.produk.localeCompare(b.produk));
    statHolder.innerHTML = "";
    if (!entries.length) {
      statHolder.innerHTML = `<div class="hint">Belum ada data BMB/DO/Opname untuk dihitung.</div>`;
      return;
    }
    entries.forEach(e => {
      const colorVar = e.pabrik === "LKJ" ? "--lkj" : "--jlp";
      statHolder.appendChild(statCard(
        `${e.produk}${isMarketing ? " · " + e.pabrik : ""}`,
        fmtNum(e.sisa), "", colorVar
      ));
    });
  };

  listenCollection("stockOpname", [where("pabrik", "in", pabrikList)], (rows) => { opnameRows = rows; recompute(); });
  listenCollection("bmb", [where("pabrik", "in", pabrikList)], (rows) => { bmbRows = rows; recompute(); });
  listenCollection("deliveryOrders", [where("pabrik", "in", pabrikList)], (rows) => { doRows = rows; recompute(); });
}

// ---------------------------------------------------------------
// VIEW: Sisa Sales Order (LKJ / JLP)
// ---------------------------------------------------------------
function renderSisaSO(main) {
  const c = card("Sisa Sales Order (Belum Terpenuhi)");
  const statHolder = document.createElement("div");
  statHolder.className = "stat-grid";
  c.appendChild(statHolder);
  main.appendChild(c);

  let soRows = [], doRows = [];
  const recompute = () => {
    const byProduk = {};
    soRows.forEach(r => {
      byProduk[r.produk] = byProduk[r.produk] || { produk: r.produk, order: 0, kirim: 0 };
      byProduk[r.produk].order += Number(r.jumlah) || 0;
    });
    doRows.forEach(r => {
      byProduk[r.produk] = byProduk[r.produk] || { produk: r.produk, order: 0, kirim: 0 };
      byProduk[r.produk].kirim += Number(r.jumlah) || 0;
    });
    const entries = Object.values(byProduk).sort((a, b) => a.produk.localeCompare(b.produk));
    statHolder.innerHTML = "";
    if (!entries.length) {
      statHolder.innerHTML = `<div class="hint">Belum ada Sales Order tercatat.</div>`;
      return;
    }
    entries.forEach(e => {
      const sisa = e.order - e.kirim;
      statHolder.appendChild(statCard(
        e.produk, fmtNum(sisa),
        `Order ${fmtNum(e.order)} · Terkirim ${fmtNum(e.kirim)}`,
        sisa > 0 ? "--marketing" : "--jlp"
      ));
    });
  };

  listenCollection("salesOrders", [], (rows) => { soRows = rows; recompute(); });
  listenCollection("deliveryOrders", [], (rows) => { doRows = rows; recompute(); });
}

// ---------------------------------------------------------------
// Nomor Sales Order: urutan global sederhana (bukan format tanggal), supaya
// mudah di-set ulang oleh admin ke angka berapa pun (mis. mulai dari 7000).
// Disimpan di counters/salesOrderSeq, field "seq" = nomor TERAKHIR yang dipakai.
// ---------------------------------------------------------------
async function nextSONumber() {
  const counterRef = doc(db, "counters", "salesOrderSeq");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? snap.data().seq : 0) + 1;
    tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() });
    return next;
  });
  return String(seq);
}

// Lihat nomor SO berikutnya TANPA memakai/mengunci nomornya (dipakai Admin
// supaya membuka halaman ini tidak menghabiskan satu nomor urut sia-sia).
async function nextPreviewSONumber() {
  const snap = await getDoc(doc(db, "counters", "salesOrderSeq"));
  const current = snap.exists() ? snap.data().seq : 0;
  return current + 1;
}

// ---------------------------------------------------------------
// VIEW: Input Sales Order (Marketing) — banner nomor SO otomatis,
// tabel multi-barang dengan bonus % & total qty terhitung otomatis.
// ---------------------------------------------------------------
function renderInputSO(main) {
  const wrap = document.createElement("div");
  const c = card("");
  c.querySelector("h2").remove();

  // --- header ikon: SALES ORDER, senada dengan Form BMB ---
  const headerRow = document.createElement("div");
  headerRow.className = "header-icon-row";
  headerRow.innerHTML = `
    <div class="header-icon-box">${ICONS.clipboard}</div>
    <div>
      <div class="header-icon-title">SALES ORDER</div>
      <div class="header-icon-sub">Input pesanan customer</div>
    </div>
  `;
  c.appendChild(headerRow);

  const isAdmin = currentRole === "admin";

  // --- header: No. Sales Order, Tanggal SO, Batas Kirim ---
  const header = document.createElement("div");
  header.className = "form-grid";
  header.style.marginBottom = "18px";
  const tanggalSO = todayStr();
  const batasKirim = addDays(tanggalSO, 7);
  header.innerHTML = `
    <div class="field">
      <label>No. Sales Order${isAdmin ? "" : " (otomatis)"}</label>
      <div class="input-with-btn">
        <input name="noSO" class="mono" value="Memuat..." ${isAdmin ? "" : "disabled"}>
        <button type="button" class="icon-btn" id="btn-copy-noso" title="Salin nomor">${ICONS.copy}</button>
      </div>
    </div>
    <div class="field">
      <label>Tanggal SO (otomatis)</label>
      <div class="readonly-box">${fmtTanggalPanjang(tanggalSO)}</div>
    </div>
    <div class="field">
      <label>Batas Kirim (otomatis, H+7)</label>
      <div class="readonly-box">${fmtTanggalPanjang(batasKirim)}</div>
    </div>
  `;
  c.appendChild(header);
  const soNoInput = header.querySelector("input[name=noSO]");
  header.querySelector("#btn-copy-noso").addEventListener("click", () => {
    navigator.clipboard.writeText(soNoInput.value)
      .then(() => showToast("Nomor SO disalin"))
      .catch(() => showToast("Gagal menyalin", "err"));
  });
  // Sekadar intip nomor berikutnya — TIDAK memakai/mengunci nomor.
  // Nomor baru benar-benar dipakai (dan urutan bertambah) hanya saat tombol
  // simpan diklik, supaya berpindah menu tidak membuat nomor meloncat.
  nextPreviewSONumber().then(n => { soNoInput.value = String(n); })
    .catch(err => { soNoInput.value = "-"; showToast("Gagal memuat No. SO: " + err.message, "err"); });
  if (!isAdmin) {
    const noteEl = document.createElement("div");
    noteEl.className = "hint";
    noteEl.style.marginTop = "-10px";
    noteEl.style.marginBottom = "10px";
    noteEl.textContent = "Nomor dibuat otomatis dan hanya bisa diubah oleh Admin.";
    header.after(noteEl);
  } else {
    const noteEl = document.createElement("div");
    noteEl.className = "hint";
    noteEl.style.marginTop = "-10px";
    noteEl.style.marginBottom = "10px";
    noteEl.textContent = "Ubah angka ini untuk mengatur ulang nomor urut Sales Order berikutnya (berlaku untuk semua Marketing). Boleh diisi tanpa mengisi barang di bawah — klik \"Simpan Perubahan\" untuk menyimpan nomornya saja.";
    header.after(noteEl);
  }
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));

  // --- info: sales, customer ---
  const infoForm = document.createElement("form");
  infoForm.addEventListener("submit", (e) => e.preventDefault());
  infoForm.className = "form-grid";
  infoForm.style.marginBottom = "18px";
  infoForm.innerHTML = `
    <div class="field"><label>Sales</label><select name="sales" required></select></div>
    <div class="field" id="customer-field"><label>Customer</label></div>
  `;
  c.appendChild(infoForm);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));
  populateMasterSelect(infoForm.sales, "sales", "Pilih sales...");

  // --- daftar nama customer & barang, dimuat SEKALI di sini dan dipakai
  // bareng-bareng semua field autocomplete di halaman ini (termasuk baris
  // barang yang ditambah belakangan) — supaya tidak ada jeda "saran kosong"
  // tiap kali baris baru dibuat.
  let customerNames = [];
  listenCollection(MASTER_LISTS.customer.collection, [orderBy("nama")], (rows) => {
    customerNames = [...new Set(rows.map(r => r.nama).filter(Boolean))];
  });
  const { wrap: customerWrap, input: customerInput } = buildAutocomplete(() => customerNames, "Ketik nama customer...", null);
  infoForm.querySelector("#customer-field").appendChild(customerWrap);

  // --- lookup harga & berat dari data master barang (juga sumber saran Nama Barang) ---
  let barangMap = {};
  listenCollection("masterBarang", [], (rows) => {
    barangMap = {};
    rows.forEach(r => { barangMap[r.nama] = r; });
  });

  // --- tabel daftar barang ---
  const toolbar = document.createElement("div");
  toolbar.className = "item-toolbar";
  toolbar.innerHTML = `<h2 style="margin:0;text-transform:none;font-size:15px;color:var(--text);">${ICONS.box} Daftar Barang</h2>`;
  const addRowBtn = document.createElement("button");
  addRowBtn.type = "button";
  addRowBtn.className = "btn btn-outline-accent btn-add-row";
  addRowBtn.innerHTML = `${ICONS.plus} Tambah Barang`;
  toolbar.appendChild(addRowBtn);
  c.appendChild(toolbar);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-bordered-wrap item-table-wrap";
  tableWrap.innerHTML = `<table>
    <thead><tr>
      <th style="width:34px;">No</th>
      <th style="min-width:170px;">Nama Barang</th>
      <th style="width:110px;">Harga/Pack</th>
      <th style="width:100px;">Qty Order</th>
      <th style="width:90px;">Bonus (%)</th>
      <th style="width:90px;">Qty Bonus</th>
      <th style="width:90px;">Total Qty</th>
      <th style="min-width:140px;">Keterangan</th>
      <th style="width:40px;"></th>
    </tr></thead>
    <tbody></tbody>
  </table>`;
  c.appendChild(tableWrap);
  const tbody = tableWrap.querySelector("tbody");

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.style.margin = "10px 0 4px";
  hint.textContent = "Qty Bonus = (persentase bonus × qty order), dibulatkan ke bawah ke kelipatan 5. Total Qty = Qty Order + Qty Bonus.";
  c.appendChild(hint);
  c.appendChild(Object.assign(document.createElement("hr"), { className: "divider" }));

  function hitungQtyBonus(qtyOrder, bonusPct) {
    const rawBonus = qtyOrder * bonusPct / 100;
    return Math.floor(rawBonus / 5) * 5;
  }

  function calcRow(tr) {
    const produk = tr.querySelector(".barang-input-el").value;
    const qtyOrder = Number(tr.querySelector("input[name=qtyOrder]").value) || 0;
    const bonusPct = Number(tr.querySelector("input[name=bonusPct]").value) || 0;
    const qtyBonus = hitungQtyBonus(qtyOrder, bonusPct);
    const totalQty = qtyOrder + qtyBonus;
    tr.querySelector(".cell-qty-bonus").textContent = fmtNum(qtyBonus);
    tr.querySelector(".cell-total-qty").textContent = fmtNum(totalQty);
    const hargaInput = tr.querySelector("input[name=harga]");
    hargaInput.value = (produk && barangMap[produk] && barangMap[produk].harga) ? barangMap[produk].harga : "";
    updateSummary();
  }

  function addItemRow() {
    const tr = document.createElement("tr");
    const rowNo = tbody.children.length + 1;
    tr.innerHTML = `
      <td><span class="row-num-badge">${rowNo}</span></td>
      <td class="nama-barang-cell" data-label="Nama Barang"></td>
      <td data-label="Harga/Pack"><input name="harga" placeholder="-" disabled></td>
      <td data-label="Qty Order"><input name="qtyOrder" type="number" min="0" step="any" placeholder="0"></td>
      <td data-label="Bonus (%)"><input name="bonusPct" type="number" min="0" step="any" placeholder="0"></td>
      <td class="num cell-qty-bonus" data-label="Qty Bonus">0</td>
      <td class="num cell-total-qty" data-label="Total Qty">0</td>
      <td data-label="Keterangan"><input name="keterangan" placeholder="Catatan (opsional)"></td>
      <td><button type="button" class="btn btn-danger row-del-btn" style="width:auto;padding:6px 9px;">${ICONS.trash}</button></td>
    `;
    const namaCell = tr.querySelector(".nama-barang-cell");
    const { wrap: barangWrap, input: produkInput, destroy: destroyBarangAutocomplete } =
      buildAutocomplete(() => Object.keys(barangMap), "Ketik nama barang...", () => calcRow(tr));
    produkInput.classList.add("barang-input-el");
    namaCell.appendChild(barangWrap);
    tr._destroyAutocomplete = destroyBarangAutocomplete; // dipakai saat Reset / hapus baris

    tr.querySelector("input[name=qtyOrder]").addEventListener("input", () => calcRow(tr));
    tr.querySelector("input[name=bonusPct]").addEventListener("input", () => calcRow(tr));
    tr.querySelector(".row-del-btn").addEventListener("click", () => {
      destroyBarangAutocomplete();
      tr.remove();
      renumberItemRows();
      updateSummary();
    });
    tbody.appendChild(tr);
  }
  function renumberItemRows() {
    [...tbody.children].forEach((tr, i) => { tr.querySelector(".row-num-badge").textContent = i + 1; });
  }
  addRowBtn.addEventListener("click", addItemRow);
  addItemRow();

  // --- catatan + ringkasan total ---
  const bottomWrap = document.createElement("div");
  bottomWrap.className = "two-col";
  const noteCard = card("Catatan Sales Order");
  const noteTextarea = document.createElement("textarea");
  noteTextarea.className = "textarea-note";
  noteTextarea.placeholder = "Tulis catatan tambahan untuk sales order ini (opsional)...";
  noteCard.appendChild(noteTextarea);

  const summaryCardOuter = document.createElement("div");
  summaryCardOuter.innerHTML = `
    <div class="card summary-panel">
      <div class="sp-item"><div class="label">Total Item</div><div class="val" id="sp-total-item">0</div></div>
      <div class="sp-item"><div class="label">Total Qty</div><div class="val" id="sp-total-qty">0</div></div>
      <div class="sp-item"><div class="label">Estimasi Tonase</div><div class="val" id="sp-total-tonase">0 kg</div></div>
    </div>
  `;
  bottomWrap.appendChild(noteCard);
  bottomWrap.appendChild(summaryCardOuter);
  c.appendChild(bottomWrap);

  function updateSummary() {
    let totalItem = 0, totalQty = 0, totalTonase = 0;
    [...tbody.children].forEach(tr => {
      const produk = tr.querySelector(".barang-input-el").value;
      const qtyOrder = Number(tr.querySelector("input[name=qtyOrder]").value) || 0;
      const bonusPct = Number(tr.querySelector("input[name=bonusPct]").value) || 0;
      const totalQtyRow = qtyOrder + hitungQtyBonus(qtyOrder, bonusPct);
      if (produk && qtyOrder > 0) {
        totalItem++;
        totalQty += totalQtyRow;
        const berat = barangMap[produk] ? toNumberID(barangMap[produk].beratEkspedisi) : 0;
        totalTonase += berat * totalQtyRow;
      }
    });
    summaryCardOuter.querySelector("#sp-total-item").textContent = fmtNum(totalItem);
    summaryCardOuter.querySelector("#sp-total-qty").textContent = fmtNum(totalQty);
    summaryCardOuter.querySelector("#sp-total-tonase").textContent = fmtNum(Math.round(totalTonase)) + " kg";
  }
  updateSummary();

  // --- tombol Reset & Simpan ---
  const actions = document.createElement("div");
  actions.className = "form-actions";
  actions.innerHTML = `
    <button type="button" class="btn" id="btn-reset-so">↺ Reset</button>
    <button type="button" class="btn btn-primary" id="btn-save-so">${ICONS.save} ${isAdmin ? "Simpan Perubahan" : "Simpan Data"}</button>
  `;
  c.appendChild(actions);
  wrap.appendChild(c);
  main.appendChild(wrap);

  actions.querySelector("#btn-reset-so").addEventListener("click", () => {
    infoForm.reset();
    populateMasterSelect(infoForm.sales, "sales", "Pilih sales...");
    customerInput.value = "";
    customerInput.classList.remove("invalid-select");
    [...tbody.children].forEach(tr => { if (tr._destroyAutocomplete) tr._destroyAutocomplete(); });
    tbody.innerHTML = "";
    addItemRow();
    noteTextarea.value = "";
    updateSummary();
  });

  function collectItems() {
    return [...tbody.children].map(tr => {
      const produk = tr.querySelector(".barang-input-el").value;
      const qtyOrder = Number(tr.querySelector("input[name=qtyOrder]").value) || 0;
      const bonusPct = Number(tr.querySelector("input[name=bonusPct]").value) || 0;
      const qtyBonus = hitungQtyBonus(qtyOrder, bonusPct);
      return {
        produk, harga: tr.querySelector("input[name=harga]").value || "",
        qtyOrder, bonusPct, qtyBonus, totalQty: qtyOrder + qtyBonus,
        keteranganItem: tr.querySelector("input[name=keterangan]").value || "",
      };
    }).filter(it => it.produk && it.qtyOrder > 0);
  }

  // Barang qty-order & qty-bonus DIPISAH jadi 2 nomor SO berurutan:
  // - noSO (mis. 7001): baris normal, harga terisi, kolom bonus kosong.
  // - noSO+1 (mis. 7002): baris bonus (hanya barang yang bonusnya > 0),
  //   qty-nya = qty bonus, harga kosong, kolom bonus terisi persentasenya.
  // itemIndex = urutan barang persis seperti di form, dipakai untuk mengurutkan
  // tampilan di Rekap supaya tidak acak (semua tulisan Firestore terjadi
  // hampir bersamaan sehingga createdAt saja tidak cukup buat mengurutkan).
  function buildNormalAndBonusDocs(baseNoSO, bonusNoSO, items, common) {
    const normalDocs = items.map((it, idx) => ({
      noSO: String(baseNoSO), ...common,
      produk: it.produk, harga: it.harga,
      qtyOrder: it.qtyOrder, bonusPct: "", qtyBonus: 0,
      jumlah: it.qtyOrder, keteranganItem: it.keteranganItem,
      rowType: "normal", itemIndex: idx,
    }));
    const bonusDocs = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.qtyBonus > 0)
      .map(({ it, idx }) => ({
        noSO: String(bonusNoSO), ...common,
        produk: it.produk, harga: "",
        qtyOrder: it.qtyBonus, bonusPct: it.bonusPct, qtyBonus: 0,
        jumlah: it.qtyBonus, keteranganItem: it.keteranganItem,
        rowType: "bonus", itemIndex: idx,
      }));
    return { normalDocs, bonusDocs };
  }

  // ---- Admin: field No. Sales Order dipakai untuk MENGATUR ULANG nomor urut
  // global. Kalau tabel barang juga diisi, sekalian dibuat Sales Order-nya
  // dengan nomor itu. Kalau tabel kosong, cuma nomor urutnya yang diperbarui
  // (dipakai untuk transaksi Marketing berikutnya).
  async function handleAdminSave() {
    const typedNo = Number(soNoInput.value);
    if (!typedNo || typedNo < 1 || !Number.isInteger(typedNo)) {
      showToast("Isi No. Sales Order dengan angka bulat yang valid", "err");
      return;
    }
    const items = collectItems();
    const btn = actions.querySelector("#btn-save-so");
    btn.disabled = true; btn.innerHTML = "Menyimpan...";
    try {
      if (items.length) {
        const sales = infoForm.sales.value;
        const customer = customerInput.value;
        if (!sales) { showToast("Pilih sales dulu", "err"); btn.disabled = false; btn.innerHTML = `${ICONS.save} Simpan Perubahan`; return; }
        if (!customer) { showToast("Pilih customer dulu", "err"); btn.disabled = false; btn.innerHTML = `${ICONS.save} Simpan Perubahan`; return; }

        const hasBonus = items.some(it => it.qtyBonus > 0);
        const bonusNoSO = hasBonus ? typedNo + 1 : null;
        const common = {
          sales, customer, tanggal: tanggalSO, batasKirim,
          catatan: noteTextarea.value || "",
          batchTime: Date.now(),
          createdBy: currentUser.email, createdAt: serverTimestamp(),
        };
        const { normalDocs, bonusDocs } = buildNormalAndBonusDocs(typedNo, bonusNoSO, items, common);
        await Promise.all([...normalDocs, ...bonusDocs].map(d => addDoc(collection(db, "salesOrders"), d)));
        await setDoc(doc(db, "counters", "salesOrderSeq"), { seq: hasBonus ? typedNo + 1 : typedNo, updatedAt: serverTimestamp() });

        const msg = hasBonus
          ? `Sales Order ${typedNo} tersimpan (${normalDocs.length} item), bonus di No. ${bonusNoSO} (${bonusDocs.length} item).`
          : `Sales Order ${typedNo} tersimpan (${normalDocs.length} item).`;
        showToast(msg);
        actions.querySelector("#btn-reset-so").click();
      } else {
        await setDoc(doc(db, "counters", "salesOrderSeq"), { seq: typedNo, updatedAt: serverTimestamp() });
        showToast(`Nomor Sales Order berikutnya diatur ke ${typedNo + 1}.`);
      }
      soNoInput.value = "Memuat...";
      nextPreviewSONumber().then(n => { soNoInput.value = String(n); });
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      btn.disabled = false; btn.innerHTML = `${ICONS.save} Simpan Perubahan`;
    }
  }

  async function handleMarketingSave() {
    const sales = infoForm.sales.value;
    const customer = customerInput.value;
    if (!sales) { showToast("Pilih sales dulu", "err"); return; }
    if (!customer) { showToast("Pilih customer dulu", "err"); return; }

    const items = collectItems();
    if (!items.length) { showToast("Isi minimal satu barang dengan qty order", "err"); return; }

    const btn = actions.querySelector("#btn-save-so");
    btn.disabled = true; btn.innerHTML = "Menyimpan...";
    try {
      // Nomor baru diambil & dikunci DI SINI (bukan saat halaman dibuka),
      // supaya berpindah-pindah menu tidak menghabiskan nomor sia-sia.
      const noSO = await nextSONumber();
      const baseNum = Number(noSO);
      const hasBonus = items.some(it => it.qtyBonus > 0);
      let bonusNoSO = null;
      if (hasBonus) bonusNoSO = await nextSONumber(); // ambil nomor berikutnya lagi khusus baris bonus

      const common = {
        sales, customer, tanggal: tanggalSO, batasKirim,
        catatan: noteTextarea.value || "",
        batchTime: Date.now(),
        createdBy: currentUser.email, createdAt: serverTimestamp(),
      };
      const { normalDocs, bonusDocs } = buildNormalAndBonusDocs(baseNum, bonusNoSO, items, common);
      await Promise.all([...normalDocs, ...bonusDocs].map(d => addDoc(collection(db, "salesOrders"), d)));

      const msg = hasBonus
        ? `Sales Order ${noSO} tersimpan (${normalDocs.length} item), bonus di No. ${bonusNoSO} (${bonusDocs.length} item)`
        : `Sales Order ${noSO} tersimpan (${normalDocs.length} item)`;
      showToast(msg);
      actions.querySelector("#btn-reset-so").click();
      soNoInput.value = "Memuat...";
      nextPreviewSONumber().then(n => { soNoInput.value = String(n); });
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      btn.disabled = false; btn.innerHTML = `${ICONS.save} Simpan Data`;
    }
  }

  actions.querySelector("#btn-save-so").addEventListener("click", () => {
    if (isAdmin) handleAdminSave(); else handleMarketingSave();
  });
}


// ---------------------------------------------------------------
// VIEW: Rekap Sales Order (Marketing / Admin)
// ---------------------------------------------------------------
function renderRekapSO(main) {
  const c = card("Rekap Sales Order");
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.style.marginBottom = "14px";
  hint.textContent = "Barang bonus tercatat sebagai baris terpisah dengan No. SO lanjutannya (mis. 7001 = normal, 7002 = bonus dari SO yang sama).";
  c.appendChild(hint);
  const holder = document.createElement("div");
  holder.style.overflowX = "auto";
  c.appendChild(holder);
  main.appendChild(c);

  let soRows = [], doRows = [];
  const recompute = () => {
    const kirimByProduk = {};
    doRows.forEach(r => { kirimByProduk[r.produk] = (kirimByProduk[r.produk] || 0) + (Number(r.jumlah) || 0); });
    holder.innerHTML = "";
    // Urutkan: submit form paling baru di atas (pakai batchTime, bukan tanggal
    // yang bisa sama-sama "hari ini"), lalu di dalam satu submit: baris normal
    // dulu baru bonus, dan sesuai urutan barang persis seperti di form.
    const sorted = [...soRows].sort((a, b) => {
      const bt = (b.batchTime || 0) - (a.batchTime || 0);
      if (bt !== 0) return bt;
      const rtA = a.rowType === "bonus" ? 1 : 0;
      const rtB = b.rowType === "bonus" ? 1 : 0;
      if (rtA !== rtB) return rtA - rtB;
      return (a.itemIndex || 0) - (b.itemIndex || 0);
    });
    holder.appendChild(makeTable(
      ["No. SO", "Tipe", "Tanggal", "Sales", "Customer", "Produk", "Qty", "Bonus %", "Batas Kirim", "Status"],
      sorted,
      (r) => {
        const totalKirimProduk = kirimByProduk[r.produk] || 0;
        const status = totalKirimProduk >= r.jumlah
          ? `<span class="badge badge-ok">Terpenuhi</span>`
          : `<span class="badge badge-wait">Diproses</span>`;
        const tipeBadge = r.rowType === "bonus"
          ? `<span class="badge badge-wait">Bonus</span>`
          : `<span class="badge badge-ok">Normal</span>`;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="mono">${r.noSO || "-"}</td><td>${tipeBadge}</td><td>${r.tanggal}</td><td>${r.sales || "-"}</td><td>${r.customer}</td><td>${r.produk}</td>
          <td class="num">${fmtNum(r.jumlah)}</td>
          <td class="num">${r.bonusPct !== undefined && r.bonusPct !== "" ? r.bonusPct + "%" : "-"}</td>
          <td>${r.batasKirim || "-"}</td><td>${status}</td>`;
        return tr;
      }
    ));
  };
  listenCollection("salesOrders", [orderBy("tanggal", "desc")], (rows) => { soRows = rows; recompute(); });
  listenCollection("deliveryOrders", [], (rows) => { doRows = rows; recompute(); });
}

// ---------------------------------------------------------------
// VIEW: Input Nomor DO (Ekspedisi) — cari DO lalu tandai dikirim
// ---------------------------------------------------------------
function renderInputNoDO(main) {
  const c = card("Konfirmasi Pengiriman via No. DO");
  const form = document.createElement("form");
  form.className = "form-grid";
  form.innerHTML = `
    <div class="field"><label>No. DO</label><input name="noDO" required placeholder="mis. DO-0001"></div>
    <div class="field"><label>Angkutan</label><select name="angkutan"></select></div>
    <div class="field"><label>Tanggal Kirim</label><input name="tanggalKirim" type="date" value="${todayStr()}" required></div>
    <button class="btn btn-primary" type="submit">Tandai Dikirim</button>
  `;
  populateMasterSelect(form.angkutan, "angkutan", "Pilih angkutan (opsional)...");
  const resultBox = document.createElement("div");
  resultBox.className = "hint";
  c.appendChild(form);
  c.appendChild(resultBox);
  main.appendChild(c);

  let allDO = [];
  listenCollection("deliveryOrders", [], (rows) => { allDO = rows; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const noDO = f.get("noDO").trim();
    const match = allDO.find(r => r.noDO.toLowerCase() === noDO.toLowerCase());
    if (!match) {
      resultBox.textContent = `No. DO "${noDO}" tidak ditemukan.`;
      resultBox.style.color = "var(--danger)";
      return;
    }
    try {
      await updateDoc(doc(db, "deliveryOrders", match.id), {
        shipped: true, tanggalKirim: f.get("tanggalKirim"),
        angkutan: f.get("angkutan") || "",
        confirmedBy: currentUser.email,
      });
      resultBox.textContent = `DO ${noDO} (${match.pabrik}, ${match.produk}, ${match.jumlah}) berhasil ditandai dikirim.`;
      resultBox.style.color = "var(--ok)";
      showToast("Pengiriman dikonfirmasi");
      form.reset();
      form.tanggalKirim.value = todayStr();
    } catch (err) { showToast(err.message, "err"); }
  });
}

// ---------------------------------------------------------------
// VIEW: Kelola User & Akses (Admin)
// ---------------------------------------------------------------
function renderManageUsers(main) {
  const c = card("Kelola User & Akses");
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.style.marginBottom = "14px";
  hint.textContent = "Set role untuk setiap akun yang mendaftar. Akun dengan role \"pending\" belum bisa mengakses aplikasi.";
  c.appendChild(hint);
  const holder = document.createElement("div");
  c.appendChild(holder);
  main.appendChild(c);

  listenCollection("users", [], (rows) => {
    holder.innerHTML = "";
    holder.appendChild(makeTable(["Email", "Role Saat Ini", "Ubah Role"], rows, (r) => {
      const tr = document.createElement("tr");
      const tdEmail = document.createElement("td");
      tdEmail.textContent = r.email;
      const tdRole = document.createElement("td");
      tdRole.innerHTML = `<span class="badge ${r.role === "pending" ? "badge-wait" : "badge-ok"}">${r.role}</span>`;
      const tdAction = document.createElement("td");
      const select = document.createElement("select");
      select.className = "mono";
      ["pending", ...Object.keys(ROLES)].forEach(roleKey => {
        const opt = document.createElement("option");
        opt.value = roleKey; opt.textContent = roleKey;
        if (roleKey === r.role) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", async () => {
        try {
          await updateDoc(doc(db, "users", r.id), { role: select.value });
          showToast(`Role ${r.email} diubah ke ${select.value}`);
        } catch (err) { showToast(err.message, "err"); }
      });
      tdAction.appendChild(select);
      tr.appendChild(tdEmail); tr.appendChild(tdRole); tr.appendChild(tdAction);
      return tr;
    }));
  });
}

// ---------------------------------------------------------------
// VIEW: Data Master — Barang / Angkutan / Customer (Admin)
// ---------------------------------------------------------------
function renderMasterData(main) {
  const c = card("Data Master");
  const tabs = document.createElement("div");
  tabs.className = "select-inline";
  const body = document.createElement("div");

  const keys = Object.keys(MASTER_LISTS); // barang, angkutan, customer
  let activeKey = keys[0];

  keys.forEach(k => {
    const btn = document.createElement("button");
    btn.textContent = MASTER_LISTS[k].label;
    btn.dataset.key = k;
    btn.className = k === activeKey ? "active" : "";
    btn.addEventListener("click", () => {
      activeKey = k;
      tabs.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.key === k));
      renderMasterTab(body, k);
    });
    tabs.appendChild(btn);
  });

  c.appendChild(tabs);
  c.appendChild(body);
  main.appendChild(c);
  renderMasterTab(body, activeKey);
}

function normalizeHeader(h) {
  return String(h || "").toUpperCase().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}
function findColumn(headers, patterns) {
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (patterns.some(p => norm.includes(p))) return h;
  }
  return null;
}

// ---------------------------------------------------------------
// Tab Data Master generik: dipakai untuk Barang, Angkutan, dan Customer.
// Perbedaan kolom antar jenis diatur lewat MASTER_LISTS[masterKey].
// ---------------------------------------------------------------
function renderMasterTab(body, masterKey) {
  clearListeners(); // hentikan listener tab sebelumnya
  body.innerHTML = "";
  const cfg = MASTER_LISTS[masterKey];
  const colName = cfg.collection;
  const hasSpec = cfg.specCols.length > 0;

  // ---- Import dari Excel ----
  const excelCard = document.createElement("div");
  excelCard.style.marginBottom = "18px";
  const kolomInfo = [cfg.label, ...cfg.specCols.map(c => c.label)].join(", ");
  excelCard.innerHTML = `
    <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">
      Import dari Excel (.xlsx / .xls)
    </label>
    <div class="hint" style="margin-bottom:8px;">
      Kolom yang dikenali otomatis: ${kolomInfo}. Baris pertama harus judul kolom.
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <input type="file" id="excel-file" accept=".xlsx,.xls" style="color:var(--text-dim);font-size:13px;">
      <button class="btn btn-primary" type="button" id="btn-excel-import" style="width:auto;padding:9px 18px;">Import Excel</button>
    </div>
    <div id="excel-status" class="hint" style="margin-top:8px;"></div>
  `;
  body.appendChild(excelCard);

  excelCard.querySelector("#btn-excel-import").addEventListener("click", () => {
    const fileInput = excelCard.querySelector("#excel-file");
    const statusEl = excelCard.querySelector("#excel-status");
    const file = fileInput.files[0];
    if (!file) { showToast("Pilih file Excel dulu", "err"); return; }
    if (typeof XLSX === "undefined") {
      showToast("Library Excel belum termuat, refresh halaman dan coba lagi", "err");
      return;
    }
    statusEl.textContent = "Membaca file...";
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) { statusEl.textContent = "File kosong atau format tidak terbaca."; return; }

        const headers = Object.keys(rows[0]);
        const namaCol = findColumn(headers, cfg.namaPatterns);
        if (!namaCol) {
          statusEl.textContent = `Kolom untuk "${cfg.label}" tidak ditemukan di file ini — import dibatalkan.`;
          return;
        }
        const specColMap = cfg.specCols.map(c => ({ ...c, sourceCol: findColumn(headers, c.patterns) }));

        const docs = rows
          .map(r => {
            const d = { nama: String(r[namaCol] || "").trim() };
            specColMap.forEach(c => { d[c.key] = c.sourceCol ? r[c.sourceCol] : ""; });
            return d;
          })
          .filter(d => d.nama);

        if (!docs.length) { statusEl.textContent = `Tidak ada baris dengan ${cfg.label.toLowerCase()} yang valid.`; return; }

        statusEl.textContent = `Mengimpor ${docs.length} data...`;
        await Promise.all(docs.map(d =>
          addDoc(collection(db, colName), { ...d, createdBy: currentUser.email, createdAt: serverTimestamp() })
        ));
        statusEl.textContent = `Berhasil import ${docs.length} data.`;
        showToast(`${docs.length} ${cfg.label} berhasil diimport`);
        fileInput.value = "";
      } catch (err) {
        statusEl.textContent = "Gagal membaca file: " + err.message;
        showToast("Import gagal: " + err.message, "err");
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // ---- Tambah manual satu-satu ----
  const manualForm = document.createElement("form");
  manualForm.className = "form-grid";
  manualForm.style.marginBottom = "18px";
  let fieldsHtml = `<div class="field"><label>${cfg.label}</label><input name="nama" required></div>`;
  cfg.specCols.forEach(c => { fieldsHtml += `<div class="field"><label>${c.label}</label><input name="${c.key}"></div>`; });
  fieldsHtml += `<button class="btn btn-primary" type="submit">Tambah</button>`;
  manualForm.innerHTML = fieldsHtml;
  body.appendChild(manualForm);

  manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(manualForm);
    const nama = f.get("nama").trim();
    if (!nama) return;
    const payload = { nama, createdBy: currentUser.email, createdAt: serverTimestamp() };
    cfg.specCols.forEach(c => { payload[c.key] = f.get(c.key) || ""; });
    try {
      await addDoc(collection(db, colName), payload);
      showToast(`${cfg.label} tersimpan`);
      manualForm.reset();
    } catch (err) { showToast(err.message, "err"); }
  });

  // ---- Import cepat tempel-list (khusus tipe tanpa kolom tambahan, mis. Customer) ----
  if (!hasSpec) {
    const bulkWrap = document.createElement("div");
    bulkWrap.className = "form-grid";
    bulkWrap.style.marginBottom = "18px";
    bulkWrap.innerHTML = `
      <div class="field" style="grid-column:1/-1">
        <label>Atau tempel banyak sekaligus (satu ${cfg.label.toLowerCase()} per baris)</label>
        <textarea name="bulk" rows="3" style="width:100%;padding:10px 12px;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;resize:vertical;"></textarea>
      </div>
      <button class="btn btn-primary" type="button" id="btn-bulk-import">Simpan / Import</button>
    `;
    body.appendChild(bulkWrap);
    bulkWrap.querySelector("#btn-bulk-import").addEventListener("click", async () => {
      const raw = bulkWrap.querySelector("textarea[name=bulk]").value;
      const names = raw.split("\n").map(s => s.trim()).filter(Boolean);
      if (!names.length) { showToast("Isi dulu minimal satu nama", "err"); return; }
      try {
        await Promise.all(names.map(nama =>
          addDoc(collection(db, colName), { nama, createdBy: currentUser.email, createdAt: serverTimestamp() })
        ));
        showToast(`${names.length} ${cfg.label} tersimpan`);
        bulkWrap.querySelector("textarea[name=bulk]").value = "";
      } catch (err) { showToast(err.message, "err"); }
    });
  }

  // ---- Daftar data ----
  const listHolder = document.createElement("div");
  body.appendChild(listHolder);

  listenCollection(colName, [orderBy("nama")], (rows) => {
    listHolder.innerHTML = "";
    const headers = [cfg.label, ...cfg.specCols.map(c => c.label), "Ditambahkan Oleh", ""];
    listHolder.appendChild(makeTable(
      headers, rows,
      (r) => {
        const tr = document.createElement("tr");
        const tdNama = document.createElement("td");
        tdNama.textContent = r.nama;
        tr.appendChild(tdNama);
        cfg.specCols.forEach(c => {
          const td = document.createElement("td");
          td.className = "num";
          td.textContent = (r[c.key] === undefined || r[c.key] === "") ? "-" : r[c.key];
          tr.appendChild(td);
        });
        const tdBy = document.createElement("td");
        tdBy.textContent = r.createdBy || "-";
        tr.appendChild(tdBy);
        const tdAction = document.createElement("td");
        tdAction.appendChild(makeDeleteBtn(colName, r.id, r.nama, cfg.label));
        tr.appendChild(tdAction);
        return tr;
      },
      `Belum ada data ${cfg.label}`
    ));
  });
}

function makeDeleteBtn(colName, id, nama, label) {
  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-danger";
  delBtn.style.padding = "5px 10px";
  delBtn.style.fontSize = "12px";
  delBtn.textContent = "Hapus";
  delBtn.addEventListener("click", async () => {
    if (!confirm(`Hapus "${nama}" dari daftar ${label}?`)) return;
    try {
      await deleteDoc(doc(db, colName, id));
      showToast(`${nama} dihapus`);
    } catch (err) { showToast(err.message, "err"); }
  });
  return delBtn;
}

const RENDERERS = {
  "input-bmb": renderInputBMB,
  "rekap-bmb": renderRekapBMB,
  "input-do": renderInputDO,
  "rekap-do": renderRekapDO,
  "sisa-so": renderSisaSO,
  "sisa-barang": renderSisaBarang,
  "input-so": renderInputSO,
  "rekap-so": renderRekapSO,
  "input-nodo": renderInputNoDO,
  "manage-users": renderManageUsers,
  "master-data": renderMasterData,
  "stock-opname": renderStockOpname,
  "riwayat-opname": renderRiwayatOpname,
};

// ---------------------------------------------------------------
// Jam kecil di topline
// ---------------------------------------------------------------
function tickClock() {
  const el = $("#clock");
  if (el) el.textContent = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
}
setInterval(tickClock, 1000);
tickClock();
