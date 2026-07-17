以下是基于对实现代码、项目架构文档（AGENTS.md）和现有控制器（特别是 `form.ts` 中手写的撤销）的深入审查得出的架构分析。

---

# 架构分析：通用撤销/重做引擎

## 1. 架构评估

### 1.1 优势

| 维度           | 评估                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **关注点分离** | `core/undo.ts` 零框架依赖；四个适配器桥接各框架的反应式系统 —— 完美遵循 Iris 设计原则（"逻辑下沉 core，适配器做薄桥"）            |
| **泛型设计**   | `<T>` 不要求 JSON 序列化，支持任何快照类型（对象、原始值、不可变数据）。这与 `form.ts` 的 `JSON.stringify/parse` 方式形成关键对比 |
| **双回调机制** | `equals`（跳过重复）→ `merge`（合并连续变更）的优先级顺序是正确的：如果状态没有变化，就不需要决定是否合并                         |
| **边界处理**   | `ensureBound` 不会在指针之后截断（`form.ts` 的 `history.shift()` 可能意外丢弃当前状态）；`maxHistory=0` 是完全零开销的 guard      |
| **测试覆盖**   | 核心 18 个测试 + React 10 个测试，覆盖基础生命周期、push/undo/redo/clear、合并策略、边界条件、对象快照                            |
| **构建集成**   | 子路径导出（`@iris-ui/core/undo`）遵循现有模式；`tsup.config.ts` 构建入口添加正确                                                 |

### 1.2 局限性

**L1：没有观察者/订阅机制 —— 桥接代码重复**

四个框架桥接器各自实现了相同的无状态→反应式模式（`bump`/`sync`/`setState`/`$state`），每个约 50 行。这是一个已接受的设计权衡（"四条薄桥"），但它带来持续的成本：

- **错误面**：四个并行实现中的微妙 bug（例如 React 的 `bump` 只在 `result !== undefined` 时触发，而 Vue/Solid/Svelte 每次都同步）。目前逻辑是一致的，但这不是类型强制保证的。
- **惯性**：对核心行为的每次更改（例如添加新方法 `peek()`、`replaceTop()`）都需要更新所有四个桥接器。

**L2：快照与命令 —— 内存效率**

每次 `push` 存储一个完整的 `T`。对于大状态（复杂表单、大型表格行、文档内容），这可能导致显著的内存使用。`form.ts` 通过 JSON 序列化部分缓解了这个问题（字符串共享），但失去了非可序列化类型的能力。

**L3：`form.ts` 仍在手写撤销逻辑**

`packages/core/src/form.ts`（第 256-728 行）维护自己的 `string[] history` 和 `let historyIdx`，使用 `JSON.stringify/parse` 进行快照操作。这与通用引擎的功能重叠：

| 功能           | `form.ts` 手写实现                    | 通用 `createUndoStack<T>`         |
| -------------- | ------------------------------------- | --------------------------------- |
| 存储格式       | `string[]` (JSON)                     | `T[]` (原始类型)                  |
| 相等性判断     | 字符串比较                            | 可配置 `equals` 回调              |
| 合并           | 不支持                                | 可配置 `merge` 回调               |
| 边界截断       | `history.shift()`（可能丢弃当前状态） | `ensureBound()`（保留指针及之后） |
| 非可序列化类型 | ❌ 不支持                             | ✅ 原生支持                       |
| 复用性         | 仅限 form                             | 任何 controller                   |

**L4：无事务/分组支持**

没有机制将多个 `push` 分组为一个撤销步骤。`merge` 回调仅合并连续的相同字段编辑，但不支持更复杂的模式，如"输入姓名 → 输入邮箱 → 提交"被视为一个步骤。

**L5：无异步撤销/重做**

撤销/重做操作是同步的。对于涉及异步反转操作的场景（如"删除行"需要调用 API 恢复数据），无法表达。

### 1.3 架构债务评估

