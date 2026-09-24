import { handleJev } from '../../../server/jev'

// POST /api/jev. Set TYPESAFE_API_KEY (server-only); without it the app runs
// on rules. The handler keeps a warm-instance cache of Jev's answers.
export function POST(request: Request) {
  return handleJev(request, process.env.TYPESAFE_API_KEY)
}
