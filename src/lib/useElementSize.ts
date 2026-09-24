import { useLayoutEffect, useState } from 'react'

/**
 * Size of an element, tracked with a ResizeObserver. Returns a callback ref,
 * so it keeps working for elements that mount later (the dial only exists
 * once a place is chosen).
 */
export function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}
