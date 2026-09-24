import { useEffect, useMemo, useState } from 'react'
import type { Decision, Forecast, Recommendation, RunState } from '../types'
import { sampleAt } from '../services/WeatherService'
import { HOUR } from '../lib/timeScale'
import { rulesEngine } from './rulesEngine'
import { jevEngine } from './jev/jevEngine'

/** Jev refines the rules unless turned off with NEXT_PUBLIC_ENGINE=rules. */
const JEV_ON = process.env.NEXT_PUBLIC_ENGINE !== 'rules'
/** Wait this long after the run stops changing before asking Jev. */
const ASK_AFTER = 250
const QUARTER = 15 * 60_000

export function runStateAt(forecast: Forecast, at: Date, durationMin: number): RunState {
  return {
    start: sampleAt(forecast, at),
    end: sampleAt(forecast, new Date(at.getTime() + durationMin * 60_000)),
    durationMin,
  }
}

/**
 * The rules answer the instant there's weather, so garments are on screen
 * right away. Jev is asked only about the run someone settles on, and
 * refines the rules in place when it answers.
 *
 * Jev's question uses the run's start rounded to the quarter hour: "now"
 * becomes the nearest quarter, so everyone looking at the same place at the
 * same time asks the identical question and shares one cached answer.
 */
export function useRecommendation(
  forecast: Forecast | null,
  now: Date,
  hoursAhead: number,
  durationMin: number,
): { state: RunState | null; recommendation: Recommendation | null } {
  const at = useMemo(() => new Date(now.getTime() + hoursAhead * HOUR), [now, hoursAhead])
  const state = useMemo(() => (forecast ? runStateAt(forecast, at, durationMin) : null), [forecast, at, durationMin])

  const rules = useMemo<Recommendation | null>(
    () => (state ? { decisions: rulesEngine.recommend(state) as Decision[] } : null),
    [state],
  )

  const jevRun = useMemo(() => {
    if (!JEV_ON || !forecast) return null
    const quarter = new Date(Math.round(at.getTime() / QUARTER) * QUARTER)
    return runStateAt(forecast, quarter, durationMin)
  }, [forecast, at, durationMin])

  // Bumped when an answer lands, to re-read the cache
  const [, setAnswered] = useState(0)

  useEffect(() => {
    if (!jevRun || !jevEngine.available?.() || jevEngine.cached(jevRun)) return
    let live = true
    const t = setTimeout(() => {
      Promise.resolve(jevEngine.recommend(jevRun))
        .catch((err: Error) => console.warn('[layers.run] Jev unavailable, using rules:', err.message))
        .finally(() => live && setAnswered((n) => n + 1))
    }, ASK_AFTER)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [jevRun])

  const jev = jevRun ? jevEngine.cached(jevRun) : null
  return { state, recommendation: jev ?? rules }
}
