# Iris UI 架构分析报告

## 1. 架构评估

### 1.1 当前架构的核心优势

**分层清晰，范式正确。** A/B/C 下沉分类是这套系统最核心的架构决策——它不只是一种代码组织方式，更是一种**认知契约**：任何开发者在介入新功能时，都能立即判断逻辑归属。

- **Layer 0-4 的分层**：从 token → 元原语 → 复合 → 布局 → 系统骨架，每一层职责单一、可独立演进。这类似 Clean Architecture 的依赖规则（内层不知外层），但针对 UI 组件做了务实调整。
- **四框架对齐是结果而非目标**：core 沉淀逻辑后，适配器做桥接——这是"一次写对，四端收益"的正确模式。manifest 实测 149 组件四框架对齐，是这套架构可复用性的实证。
- **机器事件命名（`OPEN`/`CLOSE`/`TOGGLE`）+ 状态机判定准则**：避免了"万物皆 machine"的 svjs 死法，为组件行为建立了严格的门槛。
- **插件系统不做 `registerComponent`**：静态 import + 框架特有 `widgets` map 的决策，保留了 tree-shaking 和类型安全，是架构纪律的体现。

### 1.2 架构局限性

尽管架构设计质量高，但仍存在以下结构性局限：

| 局限                                                  | 性质       | 影响面                                      |
| ----------------------------------------------------- | ---------- | ------------------------------------------- |
| **四框架重复的壳组件**（AdminLayout/Sidebar/NavMenu） | 架构债务   | 每次功能变更需改 4 份，测试 4 份            |
| **插件 SSR 协议缺失**                                 | 能力缺口   | 阻塞首个 npm 发布（P1）                     |
| **无跨标签页状态同步**                                | 能力缺口   | 多标签场景需自建方案                        |
| **无统一手势层**                                      | 能力缺口   | 触屏/鼠标事件处理分散在组件内               |
| **组合安全依赖人工审查**                              | 可治理缺口 | `as-child`、`IrisSlot` 组合容易产生非法嵌套 |
| **RSC 边界无自动化门禁**                              | 技术债     | `'use client'` 标注缺失会静默破坏 RSC       |

### 1.3 关键设计决策评估

**✅ 正确的决策：**

- `core` 零框架依赖 + 纯函数 + controller store → 适配器用 `useSyncExternalStore`/`ref`/`createSignal` 订阅。这是多框架支持的**唯一可持续路径**。
- 插件用 `registerTokens`/`registerMessages`/`registerStore` 而非 `registerComponent`。保留了摇树优化和 TypeScript 类型推导。
- 皮肤用 `extends` 继承 + 自定义命名空间 + 运行时 `patch`。避免了"主题爆炸"问题，支持渐进式定制。
- 状态机判定准则。典型 svjs 误用是把一个 `boolean` 状态包装成 machine（~400 行）；这里用明确的判别标准（有可观察内部状态 + 转换有事件语义），直接避免了架构退化。

**⚠️ 存疑的决策：**

- **四框架同步维护策略**：虽然架构上"薄桥"可行，但现实中四框架的发布节奏、breaking change、生态更新并不同步。一旦某个框架版本大更新（如 Svelte 5 runes、Vue 4），四端同步成本可能非线性增长。当前"test/typecheck/lint/build"四道门虽能发现问题，但**修复仍需要四端适配器开发者介入**。
- **manifest 由文件扫描生成**：`gen:manifest` 扫描 barrel → `manifest.json`。这的确确保了真实性，但 barreling 本身可能在大型 monorepo 中导致循环引用或构建性能问题（虽然当前 149 组件尚可控）。
- **tsup 多入口 + svelte-package 双工具链**：异构构建是"选型历史"的体现，代价是构建配置维护成本（"三套单框架 vitest 配置串行"）。若未来需要第 5 个框架（如 Qwik/Preact），构建工具链的复杂度会叠加而非线性增长。

## 2. 扩展方向

以下按优先级从高到低排列，每个方向标注了与现有 A/B/C 分类的对应关系。

