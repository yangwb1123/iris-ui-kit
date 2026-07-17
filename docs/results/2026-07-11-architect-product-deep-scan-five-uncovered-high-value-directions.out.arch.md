以下为架构分析报告。

---

# 架构分析：Iris UI 五个未覆盖高价值方向

## 1. 架构评估

### 1.1 当前架构的核心优势

Iris UI 的架构设计在同类 UI 基础设施中有几个罕见的强点：

**A/B/C 分类模型是真正的架构创新。** 将逻辑严格区分为「核心身份（A）」「附加能力（B）」「纯材料（C）」三层，配合四框架薄桥，使 149 组件的对齐成为可能。这在业界没有先例——Radix 只有 React，Naive 只有 Vue，Solid 和 Svelte 生态各自独立——Iris 证明了"一次逻辑编写、四端复用"是可行的。

**Store 抽象层是框架桥接的关键成功因素。** `Store<T>` 接口（`getState` / `setState` / `subscribe` / `subscribeWith` / `batch`）为所有控制器提供了统一的反应式契约。React 走 `useSyncExternalStore`，Vue 走 `ref`+订阅，Solid 走 `createSignal`，Svelte 走 `toStore`——这个设计是四框架对齐的基石。

**插件系统的契约设计克制且正确。** `PluginRegistry` 只开放 `registerTokens` / `registerMessages` / `registerStore` / `onTeardown` 四个注册点，没有 `registerComponent`。不做动态组件注册是为了保留类型安全、tree-shaking 和 manifest 的可扫描性。这个取舍是正确的。

**Token 驱动 + CSS 变量的主题系统在架构层面解耦了视觉与逻辑。** `IrisTheme` → `applyTheme` → `var(--iris-*)` 的链路每个环节都是可替换的，皮肤层的 `extends` 继承机制允许部分覆盖而不需要完整复制。

### 1.2 当前架构的局限性

从五个未覆盖方向反推，可以识别出以下结构性局限：

**局限一：单用户假设贯穿整个核心层。** `createSelectionModel`、`createExpansion`、`createResourceController`、`createAdminShell`——所有控制器都假定同一时间只有一个操作者。这不是"缺协作功能"的问题，而是**核心数据模型的单用户偏见**。`SelectionModel` 的 state 不携带 `userId`，`DataSource` 的变更日志不区分来源，`ResourceController` 的 `mutate` 没有操作者上下文。要支持多用户，不是加几个组件就够了——核心层的接口语义需要扩展。

**局限二：Desktop OS 的应用模型缺少「运行时交互」维度。** `AppManifest` 目前是一个声明式描述（id、name、icon、kind、render 函数），相当于操作系统的「桌面图标」和「窗口内容」的绑定。但缺少三个关键维度：

- **能力宣告（Capability Declaration）**：App 能做什么（处理 `.csv`、发送通知、打开链接）
- **服务发现（Service Discovery）**：其他 App 如何找到并调用这个能力
- **生命周期契约（Lifecycle Contract）**：App 被调用时是否懒加载、被依赖时是否可卸载

这是四个 Desktop OS 壳（React/Vue/Solid/Svelte）共有的架构缺口。

**局限三：表单步骤模型是线性序列，没有图论基础。** `FormStep<V>` 只有 `id` + `fields`，`createStepNavigation` 的 `nextStep` 永远 `cur + 1`。这是一个显式的简化假设。在真实产品中，注册/配置/支付向导几乎总是需要条件分支、步骤跳过、动态步骤生成。缺少图结构（DAG）支持意味着 form engine 的导航层只有线性能力——这对 plugin-form-builder 是一个硬约束。

**局限四：CSS 变量传播链的性能成本未被架构层管理。** `var(--iris-*)` 的求值需要浏览器沿 DOM 树向上爬升——每个组件引用一次变量，就产生一次样式计算。在 149 个组件、多层嵌套、ProTable 500 行的场景下，这个成本是线性增长的，而 containment 是唯一能打破这个线性关系的 CSS 机制。当前架构在 core 层没有 `ContainmentLevel` 类型、没有 containment 配置接口、没有组件级默认值——这是一个被遗漏的跨层优化协议。

**局限五：没有生产可观测性抽象层。** 项目有完善的 CI 质量门（test/typecheck/lint/build/size/rsc/bench），但这些都是**构建时**和**开发时**的测量。生产环境的真实性能（用户设备、网络、数据量）是盲区。`IrisProvider` 接受 `plugins`、`theme`、`locale`，但不接受任何 `telemetry` 或 `instrumentation` 配置。这意味着整个组件树的运行时行为对外部完全不可观测。

