// Apparent temperature in °F, per the US National Weather Service:
// wind chill when it's cold and moving, heat index when it's hot and humid,
// the air temperature in between (blended at the edges so it never jumps).

const toC = (f: number) => ((f - 32) * 5) / 9

/** Relative humidity (0-100) from air temperature and dew point, °F. */
export function relativeHumidity(tempF: number, dewPointF: number): number {
  const t = toC(tempF)
  const td = toC(dewPointF)
  const rh = 100 * Math.exp((17.625 * td) / (243.04 + td) - (17.625 * t) / (243.04 + t))
  return Math.min(100, Math.max(0, rh))
}

/** NWS wind chill. Defined for T ≤ 50°F and wind > 3 mph. */
export function windChill(tempF: number, windMph: number): number {
  const v = Math.pow(windMph, 0.16)
  return 35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v
}

/** NWS heat index (Rothfusz regression with the standard adjustments). */
export function heatIndex(tempF: number, rh: number): number {
  const simple = 0.5 * (tempF + 61 + (tempF - 68) * 1.2 + rh * 0.094)
  if ((simple + tempF) / 2 < 80) return simple
  const T = tempF
  const R = rh
  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R
  if (R < 13 && T >= 80 && T <= 112) hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17)
  else if (R > 85 && T >= 80 && T <= 87) hi += ((R - 85) / 10) * ((87 - T) / 5)
  return hi
}

export function feelsLike(tempF: number, windMph: number, dewPointF: number): number {
  let value = tempF
  if (tempF <= 50 && windMph > 3) {
    // Fade wind chill in over the last few degrees below 50°F
    const k = Math.min(1, (50 - tempF) / 4 + 0.25)
    value = tempF + (Math.min(tempF, windChill(tempF, windMph)) - tempF) * k
  } else if (tempF >= 80) {
    const hi = heatIndex(tempF, relativeHumidity(tempF, dewPointF))
    const k = Math.min(1, (tempF - 80) / 4 + 0.25)
    value = tempF + (Math.max(tempF, hi) - tempF) * k
  }
  return value
}