| 债务类型                          | 严重程度 | 描述                                                                                                                                                      |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **重复** (L3)                     | 中       | `form.ts` 中的手写撤销是通用引擎的直接重复。由于它们使用不同的机制（JSON vs 泛型），这不仅仅是风格问题 —— 它是功能差距（form 不支持合并、非可序列化类型） |
| **缺乏观察者** (L1)               | 低       | 桥接器复制粘贴近 50 行模式代码。如果将来添加第三个核心方法（如 `peek`），需要四次相同的更改                                                               |
| **`UndoStackReactiveState` 重复** | 低       | 相同的接口在四个桥接器包中声明。应该从 core 导出                                                                                                          |

---

## 2. 扩展方向

### 方向 A：`form.ts` 迁移到通用撤销引擎（P0）

**为什么需要：**

- 消除重复的撤销逻辑 —— 统一核心数据路径下所有有状态控制器的撤销行为
- 为 form 用户解锁 `merge` 策略（例如合并连续同字段编辑）
- 使 form 能够处理非可序列化字段值（Date、Map、自定义类），这是当前 `JSON.stringify` 方法的一个已知痛点
- 减少核心包中的总字节数（手写撤销 ~30 行 vs 重用 ~180 行的引擎）

**核心挑战：**

1. **快照范围不匹配**：form 的当前撤销快照仅存储 `values`（通过 `store.getState().values`），不包括 `errors/touched/dirty/isSubmitting`。通用 `UndoStack<FormValues>` 自然适配 —— 但需要确保 form 的 `setFieldValue/setValues/arrayPush` 等所有突变路径在更改后调用 `undoStack.push(store.getState().values)`。

2. **`reset` 行为**：Form 的 `reset` 清除撤销历史。通用引擎的 `clear()` 移除了所有内容，包括初始快照。需要在 `clear()` 后重新推送初始快照。

3. **序列化兼容性**：某些 form 消费者可能间接依赖 JSON 序列化行为（例如，他们可能期望 Date 对象被字符串化）。这是隐式的且不太可能 —— 但迁移后需要验证。

**预期架构变更：**

```
// 之前 (form.ts ~line 256-730)
const history: string[] = []
let historyIdx = -1
const saveSnapshot = () => { JSON.stringify(...) ... }
// undo/redo 内联操作 history

// 之后 (form.ts)
import { createUndoStack } from '../undo'
const undoStack = createUndoStack<V>({
  maxHistory: config.maxHistory,
  equals: (a, b) => a === b,  // 引用比较；form 控制何时推送
  initial: config.initialValues,
})
// saveSnapshot() 调用 undoStack.push(store.getState().values)
// undo/redo 调用 undoStack.undo()/redo() 并应用到 store
```

**对现有系统的影响：**

- 对外 API 不变（`form.undo()`, `form.redo()`, `form.canUndo()`, `form.canRedo()`）
- `FormStore<V>` 接口不变
- form 测试需要更新，但断言语义保持不变
- 这一变化纯粹是内部重构

**风险：低。** 测试覆盖率高（form.test.ts 包含撤销/重做测试）；更改是机械性的。

---

### 方向 B：撤销栈观察者 API —— 消除桥接器样板代码（P1）

**为什么需要：**

- 目前每个框架桥接器通过包装所有方法实现状态同步：调用核心 `push()` 后，桥接器触发 `bump()`/`sync()` 以更新反应式状态
- 将 `subscribe`/`onChange` 添加到核心 `UndoStack` 可将 ~40 行桥接器样板代码减少为 ~10 行
- 降低四个桥接器出现分歧错误的风险
- 当添加新方法（如 `peek()`、`batch()`）时，桥接器更改最小化

**核心挑战：**

1. **零依赖原则**：core 目前没有任何外部依赖。添加订阅原语（`subscribe/unsubscribe`）需要一个侦听器列表 —— 可以用纯 TypeScript 在 ~10 行内完成，无需外部库。
2. **通知粒度**：每个方法调用都通知，还是仅当 `canUndo/canRedo/depth/index` 实际更改时才通知？前者更简单，后者避免了不必要的渲染。建议：在 `push`/`undo`/`redo`/`clear` 后始终通知（因为消费者始终希望反应式绑定是最新的）。