### 1.3 架构债务识别

| 债务类型              | 位置                                                                   | 描述                                      | 影响面                                         |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| **模型贫血**          | `FormStep<V>`                                                          | 缺少条件分支、步骤组、动态生成能力        | 所有多步骤表单场景（注册/配置/支付）           |
| **单用户偏见**        | `SelectionModel`, `ExpansionModel`, `ResourceController`, `DataSource` | 所有 state 不含操作者 ID                  | 未来协作功能的架构摩擦                         |
| **无隔离契约**        | 全部 Layer 1-4 组件                                                    | 零 CSS containment 声明                   | ProTable 500行、Dashboard 20 widget 的渲染性能 |
| **OS 应用模型不完整** | Desktop OS `AppManifest`                                               | 无能力宣告/无通信协议                     | 四框架 Desktop OS 的应用间交互为零             |
| **可观测性空白**      | `IrisProvider` 配置接口                                                | 无 telemetry sink/无 instrumentation hook | 无法度量生产环境组件性能                       |
| **React 中心主义**    | Desktop OS `catalog.ts`                                                | render 函数类型为 `() => React.ReactNode` | 其他框架的 Desktop OS 壳各自为政               |

---

## 2. 扩展方向

以下方向基于输入文档的五个候选，但从架构层面重新审视了优先级和边界。

### 方向 A（P1）：表单向导条件分支协议 — `FormStepGraph`

**定位：** 在 `FormStep<V>` 之上建立有向无环图（DAG）步骤拓扑，取代当前的线性序列。

**为什么需要（架构理由）：**
当前 `createStepNavigation` 的线性模型是 form engine 最显式的架构缺口。它不是在"缺功能"，而是在**约束了所有消费方的表达力**。`plugin-form-builder` 如果基于线性步骤模型构建可视化向导编辑器，未来要支持条件分支将面临 breaking change。现在扩展比以后重构成本低一个数量级。

**核心挑战：**

1. **循环检测**：条件分支天然引入图。`shouldSkip` 的条件可能产生 A→B→C→A 的循环。需要拓扑排序验证 + 运行时死循环防护（步数上限）。

2. **条件求值时序与非确定性**：`shouldSkip` 可能是同步函数、异步函数、或依赖后续步骤数据的函数。当步骤 2 的 `shouldSkip` 依赖步骤 3 的字段值时，求值顺序产生鸡生蛋问题。需要声明 `dependencies?: Key<V>[]` 让引擎可以拓扑排序条件求值。

3. **子步骤与步骤组**：真实向导有"步骤 2.1、2.2、2.3"的嵌套结构，且子步骤的可见性可能独立于父步骤。`FormStepGroup<V>` 作为容器节点需要支持递归嵌套。

4. **URL 状态同步**：条件分支意味着当前步骤的索引不再是线性的——它依赖于表单值。`activeStep` 不能只存 index，需要存 `stepId` + 导致到达此步骤的条件快照（即「面包屑路径」）。

**预期的架构变更：**

```
// 新增：步骤图节点类型
interface FormStepNode<V> {
  id: string
  title?: string
  description?: string
  fields?: Key<V>[]
  shouldSkip?: (values: FormValues<V>) => boolean | Promise<boolean>
  // 非必填：前驱步骤的 id（默认按数组顺序）
  dependsOn?: string[]
}

// 新增：步骤组（递归容器）
interface FormStepGroup<V> {
  id: string
  title?: string
  steps: FormStepNode<V>[]
  // 组级别的跳过条件——组内所有步骤一并跳过
  shouldSkip?: (values: FormValues<V>) => boolean | Promise<boolean>
}

// 增强：步骤导航支持 DAG
interface StepNavigation<V> {
  // 当前保持
  stepCount: () => number
  // 新增：获取当前步骤的拓扑后继列表（支持分支 UI 渲染）
  nextCandidates: () => FormStepNode<V>[]
  // 新增：获取「步骤路径」——从开始到当前步骤的 id 序列
  stepPath: () => string[]
  // 增强：nextStep 自动根据 shouldSkip 选择后继
  nextStep: () => Promise<boolean>
  // 新增：验证 DAG 无循环/无孤立步骤
  validateGraph: () => { valid: boolean; errors: string[] }
}
```

**对现有系统的影响：**

- `FormStep<V>` 保持可用，降级为 `FormStepNode<V>` 的特例（无 `shouldSkip`、无 `dependsOn`）
- `createStepNavigation` 签名扩展为接受 `(FormStepNode<V> | FormStepGroup<V>)[]`，现有调用方不破坏
- 引入 `createStepDAG` 纯函数处理图验证与后继计算