### 方向 A（P0）：插件 SSR 协议 — `pluginSystem.mount` vs `pluginSystem.hydrate`

**为什么需要：**
当前插件系统在客户端运行完备，但 SSR（Server-Side Rendering）场景下，`install` 回调中的 `registerTokens` 和 `registerStore` 没有对应的服务端生命周期。这导致：

1. SSR 渲染的 HTML 不包含插件注入的 CSS 变量 → **FOUC（样式闪烁）**
2. 插件注册的 store 在服务端不可用 → 序列化 → 客户端水合不一致
3. 阻塞首个 npm 发布（因为现代 React/Vue 应用几乎必用 SSR）

**核心挑战：**

| 挑战                           | 说明                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Token 序列化时机**           | 插件 token 需在 `renderToString` 前注册，但插件可能是异步加载的                   |
| **Store 水合一致性**           | 服务端插件 store 状态需序列化 → 注入 HTML → 客户端恢复，需无冲突命名空间          |
| **框架 SSR API 异构**          | React 用 `renderToPipeableStream`，Vue 用 `renderToString`，Svelte/Solid 各有不同 |
| **插件级 `'use client'` 标注** | React RSC 下，服务端插件不能包含客户端逻辑，需编译期分割                          |

**架构变更：**

```
当前: install(reg) 在客户端执行
新增:
  install(reg)           // 运行时（客户端）
  setupSSR(ctx)          // 服务端初始化（注册 token/store 元数据）
  serialize(ctx)         // 输出 <script>window.__IRIS_PLUGINS__</script>
  hydrate(ctx)           // 客户端水合（反序列化 store）

存储结构变化:
  reg.registerStore('key', factory, { ssr: { initial: '…' } })
```

**对现有系统的影响：**

- 向后兼容：`setupSSR`/`serialize`/`hydrate` 是可选方法，现有插件零改动
- 影响 `IrisProvider` 和 `skinBootScript`（FOUC 防闪逻辑需要整合插件 token）
- 新增依赖建议：`devalue`（安全的序列化，非 `JSON.stringify` 防 `undefined`/循环引用）

### 方向 B（P0）：壳组件共享 SDK — 消除 ×4 代码重复

**为什么需要：**
`AdminLayout`/`Sidebar`/`NavMenu`/`Tabs`/`Header`/`DashboardGrid` 等 Layer 3-4 组件在每个框架中有大量重复：

- 布局计算（侧栏宽度、折叠状态、头部高度）
- 导航状态同步（菜单展开→标签页联动→路由同步）
- 响应式断点逻辑
- 用户会话/权限管理集成

当前约 6 个壳组件 × 4 框架 = 24 个文件，同一 bug 需修复 4 次。

**核心挑战：**

- 壳组件包含**渲染结构**（`<header>` / `<aside>` / `<main>` 的 DOM 布局），这部分本应是框架特有的。下沉到 core 的必须是**计算逻辑**而非 DOM 结构。
- 分辨率在于：`useShellLayout`（计算侧栏宽度/折叠/响应式）下沉 core，适配器只保留 `<aside>` 等骨架标签。

**架构变更：**

```
current/
  packages/react/src/layout/AdminLayout/    // 100% react
  packages/vue/src/layout/AdminLayout/      // 100% vue
  packages/solid/src/layout/AdminLayout/    // 100% solid

target/
  packages/core/src/controllers/shell/      // createShellLayout + createShellNavigation + createShellResponsive
    ├── createShellLayout.ts     (纯计算：宽/折叠/断点)
    ├── createShellNavigation.ts (菜单展开↔标签页联动)
    └── types.ts
  packages/react/src/layout/AdminLayout/    // 仅 DOM 骨架 + 消费 core 控制器
  packages/vue/src/layout/AdminLayout/      // 同上
  …
```

**对现有系统的影响：**

- 非破坏性重构：`createShellLayout` 可以新增，原有组件做"薄桥适配"。可以逐组件迁移。
- `createAdminShell`（已存在于 core？需确认）可能已经做了部分工作，需要审查其现状。

