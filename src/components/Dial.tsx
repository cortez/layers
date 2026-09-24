import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { SETTLE_MOTION as SETTLE } from '../lib/motion'
import { HOUR, MAX_DURATION, MAX_HOURS_AHEAD, MIN_DURATION, stepHours } from '../lib/timeScale'
import { clock } from '../lib/zone'
import { uses12Hour } from '../lib/units'
import { LABEL_ROOM, thicknessFor } from '../lib/dialGeometry'

// An open gauge: a heavy ring that starts at "now" (lower left), sweeps over
// the top, and ends a day later (lower right). Night is shaded on the track.
// The run is the red arc: drag its start (or the arc) to move it, drag its
// end to stretch it.

interface DialProps {
  size: number
  now: Date
  /** Hours from now to the run's start. Continuous while dragging. */
  start: MotionValue<number>
  /** Snapped start, for assistive tech and keyboard stepping. */
  startValue: number
  duration: number
  onDuration(minutes: number): void
  snap(hours: number): number
  /** Dark stretches, as [from, to] hours from now. */
  nights: [number, number][]
  /** A first-run hint, two short lines, shown inside the ring under the reading. */
  hint?: [string, string] | null
  /** The run's colour at its start and its finish: how each moment feels. */
  warmth: { start: string; end: string }
  children: ReactNode
}

/** The arc's touch target stays generous however slim the ring is drawn. */
const GRAB = 48
const SWEEP = 300 // degrees of ring; the gap sits at the bottom
const FROM = -SWEEP / 2
const DEG_PER_HOUR = SWEEP / MAX_HOURS_AHEAD


const rad = (deg: number) => (deg * Math.PI) / 180

/** Dusk and dawn: night fades in and out over this long, in hours. */
const TWILIGHT = 0.75
const angleOf = (hours: number) => FROM + hours * DEG_PER_HOUR

