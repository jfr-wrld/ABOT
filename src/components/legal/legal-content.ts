/**
 * The Privacy Policy and Terms of Use, in English and Indonesian. Kept as plain data rather than
 * t() strings: long legal text reads better whole, and each language is reviewed as one piece.
 * Every statement here describes what the code does today; change both when the app changes
 * (network calls, synced data, payments). Contact and operator per the owner, 2026-11-10.
 */

export type LegalLang = "en" | "id";
export type Block = { p: string } | { list: string[] };
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; blocks: Block[] }[];
}

import { CONTACT_EMAIL } from "@/lib/social";

export { CONTACT_EMAIL };
export const EFFECTIVE = { en: "10 November 2026", id: "10 November 2026" };

export const PRIVACY: Record<LegalLang, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    updated: `Effective ${EFFECTIVE.en}`,
    intro:
      "ABOT is a strength training log. It is built to work on your phone first: your workouts stay on the device unless you choose to back them up. This policy explains what ABOT keeps, where it goes, and how to remove it.",
    sections: [
      {
        heading: "Who we are",
        blocks: [{ p: `ABOT ("we") runs the ABOT app on the web (abot-app.vercel.app) and on Android. Questions about privacy: ${CONTACT_EMAIL}.` }],
      },
      {
        heading: "What stays on your phone",
        blocks: [
          {
            p: "Without an account, everything you enter is stored only in your browser or the app on your phone, and is not sent to us:",
          },
          {
            list: [
              "workouts, sets, routines, custom exercises and personal records;",
              "your profile: name, username, height, bodyweight log, body phase and nutrition targets;",
              "your profile photo and workout photos (resized on the phone and never uploaded);",
              "the gyms you save and your settings.",
            ],
          },
          { p: "You can export all of it as a backup file from Settings, and import it again." },
        ],
      },
      {
        heading: "If you sign in (optional backup and sync)",
        blocks: [
          {
            p: "Signing in with Google is optional. If you do, ABOT uses Supabase (our database and sign-in provider) to keep a copy so it can restore on another phone:",
          },
          {
            list: [
              "your account: email address, and the name and picture Google shares with the app;",
              "your routines and finished workouts (exercises, sets, weights, reps, notes and times);",
              "your plan (free, PRO, lifetime) and any redeemed codes.",
            ],
          },
          { p: "Photos, the bodyweight log, gyms and settings are not uploaded. Each account can read only its own data." },
        ],
      },
      {
        heading: "Payments",
        blocks: [
          {
            p: "PRO is bought through Midtrans, a licensed Indonesian payment gateway. ABOT sends Midtrans the order, its amount and your account email. You enter your payment details on Midtrans' page; ABOT never sees or stores card numbers, bank or e-wallet credentials. We keep the order: plan, amount, status, payment method type and dates, to grant PRO and handle refunds.",
          },
        ],
      },
      {
        heading: "Other services ABOT contacts",
        blocks: [
          {
            list: [
              "Exercise pictures load from GitHub (the open free-exercise-db collection), and demonstration videos play from YouTube in privacy-enhanced mode, only when you open them.",
              "Finding nearby gyms sends your approximate location to OpenStreetMap services (Overpass and Nominatim), only when you ask for it.",
              "The Android app asks GitHub for a newer version when it starts, and downloads the update from GitHub when you tap Update.",
              "The web app is hosted by Vercel.",
            ],
          },
          { p: "These services see your IP address and the request, as any website would. ABOT has no ads, no analytics and no tracking." },
        ],
      },
      {
        heading: "Android permissions",
        blocks: [
          {
            list: [
              "Health Connect (optional): writes finished workouts and their estimated calories, and reads your latest weight and last night's sleep. That data stays on the phone.",
              "Camera and photos: for your profile and workout photos, only when you take or pick one.",
              "Location: for finding nearby gyms, only when you ask.",
              "Notifications: the workout in progress and the rest timer.",
              "Install apps: to open the installer for an ABOT update you chose to download.",
            ],
          },
        ],
      },
      {
        heading: "How long we keep it, and deleting it",
        blocks: [
          {
            p: `Data on your phone stays until you delete it in the app, clear the app's data or uninstall. Cloud data stays while your account exists. To delete your account and everything stored with it, use Settings, Data & backup, Delete my data, which deletes it at once. You can also email ${CONTACT_EMAIL} from the address you signed in with; we delete it within 30 days. Payment records may be kept as long as Indonesian tax and accounting rules require.`,
          },
        ],
      },
      {
        heading: "Your choices and rights",
        blocks: [
          {
            p: "You can use ABOT without an account, sign out at any time, export your data, and ask us to see, correct or delete what we hold about you, in line with Indonesia's Personal Data Protection Law (UU PDP).",
          },
        ],
      },
      {
        heading: "Children",
        blocks: [{ p: "ABOT is not meant for children under 13, and we do not knowingly collect their data." }],
      },
      {
        heading: "Changes",
        blocks: [{ p: "If this policy changes, we update the date above, and tell you in the app when the change matters." }],
      },
    ],
  },
  id: {
    title: "Kebijakan Privasi",
    updated: `Berlaku ${EFFECTIVE.id}`,
    intro:
      "ABOT adalah catatan latihan beban. Data latihanmu tinggal di HP, kecuali kamu memilih untuk mencadangkannya. Kebijakan ini menjelaskan apa yang disimpan ABOT, ke mana datanya pergi, dan cara menghapusnya.",
    sections: [
      {
        heading: "Siapa kami",
        blocks: [{ p: `ABOT ("kami") menjalankan aplikasi ABOT di web (abot-app.vercel.app) dan Android. Pertanyaan soal privasi: ${CONTACT_EMAIL}.` }],
      },
      {
        heading: "Yang tetap di HP-mu",
        blocks: [
          { p: "Tanpa akun, semua yang kamu isi hanya tersimpan di browser atau aplikasi di HP-mu, dan tidak dikirim ke kami:" },
          {
            list: [
              "latihan, set, rutinitas, latihan buatanmu, dan rekor pribadi;",
              "profil: nama, username, tinggi, catatan berat badan, fase tubuh, dan target nutrisi;",
              "foto profil dan foto latihan (diperkecil di HP dan tidak pernah diunggah);",
              "gym yang kamu simpan dan pengaturanmu.",
            ],
          },
          { p: "Semuanya bisa kamu ekspor sebagai file cadangan dari Pengaturan, lalu diimpor kembali." },
        ],
      },
      {
        heading: "Jika kamu masuk (cadangan dan sinkronisasi, opsional)",
        blocks: [
          { p: "Masuk dengan Google bersifat opsional. Jika kamu masuk, ABOT memakai Supabase (penyedia database dan login kami) untuk menyimpan salinan agar bisa dipulihkan di HP lain:" },
          {
            list: [
              "akunmu: alamat email, serta nama dan foto yang dibagikan Google;",
              "rutinitas dan latihan yang selesai (gerakan, set, beban, repetisi, catatan, dan waktu);",
              "paketmu (gratis, PRO, lifetime) dan kode yang ditukarkan.",
            ],
          },
          { p: "Foto, catatan berat badan, gym, dan pengaturan tidak diunggah. Setiap akun hanya bisa membaca datanya sendiri." },
        ],
      },
      {
        heading: "Pembayaran",
        blocks: [
          {
            p: "PRO dibeli melalui Midtrans, payment gateway berlisensi di Indonesia. ABOT mengirim pesanan, nominal, dan email akunmu ke Midtrans. Data pembayaran kamu isi di halaman Midtrans; ABOT tidak pernah melihat atau menyimpan nomor kartu maupun data bank atau e-wallet. Kami menyimpan data pesanan: paket, nominal, status, jenis metode bayar, dan tanggal, untuk mengaktifkan PRO dan menangani refund.",
          },
        ],
      },
      {
        heading: "Layanan lain yang dihubungi ABOT",
        blocks: [
          {
            list: [
              "Gambar latihan dimuat dari GitHub (koleksi terbuka free-exercise-db), dan video contoh diputar dari YouTube dalam mode privasi, hanya saat kamu membukanya.",
              "Mencari gym terdekat mengirim perkiraan lokasimu ke layanan OpenStreetMap (Overpass dan Nominatim), hanya saat kamu memintanya.",
              "Aplikasi Android menanyakan versi baru ke GitHub saat dibuka, dan mengunduh pembaruan dari GitHub saat kamu mengetuk Perbarui.",
              "Aplikasi web di-hosting oleh Vercel.",
            ],
          },
          { p: "Layanan-layanan ini melihat alamat IP dan permintaanmu, seperti situs web pada umumnya. ABOT tidak memakai iklan, analitik, atau pelacakan." },
        ],
      },
      {
        heading: "Izin Android",
        blocks: [
          {
            list: [
              "Health Connect (opsional): menulis latihan yang selesai beserta perkiraan kalorinya, dan membaca berat badan terakhir serta tidur semalam. Data itu tetap di HP.",
              "Kamera dan foto: untuk foto profil dan foto latihan, hanya saat kamu memotret atau memilih foto.",
              "Lokasi: untuk mencari gym terdekat, hanya saat kamu memintanya.",
              "Notifikasi: latihan yang sedang berjalan dan timer istirahat.",
              "Memasang aplikasi: untuk membuka layar pemasangan pembaruan ABOT yang kamu pilih untuk diunduh.",
            ],
          },
        ],
      },
      {
        heading: "Lama penyimpanan dan penghapusan",
        blocks: [
          {
            p: `Data di HP tetap ada sampai kamu menghapusnya di aplikasi, menghapus data aplikasi, atau mencopot aplikasi. Data cloud disimpan selama akunmu ada. Untuk menghapus akun beserta semua datanya, buka Pengaturan, Data & backup, Hapus dataku; akun langsung terhapus. Kamu juga bisa kirim email ke ${CONTACT_EMAIL} dari alamat yang kamu pakai untuk masuk; kami menghapusnya dalam 30 hari. Catatan pembayaran dapat disimpan selama diwajibkan aturan pajak dan akuntansi di Indonesia.`,
          },
        ],
      },
      {
        heading: "Pilihan dan hakmu",
        blocks: [
          {
            p: "Kamu bisa memakai ABOT tanpa akun, keluar kapan saja, mengekspor datamu, dan meminta kami menunjukkan, memperbaiki, atau menghapus data tentangmu, sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP).",
          },
        ],
      },
      {
        heading: "Anak-anak",
        blocks: [{ p: "ABOT tidak ditujukan untuk anak di bawah 13 tahun, dan kami tidak dengan sengaja mengumpulkan data mereka." }],
      },
      {
        heading: "Perubahan",
        blocks: [{ p: "Jika kebijakan ini berubah, kami memperbarui tanggal di atas, dan memberi tahu di aplikasi bila perubahannya penting." }],
      },
    ],
  },
};

