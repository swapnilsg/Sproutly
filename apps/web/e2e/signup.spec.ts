import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import pg from 'pg';
import { E2E } from './env';
import { expect, latestCode, test, uniqueEmail } from './fixtures';

/** Steps 2–5 with the default answers (balcony, not sure, herbs), then "Save my garden". */
async function answerQuestions(page: Page, { owned = true } = {}) {
  await expect(page.getByRole('heading', { name: 'Where will your plants live?' })).toBeVisible();
  await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
  await expect(page.getByRole('heading', { name: 'How sunny is that spot?' })).toBeVisible();
  await page.getByRole('button', { name: 'Show me plants that fit' }).click();
  await expect(page.getByRole('heading', { name: 'Start with a bundle?' })).toBeVisible();
  await page.getByRole('button', { name: 'Add these to my garden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Say hi to your/ })).toBeVisible();
  await page.getByRole('radio', { name: owned ? /^Yes, they’re here/ : /^Not yet/ }).check();
  await page.getByRole('button', { name: 'Save my garden' }).click();
}

/**
 * New user: Welcome → "Start my garden" → steps 2–5 → Save your garden → email.
 * Returning user: Welcome → "I already have an account" → email.
 */
async function requestCode(
  page: Page,
  email: string,
  entry = 'Start my garden',
  { owned = true } = {},
) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await page.getByRole('link', { name: entry }).click();
  if (entry === 'Start my garden') await answerQuestions(page, { owned });
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
}

/** The saved garden for `email`, straight from the E2E database. */
async function gardenFor(email: string) {
  const db = new pg.Client({ connectionString: E2E.databaseUrl });
  await db.connect();
  try {
    const { rows } = await db.query(
      `SELECT gp.plant_id, gp.owned, t.type, t.is_first_task, u.sunlight, u.onboarding_step
       FROM users u
       JOIN gardens g ON g.user_id = u.id
       JOIN garden_plants gp ON gp.garden_id = g.id
       JOIN tasks t ON t.garden_plant_id = gp.id
       WHERE u.email = $1
       ORDER BY gp.position`,
      [email],
    );
    return rows;
  } finally {
    await db.end();
  }
}

/** After sign-up the garden is saved and the user moves on to reminders (step 7). */
async function expectOnStep7(page: Page) {
  await expect(page).toHaveURL(/\/onboarding\/7$/);
  await expect(page.getByRole('heading', { name: 'Never forget to water again' })).toBeVisible();
}

/** Finishes step 7 with "Maybe later" and lands on step 8 (still a placeholder, with Log out). */
async function skipReminders(page: Page) {
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page).toHaveURL(/\/onboarding\/8$/);
}

