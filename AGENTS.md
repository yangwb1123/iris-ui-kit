# Iris UI

> AI 原生、**四框架**、token-driven、**插件可扩展**的 UI 基础设施。一套框架无关的 `@iris-ui/core` 定义全部逻辑与组件行为；每个框架适配器是薄桥，每层产物由 token 换肤；重型能力以插件按需 `use`。

## 状态（2026-06）

- **四框架完全对齐**：`react` / `vue` / `solid` / `svelte`，**同名同语义**导出 + 子路径 `exports`。manifest 实测 **149 组件**（全部 4 框架 149 对齐）。约 1500+ 测试，四道质量门 + size 预算 + RSC + bench + format + arch-check 全绿。
- **核心是复用逻辑之家**：组件行为（选择 / 展开 / 数据视图 / 键盘 roving / 表单 / 异步 / 分页 / admin shell / CRUD 资源 …）全部沉淀在 core，四框架共享；适配器只渲染 + 桥接反应式。
- **插件层就绪**：`IrisProvider(plugins=[…])` + `createPlugin`/`runPlugins`。首批：`plugin-locale-zh`（中文包）、`plugin-editor`（CodeMirror 6，SQL/JSON/JS）、`plugin-pro-table`（vxe 式 CRUD 表格）。
- **生产就绪面闭环**：SSR 安全（`useId` + 无 DOM 测试 + React `'use client'`）· axe 无障碍门 · i18n · RTL（逻辑属性）· `prefers-reduced-motion`/`-color-scheme` · 可加载/可继承皮肤 + 市场 SDK · VitePress 文档站 · changesets 发布流水线。

| 包                                                                           | 内容                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui/core`                                                              | 零框架依赖：store · 引擎（machine/form/i18n/virtual/async/pagination/tabsNav）· **控制器**（selection/expansion/data-view/roving/admin-shell/resource）· **纯材料**（color/date/nav/compareValues/getPageRange…）· **插件契约**（createPlugin/runPlugins）· export（toCsv/toSpreadsheetXml） |
| `@iris-ui/tokens` · `theme` · `skins` · `icons`                              | 主题系统：`IrisTheme` + light/dark · `applyTheme`/`applyCssVars`/`createThemeStore`/RTL/减动效/跟随系统 · 可加载皮肤（`extends` 继承 + 自定义命名空间 + 持久化 + FOUC 防闪 + 实时 `patch` + 市场 SDK）· 结构化节点图标                                                                       |
| `@iris-ui/{react,vue,solid,svelte}`                                          | Layer 1–4 + Behaviors + 引擎/皮肤桥 + `IrisProvider` + `usePlugin`/`usePluginStore`；子路径 `exports`（`@iris-ui/react/form` …）                                                                                                                                                             |
| `@iris-ui/plugin-{locale-zh,editor,pro-table}`                               | 单包多子路径（`/core` 框架无关 + `/{react,vue,solid,svelte}` UI）；按需 `use`                                                                                                                                                                                                                |
| `@iris-ui/manifest`                                                          | 扫描四 barrel + tokens → `manifest.json` / `llms.txt`（`pnpm gen:manifest`）；AI 原生消费层                                                                                                                                                                                                  |
| `apps/{playground,playground-react,docs,cms,cms-react,cms-solid,cms-svelte}` | 四框架演示台 + VitePress 文档站 + 四框架 Vben 式 CMS demo                                                                                                                                                                                                                                    |

> **真相源**：各包 barrel（人读）+ `manifest.json`/`llms.txt`（机读，源码生成）。**不手维护组件清单**；新框架适配器须导出同名同语义组件。

## 架构

```
插件（按需 use）   plugin-editor(CM6) · plugin-pro-table(CRUD) · plugin-locale-zh   IrisProvider(plugins[])
══════════════════════════════════════════════════════════════════════════════════
Layer 4  系统骨架  Login/Dashboard 模板 · AdminLayout/NavMenu/Tabs（admin shell）   ✅ 四框架
Layer 3  布局      Stack · Container · Grid · Sidebar/Header/DashboardGrid          ✅ 四框架
Layer 2  复合      Table · Tree · VirtualScroll · Menu · Toast · 各类 Picker         ✅ 四框架
Layer 1  元原语    展示 / 表单 / 浮层 / 反馈（~88 primitive 目录，跨 L1–L2）         ✅ 四框架
──────────────────────────────────────────────────────────────────────────────────
Layer 0  逻辑+主题 @iris-ui/core（引擎+控制器+纯材料）· tokens/theme/skins/icons     ✅ 框架无关
        正交 Behaviors  Resizable · Movable · Hotkey · ClickOutside —— 包裹任意组件
