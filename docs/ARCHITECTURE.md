# ARCHITECTURE

> Concise system design. Token-lean — read this before deep-scanning.

## Layers (framework-agnostic → framework-coupled)

1. **`@iris-ui-kit/tokens`** — flat token maps (colors/spacing/radii), light/dark themes; DTCG + Style-Dictionary exports.
2. **`@iris-ui-kit/theme`** — `applyTheme`/`themeCssVarEntries` (single source for runtime + static `themeToCss`), `applyDirection`, `injectGlobalStyles` (reduced-motion + forced-colors), skin system. Derives `--iris-{semantic}-subtle`.
3. **`@iris-ui-kit/core`** — pure framework-agnostic controllers + material: `createStore` (subscribable, selective `subscribeWith`), selection/tree-selection, roving, data-view (filter/sort/group/`flattenTree`/`withSortedChildren`), `createDataSource`, expansion, admin-shell, cell-range/edit, `createSortable`+`closestCenter`, file-save/clipboard registries, i18n, color math, `contracts` (cross-fw behavior harness). NO DOM, NO framework imports.
4. **Adapters** — `@iris-ui-kit/{react,vue,solid,svelte}`: thin bindings that bridge core stores to each framework's reactivity (`useSyncExternalStore` / `shallowRef` / `createSignal` / `$state`). ~144 components at parity. Vue/Solid/Svelte authored as h()-render `.ts` / `.tsx` / `.svelte` (no Vue SFCs).
5. **Plugins** — `@iris-ui-kit/plugin-*` (pro-table, form-builder, kanban, dashboard, calendar, markdown, charts, notifications, query-builder, editor, admin, locale-zh) + `@iris-ui-kit/{cli,eslint-plugin,manifest,mcp}`. Peer-dep the adapters; single-package multi-framework build (tsup array + svelte-package).

## Key invariants

- Every feature ships across all 4 frameworks (parity is asserted by `manifest` + growing `contracts`).
- Behavior lives in core; adapters render. New behavior = core controller + 4 bridges (the canonical fan-out: React reference → 3-agent mirror → full turbo + commit).
- 4 quality gates per package: `turbo run test typecheck lint build`. Plus size budget + manifest currency.
- No raw-HTML injection (a hook blocks the escape-hatch prop); dynamic SVG/HTML via structured nodes.

## Build / test

- pnpm workspaces + turbo. Plugins: tsup (ESM+CJS+DTS for core/react/vue/solid) + svelte-package; 3 tsconfigs + 3 vitest configs. jsdom for component tests.
- CI: `.github/workflows/ci.yml` + `release.yml`; changesets for versioning.
