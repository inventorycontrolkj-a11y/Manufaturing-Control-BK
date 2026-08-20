# Aplikasi Integrasi Pabrik LKJ · JLP · Marketing · Ekspedisi

Aplikasi web satu halaman (HTML/CSS/JS murni, tanpa build tool) yang memakai
**Firebase** (Authentication + Firestore) sebagai backend, dan bisa langsung
di-hosting gratis lewat **GitHub Pages**.

## Struktur file

```
index.html          -> halaman utama (login + shell aplikasi)
css/style.css        -> styling
js/config.js         -> ISI dengan kredensial Firebase project Anda
js/app.js            -> seluruh logika aplikasi
firestore.rules       -> aturan keamanan Firestore (role-based)
```

## 1. Buat project Firebase

1. Buka https://console.firebase.google.com → **Add project** → beri nama
   (mis. `aplikasi-produksi`) → selesaikan wizard.
2. Di sidebar kiri, buka **Build → Authentication → Get started**.
   Aktifkan sign-in method **Email/Password**.
3. Di sidebar kiri, buka **Build → Firestore Database → Create database**.
   Pilih mode **Production**, lokasi terdekat (mis. `asia-southeast2`).
4. Buka **Project settings** (ikon gerigi) → scroll ke **Your apps** →
   klik ikon `</>` (Web) → daftarkan app → Firebase akan menampilkan objek
   `firebaseConfig`. Salin nilainya.

## 2. Pasang kredensial ke aplikasi

Buka `js/config.js`, ganti seluruh isi `firebaseConfig` dengan nilai yang
Anda salin dari Firebase Console:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "aplikasi-produksi.firebaseapp.com",
  projectId: "aplikasi-produksi",
  storageBucket: "aplikasi-produksi.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:xxxxxxxxxxxx"
};
```

## 3. Pasang aturan keamanan Firestore

Di Firebase Console → **Firestore Database → Rules**, tempel isi file
`firestore.rules` yang sudah disediakan, lalu klik **Publish**.

Aturan ini memastikan:
- Pabrik LKJ hanya bisa menulis data BMB/DO untuk pabrik LKJ (begitu juga JLP).
- Hanya Marketing yang bisa membuat Sales Order.
- Hanya Team Ekspedisi (dan admin) yang bisa mengubah status pengiriman DO.
- Hanya admin yang bisa mengubah role user.

## 4. Buat akun pertama & jadikan admin

1. Jalankan aplikasi (lihat langkah 5 atau buka `index.html` langsung di
   browser dengan Live Server), lalu klik **Daftar** dan buat akun dengan
   email Anda sendiri.
2. Akun baru otomatis berstatus `pending` (belum ada akses).
3. Buka Firebase Console → **Firestore Database → Data** → koleksi `users`
   → cari dokumen dengan email Anda → ubah field `role` menjadi `admin`.
4. Login ulang di aplikasi. Sekarang Anda punya menu **Kelola User & Akses**
   untuk mengatur role user lain (`lkj`, `jlp`, `marketing`, `ekspedisi`)
   tanpa harus menyentuh Firebase Console lagi.

Role yang tersedia: `lkj`, `jlp`, `marketing`, `ekspedisi`, `admin`.

## 5. Push ke GitHub & deploy via GitHub Pages

```bash
git init
git add .
git commit -m "Aplikasi integrasi produksi - Firebase + GitHub Pages"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Lalu di GitHub:
1. Buka repo → **Settings → Pages**.
2. Pada **Source**, pilih branch `main` dan folder `/ (root)`.
3. Klik **Save**. Setelah 1-2 menit, aplikasi akan tersedia di
   `https://USERNAME.github.io/NAMA-REPO/`.

> Catatan: `apiKey` Firebase yang tampil di `config.js` memang publik dan
> aman untuk disimpan di frontend — keamanan sesungguhnya diatur lewat
> **Firestore Rules** (langkah 3), bukan dengan menyembunyikan `apiKey`.

## Alur data & pemetaan fitur

| Role | Menu | Koleksi Firestore |
|---|---|---|
| Pabrik LKJ / JLP | Input BMB, Rekap BMB, Input DO, Rekap DO, Sisa Sales Order, Sisa Barang | `bmb`, `deliveryOrders` |
| Marketing | Input Sales Order, Rekap Sales Order, Sisa Barang | `salesOrders` |
| Team Ekspedisi | Input No. DO (konfirmasi kirim), Rekap DO | `deliveryOrders` (update status) |
| Admin | Kelola User & Akses | `users` |

**Sisa Barang** = total BMB masuk − total DO keluar, dihitung per pabrik per produk secara realtime.
**Sisa Sales Order** = total Sales Order − total DO yang sudah dibuat, dihitung per produk secara realtime.

Semua tampilan memakai `onSnapshot` sehingga data ter-update otomatis
tanpa refresh saat ada input baru dari role lain (real-time).

## Mengembangkan lebih lanjut

Beberapa hal yang bisa ditambahkan sesuai kebutuhan nyata di lapangan:
- Validasi stok tidak boleh minus saat Input DO.
- Riwayat perubahan (audit log) per dokumen.
- Export rekap ke Excel/PDF.
- Notifikasi (mis. email/WhatsApp) saat DO dikonfirmasi terkirim.
- Firebase Hosting sebagai alternatif GitHub Pages (mendukung custom domain
  lebih mudah): `firebase deploy --only hosting`.
