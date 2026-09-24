import type { ItemId } from '../types'

// One grid (24), one stroke (1.5), rounded caps and joins. Every wearable
// is drawn at the same optical size: roughly a 17×17 live area.

const LONG_SLEEVE =
  'M8.5 4 5.6 5.2C4.4 5.7 3.7 6.8 3.6 8.1L3.2 19H6l1-9.5V20h10V9.5l1 9.5h2.8l-.4-10.9c-.1-1.3-.8-2.4-2-2.9L15.5 4c-.5 1.4-1.9 2.2-3.5 2.2S9 5.4 8.5 4Z'
const TIGHTS = 'M7 3.5h10l.6 17h-3.4L12 9.5l-2.2 11H6.4Z'

const PATHS: Record<Exclude<ItemId, 'none'>, string[]> = {
  cap: ['M5 15a7 7 0 0 1 14 0', 'M5 15h15.5', 'M12 8V7'],
  visor: ['M6.5 11.5a5.5 2.6 0 0 1 11 0', 'M6.5 11.5v1.2', 'M17.5 11.5v1.2', 'M4 13.6c2.6 3 13.4 3 16 0-2.1-1-4.6-1.5-8-1.5s-5.9.5-8 1.5Z'],
  headband: [
    'M4 10.5C4 9.1 7.6 8 12 8s8 1.1 8 2.5v3c0 1.4-3.6 2.5-8 2.5s-8-1.1-8-2.5Z',
    'M4 10.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
  ],
  beanie: ['M6 14a6 6 0 0 1 12 0', 'M5 14h14v3.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z', 'M9.5 14v4.5', 'M14.5 14v4.5', 'M12 7.9V7.5'],
  sunglasses: [
    'M3.5 10h7v2.5a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3Z',
    'M13.5 10h7v2.5a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3Z',
    'M10.5 11c.9-.6 2.1-.6 3 0',
  ],
  singlet: [
    'M9 3.5V5c0 2.2-1.3 3.5-2.5 4.5V20h11V9.5C16.3 8.5 15 7.2 15 5V3.5',
    'M9 5c.8 1.6 1.9 2.4 3 2.4s2.2-.8 3-2.4',
  ],
  tee: ['M8.5 4 5 5.5 2.8 10l2.8 1.4L7 9v11h10V9l1.4 2.4 2.8-1.4L19 5.5 15.5 4c-.5 1.4-1.9 2.2-3.5 2.2S9 5.4 8.5 4Z'],
  'long-sleeve': [LONG_SLEEVE],
  'long-sleeve-vest': [LONG_SLEEVE, 'M7 10c1.4-.2 2-1.4 2-3', 'M17 10c-1.4-.2-2-1.4-2-3', 'M12 6.2V20'],
  jacket: [LONG_SLEEVE, 'M12 6.2V20', 'M9.5 3.6 12 6.2l2.5-2.6'],
  'rain-shell': [LONG_SLEEVE, 'M12 6.2V20', 'M8.5 4.1C8.5 2.6 10 1.8 12 1.8s3.5.8 3.5 2.3'],
  shorts: ['M5.5 5h13L20 15h-6l-2-5.5-2 5.5H4Z', 'M5.2 7.2h13.6'],
  'half-tights': ['M6.5 4h11l.6 12.5h-4.2L12 9l-1.9 7.5H5.9Z', 'M6.4 6.2h11.2'],
  tights: [TIGHTS, 'M7 5.7h10'],
  'tights-shorts': [TIGHTS, 'M6.8 12h3.9', 'M13.3 12h4'],
  'light-gloves': [
    'M8 17.5 5.3 12.9c-.6-1-.2-2.2.8-2.6.9-.4 1.8 0 2.3.8L9 12V5.5a1.1 1.1 0 0 1 2.2 0V4.5a1.1 1.1 0 0 1 2.2 0v.7a1.1 1.1 0 0 1 2.2 0v2a1.1 1.1 0 0 1 2.2 0V13c0 2-.7 3.4-1.6 4.5Z',
    'M11.2 5.5V10',
    'M13.4 4.5V10',
    'M15.6 5.2v5.3',
    'M8 17.5V21h8.2v-3.5',
  ],
  mittens: [
    'M8 17.5 5.3 12.9c-.6-1-.2-2.2.8-2.6.9-.4 1.8 0 2.3.8L9 12V7.5a3.9 3.9 0 0 1 7.8 0V13c0 2-.6 3.4-1.4 4.5Z',
    'M8 17.5V21h7.4v-3.5',
  ],
  sunscreen: [
    'M6.5 3.5h11',
    'M7 3.5 8.6 17h6.8L17 3.5',
    'M9.5 17h5v3.3a.7.7 0 0 1-.7.7h-3.6a.7.7 0 0 1-.7-.7Z',
    'M12 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z',
  ],
  'neck-gaiter': [
    'M7 5c0 1 2.2 1.8 5 1.8S17 6 17 5s-2.2-1.8-5-1.8S7 4 7 5Z',
    'M7 5v13c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V5',
    'M7 11.5c0 1 2.2 1.8 5 1.8s5-.8 5-1.8',
  ],
}

export function WearableIcon({ item, size = 24 }: { item: ItemId; size?: number }) {
  if (item === 'none') return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[item].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
