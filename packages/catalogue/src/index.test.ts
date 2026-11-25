import { describe, expect, it } from 'vitest';
import {
  getPlant,
  needsMoreSun,
  PACKS,
  PLANTS,
  plantsForLight,
  recommendPack,
  type SpaceType,
  type Sunlight,
} from './index.js';

describe('catalogue data', () => {
  it('has unique plant ids and every pack plant exists', () => {
    const ids = PLANTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pack of PACKS) {
      expect(pack.plantIds).toHaveLength(3);
      for (const id of pack.plantIds) expect(getPlant(id), id).toBeDefined();
    }
  });

  it('keeps tips to two sentences at most', () => {
    for (const plant of PLANTS) {
      expect(plant.tip.split(/[.!?](\s|$)/).filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
    }
  });

  it("sets each pack's minimum light to what its hungriest plant needs", () => {
    const order = ['shade', 'partial', 'full_sun'];
    for (const pack of PACKS) {
      const hungriest = Math.max(...pack.plantIds.map((id) => order.indexOf(getPlant(id)!.light)));
      expect(order[hungriest], pack.id).toBe(pack.minLight);
    }
  });
});

describe('recommendPack (spec matrix)', () => {
  const cases: [SpaceType[], Sunlight, string][] = [
    [['balcony'], 'bright', 'herbs'],
    [['balcony'], 'some', 'herbs'],
    [['balcony'], 'unknown', 'herbs'],
    [['balcony'], 'shade', 'houseplants'],
    [['indoors'], 'bright', 'houseplants'],
    [['indoors'], 'unknown', 'houseplants'],
    [['balcony', 'indoors'], 'some', 'herbs'],
    [['balcony', 'indoors'], 'shade', 'houseplants'],
    [['unknown'], 'unknown', 'herbs'],
    [['unknown'], 'shade', 'houseplants'],
  ];
  it.each(cases)('%j + %s → %s', (spaces, sunlight, expected) => {
    expect(recommendPack(spaces, sunlight).id).toBe(expected);
  });

  it('never recommends flowers', () => {
    const spaces: SpaceType[][] = [['balcony'], ['indoors'], ['unknown'], ['balcony', 'indoors']];
    const suns: Sunlight[] = ['bright', 'some', 'shade', 'unknown'];
    for (const s of spaces)
      for (const l of suns) expect(recommendPack(s, l).id).not.toBe('flowers');
  });
});

describe('needsMoreSun', () => {
  const flowers = PACKS.find((p) => p.id === 'flowers')!;
  const herbs = PACKS.find((p) => p.id === 'herbs')!;
  const houseplants = PACKS.find((p) => p.id === 'houseplants')!;

  it('flags flowers unless the spot gets bright sun', () => {
    expect(needsMoreSun(flowers, 'bright')).toBe(false);
    expect(needsMoreSun(flowers, 'some')).toBe(true);
    expect(needsMoreSun(flowers, 'unknown')).toBe(true);
  });

  it('flags herbs only in shade, and never houseplants', () => {
    expect(needsMoreSun(herbs, 'some')).toBe(false);
    expect(needsMoreSun(herbs, 'shade')).toBe(true);
    expect(needsMoreSun(houseplants, 'shade')).toBe(false);
  });
});

describe('plantsForLight', () => {
  it('offers only shade-tolerant plants for shade', () => {
    expect(plantsForLight('shade').every((p) => p.light === 'shade')).toBe(true);
  });

  it('offers everything for bright sun', () => {
    expect(plantsForLight('bright')).toHaveLength(PLANTS.length);
  });

  it('leaves out full-sun plants when unsure', () => {
    expect(plantsForLight('unknown').some((p) => p.light === 'full_sun')).toBe(false);
  });
});
