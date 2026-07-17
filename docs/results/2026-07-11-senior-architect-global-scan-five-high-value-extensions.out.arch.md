# 架构分析报告：Iris UI 五个高价值扩展方向

**分析人**：资深架构师
**时间**：2026-07-12
**输入**：`/home/u1/iris-ui/docs/requirements/2026-07-11-senior-architect-global-scan-five-high-value-extensions.md`
**代码验证范围**：`packages/core/src/{data-source,store,commands,form,form/*,sortable,cell-edit,resource,undo,undo.test}.ts` + 四框架 form 子路径

---

## 1. 架构评估

### 1.1 优势：当前状态之强

Iris UI 的 core→adapters 分层是经过实战验证的架构。代码阅读确认了几个关键设计胜利：

**核心层（core）已拥有大量基础设施，远超分析文档所述**。代码验证发现：

| 能力                  | 文档论断                   | 代码实况                                                         | 偏差             |
| --------------------- | -------------------------- | ---------------------------------------------------------------- | ---------------- |
| 表单数组操作          | "`createFormStore` 未暴露" | 已暴露 `arrayPush`/`insert`/`remove`/`swap`/`move`               | **文档低估**     |
| `useFieldArray` 钩子  | "四框架均缺失"             | 四框架均已存在                                                   | **文档严重低估** |
| 撤销/重做通用栈       | "完全没有 undo/redo"       | `packages/core/src/undo.ts` — 通用 `createUndoStack<T>()` 已就绪 | **文档严重低估** |
| 表单撤销/重做         | "需要新增"                 | `createFormStore` 已有 `undo()`/`redo()`/`canUndo()`/`canRedo()` | **文档低估**     |
| 表单持久化            | "无序列化"                 | 已有 `serialize()`/`hydrate()` 方法                              | **文档低估**     |
| 实时数据（WebSocket） | 建议新增                   | 确实不存在                                                       | **正确识别**     |
| 跨容器拖放            | 建议新增                   | 确实不存在                                                       | **正确识别**     |
| 通用 store 持久化     | "无统一抽象"               | 仅 form 和 skin 有特化存储，无通用 `persist()`                   | **正确识别**     |
| 命令撤销              | "Command 系统无 undo"      | `CommandRegistry` 确实无 undo 集成                               | **正确识别**     |

> **关键启示**：分析文档的「方向二（动态表单数组）」和「方向三（撤销/重做）」的实际缺口比文档描述小得多。核心基础设施已存在，差距在于 **跨框架适配层的封装质量 和 组件集成深度**。

### 1.2 局限性：真正的架构债

1. **实时数据基础设施为零**：`DataSource` 的 `fetcher` 签名（`(query, signal?) => Promise<>`）是纯 request-response 契约。无 `subscribe`/`stream`/`channel` 概念。这是一个架构层面的**能力缺口**，不是增量改进。

2. **`CommandRegistry` 功能单一**：它本质上是一个注册 + 模糊搜索 + 执行器。没有 undo/redo，没有持久化，没有组合/分解（macro），没有条件执行管道。通用 `createUndoStack` 存在但 **没有被 CommandRegistry 消费**。这是一个**集成缺口**。

3. **`createStore` 缺乏持久化钩子**：`Store<T>` 接口只有 `getState/setState/subscribe/subscribeWith/batch`。没有 `toJSON`/`fromJSON`/`onHydrate`/`persist`。每个需要持久化的组件（form、skin、未来一切）都在重复实现特化的序列化逻辑。

4. **`createSortable` 是单容器排序，不是通用 DnD**：没有跨容器、没有拖放区域概念、没有文件拖放、没有拖拽幽灵 API。这是一个**设计范围差距**——`createSortable` 的设计目标就是单容器排序，不是它做得不好。

5. **四框架适配器不对称**：虽然所有核心 API 在四框架都桥接了，但**高层次的开发体验钩子**（如 `useFieldArray` 在 Vue/Solid/Svelte 中存在，但 surface API 可能不如 React 完善）未经过统一审计。需要一次跨框架的 `useFieldArray` API 对齐审查。

