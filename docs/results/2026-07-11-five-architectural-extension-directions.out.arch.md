现在，我已掌握全局视图，以下是我的架构分析。

---

# Iris UI 架构分析报告

**分析日期**：2026-07-12
**分析范围**：`@iris-ui/*` 全库 25 包 × 4 框架适配器
**输入基准**：2026-07-12 全局扫描「5 个未覆盖扩展方向」文档及源码验证结果
**分析角色**：架构师（聚焦跨层系统级设计）

---

## 1. 架构评估

### 1.1 现有架构的核心优势

Iris UI 的架构决策在同类项目中处于领先水平，值得明确的肯定：

| 优势                         | 评价                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **core 下沉原则贯彻彻底**    | 所有控制器、引擎、纯材料集中在 `@iris-ui/core`，四个适配器是薄桥。这是四框架 149 组件对齐的根本保障                       |
| **Store 设计简洁但语义丰富** | `createStore` + `batch` + `subscribeWith` + `derived` 构成了一个类似 Zustand + Jotai 的组合原语集，体积极小但表达能力足够 |
| **插件契约清晰**             | `IrisPlugin` 接口只有 `install` + `destroy` + `dependsOn` 三个核心点，降低了第三方开发门槛                                |
| **Token 主题体系完整**       | 从 token 定义到 CSS 变量映射到皮肤继承到 FOUC 防护，形成完整闭环                                                          |
| **渐进式复杂度**             | Button 独立可用，全栈 admin shell 按需接入，符合好架构的「分层面纱」原则                                                  |

### 1.2 当前架构的局限性

扫描文档揭示的 5 个方向，本质上是同一组**架构债的不同投影面**：

```
┌──────────────────────────────────────────────────────────────┐
│                    统 一 缺 失 的 抽 象 层                      │
│                                                              │
│  ① 浮层协调层  ←  DOM 全息世界的「窗口管理器」缺失              │
│  ② 不变式测试  ←  组件契约的形式化验证缺失                      │
│  ③ 插件通信    ←  跨模块协作的基础设施缺失                      │
│  ④ Store 版本化 ← 数据 Schema 演化的治理缺失                   │
│  ⑤ 渲染调度    ←  跨帧/跨 tick 的资源编排缺失                   │
└──────────────────────────────────────────────────────────────┘
```

这 5 个缺失共享同一个根因：**核心抽象层定义了「组件是什么」和「组件能做什么」，但尚未定义「组件在系统中如何共处」**。这恰是架构从「组件集合」走向「系统平台」的分水岭。

### 1.3 关键设计决策评估

| 决策                                   | 评估                        | 建议                     |
| -------------------------------------- | --------------------------- | ------------------------ |
| 所有浮层组件独立 Portal + 独立 z-index | ⚠️ 早期合理，当前已是技术债 | 引入 Layer Manager       |
| createStore 无版本号通用模式           | ✅ 当前合理（未发布 v1.0）  | 发布前必须补 migration   |
| plugin.ts 无事件机制                   | ✅ 13 个插件零交叉时合理    | 插件间出现交叉需求时补   |
| useBodyScrollLock 模块级单例           | ❌ 跨 IrisProvider 实例泄漏 | 改为 IrisProvider 实例级 |
| 无共享 useRaf/useDebounce              | ⚠️ 可接受（小团队手写可行） | 团队扩大前补即可         |

### 1.4 架构债务清单

**技术债**（阻碍当前开发效率或引入 bug 风险）：

1. **`useBodyScrollLock` 模块级单例锁计数器**：`packages/react/src/modal-utils/useBodyScrollLock.ts:3` — 嵌套 `IrisProvider` 时 Dialog A 关闭可能解锁 Dialog B 的滚动锁。应在方向①中一并修复。
2. **8 个硬编码 z-index 值**：无法通过插件或皮肤覆盖层级，嵌套 Dialog + Popover + Drawer 的场景必有 bug。影响 Dialog/Drawer/Popover/Tooltip/Toast/Menu/Dropdown 共 7 组件类型 × 4 框架 = 28 个适配器文件。
3. **Drawer Escape 用 `preventDefault` 而非 `stopPropagation`**：扫文档时已发现的边缘差异。意味着 Dialog 内的 Drawer 按 Escape 后，父级 Dialog 仍能收到 keydown 事件。虽然是微妙的语义差异，但涉及 Escape 传播仲裁的基础假设。

