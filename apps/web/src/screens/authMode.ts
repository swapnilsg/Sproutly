/** Sign-up is reached two ways: onboarding step 6 ("Save your garden") and "I already have an account". */
export type AuthMode = 'save' | 'signin';

export const AUTH_MODES: Record<AuthMode, { base: string; title: string; sub: string }> = {
  save: {
    base: '/onboarding/6',
    title: 'Your garden is ready 🌱',
    sub: 'Save it so we can remind you when your plants need you.',
  },
  signin: {
    base: '/signin',
    title: 'Welcome back',
    sub: 'Sign in to see your garden.',
  },
};
