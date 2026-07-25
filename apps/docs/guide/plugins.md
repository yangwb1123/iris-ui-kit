# Plugin Development

Iris UI's plugin system lets you extend the UI with custom **tokens**, **messages**, and **stores** — all registered through a single `IrisProvider` integration point.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  <IrisProvider plugins={[myPlugin, editorPlugin]}>          │
│    runPlugins() ─── collects tokens + messages + stores     │
│      └─ applyCssVars(tokens)      ➜  CSS custom properties  │
│      └─ mergeMessages(locale)     ➜  i18n overrides         │
│      └─ exposeStores()            ➜  usePluginStore()       │
│                                                             │
│    <IrisCodeEditor />  ─── uses plugin's tokens + store     │
└─────────────────────────────────────────────────────────────┘
```

## Your First Plugin

A plugin is defined with `createPlugin` from `@iris-ui/core`:

```ts
import { createPlugin } from '@iris-ui/core'

export const myPlugin = createPlugin({
  name: 'my-plugin',
  install(registry) {
    // Register CSS variables (token names → values)
    registry.registerTokens({
      '--iris-my-accent': '#6366f1',
      '--iris-my-bg': '#f8fafc',
    })

    // Register localized messages
    registry.registerMessages('zh-CN', {
      'myPlugin.greeting': '你好，世界！',
    })

    // Register a shared store (accessible via usePluginStore)
    registry.registerStore('settings', () => createStore({ theme: 'dark', fontSize: 14 }))
  },
})
```

## Using Plugins

Wrap your app with `IrisProvider` to activate plugins:

```tsx
import { IrisProvider } from '@iris-ui/react'
import { myPlugin } from './my-plugin'

function App() {
  return (
    <IrisProvider plugins={[myPlugin]}>
      <MyComponent />
    </IrisProvider>
  )
}
```

Read plugin stores anywhere in the tree:

```tsx
import { usePluginStore } from '@iris-ui/react'

function MyComponent() {
  const settings = usePluginStore<{ theme: string; fontSize: number }>('my-plugin::settings')
  return <div>Theme: {settings.theme}</div>
}
```

## Plugin Conventions

| Rule                                       | Reason                                         |
| ------------------------------------------ | ---------------------------------------------- |
| Namespace `name` with lowercase kebab-case | Avoids CSS and store-key collisions            |
| Use `{namespace}::{key}` for store access  | Prevents conflicts between plugins             |
| Prefix tokens with `--iris-{namespace}-`   | Follows Iris theming conventions               |
| Don't call `registerComponent()`           | Components are static imports for tree-shaking |

## 12 Existing Plugins

| Plugin                          | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `@iris-ui/plugin-locale-zh`     | Simplified Chinese message pack        |
| `@iris-ui/plugin-editor`        | CodeMirror 6 code editor (SQL/JSON/JS) |
| `@iris-ui/plugin-pro-table`     | vxe-table-style CRUD data table        |
| `@iris-ui/plugin-charts`        | Zero-dependency SVG charts             |
| `@iris-ui/plugin-form-builder`  | Schema-driven form builder             |
| `@iris-ui/plugin-notifications` | Persistent notification center         |
| `@iris-ui/plugin-admin`         | Admin panel extensions                 |
| `@iris-ui/plugin-calendar`      | Calendar widget                        |
| `@iris-ui/plugin-dashboard`     | Dashboard layouts                      |
| `@iris-ui/plugin-kanban`        | Kanban board                           |
| `@iris-ui/plugin-markdown`      | Markdown editor/renderer               |
| `@iris-ui/plugin-query-builder` | Query/filter builder                   |

## Package Structure

Each plugin follows the same multi-entry layout:

```
plugin-name/
├── src/
│   ├── core/        # Framework-agnostic logic
│   │   └── index.ts
│   ├── react/       # React adapter
│   │   └── index.tsx
│   ├── vue/         # Vue adapter
│   ├── solid/       # Solid adapter
│   └── svelte/      # Svelte adapter (Iris*.svelte)
├── tsup.config.ts   # Multi-entry build config
├── vitest.main.config.ts
├── vitest.solid.config.ts
└── vitest.svelte.config.ts
```

Consumers import from sub-path exports:

```ts
import { editorPlugin } from '@iris-ui/plugin-editor/core'
import { IrisCodeEditor } from '@iris-ui/plugin-editor/react'
```
