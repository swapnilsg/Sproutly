import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, latestCode, test, uniqueEmail } from './fixtures';

/**
 * New user: Welcome → "Start my garden" → steps 2–3 (default answers) → Save your garden → email.
 * Returning user: Welcome → "I already have an account" → email.
 */
async function requestCode(page: Page, email: string, entry = 'Start my garden') {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await page.getByRole('link', { name: entry }).click();
  if (entry === 'Start my garden') {
    await expect(page.getByRole('heading', { name: 'Where will your plants live?' })).toBeVisible();
    await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
    await expect(page.getByRole('heading', { name: 'How sunny is that spot?' })).toBeVisible();
    await page.getByRole('button', { name: 'Show me plants that fit' }).click();
  }
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
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

test('new user signs up with an email code and lands on step 2', async ({ page, redis }) => {
  const email = uniqueEmail('new');
  await requestCode(page, email);
  await expect(page.getByText(email)).toBeVisible();

  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  await expect(page.getByRole('heading', { name: 'Where will your plants live?' })).toBeVisible();
});

test('session survives a reload without storing the token', async ({ page, redis }) => {
  const email = uniqueEmail('reload');
  await requestCode(page, email);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Where will your plants live?' })).toBeVisible();

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
  await expect(page).toHaveURL(/\/onboarding\/2$/);
});

test('returning user signs back in after logging out', async ({ page, redis }) => {
  const email = uniqueEmail('returning');
  await requestCode(page, email);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);

  // Log out lives on the placeholder screens for now; step 4 is the next one.
  await page.goto('/onboarding/4');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding\/1$/); // logout really revoked the session

  await redis.del(`dev:outbox:${email}`);
  await requestCode(page, email, 'I already have an account');
  await expect(page).toHaveURL(/\/signin\/code$/);
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);
});

test('"Use a different email" goes back with the field editable', async ({ page }) => {
  await requestCode(page, uniqueEmail('change'));
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await expect(page.getByLabel('Email')).toBeEditable();
});

test('step 2–3 answers survive a reload and sign-up', async ({ page, redis }) => {
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
  await expect(page).toHaveURL(/\/onboarding\/6$/);

  // Back to step 2 and reload: both answers are still there.
  await page.goBack();
  await page.goBack();
  await page.reload();
  await expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'That’s where they’ll live' }).click();
  await expect(page.getByRole('radio', { name: /^Mostly shade/ })).toBeChecked();
  await page.getByRole('button', { name: 'Show me plants that fit' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('Sign-in code').fill(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  const stored = await page.evaluate(() => localStorage.getItem('sproutly_onboarding_v1'));
  expect(JSON.parse(stored!).state).toMatchObject({ spaceTypes: ['unknown'], sunlight: 'shade' });
});

test('Google sign-in saves the garden', async ({ page }) => {
  // The backend Google path is covered by API tests; here the token exchange is stubbed.
  await page.route('**/api/v1/auth/google', (route) =>
    route.fulfill({
      json: {
        token: 'e2e-token',
        user_id: '00000000-0000-0000-0000-000000000001',
        onboarding_step: 1,
        onboarding_done: false,
        is_new_user: true,
      },
    }),
  );
  await page.goto('/onboarding/6');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(/\/onboarding\/2$/);
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
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await page.getByLabel('Email').focus();
  await page.keyboard.type(email);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Sign-in code')).toBeFocused();
  await page.keyboard.type(await latestCode(redis, email));
  await expect(page).toHaveURL(/\/onboarding\/2$/);
});
