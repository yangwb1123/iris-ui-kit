# Iris UI

> AI 原生、跨框架、token-driven 的 UI 基础设施。从元原语到系统骨架，每层都由 token 换肤；皮肤可加载、可继承、可热编辑。

## 状态（2026-06 / v0.1.x）

五层架构 + 贯穿主题层 + 正交 Behaviors 层 + 可加载皮肤层全部落地，**React 18 / Vue 3 双适配器完全对齐**（manifest 实测 130 组件两端齐备）。约 2100 项测试，四道质量门 + 体积预算 + RSC 守门常绿。

**生产就绪面已闭环**：SSR 安全（`useId` + 无 DOM 渲染测试 + React 全量 `'use client'`）· axe-core 无障碍门 · i18n（`Intl` + 可覆盖文案）· RTL（逻辑属性）· `prefers-reduced-motion` / `prefers-color-scheme` · 子路径 `exports` + size 预算 · VitePress 文档站 · changesets 发布流水线。

| 包                                        | 内容                                                                                                                                                                                                                             | 状态 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `@iris-ui/core`                           | store · **六大引擎**（状态机 / 表单 / i18n / 虚拟化 / 异步 / 分页）· 类型 · 工具 —— 零框架依赖                                                                                                                                   | ✅   |
| `@iris-ui/tokens`                         | `IrisTheme` + light/dark 默认主题                                                                                                                                                                                                | ✅   |
| `@iris-ui/theme`                          | `applyTheme` / `applyCssVars` · `createThemeStore` · `injectGlobalStyles`(减动效) · `applyDirection`(RTL) · `watchColorScheme`                                                                                                   | ✅   |
| `@iris-ui/skins`                          | 可加载皮肤层（建于 theme 之上）：`Skin`→`ResolvedSkin` 解析 · `extends` 继承 + 闭合 21 token 外的自定义命名空间 · `createSkinEngine`（持久化 / FOUC 防闪 / 跟随系统 / 实时 `patch`）· 市场 SDK `createSkinCatalog` —— 零框架依赖 | ✅   |
| `@iris-ui/icons`                          | 结构化节点图标 + registry/resolver + `renderIconSvg`；`IrisIcon`                                                                                                                                                                 | ✅   |
| `@iris-ui/react` / `@iris-ui/vue`         | Layer 1–4 + Behaviors + 引擎/皮肤适配器；**同名同语义导出** + 子路径 `exports`（`@iris-ui/react/form`、`@iris-ui/vue/skins` …）                                                                                                  | ✅   |
| `@iris-ui/manifest`                       | 扫描双 barrel + tokens → `manifest.json` / `llms.txt`（`pnpm gen:manifest`）；AI 原生消费层                                                                                                                                      | ✅   |
| `apps/{playground,playground-react,docs}` | Vue / React 演示台（含皮肤系统交互演示）+ VitePress 文档站（消费 manifest 自动生成组件清单）                                                                                                                                     | ✅   |

> 真相源：各包 barrel `packages/{vue,react}/src/index.ts`（人读）+ `manifest.json` / `llms.txt`（机读，源码生成）。**本文件与代码均不手维护组件清单**；新框架适配器须导出同名同语义组件。

## 架构

```
Behaviors（正交贯穿）  Resizable · Movable · Hotkey · ClickOutside —— 包裹任意组件叠加能力
══════════════════════════════════════════════════════════════════════════
Layer 4  系统骨架  LoginTemplate · DashboardTemplate                        ✅ 双框架
Layer 3  布局      Stack · Container · Grid · Sidebar/Header/DashboardGrid  ✅ 双框架
Layer 2  复合      Table · Tree · VirtualScroll · Menu · Toast · 各类 Picker ✅ 双框架
Layer 1  元原语    展示 / 表单 / 浮层 / 反馈，30+ 个                          ✅ 双框架
──────────────────────────────────────────────────────────────────────────
Layer 0  主题系统  tokens · theme · icons + 可加载皮肤层 skins              ✅
```

