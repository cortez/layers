import { TypeSafeClient } from '@typesafe-ai/sdk'
import { DRESSING_GUIDE, jevQuestions, type JevState } from '../engine/jev/questions'

// POST /api/jev  { states: JevState[] }  →  { model, results: (answers | null)[] }
//                                         or { configured: false } without a key
//
// The app asks about one run at a time (the one you settle on). A state that
// fails comes back as null so the client falls back to rules. The API key
// never leaves the server.
//
// Every uncached question costs money, so the endpoint only answers the app
// itself: same-origin requests, a small body, at most MAX_STATES questions
// per call, and a per-visitor rate limit.
//
// Served by the Next route handler at src/app/api/jev/route.ts.

const MAX_STATES = 2
const MAX_BODY_BYTES = 4096
/** Per visitor, per warm server instance: far above what a person does. */
const RATE_LIMIT = { requests: 30, windowMs: 60_000 }
const visitors = new Map<string, number[]>()

function overLimit(visitor: string) {
  const now = Date.now()
  const recent = (visitors.get(visitor) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  recent.push(now)
  visitors.set(visitor, recent)
  if (visitors.size > 10_000) visitors.delete(visitors.keys().next().value!)
  return recent.length > RATE_LIMIT.requests
}

/**
 * A spending budget per warm server instance: new (uncached) Jev questions
 * per hour. Real use is a few dozen a day; past this the endpoint says Jev is
 * off and the app quietly runs on its rules, so abuse can't run up a bill.
 */
const HOURLY_BUDGET = Number(process.env.JEV_HOURLY_BUDGET) || 300
let budget = { hour: 0, used: 0 }
function spend(n: number) {
  const hour = Math.floor(Date.now() / 3_600_000)
  if (budget.hour !== hour) budget = { hour, used: 0 }
  if (budget.used + n > HOURLY_BUDGET) return false
  budget.used += n
  return true
}

// Only the exact shape the app sends, with every number in a real-world
// range. Anything else is refused, so the endpoint can't be used as a
// general Jev proxy or stuffed with junk.
const isNum = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const hasOnly = (o: Record<string, unknown>, keys: string[]) =>
  Object.keys(o).length === keys.length && keys.every((k) => k in o)

function validMoment(m: unknown) {
  if (!m || typeof m !== 'object') return false
  const o = m as Record<string, unknown>
  return (
    hasOnly(o, ['time', 'daylight', 'temp_f', 'feels_f', 'wind_mph', 'rain_pct', 'uv']) &&
    typeof o.time === 'string' &&
    o.time.length <= 12 &&
    typeof o.daylight === 'boolean' &&
    isNum(o.temp_f, -90, 140) &&
    isNum(o.feels_f, -130, 180) &&
    isNum(o.wind_mph, 0, 250) &&
    isNum(o.rain_pct, 0, 100) &&
    isNum(o.uv, 0, 20)
  )
}

function validState(state: unknown): state is JevState {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  if (!hasOnly(s, ['guide', 'minutes', 'feel', 'start', 'finish'])) return false
  if (s.guide !== DRESSING_GUIDE || !isNum(s.minutes, 30, 480)) return false
  const f = s.feel as Record<string, unknown>
  return (
    !!f &&
    typeof f === 'object' &&
    hasOnly(f, ['overall_f', 'coldest_f', 'warmest_f', 'sun_0_to_1', 'wet_0_to_1', 'snow', 'peak_uv', 'strong_wind']) &&
    isNum(f.overall_f, -150, 200) &&
    isNum(f.coldest_f, -150, 200) &&
    isNum(f.warmest_f, -150, 200) &&
    isNum(f.sun_0_to_1, 0, 1) &&
    isNum(f.wet_0_to_1, 0, 1) &&
    typeof f.snow === 'boolean' &&
    isNum(f.peak_uv, 0, 20) &&
    typeof f.strong_wind === 'boolean' &&
    validMoment(s.start) &&
    validMoment(s.finish)
  )
}

/** Browsers send Origin on same-origin POSTs; anything else isn't the app. */
function fromThisSite(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// Answers cached by the exact question. People asking about the same place
// and time send identical states, so one Jev call serves all of them for as
// long as this server instance stays warm.
const CACHE_TTL = 30 * 60_000
const CACHE_MAX = 5000
const answers = new Map<string, { at: number; value: unknown }>()

function cachedAnswer(key: string) {
  const hit = answers.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL) {
    answers.delete(key)
    return undefined
  }
  return hit.value
}

function cacheAnswer(key: string, value: unknown) {
  answers.set(key, { at: Date.now(), value })
  while (answers.size > CACHE_MAX) answers.delete(answers.keys().next().value!)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let cached: { key: string; client: TypeSafeClient } | null = null
function clientFor(apiKey: string) {
  if (cached?.key !== apiKey) cached = { key: apiKey, client: new TypeSafeClient({ apiKey, timeout: 8000 }) }
  return cached.client
}

export async function handleJev(request: Request, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  // Not an error: without a key the app simply runs on rules
  if (!apiKey) return json(200, { configured: false })

  if (!fromThisSite(request)) return json(403, { error: 'forbidden' })
  const visitor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (overLimit(visitor)) return json(429, { error: 'slow_down' })

  let states: JevState[]
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' })
    const body = JSON.parse(text) as { states?: JevState[] }
    states = Array.isArray(body.states) ? body.states : []
  } catch {
    return json(400, { error: 'bad_json' })
  }
  if (!states.length || states.length > MAX_STATES || !states.every(validState)) {
    return json(400, { error: 'bad_states' })
  }

  let overBudget = false
  const client = clientFor(apiKey)
  const questions = jevQuestions()
  let model = 'cache'
  const results = await Promise.all(
    states.map(async (state) => {
      const key = JSON.stringify(state)
      const hit = cachedAnswer(key)
      if (hit) return hit
      // Over budget: answer nothing new; the app falls back to its rules
      if (!spend(1)) {
        overBudget = true
        return null
      }
      try {
        const r = await client.systemOne({ state, questions }, { signal: request.signal })
        model = r.model
        cacheAnswer(key, r.answers)
        return r.answers
      } catch (err) {
        console.warn('[jev]', (err as Error).message)
        return null
      }
    }),
  )
  // Out of budget: tell the app Jev is off so it stops asking this visit
  if (overBudget && results.every((r) => r === null)) return json(200, { configured: false })
  if (results.every((r) => r === null)) return json(502, { error: 'upstream_failed' })
  return json(200, { model, results })
}
