# ABOT intro: voice-over for ElevenLabs, Bahasa Indonesia

The Indonesian take of `voiceover-elevenlabs.md`: same 22 clips, same start times (seconds from the
start of `video-out/abot-intro.mp4`, from `timeline.mjs`). The on-screen text stays English.

Indonesian runs longer than English, so the lines are shorter in words to fit the same slots. The
tone is casual, "kamu", the way the app talks in Indonesian.

## Settings

- **Model: Eleven v3**, with an Indonesian-capable voice. The audio tags stay in English: v3 reads
  them as directions in any language and does not say them.
- **Stability: Natural.**
- **Pauses:** "..." for a beat, a full stop for a short stop. v3 takes no `<break>` tags.
- **ABOT:** lihat "Cara menyebut ABOT" di bawah.
- Gym words stay English as people say them in the gym: leg day, squat, set, streak, story, layout,
  cut, bulk, recomp, peak.

**Cara menyebut ABOT.** ABOT adalah kata Jawa *abot*, artinya "berat", pas dengan isi aplikasinya:
angkat berat. Ucapkan seperti orang Jawa menyebutnya, dua suku kata ringan, **a-bot**:

- *a* seperti pada "apa", pendek;
- *bot* seperti pada "botol", o terbuka, t-nya tegas;
- tekanan rata, atau sedikit di *bot*. Bukan "Ei-bot", dan tidak dieja A-B-O-T.

Di teks, tulis `Abot` (bukan huruf kapital semua, karena sebagian suara akan mengejanya). Suara
Indonesia biasanya langsung benar; kalau suara Inggris membacanya "Ei-bot", tulis `Ah-bot`.

## Clips, one per generation

Copy the line under each label; the `#` lines are only labels.

```
# 01 · 0.4 s · problem
[deadpan] Aku, tiap leg day.

# 02 · 1.4 s · problem
[confused] Minggu lalu squat berapa, ya...?

# 03 · 5.7 s · problem
[sighs] [sarcastic] Catatanku? ...Nggak kebaca.

# 04 · 6.9 s · problem
[flatly] Nggak ada progres. Bingung.

# 05 · 8.7 s · problem
[whispers] Ada cara yang lebih baik.

# 06 · 11.9 s · hook
[confident] Abot. Angkat berat. Catat semuanya.

# 07 · 15.0 s · log
[warmly] Satu tap per set. Angka minggu lalu udah langsung keisi.

# 08 · 21.8 s · bar
[calm] Timer istirahat jalan.

# 09 · 25.0 s · bar
[upbeat] Pause, selesai set, atau tambah set, langsung dari bar.

# 10 · 28.4 s · routines
[warmly] Bikin rutinitas sendiri, atau mulai dari tujuh belas program siap pakai.

# 11 · 35.4 s · exercises
[confident] Delapan puluh delapan gerakan, lengkap dengan foto dan otot yang dilatih.

# 12 · 42.0 s · progress
[proudly] Lihat tiap kilo bertambah... minggu demi minggu.

# 13 · 48.4 s · history
[excited] Rekor baru langsung kehitung, dan peta otot nunjukin yang kamu latih.

# 14 · 56.0 s · streak
[warmly] Latihan tiap minggu, dan streak-mu terus menyala.

# 15 · 60.4 s · streak
[excited] Jaga apinya tetap nyala!

# 16 · 64.0 s · story
[playfully] Bagikan workout jadi story, ada sebelas layout.

# 17 · 71.5 s · share
[playfully] Atau pamerin streak-mu. [laughs] Dua belas tema, semua gratis.

# 18 · 78.5 s · phase
[punchy] Cut. Bulk. Recomp. Peak.

# 19 · 80.8 s · phase
[calm] Kalori dan makro ngikutin latihanmu.

# 20 · 85.0 s · settings
[playfully] Bahasa Indonesia atau Inggris. Gelap atau terang. Kilo atau pound.

# 21 · 90.0 s · trust
[reassuring] Bisa offline. Tanpa iklan, tanpa pelacakan. Datamu tetap di HP-mu.

# 22 · 96.2 s · outro
[confident] Abot. Pencatat progres gym. Gratis di Android dan web.
```

Line 18 must land one word per beat (78.5, 79.0, 79.5, 80.0). If the clip runs long, generate the
four words as four clips and place each on its beat.

Tightest slots: 11 (6 s before the scene ends at 41.5) and 13 (5.6 s, to 54.0). If a clip runs
over, regenerate it a little faster or drop "lengkap dengan".

## One take, if you prefer

```
[deadpan] Aku, tiap leg day. ...... [confused] Minggu lalu squat berapa, ya...? ......
[sighs] [sarcastic] Catatanku? ...Nggak kebaca. ...... [flatly] Nggak ada progres. Bingung. ......
[whispers] Ada cara yang lebih baik. ......
[confident] Abot. Angkat berat. Catat semuanya. ......
[warmly] Satu tap per set. Angka minggu lalu udah langsung keisi. ......
[calm] Timer istirahat jalan. ...... [upbeat] Pause, selesai set, atau tambah set, langsung dari bar. ......
[warmly] Bikin rutinitas sendiri, atau mulai dari tujuh belas program siap pakai. ......
[confident] Delapan puluh delapan gerakan, lengkap dengan foto dan otot yang dilatih. ......
[proudly] Lihat tiap kilo bertambah... minggu demi minggu. ......
[excited] Rekor baru langsung kehitung, dan peta otot nunjukin yang kamu latih. ......
[warmly] Latihan tiap minggu, dan streak-mu terus menyala. ...... [excited] Jaga apinya tetap nyala! ......
[playfully] Bagikan workout jadi story, ada sebelas layout. ......
[playfully] Atau pamerin streak-mu. [laughs] Dua belas tema, semua gratis. ......
[punchy] Cut. Bulk. Recomp. Peak. ...... [calm] Kalori dan makro ngikutin latihanmu. ......
[playfully] Bahasa Indonesia atau Inggris. Gelap atau terang. Kilo atau pound. ......
[reassuring] Bisa offline. Tanpa iklan, tanpa pelacakan. Datamu tetap di HP-mu. ......
[confident] Abot. Pencatat progres gym. Gratis di Android dan web.
```

## Mixing it in

Same as the English take: duck the soundtrack about 6 dB under the voice, and place `vo-01` to
`vo-22` at the times above.
