import type { Decision, RunState } from '../types'

export interface RecommendationEngine {
  readonly id: string
  recommend(state: RunState): Decision[] | Promise<Decision[]>
  /** False once the engine knows it can't answer (e.g. no API key). */
  available?(): boolean
}