**架构债**（阻碍系统演化方向）：

1. **零 Store 迁移路径**：25+ createStore 实例一旦发布 v1.0，State shape 即固化。profile 的 `PROFILE_VERSION=1` 和注释 `// Version migrations go here` 是"承认意图但未投资"的清晰信号。
2. **零组合约束检查**：92 个 Context Provider（React 端）意味着组合错误面巨大——`<IrisDialogContent>` 放在 `<IrisPopover>` 内编译通过、运行静默失败。AI 生成的代码尤其容易踩这个坑。
3. **零插件间通信协议**：13 个插件无交叉引用，但跨插件需求已经出现（editor 保存后 → notifications 弹出）。没有基础设施就意味着开发者会在 `window.__iris_plugin_hack__` 上自行方案。

---

## 2. 扩展方向分析

### 2.1 方向一（P0）：浮层协调层管理器 — Floating UI Layer Manager

**为什么需要（业务 + 技术价值）**

- **业务价值**：复合浮层（Dialog 内嵌 Popover + Select + Tooltip）是企业应用常态。当前硬编码 z-index 在这些组合中必然错误：MenuSub 在 Dialog backdrop 下不可见（1001 < 1200）、Drawer 内 Popover 被遮挡（1000 < 1200）、Toast 遮挡 Dialog 关闭按钮（1400 > 1200）。每个 bug 都是"看起来低级"的缺陷，直接损害组件库的专业形象。
- **技术价值**：将浮层的公共职责（z-index 分配、Portal 目标、Escape 传播、focus trap 栈、scroll lock）从每个组件中提取到一个共享的 `LayerManager`。这不仅是复用，更是**架构收敛**——浮层从"各自为政的独立组件"变成"一个统一系统下的节点"。

**核心挑战与技术难点**

1. **Escape 传播仲裁模型**：关键是**内层优先消费**。用户在一个三层嵌套 Dialog 中按 Escape——最内层关闭，焦点回到中层，再按 Escape 关闭中层，再按关闭外层。当前没有一个组件能做到这一点，因为每个组件独立监听 `keydown` 且互相调用 `stopPropagation`。需要定义清晰的 **Escape 栈**：每个打开的浮层入栈，Escape 只在栈顶消费。
2. **z-index 动态分配 vs 静态层级**：当前使用静态层级（1000-1400）。Layer Manager 需要引入**动态层级增量**——同类型的浮层（如两个 Dialog 同时打开）需要递增 z-index（1200, 1201, 1202...），但 `Dialog > Popover` 的关系必须保持（Popover 的基准 1000 + 增量 < Dialog 的基准 1200 + 增量？需要精确定义基准 + 增量的关系）。
3. **跨框架一致性**：React 的 `createPortal` 需要目标 DOM 节点存在于 document 中；Vue 的 `Teleport` 是声明式的；Solid 的 `Portal` 组件是渲染时解析的；Svelte 的 `{@html}` + `portal` 是另一个机制。Layer Manager 需要**四端 Portal 抽象**，core 定义行为，适配器实现渲染。

**预期的架构变更**

```mermaid
graph TD
    A[core/createLayerManager] --> B[状态：z-index 栈 / Escape 栈 / 滚动锁]
    A --> C[方法：open / close / raise / onEscape]
    D[LayerProvider] --> A
    D --> E[Portal 根节点管理]
    F[useFloatingLayer] --> D
    F --> G[返回 { zIndex, portalTarget, onEscape }]
    G --> H[各浮层组件消费]
```

**变更层次**：

