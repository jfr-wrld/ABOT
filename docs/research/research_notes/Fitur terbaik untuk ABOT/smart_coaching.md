# Smart coaching in strength apps (Fitbod, Alpha Progression, JEFIT, Juggernaut AI, RP Hypertrophy, Dr. Muscle), 2024–2026

Research method note: web search worked, but direct page fetches to vendor help centres (help.fitbod.me, fitbod.me, help.rpstrength.com, alphaprogression.com) were blocked by this session's network allowlist. Most vendor details below therefore come from search-result excerpts of those pages, not full reads. Vendor claims are vendor marketing unless stated. Several comparison sites (sensai.fit, dr-muscle.com, arvo.guru, alphaprogression.com "vs" posts, gympsycho) are run by competing apps and are biased.

Context for the report writer: ABOT already ships deterministic versions of several of these mechanisms (read from source, not from the web): `src/lib/muscle-recovery.ts` (per-muscle fatigue: 15% per working set to primaries, 7.5% to secondaries, RPE-scaled, linear decay to 0 over 72 h for big muscles / 48 h for small, sleep-scaled, phase-stretched), `src/lib/progressive-overload.ts` ("Coach Pill": load or double progression from the last three sessions, rule-based deload of 10%), `src/lib/exercise-swapper.ts` (movement-pattern similarity score with equipment-profile filter and load conversion), `src/lib/exercise-suggest.ts`, `src/lib/phase-engine.ts`.

## 1. How each app generates or adjusts workouts (recovery, progression, volume, deloads, plateaus)

### Takeaway
Every app studied runs on a small set of mechanisms: a per-muscle recovery score (Fitbod), double progression with per-set weight/rep/RIR targets (Alpha Progression), feedback-driven weekly set changes anchored to MEV/MRV (RP), readiness questionnaire plus RPE autoregulation (Juggernaut AI), and performance-drop-triggered deloads (Dr. Muscle). None publish formulas; all published descriptions read as rules applied to the lifter's log, not as models that need cloud ML.

