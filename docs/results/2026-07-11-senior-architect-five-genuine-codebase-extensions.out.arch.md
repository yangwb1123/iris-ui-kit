以下是我基于完整代码库遍历（25 包、150+ 组件、插件系统、MCP、Desktop OS 壳、测试基础设施）所做的事实核查验证 + 综合架构分析。

---

# 架构分析：Iris UI 5 个高价值扩展方向

> **分析日期**：2026-07-12 · **覆盖范围**：`packages/` (core + 4 适配器 + 12 插件 + MCP) · `apps/` (4× desktop-os + CMS) · `docs/requirements/` (80+ 现分析文档, ~400+ 方向)
>
> **方法**：逐文件验证每条主张的代码真实性与现有分析覆盖度。以下 5 个方向确认为**尚未被任何已有分析以完整篇幅正面论述**，且每条的"为什么需要"逻辑成立。

---

## 0. 事实核查摘要：准确性与修正

在深入之前，对文档自身 5 个方向的代码验证结果：

| 方向                | 文档准确性                      | 关键修正                                                                                                                                                                                                                                                                                            | 代码证据                                                                                                      |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **① plugin-ai**     | 🟡 基本正确，低估了现有基础设施 | `commands.ts` 已有 `createLlmPlanner`/`ModelCall`/`toMcpTools`/`runMcpTool`；MCP server（`packages/mcp/`）已实现。真正缺口是**高层的 agent UI + 流式 conversation 状态**，而非文档声称的"没有任何 agent 抽象"。Assistant/AgentTools 确实 4× 重复（已验证）                                          | `packages/core/src/commands.ts` · `packages/mcp/src/server.ts` · `apps/desktop-os-*/src/appviews/Assistant.*` |
| **② 事件总线**      | ✅ 完全正确                     | 插件系统无 `EventBus`/`emit`/`on`。`PluginRegistry` 仅支持 token/i18n/store。跨插件通信必须手写 `useEffect` → `Store.subscribe`。文档未提与现有 `derived()` 的关系——`derived` 已解决简单的跨 store 组合，但无法编排插件间事件链                                                                     | `packages/core/src/plugin.ts`（零事件总线引用）· `packages/core/src/store.ts`（仅有 `derived`）               |
| **③ 持久化层**      | 🟡 夸大了缺失程度               | `profile.ts` **已有** `ProfileStorage` 模式（localStorage/云端双后端，可插拔）· `form.ts` **已有** `saveSnapshot()`/`hydrate()`（第 227-750 行）· `window.ts` **已有** `serializeSession()/restoreSession()`。真正缺口是**泛化**的 `createPersistedStore` 包装器，以及标准化适配器（URL/IndexedDB） | `packages/core/src/profile.ts` · `packages/core/src/form.ts:227-750` · `packages/core/src/window.ts:196-217`  |
| **④ 响应式/断点**   | ✅ 完全正确                     | 零 `createBreakpointEngine`、零 `useBreakpoint`、零响应式 `Table` prop、零 Dialog/Drawer `fullscreenOnMobile`。`matchMedia` 仅用于 `prefers-reduced-motion`/`prefers-color-scheme`。这是最干净的缺口                                                                                                | `grep -rn "useBreakpoint\|createBreakpoint\|fullscreenOnMobile" packages/` → 零匹配                           |
| **⑤ plugin-studio** | 🟡 部分正确                     | MCP 服务器已有 `list_components`/`get_component_api`/`generateTest`/`generateView`（`packages/mcp/src/tools.ts`）。但确实无交互式组件浏览器、无视觉回归、无障碍叠加层。playground 应用（`apps/playground*`）是手动维护的 demo                                                                       | `packages/mcp/src/tools.ts` · `apps/playground*`（手动维护）                                                  |

---

## 1. 架构评估

### 1.1 当前架构的优势

经过完整的代码库阅读，Iris UI 的架构有若干显著优点：

- **插件系统设计精良**：`PluginRegistry` 提供 `registerStore`/`registerLazyStore`/`onTeardown`/`dependsOn`/拓扑排序/热插拔（`reloadPlugins`），且所有 tear-down 都是 LIFO + 隔离的。这与 A/B/C 下沉分类（见 AGENTS.md）高度一致。
- **Store 层足够通用**：`createStore` + `derived` + `batch` + `subscribeWith` 构成了一个干净的反应式核心，四框架适配器仅靠 `useSyncExternalStore`/`ref`/`createSignal`/`toStore` 桥接。没有过度抽象。
- **MCP 集成是亮点**：`commands.ts` 至 `toMcpTools` 至 `createLlmPlanner` 的端到端管线已经到位，允许任何 shell 用一行代码接入 LLM planner。
- **专有持久化模式已确立**：`ProfileStorage`（profile.ts）、`SkinStorage`（skins）、`serializeSession`（window.ts）展示了清晰的"可插拔后端"模式，等待泛化。
- **行为系统优美**：`IrisResizable`/`IrisMovable`/`IrisSortable`/`IrisClickOutside`/`IrisHotkey` 作为正交包裹器，可嵌套组合，符合 "Behavior" 设计意图。