- `@iris-ui/core` 新增 `createLayerManager`（约 80 行——状态机很轻，核心是栈管理）
- 四个适配器各新增 `IrisLayerProvider`（约 40 行/个——只渲染 Provider Context + 管理 Portal 根节点）
- 每个浮层组件从「手写 z-index + Portal + Escape」改为消费 `useFloatingLayer`
- 每个浮层组件新增可选 `layer` prop

**向后兼容策略**：

- 当 `IrisLayerProvider` 不存在时（未包裹 provider），各组件回退到当前行为（硬编码 z-index + 直接 createPortal）。`IrisProvider` 默认包裹 `IrisLayerProvider`。
- 用户可通过 `layer` prop 覆盖某个特定组件的层级语义
- `IrisProvider` 的 `portalTarget` 默认为 `document.body`，可通过 option 配置

**方案对比**：

| 方案                                                                                                      | 复杂度 | 优点                          | 缺点                                 |
| --------------------------------------------------------------------------------------------------------- | ------ | ----------------------------- | ------------------------------------ |
| A. 最小方案：只在 core 提供 `createLayerManager` + 每个适配器手写 hook                                    | 低     | 改动最小，逐步适配            | 适配器重复逻辑，四端不完全一致       |
| B. **推荐方案**：core 提供 `createLayerManager` + 四个适配器提供 `IrisLayerProvider` + `useFloatingLayer` | 中     | 四端完全一致，provider 可配置 | 需同步修改所有浮层组件               |
| C. 激进方案：将 Portal 管理完全下沉到 core（core 持有 DOM 引用）                                          | 高     | 最大复用                      | core 引入 DOM 依赖，违反框架无关原则 |

**推荐 B**，因为这是「core 保持框架无关」和「适配器消除重复」的最优平衡点。

---

### 2.2 方向二（P0）：组件不变式测试基础设施

**为什么需要**

- **安全网**：596 组件产物（149 × 4）在没有不变式测试的情况下，每个组件的无障碍合约（WAI-ARIA）和组合约束都可能被一次 PR 无声破坏。合同测试覆盖「正确路径」，不变式测试覆盖「任何路径」——两者互补。
- **AI Guardrails**：当 AI 生成 `<IrisPopover><IrisDialogContent>...</IrisDialogContent></IrisPopover>`，不变式测试能在 CI 中捕获这种非法组合。这是 AI 原生组件库（正如 `AGENTS.md` 声明的）应有的质量基础设施。
- **插件合规验证**：第三方插件的组件应通过与核心组件相同的不变式集验证。

**核心挑战**

1. **四框架同一套断言**：Assert `aria-modal="true"` 在 React 中需要用 `screen.getByRole('dialog')`，在 Vue 中需要 `wrapper.find('[role="dialog"]')`，在 Solid/Svelte 中各有不同。不变式定义需要**框架无关的 render 抽象层**。
2. **组合约束的静态 vs 动态检查边界**：`IrisSelect > IrisMenuCheckboxItem` 这种非法组合，在运行时通过 Context 检查是最可靠的（`useContext(SelectContext)` 在 `MenuCheckboxItem` 中 throw），但运行时错误在 SSR 中可能是灾难。需要区分 `__DEV__` 下的 warning 和测试中的 throw。
3. **不变式的可组合性**：`IrisDialogContent` 有 10 个不变式（aria-modal、aria-labelledby、focus trap、scroll lock、Escape close...）。这些不变式需要可被 `IrisDrawerContent` 继承和覆盖。

**建议方案**

```
@iris-ui/core/invariants/
  render-interface.ts   ← 定义 RenderFn 抽象（四框架各自实现）
  invariants/
    aria-modal.ts       ← 共享断言逻辑
    scroll-lock.ts
    escape-dismiss.ts
    ...
  presets/
    dialog.ts           ← DialogContent 的不变式组合
    drawer.ts
    popover.ts
    ...
```

**每个不变式的格式**：

```ts
interface ComponentInvariant<TProps = unknown> {
  name: string // 如 "dialog-opened-aria-modal"
  description: string // 人读描述
  frameworks: ('all' | 'react' | 'vue' | 'solid' | 'svelte')[]
  // render 是框架桥接器注入的函数
  test: (render: RenderFn) => Promise<void> | void
}
```

