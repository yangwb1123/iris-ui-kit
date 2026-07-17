# 架构分析报告：Iris UI 五个扩展方向

> **分析者角色**：资深架构师  
> **分析日期**：2026-07-12  
> **输入材料**：方向文档 + 核查报告  
> **分析范围**：架构评估、扩展方向、接口设计、技术选型、实施路线图

---

## 1. 架构评估

### 1.1 当前架构的核心优势

**分层抽象（Layer 0–4）是经得起验证的架构决策。** 核查报告确认了以下几点：

- **Core 层零框架依赖**得到严格执行——`grep "from '(vue|react|solid|svelte)'"` 在 core 中返回空。这意味着所有五个方向的核心逻辑都可以放入 core，四框架自动继承。
- **Store 契约足够通用**——`createStore` + `store.subscribe` + `store.batch()` 的组合覆盖了同步/异步/批量三种数据流模式，五个方向均能在此基础上叠加。
- **控制器的 A/B/C 分类法**被验证有效——FormStore 的 undo 实现放在 A 类（core/form.ts），DataSource 的乐观更新放在 A 类（core/data-source.ts），均已就位。

**插件系统的 `registerStore` / `registerTokens` / `registerMessages` 三接口设计简洁且正交。** 跨标签同步（方向五）和离线持久化（方向四）天然可以以插件形态接入，不需要修改 `IrisProvider` 的核心契约。

### 1.2 架构局限性

| 局限性                       | 体现                                                                                   | 影响面                                             |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **数据流是全 pull 的**       | `createDataSource` 只支持 `fetcher: (query) => Promise`                                | 方向一必须引入新抽象，不能只扩展参数               |
| **无变异历史栈**             | 只有 FormStore 有 undo/redo，其他所有变异操作都是「即改即失」                          | 方向三需要新建 `createUndoStack`，而非扩展现有接口 |
| **无跨实例共享**             | 每个 `createStore` 调用创建独立闭包，标签页间零通信                                    | 方向五需要新建同步层，不能复用现有 store 机制      |
| **持久化是点状而非系统化的** | Profile `localStorage` / VFS 纯内存 / Clipboard 纯内存——三种不同的持久化策略，各不相知 | 方向四需要统一的持久化契约，而非只改造单个模块     |
| **无 push-based 通道**       | WebSocket / SSE / BroadcastChannel 全库零使用                                          | 方向一和方向五都需要引入浏览器级的通信 API         |

### 1.3 关键设计决策回顾

**决策一：`createStore` 设计为独立闭包而非共享内存。** 这对标签页内场景是完全正确的——避免了全局状态的副作用、便于 SSR、支持 tree-shaking。但这也意味着跨标签页同步需要新建一层基础设施，不能简单地「开启一个选项」。

**决策二：`createDataSource` 定义为纯拉取模型。** 这在 MVC 场景（CMS CRUD 表格）中是合理的选择——简单、可预测、与 REST API 天然匹配。但实时场景（Dashboard 监控、协作编辑）需要一个对等的推送模型，不是对现有接口的修补。

**决策三：变异操作直接修改 state 而不经过历史栈。** 这保持了实现的简单性（每个 store 约 200–400 行），但也意味着 undo/redo 不能通过一个全局拦截器自动附加——每个 store 需要显式 `withUndo` 包装。

**决策四：`ProfileStorage` 定义为可插拔接口。** 这是前瞻性的决策——离线持久化的 Phase 2 可以直接新增 `SyncProfileStorage` 实现，不需要修改任何消费代码。

### 1.4 架构债务

**无架构债务需要立即偿还。** 五个方向都是加法而非重构。唯一值得注意的点是：

- **FormStore 的 undo 实现（JSON 快照）是通用方案的先行者，但未被提取为可复用抽象。** 如果方向三推进，FormStore 的手写历史栈应被 `createUndoStack` 替换，而非保持两个独立实现。

---

## 2. 扩展方向

### 2.1 方向一：实时数据订阅层