**选项 A：基于订阅（推荐）**

```ts
interface UndoStack<T> {
  // ... 现有方法
  /** Subscribe to state changes (push/undo/redo/clear). Returns unsubscribe. */
  subscribe: (listener: (state: UndoStackReactiveState) => void) => () => void
}
```

- 优点：适用于所有框架；`UndoStackReactiveState` 作为快照发送
- 权衡：核心增加 ~15 行

**选项 B：getSnapshot（React 风格）**

```ts
interface UndoStack<T> {
  getSnapshot: () => UndoStackReactiveState
  subscribe: (onStoreChange: () => void) => () => void
}
```

- 优点：React 桥接器可以直接 `useSyncExternalStore(stack.subscribe, stack.getSnapshot)`，无需 `useState` hack
- 权衡：非 React 框架需要更多封装

**选项 C：保持现状（无订阅）**

- 优点：core 保持最小
- 权衡：桥接器样板代码持续存在；新方法需要四次适配器更改

**建议：选项 A，** 因为它平衡了简洁性和框架灵活性。Vue 使用 `watchEffect`，Solid 使用 `createEffect`，Svelte 使用 `$effect` 订阅。

**对现有系统的影响：**

- 核心：添加 `subscribe` 到 `UndoStack` 接口和实现（非破坏性）
- 桥接器：可选择更新为使用 `subscribe`（向后兼容；它们可以继续包装方法）
- 如果将来添加 `peek()`/`batch()`，桥接器更新仅限于添加一个转发包装器

**风险：低。** 纯加法；不会破坏现有 `UndoStack<T>` 接口的消费者。

---

### 方向 C：事务/批处理撤销（P1）

**为什么需要：**

- 用户在语义上期望编辑组作为一个撤销步骤（例如"添加行 → 编辑字段 A → 编辑字段 B"应该一次撤销回到添加行之前的状态）
- `merge` 回调仅合并当连续编辑共享属性（如 `field === field`）时；这对跨字段原子操作没有帮助
- 常见的 UI 模式：拖放（"移除行 A → 插入行 B"作为一个操作）、对话框确认（在单个提交中编辑多个字段）

**核心挑战：**

1. **批处理边界**：批处理何时结束？选项：
   - 显式 `startBatch()/endBatch()`（最清晰，但 API 较重量级）
   - `batch(cb: () => void)` 并在回调完成时自动结束（如 Immer 的 `produce`）
   - 超时 guard：如果批处理在 N 毫秒后未关闭，则自动提交（有风险）
2. **嵌套**：如果一个控制器在批处理内部调用另一个控制器的撤销栈，会发生什么？
3. **空批处理**：如果批处理内部没有调用 `push`，就不应该添加步骤。

**选项 A：`batch(callback)`（建议）**

```ts
interface UndoStack<T> {
  batch(fn: () => void): void
  // fn 內部所有 push 被合并为单个 undo 步骤
}
```

实现方式：在 `fn` 开始时创建一个临时缓冲区；`fn` 内的 push 进入缓冲区，但不会清除重做历史；`fn` 返回时，`push(buffer compacted)` 被推送到主栈。

权衡：必须是同步的（回调中的异步操作无法批处理）。

**选项 B：`groupKey` 参数**

```ts
push(snapshot: T, groupKey?: string): T
```

使用相同 `groupKey` 的连续 push 合并为一个步骤。灵活性较低，但 API 更简单。

权衡：`groupKey` 仅适用于连续调用；交错组无法工作。

**建议：选项 A（`batch`）。** 与合并相比，这是更符合人体工程学的模式 —— 它明确地界定原子操作的边界。

**对现有系统的影响：**

- 核心：`UndoStack` 接口新增方法；实现中新增一个 ~30 行的 `batch` 方法
- 桥接器：每个桥接器需要一个 `batch` 转发包装器（如果方向 B 的观察者 API 已实现，则可以自动获取反应式更新）
- 测试：新增约 6 个批处理场景测试

**风险：中低。** 批处理逻辑是自包含的；与 `undo/redo`/`clear` 的交互已在快照层级得到良好定义。

