import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Decision } from '../types'
import { ITEM_NAMES, PRESENCE, wearableImage } from '../lib/wearables'
import { SOFT_EASE, TILE_MOTION } from '../lib/motion'
import { WearableIcon } from './icons'
import { Morph } from './Morph'

/** The garment's product image, or its line icon if the image can't load. */
function Garment({ item }: { item: Decision['item'] }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <WearableIcon item={item} />
  return (
    <img
      className="tile-img"
      src={wearableImage(item)}
      alt=""
      width={48}
      height={48}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

/** Runner-up worth mentioning, e.g. "or tee". */
const RUNNER_UP = 0.25

interface WearableTileProps {
  decision: Decision
  /** Seconds before fading in. */
  delay: number
  /** Fading out in place before the list changes shape. */
  leaving: boolean
}

export function WearableTile({ decision, delay, leaving }: WearableTileProps) {
  const optional = decision.probability < PRESENCE.optional
  const name = ITEM_NAMES[decision.item]
  const runnerUp = decision.alternatives?.[0]
  const hint = optional
    ? 'Optional'
    : runnerUp && runnerUp.probability >= RUNNER_UP
      ? `or ${ITEM_NAMES[runnerUp.item].toLowerCase()}`
      : ''

  return (
    <motion.li
      className="wear"
      data-optional={optional || undefined}
      // Rows never slide: they settle in with a soft fade and the faintest
      // growth, and fade out in place before the list changes shape
      initial={{ opacity: 0, scale: 0.97 }}
      animate={
        leaving
          ? { opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: 'easeOut' } }
          : { opacity: 1, scale: 1, transition: { duration: 0.6, ease: SOFT_EASE, delay } }
      }
    >
      <span className="tile" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={decision.item}
            className="tile-icon"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={TILE_MOTION}
          >
            <Garment item={decision.item} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="wear-text">
        <Morph className="wear-name">{name}</Morph>
        <AnimatePresence initial={false}>
          {hint && (
            <motion.span
              className="wear-hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={TILE_MOTION}
            >
              <Morph>{hint}</Morph>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.li>
  )
}