**为什么需要**

当前 `createDataSource` 是纯拉取模型，无法支持监控 Dashboard、协作编辑、实时通知等场景。这些场景在 Iris UI 的目标场景（CMS admin、桌面 OS）中频繁出现。没有推送层，插件生态的发展会受限——`plugin-editor` 无法展示协作者的实时光标，`plugin-pro-table` 无法显示其他用户的编辑。

此外，实时层可以作为跨标签同步（方向五）的底层通道：一个 WebSocket 连接在 SharedWorker 中被多个标签页共享，服务端推送同时分发给所有实例。

**核心挑战**

1. **竞态处理**——WebSocket 推送时序不可靠，需要与 pull-based fetcher 共用同一套 `AsyncResource.token` + `AbortSignal` 防护机制。如果拉取和推送同时修改相同数据行，需要定义清晰的合并语义。
2. **连接状态机**——WebSocket 重连不是简单的「断→连」，需要指数退避 + jitter + 心跳检测。`createMachine` 可以作为基础，但需要扩展出 `connecting ↔ connected ↔ disconnected ↔ reconnecting` 四态机。
3. **增量合并策略**——`replace`/`append`/`patch` 三种策略的选择影响着 DataSourceState.rows 的更新方式。`patch` 模式需要 `dataIndexOf` 作为行匹配工具，但当前 `createDataSource` 没有 PK（主键）概念——这是新抽象需要解决的问题。

**预期的架构变更**

```
实时订阅引擎可以作为独立模块引入：

packages/core/src/realtime/         # 新增目录
    - createRealtimeDataSource.ts   # 取代 createDataSource 的实时变体
    - reconnect-state-machine.ts    # 连接状态机
    - merge-strategies.ts           # 增量合并策略（replace/append/patch）
    - types.ts                      # 共享类型

对现有系统的影响：
- 零影响——createDataSource 不修改
- 实时数据源消费相同的 DataSourceState 契约
- ResourceController / ProTableStore 通过类型参数选择拉取或推送
```

### 2.2 方向二：跨窗口拖放与跨应用通信

**为什么需要**

这是 Iris UI 从「组件库」走向「应用平台」的关键能力。桌面 OS demo 中已经有 Files、Photos、Calculator、Terminal 四个应用窗口，但它们之间完全隔离。跨窗口拖放是用户对桌面环境的最高频期望行为之一，没有它，桌面 OS 仅是一个视觉壳。

跨窗口消息总线（`createCrossWindowBus`）的价值超出拖放本身——它可以用于：

- 窗口 A 编辑文件 → 通知窗口 B 刷新列表
- 全局设置变更（主题、语言）广播到所有窗口
- 插件注册和发现跨窗口可见

**核心挑战**

1. **浏览器 DataTransfer API 的限制**——`dragstart`/`dragover`/`drop` 事件在浏览器中无法跨越独立的 `window` 对象。真正的跨窗口拖放需要 `BroadcastChannel` + 虚拟拖放覆盖层的组合模拟。这是**浏览器平台限制**，不是框架设计能解决的。
2. **类型化数据传输协议**——跨窗口需要协商 MIME 类型（`iris/row`、`iris/file-path`、`text/plain` 等），需要一种可扩展的序列化/反序列化机制。JSON 是基础，但大型数据（文件内容）需要 Blob 或 IndexedDB 中转。
3. **drop zone 匹配的视觉反馈**——拖放过程中，目标窗口需要显示「接受/拒绝、插入位置」等视觉指示。这需要跨窗口通信的往返延迟可以接受。

**预期的架构变更**

```
packages/core/src/dnd-cross-window/   # 新增目录
    - types.ts                        # CrossWindowDragPayload MIME 类型
    - createCrossWindowBus.ts         # BroadcastChannel 封装
    - drop-zone-registry.ts           # 接受类型注册表
    - drag-overlay.ts                 # 跨窗口拖放覆盖层

packages/core/src/messaging/
    - createCrossWindowBus.ts         # 独立的消息总线（与 DnD 共享）

对现有系统的影响：
- createSortable 不变——跨窗口拖放是在其上的叠加层
- Behaviors 需要新增 <IrisDropTarget> 包装器
- desktop OS apps 需要显式注册 drop zones
```

