现在我已充分掌握代码库，可以给出全面的架构分析了。

---

# 架构分析：Iris UI 的四大断层——设计检讨与战略路线图

以下分析针对验证文档中确定的四个架构缺损区域，并结合对源代码的直接取证（读取 `commands.ts`、`createFormStore`、`virtualizer.ts`、`profile.ts`、`data-view/tree.ts` 以及所有四条适配器的命令面板类型）。

---

## 1. 架构评估

### 1.1 优势

当前代码库在系统归属方面表现出少见的纪律性。通过对源代码的实际取证，证实了验证文档的结论：

- **CommandRegistry**（`packages/core/src/commands.ts`）是一个经过深思熟虑的抽象：包含子序列模糊匹配（`fuzzyScore`）、MCP 工具投影（`toMcpTools`/`runMcpTool`）、确定性规划器（`fuzzyPlanner`）和 LLM 规划器工厂（`createLlmPlanner`）。它是**三层架构**——注册、搜索/排序、投影——全部框架无关且完全可测试。
- **FormStore**（`packages/core/src/form.ts`）已经拥有 `dependencies` **的完整实现**（不仅仅是类型定义：第 303-310 行展示了 `setFieldValue` 中的 `for (const dep of dependencies[...]) scheduleValidate(dep)`），同时具备 `serialize()`/`hydrate()` 方法用于草稿管理，以及用于值去抖的 buffer+flush 架构，和用于处理异步校验器竞争条件的 per-field token。这是同规模库中见过的最完善的表单引擎之一。
- **Virtualizer**（`packages/core/src/virtualizer.ts`）使用了 Fenwick 树来实现 O(log n) 的度量更新和窗口计算——对于 100k 行场景，这比 O(n) 累积偏移重建要好得多。
- **Profile**（`packages/core/src/profile.ts`）提供了可插拔存储（`localStorageProfileStorage`、`httpProfileStorage`、`syncedProfileStorage`、`memoryProfileStorage`），以及用于分布式场景的 `mergeProfiles`——这比大多数"配置文件"抽象中见到的设计要好。

### 1.2 关键架构缺陷

验证结果确认了一个贯穿始终的模式：**核心实现了 A 级逻辑，但适配器/应用层消费的是 B 级替代品**。

| 区域       | 核心实现                                           | 适配器消费                                               | 缺口类型         |
| ---------- | -------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| 命令       | `CommandRegistry` + `fuzzyScore` + MCP 投影        | 每个适配器中重复的 `IrisCommandItem[]` + `defaultFilter` | **注册 vs 投影** |
| 树形虚拟化 | `createVirtualizer`（扁平）+ `flattenTree`（递归） | 无虚拟化的树                                             | **架构缺失**     |
| 表单       | 完整的 `dependencies` + `serialize`/`hydrate`      | 适配器中未连接的 `dependencies`；手动草稿                | **消费缺口**     |
| 公告       | 无核心模块                                         | 6 个重复片段中内联的 `aria-live`                         | **完全缺失**     |

### 1.3 未充分利用的资产

- **`resource.ts`（`ResourceController`）**：如果 `mutate` 钩子在成功/失败时调用中央公告器，它可以成为无障碍公告的自然枢纽。
- **`profile.ts`**：`hydrate()` + debounced `save()` 模式是一个现成的持久化管道，表单草稿可以通过它完成，无需额外基础设施。
- **`expansion.ts`/`selection.ts`**：已经为树形虚拟化的展开/折叠提供了控制器原语——适配器只需要连接它们。

### 1.4 技术债

- **三套不同的模糊搜索实现**：`commands.ts` 中的 `fuzzyScore`（分值越高越好，基于子序列）、各适配器 types.ts 中的 `defaultFilter`（分值越低越好，基于间隔）、以及 `CommandPalette.tsx` 中的内联 `filter` prop。每个都使用了不同的排序语义。
- **`IrisCommandItem` 跨四份适配器 types.ts 重复**：完全相同的接口（除 Vue 的 `icon?: string | VNode` 外）被复制了四次。如果核心定义了它，任何一处变更就需要修改四个文件。
- **`defaultFilter` 跨四份适配器重复**：完全相同的算法被复制了四次，其类型签名（`(query, item) => number | null`）与核心的 `fuzzyScore`（`(text, query) => number | null`）不同——参数顺序相反，返回值语义相反。

