import type { Decision, ItemId, Recommendation, RunState, Zone } from '../../types'
import type { RecommendationEngine } from '../RecommendationEngine'
import { EXTRA_QUESTIONS, ZONE_QUESTIONS, type JevState } from './questions'
import { jevState } from './state'

// Jev answers every zone as a calibrated distribution. We keep the whole
// distribution: presence comes from how much mass sits off "none", and the
// runners-up ride along as alternatives.
//
// Cost is per question asked, so Jev is only asked about runs someone
// settles on, one at a time, and every answer is cached on the device keyed
// by the exact question. The server keeps its own cache too, shared by
// everyone asking about the same place and time.

interface ChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}
interface NoulAnswer {
  type: 'noul'
  noul: number
}
type Answers = Record<string, ChoiceAnswer | NoulAnswer>

/** Zones where going without is a real option. The rest always get an item. */
const OPTIONAL_ZONES = new Set<Zone>(['head', 'eyes', 'hands'])

function fromChoice(zone: Zone, a: ChoiceAnswer): Decision {
  const ranked = Object.entries(a.probabilities)
    .map(([item, probability]) => ({ item: item as ItemId, probability }))
    .sort((x, y) => y.probability - x.probability)
  const wearable = ranked.filter((r) => r.item !== 'none')
  return {
    zone,
    item: wearable[0].item,
    probability: OPTIONAL_ZONES.has(zone) ? 1 - (a.probabilities.none ?? 0) : 1,
    alternatives: wearable.slice(1),
  }
}

export function toRecommendation(answers: Answers): Recommendation {
  const decisions: Decision[] = []
  for (const zone of Object.keys(ZONE_QUESTIONS) as Zone[]) {
    const a = answers[zone]
    if (a?.type === 'choice') decisions.push(fromChoice(zone, a))
  }
  for (const item of Object.keys(EXTRA_QUESTIONS) as ItemId[]) {
    const a = answers[item]
    if (a?.type === 'noul') decisions.push({ zone: 'extras', item, probability: a.noul })
  }
  return { decisions }
}

// ── Device cache: memory, persisted to localStorage ─────────────────────────

const STORE = 'layers.run:jev'
const TTL = 3 * 60 * 60_000
const MAX = 150

type Entry = { at: number; rec: Recommendation }
const cache = new Map<string, Entry>()

try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]') as [string, Entry][]
  for (const [k, e] of saved) if (Date.now() - e.at < TTL) cache.set(k, e)
} catch {
  // Storage blocked or corrupt; start empty
}

function remember(key: string, rec: Recommendation) {
  cache.delete(key)
  cache.set(key, { at: Date.now(), rec })
  while (cache.size > MAX) cache.delete(cache.keys().next().value!)
  try {
    localStorage.setItem(STORE, JSON.stringify([...cache]))
  } catch {
    // Storage full or blocked; the memory cache still works
  }
}

/** The question exactly as Jev will see it doubles as the cache key. */
const keyOf = (state: JevState) => JSON.stringify(state)

// ── Asking ─────────────────────────────────────────────────────────────────

/**
 * Set once the server says Jev isn't configured (no API key), so the app
 * stops asking for the rest of the session and runs on rules.
 */
let unavailable = false
const inFlight = new Map<string, Promise<Recommendation | null>>()

async function ask(state: JevState, key: string): Promise<Recommendation | null> {
  const res = await fetch('/api/jev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ states: [state] }),
  })
  if (!res.ok) throw new Error(`jev ${res.status}`)
  const body = (await res.json()) as { configured?: false; results?: (Answers | null)[] }
  if (body.configured === false || !body.results) {
    unavailable = true
    return null
  }
  const answers = body.results[0]
  if (!answers) return null
  const rec = toRecommendation(answers)
  remember(key, rec)
  return rec
}

export const jevEngine: RecommendationEngine & {
  /** A cached answer for this run, if Jev has already been asked. */
  cached(run: RunState): Recommendation | null
} = {
  id: 'jev',
  cached(run) {
    return cache.get(keyOf(jevState(run)))?.rec ?? null
  },
  async recommend(run) {
    const state = jevState(run)
    const key = keyOf(state)
    const hit = cache.get(key)
    if (hit) return hit.rec.decisions
    if (unavailable) throw new Error('jev: not configured')
    // Two views asking about the same run share one request
    let pending = inFlight.get(key)
    if (!pending) {
      pending = ask(state, key).finally(() => inFlight.delete(key))
      inFlight.set(key, pending)
    }
    const rec = await pending
    if (!rec) throw new Error('jev: no answer')
    return rec.decisions
  },
  available: () => !unavailable,
}
