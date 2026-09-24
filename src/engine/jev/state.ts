import type { RunState, WeatherSample } from '../../types'
import { runFeel } from '../../lib/runFeel'
import { DRESSING_GUIDE, type JevState } from './questions'
import { currentZone } from '../../lib/zone'

// The run as Jev sees it, kept compact because input tokens are the cost:
// how to read it (once), how the run feels to a runner (computed), and the
// weather at the start and finish. Numbers are rounded so nearby runs ask
// identical questions and share cached answers.

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d

function at(s: WeatherSample, timeZone?: string) {
  return {
    time: s.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone }),
    daylight: s.isDay,
    temp_f: round(s.temperature),
    feels_f: round(s.apparent),
    wind_mph: round(s.windSpeed),
    rain_pct: round(s.precipProbability / 10) * 10,
    uv: round(s.uvIndex),
  }
}

export function jevState(run: RunState, timeZone = currentZone()): JevState {
  const f = runFeel(run)
  return {
    guide: DRESSING_GUIDE,
    minutes: run.durationMin,
    feel: {
      overall_f: round(f.feel),
      coldest_f: round(f.coldest),
      warmest_f: round(f.warmest),
      sun_0_to_1: round(f.sun, 1),
      wet_0_to_1: round(f.wet, 1),
      snow: f.snow,
      peak_uv: round(f.uv),
      strong_wind: f.wind >= 15,
    },
    start: at(run.start, timeZone),
    finish: at(run.end, timeZone),
  }
}