export function Dial({ size, now, start, startValue, duration, onDuration, snap, nights, hint, warmth, children }: DialProps) {
  const THICKNESS = thicknessFor(size)
  const c = size / 2
  const r = c - THICKNESS / 2 - LABEL_ROOM
  const maxStart = MAX_HOURS_AHEAD - duration / 60

  const point = (deg: number, radius = r) => ({
    x: c + radius * Math.sin(rad(deg)),
    y: c - radius * Math.cos(rad(deg)),
  })
  const arcPath = (h0: number, h1: number) => {
    const a0 = angleOf(h0)
    const a1 = angleOf(h1)
    const p0 = point(a0)
    const p1 = point(a1)
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`
  }

  // Arc end follows duration on a spring so stretching feels physical
  const span = useSpring(duration / 60, { stiffness: 320, damping: 34 })
  useEffect(() => span.set(duration / 60), [span, duration])

  // Geometry lives in a motion value so the transforms below track resizes
  const geo = useMotionValue({ c, r })
  useEffect(() => geo.set({ c, r }), [geo, c, r])
  const at = (hours: number) => {
    const { c: cc, r: rr } = geo.get()
    const a = rad(angleOf(hours))
    return { x: cc + rr * Math.sin(a), y: cc - rr * Math.cos(a) }
  }
  const arc = useTransform(() => {
    const s = start.get()
    const e = s + span.get()
    const p0 = at(s)
    const p1 = at(e)
    const rr = geo.get().r
    const large = (e - s) * DEG_PER_HOUR > 180 ? 1 : 0
    return `M ${p0.x} ${p0.y} A ${rr} ${rr} 0 ${large} 1 ${p1.x} ${p1.y}`
  })
  const sx = useTransform(() => at(start.get()).x)
  const sy = useTransform(() => at(start.get()).y)
  const ex = useTransform(() => at(start.get() + span.get()).x)
  const ey = useTransform(() => at(start.get() + span.get()).y)

  // The run's colour runs across the ring's thickness: orange along the
  // inner edge warming to red along the outer edge
  const gradientId = `run-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // ── Dragging ────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ kind: 'start' | 'end'; offset: number } | null>(null)

  /** Hours along the gauge under the pointer; the gap snaps to the nearer end. */
  const hoursAt = (e: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI // -180..180, 0 at top
    if (deg < FROM) return 0
    if (deg > -FROM) return MAX_HOURS_AHEAD
    return (deg - FROM) / DEG_PER_HOUR
  }

  /**
   * Pressing anywhere on the run picks whichever end is nearer the finger:
   * near the end stretches it, anywhere else moves the whole run. On a short
   * run the two ends' touch areas overlap, so layering alone can't decide.
   */
  const onPress = (e: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const scale = box.width / size
    const px = (e.clientX - box.left) / scale
    const py = (e.clientY - box.top) / scale
    const toEnd = Math.hypot(px - ex.get(), py - ey.get())
    const toStart = Math.hypot(px - sx.get(), py - sy.get())
    onDown(toEnd < toStart ? 'end' : 'start')(e)
  }

  const onDown = (kind: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation()
    svgRef.current!.setPointerCapture(e.pointerId)
    start.stop()
    drag.current = { kind, offset: kind === 'start' ? hoursAt(e) - start.get() : 0 }
    svgRef.current!.parentElement!.dataset.dragging = kind
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const h = hoursAt(e)
    if (d.kind === 'start') {
      const next = Math.min(maxStart, Math.max(0, h - d.offset))
      // Crossing the gap flips between the two ends of the day: glide there
      // rather than teleport
      if (Math.abs(next - start.get()) > 3) animate(start, next, SETTLE)
      else if (!start.isAnimating()) start.set(next)
    } else {
      const minutes = Math.round(((h - start.get()) * 60) / 15) * 15
      const room = Math.floor(((MAX_HOURS_AHEAD - start.get()) * 60) / 15) * 15
      const next = Math.max(MIN_DURATION, Math.min(MAX_DURATION, room, minutes))
      if (next !== duration) onDuration(next)
    }
  }

  const onUp = () => {
    if (drag.current?.kind === 'start') animate(start, snap(start.get()), SETTLE)
    drag.current = null
    delete svgRef.current?.parentElement?.dataset.dragging
  }

  const keyDir = (e: React.KeyboardEvent) =>
    e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0

  // Repeated presses step from where the last glide is heading, not from
  // wherever it happens to be mid-flight
  const keyTarget = useRef<number | null>(null)
  const onStartKey = (e: React.KeyboardEvent) => {
    const dir = keyDir(e)
    if (!dir) return
    e.preventDefault()
    const base = start.isAnimating() && keyTarget.current !== null ? keyTarget.current : startValue
    const next = stepHours(base, now, dir, maxStart)
    keyTarget.current = next
    animate(start, next, SETTLE)
  }

  const onEndKey = (e: React.KeyboardEvent) => {
    const dir = keyDir(e)
    if (!dir) return
    e.preventDefault()
    const next = Math.min(MAX_DURATION, Math.max(MIN_DURATION, duration + dir * 15))
    if (startValue + next / 60 <= MAX_HOURS_AHEAD) onDuration(next)
  }

  // ── Face ────────────────────────────────────────────────────────────────
  // Clock labels just outside the ring at every third hour of the place's
  // own day (walked in quarter hours so half-hour time zones land right)
  const labels = []
  const QUARTER = HOUR / 4
  const firstQuarter = Math.ceil((now.getTime() + 1) / QUARTER) * QUARTER
  for (let t = firstQuarter; t <= now.getTime() + MAX_HOURS_AHEAD * HOUR; t += QUARTER) {
    const { hour: hr, minute } = clock(new Date(t))
    if (minute !== 0 || hr % 3 !== 0) continue
    const h = (t - now.getTime()) / HOUR
    if (h < 1 || h > MAX_HOURS_AHEAD - 1) continue // keep clear of the ends
    const p = point(angleOf(h), r + THICKNESS / 2 + 11)
    labels.push(
      <text key={t} x={p.x} y={p.y} className="dial-numeral" textAnchor="middle" dominantBaseline="central">
        {uses12Hour ? `${hr % 12 || 12}${hr < 12 ? 'a' : 'p'}` : String(hr).padStart(2, '0')}
      </text>,
    )
  }
  const edge = r + THICKNESS / 2 + 4
  const nowLabel = point(angleOf(0), edge)
  const endLabel = point(angleOf(MAX_HOURS_AHEAD), edge)
  const inner = r - THICKNESS / 2

  return (
    <div className="dial" style={{ width: size, height: size, ['--inner' as string]: `${inner * 2}px` }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <path d={arcPath(0, MAX_HOURS_AHEAD)} className="dial-track" strokeWidth={THICKNESS} />
        {nights.map(([a, b], i) => (
          <Night
            key={a}
            id={`${gradientId}-night-${i}`}
            from={a}
            to={b}
            thickness={THICKNESS}
            path={arcPath}
            point={(h) => point(angleOf(h))}
          />
        ))}
        {labels}
        <text x={nowLabel.x} y={nowLabel.y + 16} className="dial-numeral" textAnchor="end">
          Now
        </text>
        <text x={endLabel.x} y={endLabel.y + 16} className="dial-numeral" textAnchor="start">
          +24h
        </text>

        <defs>
          {/* How the run feels, from its start to its finish */}
          <motion.linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={ex} y2={ey}>
            <stop offset="0" className="dial-arc-stop" style={{ stopColor: warmth.start }} />
            <stop offset="1" className="dial-arc-stop" style={{ stopColor: warmth.end }} />
          </motion.linearGradient>
          {/* A soft lighter inner edge gives the band its depth */}
          <radialGradient id={`${gradientId}-glow`} gradientUnits="userSpaceOnUse" cx={c} cy={c} r={r + THICKNESS / 2}>
            <stop offset={(r - THICKNESS / 2) / (r + THICKNESS / 2)} stopColor="white" stopOpacity="0.22" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g data-no-scrub>
          <motion.path d={arc} className="dial-grab" strokeWidth={GRAB} onPointerDown={onPress} />
          <motion.path
            d={arc}
            className="dial-arc"
            strokeWidth={THICKNESS}
            style={{ stroke: `url(#${gradientId})` }}
            onPointerDown={onPress}
          />
          <motion.path
            d={arc}
            className="dial-arc-glow"
            strokeWidth={THICKNESS}
            style={{ stroke: `url(#${gradientId}-glow)` }}
          />
          {/* Start: a punched dot inside the cap. End: a quieter ring. */}
          <motion.circle
            cx={sx}
            cy={sy}
            r={5}
            className="dial-handle"
            data-start
            role="slider"
            tabIndex={0}
            aria-label="Start time"
            aria-valuemin={0}
            aria-valuemax={MAX_HOURS_AHEAD}
            aria-valuenow={Math.round(startValue * 100) / 100}
            onKeyDown={onStartKey}
          />
          <motion.circle
            cx={ex}
            cy={ey}
            r={3.5}
            className="dial-handle"
            data-end
            role="slider"
            tabIndex={0}
            aria-label="Run length"
            aria-valuemin={MIN_DURATION}
            aria-valuemax={MAX_DURATION}
            aria-valuenow={duration}
            aria-valuetext={`${duration} minutes`}
            onKeyDown={onEndKey}
          />
          {/* Generous invisible hit areas for fingers */}
          <motion.circle cx={sx} cy={sy} r={30} className="dial-hit" onPointerDown={onPress} />
          <motion.circle cx={ex} cy={ey} r={30} className="dial-hit" onPointerDown={onPress} />
        </g>
      </svg>
      <div className="dial-center">{children}</div>
      <AnimatePresence>
        {hint && (
          <motion.p
            className="dial-hint"
            style={{ top: c + inner * 0.82, width: inner * 1.3 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.4 }}
          >
            {hint[0]}
            <br />
            {hint[1]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

interface NightProps {
  id: string
  from: number
  to: number
  thickness: number
  path(h0: number, h1: number): string
  point(h: number): { x: number; y: number }
}

/**
 * One stretch of night, drawn as a single shape so there are never
 * overlapping layers (and never lines). A mask fades it in at dusk and out at
 * dawn with smooth gradients, and gives it a rounded end wherever it meets an
 * end of the track, matching the track's own caps.
 */
function Night({ id, from, to, thickness, path, point }: NightProps) {
  const atStart = from <= 0.01
  const atEnd = to >= MAX_HOURS_AHEAD - 0.01
  const fadeIn = atStart ? 0 : Math.min(TWILIGHT, (to - from) / 2)
  const fadeOut = atEnd ? 0 : Math.min(TWILIGHT, (to - from) / 2)
  // Mask strokes run a little wider than the ring so its edges stay crisp
  const w = thickness + 2
  const ramp = (h0: number, h1: number, key: string) => {
    const a = point(h0)
    const b = point(h1)
    return (
      <linearGradient key={key} id={`${id}-${key}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
        <stop offset="0" stopColor="black" />
        <stop offset="1" stopColor="white" />
      </linearGradient>
    )
  }
  // The solid middle overlaps each ramp slightly; both are opaque in the
  // mask, so the overlap can't double up
  const overlap = 0.02
  return (
    <>
      <defs>
        {fadeIn > 0 && ramp(from, from + fadeIn, 'in')}
        {fadeOut > 0 && ramp(to, to - fadeOut, 'out')}
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse">
          <path
            d={path(from + fadeIn - (fadeIn ? overlap : 0), to - fadeOut + (fadeOut ? overlap : 0))}
            stroke="white"
            strokeWidth={w}
            fill="none"
          />
          {fadeIn > 0 && <path d={path(from, from + fadeIn)} stroke={`url(#${id}-in)`} strokeWidth={w} fill="none" />}
          {fadeOut > 0 && <path d={path(to - fadeOut, to)} stroke={`url(#${id}-out)`} strokeWidth={w} fill="none" />}
          {atStart && <path d={path(0, 0.001)} stroke="white" strokeWidth={thickness} strokeLinecap="round" fill="none" />}
          {atEnd && (
            <path
              d={path(MAX_HOURS_AHEAD - 0.001, MAX_HOURS_AHEAD)}
              stroke="white"
              strokeWidth={thickness}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </mask>
      </defs>
      <path
        d={path(from, to)}
        className="dial-night"
        strokeWidth={thickness}
        strokeLinecap="round"
        mask={`url(#${id}-mask)`}
      />
    </>
  )
}

