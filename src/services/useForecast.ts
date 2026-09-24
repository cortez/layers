import { useEffect, useMemo, useRef, useState } from 'react'
import type { Forecast, Place } from '../types'
import { weatherService } from './WeatherService'
import { FRESH, loadForecast, saveForecast } from './forecastCache'

type Result = { key: string; forecast: Forecast | null; failed: boolean }

/** Coming back to the tab after this long quietly fetches a new forecast. */
const STALE_ON_RETURN = 15 * 60_000

/**
 * The forecast for `place` while `enabled`. A recent forecast saved on the
 * device shows at once; it's refreshed in the background only when it's
 * more than a few minutes old, including when the tab comes back after a
 * while. The screen keeps what it has until new data lands. Failures can be
 * retried.
 */
export function useForecast(place: Place | null, enabled: boolean) {
  const [attempt, setAttempt] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const fetchedAt = useRef(0)
  const key = enabled && place ? `${place.id}:${attempt}` : ''
  const saved = useMemo(() => (key && place ? loadForecast(place.id) : null), [key, place])

  // Returning to the tab after a while: fetch again, quietly
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const last = fetchedAt.current || Date.now() - (saved?.age ?? 0)
      if (Date.now() - last > STALE_ON_RETURN) setRefresh((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [saved])

  useEffect(() => {
    if (!key || !place) return
    const recent = loadForecast(place.id)
    if (recent && recent.age < FRESH) return // recent enough; don't spend a call
    const controller = new AbortController()
    weatherService
      .getForecast(place, controller.signal)
      .then((forecast) => {
        fetchedAt.current = Date.now()
        saveForecast(forecast)
        setResult({ key, forecast, failed: false })
      })
      .catch((err) => err.name !== 'AbortError' && setResult({ key, forecast: null, failed: !recent }))
    return () => controller.abort()
  }, [key, place, refresh])

  // A result for an older request reads as still loading
  const current = result?.key === key ? result : null
  return {
    forecast: current?.forecast ?? saved?.forecast ?? null,
    failed: current?.failed ?? false,
    retry: () => setAttempt((n) => n + 1),
  }
}