**关键在于 `RenderFn` 的抽象**：

```ts
interface RenderFn {
  // 渲染组件，返回元素引用（跨框架一致的基础查询方法）
  render(component: ComponentDefinition, props: Record<string, unknown>): RenderResult
  // 查询：通过 role / text / testid
  findByRole(role: string): Element | null
  findByText(text: string): Element | null
  // 检查 body scroll 状态等框架无关断言
}
```

四个适配器各自实现 `RenderFn`，但不变式本身的断言逻辑是框架无关的。

---

### 2.3 方向三（P1）：跨插件类型安全通信与版本契约

**为什么需要**

- **生态裂变临界点**：13 个插件已经到达「无通信」可运行的上限。一旦插件之间出现 `pluginA 需要读取 pluginB 的状态` 的需求，没有基础设施就意味着 `window.__iris__` 全局变量 hack。这个临界点可能在 15-20 个插件时到来。
- **MCP 对齐**：`commands.ts` 已经有 `toMcpTools()` 将内部能力投射为外部 MCP 工具。插件通信协议可以复用同一理念：插件能力 = 可投射为 MCP tools 的声明式合约。

**核心挑战**

1. **类型安全跨插件 Store 访问**：插件 A 注册 `store('editor', factory)` 返回 `{ text: string }`，插件 B 用 `usePluginStore('editor')` 得到 `unknown`，需要 `as EditorStore`。类型安全要求 `registerStore` 保留类型信息。但 TypeScript 不支持运行时类型反射，所以要么迫使用户手动 `as`，要么引入运行时 schema 验证（JSON Schema / Zod）。
2. **循环依赖检测**：`dependsOn` 目前有环检测（DAG 拓扑排序）。事件通道类似——如果插件 A `on('save', cb)` 和插件 B `on('render', cb)` 互相触发，就是无限循环。需要事件循环检测 + 最大重入深度。
3. **版本契约的粒度**：是语义化版本（semver）还是有更细粒度的 API 级别版本？建议 **semver + store schema hash**——每次 `registerStore` 生成 store shape 的 hash，在 dev 中检测 hash 是否匹配。

**接口设计建议**

```ts
// core 扩展
interface PluginRegistry {
  // 现有
  registerStore(key: string, factory: () => unknown): void
  // 新增——类型安全通道
  registerChannel<TSchema extends Record<string, unknown>>(
    name: string,
    schema?: TSchema,
  ): Channel<TSchema>
  // 新增——能力声明
  registerCapability(spec: CapabilitySpec): void
}

interface Channel<T extends Record<string, unknown>> {
  emit(event: string, payload?: unknown): void
  on(event: string, handler: (payload: unknown) => void): () => void
  // 类型安全 emit——TSchema 定义事件名 → payload 的映射
}

interface CapabilitySpec {
  provides: string // 如 'document-save'
  version: string // semver
  // 插件 A 声明自己提供 document-save v1.0
}
```

**关键权衡**：

| 决策     | 选项 A（轻量）    | 选项 B（推荐）                                  | 选项 C（重量）              |
| -------- | ----------------- | ----------------------------------------------- | --------------------------- |
| 类型安全 | 用户 `as` 转换    | registerStore 接受泛型工厂 + schema（dev 验证） | Zod schema + 编译时类型生成 |
| 事件总线 | 简单 EventEmitter | Channel 对象（emit/on 配对，自动清理）          | Observable + RxJS           |
| 版本契约 | semver 声明       | semver + store schema hash                      | 全量 JSON Schema            |
| 实现成本 | ~1 人天           | ~3 人天                                         | ~10 人天                    |

**推荐 B**——在类型安全上不妥协（这是第三方开发者信任的基础），但不在事件总线上过度工程化。

---

### 2.4 方向四（P1）：Store 状态 Schema 版本化与迁移协议

**为什么需要**

