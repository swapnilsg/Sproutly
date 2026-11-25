/**
 * Sproutly's plant catalogue: the one source of truth for plants and starter packs.
 * The web app bundles it (step 4 renders instantly) and the API syncs it into Postgres.
 */

/** How much light a plant needs, from least to most. */
export type Light = 'shade' | 'partial' | 'full_sun';
export type SpaceType = 'balcony' | 'indoors' | 'unknown';
export type Sunlight = 'bright' | 'some' | 'shade' | 'unknown';

export interface Plant {
  id: string;
  name: string;
  emoji: string;
  light: Light;
  waterEveryDays: number;
  difficulty: 'beginner';
  /** Plain-English care chips for the plant card. */
  care: { water: string; light: string };
  /** One or two sentences for the Quick tip card. */
  tip: string;
}

export interface Pack {
  id: string;
  name: string;
  emoji: string;
  /** Short plant list shown under the pack name. */
  description: string;
  plantIds: string[];
  /** The least light every plant in the pack can live with. */
  minLight: Light;
}

export const PLANTS: Plant[] = [
  // Easy balcony herbs
  {
    id: 'basil',
    name: 'Basil',
    emoji: '🌿',
    light: 'partial',
    waterEveryDays: 2,
    difficulty: 'beginner',
    care: { water: 'Water every 2 days', light: 'Loves bright light' },
    tip: 'Basil loves warmth. Keep it away from cold windowsills at night.',
  },
  {
    id: 'mint',
    name: 'Mint',
    emoji: '🍃',
    light: 'partial',
    waterEveryDays: 2,
    difficulty: 'beginner',
    care: { water: 'Water every 2 days', light: 'Happy in some sun' },
    tip: 'Mint spreads fast, so give it its own pot. Pinch the tips to keep it bushy.',
  },
  {
    id: 'chives',
    name: 'Chives',
    emoji: '🌱',
    light: 'partial',
    waterEveryDays: 3,
    difficulty: 'beginner',
    care: { water: 'Water every 3 days', light: 'Happy in some sun' },
    tip: 'Snip chives from the outside first. They grow back within a couple of weeks.',
  },
  // Beginner houseplants
  {
    id: 'pothos',
    name: 'Pothos',
    emoji: '🪴',
    light: 'shade',
    waterEveryDays: 7,
    difficulty: 'beginner',
    care: { water: 'Water once a week', light: 'Fine in low light' },
    tip: 'Pothos droops a little when it is thirsty. It perks up within hours of a drink.',
  },
  {
    id: 'snake-plant',
    name: 'Snake plant',
    emoji: '🪴',
    light: 'shade',
    waterEveryDays: 14,
    difficulty: 'beginner',
    care: { water: 'Water every 2 weeks', light: 'Fine in low light' },
    tip: 'Snake plants hate wet feet. Let the soil dry out completely between drinks.',
  },
  {
    id: 'peace-lily',
    name: 'Peace lily',
    emoji: '🌼',
    light: 'shade',
    waterEveryDays: 5,
    difficulty: 'beginner',
    care: { water: 'Water every 5 days', light: 'Fine in low light' },
    tip: 'Peace lilies wilt dramatically when dry. Water it and it bounces back the same day.',
  },
  // Balcony flowers
  {
    id: 'petunia',
    name: 'Petunias',
    emoji: '🌸',
    light: 'full_sun',
    waterEveryDays: 2,
    difficulty: 'beginner',
    care: { water: 'Water every 2 days', light: 'Needs full sun' },
    tip: 'Pinch off faded flowers and petunias keep blooming all season.',
  },
  {
    id: 'marigold',
    name: 'Marigolds',
    emoji: '🌻',
    light: 'full_sun',
    waterEveryDays: 3,
    difficulty: 'beginner',
    care: { water: 'Water every 3 days', light: 'Needs full sun' },
    tip: 'Marigolds keep some pests away from nearby herbs. Water the soil, not the flowers.',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    emoji: '🪻',
    light: 'full_sun',
    waterEveryDays: 5,
    difficulty: 'beginner',
    care: { water: 'Water every 5 days', light: 'Needs full sun' },
    tip: 'Lavender likes to dry out between drinks. Too much water is the usual problem.',
  },
  // Extra easy plants for "Choose my own plants"
  {
    id: 'spider-plant',
    name: 'Spider plant',
    emoji: '🌿',
    light: 'shade',
    waterEveryDays: 5,
    difficulty: 'beginner',
    care: { water: 'Water every 5 days', light: 'Fine in low light' },
    tip: 'Spider plants grow baby plants on long stems. Pot them up to grow new ones.',
  },
  {
    id: 'zz-plant',
    name: 'ZZ plant',
    emoji: '🪴',
    light: 'shade',
    waterEveryDays: 14,
    difficulty: 'beginner',
    care: { water: 'Water every 2 weeks', light: 'Fine in low light' },
    tip: 'ZZ plants store water in their roots. Forgetting to water is almost a feature.',
  },
  {
    id: 'aloe-vera',
    name: 'Aloe vera',
    emoji: '🌵',
    light: 'partial',
    waterEveryDays: 14,
    difficulty: 'beginner',
    care: { water: 'Water every 2 weeks', light: 'Likes bright light' },
    tip: 'Aloe is a succulent, so let the soil dry out fully. Plump leaves mean it is happy.',
  },
  {
    id: 'parsley',
    name: 'Parsley',
    emoji: '🌿',
    light: 'partial',
    waterEveryDays: 2,
    difficulty: 'beginner',
    care: { water: 'Water every 2 days', light: 'Happy in some sun' },
    tip: 'Cut parsley stems from the base. New leaves grow from the middle.',
  },
  {
    id: 'cherry-tomato',
    name: 'Cherry tomato',
    emoji: '🍅',
    light: 'full_sun',
    waterEveryDays: 1,
    difficulty: 'beginner',
    care: { water: 'Water every day', light: 'Needs full sun' },
    tip: 'Tomatoes are thirsty in summer. Water deeply in the morning, not the evening.',
  },
  {
    id: 'rosemary',
    name: 'Rosemary',
    emoji: '🌿',
    light: 'full_sun',
    waterEveryDays: 4,
    difficulty: 'beginner',
    care: { water: 'Water every 4 days', light: 'Needs full sun' },
    tip: 'Rosemary prefers to stay on the dry side. Let the top of the soil dry first.',
  },
];