### 2.3 方向三：通用撤销/重做栈

**为什么需要**

撤销是生产级 UI 的基础 UX 预期。Iris UI 定位对标 vxe-table / Vben Admin / Naive UI，这些框架都提供撤销能力。当前除了 FormStore 有自我实现的 undo/redo 外，DataSource、AdminShell、Kanban、Dashboard、ProTable 均无撤销。

核查报告确认 FormStore 的 undo/redo 存在（`form.ts` L219-224），这是一个重要修正——它意味着方向三的**核心问题不是「从零设计 undo 引擎」**，而是「将 FormStore 中的手写 JSON 快照栈提取为可复用的 `createUndoStack`，然后挂接到其他 store」。

**核心挑战**

1. **快照 vs. 命令模式的选择**——FormStore 使用的是 JSON 快照栈（`history: string[]`），这是最简单的方式，但每步都序列化整个 state。对于 DataSource（可能有数千行），JSON 快照的成本较高。需要考虑**增量差异**（基于 JSON Patch 或 Immutable.js 结构共享）或**命令模式**（记录逆操作）。

2. **withUndo 包装器的设计**——不是所有 store 都可以自动接入 undo。需要 `withUndo<T>(store, options)` 包装器，它拦截 `setState` 调用并将前一个 state 入栈。这要求 store 的 state 是纯 JSON 可序列化的，且每个变异操作确实是「一步」。

3. **分组（batch）语义**——`store.batch()` 中的多个操作应作为一个 undo 条目。这是 FormStore 未解决的问题（batch 不记录历史），`createUndoStack` 需要支持 `beginGroup()` / `endGroup()`。

**预期的架构变更**

```
packages/core/src/undo.ts             # 新增文件
    - createUndoStack(options)        # 核心引擎
    - withUndo(store, options)        # 包装器
    - Undoable<T>                     # 类型辅助

修改的文件：
    - packages/core/src/form.ts       # 替换手写历史栈为 createUndoStack
    - packages/core/src/data-source.ts # 新增 withUndo 包装
    - packages/plugin-kanban/src/...  # 接入 undo

对现有系统的影响：
- FormStore 的行为不会改变（向后兼容）
- 其他 store 通过 withUndo 包装获得撤销能力
- 按键绑定通过 Behaviors 的 <IrisHotkey> 提供
```

### 2.4 方向四：离线优先与同步冲突层

**为什么需要**

核查报告指出**最有价值的原创洞察**：VFS/ClipboardHistory/NotificationCenter 纯内存，页面刷新即丢。这不是一个边缘问题——对于桌面 OS 场景，用户期望文件系统、剪贴板历史、通知中心在刷新后保持不变。

此外，Profile 的 `localStorage` 持久化是单实例、无版本管理的。多设备场景（同一用户在办公电脑和家庭电脑登录）将导致直接覆盖——没有 merge、没有冲突提示。

**核心挑战**

1. **持久化的序列化范围**——VFS 可能包含大量文件内容（`Record<string, string>`），全集序列化到 `localStorage` 可能超过 5MB 的限制。需要 IndexedDB 作为主要持久化后端，`localStorage` 仅作为轻量配置的存储。
2. **冲突策略的多样性**——不是所有数据都适合「last-write-wins」策略。Profile 的嵌套字段（如皮肤 token 的自定义覆盖）可能需要字段级 merge，而不是整体替换。DataSource 的行级编辑可能需要 `server-wins` 或 `manual` 策略。
3. **离线/在线状态检测**——`navigator.onLine` 不可靠，需要自定义心跳检测 + 连接状态机。这正好可以利用方向一（实时订阅层）的连接状态机。

**预期的架构变更**

