现在我已掌握足够的代码库上下文，可以进行全面的架构分析。

---

# 架构分析：Iris UI 的现状与扩展方向

## 1 架构评估

### 1.1 优势 —— 做对了什么

**Core/适配器分离**是该架构的最高价值决策。它在实践中被严格遵循（`@iris-ui/core` 中零框架导入），并在四个框架适配器中取得了实质性成果：每个组件在每个框架中语义一致，逻辑（选择、数据视图、表单、浮层机器）完全唯一。

**合同系统**（`contracts/runner.ts`）是一项新颖的基础设施投资。通过将框架无关的可验证场景编码到 core 中，它在不重复测试脚本的情况下，跨 `react`/`vue`/`solid`/`svelte` 强制行为一致性。这是一项独特资产——其他 UI 库大多没有。

**状态机判别法**（`machine.ts`）已很好地适用 —— `createFloatingMachine` 是一个合理的 2 状态最小机器，用于浮层状态，而更丰富的组合行为（选择、展开）位于专用控制器中，而不是臃肿的机器。机器的基础设施（入口/出口动作、延迟转换、守卫）对于真正需要它们的组件来说已经足够。

**主题/皮肤系统**全面：`tokens` → `theme` → `skins` 层级、CSS 变量生成、继承、`patch`/`resetPatch`、FOUC 防闪引导脚本。它解决了比大多数库更多的生产问题。

**Behaviors 组合**（`IrisMovable`、`IrisResizable`、`IrisHotkey`、`IrisClickOutside`）的理念是正确的——正交能力包裹在任意 UI 上。

### 1.2 局限性 —— 磨砺的边缘

**1. 无叠加状态管理系统。** 所有浮层（Dialog、Popover、Tooltip、Drawer）在 DOM 中做条件渲染（`if (!ctx.open) return null`），从不渲染 `<dialog>` 元素或利用原生 API。这意味着：

- 没有离开动画（除了 Drawer 的手动 `setTimeout` 变通方案）
- 高度/宽度过渡无法动画化（因为元素在动画开始前已卸载）
- `prefers-reduced-motion` 检测存在（`Marquee`、`BackTop`、`Carousel`）但未连接到浮层组件

Drawer 的 2 阶段安装（`useState` + `requestAnimationFrame` + `setTimeout`）正确地处理了离开过渡，但这是一个每个组件的 hack，而不是架构解决方案。

**2. 无手势协调层。** `useDrag`（`primitives/drag/useDrag.ts`）是一个每个实例、无协调的原始 hook。每个 Movable 和每个 Resizable Handle 都独立绑定 `pointerdown`/`pointermove`/`pointerup`到各自的 DOM 元素。嵌套 Movable → Resizable 场景：

- Movable 在根元素上绑定 `pointerdown`
- Resizable 在每个句柄元素上绑定 `pointerdown`
- 没有共享的“活动手势”令牌或优先级协议
- 如果子元素截获指针事件，父 Movable 保持无知

这是正确的：问题不在于全局监听器（cross-validation 证实了这一点），而在于缺少一个协调层来仲裁竞争的手势。

**3. 数据源的请求生命周期空白。** `createDataSource`（`data-source.ts`）有：

- 一个用于取消的 `AbortController`（好）
- 一个用于陈旧性检查的 `epoch` 计数器（好）
- 零请求去重（`pendingQueries: Map<string, Promise>` 不存在）
- 零 SWR/缓存（即使对于不变查询，每次 `setPage`/`setSort`/`setFilter` 都会触发新的 `fetchPage()`）
- 零重试逻辑

这在高延迟连接或快速 pagination 点击期间转化为浪费的带宽。这是一个~20 行的修复，但表明 A 层控制器对数据获取模式（去重、缓存、乐观更新）的看法较窄。

**4. 无可视化回归基础设施。** 在所有 28 个包中，零 Playwright/Cypress/Storybook/storycap 配置。合同测试验证行为（DOM 状态、属性、文本内容），但不验证布局、视觉回归、响应式断点或主题变体。

**5. 上下文守卫不一致。** 跨验证确认了这四个真实缺口：`Select/Option`、`Combobox/Option`、`RadioGroup/Radio`、`ToggleGroup/Item`。每个缺口只需 ~12 行（`if (!ctx) throw new Error('...')`），但关键之处在于程序化错误消息与类型错误 TypeError。这是一个需要建立质量门的模式。