### 1.2 关键设计决策评估

| 决策                                       | 评价                                                                                                    | 风险                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Store 为 snapshot 模式（非 event-sourced） | 正确。对于 ~150 组件的组件库，event-sourcing 是过度工程。`batch` + `subscribeWith` 已提供足够的组合能力 | 随着插件数量增长，跨 store 循环检测缺失会成为问题（P2 风险） |
| 插件注册 store 是 eager by default         | 正确。SSR 需要 server/client store 实例一致。`registerLazyStore` 作为 escape hatch 保留                 | 无                                                           |
| 没有插件间通信渠道                         | **这是目前最大的设计缺口**。`derived()` 只能组合已知的 store，但插件无法声明"我消费这个事件"            | 平台化转型的障碍（P0）                                       |
| 桌面壳跨框架重复                           | 部分不可避免（render contract 框架特定），但 planner/catalog/permissions 的逻辑层重复是可以消除的       | 维护 4× 样板，AI 插件膨胀为 4× 工作量（P0 拖累）             |

### 1.3 架构债务

1. **持久化的"散养"状态**：profile/form/window 各自实现不同风格的持久化。没有一个泛化的 `createPersistedStore` 让第三方 store 无需思考即可持久化。每个新 store 都要重新发明轮子。
2. **Desktop OS 壳中重复的"planner"和"catalog"**：`planner.ts` 本质上只是 `createLlmPlanner` 的 re-export + SDK 注入，但 4 个壳各有一个。`catalog.ts` 里的 `AppManifest` 除了 render contract 外是相同的。
3. **Token 注册无值净化**：`registerTokens` 接受任意 `Record<string, string>` 直接注入 DOM。安全 review 已识别但未封锁。在首个 npm 发布前必须解决。

---

## 2. 扩展方向深度分析

以下 5 个方向按源文档顺序给出，每个方向含**代码验证**、**架构权衡**、**接口设计建议**、**实施顺序**。

---

### 方向 ①：`plugin-ai` — AI Agent 交互插件

#### 为什么需要（修正后）

核心论证成立，但需纠正前提：commands 系统**已经**提供了 agent plan→execute 管线。真正缺失的是：

1. **AI 面板 UI 复用**：Assistant/AgentTools 在 4 个 desktop-os 中各实现一次（总共 8 个文件），逻辑相同但渲染框架不同。一个 `plugin-ai` 即可消除该重复。
2. **流式 conversation 状态管理**：没有 `ConversationState`、没有 `StreamingBuffer`、没有消息历史管理。`createLlmPlanner` 是 stateless 的——一次输入 → 一次输出。没有"多轮对话"的存储。
3. **组件级 AI hooks**：`useAiCompletion(hint, context)` 让任意组件获得 AI 能力，这是一个差异化价值。当前没有任何组件可以"感知 AI"。
4. **MCP client 消费**：`@iris-ui/mcp` 是 MCP **server**（服务 AI 客户端）。但 Iris UI 自身没有 MCP **client** 插件——无法作为 AI 客户端去消费外部 MCP server（数据库、文件系统等）。

#### 核心挑战

| 挑战           | 难度  | 说明                                                                                                         |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| **流式渲染**   | 中    | LLM token 流需要流式 Markdown/Code 渲染器。可复用 `plugin-markdown`，但需改造为"逐 token 追加"模式           |
| **上下文注入** | 中-高 | 当前页面的表单值/表格行/组件状态需要自动剪裁为 LLM 上下文。需一套"上下文收集器"契约                          |
| **安全授权**   | 高    | LLM 调用的命令 `run()` 可以做任意操作。需要权限守卫（复用 desktop-os 的 `permissions.ts` 模式）+ 用户确认 UI |
| **跨框架**     | 中    | 流式渲染和 conversation 状态是框架无关的（core 层）。UI 面板需 4 套渲染器（复刻桌面壳的 Assistant）          |

#### 接口设计建议

```
@iris-ui/plugin-ai
├── core/
│   ├── index.ts          # createConversation(), createAiAgentRuntime()
│   ├── types.ts           # ConversationState, Message, AgentContext, ToolCall
│   ├── streaming.ts      # StreamingBuffer, MarkdownStreamParser
│   └── hooks.ts          # useAiCompletion, useAiFill, useAiExplain (接口定义)
├── react/
│   ├── index.ts          # IrisAiPanel, IrisAiCommandBar, provider 集成
│   ├── useAiCompletion.ts # React hook 实现
│   └── AiContext.tsx     # 上下文提供者
├── vue/
│   ├── index.ts
│   └── ...
├── solid/
│   └── ...
└── svelte/
    └── ...
```

关键接口：

```ts
// 框架无关
export interface AiAgentConfig {
  providers: AiProvider[] // 内置 OpenAI / Anthropic / Ollama
  contextCollectors?: ContextCollector[] // 插件注入上下文收集器
  permissionCheck?: (toolCall: ToolCall) => Promise<boolean>
}
export function createConversation(config: AiAgentConfig): Store<ConversationState>

// 组件级 hooks（接口定义在 core，适配器实现）
export function useAiCompletion(
  hint: string,
  context?: () => unknown,
): {
  reply: Store<string>
  loading: Store<boolean>
  stream: ReadableStream<string>
}
```

