import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGroup, MotionConfig, animate, motion, useMotionValue, useMotionValueEvent } from 'motion/react'
import type { Place } from './types'
import { skyLabel } from './services/WeatherService'
import { useForecast } from './services/useForecast'
import { useRecommendation } from './engine/useRecommendation'
import { loadDuration, loadHinted, loadPlace, saveDuration, saveHinted, savePlace } from './lib/placeStore'
import { LocateFailure, locate, locationPermission } from './services/geolocate'
import { useElementSize } from './lib/useElementSize'
import { usePageScrub } from './lib/usePageScrub'
import { useSettled } from './lib/useSettled'
import { HOUR, MAX_HOURS_AHEAD, snapHours } from './lib/timeScale'
import { nightsAhead, skyFor, useSkyTheme } from './lib/sky'
import { useNow } from './lib/useNow'
import { clock, setZone } from './lib/zone'
import { PRESENCE, preloadWearables } from './lib/wearables'
import { detailsTop } from './lib/dialGeometry'
import { arcColor } from './lib/arcColor'
import { loadUnits, saveUnits, type Units } from './lib/units'
import { EASE, SETTLE_MOTION as SETTLE, SOFT_EASE } from './lib/motion'
import { LocationPill } from './components/LocationPill'
import { PlaceButton } from './components/PlaceButton'
import { Dial } from './components/Dial'
import { Hub } from './components/Hub'
import { WearableList } from './components/WearableList'
import { SkyParticles } from './components/SkyParticles'
import { Morph } from './components/Morph'
import { Count, Speed } from './components/Numbers'

type Phase = 'locate' | 'results'

/**
 * The page fades in beneath the pill as it arrives at the top. It doesn't
 * move; it just appears, softly, once the pill has mostly cleared it.
 */
const WITH_PILL = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.7, ease: SOFT_EASE, delay: 0.3 },
} as const

/** The reverse: the page dissolves quickly, then the pill glides down alone. */
const DISSOLVE_MS = 150
const DISSOLVE = { duration: DISSOLVE_MS / 1000, ease: 'easeOut' } as const

function changePlaceProps(leaving: boolean) {
  return leaving ? { ...WITH_PILL, animate: { opacity: 0 }, transition: DISSOLVE } : WITH_PILL
}