---

## 2. 扩展方向

### 方向 A：命令注册表——从本地 CRUD 到权威投影（P1→P0，带条件）

#### 为什么需要

当前注册表拥有系统中最强大的抽象——LLM 规划器、MCP 工具投影、子序列搜索——但它在边缘处被绕过。每个应用程序分别构建自己的 `IrisCommandItem[]`，使得命令无法被 AI 层发现。这是一个**架构杠杆**：命令注册表越是**权威的**，桌面 shell、CMS 和 AI 代理之间的集成就越强大。

#### 核心挑战

1. **命令接口不完整**：核心的 `Command` 缺少适配器使用的 `shortcut` 字段。在核心添加它需要一个 `shortcut?: string` 和可选的 `contextKeys?: string[]`。
2. **返回类型**：`Command.run` 返回 `Promise<void>`——没有返回值（"已执行" vs "失败" vs "成功，结果=X"）。这使得投影到 MCP 工具（期望结果）变得更困难。
3. **注册时序**：页面/应用程序在 mount 时注册命令，但命令面板可能在 mount 之前就已打开。注册表需要一个"延迟注册，面板重新搜索"的模式。

#### 架构变更

```txt
现状：
  app/page.tsx ──items[]──> IrisCommandPalette (自有过滤)
  desktop-os ──手动创建──> createLlmPlanner(registry)

目标：（双投影）
  app/page.tsx ──register()──> CommandRegistry (权威)
                                    ├── projection A: toMcpTools() → MCP / LLM
                                    └── projection B: useCommandRegistryBridge()
                                                          ↓
                                                    IrisCommandPalette
                                                    (消费投影，不自己做 CRUD)
```

- **新增**：`packages/core/src/commands-utils.ts` 中的 `useCommandRegistryBridge`（一个框架无关的工厂，从 registry 投影到适配器消费的 `IrisCommandItem[]`，处理字段映射 + `shortcut` 拉取）。
- **新增**：`Command.shortcut` 字段，`Command.run` 的 `Result` 返回类型。
- **向后兼容**：`IrisCommandPalette` 仍然接受 `items` prop——但如果通过 `IrisProvider` 注入了注册表，则**默认**使用注册表。

#### 对现有系统的影响

最小。适配器中的 `IrisCommandPalette` 保留其现有的 `items` prop（降级路径）。核心添加 `shortcut` 到 `Command` 是一个非破坏性扩展。CMS 应用程序逐步迁移，从 `items: pageCommands` 改为 `useEffect(() => registry.registerMany(pageCommands), [])`。

---

### 方向 B：树形虚拟化——从递归展开到窗口化层次结构（P2→P1）

#### 为什么需要

`IrisTree`（React 中约 480 行）、`IrisTreeSelect` 和 `IrisCascader` 都不使用虚拟化。包含 10k 个节点的数据集会导致 10k 个 DOM 节点——对于管理 CMS（层次文件浏览器、大型分类树）来说是不可接受的退化。`createVirtualizer` 已存在并支持 100k+ 行，但完全是扁平的。

#### 核心挑战

1. **展开锚定**：这是验证文档中正确识别的关键算法问题。当展开一个深层节点时：
   - `totalSize` 突增 N 行
   - 如果用户的 `scrollOffset` 位于展开位置之后，则偏移会漂移
   - 需要 `scrollOffset += totalSizeDelta` 补偿以防止视觉跳动

2. **深度感知的 `VirtualItem`**：当前 `VirtualItem` 只有 `{ index, key, start, size }`。树形虚拟化需要 `{ ...depth }`，以便渲染器知道缩进。

3. **带 O(可见) 的**延迟展平：`flattenTree` 当前是 O(n) 全量递归。树形虚拟化需要**惰性展平**——只展平视图窗口可见的部分，使用迭代遍历（存储栈）而非递归。

#### 建议的算法架构

