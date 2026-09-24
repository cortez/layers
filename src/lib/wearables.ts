import type { ItemId, Zone } from '../types'

export const ZONE_ORDER: Zone[] = ['head', 'eyes', 'top', 'bottom', 'hands', 'extras']

export const ITEM_NAMES: Record<ItemId, string> = {
  none: 'None',
  cap: 'Cap',
  visor: 'Visor',
  headband: 'Headband',
  beanie: 'Beanie',
  sunglasses: 'Sunglasses',
  singlet: 'Singlet',
  tee: 'Tee',
  'long-sleeve': 'Long sleeve',
  'long-sleeve-vest': 'Long sleeve + vest',
  jacket: 'Jacket',
  'rain-shell': 'Rain shell',
  shorts: 'Shorts',
  'half-tights': 'Half tights',
  tights: 'Tights',
  'tights-shorts': 'Tights + shorts',
  'light-gloves': 'Light gloves',
  mittens: 'Mittens',
  sunscreen: 'Sunscreen',
  'neck-gaiter': 'Neck gaiter',
}

export const ZONE_ITEMS: Record<Zone, ItemId[]> = {
  head: ['none', 'cap', 'visor', 'headband', 'beanie'],
  eyes: ['none', 'sunglasses'],
  top: ['singlet', 'tee', 'long-sleeve', 'long-sleeve-vest', 'jacket', 'rain-shell'],
  bottom: ['shorts', 'half-tights', 'tights', 'tights-shorts'],
  hands: ['none', 'light-gloves', 'mittens'],
  extras: ['none', 'sunscreen', 'neck-gaiter'],
}

export const PRESENCE = {
  /** Below this, an item isn't worn. */
  drop: 0.4,
  /** Below this (and above drop), an item is optional. */
  optional: 0.65,
}

/** Product image for a wearable, served from public/wearables. */
export const wearableImage = (item: ItemId) => `/wearables/${item}.webp`

/** Warm the cache so garments never pop in when the outfit changes. */
export function preloadWearables() {
  for (const items of Object.values(ZONE_ITEMS)) {
    for (const item of items) {
      if (item === 'none') continue
      const img = new Image()
      img.decoding = 'async'
      img.src = wearableImage(item)
    }
  }
}
