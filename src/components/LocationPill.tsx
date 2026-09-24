import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Place } from '../types'
import { weatherService } from '../services/WeatherService'
import { GLIDE, SOFT_EASE, UI_MOTION } from '../lib/motion'
import { Morph } from './Morph'
import { regionFor } from '../lib/placeStore'

const SLOTS = 5
/** How long typing must pause, with nothing matching, before saying so. */
const NOT_FOUND_AFTER = 700
/**
 * Picking a place is deliberately simple: the search quietly dissolves, then
 * the pill alone glides to the top and the place fades in there. One thing
 * moves; everything else only fades.
 */
const DISSOLVE_MS = 150
const DISSOLVE = { duration: DISSOLVE_MS / 1000, ease: 'easeOut' } as const

/** Text that arrives in a pill once it has (nearly) stopped moving. */
const ARRIVE = { duration: 0.4, ease: SOFT_EASE, delay: 0.3 } as const

interface LocationPillProps {
  /** The current place, when changing it; the pill shows it until tapped. */
  place: Place | null
  /** A calm, one-line note shown under the pill, e.g. after geolocation is denied. */
  note?: string
  /** Geolocation is in progress. */
  locating: boolean
  /** Offer "Use my location" (not denied, supported). */
  canLocate: boolean
  onLocate(): void
  onSelect(place: Place): void
  /** Open straight into an empty, focused search (changing an existing place). */
  startOpen?: boolean
  /** Leave without changing anything: Escape, or tapping away before typing. */
  onCancel?(): void
}