```
createTreeVirtualizer(config):
  输入：roots, getChildren, getKey, estimateSize

  状态：expandedKeys: Set<string>
       measuredSizes: Map<string, number>  // key 驱动的度量缓存

  flatten(fromIndex, direction):
    // 迭代栈式遍历，从 fromIndex 开始向前或向后
    // 只访问直到填充 buffer 的节点数
    // 返回 VirtualItem[]（带 depth、start、size）

  toggle(key):
    记录 scrollOffset + firstVisibleKey
    如果展开：
      获取子节点数量（可能通过估算）
      将占位项插入展平列表
    如果折叠：
      从展平列表中移除子节点
    通过增量调整 scrollOffset → 防止跳动

  totalSize：所有可见项的 start + size 之和
```

已存在的原语（`data-view/tree.ts` 中的 `flattenTree`、`treeMatchKeys`、`withSortedChildren`）提供了基础——但 `createTreeVirtualizer` 不能直接复用它们，因为它们做的是**全量**递归展平。

#### 影响

`IrisTree` 内部重构以使用 `createTreeVirtualizer`。其公共 API 保持不变。`IrisTreeSelect` 和 `IrisCascader` 获得自动虚拟化作为消费者。需要一个单独的 `@iris-ui/core` 模块（~300 行），适配器中需要一个新的桥（每个约 80 行）。

---

### 方向 C：表单字段协议——从死类型到活依赖（P1，已具备完整实现基础）

#### 为什么需要

验证文档正确地注意到 `dependencies` 存在于类型中但处于"死态"——但实际源代码显示**它其实是完整的**：`createFormStore` 第 303-310 行：

```ts
if (validateOnChange) {
  scheduleValidate(key)
  for (const dep of dependencies[key as Key<V>] ?? []) {
    if (validators[dep]) scheduleValidate(dep)
  }
}
```

问题不是 `dependencies` 未实现（它已实现！），而是：

1. **适配器桥未暴露它**——Vue/React/Solid/Svelte 的 `useForm` 包装器没有将 `dependencies` 从配置透传到 `createFormStore`。
2. **条件字段可见性**（`showIf`/`when`）**完全缺失**——而它是 `dependencies` 的自然扩展。
3. **草稿集成**（`persist` 选项）是缺失的，尽管 `serialize()`/`hydrate()` 方法已就绪。

#### 建议

**条件字段协议**（3a 高级）：

```ts
FormConfig<V> 扩展：
  showIf?: Record<Key<V>, (values: V) => boolean>
```

在 `createFormStore` 内部：

- 在每次 `setFieldValue` 之后维护一个 `visibleFields` 派生集合
- 不可见字段跳过校验，但保留其值（为重新可见做准备）
- 适配器通过 `useField` 或一个单独的 `isFieldVisible(key)` getter 消费 `visibleFields`

**草稿集成**（3b，P1 提升）：

```ts
FormConfig<V> 扩展：
  persist?: {
    storage: ProfileStorage     // 复用已有的持久化接口
    key: string
    debounceMs?: number         // 默认 1000
    version?: number            // 草稿版本戳，用于过期检测
  }
```

在 `createFormStore` 内部，这在本质上是一个对 `serialize()` 的 debounced `subscribe` 调用，加上构造时的 `hydrate()`。现存的状态管理已经为这做好了准备——它只需要约 20 行的集成代码。

#### 对现有系统的影响

对适配器零影响，如果未配置 `showIf`/`persist`。向后兼容。适配器中需要最少的桥接代码来透传配置。

---

### 方向 D：中央 `aria-live` 公告器（P2，中等复杂度）

#### 为什么需要

当前状况：6 个组件各自管理自己的 `aria-live` 区域，产生关于相同事件的重复/冲突公告。没有可编程的 `announce(text, priority?)` API。像"已删除 3 个用户"这样的操作后公告要么写在每个页面的 `mutate` 回调中（不一致），要么缺失。

#### 关键设计决策

1. **放置**：自然位置在 `core`（一个新的 `announcer.ts`），通过 `IrisProvider` 提供。公告器在挂载时创建一个单一的隐藏的 `aria-live` 区域（或根据优先级创建两个区域："polite"和"assertive"）。

