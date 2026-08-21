# Iris UI

AI-native, cross-framework (React · Vue · Solid · Svelte), token-driven,
plugin-extensible UI infrastructure. One framework-agnostic
`@iris-ui-kit/core` defines shared behavior; each adapter is a thin reactive
bridge; every layer is themed by tokens; heavy capabilities ship as plugins.

> Not “yet another component library” — the native output format for
> AI-generated application UIs.

## Status

🔧 **Alpha** — the first npm publish has not been authorized. The generated
manifest reports **155 components in each of four frameworks**. All **620
adapter contracts** are extracted from their corresponding framework sources,
with zero `unavailable` placeholders.

CI covers tests, instrumented coverage, typechecking, lint, builds, external
installation of 27 publishable packages, bundle budgets, RSC directives,
four-framework browser E2E and visual regression, benchmarks, formatting,
token audits, generated references, registry integrity, desktop parity, and
the architecture ratchet. See [SPRINT.md](./docs/SPRINT.md) for the latest
verified run.

## Packages

| Package                                 | Description                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui-kit/core`                     | Framework-agnostic engines, controllers, contract scenarios, and nine resilience primitives                                                         |
| `@iris-ui-kit/tokens`                   | `IrisTheme` types, Light/Dark themes, and DTCG output                                                                                               |
| `@iris-ui-kit/theme`                    | Theme store, CSS variables, RTL, reduced motion, and color-scheme handling                                                                          |
| `@iris-ui-kit/skins`                    | Loadable/inheritable skins, persistence, FOUC prevention, live patching, and marketplace SDK                                                        |
| `@iris-ui-kit/icons`                    | 90+ structured, individually tree-shakeable icons and registries                                                                                    |
| `@iris-ui-kit/{react,vue,solid,svelte}` | The same 155-component surface, framework-native rendering, and thin core bridges                                                                   |
| `@iris-ui-kit/plugin-*`                 | 12 optional plugins: editor, pro-table, charts, form-builder, notifications, admin, calendar, dashboard, kanban, markdown, query-builder, locale-zh |
| `@iris-ui-kit/{registry,marketplace}`   | Typed source registry and integrity-checked runtime resources                                                                                       |
| `@iris-ui-kit/manifest`                 | Generated `manifest.json` / `llms.txt` for AI-native consumption                                                                                    |
| `@iris-ui-kit/mcp`                      | Manifest-backed MCP server with 11 component discovery, generation, and validation tools                                                            |
| `@iris-ui-kit/cli`                      | Registry workflows and repository engineering checks                                                                                                |
| `@iris-ui-kit/eslint-plugin`            | Architecture rules for imports, providers, plugin registration, and legacy tone usage                                                               |

## Quick start

The repository currently consumes workspace packages directly. After the first
authorized release:

```bash
pnpm add @iris-ui-kit/react @iris-ui-kit/theme @iris-ui-kit/tokens
```

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
      <IrisButton variant="solid">Get started</IrisButton>
    </ThemeProvider>
  )
}
```

The Vue, Solid, and Svelte adapters expose the same component names and
semantics with idiomatic framework bridges. Deep-import by area to keep bundles
lean:

```ts
import { useForm } from '@iris-ui-kit/react/form'
```

## Architecture

```text
Plugins (12, opt-in)                    IrisProvider(plugins[])
══════════════════════════════════════════════════════════════
Layer 4  Systems       Login / Dashboard / Admin shell       ✅ four frameworks
Layer 3  Layouts       Stack / Grid / Sidebar / Header        ✅ four frameworks
Layer 2  Composites    Table / Tree / VirtualScroll / Menu    ✅ four frameworks
Layer 1  Primitives    Display / form / overlay / feedback    ✅ four frameworks
────────────────────────────────────────────────────────────────
Layer 0  Core          engines / controllers / resilience     ✅ framework-agnostic
         Theme         tokens / theme / skins / icons         ✅ transversal
         Behaviors     resize / move / hotkey / outside click ✅ orthogonal
```

Shared state and behavior sink into `@iris-ui-kit/core`. React bridges stores
with `useSyncExternalStore`, Vue with refs and subscriptions, Solid with
signals, and Svelte with stores. New adapters re-bridge the same engines instead
of reimplementing product logic.

### Resilience layer

The data layer includes disposable scopes, an event bus, query cache, circuit
breaker, rate limiter, resilient fetcher, offline outbox, and reconnecting
sources. These are wired into real consumers such as `createDataSource`, async
resources, plugins, CMS realtime pages, and desktop process monitors.

## Delivery proof

- React, Vue, Solid, and Svelte CMS apps render dedicated Dashboard, Login,
  Users, Settings, Form Builder, and schema-driven Workspace pages. React also
  demonstrates realtime, Pro Table, and Markdown pages; there is no
  `GenericPage` fallback.
- Next App Router, Nuxt, SolidStart, and SvelteKit exercise routed data,
  feedback, hydration, and production HTTP behavior.
- The playgrounds demonstrate all 12 plugins; VitePress provides English and
  Simplified-Chinese guides plus the generated component explorer.
- `pnpm check:pack-install` packs every publishable package and validates it
  from plain npm projects outside the workspace.
- CI’s strict `native-linux` job builds and tests Electron, Tauri, and Wails
  with skip fallbacks disabled.
- Releases are default-deny and require
  `IRIS_NPM_RELEASE_ENABLED=true`, a successful push CI run on `main`, and that
  run’s exact immutable `head_sha`.

## React Server Components

Every `@iris-ui-kit/react` entry is interactive and ships a build-time
`'use client'` directive, including subpaths such as
`@iris-ui-kit/react/form`. Next.js App Router consumers can therefore import
Iris components without adding a manual client wrapper:

```tsx
// app/page.tsx — a Server Component
import { IrisButton } from '@iris-ui-kit/react'

export default function Page() {
  return <IrisButton variant="solid">Click me</IrisButton>
}
```

`pnpm check:rsc` verifies every built entry.

## Development

```bash
pnpm install
pnpm dev                    # Vue and React playgrounds
pnpm dev:docs               # VitePress
pnpm turbo run test typecheck lint build
pnpm test:coverage
pnpm size
pnpm check:manifest
pnpm check:docs-reference
pnpm check:registry
pnpm check:rsc
pnpm check:desktop-parity
pnpm check:pack-install
pnpm bench
pnpm format:check
pnpm arch-check:ratchet
```

Read [AGENTS.md](./AGENTS.md) for architecture and contribution constraints,
and [ROADMAP.md](./docs/ROADMAP.md) for future directions.

## License

MIT
