# Getting started

Iris UI ships the same components for **React 18**, **Vue 3**, **Solid** and **Svelte 5** — identical names, identical semantics — over a shared framework-agnostic core.

## Install

The packages are release-ready, but the first public npm publish still requires
maintainer authorization. Inside this repository, run `pnpm install` and use the
workspace packages directly. After that first release, install the adapter for
your framework:

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

```vue
<script setup lang="ts">
import { ThemeProvider, IrisButton } from '@iris-ui-kit/vue'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})
</script>

<template>
  <ThemeProvider :store="store" dir="ltr">
    <IrisButton>Save</IrisButton>
  </ThemeProvider>
</template>
```

```tsx
// Solid — the same framework-agnostic store with a Solid bridge
import { ThemeProvider, IrisButton } from '@iris-ui-kit/solid'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export function App() {
  return (
    <ThemeProvider store={store} dir="ltr">
      <IrisButton>Save</IrisButton>
    </ThemeProvider>
  )
}
```

```svelte
<script lang="ts">
  import { ThemeProvider, IrisButton } from '@iris-ui-kit/svelte'
  import { createThemeStore } from '@iris-ui-kit/theme'
  import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

  const store = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })
</script>

<ThemeProvider {store} dir="ltr">
  <IrisButton>Save</IrisButton>
</ThemeProvider>
```

## Svelte `asChild` prop merging

Svelte `asChild` primitives pass `slotProps` to their single child snippet. A
plain `{...slotProps}` remains supported when the child does not redeclare
`class`, `style`, or an event handler. If it does, call the non-enumerable
`merge()` helper so the same merged attributes are present during SSR and after
hydration:

```svelte
<script lang="ts">
  import { IrisButton } from '@iris-ui-kit/svelte'

  function onParentClick(event: MouseEvent) {
    // Runs first. Calling event.preventDefault() also suppresses onChildClick.
  }

  function onChildClick() {
    // Runs after the parent handler unless the parent prevented the event.
  }
</script>

<IrisButton asChild class="parent" style="color: red" onclick={onParentClick}>
  {#snippet children(slotProps)}
    <a
      {...slotProps.merge({
        href: '/save',
        class: 'child',
        style: 'color: blue',
        onclick: onChildClick,
      })}
    >
      Save
    </a>
  {/snippet}
</IrisButton>
```

Parent and child classes are retained, child style declarations win on
conflicts, and parent handlers run before child handlers. The direct spread
form remains source-compatible for non-conflicting attributes because
`slotProps.merge` itself is non-enumerable.

## Deep imports

Import a single area to keep bundles lean:

```ts
import { useForm } from '@iris-ui-kit/react/form'
import { useColorScheme } from '@iris-ui-kit/vue/theme'
```

## Next

- [Theming](/guide/theming) — tokens, dark mode, RTL.
- [AI-native usage](/guide/ai-native) — let an agent consume the manifest.
- [Registry & marketplace](/guide/registry-marketplace) — source installs and
  declarative runtime resources.
- [Cross-platform](/guide/cross-platform) — Electron, Tauri, Wails, and webview
  integration.
- [Components](/components) — the full reference, generated from the manifest.