一份 token 集改变整个系统视觉；每层产物都通过 `var(--iris-*)` 渲染。**皮肤**是主题层之上的可加载单元：`Skin` 部分覆盖 token、可 `extends` 继承、解析为完整 `IrisTheme` 后即与现有组件无缝对接（组件零改动）。**Behaviors** 是正交能力：renderless 包裹器（`Hotkey`/`ClickOutside`，Fragment / `display:contents`）或薄定位容器（`Resizable`/`Movable`），把 resize / 拖动 / 快捷键 / 点击外部关闭叠加到任何组件，可层层嵌套，被包裹组件无需感知。

## 不可妥协的原则

1. **原语优先**。Layer 2+ 组合 Layer 1 + 共享 hook，不写独立巨无霸。Popover = `useFloating + useDismiss + IrisSlot`。
2. **`@iris-ui/core` 零框架依赖**。业务逻辑全住 core 或框架无关工具，适配器只做响应式桥接。验证：`grep -rE "from '(vue|react|solid)'" packages/core/src` 必须为空。
3. **跨框架不跨设计**。同一套 core 工厂，多条薄桥：Vue=`ref`+订阅、React=`useSyncExternalStore`。新增框架 ≈ 重写桥接，不重写逻辑。
4. **AI 原生 API**。声明式 props；除事件回调外不收函数 prop；命名对齐 Radix / Naive；每种状态都有对应 prop（loading / disabled / invalid / error）。文案走 i18n 可覆盖字典，不硬编码。
5. **Token 杠杆**。组件一行 ≈ 30 token vs 裸 HTML/CSS ≈ 800 token（93%+ 节省）。下游在自己的 AGENTS.md 引用 `llms.txt`，让 AI 直接调用。
6. **渐进式复杂度**。可只用一个 Button 起步，主题 / 皮肤 / Behaviors / 各引擎按需接入。

## 逻辑下沉的框架无关引擎（原则 2/3 的落地证据，皆纯逻辑 + 单测）

| 引擎     | 工厂                                                                                            | 适配器薄桥                            |
| -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| 状态机   | `createMachine` / `createFloatingMachine`                                                       | `useMachine`                          |
| 表单     | `createFormStore`（值聚合 · dirty/touched · 同步/异步校验含竞态防护 · 提交生命周期）            | `useForm` / `useField` / `<IrisForm>` |
| 国际化   | `createI18n`（`t()` 插值 · `Intl` 日期/数字/相对时间）                                          | `useI18n` / `<IrisI18nProvider>`      |
| 虚拟化   | `computeVirtualRange`（定高 / 变高 / `ResizeObserver` 自动测量，前缀和 + 二分）                 | `IrisVirtualScroll`                   |
| 异步资源 | `createAsyncResource`（状态机 · 竞态防护 · stale-while-revalidate）                             | `useAsyncResource`                    |
| 分页     | `createPaginatedResource`（paged 替换 + infinite 追加 · `hasMore`）                             | `usePaginatedResource`                |
| 皮肤     | `createSkinEngine`（解析/继承 · 持久化 · FOUC 防闪 · 跟随系统 · 实时 `patch`）@`@iris-ui/skins` | `SkinProvider` / `useSkin`            |

新增同类能力遵循此形：纯逻辑（含竞态/边界）独立成包或进 core + 单测，两端各加一条薄桥。

## 状态机判别准则（防 svjs 退化）

仅当组件**有可观察内部状态**且**转换有明确事件语义**（`OPEN`/`CLOSE`/`TOGGLE`）时，才配 `createMachine` / `createFloatingMachine`。

| 用机器                                                                                | 不用机器（纯 props / 本地 ref）                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Popover / Tooltip / Dialog / Drawer / Dropdown / Menu / Toast · 任何 open↔closed 浮层 | Button / Input / Switch / Checkbox / Radio · Splitter / Resizer / Dragger（拖拽态本地 ref）· Table 排序 |

违反 = svjs 死法：每个组件套 400 行 machine，实则只有一个布尔 prop。