### 1.3 关键设计决策是否合理

| 决策                        | 评判            | 理由                                                                              |
| --------------------------- | --------------- | --------------------------------------------------------------------------------- |
| 逻辑下沉到 core             | ✅ 正确         | 代码验证确认：四框架 form 子路径只做桥接，核心逻辑在 `form.ts`                    |
| `Store` 接口最小化          | ✅ 但可增强     | `subscribeWith` + `batch` 是正确的最小集合，但缺少 `persist` 钩子                 |
| `createUndoStack` 独立存在  | ⚠️ 正确但不完整 | 通用栈已就绪，但未被 `CommandRegistry` / `CellEdit` / `Sortable` 消费 — 集成债    |
| `CommandRegistry` 不做 undo | ❌ 可质疑       | 命令模式天然适合 undo/redo。不做 undo 是把集成责任推给每个命令的调用者            |
| 表单内有自己的 undo 栈      | ⚠️ 合理但冗余   | Form 的 undo 使用了 JSON 序列化快照，而通用的 `createUndoStack` 是泛型 — 两次实现 |
| 皮肤系统有特化持久化        | ⚠️ 合理         | 皮肤是 L0 基础设施，有特化存储合理；但本可复用通用 `persist()`                    |

---

## 2. 扩展方向（修正版）

基于代码验证，我重新评估五个方向的**实际工作量**和**优先级**：

### 方向 ①：实时数据订阅层（P0 — 最高价值）

**状态**：✅ 分析正确，完全未实现
**实际工作量**：高（新接口 + 适配器 + 兼容性 + 竞态处理）

#### 为什么需要

`DataSource` 是企业级数据引擎的核心。在 2026 年的应用生态中，没有实时能力意味着 Iris UI 的数据层只能服务「传统 CRUD」场景。WebSocket/SSE/Supabase 实时订阅是：

- **Admin Shell 标配**：通知、订单更新、协作编辑
- **CMS 差异化能力**：实时内容预览、多用户协作
- **桌面 OS 场景**：文件变更通知、进程状态流

#### 核心挑战

| 挑战                | 描述                                                                                                | 难度       |
| ------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| **流式 vs 快照**    | `DataSource` 的 `applyResult` 假设全量替换；流式突变需要 **增量合并**（upsert/delete/insert）       | ⭐⭐⭐     |
| **分页 + 实时冲突** | 实时插入第 1 行时，用户在第 3 页——行去哪？                                                          | ⭐⭐⭐⭐   |
| **竞态安全**        | 实时推送和用户操作并发修改同一行——`epoch` token 不足以处理**双向冲突**                              | ⭐⭐⭐⭐⭐ |
| **连接生命周期**    | 断线重连、消息队列回放、心跳——这些是系统级问题，不是组件问题                                        | ⭐⭐⭐     |
| **消费端适配**      | `createDataSource` 当前是同步工厂（`immediate` 加载），要支持「先加载快照，后订阅流」的两阶段初始化 | ⭐⭐⭐     |

#### 建议架构

不要尝试在现有 `createDataSource` 内部塞实时能力。相反，引入**可组合的中间件模式**：

```typescript
// 核心新抽象：独立的实时通道
engine RealtimeChannel<T> {
  subscribe(observer: { next(row: T), error(err), complete() }): Unsubscribe
  reconnect(): void
  close(): void
}

// 数据源增强：通过 compose 叠加
createRealtimeDataSource<T>(
  config: DataSourceConfig<T> & {
    channel: RealtimeChannel<T>  // 可选的实时通道
  }
): DataSourceController<T> & { realtime: { status, pause, resume } }
```

关键设计原则：

1. **`createDataSource` 不修改**——向后兼容第一条
2. **`createRealtimeDataSource` 包装前者**，在 `fetcher` 之上叠加 `channel`
3. **增量合并策略以插件形式注册**——默认提供 `upsertStrategy`/`appendStrategy`/`replaceStrategy`
4. **分页模式下的实时插入**——仅在当前页可见时直接晕染；否则仅更新 `total` + 显示「数据已变化」横幅

