import type { ReactNode } from 'react'
import './globals.css'

// Root layout — a Server Component (no 'use client'). It must server-render
// without touching any browser globals; if any @iris-ui import reached for
// `document`/`window` at module-eval time, this RSC render would crash the
// build. That it doesn't is part of the proof.
export const metadata = {
  title: 'Iris UI — Next.js App Router SSR/RSC smoke',
  description: '@iris-ui-kit/react rendered through a real meta-framework SSR pipeline',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
