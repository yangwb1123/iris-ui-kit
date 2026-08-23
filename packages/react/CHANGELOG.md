# @iris-ui-kit/react

## 0.3.0

### Minor Changes

- dda2643: feat(react): IrisCommandPalette 新增 opt-in `virtual` prop

  - `virtual`（默认 `false`）开启后，结果列表经 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 命令只挂载 ≤ 20 行 DOM，spacer 高度 = Σ 行高（header 28px / item 36px，`height="100%"` 保留 70vh 流式表面），键盘导航（↑/↓/环绕/查询重置/hover）把活动行滚入视口（core 钳制偏移）
  - 列表模型复用：新增 flat→enabledIdx 记忆化映射，替换原 O(n²) `findIndex`（两条路径都受益，纯性能、DOM 不变）；共享 `renderRow` 供普通 map 与虚拟窗口；`keyOf` 精确复刻现有 header 键公式（`g-${label}-${i}`）防按键逐字重挂载
  - 默认关闭：`virtual=false` 与改动前逐字节一致，既有 15 个 palette 测试零改动全绿（新增 A1–A8 验收：窗口挂载/精确 spacer/钳制滚动/环绕/查询重置/混合高度/禁用行/空态）
  - 零新增导出、零 core 改动、零新依赖 ⇒ manifest/llms.txt 不变；Playground React 新增 10k 条目 palette 演示 + virtual 开关

### Patch Changes

- dda2643: feat(cascader): 四框架 IrisCascader 新增 opt-in `virtual` prop

  - `virtual`（默认 `false`）开启后，每个打开的列经框架 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 选项列只挂载 ≤ 20 行 DOM，spacer 高度 = count × 行高
  - 固定确定性尺寸（零旋钮）：视口 240px（即现有 maxHeight）、行高按 size（sm 28 / md 34 / lg 40，solid 无 size 恒 34）、buffer 4
  - react/solid 桥新增可透传 `role`（solid 补 `[key: string]: unknown` + rest 转发到滚动容器）；vue/svelte 桥经 attrs/rest 原样透传，零桥改动
  - 默认关闭：`virtual=false` 与改动前逐字节一致，四框架既有 cascader 测试零改动全绿
  - 零新增导出、零 core 改动、零新依赖 ⇒ manifest/llms.txt 不变

- dda2643: feat(transfer): 四框架 IrisTransfer 新增 opt-in `virtual` prop（双面板窗口化）

  - `virtual?: IrisTransferVirtualOptions { itemHeight; height?; buffer? }`（镜像 `IrisTableVirtualOptions`），开启后两个面板列表经各框架 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 选项只挂载 ≤ 11 行 DOM，spacer 高度 = count × 行高
  - `height` 默认 200（svelte 240，即其面板现有 max-height）；滚动容器保持 `flex:1` + `maxHeight` + content-box，与现有 ul/div 面板布局一致
  - 行渲染共享：react/vue 虚拟路径行标签为 `div`（`li` 入 div 会破坏 HTML 合法性），solid 保留 `role="option"` + `aria-selected`（`li`/`div` 双拼），svelte 保留 `<label>` 行（`row` snippet 双路径复用）
  - 空态、搜索过滤、全面板计数头、禁用项、value-keyed 选择（窗口化不丢勾选）在虚拟路径下行为不变；`data-iris-transfer-list` 经 rest/attrs 落到虚拟滚动根（react/vue）
  - 默认关闭：不传 `virtual` 与改动前逐字节一致，四框架既有 transfer 测试零改动全绿（新增 V1–V7 验收 × 4 框架：窗口挂载/jsdom 缓冲窗/滚动驱动窗口至第 9993 项/移动/空态/搜索计数/禁用）
  - 新增导出 `IrisTransferVirtualOptions`（四 barrel）⇒ manifest/llms.txt 与 docs components.md 已重新生成；零 core 改动、零新依赖

- dda2643: feat(react): IrisTree 新增 opt-in `virtual` prop（窗口化渲染扁平节点列表）

  - `virtual?: IrisTreeVirtualOptions { itemHeight; height; buffer? }`（镜像 `IrisTableVirtualOptions`），开启后经 `IrisVirtualScroll` 桥由 core `createVirtualizer` 只挂载可见窗口 + buffer 的 treeitem 行——5k 节点仅挂载 ≤ 23 行 DOM，spacer 高度 = count × 行高；`keyOf` 用节点 id，展开/折叠不丢滚动位置（R4）
  - 滚动根即树根：`role="tree"` / `tabIndex={-1}` / `onKeyDown` / `data-iris-tree` / rest / style 全部落到虚拟滚动根，aria 树完整（role="tree" → 无角色包装 → role="treeitem"）
  - 键盘导航滚动到活动行（scrollToIndex + refresh，不依赖原生 scroll 事件）；焦点跟随活动行跨窗口（仅键盘移动触发，rAF 重查 + 5 帧上限 + 过期链丢弃——避免旧链在目标行重新挂载时抢焦）
  - `renderFlatNode` 抽取为共享行渲染器：虚拟/非虚拟两路径逐字节一致；不传 `virtual` 与改动前完全一致（28 个既有测试零改动全绿）
  - 新增导出 `IrisTreeVirtualOptions`（tree barrel）+ `IrisVirtualScrollProps` 增加 `tabIndex`/`onKeyDown` 两个转发 prop（type-only，运行时不变量不变）；manifest/llms.txt 与 docs components.md 已重新生成；零 core 改动、零新依赖

## 0.2.2

### Patch Changes

- Updated dependencies [267713a]
- Updated dependencies [a5a34d9]
  - @iris-ui-kit/tokens@0.3.0
  - @iris-ui-kit/theme@0.3.0
  - @iris-ui-kit/skins@0.1.1

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

### Patch Changes

- Updated dependencies [38f5b85]
  - @iris-ui-kit/core@0.2.0
  - @iris-ui-kit/tokens@0.2.0
  - @iris-ui-kit/theme@0.2.0
  - @iris-ui-kit/skins@0.1.0
  - @iris-ui-kit/icons@0.2.0

## 0.1.0

### Minor Changes

- 91ca7ec: First public release of Iris UI — a token-driven, cross-framework (React 18 + Vue 3) component library.
  - 5-layer architecture (Theme → Meta Primitives → Composite → Layouts → System Skeletons) plus an orthogonal Behaviors layer, with full React⇔Vue parity (96 components).
  - Six framework-agnostic engines in `@iris-ui-kit/core`: state machines, form orchestration, i18n, virtualization windowing, async resources, and server-side pagination — each with thin dual-adapter bridges.
  - Production-readiness: SSR-safe IDs + render smoke tests, axe-core accessibility gate, i18n (Intl + overridable copy), reduced-motion / color-scheme / RTL theme foundations, variable-height virtualization, a machine-readable manifest (`llms.txt`), and a bundle-size budget.

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
  - @iris-ui-kit/tokens@0.1.0
  - @iris-ui-kit/theme@0.1.0
  - @iris-ui-kit/icons@0.1.0
  - @iris-ui-kit/skins@0.0.1
