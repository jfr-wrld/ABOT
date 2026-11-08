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
- Launcher icons and splash images live in `android/app/src/main/res`; they are ABOT's mark on
  Matte Obsidian `#09090B`.
- App id is `app.abot.gym` (`capacitor.config.ts`). It cannot change once the app is on
  Google Play.

## Not yet native

- **Google sign-in** for cloud sync: Google refuses sign-in inside an embedded WebView. It needs
  the system browser plus a deep link back into the app. Local use is unaffected.
- **Reminders and the live workout notification** still use the web notification path. Native
  delivery while the app is closed needs `@capacitor/local-notifications`.
- **Release build** for Google Play needs a signing key (kept outside the repo) and an `.aab`.
