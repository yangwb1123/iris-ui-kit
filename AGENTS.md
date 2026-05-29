# Iris UI

> AI 原生、跨框架、token-driven 的 UI 基础设施。从元原语到系统骨架，每一层都由一份 `theme.json` 换肤。

## 状态（2026-05 / v0.1.x）

五层架构 + 贯穿主题层 + 正交 Behaviors 层全部落地，**Vue 3 与 React 18 双适配器完全对齐**（manifest 实测 96 个组件全部两端齐备）。约 1590 项测试（~138 文件）。生产就绪面已补齐：**SSR 安全**（框架原生 `useId` + 无 DOM 渲染烟雾测试）、**axe-core 无障碍门**、**i18n**（Intl 格式化 + 可覆盖文案）均纳入质量门。

| 包                                | 内容                                                                                           | 状态 |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| `@iris-ui/core`                   | store · 三类状态机 · **表单引擎** · **i18n 引擎** · **虚拟化数学** · 类型 · 工具 —— 零框架依赖 | ✅   |
| `@iris-ui/tokens`                 | `IrisTheme` + light/dark 默认主题                                                              | ✅   |
| `@iris-ui/theme`                  | `applyTheme` / `getCssVar` / `createThemeStore`                                                | ✅   |
| `@iris-ui/icons`                  | 结构化节点图标集 + registry/resolver + `renderIconSvg`；`IrisIcon`（Vue/React）                | ✅   |
| `@iris-ui/vue` / `@iris-ui/react` | Layer 1–4 + Behaviors + 表单/i18n 适配器；**同名同语义导出**                                   | ✅   |
| `@iris-ui/manifest`               | 扫描双 barrel + tokens → `manifest.json` / `llms.txt`（`pnpm gen:manifest`）；AI 原生消费层    | ✅   |
| `apps/playground{,-react}`        | Vue(:5173) / React(:5174) 双演示台                                                             | ✅   |

> **本文件与代码均不手维护组件清单**——会立刻过期。真相源：各包 barrel `packages/{vue,react}/src/index.ts`（人读）+ `manifest.json` / `llms.txt`（机读，由源码生成）。新框架适配器须导出同名同语义组件。

## 架构

```
Behaviors（正交贯穿）  Resizable · Movable · Hotkey · ClickOutside —— 包裹任意组件叠加能力
══════════════════════════════════════════════════════════════════════════
Layer 4  系统骨架  LoginTemplate · DashboardTemplate                        ✅ 双框架
Layer 3  布局      Stack · Container · Grid · Sidebar/Header/DashboardGrid  ✅ 双框架
Layer 2  复合      Table · Tree · VirtualScroll · Menu · Toast · 各类 Picker ✅ 双框架
Layer 1  元原语    展示 / 表单 / 浮层 / 反馈，30+ 个                          ✅ 双框架
──────────────────────────────────────────────────────────────────────────
Layer 0  主题系统  tokens · theme · icons —— 贯穿层                          ✅
```

一份 `theme.json` 改变整个系统视觉；每层产物都通过 `var(--iris-*)` 渲染。**Behaviors** 是正交能力：renderless 包裹器（`Hotkey`/`ClickOutside` 用 Fragment / `display:contents`）或薄定位容器（`Resizable`/`Movable`），把 resize / 拖动 / 快捷键 / 点击外部关闭叠加到任何组件，可层层嵌套，被包裹组件无需感知。

## 不可妥协的原则

1. **原语优先**。Layer 2+ 必须组合 Layer 1 + 共享 hook，不写独立巨无霸。Popover = `useFloating + useDismiss + IrisSlot`。
2. **`@iris-ui/core` 零框架依赖**。所有业务逻辑住 core 或框架无关工具，适配器只做响应式桥接。验证：`grep -rE "from '(vue|react|solid)'" packages/core/src` 必须为空。
3. **跨框架不跨设计**。同一套 core store / 工厂，多条薄桥：Vue=`ref`+订阅、React=`useSyncExternalStore`。新增框架 ≈ 重写桥接，不重写逻辑。
4. **AI 原生 API**。声明式 props；除事件回调外不收函数 prop；命名对齐 Radix / Naive；每种状态都有对应 prop（loading / disabled / invalid）。文案走 i18n 可覆盖字典，不硬编码。
5. **Token 杠杆**。组件一行 ≈ 30 token vs 裸 HTML/CSS ≈ 800 token（93%+ 节省）。下游在自己的 AGENTS.md 引用 `llms.txt`，让 AI 直接调用。
6. **渐进式复杂度**。可只用一个 Button 起步，主题 / Behaviors / 表单 / i18n 按需接入。

