# Iris UI

> AI 原生、**四框架**、token-driven、**插件可扩展**的 UI 基础设施。一套框架无关的 `@iris-ui-kit/core` 定义全部逻辑与组件行为；每个框架适配器是薄桥，每层产物由 token 换肤；重型能力以插件按需 `use`。

## 状态

- **四框架完全对齐**：`react`/`vue`/`solid`/`svelte`，**同名同语义**导出 + 子路径 `exports`。manifest 实测 **151 组件**（全部 4 框架 151 对齐）。~2500+ 测试，四道质量门 + size/RSC/bench/format/arch-check/parity 全绿。
- **核心是复用逻辑之家**：组件行为（选择/展开/数据视图/键盘 roving/表单/异步/分页/admin shell/CRUD 资源/窗口管理/配置文件/命令/通知/文件系统/剪切板历史…）全部沉淀在 core，四框架共享；适配器只渲染 + 桥接反应式。
- **插件生态已扩展**：12 个插件（`plugin-locale-zh`/`plugin-editor`/`plugin-pro-table`/`plugin-charts`/`plugin-form-builder`/`plugin-notifications`/`plugin-admin`/`plugin-calendar`/`plugin-dashboard`/`plugin-kanban`/`plugin-markdown`/`plugin-query-builder`），全四框架 UI 桥接，**全部 12 个已演示**。
- **生产就绪面闭环**：SSR 安全（`useId` + 无 DOM 测试 + React `'use client'`）· axe 无障碍门 · i18n · RTL（逻辑属性）· `prefers-reduced-motion`/`-color-scheme` · 可加载/可继承皮肤 + 市场 SDK · VitePress 文档站 · changesets 发布流水线 · **MCP 服务**（11 个工具）供 AI Agent 消费 · **合约测试系统**（30+ 场景跨四框架统一验证）· **ESLint 插件**（4 个规则）。

| 包                                      | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui-kit/core`                     | 零框架依赖：store、引擎（machine/form/i18n/virtual/async/pagination/tabsNav）、**控制器**（selection/expansion/data-view/roving/admin-shell/resource/cell-edit/cell-range/sortable/window/profile/commands/notifications/fs/clipboard-history）、**数据韧性层**（disposable/query-cache/realtime/outbox/event-bus/circuit-breaker/rate-limiter/resilient-fetcher）、**纯材料**（color/date/nav/compareValues…）、插件契约、export（toCsv/toSpreadsheetXml）、**合约测试框架**（30+ 场景跨框架验证） |
| `@iris-ui-kit/tokens`                   | `IrisTheme` 类型 + light/dark 默认主题 + DTCG/Style Dictionary 集成                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `@iris-ui-kit/theme`                    | `applyTheme`/`getCssVar`/`createThemeStore`/RTL/色彩方案跟随/方向切换                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@iris-ui-kit/skins`                    | 可加载皮肤引擎：继承、自定义命名空间、持久化、FOUC 防闪、实时 patch、市场 SDK                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@iris-ui-kit/icons`                    | Feather 风格结构化图标集（90+ 可单独 tree-shake 导出）                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@iris-ui-kit/{react,vue,solid,svelte}` | Layer 1–4 + Behaviors + 引擎/皮肤桥 + `IrisProvider` + `usePlugin`/`usePluginStore`；子路径 exports                                                                                                                                                                                                                                                                                                                                                                                                 |
| `@iris-ui-kit/plugin-*` (12 个)         | 单包多子路径（`/core` 框架无关 + `/{react,vue,solid,svelte}` UI）；按需 `use`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@iris-ui-kit/manifest`                 | 扫描四 barrel + tokens → `manifest.json`/`llms.txt`；AI 原生消费层                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@iris-ui-kit/mcp`                      | MCP 服务（11 个工具：`list_components`/`search_components`/`get_component_api`/`scaffold_component`/`scaffold_view`/`generate_view`/`generate_test`/`suggest_components`/`validate_usage`/`get_architecture`/`generate_form`）                                                                                                                                                                                                                                                                      |
| `@iris-ui-kit/cli`                      | `cli.mjs` 统一工程命令 + 35+ checks/ 质量脚本                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@iris-ui-kit/eslint-plugin`            | 4 规则：no-internal-import、use-iris-provider、plugin-needs-registration、no-legacy-tone                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps` (19 个)                          | playground (Vue/React)、CMS (四框架)、desktop-os (四框架 + Tauri + Wails)、SSR (Next/Nuxt/SolidStart/SvelteKit)、docs、todo-app                                                                                                                                                                                                                                                                                                                                                                     |