### 1.3 架构债务

| 债务                                     | 位置                                                    | 影响                                                                                  |
| ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 浮层组件中的直觉 exit-animation 变通方案 | `DrawerContent.tsx:96-102`（`useState` + `setTimeout`） | 不可扩展；每个新浮层组件都会重新发明此模式                                            |
| `useDrag` 每个实例，无协调               | `useDrag.ts` + `Movable.tsx` + `Resizable.tsx`          | 嵌套手势无声冲突                                                                      |
| 手动 useEffect 用于受控 prop → 机器同步  | `Popover.tsx:50-57`、`Dialog.tsx`、`Drawer.tsx`         | 样板；容易在机器/适配器边界出现无限重渲染 bug                                         |
| context 注册使用 `React.useEffect` 运行  | `DialogContent.tsx:150`（`ctx.registerTitle()`）        | 如果在严格模式下运行两次，可能会在 SSR 水合期间有闪烁；Svelte 5 的 runes 是不同的模型 |
| 硬编码数字用于过渡持续时间               | `DrawerContent.tsx:61`（`EXIT_DURATION_MS = 220`）      | 不是 token 化的；用户无法覆盖动画速度                                                 |

---

## 2 扩展方向

### 方向 1：`@iris-ui/presence` —— 统一叠加状态系统

**为什么需要：** 当前，每个浮层组件独立处理其安装/卸载生命周期。Drawer 有 2 阶段安装；Dialog、Popover、Tooltip 有零阶段。像 Radix `Presence` 或 Vue `Transition` 这样的统一系统会使所有浮层组件获得一致的进入/离开动画，遵守 `prefers-reduced-motion`，并与 `AnimatePresence`（Framer Motion）或 CSS `@starting-style` 等框架动画系统组合。

**核心挑战：**

- **跨框架的多态性。** 存在协议必须适配于 React 的（`useSyncExternalStore` + `useEffect`）、Vue 的（`<Transition>`）、Solid 的（`<Match>/<Switch>`）和 Svelte 的（`transition:`/`fly:`）。Core 不能规定框架集成策略。
- **exit 生命周期时序。** 当 props 改变关闭时，存在系统必须使组件保持 DOM 存活预定义的持续时间内，然后才真正卸载。这需要安装状态（`unmounted` → `entering` → `entered` → `exiting` → `unmounted`），而不仅是当前的二进制机器（`closed`/`open`）。
- **`prefers-reduced-motion` 整合。** 存在逻辑已经存在于 core 中，但存在于纯材料函数中，未连接到存在生命周期。

**预期的架构变更：**

1. 新建包：`@iris-ui/presence`（zero-runtime 协议 + 4 框架适配器）
2. `FloatingMachine` 从 2 状态 → 5 状态（添加 `entering`、`entered`、`exiting`）或引入一个正交存在协议
3. 每个框架适配器：一个 `<IrisPresence>` 包装器，实现延迟卸载
4. Core 应公开一个 `createPresenceMachine(enterDuration, exitDuration)` 工厂

**对现有系统的影响：**

- 向后兼容：默认情况下，`IrisDialogContent` 可以立即从存在中添加（`enterDuration=0, exitDuration=0` → 表现为当前行为）
- 用户通过 props 或 token 选择加入动画（`--iris-dialog-exit-duration: 200ms`）
- 4 个框架都需要适配器更改；每个框架 4 个×浮层组件 ≈ 每个框架 5 天

### 方向 2：`@iris-ui/gesture` —— 手势协调层

**为什么需要：** `IrisMovable` 和 `IrisResizable` 目前是孤立的。没有一个协调层，就无法构建“可拖动的调整大小面板”（浮动窗口）、可拖动拆分器或“拖动 = 移动，调整大小 = 调整大小”手势优先级。组件作者被迫使用自己的手势管理器或使用不可靠的变通方案。

**核心挑战：**

- **手势仲裁。** 当两个指针序列在空间或时间上重叠时（例如，在可拖动窗口中的子调整大小句柄），系统必须决定哪个赢。协议：子优先？最后注册？z-index 优先级？
- **跨框架状态。** 协调器需要是一个单例（或上下文作用域），手势可以被竞争性声明。这不能是每个实例的 `useDrag`。
- **侵入性 vs 薄包装器。** 该层需要足够薄以不强制框架，但又足够智能以仲裁。一个协调器中央事件总线可能过于重；一个 DOM 冒泡的手势优先级可能过于轻。