### 方向 ②：动态表单数组（P1 — 实际是「完善」，不是「新建」）

**状态**：❌ 文档严重低估——核心 + 四框架 `useFieldArray` 均已存在
**实际工作量**：低（完善文档 + 可选 `IrisFormArray` 原语组件 + 对齐审查）

#### 真正的缺口

代码验证确认：

- ✅ `createFormStore` 已暴露 5 个数组操作方法
- ✅ 四框架 `useFieldArray` 均已实现
- ✅ 表单已有 undo/redo、serialize/hydrate
- ❌ **无 `IrisFormArray` renderless 组件**——提供「添加按钮 + 每行删除 + 拖动排序」的开箱 UI
- ❌ **无按行提取验证错误的标准方式**——`errors['items.0.price']` 路径支持存在，但缺一个 `getRowErrors(index)` 便捷方法
- ❌ **无跨框架文档**——各框架的 `useFieldArray` API 未经统一审查文档化

#### 建议

将方向改为「Field Array DX 完善包」：

1. **框架对齐审查**：检查四框架 `useFieldArray` 的签名一致性
2. **`getRowErrors`/`getRowDirty` 便捷方法**添加到 `useFieldArray` 返回值
3. **可选 `IrisFormArray`**：renderless 组件，封装「添加按钮 + 拖动排序 + 自动索引管理」
4. **案例文档**：订单明细、权限编辑、动态表格的表单 demo

### 方向 ③：撤销/重做历史栈（P2 — 实际是「集成」，不是「新建」）

**状态**：❌ 文档严重低估——`createUndoStack` 通用引擎 + 表单内 undo 均已存在
**实际工作量**：中（集成 + 桥接，非新建）

#### 真正的缺口

代码验证：

- ✅ `packages/core/src/undo.ts`：完整的 `createUndoStack<T>` 工厂（maxHistory, merge, equals, initial, undo/redo/canUndo/canRedo, clear）
- ✅ `FormStore` 内部使用（独立的 JSON 快照实现）
- ❌ `CommandRegistry.run()` 不推入 undo stack
- ❌ `CellEdit.commitEdit()` 不推入 undo stack
- ❌ `Sortable` 不推入 undo stack
- ❌ 通用 `createUndoStack` 和 `FormStore` 内的 undo 各有一套实现——应统一

#### 建议

1. **使 `CommandRegistry` 可选包装 `createUndoStack`**：命令可以声明 `undo` 函数，`run()` 自动推入
2. **`CellEdit` 增加 `undoStack` 选项**：每次 commit 推入 `{ row, column, oldValue, newValue }`
3. **`Sortable` 增加 `undoStack` 选项**：`onDragEnd` 推入顺序快照
4. **考虑统一 FormStore 的 undo 使用通用 `createUndoStack`**——替代其手写的 JSON 快照栈，减少两份实现

### 方向 ④：通用跨容器拖放（P1 — 最高复杂度）

**状态**：✅ 分析正确，完全未实现
**实际工作量**：高（全新设计 + 四框架薄桥 + 与现有 Sortable 共存）

#### 为什么需要

- 看板（Kanban）跨列拖动
- 表单设计器（Form Builder）字段拖入
- 树 → 表拖动（CMS 资源管理）
- Transfer 组件拖放替代按钮
- 文件拖放上传

#### 核心挑战

| 挑战                         | 描述                                                                 | 难度       |
| ---------------------------- | -------------------------------------------------------------------- | ---------- |
| **与 `createSortable` 共存** | 现有系统已有拖放原语（`useDrag` + `createSortable`），新设计不能破坏 | ⭐⭐⭐     |
| **触摸设备**                 | `touchstart/touchmove/touchend` 桥接到 pointer events                | ⭐⭐⭐     |
| **跨 iframe**                | 拖出/入 iframe 需要 `postMessage` 桥接                               | ⭐⭐⭐⭐⭐ |
| **自动滚动**                 | 拖到容器边缘时自动滚动                                               | ⭐⭐⭐     |
| **多选拖动**                 | 同时拖动多个选中行                                                   | ⭐⭐⭐⭐   |
| **四框架适配**               | 指针事件监听 + 动态元素（drag overlay）每个框架有不同的声明方式      | ⭐⭐⭐     |