### 方向 B（P1）：CSS 渲染优化协议 — `ComponentContainment`

**定位：** 为核心层增加 `ContainmentLevel` 枚举，每个 Layer 1-4 组件声明默认 containment，`IrisProvider` 提供全局覆盖。

**为什么需要（架构理由）：**
这不是性能优化——这是**架构层面的渲染隔离契约**。Token 系统的 `var(--iris-*)` 传播链在所有框架中共享同一个浏览器引擎约束：CSS 变量的求值成本正比于 DOM 深度 × 组件数量。`contain: style` 是唯一能阻断这个传播链的 CSS 机制。没有 containment 协议，Token 系统的规模扩展性是受浏览器样式计算约束的——这不是框架能解决的。

更关键的是，**组件的渲染隔离应该是组件自身声明的契约，而不是消费者事后调优的参数**。每个组件最清楚自己的子树的渲染边界在哪里——IrisTable 知道自己的行是独立的布局单元，IrisDialog 知道自己的内容与主文档流无关，IrisDashboardGrid 知道自己的 widget 彼此独立。这些信息应该编码在组件自身，而不是留给终端用户去配置。

**核心挑战：**

1. **`contain: style` 阻断 CSS 变量继承**：如果一个组件设置 `contain: style`，它的子树将无法继承祖先的 `var(--iris-*)`。解决方案是在 containment 根节点上显式声明 `--iris-*` fallback 值（通过 `applyTheme` 或 `applyCssVars`）。

2. **`contain: layout` 与 Behaviors 的冲突**：`IrisSortable`（拖放排序）依赖元素在 DOM 中的几何位置，`contain: layout` 会改变定位上下文。需要 Behavior 声明 `requireUncontainedLayout` 标志。

3. **SSR/Hydration 差异**：服务端渲染时 `content-visibility` 不生效，hydrate 后浏览器可能对"新出现"的区域做额外渲染。解决方案是 SSR 时设置 `content-visibility: visible`，hydrate 后在 `useEffect`/`onMount` 中切换。

4. **`content-visibility: auto` 与页面搜索**：浏览器 UI 的"在页面中查找"可能无法扫描 `content-visibility: auto` 的不可见子树。需要提供 `contain-intrinsic-size` 占位尺寸。

**预期的架构变更：**

```
// @iris-ui/core/containment
enum ContainmentLevel {
  None = 'none',
  Layout = 'layout',         // contain: layout
  Paint = 'paint',           // contain: paint
  Style = 'style',           // contain: style
  Size = 'size',             // contain: size
  Strict = 'strict',         // contain: strict
  Content = 'content',       // contain: content
  AutoVisibility = 'auto',   // content-visibility: auto
}

interface ComponentContainment {
  level: ContainmentLevel
  intrinsicSize?: { width?: number; height?: number }  // contain-intrinsic-size
}

// 组件 prop 扩展（每个组件可选）
interface IrisComponentProps {
  containment?: ContainmentLevel | ComponentContainment
}

// IrisProvider 级全局默认
interface IrisProviderConfig {
  defaultContainment?: ContainmentLevel
}
```

**对现有系统的影响：**

- 完全增量——现有组件不声明 containment 等于 `ContainmentLevel.None`
- 组件可以在各自层面独立采纳，不需要一次性全部迁移
- `IrisProvider` 新增 `defaultContainment` prop，提供者级别的覆盖

### 方向 C（P2）：Desktop OS 应用间通信与能力宣告协议 — `AppBus` + `CapabilityRegistry`

**定位：** 将当前 Desktop OS 的 `AppManifest` 扩展为包含 `capabilities` 和 `services` 的完整应用契约，并引入 `AppBus` 作为运行时通信桥。

**为什么需要（架构理由）：**
当前 Desktop OS 的架构停留在「窗口管理器 + 图标集合」阶段。`AppManifest` 有 `permissions`（应用请求的权限）但没有 `capabilities`（应用提供的能力）。这是架构上的**单向权限模型**——只描述了"App 需要什么"，没描述"App 能做什么"。在操作系统架构中，能力和权限是硬币的两面。

四个 Desktop OS 壳（React/Vue/Solid/Svelte）当前各自实现了一个 `catalog.ts`，但应用之间不能通信。这意味着「文件管理器拖一个文件到 Data 应用」这种操作系统的最基本交互都无法实现。更重要的是，`remote` 类型的第三方应用（动态加载的 ESM 模块）无法与系统集成——它只是一个隔离的 iframe/组件。

**核心挑战：**