**预期的架构变更：**

1. Core 中新的 `createGestureCoordinator()` 工厂，具有：
   - `register(handle: HTMLElement, priority: number): GestureHandle`
   - `unregister(handle)`
   - `claimGesture(pointerId, handle): boolean`（原子声明）
2. 重构 `useDrag` 以可选用协调器（注入式）：有协调器的调用者获得仲裁；没有的将像今天一样工作
3. 重构 `IrisMovable`/`IrisResizable` 以在渲染时通过 context 可选钩入协调器

**选项和权衡：**

| 方法                                                                  | 权衡                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| **每个根作用域的协调器**（`IrisGestureRoot` 包装器）                  | 显式但在树中可见；非侵入性                             |
| **隐形全局协调器**（模块级单例）                                      | 可自动工作但难以调试；与 SSR 冲突                      |
| **DOM 事件元协议**（`pointermove` 冒泡 + `stopPropagation` 用于回退） | 使用现有浏览器原语但依赖顺序，且可能被用户代码意外破坏 |

**对现有系统的影响：**

- 向后兼容：当没有协调器被注入时，`useDrag` 表现不变
- 现有 `IrisMovable`/`IrisResizable` 使用无需更改代码
- 新行为（`IrisDraggablePanel`、可拖动拆分器）依赖于协调器

### 方向 3：数据源的 SWR/缓存层

**为什么需要：** 目前，对 `data-source` 的每次调用都会通过网络（或同步处理）获取数据。对于列表 UI（表格、无限滚动、组合框），用户经常点击分页、改变排序或直接点回。没有去重，所以他们因：

1. 无请求去重而浪费带宽（同一查询并发两次）
2. 无 SWR 而浪费时间（重新获取可见数据）
3. 无乐观 UI 而浪费注意力（它们等待，而不是立即渲染缓存）

**核心挑战：**

- **持久化边界。** 缓存持续多长时间？按会话（`Map`）还是持久化（`localStorage`/`IndexedDB`）？
- **失效策略。** 什么使缓存条目无效？`mutate()` 调用？时间？可见性（`refetchOnMount`）？
- **乐观写入。** 在确认前更新 UI 然后回滚是常见的（ProTable 期望它），但目前的架构将突变留给插件。

**预期的架构变更：**

1. 在 core 中创建 `createQueryCache({ ttl, maxEntries, storage? })` 工厂
2. 将 `inFlight` 从 `AbortController | null` 扩展到 `Map<string, { promise, controller }>`（用于去重）
3. 添加可选的 `cacheKey` 到 `DataSourceConfig`；如果不存在，默认行为是无缓存
4. 在数据源上公开 `invalidate()` 和 `mutate()` 方法

**对现有系统的影响：**

- `cacheKey` 不存在 → 现有用户零行为变化
- `cacheKey` 存在 → 自动去重 + SWR
- ProTable 插件可以构建在 `mutate()` 之上以获得乐观更新

### 方向 4：Manifest 驱动的可视化回归系统

**为什么需要：** 当前保证跨框架一致性的合同系统仅限于 DOM 状态。它无法捕获布局回归、主题视觉差异或动画错误。一个 manifest 驱动的可视化回归系统可以自动测试所有 ~149 组件、4 个框架、2 个主题（亮/暗）、~2 个皮肤 = ~2400 种视觉组合。

**核心挑战：**

- **跨框架工件。** 每个框架需要一个测试页来渲染每个组件。这很多。manifest 已经枚举了所有组件；它可以生成路由。
- **确定性截图。** 浮动元素（Popover/Dialog）在 jsdom 中无法可靠定位。Playwright 可以捕获真实布局。
- **主题/皮肤矩阵。** 每个组件需要针对亮、暗和每个皮肤进行视觉测试。256 种组合 → 2K+ 截图。

**预期的架构变更：**

1. 新建包：`@iris-ui/visual-tests`（或 `apps/visual-regression`）
2. Manifest 生成每个组件名的 Playwright 规范
3. CI 步骤：构建每个框架的测试应用 → 启动 Playwright → 截图 → diff 与基线
4. 添加一个 `visualSnapshot` 元数据字段到 manifest

**对现有系统的影响：**

