'use client'

import dynamic from 'next/dynamic'

// The whole app reads the screen, saved settings, the clock and the sky, so
// it renders in the browser only, as one page.
const App = dynamic(() => import('../App'), { ssr: false })

export default function Page() {
  return <App />
}
