/** Onboarding v2 question steps (2–5). See docs/onboarding_v2_spec.md. */

export type SpaceType = 'balcony' | 'indoors' | 'unknown';

/** What "Skip for now" fills in for unanswered questions. Grows as steps 3–5 ship. */
export const STEP_DEFAULTS: { spaceTypes: SpaceType[] } = {
  spaceTypes: ['balcony'],
};

/** Multi-select with one exclusive option: "Not sure yet" clears the others, and vice versa. */
export function toggleSpace(current: SpaceType[], id: SpaceType): SpaceType[] {
  if (id === 'unknown') return current.includes('unknown') ? [] : ['unknown'];
  if (current.includes(id)) return current.filter((x) => x !== id);
  return [...current.filter((x) => x !== 'unknown'), id];
}

/** Question steps that are built, in order. Add 3, 4 and 5 here as they ship. */
const BUILT_QUESTION_STEPS = [2];
const SAVE_GARDEN_ROUTE = '/onboarding/6';

/**
 * Where to go after finishing (or skipping) a question step.
 * Guests run through the built questions, then save their garden (sign-up, step 6).
 * Signed-in users without a garden skip step 6. Until steps 3–5 and `POST /onboarding/setup`
 * exist they continue to the step 3 placeholder.
 */
export function nextAfter(step: number, signedIn: boolean): string {
  const next = BUILT_QUESTION_STEPS.find((s) => s > step);
  if (next) return `/onboarding/${next}`;
  return signedIn ? `/onboarding/${Math.min(step + 1, 5)}` : SAVE_GARDEN_ROUTE;
}
