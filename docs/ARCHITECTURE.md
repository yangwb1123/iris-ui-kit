# ARCHITECTURE

> Concise system design. Token-lean — read this before deep-scanning.

## Layers (framework-agnostic → framework-coupled)

1. **`@iris-ui-kit/tokens`** — flat token maps (colors/spacing/radii), light/dark themes; DTCG + Style-Dictionary exports.
2. **`@iris-ui-kit/theme`** — `applyTheme`/`themeCssVarEntries` (single source for runtime + static `themeToCss`), `applyDirection`, `injectGlobalStyles` (reduced-motion + forced-colors), skin system. Derives `--iris-{semantic}-subtle`.
3. **`@iris-ui-kit/core`** — pure framework-agnostic controllers + material: `createStore` (subscribable, selective `subscribeWith`), selection/tree-selection, roving, data-view (filter/sort/group/`flattenTree`/`withSortedChildren`), `createDataSource`, expansion, admin-shell, cell-range/edit, `createSortable`+`closestCenter`, file-save/clipboard registries, i18n, color math, `contracts` (cross-fw behavior harness). NO DOM, NO framework imports.
4. **Adapters** — `@iris-ui-kit/{react,vue,solid,svelte}`: thin bindings that bridge core stores to each framework's reactivity (`useSyncExternalStore` / `shallowRef` / `createSignal` / `$state`). The generated manifest reports 155 components in every adapter; all `155 × 4 = 620` framework contracts are extracted from their native adapter source and none are `unavailable`. Vue/Solid/Svelte are authored as h()-render `.ts` / `.tsx` / `.svelte`.
5. **Plugins and consumption** — 12 `@iris-ui-kit/plugin-*` packages cover pro-table, form-builder, kanban, dashboard, calendar, markdown, charts, notifications, query-builder, editor, admin, and locale-zh. UI plugins expose framework subpaths and declare only the adapter peers they actually compose; the framework-agnostic locale pack remains core-only. `registry`/`marketplace`/CLI distribute typed source and declarative runtime artifacts with SHA-256 integrity checks; manifest/MCP provide the machine-readable AI surface.

## Key invariants

- Every adapter component ships across all 4 frameworks. The manifest asserts name parity, 620 native framework contracts, and zero unavailable contracts; 42 shared behavior scenarios are replayed by all four contract drivers.
- Behavior lives in core; adapters render. New behavior = core controller + 4 bridges (the canonical fan-out: React reference → 3-agent mirror → full turbo + commit).
- Package gates are `test`, `typecheck`, `lint`, and `build`; the workspace also gates coverage, format, generated manifest/docs and registry currency, 27-package external pack/install, size, tokens, RSC, browser E2E/visual regression, benchmarks, desktop parity, and the architecture ratchet.
- No raw-HTML injection (a hook blocks the escape-hatch prop); dynamic SVG/HTML via structured nodes.

## Build / test

- pnpm workspaces + Turbo. Plugins use tsup for bundled framework/core entries plus Svelte packaging where required; jsdom covers component behavior.
- Next, Nuxt, SolidStart, and SvelteKit each exercise routed data/feedback pages, SSR/hydration, and production HTTP tests. Playwright replays the same CMS product journey across four real Vite bundles; each CMS owns real dashboard/login/users/settings/workspace pages rather than a generic fallback.
- CI lives in `.github/workflows/ci.yml`. Its `native-linux` job sets `IRIS_REQUIRE_NATIVE_BUILD=1` and builds/tests Electron, Tauri, and Wails with the required native toolchains instead of accepting skips.
- `release.yml` uses changesets and npm provenance, but is default-deny unless a maintainer sets `IRIS_NPM_RELEASE_ENABLED=true`; it then still requires a successful push CI on `main` and checks out that run's exact `head_sha`. Current combined-worktree gate status lives in `SPRINT.md`.