## 逻辑下沉 core 的四个引擎（原则 2/3 的落地证据）

| 引擎   | core 工厂（框架无关、单测覆盖）                                                      | 适配器薄桥                            |
| ------ | ------------------------------------------------------------------------------------ | ------------------------------------- |
| 状态机 | `createMachine` / `createFloatingMachine`                                            | `useMachine`                          |
| 表单   | `createFormStore`（值聚合 · dirty/touched · 同步/异步校验含竞态防护 · 提交生命周期） | `useForm` / `useField` / `<IrisForm>` |
| 国际化 | `createI18n`（`t()` 插值 · `Intl` 日期/数字/相对时间）                               | `useI18n` / `<IrisI18nProvider>`      |
| 虚拟化 | `computeVirtualRange`（定高 + 变高，前缀和 + 二分）                                  | `IrisVirtualScroll`                   |

新增同类能力时遵循此形：纯逻辑进 core + 单测，两端各加一条薄桥。

## 状态机判别准则（防 svjs 退化）

仅当组件**拥有可观察内部状态**且**转换有明确事件语义**（`OPEN`/`CLOSE`/`TOGGLE`）时，才配 `createMachine` / `createFloatingMachine`。

| 用机器                                                                                | 不用机器（纯 props / 本地 ref）                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Popover / Tooltip / Dialog / Drawer / Dropdown / Menu / Toast · 任何 open↔closed 浮层 | Button / Input / Switch / Checkbox / Radio · Splitter / Resizer / Dragger（拖拽态本地 ref）· Table 排序 |

违反 = svjs 死法：每个组件套 400 行 machine，实则只有一个布尔 prop。

## 组合模式（加新原语 / 行为前，先读对标实现）

| 需求                                 | 用什么                                                                                   | 对标                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| 给任意子元素附加行为（不渲染自身根） | `IrisSlot` + `mergeSlotProps` + `composeRefs`（React=`cloneElement` / Vue=`cloneVNode`） | `IrisButton as-child`                        |
| 浮层定位 + 关闭（点外部 / Escape）   | `useFloating`（`@floating-ui/dom`）+ `useDismiss`                                        | `IrisPopoverContent`                         |
| 模态（焦点陷阱 + 滚动锁 + 遮罩）     | `useFocusTrap` + `useBodyScrollLock`（引用计数单例）                                     | `IrisDialogContent`                          |
| 拖拽（pointer + capture）            | `useDrag`                                                                                | `IrisSplitter` / `IrisResizer`               |
| 受控 + 非受控双模                    | `value !== undefined ? value : internal`                                                 | 几乎所有有状态组件                           |
| 正交叠加能力                         | Behaviors 包裹器（可嵌套）                                                               | `<IrisResizable><IrisList/></IrisResizable>` |
| core store / 工厂 ↔ 视图             | `useMachine` / `useForm` / `useI18n`（两端各一份，均基于 core store）                    | 四个引擎的所有消费方                         |
| SSR 稳定的元素 id（ARIA 关联）       | 框架原生 `useId`（React 18 / Vue 3.5），**勿用模块自增计数器**（hydration 不一致）       | `IrisDialog` / `IrisFormField`               |
| 组件可本地化文案                     | `useI18n().t('key')`，默认值 = 现有英文字面量（无 provider 也不变）                      | `IrisPagination` / `IrisSelect`              |

## 主题系统

```ts
{ name: 'monokai-pro', type: 'dark',
  colors: { 'iris.background': '#2D2D2D', 'iris.primary': '#A6E22E', /* … */ },
  spacing: { 'iris.gap.md': 8 }, radii: { 'iris.radius.md': 4 } }
```

