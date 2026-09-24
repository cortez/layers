/** The dial is a full day: every run in the next 24 hours is reachable. */
export const MAX_HOURS_AHEAD = 24
export const HOUR = 3_600_000
const QUARTER = 15 * 60_000

/** Hours from `now` to the first clock quarter (e.g. 7:23 → 7:30 = 0.117). */
export function firstQuarter(now: Date): number {
  const next = Math.ceil(now.getTime() / QUARTER) * QUARTER
  return (next - now.getTime()) / HOUR
}

/** Start-time detents: "now", then every clock quarter-hour up to `max`. */
export function snapHours(value: number, now: Date, max = MAX_HOURS_AHEAD): number {
  const f = firstQuarter(now)
  const v = Math.min(max, Math.max(0, value))
  const k = Math.max(0, Math.round((v - f) * 4))
  let tick = f + k / 4
  if (tick > max) tick -= 0.25
  return Math.abs(v) <= Math.abs(v - tick) ? 0 : tick
}

/** Next detent in a direction, for keyboard stepping. */
export function stepHours(value: number, now: Date, dir: 1 | -1, max = MAX_HOURS_AHEAD): number {
  const f = firstQuarter(now)
  if (dir === 1) {
    const next = value < f - 1e-6 ? f : f + (Math.round((value - f) * 4) + 1) / 4
    return next > max + 1e-6 ? value : next
  }
  if (value <= f + 1e-6) return 0
  return f + (Math.round((value - f) * 4) - 1) / 4
}

/** Shorter runs make the arc a blob, and are rare enough not to need it. */
export const MIN_DURATION = 30
/** Long enough for a marathon or an ultra. */
export const MAX_DURATION = 480
