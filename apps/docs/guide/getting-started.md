# Getting started

Iris UI ships the same components for **React 18/19**, **Vue 3.5**, **Solid 1.9** and **Svelte 5** — identical names, identical semantics — over a shared framework-agnostic core.

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

## 1. Theme provider

The provider applies CSS custom properties, global styles (reduced-motion, color-scheme),
and the writing direction. Every Iris component reads `var(--iris-*)` tokens.

```tsx
// React
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton variant="solid" onClick={() => alert('Hello!')}>
        Get started
      </IrisButton>
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

## 2. Data table with CRUD

Build a fully functional data list with sorting, filtering, pagination, and
optimistic mutations — in ~30 lines:

```tsx
import { IrisTable, useResourceController, type IrisTableColumn } from '@iris-ui-kit/react'
import { createClientFetcher, type DataViewColumn } from '@iris-ui-kit/core'

interface User {
  id: number
  name: string
  role: string
  status: string
}

const DATA: User[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
]

const VIEW_COLUMNS: DataViewColumn<User>[] = [
  { key: 'name', getValue: (r) => r.name },
  { key: 'role', getValue: (r) => r.role },
  { key: 'status', getValue: (r) => r.status },
]

const TABLE_COLUMNS: IrisTableColumn<User>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  { key: 'status', title: 'Status' },
]

function UserTable() {
  const users = useResourceController({
    fetcher: createClientFetcher(DATA, VIEW_COLUMNS),
    pageSize: 10,
    // Enable query cache + circuit breaker
    resilient: { ttlMs: 5000, breaker: { failureThreshold: 3, resetMs: 10000 } },
  })

  return (
    <IrisTable columns={TABLE_COLUMNS} data={users.state.rows} rowKey="id" selectable="multi" />
  )
}
```

## 3. Schema-driven form

Define a form schema and render a validated, accessible form instantly:

```tsx
import { IrisFormBuilder } from '@iris-ui-kit/plugin-form-builder/react'
import type { FormSchema } from '@iris-ui-kit/plugin-form-builder/react'

const schema: FormSchema = {
  submitLabel: 'Create User',
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'email', type: 'email', label: 'Email', required: true },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Engineer', value: 'engineer' },
        { label: 'Designer', value: 'designer' },
      ],
    },
  ],
}

function UserForm() {
  return <IrisFormBuilder schema={schema} onSubmit={(v) => console.log(v)} validateOnChange />
}
```

## 4. Real-time data

Subscribe to a live stream with automatic exponential-backoff reconnection:

```tsx
import { useEffect, useState } from 'react'
import { createReconnectingSource } from '@iris-ui-kit/core'

function StockTicker() {
  const [price, setPrice] = useState(0)

  useEffect(() => {
    const source = createReconnectingSource<{ price: number }>(
      (sink) => {
        const ws = new WebSocket('wss://api.example.com/stocks')
        ws.onmessage = (e) => sink.message(JSON.parse(e.data))
        ws.onopen = () => sink.open()
        ws.onclose = () => sink.close()
        return () => ws.close()
      },
      { onMessage: (t) => setPrice(t.price) },
      { backoffMs: 1000, maxBackoffMs: 30000 },
    )
    source.open()
    return () => source.close()
  }, [])

  return <div>Current price: ${price.toFixed(2)}</div>
}
```

## 5. Plugins

Heavy capabilities are packaged as plugins — install them on demand:

```bash
pnpm add @iris-ui-kit/plugin-editor @iris-ui-kit/plugin-pro-table @iris-ui-kit/plugin-charts \
  @iris-ui-kit/plugin-form-builder @iris-ui-kit/plugin-notifications @iris-ui-kit/plugin-locale-zh
```

Wrap with `IrisProvider` to activate tokens, messages, and stores:

```tsx
import { IrisProvider, IrisCodeEditor } from '@iris-ui-kit/react'
import { editorPlugin } from '@iris-ui-kit/plugin-editor/core'
import { zhPlugin } from '@iris-ui-kit/plugin-locale-zh/core'

function App() {
  return (
    <IrisProvider plugins={[editorPlugin, zhPlugin]} locale="zh-CN">
      <IrisCodeEditor language="sql" value="SELECT * FROM users" />
    </IrisProvider>
  )
}
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
import { IrisProTable } from '@iris-ui-kit/plugin-pro-table/react'
```

## Next

- [Theming](/guide/theming) — tokens, skins, dark mode, RTL.
- [Data & Resilience](/guide/data-layer) — caching, circuit breaker, outbox, and realtime.
- [Plugin Development](/guide/plugins) — create your own Iris plugin.
- [AI-native usage](/guide/ai-native) — let an agent consume the manifest.
- [Registry & marketplace](/guide/registry-marketplace) — source installs and
  declarative runtime resources.
- [Cross-platform](/guide/cross-platform) — Electron, Tauri, Wails, and webview
  integration.
- [Components](/components) — the full reference, generated from the manifest.