### Cited Findings
**Fitbod**
- Each muscle group gets a 0–100% recovery score computed from logged sets, reps and weight; body stats and Apple Health data can refine it; longer or more intense sessions affect recovery more — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Fitbod blog: muscle recovery](https://fitbod.me/blog/muscle-recovery/) (via search excerpt)
- A Fitbod blog post says muscles are treated as fully recovered (100%) after seven days of rest; another says below 50% is "mostly fatigued" and that heavy/high-volume training in the last 12 days signals more recovery time — [Fitbod blog: muscle recovery](https://fitbod.me/blog/muscle-recovery/); [Fitbod blog: when to lift heavier and when to recover](https://fitbod.me/blog/how-fitbods-ai-knows-exactly-when-you-should-lift-heavier-and-when-to-recover/) (search excerpts; exact source of each figure not verified)
- Fitbod normally won't recommend exercises for muscles at 0% recovery, generally prioritises recovered muscles, but may include partially recovered muscles to support goals — [Fitbod help: How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- Outside activity from Apple Health, Health Connect, Strava or Fitbit adjusts recovery (e.g. a long run means no hard leg day next) — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery)
- Users can manually edit recovery levels — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery)
- Algorithm starts conservatively for new users and for exercises not logged before; after a layoff it automatically reduces weight suggestions — [Fitbod help centre](https://help.fitbod.me/hc/en-us/articles/16254175592215) (search excerpt)
- Fitbod's progress metric "Estimated Strength" is a theoretical 1RM from logged workouts; one Fitbod post names Epley, another a modified Brzycki, so the exact formula is unclear — [Fitbod blog: Estimated Strength](https://fitbod.me/blog/estimated-strength?fitbodUser=1); [Fitbod help](https://help.fitbod.me/hc/en-us/sections/360001078993-Understanding-Fitbod-How-It-Works)
- Fitbod describes its variation as "not random, it's responsive", balancing consistency on core lifts with variation — [Fitbod blog: personalization](https://fitbod.me/blog/how-fitbod-personalizes-your-workout-plan-using-smart-training-algorithms/)

**Alpha Progression**
- For each working set the algorithm can recommend a weight, a rep count and an RIR target, calibrated to recorded performance — [Alpha Progression blog: RIR](https://alphaprogression.com/en/blog/reps-in-reserve) (search excerpt)
- Progression is described as double progression (raise reps, then weight) and can change weight and reps together — [Alpha Progression glossary: progression](https://alphaprogression.com/en/glossary/progression)
- Recommendations use the weights actually available in the user's gym — [Alpha Progression blog: guide](https://alphaprogression.com/en/blog/alpha-progression-guide) (search excerpt)
- RIR logging is optional and can influence future recommendations; users who log only weight and reps still get recommendations — [Alpha Progression blog: RIR](https://alphaprogression.com/en/blog/reps-in-reserve)
- Mesocycles vary set counts, rep targets, optional RIR targets and stress across a block, with built-in deloads — [Alpha Progression blog: guide](https://alphaprogression.com/en/blog/alpha-progression-guide)

**RP Hypertrophy**
- Weak pumps, minimal soreness and an "easy" workload rating usually lead to more sets; good pump, on-time recovery and challenging workload leave volume unchanged; "amazing pumps, so sore that you can't heal on time, and too much volume = fewer sets" — [RP help: how the app determines when to add weight, reps and sets](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets) (search excerpt and quote via [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026))
- Calculations are continuous; every future session is influenced by past feedback — [RP help](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets)
- Framework is Israetel's MV/MEV/MAV/MRV volume landmarks with feedback-based autoregulation; RP uses pump/soreness/workload ratings rather than RPE — [sensai.fit comparison (competitor)](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- RP markets the app as adjusting "to your pump and soreness feedback to create the perfect training plan week-by-week" — [rpstrength.com app page](https://rpstrength.com/rphypeapp)

**Juggernaut AI**
- Pre-training readiness questionnaire (sleep, mood, energy, soreness) adjusts that day's volume or weight; logged RPE/RIR plus readiness adjust volume, intensity and frequency; further changes at week end and larger ones at block end (hypertrophy, strength, peaking blocks) — [JTS help: how JuggernautAI is individualized](https://help.jtsstrength.com/en/articles/3-how-juggernautai-is-individualized-to-you); [JTS help: RPE and RIR](https://help.jtsstrength.com/en/articles/2-all-about-rpe-and-rir)
- Deload management described only as "automatic"; no published trigger thresholds found — [fitnessvolt comparison](https://fitnessvolt.com/rpe-training/comparisons/rpe-calculator-vs-juggernautai/)
- Sources disagree on whether it is "machine learning" or an expert/rule system — [GarageGymReviews review](https://garagegymreviews.com/juggernautai-review); [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- Help docs cover rest-day handling, meet-date adjustments and warm-ups — [JTS help article 27](https://help.jtsstrength.com/en/articles/27-optimizing-training-with-juggernautai-a-guide-to-rest-days-meet-date-adjustments-and-warm-up-features)

**Dr. Muscle**
- Suggests a deload when strength goes down, roughly halving sets; users can trigger one manually and (newer) cancel a suggested one — [Dr. Muscle: deload](https://dr-muscle.com/deload/); [Dr. Muscle: manual deloads](https://dr-muscle.com/manual-deloads/)
- Tracks every rep and set and calculates next-session weights from past performance — [Dr. Muscle: progressive overload app](https://dr-muscle.com/progressive-overload-app-gain-muscle-strength/)
- Rest-pause/drop-set set styles; on eligible rest-pause sessions "Too easy"/"Too hard" answers adjust the next session's set count — [Dr. Muscle: building muscle](https://dr-muscle.com/building-muscle/); [Dr. Muscle X 2026 update](https://dr-muscle.com/new-dr-muscle-x-2026/)
- Marketing claim of building muscle "59% faster" has no independent evidence found — [Dr. Muscle: building muscle](https://dr-muscle.com/building-muscle/)

**JEFIT**
- Elite tier markets an "AI-powered progressive overload" system analysing volume, intensity and strength trends, with structured multi-week mesocycles and weekly progression, plus an "Adaptive AI Coach" and analytics dashboard — [JEFIT FAQ](https://cdn.jefit.com/support/faq); [JEFIT adaptive plan](https://cdn.jefit.com/ai-workout-tracker/adaptive-plan); [JEFIT vs Fitbod (JEFIT blog)](https://www.jefit.com/blog/jefit-vs-fitbod)

### Inferences
- The common pattern: (a) per-muscle fatigue/recovery bookkeeping, (b) per-exercise next-set targets from recent sets, (c) per-muscle weekly set count nudged up/down by subjective feedback, (d) a deload trigger on stalled/declining performance or end of block. ABOT already has (a), (b) and a performance-based deload; it lacks (c) weekly per-muscle volume targets with feedback and (d) a planned mesocycle/block structure with scheduled deload weeks and an RIR ramp.
- Fitbod's published recovery window (up to 7 days to 100%) is much longer than ABOT's 48–72 h linear model; neither is evidence-calibrated (see section 3).

### Gaps
- No vendor publishes exact thresholds (e.g., how many sets RP adds per feedback level, Fitbod's fatigue-per-set constant, Dr. Muscle's "strength down" definition).
- Could not verify RP's widely cited mesocycle RIR ramp (e.g., 3→2→1→0 RIR then deload) from a primary RP page; searches returned only SEO spam.
- No JEFIT technical description beyond marketing.

## 2. Exercise substitution, gym/equipment profiles, warm-up generation

### Takeaway
Equipment-filtered exercise pools (multiple gym profiles) are standard; warm-up generation is a simple optional toggle. Neither needs ML.

### Cited Findings
- Fitbod only includes exercises matching available equipment and supports multiple gym locations with different equipment — [Fitbod help: How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout); [Fitbod blog: your gym profile](https://fitbod.me/blog/your-gym-profile/)
- Fitbod warm-up sets are lighter sets before working sets, turned on under Training Format in My Plan; not generated for every exercise and skipped when a useful progression isn't possible — [Fitbod help: Warm Up Sets](https://help.fitbod.me/hc/en-us/articles/360006337634-Warm-Up-Sets)
- Alpha Progression: a gym profile defines available equipment; recommendations use the actual available weights — [hotelgyms guide](https://www.hotelgyms.com/blog/alpha-progression-the-gym-logger-app-from-germany); [Alpha Progression guide](https://alphaprogression.com/en/blog/alpha-progression-guide)
- Juggernaut AI includes warm-up features in its training flow — [JTS help article 27](https://help.jtsstrength.com/en/articles/27-optimizing-training-with-juggernautai-a-guide-to-rest-days-meet-date-adjustments-and-warm-up-features)

### Inferences
- "Use the weights your gym actually has" (Alpha Progression) maps directly onto ABOT's plate calculator (`src/lib/plate-calculator.ts`) and equipment profiles: round recommended loads to loadable steps per gym profile.
- A warm-up ramp (e.g., percentage steps of the working weight, rounded to plates, skipped for light/isolation work) is a pure function; Fitbod's "skip when no useful progression" rule is the same idea.

### Gaps
- No source describes how Fitbod or Alpha Progression rank substitutes (movement pattern vs muscle overlap); no published warm-up percentages for any app.

## 3. What is evidence-based

### Takeaway
More weekly sets per muscle produce more hypertrophy with diminishing returns (Schoenfeld 2017; Pelland et al. 2025/2026); training close to failure helps but failure itself isn't required (Refalo 2023/2024); RIR self-estimates are imprecise, especially at lighter loads; deload benefits are mostly consensus opinion, and one RCT found a full-week break cost some strength with no hypertrophy effect; MEV/MAV/MRV numbers are heuristics, not measured constants.

### Cited Findings
- Schoenfeld, Ogborn & Krieger dose-response meta-regression (J Sports Sci, online 2016 / print 2017): 15 studies, 34 treatment groups; increases in weekly RT volume produce greater hypertrophy — [ResearchGate PDF](https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf)
- Pelland, Remmert, Robinson, Hinson, Zourdos volume/frequency meta-regression (67 studies, 2,058 participants; year reported as 2025 or 2026 depending on source): nonlinear diminishing returns per extra fractional weekly set, no clear plateau but wide uncertainty at high volume, and frequency adds little once volume is matched — [sci-sport summary](https://sci-sport.com/en/muscle-hypertrophy-strength-and-volume-how-does-the-relationship-evolve-272/); [preprints.org reanalysis](https://www.preprints.org/manuscript/202610.1022). Reported figure of ~+0.24% muscle size per extra fractional set comes from secondary sources only; verify against the paper.
- "Fractional" set counting (secondary muscles counted as partial sets) is used in Pelland's analysis — [train.fitness: not all sets are created equal](https://train.fitness/personal-trainer-blogs/not-all-sets-are-created-equal)
- Refalo et al. 2023 (Sports Medicine), 15 studies: no significant hypertrophy difference between training to momentary failure and non-failure; possible nonlinear relationship — [AUT repository](https://openrepository.aut.ac.nz/items/78679612-6ff4-4d00-95d1-7920d072a760/full); [Sports Med summary newsletter](https://sportsmedu-newsletter.beehiiv.com/p/do-you-need-to-lift-to-failure-to-build-muscle-mass)
- Refalo et al. 2024 meta-regression: lower estimated RIR (closer to failure) associated with larger muscle-size gains — [Biolayne summary](https://biolayne.com/reps/issue-11/do-you-really-need-to-train-to-failure/)
- RIR estimation accuracy: lower loads (%1RM) are associated with worse proximity-to-failure estimates; exercise type, body part and sex may affect accuracy (Casanova et al. 2025, citing Halperin et al. 2022) — [Casanova et al. 2025 PDF](https://www.rdpc.uevora.pt/rdpc/bitstream/10174/39787/1/2025%20Casanova%20et%20al.%20Accuracy%20in%20predicting%20repetitions%20in%20reserve%20during%20resistance%20training.pdf)
- No study has tested an app's RPE/RIR rules directly; the research tested coaches/researchers applying RPE/RIR rules — [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- Deload consensus (Bell et al. 2023, Sports Medicine – Open, Delphi with 34→29→21 coaches): deload defined as a period of reduced training stress to mitigate fatigue, promote recovery and enhance preparedness; this is expert opinion, not efficacy evidence — [Bell et al. 2023 (SHU repository)](https://shura.shu.ac.uk/32417); [PDF](https://shura.shu.ac.uk/32417/1/s40798-023-00633-0.pdf)
- Coleman et al. 2024 (PeerJ), 39 trained participants, 9-week high-volume program: a 1-week full training cessation at midpoint had no effect on hypertrophy, power or local endurance but lower-body strength improved less; authors note no empirical evidence of deload potentiation in trained lifters — [PeerJ](https://peerj.com/articles/16777); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/)
- MEV/MAV/MRV: secondary reproductions of RP tables conflict (e.g., chest MEV 6 vs 10, MRV 22+; back MV 8, MEV 10, MAV 14–22, MRV 25+, 2–4x/week) — [gympsycho table](https://gympsycho.pages.dev/guides/volume-training); [arvo.guru landmarks](https://arvo.guru/resources/volume-landmarks); [2020 blog reproducing RP table](https://davidroesener.blogspot.com/2020/05/rp-hypertrophy.html)
- Recovery interval: "48–72 h per muscle" is largely blog lore; Korak et al. suggested ~72 h for slower recoverers on multi-joint barbell lifts and noted guidelines rest on anecdote; some trials found 24 h gaps gave similar strength/hypertrophy (unverified secondary summary); soreness is not a reliable readiness marker — [Korak et al. (core.ac.uk PDF)](https://core.ac.uk/download/43646094.pdf); [fitnessvolt](https://fitnessvolt.com/how-much-rest-between-workouts)

### Inferences
- Defensible offline defaults: count weekly hard sets per muscle (fractional for secondaries), show the lifter where they sit against a soft target band (e.g., ~10–20 sets), and treat landmarks as editable per-user numbers, not truths.
- Prefer performance-based signals (reps at a given load, e1RM trend) over RIR alone for automation, because RIR self-reports are noisy; use RIR as a modifier, as ABOT's Coach Pill already does with RPE.
- Scheduled deloads should be framed as optional/reduced-volume weeks, not mandatory full rest, given Coleman 2024 and the opinion-only status of Bell 2023.

### Gaps
- Could not access Pelland full text; exact coefficients unverified and publication year inconsistent across sources (2025 vs 2026).
- Halperin 2022 RIR-accuracy figures not retrieved directly.
- No primary RP/Israetel landmark table retrieved.
- No good trained vs untrained recovery-time comparison found.

## 4. What users praise and complain about

### Takeaway
Fitbod gets "random/not aligned with goals" and "bad weight suggestions" complaints (in both directions), but billing/support is the loudest complaint; Alpha Progression is praised for progression guidance, criticised for speed, partial offline and no Apple Watch app; RP is seen as pricey, not beginner-friendly and web-based.

### Cited Findings
- Fitbod: suggestions can "feel random rather than strategic"; Reddit thread "Is AI Coach just a glorified random workout generator?" with users saying suggestions don't match goals or past performance — [setgraph Reddit roundup](https://setgraph.app/ai-blog/best-weightlifting-app-reddit); [reddit snapshot](https://reddit.sentinel-team.org/posts/1pw0jmh/snapshots/2025-12-26T14%3A51%3A12.593993Z)
- Fitbod: thread titled "Fitbod recommends dangerous weights"; other reviewers say workouts were too easy even on "advanced" — [trustyspotter Reddit roundup](https://trustyspotter.com/blog/best-weightlifting-apps-reddit); [IndieHackers review 2026](https://www.indiehackers.com/post/fitbod-app-review-2026-honest-take-after-real-testing-45d5f07a1b)
- Fitbod: dominant complaints are surprise charges, upsells and cancellation/refund problems; Trustpilot shows recurring subscription-management complaints; repetitive workouts complaint also logged — [Trustpilot](https://www.trustpilot.com/review/fitbod.me); [sikayetvar complaint](https://www.sikayetvar.com/en/fitbod-us/fitbod-gave-me-repetitive-workouts-and-an-unreliable-app-experience); [Dr. Muscle's Fitbod review (competitor)](https://dr-muscle.com/fitbod-app-review-alternative/)
- Alpha Progression: praised for progression recommendations that "keep you training hard and improving"; criticised for speed; offline mode described as partial; r/alphaprogression users report 503/"no internet" login problems and want an Apple Watch app — [fitnessdrum review 2026](https://fitnessdrum.com/alpha-progression-app-review/); [brace-ai review](https://brace-ai.pages.dev/reviews/alpha-progression/); [r/alphaprogression mirror](https://redlib.hbubli.cc/r/alphaprogression)
- RP Hypertrophy: user review (Medium, Feb 2024) says not beginner-friendly, web app rather than native, ~$35/month, and it prescribed far more volume than the reviewer needed; Reddit users note only a broad 5–30 rep guideline — [Medium: 6 months with RP](https://medium.com/@justinsmith31491/i-used-the-rp-hypertrophy-app-for-6-months-f20e67378b20); [r/RPHypertrophy mirror](https://redlib.hbubli.cc/r/RPHypertrophy)

### Inferences
- Trust problems arise when the app changes things without saying why. Fitbod even publishes a help section "Why did my workout change? Understanding workout refreshes" ([Fitbod help](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works)). An offline rule engine can always show its reason (ABOT's Coach Pill rules are already explainable), which is a differentiator.
- Alpha Progression's login/503 and partial-offline complaints are exactly what a local-first app avoids.

### Gaps
- Direct Reddit threads mostly unavailable (only mirrors/roundups); sentiment counts not quantified. Little on JEFIT, Juggernaut AI or Dr. Muscle user complaints.

## 5. Pricing / what is premium

### Takeaway
"Smart" features are almost always the paywall: Alpha Progression gates progression recommendations and the plan generator; JEFIT gates the adaptive coach in Elite; RP and Juggernaut AI are ~$35/month. Prices vary by source and region.

### Cited Findings
- Fitbod: ~$15.99/month, $95.99/year on App Store; sources disagree on whether a permanent free tier exists — [App Store](https://apps.apple.com/app/id1041517543); [sensai.fit pricing comparison](https://www.sensai.fit/blog/fitness-app-pricing-free-tier-comparison); [aitoolsbakery](https://aitoolsbakery.com/blog/fitbod-pricing/)
- Alpha Progression: free tier; Pro (14-day trial) unlocks plan generator, progression recommendations, analytics; ~$12.99/month or $79.99/year per a 2026 comparison, older sources $59.99/year — [alphaprogression.com](https://alphaprogression.com/en); [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026); [fitnessdrum](https://fitnessdrum.com/alpha-progression-app-review/)
- JEFIT Elite: ~$12.99/month or $69.99/year (older/promo $6.99/month, $34.99/year) — [JEFIT blog](https://www.jefit.com/blog/jefit-vs-fitbod); [App Store](https://apps.apple.com/app/id449810000)
- Juggernaut AI: $34.99/month or $349.99/year — [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- RP Hypertrophy: ~$34.99/month, ~$299.99/year — [sensai.fit comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- Dr. Muscle: $49/month (~$588/year) per a single source — [aitoolsbakery](https://aitoolsbakery.com/blog/best-ai-workout-apps/)

### Inferences
- A free, offline, explainable version of progression + weekly volume + deload would undercut a $13–$50/month category; in ABOT these could equally be the Pro tier.

### Gaps
- No official price pages fetched (blocked); Dr. Muscle price single-sourced; regional (IDR) prices not checked.

## 6. Deterministic rules (offline-feasible) vs ML/cloud

### Takeaway
Everything described publicly by these apps can be implemented as deterministic rules over the on-device log. ML would only matter for population-level priors (e.g., starting weights for a never-logged exercise from millions of users) or wearable fusion, and even those have rule-based substitutes.

### Cited Findings
- Fitbod's described inputs are the user's own sets/reps/weight plus optional health data, with conservative defaults for unlogged exercises and layoffs — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Fitbod help](https://help.fitbod.me/hc/en-us/articles/16254175592215)
- Alpha Progression's progression is double progression on recorded performance with optional RIR — [Alpha Progression glossary](https://alphaprogression.com/en/glossary/progression)
- RP's set changes are a mapping from three ratings (pump, soreness, workload) to more/same/fewer sets — [RP help](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets)
- Juggernaut AI's described engine is debated as ML vs expert/rule system — [GarageGymReviews](https://garagegymreviews.com/juggernautai-review); [sensai.fit](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- A local-first competitor markets "100% on-device" training intelligence, showing the approach is viable — [gympsycho training intelligence](https://gympsycho.pages.dev/training-intelligence)
- Epley/Brzycki 1RM equations are closed-form — [Fitbod blog: Estimated Strength](https://fitbod.me/blog/estimated-strength?fitbodUser=1)

### Inferences (mechanism → offline feasibility for ABOT)
- Per-muscle recovery % (Fitbod): deterministic; ABOT has it. Possible upgrades: lengthen tail for eccentric-heavy/high-volume days, add manual override (Fitbod allows edits), use recovery % in exercise suggestion ordering.
- Per-set weight/rep/RIR targets with double progression (Alpha Progression): deterministic; ABOT's Coach Pill does this per exercise. Upgrade: per-set targets and gym-profile load rounding.
- Weekly set target per muscle with feedback (RP): deterministic. Store a per-muscle band (start ~MEV, cap ~MRV, user-editable); after each session ask 1–3 quick ratings (pump/soreness/workload or simply "too easy / right / too much") and move next week's sets −1/0/+1 or +2. Offline.
- Mesocycle with RIR ramp and scheduled deload week (RP/Alpha/JEFIT/Juggernaut blocks): deterministic calendar + table; fits ABOT's phase-engine.
- Readiness questionnaire scaling the day (Juggernaut AI): deterministic (score → % volume/load); can fold in Health Connect sleep already used in ABOT.
- Performance-drop deload (Dr. Muscle) and plateau detection: deterministic (e1RM or reps-at-load falling over N sessions; ABOT already has a 3-session rule). Add "cancel/trigger deload manually".
- Exercise substitution by equipment profile: deterministic; ABOT has it.
- Warm-up ramp: deterministic.
- Starting weight for a never-logged exercise: Fitbod-style population data would need a server; offline substitute is ratio conversion from related lifts (ABOT's swapper already does barbell-equivalent ratios) or bodyweight-relative tables shipped as static data.
- Readiness from HRV/wearables at scale and "learning" personal recovery rates: could be done on-device with simple per-user regression of performance vs days-since-trained; not ML-cloud dependent, but needs months of data.

### Gaps
- No app documents a learned (data-driven) component that demonstrably beats rule-based logic; no comparative outcome studies of apps found.
