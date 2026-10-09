# @iris-ui-kit/icons

## 0.3.0

### Minor Changes

- 250484b: Add the searchable, categorized `IrisIconPicker` to all four framework adapters, with semantic-name helpers and localized default labels. Add an optional Iconify JSON provider that converts a restricted, validated SVG subset—including safe nested groups, gradients, clip paths, and masks—into structured icons. Export `normalizeIconNodes` to sanitize and bound custom icon trees before rendering, including cyclic nodes, unsafe tags, event attributes, and external paint URLs.

### Patch Changes

- Publish a coherent public graph after the shared layout/size/Toast and bounded SVG
  security fixes. Rebuild every public package and resolve production workspace
  dependencies to matching concrete versions. Advance otherwise unchanged package
  versions when their packaged dependency manifests or generated public contracts
  change; never replace an immutable existing artifact. Keep the native dev TLS
  certificate helper private. The explicitly authorized core/icons size rebaseline
  retains finite 72/12KiB entry-gzip limits and the existing single-icon hard gate.
- Keep compacted variable declarations separate so Nitro automatic imports cannot
  inject a conflicting H3 `send` binding for the public icon. Retain names, arity,
  purity annotations, source maps, and the existing no-mangling policy.
- Collect SVG ids, typed references and nearest-definition dependencies in a single bounded tree traversal. Preserve forward references, nested-definition ownership, error precedence, cycle rejection and existing security limits without changing exports or identifier spelling.
- Compact published JavaScript without identifier mangling, retaining function/class names, directives, source maps, and consumer-facing PURE annotations. Preserve single-icon and single-Vue-export tree-shaking instead of stripping purity metadata during build minification.

## 0.2.0

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

## 0.1.0

### Minor Changes

- 91ca7ec: First public release of Iris UI — a token-driven, cross-framework (React 18 + Vue 3) component library.
  - 5-layer architecture (Theme → Meta Primitives → Composite → Layouts → System Skeletons) plus an orthogonal Behaviors layer, with full React⇔Vue parity (96 components).
  - Six framework-agnostic engines in `@iris-ui-kit/core`: state machines, form orchestration, i18n, virtualization windowing, async resources, and server-side pagination — each with thin dual-adapter bridges.
  - Production-readiness: SSR-safe IDs + render smoke tests, axe-core accessibility gate, i18n (Intl + overridable copy), reduced-motion / color-scheme / RTL theme foundations, variable-height virtualization, a machine-readable manifest (`llms.txt`), and a bundle-size budget.
