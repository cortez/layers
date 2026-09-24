import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

const description = 'What to wear on your run, from the forecast for exactly when and where you’re going.'

const OG_IMAGE = 'https://rstr.in/mo3ymucdlps90r/layers/4AE_JSn8R1L'

export const metadata: Metadata = {
  metadataBase: new URL('https://layers.run'),
  title: 'Layers',
  description,
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'layers.run',
    title: 'Layers',
    description,
    images: [{ url: OG_IMAGE, width: 2400, height: 1260, alt: 'Layers, with running gear around it on a clear sky' }],
  },
  twitter: { card: 'summary_large_image', title: 'Layers', description, images: [OG_IMAGE] },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
}

const FONTS = 'https://cdn.cortez.io/fonts'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdn.cortez.io" crossOrigin="" />
        <link rel="preconnect" href="https://api.open-meteo.com" crossOrigin="" />
        <link rel="preconnect" href="https://geocoding-api.open-meteo.com" crossOrigin="" />
        <link rel="preload" href={`${FONTS}/PPNeueMontreal-Book.otf`} as="font" type="font/otf" crossOrigin="" />
        <link rel="preload" href={`${FONTS}/PPNeueMontreal-Regular.otf`} as="font" type="font/otf" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  )
}