### 方向 C（P1）：统一手势层 — `createGestureMachine`

**为什么需要：**
当前 `useDrag`、`useResize`、`useMove` 等手势逻辑散落在各组件内（Resizable、Splitter、Slider、DragList）。每个实现都有自己的：

- 事件绑定（`pointerdown`/`pointermove`/`pointerup` vs `mousedown`/`touchstart`）
- 坐标计算（`clientX`/`clientY` vs `pageX`/`pageY` vs 相对位移）
- 边界约束（最小宽度、弹性回弹、阈值判定）
- 竞态处理（同时拖动 + 滚轮）

这违反了 A/B/C 原则——手势逻辑是 A 类（跨框架、无 DOM），但当前散布在适配器中。

**核心挑战：**

| 挑战                 | 说明                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| **手势组合**         | 拖动 + 缩放的组合（如图片查看器）需要统一的 gesture state machine                    |
| **框架事件系统差异** | React 合成事件 vs Vue 原生事件 vs Solid 委托 vs Svelte 编译器指令                    |
| **SSR 安全**         | 指针事件在服务端不存在，必须 stripped 在 `if (typeof window === 'undefined') return` |
| **行为可嵌套**       | `Resizable` 内嵌 `Movable`，手势需按优先级链传递                                     |

**架构变更：**

```
packages/core/src/controllers/gesture/
  ├── createGestureMachine.ts   (状态机：idle → pointerdown → dragging)
  ├── types.ts                  (GestureEvent, GestureConfig, Bounds)
  └── math.ts                   (clamp, snapToGrid, distance, angle)

// 可选 B 类能力（树外可摇树）：
packages/core/src/export/gesture-presets/
  ├── drag.ts                   (拖动预设)
  ├── pinch.ts                  (双指缩放)
  ├── swipe.ts                  (滑动)
  └── resize.ts                 (边缘拖动调整大小)
```

**与现有 `useDrag` 的关系：**

- 现有 `useDrag`（在 core？需确认）可能只是基础封装。统一手势层是它的超集——新增 `pinch`/`swipe`/`rotate`/`longpress`。
- 注意：并非所有组件都需要统一手势（Button 不需要），所以手势层应是可选控制器，按 `use` 调用。

### 方向 D（P1）：跨标签页同步总线 — `createCrossTabBus`

**为什么需要：**
多标签页场景下（CMS 多开、管理后台多窗口），用户期望：

- 主题/皮肤切换 → 所有标签页同步
- 个人资料修改 → 其他标签页刷新权限
- 登出 → 所有标签页退出
- （未来）WebSocket 推送 → 所有标签页更新数据

当前无统一方案——每个应用自建 `storage` 事件监听，分散、不兼容。

**核心挑战：**

| 挑战           | 说明                                                   |
| -------------- | ------------------------------------------------------ |
| **存储限制**   | `localStorage` 5MB + 同步 API 阻塞主线程               |
| **竞态条件**   | 同时修改同一 key 时出现写覆盖                          |
| **序列化开销** | 大型数据（如皮肤主题）反复序列化                       |
| **测试困难**   | `BroadcastChannel` 和 `storage` 事件在 jsdom 未实现    |
| **权限隔离**   | 敏感数据（token/用户信息）不应通过 `localStorage` 传递 |

**架构变更：**

```
packages/core/src/controllers/crosstab/
  ├── createCrossTabBus.ts      (核心：BroadcastChannel + localStorage 降级)
  ├── types.ts
  └── storage.ts                (频道管理 + 序列化 + 去重)

// 使用模式：
const bus = createCrossTabBus('iris:shell')
bus.on('theme-change', (theme) => applyTheme(theme))
bus.emit('theme-change', newTheme)

// 框架桥接（可选）：
const useCrossTab = (channel, event, handler) => { … }
```

**对现有系统的影响：**

- 非侵入式：新能力，不改变现有组件契约
- `IrisProvider` 可选集成：传入 `crossTabBus` 实例，自动同步皮肤/语言/权限
- 需提供 `BroadcastChannel` polyfill 或文档说明浏览器兼容性

