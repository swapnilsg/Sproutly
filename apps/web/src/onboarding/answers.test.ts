import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOnboarding } from '../stores/onboarding';
import { browserTimeZone, buildSetupBody, resolveGardenPlants } from './answers';

const base = () => ({
  ...useOnboarding.getInitialState(),
  spaceTypes: ['balcony' as const],
  sunlight: 'some' as const,
});

describe('resolveGardenPlants', () => {
  it('uses hand-picked plants in the order picked', () => {
    const { packId, plants } = resolveGardenPlants({
      ...base(),
      customPlantIds: ['pothos', 'mint'],
    });
    expect(packId).toBeNull();
    expect(plants.map((p) => p.id)).toEqual(['pothos', 'mint']);
  });

  it('drops picks that are no longer in the catalogue', () => {
    const { plants } = resolveGardenPlants({ ...base(), customPlantIds: ['retired', 'mint'] });
    expect(plants.map((p) => p.id)).toEqual(['mint']);
  });

  it('falls back to the recommended pack when no saved pick still exists', () => {
    const { packId, plants } = resolveGardenPlants({ ...base(), customPlantIds: ['retired'] });
    expect(packId).toBe('herbs');
    expect(plants.map((p) => p.id)).toEqual(['basil', 'mint', 'chives']);
    expect(
      buildSetupBody({ ...base(), customPlantIds: ['retired'], plantsOwned: true }),
    ).toMatchObject({
      pack_id: 'herbs',
      custom_plant_ids: null,
    });
  });
});

describe('browserTimeZone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the browser timezone when it is usable', () => {
    expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('falls back to UTC when the browser reports something unusable', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Etc/Unknown',
    });
    expect(browserTimeZone()).toBe('UTC');
  });
});
