# Iris UI

> AI 原生、**四框架**、token-driven、**插件可扩展**的 UI 基础设施。一套框架无关的 `@iris-ui-kit/core` 定义全部逻辑与组件行为；每个框架适配器是薄桥，每层产物由 token 换肤；重型能力以插件按需 `use`。

## 状态（2026-07）

- **四框架完全对齐**：`react` / `vue` / `solid` / `svelte`，**同名同语义**导出 + 子路径 `exports`。当前生成的 manifest 实测 **154 组件**（全部 4 框架 154 对齐）；`154 × 4 = 616` 份框架契约全部从对应适配器源码原生提取（`source: native`），`unavailable = 0`。CI 对测试、覆盖率、类型、lint、构建、27 包外部安装、size、RSC、浏览器 E2E/视觉回归、bench、format、token、生成文档与架构 ratchet 设门。
- **核心是复用逻辑之家**：组件行为（选择 / 展开 / 数据视图 / 键盘 roving / 表单 / 异步 / 分页 / admin shell / CRUD 资源 / 窗口 / 配置 / 命令 / 通知 / 文件系统 / 剪贴板历史 …）与 9 个数据韧性原语全部沉淀在 core，四框架共享；适配器只渲染 + 桥接反应式。
- **插件层就绪**：`IrisProvider(plugins=[…])` + `createPlugin`/`runPlugins`。现有 12 个按需插件覆盖 locale、editor、pro-table、admin、form-builder、charts、calendar、dashboard、kanban、markdown、notifications 与 query-builder。
- **生产就绪面闭环**：SSR 安全（`useId` + 无 DOM 测试 + React `'use client'`）· Next/Nuxt/SolidStart/SvelteKit 同等的多路由/生产 HTTP 证明 · axe 无障碍门 · i18n · RTL（逻辑属性）· `prefers-reduced-motion`/`-color-scheme` · SHA-256 守护的 marketplace/registry · 四框架 CMS 真实页面与浏览器 E2E（无 `GenericPage` 兜底）· Electron/Tauri/Wails 严格 native CI job · VitePress 中英双语文档站 · 11 工具 MCP · 30+ 场景跨框架合约测试 · 4 条架构 ESLint 规则 · changesets 发布流水线。

