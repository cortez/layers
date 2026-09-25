// Display units. Everything is computed in °F and mph; these only change
// what's shown. The default follows the device's region (the US and a
// couple of others read Fahrenheit); tapping the temperature switches, and
// the choice is remembered.

export type Units = 'imperial' | 'metric'

const KEY = 'layers.run:units'
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM', 'PR', 'GU', 'AS', 'VI', 'MP', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'])

/** US time zones, for when the language doesn't name a region. */
const US_ZONE = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Boise|Detroit|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/

/**
 * The region a language names outright ("en-US", "es-MX"), from any of the
 * device's languages. A bare "en" or "es" names none, and guessing one from
 * it goes wrong ("es" alone would mean Spain), so that's left to the clock.
 */
function namedRegion(): string | undefined {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    try {
      const region = new Intl.Locale(tag).region
      if (region) return region
    } catch {
      // A malformed tag; try the next
    }
  }
}

function regionDefault(): Units {
  try {
    const region = namedRegion()
    if (region) return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
    if (US_ZONE.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) return 'imperial'
    const guessed = new Intl.Locale(navigator.language).maximize().region
    return guessed && IMPERIAL_REGIONS.has(guessed) ? 'imperial' : 'metric'
  } catch {
    return 'imperial'
  }
}

export function loadUnits(): Units {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'imperial' || saved === 'metric') return saved
  } catch {
    // Storage blocked; fall back to the region
  }
  return regionDefault()
}

export function saveUnits(units: Units) {
  try {
    localStorage.setItem(KEY, units)
  } catch {
    // Storage blocked; the choice lasts this visit
  }
}

export const toDisplayTemp = (f: number, units: Units) => (units === 'metric' ? ((f - 32) * 5) / 9 : f)
export const toDisplaySpeed = (mph: number, units: Units) => (units === 'metric' ? mph * 1.609344 : mph)
export const tempUnit = (units: Units) => (units === 'metric' ? 'C' : 'F')
export const speedUnit = (units: Units) => (units === 'metric' ? ' km/h' : ' mph')

/** Whether the device reads a 12-hour clock ("9:30 PM") or a 24-hour one ("21:30"). */
export const uses12Hour = (() => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true
  } catch {
    return true
  }
})()
