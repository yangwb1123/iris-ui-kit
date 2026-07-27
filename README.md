# Iris UI

AI-native cross-framework component infrastructure. From meta UI primitives to full system skeletons, every layer is themeable like VS Code.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

🔧 **Alpha** — not yet published to npm. **149 components across four frameworks (149 each)**, generated from one set of framework-agnostic engines, with a deep test suite (1,500+ specs) and four green quality gates (test · typecheck · lint · build) plus bundle-size, RSC-directive, bench, and format checks.

## Packages

| Package                            | Description                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@iris-ui-kit/core`                | Framework-agnostic engines: store, state machine, forms, i18n, virtualization, async, pagination                                     |
| `@iris-ui-kit/tokens`              | `IrisTheme` types + Light/Dark default themes                                                                                        |
| `@iris-ui-kit/theme`               | Theme engine: `applyTheme`, `getCssVar`, theme store, direction & color-scheme                                                       |
| `@iris-ui-kit/icons`               | Built-in Feather-style icon set (structured nodes) + icon-set interface                                                              |
| `@iris-ui-kit/react`               | React 18 / 19 adapter — all 141 components                                                                                           |
| `@iris-ui-kit/vue`                 | Vue 3.5 adapter — all 141 components                                                                                                 |
| `@iris-ui-kit/solid`               | SolidJS adapter — 140 components, thin bridges over `@iris-ui-kit/core`                                                              |
| `@iris-ui-kit/svelte`              | Svelte 5 adapter — 138 components, thin bridges over `@iris-ui-kit/core`                                                             |
| `@iris-ui-kit/skins`               | Loadable, token-built skin system: inheritance, custom tokens, marketplace catalog, runtime engine                                   |
| `@iris-ui-kit/manifest`            | Machine-readable component/token manifest (`manifest.json` / `llms.txt`) for AI-native consumption                                   |
| `@iris-ui-kit/mcp`                 | MCP server over the typed manifest — `list_components` / `search_components` / `get_component_api` / `scaffold_component` for agents |
| `@iris-ui-kit/plugin-locale-zh`    | Simplified-Chinese (zh-CN) message pack, packaged as an Iris plugin                                                                  |
| `@iris-ui-kit/plugin-editor`       | Code editor plugin (CodeMirror 6): `IrisCodeEditor` for all four frameworks                                                          |
| `@iris-ui-kit/plugin-pro-table`    | vxe-table-style CRUD data table plugin: `IrisProTable` for all four frameworks                                                       |
| `@iris-ui-kit/plugin-charts`       | Zero-dependency, token-themed SVG charts: `IrisLineChart` / `IrisBarChart` / `IrisSparkline`                                         |
| `@iris-ui-kit/plugin-form-builder` | Schema-driven form builder: `IrisFormBuilder` renders a form from a declarative schema                                               |

## Architecture

The same logic powers all four frameworks: **engines sink into `@iris-ui-kit/core`** (pure, framework-agnostic), and each adapter is a thin bridge — React via `useSyncExternalStore`, Vue via `ref` + `subscribe`, Solid via `createSignal` + `subscribe`, Svelte via `readable` stores. A new framework adapter therefore re-bridges engines, not logic.

Five-layer model with a transversal theme layer and an orthogonal behaviors layer:

```
Layer 4: System Skeletons (Login / Dashboard templates)
Layer 3: Layouts          (Sidebar / Header / Dashboard Grid)
Layer 2: Composite        (Table / Tree / Splitter / Calendar)
Layer 1: Primitives       (Button / Dialog / Popover / Select / …)
Layer 0: Theme System     (tokens / theme / icons)  ← transversal
Behaviors:                (ClickOutside / Movable / Resizable / Hotkey)  ← orthogonal
```

On top of the component layers sits a Vben-style **admin layer** (the `admin` entry of every adapter, e.g. `@iris-ui-kit/react/admin`): `AdminLayout` shell, `NavMenu`, `AdminTabs` tab navigation, and `AdminBreadcrumb`, all driven by the core nav/tabsNav engines. And for AI agents, **`@iris-ui-kit/mcp`** serves the typed component manifest over the Model Context Protocol — list, search, fetch a component's full prop contract, or scaffold a ready-to-edit usage snippet in any of the four frameworks.

Read [AGENTS.md](./AGENTS.md) for the full vision and [ROADMAP.md](./docs/ROADMAP.md) for the expansion plan.

## Usage

> Peer deps: React `^18 || ^19` (+ `react-dom`), Vue `^3.5`, Solid `^1.9`, or Svelte `^5`.

**React** — wrap your tree in `ThemeProvider`, then use components:

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'

export function App() {
  return (
    <ThemeProvider>
      <IrisButton variant="primary">Save</IrisButton>
    </ThemeProvider>
  )
}
```

**Vue** — same surface, idiomatic bridge:

```vue
<script setup lang="ts">
import { ThemeProvider, IrisButton } from '@iris-ui-kit/vue'
</script>

<template>
  <ThemeProvider>
    <IrisButton variant="primary">Save</IrisButton>
  </ThemeProvider>
</template>
```

Deep-import by area to keep bundles lean: `import { useForm } from '@iris-ui-kit/react/form'`.

### React Server Components

Every `@iris-ui-kit/react` module is interactive (hooks/state), so the package ships the `'use client'` directive on **every** entry — including deep imports like `@iris-ui-kit/react/form`. You can import Iris components straight into a Next.js App Router Server Component; the import is already a client boundary, so no manual wrapper is needed:

```tsx
// app/page.tsx — a Server Component
import { IrisButton } from '@iris-ui-kit/react'

export default function Page() {
  return <IrisButton variant="primary">Click me</IrisButton>
}
```

The directive is injected at build time and verified in CI (`pnpm check:rsc`). Vue/Nuxt has no equivalent — its server/client boundary is handled by the framework — so the Vue adapter needs no counterpart.

## Development

```bash
pnpm install
pnpm dev         # both playgrounds — Vue → http://localhost:5173, React → :5174
pnpm dev:vue     # Vue playground only
pnpm dev:react   # React playground only
pnpm dev:docs    # VitePress docs site

# Dev runs the libraries straight from source (instant start, HMR on any
# @iris-ui-kit/* edit — no build step). Use dev:watch for the old tsup --watch graph.
pnpm preview     # build, then serve the production bundles (preview:vue / :react too)

pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # Typecheck all packages
pnpm lint        # Lint all packages
pnpm format      # Format with Prettier
pnpm size        # Bundle-size budget gate (gzip)
pnpm check:rsc   # Assert React entries carry 'use client' (run after build)
```

## License

MIT
