/**
 * The app's representative @iris-ui/solid composition, factored into a single
 * tree that BOTH the server renderer and the client hydrator import, so the
 * SSR markup and the hydrated tree are byte-for-byte the same component graph.
 *
 * It mirrors the real route (`src/routes/index.tsx`) — ThemeProvider wrapping
 * Button / Input / Badge / Table — but omits the portal-based IrisDialog. A
 * portal renders to `document.body` (a detached subtree), so it is not part of
 * the in-flow SSR string a container hydrate reconciles against; including it
 * would test the portal machinery, not the page composition. Every other
 * element the route renders is present here.
 *
 * This module is imported in two compile targets by `hydration.test.tsx`:
 *   - SSR  (generate:'ssr', hydratable) via Vite's ssrLoadModule → renderToString
 *   - client (generate:'dom', hydratable) via the jsdom test's own import → hydrate
 * vite-plugin-solid (configured `ssr:true`) selects the target per transform,
 * and both targets share the same `data-hk` hydration-key scheme, which is what
 * lets hydrate() reconcile with the server markup with no mismatch.
 */
import { ThemeProvider, IrisButton, IrisInput, IrisBadge, IrisTable } from '@iris-ui/solid'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'
import type { JSX } from 'solid-js'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]

// A single shared store instance keeps the theme css-var output identical
// across the server render and the client hydrate.
const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export function IrisTree(): JSX.Element {
  return (
    <ThemeProvider store={themeStore}>
      <main style={{ 'max-width': '880px', margin: '0 auto', padding: '40px 24px' }}>
        <header style={{ 'margin-bottom': '24px' }}>
          <h1 style={{ margin: '0 0 4px', 'font-size': '24px' }}>Iris UI · SolidStart SSR smoke</h1>
          <p style={{ margin: 0 }}>Server-rendered page built from @iris-ui/solid.</p>
        </header>

        <section style={{ display: 'grid', gap: '24px' }}>
          <div
            style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'flex-wrap': 'wrap' }}
          >
            <IrisButton variant="solid">Primary action</IrisButton>
            <IrisInput value="" placeholder="Type your name…" style={{ 'max-width': '240px' }} />
            <IrisBadge tone="primary" variant="solid">
              live badge
            </IrisBadge>
          </div>

          <div>
            <h2 style={{ 'font-size': '16px', margin: '0 0 8px' }}>Team</h2>
            <IrisTable columns={columns} data={rows} rowKey="id" />
          </div>
        </section>
      </main>
    </ThemeProvider>
  )
}
