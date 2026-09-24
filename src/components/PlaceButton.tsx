import { motion } from 'motion/react'
import type { Place } from '../types'
import { GLIDE, SOFT_EASE } from '../lib/motion'
import { regionFor } from '../lib/placeStore'

/**
 * The location pill, settled at the top. It glides here from the middle of
 * the screen as one shape; its words fade in as it arrives. Tap to change.
 */
interface PlaceButtonProps {
  place: Place
  /** Heading back to search: the words dissolve before the pill glides down. */
  leaving: boolean
  onClick(): void
}

export function PlaceButton({ place, leaving, onClick }: PlaceButtonProps) {
  return (
    <motion.button
      layoutId="core"
      className="place"
      style={{ borderRadius: 999 }}
      transition={GLIDE}
      onClick={onClick}
      aria-label={`${place.name}, ${place.region}. Change location`}
    >
      <motion.span
        layout="position"
        className="place-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{
          opacity: leaving ? { duration: 0.15, ease: 'easeOut' } : { duration: 0.45, ease: SOFT_EASE, delay: 0.35 },
        }}
      >
        <span className="place-name">{place.name}</span>
        {regionFor(place) && <span className="place-region">{regionFor(place)}</span>}
      </motion.span>
    </motion.button>
  )
}
