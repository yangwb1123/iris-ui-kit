<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ThemeProvider } from '@iris-ui-kit/svelte'
  import { createThemeStore } from '@iris-ui-kit/theme'
  import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'

  let { children }: { children: Snippet } = $props()

  const themeStore = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })
</script>

<ThemeProvider store={themeStore}>
  <div style="min-height:100vh;background:var(--iris-background);color:var(--iris-foreground)">
    <header style="border-block-end:1px solid var(--iris-border);background:var(--iris-surface)">
      <div
        style="max-width:880px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"
      >
        <a href="/" style="color:var(--iris-foreground);font-weight:700;text-decoration:none">
          Iris UI · SvelteKit
        </a>
        <nav aria-label="Primary navigation" style="display:flex;gap:18px">
          <a href="/">Overview</a>
          <a href="/data">Server data</a>
          <a href="/feedback">Feedback</a>
        </nav>
      </div>
    </header>
    <main style="max-width:880px;margin:0 auto;padding:40px 24px">
      {@render children()}
    </main>
  </div>
</ThemeProvider>