#### 架构变更

- **新增包**：`packages/plugin-ai/`（core + 4 适配器子路径）
- **修改 Desktop OS**：4 个壳的 `Assistant`/`AgentTools` 替换为使用 `plugin-ai` 的薄桥接
- **修改 Core（可选）**：在 `commands.ts` 中添加 `Command.executionState`（running/success/error/cancelled），让 UI 可反映命令执行状态

#### 对现有系统的影响

| 影响                      | 程度 | 说明                                                                             |
| ------------------------- | ---- | -------------------------------------------------------------------------------- |
| Desktop OS Assistant 替换 | 中   | 4 个壳的 Assistant 应用替换但接口兼容。约 60 行/壳 → 10 行 import。净减少 200 行 |
| commands.ts 增强          | 低   | 添加 `ExecutionState` 不影响现有 API。纯增量                                     |
| 测试                      | 中   | 流式渲染测试需要 mock `ReadableStream`。jsdom 无原生支持，需 polyfill            |

#### 向后的兼容性

- 不修改现有 `IrisProvider` 接口。`plugin-ai` 作为一个独立插件 `use`。
- 不修改 `commands.ts` API——仅添加可选字段（`executionState` 枚举，非 breaking）。
- Desktop OS 的 Assistant 可以在过渡期并存。

---

### 方向 ②：事件总线 + 编排系统

#### 为什么需要

代码验证确认：**零事件总线**。`PluginRegistry` 没有 `registerEventBus` 或任何 pub/sub 机制。当前跨插件通信模式是：

```ts
// 现状（手写 glue code）
// plugin-a 的 store 变化时 plugin-b 需要感知
const unsub = pluginAStore.subscribe(() => {
  // 手动写刷新逻辑
})
// 没有标准的事件契约，没有类型安全，没有生命周期管理
```

`derived()` 只能解决"已知 store 的组合"，不能解决"插件 A 发出事件，插件 B/C/D 无感知地响应"。

事件总线的价值不仅是通信，而是**平台化转型的基石**——它让插件从"死文件"变成"活系统"。

#### 核心挑战

| 挑战                    | 说明                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **类型安全**            | 事件名 + payload 必须是 TypeScript 可推导的。需要模块增强（`declare module '@iris-ui/plugin-ai/events'`） |
| **生命周期**            | 事件订阅必须在插件卸载时自动清理。当前 `PluginRegistry.onTeardown` 已提供机制                             |
| **跨框架**              | 总线本身是框架无关的（core 层）。handler 中访问框架 reactivity 需要适配器桥接                             |
| **与现有 Store 的关系** | 事件总线和 `Store` 不是竞争关系——Store 是"状态"，总线是"信号"。需要明确的架构文档指导何时用哪个           |

#### 接口设计建议

事件总线应该在 `PluginRegistry` 中作为一等公民加入，而非单独包：

```ts
// 在 @iris-ui/core/plugin.ts 中新增
export interface PluginEventBus {
  emit<E extends string>(event: E, payload: EventPayloads[E]): void
  on<E extends string>(event: E, handler: (payload: EventPayloads[E]) => void): () => void
  // 内置生命周期：插件卸载时自动清理所有订阅
}

// PluginRegistry 新增
export interface PluginRegistry {
  // ... 现有 ...
  registerEventBus<E extends EventPayloads>(bus: PluginEventBus<E>): void
}
```

但更好的设计方案是在 core 中提取组件级的 `createEventBus()`（框架无关），然后在 `IrisProvider` 初始化时收集所有插件的事件总线：

```ts
// 框架无关
export function createEventBus<EventMap extends Record<string, unknown>>(): {
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void
  // 生命周期管理
  readonly teardown: () => void
}
```

**类型安全的增强模式**：

```ts
// 在插件的 types.ts 中
declare module '@iris-ui/core' {
  interface PluginEvents {
    'notification:new': { id: string; title: string; tone: 'info' | 'warning' }
    'table:row-updated': { tableId: string; rowId: string }
  }
}
```

#### 编排层设计权衡

| 选项                                        | 优点                                                             | 缺点                                            |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| **A. 纯事件总线**（无编排层）               | 简单，4-6 周实现。不增加复杂度                                   | 仍然是手动 glue code，只是比 useEffect 优雅一点 |
| **B. 声明式规则引擎**（事件 → 条件 → 动作） | 非开发者也能连接组件。真正的差异化                               | 需要 DSL 设计 + UI（规则编辑器）。8-12 周       |
| **C. PluginRegistry 内置 reaction**         | 最轻量的编排："当事件 X 发生时自动调用插件 Y 的 store 的 reload" | 表达能力有限                                    |

**建议**：先做 A，在 PluginRegistry 中内置 `registerEventBus` + `createEventBus`。当有 3+ 个消费者证明需要编排层时再做 B。C 作 A 的语法糖。