- JS 键 `iris.background` ↔ CSS 变量 `--iris-background`（`toCssVarName`：dots → dashes）。
- 样式只用 `var(--iris-*)` 或单例注入的 stylesheet（仅当 inline 表达不了：`:hover` / `:focus-visible` / keyframe）。**禁止**硬编码 hex；**禁止** Tailwind / Emotion / CSS-in-JS。
- `<ThemeProvider>` 在挂载元素写入 `data-iris-theme` + 完整变量集，切换瞬时响应。

## 约定速查

| 类别                                  | 规则 / 选型                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 包 / 组件 / 子组件                    | `@iris-ui/<kebab>` · `Iris<Pascal>` · `Iris<Parent><Child>`                                                             |
| CSS 变量 / token 键 / 机器事件 / hook | `--iris-<dash>` · `iris.<dot>` · `SCREAMING_SNAKE` · `use<Camel>`                                                       |
| 技术栈                                | pnpm 9 · Turborepo 2 · TS 5.4 strict · tsup(库) · Vite(应用) · Vitest + jsdom · ESLint 9 flat + Prettier 3 · Changesets |
| 提交                                  | Conventional Commits：`feat(react): add IrisCombobox` / `fix(core): …`                                                  |
| 质量门（合并前置）                    | `pnpm turbo run test typecheck lint build` 四道全绿（test 内含 SSR / axe / i18n）；改动组件清单后跑 `pnpm gen:manifest` |

## 测试陷阱（jsdom）

- 无 `PointerEvent` 构造器 → 用 `Event` + 手赋 `clientX/Y/button/pointerId`（见 `useDrag.test`）。
- `getBoundingClientRect` / `clientHeight` 常返 0 → 浮层与虚拟滚动只验 wiring，尺寸按 0 基准断言。
- 日期勿用 `toISOString().slice(0,10)`（UTC 偏移一天）→ 用本地 `formatLocalISO`。
- 共享单例（scroll-lock 计数、toast 队列、stylesheet 注入）须 `afterEach` 重置 + `enableAutoUnmount`。
- React：子组件 `useEffect` 依赖 context 对象会无限重渲 → 依赖**解构出的稳定回调**；批量事件用 `setState(prev => …)`。
- SSR 测试用 `// @vitest-environment node`（无 DOM）跑 `renderToString` / `@vue/server-renderer`；axe 扫描禁用 `color-contrast`（jsdom 无布局）并限 WCAG A/AA。

## 未竟事项

- **采用面**：VitePress 文档站（消费 manifest 自动生成 props 表）；changesets release workflow + 首发布。
- **打包**：每组件子路径 `exports` + CI size-limit 预算门（当前单 barrel 入口）。
- **数据层**：变高虚拟化已落地（core 数学 + 两端 `VirtualScroll` 按 size 函数接入）；待补 `ResizeObserver` 自动测量、Table/Tree/List 统一异步契约（loading/error/empty + 服务端分页）、宽表横向虚拟化 + 列冻结。
- **边界**：RTL / CSS 逻辑属性；内联 `transition` 统一服从 `prefers-reduced-motion`；`prefers-color-scheme` 自动跟随。
- 更多框架适配器（Solid / Svelte 走同一 core 桥接）；Table 的 xlsx 导出（CSV 已具备）。延后：theme marketplace、Figma 插件、VS Code 扩展。

## svjs 教训（北极星）

| 不要                                         | 要                                                      |
| -------------------------------------------- | ------------------------------------------------------- |
| 同时铺 Vue/React/Solid/Svelte/Lit            | 打透一个到 Radix / Naive 质量再扩；core 让扩展 ≈ 加薄桥 |
| 11 个组件没一个达基准                        | 少即是多；每个原语可生产、有测试                        |
| 适配器写 400 行业务逻辑（Resizer in render） | 业务在 core / 共享工具；适配器只桥接                    |
| 自创命名（`SvButton`）                       | 对齐 Radix / Naive；`Iris` 仅作品牌前缀                 |
| 实验目录堆积（Table copy/copy2）             | 重构而非加 prop；废码立即删                             |
| 主题后期加（必然推倒重来）                   | 主题第一天起就是设计中心                                |
