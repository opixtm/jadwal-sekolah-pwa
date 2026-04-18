# Dokumen Handover: JADWAL PWA
**Status Terakhir: 20 Maret 2026 (v1.0.6)**

Dokumen ini berisi detail kondisi aplikasi saat ini, infrastruktur yang digunakan, dan saran pengembangan di masa mendatang.

## 1. Kondisi Saat Ini (Current State)

Aplikasi telah diperbarui dengan fitur-fitur manajemen jadwal yang lebih fleksibel dan stabil, serta penyelesaian masalah browser compatibility.

### Fitur Utama & Perbaikan Terakhir:
- **Breaking Down Subject Detail:** Fitur baru di mana nama mata pelajaran di tabel jadwal bisa diklik untuk memunculkan modal detail. Modal ini memberikan breakdown tugas/PR aktif dan jadwal ujian yang spesifik untuk mata pelajaran tersebut.
- **Input Fleksibel (Combobox):** Semua kolom Mata Pelajaran dan Nama Guru (Admin/Anak) telah diubah dari dropdown kaku menjadi kolom input bebas. Pengguna bisa mengetik subjek apa pun secara manual dengan saran otomatis (datalist) untuk guru.
- **Admin Settings (Tab Pengaturan):** Mengatur **Semester Aktif (Ganjil/Genap)** secara global untuk mensinkronisasi tampilan jadwal di dashboard anak.
- **Manajemen User:** Admin dapat menyetujui (Approve) user baru dan menentukan tingkatan kelasnya (SD 1-6, SMP 7-9, SMA 10-12).
- **Dashboard Anak:** Memiliki fitur "Kelola" jadwal pribadi yang sinkron dengan data sekolah namun tetap bisa diisi secara mandiri.

### Perbaikan Bug & Stabilitas (v1.0.6):
- **Safari Compatibility:** Menggunakan `experimentalForceLongPolling` dan `useFetchStreams: false` pada konfigurasi Firestore untuk mengatasi error `Fetch API` di browser Safari pada domain Cloudflare Workers.
- **Cache-Busting & Update Otomatis:** Service Worker (`sw.js`) diperbarui menggunakan strategi **Network-First** untuk memastikan pengguna selalu mendapatkan kode terbaru setelah setiap `git push`.
- **Global Function Collision Fix:** Memisahkan fungsi global antara Admin dan User (contoh: `viewSubjectDetailAdmin` vs `viewSubjectDetailUser`) untuk menghindari error `null is not an object` saat perpindahan tab.
- **Diagnostic Version Label:** Penambahan label versi (v1.0.6) di pojok kanan bawah aplikasi untuk mempermudah verifikasi status update di sisi client.

## 2. Infrastruktur & Teknologi

Aplikasi ini dibangun menggunakan arsitektur serverless yang ringan dan cepat.

- **Frontend:** Vanilla HTML5, CSS3 (Tailwind CSS via CDN), dan JavaScript. Menggunakan pendekatan PWA (Progressive Web App) dengan Service Worker (`sw.js`).
- **Backend / Hosting:** 
  - **Cloudflare Workers:** Menghosting file statis dan menangani routing di domain `jadwal.vagabondtm.workers.dev`.
  - **GitHub:** Digunakan untuk source control dan trigger deployment otomatis. Setiap `git push origin main` akan memperbarui konten di situs live.
- **Database & Authentication:**
  - **Firebase Firestore:** Database real-time untuk menyimpan data `users`, `schedules`, `contacts` (pengaturan guru), dan `config` (semester).
  - **Firebase Auth:** Login menggunakan Google Account. *Penting: Pastikan domain workers.dev sudah ada di daftar Authorized Domains di Firebase Console.*

## 3. Potensi Pengembangan (Roadmap)

Berikut adalah beberapa ide untuk meningkatkan fungsi aplikasi di masa mendatang:

### Jangka Pendek:
- **Firestore Security Rules:** Memperketat aturan akses database agar user hanya bisa membaca/menambah jadwal yang relevan dengan kelas atau ID mereka sendiri.
- **Input Validation:** Menambahkan validasi jam (agar waktu mulai tidak lebih besar dari waktu selesai).
- **Fitur Chat/Notifikasi:** Integrasi lebih dalam dengan grup WhatsApp atau push notification untuk pengingat jadwal tugas.

### Jangka Panjang:
- **Statistik Belajar:** Menambahkan grafik progres pengerjaan tugas atau rutinitas harian di dashboard monitoring orang tua.
- **Multi-School Support:** Jika ingin dikembangkan untuk lebih dari satu sekolah, diperlukan struktur koleksi Firestore yang membagi data berdasarkan `schoolId`.
- **Mode Offline:** Memperkuat Service Worker agar jadwal tetap bisa dilihat meskipun tanpa koneksi internet (Caching Data).

## 4. Modul PWA Jadwal Kuliah (Stand-Alone)

Sebagai fitur ekstensi, aplikasi PWA ini juga sedang mengembangkan modul spesifik perkuliahan bersistem *Blok/SkS*. Kodenya diletakkan secara terpisah di direktori `/kuliah/` agar tidak merusak PWA utama (`index.html`).

### Kondisi Saat Ini (Current State):
- **Ekstraksi Data:** Skrip Python `jadwal_parser.py` telah berhasil dibuat untuk mengekstrak data dari arsip MS Word (contoh: `jadwal 2023.doc`). Skrip ini mengubah data mentah mingguan menjadi struktur yang dapat dikonsumsi Web yaitu `kuliah_parsed.json`.
- **UI Base PWA:** Draf awal struktur tampilan `kuliah.html` & `kuliah.js` telah dibuat meniru Model CSS PWA original (seperti `card-shadow`, `bottom-navigation`, warna Tailwind). Sistem mem-parsing JSON menjadi bentuk interaktif Silabus *Timeline Accordion* dikategorikan per Minggu untuk kebutuhan mode Blok.
- Seluruh file yang dibuat telah dipindahkan dari root `/` ke dalam folder `/kuliah/`.

### Langkah Selanjutnya (Roadmap Modul Kuliah):
1. **Penerjemahan Kalender (Mapping):** Membuat alur konversi jadwal Mingguan menjadi struktur Harfiah berserta tanggal yang presisi (H-Day calendar/Grid) sesuai dengan contoh format *output* `jadwal kuliah angkatan 2023.doc`.
2. **Setup Penyimpanan / Entry Point:** Menentukan apakah sistem akan memakai file statis (otomasi Git) atau memerlukan input Dosen di antarmuka Admin (Firebase Web) guna memasukkan data Jam spesifik.
3. **Penyatuan Interface:** Membuat jembatan akses Login bagi pengguna ber-role "Mahasiswa" agar dapat diarahkan dengan rapi ke halaman `/kuliah/kuliah.html`.

---
*Dokumen ini dibuat untuk membantu proses transisi dan pemeliharaan kode ke depannya.*
