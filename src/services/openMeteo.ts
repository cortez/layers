import type { Forecast, Place, WeatherSample } from '../types'
import type { WeatherService } from './WeatherService'
import { feelsLike } from '../lib/feelsLike'

// Open-Meteo: free, keyless forecast and place search. Imperial units,
// unix times, and the place's own time zone. Feels-like is computed here
// with the NWS formulas rather than taken from the API, so wind always
// counts the same way everywhere in the app.

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'

const HOURLY = [
  'temperature_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
] as const

type Hourly = { time: number[] } & Record<(typeof HOURLY)[number], (number | null)[]>

interface GeocodeResult {
  id: number
  name: string
  admin1?: string
  country?: string
  country_code?: string
  latitude: number
  longitude: number
  timezone?: string
  population?: number
  feature_code?: string
}

async function getJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${url.hostname} ${res.status}`)
  return (await res.json()) as T
}

/**
 * US places read "Boston · Massachusetts"; elsewhere "Lisbon · Portugal".
 * Empty when there's nothing to add, or it would just repeat the name.
 */
function region(r: GeocodeResult) {
  const value = (r.country_code === 'US' ? r.admin1 : r.country) ?? r.admin1 ?? ''
  return value.toLowerCase() === r.name.toLowerCase() ? '' : value
}

export const openMeteo: WeatherService = {
  async searchPlaces(query, signal) {
    const q = query.trim()
    if (q.length < 2) return []
    const url = new URL(GEOCODE)
    url.search = new URLSearchParams({ name: q, count: '12', language: 'en', format: 'json' }).toString()
    const body = await getJson<{ results?: GeocodeResult[] }>(url, signal)
    // People run in towns and cities. A country or region is placed at its
    // middle (Greenland's is 3km up on the ice sheet), so drop those whenever
    // a real place matches. Short queries also match hamlets that share the
    // name, often many identical ones: prefer populated places, and never
    // show the same place twice.
    const all = body.results ?? []
    const places = all.filter((r) => r.feature_code?.startsWith('PPL'))
    const candidates = places.length ? places : all
    const populated = candidates.filter((r) => (r.population ?? 0) > 0)
    const lower = q.toLowerCase()
    const named = (r: GeocodeResult) => (r.name.toLowerCase().startsWith(lower) ? 1 : 0)
    const seen = new Set<string>()
    const ranked = (populated.length ? populated : candidates)
      .map((r, i) => ({ r, i }))
      // What you typed first, then the bigger place
      .sort((a, b) => named(b.r) - named(a.r) || (b.r.population ?? 0) - (a.r.population ?? 0) || a.i - b.i)
      .map(({ r }) => r)
      .filter((r) => {
        const k = `${r.name}|${r.admin1}|${r.country_code}`
        return !seen.has(k) && !!seen.add(k)
      })
      .slice(0, 5)
    return ranked.map((r) => ({
      id: `om:${r.id}`,
      name: r.name,
      region: region(r),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    }))
  },

  async getForecast(place, signal) {
    const url = new URL(FORECAST)
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      hourly: HOURLY.join(','),
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timeformat: 'unixtime',
      timezone: 'auto',
      // An hour behind so "now" interpolates; a day ahead plus the longest run
      past_hours: '1',
      forecast_hours: '34',
    }).toString()
    const body = await getJson<{ timezone: string; hourly: Hourly }>(url, signal)
    const h = body.hourly
    const n = (key: (typeof HOURLY)[number], i: number) => h[key][i] ?? 0
    const hours: WeatherSample[] = h.time.map((t, i) => {
      const temperature = n('temperature_2m', i)
      const windSpeed = n('wind_speed_10m', i)
      const dewPoint = n('dew_point_2m', i)
      return {
        time: new Date(t * 1000),
        temperature,
        apparent: feelsLike(temperature, windSpeed, dewPoint),
        dewPoint,
        windSpeed,
        windGust: n('wind_gusts_10m', i),
        precipProbability: n('precipitation_probability', i),
        precipitation: n('precipitation', i),
        uvIndex: n('uv_index', i),
        cloudCover: n('cloud_cover', i),
        isDay: n('is_day', i) === 1,
        weatherCode: n('weather_code', i),
      }
    })
    const located: Place = { ...place, timezone: place.timezone ?? body.timezone }
    return { place: located, hours } satisfies Forecast
  },
}
