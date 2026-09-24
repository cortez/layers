import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { Morph } from './Morph'
import { SPIN_TIMING } from '../lib/motion'
import { clock } from '../lib/zone'
import { speedUnit, toDisplaySpeed, toDisplayTemp, uses12Hour, type Units } from '../lib/units'

// Numbers roll with NumberFlow; the words around them morph with TextMorph.

const SPIN = SPIN_TIMING
const TWO_DIGITS = { minimumIntegerDigits: 2 } as const

/**
 * "9:30 PM", or "21:30" where the device reads a 24-hour clock. `trend` is
 * the direction time is being dragged: every digit rolls that way, so a
 * sweep reads as one motion instead of digits spinning against each other.
 */
export function ClockTime({ date, trend = 0 }: { date: Date; trend?: -1 | 0 | 1 }) {
  const { hour: h24, minute } = clock(date)
  return (
    <span className="clock">
      <NumberFlowGroup>
        <NumberFlow
          value={uses12Hour ? h24 % 12 || 12 : h24}
          format={uses12Hour ? undefined : TWO_DIGITS}
          spinTiming={SPIN}
          trend={trend}
        />
        <span className="clock-colon">:</span>
        <NumberFlow value={minute} format={TWO_DIGITS} spinTiming={SPIN} trend={trend} />
      </NumberFlowGroup>
      {uses12Hour && (
        <>
          {' '}
          <Morph className="clock-meridiem">{h24 < 12 ? 'AM' : 'PM'}</Morph>
        </>
      )}
    </span>
  )
}

/** "1h 30m", "45m", "2h". */
export function Duration({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <span className="duration">
      <NumberFlowGroup>
        {h > 0 && <NumberFlow value={h} suffix="h" spinTiming={SPIN} />}
        {h > 0 && m > 0 && ' '}
        {m > 0 && <NumberFlow value={m} suffix="m" spinTiming={SPIN} />}
      </NumberFlowGroup>
    </span>
  )
}

/** A temperature given in °F, shown in the runner's units. */
export function Degrees({ value, units }: { value: number; units: Units }) {
  return <NumberFlow value={Math.round(toDisplayTemp(value, units))} suffix="°" spinTiming={SPIN} />
}

/** A wind speed given in mph, shown in the runner's units. */
export function Speed({ mph, units }: { mph: number; units: Units }) {
  return <NumberFlow value={Math.round(toDisplaySpeed(mph, units))} suffix={speedUnit(units)} spinTiming={SPIN} />
}

export function Count({ value }: { value: number }) {
  return <NumberFlow value={Math.round(value)} spinTiming={SPIN} />
}