2. **节流 vs 去抖**：浏览器在 <50ms 内合并连续的区域突变。但公告器应该**去抖**（500ms 窗口内只保留最新消息），以防止像"用户删除了…用户删除了…用户删除了"这样的连发消息。

3. **队列**：不需要优先级队列。浏览器会在 50ms 帧边界自然合并。但公告器应该有一个**每个优先级一个槽位**的模式——如果 500ms 内两次调用 `announce("msg1", "polite")` 和 `announce("msg2", "polite")`，只有 `msg2` 被保留。

4. **与 Toast 的边界**：公告器替代 **Toast**。Toast 是带有操作的 UI——公告器是无障碍通知。两者可以共存：Toast 内部调用公告器作为其无障碍实现的一部分。

#### 关键集成点（验证文档中正确识别）

真正的杠杆（超出 60 行核心）是在**骨架**级别集成公告器：

- `resource.ts`：`mutate.onSuccess` → `announcer.announce("Deleted 3 users")`
- `data-view/pagination.ts`：`pageChange` → `announcer.announce("Page 5 of 20")`
- `selection.ts`：`selectAll` → `announcer.announce("All 50 rows selected")`

如果不做骨架集成，公告器只是一个低价值的工具——每页仍然需要手动 `announce()` 调用。

#### 影响

新增核心模块 ~100 行（包括节流/去抖）。每个适配器中约 20 行的桥接代码（`useAnnouncer` hook）。骨架集成约 150 行。已有 `IrisVisuallyHidden` 作为渲染层重用。

---

### 方向 E：热键注册表——命令的热键作为关联元数据（新 P3）

这个方向在验证文档中有提及，但值得作为一个独立的架构提案。

#### 为什么需要

`IrisHotkey` 行为是一个 `key → handler` 映射，目前在 props 处配置。如果命令可以声明其快捷键（`Command.shortcut?: string`），那么 `IrisHotkey` 可以从 `CommandRegistry` 订阅，这让快捷键发现成为自动的——应用程序无需既在注册表中注册快捷键又在 `IrisHotkey` 组件中重复它们。

#### 核心设计

```
Command { ..., shortcut?: string, contextKeys?: string[] }
                                    ↓
CommandRegistry ──watch──> IrisHotkey(registry shortcut)
                             (自动订阅快捷键变更)
```

这让"按 Ctrl+K → 搜索 → 执行"和"按 Ctrl+S → 注册表查找 → 执行"的流程统一。

---

## 3. 接口设计建议

### 3.1 四份适配器 types.ts 中的接口重复

`IrisCommandItem` 和 `defaultFilter` 在四个适配器中被复制。修复方案：

- **将 `IrisCommandItem` 移到 `@iris-ui/core`** 作为一个框架无关的类型。
- **将 `fuzzyScore` 提升**作为通用的核心搜索函数，并弃用四个适配器特定的 `defaultFilter` 副本。
- 适配器从 `@iris-ui/core` 重新导出类型以保持向后兼容。

但这与"核心不能包含框架特定类型"的原则相冲突。合理的做法是：`IrisCommandItem` 没有框架依赖——它只是一个 `{ id, label, keywords?, group?, icon?, shortcut?, disabled?, action? }` 的接口。它可以存在于 `@iris-ui/core/commands` 中，与其他框架无关的类型一起。

### 3.2 命令的适配层

验证文档正确地识别了 `CommandHit → IrisCommandItem` 的转型需求。建议引入：

```ts
// 在 @iris-ui/core/commands 中
export function commandToPaletteItem(cmd: Command): IrisCommandItem {
  return {
    id: cmd.id,
    label: cmd.title,
    keywords: cmd.keywords?.split(/\s+/) ?? [],
    group: cmd.group,
    icon: cmd.icon,
    shortcut: cmd.shortcut,
    disabled: cmd.enabled ? !cmd.enabled() : false,
    action: () => void cmd.run(),
  }
}
```

这是一个纯函数，零依赖——适合放在核心。