## 架构

```
插件（12 个，按需 use）              IrisProvider(plugins[])
══════════════════════════════════════════════════════════
Layer 4  系统骨架  AdminLayout/NavMenu/Tabs               ✅ 四框架
Layer 3  布局      Stack · Container · Grid · Sidebar     ✅ 四框架
Layer 2  复合      Table · Tree · VirtualScroll · Menu    ✅ 四框架
Layer 1  元原语    展示 / 表单 / 浮层 / 反馈（88+ 原语）  ✅ 四框架
──────────────────────────────────────────────────────────
Layer 0  逻辑+主题 @iris-ui-kit/core（引擎+控制器+纯材料+数据韧性）
        正交 Behaviors  Resizable · Movable · Hotkey · ClickOutside · LongPress
        数据韧性层      9 个原语全部接入真实消费者
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

## 组合模式速查

| 需求                                    | 用什么                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| 给任意子元素附加行为                    | `IrisSlot` + `mergeSlotProps` + `composeRefs`                   |
| 浮层定位 + 关闭                         | `useFloating`（`@floating-ui/dom`）+ `useDismiss`               |
| 模态（焦点陷阱+滚动锁+遮罩）            | `useFocusTrap` + `useBodyScrollLock`                            |
| 受控+非受控双模                         | `value !== undefined ? value : internal`                        |
| 键控选择 / 展开 / roving 焦点           | `createSelectionModel` / `createExpansion` / `nextEnabledIndex` |
| CRUD 列表                               | `createResourceController` + `useResourceController`            |
| 实时数据 + 自动重连                     | `useReconnectingSource` / `createReconnectingSource`            |
| 弹性数据获取                            | `useResilientFetcher` / `createResilientFetcher`                |
| 生命周期自动清理                        | `useDisposableScope` / `createDisposableScope`                  |
| 离线变更队列                            | `createOutbox` 接入 `createDataSource`                          |
| 管理 shell                              | `createAdminShell`（greenfield）/ nav+tabsNav 选择器            |
| 换肤/跟随系统                           | `createSkinEngine` + `SkinProvider` + `useSkin`                 |
| 全部 87/87 React 组件正确转发 `...rest` | 从 Button 到 Table 均已修复                                     |

## 最近完成

- Form Builder 嵌套字段递归验证 + 表单引擎基准测试（setFieldValue @10k / validate @1k / array @1k）+ 韧性层基准测试（cache/breaker/limiter @10k）
- Desktop OS 四框架实时进程监控 · `@iris-ui-kit/icons` 90+ 图标全量导出 · React 87/87 `...rest` 修复
- 全部 9 个韧性原语接入真实消费者 · 全部 12 个插件均已演示 · Playground React 21 + Vue 15 展示区
- 文档 6 篇指南 + i18n 中英双语 · MCP 10 工具 · ESLint 4 规则 · 四框架 CMS Form Builder + hooks

## 约定

| 类别   | 规则                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------ |
| 命名   | 包 `@iris-ui-kit/<kebab>` · 组件 `Iris<Pascal>` · CSS `--iris-<dash>` · token `iris.<dot>`             |
| 技术栈 | pnpm 9 · Turborepo 2 · TS strict · tsup + svelte-package · Vite · Vitest+jsdom · ESLint 9 + Prettier 3 |

## 未竟（显式决定，非能力缺口）

1. **首个 npm 发布**：5 个核心包已验证外部 `pack+install` 通过，`release.yml` 就绪，按维护者授权执行。
2. **ROADMAP v3 方向**：bench CI、嵌套路径表单、型录 admin 参考实现、Angular/Qwik 适配器——架构级投入，需维护者选择。

## 发布验证

```
pnpm check:pack-install
✓ @iris-ui-kit/core    import ok
✓ @iris-ui-kit/react   import ok
✓ @iris-ui-kit/vue     import ok
✓ @iris-ui-kit/solid   import ok
✓ @iris-ui-kit/svelte  exports ok (7 paths)
```
