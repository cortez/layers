// The one wind every layer of the sky moves through.
//
// A steady flow from the forecast's wind speed that swells and eases over
// time, the same everywhere so rain falls in parallel sheets, plus small
// eddies that give each snowflake its own wander.

/** Screen speed per mph of wind. */
const PX_PER_MPH = 14
/** Even on a still day the air drifts a little. */
const BREEZE = 4

export class WindField {
  private mph = 0
  private target = 0

  set(mph: number) {
    this.target = Math.max(0, mph)
  }

  /** Ease toward the forecast so a change of wind builds or dies away. */
  update(dt: number, still: boolean) {
    this.mph = still ? this.target : this.mph + (this.target - this.mph) * Math.min(1, dt * 0.8)
  }

  /**
   * One steady drift for the whole sky (px/s), swelling and easing slowly
   * over time but the same everywhere. Falling rain and snow use this so
   * everything slants the same way, like real sheets of rain.
   */
  steady(t: number): number {
    const swell = 1 + 0.12 * Math.sin(t * 0.00025) + 0.06 * Math.sin(t * 0.00061 + 1.1)
    return BREEZE + this.mph * PX_PER_MPH * swell
  }

  /**
   * Small eddies for light things like snow and spray: a sideways and a
   * vertical nudge (px/s) that grows with the wind.
   */
  eddy(t: number, x: number, y: number, phase: number): [number, number] {
    const k = 10 + this.mph * 1.6
    return [
      Math.sin(t * 0.0011 + y * 0.013 + phase) * k,
      Math.sin(t * 0.0017 + x * 0.009 + phase * 1.3) * k * 0.5,
    ]
  }
}
