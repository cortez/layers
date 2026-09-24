export type Zone = 'head' | 'eyes' | 'top' | 'bottom' | 'hands' | 'extras'

export type ItemId =
  | 'none'
  | 'cap'
  | 'visor'
  | 'headband'
  | 'beanie'
  | 'sunglasses'
  | 'singlet'
  | 'tee'
  | 'long-sleeve'
  | 'long-sleeve-vest'
  | 'jacket'
  | 'rain-shell'
  | 'shorts'
  | 'half-tights'
  | 'tights'
  | 'tights-shorts'
  | 'light-gloves'
  | 'mittens'
  | 'sunscreen'
  | 'neck-gaiter'

export interface Place {
  id: string
  name: string
  region: string
  latitude: number
  longitude: number
  timezone?: string
}

/** One hour of forecast, imperial units (°F, mph, in). */
export interface WeatherSample {
  time: Date
  temperature: number
  apparent: number
  dewPoint: number
  windSpeed: number
  windGust: number
  precipProbability: number // 0-100
  precipitation: number // in/hr
  uvIndex: number
  cloudCover: number // 0-100
  isDay: boolean
  weatherCode: number // WMO
}

export interface Forecast {
  place: Place
  hours: WeatherSample[]
}

export interface RunState {
  /** Conditions at the start of the run. */
  start: WeatherSample
  /** Conditions at the end of the run. */
  end: WeatherSample
  durationMin: number
}

export interface Decision {
  zone: Zone
  item: ItemId
  /**
   * 0-1 presence: how sure we are this item belongs on the runner.
   * Below ~0.4 the item is dropped; 0.4-0.65 is shown as optional.
   */
  probability: number
  /** Other items for this zone with their probabilities, most likely first. */
  alternatives?: { item: ItemId; probability: number }[]
}

export interface Recommendation {
  decisions: Decision[]
}


