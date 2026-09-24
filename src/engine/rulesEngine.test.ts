import { describe, expect, it } from 'vitest'
import type { Decision, ItemId, RunState, WeatherSample, Zone } from '../types'
import { feelsLike } from '../lib/feelsLike'
import { rulesEngine } from './rulesEngine'
import { PRESENCE } from '../lib/wearables'

// Scenario tests: conditions a runner would recognise, and what they'd wear.

interface Conditions {
  temp: number
  wind?: number
  dew?: number
  cloud?: number
  uv?: number
  rain?: number // in/hr
  code?: number
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
    weatherCode: c.code ?? (c.rain ? 63 : 2),
  }
}

function outfit(start: Conditions, end: Conditions = start, durationMin = 60) {
  const run: RunState = { start: sample(start), end: sample(end), durationMin }
  const decisions = rulesEngine.recommend(run) as Decision[]
  const worn = decisions.filter((d) => d.item !== 'none' && d.probability >= PRESENCE.drop)
  const by = (zone: Zone) => worn.filter((d) => d.zone === zone).map((d) => d.item)
  return { worn: worn.map((d) => d.item), by, decisions }
}

const wears = (items: ItemId[], ...expected: ItemId[]) => expected.forEach((i) => expect(items).toContain(i))
const skips = (items: ItemId[], ...unexpected: ItemId[]) => unexpected.forEach((i) => expect(items).not.toContain(i))

describe('rules', () => {
  it('matches the dressmyrun reference: a cloudy, breezy 54→60°F morning', () => {
    const o = outfit({ temp: 54, wind: 11, dew: 48, cloud: 74, uv: 3 }, { temp: 60, wind: 11, dew: 48, cloud: 70, uv: 4 })
    wears(o.worn, 'tee', 'shorts', 'sunglasses')
    skips(o.worn, 'light-gloves', 'mittens', 'beanie', 'neck-gaiter')
  })

  it('hot, sunny and humid: as little as possible, and protect from the sun', () => {
    const o = outfit({ temp: 86, dew: 68, cloud: 5, uv: 9 })
    wears(o.worn, 'singlet', 'shorts', 'sunglasses', 'sunscreen')
    expect(o.by('head')).toEqual(['visor'])
  })

  it('a mild evening: tee and shorts, nothing for the sun', () => {
    const o = outfit({ temp: 63, cloud: 30, day: false })
    wears(o.worn, 'tee', 'shorts')
    skips(o.worn, 'sunglasses', 'sunscreen', 'visor')
  })

  it('cool and clear: long sleeve, still shorts', () => {
    const o = outfit({ temp: 46, wind: 6, cloud: 60, uv: 2 })
    expect(o.by('top')).toEqual(['long-sleeve'])
    expect(o.by('bottom')).toEqual(['shorts'])
  })

  it('freezing: a vest over sleeves, tights, gloves, something for the ears', () => {
    const o = outfit({ temp: 30, wind: 6, cloud: 80 })
    expect(o.by('top')).toEqual(['long-sleeve-vest'])
    expect(o.by('bottom')).toEqual(['tights'])
    wears(o.worn, 'light-gloves')
    expect(['beanie', 'headband']).toContain(o.by('head')[0])
  })

  it('bitter and windy: everything', () => {
    const o = outfit({ temp: 15, wind: 16, cloud: 90 })
    wears(o.worn, 'jacket', 'tights-shorts', 'mittens', 'beanie', 'neck-gaiter')
  })

  it('cold rain: a shell and a brim', () => {
    const o = outfit({ temp: 48, wind: 10, rain: 0.12, cloud: 100 })
    expect(o.by('top')).toEqual(['rain-shell'])
    wears(o.worn, 'cap')
    skips(o.worn, 'sunglasses', 'sunscreen')
  })

  it('warm rain: just get wet', () => {
    const o = outfit({ temp: 72, rain: 0.1, cloud: 100, dew: 66 })
    skips(o.worn, 'rain-shell', 'jacket')
    wears(o.worn, 'shorts')
  })

  it('an evening that cools off: dress for the whole run, gloves for the end', () => {
    const o = outfit({ temp: 50, cloud: 90, day: false }, { temp: 38, wind: 8, cloud: 90, day: false }, 90)
    expect(['long-sleeve', 'long-sleeve-vest']).toContain(o.by('top')[0])
    wears(o.worn, 'light-gloves')
  })

  it('borderline temperatures are optional, not forced', () => {
    // Right at the edge of needing gloves
    const o = outfit({ temp: 44, wind: 5, cloud: 90 })
    const gloves = o.decisions.find((d) => d.zone === 'hands')!
    expect(gloves.probability).toBeGreaterThan(0.25)
    expect(gloves.probability).toBeLessThan(0.75)
  })

  it('always gives a top and a bottom', () => {
    for (const temp of [-5, 20, 40, 55, 70, 95]) {
      const o = outfit({ temp })
      expect(o.by('top')).toHaveLength(1)
      expect(o.by('bottom')).toHaveLength(1)
    }
  })
})