---

### 方向 D：命令式撤销模式（可选层，P1-P2）

**为什么需要：**

- 快照式撤销对于普通状态（表单值、UI 状态）效果很好，但对于大状态（大表格的 10,000 行、文档编辑器内容）来说内存浪费严重
- 某些操作不能通过存储快照来反转（例如"发送 HTTP 请求"、"打开 WebSocket"）
- 命令模式支持每个操作的 `execute`/`undo` 逻辑，使得撤销/重做在语义上更丰富

**核心挑战：**

1. **与快照式栈共存**：命令撤销是平行概念，而非替代品。Iris 需要一个统一的撤销体验 —— 而不是"某些组件用快照，某些用命令"。
2. **序列化**：命令包含闭包和回调；它们不能序列化以持久化到 localStorage。
3. **逆操作证明**：编写一个总能正确反转其效果的 `undo` 方法在数学上很困难（特别是对于不可逆操作如"删除行"——被删除的数据必须捕获在命令中）。

**提议的接口：**

```ts
// packages/core/src/undo-command.ts (新模块)
interface Command<T> {
  /** Execute the command, applying the mutation to `state`. Returns the new state. */
  execute(state: T): T
  /** Reverse the command. Must perfectly undo `execute`. */
  undo(state: T): T
  /** Optional: merge with next command for coalescing. */
  merge?(next: Command<T>): Command<T> | undefined
}

interface CommandStack<T> {
  push(cmd: Command<T>): void
  undo(): Command<T> | undefined
  redo(): Command<T> | undefined
  // ...
}
```

**与快照栈的关系：**

```
SnapshotStack<T>         ← 简单用例（表单、UI 状态）
CommandStack<T>          ← 复杂用例（编辑器、CRUD 变更）

Iris 消费者可以选择一个，
但未来可以有一个统一接口
包装两者：
UndoEngine<T> = SnapshotStack<T> | CommandStack<T>
```

**建议：不要急于统一。** 先通过 `form.ts` 迁移来巩固 `SnapshotStack<T>` 作为基础。如果某个功能需求需要命令（例如 `plugin-pro-table` 中的 CRUD 操作的乐观突变撤销），则作为平行模块构建 `CommandStack<T>`。在至少两个实际消费者出现之前，不要统一。

**对现有系统的影响：**

- 纯加法（新模块 `undo-command.ts`）
- 无破坏性接口变更
- 测试新模块
- 构建：将新入口添加到 `tsup.config.ts`

**风险：中。** 命令撤销的正确性难以证明，需要彻底的测试。由于它是纯加法，风险是隔离的。

---

### 方向 E：插件集成和键盘快捷键（P1）

**为什么需要：**

- 在 admin shell 和 CMS 演示中，Ctrl+Z/Ctrl+Shift+Z 是用户期望的全局操作
- 编辑器可以在 `IrisProvider` 级别协调多个撤销栈（例如，哪个组件获得 Ctrl+Z 取决于焦点）
- 遵循已建立的插件模式（`createPlugin` + `IrisProvider(plugins=[...])`）

**提议的架构：**

```
packages/plugin-undo/
├── core/
│   └── index.ts          ← 框架无关（键盘绑定、管理器状态）
├── react/
│   └── index.ts          ← React 绑定（useGlobalUndo、IrisUndoProvider）
├── vue/...
├── solid/...
└── svelte/...
```

插件的注册：

```ts
createPlugin({
  name: 'undo',
  install(reg) {
    reg.registerStore('undo', () => createUndoManager())
    reg.registerKeybindings({
      'mod+z': (ctx) => ctx.getStore('undo')?.activeStack?.undo(),
      'mod+shift+z': (ctx) => ctx.getStore('undo')?.activeStack?.redo(),
    })
  },
})
```

**核心挑战：**

1. **焦点路由**：当多个撤销栈共存（例如，表单 + 内联编辑器 + 表格行编辑）时，Ctrl+Z 必须针对焦点所在的栈。这需要与 Iris 的焦点管理系统集成。
2. **全局与局部范围**：某些组件（如全局搜索对话框）应在对话框打开时劫持 Ctrl+Z。撤销管理器需要优先级/范围概念。