### 3.3 资源控制器的公告集成

资源控制器的 `mutate` 方法（`packages/core/src/resource.ts`）是公告集成的理想位置，因为它是 CRUD 操作的一致钩子。当前的 `MutateOptions` 有 `optimistic` 和 `skipReload`。添加一个可选的回调槽：

```ts
export interface MutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
  onSuccess?: (result: unknown) => void // 🌟 新增
  onError?: (error: unknown) => void // 🌟 新增
}
```

公告器通过 `onSuccess`/`onError` 连接，而非耦合到 `resource.ts` 中。这让应用程序选择自己的公告策略。

---

## 4. 技术选型

### 4.1 无需新增依赖

所有四个方向都可以用现有的技术栈解决：

- **命令注册表**：纯 TypeScript，零依赖。现有的 `fuzzyScore` 只需按 `IrisCommandItem` 重新校准。
- **树形虚拟化**：复用现有的 `createVirtualizer` + Fenwick 树。无需虚拟滚动库——Fenwick 树设计已支持 100k+。
- **表单依赖**：在 `createFormStore` 内部解决。无需校验库——它使用现有的 `StandardSchema` 接口。
- **中央公告器**：纯 DOM API（`aria-live` 区域 + `textContent`）。无需库。
- **热键注册表**：现有的 `IrisHotkey` 行为。只需从 props 驱动改为 registry 驱动的快捷键。

### 4.2 技术选型指南

| 决策               | 推荐                                 | 理由                                                                      |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------- |
| 树形虚拟化的滚动库 | 不引入，自建 `createTreeVirtualizer` | 现有 Fenwick 树提供了 O(log n) 的度量更新；树形版本只需添加深度和惰性展平 |
| 公告器的状态管理   | 复用 `createStore`                   | 核心已有完善的 store 抽象；适配器已有 `useStore` 桥接                     |
| 表单校验           | 不引入 Zod/Yup                       | `StandardSchema` 接口已是适配层；直接使用 `validate` 函数                 |
| 草稿存储           | 复用 `ProfileStorage`                | 已抽象 `localStorage`/HTTP/同步模式                                       |
| MCP 集成           | 不引入 SDK                           | `toMcpTools`/`runMcpTool` 是纯函数，可被任何 MCP SDK 消费                 |

---

## 5. 实施路线图

### 阶段划分

| 阶段        | 焦点                            | 持续时间 | 依赖    |
| ----------- | ------------------------------- | -------- | ------- |
| **Phase 0** | 核心接口补齐                    | 2-3 天   | 无      |
| **Phase 1** | 表单字段协议（条件字段 + 草稿） | 3-4 天   | Phase 0 |
| **Phase 2** | 命令注册表 → 命令面板桥接       | 4-5 天   | Phase 0 |
| **Phase 3** | 中央公告器 + 资源控制器集成     | 3-4 天   | Phase 0 |
| **Phase 4** | 树形虚拟化                      | 5-7 天   | Phase 0 |
| **Phase 5** | 热键注册表（可选）              | 2-3 天   | Phase 2 |

### 优先级矩阵

| 方向                | 价值（用户影响）         | 努力                                                           | 风险                   | 优先级 |
| ------------------- | ------------------------ | -------------------------------------------------------------- | ---------------------- | ------ |
| 表单条件字段 + 草稿 | 高（CMS 用户每天使用）   | 低（3-4 天，已有 `dependencies` + `serialize`/`hydrate` 基础） | 低                     | **P1** |
| 命令注册表桥接      | 高（AI 集成 + ⌘K 统一）  | 中（4-5 天，需接口补齐）                                       | 中（Command 接口变更） | **P1** |
| 中央公告器          | 中（无障碍合规需求）     | 低-中（3-4 天 + 骨架集成）                                     | 低                     | **P2** |
| 树形虚拟化          | 高（大树的用户可见性能） | 高（5-7 天，新算法）                                           | 中（展开锚定可能复杂） | **P2** |
| 热键注册表          | 低-中（电源用户功能）    | 低（2-3 天）                                                   | 低                     | **P3** |

### 具体任务分解