export default function App() {
  const [place, setPlace] = useState<Place | null>(loadPlace)
  // Straight to the dial when we already know where you run; the location
  // screen is only for choosing one
  const [phase, setPhase] = useState<Phase>(() => (loadPlace() ? 'results' : 'locate'))
  const [locating, setLocating] = useState(false)
  const [canLocate, setCanLocate] = useState(true)
  const [locateNote, setLocateNote] = useState('')
  const [hinted, setHinted] = useState(loadHinted)
  /** Going back to search: the page dissolves before the pill glides down. */
  const [leaving, setLeaving] = useState(false)
  const [hoursAhead, setHoursAhead] = useState(0)
  const [trend, setTrend] = useState<-1 | 0 | 1>(0)
  const [duration, setDuration] = useState(loadDuration)
  const [units, setUnits] = useState<Units>(loadUnits)
  const toggleUnits = () => {
    const next = units === 'metric' ? 'imperial' : 'metric'
    setUnits(next)
    saveUnits(next)
  }
  const [dialRef, dialBox] = useElementSize<HTMLDivElement>()
  const appRef = useRef<HTMLElement>(null)
  const now = useNow()
  const results = phase === 'results'

  // The run has to finish inside the forecast window
  const maxStart = MAX_HOURS_AHEAD - duration / 60
  const snap = (v: number) => snapHours(v, now, maxStart)

  // The dial and horizontal trackpad scrolls move `scrub` continuously; everything else follows its nearest detent
  const scrub = useMotionValue(0)
  useMotionValueEvent(scrub, 'change', (v) => {
    const next = snap(v)
    if (next !== hoursAhead) {
      setTrend(next > hoursAhead ? 1 : -1)
      dismissHint()
    }
    setHoursAhead(next)
  })
  useEffect(() => {
    if (scrub.get() > maxStart) animate(scrub, snapHours(maxStart, now, maxStart), SETTLE)
  }, [scrub, maxStart, now])

  useEffect(preloadWearables, [])

  const dismissHint = () => {
    if (hinted) return
    setHinted(true)
    saveHinted()
  }

  const locateMe = () => {
    setLocating(true)
    setLocateNote('')
    locate()
      .then((p) => selectPlace(p))
      .catch((err) => {
        const denied = err instanceof LocateFailure && err.reason === 'denied'
        if (denied) setCanLocate(false)
        setLocateNote(
          denied
            ? 'Location is off for this site. Search for a city instead.'
            : 'Couldn’t find you just now. Search for a city instead.',
        )
      })
      .finally(() => setLocating(false))
  }

  // First visit: if location is already allowed, just find them. Otherwise
  // wait for a tap on "Use my location", so the browser only asks when asked.
  useEffect(() => {
    if (place) return
    locationPermission().then((state) => {
      if (state === 'granted') locateMe()
      else if (state === 'denied' || state === 'unsupported') setCanLocate(false)
    })
    // Only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { forecast, failed, retry } = useForecast(place, results)
  // Every time on screen reads in the place's own time zone
  setZone(forecast?.place.timezone ?? place?.timezone)

  // Times follow the dial live; weather, outfit and sky wait for it to settle
  const settledHours = useSettled(hoursAhead, 180)
  const settledDuration = useSettled(duration, 180)
  useEffect(() => saveDuration(settledDuration), [settledDuration])
  const { state, recommendation } = useRecommendation(forecast, now, settledHours, settledDuration)

  // The sky at the start of the run paints the page and decides light or dark
  const sky = skyFor(results ? (state?.start ?? null) : null, now)
  useSkyTheme(sky)

  usePageScrub(appRef, scrub, window.innerWidth / 6, snap, maxStart, results && state !== null)

  // iOS only raises the keyboard for a focus inside the tap itself, and the
  // search box appears a moment later. Focus a stand-in now; the search box
  // takes the focus (and keeps the keyboard) when it arrives.
  const keyboard = useRef<HTMLInputElement>(null)

  const changePlace = () => {
    keyboard.current?.focus({ preventScroll: true })
    setLeaving(true)
    setTimeout(() => {
      setPhase('locate')
      setLeaving(false)
    }, DISSOLVE_MS)
  }

  const selectPlace = (p: Place) => {
    savePlace(p)
    setPlace(p)
    scrub.jump(0)
    setHoursAhead(0)
    setPhase('results')
  }

  const nights = useMemo(() => nightsAhead(forecast, now), [forecast, now])

  const start = new Date(now.getTime() + hoursAhead * HOUR)
  const end = new Date(start.getTime() + duration * 60_000)
  const shownItems = (recommendation?.decisions ?? []).filter(
    (d) => d.item !== 'none' && d.probability >= PRESENCE.drop,
  ).length
  const dialSize = Math.max(240, Math.min(dialBox.width || window.innerWidth - 32, dialBox.height || Infinity, 520))
  // UV only earns a place in the conditions line when it matters: daylight, 3+
  const peakUv =
    state && (state.start.isDay || state.end.isDay) ? Math.round(Math.max(state.start.uvIndex, state.end.uvIndex)) : 0
  const status = failed ? 'The sky isn’t answering' : !state ? 'Checking the sky…' : null

  return (
    <MotionConfig reducedMotion="user">
      <SkyParticles
        precip={sky.precip}
        intensity={sky.intensity}
        storm={sky.storm}
        stars={sky.stars}
        dark={sky.dark}
        windMph={results ? (state?.start.windSpeed ?? 0) : 0}
      />
      <LayoutGroup>
        <main ref={appRef} className="app" data-phase={phase}>
          {results && place ? (
            // Keyed so the two screens are separate elements, not one that resizes
            <div
              key="results"
              className="results"
              // On wide screens the details sit on the dial's optical centre
              style={{ ['--dial' as string]: `${dialSize}px`, ['--details-top' as string]: `${detailsTop(dialSize, shownItems)}px` }}
            >
              <header className="bar">
                <PlaceButton place={place} leaving={leaving} onClick={changePlace} />
              </header>

              {/* Arrives in step with the pill so the whole change is one motion */}
              <motion.div
                ref={dialRef}
                className="dial-wrap"
                data-loading={!state || undefined}
                {...changePlaceProps(leaving)}
              >
                <Dial
                  size={dialSize}
                  now={now}
                  start={scrub}
                  startValue={hoursAhead}
                  duration={duration}
                  onDuration={(m) => {
                    setDuration(m)
                    dismissHint()
                  }}
                  hint={!hinted && state ? ['Drag the arc', 'to plan your run'] : null}
                  warmth={{
                    start: arcColor(state?.start.apparent ?? 55, sky.dark),
                    end: arcColor(state?.end.apparent ?? 55, sky.dark),
                  }}
                  snap={snap}
                  nights={nights}
                >
                  <Hub
                    feelsLike={state ? state.start.apparent : null}
                    status={status}
                    start={start}
                    end={end}
                    minutes={duration}
                    startsNow={hoursAhead === 0}
                    tomorrow={clock(start).day !== clock(now).day}
                    trend={trend}
                    units={units}
                    onToggleUnits={toggleUnits}
                  />
                </Dial>
              </motion.div>

              <motion.div className="details" {...changePlaceProps(leaving)}>
                {/* The line is always there, holding its height; its words fade in */}
                <p className="conditions">
                  {state && (
                    <motion.span
                      className="conditions-text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, ease: EASE }}
                    >
                      <Morph>{skyLabel(state.start)}</Morph>
                      <span className="sep" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        <Speed mph={state.start.windSpeed} units={units} /> wind
                      </span>
                      {peakUv >= 3 && (
                        <>
                          <span className="sep" aria-hidden="true">
                            ·
                          </span>
                          <span>
                            UV <Count value={peakUv} />
                          </span>
                        </>
                      )}
                    </motion.span>
                  )}
                </p>
                {failed ? (
                  <motion.div
                    className="notice"
                    role="alert"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    <p className="notice-title">Couldn’t reach the forecast</p>
                    <p className="notice-body">Check your connection. Your place and run are kept.</p>
                    <button className="notice-action" onClick={retry}>
                      Try again
                    </button>
                  </motion.div>
                ) : (
                  // No skeletons: the list keeps its height and fills in when ready
                  <WearableList decisions={recommendation?.decisions ?? []} entranceDelay={0.45} />
                )}
              </motion.div>
            </div>
          ) : (
            <div key="locate" className="locate">
              <LocationPill
                place={place}
                note={locateNote}
                locating={locating}
                canLocate={canLocate}
                onLocate={locateMe}
                onSelect={selectPlace}
                startOpen={!!place}
                onCancel={place ? () => setPhase('results') : undefined}
              />
              {/* Credit, quietly: Open-Meteo's data is CC BY 4.0, and Jev picks the outfits.
                  Pressing a link keeps the search focused, so it isn't read as "tap away
                  to cancel" before the link can open. */}
              <p className="credit" onPointerDown={(e) => e.preventDefault()}>
                Weather by{' '}
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                  Open-Meteo
                </a>
                <span className="sep" aria-hidden="true">
                  {' · '}
                </span>
                Outfits by{' '}
                <a href="https://typesafe.ai/" target="_blank" rel="noreferrer">
                  Jev
                </a>
              </p>
            </div>
          )}
        </main>
      </LayoutGroup>
      <input
        ref={keyboard}
        className="keyboard-stand-in"
        aria-hidden="true"
        tabIndex={-1}
        onBlur={(e) => (e.currentTarget.value = '')}
      />
    </MotionConfig>
  )
}
