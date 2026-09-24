import { useEffect, useMemo, useState } from 'react'
import type { Decision } from '../types'
import { PRESENCE, ZONE_ITEMS, ZONE_ORDER } from '../lib/wearables'
import { WearableTile } from './WearableTile'

const STAGGER = 0.06
/** How long leaving rows take to fade before the new layout commits. */
const FADE_OUT_MS = 200

/**
 * Rows are keyed by zone, not item: when the top changes from tee to long
 * sleeve the row stays where it is and just updates.
 */
const rowKey = (d: Decision) => (d.zone === 'extras' ? `extras:${d.item}` : d.zone)

/** A row in a particular place in the grid. */
const slotKey = (d: Decision, index: number) => `${rowKey(d)}@${index}`

function order(d: Decision) {
  return ZONE_ORDER.indexOf(d.zone) * 10 + ZONE_ITEMS[d.zone].indexOf(d.item)
}

interface Shown {
  layout: string
  rows: Decision[]
  delays: Map<string, number>
}

/**
 * Nothing ever slides over anything else. When the outfit changes shape,
 * rows that are leaving or moving fade out in place first; then the new
 * layout commits and new or moved rows fade in where they belong. Rows that
 * keep their place never move at all.
 */
export function WearableList({ decisions, entranceDelay = 0 }: { decisions: Decision[]; entranceDelay?: number }) {
  const rows = useMemo(
    () =>
      decisions
        .filter((d) => d.item !== 'none' && d.probability >= PRESENCE.drop)
        .sort((a, b) => order(a) - order(b)),
    [decisions],
  )
  const layout = rows.map(slotKey).join('|')

  // What's on screen, and which of its slots are fading out
  const [shown, setShown] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState<{ layout: string; slots: Set<string> } | null>(null)

  if (shown === null || shown.rows.length === 0) {
    // First paint: everything fades in, in order
    if (rows.length && shown?.layout !== layout) {
      const delays = new Map<string, number>()
      rows.forEach((d, i) => delays.set(slotKey(d, i), entranceDelay + STAGGER * i))
      setShown({ layout, rows, delays })
    } else if (shown === null) setShown({ layout, rows, delays: new Map() })
  } else if (shown.layout === layout) {
    // Same slots, fresh details (an item within a zone, a probability)
    if (shown.rows !== rows) setShown({ ...shown, rows })
  } else if (leaving?.layout !== layout) {
    // The shape changed: fade out whatever won't be in the same place
    const next = new Set(rows.map(slotKey))
    setLeaving({ layout, slots: new Set(shown.rows.map(slotKey).filter((k) => !next.has(k))) })
  }

  // Once the leavers have faded, commit the new layout; newcomers fade in
  useEffect(() => {
    if (!leaving || !shown || shown.layout === leaving.layout) return
    const t = setTimeout(() => {
      const before = new Set(shown.rows.map(slotKey))
      const delays = new Map<string, number>()
      let entering = 0
      rows.forEach((d, i) => {
        const k = slotKey(d, i)
        delays.set(k, before.has(k) ? 0 : STAGGER * entering++)
      })
      setShown({ layout, rows, delays })
      setLeaving(null)
    }, FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [leaving, shown, rows, layout])

  return (
    <ul className="wear-list" aria-label="What to wear">
      {(shown?.rows ?? []).map((d, i) => {
        const k = slotKey(d, i)
        return (
          <WearableTile key={k} decision={d} delay={shown?.delays.get(k) ?? 0} leaving={leaving?.slots.has(k) ?? false} />
        )
      })}
    </ul>
  )
}