- **发布即承诺**：25+ `createStore` 实例在 npm publish 的瞬间，其 state shape 就成为公共 API。没有 migration 协议，任何 shape 变更只能通过破坏性 major 版本实现——这意味着要么不升级，要么数据丢失。
- **Profile 是入口点**：`packages/core/src/profile.ts:243` 的注释 `// Version migrations go here` 是清晰的未完成信号。profile 无法迁移 = 整个持久化体系无法演化。

**核心挑战**

1. **迁移链的有序性**：`{ from: 1, to: 2, fn }` → `{ from: 2, to: 3, fn }` → ... 用户可能从 v1 直接升级到 v3，需要链式执行（v1→v2→v3）。不能跳跃。
2. **嵌套 Store 迁移**：`createDataSource` 内嵌 `selection` store。如果 `selection` 的 shape 变了，`data-source` 的快照也需要迁移。需要组合迁移支持。
3. **持久化 vs 非持久化**：不是所有 store 都需要持久化。migration 只应在持久化 store 上启用。需要区分。

**接口设计**

```ts
// 高阶函数包装 createStore
function createStoreWithVersion<T extends { version: number }>(
  initial: T,
  options: {
    version: number
    migrations: Array<{ from: number; to: number; migrate: (old: unknown) => T }>
  },
): Store<T>

// 使用
const profileStore = createStoreWithVersion(
  { version: PROFILE_VERSION, ...defaults },
  {
    version: PROFILE_VERSION,
    migrations: [
      { from: 1, to: 2, migrate: (old) => ({ ...(old as any), prefs: {}, version: 2 }) },
      { from: 2, to: 3, migrate: (old) => ({ ...(old as any), version: 3 }) },
    ],
  },
)
```

**核心设计原则**：

- 迁移是纯函数（`(old: unknown) => T`），不依赖任何外部状态
- 迁移链是线性有序的（`from` → `to`，不允许分支）
- 迁移在 `hydrate`（从持久化加载）时自动执行
- 非持久化 store 不要求版本号

---

### 2.5 方向五（P2）：渲染性能调度基础设施

**为什么需要**

- **非对称影响**：缺失调度在普通使用中不可感，但在大数据量场景（5000+ options Combobox 连续过滤、1000+ rows Table resize）直接导致掉帧。组件库的质量应由**边界性能**而非常规性能定义。
- **DRY 原则**：当前 4 个手写 raf 各有不同的清理逻辑、SSR 守卫、测试 mock。每次新场景都要重复「raf + cleanup + SSR guard + test mock」——这应是一个共享 hook 的职责。

**核心挑战**

1. **跨框架 Bridge**：`requestAnimationFrame` 是 Web API，但每个框架有自己的 tick/effect 系统。React 需要 `useEffect` + raf；Vue 有 `nextTick`（microtask vs raf 的 macrotask）；Svelte 5 的 `$effect` + `tick` 有 rune 时序；Solid 的 `createEffect` 同步执行。调度原语必须是**框架感知的**。
2. **SSR 安全**：`requestAnimationFrame`、`requestIdleCallback` 在 Node.js 中不存在。所有调度原语必须是 SSR-safe（返回 no-op）。
3. **测试 mock 可注入**：当前 jsdom 中的 `raf` 行为与真实浏览器不同。调度器需要可注入的 `Scheduler` 接口（类似 `createMachine` 的 `Scheduler` 模式）。

**架构变更**

```
@iris-ui/core
  createScheduler(scheduler?: Scheduler) → { raf, idle, debounce, throttle }
  Scheduler 接口 → 可注入（生产 = 真实 API，测试 = mock）

@iris-ui/react
  useRaf(callback, deps)    — 自动 cleanup + SSR guard
  useDebounce(value, ms)    — 自动 cleanup
  useThrottle(value, ms)    — 自动 cleanup

@iris-ui/vue (composables 同理)
  useRaf / useDebounce / useThrottle
```

**框架桥接策略**：

