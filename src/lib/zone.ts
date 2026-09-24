// Times are shown in the running place's own time zone, not the device's:
// planning a 7am run in Boston from California should read 7am. The zone is
// set when a forecast arrives; until then the device's zone is used.

let zone: string | undefined
const formatters = new Map<string, Intl.DateTimeFormat>()

export function setZone(timeZone: string | undefined) {
  zone = timeZone
}

export function currentZone() {
  return zone
}

function formatter() {
  const key = zone ?? ''
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
    formatters.set(key, f)
  }
  return f
}

/** Wall-clock parts of a moment in the running place. */
export function clock(date: Date) {
  const parts = Object.fromEntries(formatter().formatToParts(date).map((p) => [p.type, p.value]))
  return {
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    /** A calendar day key, for "is this tomorrow" comparisons. */
    day: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

/** Hours since local midnight, with a fraction for the minutes. */
export function hourOfDay(date: Date) {
  const c = clock(date)
  return c.hour + c.minute / 60
}
