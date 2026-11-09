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
- `LiveWorkoutPlugin.java` (app-local): the workout in progress as an ongoing notification,
  with a clock Android ticks itself (rest countdown, then the workout clock) and buttons
  (+30s, Skip rest, Log set, Pause, Resume) handled by `LiveWorkoutReceiver.java` while ABOT
  is frozen, then replayed in the app (`applyCapsuleAction`, `src/lib/live-capsule.ts`, which
  also builds the text). On Android 16 it is a Live Update, a chip in the status bar.
  `WorkoutLiveService.java` holds it as a foreground service (`specialUse`; a Play release
  must explain it in the Play Console declaration). The service starts only from the app in
  front, as Android 12+ requires; if that is refused, the plain notification stays.
- `src/lib/native/notify.ts`: the rest-over alarm and the weekly reminders, scheduled with Android (`@capacitor/local-notifications`) so they arrive while
  ABOT is frozen or closed. Android 12+ may deliver alarms late unless exact alarms are
  allowed; Settings offers the switch.
- `src/lib/native/haptics.ts`: vibration (`@capacitor/haptics`).
- Permissions (`AppPermissionsPlugin.java`, `src/lib/native/permissions.ts`): a step after the
  intro (`/permissions`, once per install) and a Settings section. Each access maps to a
  feature: notifications (rest alarm, live workout, reminders), camera (Take photo for the
  profile and story background), location (gyms pinned in Settings are picked by themselves
  when a workout starts nearby, `AutoGym`). Photos use Android's picker, which needs none.
  `USE_EXACT_ALARM` keeps the rest alarm on time; a Play release must justify it as a timer.
- `src/components/layout/NativeShell.tsx`: back button and swipe, notification taps, and the
  Google sign-in return (`app.abot.gym://auth/callback`; setup in `docs/cloud-sync-setup.md`).
- The system splash is plain black with no icon, so the app's animated splash is the only one.
- Health Connect (`HealthConnectPlugin.kt`, `src/lib/health-sync.ts`, Settings, Health apps):
  finished workouts are written as weightlifting sessions with their estimated active calories
  (`src/lib/calorie-estimator.ts`); the latest weight and last night's sleep are read back.
  Samsung Health and Huawei Health see them once their own Health Connect sharing is on. Records
  use the workout id as client record id, so a re-sync updates. `@capgo/capacitor-health` was
  not used: it cannot write exercise sessions, and its manifest adds about 50 health
  permissions. The app module builds Kotlin for this (connect-client is coroutine based) and
  needs minSdk 26. `HealthPermissionsRationaleActivity` answers Health Connect's "why" link;
  without an activity for `ACTION_SHOW_PERMISSIONS_RATIONALE` no permission dialog appears.
  The emulator smoke test grants the permissions and writes a workout twice.

## Not yet native

- **Release build** for Google Play needs its own signing key (kept outside the repo) and an
  `.aab`.
