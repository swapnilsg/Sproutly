# Sproutly onboarding v2 — screen spec

Status: approved direction, not built yet (only the sign-up screens exist, currently at step 1).
Supersedes the PRD's 8-screen flow (`GardenBuddy_Onboarding_PRD.docx`) and the matching parts of the tech spec.
`CLAUDE.md` holds the summary; this file holds the detail.

## Why v2
The PRD's order has three problems:
1. It asks for an account before showing any value.
2. It spends two screens (name + location, experience level) on answers that don't change what a beginner sees.
3. It never asks the two things that decide whether a first plant survives: **light** and **whether the user owns the plant yet**.

v2 fixes all three and keeps the < 3 minute target. There are 5 quick taps before sign-up, and sign-up is one tap with Google.

## Flow at a glance
| # | Screen | Route | Who can see it | Progress bar |
|---|---|---|---|---|
| 1 | Welcome | `/onboarding/1` | guests only | none |
| 2 | Where will your plants live? | `/onboarding/2` | anyone | segment 1 |
| 3 | How sunny is that spot? | `/onboarding/3` | anyone | segment 2 |
| 4 | Pick your starter pack | `/onboarding/4` | anyone | segment 3 |
| 5 | Meet your plant | `/onboarding/5` | anyone | segment 4 |
| 6 | Save your garden (sign-up) | `/onboarding/6`, `/onboarding/6/code` | guests only | segment 5 |
| 7 | Reminders | `/onboarding/7` | signed in | none |
| 8 | Your first win | `/onboarding/8` → `/dashboard` | signed in | none |

Returning users sign in at `/signin` and `/signin/code`. These reuse the step 6 components with "Welcome back" copy.

### Where answers live
- **Steps 2–5:** answers are stored only in the browser, in the persisted onboarding store (`sproutly_onboarding_v1`). No server calls, so every transition is instant.
- **After sign-in:** the client sends everything in one `POST /onboarding/setup`.
- **Signed-in users** (for example, someone who signed in at `/signin` but has no garden yet) go through steps 2–5 the same way. At the end of step 5 they skip step 6 and the client calls setup directly.
- **Cost of this design:** if the user clears site data before step 6, their answers are lost. That's acceptable: it's under 1 minute of work.

### Step-number mapping (`users.onboarding_step` = last completed step, 0–7)
| Server state | Meaning | Where `homeRoute()` sends a signed-in user |
|---|---|---|
| `0` | Account exists, no garden yet | First unanswered step in local state, else `/onboarding/2` |
| `6` | Setup saved (garden + tasks created) | `/onboarding/7` |
| `7` | Reminders step done (granted, denied or "Maybe later") | `/onboarding/8` |
| `onboarding_done = true` | First-win screen reached | `/dashboard` |

Steps 1–5 are never recorded on the server; they're guest steps. New accounts start at `0`, **not 1**; this is a change to `NEW_USER_STEP` in `apps/api/src/auth/users.ts`.

### Skipping
- "Skip for now" (small secondary text, never hidden) appears on steps 2–5.
- It fills every unanswered question with its default and jumps straight to **step 6**. Defaults: space → balcony; sunlight → not sure; pack → the recommendation; plants owned → "not yet". An account is needed to save anything, so the skip goes to step 6 rather than the dashboard.
- There is no skip on steps 6–8.
- The PRD's "Skip to dashboard" and its empty-dashboard path are superseded.

### Progress bar
5 segments cover steps 2–6: done (Sprout green), active (Leaf mid), idle (Morning mist). This keeps the PRD's "5 dots", and the last segment is "save".

---

## Step 1 — Welcome
**Goal:** state the promise before asking for anything, and give returning users a way in.

**Content (Deep forest shell, same as the built sign-up screen):**
- Sprout mark and "Sproutly".
- Headline: **"Keep your first plants alive"**
- Sub: "We'll tell you exactly what to do, every day."
- Primary CTA: **"Start my garden"** → `/onboarding/2`
- Link: "I already have an account" → `/signin`
- Fine print: "Free · takes about 2 minutes"
- Two decorative sample task cards between the copy and the CTA (hidden from screen readers), showing what the app does:
  - "Water your basil · Today · morning" (ticked)
  - "Move mint into the sun · Today · any time"

**Inputs:** none.

**Data:**
- Sets `step1StartedAt` (onboarding store) on first view.
- Fires `onboarding_started`, once per onboarding attempt. This behaviour already exists via `markStep1Started()`.

**Acceptance:**
- Loads with no API calls other than the session-refresh check.
- Signed-in users never see this screen; they go to their `homeRoute()`.
- axe clean, keyboard reachable.

## Step 2 — Where will your plants live?
**Goal:** the first filter for plants, packs and advice.