#### Phase 0：核心接口补齐（2-3 天）

1. 向 `Command` 添加 `shortcut?: string` 和 `icon?: string` ——它们是纯元数据字段，接口无风险。
2. 将 `IrisCommandItem` 类型导入到 `@iris-ui/core/commands` 中，使其成为跨四份适配器 types.ts 的单一真相源。在核心中定义为：
   ```ts
   // packages/core/src/commands.ts
   export interface IrisCommandItem {
     id: string
     label: string
     keywords?: string[]
     group?: string
     icon?: string
     shortcut?: string
     disabled?: boolean
     action?: () => void
   }
   ```
3. 为适配器新增 `commandToPaletteItem(cmd: Command): IrisCommandItem` 纯函数。
4. 在适配器的 types.ts 中将 `defaultFilter` 标记为 `@deprecated`，引用核心的 `fuzzyScore`。

#### Phase 1：表单字段协议（3-4 天）

1. 类型：
   - 向 `FormConfig<V>` 添加 `showIf?: Record<Key<V>, (values: V) => boolean>`。
   - 向 `FormConfig<V>` 添加 `persist?: { storage: ProfileStorage; key: string; debounceMs?: number; version?: number }`。
2. `createFormStore` 的实现：
   - **`showIf`**：在每次 `setFieldValue` 后添加一个 `computeVisibleFields()` 派生集合。不可见字段跳过校验但保留值。
   - **`persist`**：如果配置了，在构造时调用 `hydrate(storage.get(key))`，并添加一个对 `serialize()` 的 debounced subscribe。在 `reset` 和 `handleSubmit` 成功时调用 `storage.delete(key)`。
   - **`dependencies`**（确认实现）：`setFieldValue` 第 303-310 行已有。只需确保适配器桥透传此配置。
3. 适配器桥接：
   - 更新 `useForm`/`createForm` 桥以透传 `showIf` 和 `persist`。
   - 新增 `isFieldVisible(key): boolean` getter。
4. 测试：
   - 条件字段：值在隐藏时保留，在可见时校验，级联隐藏/显示。
   - 草稿：持久化-dans 周期（构造 → 编辑 → 页面关闭 → 恢复 → 提交 → 清理）。

#### Phase 2：命令注册表桥接（4-5 天）

1. 核心：
   - 将 `IrisCommandItem` 和 `commandToPaletteItem` 添加到 `@iris-ui/core/commands`。
   - 添加一个框架无关的桥接工厂 `createCommandBridge(registry): { items: Store<IrisCommandItem[]>; search(query): IrisCommandItem[] }`。
2. 适配器：
   - 更新 `IrisCommandPalette` 以接受一个可选的 `registry?: CommandRegistry` prop（或者从 `IrisProvider` 中自动拾取）。
   - 当提供了 registry 时，用 `commandToPaletteItem` 转换项目，并忽略 `items` prop。
   - 在搜索时调用 registry 的 `search()` 然后转换为 `IrisCommandItem`。
3. CMS 集成：
   - 将 `page.actions` 和 `menus.ts` 命令迁移到 `registry.registerMany()` 而不是 `items={...}`。
4. 测试：
   - registry → palette 转换，搜索同步，快捷键透传。

#### Phase 3：中央公告器（3-4 天）

1. 核心（`packages/core/src/announcer.ts`）：
   - 基于 `createStore` 的公告器，具有 `announce(text, priority?)` 界面。
   - 两个 slot 设计："polite"和"assertive"（映射到两个 DOM 区域）。
   - 500ms 去抖：每个优先级在一个节流窗口内只保留最新消息。
   - `IrisProvider` 通过注册表插件 `registerStore('announcer', () => createAnnouncer())` 集成。
2. 适配器桥：
   - `useAnnouncer(): { announce(text, priority?) }` hook（每个框架）。
   - 确保 `IrisVisuallyHidden` 在 SSR 期间不会在服务端渲染公告区域。
3. 骨架集成：
   - 在 `ResourceController.mutate` 中添加 `onSuccess`/`onError` 回调槽。
   - 在 `useResourceController`（适配器桥）中添加默认公告集成。