### 方向 E（P2）：组合安全治理 — 编译期 + 运行时双层保护

**为什么需要：**
`as-child`、`IrisSlot`、`mergeSlotProps`、`composeRefs` 的组合模式允许强大的抽象，但也允许**非法嵌套**：

- `<IrisDialog as-child><IrisPopover /></IrisDialog>`（浮层嵌套浮层，双层遮罩）
- `<IrisMenuItem as-child><IrisMenuItem /></IrisMenuItem>`（菜单递归）
- `<IrisTable><IrisForm /></IrisTable>`（不兼容组件混合）

当前这些只能人工审查发现，一旦进入生产环境可能导致 ARIA 属性冲突、焦点管理混乱。

**核心挑战：**

| 挑战                     | 说明                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **运行时检测的精度**     | `React.Children.forEach` 只能在 render 时检查，消耗性能                             |
| **编译期检测的框架差异** | React 无编译；Vue/Svelte/Solid 编译期可做但 API 各异                                |
| **组件身份识别**         | 运行时如何判断组件是 `IrisPopover` 还是 `IrisTable`？`displayName` 不可靠（minify） |
| **误报/漏报平衡**        | 过于严格会限制合法组合，过于宽松则防不住                                            |

**架构变更：**

```
// 方案 A：运行时 Symbol 标记（轻量，推荐）
const IrisDialog = Object.assign(forwardRef((props, ref) => { … }), {
  __iris_type: 'layer:Dialog',  // 或 Symbol('iris:component')
  __iris_valid_children: ['layer:*'],  // 允许浮层内嵌套浮层（Drawer内嵌Dialog）
})

// 方案 B：编译期插件（ESLint 规则）
// eslint-plugin-iris/no-invalid-composition
// 规则库：<IrisDialog> 的子元素中，若 children 是 IrisPopover/IrisTooltip → error

// 方案 C：dev-only 运行时校验
// 开发环境下，IrisProvider 注入验证器，组件在 mount 时检查父链
```

**对现有系统的影响：**

- 方案 A 需要为每个组件添加元数据（~149 组件），是侵入性变更
- 方案 B 对现有代码零侵入，但只能覆盖静态分析可检测的案例
- 方案 C 最准确但有性能开销（生产环境应 skip）
- 推荐路线：**B → A → C**。先从 ESLint 规则开始（P2），后续补充运行时保护（P3）

## 3. 接口设计建议

### 3.1 关键接口设计原则

基于 Iris UI 现有的设计质量，以下是补充建议：

**原则一：插件生命周期增加 SSR 阶段**

```
Current:  install(reg: PluginRegistry) → void
Proposed:
  install(reg: PluginRegistry)             → void  // 运行时
  setupSSR?(ctx: SSRContext)               → void  // 服务端初始化
  serialize?()                             → Record<string, unknown>  // 序列化插件状态
  hydrate?(payload: Record<string, unknown>) → void  // 客户端反序列化
```

这不是破坏性变更——`setupSSR`/`serialize`/`hydrate` 是可选方法，现有插件完全忽略即可。

**原则二：壳组件下沉用 "Presenter Pattern"**

```
// core 层（纯数据 + 计算）
createShellLayout() → {
  sidebarWidth, isCollapsed, toggle, responsiveMode
}

// 适配器层（仅渲染）
<AdminLayout>  // React 版本
  const { sidebarWidth, isCollapsed } = useShellLayout()
  return <div style={{ '--sidebar-width': sidebarWidth }}>
    <aside … />  // 实际 DOM 元素
    <main … />
  </div>
</AdminLayout>
```

适配器的职责：**将 core 数据映射为框架特定的 DOM + 事件绑定**。不做任何布局计算。

**原则三：手势控制器用 Machine + 预设分离**