1. **跨窗口/跨标签页路由**：Desktop OS 的多个窗口可能运行在不同的浏览器标签页或 iframe 中。`AppBus` 必须基于 `BroadcastChannel` 或 `SharedWorker`，不能是简单的同窗内存共享。

2. **能力冲突与优先级**：两个应用声明可以处理 `.csv`（ProTable + CodeEditor）。需要优先级/用户选择机制 +"总是用此应用打开"的记忆。这个决策不能硬编码——需要一个 `CapabilityRanking` 策略接口。

3. **懒启动与应用生命周期**：App B 被调用时可能尚未挂载或被卸载。`AppBus` 需要支持"收到请求 → 自动挂载 → 处理后通知调用方"的完整生命周期。

4. **权限不透传**：App A 有剪贴板权限，调用 App B 处理数据时，B 不应该继承 A 的权限。需要一个标准化的中介请求模式。

**预期的架构变更：**

```
// @iris-ui/core/app-bus

// 能力声明
interface AppCapability {
  type: 'file-handler' | 'protocol-handler' | 'action-provider'
  schemes?: string[]       // ['file://.csv', 'file://.json']
  mimeTypes?: string[]     // ['text/csv', 'application/json']
  actions?: string[]       // ['calendar.createEvent', 'files.open']
}

// 应用清单扩展
interface AppManifest {
  // ... 现有字段
  capabilities?: AppCapability[]
  // 声明应用提供的服务接口
  provides?: Record<string, ServiceSchema>
}

// 运行时通信桥
interface AppBus {
  request(targetId: string, action: string, payload: unknown): Promise<AppBusResponse>
  broadcast(action: string, payload: unknown): void
  onRequest(action: string, handler: AppRequestHandler): () => void
  onBroadcast(action: string, handler: BroadcastHandler): () => void
  // 服务发现
  findApps(capability: AppCapabilityQuery): AppManifest[]
}

// 能力注册中心
interface CapabilityRegistry {
  register(appId: string, capability: AppCapability): void
  unregister(appId: string, capability: AppCapability): void
  resolve(query: AppCapabilityQuery): AppManifest[]
}
```

**对现有系统的影响：**

- `AppManifest` 扩展（`capabilities` 为可选字段），现有清单向后兼容
- Desktop OS 壳需要新增 `AppBus` 实例初始化和传递
- `catalog.ts` 中的内置应用逐步添加 `capabilities` 声明
- 跨框架一致性：`AppBus` 接口定义在 core 层，各壳实现 BroadcastChannel 桥接

### 方向 D（P3）：组件级生产遥测 SDK — `TelemetrySink`

**定位：** 为 `IrisProvider` 增加 `telemetry` 配置点，收集组件挂载/更新/卸载/交互/错误事件，支持采样和脱敏。

**为什么需要（架构理由）：**
这不是一个功能——这是一个**组织级反馈环路**。当前的质量体系是基于"我们在 CI 中测量什么"。但生产环境的真实使用模式与 CI 测试相差巨大：用户的设备性能、网络延迟、数据量、交互路径——这些都是 CI 无法复现的。没有遥测，性能优化是盲人摸象。

从插件生态角度，`IrisProvider(plugins=[...])` 的插件市场需要知道哪些插件被广泛使用、哪些功能与用户交互——没有遥测，插件作者只能根据 GitHub issue 数量判断活跃度。

**核心挑战：**

1. **性能开销分层**：每个组件每次渲染都触发回调 → 测量本身变成性能问题。需要三层模型：
   - `verbose`（开发环境，100% 采样）
   - `sampled`（生产环境，1% 采样率）
   - `critical`（错误/异常，100% 采样）

2. **PII/隐私**：`IrisFormField` 的 `onChange` 事件可能包含用户输入内容。每个遥测事件必须有 `pii: boolean` 标记，自动脱敏或丢弃 payload。

3. **框架差异抽象**：React 的 `useEffect` 计数 vs Vue 的 `onBeforeUpdate` vs Solid 的 `onCleanup` vs Svelte 的 `$effect`——需要在 core 层定义事件类型，框架适配器按各自生命周期注册。

4. **SSR 静默**：服务端渲染时会触发生命周期但不应产生遥测事件。需要 `typeof window === 'undefined'` 守卫。

**预期的架构变更：**

