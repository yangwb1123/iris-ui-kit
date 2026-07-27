# Getting started

Iris UI ships the same components for **React 18**, **Vue 3**, **Solid** and **Svelte 5** — identical names, identical semantics — over a shared framework-agnostic core.

## Install

```bash
# React
pnpm add @iris-ui-kit/react @iris-ui-kit/theme @iris-ui-kit/tokens

# Vue
pnpm add @iris-ui-kit/vue @iris-ui-kit/theme @iris-ui-kit/tokens

# Solid
pnpm add @iris-ui-kit/solid @iris-ui-kit/theme @iris-ui-kit/tokens

# Svelte
pnpm add @iris-ui-kit/svelte @iris-ui-kit/theme @iris-ui-kit/tokens
```

## Wrap your app in a ThemeProvider

The provider applies the theme's CSS variables, injects the global stylesheet
(reduced-motion compliance), and sets the writing direction.

```tsx
// React
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })

export function App() {
  return (
    <ThemeProvider store={store} dir="ltr">
      <IrisButton>Save</IrisButton>
    </ThemeProvider>
  )
}
```

````ts
// Vue — same store, mirrored provider
import { ThemeProvider } from '@iris-ui-kit/vue'

```solid
// Solid — same store, mirrored provider
import { ThemeProvider } from '@iris-ui-kit/solid'
````

```svelte
// Svelte — same store, mirrored provider import {ThemeProvider} from '@iris-ui-kit/svelte'
```

## Deep imports

Import a single area to keep bundles lean:

```ts
import { useForm } from '@iris-ui-kit/react/form'
import { useColorScheme } from '@iris-ui-kit/vue/theme'
```

## Next

- [Theming](/guide/theming) — tokens, dark mode, RTL.
- [AI-native usage](/guide/ai-native) — let an agent consume the manifest.
- [Components](/components) — the full reference, generated from the manifest.
