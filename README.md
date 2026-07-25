# Iris UI

AI-native, cross-framework (React · Vue · Solid · Svelte), token-driven, plugin-extensible UI infrastructure. One framework-agnostic `@iris-ui/core` defines all logic; each adapter is a thin bridge; every layer is themed by tokens; heavy capabilities ship as plugins.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

**🔧 Alpha** — 151 components across **4 frameworks (151 each)**, ~1,500+ tests, 25 packages, 19 demo apps, 12 plugins, 10 MCP tools, 4 ESLint rules. All quality gates green: test · typecheck · lint · build · size · RSC · parity · arch-check.

## Quick start

```bash
pnpm add @iris-ui/react @iris-ui/theme @iris-ui/tokens
```

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui/react'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme } from '@iris-ui/tokens'

const store = createThemeStore({ themes: { light: lightTheme }, default: 'light' })

export function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton variant="solid">Get started</IrisButton>
    </ThemeProvider>
  )
}
```

## Packages (25)

| Package                             | Description                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui/core`                     | Zero-dependency framework: store, machine, form, i18n, virtual, async, pagination, **9 resilience primitives**, controllers, contracts  |
| `@iris-ui/tokens`                   | `IrisTheme` types + Light/Dark default themes + DTCG export                                                                             |
| `@iris-ui/theme`                    | Theme engine: `applyTheme`, `getCssVar`, `createThemeStore`, RTL, color-scheme                                                          |
| `@iris-ui/skins`                    | Loadable skin system: inheritance, custom tokens, FOUC prevention, marketplace                                                          |
| `@iris-ui/icons`                    | Feather-style structured icon set + icon registry system                                                                                |
| `@iris-ui/{react,vue,solid,svelte}` | Adapters — Layer 1–4 components + behaviors + plugins bridge                                                                            |
| `@iris-ui/manifest`                 | Machine-readable `manifest.json` / `llms.txt` for AI consumption                                                                        |
| `@iris-ui/mcp`                      | MCP server: 10 tools (`list`, `search`, `get-api`, `scaffold`, `generate-view`, `generate-test`, `suggest`, `validate`, `architecture`) |
| `@iris-ui/cli`                      | Engineering CLI: 20+ quality gates (size, RSC, parity, arch, coverage…)                                                                 |
| `@iris-ui/eslint-plugin`            | 4 rules: no-internal-import, use-iris-provider, plugin-needs-registration, no-legacy-tone                                               |
| `@iris-ui/plugin-*` (12)            | editor, pro-table, charts, form-builder, notifications, admin, calendar, dashboard, kanban, markdown, query-builder, locale-zh          |

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
Layer 0  Core          @iris-ui/core engines         ✅ framework-agnostic
         Behaviors     Resizable/Movable/Hotkey      ✅ 4-framework
         Resilience    9 primitives, all wired       ✅ done
```

## Demo apps (19)

- **CMS** — React/Vue/Solid/Svelte: CRUD, Form Builder, Realtime, ProTable
- **Desktop OS** — React/Vue/Solid/Svelte (+ Electron/Tauri/Wails): window manager, app store, AI agent
- **Playground** — React (17 showcases), Vue (9 showcases)
- **SSR** — Next.js (real form), Nuxt/SolidStart/SvelteKit (smoke)
- **Docs** — VitePress, 6 guides, i18n (en/zh-CN), interactive component explorer

## Plugin ecosystem (12)

| Plugin                 | Demo                               |
| ---------------------- | ---------------------------------- |
| `plugin-form-builder`  | ✅ CMS (4 frameworks) + Playground |
| `plugin-pro-table`     | ✅ CMS (React)                     |
| `plugin-realtime`      | ✅ CMS + Playground                |
| `plugin-charts`        | ✅ Playground                      |
| `plugin-calendar`      | ✅ Playground                      |
| `plugin-markdown`      | ✅ Playground                      |
| `plugin-query-builder` | ✅ Playground                      |
| `plugin-kanban`        | ✅ Playground                      |
| `plugin-notifications` | ✅ CMS (all frameworks)            |
| `plugin-editor`        | —                                  |
| `plugin-admin`         | —                                  |
| `plugin-dashboard`     | —                                  |

## Development

```bash
pnpm install
pnpm dev         # React + Vue playgrounds
pnpm test        # All tests
pnpm build       # All packages
pnpm typecheck   # All typechecks
```

## License

MIT
