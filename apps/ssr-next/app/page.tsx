import { Demo } from './Demo'

// This page is a SERVER COMPONENT (note: no 'use client' directive). It runs on
// the server during `next build` / request time and renders a CLIENT component
// (`Demo`). The fact that a Server Component can import @iris-ui-kit/react's client
// components transitively — without a manual wrapper — exercises the package's
// `'use client'` boundary that tsup injects into every entry.
export default function Page() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Iris UI · SSR / RSC smoke</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground, #666)' }}>
          Server Component (<code>app/page.tsx</code>) rendering a client island (
          <code>app/Demo.tsx</code>) built from <code>@iris-ui-kit/react</code>. A successful{' '}
          <code>next build</code> is the SSR/RSC-compat proof.
        </p>
      </header>
      <Demo />
    </main>
  )
}