4. 测试：
   - 节流、去抖、SSR 安全、Toast 不冲突。

#### Phase 4：树形虚拟化（5-7 天）

1. 核心（`packages/core/src/virtualizer-tree.ts`）：
   - `createTreeVirtualizer(config)`：带有惰性展平、深度感知的 `VirtualItem`、展开/折叠的滚动锚定。
   - 基于栈的展平（非递归），RPO（只展平可见区域 + buffer）。
   - 展开时使用占位估算（`estimateSize` 用于不可见子节点）。
   - `toggle(key)` 方法，通过 `delta = totalSizeAfter - totalSizeBefore` 更新 `scrollOffset`。
2. 适配器：
   - 更新 `IrisTree` 以在内部使用 `createTreeVirtualizer` 替代全量展平。
   - 用虚拟滚动包装替换 `IrisTree` 的 `overflow: auto`。
3. 逐步采用：
   - **Phase 4a**（P2）：`IrisTree` 虚拟化。
   - **Phase 4b**（P2—续）：`IrisTreeSelect` 和 `IrisCascader` 虚拟化。
4. 测试：
   - 10k 节点树的展开/折叠。
   - 展开锚定无跳动。
   - 全部展开和折叠后的键盘导航。

### 风险与缓解

| 风险                                              | 概率 | 影响 | 缓解                                                                                                          |
| ------------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------- |
| 命令 `shortcut` 字段变更破坏现有 `Command` 字面量 | 低   | 低   | 可选字段；现有代码保持不变                                                                                    |
| 树形展开锚定中的滚动跳动                          | 中   | 高   | 增量 `scrollOffset` 调整（`delta = totalSizeAfter - totalSizeBefore`）；第一阶段严格单元测试，第二阶段手动 QA |
| 表单 `persist` 与现有手动草稿代码冲突             | 中   | 中   | 默认关闭（`persist?: undefined`）；Opt-in API                                                                 |
| 公告器与 Toast `aria-live` 区域冲突               | 中   | 中   | 公告器使用专用区域（`id="iris-announcer-{polite,assertive}"`）；明确的职责分离                                |
| Svelte SSR 中的虚拟滚动                           | 低   | 中   | `onMount` 守卫；SSR 中不渲染虚拟化内容                                                                        |

### 向后兼容策略

对所有四个方向：

- **可选配置**：每个新能力都有一个"未配置"的合理默认值，降级到当前行为。
- **弃用而非移除**：适配器 types.ts 中的 `defaultFilter` 标记为 `@deprecated` 并引用核心的替代品，但不会被移除。
- **适配器 props 不变**：`IrisCommandPalette.items` 保留。注册表集成是附加的。
- **表单 `persist` 默认关闭**：现有草稿代码不受影响。
- **树形虚拟化默认关闭**（可选）：可选的 `virtualized` prop 用于 `IrisTree`；当关闭时使用现有实现。

---

### 总结

验证分析确认，Iris UI 的四个断层遵循一个共同模式：**核心工程完备，但适配器和应用层未连接**。这种架构纪律意味着每个方向的工程跨度远小于首次分析可能暗示的：

- 方向 A（命令注册表）：核心 ~95%。缺口在于适配器 types.ts 中有 ~5% 的接口重复。
- 方向 C（表单字段协议）：核心 ~100%。缺口在于适配器桥中 ~0% 的有条件可见性和草稿自动化。
- 方向 B（树形虚拟化）：核心 ~40%（FlattenTree + Virtualizer 存在但未连接）。缺口在于一个新的 ~300 行的核心模块。
- 方向 D（中央公告器）：核心 ~0%（不存在）。缺口在于一个新的 ~100 行的核心模块 + 骨架集成。

实施顺序应优先考虑**最大价值/最小风险**——表单字段协议（方向 C）和命令桥接（方向 A）应该先行，因为它们建立在已存在**且**已测试的核心逻辑上。树形虚拟化（方向 B）是工程上最有趣的，但如果保持可选（默认关闭），其风险是可控的。公告器（方向 D）价值最低，除非辅助功能合规性是一个优先事项。
