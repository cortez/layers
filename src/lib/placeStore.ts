import type { Place } from '../types'

const KEY = 'layers.run:place'
/** Keys from before the rename, still read so nothing saved is lost. */
const LEGACY = { place: 'layer:place', duration: 'layer:duration' }

export function loadPlace(): Place | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY.place)
    return raw ? (JSON.parse(raw) as Place) : null
  } catch {
    return null
  }
}

export function savePlace(place: Place) {
  try {
    localStorage.setItem(KEY, JSON.stringify(place))
  } catch {
    // Private mode or storage blocked; the app works without it
  }
}

/**
 * The region to show beside a place's name in the pill, or nothing when the
 * pair would crowd it: better no region than one squeezed to "U…".
 */
export function regionFor(place: Place) {
  return place.region && place.name.length + place.region.length <= 30 ? place.region : ''
}

const HINT_KEY = 'layers.run:hinted'

/** Whether the runner has already learned to drag the dial. */
export function loadHinted(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function saveHinted() {
  try {
    localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Storage blocked; they'll just see the hint again next time
  }
}

const DURATION_KEY = 'layers.run:duration'
export const DEFAULT_DURATION = 75

/** The last run length the runner chose, in minutes. */
export function loadDuration(): number {
  try {
    const n = Number(localStorage.getItem(DURATION_KEY) ?? localStorage.getItem(LEGACY.duration))
    if (!Number.isFinite(n) || n <= 0 || n > 480) return DEFAULT_DURATION
    return Math.max(30, n) // runs shorter than the minimum, saved before it rose
  } catch {
    return DEFAULT_DURATION
  }
}

export function saveDuration(minutes: number) {
  try {
    localStorage.setItem(DURATION_KEY, String(minutes))
  } catch {
    // Storage blocked; the default is fine
  }
}
