# Iris UI

AI-native cross-framework component infrastructure. From meta UI primitives to full system skeletons, every layer is themeable like VS Code.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

🔧 **Alpha** — not yet published to npm. **141 components across four frameworks (React 141 · Vue 141 · Solid 140 · Svelte 138)**, generated from one set of framework-agnostic engines, with a deep test suite (2,100+ specs) and four green quality gates (test · typecheck · lint · build) plus bundle-size and RSC-directive guards.

## Packages

| Package                        | Description                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@iris-ui/core`                | Framework-agnostic engines: store, state machine, forms, i18n, virtualization, async, pagination                                     |
| `@iris-ui/tokens`              | `IrisTheme` types + Light/Dark default themes                                                                                        |
| `@iris-ui/theme`               | Theme engine: `applyTheme`, `getCssVar`, theme store, direction & color-scheme                                                       |
| `@iris-ui/icons`               | Built-in Feather-style icon set (structured nodes) + icon-set interface                                                              |
| `@iris-ui/react`               | React 18 / 19 adapter — all 141 components                                                                                           |
| `@iris-ui/vue`                 | Vue 3.5 adapter — all 141 components                                                                                                 |
| `@iris-ui/solid`               | SolidJS adapter — 140 components, thin bridges over `@iris-ui/core`                                                                  |
| `@iris-ui/svelte`              | Svelte 5 adapter — 138 components, thin bridges over `@iris-ui/core`                                                                 |
| `@iris-ui/skins`               | Loadable, token-built skin system: inheritance, custom tokens, marketplace catalog, runtime engine                                   |
| `@iris-ui/manifest`            | Machine-readable component/token manifest (`manifest.json` / `llms.txt`) for AI-native consumption                                   |
| `@iris-ui/mcp`                 | MCP server over the typed manifest — `list_components` / `search_components` / `get_component_api` / `scaffold_component` for agents |
| `@iris-ui/plugin-locale-zh`    | Simplified-Chinese (zh-CN) message pack, packaged as an Iris plugin                                                                  |
| `@iris-ui/plugin-editor`       | Code editor plugin (CodeMirror 6): `IrisCodeEditor` for all four frameworks                                                          |
| `@iris-ui/plugin-pro-table`    | vxe-table-style CRUD data table plugin: `IrisProTable` for all four frameworks                                                       |
| `@iris-ui/plugin-charts`       | Zero-dependency, token-themed SVG charts: `IrisLineChart` / `IrisBarChart` / `IrisSparkline`                                         |
| `@iris-ui/plugin-form-builder` | Schema-driven form builder: `IrisFormBuilder` renders a form from a declarative schema                                               |

## Architecture

The same logic powers all four frameworks: **engines sink into `@iris-ui/core`** (pure, framework-agnostic), and each adapter is a thin bridge — React via `useSyncExternalStore`, Vue via `ref` + `subscribe`, Solid via `createSignal` + `subscribe`, Svelte via `readable` stores. A new framework adapter therefore re-bridges engines, not logic.

Five-layer model with a transversal theme layer and an orthogonal behaviors layer:

```
Layer 4: System Skeletons (Login / Dashboard templates)
Layer 3: Layouts          (Sidebar / Header / Dashboard Grid)
Layer 2: Composite        (Table / Tree / Splitter / Calendar)
Layer 1: Primitives       (Button / Dialog / Popover / Select / …)
Layer 0: Theme System     (tokens / theme / icons)  ← transversal
Behaviors:                (ClickOutside / Movable / Resizable / Hotkey)  ← orthogonal
```

On top of the component layers sits a Vben-style **admin layer** (the `admin` entry of every adapter, e.g. `@iris-ui/react/admin`): `AdminLayout` shell, `NavMenu`, `AdminTabs` tab navigation, and `AdminBreadcrumb`, all driven by the core nav/tabsNav engines. And for AI agents, **`@iris-ui/mcp`** serves the typed component manifest over the Model Context Protocol — list, search, fetch a component's full prop contract, or scaffold a ready-to-edit usage snippet in any of the four frameworks.

Read [AGENTS.md](./AGENTS.md) for the full vision and [ROADMAP.md](./ROADMAP.md) for the expansion plan.

## Usage

> Peer deps: React `^18 || ^19` (+ `react-dom`), Vue `^3.5`, Solid `^1.9`, or Svelte `^5`.

**React** — wrap your tree in `ThemeProvider`, then use components:

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui/react'

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
import { ThemeProvider, IrisButton } from '@iris-ui/vue'
</script>

<template>
  <ThemeProvider>
    <IrisButton variant="primary">Save</IrisButton>
  </ThemeProvider>
</template>
```

Deep-import by area to keep bundles lean: `import { useForm } from '@iris-ui/react/form'`.

### React Server Components

Every `@iris-ui/react` module is interactive (hooks/state), so the package ships the `'use client'` directive on **every** entry — including deep imports like `@iris-ui/react/form`. You can import Iris components straight into a Next.js App Router Server Component; the import is already a client boundary, so no manual wrapper is needed:

```tsx
// app/page.tsx — a Server Component
import { IrisButton } from '@iris-ui/react'

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
# @iris-ui/* edit — no build step). Use dev:watch for the old tsup --watch graph.
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