- 零运行时影响（测试基础设施只有）
- 设置成本高：初始基线生成可能产生许多误报
- 支架需要重新运行 CI 来批准更改，这增加了工作流复杂性

### 方向 5：在 core 中的形式化上下文守卫契约

**为什么需要：** 跨验证确认了 4 个真实的上下文守卫缺口。这些是廉价的修复，提供了巨大的 DX 收益——将 cryptic `Cannot read properties of null` 转换为 `'<IrisOption> must be inside <IrisSelect>'`。但问题更深：没有强制要求每个复合组件都有守卫的自动化质量门。

**核心挑战：**

- **检测。** 守卫最常见的模式是：从 context 消费，如果它是 null 则抛出一个有意义的错误。但并非所有复合组件都需要它——有些组件有可选上下文。
- **测试。** 守卫需要一个测试来渲染孤立组件并断言 `toThrow`。合同系统定义了场景但没有守卫断言。

**预期的架构变更：**

1. 向合同系统添加一个 `guard` 场景类型（`action: 'render-outside-context'`，期望 `throws`）
2. 向 `@iris-ui/manifest` 添加一个 `hasContextGuard` 元数据字段，包含在 `gen:manifest` 中
3. CI 检查：`pnpm check:context-guards` 扫描所有复合组件并报告缺失

**对现有系统的影响：**

- 最小：每个缺口 < 12 行 + <20 行测试
- 防止回归：新的复合组件必须添加守卫才能通过 CI
- 使 IRIS-UI 与 Radix（为每个复合组件做得很好）对齐

---

## 3 接口设计原则

### 3.1 保持分层

该架构当前的分层（Core L0 → 适配器 L1-L4 框架 → 行为 → 插件）仍然合理。扩展不应模糊这些边界：

- **存在/手势层**应该与 Core 分开，具有框架适配器，就像当前的选择/展开模式一样
- **缓存/去重**应该作为 Core `createDataSource` 的可选配置层存在，而不是一个新的包
- **可视化回归**应该是一个新的测试包，不影响运行时接口

### 3.2 新增的接口契约

对于任何扩展，关键接口选择：

| 原则                     | 原因                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| **默认零开销**           | 如果用户不导入或配置功能，0 字节进入 bundle，0 个新依赖                           |
| **行为注入，而非配置**   | 像当前 Behaviors 使用 `<IrisResizable>` 包装器一样传递功能，而不是通过 props 配置 |
| **Core 协议，框架桥接**  | 存在和手势应该像选择/展开一样：Core 定义工厂/类型，适配器桥接到框架反应性         |
| **`use` 之前不打包插件** | 重度功能（编辑器、ProTable）保持插件形式                                          |

### 3.3 具体接口决策

**对于存在系统：**

```
// Core 协议（零依赖）
createPresenceMachine({ enterDuration?: number, exitDuration?: number })
  → Machine<'unmounted' | 'entering' | 'entered' | 'exiting', ...>

// React 适配器
<IrisPresence enter={200} exit={200}>
  {open && <IrisDialogContent />}  // 延迟卸载
</IrisPresence>
```

**对于手势协调：**

```
// Core 协议
createGestureCoordinator() → {
  register(handle: HTMLElement, priority: number): () => void
  claim(pointerId: number, handle: HTMLElement): boolean
  getActive(pointerId: number): HTMLElement | null
}

// React 适配器
<IrisGestureRoot>
  <IrisMovable><IrisResizable>...</IrisResizable></IrisMovable>
</IrisGestureRoot>
```

### 3.4 向后兼容性策略

1. **检测/弃用来引入。** 新的可选 props（例如 `cacheKey`、`IrisPresence` 包装器）可以检测到缺失并通过警告引导用户
2. **跨框架同步。** React 中测试的任何新接口必须在 Vue/Solid/Svelte 中具有语义等效项。合同系统确保这一点
3. **Core 类型版本控制。** 接口更改（例如将 `FloatingState` 扩展为 5 状态）应添加，而非修改。旧 consumer 保持功能

---

## 4 技术选型

### 4.1 需要什么