| 框架   | raf                  | debounce                    | 实现策略        |
| ------ | -------------------- | --------------------------- | --------------- |
| React  | `useEffect` + raf    | `useRef` + setTimeout       | 标准 hook       |
| Vue    | `watch` + raf        | `ref` + `watchDebounced`    | 标准 composable |
| Solid  | `createEffect` + raf | `createSignal` + setTimeout | 标准 primitive  |
| Svelte | `$effect` + raf      | `$state` + `setTimeout`     | rune-based      |

核心 `createScheduler` 在 core 中定义接口，适配器提供框架绑定。

---

## 3. 接口设计建议

### 3.1 设计原则

基于现有架构的阅读，我总结以下接口设计原则：

**原则 1：core 保持零框架依赖 + 纯函数/纯数据**

- 现状已满足 ✔ —— 不可妥协
- 任何引入 `Promise`（异步时序）或 `DOM API` 的抽象必须三思。例如方向①的 `createLayerManager` 不能持有 DOM 引用。

**原则 2：组合优于继承，提供优于配置**

- `useFloatingLayer` 返回 `{ zIndex, portalTarget, onEscape }` —— 消费者可以决定如何使用这些值
- `IrisLayerProvider` 仅提供 Context，不渲染任何 DOM

**原则 3：渐进式 opt-in，非强制迁移**

- 用户不包裹 `IrisLayerProvider` → 组件回退到当前行为
- 用户不调用 `useRaf` → 继续手写 raf
- 插件不注册 channel → 不受影响

**原则 4：所有 hook/composable 自动清理**

- 不自动清理的 hook 是 bug 来源。`useRaf` 必须在组件卸载时取消 raf callback。`Channel.on` 必须在插件 teardown 时取消注册。

### 3.2 是否需要新的抽象层

| 方向           | 新的抽象层                            | 理由                                    |
| -------------- | ------------------------------------- | --------------------------------------- |
| ① 浮层协调     | `LayerManager` + `LayerProvider`      | ✅ 必须。当前零抽象，每个组件手写       |
| ② 不变式测试   | `RenderFn` 抽象层                     | ✅ 必须。四框架共用断言逻辑             |
| ③ 插件通信     | `Channel` + `CapabilitySpec`          | ✅ 必须。零现有抽象                     |
| ④ Store 版本化 | `createStoreWithVersion`              | ✅ 推荐。包装而非替换现有 `createStore` |
| ⑤ 渲染调度     | `Scheduler` 接口 + hook/composable 层 | ✅ 推荐。可注入模式                     |

### 3.3 向后兼容策略

**原则**：现有用户代码零改动。

| 方向         | 兼容策略                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 浮层协调     | `IrisProvider` 默认包裹 `IrisLayerProvider`，用户无感知。未包裹时组件回退到当前行为             |
| 不变式测试   | 纯测试基础设施，零运行时代码，无兼容问题                                                        |
| 插件通信     | 现有 `registerStore`/`registerTokens`/`registerMessages` 签名不变。`registerChannel` 是新增方法 |
| Store 版本化 | `createStore` 不变，`createStoreWithVersion` 是新增函数。现有 store 迁移是非强制性的            |
| 渲染调度     | 新增 hook/composable，不修改现有组件。逐步迁移高频组件                                          |

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

| 方向         | 需要的新依赖   | 理由                                                                          |
| ------------ | -------------- | ----------------------------------------------------------------------------- |
| 浮层协调     | **无新依赖**   | `createLayerManager` 可以用纯 stack 实现，无需第三方                          |
| 不变式测试   | **无新依赖**   | 断言逻辑是纯 TS，测试框架已有 vitest                                          |
| 插件通信     | **视方案而定** | 轻量方案（EventEmitter）无依赖；重量方案（Zod 验证）需引入 `zod` 或 `valibot` |
| Store 版本化 | **无新依赖**   | migration 链是 `(old) => new` 纯函数映射                                      |
| 渲染调度     | **无新依赖**   | `requestAnimationFrame` + `setTimeout` 是 Web API，只需包装                   |

**建议**：对于方向③中的事件通道，使用**无依赖 EventEmitter 实现**（约 30 行）。SSR 安全的 EventEmitter 可以手写。只有需要运行时 schema 验证时才引入 Zod——且应为**可选依赖**（仅在 dev 中启用）。