#### 建议架构

`createSortable` 保持不动（它解决了单容器排序这一特定问题）。新建独立的 `createDnDController`：

```typescript
// 核心抽象：独立的 DnD 控制器
createDnDController<T>(): DnDController<T>

interface DnDController<T> {
  // 注册拖放区
  registerDroppable(id: string, config: DroppableConfig): void
  unregisterDroppable(id: string): void

  // 注册可拖动项
  registerDraggable(id: string, config: DraggableConfig<T>): void
  unregisterDraggable(id: string): void

  // 事件驱动
  onDragStart: (e: PointerEvent) => void
  onDragMove: (e: PointerEvent) => void
  onDragEnd: (e: PointerEvent) => void

  // 状态
  getState(): DnDState
  subscribe: Store<DnDState>['subscribe']
}

// 四种 Behavior 组件（四框架各一套）
IrisDraggable / IrisDroppable / IrisDndProvider / IrisDragOverlay
```

**设计决策**：不尝试与 `createSortable` 合并。两个控制器专注于不同的语义——`Sortable` = 列表内排序，`DnD` = 跨容器 + 任意类型 + 自定义幽灵 + 多选。长远看可以将 `Sortable` 重写为 DnD 之上的一层封装（只允许同一容器内），但不必一开始就做。

### 方向 ⑤：状态持久化与 URL 同步（P0 — 次高价值）

**状态**：部分存在（form 有 serializ/hydrate，skin 有特化），其余为零
**实际工作量**：中

#### 真正的缺口

代码验证：

- ✅ `createFormStore`：`serialize()`/`hydrate()` 已就绪
- ✅ `skin` 包：`SkinStorage` 接口 + `localStorage` 实现已就绪
- ❌ `createStore`：无通用 `persist()` 装饰器
- ❌ `DataSource`/`ProTableStore`/`WindowManager`：无持久化
- ❌ URL searchParams 同步：完全不存在

#### 建议

完全同意分析文档的 `persist(store, config)` 设计。补充以下架构决策：

1. **`persist()` 是纯函数装饰器**，不是 `Store` 接口的方法——保持 `Store` 最小化
2. **多 storage 适配器的责任边界**：
   - `localPersistence()` / `sessionPersistence()`：纯同步，适合草稿/偏好
   - `urlPersistence()`：**只支持原始类型字段**（string, number, boolean, string[]），复杂对象自动降级到 localStorage + URL 只存 hashId
   - `serverPersistence()`：异步，需要 loading/error 状态（返回 `StoreWithSync<T>` 而非 `Store<T>`）
3. **SSR 策略**：`persist()` 返回的 store 在 SSR 环境下返回默认值，不读 `window`；adapter 层在 `useEffect`/`onMount` 执行 hydration

---

## 3. 接口设计原则

### 3.1 五个方向共同的接口原则

1. **零侵入**：所有新抽象以「包装器」或「可选参数」形式叠加，不修改现有接口签名。`createRealtimeDataSource(config)` 包装 `createDataSource(config)`，`persist(store, config)` 返回增强的 store。

2. **框架无关在前，薄桥在后**：`createDnDController` 接收纯数据（`PointerEvent` 坐标 + `DOMRect`），返回纯状态（`activeId`/`overId`/`dropZone`）。四框架的 `IrisDraggable`/`IrisDroppable` 只做 DOM 绑定+事件监听。

3. **可组合性优先于功能完备**：实时通道 `RealtimeChannel` 是可插拔的；undo 栈 `UndoStack` 是被 `CommandRegistry`、`CellEdit`、`Sortable` 各自独立消费的；`persist()` 可以被任何 store 消费。

4. **默认安全**：实时通道在断开时不丢数据（内部队列 + 重连回放）；undo 操作在边界条件下（最大栈满、被 invalidate）应该有定义良好的行为。

