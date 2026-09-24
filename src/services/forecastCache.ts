import type { Forecast } from '../types'

// The last forecast per place, kept on the device. A return visit draws
// from it instantly, and it saves weather calls: it's only refreshed once
// it's more than FRESH old, and dropped after USABLE.

const KEY = 'layers.run:forecast'
export const FRESH = 10 * 60_000
const USABLE = 30 * 60_000

interface Saved {
  placeId: string
  at: number
  forecast: Forecast
}

export function loadForecast(placeId: string): { forecast: Forecast; age: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (!saved || saved.placeId !== placeId) return null
    const age = Date.now() - saved.at
    if (age > USABLE) return null
    const forecast = saved.forecast
    return {
      age,
      forecast: { ...forecast, hours: forecast.hours.map((h) => ({ ...h, time: new Date(h.time) })) },
    }
  } catch {
    return null
  }
}

export function saveForecast(forecast: Forecast) {
  try {
    const saved: Saved = { placeId: forecast.place.id, at: Date.now(), forecast }
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Storage blocked or full; we'll just fetch next time
  }
}