**选项 A：焦点跟踪（建议）**

撤销管理器维护一个栈栈（"撤撤销栈"）：获得焦点的组件在 mount 时注册，blur 时注销。Ctrl+Z 作用于栈顶。

**选项 B：作用域键绑定**

消费者显式地将 Ctrl+Z 绑定到特定组件。更安全但需要样板代码。

**选项 C：事件冒泡**

撤销事件像 DOM 事件一样从焦点元素向上冒泡。最灵活但实现最复杂。

**建议：从选项 A 开始。** 它符合用户期望（最后交互的组件获得 Ctrl+Z），并且可以增量实现。

**对现有系统的影响：**

- 新包 `plugin-undo`（遵循 `plugin-locale-zh`/`plugin-editor` 模式）
- 不与任何现有 API 冲突
- 向后兼容：没有插件的 IrisProvider 照常工作

**风险：低。** 插件系统是可选的；键盘快捷键是可选的。实现可以独立演进。

---

## 3. 接口设计建议

### 3.1 `UndoStack<T>` 接口原则

当前接口简洁、可组合、语义清晰。建议改进：

| 新增                  | 原因                                     | 设计原则                                                                             |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `subscribe`           | 消除桥接器样板代码；实现反应式绑定       | 最小通知：仅公开状态变化（`UndoStackReactiveState`），而不是内部数组突变             |
| `batch`               | 原子多步操作                             | 不添加 `batch` 到核心 `UndoStack` 接口，直到它在消费者中得到验证。最初作为实验性添加 |
| `peekUndo`/`peekRedo` | 预览功能（例如"撤销：删除行 X"工具提示） | 不移动指针；可用于实现"撤销预览"UI                                                   |

### 3.2 关于引入新抽象层

**`UndoStackReactiveState` 应移到 core：**

目前它在四个包中重复。这违反了 DRY。将其移到 `@iris-ui/core/undo`：

```ts
// packages/core/src/undo.ts
export interface UndoStackReactiveState {
  canUndo: boolean
  canRedo: boolean
  depth: number
  index: number
}
```

所有四个桥接器应导入此接口 —— 消除了 4×12 = 48 行重复。

**是否需要帮助函数？**

一个框架无关的工厂 `createUndoStackController<T>(options)` 可以封装 `UndoStack<T>` + 反应式状态同步，返回 `{ push, undo, redo, clear, subscribe }`。这将把桥接器减少到每个约 10 行。

但：这会引入一个在 core 和桥接器之间的"额外中间层"，而 Iris 的架构原则偏向于薄桥接器。建议：**在消费者请求之前不要添加。** 如果桥接器样式的重复被证明是一个真实问题（在多次方法添加后），可以在那时候提取这个层。

### 3.3 向后兼容性

所有扩展必须：

1. **在 `UndoStack<T>` 接口上添加新方法是可选的** —— 不破坏现有实现
2. **保持现有方法签名不变** — `push(snapshot: T): T`、`undo(): T | undefined` 等不得改变
3. **子路径保持稳定** — `@iris-ui/core/undo` 永远指向此模块

破坏性变更只有在以下情况下才考虑：

- 将 form 迁移到通用引擎（内部重构；对外接口不变）
- 将 `UndoStackReactiveState` 移到 core（符号从四个包消失；导入更新的消费者必须从 `@iris-ui/core/undo` 导入）

破坏 `UndoStack<T>` 接口本身的唯一理由：添加 `async undo()` 支持（方向 F）。这种情况应推迟到 P2 并仔细评估。

---

## 4. 技术选型

### 4.1 需要引入的新框架或技术栈？否

撤销引擎的当前技术栈（纯 TypeScript + 现有 Iris store 机制）完全足够。无需：

- ✅ **无新框架**（Immer/XState/MobX — 都不需要）
- ✅ **无新构建工具**（tsup 已处理多入口）
- ✅ **无运行时依赖**（核心保持零依赖）
- ✅ **无外部状态管理**（`createStore` 在 Iris 中已存在）