### 3.2 是否需要新抽象层

| 方向     | 新抽象                            | 所属包               | 动机                                    |
| -------- | --------------------------------- | -------------------- | --------------------------------------- |
| ① 实时   | `RealtimeChannel` 接口 + 适配器   | `core`（L0）         | 独立于 DataSource，下可被任何消费方使用 |
| ① 实时   | `createRealtimeDataSource`        | `core`（L1）         | 组合 DataSource + RealtimeChannel       |
| ④ DnD    | `DnDController` + 4 个 Behavior   | `core`（L0）+ 四框架 | 全新领域，与 Sortable 分开              |
| ⑤ 持久化 | `persist()` 函数（非 Store 方法） | `core`（L1）         | 纯函数装饰器，保持 Store 最小化         |

不需要新的抽象层：方向②是 API 完善，方向③是集成已有抽象（`createUndoStack` 整合到 `CommandRegistry` 等）。

### 3.3 向后兼容性策略

```
方向①: 新增 createRealtimeDataSource, 不改 createDataSource
方向②: 新增 getRowErrors/getRowDirty 到 useFieldArray 返回值（可选新字段）
方向③: 为 CommandRegistry 新增 undo/redo 方法，不修改 run 签名（通过选项开启）
方向④: 全新 createDnDController，createSortable 不动
方向⑤: 新增 persist() 函数，不修改 Store 接口
```

五个方向都是纯加法，零中断变更。

---

## 4. 技术选型与依赖评估

### 4.1 方向① 实时数据

| 方案                         | 优点                                    | 缺点                                              | 推荐度              |
| ---------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------- |
| **自建薄抽象**               | 框架可控、无外部依赖、tree-shaking 友好 | 需要实现 WebSocket/SSE 适配器                     | ⭐⭐⭐⭐⭐ **首选** |
| 引入 `@supabase/realtime-js` | 功能完备、协议成熟                      | 大依赖（~50KB gzip）、Iris 被迫了解 Supabase 协议 | ⭐⭐                |
| 引入 `socket.io-client`      | 功能最全                                | 60KB+、与 Iris "最小依赖" 原则冲突                | ⭐                  |

**建议**：自建约 200 行的 `RealtimeChannel` 接口 + 内置 `createWebSocketChannel`/`createSSEChannel`。第三方实时服务的用户自己实现适配器。这符合 Iris 的「B 类能力走插件」原则——如需 Socket.IO 支持，可出 `plugin-realtime-socketio`。

### 4.2 方向④ 跨容器 DnD

| 方案                                  | 优点                                    | 缺点                                       | 推荐度            |
| ------------------------------------- | --------------------------------------- | ------------------------------------------ | ----------------- |
| **自建**                              | 完全可控、大小可预计                    | 工作量大（触摸、自动滚动、跨 iframe）      | ⭐⭐⭐            |
| 基于 `@dnd-kit/core`                  | 成熟、触摸支持、多容器、自动滚动        | 已进化为 v6 但类型不稳定、React 绑定强耦合 | ⭐⭐              |
| 自建 + 可选的 `@floating-ui/dom` 定位 | 复用已有依赖（Iris 已使用 floating-ui） | 定位只是 DnD 的一小部分                    | ⭐⭐⭐⭐ **首选** |

**建议**：自建核心（`createDnDController` 纯逻辑，约 300-400 行），DOM 交互（`setPointerCapture`/`getBoundingClientRect`/scroll 事件）封装在四框架 Behavior 中。核心逻辑不依赖任何第三方。利用 Iris 已有的 `@floating-ui/dom` 做 drag overlay 的定位。

### 4.3 方向⑤ 持久化

零新依赖。`URLSearchParams` 和 `localStorage`/`sessionStorage` 都是 Web API。

---

## 5. 实施路线图（修正版）

### 5.1 重新排序的优先级

基于代码验证，我对文档推荐的启动顺序做修正：

