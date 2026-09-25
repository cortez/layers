import { useEffect, useRef } from 'react'
import { animate, type MotionValue } from 'motion/react'

// Released with momentum: a spring carries the fling's speed into the detent
const SETTLE = { type: 'spring', stiffness: 260, damping: 34 } as const

/**
 * Horizontal wheel/trackpad scrolling over `target` moves the run's start
 * time, settling on the nearest detent once the scroll stops. Touch and mouse
 * drags are left alone: only the dial itself is draggable.
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

    let wheelTimer: ReturnType<typeof setTimeout> | undefined
    const clamp = (v: number) => Math.min(maxRef.current, Math.max(0, v))

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      const delta = e.deltaX
      e.preventDefault()
      hours.stop()
      hours.set(clamp(hours.get() + delta / pxPerHour))
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => animate(hours, snapRef.current(clamp(hours.get())), SETTLE), 140)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      clearTimeout(wheelTimer)
      el.removeEventListener('wheel', onWheel)
    }
  }, [target, hours, pxPerHour, enabled])
}
