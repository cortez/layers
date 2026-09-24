// Geometry shared by the dial and the layout around it.

/** Ring thickness scales with the dial: slimmer on a phone, 36px at most. */
export const thicknessFor = (size: number) => Math.round(Math.min(36, Math.max(22, size * 0.07)))
/** Room outside the ring for the clock labels. */
export const LABEL_ROOM = 30

/** The outfit list's rows: 56px tiles with 14px between (.wear-list). */
const ROW = 56
const ROW_GAP = 14
/** The conditions line and the space under it (.conditions, .details gap). */
const CONDITIONS = 13 * 1.4 + 24

/**
 * Top padding that centres the details (conditions plus the visible rows)
 * on the dial's optical centre. The ring is open at the bottom, so its
 * visual weight sits a little above the middle of its box.
 */
export function detailsTop(size: number, items: number) {
  const rows = Math.max(1, Math.ceil(items / 2))
  const block = CONDITIONS + rows * ROW + (rows - 1) * ROW_GAP
  const opticalCentre = size * 0.47
  return Math.max(0, opticalCentre - block / 2)
}