```
packages/core/src/persist/            # 新增目录
    - createPersistedStore.ts         # localStorage/IndexedDB 持久化
    - conflict-strategies.ts          # server-wins / client-wins / manual / merge
    - sync-engine.ts                  # 在线同步协调器
    - schema-migration.ts             # PROFILE_VERSION 驱动的迁移

packages/core/src/profile.ts          # 修改：新增 SyncProfileStorage
packages/core/src/fs.ts               # 修改：新增 persist 选项
packages/core/src/clipboard-history.ts # 修改：新增 persist 选项
packages/core/src/notifications.ts     # 修改：新增 persist 选项

对现有系统的影响：
- 三个内存模块的行为模式不变（增/删/改），仅在加载时从持久化恢复
- ProfileStorage 接口不变（向后兼容）
- 不引入同步的模块继续保持纯内存运行
```

### 2.5 方向五：跨标签页/跨窗口状态同步

**为什么需要**

桌面 OS 场景下，用户可能打开多个标签页或窗口分别显示不同内容。当前每个标签页拥有独立的皮肤引擎、profile、i18n、VFS 实例。用户在标签页 A 切换暗色主题 → 标签页 B 仍然是亮色。这是**一致性问题**，不是性能优化。

核查报告确认方向五与方向四是正交互补的——持久化（方向四）解决设备间的同步，跨标签页同步（方向五）解决同一设备多个实例的一致性。两者可以共享序列化格式和冲突策略。

**核心挑战**

1. **三通道的自愈设计**——BroadcastChannel（实时）→ StorageEvent（回退）→ SharedWorker（高级），通道的选择不是简单「选最好的」，而是需要 fallback 链。BroadcastChannel 在所有现代浏览器中可用，所以 StorageEvent 的回退价值有限。
2. **部分同步 vs. 全量同步**——不是所有 state 字段都需要跨标签页同步。需要 `filter: (key) => !key.startsWith('_local')` 机制。但 `createStore` 的 state 是扁平的（`Record<string, T>`），有些嵌套字段可能需要局部排除。
3. **同步频率与批量**——实时同步可能导致标签页间繁忙的来回通信（标签页 A 设置主题 → 发送 → 标签页 B 收到 → 设置主题 → 触发通知 → 但 A 不应再次更新）。需要**来源追踪**机制，避免回环。

**预期的架构变更**

```
packages/core/src/sync/               # 新增目录
    - createCrossTabBus.ts            # BroadcastChannel 封装
    - syncable-store.ts               # store + 同步包装
    - sync-filter.ts                  # 字段过滤
    - origin-tracker.ts               # 避免回环

插件：
    plugin-cross-tab-sync/            # 新增插件包
        - react/vue/solid/svelte      # 四框架插件

对现有系统的影响：
- createStore 不自带同步能力——同步是通过 syncable-store 包装器或插件添加的
- 不开启同步的场景（单标签页）不受影响，无额外开销
- 开启同步后，每个 setState 会触发 BroadcastChannel.postMessage
```

---

## 3. 接口设计建议

### 3.1 原则

**原则一：新增而非修改。** 五个方向都不应修改现有接口。`createDataSource` 保持原样，新增 `createRealtimeDataSource`；`createStore` 保持原样，新增 `syncable-store` 包装器。这保证了向后兼容性。

**原则二：包装器模式优先于基类继承。** `withUndo(store)` > `UndoableStore extends Store`。包装器不改变 store 的类型结构，只需 `store.getState()` 和 `store.setState()` 两个方法即可介入。这使得 undo 可以叠加在已有 store 之上而不需要改造 store。

**原则三：配置驱动，按需开启。** 实时订阅、跨标签同步、持久化都应通过配置参数开启，默认关闭。用户引用 `createDataSource` 时不需关心实时层，引用 `createStore` 时不需关心同步层。

**原则四：插件封装 > core 内置。** 跨标签同步（方向五）应作为插件发布，而非内置到 core。这在 AGENTS.md 的 B 类规则中已经明确——「B 不用不进包」。实时订阅层可以视情况：核心接口（`createRealtimeDataSource`）放 core，但 WebSocket 传输实现可以放插件。