## 组合模式（加新原语 / 行为前，先读对标实现）

| 需求                                                  | 用什么                                                                                   | 对标                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| 给任意子元素附加行为（不渲染自身根）                  | `IrisSlot` + `mergeSlotProps` + `composeRefs`（React `cloneElement` / Vue `cloneVNode`） | `IrisButton as-child`                        |
| 浮层定位 + 关闭（点外部 / Escape）                    | `useFloating`（`@floating-ui/dom`）+ `useDismiss`                                        | `IrisPopoverContent`                         |
| 模态（焦点陷阱 + 滚动锁 + 遮罩）                      | `useFocusTrap` + `useBodyScrollLock`（引用计数单例）                                     | `IrisDialogContent`                          |
| 受控 + 非受控双模                                     | `value !== undefined ? value : internal`                                                 | 几乎所有有状态组件                           |
| 正交叠加能力                                          | Behaviors 包裹器（可嵌套）                                                               | `<IrisResizable><IrisList/></IrisResizable>` |
| 可加载/可继承皮肤 · 换肤 · 跟随系统 · 实时 token 编辑 | `createSkinEngine` + `SkinProvider` + `useSkin`（`patch`/`resetPatch`/`setMode`）        | 皮肤系统 / playground                        |
| SSR 稳定 id（ARIA 关联）                              | 框架原生 `useId`，**勿用模块自增计数器**（hydration 不一致）                             | `IrisDialog` / `IrisFormField`               |
| 可本地化文案                                          | `useI18n().t('key')`，默认值 = 现有英文（无 provider 也不变）                            | `IrisPagination` / `IrisSelect`              |
| 服务端数据（loading/error/empty · 分页 / 无限滚动）   | `useAsyncResource` / `usePaginatedResource` + Table 三态 props                           | `IrisTable`                                  |
| 跟随系统主题 / RTL                                    | `useColorScheme()` → `setTheme`；`<ThemeProvider dir>` + `useDirection()`                | 主题系统                                     |

## 主题与皮肤系统

```ts
// 主题：完整 token 集
{ name: 'monokai-pro', type: 'dark',
  colors: { 'iris.background': '#2D2D2D', 'iris.primary': '#A6E22E', /* … */ },
  spacing: { 'iris.gap.md': 8 }, radii: { 'iris.radius.md': 4 } }

// 皮肤：部分覆盖 + 继承 + 自定义命名空间，解析后 = 完整 IrisTheme
{ id: 'ocean', name: 'Ocean', extends: 'dark',
  tokens: { 'iris.primary': '#3BA7FF' },
  custom: { 'brand.gradient': 'linear-gradient(...)', 'brand.shadow': '...' },
  variants: { light: 'sunrise', dark: 'ocean' } }   // 跟随系统时按此映射
```

- JS 键 `iris.background` ↔ CSS 变量 `--iris-background`（`toCssVarName`：dots → dashes）；自定义命名空间同理（`brand.gradient` → `--brand-gradient`）。
- 样式只用 `var(--iris-*)` 或单例注入的 stylesheet（仅当 inline 表达不了：`:hover` / `:focus-visible` / keyframe）。**禁止**硬编码 hex；**禁止** Tailwind / Emotion / CSS-in-JS。
- 方向相关样式用 CSS 逻辑属性（`margin-inline-start` / `inset-inline` / `textAlign: start`），勿写死 left/right。
- `<ThemeProvider>` / `<SkinProvider>` 写入 `data-iris-theme` + 完整变量集（瞬时切换），注入 `prefers-reduced-motion` 全局规则，并按 `dir` 设 `data-iris-dir`。
- 皮肤运行时：持久化走可插拔 `SkinStorage`（默认 localStorage）；FOUC 防闪用 `skinBootScript`（注入字符串经 `textContent`，**非 innerHTML**）；市场 = 清单契约 + 客户端 SDK（注入 `fetch`，无服务端）；`patch`/`resetPatch` 为非破坏式实时编辑，不改注册皮肤。

