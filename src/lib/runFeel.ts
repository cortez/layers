import type { RunState, WeatherSample } from '../types'

// How a run's conditions feel to the runner, in °F, before counting the
// heat the runner makes. This is the one number both engines dress for.
//
// It starts from the NWS feels-like (wind chill / heat index), then adds
// what that leaves out and runners feel: sun on the skin, wind on a mild
// day, being wet, sticky air, and how long they're out.

export interface RunFeel {
  /** Feels-like across the run, adjusted: what to dress the body for. */
  feel: number
  /** The coldest point of the run, adjusted: for hands, ears and neck. */
  coldest: number
  /** The warmest point of the run, adjusted: for heat and sun. */
  warmest: number
  /** 0-1 strength of direct sun during the run. */
  sun: number
  /** 0-1 how wet the run will be. */
  wet: number
  /** Snow falling. */
  snow: boolean
  /** Peak UV during the run. */
  uv: number
  /** Strongest sustained wind during the run, mph. */
  wind: number
  daylight: boolean
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function sunOf(s: WeatherSample) {
  if (!s.isDay) return 0
  return clamp(1 - s.cloudCover / 100, 0, 1) * clamp(s.uvIndex / 7, 0, 1)
}

function wetOf(s: WeatherSample) {
  const falling = s.weatherCode >= 51 || s.precipitation >= 0.01
  const likely = clamp((s.precipProbability - 30) / 50, 0, 1)
  return falling ? Math.max(0.6, likely, clamp(s.precipitation / 0.15, 0, 1)) : likely * 0.6
}

const isSnow = (s: WeatherSample) => (s.weatherCode >= 71 && s.weatherCode <= 77) || s.weatherCode === 85 || s.weatherCode === 86

/** Adjustments to a single moment's feels-like. */
function adjusted(s: WeatherSample): number {
  let f = s.apparent
  // Direct sun warms a runner noticeably, most of all on a cool day
  f += sunOf(s) * (f < 70 ? 7 : 4)
  // Wind chill only starts at 50°F; below 65°F a breeze still bites
  if (f >= 50 && f < 65) f -= clamp((s.windSpeed - 8) * 0.35, 0, 6)
  // Wet skin and fabric lose heat fast when it isn't warm
  if (f < 65) f -= wetOf(s) * 5
  // Heat index only starts at 80°F; sticky air feels hotter before that
  if (s.dewPoint > 60 && f >= 60 && f < 80) f += (s.dewPoint - 60) * 0.25
  return f
}

export function runFeel(run: RunState): RunFeel {
  const a = adjusted(run.start)
  const b = adjusted(run.end)
  // Short runs never really warm up; long ones end tired and slower
  const duration = run.durationMin <= 30 ? -3 : run.durationMin >= 100 ? -1 : 0
  return {
    feel: (a + b) / 2 + duration,
    coldest: Math.min(a, b) + duration,
    warmest: Math.max(a, b),
    sun: Math.max(sunOf(run.start), sunOf(run.end)),
    wet: Math.max(wetOf(run.start), wetOf(run.end)),
    snow: isSnow(run.start) || isSnow(run.end),
    uv: Math.max(run.start.uvIndex, run.end.uvIndex),
    wind: Math.max(run.start.windSpeed, run.end.windSpeed),
    daylight: run.start.isDay || run.end.isDay,
  }
}
