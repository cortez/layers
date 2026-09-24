// Display units. Everything is computed in °F and mph; these only change
// what's shown. The default follows the device's region (the US and a
// couple of others read Fahrenheit); tapping the temperature switches, and
// the choice is remembered.

export type Units = 'imperial' | 'metric'

const KEY = 'layers.run:units'
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM', 'PR', 'GU', 'AS', 'VI', 'MP', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'])

function regionDefault(): Units {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
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
export const speedUnit = (units: Units) => (units === 'metric' ? ' km/h' : ' mph')

/** Whether the device reads a 12-hour clock ("9:30 PM") or a 24-hour one ("21:30"). */
export const uses12Hour = (() => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true
  } catch {
    return true
  }
})()
