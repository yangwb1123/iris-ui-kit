<template>
  <Html lang="en">
    <Body>
      <ThemeProvider :store="themeStore">
        <div
          style="
            min-height: 100vh;
            background: var(--iris-background);
            color: var(--iris-foreground);
          "
        >
          <header
            style="border-block-end: 1px solid var(--iris-border); background: var(--iris-surface)"
          >
            <div
              style="
                max-width: 880px;
                margin: 0 auto;
                padding: 18px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                flex-wrap: wrap;
              "
            >
              <NuxtLink
                to="/"
                style="color: var(--iris-foreground); font-weight: 700; text-decoration: none"
              >
                Iris UI · Nuxt
              </NuxtLink>
              <nav aria-label="Primary navigation" style="display: flex; gap: 18px">
                <NuxtLink to="/">Overview</NuxtLink>
                <NuxtLink to="/data">Server data</NuxtLink>
                <NuxtLink to="/feedback">Feedback</NuxtLink>
              </nav>
            </div>
          </header>
          <main style="max-width: 880px; margin: 0 auto; padding: 40px 24px">
            <NuxtPage />
          </main>
        </div>
      </ThemeProvider>
    </Body>
  </Html>
</template>

<script setup lang="ts">
import { ThemeProvider } from '@iris-ui-kit/vue'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})
</script>
