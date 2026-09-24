import { describe, expect, it } from 'vitest'
import { feelsLike, heatIndex, windChill } from './feelsLike'

// Values from the US National Weather Service wind chill and heat index charts.

describe('feels like', () => {
  it('matches the NWS wind chill chart', () => {
    expect(Math.round(windChill(30, 15))).toBe(19)
    expect(Math.round(windChill(0, 20))).toBe(-22)
    expect(Math.round(windChill(40, 10))).toBe(34)
  })

  it('matches the NWS heat index chart', () => {
    expect(Math.round(heatIndex(90, 60))).toBe(100)
    expect(Math.round(heatIndex(96, 40))).toBe(101)
  })

  it('is just the air temperature when it is mild', () => {
    expect(feelsLike(62, 12, 50)).toBe(62)
  })

  it('never jumps across the wind chill and heat index edges', () => {
    for (let t = 40; t <= 90; t += 0.5) {
      const step = Math.abs(feelsLike(t + 0.5, 12, t - 10) - feelsLike(t, 12, t - 10))
      expect(step).toBeLessThan(3)
    }
  })
})
