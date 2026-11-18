# Audit kesiapan Google Play (2026-11-18)

Apa saja yang harus beres sebelum ABOT bisa dikirim ke Google Play, dan satu hal yang sudah
berlaku untuk APK GitHub sekarang. Bukti dari kode merujuk ke `main` per 2026-11-18.

**Tingkat keyakinan sumber kebijakan:**
- **Resmi (dibaca):** halaman developer.android.com dibaca penuh.
- **Resmi (kutipan):** halaman support.google.com tidak bisa dibuka dari lingkungan audit. Isinya
  diambil dari kutipan mesin pencari, jadi buka halamannya sendiri sebelum mengandalkan kalimat persisnya.
- **Belum pasti:** tidak ada sumber resmi yang memastikannya.

Prioritas:
- **P0:** menghalangi pengiriman ke Play atau distribusi.
- **P1:** wajib diisi atau diubah supaya lolos review.
- **P2:** dianjurkan.

---

## P0-1. Verifikasi developer untuk APK di luar Play (berlaku sekarang)

- **Aturan:** sejak 30 September 2026, di Indonesia, HP bersertifikat dengan Android 8+ hanya
  memasang app dari developer yang sudah terverifikasi. Ini termasuk APK yang diunduh dari luar Play.
  App di Play terdaftar otomatis lewat Play Console. App di luar Play didaftarkan manual: package name
  dan kunci tanda tangan. Sumber: developer.android.com/developer-identity (resmi, dibaca).
- **ABOT sekarang:** dibagikan sebagai `abot.apk` dari GitHub Releases, ditandatangani kunci rilis
  (`.github/workflows/android.yml`).
- **Yang perlu dicek:** apakah package `app.abot.gym` dan kunci rilisnya sudah didaftarkan. Kalau belum,
  tester dan pengguna baru bisa gagal memasang APK.
- **Langkah:** daftar di Android Developer Console (atau Play Console, yang sekaligus memverifikasi
  identitas), lalu daftarkan package dan sidik jari (fingerprint) kunci rilisnya.

## P0-2. Pembayaran PRO lewat Midtrans di dalam app

- **Aturan:** Play mewajibkan Google Play Billing untuk barang digital, kecuali ikut program tertentu.
  Tombol, link, atau WebView yang menuju checkout lain dilarang.
  Sumber: support.google.com/googleplay/android-developer/answer/9858738 dan /answer/10281818 (resmi, kutipan).
- **Program yang tersedia untuk Indonesia:**
  - Indonesia termasuk pasar User Choice Billing: billing sendiri ditawarkan **di samping** Play
    Billing, bukan menggantikannya, dengan potongan biaya layanan 4 poin
    (/answer/12570971, /answer/13821247; resmi, kutipan).
  - Model biaya baru Google baru sampai ke Indonesia paling lambat 30 September 2027
    (developer.android.com/blog/posts/a-new-era-for-choice-and-openness; resmi, dibaca).
  - Mengarahkan pengguna ke website untuk membeli: belum ada program untuk Indonesia (belum pasti).
  - Putusan KPPU / Mahkamah Agung terhadap Google (Maret 2026) hanya dilaporkan media. Belum ada teks
    resmi Google soal penerapannya (belum pasti).
- **ABOT sekarang:**
  - `src/lib/checkout.ts:140-142` membuka halaman Midtrans dari app Android.
  - `checkoutOnAndroid` (`src/lib/remote-config.ts:26`) bisa mematikan checkout dari jarak jauh, tapi
    berlaku juga untuk APK GitHub dan tidak menghapus ajakan membeli.
- **Pilihan:**
  1. **Build Play tanpa jualan (disarankan untuk awal).** Hapus checkout dan semua tombol atau ajakan
     beli di build Play. PRO tetap terbuka kalau akun sudah punya hak PRO, karena dibeli di web.
     FAQ Play mengizinkan app "consumption-only" seperti ini, asal tidak ada link atau kalimat yang
     mendorong ke checkout luar (/answer/10281818; resmi, kutipan).
     - **Belum pasti:** apakah kolom "Redeem a code" boleh tetap ada. Paling aman disembunyikan juga
       di build Play.
  2. **Ikut User Choice Billing.** Butuh integrasi Google Play Billing plus pendaftaran program. Kerjanya
     besar, cocok setelah ada pembeli rutin.

## P0-3. Update sendiri dari GitHub dan `REQUEST_INSTALL_PACKAGES`

- **Aturan:** app di Play tidak boleh memperbarui dirinya selain lewat mekanisme update Play.
  `REQUEST_INSTALL_PACKAGES` tidak boleh dipakai untuk update sendiri, dan wajib dideklarasikan.
  Sumber: /answer/16559646 dan /answer/16558241 (resmi, kutipan).