```
// @iris-ui/core/telemetry

interface TelemetryEvent {
  type: 'mount' | 'update' | 'unmount' | 'interaction' | 'error'
  component: string
  framework: 'react' | 'vue' | 'solid' | 'svelte'
  timestamp: number
  phase?: 'ssr' | 'csr' | 'hydration'
  duration?: number
  pii: boolean
  metadata?: Record<string, unknown>
}

interface TelemetryConfig {
  enabled: boolean
  sampleRate: number      // 0.01 = 1%
  sink: TelemetrySink
  onError?: (event: TelemetryEvent) => void  // 错误事件不采样
}

interface TelemetrySink {
  push(event: TelemetryEvent): void
  flush(): Promise<void>
  dispose(): void
}

// IrisProvider 扩展
interface IrisProviderConfig {
  telemetry?: Partial<TelemetryConfig>
}
```

**对现有系统的影响：**

- 完全不侵入现有组件——通过 `IrisProvider` 的 provider 级配置
- 各框架适配器需要新增 `useTelemetry` 或等效 hook
- 插件可以通过 `onTeardown` 注册自己的遥测清理

### 方向 E（P3）：实时协作 UI 原语层

**定位：** 新增 `@iris-ui/core/collaboration` 包，提供感知/光标/冲突可视化的纯逻辑引擎。

**为什么需要（架构理由）：**
已有分析中 CRDT 同步层规划了"数据如何合并"，但没有规划"用户如何感知其他用户"。这是两个独立问题——数据可以完美合并，但用户界面仍需要知道"谁在哪里做什么"。协作 UI 原语是插件生态（共同编辑看板/表格/文档）的前提。

从架构角度，当前所有控制器（Selection、Expansion、DataSource）的 state 都不带 `userId`——这是一个架构约定。要支持协作，核心层的 state 接口需要兼容多用户视角但不强制修改现有单用户接口。方案是：协作感知作为可选层叠加在现有状态之上，通过 `mergeSlotProps` 等现有机制扩展 UI。

**核心挑战：**

1. **光标更新频率**：每个 mousemove 发送位置 → 每秒 30-60 次更新。需要 `requestAnimationFrame` 节流 + 增量 diff（只发送变化的位置）。

2. **大量用户同时在线**：20+ 光标 → 视觉混乱且性能瓶颈。需要用户分群（只显示附近用户/只显示同一视图的用户）、聚合（ClusterCursor 组件将邻近光标合并显示）。

3. **冲突可视化 vs 乐观更新**：CRDT 通常自动合并冲突，但用户仍然需要知道"我的更改和其他人的更改被合并了"。需要 `IrisConflictIndicator` 等轻量级 UI。

4. **私有区域声明**：密码字段/敏感数据不应显示远程光标。需要 `data-iris-no-collaboration` 属性或组件级声明。

**预期的架构变更：**

```
// @iris-ui/core/collaboration

interface PresenceState {
  users: Map<string, UserPresence>
}

interface UserPresence {
  userId: string
  displayName: string
  color: string
  status: 'online' | 'idle' | 'away' | 'offline'
  lastSeen: number
  currentView?: string
  cursor?: { x: number; y: number }
  selection?: { componentId: string; keys: string[] }
}

// 纯逻辑引擎（零框架依赖）
function createPresenceStore(roomId: string, userId: string): Store<PresenceState>
function createRemoteSelectionOverlay(base: SelectionModel): SelectionModelWithRemote
```

**对现有系统的影响：**

- 新包 `@iris-ui/collaboration`（或 core 子路径），不影响现有单用户组件
- 四框架适配器各需新建协作桥接（presence hook + cursor overlay 组件）
- 依赖 CRDT 同步层（已在规划中），本身无运行时依赖

---

## 3. 接口设计建议

### 3.1 关键模块的接口设计原则

**原则一：向下兼容是硬约束，不是软目标。**
五个方向的共同要求是"不改现有代码"。这要求所有新接口必须是增量扩展：

| 方向              | 向后兼容策略                                             |
| ----------------- | -------------------------------------------------------- |
| 表单向导分支      | `FormStep` 降级为 `FormStepNode` 特例，`shouldSkip` 可选 |
| CSS 渲染优化      | `containment` prop 默认为 `'none'`                       |
| Desktop OS AppBus | `AppManifest` 的 `capabilities` 可选，无通信契约 = 隔离  |
| 遥测 SDK          | 不传入 telemetry config = 完全静默                       |
| 协作 UI           | 新包/新子路径，单用户代码零改动                          |

**原则二：core 层定义契约，框架适配器按各自特性实现。**
这是 Iris 已有的模式，五个方向必须遵循。`AppBus` 的接口定义在 core，但 `BroadcastChannel` 的实现在各壳；`TelemetryEvent` 的类型在 core，但生命周期 hook 的注册在框架适配器。