```
// Machine（状态机，必选）
createGestureMachine(config) → {
  state: GestureState,  // idle | active | cancelled
  bind: (element) => void,  // 绑定到 DOM 元素
  destroy: () => void
}

// Presets（预设，可选，B 类）
drag(config) → GestureConfig    // 使用 createGestureMachine 的工厂
pinch(config) → GestureConfig
swipe(config) → GestureConfig
```

Machine 处理**状态转换**（指针按下 → 移动 → 释放），预设处理**语义**（拖动 vs 缩放 vs 滑动）。Machine 在 core、预设可以摇树。

### 3.2 是否需要新的抽象层

| 方向     | 需要的新抽象层                                            | 理由                                               |
| -------- | --------------------------------------------------------- | -------------------------------------------------- |
| 插件 SSR | `SSRContext` + `SerializedPluginPayload`                  | 为服务端/客户端边界定义清晰接口                    |
| 壳共享   | `ShellLayoutController` + `ShellNavigationController`     | 现有代码中这层缺失（逻辑在适配器）                 |
| 统一手势 | `GestureMachine`（状态机） + `GesturePresets`（预设工厂） | 指针事件逻辑在多个组件间横切                       |
| 跨标签页 | `CrossTabBus`（通道抽象） + `CrossTabSerializer`          | 底层 API（BroadcastChannel/storage）细节对业务透明 |
| 组合安全 | 无新抽象层，但需 `ComponentIdentity` 元数据               | 不需要新层，在现有组件上加元数据标记即可           |

### 3.3 向后兼容性策略

所有扩展方向都遵循**加法原则**：

1. **新接口都是可选的**（`interface` 新增可选方法，旧实现零改动）
2. **插件 SSR**：`setupSSR`/`serialize`/`hydrate` 是可选的插件生命周期方法
3. **壳共享**：`createShellLayout` 是新增 export，旧组件保持原样（但标记 `@deprecated`）
4. **手势层**：`createGestureMachine` 是新增能力，不替换已有组件内部的 `useDrag`
5. **跨标签页**：`createCrossTabBus` 是新增能力，现有代码不感知
6. **组合安全**：ESLint 规则（零运行时影响）+ 运行时标记（dev-only）

## 4. 技术选型

### 4.1 新增依赖评估

| 方向     | 建议依赖                                    | 理由                                                                   | 风险                                              |
| -------- | ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 插件 SSR | `devalue`（~1KB）                           | 比 `JSON.stringify` 安全（处理 `undefined`/`Infinity`/`NaN`/循环引用） | React 19 的 `useId`/`Suspense` 边界可能兼容性问题 |
| 统一手势 | 无新增依赖                                  | 纯指针事件 API（PointerEvent API 已 W3C 标准）                         | 无                                                |
| 跨标签页 | 无新增依赖（`BroadcastChannel` 是 Web API） | 可选 polyfill：`broadcast-channel`（~4KB gzip）用于 Safari 旧版        | 无                                                |
| 组合安全 | 无新增依赖（`Symbol`/ESLint）               | 纯 JS 特性                                                             | 无                                                |
| 壳共享   | 无新增依赖                                  | 纯 TS 计算逻辑                                                         | 无                                                |

**关于 PointerEvent polyfill 的决策：**
`PointerEvent` 在 IE11 和旧 Safari 不完整。如果 Iris UI 的目标浏览器包含这些，需要一个 polyfill。建议：

```ts
// 在 createGestureMachine 中做功能检测，而非打包 polyfill
if (typeof PointerEvent === 'undefined') {
  console.warn('[@iris-ui/gesture] PointerEvent not supported, falling back to mouse+touch')
  // 回退到鼠标+触摸事件
}
```

不直接引入 polyfill，而是提供兼容模式——由消费方按需引入 polyfill。

### 4.2 自建 vs 采购决策

