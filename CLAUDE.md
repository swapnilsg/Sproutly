# Sproutly

A web-first garden companion for **beginner hobbyist gardeners** growing on balconies or indoors — "Duolingo for plants", not a power tool.
North star: *"This is fun and I want to learn more."* Every feature must reduce fear, build curiosity, or celebrate a small win.

Status: scaffolding only. A runnable monorepo exists; no product features yet. The product name **Sproutly is final**.

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
  - `docker compose up -d`
- Tests: Vitest in both apps. The API uses Supertest against `createApp()`; the web app uses Testing Library + jsdom. The shared ESLint config lives in `packages/config`.
- API imports are ESM (NodeNext), so relative imports need `.js` extensions.
- CI: `.github/workflows/ci.yml` runs install → lint → format:check → typecheck → test → build.

## Reference files (`docs/`)
| File | Contents |
|---|---|
| `sproutly_full_summary.html` | Product, roadmap, brand, tech and open-questions summary |
| `GardenBuddy_Onboarding_PRD.docx` | Onboarding PRD v1.0: per-screen specs, copy, analytics events (written under the old name) |
| `Sproutly_Onboarding_TechSpec.docx` | Engineering spec: SQL models, API contracts, Zustand store, component tree, 75 tasks |
| `onboarding_flow_overview.png` | Onboarding flowchart |
| `sample screens.docx` | Dark-mode mockups: space, starter pack, meet plant, dashboard (one embedded PNG) |
| `sproutly_branded_screens.html` | Light-mode branded mockups of every onboarding screen except experience level |
| `sproutly_brand_exploration.html` | Logo concepts, palette, typography, domain ranking |

To read a .docx: `python3 -c "import zipfile,re,sys;print(re.sub(r'<[^>]+>','',zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode().replace('</w:p>','\n')))" docs/FILE`

## User & platform
- Persona: **Sam, 28**. First-time plant parent with a sunny balcony who wants to grow herbs. Scared of killing plants, doesn't know the jargon, won't read a manual.
- v1 growing contexts: balcony/containers and indoor houseplants. Outdoor ground growing is not supported in v1 (see OQ-11).
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

## Onboarding flow (canonical)
There are 8 screens, and sign-up to first reminder should take under 3 minutes. Step numbers below are the canonical ones for code, analytics and docs.

| # | Screen | Progress bar | Notes |
|---|---|---|---|
| 1 | Sign up | none | "Continue with Google" (+ One Tap) or "Continue with email" → 6-digit code. No passwords, no name field (step 2 asks). Same screen doubles as "Welcome back". |
| 2 | Welcome: name + location | segment 1 | Location is used for hardiness zone and frost dates. Geocoding is async and never blocks. |
| 3 | Choose your space | segment 2 | 2×2 tiles: Balcony, Indoors, Garden bed, Not sure yet. Multi-select via "Pick multiple spaces". |
| 4 | Experience level | segment 3 | "Total beginner" is pre-selected. Auto-advances after 2.5s with a visible countdown; any key, click or touch cancels it. |
| 5 | Pick a starter pack | segment 4 | The best-fit pack is pre-selected. Ghost CTA: "I'll add plants myself" (goes to plant search). |
| 6 | Meet your first plant | segment 5 | Care card plus optional nickname (max 32 chars). The schedule is auto-filled and review-only here. |
| 7 | Enable reminders | none | Dark screen. Web push is asked **last**. |
| 8 | Aha moment: dashboard | none | Output only. Onboarding completes here. |

- **Progress bar:** 5 segments covering steps 2–6, coloured done (teal), active (light teal) and idle (grey). The mockup labels such as "STEP 2 — CHOOSE YOUR SPACE" count progress segments, not screen numbers.
- The flowchart's "Add first plant" and "Set care schedule" boxes are both step 6.
- **Skip to dashboard:**
  - Shown from step 2 onward as small secondary text below the CTA. Never hidden or deceptive.
  - Skipping sets `onboarding_done`, and the user lands on an empty dashboard with a single CTA: "Add your first plant — takes 2 minutes".
- **Starter packs (v1, 3 packs):**
  - Easy balcony herbs 🌿 (basil, mint, chives)
  - Beginner houseplants 🪴 (pothos, snake plant, peace lily)
  - Balcony flowers 🌸 (petunias, marigolds, lavender)
  - Default pack by space: balcony → herbs; indoors → houseplants; not sure → herbs.
- **Reminders (step 7):**
  - If the user denies: record it, continue, show an in-app bell, and re-prompt after 7 days.
  - If the browser has no Web Push (Safari < 16.4): hide the ask and show "We'll remind you in-app instead."
- **Dashboard (step 8):**
  - Confetti banner "Your garden is ready! [N] plants added", shown once and auto-dismissed after 4s.
  - Watering tasks for today and tomorrow.
  - One amber "Quick tip" card, 2 sentences max.
  - No tutorial overlays.
- **Resume:** progress is saved after every step (localStorage + server), and a returning user continues from their last completed step. Anonymous-session resume depends on OQ-03.

### Key copy
| Screen | Copy |
|---|---|
| Sign up | "Grow with confidence, one plant at a time" / "Create your account" |
| Welcome | "Nice to meet you, [name]!" — "Where are you growing from?" Privacy line: "Used only to personalise your care advice — never shared." |
| Space | "Where do you grow?" |
| Experience | "How much do you know about plants?" — "No judgement — we all start somewhere." |
| Pack | "Start with a bundle?" — CTA "Add these to my garden" |
| Meet plant | "Say hi to your [plant]!" — CTA "Looks good — set my reminders" |
| Reminders | "Never forget to water again" — "We'll remind you exactly when each plant needs care — nothing more, nothing less." CTA "Turn on reminders" / ghost CTA "Maybe later" |
| Dashboard | "Good morning, [name]" — "[N] plants are counting on you today" |