**原则三：采样和节流是基础设施层的责任，不是消费方的责任。**
遥测的 `sampleRate` 和协作光标的 `throttle` 应该在 core 层的引擎内部处理，不要让每个组件去配置。这意味着 `TelemetrySink.push()` 内部做采样，`PresenceStore` 内部做节流。

### 3.2 是否需要新的抽象层

**需要新增的抽象层：**

| 抽象层                | 方向            | 理由                                                |
| --------------------- | --------------- | --------------------------------------------------- |
| `StepDAG<V>`          | 表单向导分支    | 步骤拓扑验证 + 后继计算是独立于 form store 的纯逻辑 |
| `ContainmentRegistry` | CSS 渲染优化    | 全局 containment 策略 + 组件覆盖的配置管理          |
| `CapabilityRegistry`  | Desktop OS 通信 | 能力注册 + 发现 + 冲突解决，独立于 AppBus 传输层    |
| `TelemetryPipeline`   | 遥测 SDK        | 采样 → 批处理 → 脱敏 → 分发的管道抽象               |
| `PresenceEngine`      | 协作 UI         | 光标聚合 + 节流 + 用户分群，独立于 UI 渲染          |

**不需要新增的抽象层：**

- 不需要新增「跨窗口状态同步」抽象层——`BroadcastChannel` 可以作为已有 `Store` 的 middleware 实现（已在其他分析中覆盖）
- 不需要新增「组件注册表」抽象层——插件系统已足够

### 3.3 如何保持向后兼容性

**类型层面的兼容策略：**

```
// 示例：FormStep 的类型兼容
// 现有代码：
interface FormStep<V> {
  id?: string
  fields: Key<V>[]
}

// 扩展后（同一接口，不新增类型）：
interface FormStep<V> {
  id?: string
  fields: Key<V>[]
  shouldSkip?: (values: FormValues<V>) => boolean | Promise<boolean>  // 新增可选
  dependsOn?: string[]                                                   // 新增可选
}
```

**工厂函数层面的兼容策略：**

```
// 示例：createStepNavigation 签名保持，新增 factory
// 现有（不变）：
createStepNavigation<V>(steps, getCurrentStep, setCurrentStep, validateFields, setFieldsTouched)
// → steps: FormStep<V>[] 继续保持

// 新增（DAG 版本）：
createStepDAGNavigation<V>(steps: FormStepNode<V>[], ...)
// → 内部调用 createStepNavigation，仅增强导航逻辑
```

**Provider 层面的兼容策略：**

```
// 示例：IrisProvider 配置扩展
// 现有（不变）：
<IrisProvider plugins={plugins}>
  <App />
</IrisProvider>

// 扩展（全部可选）：
<IrisProvider
  plugins={plugins}
  defaultContainment="content"       // 可选新增
  telemetry={{ enabled: true, sampleRate: 0.01, sink }}  // 可选新增
>
  <App />
</IrisProvider>
```

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈或框架

| 方向              | 需要引入 | 可选引入                                          | 不需要                  |
| ----------------- | -------- | ------------------------------------------------- | ----------------------- |
| 表单向导分支      | 无       | `graphlib` 或 `topological-sort`（DAG 验证）      | —                       |
| CSS 渲染优化      | 无       | 无                                                | —                       |
| Desktop OS AppBus | 无       | `BroadcastChannel` polyfill（旧浏览器支持）       | —                       |
| 遥测 SDK          | 无       | 无（纯 core 逻辑）                                | —                       |
| 协作 UI           | 无       | `y-partykit` / `y-websocket`（网络传输，非 core） | CRDT 本身（已在规划中） |

**结论：不需要引入新的框架或构建工具。** 所有五个方向都可以在现有 pnpm/turbo/tsup/svelte-package 工具链中实现。

### 4.2 第三方依赖的评估标准

对于可能需要引入的小型第三方库（如表单分支的 DAG 验证），评估标准：

| 标准            | 阈值           | 说明                                 |
| --------------- | -------------- | ------------------------------------ |
| 包体积          | < 5KB min+gzip | 必须轻量，不能影响 core 的 size 预算 |
| TypeScript 类型 | 一等支持       | 必须是 ts 编写或带 `.d.ts`           |
| 框架无关        | 必选           | 不能依赖 React/Vue/Solid/Svelte      |
| 许可证兼容      | 必选           | MIT/Apache-2.0/BSD                   |
| 无 DOM 依赖     | 必选           | 在 Node/SSR 环境可运行               |
| 不再无维护      | 可选但加分     | 近 1 年有 commits                    |

**具体建议：**

