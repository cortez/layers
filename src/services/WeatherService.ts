import type { Forecast, Place, WeatherSample } from '../types'
import { openMeteo } from './openMeteo'

export interface WeatherService {
  searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]>
  getForecast(place: Place, signal?: AbortSignal): Promise<Forecast>
}

export const weatherService: WeatherService = openMeteo

const NUMERIC_KEYS = [
  'temperature',
  'apparent',
  'dewPoint',
  'windSpeed',
  'windGust',
  'precipProbability',
  'precipitation',
  'uvIndex',
  'cloudCover',
] as const

/** Linearly interpolate the forecast at an arbitrary moment. */
export function sampleAt(forecast: Forecast, at: Date): WeatherSample {
  const hours = forecast.hours
  const t = at.getTime()
  if (t <= hours[0].time.getTime()) return { ...hours[0], time: at }
  for (let i = 0; i < hours.length - 1; i++) {
    const a = hours[i]
    const b = hours[i + 1]
    const ta = a.time.getTime()
    const tb = b.time.getTime()
    if (t >= ta && t <= tb) {
      const k = (t - ta) / (tb - ta)
      const nearest = k < 0.5 ? a : b
      const out: WeatherSample = { ...nearest, time: at }
      for (const key of NUMERIC_KEYS) out[key] = a[key] + (b[key] - a[key]) * k
      return out
    }
  }
  return { ...hours[hours.length - 1], time: at }
}

const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorms',
  96: 'Thunderstorms',
  99: 'Thunderstorms',
}

export function skyLabel(s: WeatherSample): string {
  return WMO[s.weatherCode] ?? 'Clear'
}
