/** Onboarding v2 question steps (2–5). See docs/onboarding_v2_spec.md. */

import type { SpaceType, Sunlight } from '@sproutly/catalogue';

export type { SpaceType, Sunlight };

/**
 * What "Skip for now" fills in for unanswered questions. Step 4's default is the
 * recommended pack and step 5's is "not yet" (see fillDefaults in the onboarding store).
 */
export const STEP_DEFAULTS: { spaceTypes: SpaceType[]; sunlight: Sunlight } = {
  spaceTypes: ['balcony'],
  sunlight: 'unknown',
};

/**
 * Identifies a set of step 2–3 answers. A pack chosen on step 4 is only kept while the
 * answers it was chosen for stay the same; otherwise step 4 recommends afresh.
 */
export function answersKey(spaceTypes: SpaceType[], sunlight: Sunlight): string {
  return `${[...spaceTypes].sort().join(',')}|${sunlight}`;
}

/** Multi-select with one exclusive option: "Not sure yet" clears the others, and vice versa. */
export function toggleSpace(current: SpaceType[], id: SpaceType): SpaceType[] {
  if (id === 'unknown') return current.includes('unknown') ? [] : ['unknown'];
  if (current.includes(id)) return current.filter((x) => x !== id);
  return [...current.filter((x) => x !== 'unknown'), id];
}

/** The question steps, in order. */
const QUESTION_STEPS = [2, 3, 4, 5];

/**
 * The next question after `step` (steps 2–4). After step 5 there is no next question:
 * use `useFinishQuestions()` (src/onboarding/saveGarden.ts), which also handles "Skip for now".
 */
export function nextAfter(step: number): string {
  const next = QUESTION_STEPS.find((s) => s > step);
  if (!next) throw new Error(`No question after step ${step}`);
  return `/onboarding/${next}`;
}
