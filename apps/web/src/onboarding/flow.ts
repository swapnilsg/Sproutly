/** Onboarding v2 question steps (2–5). See docs/onboarding_v2_spec.md. */

export type SpaceType = 'balcony' | 'indoors' | 'unknown';
export type Sunlight = 'bright' | 'some' | 'shade' | 'unknown';

/** What "Skip for now" fills in for unanswered questions. Grows as steps 4–5 ship. */
export const STEP_DEFAULTS: { spaceTypes: SpaceType[]; sunlight: Sunlight } = {
  spaceTypes: ['balcony'],
  sunlight: 'unknown',
};

/** Multi-select with one exclusive option: "Not sure yet" clears the others, and vice versa. */
export function toggleSpace(current: SpaceType[], id: SpaceType): SpaceType[] {
  if (id === 'unknown') return current.includes('unknown') ? [] : ['unknown'];
  if (current.includes(id)) return current.filter((x) => x !== id);
  return [...current.filter((x) => x !== 'unknown'), id];
}

const QUESTION_STEPS = [2, 3, 4, 5];
/** Question steps that are built, in order. Add 4 and 5 here as they ship. */
const BUILT_QUESTION_STEPS = [2, 3];
const SAVE_GARDEN_ROUTE = '/onboarding/6';

/**
 * Where signed-in users (no garden yet) go once the built questions run out.
 * Interim until steps 4–5 and `POST /onboarding/setup` exist: the first unbuilt question's placeholder.
 */
function signedInFallback(): string {
  const unbuilt = QUESTION_STEPS.find((s) => !BUILT_QUESTION_STEPS.includes(s)) ?? 5;
  return `/onboarding/${unbuilt}`;
}

/**
 * Where to go after answering a question step.
 * Guests run through the built questions, then save their garden (sign-up, step 6).
 * Signed-in users without a garden skip step 6.
 */
export function nextAfter(step: number, signedIn: boolean): string {
  const next = BUILT_QUESTION_STEPS.find((s) => s > step);
  if (next) return `/onboarding/${next}`;
  return signedIn ? signedInFallback() : SAVE_GARDEN_ROUTE;
}

/** "Skip for now" jumps past every remaining question (spec: straight to Save your garden). */
export function skipRoute(signedIn: boolean): string {
  return signedIn ? signedInFallback() : SAVE_GARDEN_ROUTE;
}
