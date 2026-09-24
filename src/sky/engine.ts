import { WindField } from './wind'

// The sky's weather engine. One canvas, one clock, one wind. Each layer is
// a small system that reads the same air and the same lightning, drawn back
// to front: stars, rain or snow, splashes. Presence per layer eases toward
// the forecast so the weather blends from one state to the next.
//
// Everything drawn here is crisp (dots and streaks). Soft, faint layers like
// drifting cloud or fog band badly on dark skies, so cloud, fog and wind are
// told by the sky's own colour instead.

export interface SkyParams {
  precip: 'none' | 'rain' | 'snow'
  /** 0-1 */
  intensity: number
  storm: boolean
  /** 0-1 */
  stars: number
  /** Light-on-dark sky. */
  dark: boolean
  windMph: number
}

interface Env {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  t: number
  dt: number
  still: boolean
  wind: WindField
  p: SkyParams
  /** 0-1, how lit the scene is by lightning right now. */
  flash: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Wraps x around the screen with a margin, so drifting things re-enter. */
function wrap(x: number, w: number, margin: number) {
  const span = w + margin * 2
  return ((((x + margin) % span) + span) % span) - margin
}

// ── Stars ──────────────────────────────────────────────────────────────────

class Stars {
  private stars = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.pow(Math.random(), 1.4) * 0.75, // denser toward the top
    r: rand(0.4, 1.3),
    base: rand(0.35, 1),
    phase: rand(0, 6.3),
    speed: rand(0.4, 1.4),
  }))
  presence = 0

  step(e: Env) {
    this.presence = ease(this.presence, e.p.stars, e, 0.8)
    if (this.presence < 0.01) return
    // Four brightness levels, one path each
    const levels: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
    for (const s of this.stars) {
      const tw = e.still ? 1 : 0.7 + 0.3 * Math.sin((e.t / 1000) * s.speed + s.phase)
      const level = Math.min(3, Math.floor(s.base * tw * 4))
      const x = s.x * e.w
      const y = s.y * e.h
      levels[level].moveTo(x + s.r, y)
      levels[level].arc(x, y, s.r, 0, Math.PI * 2)
    }
    levels.forEach((path, i) => {
      e.ctx.fillStyle = `rgb(255 255 255 / ${this.presence * ((i + 0.5) / 4) * 0.85})`
      e.ctx.fill(path)
    })
  }
}

// ── Rain and snow share particles; the wind decides how they move ──────────

interface Drop {
  x: number
  y: number
  z: number // depth 0.3-1: nearer is bigger, faster, brighter
  phase: number
  vx: number
  vy: number
  /** Where a near raindrop lands; far drops fall out of frame. */
  ground: number
}

interface Splash {
  x: number
  y: number
  age: number
  size: number
  z: number
  lean: number // which way the wind throws the spray
}

/** Rain falls faster the nearer it is. */
const rainFall = (z: number) => 460 + 720 * z
/** Rain never slants more than this (horizontal per vertical, about 18°). */
const MAX_SLANT = 0.32
/** One angle for every drop: the sky's steady wind against a typical fall. */
const rainSlant = (e: Env) => Math.max(-MAX_SLANT, Math.min(MAX_SLANT, e.wind.steady(e.t) / 1200))

/** Particles are drawn in a few depth bands so each band is one path. */
const DEPTH_BANDS = 4
const depthBand = (z: number) => Math.min(DEPTH_BANDS - 1, Math.floor(((z - 0.3) / 0.7) * DEPTH_BANDS))
const bandDepth = (band: number) => 0.3 + ((band + 0.5) / DEPTH_BANDS) * 0.7

// Calm enough to read over: a texture of rain, not a downpour of lines
const MAX_RAIN = 200
const MAX_SNOW = 200
const MAX_SPLASHES = 36
const SPLASH_LIFE = 0.42

class Precipitation {
  private drops: Drop[] = []
  private splashes: Splash[] = []
  private kind: 'rain' | 'snow' = 'rain'
  presence = 0

