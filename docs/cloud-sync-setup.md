# Cloud sync setup (Supabase + Google sign-in)

ABOT works fully without this. These steps turn on the optional "Sign in with Google to Backup &
Sync" in Settings. Everything below happens in your own Supabase and Google Cloud accounts; the
app never needs a secret key.

## 1. Database

In the Supabase dashboard, open **SQL Editor** and run, in order:

1. `supabase/migrations/0001_abot_records.sql`: the `abot_records` table, row level security
   (each user sees only their own rows), the `server_updated_at` trigger and the
   `upsert_if_newer` function.
2. `supabase/migrations/0002_bodyweight_and_media.sql`: allows weigh-ins and custom videos.
3. For Mission Control (`/admin`) and redeem codes: `20261109_admin_and_redeem.sql`, then
   `20261110_lock_down_grants.sql`. Run the second one too on a project that already has the
   first: before it, anyone with the anon key could give any account lifetime access.

Every file is safe to run again. `npm run check:schema` runs the same checks the app relies on
against a throwaway local Postgres.

## 2. Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**. Add this
   authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase, **Authentication > Providers > Google**: turn it on and paste the client ID and
   secret. The secret stays in Supabase; it is never part of ABOT.
3. In Supabase, **Authentication > URL Configuration**: set **Site URL** to where ABOT runs, and add
   `https://<your ABOT domain>/settings` (and `http://localhost:3000/settings` for local
   development) to **Redirect URLs**. Google sends people back to Settings after signing in;
   ABOT then takes them on to the page they started from (Profile, say), so `/settings` is the only
   redirect URL needed.

## 3. The app

Put the project URL and anon key in `.env` (never commit it; `.env.example` shows the names):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

The anon key is public by design: row level security limits it to the signed-in user's own rows.

## 4. The Android app

1. In Supabase, **Authentication > URL Configuration > Redirect URLs**, add
   `app.abot.gym://auth/callback`. Google sends the app back there after sign-in.
2. In GitHub, **Settings > Secrets and variables > Actions > Variables**, add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as `.env`.
   The "Android APK" workflow builds them into the APK; without them it is local-only.

In the app, sign-in opens Google in the phone's browser (a Custom Tab): Google does not allow
sign-in inside an app's WebView. Nothing changes in Google Cloud.

## How sync behaves

- Guests never load the Supabase library and never contact Supabase.
- After sign-in, everything on the device uploads, and anything already in the account comes down
  and merges. Sync runs when the app opens, when the connection returns, a moment after a workout
  is finished, and from **Sync now**. It never blocks logging.
- The newer edit wins per item (a workout, a routine, a weigh-in). If an edit made offline loses to
  a newer one from another phone, the older version is kept on the device (up to 50).
- The workout in progress stays on its phone until it is finished.
- Signing out keeps everything on the device. Signing in with a different account uploads this
  device's data to that account.

## Known limits

- A free Supabase project pauses after about a week without activity. Data is safe; sync stops
  until you resume the project in the dashboard.
- Last-write-wins uses each phone's clock. A phone with a badly wrong clock can lose a tie.
- Not verified against a live project from the development sandbox (its network cannot reach
  Supabase, and Google sign-in needs your account). The browser tests answer Supabase's API with
  recorded responses instead. The first real sign-in is the live test.
