# ABOT Master Plan: Audit Codebase dan Full Product Planning

Tanggal: 2026-11-08
Branch: `claude/vigilant-fermat-2dcmbe` (PR draft jfr-wrld/ABOT#1)
Status dokumen: DRAFT untuk persetujuan owner. Belum ada kode yang ditulis berdasarkan dokumen ini.

ABOT (bahasa Jawa: "berat") adalah gym progress tracker yang mengambil seluruh kelebihan Hevy,
memperbaiki kelemahannya, dan menambahkan fitur AI lewat Replicate. Dokumen ini menjawab tiga hal:
apa yang sudah ada di repo hari ini, produk apa yang mau dibangun, dan dalam urutan apa.

Aturan yang mengikat dokumen ini dan semua kerja turunannya:

- `antislop` (mode DURING, dipilih owner di sesi ini): tidak ada em dash, tidak ada angka palsu,
  tidak ada kontrol mati, setiap keputusan visual punya alasan satu baris, Delivery Gate dijalankan
  sebelum setiap rilis.
- `replicate/skills`: pilih model lewat API Replicate, bukan dari ingatan; cek schema model sebelum
  mengirim input; URL output kedaluwarsa 1 jam jadi harus disimpan; jangan pernah menaruh token di
  client.
- `superpowers`: dokumen ini adalah design doc (brainstorming). Setelah disetujui, setiap milestone
  mendapat implementation plan terpisah di `docs/plans/` lewat skill `writing-plans`, dieksekusi
  per task dengan TDD dan commit kecil.

---

## 1. Audit Codebase (keadaan hari ini)

### 1.1 Stack dan fondasi

| Area | Keadaan | Catatan |
|---|---|---|
| Framework | Next.js 16.4.5 (App Router, Turbopack, `cacheComponents: true`), React 19.3, TypeScript strict | Semua halaman adalah client component; tidak ada server code sama sekali |
| Styling | Tailwind v4 dengan token di `src/app/globals.css` | Palet sudah dicek kontras WCAG AA (lihat `DESIGN.md`) |
| State | Zustand + `persist` ke `localStorage`, `skipHydration` + `StoreHydrator` | 4 store: workouts, routines, exercises, settings |
| Chart | Recharts 3 | Baru dipakai di halaman Progress dan detail exercise (belum diverifikasi di browser) |
| Ikon | Lucide | Arahan owner |
| Test | Vitest, 15 unit test lulus (`calc.ts`, `analytics.ts`) | Belum ada test komponen atau e2e yang tersimpan di repo; click-through Playwright dilakukan manual dari scratchpad |
| Skill terpasang | replicate/skills (7), antislop (6), superpowers (15) | `CLAUDE.md` memuat pointer antislop |

Total kode aplikasi: sekitar 4.600 baris TS/TSX di `src/`.

### 1.2 Peta file dan tanggung jawab

```
src/types/workout.ts          Model domain: Exercise, WorkoutSet, SessionExercise, WorkoutSession,
                              Routine*, PersonalRecord, UserSettings, label map, SET_TYPE_META
src/lib/calc.ts               Epley 1RM, volume, durasi, PR table + deteksi PR live, previousSets,
                              exerciseHistory, muscleSplit (fractional set), format durasi
src/lib/analytics.ts          Bucket mingguan, week streak, grid kalender bulanan
src/lib/units.ts              kg <-> lbs di tepi UI (penyimpanan selalu kg)
src/data/exercises.ts         44 gerakan seed dengan otot primer/sekunder dan alat
src/store/useWorkoutStore.ts  Sesi aktif, riwayat, rest timer (endsAt dipersist), finish/discard
src/store/useRoutineStore.ts  CRUD routine, duplicate, planned sets
src/store/useExerciseStore.ts Custom exercise + selector gabungan seed+custom
src/store/useSettingsStore.ts unit, default rest, alert, showRpe, first day of week
src/app/page.tsx              Home: banner sesi aktif, start empty, quick-start routine, recent
src/app/workout/page.tsx      Active Workout Logger (fitur inti)
src/components/workout/*      Header live, ExerciseCard, SetRow (grid 6 kolom), SetTypeMenu,
                              RestTimerBar, ExercisePicker, FinishDialog
src/app/routines/**           Daftar per folder + editor target set            (WIP, belum diverifikasi)
src/app/exercises/**          Library + filter + detail (PR, chart 1RM, histori) (WIP, belum diverifikasi)
src/app/progress/page.tsx     Volume/minggu, workout/minggu, menit/minggu, sets per otot, kalender (WIP)
src/app/history/[id]/page.tsx Detail sesi + hapus                            (WIP, belum diverifikasi)
src/app/settings/page.tsx     Unit, rest default, alert, RPE, awal minggu     (WIP, belum diverifikasi)
```

### 1.3 Apa yang sudah diverifikasi berjalan (click-through Playwright, viewport Pixel 7)

Semua di bawah ini lulus pada commit `eaa695b`, tanpa console error:

- Start empty workout, add exercise lewat picker (search, filter otot, empty state "no match").
- Complete set tanpa reps: pesan inline "Enter reps before completing this set", fokus ke input reps.
- Complete set: rest timer muncul (1:30 default), +15s, skip, header volume 480 kg dan sets 1/3.
- Badge PR live muncul untuk gerakan baru, dan muncul lagi saat 62.5x8 mengalahkan 60x8.
- Reload halaman: sesi aktif dan set yang sudah dicentang tetap ada.
- Ubah tipe set ke warm-up, Escape menutup sheet, add set membawa beban, remove set.
- Rest per exercise diubah ke 2:00, "Move up" disabled di posisi pertama.
- Tab dari nama workout mendarat di tombol Finish, Enter membuka dialog Finish dengan catatan
  "2 sets were not marked done and will not be saved" dan daftar PR.
- Finish menyimpan sesi; Home menampilkan recent workout; kolom Previous menampilkan "60 x 8" dan
  tap mengisi weight/reps; discard dengan konfirmasi.
- Tidak ada horizontal overflow di Home dan Workout pada 412px.

### 1.4 Yang belum diverifikasi dan defect yang diketahui

| # | Item | Dampak | Status |
|---|---|---|---|
| D1 | `progress/page.tsx` dan `WorkoutCalendar.tsx` memanggil `Date.now()` saat render; React Compiler lint menolak (5 error) | `npm run lint` merah; perilaku runtime kemungkinan benar tapi bisa menyebabkan hydration mismatch pada `isToday` | Perlu dipindah ke `useNow()` atau `useState(() => Date.now())` |
| D2 | Halaman routines, exercises, progress, history, settings belum pernah dibuka di browser | Bisa ada bug layout/overflow/Recharts SSR | Perlu click-through + screenshot sebelum dianggap selesai |
| D3 | Tidak ada e2e test di repo; skrip Playwright hanya ada di scratchpad sesi | Regression tidak terdeteksi otomatis | Pindahkan ke `e2e/` dengan `@playwright/test` memakai Chromium bawaan |
| D4 | `useAllExercises()` membuat array dan map baru setiap render | Re-render berlebih di picker dan list besar | `useMemo` berdasarkan `custom` |
| D5 | Finish membuang set yang tidak dicentang tanpa opsi "tandai semua selesai" | Lifter yang lupa mencentang kehilangan data | Tambah tombol "Mark all remaining as done" di FinishDialog |
| D6 | `startedAt` bisa lebih awal dari set pertama (timer berjalan saat lupa menutup sesi) | Durasi sesi menggelembung | Tambah "Adjust start time" dan auto-pause bila tidak ada set 30 menit |
| D7 | Belum ada ekspor/impor data; semua data hanya di `localStorage` satu browser | Risiko kehilangan total | Export JSON/CSV dan import wajib ada sebelum fitur lain menambah data (foto!) |
| D8 | Bodyweight exercise: tidak bisa mencatat beban tambahan (weighted pull-up) | Progres pull-up tidak terekam | Field `extraWeightKg` opsional |
| D9 | Penomoran set: warm-up tidak dihitung, tapi drop set dan failure dihitung sebagai set kerja bernomor (sesuai Hevy); belum ada tes | Ambiguitas kecil di UI | Tes snapshot penomoran |
| D10 | Nama produk masih "Heavy" di metadata, README, Home, DESIGN.md | Branding | Ganti ke ABOT di milestone 1 |

### 1.5 Penilaian kualitas singkat

Yang baik dan layak dipertahankan: model domain netral (berat selalu kg), PR engine yang sudah
diuji, hidrasi store yang benar, aksesibilitas dasar (label, 44px, focus ring, native `<dialog>`,
status teks bukan warna saja), token warna yang terbukti lulus kontras.

Yang perlu dirombak untuk ABOT: `SetRow` sudah padat (6 kolom pada 360px); menambah myo-reps,
quick-step, durasi inline, dan superset harus lewat desain ulang baris, bukan tambal. Store workout
akan tumbuh; perlu dipecah per concern (session, timer, records). Penyimpanan `localStorage`
(batas sekitar 5 MB) tidak cukup untuk foto body check-in dan ilustrasi; perlu IndexedDB.

---

## 2. Definisi Produk ABOT

### 2.1 Intent

Logger latihan beban yang lebih cepat dipakai di lantai gym daripada Hevy (target di bawah 4 detik
per set), dengan analitik yang jujur, dan lapisan AI yang membantu memutuskan beban hari ini.

### 2.2 Goals

1. Paritas penuh dengan alur inti Hevy (Pilar 1) sehingga pengguna Hevy tidak kehilangan apa pun.
2. Empat perbaikan UX yang Hevy tidak punya (Pilar 2), masing-masing menyelesaikan keluhan nyata.
3. Fitur AI yang memberi keputusan, bukan hiasan (Pilar 3), dan tetap berfungsi tanpa AI.
4. Lulus Delivery Gate antislop di setiap rilis.

### 2.3 Non-goals (untuk versi ini)

- Fitur sosial: feed, follow, like, komentar.
- Sinkronisasi multi-perangkat real-time dan akun pengguna (lihat pertanyaan terbuka Q1).
- Program latihan berbayar atau marketplace routine.
- Integrasi wearable (HR, Apple Health, Google Fit).
- Nutrisi dan berat badan harian selain yang menempel pada body check-in.

### 2.4 Anti-goals (yang membuat produk gagal meski "jalan")

- Logging jadi lebih lambat dari Hevy karena fitur bertumpuk di baris set.
- Angka yang tidak bisa dipertanggungjawabkan (persentase recovery tanpa dasar, PR palsu).
- Fitur AI yang memblokir alur dasar saat offline atau token tidak ada.
- UI yang terlihat seperti template dashboard generik.

### 2.5 Constraints

- Mobile-first 360px, satu tangan, kondisi gym (dim, tangan berkeringat, terburu-buru).
- Offline-first: logging harus bekerja tanpa jaringan; AI bersifat progressive enhancement.
- Token Replicate hanya di server (Route Handler Next.js), tidak pernah di bundle client.
- Data pengguna adalah milik pengguna: ekspor penuh tersedia sebelum fitur berbasis data berikutnya.
- Tidak ada angka, testimoni, atau klaim performa yang tidak diukur (R-17, R-36).

---

## 3. Pendekatan Arsitektur (pilih satu)

Tiga pendekatan yang masuk akal. Yang lemah sudah dibuang (mis. Next.js penuh dengan Prisma +
Postgres tanpa offline: bertentangan dengan constraint gym offline).

### Pendekatan A: Local-first + serverless AI (direkomendasikan)

- Data di perangkat: pindah dari `localStorage` ke IndexedDB (Dexie) untuk sesi, routine, foto,
  ilustrasi. Zustand tetap untuk state UI dan sesi aktif.
- PWA installable, service worker untuk shell dan aset.
- Fitur AI lewat Route Handler `/api/ai/*` yang memegang `REPLICATE_API_TOKEN`; client mengirim
  audio/prompt, menerima hasil, menyimpan hasil ke IndexedDB (URL Replicate kedaluwarsa 1 jam).
- Ekspor/impor JSON untuk backup dan pindah perangkat.

Trade-off: tanpa akun, tidak ada sync antar perangkat; kehilangan browser = kehilangan data
kecuali rajin ekspor. Biaya infrastruktur hampir nol; semua fitur Pilar 1 dan 2 tidak butuh server.

### Pendekatan B: Supabase penuh (auth + Postgres + Storage) dengan cache lokal

- Setiap entitas disimpan di Postgres via Supabase, foto di Storage, RLS per user.
- Cache lokal untuk sesi aktif agar refresh aman; sinkronisasi saat online.
- Route Handler AI tetap sama.

Trade-off: sync multi-perangkat dan backup otomatis sejak hari pertama, tetapi offline-first
menjadi pekerjaan nyata (konflik, antrean mutasi), ada biaya layanan, dan auth menambah 1 sampai 2
minggu kerja sebelum fitur produk terasa.

### Pendekatan C: A sekarang, B sebagai lapisan sync opsional nanti

- Bangun A dengan repository layer (`src/data/repo/*`) yang memisahkan store dari penyimpanan.
- Saat sync dibutuhkan, tambahkan adapter Supabase di belakang interface yang sama; data lokal
  tetap sumber kebenaran saat offline.

Trade-off: sedikit lebih banyak abstraksi sejak awal (satu interface repo), tetapi tidak memaksa
keputusan backend sekarang dan tidak menghalangi pengembangan fitur.

Rekomendasi: **C** (A dengan repository layer). Alasan: constraint offline dan kecepatan logging
adalah inti produk; semua fitur Pilar 1 sampai 3 bisa diselesaikan tanpa backend data; satu
interface repo murah dan membuat migrasi ke Supabase tidak memerlukan penulisan ulang UI.
Keputusan ini menunggu jawaban owner (Q1 di bagian 9).

---

## 4. PILAR 1: Core Parity dengan Hevy

### 4.1 Live Workout Logger

Keadaan: ada, berfungsi, diverifikasi. Perlu upgrade untuk item di bawah.

| Fitur | Desain ABOT | Perubahan model data |
|---|---|---|
| Set types W / 1,2,3 / D / F | Sudah ada | Tidak ada |
| Myo-reps `M` | Tipe baru; chip warna teal `#2dd4bf` (perlu cek kontras, target > 4.5:1 di `#18181b`); dihitung sebagai set kerja; sheet tipe set menjelaskan "aktivasi + mini set" | `SetType` tambah `"myorep"`; `SET_TYPE_META` tambah entri |
| Kolom Previous | Sudah ada; upgrade: tampilkan tipe set sebelumnya (W/D/F/M) dan beri "Previous" dari sesi dengan varian lokasi yang sama (lihat 5.3) | `previousSets()` menerima `variantKey` |
| RPE | Sudah ada sebagai input angka. Upgrade: picker 6 sampai 10 step 0.5 sebagai sheet dengan label singkat ("RPE 8: 2 reps left") agar tidak mengetik | Tidak ada |
| Inline duration timer (plank, cardio) | Exercise mendapat `logType`: `weight_reps` (default), `reps_only`, `duration`, `distance_duration`. Baris set untuk `duration` menampilkan tombol start/stop + mm:ss, bukan weight/reps. Volume tidak dihitung; durasi masuk statistik waktu | `Exercise.logType`; `WorkoutSet.durationSec`, `WorkoutSet.distanceM` |
| Superset color-coding | `SessionExercise.supersetId` (nanoid) dan `RoutineExercise.supersetId`. Exercise yang satu superset mendapat garis tepi kiri 3px berwarna dari palet superset tetap (4 warna, urutan tetap, divalidasi CVD dengan `dataviz` validator) dan label "Superset A". Rest timer dimulai setelah set terakhir dalam superset, bukan tiap set | `supersetId?: string` di kedua tipe |

Catatan antislop untuk garis tepi kiri: R-01/R-31 melarang stripe dekoratif; di sini stripe
membawa informasi (keanggotaan superset) dan hanya muncul saat superset ada. Alasan tercatat.

### 4.2 Calculators

**Warm-up Set Generator.** Input: beban kerja pertama (kg), bar `barWeightKg` (default 20,
dapat 15/10/7 di settings), jumlah set warm-up (default 3). Output deterministik:

```
ramp = [0.40, 0.60, 0.80] untuk 3 set; [0.50, 0.75] untuk 2; [0.40, 0.55, 0.70, 0.85] untuk 4
reps = [8, 5, 3] (3 set), [6, 3] (2 set), [8, 5, 3, 1] (4 set)
weight_i = roundToPlate(max(bar, work * ramp_i), smallestPlateKg * 2)
```

Set dengan beban di bawah bar digabung menjadi satu set bar kosong. Tombol "Generate warm-ups" di
menu exercise; hasil dimasukkan sebagai set tipe W di atas set kerja. Unit test memuat tabel
contoh (60 kg kerja, bar 20, plate 1.25: 20x8, 37.5x5, 47.5x3).

**Plate Calculator visual.** Input: beban target, bar, inventaris plate (default
25/20/15/10/5/2.5/1.25 kg, dapat diubah per lokasi gym). Output: daftar plate per sisi, digambar
sebagai SVG batang horizontal dengan plate sebagai persegi panjang berlabel angka (lebar
proporsional diameter plate, warna per berat mengikuti kode IPF: 25 merah, 20 biru, 15 kuning,
10 hijau, 5 putih, 2.5 hitam, 1.25 krom; selalu berlabel angka sehingga warna bukan satu-satunya
penanda). Jika beban tidak bisa dicapai, tampilkan beban terdekat yang bisa dan selisihnya.
Dibuka dari tap-and-hold pada input weight dan dari tombol di menu exercise.

### 4.3 PR & Set Records Engine

Keadaan: `detectSessionPRs()` sudah ada untuk 3 jenis, diuji, live di baris set.

Tambahan **Rep PR pada beban tertentu**: untuk setiap set kerja, cari rep terbaik sebelumnya pada
beban yang sama (toleransi 0.01 kg). Jika reps sekarang lebih besar, badge "Rep PR @ 60 kg".
Implementasi: `PRKind` tambah `"rep_pr"`; `buildPRTable` menyimpan `repsByWeight: Map<number,
number>` per exercise; `detectSessionPRs` membandingkan. Unit test: 60x8 lalu 60x10 = Rep PR;
60x10 lalu 62.5x6 = Heaviest tapi bukan Rep PR.

Semua PR dihitung per `variantKey` (exercise + lokasi) agar PR mesin gym A tidak dibandingkan
dengan gym B (lihat 5.3). Halaman exercise menampilkan PR per varian dan "all locations".

### 4.4 Routine Post-Session Sync

Saat `finishActive()` dipanggil pada sesi dengan `routineId`:

1. Hitung diff antara sesi (exercise, urutan, jumlah set kerja, tipe set) dan routine.
   Beban/reps aktual selalu dianggap "kemajuan", bukan perubahan struktur, kecuali owner memilih
   "update target".
2. Jika ada perubahan struktur: tampilkan sheet "Update routine?" dengan ringkasan diff
   ("+ Cable Fly, 3 sets", "Bench Press: 3 -> 4 sets") dan dua tombol: "Update <nama routine>"
   dan "Keep original routine". Checkbox tambahan: "Also set today's weights as new targets".
3. Tanpa perubahan struktur: tidak ada modal (jangan mengganggu).

Fungsi murni `diffSessionAgainstRoutine(session, routine): RoutineDiff` diuji unit.

### 4.5 Muscle Heatmap dan Analytics

Keadaan: sets per otot (bar horizontal), volume/minggu, workout/minggu, menit/minggu, kalender
dan streak sudah ditulis (WIP, belum diverifikasi).

Tambahan:

- **Radar keseimbangan otot**: Recharts `RadarChart` 8 sumbu (Chest, Back, Shoulders, Arms,
  Core, Quads, Hamstrings+Glutes, Calves) menampilkan sets 4 minggu terakhir, dinormalisasi
  terhadap sumbu terbesar. Satu seri, satu hue, label langsung di tiap sumbu. Radar hanya untuk
  "bentuk keseimbangan"; angka tetap di bar chart (radar buruk untuk membaca nilai).
- **Heatmap tubuh**: dua siluet (depan/belakang) sebagai SVG statis buatan sendiri dengan path
  per grup otot; isi warna sequential satu hue (5 step, divalidasi validator `dataviz` terhadap
  surface gelap) berdasarkan sets 7 hari. Tooltip per grup dengan angka. Ini aset visual; sesuai
  R-23, bentuk siluet dikonfirmasi ke owner lewat sketsa sebelum dibuat (atau digenerate lewat
  Replicate, lihat 6.3, dengan placeholder berlabel sampai disetujui).
- **Grafik per exercise**: 1RM estimasi sudah ada; tambah toggle "Heaviest set" dan "Volume per
  session" (bukan dual-axis; satu metrik per tampilan).
- **Kalender**: sudah ada; tambah penanda hari dengan PR.

---

## 5. PILAR 2: Perbaikan Kelemahan Hevy

### 5.1 Ultra-Fast Logging (< 4 detik per set)

Target terukur: dari tap pertama pada baris sampai set tercentang, median < 4 detik pada
pengujian internal dengan 20 set berturut; diukur dengan instrumentasi `performance.mark` di
dev build, dilaporkan hanya jika benar-benar diukur.

- **Smart Placeholder**: sudah ada sebagian (tap centang pada baris kosong mengisi dari Previous).
  Upgrade: baris kosong menampilkan nilai Previous sebagai placeholder redup di dalam input (sudah)
  dan centang satu tap mengunci nilai itu termasuk RPE (sudah) tanpa pesan error; error hanya bila
  tidak ada Previous.
- **Quick-Step Micro Buttons**: saat input weight fokus, muncul baris tombol di atas keyboard
  (sticky bottom, 44px): `-2.5`, `-1.25`, `+1.25`, `+2.5` (kg; untuk lbs: `-5 -2.5 +2.5 +5`),
  dan untuk reps `-1`, `+1`. Dengan `inputMode="decimal"` keyboard tetap muncul; opsi settings
  "Numpad ABOT" mengganti keyboard OS dengan numpad kustom di dalam halaman (tanpa keyboard OS,
  tidak ada layout shift). Step disesuaikan `smallestPlateKg * 2` dari lokasi aktif.
- **Carry-forward**: "Add set" sudah menyalin beban/reps set terakhir.
- **Auto-advance**: setelah centang, fokus pindah ke input pertama yang kosong di set berikutnya
  (opsi, default on).

### 5.2 Dumbbell / Unilateral Smart Toggle

- `Exercise.loadMode`: `"total"` (default), `"per_hand"` (dumbbell dua tangan: volume = berat x 2
  x reps), `"unilateral"` (satu sisi bergantian: reps dihitung per sisi, volume = berat x reps,
  UI menampilkan "L/R" opsional).
- Seed data: semua `(Dumbbell)` dua tangan diset `per_hand`; One Arm Row dan Bulgarian Split Squat
  diset `unilateral`.
- Input tetap "beban per tangan" (yang tertulis di dumbbell); header volume dan PR volume memakai
  faktor. Heaviest weight tetap per tangan (itu yang dibandingkan lifter). Label kolom berubah
  menjadi "kg/hand".
- Migrasi: sesi lama dihitung dengan mode exercise saat ini; tambahkan catatan di changelog
  bahwa volume historis dumbbell naik 2x setelah upgrade.

### 5.3 Gym Location / Machine Variant Tagging

- Entitas baru `GymLocation { id, name, barWeightKg, plates[], isDefault }` di settings.
- `WorkoutSession.locationId` dipilih saat start (default: lokasi terakhir; satu tap untuk ganti).
- `variantKey = exerciseId + ":" + (exercise.isMachineDependent ? locationId : "any")`.
  `isMachineDependent` default true untuk equipment `machine` dan `cable`, false untuk barbell,
  dumbbell, bodyweight; dapat di-override per exercise.
- Previous, PR, grafik 1RM, dan coach (6.1) memakai `variantKey`. Halaman exercise punya tab per
  lokasi dan "All".
- Tanpa lokasi yang dibuat pengguna, semuanya berjalan seperti sekarang (lokasi implisit "Home").

### 5.4 Multi-Angle Body Progress Check-in

- Entitas `BodyCheckin { id, date (YYYY-MM-DD), weightKg?, notes?, photos: { front?, side?,
  back? } }` dengan blob foto di IndexedDB (bukan `localStorage`).
- Kamera lewat `<input type="file" accept="image/*" capture="user">` sebagai fallback universal,
  dan `getUserMedia` untuk mode kamera in-app dengan **ghost overlay**: foto terakhir pose yang
  sama ditampilkan transparan 35% di atas viewfinder, plus garis bantu horizon.
- Foto dikompres client-side (canvas, sisi panjang 1280px, JPEG 0.82) sebelum disimpan.
- Tampilan: grid per tanggal (3 slot), compare slider dua tanggal untuk pose yang sama.
- Privasi: foto tidak pernah dikirim ke server kecuali pengguna memilih fitur AI eksplisit
  (tidak ada fitur AI untuk foto tubuh dalam rencana ini).
- Prasyarat keras: ekspor/impor (D7) termasuk foto sebagai ZIP.

---

## 6. PILAR 3: ABOT Differentiators dan Replicate

Prinsip: setiap fitur AI punya jalur non-AI yang setara (voice -> ketik; anatomi -> placeholder
teks; PR card -> render lokal). Semua panggilan Replicate lewat Route Handler dengan token
server; client tidak pernah melihat token.

### 6.1 Auto-Progressive Overload Coach (double progression, tanpa AI)

Logika deterministik, dihitung lokal, diuji unit. Untuk tiap exercise (per `variantKey`) dengan
target rep range (default 8 sampai 12, dapat diatur di routine per exercise):

```
ambil 2 sesi terakhir -> set kerja per sesi
jika sesi terakhir: semua set kerja >= repMax dan RPE median <= 8.5 (atau RPE kosong)
    -> rekomendasi: beban + step (step = 2.5 kg barbell / 1 kg dumbbell per tangan / 1 plate mesin), target repMin
jika sesi terakhir: ada set < repMin, atau RPE median >= 9.5 dua sesi berturut
    -> rekomendasi: beban tetap, target reps sama, catatan "stay"; jika gagal 2x: beban - 10% dibulatkan ke plate (deload)
selain itu
    -> beban tetap, target: reps terbanyak terakhir + 1
```

Badge di atas kartu exercise: "Today: 62.5 kg x 8 to 12" dengan alasan satu baris ("hit 12 reps
on every set last time"). Tap badge mengisi target ke set kosong. Tanpa 2 sesi: badge "Log two
sessions to get a target". Tidak ada badge tanpa data (R-17).

### 6.2 Muscle Recovery & Readiness Estimator (tanpa AI)

Model eksplisit dan dapat dijelaskan di UI ("how is this computed?"):

```
stimulus_m = sum over sesi 7 hari: sets_m (fractional) * faktor_intensitas
   faktor_intensitas = 1.0 (RPE <= 7), 1.15 (RPE 8), 1.3 (RPE >= 9), default 1.1 jika kosong
tau_m (jam) = 48 untuk otot kecil (biceps, triceps, calves, forearms, abs), 72 untuk besar
recovery_m(t) = 100 * (1 - exp(-hours_since_last_m / tau_m)) dikurangi penalti volume:
   penalti = min(30, 3 * stimulus_m_terakhir)  -> dipulihkan linear sepanjang tau_m
hasil dibatasi 0..100, dibulatkan ke 5
```

Tampil sebagai daftar otot dengan bar 0 sampai 100 (satu hue sequential) dan teks "Chest 85%,
trained 2 days ago, 12 sets". Label jujur: "Estimate based on your logged sets and rest time, not
a medical measurement". Unit test memuat tabel nilai.

### 6.3 Integrasi Replicate

Infrastruktur bersama (milestone 4):

- `src/app/api/ai/[task]/route.ts`: POST, validasi input dengan zod, panggil
  `POST https://api.replicate.com/v1/predictions` dengan `Prefer: wait` untuk model cepat
  (< 60 s) atau polling; batas `lifetime: "2m"`; rate limit sederhana per IP; log biaya per
  panggilan.
- Pemilihan model dilakukan lewat API pencarian Replicate saat implementasi (aturan skill:
  "choose a model with the API, not from memory"), lalu `owner/name:version` dipin di
  `src/lib/ai/models.ts` bersama schema input yang sudah dicek. Kandidat awal untuk dicek:
  keluarga `openai/whisper` atau model speech-to-text yang lebih cepat untuk voice; model
  text-to-image dengan dukungan style reference untuk anatomi; tidak ada yang dianggap final
  sebelum schema dibaca.
- Output file Replicate kedaluwarsa 1 jam: Route Handler mengunduh dan mengembalikan bytes ke
  client, client menyimpan ke IndexedDB.
- Tanpa `REPLICATE_API_TOKEN`: endpoint mengembalikan 503 dengan pesan jelas, UI menyembunyikan
  tombol AI dan menampilkan "AI features need a server token" di settings (bukan tombol mati).

**A. Custom Exercise Anatomy Generator**

- Tujuan: ilustrasi otot konsisten gaya dark-vector untuk 44 gerakan seed + custom.
- Pipeline: prompt template tunggal (gaya: "flat dark vector, obsidian background #09090b,
  single highlighted muscle group in electric blue, no text") + style reference image yang
  disetujui owner (R-23: owner mengonfirmasi 3 contoh pertama sebelum batch). Batch 44 gambar
  dijalankan paralel, hasil disimpan ke `public/anatomy/<exerciseId>.webp` lewat skrip CLI
  (bukan runtime), dengan `width/height` tetap 512x512 (R-40).
- Untuk custom exercise: tombol "Generate illustration" di detail exercise, hasil ke IndexedDB,
  placeholder berlabel "No illustration yet" sebelum itu.
- Biaya: dicatat per gambar dari respons API; tidak diklaim sebelum diukur.

**B. AI Voice Set Logger**

- Tombol mic di header exercise card (44px). Rekam lewat `MediaRecorder` (webm/opus), maksimal
  8 detik, kirim ke `/api/ai/transcribe`.
- Transkrip diurai lokal oleh parser deterministik `parseSetUtterance(text, unit)` yang menangani
  pola Indonesia dan Inggris: "enam puluh dua setengah kali delapan rpe delapan", "62.5 for 8 at
  8", "8 reps 60 kilo". Parser diuji unit dengan 30 contoh; tidak bergantung pada LLM.
- Hasil ditampilkan sebagai konfirmasi inline (weight, reps, rpe) yang bisa dikoreksi sebelum
  dicentang. Target latensi < 3 detik end-to-end; diukur, bukan diklaim.
- Fallback: Web Speech API di browser yang mendukung (gratis, offline di beberapa perangkat)
  dipakai lebih dulu; Replicate dipakai bila tidak tersedia atau pengguna memilih.

**C. Shareable ABOT PR Card**

- Render lokal dengan Canvas/`OffscreenCanvas` ke PNG 1080x1350: nama gerakan, angka besar
  (tabular), jenis PR, tanggal, estimasi 1RM, wordmark ABOT sebagai teks. Tidak butuh AI dan
  tidak butuh jaringan; dibagikan lewat Web Share API dengan fallback unduh.
- Opsi AI (nanti, setelah A dan B stabil): latar belakang industrial yang digenerate sekali per
  pengguna dan di-cache; bukan prasyarat.

---

## 7. PILAR 4: Standar Desain ABOT dan Gap Analysis

### 7.1 Identitas visual ABOT

Dasar: `DESIGN.md` saat ini (dial ENERGY 2 / RHYTHM 2 / MOTION 1) tetap berlaku, dengan
penajaman ke arah industrial:

| Keputusan | Nilai | Alasan satu baris |
|---|---|---|
| Nama dan wordmark | "ABOT" sebagai teks, bold, tracking normal, tanpa logo gambar sampai owner memberi arahan (R-23) | Wordmark teks adalah placeholder jujur dan cukup kuat |
| Latar | Obsidian `#09090b`, Steel `#18181b`, `#27272a` | Sudah dicek kontras; gym dim |
| Aksen | `#3b82f6` teks/outline/tint, `#2563eb` tombol terisi | Putih di `#3b82f6` hanya 3.68:1 |
| Status set | W `#facc15`, D `#c084fc`, F `#f87171`, M `#2dd4bf` (cek kontras saat implementasi) | Arahan owner + satu tambahan; selalu berpasangan dengan huruf |
| Angka | `font-feature-settings: "tnum"` global (sudah), ukuran besar hanya untuk angka header dan PR | Angka adalah konten utama |
| Sudut | 6px kontrol, 12px kartu, 0px pada chip superset dan PR card | Industrial: lebih sedikit lengkung, tidak ada pill |
| Garis | Divider 1px `#3f3f46`; batas kontrol `#71717a` | Non-text contrast 3:1 |
| Motif identitas | Chip persegi tipe set yang "menyala" biru saat selesai; PR card dengan angka raksasa | Terlihat ABOT walau logo dilepas |
| Motion | Bar rest timer, transisi < 200ms, mati di reduced-motion | MOTION 1 |
| Tipografi | Geist Sans (tnum, x-height tinggi) | Kolom 60px tetap terbaca; alasan tercatat di DESIGN.md |

Checklist antislop yang akan dijalankan tiap milestone: Delivery Gate core + UI, layoutmobile,
human (contrast checker untuk setiap warna baru), copywriting untuk semua string UI.

### 7.2 Gap Analysis

Status: **Done** = ada dan diverifikasi di browser; **Needs Upgrade** = ada sebagian atau belum
diverifikasi; **Not Started** = belum ada kode.

| Pilar | Fitur | Status | Ada di kode | Yang kurang |
|---|---|---|---|---|
| 1.1 | Set types W / N / D / F | Done | `SetType`, `SetTypeMenu`, `SetTypeChip` | Tes penomoran |
| 1.1 | Myo-reps `M` | Not Started | | Tipe, warna, semantik volume |
| 1.1 | Kolom Previous | Done | `previousSets()`, `SetRow` | Per varian lokasi, tampilkan tipe set |
| 1.1 | RPE input | Done | `NumberField` RPE | Picker 6..10 step 0.5 |
| 1.1 | Inline duration timer | Not Started | | `logType`, `durationSec`, UI baris durasi |
| 1.1 | Superset color-coding | Not Started | | `supersetId`, palet 4 warna, rest setelah superset |
| 1.1 | Auto rest timer | Done | `RestTimerBar`, store | Rest setelah superset |
| 1.2 | Warm-up generator | Not Started | | Fungsi murni + UI |
| 1.2 | Plate calculator | Not Started | | Fungsi murni + SVG |
| 1.3 | PR Heaviest / 1RM / Volume | Done | `detectSessionPRs`, 10 tes | Per varian lokasi |
| 1.3 | Rep PR pada beban tertentu | Not Started | | `repsByWeight` di PR table |
| 1.4 | Routine post-session sync | Not Started | | `diffSessionAgainstRoutine`, sheet |
| 1.4 | Routine builder + folder + start | Needs Upgrade | `routines/*` (WIP) | Verifikasi browser, superset, rep range target |
| 1.5 | Sets per muscle (bar) | Needs Upgrade | `MuscleSplit` (WIP) | Verifikasi, lint D1 |
| 1.5 | Radar keseimbangan | Not Started | | `RadarChart` 8 sumbu |
| 1.5 | Body heatmap | Not Started | | Siluet SVG (R-23), skala sequential |
| 1.5 | Kalender + streak | Needs Upgrade | `WorkoutCalendar`, `weekStreak` (tes lulus) | Verifikasi browser, penanda PR |
| 1.5 | Grafik 1RM / volume | Needs Upgrade | `exercises/[id]` (WIP) | Verifikasi, toggle metrik |
| 2.1 | Smart placeholder | Needs Upgrade | `SetRow.toggleComplete` | Tanpa error bila Previous ada (sudah), RPE ikut |
| 2.1 | Quick-step micro buttons | Not Started | | Toolbar sticky, numpad opsional |
| 2.1 | Auto-advance fokus | Not Started | | |
| 2.2 | Unilateral / per-hand toggle | Not Started | | `loadMode`, faktor volume, seed update |
| 2.3 | Gym location / variant | Not Started | | `GymLocation`, `variantKey` di calc |
| 2.4 | Body check-in 3 pose + ghost | Not Started | | IndexedDB, kamera, kompresi, compare |
| 3.1 | Progressive overload coach | Not Started | | Fungsi murni + badge |
| 3.2 | Recovery estimator | Not Started | | Fungsi murni + halaman |
| 3.3A | Anatomy generator | Not Started | | Route Handler, skrip batch, style ref |
| 3.3B | Voice set logger | Not Started | | MediaRecorder, transcribe route, parser |
| 3.3C | PR card | Not Started | | Canvas render, Web Share |
| 4 | Identitas ABOT (rename, wordmark) | Not Started | masih "Heavy" | Rename, metadata, PWA manifest |
| Fondasi | IndexedDB + repository layer | Not Started | `localStorage` | Dexie, migrasi dari localStorage |
| Fondasi | Export / import | Not Started | | JSON + ZIP foto |
| Fondasi | PWA (manifest, SW, ikon) | Not Started | | Ikon butuh arahan owner (R-23) |
| Fondasi | E2E test di repo | Not Started | skrip di scratchpad | `e2e/` Playwright |
| Fondasi | Settings | Needs Upgrade | `settings/page.tsx` (WIP) | Verifikasi, lokasi gym, bar/plates |

Ringkasan: 7 Done, 8 Needs Upgrade, 24 Not Started.

---

## 8. Roadmap dan Milestone

Setiap milestone menghasilkan aplikasi yang berjalan, lulus Delivery Gate, dan di-merge. Setiap
milestone mendapat implementation plan sendiri (`docs/plans/YYYY-MM-DD-m<N>-<nama>.md`) yang
ditulis dengan skill `writing-plans` setelah dokumen ini disetujui.

| Milestone | Isi | Keluaran yang bisa dicek |
|---|---|---|
| **M1 Stabilisasi dan identitas** | Perbaiki D1..D6, D9; rename ke ABOT; e2e Playwright di repo (`e2e/logger.spec.ts`, `e2e/routines.spec.ts`, ...); verifikasi semua halaman WIP; export/import JSON (D7); weighted bodyweight (D8) | `npm run lint`, `npm test`, `npm run e2e` hijau; Delivery Gate PASS untuk 7 halaman |
| **M2 Fondasi data** | Repository layer + Dexie/IndexedDB + migrasi dari localStorage; `GymLocation`; `variantKey` di calc; `loadMode`; `logType` + durasi; `supersetId` | Tes migrasi; data lama tetap terbaca; PR per lokasi |
| **M3 Core parity** | Myo-reps; RPE picker; superset UI + rest; warm-up generator; plate calculator; Rep PR; routine post-session sync; radar + heatmap (siluet setelah konfirmasi owner); penanda PR di kalender | Tabel tes untuk setiap fungsi murni; click-through |
| **M4 Ultra-fast logging dan body** | Quick-step toolbar + numpad opsional; auto-advance; instrumentasi waktu per set; body check-in 3 pose + ghost overlay + compare; export ZIP foto | Median waktu per set diukur dan dilaporkan apa adanya |
| **M5 Coach dan recovery** | Double progression coach; recovery estimator; halaman "Readiness" | Tabel nilai uji untuk kedua model |
| **M6 Replicate** | Route Handler AI + pemilihan model lewat API; voice logger (Web Speech dulu, Replicate kedua) + parser; anatomy generator (3 contoh -> persetujuan -> batch); PR card lokal | Tanpa token: UI tetap utuh; dengan token: latensi dan biaya diukur |
| **M7 PWA dan rilis** | Manifest, ikon (setelah arahan owner), service worker, halaman "About / data on your device", audit akhir Delivery Gate + dataviz + human | Lighthouse dijalankan dan angkanya dilaporkan apa adanya |

Urutan ini sengaja menaruh fondasi data (M2) sebelum fitur yang menambah data (M3, M4), dan
menaruh AI (M6) setelah semua jalur non-AI selesai sehingga AI benar-benar enhancement.

### 8.1 Perubahan model data yang direncanakan (ringkasan untuk M2)

```ts
type SetType = "warmup" | "normal" | "dropset" | "failure" | "myorep";
type LogType = "weight_reps" | "reps_only" | "duration" | "distance_duration";
type LoadMode = "total" | "per_hand" | "unilateral";

interface Exercise { ...; logType: LogType; loadMode: LoadMode; isMachineDependent: boolean;
                     targetRepRange?: [number, number]; illustration?: "seed" | "custom" | null }
interface WorkoutSet { ...; durationSec?: number | null; distanceM?: number | null;
                       extraWeightKg?: number | null }
interface SessionExercise { ...; supersetId?: string }
interface RoutineExercise { ...; supersetId?: string; targetRepRange?: [number, number] }
interface WorkoutSession { ...; locationId?: string }
interface GymLocation { id; name; barWeightKg; plateInventoryKg: number[]; isDefault }
interface BodyCheckin { id; date; weightKg?; notes?; photos: Partial<Record<"front"|"side"|"back", string /* blob key */>> }
type PRKind = "heaviest_weight" | "best_1rm" | "best_set_volume" | "rep_pr";
```

Semua field baru opsional atau punya default sehingga data `localStorage` lama termigrasi tanpa
kehilangan.

### 8.2 Perkiraan ukuran

Dalam satuan "sesi kerja agen dengan review": M1 1, M2 1.5, M3 2.5, M4 2, M5 1, M6 2, M7 1.
Ini perkiraan, bukan komitmen; akan direvisi di setiap implementation plan.

---

## 9. Pertanyaan Terbuka untuk Owner (urut dari yang paling mengubah rencana)

- **Q1. Backend.** Pendekatan C (local-first + repository layer, Supabase nanti) direkomendasikan.
  Setuju, atau akun + sync multi-perangkat harus ada sejak awal (Pendekatan B)?
- **Q2. Bahasa UI.** Saat ini semua string UI bahasa Inggris. ABOT mau Inggris saja, Indonesia
  saja, atau keduanya (i18n menambah pekerjaan di setiap task)?
- **Q3. Logo dan ikon PWA.** Perlu arahan (bentuk, konsep) sebelum dibuat; sampai itu ada,
  wordmark teks "ABOT" dipakai.
- **Q4. Siluet heatmap dan gaya anatomi.** Owner ingin menyetujui 3 contoh gambar Replicate dulu,
  atau menyerahkan gaya ke agen dengan placeholder berlabel sampai batch selesai?
- **Q5. Token Replicate.** Siap disediakan untuk M6 lewat form kredensial aman (bukan chat)?
  Tanpa itu M6 hanya bisa diuji dengan mock.
- **Q6. Voice logger.** Boleh memakai Web Speech API bawaan browser sebagai jalur pertama
  (gratis, tanpa server) dan Replicate sebagai jalur kedua?

Keputusan yang sudah diambil agen dan bisa dikoreksi owner: unit penyimpanan kg; Epley untuk
1RM; fractional set 0.5 untuk otot sekunder; default rep range 8 sampai 12; model recovery
eksponensial dengan tau 48/72 jam; warna myo-reps teal; Geist Sans dipertahankan.

---

## 10. Definisi "Selesai" untuk setiap milestone

1. `npm run lint`, `npm test`, `npm run build`, `npm run e2e` hijau.
2. Click-through tercatat (elemen demi elemen) pada viewport 360px dan 640px.
3. Delivery Gate antislop (core + UI + layoutmobile + human) PASS dengan bukti per item.
4. Setiap warna baru dicek dengan `contrast-check.py`; setiap palet kategorikal baru dicek dengan
   validator `dataviz`.
5. Tidak ada angka di UI yang tidak berasal dari data pengguna atau perhitungan yang dijelaskan.
6. PR di-update dengan ringkasan dan screenshot; owner menyetujui sebelum milestone berikutnya.
