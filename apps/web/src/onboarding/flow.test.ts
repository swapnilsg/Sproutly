import { describe, expect, it } from 'vitest';
import { nextAfter, skipRoute, toggleSpace } from './flow';

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
  it('moves through the built question steps', () => {
    expect(nextAfter(2, false)).toBe('/onboarding/3');
    expect(nextAfter(2, true)).toBe('/onboarding/3');
  });

  it('sends guests to Save your garden after the last built question', () => {
    expect(nextAfter(3, false)).toBe('/onboarding/6');
  });

  it('sends signed-in users to the first unbuilt question for now', () => {
    expect(nextAfter(3, true)).toBe('/onboarding/4');
  });
});

describe('skipRoute', () => {
  it('jumps guests straight to Save your garden', () => {
    expect(skipRoute(false)).toBe('/onboarding/6');
  });

  it('jumps signed-in users past the built questions', () => {
    expect(skipRoute(true)).toBe('/onboarding/4');
  });
});