### 3.2 是否需要引入新的抽象层

**需要引入两个新的抽象层：**

**A. 持久化抽象层（`@iris-ui/core/persist`）**

方向四和方向五需要同一个底层能力：state 的序列化/反序列化/存储。当前 `ProfileStorage` 已经是接口，但仅限 profile。需要扩展为通用的 `PersistStorage` 接口：

```
interface PersistStorage {
  load<T>(key: string): T | null
  save<T>(key: string, value: T): void
  delete(key: string): void
}
```

实现包括 `localStoragePersist`、`indexedDBPersist`、`remoteSyncPersist`。这个抽象层被方向四（持久化）和方向五（跨标签同步）共享。

**B. 通信抽象层（`@iris-ui/core/messaging`）**

方向一（实时订阅）、方向二（跨窗口总线）、方向五（跨标签同步）都需要通信能力。当前系统零通信抽象。需要：

```
interface MessageBus {
  emit(channel: string, payload: unknown): void
  on(channel: string, handler: (payload: unknown) => void): () => void
  close(): void
}
```

实现包括 `broadcastChannelBus`、`webSocketBus`、`sharedWorkerBus`。这个抽象层被方向一、二、五共享，避免每个方向各自实现通信协议。

### 3.3 向后兼容性

五个方向均可零破坏实现：

| 方向 | 核心变动                                               | 向后兼容策略                                              |
| ---- | ------------------------------------------------------ | --------------------------------------------------------- |
| 一   | 新增 `createRealtimeDataSource`                        | 不修改 `createDataSource`；消费方选择使用哪个             |
| 二   | 新增 `CrossWindowDragPayload` + `createCrossWindowBus` | 不修改 `createSortable`；桌面 OS apps 选择注册 drop zones |
| 三   | 新增 `createUndoStack`                                 | 不修改现有 store；`withUndo` 是可选包装                   |
| 四   | 新增 `createPersistedStore`                            | 不修改现有纯内存模块；持久化通过配置选项开启              |
| 五   | 新增 `syncable-store` 包装器/插件                      | store 默认不同步；同步通过插件按需引入                    |

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

**不需要引入外部框架级依赖。** 五个方向都可以在现有技术栈内实现：

| 方向 | 所需技术                             | 是新增依赖？     | 理由                                               |
| ---- | ------------------------------------ | ---------------- | -------------------------------------------------- |
| 一   | WebSocket / SSE / `BroadcastChannel` | 否（浏览器原生） | 无需 polyfill，现代浏览器全支持                    |
| 二   | `BroadcastChannel` / `DataTransfer`  | 否（浏览器原生） | DataTransfer 兼容性需测试旧浏览器                  |
| 三   | 纯逻辑（JSON diff / snapshot）       | 否               | 可选 `rfdc` 或 `structuredClone`，都在 core 中已用 |
| 四   | `localStorage` / `IndexedDB`         | 否（浏览器原生） | IndexedDB 需要封装层                               |
| 五   | `BroadcastChannel` / `SharedWorker`  | 否（浏览器原生） | SharedWorker 是可选增强，非必选                    |

**唯一需要评估的第三方依赖**：`idb-keyval`（IndexedDB 封装）或 `localforage`，用于方向四的 IndexedDB 持久化。两者都是 1KB 级、零依赖的工具库，可以简化 IndexedDB 的版本管理和事务处理。

### 4.2 第三方依赖的评估标准

方向四和方向五涉及持久化和通信，可能会考虑引入第三方库。评估标准如下：