export function LocationPill({
  place,
  note,
  locating,
  canLocate,
  onLocate,
  onSelect,
  startOpen = false,
  onCancel,
}: LocationPillProps) {
  const [open, setOpen] = useState(startOpen)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  /** The query those results answered, so they're only kept while refining it. */
  const [resultsFor, setResultsFor] = useState('')
  const [status, setStatus] = useState('')
  /** A search that's taking a moment: the pill breathes instead of saying so. */
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  /** Only highlight a row once the arrow keys are in use; touch never sees it. */
  const [keyed, setKeyed] = useState(false)
  /** A place just picked: the search is dissolving before the pill glides away. */
  const [chosen, setChosen] = useState<Place | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const controller = new AbortController()
    // Only show that we're searching if it's taking a moment; fast answers don't flicker
    const slow = setTimeout(() => setBusy(true), 320)
    let notFound: ReturnType<typeof setTimeout> | undefined
    const t = setTimeout(async () => {
      try {
        const found = await weatherService.searchPlaces(q, controller.signal)
        clearTimeout(slow)
        setBusy(false)
        if (found.length) {
          setResults(found)
          setResultsFor(q.toLowerCase())
          setActive(0)
          setKeyed(false)
          setStatus('')
          return
        }
        // Nothing matched *yet*: mid-word, keep the last matches and say
        // nothing. Only once typing has paused, and the query is long enough
        // to mean something, is it truly not found.
        if (q.length < 3) return
        notFound = setTimeout(() => {
          setResults([])
          setStatus(`Nowhere called “${q}”. Try a nearby city.`)
        }, NOT_FOUND_AFTER)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        clearTimeout(slow)
        setBusy(false)
        setResults([])
        setStatus('Can’t reach the map right now. Try again in a moment.')
      }
    }, 180)
    return () => {
      clearTimeout(t)
      clearTimeout(slow)
      clearTimeout(notFound)
      setBusy(false)
      controller.abort()
    }
  }, [query])

  // Changing an existing place can be abandoned: back to it, untouched
  const dismiss = () => (onCancel ? onCancel() : close())

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })
  useEffect(() => {
    if (!chosen) return
    const t = setTimeout(() => onSelectRef.current(chosen), DISSOLVE_MS)
    return () => clearTimeout(t)
  }, [chosen])

  const choose = (p: Place) => setChosen(p)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') dismiss()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      // The first press selects the first row; later presses move down
      if (!keyed) setKeyed(true)
      else setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setKeyed(true)
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault()
      choose(shown[active])
    }
  }

  // Changing place and "Use my location" failed: go straight back to the
  // search box, with the reason under it, rather than a closed pill
  const searchOpen = open || (!!onCancel && !!note && !locating)
  const searching = searchOpen && query.trim() !== ''
  // Earlier matches stay up only while refining the same word (adding or
  // deleting letters), never under something new
  const typed = query.trim().toLowerCase()
  const refining = typed.startsWith(resultsFor) || resultsFor.startsWith(typed)
  const shown = searching && refining ? results : []
  // While locating, the pill says so, never the old place (that reads as done)
  const settled = !searchOpen && !locating ? place : null
  const message = open ? (searching ? status : '') : note
  const expanded = shown.length > 0

  return (
    <div className="pill-anchor">
      <motion.div
        layoutId="core"
        className="pill"
        data-open={searchOpen || undefined}
        data-busy={(busy && searchOpen) || undefined}
        data-place={settled ? '' : undefined}
        style={{ borderRadius: 999 }}
        transition={GLIDE}
      >
        {searchOpen ? (
          // Not layout-animated: it stays invisible while the pill grows, then
          // fades in already in its final place, so the placeholder never slides
          <motion.input
            ref={inputRef}
            className="pill-input"
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search a city"
            aria-label="Search for a place"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // A new keystroke means it isn't settled yet: drop any "not found"
              setStatus('')
            }}
            onKeyDown={onKeyDown}
            onBlur={() => !query && dismiss()}
            initial={{ opacity: 0 }}
            animate={{ opacity: chosen ? 0 : 1 }}
            transition={chosen ? DISSOLVE : { duration: 0.25, ease: 'easeOut', delay: 0.45 }}
          />
        ) : settled ? (
          <button className="pill-button pill-place" onClick={() => setOpen(true)}>
            <motion.span className="pill-place-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ARRIVE}>
              <span className="place-name">{settled.name}</span>
              {regionFor(settled) && <span className="place-region">{regionFor(settled)}</span>}
            </motion.span>
          </button>
        ) : (
          <motion.button
            className="pill-button"
            onClick={() => setOpen(true)}
            disabled={locating}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut', delay: 0.3 }}
          >
            <Morph>{locating ? 'Finding you…' : 'Where are you running?'}</Morph>
          </motion.button>
        )}
      </motion.div>

      <div className="pill-below">
        <AnimatePresence initial={false}>
          {canLocate && !locating && !searching && !chosen && (
            <motion.button
              className="locate-me"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
              // Keep the input's focus so it doesn't close under the tap first
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                close()
                onLocate()
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 4 4 10.5l7 2.5 2.5 7Z" />
              </svg>
              Use my location
            </motion.button>
          )}
        </AnimatePresence>
        <ul id={listId} role="listbox" aria-label="Places" className="suggestions">
          {Array.from({ length: SLOTS }, (_, i) => {
            const p = shown[i]
            return (
              <li
                key={i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-hidden={!p}
                className="suggestion"
                data-active={(keyed && p && i === active) || undefined}
                onPointerDown={(e) => {
                  // Keep focus in the input so blur doesn't close the pill first
                  e.preventDefault()
                  if (p) choose(p)
                }}
              >
                <motion.span
                  className="suggestion-text"
                  animate={{ opacity: chosen ? 0 : 1 }}
                  transition={chosen ? DISSOLVE : { duration: 0.2 }}
                >
                  <Morph>{p ? p.name : ''}</Morph>
                  {(!p || p.region) && <Morph className="suggestion-region">{p ? p.region : ''}</Morph>}
                </motion.span>
              </li>
            )
          })}
        </ul>
        <AnimatePresence>
          {message && (
            <motion.p
              className="pill-note"
              role="status"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={UI_MOTION}
            >
              <Morph>{message}</Morph>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
