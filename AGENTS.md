# Iris UI

> AI 原生、跨框架、token-driven 的 UI 基础设施。从元原语到系统骨架，每一层都由一份 `theme.json` 换肤。

## 状态（2026-05 / v0.1.x）

五层架构 + 贯穿主题层 + 正交 Behaviors 层全部落地，**Vue 3 与 React 18 双适配器组件完全对齐**。约 1400 项测试覆盖（120+ 个测试文件）。

| 包 | 内容 | 状态 |
| --- | --- | --- |
| `@iris-ui/core` | `createStore` / `createMachine` / `createFloatingMachine` / 类型 / 工具 —— 零框架依赖 | ✅ |
| `@iris-ui/tokens` | `IrisTheme` + light/dark 默认主题 | ✅ |
| `@iris-ui/theme` | `applyTheme` / `getCssVar` / `createThemeStore` | ✅ |
| `@iris-ui/vue` | Layer 1–4 + Behaviors，~50 原语/组件 | ✅ |
| `@iris-ui/react` | 与 Vue **全量组件对齐**（同名同语义导出） | ✅ |
| `@iris-ui/icons` | 结构化节点图标集 + registry/resolver + `renderIconSvg`；`IrisIcon` 组件（Vue/React） | ✅ |
| `apps/playground{,-react}` | Vue(:5173) / React(:5174) 双演示台 | ✅ |

> **本文件不枚举组件清单**——会立刻过期。可用组件以各包 barrel `packages/{vue,react}/src/index.ts` 为唯一事实来源；新框架适配器须导出同名同语义的组件。

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

一份 `theme.json` 改变整个系统视觉；每一层产物都通过 `var(--iris-*)` 渲染。**Behaviors 层**是正交能力：renderless 包裹器（`Hotkey` / `ClickOutside` 用 Fragment / `display:contents`）或薄定位容器（`Resizable` / `Movable`），把 resize / 拖动 / 快捷键 / 点击外部关闭等能力叠加到任何组件上，可层层嵌套（`<IrisResizable><IrisMovable><IrisHotkey><IrisList/></…>`），被包裹组件无需感知。

## 不可妥协的原则

1. **原语优先**。Layer 2+ 必须组合 Layer 1 + 共享 hook，不得写独立巨无霸。Popover = `useFloating + useDismiss + IrisSlot`。
2. **`@iris-ui/core` 零框架依赖**。业务逻辑（machine、定位、拖拽 / 日期 / 颜色数学）住在 core 或框架无关的工具里；适配器只做响应式桥接。验证：`grep -rE "from '(vue|react|solid)'" packages/core/src` 必须为空。
3. **跨框架不跨设计**。同一套 core store，多条薄桥：Vue = `ref` + 订阅、React = `useSyncExternalStore`。新增框架 ≈ 重写桥接，不重写逻辑。
4. **AI 原生 API**。声明式 props；除事件回调外不收函数 prop；命名对齐 Radix / Naive 行业标准；每种状态都有对应 prop（loading / disabled / invalid）。
5. **Token 杠杆**。组件一行 ≈ 30 token，等价裸 HTML/CSS ≈ 800 token（93%+ 节省）。下游项目在自己的 AGENTS.md 声明组件清单，让 AI 直接调用。
6. **渐进式复杂度**。可只用一个 Button 起步，主题与 Behaviors 按需接入。

## 状态机判别准则（防 svjs 退化）

仅当组件**拥有可观察的内部状态**且**状态转换有明确事件语义**（`OPEN` / `CLOSE` / `TOGGLE`）时，才配 `createMachine` / `createFloatingMachine`。

| 用机器 | 不用机器（纯 props / 本地 ref） |
| --- | --- |
| Popover / Tooltip / Dialog / Drawer / Dropdown / Menu / Toast | Button / Input / Switch / Checkbox / Radio |
| 任何 open ↔ closed 浮层 | Splitter / Resizer / Dragger（拖拽态用本地 ref）、Table 排序 |

违反 = svjs 死法：每个组件套 400 行 machine，实则只有一个布尔 prop。

## 组合模式（加新原语 / 行为前，先读对标实现）

