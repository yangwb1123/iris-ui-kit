# Iris UI

AI-native, cross-framework (React · Vue · Solid · Svelte), token-driven, plugin-extensible UI infrastructure. One framework-agnostic `@iris-ui-kit/core` defines all logic; each adapter is a thin bridge; every layer is themed by tokens; heavy capabilities ship as plugins.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

**🔧 Alpha** — 151 components across **4 frameworks (151 each)**, ~1,500+ tests, 25 packages, 19 demo apps, 12 plugins, 10 MCP tools, 4 ESLint rules. All quality gates green: test · typecheck · lint · build · size · RSC · parity · arch-check.

## Packages (25)

| Package                                 | Description                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@iris-ui-kit/core`                     | Zero-dependency framework: store, machine, form, i18n, virtual, async, pagination, **9 resilience primitives**, controllers, contracts     |
| `@iris-ui-kit/tokens`                   | `IrisTheme` types + Light/Dark default themes + DTCG export                                                                                |
| `@iris-ui-kit/theme`                    | Theme engine: `applyTheme`, `getCssVar`, `createThemeStore`, RTL, color-scheme, direction switching                                        |
| `@iris-ui-kit/skins`                    | Loadable skin system: inheritance, custom tokens, FOUC prevention, marketplace SDK                                                         |
| `@iris-ui-kit/icons`                    | Feather-style structured icon set (90+ tree-shakeable named exports) + icon registry system                                                |
| `@iris-ui-kit/{react,vue,solid,svelte}` | Adapters — Layer 1–4 components + behaviors + plugins bridge; subpath exports (e.g. `@iris-ui-kit/react/form`)                             |
| `@iris-ui-kit/manifest`                 | Machine-readable `manifest.json` / `llms.txt` for AI consumption                                                                           |
| `@iris-ui-kit/mcp`                      | MCP server: 11 tools (`list`, `search`, `get-api`, `scaffold`, `generate-view`, `generate-test`, `suggest`, `validate`, `architecture`, …) |
| `@iris-ui-kit/cli`                      | Engineering CLI: 35+ quality gates (size, RSC, parity, arch, coverage, pack-install…)                                                      |
| `@iris-ui-kit/eslint-plugin`            | 4 rules: no-internal-import, use-iris-provider, plugin-needs-registration, no-legacy-tone                                                  |
| `@iris-ui-kit/plugin-*` (12)            | editor, pro-table, charts, form-builder, notifications, admin, calendar, dashboard, kanban, markdown, query-builder, locale-zh             |

## Quick start

```bash
pnpm add @iris-ui-kit/react @iris-ui-kit/theme @iris-ui-kit/tokens
```

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({ themes: { light: lightTheme }, default: 'light' })

export function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton variant="solid">Get started</IrisButton>
    </ThemeProvider>
  )
}
```

## Resilience Layer

All 9 resilience primitives wired into real consumers:

| Primitive                  | Consumer                                             |
| -------------------------- | ---------------------------------------------------- |
| `createDisposableScope`    | `createAsyncResource.destroy()`                      |
| `createEventBus`           | `plugin.ts PluginRegistry`                           |
| `createQueryCache`         | `createResilientFetcher` → `createDataSource`        |
| `createCircuitBreaker`     | `createResilientFetcher` → `createDataSource`        |
| `createRateLimiter`        | `createResilientFetcher` → `createDataSource`        |
| `createResilientFetcher`   | `createDataSource` (resilient option)                |
| `createOutbox`             | `createDataSource` (outbox option)                   |
| `createReconnectingSource` | CMS demo + desktop-os + `useReconnectingSource` hook |

## Architecture

```
Plugins (12)                          IrisProvider(plugins[])
════════════════════════════════════════════════════════
Layer 4  Systems       AdminLayout/NavMenu/Tabs      ✅ 4-framework
Layer 3  Layouts       Stack/Grid/Sidebar/Header     ✅ 4-framework
Layer 2  Composites    Table/Tree/VirtualScroll      ✅ 4-framework
Layer 1  Primitives    88+ components                ✅ 4-framework
────────────────────────────────────────────────────────
Layer 0  Core          @iris-ui-kit/core engines         ✅ framework-agnostic
         Behaviors     Resizable/Movable/Hotkey      ✅ 4-framework
         Resilience    9 primitives, all wired       ✅ done
```

Deep-import by area to keep bundles lean: `import { useForm } from '@iris-ui-kit/react/form'`.

## Demo apps (19)

- **CMS** — React/Vue/Solid/Svelte: CRUD, Form Builder, Realtime, ProTable
- **Desktop OS** — React/Vue/Solid/Svelte (+ Electron/Tauri/Wails): window manager, app store, AI agent
- **Playground** — React (21 showcases), Vue (15 showcases)
- **SSR** — Next.js (real form), Nuxt/SolidStart/SvelteKit (smoke)
- **Docs** — VitePress, 6 guides, i18n (en/zh-CN), interactive component explorer

## Plugin ecosystem (12)

| Plugin                 | Demo                               |
| ---------------------- | ---------------------------------- |
| `plugin-form-builder`  | ✅ CMS (4 frameworks) + Playground |
| `plugin-pro-table`     | ✅ CMS (React)                     |
| `plugin-notifications` | ✅ CMS (all frameworks)            |
| `plugin-charts`        | ✅ Playground                      |
| `plugin-calendar`      | ✅ Playground                      |
| `plugin-markdown`      | ✅ Playground                      |
| `plugin-query-builder` | ✅ Playground                      |
| `plugin-kanban`        | ✅ Playground                      |
| `plugin-editor`        | ✅ Playground                      |
| `plugin-admin`         | ✅ Playground                      |
| `plugin-dashboard`     | ✅ Playground                      |
| `plugin-locale-zh`     | ✅ CMS (React/Vue)                 |

Every `@iris-ui-kit/react` module is interactive (hooks/state), so the package ships the `'use client'` directive on **every** entry — including deep imports like `@iris-ui-kit/react/form`. You can import Iris components straight into a Next.js App Router Server Component; the import is already a client boundary, so no manual wrapper is needed:

```tsx
// app/page.tsx — a Server Component
import { IrisButton } from '@iris-ui-kit/react'

export default function Page() {
  return <IrisButton variant="primary">Click me</IrisButton>
}
```

The directive is injected at build time and verified in CI (`pnpm check:rsc`).

## Development

```bash
pnpm install
pnpm dev         # both playgrounds — Vue → http://localhost:5173, React → :5174
pnpm test        # All tests
pnpm build       # All packages
pnpm typecheck   # All typechecks
pnpm lint        # Lint all packages
pnpm format      # Format with Prettier
pnpm size        # Bundle-size budget gate (gzip)
pnpm check:rsc   # Assert React entries carry 'use client' (run after build)
```

## License

MIT
