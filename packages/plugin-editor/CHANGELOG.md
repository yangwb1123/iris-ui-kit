# @iris-ui-kit/plugin-editor

## 1.0.2

### Patch Changes

- fix(plugins): accept compatible pre-1.0 framework adapter versions without forcing major plugin releases

## 1.0.1

### Patch Changes

- @iris-ui-kit/react@0.2.2
- @iris-ui-kit/solid@0.2.2
- @iris-ui-kit/svelte@0.2.2
- @iris-ui-kit/vue@0.2.21

## 1.0.0

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

## 0.1.0

### Minor Changes

- 67e1e2e: ### Cross-framework behavior contracts
  Added Select, Menu, Alert, Banner, SplitButton, and Form contract scenarios across all 4 frameworks (37 scenarios, 148 tests). These shared scenarios verify identical overlay lifecycle, form validation, and interaction behavior across React, Vue, Solid, and Svelte.

  ### Column virtualization (pro-table)

  Wired applyColumnWindow into all 4 framework adapters. When columnVirtualized is enabled, only viewport-visible columns are rendered in the tbody, with the table offset via marginLeft to preserve scroll position.

  ### Editor plugin

  IrisCodeEditor now supports completions (autocomplete via @codemirror/autocomplete) and diff view (base prop with LCS-based change decorations).

  ### CMS demos

  All 4 CMS apps (React, Vue, Solid, Svelte) now have auth + login + RBAC menu filtering + notifications plugin integration. React and Vue also have CommandPalette with keyboard shortcut.

  ### Portal control

  Added portalTarget/teleport props to Svelte Select/Menu and Vue Select, allowing inline rendering for testing and controlled environments.

  ### CI instrumentation

  Added bench, size, arch-check, RSC, and format checks to CI workflow.

### Patch Changes

- Updated dependencies [91ca7ec]
- Updated dependencies [67e1e2e]
  - @iris-ui-kit/core@0.1.0
