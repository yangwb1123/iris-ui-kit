# @iris-ui-kit/plugin-admin

## 2.0.3

### Patch Changes

- a4c280b: Defer Admin DataPage requests until the client mount lifecycle so server rendering and uncommitted renders remain side-effect free.
- c154245: Fix five defects found by running the gates on a real machine, plus wire pbatch
  (ai-batch-runner) into the repo.

  - `createDataSource` published the loaded rows **twice** on every load:
    `reapplyPendingOptimistic` wrote back the snapshot the caller had just
    published even when no optimistic layer was pending. The duplicate emission
    cost an extra render in all four adapters and defeated React's referential
    bail-out. The optimistic-layer arithmetic now lives in
    `data-source-optimistic.ts` (pure, framework-agnostic) and skips the redundant
    write.
  - `plugin-admin`: a client-side delete located its row by object identity
    (`clientRows.indexOf(current)`) while the resource publishes _clones_, so
    `indexOf` was always `-1` and the delete silently removed nothing. Deletion
    now matches on the row key, like the update path already did.
  - `@iris-ui-kit/tokens`: add `iris.radius.full` (pill radius). `IrisIconPicker`
    referenced `--iris-radius-full` in all four adapters while no theme defined it.
  - `MonthPicker`: the year header was styled in React/Vue but unstyled in
    Solid/Svelte, so the same control rendered at a different size per framework.
  - `@iris-ui-kit/plugin-locale-zh`: add the 16 `iconPicker.*` translations that
    `IrisIconPicker` introduced; the "no English fallback" guard was red.

  Engineering: `scripts/lib/run-pnpm.mjs` no longer hands pnpm's native binary to
  `node` (that produced a `SyntaxError` and a non-zero status indistinguishable
  from a real gate failure, breaking `check:manifest`, `check:docs-reference` and
  the four SSR production-route suites on macOS); `check-doc-facts --write` now
  actually rewrites the counts line it claims to rewrite; `pnpm test:scripts`
  covers the launcher and runs in CI.

- Publish a coherent public graph after the shared layout/size/Toast and bounded SVG
  security fixes. Rebuild every public package and resolve production workspace
  dependencies to matching concrete versions. Advance otherwise unchanged package
  versions when their packaged dependency manifests or generated public contracts
  change; never replace an immutable existing artifact. Keep the native dev TLS
  certificate helper private. The explicitly authorized core/icons size rebaseline
  retains finite 72/12KiB entry-gzip limits and the existing single-icon hard gate.
- 0b0d23f: Propagate AbortSignals through cached, resilient, resource, and Admin fetchers so owner teardown can cancel foreground and stale-while-revalidate requests.
- Updated dependencies [c154245]
- Updated dependencies [250484b]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [0b0d23f]
- Updated dependencies [1a1f48f]
- Updated dependencies
  - @iris-ui-kit/core@0.2.7

## 2.0.2

### Patch Changes

- fix(plugins): accept compatible pre-1.0 framework adapter versions without forcing major plugin releases

## 2.0.1

### Patch Changes

- @iris-ui-kit/react@0.2.2
- @iris-ui-kit/solid@0.2.2
- @iris-ui-kit/svelte@0.2.2
- @iris-ui-kit/vue@0.2.21

## 2.0.0

### Minor Changes