```

一份 token 改变整个系统视觉；每层产物经 `var(--iris-*)` 渲染。**皮肤** = 主题层之上的可加载单元（部分覆盖 + `extends` 继承，解析为完整 `IrisTheme`，组件零改动）。**Behaviors** = renderless/薄定位包裹器，把 resize/拖动/快捷键/点击外部叠加到任意组件，可嵌套。

## 不可妥协的原则

1. **逻辑下沉 core，适配器做薄桥**。一切「换个框架也一样」的逻辑都属于 core——出现在适配器里即是 bug。验证：`grep -rE "from '(vue|react|solid|svelte)'" packages/core/src` 必须为空。
2. **跨框架不跨设计**。同一套 core 工厂，四条薄桥（React `useSyncExternalStore` · Vue `ref`+订阅 · Solid `createSignal` · Svelte `toStore`）。新增框架 ≈ 重写桥接，不重写逻辑——四框架对齐即此证明。
3. **原语优先**。Layer 2+ 组合 Layer 1 + 共享 hook，不写巨无霸。Popover = `useFloating + useDismiss + IrisSlot`。
4. **AI 原生 API**。声明式 props；除回调外不收函数 prop；命名对齐 Radix/Naive；每种状态都有 prop（loading/disabled/invalid/error）；文案走 i18n 可覆盖字典。
5. **Token 杠杆**。组件一行 ≈ 30 token vs 裸 HTML/CSS ≈ 800（93%+ 节省）。下游在自己的 AGENTS.md 引用 `llms.txt` 让 AI 直接调用。
6. **渐进式复杂度**。一个 Button 即可起步；主题/皮肤/Behaviors/引擎/插件按需接入。

## 新逻辑放哪里 —— A/B/C 下沉分类（核心心智模型）

判别：拿掉它，改变的是组件**「是什么」**(A)、**「能做什么」**(B)、还是**「用什么搭的」**(C)？

| 类              | 含义                        | 落点 / 消费                                   | 例                                                                                                                                                                                       |
| --------------- | --------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A 核心/身份** | 定义组件行为的状态机/控制器 | core 控制器，随组件自动打包；薄桥订阅其 store | `createSelectionModel` · `createExpansion` · data-view（filter→sort→paginate）· `createMachine`/form/i18n/async/pagination/tabsNav · L4：`createAdminShell` · `createResourceController` |
| **B 附加**      | 组合上去的可选能力          | 独立、可摇树、或插件；不用不进包              | export（`toCsv`/`toSpreadsheetXml`）· 编辑器 · pro-table · 中文包                                                                                                                        |
| **C 纯材料**    | 无状态纯函数，A/B 共用      | core L1 纯函数                                | `compareValues`/`cycleSort`/`getPageRange` · `nextEnabledIndex`（roving）· `color`/`date`/`nav` 数学 · `computeVirtualRange`                                                             |

铁律：**A 零配置在场，B 不用不进包**。下沉若让消费 API 变复杂，就不要下沉（受控适配器用 `model.sync` 镜像 prop，把值-shape 映射留在边缘；见 selection 已铺到 17 组件、roving ~19 组件、NavMenu→expansion ×4）。新同类逻辑：纯逻辑（含竞态/边界）进 core + 单测，四端各加薄桥。

## 插件系统

`IrisProvider(plugins=[…])` 在内部 `runPlugins()` 收集注册，注入 theme/i18n/context；与现有 Theme/Skin/I18n Provider 组合，**向后兼容**。

```ts
// 契约（@iris-ui/core）—— 插件是加法，不是 monkey-patch
createPlugin({ name, install(reg) {
  reg.registerTokens({ '--iris-x': '…' })   // CSS 变量
  reg.registerMessages('zh-CN', { … })       // i18n
  reg.registerStore('key', () => …)          // 共享 store
}})
// 用法（install 逻辑框架无关，UI 框架专属）
<IrisProvider plugins={[editorPlugin]}><IrisCodeEditor language="sql" /></IrisProvider>
const store = usePluginStore<T>('key')       // 缺失则 throw
```

**不做** `registerComponent`（动态组件名会牺牲类型/tree-shaking/manifest）——组件保持静态 import；schema 驱动渲染用局部有类型的 `widgets` map。插件包构建是异构三工具链：`tsup` 数组配置（core/react/vue + solid 各一段）+ `svelte-package`；测试 = 三套单框架 vitest 配置串行。

## 状态机判别准则（防 svjs 退化）

仅当组件**有可观察内部状态**且**转换有明确事件语义**（`OPEN`/`CLOSE`/`TOGGLE`）才配 `createMachine`/`createFloatingMachine`。

| 用机器                                                                    | 不用（纯 props / 本地 ref）                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Popover/Tooltip/Dialog/Drawer/Dropdown/Menu/Toast · 任何 open↔closed 浮层 | Button/Input/Switch/Checkbox/Radio · Splitter/Resizer/Dragger（拖拽态本地 ref）· Table 排序 |

违反 = svjs 死法：每个组件套 400 行 machine，实则只有一个布尔 prop。键控选择/展开用 `createSelectionModel`/`createExpansion`，不是 machine。

## 组合模式（加新原语/行为前先读对标）

| 需求                                    | 用什么                                                                              | 对标                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| 给任意子元素附加行为（不渲染自身根）    | `IrisSlot` + `mergeSlotProps` + `composeRefs`                                       | `IrisButton as-child`                        |
| 浮层定位 + 关闭                         | `useFloating`（`@floating-ui/dom`）+ `useDismiss`                                   | `IrisPopoverContent`                         |
| 模态（焦点陷阱+滚动锁+遮罩）            | `useFocusTrap` + `useBodyScrollLock`（引用计数单例）                                | `IrisDialogContent`                          |
| 受控+非受控双模                         | `value !== undefined ? value : internal`；下沉 controller 时用 `model.sync` 镜像    | 几乎所有有状态组件                           |
| 键控选择 / 展开 / roving 焦点           | `createSelectionModel` / `createExpansion` / `nextEnabledIndex`（focus() 留适配器） | List/Table/Select/Tree · NavMenu/Tabs        |
| 服务端 CRUD 列表（list+分页+选择+刷新） | `createResourceController` + `useResourceController` 桥                             | cms demos 的 UsersPage                       |
| 菜单↔标签页 admin shell                 | `createAdminShell`（greenfield）/ nav+tabsNav 选择器                                | AdminLayout                                  |
| SSR 稳定 id                             | 框架原生 `useId`，**勿用模块自增计数器**                                            | `IrisDialog`/`IrisFormField`                 |
| 可本地化文案                            | `useI18n().t('key')`，默认值 = 现有英文                                             | `IrisPagination`/`IrisSelect`                |
| 正交叠加能力                            | Behaviors 包裹器（可嵌套）                                                          | `<IrisResizable><IrisList/></IrisResizable>` |
| 换肤/跟随系统/实时 token 编辑           | `createSkinEngine` + `SkinProvider` + `useSkin`                                     | 皮肤系统 / playground                        |

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

| 类别               | 规则                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 命名               | 包 `@iris-ui/<kebab>` · 组件 `Iris<Pascal>` · 子组件 `Iris<Parent><Child>` · CSS `--iris-<dash>` · token `iris.<dot>` · 机器事件 `SCREAMING_SNAKE` · hook `use<Camel>`                             |
| 技术栈             | pnpm 9 · Turborepo 2 · TS strict · tsup（库，多入口）+ svelte-package · Vite（应用）· Vitest+jsdom · ESLint 9 flat + Prettier 3 · Changesets                                                       |
| 提交               | Conventional：`feat(react): add IrisCombobox` / `refactor(selection): …`                                                                                                                           |
| 质量门（合并前置） | `pnpm turbo run test typecheck lint build` 四道全绿（test 内含 SSR/axe/i18n）+ `pnpm size`（core/各 adapter/skins 预算）+ `pnpm check:rsc` + `pnpm format:check`；改组件清单后 `pnpm gen:manifest` |

> core 是复用逻辑之家，size 预算随之上调（core 10KB）——适配器消费控制器后净缩，总字节净降。

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

1. **首个 npm 发布**：`release.yml` 就绪，属不可逆对外动作，按维护者授权 + 版本决定后执行。
2. **QRCode**：需正确 QR 编码器（可扫描性 jsdom 无法验证），按决定跳过。
3. **ROADMAP v3 方向**：bench CI、嵌套路径表单、型录 admin 参考实现、状态机做厚——架构级投入，需维护者选择。