- **ABOT sekarang:**
  - `AndroidManifest.xml:159` meminta `REQUEST_INSTALL_PACKAGES`.
  - `AppUpdatePlugin.java` dan `src/store/useAppUpdate.ts` mengunduh dan memasang APK dari GitHub.
  - Notifikasi update dan item di halaman Notifikasi (PR #34) ikut alur ini.
- **Langkah:** build Play tanpa izin itu, tanpa `AppUpdatePlugin`, dan tanpa `UpdateCenter`.
  APK GitHub tetap seperti sekarang.

## P0-4. Format Android App Bundle

- **Aturan:** app baru di Play harus diunggah sebagai Android App Bundle (`.aab`), bukan APK.
  Sumber: pengetahuan umum tentang Play sejak Agustus 2021, tidak dicek ulang dalam audit ini.
- **ABOT sekarang:** CI hanya menjalankan `assembleRelease` dan `assembleDebug`
  (`.github/workflows/android.yml:71`).
- **Langkah:** tambahkan `bundlePlayRelease` untuk build Play, lalu pakai Play App Signing.

## P1-1. `USE_EXACT_ALARM`

- **Aturan:** hanya app jam alarm atau kalender yang boleh memakainya. Play menolak rilis dengan izin
  ini kalau app tidak memenuhi syarat. Sumber: developer.android.com/about/versions/14/changes/schedule-exact-alarms
  (resmi, dibaca). Apakah app "timer" termasuk: belum pasti. Tujuan utama ABOT tetap pencatat gym.
- **ABOT sekarang:**
  - `AndroidManifest.xml:171`.
  - Alarm akhir istirahat memakai `setExactAndAllowWhileIdle` dengan cadangan kalau tidak diizinkan
    (`LiveWorkoutPlugin.java:382-383`).
- **Langkah di build Play:**
  - Hapus `USE_EXACT_ALARM` dan pakai `SCHEDULE_EXACT_ALARM`. Pengguna yang memberi izin; tombol
    pengaturannya sudah ada di Settings.
  - Selama sesi berjalan, layanan latar depan tetap hidup, jadi akhir istirahat juga bisa diukur dari
    dalam layanan itu.
  - Pengingat mingguan cukup alarm tidak presisi.

## P1-2. Tipe foreground service

- **Aturan:**
  - Setiap tipe foreground service wajib dideklarasikan di Play Console, lengkap dengan video
    (/answer/13392821; resmi, kutipan).
  - `specialUse` hanya untuk kebutuhan yang tidak tercakup tipe lain. Untuk pelacak olahraga ada tipe
    `health`.
  - `health` butuh `FOREGROUND_SERVICE_HEALTH` plus salah satu dari: `ACTIVITY_RECOGNITION` yang sudah
    diizinkan, atau `HIGH_SAMPLING_RATE_SENSORS`.
  - Sumber: developer.android.com/about/versions/14/changes/fgs-types-required (resmi, dibaca).
- **ABOT sekarang:** `WorkoutLiveService` memakai `specialUse` (`AndroidManifest.xml:138`, `:166`).
- **Pilihan:**
  - **(a)** Pindah ke `health` dan minta `ACTIVITY_RECOGNITION` saat workout pertama dimulai. Satu izin
    tambahan, tapi tipenya sesuai.
  - **(b)** Pertahankan `specialUse` dengan penjelasan yang kuat. Risiko ditolak lebih tinggi.
- **Sesudah itu:** rekam video singkat: mulai workout, notifikasi live muncul, tombol-tombolnya dipakai.

## P1-3. Health Connect

- **Aturan:**
  - Isi formulir **Health apps** di Play Console (App content), dengan alasan untuk setiap tipe data:
    Exercise, ActiveCaloriesBurned, Weight, Sleep.
  - Kebijakan privasi di halaman toko harus sama dengan yang ditautkan Health Connect.
  - Kalau formulir tidak diisi, app yang sudah terbit tidak bisa tersambung ke Health Connect.
  - Sumber: developer.android.com/health-and-fitness/health-connect/publish (resmi, dibaca).
- **ABOT sekarang:**
  - Izin di `AndroidManifest.xml:181-184`.
  - Halaman penjelasan izin sudah ada (`HealthPermissionsRationaleActivity`).
- **Langkah:** siapkan alasan per tipe data. Siapkan juga jawaban kenapa app gym membaca data tidur:
  pemulihan dan saran latihan. Tanpa fitur yang memakainya, lebih baik izinnya dicabut.

## P1-4. Formulir Data safety dan link hapus akun

- **Aturan:**
  - Semua data yang dikumpulkan atau dibagikan harus dideklarasikan, termasuk lewat SDK.
  - App yang punya akun wajib menyediakan penghapusan akun di dalam app **dan** lewat link web yang
    diisikan di Play Console.
  - Sumber: /answer/10787469 dan /answer/13327111 (resmi, kutipan).
- **Yang perlu dideklarasikan untuk ABOT:**
  - Email dan foto profil Google (login opsional, Supabase).
  - Data latihan dan berat badan yang di-backup.
  - Data kesehatan dari Health Connect.
  - Lokasi saat mencari gym terdekat (dikirim ke OpenStreetMap).
  - Foto (kamera).
  - Riwayat pembelian (Midtrans; tidak ada di build Play kalau pilihan 1 di P0-2 diambil).
  - Pemutar TikTok dan YouTube yang disematkan, serta permintaan oEmbed TikTok
    (`src/lib/tiktok-resolve.ts`).
- **ABOT sekarang:**
  - Hapus data di dalam app sudah ada (Settings, Data & backup, Delete my data).
  - Kebijakan privasi menyebut permintaan lewat email (`src/components/legal/legal-content.ts:108`).
- **Langkah:** sediakan URL web yang jelas untuk permintaan hapus akun. Halaman `/privacy` dengan
  bagian khusus sudah cukup, atau buat formulir kecil.

## P1-5. Penjelasan sebelum meminta izin lokasi dan kamera

- **Aturan:** tampilkan penjelasan di dalam app sebelum dialog izin Android kalau akses mungkin tidak
  diduga pengguna. Sumber: /answer/10144311 (resmi, kutipan).
- **ABOT sekarang:** lokasi diminta saat mencari gym, kamera saat mengambil foto. Keduanya wajar, tapi
  layar penjelasan singkat sebelum dialog tetap dianjurkan.

## P1-6. Akun developer baru dan closed testing

- **Aturan:**
  - Biaya pendaftaran US$25 sekali bayar; kartu prabayar tidak diterima (/answer/6112435).
  - Verifikasi identitas dan verifikasi HP Android asli (/answer/10841920, /answer/13628312).
  - Akun pribadi yang dibuat setelah 13 November 2023: minimal **12 tester** yang ikut terus-menerus
    selama **14 hari** sebelum boleh mengajukan rilis produksi (/answer/14151465).
  - Semua dari sumber resmi, kutipan.
- **Langkah:** rekrut 20–25 tester, karena ada yang akan keluar di tengah jalan.

## P2

- **`POST_PROMOTED_NOTIFICATIONS`:** tidak ditemukan aturan Play khusus. Jam workout yang berjalan
  sesuai kriteria Live Update. Pengingat mingguan tidak boleh dipromosikan.
  Sumber: developer.android.com/develop/ui/views/notifications/live-update (resmi, dibaca).
- **Target API:** `targetSdkVersion = 36` sudah memenuhi syarat 2026
  (developer.android.com/google/play/requirements/target-sdk; resmi, dibaca).
- **Laporan crash:** setelah masuk Play, Android vitals di Play Console memberi laporan crash tanpa
  kode tambahan. APK GitHub tetap tanpa laporan crash.

---

## Usulan rancangan build Play

Satu kode, dua versi build:
- **Web:** tetap memakai `ABOT_TARGET=android` untuk export statis, ditambah penanda baru, misalnya
  `NEXT_PUBLIC_ABOT_STORE=play`. Penanda ini menyembunyikan checkout, ajakan membeli, kolom redeem
  (kalau perlu), `UpdateCenter`, dan cek update.
- **Android:** product flavor Gradle `github` dan `play`.
  - Flavor `play` mencabut `REQUEST_INSTALL_PACKAGES` dan `USE_EXACT_ALARM` lewat
    `tools:node="remove"`, tidak mendaftarkan `AppUpdatePlugin`, dan memakai `health`/`specialUse`
    sesuai keputusan di P1-2.
  - Flavor `github` tetap sama persis dengan APK sekarang.
- **CI:** job baru `bundlePlayRelease` yang menghasilkan `.aab`. Smoke test tetap berjalan pada flavor
  `github`, ditambah satu cek bahwa manifest flavor `play` bebas dari izin yang dilarang.

## Urutan kerja

1. **P0-1:** cek dan daftarkan verifikasi developer untuk APK GitHub. Ini memengaruhi tester sekarang.
2. Daftar akun Play Console (US$25), sekaligus memverifikasi identitas.
3. Putuskan **P0-2** (jualan di build Play atau tidak) dan **P1-2** (`health` atau `specialUse`).
4. Bangun flavor `play` (P0-2, P0-3, P0-4, P1-1, P1-2).
5. Isi formulir Play Console (P1-3, P1-4) dan siapkan URL hapus akun.
6. Closed testing 14 hari dengan tester (P1-6).
