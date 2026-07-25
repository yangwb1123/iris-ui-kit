# Contributing to Iris UI

## Setup

```bash
pnpm install
pnpm build          # Build all packages
pnpm --filter @iris-ui/core build  # Build a specific package
```

## Project Structure

```
packages/
  core/           # Framework-agnostic engines (zero framework deps)
  {react,vue,solid,svelte}/  # Thin adapter over core
  tokens/         # IrisTheme types + light/dark themes
  theme/          # applyTheme, createThemeStore, CSS var utilities
  skins/          # Loadable skin system (inheritance, FOUC, marketplace)
  icons/          # Feather-style structured icon set
  manifest/       # Machine-readable component manifest (manifest.json/llms.txt)
  mcp/            # MCP server (10 tools for AI agents)
  cli/            # Developer CLI (list, scaffold, codemod)
  eslint-plugin/  # ESLint plugin (4 rules)
  plugin-*/       # 12 plugins (form-builder, charts, editor, kanban, etc.)
apps/
  cms{-react,-solid,-svelte}  # CMS demos (one per framework)
  playground{-react}          # Component showcases (Vue + React)
  desktop-os{-vue,-solid,-svelte}  # Desktop OS demos
  ssr-{next,nuxt,solidstart,sveltekit}  # SSR compatibility demos
  todo-app/       # Standalone todo demo
  docs/           # VitePress documentation site (en + zh-CN)
```

## Workflow

1. Create a branch from `main`.
2. Make changes.
3. Run quality gates:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   # Or for a specific package:
   pnpm --filter @iris-ui/react test
   pnpm --filter @iris-ui/react typecheck
   ```
4. If adding a new feature, add tests:
   - **Unit tests**: alongside the source file (`Component.test.tsx`)
   - **Contract tests**: in `packages/core/src/contracts/scenarios/` + adapters
   - **Benchmarks**: in `packages/core/src/*.bench.ts`
5. Add a changeset: `pnpm changeset`
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
7. Open a PR.

## Testing Patterns

### Unit Tests

```tsx
// packages/react/src/primitives/button/Button.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { IrisButton } from './Button'

it('renders with variant', () => {
  const { container } = render(<IrisButton variant="solid">Click</IrisButton>)
  expect(container.querySelector('[data-iris-button-variant]')).toBeTruthy()
})
```

### Cross-Framework Contract Tests

Add a scenario in `packages/core/src/contracts/scenarios/` then wire it in all 4 adapters:

```ts
// core scenario
export const buttonScenario: ContractScenario = { ... }

// React runner
await runContract(buttonScenario, driverFor(container), expect)

// Vue runner
await runContract(buttonScenario, driverFor(wrapper.element as HTMLElement), expect)
```

### Benchmarks

```ts
// packages/core/src/*.bench.ts
bench('10k operations', () => {
  for (let i = 0; i < 10_000; i++) {
    /* code to measure */
  }
})
```

## Design Principles

Read [AGENTS.md](./AGENTS.md) — it is the source of truth for:

- **A/B/C classification**: Where logic lives (core vs adapter vs plugin)
- **Layer model**: Primitives → Composite → Layouts → Systems
- **Plugin system**: createPlugin + IrisProvider
- **Naming conventions**: `IrisPascal`, `--iris-kebab`, `iris.dot`

### Key Rules

- **Never** import React/Vue/Solid/Svelte in `packages/core/` (verified by CI)
- **Always** use `var(--iris-*)` for colors/spacing/radii — never hardcode hex values
- **Always** forward `{...rest}` to the root DOM element in React components
- **Always** add JSDoc to public APIs (it powers the AI manifest)
- **Always** use CSS logical properties (`margin-inline-start` not `margin-left`)

## Code Style

- TypeScript `strict` mode with `noUnusedLocals` and `noUnusedParameters`
- All public APIs have JSDoc (JSDoc is the AI's context — write it for AI as much as humans)
- Component props are declarative; never accept functions as props (event callbacks are fine)
- Use `prettier` for formatting: `pnpm format`
- ESLint 9 flat config with custom Iris UI rules

## Key Commands

```bash
pnpm dev          # Vue + React playgrounds
pnpm test         # All tests
pnpm build        # All packages
pnpm typecheck    # All typechecks
pnpm lint         # All linting
pnpm bench        # Performance benchmarks
pnpm size         # Bundle size budget check
pnpm gen:manifest # Regenerate component manifest
pnpm format       # Format code with Prettier
```

## Reporting Issues

Open a GitHub issue with:

- A minimal reproduction
- Expected vs. actual behavior
- Environment (Node version, package manager, OS)
- Framework (React/Vue/Solid/Svelte) and version