| 包                                                  | 内容                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui-kit/core`                                 | 零框架依赖：store · 引擎（machine/form/i18n/virtual/async/pagination/tabsNav）· **控制器**（selection/expansion/data-view/roving/admin-shell/resource/cell-edit/cell-range/sortable/window/profile/commands/notifications/fs/clipboard-history）· **数据韧性层**（disposable/query-cache/realtime/outbox/event-bus/circuit-breaker/rate-limiter/resilient-fetcher）· 纯材料 · 插件契约 · export · 跨框架合约场景 |
| `@iris-ui-kit/tokens` · `theme` · `skins` · `icons` | 主题系统：`IrisTheme` + light/dark · `applyTheme`/`applyCssVars`/`createThemeStore`/RTL/减动效/跟随系统 · 可加载皮肤（`extends` 继承 + 自定义命名空间 + 持久化 + FOUC 防闪 + 实时 `patch` + 市场 SDK）· 结构化节点图标                                                                                                                                                                                           |
| `@iris-ui-kit/{react,vue,solid,svelte}`             | Layer 1–4 + Behaviors + 引擎/皮肤桥 + `IrisProvider` + `usePlugin`/`usePluginStore`；子路径 `exports`（`@iris-ui-kit/react/form` …）                                                                                                                                                                                                                                                                             |
| `@iris-ui-kit/plugin-*`                             | 12 个单包多子路径插件（`/core` 框架无关 + `/{react,vue,solid,svelte}` UI）；按需 `use`                                                                                                                                                                                                                                                                                                                           |
| `@iris-ui-kit/{registry,marketplace,cli,mcp}`       | 类型化源码注册表与声明式市场；远程资源 SHA-256 校验；CLI 安装/对比/更新与工程质量工作流；manifest 驱动的 11 个 MCP 工具                                                                                                                                                                                                                                                                                          |
| `@iris-ui-kit/manifest`                             | 扫描四 barrel + tokens → `manifest.json` / `llms.txt`（`pnpm gen:manifest`）；AI 原生消费层                                                                                                                                                                                                                                                                                                                      |
| `apps/*`                                            | 演示台 + VitePress 文档站 + 四框架 CMS + Next/Nuxt/SolidStart/SvelteKit SSR 参考 + Electron/Tauri/Wails 桌面壳                                                                                                                                                                                                                                                                                                   |

> **真相源**：各包 barrel（人读）+ `manifest.json`/`llms.txt`（机读，源码生成）。**不手维护组件清单**；新框架适配器须导出同名同语义组件。
> manifest 的框架 API 同样以四端源码为真相源；不得用另一框架契约或 `unavailable` 占位冒充对齐。

## 架构

```
插件（按需 use）   12 × plugin-*：editor/pro-table/admin/charts/…   IrisProvider(plugins[])
══════════════════════════════════════════════════════════════════════════════════
Layer 4  系统骨架  Login/Dashboard 模板 · AdminLayout/NavMenu/Tabs（admin shell）   ✅ 四框架
Layer 3  布局      Stack · Container · Grid · Sidebar/Header/DashboardGrid          ✅ 四框架
Layer 2  复合      Table · Tree · VirtualScroll · Menu · Toast · 各类 Picker         ✅ 四框架
Layer 1  元原语    展示 / 表单 / 浮层 / 反馈（~88 primitive 目录，跨 L1–L2）         ✅ 四框架
──────────────────────────────────────────────────────────────────────────────────
Layer 0  逻辑+主题 @iris-ui-kit/core（引擎+控制器+韧性+纯材料）· tokens/theme/skins/icons ✅ 框架无关
        正交 Behaviors  Resizable · Movable · Hotkey · ClickOutside · LongPress
        合约测试        30+ ContractScenario 跨四框架统一验证
        桌面 OS 模式    window/profile/commands/notifications/fs/clipboard-history
```

## 不可妥协的原则

1. **逻辑下沉 core，适配器做薄桥**。`grep -rE "from '(vue|react|solid|svelte)'" packages/core/src` 必须为空。
2. **跨框架不跨设计**。同一套 core 工厂，四条薄桥（React `useSyncExternalStore` · Vue `ref`+订阅 · Solid `createSignal` · Svelte `toStore`）。
3. **原语优先**。Layer 2+ 组合 Layer 1 + 共享 hook，不写巨无霸。
4. **AI 原生 API**。声明式 props；每种状态都有 prop（loading/disabled/invalid/error）；文案走 i18n。
5. **Token 杠杆**。组件一行 ≈ 30 token vs 裸 HTML/CSS ≈ 800（93%+ 节省）。
6. **渐进式复杂度**。一个 Button 即可起步；主题/皮肤/Behaviors/引擎/插件按需接入。

## A/B/C 下沉分类

| 类           | 含义                        | 落点                 | 例                                                                                            |
| ------------ | --------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| **A 核心**   | 定义组件行为的状态机/控制器 | core 控制器          | `createSelectionModel`/`createExpansion`/data-view/machine/form/async/window/profile/commands |
| **B 附加**   | 组合上去的可选能力          | 独立、可摇树、或插件 | export（toCsv/toSpreadsheetXml）· 编辑器 · pro-table · 图表 · 中文包                          |
| **C 纯材料** | 无状态纯函数，A/B 共用      | core 纯函数          | `compareValues`/`color`/`date`/`nav`/`computeVirtualRange`                                    |

铁律：**A 零配置在场，B 不用不进包**。

## 插件系统

```ts
// 契约（@iris-ui-kit/core）—— 插件是加法，不是 monkey-patch
createPlugin({ name, install(reg) {
  reg.registerTokens({ '--iris-x': '…' })
  reg.registerMessages('zh-CN', { … })
  reg.registerStore('key', () => …)
}})
<IrisProvider plugins={[editorPlugin]}><IrisCodeEditor language="sql" /></IrisProvider>
```

## 最近完成

- Form Builder 嵌套字段递归验证 + 表单引擎基准测试（setFieldValue @10k / validate @1k / array @1k）+ 韧性层基准测试（cache/breaker/limiter @10k）
- Desktop OS 四框架实时进程监控 · `@iris-ui-kit/icons` 90+ 图标全量导出 · React 87/87 `...rest` 修复
- 全部 9 个韧性原语接入真实消费者 · 全部 12 个插件均已演示 · Playground React 21 + Vue 15 展示区
- 文档指南 + i18n 中英双语 · MCP 11 工具 · ESLint 4 规则 · 四框架 CMS Form Builder + 韧性 hooks

## 组合模式（加新原语/行为前先读对标）

| 需求                                    | 用什么                                                                              | 对标                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| 给任意子元素附加行为（不渲染自身根）    | `IrisSlot` + `mergeSlotProps` + `composeRefs`                                       | `IrisButton as-child`                        |
| 浮层定位 + 关闭                         | `useFloating`（`@floating-ui/dom`）+ `useDismiss`                                   | `IrisPopoverContent`                         |
| 模态（焦点陷阱+滚动锁+遮罩）            | `useFocusTrap` + `useBodyScrollLock`（引用计数单例）                                | `IrisDialogContent`                          |
| 受控+非受控双模                         | `value !== undefined ? value : internal`；下沉 controller 时用 `model.sync` 镜像    | 几乎所有有状态组件                           |
| 键控选择 / 展开 / roving 焦点           | `createSelectionModel` / `createExpansion` / `nextEnabledIndex`（focus() 留适配器） | List/Table/Select/Tree · NavMenu/Tabs        |
| 服务端 CRUD 列表（list+分页+选择+刷新） | `createResourceController` + `useResourceController` 桥                             | cms demos 的 UsersPage                       |
| 实时数据 + 自动重连                     | `createReconnectingSource` + `useReconnectingSource`                                | CMS / Desktop OS 实时数据                    |
| 弹性数据获取                            | `createResilientFetcher` + `useResilientFetcher`                                    | `createDataSource({ resilient })`            |
| 生命周期自动清理                        | `createDisposableScope` + `useDisposableScope`                                      | async/resource/realtime 消费者               |
| 离线变更队列                            | `createOutbox` 接入 `createDataSource`                                              | 离线 mutation                                |
| 菜单↔标签页 admin shell                 | `createAdminShell`（greenfield）/ nav+tabsNav 选择器                                | AdminLayout                                  |
| SSR 稳定 id                             | 框架原生 `useId`，**勿用模块自增计数器**                                            | `IrisDialog`/`IrisFormField`                 |
| 可本地化文案                            | `useI18n().t('key')`，默认值 = 现有英文                                             | `IrisPagination`/`IrisSelect`                |
| 正交叠加能力                            | Behaviors 包裹器（可嵌套）                                                          | `<IrisResizable><IrisList/></IrisResizable>` |
| 换肤/跟随系统/实时 token 编辑           | `createSkinEngine` + `SkinProvider` + `useSkin`                                     | 皮肤系统 / playground                        |

Svelte `asChild` 的单子元素若自带 `class`、`style` 或事件，使用
`{...slotProps.merge({ ...childProps })}`：父 class/style 先合并、子值覆盖冲突样式，
父事件先执行且可用 `preventDefault()` 阻止子事件，SSR 与 hydration 结果一致。
`merge` 为非枚举属性，所以无冲突属性的既有 `{...slotProps}` 写法继续兼容。

## 主题与皮肤

```ts
// 皮肤：部分覆盖 + 继承 + 自定义命名空间，解析后 = 完整 IrisTheme
{ id:'ocean', extends:'dark', tokens:{ 'iris.primary':'#3BA7FF' },
  custom:{ 'brand.gradient':'…' }, variants:{ light:'sunrise', dark:'ocean' } }
```

- JS 键 `iris.background` ↔ CSS `--iris-background`（`toCssVarName`：dots→dashes）；自定义命名空间同理。
- 样式只用 `var(--iris-*)` 或单例注入的 stylesheet（仅当 inline 表达不了：`:hover`/`:focus-visible`/keyframe）。**禁止**硬编码 hex、Tailwind、Emotion、CSS-in-JS、原始 innerHTML。
- 方向相关用 CSS 逻辑属性（`margin-inline-start`/`inset-inline`），勿写死 left/right。
- 皮肤运行时：持久化走可插拔 `SkinStorage`；FOUC 防闪用 `skinBootScript`（`textContent` 注入，**非 innerHTML**）；`patch`/`resetPatch` 非破坏式实时编辑。

## 约定速查 + 质量门

| 类别               | 规则                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 命名               | 包 `@iris-ui-kit/<kebab>` · 组件 `Iris<Pascal>` · 子组件 `Iris<Parent><Child>` · CSS `--iris-<dash>` · token `iris.<dot>` · 机器事件 `SCREAMING_SNAKE` · hook `use<Camel>`                                                                                                |
| 技术栈             | pnpm 9 · Turborepo 2 · TS strict · tsup（库，多入口）+ svelte-package · Vite（应用）· Vitest+jsdom · ESLint 9 flat + Prettier 3 · Changesets                                                                                                                              |
| 提交               | Conventional：`feat(react): add IrisCombobox` / `refactor(selection): …`                                                                                                                                                                                                  |
| 质量门（合并前置） | `pnpm turbo run test typecheck lint build`（test 内含 SSR/axe/i18n）+ coverage + `pnpm size` + 各 `pnpm check:*`（27 包 pack-install/manifest/docs-reference/registry/RSC/desktop）+ 浏览器 E2E/视觉回归 + `pnpm bench` + `pnpm format:check` + `pnpm arch-check:ratchet` |

> core 是复用逻辑之家，size 预算随之上调（core 10KB）——适配器消费控制器后净缩，总字节净降。
> `.github/workflows/ci.yml` 另设 `native-linux`，以
> `IRIS_REQUIRE_NATIVE_BUILD=1` 构建并测试 Electron/Tauri/Wails，禁止工具链缺失时
> 静默跳过。门的当前实际通过状态以 `docs/SPRINT.md` 为准，不由本文件预宣称。

## jsdom 测试陷阱

- 无 `PointerEvent` → 用 `Event` + 手赋 `clientX/Y/button/pointerId`（见 `useDrag.test`）。
- `getBoundingClientRect`/`clientHeight` 返 0；`matchMedia`/`ResizeObserver` 未实现 → 浮层/虚拟滚动只验 wiring，测 color-scheme/auto-measure 时 mock。
- 无 `localStorage` → 皮肤持久化测试须 `vi.stubGlobal`。
- 日期勿用 `toISOString().slice(0,10)`（UTC 偏一天）→ 用 core `formatLocalISO`。
- 共享单例（scroll-lock 计数/toast 队列/stylesheet/皮肤引擎/`createStore`）须 `afterEach` 重置。
- React：子组件 `useEffect` 依赖 context 对象会无限重渲 → 依赖**解构出的稳定回调**；批量用 `setState(prev => …)`。
- **Svelte：勿把 `$state` 变量命名为 `state`**（`$state` 会被读成 store 自动订阅 → 报错）；`generics` 属性 + `$state<T>()` 会破坏 svelte-check 的 rune 识别。
- SSR 测试用 `// @vitest-environment node` 跑 `renderToString`；axe 禁 `color-contrast` 并限 WCAG A/AA。

## svjs 北极星

| 不要                                  | 要                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 一上来同时铺 N 个框架                 | 打透一个到 Radix/Naive 质量再扩；**core 让扩展 ≈ 加薄桥**（react/vue → solid/svelte 即此证明） |
| 适配器写业务逻辑（Resizer in render） | 业务在 core；适配器只渲染 + 桥接                                                               |
| 下沉到让消费变复杂                    | A 零配置在场、B 不用不进包；net-negative 就不下沉                                              |
| 自创命名（`SvButton`）                | 对齐 Radix/Naive；`Iris` 仅作品牌前缀                                                          |
| 实验目录堆积（Table copy/copy2）      | 重构而非加 prop；废码立即删                                                                    |
| 主题/插件后期加（必然推倒重来）       | 主题第一天即设计中心；重型能力一律走插件，core 保持精简                                        |

## 未竟（显式决定，非能力缺口）

1. **首个 npm 发布**：`release.yml` 默认拒绝运行；只有维护者显式设置仓库变量 `IRIS_NPM_RELEASE_ENABLED=true`，且 `main` 的 push CI 成功后，才 checkout 该次 CI 的不可变 `head_sha`。开关与版本决定均属维护者授权。
2. **QRCode**：需正确 QR 编码器（可扫描性 jsdom 无法验证），按决定跳过。
3. **ROADMAP v3 方向**：新框架适配器、可变高度虚拟化、状态机/代码生成进一步做厚等架构级投入，需维护者选择。
