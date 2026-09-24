import type { Decision, ItemId, RunState, Zone } from '../types'
import type { RecommendationEngine } from './RecommendationEngine'
import { runFeel, type RunFeel } from '../lib/runFeel'

// The rules. Every zone scores each of its items with soft-edged ranges on
// how the run feels, then normalises the scores into a distribution, the
// same shape Jev returns. Near a threshold two items share the probability,
// which is what makes an item "optional" or earns an "or tee".
//
// The ranges follow what runners actually wear for a given feels-like
// (dress about 15-20°F warmer than it is standing still): a tee from the
// mid 50s, shorts down to the low 40s, gloves under the low 40s, a full
// jacket only when it feels below the low 20s. Feels-like already includes
// wind chill, so these sit a few degrees lower than air-temperature charts.

const SOFT = 2.5

const rise = (x: number, at: number, soft = SOFT) => 1 / (1 + Math.exp(-(x - at) / soft))
/** Soft membership of x in [lo, hi). */
const band = (x: number, lo = -Infinity, hi = Infinity, soft = SOFT) =>
  (lo === -Infinity ? 1 : rise(x, lo, soft)) * (hi === Infinity ? 1 : 1 - rise(x, hi, soft))
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

type Scores = Partial<Record<ItemId, number>>

/** Normalise scores into a ranked distribution. */
function distribution(scores: Scores) {
  const total = Object.values(scores).reduce((a, b) => a + (b ?? 0), 0) || 1
  return (Object.entries(scores) as [ItemId, number][])
    .map(([item, s]) => ({ item, probability: s / total }))
    .sort((a, b) => b.probability - a.probability)
}

/** A zone's decision: the best wearable, how present it is, and runners-up. */
function decide(zone: Zone, scores: Scores, optional: boolean): Decision {
  const ranked = distribution(scores)
  const none = ranked.find((r) => r.item === 'none')?.probability ?? 0
  const wearable = ranked.filter((r) => r.item !== 'none')
  return {
    zone,
    item: wearable[0].item,
    probability: optional ? 1 - none : 1,
    alternatives: wearable.slice(1).filter((r) => r.probability > 0.02),
  }
}

export function scoreZones(f: RunFeel) {
  const windy = clamp01((f.wind - 10) / 8) // 0 at 10 mph, 1 at 18 mph
  const body = f.feel - windy * 3 // a real wind makes layers matter more

  // Top: one garment. A shell wins when it's wet and not warm enough to
  // just get soaked.
  const shell = f.wet * band(body, 34, 64)
  const top: Scores = {
    singlet: band(body, 70),
    tee: band(body, 55, 70),
    'long-sleeve': band(body, 40, 55),
    'long-sleeve-vest': band(body, 22, 40),
    jacket: band(body, -Infinity, 22),
  }
  for (const k of Object.keys(top) as ItemId[]) top[k]! *= 1 - 0.85 * shell
  top['rain-shell'] = shell

  const legs = f.feel - windy * 2
  const bottom: Scores = {
    shorts: band(legs, 42),
    'half-tights': band(legs, 36, 42),
    tights: band(legs, 18, 36),
    'tights-shorts': band(legs, -Infinity, 18),
  }

  // Head: warmth for cold ears, a brim for rain or strong sun
  const brimForRain = f.wet * band(f.coldest, 34)
  const brimForSun = f.sun * band(f.warmest, 50, 74)
  const visor = f.sun * band(f.warmest, 72)
  const head: Scores = {
    beanie: band(f.coldest, -Infinity, 30),
    headband: band(f.coldest, 30, 42),
    cap: Math.max(brimForRain, brimForSun * 0.9),
    visor,
  }
  head.none = Math.max(0.02, band(f.coldest, 42) * (1 - Math.max(head.cap!, visor)))

  // UV 2 makes them worth considering; UV 3 and up, wear them
  const glare = f.daylight ? clamp01(Math.max(f.sun * 1.3, (f.uv - 0.8) / 2, f.snow ? 0.6 : 0)) : 0
  const eyes: Scores = { sunglasses: glare, none: 1 - glare }

  const hands: Scores = {
    mittens: band(f.coldest, -Infinity, 20 + windy * 5),
    'light-gloves': band(f.coldest, 20 + windy * 5, 42 + windy * 3),
    none: band(f.coldest, 42 + windy * 3),
  }

  const sunscreen = f.daylight ? clamp01((f.uv - 2) / 3) : 0
  const gaiter = Math.max(band(f.coldest, -Infinity, 22), band(f.coldest, -Infinity, 30) * windy)

  return { top, bottom, head, eyes, hands, sunscreen, gaiter }
}

export const rulesEngine: RecommendationEngine = {
  id: 'rules',
  recommend(run: RunState) {
    const f = runFeel(run)
    const z = scoreZones(f)
    const round = (d: Decision): Decision => ({ ...d, probability: Math.round(d.probability * 100) / 100 })
    const decisions: Decision[] = [
      decide('head', z.head, true),
      decide('eyes', z.eyes, true),
      decide('top', z.top, false),
      decide('bottom', z.bottom, false),
      decide('hands', z.hands, true),
      { zone: 'extras', item: 'sunscreen', probability: z.sunscreen * (run.durationMin <= 30 ? 0.8 : 1) },
      { zone: 'extras', item: 'neck-gaiter', probability: z.gaiter },
    ]
    return decisions.map(round)
  },
}