export const TERMS: Record<LegalLang, LegalDoc> = {
  en: {
    title: "Terms of Use",
    updated: `Effective ${EFFECTIVE.en}`,
    intro: "These terms apply when you use ABOT on the web or on Android. By using the app you agree to them.",
    sections: [
      {
        heading: "Training at your own risk",
        blocks: [
          {
            p: "ABOT helps you log and plan training. Its suggestions (weights, rest, recovery, body phases, nutrition and calorie estimates) are general guidance, not medical or professional advice. Check with a doctor before starting a new program, use good form and a spotter, and stop if something hurts. You are responsible for how you train.",
          },
        ],
      },
      {
        heading: "Your account",
        blocks: [
          {
            p: "An account is optional and is used for backup, sync and purchases. Keep your Google account secure; what happens under your account is your responsibility. You can stop using ABOT at any time.",
          },
        ],
      },
      {
        heading: "ABOT // BLACK PRO",
        blocks: [
          {
            list: [
              "PRO features are offered as an annual plan (365 days, added onto any time left), a lifetime licence, and a founder price for eligible accounts. Prices are in Indonesian rupiah and shown before you pay.",
              "Payments are processed by Midtrans. A purchase is tied to your ABOT account and restores on any phone signed in to it.",
              "The annual plan does not renew by itself. When it ends, the app returns to the free plan and your data stays.",
              "\"Lifetime\" means for as long as ABOT is offered.",
              `If something went wrong with a purchase, email ${CONTACT_EMAIL}. Refunds are reviewed case by case and as Indonesian consumer law requires; a refunded purchase removes the PRO it granted.`,
              "During the beta, some PRO features may be free; that can end.",
            ],
          },
        ],
      },
      {
        heading: "Fair use",
        blocks: [
          {
            p: "Do not misuse ABOT: no attempts to break into accounts or systems, abuse redeem codes or payments, overload the service, or copy the app to resell it.",
          },
        ],
      },
      {
        heading: "Content",
        blocks: [
          {
            p: "Your workouts and photos are yours. Exercise pictures come from the open free-exercise-db collection, and linked videos belong to their creators on YouTube and TikTok. The ABOT name, logo and app design belong to ABOT.",
          },
        ],
      },
      {
        heading: "The app as it is",
        blocks: [
          {
            p: "ABOT is provided as it is, and features may change. We work to keep your data safe, but cannot promise the service will never be interrupted or lose data, so keep a backup file. To the extent the law allows, ABOT is not liable for indirect losses, or for more than you paid in the last 12 months.",
          },
        ],
      },
      {
        heading: "Changes and law",
        blocks: [
          {
            p: "We may update these terms; the date above shows the latest version, and important changes are announced in the app. These terms follow the laws of the Republic of Indonesia.",
          },
        ],
      },
      { heading: "Contact", blocks: [{ p: `Questions about these terms: ${CONTACT_EMAIL}.` }] },
    ],
  },
  id: {
    title: "Ketentuan Penggunaan",
    updated: `Berlaku ${EFFECTIVE.id}`,
    intro: "Ketentuan ini berlaku saat kamu memakai ABOT di web atau Android. Dengan memakai aplikasi, kamu menyetujuinya.",
    sections: [
      {
        heading: "Risiko latihan",
        blocks: [
          {
            p: "ABOT membantu mencatat dan merencanakan latihan. Sarannya (beban, istirahat, pemulihan, fase tubuh, nutrisi, dan perkiraan kalori) bersifat panduan umum, bukan nasihat medis atau profesional. Konsultasikan dengan dokter sebelum memulai program baru, jaga teknik, gunakan spotter, dan berhenti bila terasa sakit. Kamu bertanggung jawab atas cara kamu berlatih.",
          },
        ],
      },
      {
        heading: "Akunmu",
        blocks: [
          {
            p: "Akun bersifat opsional dan dipakai untuk cadangan, sinkronisasi, dan pembelian. Jaga keamanan akun Google-mu; aktivitas di akunmu menjadi tanggung jawabmu. Kamu bisa berhenti memakai ABOT kapan saja.",
          },
        ],
      },
      {
        heading: "ABOT // BLACK PRO",
        blocks: [
          {
            list: [
              "Fitur PRO tersedia sebagai paket tahunan (365 hari, ditambahkan ke sisa waktu), lisensi lifetime, dan harga founder untuk akun yang memenuhi syarat. Harga dalam rupiah dan ditampilkan sebelum kamu membayar.",
              "Pembayaran diproses oleh Midtrans. Pembelian terikat pada akun ABOT-mu dan pulih di HP mana pun yang masuk dengan akun itu.",
              "Paket tahunan tidak diperpanjang otomatis. Saat berakhir, aplikasi kembali ke paket gratis dan datamu tetap ada.",
              "\"Lifetime\" berarti selama ABOT masih disediakan.",
              `Jika ada masalah dengan pembelian, kirim email ke ${CONTACT_EMAIL}. Refund ditinjau per kasus dan sesuai hukum perlindungan konsumen Indonesia; pembelian yang di-refund mencabut PRO yang diberikannya.`,
              "Selama masa beta, sebagian fitur PRO bisa gratis; hal ini dapat berakhir.",
            ],
          },
        ],
      },
      {
        heading: "Penggunaan yang wajar",
        blocks: [
          {
            p: "Jangan menyalahgunakan ABOT: tidak boleh mencoba membobol akun atau sistem, menyalahgunakan kode atau pembayaran, membebani layanan, atau menyalin aplikasi untuk dijual kembali.",
          },
        ],
      },
      {
        heading: "Konten",
        blocks: [
          {
            p: "Latihan dan foto milikmu tetap milikmu. Gambar latihan berasal dari koleksi terbuka free-exercise-db, dan video yang ditautkan milik pembuatnya di YouTube dan TikTok. Nama, logo, dan desain aplikasi ABOT milik ABOT.",
          },
        ],
      },
      {
        heading: "Aplikasi apa adanya",
        blocks: [
          {
            p: "ABOT disediakan apa adanya, dan fiturnya bisa berubah. Kami berupaya menjaga datamu, tetapi tidak bisa menjamin layanan tidak pernah terganggu atau kehilangan data, jadi simpan file cadangan. Sejauh diizinkan hukum, ABOT tidak bertanggung jawab atas kerugian tidak langsung, atau melebihi jumlah yang kamu bayar dalam 12 bulan terakhir.",
          },
        ],
      },
      {
        heading: "Perubahan dan hukum",
        blocks: [
          {
            p: "Kami dapat memperbarui ketentuan ini; tanggal di atas menunjukkan versi terbaru, dan perubahan penting diumumkan di aplikasi. Ketentuan ini tunduk pada hukum Republik Indonesia.",
          },
        ],
      },
      { heading: "Kontak", blocks: [{ p: `Pertanyaan tentang ketentuan ini: ${CONTACT_EMAIL}.` }] },
    ],
  },
};