**Content:**
- Headline: **"Where will your plants live?"**
- Sub: "Pick all that apply."
- Tiles (multi-select, selected state = Sprout green border + Morning mist fill):
  - 🪴 **Balcony** — "Pots, railings and window boxes"
  - 🏠 **Indoors** — "Windowsills, shelves and rooms"
  - 🌱 **Not sure yet** — "We'll suggest easy options". Exclusive: selecting it clears the others, and selecting another tile clears it.
- CTA: **"That's where they'll live"**
- "Skip for now"

**Default:** Balcony pre-selected (the persona's case).

**No "Garden bed" tile in v1.** Outdoor ground growing isn't supported, so we don't offer it. It can come back as "coming soon / notify me" in Phase 4. (Resolves OQ-11.)

**Data:** `spaceTypes: ('balcony' | 'indoors' | 'unknown')[]`, at least one required.

**Analytics:** `onboarding_step_completed {step: 2, space_types, time_on_step}`.

**Acceptance:**
- Tiles are toggle buttons (`aria-pressed`) that work with Enter/Space.
- The grid collapses to 1 column at 320px.

## Step 3 — How sunny is that spot?
**Goal:** capture light, the biggest single factor in whether a beginner's plant survives. This replaces the PRD's experience-level screen (resolves OQ-07). Everyone gets beginner mode; an "I've grown plants before" setting can come later.

**Content:**
- Headline: **"How sunny is that spot?"**
- Sub: "Your best guess is fine — you can change it later."
- Options (single-select radio cards):
  - ☀️ **Bright sun** — "Sun shines on it for most of the day"
  - ⛅ **Some sun** — "A few hours of sun, or bright light all day"
  - 🌥️ **Mostly shade** — "Little or no direct sun"
  - 🤷 **Not sure** — "We'll pick plants that cope with anything"
- CTA: **"Show me plants that fit"**
- "Skip for now"

**Default:** "Not sure" pre-selected. It's the honest default, and it maps to the most forgiving plants.

**Data:** `sunlight: 'bright' | 'some' | 'shade' | 'unknown'`.

**Analytics:** `onboarding_step_completed {step: 3, sunlight, time_on_step}`.

**Acceptance:**
- The group is a native radio group: arrow keys move between options, and the legend is the headline.

## Step 4 — Pick your starter pack
**Goal:** avoid the blank slate. Recommend plants that suit the user's space and light.

**Content:**
- Headline: **"Start with a bundle?"**
- Sub: "We've picked plants that suit your spot — all easy to keep alive."
- Location chip:
  - With an IP-based guess: "📍 Growing in **Bengaluru** · change"
  - Without one: "📍 Add your city (optional)"
  - Tapping opens an inline text field. This is the only place location is asked.
- Pack list (radio cards; the recommended pack is first and pre-selected, with a "Best for your spot" badge):
  - 🌿 **Easy balcony herbs** — basil, mint, chives
  - 🪴 **Beginner houseplants** — pothos, snake plant, peace lily
  - 🌸 **Balcony flowers** — petunias, marigolds, lavender
  - A pack that needs more light than the user reported shows a gentle note: "Needs more sun than your spot gets". It stays selectable.
- CTA: **"Add these to my garden"**
- Link: **"Choose my own plants"** → an inline picker of the catalogue's beginner plants, filtered by light, max 5 selected.
- "Skip for now"

**Recommendation matrix** (sunlight `unknown` is treated as `some`):

| Space ↓ / Sunlight → | bright | some | shade |
|---|---|---|---|
| balcony | herbs | herbs | houseplants |
| indoors | houseplants | houseplants | houseplants |
| balcony + indoors | herbs | herbs | houseplants |
| unknown | herbs | herbs | houseplants |

Flowers are never the pre-selected default (they need full sun and are less forgiving). They can always be chosen.

**City detection:**
- `GET /api/v1/geo/guess`, no auth, returns `{ city, country_code } | { city: null }`.
- In production it reads Cloudflare's visitor-location headers (`cf-ipcity`, `cf-ipcountry`; enable Cloudflare's "Add visitor location headers" setting). No third-party call, and no browser location permission.
- In dev and test it returns `{ city: null }`. It must never block the screen; it's fetched in the background from step 2 onwards.
- An edited or typed city is stored with `source: 'user'`. Proper geocoding is still OQ-02 and runs async after setup.

**Data:**
- `packId: string | null`
- `customPlantIds: string[]` (only when choosing plants manually)
- `location: { raw, city, countryCode, source: 'ip' | 'user' } | null`

**Analytics:**
- `starter_pack_selected {pack_name, recommended: boolean}`, or `{custom: true, count}`.
- `onboarding_step_completed {step: 4, time_on_step}`.