| 场景            | 决策                        | 理由                                                                      |
| --------------- | --------------------------- | ------------------------------------------------------------------------- |
| 跨标签页通信    | **自建**（~200 行核心代码） | 业务逻辑简单；`BroadcastChannel` 封装无需第三方                           |
| 手势识别        | **自建**                    | 仅需 PointerEvent + 状态机；Hammer.js/Interact.js 太大（20KB+）且不可摇树 |
| 序列化（SSR）   | **引入 `devalue`**          | 安全序列化复杂度高；自己写容易漏 `undefined`/循环引用/`Date`/`Map`/`Set`  |
| ESLint 组合规则 | **自建**                    | 基于 AST 的规则检查，可维护                                               |

**决策矩阵：**

| 标准                     | 自建 | 引入 |
| ------------------------ | ---- | ---- |
| 代码量 < 300 行          | ✅   | ❌   |
| 有竞态/安全边界          | ❌   | ✅   |
| 框架逻辑密集（组件身份） | ✅   | ❌   |
| 变更频率低               | ✅   | ✅   |

### 4.3 框架版本兼容性

考虑到 Iris UI 的目标期是 2026 年，各框架版本需明确：

| 框架       | 建议目标版本 | 理由                                     |
| ---------- | ------------ | ---------------------------------------- |
| React      | 19.x         | RSC + `use()` Hook + Server Actions      |
| Vue        | 3.5+         | 稳定组合式 API + `defineModel` + `useId` |
| Solid      | 1.9+         | `createAsync` + `use` 与 React RSC 对齐  |
| Svelte     | 5+           | runes（`$state`/`$derived`/`$effect`）   |
| TypeScript | 5.5+         | `infer` 类型推断增强 + 独立声明文件      |

注意：四项适配器的版本兼容性测试应纳入 CI 矩阵（`react-18`/`react-19` 等）。

## 5. 实施路线图

### 5.1 优先级矩阵

| 方向          | 价值                   | 风险                        | 工作量估算 | 优先级 |
| ------------- | ---------------------- | --------------------------- | ---------- | ------ |
| 插件 SSR 协议 | 高（阻塞发布）         | 中（四个框架 SSR API 不同） | ~4.5 人天  | **P0** |
| 壳共享 SDK    | 高（消除重复）         | 低（纯重构，新增不修改）    | ~6 人天    | **P0** |
| 统一手势      | 中（减少 boilerplate） | 中（与现有 `useDrag` 整合） | ~5 人天    | **P1** |
| 跨标签页同步  | 中（场景驱动）         | 低（独立能力）              | ~2 人天    | **P1** |
| 组合安全治理  | 高（长期质量）         | 低（ESLint 先行）           | ~3 人天    | **P2** |

### 5.2 阶段划分

**Phase 0（立即开始）— 插件 SSR 协议 + 壳共享 SDK**

```
Week 1: 插件 SSR 协议设计 + SSRContext/serialize/hydrate 接口
Week 2: React SSR 适配（renderToString + RSC 'use client' 边界）
Week 3: Vue/Solid/Svelte SSR 适配
Week 4: 壳下沉 — createShellLayout + createShellNavigation
```

**Phase 1（Phase 0 后）— 统一手势 + 跨标签页**

```
Week 5: createGestureMachine（状态机 + 指针事件封装）
Week 6: 手势预设（drag/resize/pinch/swipe）+ 现有 useDrag 整合
Week 7: createCrossTabBus（核心通道 + 降级策略）
Week 8: IrisProvider 可选集成跨标签页同步（皮肤/语言/权限）
```

**Phase 2（持续治理）— 组合安全**

```
Week 9: eslint-plugin-iris/no-invalid-composition 规则
Week 10: 组件身份标记（__iris_type）开发环境校验
Week 11: 集成测试 + 文档 + 示例
```

### 5.3 风险矩阵与缓解策略