### 4.2 第三方依赖评估标准

对于 future 增强（命令模式、CRDT 用于协作撤销），依赖项应按以下标准评估：

| 标准                   | 问题                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| **捆绑包大小**         | 它是否使 core 超过当前的 10KB 预算？                                 |
| **框架无关性**         | 它是否导入 `from 'react'` 或 `from 'vue'`？如果是，它就不能进入 core |
| **树摇兼容性**         | 是 ES 模块吗？有 `sideEffects: false` 吗？                           |
| **测试基础设施兼容性** | 能否在 jsdom 中测试？是否能 mock 缺失的 API？                        |
| **消费者需求**         | 在引入之前，是否有至少两个独立的功能需要此依赖？                     |

### 4.3 自建 vs 采购决策

| 能力                 | 决策                      | 理由                                                           |
| -------------------- | ------------------------- | -------------------------------------------------------------- |
| 快照式撤销栈         | **自建** ✅               | 已构建；~180 行；完全满足需求                                  |
| 命令式撤销           | **自建**                  | 核心撤销引擎的自然进化；没有库提供 Iris 所需的精确类型安全契约 |
| CRDT 用于协作撤销    | **采购**（Automerge/Yjs） | 这是一个完整的研究领域；不应自建                               |
| undo/redo 键盘快捷键 | **自建**                  | ~50 行模式代码；与 Iris 焦点系统紧密集成                       |

对于命令模式：不要采购像 `undo-redo` 或 `redo-undo-middleware` 这样的库。它们缺乏泛型 `<T>`，并且其接口是针对 Redux 风格状态设计的，而不是 Iris 的控制器模式。Iris `createUndoStack` 已经是同类最佳 —— 命令模式只是在其基础上增加一个语义层。

---

## 5. 实施路线图

### 优先级矩阵

| 方向                  | 优先级 | 努力程度      | 风险 | 业务价值               | 技术价值                     |
| --------------------- | ------ | ------------- | ---- | ---------------------- | ---------------------------- |
| A: 表单迁移到通用引擎 | **P0** | 小（~1 天）   | 低   | 中（消除重复）         | 高（验证引擎设计；解锁合并） |
| B: 观察者 API         | **P1** | 小（~0.5 天） | 低   | 中（桥接器更简单）     | 高（减少重复；降低未来成本） |
| E: 插件集成           | **P1** | 中（~2 天）   | 低   | 高（Ctrl+Z 在 CMS 中） | 中（验证插件扩展点）         |
| C: 批处理             | **P1** | 小（~1 天）   | 中低 | 中（原子操作）         | 高（核心抽象能力提升）       |
| D: 命令模式           | **P2** | 大（~3 天）   | 中   | 中（编辑器、CRUD）     | 高（新抽象层）               |

### 阶段划分

**第一阶段：核心基础巩固（P0，第 1 周）**

```
里程碑：form.ts 使用 createUndoStack<V>，所有测试通过
```

- [x] 已实现：核心 `createUndoStack<T>` + 4 个桥接器 + 测试
- [ ] 重构 `packages/core/src/form.ts` 替换手写撤销为 `createUndoStack<V>`
- [ ] 更新 form 测试以验证新实现（断言语义不变）
- [ ] 将所有四个桥接器中的 `UndoStackReactiveState` 统一到 core 导出
- [ ] 运行完整的质量门（`pnpm turbo run test typecheck lint build`）
- [ ] 基准测试撤销性能（快照深度、push/undo/redo 延迟）

**交付物：** PR 包含 form.ts 重构 + 类型统一。所有现有测试不变通过。

**第二阶段：可观察性 + 批处理（P1，第 2 周）**

```
里程碑：UndoStack.subscribe + batch 已实现，
        四个桥接器通过 subscribe 简化
```