| 阶段             | 方向            | 理由                                                                                                               |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Phase 1 (P0)** | ⑤ 状态持久化    | 最低难度、最高价值密度。persist() 是纯函数装饰器，可独立发布，且与现有 ProTable/Form/AdminShell 集成即可立竿见影   |
| **Phase 1 (P0)** | ① 实时数据订阅  | 最高差异化价值。工作量虽大但可独立开发，且不依赖其他方向                                                           |
| **Phase 2 (P1)** | ④ 跨容器拖放    | 最高复杂度但释放 plugin-form-builder 和 plugin-kanban 潜力。需独立设计，不与 Sortable 共享                         |
| **Phase 3 (P2)** | ③ 撤销/重做集成 | 核心基础设施已存在（`createUndoStack`），工作在于集成到 CommandRegistry/CellEdit/Sortable + 统一 form 内的两套实现 |
| **Phase 3 (P2)** | ② 表单数组完善  | 核心+四框架均已存在，工作量最低（完善 + 可选 IrisFormArray + 文档）                                                |

**推荐启动顺序**：⑤ → ① → ④ → ③ → ②

### 5.2 阶段划分和里程碑

#### Phase 1（预计 2-3 周）

| 里程碑 | 内容                                                                   | 可交付                                       |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------- |
| M1.1   | `persist()` 函数 + `localPersistence`/`sessionPersistence` 适配器      | `@iris-ui/core` 新子路径 `/persist`，纯 core |
| M1.2   | `urlPersistence` 适配器 + `pushState`/`replaceState`                   | 同上                                         |
| M1.3   | ProTable/Form 集成示例                                                 | apps 中 demo 页面                            |
| M1.4   | `RealtimeChannel` 接口 + `createWebSocketChannel` + `createSSEChannel` | `@iris-ui/core` 新子路径 `/realtime`         |
| M1.5   | `createRealtimeDataSource`                                             | 同上                                         |
| M1.6   | 测试覆盖（竞态安全、增量合并、断开恢复）                               | 核心单测 ~200 行                             |

**Phase 1 风险**：

- urlPersistence 的 2000 字符限制处理不当（缓解：自动降级到 hashId 引用）
- 实时增量合并与分页/排序/筛选的组合复杂度（缓解：从无分页的「实时列表」场景先做，分页模式后做）

#### Phase 2（预计 2-3 周）

| 里程碑 | 内容                                                                               | 可交付                               |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------------ |
| M2.1   | `createDnDController` 核心控制器                                                   | `@iris-ui/core` 新子路径 `/dnd`      |
| M2.2   | React Behavior 组件（IrisDraggable/IrisDroppable/IrisDndProvider/IrisDragOverlay） | `@iris-ui/react/behaviors`           |
| M2.3   | Vue/Solid/Svelte Behavior 组件同步                                                 | 四框架对齐                           |
| M2.4   | IrisTransfer 拖放模式                                                              | `@iris-ui/react/primitives/transfer` |
| M2.5   | IrisKanban 跨列拖放                                                                | `plugin-kanban`                      |

**Phase 2 风险**：

- 触摸设备兼容（缓解：先做桌面，触摸 v2）
- 与 `createSortable` 的边界模糊——用户该用哪个（缓解：清晰的 README 决策树）

#### Phase 3（预计 1-2 周）

| 里程碑 | 内容                                              | 可交付                                             |
| ------ | ------------------------------------------------- | -------------------------------------------------- |
| M3.1   | `CommandRegistry` undo/redo 集成                  | `@iris-ui/core`，`run(id, { trackHistory: true })` |
| M3.2   | `CellEdit` undo 集成                              | `@iris-ui/core/cell-edit`                          |
| M3.3   | `Sortable` undo 集成                              | `@iris-ui/core/sortable`                           |
| M3.4   | 统一 FormStore 的 undo 使用通用 `createUndoStack` | 重构（消除 JSON 快照实现）                         |
| M3.5   | `useFieldArray.getRowErrors`/`getRowDirty`        | 四框架                                             |
| M3.6   | `IrisFormArray` renderless 组件 + 文档            | `@iris-ui/react/primitives/form` + 四框架          |

### 5.3 风险矩阵