**Acceptance:**
- The screen renders instantly with the recommendation; the pack catalogue is bundled or CDN-cached.
- The location chip appears when the guess arrives and never shifts the layout.

## Step 5 — Meet your plant
**Goal:** create attachment, and find out whether day-1 tasks should be care or buying.

**Content:**
- Headline: **"Say hi to your [plant]!"** (the first plant in the pack)
- Plant card: emoji, name, "Tap to give it a nickname" (inline, max 32 chars), and care chips: 💧 "Water every 2 days", ☀️ "Bright indirect light", 🌱 "Beginner friendly".
- Question: **"Do you have these plants yet?"**, as two radio cards:
  - **"Yes, they're here"**
  - **"Not yet — I'm getting them"**
- CTA: **"Save my garden"** → step 6, or setup directly if already signed in.
- "Skip for now"

**Default:** **none**. The CTA stays disabled until the user answers. This is a deliberate exception to "every screen has a default": guessing wrong makes day 1 either tell the user to water plants they don't have, or tell them to buy plants they already own. Either breaks trust. (Skip uses "not yet", which is the harmless option.)

**Data:**
- `nickname: string | null` (first plant only)
- `plantsOwned: boolean`

**Analytics:** `onboarding_step_completed {step: 5, plants_owned, has_nickname, time_on_step}`.

**Acceptance:**
- The care schedule is shown, not editable.
- The nickname is saved when the field loses focus or on Enter, and clears with Esc.

## Step 6 — Save your garden (sign-up)
**Goal:** create the account at the moment the user has something to lose.

**Content:** reuses the built `SignUp` / `VerifyCode` components with new copy:
- Headline: **"Your garden is ready 🌱"**
- Sub: "Save it so we can remind you when your plants need you."
- Google button (+ One Tap), "or", email field, **"Continue with email"**, hint "We'll email you a 6-digit code — no password needed."
- Code screen: unchanged ("Check your email", auto-submit, resend after 30s).

**Name:**
- Google provides the first name.
- Email users are **not** asked in onboarding; the greeting falls back to "Good morning 🌱". A name can be added in settings later. (One less field at the highest-drop-off step.)

**After sign-in:** the client calls `POST /onboarding/setup` with the local answers, then goes to step 7. If the response is `409 garden_exists` (a returning user who went through steps 2–5 again), the client discards the local answers and routes to `homeRoute()`.

**Analytics:** `onboarding_step_completed {step: 6, method: 'google' | 'email', is_new_user}`. This replaces the current step 1 event.

**Acceptance:**
- All existing sign-up tests pass at the new route.
- A 409 from setup never shows an error to the user.

## Step 7 — Reminders
**Goal:** get notification permission, with the user choosing when reminders arrive.

**Content (dark screen, as in the mockups):**
- Headline: **"Never forget to water again"**
- Sub: "We'll send one reminder a day, only when a plant needs you."
- Time picker: "Remind me at **8:00 AM**" (native `<input type="time">`, 15-minute steps). The timezone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Notification preview card: "Sproutly — Time to water your basil".
- CTA: **"Turn on reminders"** → browser permission → push subscription.
- Ghost CTA: "Maybe later"
- If the browser has no Web Push (Safari < 16.4): hide the permission CTA and show "We'll remind you in the app instead." with CTA "Sounds good".

**Data:**
- `PATCH /users/me/reminders {reminder_time, timezone}`
- `POST /notifications/permission {status, subscription?}` (per the original tech spec)
- Then `onboarding_step = 7`.

**Rules:** if denied, record it, carry on, show the in-app bell, and ask again after 7 days. No penalty copy.

**Analytics:** `notification_permission_granted | notification_permission_denied {browser, os, reminder_time}`, then `onboarding_step_completed {step: 7}`.

## Step 8 — Your first win
**Goal:** the user completes one real task inside onboarding. This is the "I can do this" moment, and it directly targets day-1 task completion.

**Content (dashboard layout):**
- Greeting: "Good morning, [name]" / "Good morning 🌱"
- Sub: "[N] plants are counting on you"
- A highlighted **first task** card with a "Try it now · 30 seconds" label:
  - Owned plants: "Check if [plant]'s soil is dry" (hint: "Push a finger in up to the first knuckle. Dry? Give it water.")
  - Not owned: "Pick up your [plant]" (hint: "Look for firm green leaves and no yellow spots.")
- The rest of today's and tomorrow's tasks.
- One amber "Quick tip" card (2 sentences max).
- Ticking the first task: strike-through animation, then the confetti banner **"Your first win! 🌱 Your garden is off to a great start."** (auto-dismisses after 4s).

