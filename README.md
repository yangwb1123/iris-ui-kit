# Iris UI

AI-native cross-framework component infrastructure. From meta UI primitives to full system skeletons, every layer is themeable like VS Code.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

🔧 **Alpha** — the first npm publish has not been authorized. The generated
manifest currently reports **154 components across four frameworks (154 each)**,
all backed by the same framework-agnostic engines. Its **616 adapter contracts**
are all extracted natively from their corresponding framework sources, with zero
`unavailable` contracts. CI declares tests, typecheck, lint, build, coverage,
package-install smoke tests, bundle budgets, RSC directives, browser E2E/visual
regression, benchmarks, formatting, token audits, generated-reference checks,
and the architecture ratchet.

The current combined worktree has completed its full closeout: all declared
quality gates are green, including 19/19 browser E2E and visual checks. See
[SPRINT.md](./docs/SPRINT.md) for the verified results.

## Packages

| Package                             | Description                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@iris-ui-kit/core`                 | Framework-agnostic engines: store, state machine, forms, i18n, virtualization, async, pagination                                     |
| `@iris-ui-kit/tokens`               | `IrisTheme` types + Light/Dark default themes                                                                                        |
| `@iris-ui-kit/theme`                | Theme engine: `applyTheme`, `getCssVar`, theme store, direction & color-scheme                                                       |
| `@iris-ui-kit/icons`                | Built-in Feather-style icon set (structured nodes) + icon-set interface                                                              |
| `@iris-ui-kit/react`                | React 18 / 19 adapter — all 154 manifest components                                                                                  |
| `@iris-ui-kit/vue`                  | Vue 3.5 adapter — all 154 manifest components                                                                                        |
| `@iris-ui-kit/solid`                | SolidJS adapter — all 154 manifest components, thin bridges over `@iris-ui-kit/core`                                                 |
| `@iris-ui-kit/svelte`               | Svelte 5 adapter — all 154 manifest components, thin bridges over `@iris-ui-kit/core`                                                |
| `@iris-ui-kit/skins`                | Loadable, token-built skin system: inheritance, custom tokens, marketplace catalog, runtime engine                                   |
| `@iris-ui-kit/registry`             | Typed source registry contracts with SHA-256-verified remote item and file metadata                                                  |
| `@iris-ui-kit/marketplace`          | Safe runtime store for integrity-checked skins, fonts, page blueprints, and view presets                                             |
| `@iris-ui-kit/manifest`             | Machine-readable component/token manifest (`manifest.json` / `llms.txt`) for AI-native consumption                                   |
| `@iris-ui-kit/cli`                  | Source registry workflow: `init`, `registry add`, `add`, `diff`, and `update`                                                        |
| `@iris-ui-kit/mcp`                  | MCP server over the typed manifest — `list_components` / `search_components` / `get_component_api` / `scaffold_component` for agents |
| `@iris-ui-kit/eslint-plugin`        | Architecture lint rules, including plugin registration and framework-boundary checks                                                 |
| `@iris-ui-kit/plugin-locale-zh`     | Simplified-Chinese (zh-CN) message pack, packaged as an Iris plugin                                                                  |
| `@iris-ui-kit/plugin-editor`        | Code editor plugin (CodeMirror 6): `IrisCodeEditor` for all four frameworks                                                          |
| `@iris-ui-kit/plugin-pro-table`     | vxe-table-style CRUD data table plugin: `IrisProTable` for all four frameworks                                                       |
| `@iris-ui-kit/plugin-charts`        | Zero-dependency SVG line, bar, sparkline, multi-line, stacked-bar, and donut charts                                                  |
| `@iris-ui-kit/plugin-form-builder`  | Schema-driven form builder: `IrisFormBuilder` renders a form from a declarative schema                                               |
| `@iris-ui-kit/plugin-admin`         | Schema-driven admin shell with validated schemas, client/server data pages, query, CRUD, permissions, and row actions                |
| `@iris-ui-kit/plugin-calendar`      | Four-framework event calendar                                                                                                        |
| `@iris-ui-kit/plugin-dashboard`     | Token-themed draggable dashboard grid                                                                                                |
| `@iris-ui-kit/plugin-kanban`        | Declarative drag-and-drop kanban board                                                                                               |
| `@iris-ui-kit/plugin-markdown`      | Safe structured-node Markdown renderer                                                                                               |
| `@iris-ui-kit/plugin-notifications` | Persistent notification inbox and panel                                                                                              |
| `@iris-ui-kit/plugin-query-builder` | Visual builder for typed data-engine filter rules                                                                                    |

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

## Reference and delivery proof

- The React, Vue, Solid, and Svelte CMS applications render real
  `DashboardPage`, `LoginPage`, `UsersPage`, `SettingsPage`, and
  `WorkspacePage` implementations. There is no `GenericPage` fallback.
- Next App Router, Nuxt, SolidStart, and SvelteKit each exercise routed data and
  feedback flows, hydration, and production HTTP route tests.
- `pnpm check:pack-install` auto-discovers all **27 publishable packages**, packs
  real tarballs, installs them with plain npm outside the workspace, and checks
  ESM/CJS exports, TypeScript and Svelte consumers, licenses, and the CLI.
- CI has a separate `native-linux` job with `IRIS_REQUIRE_NATIVE_BUILD=1`; it
  installs the native toolchains and builds/tests Electron, Tauri, and Wails
  without skip fallbacks.
- The release workflow is default-deny: it requires the repository variable
  `IRIS_NPM_RELEASE_ENABLED=true`, a successful push-triggered CI run on `main`,
  and that run's exact `head_sha`. Enabling the variable and choosing the first
  version remain explicit maintainer decisions.

## Usage

> Peer deps: React `^18 || ^19` (+ `react-dom`), Vue `^3.5`, Solid `^1.9`, or Svelte `^5`.

**React** — wrap your tree in `ThemeProvider`, then use components:

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const theme = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export function App() {
  return (
    <ThemeProvider store={theme}>
      <IrisButton variant="solid">Save</IrisButton>
    </ThemeProvider>
  )
}
```

**Vue** — same surface, idiomatic bridge:

```vue
<script setup lang="ts">
import { ThemeProvider, IrisButton } from '@iris-ui-kit/vue'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const theme = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})
</script>

<template>
  <ThemeProvider :store="theme">
    <IrisButton variant="solid">Save</IrisButton>
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
  return <IrisButton variant="solid">Click me</IrisButton>
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
pnpm check:pack-install # Pack/install all 27 publishable packages as external consumers
pnpm check:manifest     # Verify generated manifest/llms and 616 native adapter contracts
pnpm check:docs-reference # Verify the generated component reference
pnpm check:registry     # Validate official source-registry/marketplace templates
pnpm test:coverage      # Workspace coverage report
pnpm arch-check:ratchet # Reject new/growing oversized source files
```

## License

MIT