#### 架构变更

- **修改 Core**：在 `plugin.ts` 中添加 `createEventBus()` + `registerEventBus`（~50 行纯逻辑）
- **修改 PluginRegistry**：新增 `eventBuses` 收集区，加入 `CollectedRegistrations`
- **新增 `@iris-ui/plugin-workflow`（可选）**：P1 方向，依赖事件总线存在后再说

#### 向后的兼容性

- 零 breaking change。所有现有插件正常工作。
- 新事件总线是可选能力（插件不调用 `registerEventBus` 则不受影响）。

---

### 方向 ③：通用持久化层（`createPersistedStore`）

#### 为什么需要（修正后）

代码验证显示：**存在多个专有持久化**（`ProfileStorage`、`saveSnapshot`/`hydrate`、`serializeSession`），但没有一个**泛化、一行的 `createPersistedStore`**。

用户期望：任何有分页/筛选/输入的页面，刷新后保持状态。当前每个应用必须手写 `localStorage.getItem('table-page')`。

已有可复用模式：

```ts
// packages/core/src/profile.ts — ProfileStorage 模式
export interface ProfileStorage {
  load(): ProfileData | null | Promise<ProfileData | null>
  save(data: ProfileData): void | Promise<void>
}
```

缺口是：**将这个模式泛化为 `createPersistedStore<T>(key, initial, adapter?)`，自动在 `setState` 时反写后端，初始化时读取恢复**。

#### 核心挑战

| 挑战                | 难度 | 说明                                                                                         |
| ------------------- | ---- | -------------------------------------------------------------------------------------------- |
| SSR 安全            | 低   | 持久化只在 `useEffect`/`onMount` 中执行。已有 profile.ts 的 SSR-safe localStorage 模式可复用 |
| 多适配器            | 低   | localStorage/sessionStorage/URL params 的适配器实现简单（共 ~50 行）                         |
| 序列化/反序列化     | 中   | Date/RegExp/Map/Set 在 JSON 序列化中丢失类型。需要可插拔的 `serializer`/`deserializer` 钩子  |
| 并发（多 tab 覆盖） | 中   | 两个 tab 同时写 localStorage 可能导致覆盖。需要广播通道（`BroadcastChannel`）或版本戳        |
| **选择性持久化**    | 中   | 不应持久化 `loading`/`error` 等瞬态字段。需要 `selector` 过滤                                |

#### 接口设计建议

```ts
export interface PersistAdapter<T> {
  load(): T | null | Promise<T | null>
  save(state: T): void | Promise<void>
}

// 内置适配器
export function localStorageAdapter<T>(key: string): PersistAdapter<T>
export function sessionStorageAdapter<T>(key: string): PersistAdapter<T>
export function urlSearchParamsAdapter<T>(mapping: Record<keyof T, string>): PersistAdapter<T>
export function indexedDbAdapter<T>(key: string, dbName: string): PersistAdapter<T>

export interface PersistConfig<T, S> {
  key: string
  adapter?: PersistAdapter<S>
  selector?: (full: T) => S // 选择要持久化的 slice
  merge?: (loaded: S, initial: T) => T // 合并恢复的状态（冲突策略）
  debounce?: number // 反写防抖（默认 300ms）
}

export function createPersistedStore<T>(
  initial: T,
  config?: PersistConfig<T, Partial<T>>,
): Store<T> & { flush: () => void } // 强制立即持久化

// 直接用
const tableStore = createPersistedStore(
  { page: 1, pageSize: 20, filters: {}, loading: false },
  {
    key: 'table-state',
    adapter: localStorageAdapter('iris-table'),
    selector: (s) => ({ page: s.page, pageSize: s.pageSize, filters: s.filters }),
    debounce: 500,
  },
)
```

#### 架构变更

- **新增 core 子路径**：`@iris-ui/core/persist`（框架无关，~80 行核心逻辑 + ~60 行适配器）
- **不修改现有 API**：`createPersistedStore` 包装 `createStore`，是增强而非替代
- **关于 form 的自动草稿**：在 `form.ts` 中添加可选 `createPersistedForm` 工厂，或提供一个 `persistForm(config)` 包装器

#### 冲突策略设计

| 策略               | 含义                           | 适用场景           |
| ------------------ | ------------------------------ | ------------------ |
| `'local-override'` | 本地持久化状态覆盖服务端默认值 | 离线优先、表单草稿 |
| `'server-wins'`    | 服务端初始值覆盖本地           | 多用户共享数据     |
| `'merge-deep'`     | 递归合并                       | 设置/偏好合并      |

#### 向后的兼容性

- `createPersistedStore` 是新增 API，零 breaking。
- 现有 `saveSnapshot`/`hydrate` 保持不变。`createPersistedStore` 是更自动化的选择。
- 现有 `ProfileStorage`/`serializeSession` 作为专有方案继续有效。

---

### 方向 ④：响应式布局与断点系统

#### 为什么需要

