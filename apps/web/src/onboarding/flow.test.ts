import { describe, expect, it } from 'vitest';
import { nextAfter, toggleSpace } from './flow';

describe('toggleSpace', () => {
  it('adds and removes places', () => {
    expect(toggleSpace(['balcony'], 'indoors')).toEqual(['balcony', 'indoors']);
    expect(toggleSpace(['balcony', 'indoors'], 'balcony')).toEqual(['indoors']);
  });

  it('allows deselecting everything', () => {
    expect(toggleSpace(['balcony'], 'balcony')).toEqual([]);
  });

  it('"Not sure yet" clears the other places', () => {
    expect(toggleSpace(['balcony', 'indoors'], 'unknown')).toEqual(['unknown']);
  });

  it('picking a place clears "Not sure yet"', () => {
    expect(toggleSpace(['unknown'], 'indoors')).toEqual(['indoors']);
  });

  it('tapping "Not sure yet" again deselects it', () => {
    expect(toggleSpace(['unknown'], 'unknown')).toEqual([]);
  });
});

describe('nextAfter', () => {
  it('moves through the question steps in order', () => {
    expect(nextAfter(2)).toBe('/onboarding/3');
    expect(nextAfter(3)).toBe('/onboarding/4');
    expect(nextAfter(4)).toBe('/onboarding/5');
  });

  it('has no question after step 5 (finishing saves the garden instead)', () => {
    expect(() => nextAfter(5)).toThrow();
  });
});