### 4.2 第三方依赖评估标准

引入任何新依赖前，应问：

1. **是否必须？** 这个逻辑能否用 30 行手写代码实现？如果能，手写优于引入依赖。
2. **SSR 安全吗？** 依赖是否使用了 `window`/`document`/`requestAnimationFrame` 等浏览器 API？如果是，能否 safe-guard？
3. **包体积代价？** 依赖的 gzip 大小，是否 tree-shakable？
4. **框架锁定？** 依赖是否绑定了特定框架（如 React hooks）？如果是，不能在 core 中使用。

### 4.3 自建 vs 采购决策

对于这 5 个方向，**全部建议自建**：

| 方向         | 为什么不采购                                       |
| ------------ | -------------------------------------------------- |
| 浮层协调     | 市场无同类产品（这是 Iris 的差异化机会）           |
| 不变式测试   | 需要与 Iris 的四框架模式深度集成                   |
| 插件通信     | EventEmitter 是标准模式，不需要库                  |
| Store 版本化 | 需要与 createStore 的 batch/subscribe 协议深度集成 |
| 渲染调度     | 框架绑定的 hook + core 的 scheduler 接口           |

**唯一的例外**：如果方向③采用运行时 schema 验证，可考虑引入 `valibot`（比 Zod 更轻量、tree-shakable 更好）。即使如此，也应为**可选依赖**。

---

## 5. 实施路线图

### 5.1 优先级排序

```
P0（必须，发布前完成）
  ├── 浮层协调层管理器  ← 复合组件场景有确认 bug
  └── 不变式测试       ← 596 组件产品的质量安全网

P1（发布后 1-2 个月）
  ├── 跨插件通信       ← 插件数 ~15-20 时会触达临界点
  └── Store 版本化     ← profile 是阻塞项，其他 store 可先发布再补

P2（持续优化）
  └── 渲染调度         ← 非功能阻塞，但边界性能影响感知
```

### 5.2 阶段划分与里程碑

**Phase 1（P0 — 6-8 周）**

```
里程碑                   | 依赖                    | 验收标准
M1: LayerManager 定义    | core 新增 createLayerManager | 纯函数测试通过（z-index 栈 / Escape 栈 / 滚动锁栈）
M2: React 适配          | M1                     | LayerProvider + useFloatingLayer 在 React 中可用
M3: Vue/Solid/Svelte 适配| M1                     | 三框架适配器同步就绪
M4: 浮层组件迁移         | M2 + M3                | Dialog/Drawer/Popover/Menu/Tooltip/Dropdown/Toast 7 组件迁移完成
M5: 集成测试             | M4                     | 3 层嵌套 Dialog-Escape 测试 + Dialog>Popover 复合场景测试
M6: 不变式框架定义       | 无                     | RenderFn 接口 + 5 个核心不变式定义
M7: 四框架不变式实现      | M6                     | 4 框架 x 5 不变式 = 20 个 CI 测试用例
M8: Phase 1 验收          | M5 + M7               | 全部验收用例通过
```

**Phase 2（P1 — 4-6 周）**

```
里程碑                   | 依赖                    | 验收标准
M9: PluginChannel 定义   | 无                     | registerChannel + emit/on/off 实现
M10: 版本冲突检测         | 无                     | runPlugins 中 semver 冲突检测
M11: createStoreWithVersion | 无                  | migration 链 + hydrate 测试
M12: profile 迁移实现     | M11                    | PROFILE_VERSION 1→2 迁移链
M13: 演示插件通信         | M9 + M10               | plugin-editor + plugin-notifications 集成测试
M14: Phase 2 验收         | M11 + M13              | 全部验收用例通过
```

**Phase 3（P2 — 2-4 周）**

