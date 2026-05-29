# Iris UI

AI-native cross-framework component infrastructure. From meta UI primitives to full system skeletons, every layer is themeable like VS Code.

> Not "yet another component library" — the native output format for AI-generated application UIs.

## Status

🔧 **Alpha** — Phase 0 complete: Monorepo scaffold + Layer 0 (theme system). No components yet.

## Packages

| Package           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `@iris-ui/core`   | Framework-agnostic store + state machine abstraction     |
| `@iris-ui/tokens` | `IrisTheme` types + Light/Dark default themes            |
| `@iris-ui/theme`  | `applyTheme`, `getCssVar`, `createThemeStore`            |
| `@iris-ui/icons`  | Icon set interface (implementations TBD)                 |
| `@iris-ui/vue`    | Vue 3 adapter: `ThemeProvider`, `useTheme`, `useMachine` |

## Quick Start

```bash
pnpm install
pnpm dev --filter playground
```

Open http://localhost:5173 to see the Light/Dark theme switching demo.

## Development

```bash
pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # Typecheck all packages
pnpm lint        # Lint all packages
pnpm format      # Format with Prettier
```

## Architecture

Five-layer model with a transversal theme layer:

```
Layer 4: System Skeletons (Admin / CRM / Dashboard)
Layer 3: Layouts          (Sidebar / Header / Dashboard Grid)
Layer 2: Composite        (Table / Tree / Splitter / Gantt)
Layer 1: Primitives       (Button / Dialog / Popover / Select)
Layer 0: Theme System     (tokens / theme / icons)  ← transversal
```

Read [AGENTS.md](./AGENTS.md) for the full vision document.

## License

MIT