1. **包大小上限**：方向四/五的持久化/通信层在 core 中应 ≤ 2KB（minified + gzipped）。如果第三方库超过此限制，应自建实现。
2. **零框架依赖**：core 层的依赖必须框架无关。`localforage` 没问题，但任何依赖 React/Vue/Solid/Svelte 的库不可接受。
3. **浏览器兼容性**：BroadcastChannel / SharedWorker / IndexedDB 在现代浏览器（Chrome 85+, Firefox 80+, Safari 14+）中可用。Iris UI 的兼容性目标应重新确认——如果支持 IE11，方向一/二/五需要 polyfill。
4. **类型安全**：必须提供 TypeScript 类型声明。浏览器原生 API 的封装需要 `@types/` 或自带类型。

### 4.3 自建 vs. 采购的决策依据

| 能力             | 自建                       | 采用外部库                 | 决策                                                                |
| ---------------- | -------------------------- | -------------------------- | ------------------------------------------------------------------- |
| 持久化存储       | IndexedDB 封装（~200 行）  | `idb-keyval`（1KB）        | **建议用 idb-keyval**——稳定，开源已久，零依赖                       |
| JSON diff/patch  | `createUndoStack` 快照差异 | `fast-json-patch` / `diff` | **建议自建**——undo 栈不需要通用的 JSON diff，只需要能还原的操作记录 |
| WebSocket 重连   | 自定义状态机               | `reconnecting-websocket`   | **建议自建**——重连逻辑简单，且可以与 `createMachine` 集成           |
| BroadcastChannel | 原生封装（~50 行）         | 无成熟库                   | **自建**——太简单，不需要外部依赖                                    |
| 跨窗口 DnD       | 自定义协议                 | 无成熟浏览器方案           | **自建**——浏览器原生不支持，必须自建模拟层                          |

---

## 5. 实施路线图

### 5.1 优先级排序

基于三个维度的综合评估：

- **用户影响面**：多少用户/场景受益
- **技术风险**：实现难度和不确定性
- **依赖关系**：是否被其他方向前置依赖

| 排序 | 方向                     | 用户影响面         | 技术风险 | 被其他方向依赖         | 综合优先级 |
| ---- | ------------------------ | ------------------ | -------- | ---------------------- | ---------- |
| 1    | 撤销栈（三）             | 全部组件用户       | 低       | 无                     | **P0**     |
| 2    | 持久化（四·Phase 1）     | 桌面 OS / CMS 用户 | 低       | 被方向五依赖           | **P0**     |
| 3    | 跨标签同步（五·Phase 1） | 多窗口用户         | 低       | 依赖方向四 Phase 1     | **P1**     |
| 4    | 实时订阅（一）           | 监控/协作插件用户  | 中       | 无                     | **P1**     |
| 5    | 跨窗口 DnD（二）         | 桌面 OS 用户       | 高       | 依赖方向五（消息总线） | **P2**     |

**修正说明**：核查报告修正了 FormStore 的 undo 存在性，但方向三（撤销栈）的优先级不因此降低——DataSource / Kanban / AdminShell / Dashboard 的 undo 缺口仍是真实的。FormStore 的实现反而是资产而非负债，使得方向三的技术风险从「中等」降为「低」。

### 5.2 阶段划分

#### Phase 0 — 基础设施（2 周）

```
目标：建立两个共享抽象层
产出：
  1. packages/core/src/persist/ — PersistStorage 接口 + localStorage / IndexedDB 实现
  2. packages/core/src/messaging/ — MessageBus 接口 + BroadcastChannel 实现

验收标准：
  - PersistStorage 可以 save/load/delete 任意 JSON 序列化数据
  - MessageBus 可以 emit/on/close 跨标签页消息
  - 两个抽象层均有单元测试（含 mock 实现）
  - 零依赖（IndexedDB 封装借助 idb-keyval 或自建，需在此阶段决策）
```

#### Phase 1 — 高价值快速交付（4 周）

```
目标：解决两个最紧迫的数据耐久性问题
产出：
  1. 持久化（方向四 Phase 1）：VFS / ClipboardHistory / NotificationCenter 从纯内存 → localStorage/IndexedDB
  2. 撤销栈（方向三）：createUndoStack + withUndo → 接入 DataSource → 接入 Kanban

验收标准：
  - 刷新后 VFS 文件不丢失、剪贴板历史不丢失、通知中心不丢失
  - DataSource 的 mutate/mutateRow 支持 ctrl+z 撤销
  - Kanban 的 moveCard/addCard/removeCard 支持撤销
  - FormStore 的历史栈替换为 createUndoStack（重构而非重写）
```