| 功能           | 推荐方法                                                | 原因                                                                                                                                  |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **可视化回归** | Playwright + `@playwright/test` + `playwright-chromium` | 已经是 monorepo；Playwright 是事实标准；无框架锁定                                                                                    |
| **存在动画**   | 自制协议（`createPresenceMachine`），4 个框架适配器     | 当前堆栈中没有 Framer Motion；添加 framer-motion 作为依赖将为 bundle 增加 ~15KB，并且与 Vue/Solid/Svelte 不兼容。自制协议保持框架无关 |
| **手势协调**   | 自制协调器（Core 工厂 + 适配器）                        | 没有跨框架的 gesture-lib 存在；`@use-gesture/vanilla` 接近但缺少优先级仲裁                                                            |
| **请求缓存**   | 自制 `createQueryCache`（Core 工厂）                    | 轻量（~50 行）；SWR/`@tanstack/react-query` 会增加 ~12KB 并锁定框架；自制与 data-view 更紧密集成                                      |

### 4.2 第三方依赖评估

评估新依赖的标准：

| 标准              | 要求                                       |
| ----------------- | ------------------------------------------ |
| **框架无关**      | 核心层必须零框架导入                       |
| **Tree-shakable** | 未使用的功能不应进入 bundle                |
| **大小预算**      | Core 新增 < 1KB，每个适配器新增 < 2KB      |
| **测试兼容性**    | 在 jsdom + node 测试中无需配置即可工作     |
| **许可证**        | MIT/Apache 2.0（无 SSPL/AGPL，无商业限制） |

### 4.3 自建 vs 采购决策

| 功能                  | 决策                            | 理由                                                                                                  |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 存在管理              | **自建**                        | 跨框架多态性：没有库在所有 4 个框架中都有效。协议规模不大（~100 行）。                                |
| 手势仲裁              | **自建**                        | 没有库解决跨框架的优先级仲裁。规模不大。                                                              |
| 请求缓存/SWR          | **自建**                        | 所需 API 很小（去重 + 过时-时重新验证 + 突变）。一个 80 行的工厂比引入 @tanstack/react-query 更合适。 |
| 可视化回归            | **Playwright**                  | 不是构建时；是测试基础设施。Playwright 是这里的最佳选择。                                             |
| 可拖动/可调整大小面板 | **自建**，在存在 + 手势协调之上 | 一旦存在和手势到位，可拖动/可调整大小组合是编排问题，不是新库。                                       |

---

## 5 实施路线图

### 优先级

| 优先级 | 方向                             | 理由                                                                    |
| ------ | -------------------------------- | ----------------------------------------------------------------------- |
| **P0** | 方向 5：上下文守卫契约           | 低成本（4×12 行 + 测试），高 DX 影响；从合规清单中清除已知缺口          |
| **P0** | 方向 3：请求去重（缓存层的子集） | 低成本（~20 行），高运行时影响（消除浪费的获取）                        |
| **P1** | 方向 1：存在系统                 | 消除架构债务（Drawer 的手动退出动画）；跨框架统一；解锁可主题化动画速度 |
| **P1** | 方向 2：手势协调                 | 解锁可拖动窗口、可调整大小面板；澄清 Movable+Resizable 语义             |
| **P2** | 方向 4：可视化回归               | 高设置成本，高信心收益；需要 play-pen 应用和团队承诺维护截图基线        |

### 阶段细节

**阶段 0（第 1-2 天）：基础修复**

- 实现 4 个上下文守卫 + 测试
- 实现 `pendingQueries: Map<string, Promise>` 去重到 `createDataSource`
- 添加 CI 检查规则（`check:context-guards`）
- _交付：_ 具体、可合并的 PR，测试绿色

**阶段 1（第 1-2 周）：存在系统**

- 设计 Core 协议：`createPresenceMachine`（5 状态） + 类型
- 选择 1 个框架（例如 React）作为原型：编写 `<IrisPresence>`，重构 `IrisDialogContent` 以使用它
- 将 `IrisPopoverContent`、`IrisDrawerContent`、`IrisTooltipContent` 移植到存在
- 添加 `usePrefersReducedMotion()` 连接到存在进入/退出持续时间
- 将 `--iris-dialog-exit-duration` 等 token 添加到主题
- 移植到 Vue → Solid → Svelte（并行：核心协议不变）
- _交付：_ 所有 4 个框架中，所有浮层组件都具有统一的进入/离开动画 + 减动效尊重

**阶段 2（第 2-4 周）：手势协调 + 可拖动面板**

