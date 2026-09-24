// The run's colour on the dial hints at how it will feel: warm runs lean
// orange, the usual feel is the app's red, and cold runs lean crimson then
// violet. Each end of the arc takes the colour of its own moment, so a run
// that cools off visibly cools along its length. Kept close to the red so
// it reads as a hint, not a thermometer.

type LCH = [number, number, number]

// [feels-like °F, colour]
const STOPS: [number, LCH][] = [
  [5, [0.6, 0.15, 292]],
  [32, [0.6, 0.19, 352]],
  [55, [0.61, 0.215, 26]],
  [75, [0.66, 0.2, 40]],
  [92, [0.73, 0.17, 56]],
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpHue = (a: number, b: number, t: number) => (a + ((((b - a) % 360) + 540) % 360 - 180) * t + 360) % 360

export function arcColor(feelsF: number, dark: boolean): string {
  let [l, c, h] = STOPS[STOPS.length - 1][1]
  if (feelsF <= STOPS[0][0]) [l, c, h] = STOPS[0][1]
  else {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [f0, a] = STOPS[i]
      const [f1, b] = STOPS[i + 1]
      if (feelsF <= f1) {
        const t = (feelsF - f0) / (f1 - f0)
        ;[l, c, h] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerpHue(a[2], b[2], t)]
        break
      }
    }
  }
  // A touch brighter on dark skies, like the rest of the accent
  if (dark) l += 0.05
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}
