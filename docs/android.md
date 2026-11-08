# Android app (Capacitor)

ABOT ships to Android as a Capacitor app: the Next app is exported as static files
(`ABOT_TARGET=android`, see `next.config.ts`) and bundled inside the APK. It runs with no
network, same as the web build.

## Get an APK without installing anything

Every push to `main` or a `claude/*` branch runs **Android APK** in GitHub Actions
(`.github/workflows/android.yml`). Open the run, download `abot-debug-apk` under Artifacts,
unzip it and install `app-debug.apk` on the phone (allow "Install unknown apps" once).

## Build on your own machine

Needs Node 22, JDK 21 and Android Studio (with the Android SDK).

```bash
npm ci
```

```bash
npm run android
```

`npm run android` exports the web app, copies it into `android/` (`cap sync`) and opens
Android Studio; press Run there with a phone plugged in or an emulator started.
After changing web code, `npm run build:android` refreshes the copy.

## How the export works

- Detail pages read their id from the query string (`/history?id=…`), because a static export
  has one HTML file per page. Build links with `src/lib/routes.ts`.
- Partial prerendering is off for the export (it needs a server); the web build keeps it.
- Launcher icons live in `android/app/src/main/res`: ABOT's mark on Matte Obsidian `#09090B`.
- App id is `app.abot.gym` (`capacitor.config.ts`). It cannot change once the app is on
  Google Play.

## Updates keep your data

Every APK is signed with the same debug key (`android/app/abot-debug.keystore`, Android's public
debug passwords) and CI numbers each build (`versionCode` = run number). A new APK therefore
installs over the old one and keeps the workouts. That key is for side-loaded test builds only.

## Native pieces

- `src/lib/native/files.ts`: share sheet (`@capacitor/share`) and saving files through the
  app's own `FileSaver` plugin (`android/app/src/main/java/app/abot/gym/FileSaverPlugin.java`):
  PNGs to Pictures/ABOT, backups and the calendar file to Download/ABOT.
- `LiveWorkoutPlugin.java` (app-local): the workout in progress as an ongoing notification
  while ABOT is in the background, with a clock Android ticks itself (rest countdown, then the
  workout clock). On Android 16 it is a Live Update, a chip in the status bar. Shown on the
  app's pause event: the WebView keeps reporting "visible" in the background.
- `src/lib/native/notify.ts`: the rest-over alarm and the weekly reminders, scheduled with Android (`@capacitor/local-notifications`) so they arrive while
  ABOT is frozen or closed. Android 12+ may deliver alarms late unless exact alarms are
  allowed; Settings offers the switch.
- `src/lib/native/haptics.ts`: vibration (`@capacitor/haptics`).
- `src/components/layout/NativeShell.tsx`: back button and swipe, notification taps, and the
  Google sign-in return (`app.abot.gym://auth/callback`; setup in `docs/cloud-sync-setup.md`).
- The system splash is plain black with no icon, so the app's animated splash is the only one.

## Not yet native

- **Release build** for Google Play needs its own signing key (kept outside the repo) and an
  `.aab`.