  private spawn(e: Env, top: boolean): Drop {
    const z = 0.3 + 0.7 * Math.pow(Math.random(), 1.8) // most are far away
    // Start upwind by however far the air will carry it on the way down, so
    // a gale doesn't leave one side of the screen empty
    const fall = this.kind === 'snow' ? 30 + 50 * z : rainFall(z)
    const drift = this.kind === 'snow' ? (e.wind.steady(e.t) * 0.9 * e.h) / fall : rainSlant(e) * e.h
    return {
      // Cover the whole top edge plus the stretch upwind that blows in
      x: top ? rand(Math.min(-80, -80 - drift), Math.max(e.w + 80, e.w + 80 - drift)) : rand(-80, e.w + 80),
      y: top ? rand(-80, -20) : rand(0, e.h),
      z,
      phase: rand(0, 6.3),
      vx: 0,
      vy: 1,
      ground: this.kind === 'rain' && z > 0.75 ? e.h - rand(0, e.h * 0.2) : e.h + 40,
    }
  }

  step(e: Env) {
    // Switching rain to snow (or back): the old kind fades out fully, then
    // the new one fades in
    const wanted = e.p.precip === 'none' || e.still ? null : e.p.precip
    if (wanted && wanted !== this.kind && this.presence < 0.02) {
      this.kind = wanted
      this.drops.length = 0
    }
    const target = wanted === this.kind ? e.p.intensity : 0
    this.presence = ease(this.presence, target, e, wanted && wanted !== this.kind ? 4 : 2)
    const want = Math.round(this.presence * (this.kind === 'snow' ? MAX_SNOW : MAX_RAIN))
    // New weather fills the whole sky at once; only recycled drops start at the top
    while (this.drops.length < want) this.drops.push(this.spawn(e, false))
    if (this.drops.length > want) this.drops.length = want
    if (this.kind === 'snow') this.snow(e)
    else this.rain(e)
  }