### UX and copy rules
- One meaningful question per screen.
- Every screen has a sensible pre-selected default, and it is always the genuine beginner recommendation.
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
| Sprout green | `#1D9E75` | Primary, CTAs, logo, selected borders |
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
  - Routes: `/onboarding/:step` (1–8) and `/dashboard`. Step components are lazy-loaded.
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
- `POST /gardens` runs in a single transaction and is idempotent on `pack_id`.
- `users.onboarding_step` holds the last completed step (0–7). It only increments; lower values are ignored.

### Data model
- **Built:** `users` (no `password_hash`), `auth_identities`, `refresh_tokens`, `onboarding_events` (migrations in `apps/api/migrations/`).
- **Specified, not built:** `gardens`, `garden_plants` (with `care_schedule` JSONB).
- **Still to specify:** `plants`, `packs` (+ pack→plant join), `tasks`, `push_subscriptions`, `tips`.

### API
- **Built (auth):**
  - `POST /auth/email/start`, `POST /auth/email/verify`
  - `POST /auth/google`
  - `POST /auth/refresh`, `POST /auth/logout`
  - `GET /users/me/onboarding-state`
  - `POST /analytics/events`
- **Specified, not built:**
  - `PATCH /users/me/profile`
  - `GET /packs?space_type=` (public, CDN-cached 1h, max 4 packs)
  - `POST /gardens`, `PATCH /gardens/:gardenId/plants/:plantId`
  - `POST /notifications/permission`
- **Still to specify:** `GET /dashboard` (single call, no waterfall), `PATCH /tasks/:id`, `GET /notifications/vapid-public-key`.

### Analytics events
All events carry `user_id`, `session_id` and a timestamp.

| Event | Extra properties |
|---|---|
| `onboarding_started` | — |
| `onboarding_step_completed` | `step`, `time_on_step` |
| `onboarding_skipped` | `step` |
| `starter_pack_selected` | `pack_name` |
| `notification_permission_granted` / `notification_permission_denied` | `browser`, `os` |
| `onboarding_completed` | `total_time_ms` |
| `first_task_completed` | — |

### Build plan
- 75 tasks with stable IDs: A-*, OS-*, S2-* to S8-*, AN-*, IN-*.
- Sizes: 11 XS, 34 S, 24 M, 6 L. That sums to **~55–60 dev-days solo**. The spec's "~83 days" came from a summary table that doesn't match the task rows.
- Week 1 must deliver auth (A-01 to A-06) and env/DB setup (IN-01, IN-02) before steps can be integrated end to end.
- Accessibility and responsive QA (IN-07, IN-08) cover all 8 screens at 320, 375, 768 and 1280px.

## Open questions
| ID | Question | Current leaning |
|---|---|---|
| OQ-01 | Monetisation | Freemium (5 plants free; paid = unlimited + AI diagnosis) is the leading idea, not decided |
| OQ-02 | Geocoding provider | Google Maps (~$5 per 1k requests, accurate) vs Nominatim (free, weaker for India and non-Western cities) |
| OQ-03 | Guest/anonymous onboarding | Redis session keyed by a client UUID, migrated on signup; about 1 extra dev-day |
| OQ-04 | Email verification | **Resolved:** email codes verify every account |
| OQ-05 | OAuth popup vs redirect | **Resolved:** Google uses GIS ID-token verification, with no popup or redirect of our own |
| OQ-06 | Push scheduling | BullMQ from day 1 |
| OQ-07 | Keep step 4 (experience level)? | In the flow for now; the branded mockups already omit it |
| OQ-08 | Is in-app-only acceptable where Web Push is unsupported? | In-app bell + message |
| OQ-09 | Domain purchase | Buy `sproutly.app` now |
| OQ-10 | Day-1 re-engagement | Not designed |
| OQ-11 | What does picking "Garden bed" give a user, given v1 has no ground-growing support? | Not decided (e.g. default to the balcony pack and tag them for the Phase 4 outdoor path) |
| OQ-12 | Add Sign in with Apple later? | Deferred; needs a $99/yr Apple developer account. iPhone users use the email code for now |

## Resolved doc conflicts
When reading the reference files, apply these rulings:
- **Name:**
  - "GardenBuddy" in the PRD means Sproutly.
- **Auth:**
  - Sign-up is passwordless: Google + email code only.
  - This supersedes everything password- and Apple-related in the PRD and spec: `POST /auth/signup` and `/auth/oauth`, `password_hash`, bcrypt, password validation, the Apple button, the name field on step 1, and the separate log-in screen.
- **Flow numbering:**
  - The 8-screen table above is canonical.
  - Mockup "STEP n" labels count progress segments, not screen numbers.
  - The flowchart's two plant boxes are one screen (step 6).
- **Progress bar:**
  - The PRD's "5 dots" is the 5-segment bar over steps 2–6.
- **Skip link:**
  - It appears from step 2. This overrides the PRD's step-3 table.
- **Experience level:**
  - Auto-advance is 2.5s with a countdown (tech spec), not the PRD's 3s.
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
  - The PRD's "anonymous sessions" resume applies only if OQ-03 is approved.