## 约定速查

| 类别                                  | 规则 / 选型                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 包 / 组件 / 子组件                    | `@iris-ui/<kebab>` · `Iris<Pascal>` · `Iris<Parent><Child>`                                                                                                                                 |
| CSS 变量 / token 键 / 机器事件 / hook | `--iris-<dash>` · `iris.<dot>` · `SCREAMING_SNAKE` · `use<Camel>`                                                                                                                           |
| 技术栈                                | pnpm 9 · Turborepo 2 · TS 5.4 strict · tsup(库，多入口) · Vite(应用) · Vitest + jsdom · ESLint 9 flat + Prettier 3 · Changesets                                                             |
| 提交                                  | Conventional Commits：`feat(react): add IrisCombobox` / `fix(core): …`                                                                                                                      |
| 质量门（合并前置）                    | `pnpm turbo run test typecheck lint build` 四道全绿（test 内含 SSR / axe / i18n）+ `pnpm size`（含 `skins` 预算）+ `pnpm check:rsc` + `pnpm format:check`；改组件清单后 `pnpm gen:manifest` |

## 测试陷阱（jsdom）

- 无 `PointerEvent` 构造器 → 用 `Event` + 手赋 `clientX/Y/button/pointerId`（见 `useDrag.test`）。
- `getBoundingClientRect` / `clientHeight` 返 0；`matchMedia` / `ResizeObserver` 未实现 → 浮层/虚拟滚动只验 wiring；测 color-scheme / auto-measure 时 mock 这两者（见 `watchColorScheme.test`、VirtualScroll auto-measure）。
- 无 `window.localStorage`（`undefined`）→ 测皮肤持久化须 `vi.stubGlobal('localStorage', fake)`；SSR 安全的 storage 守卫会吞掉访问异常。
- 日期勿用 `toISOString().slice(0,10)`（UTC 偏移一天）→ 用本地 `formatLocalISO`。
- 共享单例（scroll-lock 计数、toast 队列、stylesheet 注入、皮肤引擎状态）须 `afterEach` 重置 + `enableAutoUnmount`。
- React：子组件 `useEffect` 依赖 context 对象会无限重渲 → 依赖**解构出的稳定回调**；批量事件用 `setState(prev => …)`。
- SSR 测试用 `// @vitest-environment node`（无 DOM）跑 `renderToString` / `@vue/server-renderer`；axe 扫描禁 `color-contrast`（jsdom 无布局）并限 WCAG A/AA；jsdom 保留 CSS 逻辑属性，可直接断言。

## 未竟事项

> 五层架构、六大引擎、皮肤系统（含市场 SDK）与全部工程化补齐均已闭环。剩余两项均为**显式决定，非能力缺口**：

1. **首个 npm 发布** —— changesets `release.yml` 流水线就绪；属不可逆对外动作，按维护者决定暂缓，待授权 + 版本决定后执行。
2. **QRCode 组件** —— 需正确 QR 编码器（Reed–Solomon / 掩码），可扫描性无法在 jsdom 验证，故不手搓；按决定跳过（如重启，接入经审计依赖或对照测试向量移植）。

外延（非阻塞）：更多框架适配器（Solid / Svelte 走同一 core 桥接）、Figma 插件、VS Code 扩展。

## svjs 教训（北极星）

| 不要                                  | 要                                                      |
| ------------------------------------- | ------------------------------------------------------- |
| 同时铺 Vue/React/Solid/Svelte/Lit     | 打透一个到 Radix / Naive 质量再扩；core 让扩展 ≈ 加薄桥 |
| 适配器写业务逻辑（Resizer in render） | 业务在 core / 框架无关工具；适配器只桥接                |
| 自创命名（`SvButton`）                | 对齐 Radix / Naive；`Iris` 仅作品牌前缀                 |
| 实验目录堆积（Table copy/copy2）      | 重构而非加 prop；废码立即删                             |
| 主题后期加（必然推倒重来）            | 主题与皮肤第一天起就是设计中心                          |
