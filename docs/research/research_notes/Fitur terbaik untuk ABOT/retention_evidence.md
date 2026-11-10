# Retention, habit formation and monetization evidence for fitness / workout-tracking apps (2023–2026)

Method note: built from web search results plus snippets of primary and secondary pages. Direct page fetches failed for athletechnews.com, endurancesportswire.com, adapty.io and frontiersin.org (not on this session's allowed network list), so several figures come from search-result summaries of those pages rather than a full read. Each item is flagged where the source is secondary or the numbers conflict.

## 1. Benchmarks: day-1/7/30 retention, churn timing, drop-off after N workouts

### Takeaway
Health & fitness apps keep roughly 3–9% of installers at day 30, depending on the vendor and how "retention" is defined. Most loss happens in the first one to two weeks. Among people who actually start strength training in an app, about 1 in 10 beginners is still training weekly after a year.

### Cited Findings
- Braze's category table: Health & Fitness day-30 retention is 3.9% on iOS and 3.4% on Android. — [Braze](https://www.braze.com/resources/articles/mobile-app-retention)
- Business of Apps: about 3% day-30 retention for health & fitness in 2023. — [Business of Apps](https://www.businessofapps.com/?p=98298)
- Getstream's compilation puts Health & Fitness day 30 at 8.48%. An AppsFlyer-based figure gives 8–9%. Getstream notes that some methods (rolling or unbounded retention) give higher numbers than classic Day-N. — [Getstream](https://getstream.io/blog/app-retention-guide); [Engagelab](https://www.engagelab.com/blog/increase-app-retention)
- AppsFlyer's 2025 retention report lists Health & Fitness among the categories with the largest year-on-year retention growth (+22%). This is growth, not an absolute level. — [AppsFlyer 2025 retention benchmarks](https://appsflyer.com/?p=453529)
- Cross-category averages are about 25% at day 1, 12% at day 7 and 6% at day 30. Reteno gives about 26% at day 1 and about 13% at day 7. — [Getstream](https://getstream.io/blog/app-retention-guide); [Reteno](https://reteno.com/blog/how-health-fitness-apps-convert-new-year-resolution-users-into-long-term-subscribers)
- A scoping review of lifestyle and mental-health apps (cited by Sahha) found a median 70% of users stop within 100 days, with the steepest abandonment in the first two weeks. — [Sahha, Jan 2026](https://resources.sahha.ai/news/health-app-churn-retention)
- Peer-reviewed workout-tracker data from Frontiers in Sports and Active Living (2026), 389,481 Fitbod users: adherence fell steadily, and 10.1% of beginners were still adherent at 12 months. Adherence meant at least one workout per week, with up to six missed weeks allowed. — [Frontiers 2026](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1855668/full) (known only through a search summary; the full text could not be fetched)
- One indie report says only about 15% of people who start onboarding ever complete a workout. This is a single app's anecdote. — [WIP post](https://wip.co/posts/next-steps-to-improve-retention-for-a-launched-app-9h6msa)
- In Health & Fitness, first-renewal retention is 30.3%, the lowest of any category, even though trial-to-paid conversion (35.0%) is the highest. Adapty data cited secondarily. — [Airbridge citing Adapty](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026); [Adapty plan-type article](https://adapty.io/blog/weekly-monthly-annual-subscription-plan/)

### Inferences
- For ABOT, a realistic day-30 target is somewhere in 4–9% of installs. The more useful metric is retention among people who logged a first workout, because the main leak is install → first workout.
- Churn is front-loaded (weeks 1–2). Retention work belongs in the first session and the first 14 days, not in long-tail features.
- The Fitbod result (about 10% of beginners adherent at a year, with a lenient definition) gives ABOT a fair comparison point for weekly-active lifters. It suggests rest-week tolerance (up to six missed weeks) is a reasonable way to define "still a user".

### Gaps
- No public Hevy or Strong retention or "stop after N workouts" curve was found.
- The Frontiers/Fitbod paper's predictors (for example early workout frequency, experience level) could not be read because the host was blocked.
- No Indonesia- or SEA-specific fitness retention benchmark was found.

## 2. Mechanisms with evidence (streaks, freezes, reminders, goals, onboarding, first workout, progress, badges, recaps, social)

### Takeaway
The strongest evidence is for self-monitoring with feedback, and for rescue mechanics that help people return after a miss (the largest gym megastudy). Gamification has a small, real effect that fades over time. Streaks motivate while they are intact but demotivate when broken, so streak design should make the miss less visible and repairable. Notifications help mostly early, and their effect decays.

### Cited Findings
**Academic: gamification and BCTs**
- Mazeas et al. 2022 (JMIR, 16 studies, n = 2,407): gamified interventions had a small-to-medium effect on physical activity, g = 0.42 (95% CI 0.14–0.69). — [JMIR preprint 26779](https://preprints.jmir.org/preprint/26779)
- Yu et al. 2025 (JMIR Serious Games, cardiovascular populations): short-term PA effect g = 0.32 (95% CI 0.19–0.45). The maintenance effect was smaller, g = 0.20 (3 studies). **Feedback** was the most influential design element, followed by avatars. — [JMIR Serious Games 2025;13:e64410](https://games.jmir.org/2025/1/e64410/PDF)
- Wang et al. 2025 (children and adolescents): gamification raised MVPA (SMD 0.15) and had no effect on sedentary time. — [JMIR Serious Games 2025;13:e68151](https://games.jmir.org/2025//e68151/)
- Laranjo et al. 2021 (BJSM): apps and trackers with automated self-monitoring and feedback had a small-to-moderate positive effect on PA. Self-monitoring and feedback were the BCTs that stood out. — [IJBNPA/related reviews via search](https://link.springer.com/article/10.1186/s12966-022-01319-8)
- A 2022 meta-regression (IJBNPA, CVD apps): goal setting on its own did not clearly moderate PA outcomes. Combining self-monitoring with control-theory techniques (goal + feedback) tended to work better. — [IJBNPA 2022](https://link.springer.com/article/10.1186/s12966-022-01319-8)
- A content analysis of 64 PA apps found an average of 5 BCTs (range 2–8). The most common were self-monitoring, feedback and goal setting. — [PMC4132213](https://pmc.ncbi.nlm.nih.gov/articles/PMC4132213)

**Habit formation**
- Lally et al. 2010 (n = 96, daily behaviour tied to a cue, 84 days): median of 66 days to automaticity, range 18–254. This is a model estimate from the subset with good curve fits, and about half of participants did not reach habit by day 84. Exercise behaviours took about 1.5x longer than eating or drinking ones. **Missing one day did not significantly affect habit formation**, but very inconsistent people did not form habits. — [UCL news](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit); [The Behavioral Scientist](https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit)
- Singh et al. 2024 (Healthcare, systematic review, 20 studies, n = 2,601): median formation time 59–66 days, means 106–154 days, range 4–335 days. Only 23% of participants reached the formation threshold. Habit-strength change SMD = 0.69. Only 4 studies reported formation time directly. — [ScienceDaily](https://www.sciencedaily.com/releases/2025/01/250124151347.htm); [News-Medical](https://www.news-medical.net/news/20250124/Healthy-habits-take-longer-to-form-than-expected.aspx)

**Rescue after a miss (strongest field evidence)**
- Milkman et al. 2021 (Nature 600:478–483), megastudy of about 61,000 24 Hour Fitness members testing 54 interventions: 45% of interventions raised weekly gym visits by 9–27% during the 4-week program. The **top performers paid a small bonus for returning after a missed workout**. Experts' predictions of which interventions would work did not match the results. Little effect lasted after the intervention ended. — [Scimex](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost); [WEF](https://www.weforum.org/stories/health-and-healthcare-systems/science-fitness-goal-motivation-jp); [Nature PDF mirror](https://Www.Gwern.net/doc/statistics/prediction/2021-milkman.pdf)

**Streaks**
- Silverman & Barasch 2023 (Journal of Consumer Research): highlighting an **intact** streak raised the target behaviour. A **broken** streak lowered motivation and self-rated dedication, and people tended to avoid the behaviour afterwards. With identical actual behaviour, showing the log as broken rather than intact changed what people did. Almost half of participants would do something undesirable (for example watch an ad) to keep or repair a streak. The authors advise not highlighting broken streaks, for example with no "you broke your streak" notifications. — [INSEAD Knowledge](https://knowledge.insead.edu/marketing/consumer-streaks-are-motivating-key-keeping-them-alive); [UDaily 2024](https://udel.edu/udaily/2024/march/power-of-streaks-motivation-jackie-silverman); [Psychology Today](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- Duolingo reports a record Current User Retention Rate of 84% (Q2 2026). The company credits continuous A/B testing ("Green Machine") rather than any single feature. — [Pulse2](https://pulse2.com/duolingo-daily-active-users-reach-58-7-million-as-retention-hits-record-84-and-social-accounts-top-1-billion-organic-impressions/)
- Duolingo streak-freeze numbers circulating online (for example "+10% long-term retention", "-21% churn for at-risk users", "+40% D30 for streak maintainers") come from secondary blogs with no primary source, and they conflict. **Unverified.** — [Sensor Tower blog](https://sensortower.com/blog/duolingo-streak-feature-app-engagement-growth); [Blitzllama](https://www.blitzllama.com/blog/duolingo-product-management-lessons)
- Mobbin's survey of 859 streak designs (practitioner, not academic) frames streaks as "about losing", which supports loss-aversion mechanics. — [Mobbin](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs)

**Reminders / notifications**
- HeartSteps micro-randomized trial (Klasnja et al. 2019, 42 days, n = 44): contextually tailored walking suggestions raised steps in the following 30 minutes. One reported specification gives +24% (59 steps). **The effect was largest at the start (about +107%) and faded over the study.** Anti-sedentary messages had no detectable effect. Indexed versions of the paper report different headline numbers (14% / 66% / 24%) depending on the analysis, so check before quoting. — [PubMed 30192907](https://pubmed.ncbi.nlm.nih.gov/30192907/)
- myBPmyLife MRT (hypertension): activity notifications did **not** raise steps in the next 60 minutes, but they did raise engagement with the app. — [JMIR preprint 78218](https://preprints.jmir.org/preprint/78218/accepted)

**Onboarding / first workout / personalization**
- Practitioner sources agree the activation event is the first completed workout. Complex onboarding (long questionnaires, required device connections, dense dashboards) loses users before they reach value. These are vendor blogs and not measured effects. — [Sahha](https://resources.sahha.ai/news/health-app-churn-retention); [CleverTap](https://clevertap.com/blog/fitness-apps-retain-new-users/); [Reteno](https://reteno.com/blog/how-health-fitness-apps-convert-new-year-resolution-users-into-long-term-subscribers)

**Recaps (Wrapped-style)**
- Spotify Wrapped 2024 reached 200M engaged users in its first days (+19% YoY). Outlets disagree on whether that took 24 or about 62 hours. One report says 250M within 65 hours. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/spotify-wrapped-campaign-hit-200m-engaged-users-in-24-hours-a-19-yoy-increase); [WDEF](https://www.wdef.com/?p=2271401)
- UK (Ipsos iris): Spotify's app audience rose 25% (9M to 11.3M) from 3 to 4 December 2024, its largest UK day that month. — [UKOM](https://ukom.uk.net/snapshots/292-the-allure-of-spotify-wrapped-in-the-uk.php)

**Social accountability / contagion**
- Aral & Nicolaides 2017 (Nature Communications, about 1.1M runners, 359M km over 5 years, weather as a natural experiment): exercise is socially contagious. Less-active runners influence more-active ones, not the reverse, which fits a "keep ahead of those behind me" motive. Men are influenced by both genders, while women are influenced only by women. — [MIT Sloan](https://mitsloan.mit.edu/press/new-study-mit-sloan-school-management-professors-shows-exercise-contagious); [Nature comment](https://www.nature.com/articles/544270a)

### Inferences
- Ranking by evidence strength for a solo-first gym tracker:
  1. Fast self-monitoring with immediate feedback (PRs, progress vs last session).
  2. A return-after-miss flow that welcomes the user back without punishment (Milkman). This is the single strongest field result.
  3. Rest-day-aware streaks that hide breaks (Lally: a single miss doesn't matter; Silverman: broken streaks hurt).
  4. Early, sparse, contextual reminders that fade over time (HeartSteps).
  5. Goals paired with feedback, never goals alone.
  6. Recaps and badges as smaller levers.
- A weekly streak, counting weeks that hit a target number of sessions, fits strength training better than a daily streak, because rest days are part of the program. This is an inference consistent with Lally and Silverman, not a tested result for lifting apps.
- Gamification effects shrink over time (g 0.32 → 0.20). Badges should support, not replace, progress feedback.
- Social contagion evidence comes from running and endurance training. For a gym app without a social graph, the transferable part is lightweight comparison or sharing, not a full social network.

### Gaps
- No RCT isolating streak freezes, and no primary Duolingo data on them.
- No study isolating "first workout in the first session" as a causal retention lever. Only practitioner claims exist.
- No measured retention effect of Year-in-Sport/Wrapped recaps on next-month activity. Only reach and audience spikes were found.
- No evidence specific to strength-training apps for badges or achievements.

## 3. Strava: kudos, segments, clubs, challenges, Year in Sport, and what transfers to strength training

### Takeaway
Strava's social layer (kudos, clubs) is very large and growing, and the company says it drives engagement. No independent causal study isolates kudos or clubs as retention drivers. Weight training is the fastest-growing trend among Gen Z Strava users, which makes a strength-friendly recap and share loop timely.

### Cited Findings
- Year in Sport 2025 (12th edition, activity Sep 2024–Aug 2025, survey of 30,000+ users and non-users): 14 billion kudos across about 180M users, +20% vs 2024. New clubs nearly quadrupled to 1 million total, and hiking clubs grew 5.8x. 54% of users log multiple sport types. Walking is the second most-recorded activity. — [PR Newswire via Webull](https://www.webull.com/news/13961203642123264); [SGB Online](https://sgbonline.com/stravas-year-in-sport-trend-report-highlights-gen-zs-passion-for-run/); [The 5K Runner](https://the5krunner.com/2025/12/04/strava-2025-year-in-sport-report-apple-watch-coros-gen-z/)
- Gen Z is twice as likely as Gen X to name weight training as their primary sport, and 61% more likely to cite aesthetics as a goal. Gen Z is 75% more likely to name a race or event as their main motivation. — [Fitt Insider](https://insider.fitt.co/gen-z-drives-strength-social-workouts/); [ATN](https://athletechnews.com/running-walking-strength-training-strava-year-in-sport-report/)
- Strava mid-year data: 41% of subscribers are on pace or ahead on their annual goals. Strava says social features "continue to drive engagement" (company claim). — [ATN mid-year](https://athletechnews.com/strava-mid-year-data-running-cycling/)
- In June 2025 the CEO told the WSJ that Strava was heading to about $500M annual revenue, with over 50% growth in new users. IPO reportedly being explored (Oct 2025). — [Sacra](https://sacra.com/c/strava/); [TechCrunch](https://techcrunch.com/2025/10/12/strava-eyes-ipo-as-gen-z-trades-dating-apps-for-running-clubs/)
- A claim that sponsored challenges gave "mid-to-high single-digit" lifts in 30-day retention could not be traced to a primary Strava source. **Unverified.** — [Latterly](https://www.latterly.org/strava-business-model/)

### Inferences
- What transfers to a gym tracker without servers or social features: (a) an annual or monthly recap card in Year-in-Sport style (total volume lifted, PRs, most-trained muscle, consistency weeks) that can be shared as an image; (b) personal "segments", which in lifting are PR boards per exercise; (c) time-boxed solo challenges (for example "12 sessions in 30 days").
- Kudos and clubs need a social graph and a backend. For ABOT this only becomes possible with the optional Supabase sync, and the evidence for it is correlational. Lower priority than solo mechanics.
- The Gen Z aesthetics and strength trend supports progress photos and body-measurement tracking as engagement features. This is an inference.

### Gaps
- No independent data on Strava's free-to-paid conversion, churn, or the retention effect of kudos, segments or Year in Sport.
- No Strava engineering or product blog with experimental results was found.

## 4. Monetization: freemium vs subscription vs lifetime, paywall timing, trials, what users pay for

### Takeaway
Health & Fitness earns the highest revenue per install of any subscription category, but revenue is highly concentrated. Hard paywalls convert about 5x more installs than freemium. Annual plans dominate revenue, and lifetime plans are a small add-on that lifts revenue when shown next to annual. Conversion in India/SEA is roughly half of North America's and refunds are higher, which supports local pricing.

### Cited Findings
- RevenueCat SOSA 2025 (75k+ apps, $10B+ revenue): Health & Fitness had the highest median revenue per install at day 60, **$0.63** vs $0.31 for all apps. — [RevenueCat launch post](https://www.revenuecat.com/blog/company/the-state-of-subscription-apps-2025-launch)
- Only 5% of Health & Fitness apps reach $10k total revenue within two years. — [ATN on RevenueCat](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/) (secondary)
- Health & Fitness median trial-to-paid is 39.9%, top decile 68.3%. Trials of 4 days or less convert at 26.8%. iOS converts about 2x Android. — [ATN on RevenueCat](https://athletechnews.com/?p=124212) (secondary)
- Day-35 download-to-paid, all categories, 2025: **hard paywall 12.1% vs freemium 2.2%**. The 2026 report gives 10.7% vs 2.1%. A RevenueCat case study of a switch from hard paywall to freemium saw conversion fall 50% while LTV rose 75%, so the gap is partly selection and should not be read as fully causal. — [Airbridge](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026); [RevenueCat blog](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium.md); [Plushcap summary](https://www.plushcap.com/content/revenuecat/blog/revenuecat-how-a-switch-from-hard-paywall-to-freemium-led-to-a-75-ltv-lift-and-a-50-conversion-drop)
- Regional, 2025: median day-35 download-to-paid is **North America 2.6%, Western Europe 2.0%, India & SEA 1.4%**. — [RevenueCat SOSA 2025 page](https://www.revenuecat.com/state-of-subscription-apps-2025/) (via search summary)
- 2026 (secondary): median refund rate IN/SEA 7.7% vs North America 3.4%. — [PricePush](https://pricepush.app/blog/revenuecat-sosa-2026-pricing-localization-insights)
- Health & Fitness has high refund rates, partly blamed on unrealistic goals. — [DEV Community](https://dev.to/rikh81/what-subscription-developers-can-learn-from-this-years-benchmark-data-3ke9); [Kitemetric](https://kitemetric.com/blogs/subscription-app-benchmark-data-key-insights-for-developers)
- Adapty: annual plans make up about 60.6% of Health & Fitness revenue (2026), up from 51% in 2023. Lifetime is offered by about 14% of apps and brings about 1% of total subscription revenue, but **adding lifetime next to annual lifted revenue** in paywall tests. Health & Fitness offers lifetime more often than other categories. Trials raise LTV for annual Health & Fitness plans. — [Adapty plan types](https://adapty.io/blog/weekly-monthly-annual-subscription-plan/); [Adapty paywall tests](https://adapty.io/blog/paywall-optimization-tests/); [Adapty State of Paywalls 2026](https://adapty.io/state-of-paywalls/report/); [Adapty trial vs direct](https://adapty.io/blog/free-trial-vs-direct-purchase-subscription-apps/)
- RevenueCat's blog argues for 60–80% lower prices in markets like SEA. This is advocacy, not a measured result. A "+15–40% conversion from PPP pricing" figure attributed to RevenueCat is unverified. — [RevenueCat pricing fixes](https://www.revenuecat.com/blog/growth/5-quick-fixes-for-bad-default-global-pricing-on-app-stores.md); [AppsOps](https://appsops.store/blog/revenuecat-data-local-pricing)

### Inferences
- ABOT's model (free core, PRO as one-time or annual, Midtrans in Indonesia) matches the data: annual as the default anchor, lifetime beside it as a revenue lift. Indonesian users' known aversion to recurring card charges (an inference; no data was found) suggests one-time and annual purchases through local rails such as QRIS or e-wallets may suit Indonesia better than auto-renew.
- Because the core is free, ABOT should expect conversion in the low single digits (about 1–2% of installs in SEA). Revenue depends on putting the paywall at moments of shown value, for example after a PR, after the first weekly recap, or when opening advanced analytics, rather than on gating basic logging.
- Higher refund rates in Health & Fitness and in SEA argue for a clear statement of what PRO includes, and for not selling with goals the user is unlikely to reach.
- Short trials (≤4 days) convert worse. If ABOT adds a trial of PRO, about 7 days is the evidence-aligned choice (inference from the RevenueCat data above).

### Gaps
- No Health & Fitness-specific hard vs freemium split was found.
- No data on which specific features fitness users pay for (for example analytics vs programs vs cloud sync).
- No Indonesia-specific willingness-to-pay or payment-method conversion data was found.
- Full RevenueCat and Adapty PDFs were not read directly (hosts blocked or too large).

## 5. Anti-patterns that hurt retention

### Takeaway
The best-evidenced anti-pattern is drawing attention to broken streaks: it lowers motivation and leads people to avoid the behaviour. Friction-heavy onboarding and notifications that keep firing without tailoring have practitioner support. Guilt-based messaging has no direct RCT, but it follows from the streak research.

### Cited Findings
- Highlighting broken streaks lowers motivation and self-rated dedication, and makes people avoid the behaviour. The authors recommend not notifying users that a streak broke. — [INSEAD Knowledge](https://knowledge.insead.edu/marketing/consumer-streaks-are-motivating-key-keeping-them-alive); [Psychology Today](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- Notification effects fade over weeks (HeartSteps). In one MRT, notifications did not change activity at all, only engagement. — [PubMed 30192907](https://pubmed.ncbi.nlm.nih.gov/30192907/); [JMIR preprint 78218](https://preprints.jmir.org/preprint/78218/accepted)
- Complex onboarding (multi-screen questionnaires, required device connections, feature-dense dashboards) loses users before first value. Practitioner claim. — [Sahha](https://resources.sahha.ai/news/health-app-churn-retention)
- Unrealistic goal framing is linked to high refund rates in Health & Fitness. — [Kitemetric](https://kitemetric.com/blogs/subscription-app-benchmark-data-key-insights-for-developers)
- Blog claims of "63% quit after broken streak (CHI 2020)" and "+37% two-day rule" could not be traced to primary sources. **Do not use.** — [DEV Community](https://dev.to/skaraz/why-your-habit-tracker-resets-you-to-zero-and-why-thats-psychologically-damaging-5cho)

### Inferences
- For ABOT: never send a "you lost your streak" push. On return after a gap, show a welcome-back view with last session's weights and an easy "pick up where you left off" option, as in Milkman's return-after-miss bonus. Count streaks in weeks, with planned rest days not counting as misses.
- Keep onboarding to the minimum needed to start a first workout (goal, experience, units). Defer everything else.

### Gaps
- No RCT on guilt- or shame-toned fitness notifications specifically.
- No quantitative data on how much onboarding length hurts fitness apps.