代码验证确认：**这是方向中最清晰、最干净的缺口**。150+ 组件中没有任何一个感知视口宽度或提供响应式变体。`Stack`/`Grid`/`Container` 固定比例或仅 CSS 原生响应式（`container-type`），但**没有断点级 prop**（如 `<Stack direction={{ base: 'column', md: 'row' }}>`）。`Table` 无列隐藏/卡片降级。`Dialog`/`Drawer` 无可移动端全屏模式。

产品影响：四个 CMS demo 在手机上不可用。项目定位 "AI 原生"但无法生成适配移动端的 UI。

#### 核心挑战

| 挑战                   | 难度 | 说明                                                                                             |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| **SSR 断点匹配**       | 中   | 服务端不知客户端视口 → 默认发 `'md'`，hydrate 后修正。CLS 风险                                   |
| **性能**               | 中   | 大量组件监听 `matchMedia` → 引擎使用单一 `matchMedia` 监听器 + pub/sub                           |
| **组件层 vs Token 层** | 中   | 间距/字体应在 token 层定义响应式变体（`--iris-space-sm: 8px / 12px / 16px`），而非全部 prop      |
| **测试**               | 低   | jsdom 无 `matchMedia` → mock 即可                                                                |
| **组合性**             | 高   | 断点 prop 需要深度侵入每个组件类型定义。`<Grid columns={{ base: 1, md: 2 }}>` 需要泛型 prop 支持 |

#### 接口设计建议

**分层设计**：

1. **引擎层**（core）：`createBreakpointEngine(config)` — 纯逻辑，无 DOM 依赖

```ts
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export interface BreakpointConfig {
  breakpoints: Record<Breakpoint, number> // px 宽度
  defaultBreakpoint?: Breakpoint
}
export interface BreakpointEngine {
  get current(): Breakpoint
  get matches(): Record<Breakpoint, boolean>
  onChange(listener: (bp: Breakpoint) => void): () => void
  // SSR-safe: 同步返回默认值
  destroy(): void
}
```

2. **响应式值类型**（core/types.ts）：

```ts
// 泛型响应式值：每个组件可以定义自己的 ResponsiveProp<T>
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>
export function resolveResponsive<T>(value: ResponsiveValue<T>, current: Breakpoint): T
```

3. **视图层适配器**（各框架 bridge）：

```ts
// React
function useBreakpoint(): Breakpoint
function useResponsiveValue<T>(value: ResponsiveValue<T>): T

// Provider（可选，用于 SSR hydration）
<IrisViewportProvider defaultBreakpoint="md">
  <App />
</IrisViewportProvider>
```

4. **组件层**（渐进式渗透）：先从 **Table** 和 **Grid** 开始，因为这两个是布局核心且有最高用户感知。

#### 响应式 Token 优先级

文档指出"响应式间距/字体应在 token 层定义，而不是组件 props"。我同意这个判断。建议：

```css
:root {
  --iris-space-xs: 4px;
  --iris-space-sm: 8px;
  --iris-space-md: 16px;
}
@media (min-width: 768px) {
  :root {
    --iris-space-xs: 6px;
    --iris-space-sm: 12px;
    --iris-space-md: 24px;
  }
}
```

但 token 层响应式意味着皮肤系统也需要支持 `variants` 中的断点。这是一个更深的改动。

#### 实施路径建议

| 阶段 | 内容                                                                                      | 时间估计                   |
| ---- | ----------------------------------------------------------------------------------------- | -------------------------- | ---------------- | ------ |
| 1    | `createBreakpointEngine`（core） + `useBreakpoint`（React bridge） + `useResponsiveValue` | 1-2 周                     |
| 2    | Grid/Stack/Container 添加响应式 prop + 组件测试                                           | 1-2 周                     |
| 3    | Table 响应式降级（`responsive: 'collapse'                                                 | 'card'                     | 'scroll-hint'`） | 2-3 周 |
| 4    | Dialog/Drawer `fullscreenOnMobile`                                                        | 1 周                       |
| 5    | AdminLayout/NavMenu 断点自动折叠                                                          | 1 周                       |
| 6    | 响应式 token 变体（皮肤层）                                                               | 2 周（依赖皮肤系统的扩展） |

---

### 方向 ⑤：`plugin-studio` / `@iris-ui/testing`

#### 为什么需要（修正后）

MCP 服务器已实现组件枚举/搜索/API 查询/脚手架生成（`list_components`/`get_component_api`/`generateView`/`generateTest`）。但缺失的是**交互式可视化层**：

1. **组件浏览器**：没有 Storybook 式的交互式 playground。playground 应用（`apps/playground*`）是手动维护的 demo，不是自动发现所有组件的浏览器。
2. **视觉回归**：没有像素级 diff 管线。合约测试验证"行为正确"，但不验证"看起来对不对"。
3. **a11y 可视化叠加层**：没有实时的 ARIA 标注/焦点路径/对比度检查覆盖层。
4. **AI 验证闭环**：如果 AI 生成 UI（方向①），开发者需要快速预览/调参/对比。

#### 核心挑战