```
# DAG 验证（表单分支）——如需要，推荐
- tiny-toposort (1KB, MIT, 纯函数, 无依赖)
- 或自建 ~50 行实现（因为只需要基本的拓扑排序和循环检测）

# BroadcastChannel（Desktop OS）——不需要额外依赖
- 现代浏览器全部支持 BroadcastChannel
- Node 18+ 支持（SSR 场景）
- 旧浏览器：可直接引用 MDN polyfill（~2KB）

# 遥测批处理——不需要额外依赖
- requestIdleCallback + 自建队列
- 或 navigator.sendBeacon 用于页面卸载时的 flush
```

### 4.3 自建 vs 采购的决策依据

| 候选方案             | 自建理由                                                                     | 采购/引入理由                     | 决策                            |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| DAG 步骤验证         | ~50行纯函数，核心逻辑，自建可精确控制错误信息格式                            | 略                                | **自建**                        |
| 遥测 SDK             | 接口需要与 IrisProvider 深度集成，通用 SDK（Sentry/PostHog）不能理解组件语义 | 数据可视化/告警链路可复用现有工具 | **自建 SDK 层 + 适配通用后端**  |
| 协作 UI              | 必须与 Iris 的 Selection/Expansion/DataSource 模型对齐                       | Yjs 社区有光标插件但框架不匹配    | **自建，底层网络可接 Yjs**      |
| Desktop OS AppBus    | 必须与 AppManifest + 权限模型集成                                            | 无通用 Web 应用通信库             | **自建**                        |
| CSS Containment 配置 | 纯声明式配置，无运行时                                                       | 无                                | **自建（类型定义 + 样式注入）** |

---

## 5. 实施路线图

### 5.1 优先级排序（重新校准）

输入文档的建议优先级整体合理，但基于架构分析，建议做以下微调：

| 方向              | 输入文档 | 架构分析建议        | 调整理由                                                                               |
| ----------------- | -------- | ------------------- | -------------------------------------------------------------------------------------- |
| 表单向导分支      | **P1**   | **P1（不变）**      | 低工程成本（~150 行 core），零断变，立即可为。form engine 完成度关键缺口               |
| CSS 渲染优化      | **P1**   | **P1（不变）**      | 但范围建议缩小为「Layer 3 布局组件 + ProTable」先行覆盖，Layer 1 原语放缓              |
| Desktop OS AppBus | **P2**   | **P2（提至 P1.5）** | 架构分析认为这是 Desktop OS 从"demo"到"真实壳"的关键一跳，建议在 Desktop OS 发布前完成 |
| 协作 UI           | **P3**   | **P3（不变）**      | 依赖 CRDT 同步层前置工作，工程成本高且需要多组件 + 多框架桥接                          |
| 遥测 SDK          | **P3**   | **P3（不变）**      | 价值高但非紧急；建议在 plugin-market 启动原型时配套推进                                |

### 5.2 阶段划分和里程碑

```
Phase 0（已就绪）—— 基础架构
├── 完成五个方向的需求确认（本文档）
├── 确定每个方向的接口设计 RFC
└── 建立新子路径/新包的目录结构和构建配置

Phase 1（1-2 周）—— 表单向导分支 + CSS 渲染优化首波
├── 1a: FormStep 类型扩展（shouldSkip + dependsOn 可选字段）
│   ├── 新增 createStepDAG 循环检测函数
│   ├── 增强 createStepNavigation 支持条件跳过
│   ├── 测试覆盖：线性兼容、分支流程、循环阻断、异步 shouldSkip
│   └── 里程碑 ✅：现有线性步骤测试全部通过 + 新增分支测试
├── 1b: ComponentContainment 类型定义
│   ├── Layer 3 布局组件（IrisSidebarLayout、IrisDashboardGrid、IrisAdminLayout）添加 containment
│   ├── IrisTable + IrisVirtualScroll 添加 content-visibility: auto
│   ├── IrisProvider 新增 defaultContainment prop
│   └── 里程碑 ✅：Dashboard 和 ProTable 场景的渲染性能基准建立 + 对比数据

Phase 2（2-3 周）—— Desktop OS 应用间通信
├── 2a: core 层 AppBus 接口定义 + CapabilityRegistry
│   ├── AppBus.request / broadcast / onRequest / onBroadcast
│   ├── CapabilityRegistry.register / resolve / unregister
│   ├── 类型扩展：AppManifest.capabilities
│   └── 里程碑 ✅：AppBus 接口类型检查 + 纯逻辑单元测试
├── 2b: React Desktop OS 壳集成（作为首波示范）
│   ├── BroadcastChannel 传输层实现
│   ├── 内置应用逐步添加能力宣告（Files → .csv/.json、Calendar → events）
│   ├── "用…打开"应用选择器 UI
│   └── 里程碑 ✅：Files 中点击 .csv → Data 应用打开

Phase 3（3-4 周）—— 协作 UI 原语原型 + 遥测 SDK
├── 3a: @iris-ui/core/collaboration 初始包
│   ├── createPresenceStore + UserPresence 类型
│   ├── 光标节流（requestAnimationFrame-based throttle）
│   ├── 单框架示范（React）的 IrisCursorOverlay 组件
│   └── 里程碑 ✅：两个浏览器标签页同步光标位置
├── 3b: Telemetry 配置点 + TelemetrySink 接口
│   ├── IrisProvider 新增 telemetry prop
│   ├── 采样/批处理/脱敏 Pipeline
│   ├── React 适配器的生命周期 hook 桥接
│   └── 里程碑 ✅：IrisDevTools 原型接收实时遥测事件流
```

