# layers.run

What to wear on your run, from the forecast for exactly when and where you're going.

Next.js (App Router), one client-rendered page, deployed on Vercel.

## Run it

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm test         # rules and feels-like tests
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `TYPESAFE_API_KEY` | `.env.local`, Vercel env | Jev refines the outfit. Without it the app runs on its rules. Server-only. |
| `NEXT_PUBLIC_ENGINE` | optional | `rules` turns Jev off. |

## How it's built

- **Weather**: Open-Meteo forecast and place search (free, keyless). Feels-like uses the NWS wind chill and heat index. Times show in the place's own time zone.
- **Outfit**: `src/engine/rulesEngine.ts` answers instantly; Jev (`/api/jev`) refines the run you settle on. Both dress by one shared "how it feels to a runner" number (`src/lib/runFeel.ts`). Answers are cached on the device and on the server.
- **Sky**: the page gradient tells the time of day and the weather (clear, cloud, fog, storm); `src/sky/` adds stars, rain, snow and lightning, moving through one shared wind.

Compare Jev with the rules on a set of runs (with the dev server running):

```sh
JEV_EVAL=1 pnpm test --reporter=verbose
```