| 挑战               | 难度  | 说明                                                                                              |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| **组件自动发现**   | 中    | Manifest 已就绪（`pnpm gen:manifest`），但 prop 类型需要运行时反射。TypeScript 类型在运行时不可用 |
| **Prop 面板**      | 中-高 | 需要从 manifest 的 JSON schema 描述生成 prop 编辑器。枚举类型/布尔/数字/字符串各有不同 UI         |
| **视觉 diff 基线** | 中    | 首次运行需生成 baseline 截图。CI 需一致字体/抗锯齿渲染                                            |
| **框架兼容**       | 高    | Studio 自身应使用何种框架？推荐 React（manifest 从 React 提取 props），但限制跨框架用户           |
| **代码生成集成**   | 中    | Studio 中的"调整 prop → 生成代码"管线已经部分存在（MCP `generateView`），但 UI 层缺失             |

#### 接口设计建议

```ts
// @iris-ui/plugin-studio — 自身是 IrisPlugin
export const studioPlugin = createPlugin({
  name: 'studio',
  dependsOn: ['manifest'],  // 依赖 manifest 插件/包
  install(reg) {
    reg.registerTokens({ '--iris-studio-bg': '#fafafa', /* ... */ })
    reg.registerStore('studio', () => createStudioStore())
  },
})

// 用法
// 在任何 IrisProvider 应用中嵌入：
import { studioPlugin, IrisStudioPanel } from '@iris-ui/plugin-studio'
<IrisProvider plugins={[studioPlugin]}>
  <IrisStudioPanel />
</IrisProvider>
```

**Studio 的狗粮自食**：Studio 本身使用 Iris UI 组件（`IrisTree`、`IrisTabs`、`IrisSelect`、`IrisTable` 等）。这是最佳的 dogfooding 场景——如果 Studio 的组件浏览器中用起来不爽，那就是最真实的 bug report。

#### Studio 与现有 MCP 的关系

Studio 不应重复 MCP 的功能。相反，Studio 是 MCP 的 GUI 前端：

```
Studio UI Panel  → 调用 MCP tools (通过 WebSocket/HTTP)  →  MCP Server  → Manifest
```

或更轻量：Studio 直接 import manifest JSON 并本地渲染。

#### 实施路径

| 阶段 | 内容                                                       | 依赖                           |
| ---- | ---------------------------------------------------------- | ------------------------------ |
| 1    | 组件浏览器（Tree + Props panel + 状态切换）+ manifest 导入 | manifest 包（已就绪）          |
| 2    | 主题/皮肤切换 + 响应式预览                                 | 方向④的断点引擎                |
| 3    | 视觉回归集成 + CI 门禁                                     | 方向⑤自身 + `@iris-ui/testing` |
| 4    | a11y 叠加层                                                | 方向⑤自身                      |
| 5    | AI 集成（"让 AI 改这个组件的样式"）                        | 方向①的 AI hooks               |

---

## 3. 接口设计原则

### 3.1 通用设计准则

1. **A 类（核心身份）进 core，B 类（附加）进插件，C 类（纯函数）进 core 材料层** —— 与项目已有的 A/B/C 分类完全一致。
2. **不在 core 中产生框架依赖** —— `grep "from 'react\|vue\|solid\|svelte'" packages/core/src/` 必须为空（当前已验证成立）。
3. **新旧共存** —— 新增 API 不修改旧 API。`createPersistedStore` 不替换 `createStore`；`registerEventBus` 不改变现有 PluginRegistry。
4. **渐进复杂性** —— 所有新方向都可作为`可选`加载：插件用 `use`、引擎用 `import`、组件 prop 用 `optional`。

### 3.2 是否需要新的抽象层

| 方向            | 新抽象层                                          | 说明                                                          |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| ① plugin-ai     | `Conversation` state 管理 + `AiProvider` LLM 抽象 | 现有 `ModelCall` 已提供，但 `Conversation` 是多轮协商的必需品 |
| ② 事件总线      | `EventBus` 接口（框架无关）                       | 不需要抽象层——就是接口本身                                    |
| ③ 持久化        | `PersistAdapter` 接口                             | 已有 `ProfileStorage` 为先例，直接泛化即可                    |
| ④ 响应式        | `BreakpointEngine` + `ResponsiveValue` 类型       | 新的原语，但在 core 中定义的类型只有 ~30 行                   |
| ⑤ plugin-studio | 无新抽象                                          | 全部 UI 基于现有组件                                          |

**结论**：5 个方向均不需要新的架构抽象层。全部在现有分层内（core → 插件/适配器）自然放置。

---

## 4. 技术选型

### 4.1 是否需要新的技术栈

| 方向            | 新依赖                                      | 决策                                                              |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| ① plugin-ai     | LLM SDK（`@anthropic-ai/sdk`、`openai` 等） | **必须**。但应该是 peer dependency 或插件内部封装，不暴露给消费者 |
| ① plugin-ai     | Markdown 流式渲染                           | 复用 `plugin-markdown`，改为流式模式。无需新依赖                  |
| ② 事件总线      | 无                                          | 纯 TypeScript，50 行逻辑。零外部依赖                              |
| ③ 持久化        | 无                                          | 纯 TypeScript。IndexedDB 适配器可选，但使用标准 Web API           |
| ④ 响应式        | 无                                          | `matchMedia` 是标准 Web API。SSR 安全模式已成熟                   |
| ⑤ plugin-studio | `pixelmatch` 或相似                         | 视觉 diff 需要像素级比较。这是 ~5KB 的纯 JS 库，无副作用          |
| ⑤ plugin-studio | `playwright`（CI 截图）                     | 开发依赖，非运行时依赖                                            |

