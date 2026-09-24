import { useEffect } from 'react'
import type { Forecast, WeatherSample } from '../types'
import { HOUR, MAX_HOURS_AHEAD } from './timeScale'
import { hourOfDay } from './zone'

// The page background is the sky at the start of the run. Clear-sky colour
// follows the hour through dawn, day, dusk and night; cloud, rain, snow and
// fog pull it toward their own greys. Everything is in OKLCH.

type LCH = [number, number, number]

export interface Sky {
  top: string
  bottom: string
  /** Ink colour that reads on this sky. */
  ink: string
  /** The sky is dark enough that the UI runs light-on-dark. */
  dark: boolean
  precip: 'none' | 'rain' | 'snow'
  /** 0-1 particle density. */
  intensity: number
  storm: boolean
  /** 0-1 visible stars (clear night). */
  stars: number
  /** The horizon colour as sRGB hex, for the browser's own chrome. */
  tint: string
}

// Clear sky by hour: [hour, top, bottom]
const CLEAR: [number, LCH, LCH][] = [
  [0, [0.18, 0.045, 268], [0.26, 0.05, 264]],
  [4.5, [0.2, 0.045, 268], [0.29, 0.055, 265]],
  [6, [0.55, 0.07, 285], [0.8, 0.09, 45]],
  [7.5, [0.74, 0.08, 245], [0.9, 0.06, 70]],
  [10, [0.74, 0.11, 240], [0.92, 0.035, 225]],
  [15, [0.73, 0.11, 240], [0.91, 0.04, 215]],
  [17.5, [0.72, 0.09, 250], [0.88, 0.07, 65]],
  [19, [0.5, 0.09, 290], [0.76, 0.12, 40]],
  [20.5, [0.25, 0.055, 272], [0.35, 0.065, 288]],
  [24, [0.18, 0.045, 268], [0.26, 0.05, 264]],
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function lerpHue(a: number, b: number, t: number) {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}
function mix(a: LCH, b: LCH, t: number): LCH {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerpHue(a[2], b[2], t)]
}
const css = ([l, c, h]: LCH) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`

/** OKLCH to sRGB hex, clipped to gamut. Safari wants a plain colour for theme-color. */
function hex([L, C, H]: LCH): string {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return (
    '#' +
    lin
      .map((v) => {
        const x = Math.min(1, Math.max(0, v))
        const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
        return Math.round(g * 255)
          .toString(16)
          .padStart(2, '0')
      })
      .join('')
  )
}

function clearAt(hour: number): [LCH, LCH] {
  for (let i = 0; i < CLEAR.length - 1; i++) {
    const [h0, t0, b0] = CLEAR[i]
    const [h1, t1, b1] = CLEAR[i + 1]
    if (hour >= h0 && hour <= h1) {
      // Ease between keyframes so dawn and dusk bloom rather than ramp
      const k = (hour - h0) / (h1 - h0)
      const e = k * k * (3 - 2 * k)
      return [mix(t0, t1, e), mix(b0, b1, e)]
    }
  }
  return [CLEAR[0][1], CLEAR[0][2]]
}

/** 0 at night, 1 in full daylight. */
function daylight(top: LCH) {
  return Math.min(1, Math.max(0, (top[0] - 0.2) / 0.52))
}

/**
 * The sky for a forecast sample. With no weather yet, it's a clear sky at
 * `fallback` (the current time), slightly muted. Light or dark UI follows
 * from how bright the sky is, never from the system theme.
 */
export function skyFor(s: WeatherSample | null, fallback: Date): Sky {
  if (!s) {
    const hour = hourOfDay(fallback)
    const [t, b] = clearAt(hour)
    const mute = ([l, c, h]: LCH): LCH => [l, c * 0.55, h]
    return finish(mute(t), mute(b), { precip: 'none', intensity: 0, storm: false, stars: 0 })
  }

  const hour = hourOfDay(s.time)
  let [top, bottom] = clearAt(hour)
  const light = daylight(top)
  const code = s.weatherCode
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86
  const rain = !snow && (code >= 51 || s.precipitation > 0.01)
  const fog = code === 45 || code === 48
  const storm = code >= 95

  // Overcast grey, brighter by day
  const grey: LCH = [lerp(0.25, 0.8, light), 0.012, 250]
  const greyLow: LCH = [lerp(0.3, 0.86, light), 0.01, 250]
  const cloud = Math.min(1, s.cloudCover / 100) * 0.85
  top = mix(top, grey, cloud)
  bottom = mix(bottom, greyLow, cloud)

  if (storm) {
    // Bruised, low and dark even at midday
    top = mix(top, [lerp(0.13, 0.27, light), 0.03, 265], 0.95)
    bottom = mix(bottom, [lerp(0.18, 0.4, light), 0.025, 255], 0.95)
  } else if (rain) {
    top = mix(top, [lerp(0.24, 0.58, light), 0.018, 245], 0.6)
    bottom = mix(bottom, [lerp(0.3, 0.72, light), 0.014, 240], 0.6)
  }
  if (snow) {
    // Deep enough that white flakes still read against it
    top = mix(top, [lerp(0.32, 0.66, light), 0.016, 245], 0.85)
    bottom = mix(bottom, [lerp(0.38, 0.74, light), 0.012, 240], 0.85)
  }
  if (fog) {
    const f: LCH = [lerp(0.38, 0.88, light), 0.006, 240]
    top = mix(top, f, 0.85)
    bottom = mix(bottom, f, 0.9)
  }

  // Drizzle is a light scatter; showers and storms fill the sky
  const drizzle = code >= 51 && code <= 57
  const intensity =
    rain || snow ? Math.min(1, (drizzle ? 0.12 : 0.3) + s.precipitation * 5 + (storm ? 0.35 : 0)) : 0
  const cover = Math.min(1, s.cloudCover / 100)
  return finish(top, bottom, {
    precip: snow ? 'snow' : rain ? 'rain' : 'none',
    intensity,
    storm,
    // Stars need darkness and a mostly open sky
    stars: rain || snow || fog ? 0 : Math.max(0, 1 - light * 2.5) * Math.max(0, 1 - cover / 0.6),
  })
}

type Weather = Pick<Sky, 'precip' | 'intensity' | 'storm' | 'stars'>

function finish(top: LCH, bottom: LCH, weather: Weather): Sky {
  const dark = (top[0] + bottom[0] * 2) / 3 < 0.6
  return {
    top: css(top),
    bottom: css(bottom),
    ink: dark ? 'oklch(0.97 0.005 250)' : 'oklch(0.24 0.012 255)',
    dark,
    tint: hex(bottom),
    ...weather,
  }
}

/** Paint the page with a sky: gradient, ink, and light or dark controls. */
export function useSkyTheme(sky: Sky) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sky-top', sky.top)
    root.style.setProperty('--sky-bottom', sky.bottom)
    root.style.setProperty('--fg', sky.ink)
    root.style.colorScheme = sky.dark ? 'dark' : 'light'
    root.dataset.sky = sky.dark ? 'dark' : 'light'
    // iOS Safari tints the status bar strip and its toolbar with this colour.
    // It's the horizon colour, which the page shows at both edges (globals.css).
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.append(meta)
    }
    meta.content = sky.tint
  }, [sky.top, sky.bottom, sky.ink, sky.dark, sky.tint])
}

/** Dark stretches of the next day as [from, to] hours from `now`, for shading the dial. */
export function nightsAhead(forecast: Forecast | null, now: Date): [number, number][] {
  const out: [number, number][] = []
  let from: number | null = null
  for (const h of forecast?.hours ?? []) {
    const ahead = Math.min(MAX_HOURS_AHEAD, Math.max(0, (h.time.getTime() - now.getTime()) / HOUR))
    if (!h.isDay && from === null) from = ahead
    if (h.isDay && from !== null) {
      if (ahead > from) out.push([from, ahead])
      from = null
    }
  }
  if (from !== null && from < MAX_HOURS_AHEAD) out.push([from, MAX_HOURS_AHEAD])
  return out
}