| 风险                                    | 概率 | 影响 | 缓解                                                             |
| --------------------------------------- | ---- | ---- | ---------------------------------------------------------------- |
| 实时增量合并复杂度超出预期              | 中   | 高   | 从「无分页实时列表」做起，分页实时作为 v2                        |
| 四框架 DnD Behavior 行为不一致          | 中   | 中   | 每个框架使用相同的核心控制器 + 测试契约                          |
| `persist()` 在 SSR 环境中出问题         | 低   | 高   | 所有 storage 适配器检查 `typeof window`                          |
| 跨容器 DnD 与 `createSortable` 用户混乱 | 中   | 低   | 文档 + 决策树 + `createSortable` 内部可重写为 DnD 之上的一层封装 |
| Phase 3 的 form undo 统一重构有回归     | 低   | 中   | 测试覆盖（已有 form.test.ts 1000+ 行）                           |

---

## 6. 补充发现（分析文档未覆盖）

### 6.1 技术债务发现

1. **`FormStore` 内的 undo 是通用 `createUndoStack` 的平行实现**：手写的 `history: string[]` + `JSON.stringify`/`JSON.parse` 实现。通用 `createUndoStack` 支持 `merge`/`equals`/`maxHistory`，FormStore 不支持这些功能。建议统一。

2. **`CellEdit` 缺少 undo 集成点**：`onCommit` 回调不接收 undo stack。这是 `plugin-pro-table` 的内联编辑无法撤销的根本原因。

3. **`createSortable` 的 `SortablePoint` 使用 `x/y` 而非 `dx/dy`**：当前设计记录绝对坐标，使得跨容器判断只能依赖 `closestCenter`，无法判断「从容器 A 的左侧边缘拖入」。如果日后要扩展为 DnD 的「方向感知」放置，可能需要补充。

4. **四框架 `useFieldArray` 的 API 一致性未审计**：虽然四个文件都存在，但返回值签名未经 cross-framework review。Solid 的 `replace` / Svelte 的响应性绑定可能存在细微差异。

### 6.2 跨方向组合的价值

有些真实场景需要多个方向的组合能力，这决定了它们应并行开发而非串行：

| 场景                           | 需要的方向 | 优先级                  |
| ------------------------------ | ---------- | ----------------------- |
| 实时表格 + 行级内联编辑 + 撤销 | ① + ③      | 高（CMS admin）         |
| 表单设计器拖放字段 + 撤销      | ④ + ③ + ②  | 高（Form Builder）      |
| 表格状态分享给同事（URL）      | ⑤          | 高（ProTable 用户体验） |
| 实时协作表单（如 Google Docs） | ① + ②      | 中（协作场景）          |

### 6.3 一个被遗漏的方向？MCP/Agent 能力进阶

分析文档未提及的方向：`CommandRegistry` 已有 `fuzzyPlanner`/`createLlmPlanner`/`toMcpTools`/`runMcpTool`。这意味着 Iris UI 已经有**让 AI agent 操作用户界面的管道**。这个方向的价值可能比前述五个都高，但需要产品层面的定义（agent 做什么？权限？可见性？）。

建议将此列为低调跟踪的 **方向⑥**，等文档站建立后与 AI 原点故事统一包装。

---

## 7. 总结

| 维度                   | 评估                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| 分析文档准确性         | **中等偏差**——低估了现有代码的成熟度（表单数组/undo/serialize 已存在），但对差距方向的识别基本正确 |
| 最高价值方向（修正后） | ⑤ 状态持久化 + ① 实时数据订阅层（并行启动，2 周内可交付）                                          |
| 最大复杂度方向         | ④ 跨容器拖放（需要全新设计，预计 2-3 周）                                                          |
| 最快实现方向           | ② 表单数组完善（1-2 天，主要是文档和对齐审查）                                                     |
| 架构债最严重处         | `CommandRegistry` / `CellEdit` / `Sortable` 无 undo 集成；`createStore` 无 persistence 钩子        |
| 建议延期方向           | ②（已存在，不值单独一个扩展 cycle）→ 合并到 ③ 作为附带改进                                         |
