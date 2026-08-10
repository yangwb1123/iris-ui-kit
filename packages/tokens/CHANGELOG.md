# @iris-ui-kit/tokens

## 0.3.0

### Minor Changes

- 267713a: **美学打磨（aesthetic review P1-P15）**
  - 新增 token：`surface.floating`（浮层层级，dark 脱离卡片）、`success.foreground` / `danger.foreground` / `info.foreground`（语义色前景 ink，dark 深墨 AA）
  - `info` 色相 `#3b82f6 → #0ea5e9`（light）/ `#60a5fa → #38bdf8`（dark）——与 primary 拉开色相，语义不再像"坏掉的 primary"
  - `radius.sm` 2 → 4（软化微家族）
  - 阴影双层分层（light /0.05+/0.06 系，dark /0.2+/0.4）
  - `letter.spacing.tight` -0.01 → -0.02em（display 标题）、`wide` 0.02 → 0.04em（label）
  - 浮层入场动效（CSS 变量 + prefers-reduced-motion 归零）、全局 focus-visible ring、Card padding/阴影对齐、Button hover color-mix、Table row hover/selected、Statistic 值 token 化（20/24/30）、Badge sm 12px、Switch 150ms 同步、EmptyState 图标容器、z-index token 化

- a5a34d9: **设计系统刻度补全 + 全仓 token 统一**
  - 新增 font.size 完整刻度（xs/sm/md/base/lg/xl/2xl/3xl/4xl = 12/13/14/15/16/18/20/24/30）+ font.weight / line.height / letter.spacing 家族
  - 新增 space.xxs~5xl 4pt 间距刻度 + control.height.sm/md/lg（28/34/40）
  - 新增 shadow.xl（浮层大阴影）、on.color、warning.foreground（彩色表面前景对比度纪律）
  - **注意**：`iris.font.size.md` 15px → 14px、`iris.font.size.lg` 18px → 16px（消费面仅 drawer/charts，属刻度统一的一部分）
  - 全仓组件样式迁移为 var(--iris-\*) 驱动（589 处违规归零：裸字号/魔法间距/fallback 漂移/硬编码阴影）
  - 插件注册 token 恢复嵌套 var 消费（宿主可覆盖）

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