- [ ] 将 `subscribe` 添加到 `UndoStack<T>` 接口和实现
- [ ] 更新四个桥接器以使用 `subscribe`（可选，保持向后兼容）
- [ ] 将 `batch` 添加到 `UndoStack<T>`（包括防误用的超时 guard）
- [ ] core 测试：订阅生命周期、批处理边界、嵌套批处理
- [ ] 框架测试：使用新 API 的 React/Vue/Solid/Svelte
- [ ] 更新 API 文档

**交付物：** 两个新核心特性 + 简化的桥接器 + 测试。

**第三阶段：插件 + 键盘快捷键（P1，第 3 周）**

```
里程碑：plugin-undo 支持 Ctrl+Z/Ctrl+Shift+Z，
        在 admin shell 演示中展示
```

- [ ] 创建 `packages/plugin-undo/` 包结构
- [ ] 实现 `createUndoManager`（多栈焦点跟踪）
- [ ] 实现 React 桥接器 `useGlobalUndo`、`IrisUndoProvider`
- [ ] 实现 Vue/Solid/Svelte 桥接器
- [ ] 构建配置（tsup 数组 + svelte-package，遵循 plugin-editor 模式）
- [ ] 集成测试：admin shell 中的 Ctrl+Z
- [ ] 演示页面

**交付物：** 新插件包 + 四个框架绑定 + 演示。

**第四阶段：命令模式 + 展望（P2，第 4 周）**

```
里程碑：CommandStack<T> 作为可选平行模块，
        在 data-source 或 pro-table 中试点
```

- [ ] 在 `packages/core/src/undo-command.ts` 中设计和实现 `CommandStack<T>`
- [ ] 与 `SnapshotStack<T>` 集成（统一顶层接口？还是保持独立？—— 在此阶段决定）
- [ ] 在 `data-source.ts` 或 `plugin-pro-table` 中试点（乐观突变 + 撤销）
- [ ] 基准测试：快照与命令的内存使用
- [ ] 更新 `llms.txt` 和 manifest

**交付物：** 新命令模式模块 + 一个试点消费者 + 性能数据。

### 风险与缓解

| 风险                                 | 可能性 | 影响 | 缓解措施                                                                                          |
| ------------------------------------ | ------ | ---- | ------------------------------------------------------------------------------------------------- |
| **form.ts 迁移破坏了撤销行为**       | 低     | 高   | 测试覆盖完善；form 撤销测试确保语义不变；做A/B版本对比测试                                        |
| **`subscribe` API 设计与框架不兼容** | 低     | 中   | 遵循 `subscribe`/`unsubscribe` 模式（`useSyncExternalStore` 兼容）；所有四个框架的 reference 实现 |
| **批处理相互冲突（嵌套撤销栈）**     | 中     | 低   | 批处理实现为每栈；嵌套栈各自独立管理                                                              |
| **插件撤销在焦点管理上存在竞态条件** | 中     | 中   | 焦点跟踪使用同步事件（focusin/focusout），而非异步轮询                                            |
| **命令撤销的逆操作出错**             | 中     | 高   | 对每个命令进行彻底的单元测试；提供"强制快照"回退用于无法撤销的操作                                |

---

## 总结

当前撤销引擎实现是一个**执行良好的 A/B 类下沉**（遵循 Iris 原则）。核心引擎干净、测试完善且框架无关。四个桥接器遵循既定的"四条薄桥"模式。

**两个最重要的立即行动：**

1. **重构 `form.ts` 使用通用引擎**（P0） —— 这验证了引擎设计，消除了已识别的重复，并解锁了基于 form 的用例中的 `merge` 功能。这是核心积累验证的关键一步。

2. **添加 `subscribe` 到核心接口**（P1） —— 这降低了四个桥接器出现分歧错误的风险，并简化了所有 future 的方法添加。

插件集成（方向 E）具有最高的用户可见价值（Ctrl+Z 无处不在），但应建立在观察者 API 之上，以确保插件撤销管理器可以一致地跟踪多个栈。

命令模式（方向 D）应推迟到 P2，并一直推迟到出现需要它的实际消费者（很可能是 `data-source` 的乐观突变撤销或 `plugin-editor` 的文本编辑撤销）。过早抽象是不必要的风险。