**总体判断**：5 个方向均不需要引入重大新框架（如 React Native、Node.js stream、WebAssembly）。所有依赖都是标准 Web API 或轻量 npm 包。

### 4.2 第三方依赖评估标准

| 标准                   | 门槛                                    |
| ---------------------- | --------------------------------------- |
| 包大小                 | 运行时依赖 < 10KB gzip                  |
| 许可证                 | MIT / Apache-2.0 仅                     |
| 无原生编译             | 纯 JS/TS，无 Node 原生绑定              |
| 无 DOM 依赖（core 层） | core 层使用该依赖时，必须不依赖 DOM/BOM |
| 测试兼容               | 可在 jsdom 中 mock                      |
| 维护状态               | 近 6 个月有 release                     |

### 4.3 自建 vs 采购

| 方向              | 决策                               | 理由                                                                 |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------- |
| LLM SDK 集成      | **采购**（`@anthropic-ai/sdk` 等） | 维护自建 HTTP 封装无意义。SDK 封装为 `AiProvider` 抽象的内部细节     |
| Markdown 流式渲染 | **自建**（基于 `plugin-markdown`） | 已有 Markdown 渲染器，只需改为流式追加。自建 50 行                   |
| 事件总线          | **自建**                           | 类型安全的事件总线在 npm 上没有好的轻量方案。自建 ~50 行             |
| 持久化适配器      | **自建**                           | localStorage/sessionStorage 是 5 行的包装器。IndexedDB 适配器 ~30 行 |
| 视觉 diff         | **采购**（`pixelmatch`）           | 像素级 diff 是 NP-hard 问题，不自建                                  |
| 组件浏览器        | **自建**（基于 Iris UI 组件）      | 这是产品差异化。不自建意味着把自己的体验外包给 Storybook             |

---

## 5. 实施路线图

### 5.1 优先级排序

| Direction           | 代码杠杆                       | 用户感知            | 差异化          | 实施成本 | 优先级 | 修正调整                            |
| ------------------- | ------------------------------ | ------------------- | --------------- | -------- | ------ | ----------------------------------- |
| **① plugin-ai**     | 🟢 高（commands + MCP 已就绪） | 🟢 高               | 🟢 行业首创     | 中       | **P0** | ✅ 同文档                           |
| **② 事件总线**      | 🟡 中（插件系统增量）          | 🟡 对开发者         | 🟢 平台化转型   | 低       | **P0** | ✅ 同文档                           |
| **③ 持久化层**      | 🟢 高（多个专有持久化已有）    | 🟢 高               | 🟡 常见但集成好 | 低       | **P1** | ⬅ 从 P1 降至 P0.5？成本极低，收益高 |
| **④ 响应式**        | 🔴 全新                        | 🟢 高（移动端刚需） | 🟡 必备功能     | 高       | **P1** | ✅ 同文档                           |
| **⑤ plugin-studio** | 🟡 中（MCP + manifest 已就绪） | 🟢 高（开发者体验） | 🟢 插件形式独特 | 高       | **P2** | ✅ 同文档                           |

**修正建议**：方向③（持久化层）的实施成本低（预估 3-5 天，核心逻辑 ~80 行），而用户感知极高（刷新保留状态是每个应用的基线体验）。建议提升至 **P0.5**——在 ①+② 之后立即执行，无需等到 "P1 后续批次"。

> 因为已有 `ProfileStorage` 和 `saveSnapshot` 的先例，`createPersistedStore` 本质上是**提取一个泛化包装器**，不是从零构建。这是高杠杆、低风险、高感知的方向。

### 5.2 阶段划分

#### Phase 1：平台基础（6-8 周）—— P0

| 周  | 方向            | 里程碑                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------ |
| 1-2 | ② 事件总线      | `createEventBus()` 在 core 实现 + PluginRegistry 集成 + 测试                               |
| 2-3 | ③ 持久化层      | `createPersistedStore()` + localStorage/URL/sessionStorage 适配器 + `persistedForm` 包裹器 |
| 3-6 | ① plugin-ai MVP | `Conversation` state + 流式渲染 + 组件级 `useAiCompletion` hook（React 先行）+ 权限守卫    |
| 6-8 | ① 跨框架展开    | plugin-ai 铺到 Vue/Solid/Svelte；Desktop OS 4× Assistant 替换                              |

**交付物**：

- [ ] 事件总线正式发布（`@iris-ui/core` 子路径，按需使用）
- [ ] `createPersistedStore` 文档 + 测试（core 子路径）
- [ ] `plugin-ai` MVP：React 版本 + 基础 AI 面板 + 命令集成
- [ ] Desktop OS 四个壳的 Assistant 统一使用 plugin-ai（消除 4× 重复，净减 ~300 行）

