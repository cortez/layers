import { useEffect, useRef } from 'react'
import { animate, type MotionValue } from 'motion/react'

const THRESHOLD = 6 // px of horizontal travel before a press becomes a scrub
// Released with momentum: a spring carries the fling's speed into the detent
const SETTLE = { type: 'spring', stiffness: 260, damping: 34 } as const


/**
 * Horizontal drags anywhere on `target`, and horizontal wheel/trackpad
 * scrolling, move the run's start time. Releasing glides with a little momentum and settles
 * on the nearest detent.
 */
export function usePageScrub(
  target: React.RefObject<HTMLElement | null>,
  hours: MotionValue<number>,
  pxPerHour: number,
  snap: (v: number) => number,
  max: number,
  enabled: boolean,
) {
  const snapRef = useRef(snap)
  const maxRef = useRef(max)
  useEffect(() => {
    snapRef.current = snap
    maxRef.current = max
  })

  useEffect(() => {
    const el = target.current
    if (!el || !enabled) return

    let press: { id: number; x: number; y: number; start: number; scrubbing: boolean } | null = null
    let lastX = 0
    let lastT = 0
    let velocity = 0 // px/ms
    let wheelTimer: ReturnType<typeof setTimeout> | undefined
    const clamp = (v: number) => Math.min(maxRef.current, Math.max(0, v))

    const settle = (projected: number) => {
      animate(hours, snapRef.current(clamp(projected)), SETTLE)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as Element).closest('input, [data-no-scrub]')) return
      hours.stop()
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, start: hours.get(), scrubbing: false }
      lastX = e.clientX
      lastT = e.timeStamp
      velocity = 0
    }

    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return
      const dx = e.clientX - press.x
      const dy = e.clientY - press.y
      if (!press.scrubbing) {
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
        press.scrubbing = true
        el.setPointerCapture(e.pointerId)
        el.dataset.scrubbing = ''
      }
      const dt = Math.max(1, e.timeStamp - lastT)
      velocity = velocity * 0.6 + ((e.clientX - lastX) / dt) * 0.4
      lastX = e.clientX
      lastT = e.timeStamp
      // Dragging left pulls time forward, like pulling a dial round
      hours.set(clamp(press.start - dx / pxPerHour))
    }

    const onUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return
      if (press.scrubbing) {
        delete el.dataset.scrubbing
        // Swallow the click that would otherwise land on whatever was under the finger
        const block = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', block, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', block, { capture: true }), 0)
        settle(hours.get() - (velocity * 180) / pxPerHour)
      }
      press = null
    }

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      const delta = e.deltaX
      e.preventDefault()
      hours.stop()
      hours.set(clamp(hours.get() + delta / pxPerHour))
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => settle(hours.get()), 140)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      clearTimeout(wheelTimer)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [target, hours, pxPerHour, enabled])
}