- 38f5b85: ### Data Resilience Layer (all 9 primitives wired into real consumers)
  - `createDisposableScope` integrated into `createAsyncResource` — controllers now extend `Disposable` with proper lifecycle teardown
  - `createResilientFetcher` composed of query cache + circuit breaker + rate limiter, wired into `createDataSource` via optional `resilient` config
  - `createOutbox` (offline mutation queue) integrated into `createDataSource` via optional `outbox` config − at-least-once, in-order delivery
  - `createReconnectingSource` demonstrated in CMS realtime page + Desktop OS process monitor (all 4 frameworks)
  - `createResourceController` extended with `resilient` pass-through option

  ### React: All 87 primitive components now forward `...rest`

  Every Iris React component now correctly spreads `...rest` props to its root DOM element, ensuring `aria-*`, `data-*`, and other unlisted HTML attributes are forwarded.

  ### Cross-framework hooks (React/Vue/Solid/Svelte)
  - `useReconnectingSource` / `toReconnectingSource` — realtime subscription with exponential-backoff reconnection
  - `useDisposableScope` / `toDisposableScope` — automatic cleanup lifecycle management
  - `useResilientFetcher` (React) — hardened async fetcher with cache + breaker + limiter

  ### Icons: All 90+ icons now individually tree-shakeable

  Previously only ~20 icons had named exports. Now `chevronDown`, `edit`, `trash`, `user`, `settings`, `calendar`, `bell`, `star`, `heart` and 70+ more are individually exportable.

  ### Cross-framework CMS demos
  - Form Builder (`@iris-ui-kit/plugin-form-builder`) demo added to all 4 CMS apps (React/Vue/Solid/Svelte)
  - Realtime data page (`createReconnectingSource`) in CMS React
  - ProTable CRUD demo in CMS React
  - Markdown documentation page in CMS React
  - Chinese i18n (`@iris-ui-kit/plugin-locale-zh`) enabled in CMS React with `locale="zh-CN"`

  ### Desktop OS enhancements
  - Real-time process monitor (`createReconnectingSource` + `createDisposableScope`) added to all 4 desktop shells (React/Vue/Solid/Svelte)
  - Data app now shows live connection status with automatic reconnection

  ### Documentation site
  - 6 comprehensive guides (Getting started, Theming, Data & Resilience, Plugin Development, AI-native, Cross-platform)
  - i18n support: English + Simplified Chinese (zh-CN) with full language switching
  - Interactive component explorer with 4-framework live preview
  - Full README rewrite reflecting current 25-package ecosystem

  ### Plugin ecosystem: all 12 plugins now have live demos

  Every plugin is demonstrated in either the Playground (21 sections) or CMS apps:
  - `plugin-form-builder`, `plugin-pro-table` — CMS demos
  - `plugin-charts`, `plugin-calendar`, `plugin-markdown` — Playground sections
  - `plugin-query-builder`, `plugin-kanban`, `plugin-editor` — Playground sections
  - `plugin-dashboard`, `plugin-admin` — Playground sections
  - `plugin-notifications` — integrated into all CMS apps
  - `plugin-locale-zh` — CMS i18n + docs site

  ### MCP server: 10 tools

  Added `get_architecture` tool returning layer model, resilience primitives, plugin ecosystem, and design tokens in a single call — 9 previous tools already existed (list, search, get-api, scaffold, generate-view, generate-test, suggest, validate).

  ### ESLint plugin: 4 rules

  Added `no-legacy-tone` rule detecting `tone="error"` (should be `"danger"`) alongside existing `no-internal-import`, `use-iris-provider`, and `plugin-needs-registration` rules.

  ### E2E testing

  Added Playwright E2E tests for Form Builder and Realtime pages alongside existing smoke and visual regression tests (3 screenshot baselines).

### Patch Changes

- Updated dependencies [38f5b85]
  - @iris-ui-kit/core@0.2.0
  - @iris-ui-kit/react@0.2.0
  - @iris-ui-kit/vue@0.2.0
  - @iris-ui-kit/solid@0.2.0
  - @iris-ui-kit/svelte@0.2.0

## 1.0.0

### Patch Changes

- Updated dependencies [91ca7ec]
- Updated dependencies [67e1e2e]
  - @iris-ui-kit/core@0.1.0
  - @iris-ui-kit/react@0.1.0
  - @iris-ui-kit/vue@0.1.0
  - @iris-ui-kit/solid@0.1.0
  - @iris-ui-kit/svelte@0.1.0