### 5.3 风险点和缓解策略

| 风险                                                                | 方向            | 概率   | 影响   | 缓解策略                                                                                                                                                                               |
| ------------------------------------------------------------------- | --------------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contain: style` 阻断 CSS 变量继承链，导致组件样式丢失              | CSS 渲染优化    | **高** | 严重   | 1. 在 containment 根节点上显式声明 `--iris-*` fallback；2. 工具函数 `computeRequiredTokens(componentName)` 自动收集所需变量；3. 先在 `IrisCard` 等简单组件验证，再推广                 |
| `shouldSkip` 异步求值导致步骤闪烁（用户看到步骤出现然后消失）       | 表单向导分支    | 中     | 中     | 1. `shouldSkip` 支持返回 `{ skip: boolean, loading: boolean }` 联合状态；2. 步骤渲染器根据 `loading` 显示骨架屏                                                                        |
| `AppBus.request` 在目标应用未挂载时超时                             | Desktop OS 通信 | 中     | 中     | 1. 引入超时参数 `timeout?: number`（默认 5000ms）；2. 目标应用注册时声明 `lazyLoad: boolean`，支持自动挂载                                                                             |
| 协作光标 30fps 更新 + 20 用户同时在线 → 性能退化                    | 协作 UI         | **高** | 严重   | 1. 服务端聚合（只广播附近用户的光标）；2. 客户端 `requestAnimationFrame` 节流 + 增量 diff；3. 用户分群（同一视图的 > 5 人时聚合光标为 `ClusterCursor`）                                |
| 遥测 SDK 的 `push` 调用在高频组件（IrisTable 行渲染）中产生性能压力 | 遥测 SDK        | 中     | 中     | 1. 采样在 `push` 内部立即执行，被采样掉的调用不分配事件对象；2. 批量 flush 使用 `requestIdleCallback`；3. `type: 'update'` 事件在组件级别聚合（只发"本次 batch 中组件 X 更新了 N 次"） |
| Desktop OS 四个壳的 AppBus 实现不一致                               | Desktop OS 通信 | 中     | **高** | 1. core 层定义 `AppBus` 接口 + 测试套件（`describe('AppBus contract')`）；2. 各壳实现必须通过相同测试集；3. code review 时交叉检查                                                     |

---

## 总结

这五个方向覆盖了 Iris UI 从「单人 UI 库」向「完整 UI 基础设施」演进所需的五个不同维度：

| 维度               | 方向                    | 架构提升                                                 |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| **表单完成度**     | 表单向导分支（P1）      | 从线性到图模型，从 demo-ready 到 production-ready        |
| **渲染性能治理**   | CSS 渲染优化（P1）      | CSS 变量传播链从 O(n) 到 O(1)，突破 token 系统的规模限制 |
| **应用生态成熟度** | Desktop OS AppBus（P2） | 从窗口管理器到真实操作系统的关键一跳                     |
| **生态可观测性**   | 遥测 SDK（P3）          | 从 CI 盲测到生产可见的反馈闭环                           |
| **多用户协作**     | 协作 UI 原语（P3）      | 从单用户到多用户感知，插件生态的乘数效应                 |

**架构层面的核心建议**是：P1 的两个方向（表单分支 + CSS containment）应该同时推进，因为它们在架构上互补——一个在逻辑层（步骤图的 DAG 模型），一个在渲染层（CSS containment 协议）。两者都在 core 层增加约 200-400 行纯逻辑，都不改动现有组件，都可以在两周内交付。配合 `pnpm gen:manifest` 的自动化文档生成，新能力会立即在 `manifest.json` / `llms.txt` 中体现——这是 AI 原生 API 文化的直接落地。
