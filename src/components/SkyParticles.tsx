import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { SkyEngine, type SkyParams } from '../sky/engine'

// Hosts the weather engine: a full-screen canvas behind the page and the
// lightning overlay. Under reduced motion the engine paints a still frame
// whenever the weather changes instead of running a loop.

export function SkyParticles(props: SkyParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SkyEngine | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.set(props)
    if (reduced) engine.frame(performance.now(), 0, true)
  })

  useEffect(() => {
    const engine = new SkyEngine(canvasRef.current!, flashRef.current)
    engineRef.current = engine
    engine.set(props)

    const onResize = () => {
      engine.resize()
      if (reduced) engine.frame(performance.now(), 0, true)
    }
    window.addEventListener('resize', onResize)

    if (reduced) {
      engine.frame(performance.now(), 0, true)
      return () => {
        engineRef.current = null
        window.removeEventListener('resize', onResize)
      }
    }

    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      // rAF timestamps can trail performance.now() on the first frame
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      engine.frame(t, dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      engineRef.current = null
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // The engine is built once per motion preference; props flow in above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  return (
    <div className="sky-fx" aria-hidden="true">
      <canvas ref={canvasRef} className="sky-canvas" />
      <div ref={flashRef} className="sky-flash" />
    </div>
  )
}
