import { motion } from 'motion/react'
import { ClockTime, Degrees, Duration } from './Numbers'
import { EASE } from '../lib/motion'
import { Morph } from './Morph'
import { toDisplayTemp, type Units } from '../lib/units'

interface HubProps {
  /** Feels-like °F, or null while the sky is being checked. */
  feelsLike: number | null
  status: string | null
  start: Date
  end: Date
  /** Run length in minutes, shown under the times. */
  minutes: number
  startsNow: boolean
  tomorrow: boolean
  /** Direction the run is being dragged, so the clocks roll together. */
  trend: -1 | 0 | 1
  units: Units
  /** Tapping the temperature switches between °F and °C. */
  onToggleUnits(): void
}

/** The reading in the middle of the dial. */
export function Hub({ feelsLike, status, start, end, minutes, startsNow, tomorrow, trend, units, onToggleUnits }: HubProps) {
  const label = tomorrow ? 'Tomorrow, feels like' : startsNow ? 'Feels like now' : 'Feels like'
  return (
    <div className="hub" aria-live="polite">
      <Morph className="hub-label">{label}</Morph>
      <span className="hub-temp">
        {feelsLike !== null && (
          <motion.button
            className="hub-temp-button"
            onClick={onToggleUnits}
            aria-label={`Feels like ${Math.round(toDisplayTemp(feelsLike, units))} degrees ${units === 'metric' ? 'Celsius' : 'Fahrenheit'}. Switch to ${units === 'metric' ? 'Fahrenheit' : 'Celsius'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <Degrees value={feelsLike} units={units} />
          </motion.button>
        )}
      </span>
      <span className="hub-window">
        {status ? (
          <Morph>{status}</Morph>
        ) : (
          <>
            <ClockTime date={start} trend={trend} />
            <span className="hub-arrow" aria-hidden="true">
              →
            </span>
            <ClockTime date={end} trend={trend} />
          </>
        )}
      </span>
      {/* How long, right where the arc is being stretched */}
      <span className="hub-duration" aria-hidden={!!status || undefined}>
        {!status && <Duration minutes={minutes} />}
      </span>
    </div>
  )
}
