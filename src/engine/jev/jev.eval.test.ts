import { describe, it } from 'vitest'
import type { Decision, RunState, WeatherSample } from '../../types'
import { feelsLike } from '../../lib/feelsLike'
import { PRESENCE } from '../../lib/wearables'
import { rulesEngine } from '../rulesEngine'
import { jevState } from './state'
import { toRecommendation } from './jevEngine'

// Opt-in evaluation against the real Jev, through the running app's API:
//   JEV_EVAL=1 pnpm test
// It prints each scenario's outfit from the rules and from Jev side by side.
// It asserts nothing: it's for judging answer quality when the questions or
// the model change.

const ENDPOINT = process.env.JEV_URL ?? 'http://localhost:3000/api/jev'

interface Conditions {
  temp: number
  wind?: number
  dew?: number
  cloud?: number
  uv?: number
  rain?: number
  day?: boolean
}

function sample(c: Conditions): WeatherSample {
  const wind = c.wind ?? 5
  const dew = c.dew ?? c.temp - 12
  return {
    time: new Date('2026-09-24T09:00:00'),
    temperature: c.temp,
    apparent: feelsLike(c.temp, wind, dew),
    dewPoint: dew,
    windSpeed: wind,
    windGust: wind * 1.5,
    precipProbability: c.rain ? 90 : 5,
    precipitation: c.rain ?? 0,
    uvIndex: c.uv ?? 0,
    cloudCover: c.cloud ?? 50,
    isDay: c.day ?? true,
    weatherCode: c.rain ? 63 : 2,
  }
}

const SCENARIOS: [string, RunState][] = [
  ['dressmyrun ref 54→60 cloudy breezy', { start: sample({ temp: 54, wind: 11, dew: 48, cloud: 74, uv: 3 }), end: sample({ temp: 60, wind: 11, dew: 48, cloud: 70, uv: 4 }), durationMin: 60 }],
  ['hot sunny humid 86', { start: sample({ temp: 86, dew: 68, cloud: 5, uv: 9 }), end: sample({ temp: 86, dew: 68, cloud: 5, uv: 9 }), durationMin: 60 }],
  ['mild evening 63', { start: sample({ temp: 63, cloud: 30, day: false }), end: sample({ temp: 63, cloud: 30, day: false }), durationMin: 45 }],
  ['cool clear 46', { start: sample({ temp: 46, wind: 6, cloud: 60, uv: 2 }), end: sample({ temp: 46, wind: 6, cloud: 60, uv: 2 }), durationMin: 60 }],
  ['freezing 30', { start: sample({ temp: 30, wind: 6, cloud: 80 }), end: sample({ temp: 30, wind: 6, cloud: 80 }), durationMin: 60 }],
  ['bitter windy 15', { start: sample({ temp: 15, wind: 16, cloud: 90 }), end: sample({ temp: 15, wind: 16, cloud: 90 }), durationMin: 45 }],
  ['cold rain 48', { start: sample({ temp: 48, wind: 10, rain: 0.12, cloud: 100 }), end: sample({ temp: 48, wind: 10, rain: 0.12, cloud: 100 }), durationMin: 60 }],
  ['warm rain 72', { start: sample({ temp: 72, rain: 0.1, cloud: 100, dew: 66 }), end: sample({ temp: 72, rain: 0.1, cloud: 100, dew: 66 }), durationMin: 60 }],
  ['cooling evening 50→38', { start: sample({ temp: 50, cloud: 90, day: false }), end: sample({ temp: 38, wind: 8, cloud: 90, day: false }), durationMin: 90 }],
]

const summary = (ds: Decision[]) =>
  ds
    .filter((d) => d.item !== 'none' && d.probability >= PRESENCE.drop)
    .map((d) => (d.probability < PRESENCE.optional ? `(${d.item})` : d.item))
    .join(', ')

describe.skipIf(!process.env.JEV_EVAL)('Jev vs rules', () => {
  it('prints outfits side by side', { timeout: 60_000 }, async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      // The endpoint only answers the app itself
      headers: { 'content-type': 'application/json', origin: new URL(ENDPOINT).origin },
      body: JSON.stringify({ states: SCENARIOS.map(([, s]) => jevState(s)) }),
    })
    const body = (await res.json()) as { model?: string; results?: unknown[]; configured?: false }
    if (!body.results) throw new Error(`Jev unavailable: ${JSON.stringify(body)}`)
    console.log(`model ${body.model}  (parenthesised = optional)\n`)
    SCENARIOS.forEach(([name, run], i) => {
      const jev = body.results![i] ? toRecommendation(body.results![i] as never).decisions : []
      console.log(`${name}\n  rules: ${summary(rulesEngine.recommend(run) as Decision[])}\n  jev:   ${summary(jev)}\n`)
    })
  })
})
