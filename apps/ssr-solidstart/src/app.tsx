import { A, Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { ThemeProvider } from '@iris-ui-kit/solid'
import { createThemeStore } from '@iris-ui-kit/theme'
import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'
import { Suspense, type JSX } from 'solid-js'

const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

function AppShell(props: { children?: JSX.Element }) {
  return (
    <ThemeProvider store={themeStore}>
      <div
        style={{
          'min-height': '100vh',
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
        }}
      >
        <header
          style={{
            'border-block-end': '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          <div
            style={{
              'max-width': '880px',
              margin: '0 auto',
              padding: '18px 24px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
              gap: '16px',
              'flex-wrap': 'wrap',
            }}
          >
            <A
              href="/"
              style={{
                color: 'var(--iris-foreground)',
                'font-weight': 700,
                'text-decoration': 'none',
              }}
            >
              Iris UI · SolidStart
            </A>
            <nav aria-label="Primary navigation" style={{ display: 'flex', gap: '18px' }}>
              <A href="/" end>
                Overview
              </A>
              <A href="/data">Server data</A>
              <A href="/feedback">Feedback</A>
            </nav>
          </div>
        </header>
        <main style={{ 'max-width': '880px', margin: '0 auto', padding: '40px 24px' }}>
          <Suspense>{props.children}</Suspense>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <Router root={(props) => <AppShell>{props.children}</AppShell>}>
      <FileRoutes />
    </Router>
  )
}