| 风险                                                        | 概率 | 影响           | 缓解措施                                               |
| ----------------------------------------------------------- | ---- | -------------- | ------------------------------------------------------ |
| SSR 协议设计遗漏框架特有 API（如 Svelte 5 `svelte/server`） | 中   | 高             | 设计阶段并行 PoC 四个框架；每个框架指派 reviewer       |
| 壳下沉后发现 XSS 容器渲染逻辑无法完全脱离框架               | 中   | 中             | 接受部分渲染逻辑留在适配器；下沉"足够多"而非"全部"     |
| 手势状态机与现有 `useDrag` 在竞态处理上冲突                 | 低   | 中             | 现有组件延迟迁移；先以新增 controller 形式发布，不替换 |
| `BroadcastChannel` 在某些受限环境（VPN/内网）不可用         | 低   | 低             | 提供 `localStorage` 事件降级；document 兼容模式        |
| 组件身份标记 `__iris_type` 在生产环境被 minify 删除         | 高   | 低（dev-only） | 计划就是 dev-only；或使用 `Symbol()` 而非字符串        |
| 四框架 SSR API 差异导致插件 SSR 在不同框架表现不一致        | 中   | 高             | 定义框架无关的抽象层（SSRContext），各适配器实现接口   |

### 5.4 测试策略

对每个方向增加对应的测试维度：

| 方向     | 单元测试（core）                        | 集成测试（适配器）           | E2E/SSR 测试             | 兼容性测试            |
| -------- | --------------------------------------- | ---------------------------- | ------------------------ | --------------------- |
| 插件 SSR | `setupSSR`/`serialize`/`hydrate` 数据流 | 各框架 `renderToString` 结果 | Playwright SSR 截图 diff | Node 18/20/22         |
| 壳共享   | `createShellLayout` 状态计算            | 各框架 DOM 结构              | 无额外                   | 无额外                |
| 手势     | 状态机转换（全部路径）                  | 合成 PointerEvent 绑定       | 无额外                   | 触屏/鼠标/笔          |
| 跨标签页 | `BroadcastChannel` mock                 | `IrisProvider` 集成          | 无额外（框架无关）       | Safari/Firefox/Chrome |
| 组合安全 | AST 解析规则                            | 无额外                       | 无额外                   | 无额外                |

### 5.5 发布与文档策略

```
npm publish 前的检查清单:
☐ 插件 SSR 协议实现 + 各框架适配
☐ RSC 'use client' 边界完整性检测（pnpm check:rsc）
☐ 壳下沉至少完成 AdminLayout（验证消除重复可行）
☐ size budget 更新（core 增加 ~2KB，适配器净减）
☐ 文档站点新增章节：/plugins/ssr、/shell/shared-sdk
☐ changeset 准备（major bump：插件接口新增可选方法）
```

## 6. 总结：架构师建议

### 立即开始的切入点

基于上述分析，我建议从 **方向④ 插件 SSR 协议** 开始，具体切入 **TASK-002 插件服务端数据的序列化与反序列化协议**。

**理由：**

1. **阻塞项优先级最高**：npm 发布前必须解决 SSR 兼容性
2. **与现有架构正交**：新增接口不影响现有插件运行逻辑
3. **可独立验证**：先做 `devalue` 序列化协议 + React SSR PoC，再扩展到其他框架
4. **低风险启动**：不触及其他方向的代码，即使设计有小调整也不会阻塞后续方向

**具体建议的第一步行动：**

```
1. 读取 packages/core/src/plugin/types.ts 确认现有 PluginRegistry 接口
2. 设计 SSRContext 类型 + serialize/hydrate 可选方法
3. 在 packages/core 下新建 __tests__/plugin-ssr.test.ts（单元测试先行）
4. 在 @iris-ui/react 实现 React SSR 适配（renderToString 场景）
5. 验证 RSC 边界：确保插件组件不会静默出现在服务端 bundle 中
```

### 需维护者确认的决策

1. **插件 SSR 的序列化安全**：直接用 `devalue` 还是自建安全的序列化方案？
2. **壳下沉的范围**：是否所有 Layer 3-4 壳组件都应下沉，还是先从 `AdminLayout` + `NavMenu` 开始？
3. **手势层的组合策略**：`createGestureMachine` 是否应作为现有 `useDrag` 的内部替换，还是作为独立 API 推出？
4. **四框架 SSR 测试矩阵**：是否要求 4 框架 SSR 测试全部通过才合并，还是接受「先 React，其他框架逐步对齐」？
