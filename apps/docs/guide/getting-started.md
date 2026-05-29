# Getting started

Iris UI ships the same components for **React 18** and **Vue 3** — identical names, identical semantics — over a shared framework-agnostic core.

## Install

```bash
# React
pnpm add @iris-ui/react @iris-ui/theme @iris-ui/tokens
# Vue
pnpm add @iris-ui/vue @iris-ui/theme @iris-ui/tokens
```

## Wrap your app in a ThemeProvider

The provider applies the theme's CSS variables, injects the global stylesheet
(reduced-motion compliance), and sets the writing direction.

```tsx
// React
import { ThemeProvider, IrisButton } from '@iris-ui/react'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'

const store = createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })

export function App() {
  return (
    <ThemeProvider store={store} dir="ltr">
      <IrisButton>Save</IrisButton>
    </ThemeProvider>
  )
}
```

```ts
// Vue — same store, mirrored provider
import { ThemeProvider } from '@iris-ui/vue'
```

## Deep imports

Import a single area to keep bundles lean:

```ts
import { useForm } from '@iris-ui/react/form'
import { useColorScheme } from '@iris-ui/vue/theme'
```

## Next

- [Theming](/guide/theming) — tokens, dark mode, RTL.
- [AI-native usage](/guide/ai-native) — let an agent consume the manifest.
- [Components](/components) — the full reference, generated from the manifest.