- 设计 Core 协议：`createGestureCoordinator`
- 编写可选的协调器注入到 `useDrag`
- 引入 `<IrisGestureRoot>` 框架包装器
- 重构 `IrisMovable` → `IrisResizable` 以使用协调器
- 示例：`<IrisDraggablePanel>` 结合存在 + 手势以实现可拖动、可调整大小、主题化的窗口
- _交付：_ Movable+Resizable 和谐；可拖动/可调整大小面板原型

**阶段 3（第 5-8 周）：缓存层**

- 设计 Core 协议：`createQueryCache({ ttl, maxEntries })`
- 向 `DataSourceConfig` 添加可选的 `cacheKey` + `cache`
- 向 `DataSourceController` 添加 `invalidate(key?)` 和 `mutate(key, updater)`
- 编写测试（陈旧数据 → 重新验证；去重；TTL 过期）
- _交付：_ 数据源感知缓存；按需 ProTable 乐观更新

**阶段 4（第 9-12 周）：可视化回归**

- 添加 Playwright 到 repo（`pnpm add -D -w @playwright/test`）
- 扩展 manifest 生成以创建路由规范
- 构建 4 个测试应用（react/vue/solid/svelte），一个路由每个组件
- CI 步骤：`playwright install` + `pnpm exec playwright test`
- 基线生成 + PR 评论 API
- _交付：_ 自动截图回归跨所有框架 + 主题变体

### 风险矩阵

| 风险                                           | 可能性 | 影响 | 缓解                                                                                                 |
| ---------------------------------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------- |
| 存在系统使复杂状态机回归（svg-js 退化）        | 中     | 高   | 存在机器保持简单（5 状态，零上下文）。状态机判别法仍适用：浮层获得存在，表单/树不移。                |
| 手势协调添加了上下文层次，使行为包装器更重     | 中     | 中   | 使协调器可选；不带协调器，行为表现不变。文档单一规则：“需要协调的嵌套手势使用 `IrisGestureRoot`。”   |
| 缓存层添加了可变状态，使测试不稳定             | 中     | 中   | 查询缓存可注入/可模拟；默认 `ttl: 0` = 无缓存行为。测试注入 `ttl: -1`（永不过期）以获得确定性。      |
| 可视化回归 CI 运行超过 20 分钟                 | 高     | 中   | Playwright sharding；仅对更改的包进行有差异测试；manifest 元数据指导选择性运行。                     |
| 团队烧伤：4 个框架适配器对每一个更改施加高成本 | 低     | 高   | 使用合同测试来强制框架一致性，使适配器 PR 成为机械任务。如果一个框架落后，发布一个更严格的尺寸预算。 |

### 退出标准

对于每个方向，在发布前应满足：

| 方向       | 准备发布的条件                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 存在       | 4 个框架中的所有浮层组件通过合同测试（没有 `setTimeout` hack）；`prefers-reduced-motion` 受尊重的进入/退出动画；每个 exit-duration 的可主题化 token |
| 手势       | Movable 中的 Resizable → 句柄在 3 个场景中获胜（嵌套、兄弟、重叠）；现有 Movable/Resizable 测试绿色，无需协调器                                     |
| 缓存       | 去重消除“快速分页垃圾”；SWR 测试（陈旧-时-重新验证）；`invalidate` 强制重新获取；bundle 增量 < 1KB                                                  |
| 可视化回归 | Playwright CI 绿色；基线截图 PR 工作流；24 小时内没有开发人员烧伤                                                                                   |

---

## 总结

Iris UI 有一个坚实、纪律严明的架构。缺口主要在三个地方：**叠加生命周期**（无存在→断裂的动画）、**手势**（无仲裁→竞争拖动/调整大小）和**数据获取生命周期**（无去重/缓存→浪费的请求）。这些都是可预测的缺口，对于一个关注逻辑下沉、跨框架对齐和主题覆盖的库来说——它们恰好是 `@radix-ui` 或 Naive UI 使用几年后解决的问题。

好消息是，这些方向中的每一个都与现有架构自然地契合：

- 存在 = 另一个像选择/展开的 core 工厂，但有框架适配器
- 手势 = 一个可选的注入式协调器，可以搭配 `useDrag`
- 缓存 = `DataSourceConfig` 中的一个可选层
- 上下文守卫 = 一个廉价的 CI 门
- 可视化回归 = 一个测试包，不是运行时

最高杠杆的下一步是实现第 0 阶段（上下文守卫 + 请求去重）——两者都是 1-2 天的努力，可以在更高投入的方向之前产生即时价值。
