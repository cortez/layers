import type { Place } from '../types'

// Finding the runner: browser geolocation for coordinates, then a free,
// keyless reverse-geocode (BigDataCloud's client endpoint) for a city name.

export type LocateError = 'denied' | 'unavailable'

export class LocateFailure extends Error {
  readonly reason: LocateError
  constructor(reason: LocateError) {
    super(reason)
    this.reason = reason
  }
}

/** Whether the site may already use location without asking. */
export async function locationPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (!('geolocation' in navigator)) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt' // Permissions API missing: we'll only know by asking
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 10 * 60_000,
    }),
  )
}

async function nameFor(latitude: number, longitude: number, signal?: AbortSignal) {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'en',
  }).toString()
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`reverse geocode ${res.status}`)
  const d = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string; countryName?: string }
  return { name: d.city || d.locality || 'Near you', region: d.principalSubdivision || d.countryName || '' }
}

/** Where the runner is, as a place. Throws LocateFailure. */
export async function locate(signal?: AbortSignal): Promise<Place> {
  let pos: GeolocationPosition
  try {
    pos = await position()
  } catch (err) {
    const denied = (err as GeolocationPositionError).code === 1
    throw new LocateFailure(denied ? 'denied' : 'unavailable')
  }
  const { latitude, longitude } = pos.coords
  // A name is nice to have; the coordinates are what matter
  const label = await nameFor(latitude, longitude, signal).catch(() => ({ name: 'Near you', region: '' }))
  return {
    id: `geo:${latitude.toFixed(2)},${longitude.toFixed(2)}`,
    ...label,
    latitude,
    longitude,
  }
}
