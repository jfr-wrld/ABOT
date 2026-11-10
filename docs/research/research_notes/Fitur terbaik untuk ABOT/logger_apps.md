# Manual workout-logging apps: features and user flows (Hevy, Strong, Liftin', Boostcamp, Liftosaur, Gymshark Training), 2025-2026

Research method note: this cloud session could not fetch most primary sites directly (hevyapp.com, strong.app, boostcamp.app, apps.apple.com and sensai.fit all failed DNS resolution under the session's network allowlist). Every finding below comes from web-search result summaries of those pages (official help-center and feature pages, App Store listings, third-party reviews). The summaries quote the pages, but I could not open them in full. Where a summary flagged a conflict or a weak source, the note says so. Items that come only from my background knowledge, with no source found this session, are kept out of Cited Findings and listed under Inferences or Gaps.

## 1. Logging flow details (set types, rest timer, plate/warm-up calculators, RPE, supersets, previous values, watch, live activity, widgets)

### Takeaway
Hevy and Strong have the same core logger: rest timer, plate calculator, warm-up calculator, supersets and RPE. Hevy also has a Live Activity on the lock screen, home-screen widgets, live PR notifications, and since late 2025 limit alerts and a live muscle heatmap during logging. Liftin' stands out for its Apple Watch app: double-tap set logging and a watch Live Activity.

### Cited Findings
**Hevy**
- Hevy's features page lists a warm-up set calculator, weight plate calculator, RPE, supersets, an automatic rest timer, live personal-record notifications, a Live Activity on the lock screen, and home-screen widgets. — [Hevy track-workouts feature page](https://www.hevyapp.com/features/track-workouts/); [Hevy 2025 Features Guide (help center)](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide)
- Warm-up calculator: you open the three-dot menu on an exercise and pick "Add Warm Up Sets". It adds percentage-based warm-up sets, and you can adjust the formula and the plate/dumbbell rounding. The help center lists it as a Pro feature. — [Hevy 2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide)
- The plate calculator works out which plates to load for a target barbell weight. One review says it is not Pro-gated, unlike the warm-up calculator. — [Hevy workout-settings page](https://www.hevyapp.com/features/workout-settings/); [lifting-apps review](https://lifting-apps.pages.dev/reviews/hevy) (third party)
- Supersets can group more than two exercises, and drop sets are supported on individual movements. — [Hevy exercise programming options](https://www.hevyapp.com/features/exercise-programming-options/)
- RPE is switched on in settings. You then pick a value from 6 to 10 for each set. — [Hevy RPE page](https://www.hevyapp.com/features/how-to-calculate-rpe/)
- Version 2.4.5 (Android, uploaded 2025-09-15) added "alerts when logged values exceed set limits" (a typo guard) and strength levels for 10 more exercises. — [APKMirror Hevy 2.4.5](https://www.apkmirror.com/?p=10738953)
- Version 2.5.6 (late 2025, exact date not shown) added a muscle-distribution heatmap you can view while logging, and tap for full details. — [APKMirror Hevy 2.5.6](https://www.apkmirror.com/?p=11862319)
- iOS 3.x (2026, undated in results): 3.0.15 restored duration input as a text field. 3.1.4 added liquid-glass navigation and a full Trainer program view. 3.2.2 rebuilt notes, so a note can be pinned to an exercise (shown every time you train it), pinned to a routine, or added once for today's workout. — [Hevy App Store listing](https://apps.apple.com/za/app/id1458862350) (via search summary)
- Hevy has a Wear OS app (APKMirror lists a Wear OS build, 2.5.4). — [APKMirror Hevy Wear OS](https://www.apkmirror.com/apk/hevy-gym-workout-tracker/hevy-gym-log-workout-tracker-wear-os)
- Hevy community update (July 2026): a Pro feature to swap an exercise for this session only or for all future workouts, plus logging and navigation improvements. The update says these came from Reddit and in-app feedback. — [Hevy community update, July '26](https://www.hevyapp.com/community-updates/july-26/)

**Strong**
- The App Store listing describes a Warm Up Calculator (suggests warm-up weights), a Plate Calculator, Supersets/Grouped Exercises, lbs, kg or mixed units, and a standalone Apple Watch app that logs with or without the iPhone. — [Strong App Store listing](https://apps.apple.com/app/id464254577); [spark.mwm.ai mirror of listing](https://spark.mwm.ai/en/apps/strong-workout-tracker-gym-log/464254577)
- Listings disagree on the minimum watchOS (10.0 vs 8.0). One listing says "Strong 6.0 is currently in early access". — [Strong App Store listing (vc)](https://apps.apple.com/vc/app/id464254577?l=en-gb); [Strong App Store listing (mn)](https://apps.apple.com/mn/app/id464254577)
- One reviewer said logging on the watch is slower than "just us[ing] the normal app". — [Strong App Store listing reviews](https://apps.apple.com/app/strong/id464254577) (via search summary)

**Liftin' (iOS/watchOS only)**
- Apple Watch features: double-tap gesture to log sets, a Live Activity on Apple Watch, and pausing a workout by swiping left on the watch. The newest listing adds new exercise visuals, 60+ new exercises, an option to change the Apple Fitness workout type, and a swipe action to quick-switch exercises. — [Liftin' App Store listing](https://apps.apple.com/app/id1445041669)
- Requires iOS 17 / watchOS 10 or later. — [Liftin' App Store listing](https://apps.apple.com/app/id1445041669)
- iOS 14 widgets and a then-new watch app (older, 2020). — [iMore, 2020](https://imore.com/liftin-workout-tracker-has-ios-14-widgets-new-watch-app-and-tons-more)

### Inferences
- Table stakes for a 2026 logger: an automatic rest timer, a plate calculator, warm-up set generation, supersets, RPE and live PR detection. Hevy's late-2025 additions point to where the market is going: input sanity checks ("value exceeds limit" alerts), a live muscle heatmap during the session, and pinned per-exercise notes.
- For a web/Android PWA like ABOT, the closest substitutes for Live Activity/widgets are an Android notification with the rest countdown and a home-screen shortcut. Watch apps are out of reach.
- Pinned per-exercise notes (Hevy 3.2.2) and "swap for this session vs all future" (Hevy, July 2026) are cheap, high-value, user-requested flows.

### Gaps
- I could not verify each app's exact set-type taxonomy (warm-up / normal / drop / failure labels) or the "previous" column / inline previous-value autofill behaviour from a primary source this session. From background knowledge (unverified here): Hevy and Strong both show the previous session's weight×reps per set row and let a tap copy it in, and Hevy uses W/D/F set-type badges.
- No sourced detail on keyboard/number-pad UX (custom keypads, +/- steppers) for any app.
- Strong's widget and Live Activity support could not be confirmed.

## 2. Routines and programs (templates, folders, marketplaces, progression rules, scheduling)

### Takeaway
Boostcamp is built on a program library and runs on scheduled multi-week programs. Hevy added "Hevy Trainer", which suggests starting weights and progresses weights automatically. Liftin' has rule-based automatic weight adjustment. Liftosaur gives the most control: a scripting language (Liftoscript) with built-in linear, double-progression and reps-sum rules. Strong stays a template logger with no auto-progression found in sources.

### Cited Findings
- Hevy free tier: up to 4 routines. Pro: unlimited. — [Hevy 2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727)
- Hevy Trainer: suggested starting weights for new exercises, automatic weight progression based on performance, and "gentle reminders" to keep intensity up if progress stalls. It is included with a standard (Pro) subscription. — [Announcing Hevy Trainer](https://www.hevyapp.com/announcing-hevy-trainer/)
- Liftin': "set up rules to automatically adjust the weights depending on your results". One reviewer notes a learning curve to configure the first routine, and another asked for an empty-workout option. — [Liftin' App Store listing](https://apps.apple.com/app/id1445041669); [appshunter Liftin' reviews](https://appshunter.io/ios/app/1445041669/reviews)
- Boostcamp: a free program library plus tracker plus custom program builder (multi-week). Pro adds 20+ exclusive coach programs, personalized programs and auto-progression. — [Boostcamp "is Boostcamp free"](https://www.boostcamp.app/is-boostcamp-free); [Boostcamp Pro](https://www.boostcamp.app/pro) (vendor pages, via search summary)
- Boostcamp's library is described as "a near-endless program library" and as putting "all of Reddit's best free workouts in one slick app". — [Garage Gym Reviews](https://www.garagegymreviews.com/boostcamp-review); [justuseapp Boostcamp reviews](https://justuseapp.com/en/app/1529354455/boostcamp-gym-workout-planner/reviews)
- A 2026 review says Boostcamp is not for people who want custom coaching or per-session changes. — [brace-ai Boostcamp review](https://brace-ai.pages.dev/reviews/boostcamp/) (third party, low authority)
- Liftosaur: programs are written in Liftoscript text, e.g. `Bench Press / 3x8 / progress: lp(5lb)`. Built-in progressions: linear (lp, fixed amount or percent after N attempts), double progression (dp), and reps-sum (sum). The app rewrites the program text after each workout. — [Liftoscript docs](https://www.liftosaur.com/doc/liftoscript); [Liftosaur overview](https://www.liftosaur.com/blog/posts/liftosaur-overview/)
- Gymshark Training: a library of workouts and plans, custom routine creation, and a 66-day "Gymshark66" habit challenge (third-party listings). Tom's Guide says it lacks the customization of premium rivals. — [Gymshark support](https://support.gymshark.com/en-US/article/the-gymshark-training-app); [Tom's Guide review](https://www.tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free)

### Inferences
- Progression rules range from none (Strong) to fixed rules (Liftin' rules, Liftosaur lp/dp/sum) to adaptive suggestions (Hevy Trainer). For a small app, double progression (add reps up to a ceiling, then add weight) plus "suggest the next weight" covers most users without a scripting language.
- A curated starter-program library (Boostcamp's main draw) is cheap to ship offline as static JSON. Classic free programs are what Boostcamp users praise.

### Gaps
- Routine folders and program week/day scheduling details for Hevy and Strong were not confirmed from sources this session.
- I found no source describing deload handling in Hevy Trainer or Boostcamp.

## 3. Analytics (e1RM, volume, sets per muscle, PRs, recaps, measurements, photos)

### Takeaway
Hevy has the richest analytics among the loggers: sets per muscle group per week/month/year, a muscle distribution chart, strength levels, a calendar view, monthly reports and a December Year in Review. Free users see only about 3 months. Strong gates its graphs (1RM, volume) behind PRO. Boostcamp Pro sells Strength Score and a volume heatmap.

### Cited Findings
- Hevy Statistics: "Set count per muscle" by week, month or year, with filters (e.g. Year/All time plus Month grouping). — [Hevy Statistics Explained](https://help.hevyapp.com/hc/en-us/articles/35702030346903-Hevy-Statistics-Explained-Track-Your-Training-Progress-and-Muscle-Growth); [Hevy sets per muscle group per week](https://www.hevyapp.com/features/sets-per-muscle-group-per-week/)
- Hevy Monthly Report summarises the previous month and highlights achievements. Year in Review (each December) shows most productive month, workout calendar, longest streak, and PRs for the year. — [Hevy monthly report](https://www.hevyapp.com/features/monthly-report/); [Hevy Yearly Review help](https://help.hevyapp.com/hc/en-us/articles/35700454899991-Discover-Your-Hevy-Training-Stats-with-the-Yearly-Review)
- Hevy 2.5.1 (Oct 2025) added a Calendar view (Profile > Calendar) across months and years. — [APKMirror Hevy 2.5.1](https://www.apkmirror.com/?p=11238310)
- Hevy "strength level" exists per exercise and was expanded to 10 more exercises in Sept 2025. — [APKMirror Hevy 2.4.5](https://www.apkmirror.com/?p=10738953)
- Hevy free tier limits graph/history data to the past ~3 months. Pro gives all-time history. Body measurements and PR tracking are available on both tiers. — [Hevy gym-progress page](https://www.hevyapp.com/features/gym-progress/); [Hevy 2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727); [gainframe Hevy review](https://gainframe.app/blog/hevy-app-review/) (third party)
- Strong PRO: graphs for volume and 1RM progression. — [SensAI Strong review 2026](https://www.sensai.fit/blog/strong-app-review-2026) (competitor site)
- Boostcamp Pro: Strength Score (level, max, balance views), Muscle Tracker / volume heatmap, advanced analytics. — [Boostcamp Pro](https://www.boostcamp.app/pro); [Boostcamp vs Hevy](https://www.boostcamp.app/vs/hevy) (vendor pages, via search summary)
- Liftin': "graphs to visualize your short and long term progress". — [Liftin' App Store listing](https://apps.apple.com/app/id1445041669)
- Gymshark Training: tracks 1RMs, sets and workout progress. — [Gymshark support](https://support.gymshark.com/en-US/article/the-gymshark-training-app)

### Inferences
- The analytics most worth copying are weekly sets per muscle (with a target range), per-exercise e1RM/best-set trend, a PR table, a calendar heatmap, and a monthly recap card. These all compute offline from the local log, so they fit ABOT's no-network rule.
- Hevy and Strong both put long-range history and graphs behind the paywall, so a free all-time history is a real differentiator.

### Gaps
- Progress photos: I found no source this session confirming progress-photo support in Hevy, Strong or Liftin' (gainframe's title mentions "Photos", but the content could not be read).
- Exact chart list for Strong (beyond 1RM/volume) was not confirmed.

## 4. Social and coach features

### Takeaway
Hevy is the only social-first logger in this set: a feed on the free tier, plus a separate paid Hevy Coach platform priced by number of clients. Strong, Liftin' and Gymshark Training have no community features found in sources.

### Cited Findings
- The social feed is included on Hevy's free tier. — [Hevy 2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727); [gainframe Hevy review](https://gainframe.app/blog/hevy-app-review/)
- Hevy Coach: $25/mo for 1-10 clients, $50 for 11-25, $90 for 26-50, $160 for 51-100 (GetApp). Coachway, a competitor, says the published ladder goes up to $700/mo for 501-1,000 clients. Monthly billing via Paddle, a 30-day trial with no card, no annual plan. — [Capterra Hevy Coach pricing](https://www.capterra.com/p/10015732/Hevy-Coach/pricing/); [GetApp Hevy Coach](https://www.getapp.com/all-software/a/hevy-coach/); [Coachway Hevy Coach pricing](https://coachway.io/articles/hevy-coach-pricing/)
- Coached clients train in the normal Hevy app and get complimentary Hevy Pro. There is no white-label app and no nutrition coaching. — [Coachway Hevy Coach review](https://coachway.io/articles/hevy-coach-review) (competitor site)
- Gymshark Training has no community features (no leaderboards or forums). — [Tom's Guide](https://www.tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free)

### Inferences
- For ABOT (local-first, no runtime network apart from optional Supabase), a feed is out of scope. Shareable workout summary images (ABOT already has share studios) give most of the social payoff without a backend.

### Gaps
- Details of Hevy's likes/comments, following and leaderboard mechanics, and share-image formats, were not retrieved this session.

## 5. Free vs paid and pricing

### Takeaway
Hevy has the most generous free tier (unlimited logging, 4 routines, 7 custom exercises, 3 months of graphs) and is the cheapest Pro. Strong's free tier is narrower (3 routines) and PRO costs more. Boostcamp is the most expensive per month. Liftosaur keeps almost everything free. Gymshark Training is fully free.

### Cited Findings
| App | Free tier | Paid price (USD, may vary by region) | Source |
|---|---|---|---|
| Hevy | Unlimited logging, social feed, PRs, measurements; 4 routines, 7 custom exercises, ~3 months of graph history; ads reported on free | Pro ~$2.99/mo, $23.99/yr, lifetime $74.99 (one region showed $89.99). Pro: unlimited routines and custom exercises, all-time history, warm-up calculator, Hevy Trainer | [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/33106320824727); [SensAI pricing comparison](https://www.sensai.fit/blog/fitness-app-pricing-free-tier-comparison); [gainframe](https://gainframe.app/blog/hevy-app-review/) |
| Strong | Unlimited logging, 3 routines/templates, no ads | PRO $4.99/mo, $29.99/yr, $99.99 lifetime (some listings $3.99 / $23.99 / $79.99, likely regional or older). PRO: graphs, Strong Cloud backup, Apple Health sync | [SensAI Strong review, Oct 2026](https://www.sensai.fit/blog/strong-app-review-2026); [Strong App Store listing](https://apps.apple.com/app/id464254577) |
| Boostcamp | Full program library, tracker, custom program builder | Pro $14.99/mo or $59.99/yr; IAPs range $11.99-$79.99; 7-day trial | [Boostcamp Pro](https://www.boostcamp.app/pro); [apppricinglab](https://apppricinglab.com/iap/apple/1529354455) |
| Liftin' | Freemium. One third-party listing says up to 5 workouts/month free (possibly outdated) | Not confirmed | [appfollow Liftin'](https://apps.appfollow.io/ios/liftin-gym-workout-tracker/1445041669?country=us) |
| Liftosaur | Programs, editor, Liftoscript, logging, history, measurements, equipment, sharing, import/export all free | Premium $4.99/mo, $39.99/yr, $99.99 lifetime | [SensAI Liftosaur review](https://www.sensai.fit/blog/liftosaur-review) |
| Gymshark Training | Fully free, no ads, no subscriptions; iOS only (pulled from Android) | n/a | [Gymshark support](https://support.gymshark.com/en-US/article/the-gymshark-training-app) |

- Boostcamp's own pages conflict on whether analytics and auto-progression are free or Pro. The search summary flagged one claim listing them as free while the Pro page lists them as Pro-only. — [Boostcamp is-free](https://www.boostcamp.app/is-boostcamp-free); [Boostcamp Pro](https://www.boostcamp.app/pro)

### Inferences
- The typical paywall line falls in the same places: number of routines/templates, number of custom exercises, length of history in charts, warm-up calculator, and auto-progression or "trainer" features. Logging itself is always free.

### Gaps
- Liftin' current price and free limits are unverified.
- The SensAI pages are from a competitor (an AI coach app) and may be biased. Prices should be checked in-store.

## 6. Most-praised, most-requested features and complaints

### Takeaway
Praise centres on fast, reliable logging, watch apps (Liftin'), and a large free program library (Boostcamp). Complaints centre on paywalls on features that used to be free, sync/watch bugs, data loss after updates (Strong Android), missing gym-specific machines, and missing Garmin integration.

### Cited Findings
- Liftin' praise: "best watch app, by far, and with absolutely zero sync issues". Complaints: a workout started on the phone will not sync to the watch, and active calories always show as 0. — [appshunter Liftin' reviews](https://appshunter.io/ios/app/1445041669/reviews)
- Strong is described as a "minimal, dependable logbook with a mature Apple Watch app", rated 4.2/5 (June 2026 review). Another review says the Android app trails iOS. — [brace-ai Strong review](https://brace-ai.pages.dev/reviews/strong/); [SensAI Strong review](https://www.sensai.fit/blog/strong-app-review-2026)
- Strong Android, March 2025 reviews: the app deleted saved workouts, crashed right after a workout was completed, and exercise swaps in templates broke after an update. One iOS reviewer said the app had been "abandoned for some time". — [unitQ Strong scorecard](https://unitq.com/unitq-scorecards/strongworkouttracker) (aggregator, small sample)
- Boostcamp complaints: features that used to be free moved behind Pro, and bugs from around mid-2023 onward. Praise: Reddit-favourite programs collected in one app. — [justuseapp Boostcamp reviews](https://justuseapp.com/en/app/1529354455/boostcamp-gym-workout-planner/reviews)
- Hevy requests: users want to add custom gym machines with images ("I don't find the machines of my gym in the list"), and deeper Garmin integration (record watch HR while logging in Hevy). — [Garmin forum thread](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/418320/strength-training-integration-with-hevy-app-improved-workout-tracking-experience/2020705)
- Hevy says it watches Reddit and in-app feedback, and that the swap-exercise (session/all-future) feature and logging improvements came from users. — [Hevy community update July '26](https://www.hevyapp.com/community-updates/july-26/)
- An r/Hevy feature-request megathread exists (2022), but its top requests were not readable. — [r/Hevy megathread mirror](https://redlib.groet-infra.nl/r/Hevy/comments/ryzrdi/comment/n525j5r/)

### Inferences
- Data safety (no lost workouts, crash-proof save on finish) is a top complaint whenever it fails. ABOT's local persistence plus export already addresses this, and it is worth stating in the UI.
- "Paywalling something that used to be free" draws strong backlash (Boostcamp). ABOT's free/paid split should not take features away from existing users.

### Gaps
- I could not read Reddit threads directly (r/Hevy, r/strongapp, r/weightroom, r/fitness), so no ranked list of top requests from Reddit is available.

## 7. Data import/export and integrations

### Takeaway
CSV export is standard (Strong, Hevy, Liftosaur). Hevy imports Strong's CSV, which makes switching easy. Apple Health is standard on iOS. Hevy has Strava sync, but Garmin refused Hevy's API application. Health Connect support for Hevy was not confirmed.

### Cited Findings
- Strong exports all data as CSV to Notes or Email. — [Strong App Store listing](https://apps.apple.com/app/id464254577)
- Hevy imports a direct Strong CSV export. The export must be in English. The menu path is Profile > Settings > Export & Import Data. Hevy exports workouts and measurements separately. Support only helps with direct Strong files. — [Hevy help: Import Strong CSV / Export](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)
- Hevy supports logging past workouts manually and a CSV import. — [Hevy help: Log past workouts and import CSV](https://help.hevyapp.com/hc/en-us/articles/35687878672663)
- Hevy has a "detailed Strava integration" (community update). A user says it posts the whole workout into the Strava activity notes. — [Hevy community update July '26](https://www.hevyapp.com/community-updates/july-26/); [intervals.icu forum](https://forum.intervals.icu/t/import-strong-data-weightlifting-app/5531)
- Garmin rejected Hevy's API application. Community tools (hevy2garmin, a Home Assistant automation) convert Hevy workouts to FIT files and upload them to Garmin Connect using the official Hevy API. — [Hevy help (Garmin)](https://help.hevyapp.com/hc/en-us/articles/35361029194647); [Home Assistant community](https://community.home-assistant.io/t/hevy-to-garmin-connect-automatic-strength-workout-sync-via-home-assistant/991440)
- Strong PRO includes Apple Health sync and Strong Cloud backup. — [SensAI Strong review](https://www.sensai.fit/blog/strong-app-review-2026)
- Liftin' integrates with Apple Health and shows up in Apple Fitness, and the user can change the Apple Fitness workout type. — [Liftin' App Store listing](https://apps.apple.com/app/id1445041669)
- Liftosaur includes import/export on the free tier. — [SensAI Liftosaur review](https://www.sensai.fit/blog/liftosaur-review)
- Third-party apps (repstack, lastlift) advertise Strong-CSV and Hevy-CSV importers, which suggests these two CSV formats are the de facto interchange formats. — [repstack Strong CSV import](https://repstack.pages.dev/import/strong-csv/); [repstack Hevy CSV](https://repstack.pages.dev/import/hevy-csv/)

### Inferences
- Importing Strong CSV and Hevy CSV is the cheapest, highest-leverage acquisition feature for ABOT. It parses offline with no network call, so it fits the Zero External API rule. Health Connect (Android) is the platform integration that matters for ABOT's Android build, and it is on-device.

### Gaps
- Hevy's Health Connect / Apple Health support and Strong's Android Health Connect support were not confirmed in sources this session.
- The exact column schemas of the Strong and Hevy CSVs were not retrieved. They need checking before an importer is built.