```
里程碑                   | 依赖                    | 验收标准
M15: createScheduler      | 无                     | Scheduler 接口 + mock 测试
M16: 四框架 hook 实现     | M15                    | React/Vue/Solid/Svelte 各提供 useRaf/useDebounce/useThrottle
M17: 高频组件接入         | M16                    | Combobox/Slider/Table/VirtualScroll 接入调度原语
M18: bench 验证           | M17                    | Combobox 5000 options typeahead <4ms（当前 >16ms）
```

### 5.3 风险点与缓解策略

| 风险                                        | 概率 | 影响 | 缓解                                                                                                                                                   |
| ------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Escape 传播仲裁模型的复杂度**（浮层协调） | 中   | 高   | 从「Escape 栈」这个最小模型开始，不要一次实现完整的「全局快捷键仲裁」。先覆盖最常用场景（Dialog/Drawer → Popover），其他场景逐步补                     |
| **四框架不变式测试的维护成本**              | 高   | 中   | 核心断言逻辑下沉到 core（框架无关），适配器只实现 `RenderFn` 桥接。测试文件数量从 4 × N 缩减为 N（断言）+ 4（适配器）                                  |
| **Store 版本化被绕过**                      | 中   | 中   | 迁移是 opt-in，不强制。关键是：profile 必须实现迁移（它是入口），其他 store 可以先不补。在 `createStore` 的 `setState` 中添加 dev-only schema 形状检测 |
| **插件通信与版本契约过度设计**              | 中   | 低   | 最小可行产品 = EventEmitter（30 行）+ semver 检查（50 行）。不要在 Phase 1 做 Zod schema 验证。后者可以延迟到第三方插件市场启动前                      |
| **渲染调度与框架 reactivity 冲突**          | 低   | 中   | `createScheduler` 只提供 raw 原语（raf/debounce/throttle），框架绑定在 hook 层处理。`useRaf` 内部用 `useEffect` + 清理，不干涉框架的 tick 机制         |

### 5.4 关键架构决策日志

以下是我建议在实施过程中记录并审计的决策：

```
ADC-001: LayerManager 不持有 DOM 引用
  状态：建议
  原因：core 必须保持框架无关性。Portal 目标由适配器层的 IrisLayerProvider 管理。

ADC-002: Escape 传播使用「栈内消费」而非「事件冒泡」
  状态：建议
  原因：事件冒泡无法处理跨 Portal 边界（shadow DOM、不同 document 树的 Portal）。
        栈模型（浮层打开入栈、Escape 始终作用于栈顶）更简单且跨框架一致。

ADC-003: 不变式测试是纯测试基础设施，不在运行时引入
  状态：建议
  原因：运行时组合检查（dev warning）是独立能力，不应与不变式测试捆绑。
        运行时检查是方向②的延伸，但优先级更低。

ADC-004: 插件 channel 在 core 中定义接口，在插件 install 时创建实例
  状态：建议
  原因：channel 实例必须与插件的生命周期绑定（插件卸载时自动取消订阅），
        不能在全局单例中管理。

ADC-005: Store 迁移必须是纯函数，不得引入异步
  状态：建议
  原因：迁移可能发生在 hydrate 时（同步关键路径）。异步迁移引入不必要的时序依赖。
        如果确实需要异步迁移（如网络请求旧数据格式），应将异步逻辑放在 store 之外。
```

---

## 总结

| 维度             | 结论                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **架构健康度**   | 核心设计优秀（core 下沉、store 简洁、插件契约清晰），但 5 个缺失的抽象层构成了阻碍从「组件集合」到「系统平台」演化的架构债       |
| **最高优先级**   | 浮层协调层管理器（现存的 bug 源）+ 不变式测试（596 产品的安全网）                                                                |
| **最大风险控制** | Store 版本化对发布节奏有直接影响——profile 的 migration 必须在 v1.0 发布前就绪                                                    |
| **长期价值**     | 插件通信协议 + 渲染调度基础设施是生态健康和用户体验差异化的基础                                                                  |
| **总体评估**     | 这 5 个方向不改变核心架构，而是在现有优秀核心之上**补全缺失的跨组件/跨模块抽象层**。每个方向都可以独立推进、渐进交付，风险可控。 |