  private rain(e: Env) {
    const { ctx } = e
    const ink = e.p.dark ? '225 235 250' : '48 60 80'
    // Lightning catches the rain
    const lit = 1 + e.flash * 1.6

    // Move every drop; land the near ones
    for (const d of this.drops) {
      const vy = rainFall(d.z)
      // Every drop falls at the same angle; nearer drops are just faster
      const vx = vy * rainSlant(e)
      d.x += vx * e.dt
      d.y += vy * e.dt
      d.vx = vx
      d.vy = vy
      if (d.y > d.ground) {
        if (d.ground < e.h + 40 && this.splashes.length < MAX_SPLASHES) {
          const lean = Math.sign(vx) * Math.min(1, Math.abs(vx) / 400)
          this.splashes.push({ x: d.x, y: d.ground, age: 0, size: 2 + 5 * d.z, z: d.z, lean })
        }
        Object.assign(d, this.spawn(e, true))
      }
    }

    // Draw by depth band: a handful of strokes a frame instead of hundreds.
    // Each streak lies along its drop's velocity, a faint tail with a
    // brighter head, which reads as motion blur without gradients.
    ctx.lineCap = 'round'
    for (let band = 0; band < DEPTH_BANDS; band++) {
      const z = bandDepth(band)
      const a = Math.min(0.7, (0.05 + 0.26 * z * z) * lit)
      ctx.lineWidth = 0.5 + 1.1 * z * z
      for (const [share, alpha] of [
        [1, a * 0.45],
        [0.35, a],
      ] as const) {
        ctx.strokeStyle = `rgb(${ink} / ${alpha})`
        ctx.beginPath()
        for (const d of this.drops) {
          if (depthBand(d.z) !== band) continue
          const len = (7 + 26 * d.z * d.z) * share
          const speed = Math.hypot(d.vx, d.vy) || 1
          ctx.moveTo(d.x - (d.vx / speed) * len, d.y - (d.vy / speed) * len)
          ctx.lineTo(d.x, d.y)
        }
        ctx.stroke()
      }
    }

    // Splashes: a flat ripple, and a short crown of spray thrown downwind
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i]
      s.age += e.dt
      const k = s.age / SPLASH_LIFE
      if (k >= 1) {
        this.splashes.splice(i, 1)
        continue
      }
      const fade = (1 - k) * (1 - k)
      const rx = s.size * (0.6 + k * 2.6)
      ctx.strokeStyle = `rgb(${ink} / ${0.18 * s.z * fade})`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, rx, rx * 0.26, 0, 0, Math.PI * 2)
      ctx.stroke()
      if (k < 0.45) {
        const c = 1 - k / 0.45
        ctx.strokeStyle = `rgb(${ink} / ${0.22 * s.z * c})`
        ctx.lineWidth = 0.7
        ctx.beginPath()
        for (const angle of [-0.9, -0.3, 0.35, 0.95]) {
          const a = angle + s.lean * 0.5
          const r0 = s.size * 0.5
          const r1 = s.size * (0.8 + k * 3)
          ctx.moveTo(s.x + Math.sin(a) * r0, s.y - Math.cos(a) * r0 * 0.9)
          ctx.lineTo(s.x + Math.sin(a) * r1, s.y - Math.cos(a) * r1 * 0.9)
        }
        ctx.stroke()
      }
    }
  }

  private snow(e: Env) {
    const { ctx } = e
    for (const d of this.drops) {
      const [ex, ey] = e.wind.eddy(e.t, d.x, d.y, d.phase)
      // All snow drifts the same way; the eddies give each flake its own wander
      d.x += (e.wind.steady(e.t) * 0.8 + ex * d.z) * e.dt
      d.y += (30 + 50 * d.z + ey) * e.dt
      if (d.y > e.h + 10) Object.assign(d, this.spawn(e, true))
      d.x = wrap(d.x, e.w, 20)
    }
    // Snow is always white; on pale skies a faint rim keeps it visible
    for (let band = 0; band < DEPTH_BANDS; band++) {
      const z = bandDepth(band)
      const size = 0.8 + 2.2 * z
      for (const rim of e.p.dark ? [false] : [true, false]) {
        ctx.fillStyle = rim ? `rgb(50 60 80 / ${0.1 + 0.18 * z})` : `rgb(255 255 255 / ${0.75 + 0.25 * z})`
        const r = rim ? size + 0.8 : size
        ctx.beginPath()
        for (const d of this.drops) {
          if (depthBand(d.z) !== band) continue
          ctx.moveTo(d.x + r, d.y)
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
    }
  }
}

// ── Lightning: one clock that lights the overlay, the cloud and the rain ───

const STRIKE: [number, number][] = [
  // [ms, relative brightness]: stroke, gap, return stroke, gone
  [0, 0],
  [25, 1],
  [85, 0.2],
  [120, 0.8],
  [190, 0.35],
  [420, 0],
]

class Lightning {
  private start = -Infinity
  private next = 0
  private peak = 0.35
  level = 0
  private overlay: HTMLElement | null

  constructor(overlay: HTMLElement | null) {
    this.overlay = overlay
  }

  step(e: Env) {
    if (!this.next) this.next = e.t + rand(2500, 6500)
    if (!e.still && e.p.storm && e.t > this.next) {
      this.start = e.t
      this.peak = rand(0.28, 0.42)
      this.next = e.t + rand(9000, 23000)
      this.overlay?.style.setProperty('--flash-x', `${rand(10, 90)}%`)
    }
    const k = e.t - this.start
    let v = 0
    for (let i = 1; i < STRIKE.length; i++) {
      const [t1, v1] = STRIKE[i]
      const [t0, v0] = STRIKE[i - 1]
      if (k >= t0 && k <= t1) {
        v = v0 + ((v1 - v0) * (k - t0)) / (t1 - t0)
        break
      }
    }
    this.level = v
    if (this.overlay) this.overlay.style.opacity = String(v * this.peak)
  }
}

// ── Easing shared by every layer ───────────────────────────────────────────

function ease(cur: number, target: number, e: Env, rate: number) {
  return e.still ? target : Math.max(0, cur + (target - cur) * Math.min(1, e.dt * rate))
}

// ── The engine ─────────────────────────────────────────────────────────────

export class SkyEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private wind = new WindField()
  private stars = new Stars()
  private precip = new Precipitation()
  private lightning: Lightning
  private params: SkyParams = {
    precip: 'none',
    intensity: 0,
    storm: false,
    stars: 0,
    dark: false,
    windMph: 0,
  }

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement | null) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.lightning = new Lightning(overlay)
    this.resize()
  }

  set(params: SkyParams) {
    this.params = params
    this.wind.set(params.windMph)
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = this.w * dpr
    this.canvas.height = this.h * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Advance and draw one frame. `still` paints the settled state with no motion. */
  frame(t: number, dt: number, still = false) {
    this.wind.update(dt, still)
    const e: Env = {
      ctx: this.ctx,
      w: this.w,
      h: this.h,
      t,
      dt: still ? 0 : dt,
      still,
      wind: this.wind,
      p: this.params,
      flash: this.lightning.level,
    }
    this.ctx.clearRect(0, 0, this.w, this.h)
    this.lightning.step(e)
    e.flash = this.lightning.level
    this.stars.step(e)
    this.precip.step(e)
  }
}