| 需求 | 用什么 | 对标 |
| --- | --- | --- |
| 给任意子元素附加行为（不渲染自身根） | `IrisSlot` + `mergeSlotProps` + `composeRefs`（React=`cloneElement` / Vue=`cloneVNode`） | `IrisButton as-child` |
| 浮层定位 + 关闭（点外部 / Escape） | `useFloating`（`@floating-ui/dom`）+ `useDismiss` | `IrisPopoverContent` |
| 模态（焦点陷阱 + 滚动锁 + 遮罩） | `useFocusTrap` + `useBodyScrollLock`（引用计数单例） | `IrisDialogContent` |
| 拖拽（pointer 事件 + capture） | `useDrag` | `IrisSplitter` / `IrisResizer` |
| 受控 + 非受控双模 | `value !== undefined ? value : internal` | 几乎所有有状态组件 |
| **给已有组件正交叠加能力** | Behaviors 包裹器（`IrisResizable` / `IrisMovable` / `IrisHotkey` / `IrisClickOutside`），可嵌套 | `<IrisResizable><IrisList/></IrisResizable>` |
| 框架无关 store / machine ↔ 视图 | `useMachine`（Vue 与 React 各一份，均基于 core store） | 所有用 machine 的组件 |
| SSR 稳定的元素 id（ARIA 关联） | 框架原生 `useId`（React 18 / Vue 3.5），**勿用模块自增计数器**（会导致 hydration 不一致） | `IrisDialog` / `IrisFormField` |

## 主题系统

```ts
{ name: 'monokai-pro', type: 'dark',
  colors: { 'iris.background': '#2D2D2D', 'iris.primary': '#A6E22E', /* … */ },
  spacing: { 'iris.gap.md': 8 }, radii: { 'iris.radius.md': 4 } }
```

- JS 键 `iris.background` ↔ CSS 变量 `--iris-background`（`toCssVarName`：dots → dashes）。
- 样式只用 `var(--iris-*)` 或单例注入的 stylesheet（仅当 inline style 表达不了，如 `:hover` / `:focus-visible` / keyframe）。
- **禁止**硬编码 hex；**禁止**引入 Tailwind / Emotion / CSS-in-JS。
- `<ThemeProvider>` 在挂载元素写入 `data-iris-theme` + 完整变量集，切换瞬时响应。

## 约定速查

| 类别 | 规则 / 选型 |
| --- | --- |
| 包 / 组件 / 子组件 | `@iris-ui/<kebab>` · `Iris<Pascal>` · `Iris<Parent><Child>` |
| CSS 变量 / token 键 / 机器事件 / hook | `--iris-<dash>` · `iris.<dot>` · `SCREAMING_SNAKE` · `use<Camel>` |
| 技术栈 | pnpm 9 · Turborepo 2 · TS 5.4 strict · tsup(库) · Vite(应用) · Vitest + jsdom · ESLint 9 flat + Prettier 3 · Changesets |
| 提交 | Conventional Commits：`feat(react): add IrisCombobox` / `fix(core): …` / `refactor(vue): …` |
| 质量门（合并前置） | 根目录 `pnpm turbo run test typecheck lint build` 四道全绿 |

## 测试陷阱（jsdom）

- 不实现 `PointerEvent` 构造器 → 用 `Event` + 手赋 `clientX/Y/button/pointerId`（见 `useDrag.test`）。
- `getBoundingClientRect` / `clientHeight` 常返 0 → 浮层与虚拟滚动测试只验 wiring，定位 / 尺寸数值按 0 基准断言。
- 日期勿用 `toISOString().slice(0,10)`（UTC 偏移一天）→ 用本地化的 `formatLocalISO`（getFullYear/Month/Date）。
- 共享单例（scroll-lock 计数、toast 队列、stylesheet 注入）须 `afterEach` 重置 + `enableAutoUnmount`。
- React：子组件 `useEffect` 依赖 context 对象会无限重渲 → 依赖**解构出的稳定回调**；批量事件用函数式 `setState(prev => …)` 避免闭包读旧值。

## 未竟事项

- VitePress 文档站；更多框架适配器（Solid / Svelte 走同一 core 桥接）；Table 的 Excel(xlsx) 导出（resize / 行内编辑 / 虚拟滚动 / CSV 两端已具备）。
- 延后：theme marketplace、Figma 插件、VS Code 扩展。

## svjs 教训（北极星）

| 不要 | 要 |
| --- | --- |
| 同时铺 Vue/React/Solid/Svelte/Lit | 打透一个到 Radix / Naive 质量再扩；core 已让扩展 ≈ 加薄桥 |
| 11 个组件没一个达行业基准 | 少即是多；每个原语可生产、有测试 |
| 适配器写 400 行业务逻辑（Resizer in render） | 业务在 core / 共享工具；适配器只做响应式桥接 |
| 自创命名（`SvButton` / `IrisActionTrigger`） | 对齐 Radix / Naive；`Iris` 仅作品牌前缀 |
| 实验目录堆积（Table copy/copy2/copy3） | 重构而非加 prop；废码立即删 |
| 主题后期加（必然推倒重来） | 主题第一天起就是设计中心 |