export const PACKS: Pack[] = [
  {
    id: 'herbs',
    name: 'Easy balcony herbs',
    emoji: '🌿',
    description: 'Basil, mint, chives — hard to kill',
    plantIds: ['basil', 'mint', 'chives'],
    minLight: 'partial',
  },
  {
    id: 'houseplants',
    name: 'Beginner houseplants',
    emoji: '🪴',
    description: 'Pothos, snake plant, peace lily',
    plantIds: ['pothos', 'snake-plant', 'peace-lily'],
    minLight: 'shade',
  },
  {
    id: 'flowers',
    name: 'Balcony flowers',
    emoji: '🌸',
    description: 'Petunias, marigolds, lavender',
    plantIds: ['petunia', 'marigold', 'lavender'],
    minLight: 'full_sun',
  },
];

/** Most plants you can pick by hand in onboarding. */
export const MAX_CUSTOM_PLANTS = 5;

const LIGHT_ORDER: Light[] = ['shade', 'partial', 'full_sun'];

/** The light a spot actually gets. "Not sure" is treated as some sun (spec). */
export function availableLight(sunlight: Sunlight): Light {
  if (sunlight === 'bright') return 'full_sun';
  if (sunlight === 'shade') return 'shade';
  return 'partial';
}

function lightFits(needed: Light, available: Light): boolean {
  return LIGHT_ORDER.indexOf(needed) <= LIGHT_ORDER.indexOf(available);
}

export function getPlant(id: string): Plant | undefined {
  return PLANTS.find((p) => p.id === id);
}

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

/**
 * The spec's recommendation matrix: indoors-only spaces or shade get houseplants;
 * everything else gets herbs. Flowers are never the default.
 */
export function recommendPack(spaceTypes: SpaceType[], sunlight: Sunlight): Pack {
  const indoorsOnly = spaceTypes.length > 0 && spaceTypes.every((s) => s === 'indoors');
  const id = indoorsOnly || availableLight(sunlight) === 'shade' ? 'houseplants' : 'herbs';
  return getPack(id)!;
}

/** True when the pack needs more light than the spot gets. */
export function needsMoreSun(pack: Pack, sunlight: Sunlight): boolean {
  return !lightFits(pack.minLight, availableLight(sunlight));
}

/** Plants that will cope with the spot's light, for "Choose my own plants". */
export function plantsForLight(sunlight: Sunlight): Plant[] {
  const available = availableLight(sunlight);
  return PLANTS.filter((p) => lightFits(p.light, available));
}
