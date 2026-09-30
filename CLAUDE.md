# Sproutly

A web-first garden companion for **beginner hobbyist gardeners** growing on balconies or indoors — "Duolingo for plants", not a power tool.
North star: *"This is fun and I want to learn more."* Every feature must reduce fear, build curiosity, or celebrate a small win.

Status: onboarding v2 is being built step by step (branch `feature/onboarding-welcome`). Built so far:
- Step 1, Welcome, at `/onboarding/1`.
- Passwordless sign-up at `/onboarding/6` ("Save your garden") and `/signin` ("Welcome back"). Both use `SignUp` / `VerifyCode` with a `mode` prop (see `apps/web/src/screens/authMode.ts`).

Steps 2–5, 7 and 8 and the dashboard are still placeholders.

**Interim until those steps exist:**
- "Start my garden" goes straight to `/onboarding/6` (`START_ROUTE` in `Welcome.tsx`). Point it at `/onboarding/2` when step 2 ships.
- `NEW_USER_STEP` stays `1` until `POST /onboarding/setup` exists. Setting it to 0 now would send new users back to the guest-only Welcome screen.

The product name **Sproutly is final**.

**This file is the source of truth.** Where the reference docs disagree with it, this file wins (see *Resolved doc conflicts* at the end).

## Repo layout & commands
```
apps/web/         React + Vite + TS + Zustand (dev server :3000, proxies /api → :4000)
apps/api/         Express 5 + TS (tsx watch in dev, tsc build), :4000; app in src/app.ts, listener in src/index.ts
packages/config/  shared tsconfig.base.json + ESLint flat config (@sproutly/config)
docs/             planning & design reference files (below)
docker-compose.yml  postgres:16 (sproutly/sproutly, db sproutly) + redis:7
```
- Requirements: Node 22 (`.nvmrc`), pnpm (via corepack), Docker.
- Commands:
  - `pnpm install`
  - `pnpm dev` (web + api)
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`
  - `pnpm test:e2e` (Playwright, desktop + Pixel 7; starts its own API on :4100 and web on :3100)
  - `docker compose up -d`, then `pnpm --filter @sproutly/api migrate`
- **Local config:** copy `apps/api/.env.example` to `apps/api/.env` and fill in the two secrets. Sign-in codes print in the API console.
- **Tests:**
  - API: Vitest + Supertest against `createApp(deps)`. `src/test/helpers.ts` builds deps with a recording email sender and a mocked Google verifier. The test DB `sproutly_test` is recreated each run; Redis db 1.
  - Web: Testing Library + jsdom, with `mockApi()` in `src/test/utils.tsx`.
  - E2E: `apps/web/e2e/`. DB `sproutly_e2e`, Redis db 2. Codes are read from `dev:outbox:{email}` in Redis, and the Google GIS script is stubbed. Every E2E run includes axe WCAG 2.1 AA checks.
- **Code layout:**
  - API: `src/auth/` (email codes, Google, tokens, routes), `src/analytics/`, `src/users/`, `migrations/*.sql`.
  - Web: `src/screens/`, `src/stores/` (auth in memory, onboarding persisted), `src/lib/api.ts`, `src/routes.tsx`.
- API imports are ESM (NodeNext), so relative imports need `.js` extensions.
- CI: `.github/workflows/ci.yml` runs install → lint → format:check → typecheck → test → build.

## Reference files (`docs/`)
| File | Contents |
|---|---|
| `onboarding_v2_spec.md` | **Current** onboarding spec: per-screen copy, defaults, data, analytics, new API and migrations |
| `sproutly_full_summary.html` | Product, roadmap, brand, tech and open-questions summary |
| `GardenBuddy_Onboarding_PRD.docx` | Onboarding PRD v1.0 (old name). Its flow is superseded by v2; copy rules and metrics still apply |
| `Sproutly_Onboarding_TechSpec.docx` | Engineering spec: SQL models, API contracts, Zustand store, component tree, 75 tasks |
| `onboarding_flow_overview.png` | Onboarding flowchart |
| `sample screens.docx` | Dark-mode mockups: space, starter pack, meet plant, dashboard (one embedded PNG) |
| `sproutly_branded_screens.html` | Light-mode branded mockups of every onboarding screen except experience level |
| `sproutly_brand_exploration.html` | Logo concepts, palette, typography, domain ranking |

To read a .docx: `python3 -c "import zipfile,re,sys;print(re.sub(r'<[^>]+>','',zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode().replace('</w:p>','\n')))" docs/FILE`

## User & platform
- Persona: **Sam, 28**. First-time plant parent with a sunny balcony who wants to grow herbs. Scared of killing plants, doesn't know the jargon, won't read a manual.
- v1 growing contexts: balcony/containers and indoor houseplants. Outdoor ground growing is not supported in v1, so there is no "Garden bed" option.
- Web-first: desktop and tablet are primary; mobile web must be fully responsive (320–1440px). Native apps are out of scope for v1.
- Browsers: Chrome, Firefox and Edge 100+; Safari 15+. Web Push needs Safari 16.4+.

## Roadmap
- **Phase 1 (MVP):**
  - 8-screen onboarding and starter packs
  - Daily task dashboard and plain-English care cards
  - Web-push watering reminders
  - Photo diary with time-lapse
  - Weekly emoji health check-in
  - Pot/container tracker with repotting reminders
- **Phase 2 (post-PMF):**
  - In-context lessons and a tap-to-define glossary
  - AI pest/disease diagnosis from photos
  - Seasonal tips
  - Streaks, badges and shareable plant cards
  - Recommendations engine
  - Moderated community Q&A
- **Phase 3 (delight):** plant birthdays and milestones, year-in-review, neighbourhood seed swap, harvest-to-table recipes.
- **Phase 4 (premium):** AI chat assistant, seed/supply shop, multi-garden support, upgrade path to outdoor beds.
- **Not in v1:** garden layout map, seed inventory, harvest logging, companion planting, soil sensors, social/referral features, paid upsell during onboarding.

## Onboarding flow (canonical: v2)
Full detail is in `docs/onboarding_v2_spec.md`. There are 8 screens: 5 quick taps before sign-up, then a first completed task inside onboarding. The goal is landing → first win in under 3 minutes.

| # | Screen | Route / access | Progress bar | Notes |
|---|---|---|---|---|
| 1 | Welcome | `/onboarding/1`, guests only | none | "Keep your first plants alive". CTA "Start my garden"; link "I already have an account" → `/signin`. |
| 2 | Where will your plants live? | anyone | segment 1 | Balcony / Indoors / Not sure yet (multi-select; "Not sure" is exclusive). Default: Balcony. No Garden bed. |
| 3 | How sunny is that spot? | anyone | segment 2 | Bright sun / Some sun / Mostly shade / Not sure. Default: Not sure. Replaces experience level. |
| 4 | Pick your starter pack | anyone | segment 3 | Pre-selected from space × sunlight. Editable city chip (IP guess via Cloudflare headers). "Choose my own plants" (max 5). |
| 5 | Meet your plant | anyone | segment 4 | Care card, optional nickname, and **"Do you have these plants yet?"** (no default; the CTA waits for an answer). |
| 6 | Save your garden (sign-up) | `/onboarding/6` + `/6/code`, guests only | segment 5 | The built Google / email-code screens, retitled "Your garden is ready 🌱". Then `POST /onboarding/setup`. |
| 7 | Reminders | signed in | none | Pick a daily time (default 8:00, browser timezone), then push permission / "Maybe later". |
| 8 | Your first win | signed in | none | Dashboard with one task doable right now (check soil, or "Pick up your [plant]"). Ticking it shows the confetti. Completes onboarding. |

- **Guest steps:**
  - Answers from steps 2–5 live only in the persisted onboarding store (`sproutly_onboarding_v1`). They go to the server in one `POST /onboarding/setup` after sign-in; there are no guest sessions on the server (resolves OQ-03).
  - Signed-in users without a garden also go through steps 2–5, and skip step 6.
  - A `409 garden_exists` response from setup means a returning user: drop the local answers and go home.
- **Step mapping:** `users.onboarding_step` = last completed step. `0` = account but no garden; `6` = setup saved; `7` = reminders done. `onboarding_done` is set when step 8 renders. New accounts start at 0.
- **Skip for now:** shown on steps 2–5. It fills defaults (balcony, not sure, recommended pack, plants "not yet") and jumps to step 6. There's no skip after that, and no skip-to-empty-dashboard path.
- **Pack recommendation:**
  - Balcony, unknown space, or mixed spaces with bright/some/unknown sun → Easy balcony herbs.
  - Indoors-only, or any shade → Beginner houseplants.
  - Flowers are never the default.
  - A pack that needs more sun than the spot gets shows "Needs more sun than your spot gets".
- **Starter packs (v1):**
  - Easy balcony herbs 🌿 (basil, mint, chives)
  - Beginner houseplants 🪴 (pothos, snake plant, peace lily)
  - Balcony flowers 🌸 (petunias, marigolds, lavender)
- **First tasks:**
  - Owned plants: "Check if the soil is dry" (first task) plus watering from today.
  - Not owned: "Pick up your [plant]" tasks; watering starts once each is done.
- **Reminders:** if the user denies, record it, carry on, show the in-app bell, and re-prompt after 7 days. Without Web Push (Safari < 16.4): "We'll remind you in the app instead."
- **Names:** Google provides the first name. Email users aren't asked during onboarding; the greeting falls back to "Good morning 🌱".

### Key copy
| Screen | Copy |
|---|---|
| Welcome | "Keep your first plants alive" — "We'll tell you exactly what to do, every day." CTA "Start my garden"; "Free · takes about 2 minutes" |
| Space | "Where will your plants live?" — "Pick all that apply." CTA "That's where they'll live" |
| Sunlight | "How sunny is that spot?" — "Your best guess is fine — you can change it later." CTA "Show me plants that fit" |
| Pack | "Start with a bundle?" — "We've picked plants that suit your spot — all easy to keep alive." CTA "Add these to my garden" |
| Meet plant | "Say hi to your [plant]!" — "Do you have these plants yet?" CTA "Save my garden" |
| Save garden | "Your garden is ready 🌱" — "Save it so we can remind you when your plants need you." Tagline stays "Grow with confidence, one plant at a time" |
| Reminders | "Never forget to water again" — "We'll send one reminder a day, only when a plant needs you." CTA "Turn on reminders" / "Maybe later" |
| First win | "Good morning, [name]" — "[N] plants are counting on you"; after the first tick: "Your first win! 🌱 Your garden is off to a great start." |

### UX and copy rules
- One meaningful question per screen.
- Every screen has a sensible pre-selected default, and it is always the genuine beginner recommendation. The one exception is step 5's "Do you have these plants yet?": a wrong guess would make day 1's tasks wrong.
- Plain English only, no botanical jargon. Beginner mode adds tap-to-define on technical terms after onboarding.
- Warm "knowledgeable friend" tone, sentence case everywhere, max 2 sentences of body copy per screen.
- CTAs describe the outcome ("Set my reminders", not "Continue").
- Ghost CTAs are honest. No urgency, scarcity or other dark patterns.

### Success targets
| Metric | Target |
|---|---|
| Onboarding completion | > 70% |
| Time to first reminder | < 3 min |
| Day-1 task completion | > 40% |
| Day-3 retention | > 50% |
| Starter pack selection | > 60% |
| Notification opt-in | > 55% |

## Brand
- **Name and domain:**
  - Name: **Sproutly**. Wordmark is lowercase Georgia serif with a small leaf flourish.
  - Domains in priority order: `sproutly.app` (buy first); `sproutly.com` (check; inquire if parked); `getsproutly.com` (fallback); `sproutly.io` (fine); `sproutly.co` (last resort); avoid `mysproutly.com`.
  - Trademark check (USPTO/EUIPO, Class 42) still pending.
- **Logo:** single sprout (two-leaf seedling) is the preferred mark. App icon/favicon is the sprout on a rounded-square brand-green background. Wordmark variants: on white (primary), on dark (night mode), on brand green (marketing).
- **Palette:**

| Token | Hex | Use |
|---|---|---|
| Sprout green | `#1D9E75` | Primary brand colour: logo, selected borders, focus rings. **Not** for white-text fills: only 3.4:1 contrast |
| Sprout green dark | `#0F6E56` | CTA button fills (white text 6.2:1) and green text on white |
| Leaf mid | `#5DCAA5` | Accents, active progress segment |
| Morning mist | `#E1F5EE` | Card backgrounds, selected tile fill |
| Terracotta sun | `#F9A23C` | Warmth: tips, streaks, alerts |
| Parchment | `#FEF4E6` | Warm neutral surface, tip cards |
| Deep forest | `#1A2E1A` | Dark mode background, text, reminders screen |

- **Care chips** (from the mockups):

| Chip | Background | Text |
|---|---|---|
| Water | `#E6F1FB` | `#185FA5` |
| Sun | `#FAEEDA` | `#854F0B` |
| Difficulty | `#EAF3DE` | `#27500A` |

- **Typography:** headings and wordmark in Georgia/Lora; body and UI in Inter/DM Sans. The mockups fall back to `system-ui`, but the production UI uses Inter.

## Tech stack
- **FE:** React + Zustand.
  - Persist key `sproutly_onboarding_v1`. On load: rehydrate from localStorage, then reconcile with the server. The server wins on step number; local wins on unsaved form data.
  - Routes: `/onboarding/:step` (1–8, with `/onboarding/6/code`), `/signin` (+ `/signin/code`) and `/dashboard`. Step components are lazy-loaded.
- **API:** Node/Express (no Passport). REST under `/api/v1`, JSON only. zod validation returns 422 with field errors. Global error handler with no stack traces in production.
- **Data:** PostgreSQL. Redis holds sessions, rate limits, the onboarding cache (`onboarding:{userId}`, 30-day TTL) and the analytics queue (flushed every 10s).
- **Auth (passwordless):**
  - **Methods:** Google (GIS button + One Tap, server verifies the ID token) and a 6-digit email code. No passwords and no Apple (OQ-12).
  - **Email code:**
    - Stored as an HMAC in Redis `otp:{email}` with a 10-minute TTL.
    - Max 5 attempts, then the code is burned.
    - `start` always returns 202, so it never reveals whether an account exists.
    - Rate limits: 3 per email per 15 min, 10 per IP per hour.
  - **Accounts:** every account has a verified email. Google sign-ins link to an existing user by email; `auth_identities` stores `(provider, provider_subject)`.
  - **Access token:** a JWT that lasts 15 min and is kept **in memory only**, never in localStorage.
  - **Refresh token:** lasts 30 days and lives in an httpOnly cookie. It is rotated on every use; reusing a revoked token revokes the whole token family.
  - **Google switched off:** when `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` are unset, the API returns 503 and the web app hides the Google button.
  - **Email sending:** codes print to the API console until `EMAIL_API_KEY` is set; then Resend is used.
- **Push:** Web Push + VAPID. **CDN:** Cloudflare. **CORS:** `sproutly.app` and `localhost:3000`, with credentials.
- **Tests:**
  - Playwright E2E on every PR, covering the happy, skip, OAuth, resume and notification-denied paths.
  - Vitest + Supertest for the API against real Postgres/Redis, with 90% coverage on auth and onboarding routes.
- **Env vars:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OTP_SECRET`, `GOOGLE_CLIENT_ID`, `EMAIL_API_KEY`, `EMAIL_FROM`, `VAPID_PRIVATE_KEY`, `GEOCODING_API_KEY`.

### Constraints
- Each screen renders in < 1s, with no blocking API call on step transitions.
- Onboarding chunk < 120 KB gzipped; total onboarding payload < 500 KB.
- API p95 < 300 ms.
- WCAG 2.1 AA, full keyboard support (tiles activate with Enter/Space), screen-reader labels.
- `POST /onboarding/setup` runs in a single transaction (profile, garden, plants, first tasks) and returns 409 if a garden already exists.
- `users.onboarding_step` holds the last completed step (0, 6 or 7 in v2). It only increments; lower values are ignored.

### Data model
- **Built:** `users` (no `password_hash`), `auth_identities`, `refresh_tokens`, `onboarding_events` (migrations in `apps/api/migrations/`).
- **Specified, not built** (see `docs/onboarding_v2_spec.md`):
  - `users` + `sunlight`, `reminder_time`, `timezone`, `location_source`
  - `plants`, `packs`, `pack_plants`
  - `gardens` (one per user)
  - `garden_plants` (+ `owned`)
  - `tasks` (`water` / `check_soil` / `buy`, `is_first_task`)
- **Still to specify:** `push_subscriptions`, `tips`.

### API
- **Built (auth):**
  - `POST /auth/email/start`, `POST /auth/email/verify`
  - `POST /auth/google`
  - `POST /auth/refresh`, `POST /auth/logout`
  - `GET /users/me/onboarding-state`
  - `POST /analytics/events`
- **Specified, not built:**
  - `GET /geo/guess`
  - `POST /onboarding/setup`
  - `PATCH /users/me/reminders`, `PATCH /users/me/onboarding`
  - `PATCH /tasks/:id`
  - `POST /notifications/permission`
  - `PATCH /gardens/:gardenId/plants/:plantId`
- **Superseded by setup:** `PATCH /users/me/profile` and `POST /gardens` from the tech spec.
- **Still to specify:** `GET /dashboard` (single call, no waterfall), `GET /notifications/vapid-public-key`.

### Analytics events
All events carry `user_id`, `session_id` and a timestamp.

| Event | Extra properties |
|---|---|
| `onboarding_started` | — |
| `onboarding_step_completed` | `step`, `time_on_step`, plus the step's answer (`space_types`, `sunlight`, `plants_owned`, `has_nickname`, `method`, `is_new_user`) |
| `onboarding_skipped` | `step` |
| `starter_pack_selected` | `pack_name`, `recommended`, or `custom` + `count` |
| `notification_permission_granted` / `notification_permission_denied` | `browser`, `os`, `reminder_time` |
| `onboarding_completed` | `total_time_ms` |
| `first_task_completed` | `in_onboarding`, `task_type` |

`onboarding_started` fires on the Welcome screen, once per onboarding attempt. Sign-up reports as step 6. A returning user signing in at `/signin` reports no step, unless the account turns out to be new.

### Build plan
- 75 tasks with stable IDs: A-*, OS-*, S2-* to S8-*, AN-*, IN-*. The step tasks (S2–S8) predate onboarding v2; re-plan them from `docs/onboarding_v2_spec.md` before building.
- Sizes: 11 XS, 34 S, 24 M, 6 L. That sums to **~55–60 dev-days solo**. The spec's "~83 days" came from a summary table that doesn't match the task rows.
- Week 1 must deliver auth (A-01 to A-06) and env/DB setup (IN-01, IN-02) before steps can be integrated end to end.
- Accessibility and responsive QA (IN-07, IN-08) cover all 8 screens at 320, 375, 768 and 1280px.

## Open questions
| ID | Question | Current leaning |
|---|---|---|
| OQ-01 | Monetisation | Freemium (5 plants free; paid = unlimited + AI diagnosis) is the leading idea, not decided |
| OQ-02 | Geocoding provider | Google Maps (~$5 per 1k requests, accurate) vs Nominatim (free, weaker for India and non-Western cities) |
| OQ-03 | Guest/anonymous onboarding | **Resolved (v2):** steps 2–5 run as a guest with answers in the browser, saved by `POST /onboarding/setup` after sign-in. No server-side guest sessions |
| OQ-04 | Email verification | **Resolved:** email codes verify every account |
| OQ-05 | OAuth popup vs redirect | **Resolved:** Google uses GIS ID-token verification, with no popup or redirect of our own |
| OQ-06 | Push scheduling | BullMQ from day 1 |
| OQ-07 | Keep step 4 (experience level)? | **Resolved (v2):** cut. Replaced by the sunlight question; everyone gets beginner mode |
| OQ-08 | Is in-app-only acceptable where Web Push is unsupported? | In-app bell + message |
| OQ-09 | Domain purchase | Buy `sproutly.app` now |
| OQ-10 | Day-1 re-engagement | Not designed |
| OQ-11 | What does picking "Garden bed" give a user, given v1 has no ground-growing support? | **Resolved (v2):** the tile is removed from v1; it may return as "coming soon / notify me" in Phase 4 |
| OQ-12 | Add Sign in with Apple later? | Deferred; needs a $99/yr Apple developer account. iPhone users use the email code for now |
| OQ-13 | Does sign-up at step 6 actually beat step 1? | Planned experiment once there's traffic: onboarding completion and day-3 retention |

## Resolved doc conflicts
When reading the reference files, apply these rulings:
- **Name:**
  - "GardenBuddy" in the PRD means Sproutly.
- **Auth:**
  - Sign-up is passwordless: Google + email code only.
  - This supersedes everything password- and Apple-related in the PRD and spec: `POST /auth/signup` and `/auth/oauth`, `password_hash`, bcrypt, password validation, the Apple button, the name field on step 1, and the separate log-in screen.
- **Onboarding v2 supersedes the PRD flow:**
  - `docs/onboarding_v2_spec.md` replaces the PRD's screen order, the name + location screen, the experience-level screen (with its auto-advance), the "Garden bed" tile, and "Skip to dashboard".
  - Sign-up moves from step 1 to step 6.
  - The PRD's copy rules, metrics and reminder rules still apply.
- **Mockups:**
  - Mockup "STEP n" labels count progress segments, not screen numbers.
  - The flowchart's "Add first plant" and "Set care schedule" boxes are both step 5 (Meet your plant).
  - The branded sign-up mockup's name/password fields are superseded by Google + email code.
- **Progress bar:**
  - The PRD's "5 dots" is the 5-segment bar over steps 2–6.
- **Sign-up headline:**
  - The branded mockup's "Grow with confidence, one plant at a time" replaces the PRD's "Start growing with confidence."
- **Tip card:**
  - The label is "Quick tip". The dark mockup's "Did you know?" is superseded.
- **Body font:**
  - Inter/DM Sans. The mockups' `system-ui` is only a placeholder.
- **Safari:**
  - The app supports Safari 15+, but reminders there are in-app only (below 16.4).
- **Estimates:**
  - Use ~55–60 days, not 83.
  - "7 screens" in IN-07 and IN-08 means all 8.
- **Anonymous resume:**
  - Guests resume from the persisted onboarding store (steps 2–5).
  - The server only tracks steps once an account exists (v2 step mapping).
