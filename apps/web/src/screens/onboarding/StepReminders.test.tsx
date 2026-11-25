import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuth } from '../../stores/auth';
import { fakePush, removeFakePush } from '../../test/push';
import { mockApi, renderAt } from '../../test/utils';
import { toQuarterHour } from './StepReminders';

type Call = { path: string; body: unknown };
const event = (calls: Call[], name: string) =>
  calls.find((c) => (c.body as { event_name?: string })?.event_name === name)?.body;
const remindersCall = (calls: Call[]) =>
  calls.find((c) => c.path === '/onboarding/reminders')?.body;

const withGarden = { token: 't', userId: 'u', onboardingStep: 6, onboardingDone: false };
const KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

function api(vapidKey: string | null, remindersStatus = 200) {
  return mockApi({
    '/analytics/events': () => ({ status: 202 }),
    '/notifications/config': () => ({ status: 200, body: { vapid_public_key: vapidKey } }),
    '/users/me/onboarding-state': () => ({ status: 200, body: { first_plant_name: 'Basil' } }),
    '/onboarding/reminders': () =>
      remindersStatus === 200
        ? { status: 200, body: { onboarding_step: 7 } }
        : { status: remindersStatus, body: { error: 'internal_error' } },
  });
}

async function atStep7Ready() {
  api(KEY);
  return atStep7();
}

async function atStep7() {
  const router = renderAt('/onboarding/7', withGarden);
  await screen.findByRole('heading', { name: 'Never forget to water again' });
  return router;
}

describe('Step 7 — reminders', () => {
  afterEach(removeFakePush);

  it('previews tomorrow’s reminder for the user’s own plant at 8:00 by default', async () => {
    fakePush();
    api(KEY);
    await atStep7();
    expect(screen.getByLabelText('Remind me every day at')).toHaveValue('08:00');
    expect(await screen.findByText('Time to water your basil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn on reminders' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Maybe later' })).toBeEnabled();
  });

  it('turns on reminders: subscription and chosen time sent, step 8 next', async () => {
    const push = fakePush();
    const { calls } = api(KEY);
    const router = await atStep7();
    // jsdom can't type into time fields like a browser; set the value directly (E2E types it).
    fireEvent.change(screen.getByLabelText('Remind me every day at'), {
      target: { value: '07:30' },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on reminders' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(push.requestPermission).toHaveBeenCalled();
    expect(remindersCall(calls)).toMatchObject({
      reminder_time: '07:30',
      permission: 'granted',
      subscription: { endpoint: 'https://push.example.com/send/abc' },
      timezone: expect.any(String),
    });
    expect(useAuth.getState().session?.onboardingStep).toBe(7);
    expect(event(calls, 'notification_permission_granted')).toMatchObject({
      properties: { reminder_time: '07:30', browser: expect.any(String), os: expect.any(String) },
    });
  });

  it('records "Block" as denied, with no penalty, and moves on', async () => {
    fakePush({ permission: 'denied' });
    const { calls } = api(KEY);
    const router = await atStep7();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on reminders' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(remindersCall(calls)).toMatchObject({ permission: 'denied', subscription: null });
    expect(event(calls, 'notification_permission_denied')).toBeDefined();
  });

  it('"Maybe later" skips the browser prompt', async () => {
    const push = fakePush();
    const { calls } = api(KEY);
    const router = await atStep7();
    await userEvent.click(await screen.findByRole('button', { name: 'Maybe later' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(push.requestPermission).not.toHaveBeenCalled();
    expect(remindersCall(calls)).toMatchObject({ permission: 'later' });
  });

  it('offers in-app reminders where the browser can’t do push', async () => {
    const { calls } = api(KEY); // no fakePush: jsdom has no Push APIs
    const router = await atStep7();
    expect(
      await screen.findByText(
        'Your browser can’t show notifications, so we’ll remind you in the app instead.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Turn on reminders' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sounds good' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(remindersCall(calls)).toMatchObject({ permission: 'unsupported' });
  });

  it('doesn’t blame the browser when the server has no push keys, and asks again later', async () => {
    fakePush();
    const { calls } = api(null);
    const router = await atStep7();
    expect(
      await screen.findByText(
        'For now we’ll remind you in the app. We’ll ask about notifications another time.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Your browser can’t show notifications/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sounds good' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(remindersCall(calls)).toMatchObject({ permission: 'later' });
  });

  it('shows a friendly error and lets the user try again if saving fails', async () => {
    fakePush();
    api(KEY, 500);
    const router = await atStep7();
    await userEvent.click(await screen.findByRole('button', { name: 'Maybe later' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong — try again.');
    expect(router.state.location.pathname).toBe('/onboarding/7');
    expect(screen.getByRole('button', { name: 'Maybe later' })).toBeEnabled();
  });

  it('keeps a half-typed time while editing, and settles it when leaving the field', async () => {
    fakePush();
    const { calls } = api(KEY);
    await atStep7();
    const input = screen.getByLabelText('Remind me every day at');
    fireEvent.change(input, { target: { value: '' } }); // a segment being retyped
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: '21:10' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('21:15');
    await userEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    await waitFor(() => expect(remindersCall(calls)).toMatchObject({ reminder_time: '21:15' }));
  });

  it('falls back to 8:00 if the field is left empty', async () => {
    fakePush();
    await atStep7Ready();
    const input = screen.getByLabelText('Remind me every day at');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('08:00');
  });

  it('offers in-app reminders when notifications are already blocked, without a fake prompt', async () => {
    const push = fakePush({ current: 'denied' });
    const { calls } = api(KEY);
    const router = await atStep7();
    expect(
      await screen.findByText(
        'Notifications are turned off for Sproutly in this browser, so we’ll remind you in the app instead.',
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sounds good' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/8'));
    expect(push.requestPermission).not.toHaveBeenCalled();
    expect(remindersCall(calls)).toMatchObject({ permission: 'denied' });
    expect(event(calls, 'notification_permission_denied')).toBeUndefined();
  });

  it('is only reachable once the garden is saved', async () => {
    api(KEY);
    const router = renderAt('/onboarding/7', { ...withGarden, onboardingStep: 0 });
    await screen.findByRole('heading', { name: 'Where will your plants live?' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });
});

describe('toQuarterHour', () => {
  it('snaps to the nearest quarter hour and wraps past midnight', () => {
    expect(toQuarterHour('08:00')).toBe('08:00');
    expect(toQuarterHour('07:37')).toBe('07:30');
    expect(toQuarterHour('07:38')).toBe('07:45');
    expect(toQuarterHour('23:55')).toBe('00:00');
    expect(toQuarterHour('')).toBe('08:00');
  });
});