/** One user's reminder settings and push subscriptions, straight from the E2E database. */
async function remindersFor(email: string) {
  const db = new pg.Client({ connectionString: E2E.databaseUrl });
  await db.connect();
  try {
    const { rows } = await db.query(
      `SELECT to_char(u.reminder_time, 'HH24:MI') AS reminder_time, u.notif_permission,
              u.onboarding_step, count(s.id)::int AS subscriptions
       FROM users u LEFT JOIN push_subscriptions s ON s.user_id = u.id
       WHERE u.email = $1
       GROUP BY u.id`,
      [email],
    );
    return rows[0];
  } finally {
    await db.end();
  }
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary}`),
    ),
  ).toEqual([]);
}

test('new user answers, signs up, and their garden is saved', async ({ page, redis }) => {
  const email = uniqueEmail('new');
  await requestCode(page, email);
  await expect(page.getByText(email)).toBeVisible();

  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);
  expect(await gardenFor(email)).toEqual([
    {
      plant_id: 'basil',
      owned: true,
      type: 'check_soil',
      is_first_task: true,
      sunlight: 'unknown',
      onboarding_step: 6,
    },
    {
      plant_id: 'mint',
      owned: true,
      type: 'water',
      is_first_task: false,
      sunlight: 'unknown',
      onboarding_step: 6,
    },
    {
      plant_id: 'chives',
      owned: true,
      type: 'water',
      is_first_task: false,
      sunlight: 'unknown',
      onboarding_step: 6,
    },
  ]);
  // Saved, so nothing is left behind in the browser.
  const stored = await page.evaluate(() => localStorage.getItem('sproutly_onboarding_v1'));
  expect(JSON.parse(stored!).state).toMatchObject({ spaceTypes: null, packId: null });
});

test('plants not bought yet start with "pick up" tasks', async ({ page, redis }) => {
  const email = uniqueEmail('notyet');
  await requestCode(page, email, 'Start my garden', { owned: false });
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);
  const garden = await gardenFor(email);
  expect(garden.map((r) => [r.owned, r.type])).toEqual([
    [false, 'buy'],
    [false, 'buy'],
    [false, 'buy'],
  ]);
});

test('session survives a reload without storing the token', async ({ page, redis }) => {
  const email = uniqueEmail('reload');
  await requestCode(page, email);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);

  await page.reload();
  await expectOnStep7(page);

  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(stored).not.toMatch(/eyJ/); // no JWT in localStorage
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'sproutly_rt')?.httpOnly).toBe(true);
});

test('wrong code shows a friendly error, right code still works', async ({ page, redis }) => {
  const email = uniqueEmail('wrong');
  await requestCode(page, email);
  const code = await latestCode(redis, email);
  const wrong = code === '000000' ? '111111' : '000000';

  await page.getByLabel('Sign-in code').fill(wrong);
  await expect(page.getByRole('alert')).toHaveText("That code didn't match — try again.");
  await page.getByLabel('Sign-in code').fill(code);
  await expectOnStep7(page);
});

test('returning user signs back in after logging out', async ({ page, redis }) => {
  const email = uniqueEmail('returning');
  await requestCode(page, email);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);

  // Log out lives on the placeholder screens for now (step 8 is one).
  await skipReminders(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding\/1$/); // logout really revoked the session

  await redis.del(`dev:outbox:${email}`);
  await requestCode(page, email, 'I already have an account');
  await expect(page).toHaveURL(/\/signin\/code$/);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/8$/); // picks up where they left off
});

test('a returning user who answers the questions again keeps their original garden', async ({
  page,
  redis,
}) => {
  const email = uniqueEmail('again');
  await requestCode(page, email);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);
  await skipReminders(page);
  await page.getByRole('button', { name: 'Log out' }).click();

  // Same person, new answers (plants not owned this time), same email.
  await redis.del(`dev:outbox:${email}`);
  await requestCode(page, email, 'Start my garden', { owned: false });
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/8$/);
  const garden = await gardenFor(email);
  expect(garden.map((r) => r.type)).toEqual(['check_soil', 'water', 'water']);
});

test('"Use a different email" goes back with the field editable', async ({ page }) => {
  await requestCode(page, uniqueEmail('change'));
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await expect(page.getByLabel('Email')).toBeEditable();
});

test('answers survive a reload and are saved at sign-up', async ({ page, redis }) => {
  const email = uniqueEmail('space');
  await page.goto('/onboarding/1');
  await page.getByRole('link', { name: 'Start my garden' }).click();

  const tile = (name: RegExp) => page.getByRole('button', { name });
  await tile(/^Indoors/).click();
  await tile(/^Not sure yet/).click();
  await expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(/^Indoors/)).toHaveAttribute('aria-pressed', 'false');
  await expect(tile(/^Balcony/)).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
  await page.getByRole('radio', { name: /^Mostly shade/ }).check();
  await page.getByRole('button', { name: 'Show me plants that fit' }).click();
  // Shade → houseplants recommended; pick it and continue.
  await expect(page.getByRole('radio', { name: /Beginner houseplants/ })).toBeChecked();
  await page.getByRole('button', { name: 'Add these to my garden' }).click();
  await expect(page).toHaveURL(/\/onboarding\/5$/);

  // Back to step 2 and reload: the answers are still there.
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  await page.reload();
  await expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
  await expect(page.getByRole('radio', { name: /^Mostly shade/ })).toBeChecked();
  await page.getByRole('button', { name: 'Show me plants that fit' }).click();
  await page.getByRole('button', { name: 'Add these to my garden' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Say hi to your pothos!');
  await page.getByRole('button', { name: 'Tap to give it a nickname' }).click();
  await page.getByLabel('Nickname').fill('Leafy');
  await page.getByLabel('Nickname').press('Enter');
  await page.getByRole('radio', { name: /^Yes, they’re here/ }).check();
  await page.getByRole('button', { name: 'Save my garden' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expectOnStep7(page);
  const garden = await gardenFor(email);
  expect(garden.map((r) => r.plant_id)).toEqual(['pothos', 'snake-plant', 'peace-lily']);
  expect(garden[0]).toMatchObject({ sunlight: 'shade' });
});

test('Google sign-in saves the garden', async ({ page }) => {
  // The backend Google and setup paths are covered by API tests; here both calls are stubbed.
  await page.route('**/api/v1/auth/google', (route) =>
    route.fulfill({
      json: {
        token: 'e2e-token',
        user_id: '00000000-0000-0000-0000-000000000001',
        onboarding_step: 0,
        onboarding_done: false,
        is_new_user: true,
      },
    }),
  );
  let setupAuth: string | undefined;
  await page.route('**/api/v1/onboarding/setup', (route) => {
    setupAuth = route.request().headers()['authorization'];
    return route.fulfill({ status: 201, json: {} });
  });
  await page.goto('/onboarding/1');
  await page.getByRole('link', { name: 'Start my garden' }).click();
  await answerQuestions(page);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expectOnStep7(page);
  expect(setupAuth).toBe('Bearer e2e-token');
});

test('welcome, sign-up, sign-in and code screens have no accessibility violations', async ({
  page,
}) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto('/onboarding/1');
  await expect(page.getByRole('heading', { name: 'Keep your first plants alive' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('link', { name: 'Start my garden' }).click();
  await expect(page.getByRole('heading', { name: 'Where will your plants live?' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
  await expect(page.getByRole('heading', { name: 'How sunny is that spot?' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Show me plants that fit' }).click();
  await expect(page.getByRole('heading', { name: 'Start with a bundle?' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Choose my own plants' }).click();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Use a bundle instead' }).click();

  await page.getByRole('button', { name: 'Add these to my garden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Say hi to your/ })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Tap to give it a nickname' }).click();
  await expectNoA11yViolations(page);
  await page.getByLabel('Nickname').press('Escape');
  await page.getByRole('radio', { name: /^Not yet/ }).check();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Save my garden' }).click();
  await expect(page.getByRole('heading', { name: 'Your garden is ready 🌱' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel('Email').fill(uniqueEmail('a11y'));
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('sign-up works with the keyboard alone', async ({ page, redis }) => {
  const email = uniqueEmail('keyboard');
  await page.goto('/onboarding/1');
  await page.getByRole('link', { name: 'Start my garden' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  // Space toggles a tile; Enter on the CTA continues.
  await page.getByRole('button', { name: /^Indoors/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /^Indoors/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'That’s where they’ll live' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/onboarding\/3$/);
  // Arrow keys move the sunlight choice; Enter on the CTA continues.
  await page.getByRole('radio', { name: /^Not sure/ }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('radio', { name: /^Mostly shade/ })).toBeChecked();
  await page.getByRole('button', { name: 'Show me plants that fit' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/onboarding\/4$/);
  // Shade (chosen above) puts houseplants first; arrow keys move the pack choice.
  await expect(page.getByRole('radio', { name: /Beginner houseplants/ })).toBeChecked();
  await page.getByRole('radio', { name: /Beginner houseplants/ }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Easy balcony herbs/ })).toBeChecked();
  await page.getByRole('button', { name: 'Add these to my garden' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/onboarding\/5$/);
  // No default answer on step 5: Space picks one, then Enter on "Save my garden".
  await page.getByRole('radio', { name: /^Yes, they’re here/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: /^Yes, they’re here/ })).toBeChecked();
  await page.getByRole('button', { name: 'Save my garden' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await page.getByLabel('Email').focus();
  await page.keyboard.type(email);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Sign-in code')).toBeFocused();
  await page.keyboard.type(await latestCode(redis, email));
  await expectOnStep7(page);
});

test.describe('step 7 — reminders', () => {
  async function signUpTo7(page: Page, redis: Parameters<typeof latestCode>[0], label: string) {
    const email = uniqueEmail(label);
    await requestCode(page, email);
    await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
    await expectOnStep7(page);
    return email;
  }

  test('turning on reminders stores the time and this browser’s subscription', async ({
    page,
    redis,
    context,
  }) => {
    // Headless Chromium has no push service, so stand in for pushManager.subscribe.
    await context.grantPermissions(['notifications']);
    await page.addInitScript(() => {
      PushManager.prototype.subscribe = async function () {
        return {
          toJSON: () => ({
            endpoint: `https://push.example.com/send/${Math.random().toString(36).slice(2)}`,
            keys: { p256dh: 'BOr1gK8x_3vQ', auth: 'tBHItJI5svbpez7KI4CCXg' },
          }),
        } as unknown as PushSubscription;
      };
    });
    const email = await signUpTo7(page, redis, 'push');
    await expect(page.getByText('Time to water your basil')).toBeVisible();
    await page.getByLabel('Remind me every day at').fill('07:30');
    await page.getByRole('button', { name: 'Turn on reminders' }).click();
    await expect(page).toHaveURL(/\/onboarding\/8$/);
    expect(await remindersFor(email)).toEqual({
      reminder_time: '07:30',
      notif_permission: 'granted',
      onboarding_step: 7,
      subscriptions: 1,
    });
  });

  test('"Maybe later" keeps going without asking the browser', async ({ page, redis }) => {
    const email = await signUpTo7(page, redis, 'later');
    await skipReminders(page);
    expect(await remindersFor(email)).toMatchObject({
      reminder_time: '08:00',
      notif_permission: 'not_asked',
      onboarding_step: 7,
      subscriptions: 0,
    });
  });

  test('browsers without push get in-app reminders instead', async ({ page, redis }) => {
    await page.addInitScript(() => {
      delete (window as { PushManager?: unknown }).PushManager;
    });
    const email = await signUpTo7(page, redis, 'nopush');
    await expect(
      page.getByText(
        'Your browser can’t show notifications, so we’ll remind you in the app instead.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sounds good' }).click();
    await expect(page).toHaveURL(/\/onboarding\/8$/);
    expect(await remindersFor(email)).toMatchObject({ notif_permission: 'unsupported' });
  });

  test('notifications already blocked for the site get in-app reminders, no prompt', async ({
    page,
    redis,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => 'denied',
      });
    });
    const email = await signUpTo7(page, redis, 'blocked');
    await expect(
      page.getByText(
        'Notifications are turned off for Sproutly in this browser, so we’ll remind you in the app instead.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sounds good' }).click();
    await expect(page).toHaveURL(/\/onboarding\/8$/);
    expect(await remindersFor(email)).toMatchObject({ notif_permission: 'denied' });
  });

  test('step 7 has no accessibility violations and works with the keyboard', async ({
    page,
    redis,
  }) => {
    const email = await signUpTo7(page, redis, 'a11y7');
    await expectNoA11yViolations(page);
    // The native time field has hour/minute/AM-PM segments; Tab walks them, then leaves.
    await page.getByLabel('Remind me every day at').focus();
    const cta = page.getByRole('button', { name: 'Turn on reminders' });
    for (let i = 0; i < 5 && !(await cta.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(cta).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Maybe later' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/onboarding\/8$/);
    expect(await remindersFor(email)).toMatchObject({ onboarding_step: 7 });
  });
});
