import { TextMorph } from 'torph/react'
import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties, ElementType } from 'react'
import { EASE, MORPH_DURATION, MORPH_EASE } from '../lib/motion'

// Every changing string in the app goes through here. Under reduced motion
// the morph becomes a plain crossfade.

interface MorphProps {
  children: string
  className?: string
  style?: CSSProperties
  as?: ElementType
}

export function Morph({ children, className, style, as = 'span' }: MorphProps) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <motion.span
        key={children}
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {children}
      </motion.span>
    )
  }
  return (
    <TextMorph as={as} className={className} style={style} ease={MORPH_EASE}
      duration={MORPH_DURATION} respectReducedMotion={false}>
      {children}
    </TextMorph>
  )
}