#### Phase 2：体验补齐（4-6 周）—— P1

| 周    | 方向             | 里程碑                                                              |
| ----- | ---------------- | ------------------------------------------------------------------- |
| 9-10  | ④ 响应式 阶段 1  | `createBreakpointEngine` + `useBreakpoint` + Grid/Stack 响应式 prop |
| 10-11 | ④ 响应式 阶段 2  | Table 响应式降级模式 + Dialog/Drawer `fullscreenOnMobile`           |
| 11-12 | ④ 响应式 阶段 3  | AdminLayout/NavMenu 自适应折叠 + CMS demo 移动端适配                |
| 12-13 | ① plugin-ai 增强 | MCP client 集成 + 上下文收集器 + `useAiFill`/`useAiExplain`         |
| 13-14 | 事件总线消费     | 通知→dashboard 刷新、pro-table 自动 reload、form→table 联动         |

**交付物**：

- [ ] 响应式引擎全四框架展开
- [ ] 全部 CMS demo 移动端可用
- [ ] plugin-ai v2：AI 可填写表单/解释表格行
- [ ] 首轮"事件总线驱动"集成场景（通知 + pro-table + form-builder）

#### Phase 3：开发者体验（8-10 周）—— P2

| 周    | 方向                   | 里程碑                                                     |
| ----- | ---------------------- | ---------------------------------------------------------- |
| 15-17 | ⑤ plugin-studio 阶段 1 | 组件浏览器 + props 面板 + 状态/主题/皮肤切换               |
| 17-19 | ⑤ @iris-ui/testing     | 视觉 diff 引擎 + 合约场景集成 + CI 截图门禁                |
| 19-21 | ⑤ plugin-studio 阶段 2 | a11y 叠加层 + 代码生成集成（MCP bridge）                   |
| 21-22 | ⑤ 跨框架               | Studio 适配 Vue/Solid/Svelte（或选 React 为主 + 说明文档） |

**交付物**：

- [ ] Studio 插件可用（React 优先）
- [ ] 视觉回归 CI 门禁
- [ ] a11y 可视化叠加层
- [ ] Studio ↔ MCP 的双向集成

### 5.3 风险点与缓解策略

| 风险                           | 概率 | 影响 | 缓解措施                                                                                         |
| ------------------------------ | ---- | ---- | ------------------------------------------------------------------------------------------------ |
| **plugin-ai 流式渲染测试困难** | 中   | 高   | 用 `MockedReadableStream` + 小段 token 序列测行为。不考虑测试逐像素渲染                          |
| **响应式 SSG 流量流失**        | 高   | 中   | 接受 "服务器端渲染为 md，hydrate 后修正"。使用 `container-type` + CSS 原生响应式作为渐进增强基线 |
| **编排层的范围蔓延**           | 中   | 高   | **严格限定 Phase 1 为纯事件总线**。编排层需要独立 RFC 才能进入开发                               |
| **视觉 diff 基线漂移**         | 高   | 低   | CI 中使用 Docker 固定 fontstack + OS 版本。每次 UI 变更后自动更新 baseline                       |
| **插件系统复杂化**             | 低   | 高   | 事件总线加入后插件 API 表面积增大。需编写迁移指南 + 尽量保持 `PluginRegistry` 接口窄             |

---

## 6. 总结性推荐

### 执行顺序

```
Phase 1 (P0):      ② 事件总线 ─→ ③ 持久化层 ─→ ① plugin-ai
                       ↓                          ↑
                   (总线为 plugin-ai 提供感知基础)

Phase 2 (P1):      ④ 响应式系统 → ① plugin-ai 增强 → 总线消费场景

Phase 3 (P2):      ⑤ plugin-studio → @iris-ui/testing
```

**为什么先总线再持久化再 AI？**

1. 事件总线是基础设施，所有后续方向（AI 感知、编排、跨组件通信）依赖它。
2. 持久化层是从"已有模式 → 泛化"的杠杆操作，成本极低（~80 行逻辑），适合在团队热身期快速交付。
3. AI 插件需要总线来感知"表格加载完成""通知已到达"，所以总线必须在 AI 之前。

### "不做"清单

| 不做                           | 理由                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| 不做微前端/联邦                | 文档已有讨论，当前阶段过早                                                      |
| 不做 CRDT/协作                 | 需要事件溯源基础，方向③的 `createPersistedStore` 先做                           |
| 不做插件市场 SDK 增强          | 已覆盖于皮肤市场 SDK 讨论，不在本文范围                                         |
| 不做 CLI 工具                  | MCP 已覆盖 CLI 场景（`generateView`/`generateTest`）                            |
| 不做 Form Builder 替代事件总线 | 方向②和 Form Builder 是平行的。Form Builder 是 UI，事件总线是通信。两者相互增强 |

---

_以上分析基于 2026-07-12 代码库状态。所有代码引用指向已验证的文件路径。_