**Data:**
- On render: `PATCH /users/me/onboarding {onboarding_done: true}`, and the onboarding store is cleared.
- Ticking a task: `PATCH /tasks/:id {done: true}`.
- For not-owned plants, completing "Pick up your [plant]" creates the first watering task for the next day.

**Analytics:** `onboarding_completed {total_time_ms}` on render; `first_task_completed {in_onboarding: true, task_type}` on tick.

**Acceptance:** leaving without ticking still completes onboarding. The first task stays at the top of the dashboard until it's done.

---

## New API
| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /geo/guess` | none | IP-based city guess from Cloudflare headers; `{city: null}` otherwise |
| `POST /onboarding/setup` | required | Saves steps 2–5 in **one transaction**: user profile fields, garden, garden plants, initial tasks; sets `onboarding_step = 6` |
| `PATCH /users/me/reminders` | required | `reminder_time`, `timezone` |
| `PATCH /users/me/onboarding` | required | `onboarding_step` (increment only) / `onboarding_done` |
| `PATCH /tasks/:id` | required | Mark a task done |

**`POST /onboarding/setup`**

Request body:
```json
{
  "space_types": ["balcony"],
  "sunlight": "unknown",
  "location": { "raw": "Bengaluru", "city": "Bengaluru", "country_code": "IN", "source": "ip" },
  "pack_id": "easy-balcony-herbs",
  "custom_plant_ids": [],
  "first_plant_nickname": "Basil Brush",
  "plants_owned": true,
  "timezone": "Asia/Kolkata"
}
```
- Exactly one of `pack_id` or a non-empty `custom_plant_ids` (max 5) is required.
- `location` may be null.
- Response: `{ garden_id, plants: [...], first_task: {...}, onboarding_step: 6 }`.
- `409 garden_exists` if the user already has a garden. This makes the call idempotent across retries and returning users.

**Initial tasks:**
- **Owned:**
  - "Check if the soil is dry" for the first plant (due today, marked `is_first_task`).
  - Watering tasks for all plants from today and tomorrow, following each plant's `water_every_days`.
- **Not owned:**
  - "Pick up your [plant]" for each plant (due today; the first one is `is_first_task`).
  - Watering starts once a plant's buy task is done.

## Data model changes (next migration)
- **`users`:**
  - Add `sunlight TEXT CHECK (sunlight IN ('bright','some','shade','unknown'))`, `reminder_time TIME NOT NULL DEFAULT '08:00'`, `timezone TEXT`, `location_source TEXT CHECK (location_source IN ('ip','user'))`.
  - `space_types` values limited to `balcony`, `indoors`, `unknown`.
  - New users start at `onboarding_step = 0`.
- **`plants`:** `id (slug)`, `name`, `emoji`, `light ('full_sun'|'partial'|'shade')`, `water_every_days`, `difficulty`, `care_card JSONB`.
- **`packs`:** `id (slug)`, `name`, `emoji`, `description`, `min_light`. Join table **`pack_plants`** (`pack_id`, `plant_id`, `position`).
- **`gardens`:** as in the tech spec, one per user in v1 (`UNIQUE (user_id)`).
- **`garden_plants`:** as in the tech spec, plus `owned BOOLEAN NOT NULL`.
- **`tasks`:** `id`, `garden_plant_id`, `type ('water'|'check_soil'|'buy')`, `due_date DATE`, `is_first_task BOOLEAN`, `completed_at TIMESTAMPTZ`.

## Analytics summary
| Event | When | Properties (in addition to user/session/time) |
|---|---|---|
| `onboarding_started` | Step 1 first view per attempt | — |
| `onboarding_step_completed` | Each CTA on steps 2–7 | `step`, `time_on_step`, plus the step's answer (see each step) |
| `onboarding_skipped` | "Skip for now" | `step` |
| `starter_pack_selected` | Step 4 CTA | `pack_name`, `recommended` / `custom`, `count` |
| `notification_permission_granted` / `notification_permission_denied` | Step 7 | `browser`, `os`, `reminder_time` |
| `onboarding_completed` | Step 8 render | `total_time_ms` |
| `first_task_completed` | First task ticked | `in_onboarding`, `task_type` |

**Experiment for later:** sign-up at step 6 (v2) vs step 1, measured on onboarding completion and day-3 retention.

## Changes to what's already built
- Move `SignUp` / `VerifyCode` from `/onboarding/1` to `/onboarding/6` (and add `/signin`). Update the copy per step 6.
- `homeRoute()` in `apps/web/src/stores/auth.ts` follows the step-number mapping above.
- `NEW_USER_STEP` goes from `1` to `0` in `apps/api/src/auth/users.ts`.
- The analytics step number for sign-up changes from 1 to 6. Update the web and E2E tests to match.
