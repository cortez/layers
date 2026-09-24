import type { Transition } from 'motion/react'

// One curve for things that move or change shape: a steep, precise in-out.
// It needs a little more time than a gentle ease to read as smooth, so
// durations sit between 0.4 and 0.7s. Things that follow a finger (the dial
// arc, swipe momentum) stay physical, and values changing in place settle
// with a decelerating curve (below).

export const EASE = [0.86, 0, 0.07, 1] as const

/** Outfit rows entering, leaving, and reflowing. */
export const TILE_MOTION: Transition = { type: 'tween', ease: EASE, duration: 0.55 }

/** Small UI: panels, notes, hints. */
export const UI_MOTION: Transition = { type: 'tween', ease: EASE, duration: 0.4 }

/** The run's start gliding to its detent after a drag or key press. */
export const SETTLE_MOTION: Transition = { type: 'tween', ease: EASE, duration: 0.5 }

/**
 * Values changing in place (the temperature rolling, a word morphing) settle
 * rather than snap, so they use a decelerating curve instead.
 */
export const SETTLE_EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** TextMorph, for every changing string. */
export const MORPH_EASE = SETTLE_EASE_CSS
export const MORPH_DURATION = 450

/** NumberFlow digit rolls. */
export const SPIN_TIMING = { duration: 520, easing: SETTLE_EASE_CSS }

/**
 * The calmest move in the app: the location pill gliding between the middle
 * of the screen and the top. Quick to leave, long soft arrival.
 */
export const GLIDE: Transition = { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.9 }

/** A soft settle for things fading into place. */
export const SOFT_EASE = [0.22, 1, 0.36, 1] as const