#### Phase 2 — 多实例一致性（4 周）

```
目标：实现跨标签页状态同步
产出：
  1. 跨标签同步（方向五 Phase 1）：BroadcastChannel-only 版本
     - skin / profile / i18n 三个 store 接入同步
     - 来源追踪避免回环
  2. plugin-cross-tab-sync: 四框架插件包装

验收标准：
  - 标签页 A 切换主题 → 标签页 B 半秒内跟随
  - 标签页 A 更改语言 → 标签页 B 半秒内切换
  - 关闭同步不影响单标签页性能
  - 同步状态可在运行时动态开启/关闭
```

#### Phase 3 — 实时与交互（6 周）

```
目标：实现推送数据能力和跨窗口通信
产出：
  1. 实时订阅（方向一）：createRealtimeDataSource
     - WebSocket 传输实现
     - 连接状态机（指数退避 + jitter）
     - replace/append/patch 三种合并策略
  2. 跨窗口 DnD（方向二 Phase 1）：跨窗口拖放协议 + 消息总线
     - CrossWindowDragPayload 类型系统
     - createCrossWindowBus 基于 MessageBus 封装的 app 级总线
     - 桌面 OS demo 接入：Files → Data / Files → Photos

验收标准：
  - createRealtimeDataSource 可以通过 WebSocket 订阅实时数据
  - 实时数据源 + 拉取数据源可以共存于同一个 ResourceController
  - 跨窗口拖放在桌面 OS demo 中可用（Files → Drop to Data）
  - 桌面 OS 窗口间可以 emit/on 自定义事件
```

### 5.3 风险点和缓解策略

| 风险                                | 概率 | 影响 | 缓解策略                                                                                                                              |
| ----------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| direction-ception（方向间过度耦合） | 中   | 高   | 使用共享抽象层（PersistStorage + MessageBus）解耦；方向二的 `createCrossWindowBus` 基于 MessageBus 而非硬编码 BroadcastChannel        |
| IndexedDB 5MB 限制（VFS 大文件）    | 低   | 中   | Phase 0 预研时评估实际文件大小分布；大文件场景使用 `Origin Private File System` 而非 IndexedDB                                        |
| BroadcastChannel 在跨域场景失效     | 低   | 中   | 文档明确「同源多标签页」，若需跨域由 `SharedWorker` 桥接（跨域场景暂不纳入 Phase 2）                                                  |
| WebSocket 重连导致的竞态风暴        | 中   | 高   | 共享 `createMachine` 的连接状态机 + `AsyncResource.token` 令牌保护；合并策略从 `replace` 起步，延迟 `patch` 到 Phase 4                |
| 跨窗口 DnD 的浏览器兼容性           | 高   | 中   | 将此方向标记为 P2，作为探索性实验而非发布承诺；Phase 3 结束时评估是否可落地                                                           |
| 持久化拖慢首次加载                  | 中   | 低   | `createPersistedStore` 使用异步加载（`load()` 返回 Promise），在数据就绪前显示 skeleton UI                                            |
| undo 历史栈内存膨胀                 | 低   | 低   | `createUndoStack` 支持 `max: number` 选项（默认 50），并通过 `structuredClone` 替代 `JSON.stringify/parse` 以支持非 JSON 安全的 state |

### 5.4 架构师的一句话建议

首先解决数据耐久性问题（方向四 Phase 1 + 方向三），让用户数据在刷新后不丢失、在编辑后可回退。这是生产级框架的入场券。跨窗口拖放（方向二）虽然 ROI 最高，但技术风险也最高——建议定位为 P2 的实验性能力，在 Phase 3 结束时评估是否进入发布通道。
