// The Jev question set. Pure data so the browser adapter and the server
// share one definition. State carries the facts, including a computed
// `how_it_feels_to_a_runner`; questions carry the judgment and the ranges
// runners actually dress by. One Choice per body zone, a Noul for each
// extra (several can apply at once).

import type { JsonValue } from '@typesafe-ai/sdk'

type Criteria = Record<string, string>

export interface JevChoice {
  type: 'choice'
  instructions: string
  criteria: Criteria
}
export interface JevNoul {
  type: 'noul'
  instructions: string
  criteria: { true: string; false: string }
}
export type JevQuestion = JevChoice | JevNoul

/** What the server receives per candidate run. Built by ./state.ts. */
export type JevState = { [key: string]: JsonValue }

/**
 * How to read the state, sent once in the state rather than repeated in
 * every question (tokens are the cost).
 */
export const DRESSING_GUIDE =
  'Dress for the whole run by `feel`, which already includes wind chill, sun, rain and humidity. ' +
  'Runners make their own heat. Use `start` and `finish` for changes during the run.'

export const ZONE_QUESTIONS = {
  head: {
    type: 'choice',
    instructions: 'What should this runner wear on their head?',
    criteria: {
      none: 'Nothing: `feel.coldest_f` is 42°F or warmer, `feel.wet_0_to_1` under 0.5 and `feel.sun_0_to_1` under 0.4',
      cap: 'Brimmed cap: `feel.wet_0_to_1` 0.5+ with `feel.coldest_f` 34°F+, or `feel.sun_0_to_1` 0.4+ with `feel.warmest_f` 50-74°F',
      visor: 'Visor: `feel.sun_0_to_1` 0.4+ with `feel.warmest_f` 72°F or hotter',
      headband: 'Ear-covering headband: `feel.coldest_f` is 30-42°F, cold ears but a hat would overheat',
      beanie: 'Warm beanie: `feel.coldest_f` is below 30°F',
    },
  },
  eyes: {
    type: 'choice',
    instructions: 'Should this runner wear sunglasses?',
    criteria: {
      none: 'No sunglasses: dark, or heavy overcast with a UV index under 2',
      sunglasses: 'Sunglasses: daylight with sun, a UV index of 2 or more, or snow glare',
    },
  },
  top: {
    type: 'choice',
    instructions: 'Which top should this runner wear?',
    criteria: {
      singlet: 'Singlet: `feel.overall_f` is 70°F or warmer',
      tee: 'Short-sleeve tee: `feel.overall_f` is 55-70°F',
      'long-sleeve': 'Long-sleeve shirt: `feel.overall_f` is 40-55°F',
      'long-sleeve-vest': 'Long sleeve plus a vest: `feel.overall_f` is 22-40°F, or 40-45°F with a strong wind',
      jacket: 'Insulated running jacket: `feel.overall_f` is below 22°F',
      'rain-shell': 'Rain shell: steady rain or heavy drizzle when `feel.overall_f` is 34-64°F; above that, just get wet',
    },
  },
  bottom: {
    type: 'choice',
    instructions: 'Which bottoms should this runner wear?',
    criteria: {
      shorts: 'Shorts: `feel.overall_f` is 42°F or warmer',
      'half-tights': 'Half tights: `feel.overall_f` is 36-42°F',
      tights: 'Full tights: `feel.overall_f` is 18-36°F',
      'tights-shorts': 'Tights with shorts over them: `feel.overall_f` is below 18°F, or below 25°F with a strong wind',
    },
  },
  hands: {
    type: 'choice',
    instructions: 'What should this runner wear on their hands?',
    criteria: {
      none: 'Nothing: `feel.coldest_f` is 42°F or warmer (45°F in a strong wind)',
      'light-gloves': 'Light gloves: `feel.coldest_f` is 20-42°F',
      mittens: 'Mittens: `feel.coldest_f` is below 20°F, or below 25°F with a strong wind',
    },
  },
} satisfies Record<string, JevChoice>

export const EXTRA_QUESTIONS = {
  sunscreen: {
    type: 'noul',
    instructions: 'Should this runner put on sunscreen before this run?',
    criteria: {
      true: 'The run is in daylight and the UV index reaches 3 or more during it',
      false: 'Dark, or the UV index stays under 3',
    },
  },
  'neck-gaiter': {
    type: 'noul',
    instructions: 'Would a neck gaiter make this run meaningfully more comfortable?',
    criteria: {
      true: '`feel.coldest_f` is below 22°F, or below 30°F with a strong wind',
      false: 'Warmer than that: a gaiter would be unnecessary or too hot',
    },
  },
} satisfies Record<string, JevNoul>

export function jevQuestions(): Record<string, JevQuestion> {
  return { ...ZONE_QUESTIONS, ...EXTRA_QUESTIONS }
}
