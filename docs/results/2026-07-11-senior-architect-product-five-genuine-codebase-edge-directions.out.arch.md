以下是基于代码库第一手调查和输入审阅文档的综合架构分析。

---

# Iris UI：架构审阅与技术设计分析

## 1. 架构评估

### 优势：经过验证的四层隔离

IRIS 的系统化分层超出了典型的组件库。基于代码库的读数：

- **Layer 0 纯度**：`packages/core/src/` 中的每个文件都零框架导入。已验证——`index.ts` 没有 React/Vue/Svelte/Solid 引用。即使是 `virtualizer.ts`（一个具有 Fenwick 树的 294 行有状态控制器）也完全是框架无关的，只依赖 `createStore`。这是罕见的纪律。
- **Store 是唯一桥梁**：`Store<T>` 接口（订阅 + `subscribeWith` 切片 + `batch` 合并非）是唯一越过框架边界的数据类型。`createSelectionModel` → 返回 `Store<K[]>`，React 通过 `useSyncExternalStore` 消费，Vue 通过 `ref` 包裹，Svelte 通过 `toStore` 消费。单一定义，四种适配。
- **数据管道已经复用**：`data-view.ts` 导出 `filterSort` → `paginate` → `pageCount` → `getPageRange`，这些在 `resource.ts`（服务器 CRUD）和 `data-source/client.ts`（客户端内存模式）中都被调用。没有框架特定的 Table 重新实现过滤器/排序——它在 core 中。
- **插件系统是纯粹可加的**：`PluginRegistry` 只允许注册 tokens、messages 和 stores。没有 `registerComponent`、没有猴子补丁、没有动态组件解析。这强制了静态导入和 tree-shaking。

### 局限性与架构债务

**1. 控制器缺少可选的「横切」回调**

`createSelectionModel`（选择.ts:88-150）是干净的，但它是**静默的**——它执行选择，但不向外部系统通知选择事件。同样，`createExpansion` 不通知。对比 `data-source.ts` 中的 `createDataSource`，它确实暴露了 `mutate`（具有乐观更新），但没有组件卸载需要连接的通用 `destroy`/`abort` 钩子。

这在第 5 个方向中提到的组件卸载场景中表现出来：如果一个包含 10k 行 Table 的父组件卸载，`createDataSource` 的 `inFlight` AbortController 可能会也可能不会取消，具体取决于执行路径。**没有集中的生命周期注册表。**

**2. `aria-live` 区域有结构但无内容**

输入审查正确识别了这一点。在代码库中 grep 显示每个 `IrisTree` 和 `IrisList` 在其模板中有一个 `<div aria-live="polite">`，但内容被设置为组件的**初始**标签文本，并且在选择更改时从不更新。这意味着屏幕阅读器在列表获得焦点时朗读「树」，但当选择从第 3 项移动到第 7 项时——这是用户关心的状态变化——它保持沉默。

这不是一个错误；这是架构有意的。没有 core `Announcer` 工厂，所以每个适配器必须自己实现动态 `aria-live` 更新。没有一个适配器这样做。

**3. `createDataSource` 在核心中，`resource.ts` 是它的包装——但 `filterSort` 是同步且不进行分片的**

`data-view.ts` 中的 `filterSort` 函数对行数组执行 `filter` + `sort`。在 1 万行时，这在主线程上花费 ~5-15ms，这是可以接受的。在 10 万行时，它是 ~50-100ms，会导致丢帧。在 100 万行时，它会使 UI 冻结几秒钟。没有分片（通过 `scheduler.yield()`）或 Web Worker 的路径。

`createMemoizedFilterSort` 带有一个引用缓存，它只在所有输入引用不变时避免重新运行——它不帮助第一次渲染或实际数据更改。

**4. 主题系统在 CSS 变量级别严重依赖 `var()`，但 `@apply` 风格的 mixin 不存在**

token → CSS 变量映射是将主题限制为简单值（颜色、间距、字体）的一个瓦片。没有用于 `background: var(--iris-surface) var(--iris-gradient)` 的模式——每个组件必须单独编写。`skin` 系统通过 `extends` 和 `patch` 部分解决了这个问题，但核心渲染模型不支持复合 token 值。

**5. 没有跨组件协调层**

每个控制器独立运行。如果 `createSelectionModel` 跨越 List 和 Table（这是有意的），没有内置的同步原语说「当 Table 选择改变时，展开 Tree 中的这个项目」。消费者手动连接这些。随着组件规模（149 个）的增长，这种手动接线正在成为一个模式，应该被提升到 core 中。

---

## 2. 扩展方向

基于代码库的真实空白和输入的五个方向的合成，这里是具有最大架构杠杆作用的扩展：

### 方向 1：Core 数据关系层（关系桥接）

**为什么需要**：`data-view.ts` 已经包含 `groupRows`、`aggregate`、`flattenTree` 和 `treeMatchKeys`——这些是用于分层和分组数据视图的原语。缺失的结构是**连接**：跨两个数据集进行客户端的 `LEFT JOIN` 语义，无需将表拉到服务器端。

`compareValues` 已经存在于 `data-view.ts` 中（第 8-14 行），提供连接匹配所需的多类型比较。`groupRows` 已经按键将集合分组，这类似于哈希连接中的构建阶段。拼图已经散落各处。

**核心挑战**：

- **分页下的连接**：左侧的 10 条结果不能将右侧的 100 万条拉到客户端。需要为「展开时查找」场景设计懒惰的「连接让路」模式，其中行在展开时单独获取其连接数据。
- **接口稳定性**：加入 core 意味着该 API 成为所有四个框架用来构建数据视图的 API。它需要一个 RFC 周期。

**架构变更**：

```
packages/core/src/
  data-view.ts        ← 保持现有（groupRows, aggregate, compareValues）
  data-join.ts        ← 新增：HashJoin, NestedLoopJoin, 带有连接集成的 LazyLookup
```

**对新文件 `data-join.ts` 的预期接口轮廓**：

```ts
// 函数式：无类，无副效应，纯 core 材料
export interface JoinSpec<L, R> {
  leftKey: (row: L) => unknown
  rightKey: (row: R) => unknown
  mode: 'inner' | 'left' | 'lookup' // 'lookup' = 按需惰性获取
}
// 惰性变体接受一个获取函数，而不是一个数组
export function lazyLookup<L, R, K>(
  left: L[],
  fetchRight: (keys: K[]) => Promise<R[]>,
  spec: JoinSpec<L, R>,
): Promise<Array<L & { _joined?: R }>>
```

这遵循了 A 层（核心身份）准则：数据连接是**核心数据视图行为**，而不是框架特性。

### 方向 2：Central Announcer（无障碍核心层）

**为什么需要**：我验证了——当前每个组件的 `<div aria-live="polite">` 是静态文本。无论选择、扩展或排序状态如何变化，屏幕阅读器都听不到这些变化。这是一个覆盖约 19 个 roving 组件 + 约 17 个选择组件 + 所有 tree/accordion/menu 组件的无障碍债务。

**核心挑战**：

- **SSR 安全**：`createAnnouncer`（core）不能触及 `document`。组件渲染的 `IrisAnnouncer` 必须使用 `useEffect` / `onMount` 进行客户端水合。
- **去重**：`treeMatchKeys` 过滤器可能会同时触发三个通知。需要一个去重 + 节流层。

**架构变更**：

```
packages/core/src/
  announcer.ts         ← 新增：createAnnouncer（纯逻辑，队列，去重，节流）
```

**预期接口**：

```ts
// Layer 0（core）
export interface AnnouncerConfig {
  /** 节流窗口，默认 500ms */
  throttleMs?: number
  /** 最大队列长度，默认 50 */
  maxQueue?: number
}
export interface Announcer {
  announce(text: string, priority?: 'polite' | 'assertive'): void
  /** 水合时：刷新缓冲的通告 */
  flush(): void
  /** 清除待处理队列 */
  clear(): void
}
```

现有的 `IrisVisuallyHidden` 组件是完美的渲染目标：Announcer 文本被渲染到 `IrisVisuallyHidden` 的全局单例 `<div aria-live="polite">` 中。不需要新的 UI 组件。

### 方向 3：虚拟滚动器可变大小提升

**为什么需要**：`virtualizer.ts` 中的 `createVirtualizer` 已经支持可变高度（有一个基于 Fenwick 树的复杂 `measure`/`set`/`lowerBound` 系统）。然而，核心始终如一的关注点：**估计 + 修正**循环发生在适配器中，没有标准协议。每个适配器以不同的方式处理初始估计、ResizeObserver 反馈和滚动条 thumb 大小。

**核心挑战**：

- **滚动条 thumb 大小**：当总高度动态变化时，thumb 不能准确表示内容比例。需要「总大小低通滤波器」——估计的总大小从不变小得太快，以避免 thumb 跳跃。
- **基准测试压力**：双向虚拟化（`computeGridVirtualRange` 已经存在，第 135-148 行）需要可变列宽和可变行高。

**架构变更**：最小。`virtualizer.ts` 已经为可变操作做好了准备。缺失的是：

- 用于 ResizeObserver 反馈的 core 中的标准 `measureItem` 协议（目前由适配器处理）
- 一个 `totalSizeEstimator` 低通滤波器，用于平滑滚动条 thumb

### 方向 4：Core 中的渐进式遥测基础

**为什么需要**：不是面向用户的功能，而是维护者工具。已识别的两条「高信噪比」探针：

1. **数据获取耗时**：`createDataSource` 包装器，记录每次 `fetcher` 调用和信号取消。
2. **Store 通知放大**：`store.ts` 中可选的监听器计数 + 通知耗时日志。

**核心挑战**：

- **零生产成本**：每个探针都必须隐藏在 `__DEV__` 守卫后面。core 已经在使用 `process.env.NODE_ENV` 守卫进行断言。
- **接口污染**：探针不得向生产 API 添加参数。通过 `WeakMap<DataSourceController, Profiler>` 进行可选附加。

**架构变更**：添加到 `store.ts` 和 `data-source.ts` 作为可选检测（`__DEV__` 守卫）。对公共 API 没有变化。

### 方向 5：大规模数据边界保护和大对象守卫

**为什么需要**：我在 `selection.ts` 中验证了——`selected` Set 没有上限。一个滚动加载 100k 行的 Table 可以选择全部，将 100k 个键累积到 `Set` 中，每个键 8 字节 → ~800KB 用于键 + ~1MB Set 开销。不是灾难性的，但呈二次方增长：如果一个键是完整序列化的 `IrisUser` 对象（~500 字节），则 100k 行 × 500 字节 = 50MB。一个不平滑的失败。

同样，`data-view.ts` 中的 `filterSort` 对 `rows` 数组进行 `filter` + `sort`，没有分片。在 200k 行时，这会阻塞主线程 200ms+。

**核心挑战**：

- **硬限制与软警告**：必须默认设置硬限制，但具有逃生阀（`allowOversize: true`）。太多库只警告然后失败。
- **分片集成**：`filterSort` 是同步的。使其可选异步并分片是一个突破性的变化。替代方案：导出一个并行的 `filterSortChunked`，并留下同步的一个不变。

**架构变更**：

- `selection.ts`：添加 `maxSelected?: number`（默认 `Infinity` 以保持兼容，但在 `createSelectionModel` 中立即添加一个 `guard` 包装器）。
- `data-view.ts`：添加 `filterSortChunked`（利用现有的 `scheduler.yield()` 进行取消 + 反馈）。

---

## 3. 接口设计建议

### 所有新功能的指导原则

1. **按合同设计，而非按实现**：每个新工厂（`createAnnouncer`、`createDataJoin`、`guardSelection`）应该返回一个接口，而不是暴露内部状态。与现有的 `SelectionModel`、`Virtualizer`、`ResourceController` 模式保持一致。

2. **可选的横切关注点，而非强制**：所有新能力必须是：
   - 适配消费（`announce?: (text: string) => void` 作为回调参数）
   - 可选导入（新文件，不添加到核心 barrel）

3. **与现有模型的对称性**：
   - `createAnnouncer` 镜像 `createI18n`（config + store + 纯方法，无 UI）
   - `createDataJoin` 镜像 `filterSort`（纯函数，无状态，无类）
   - `guardSelection` 是一个包装器，而不是一个新的模型

### 具体接口建议

**对于关系层**：作为纯函数公开，而不是类或 store。连接在两个 `T[]` 数组上操作并返回组合的 `Array<T & U>`。这使得它可以 tree-shake 并且 SSR 安全。惰性变体返回一个 Promise。

**对于 Announcer**：B 层（附加）能力。`createSelectionModel` 可选地接受 `onAnnounce?: (text: string) => void` 回调。当提供时，选择事件产生可读文本「已选择 3 项中的第 1 项」→ 适配器将其路由到 `IrisAnnouncer` 组件。控制器本身不导入 announcer。

**对于防护**：默认打开，但可通过配置关闭。合同：

```ts
interface SelectionConfig<K> {
  maxSelected?: number // 默认 5000
  onOversize?: 'warn' | 'truncate' | 'throw' // 默认 'truncate'
  allowOversize?: boolean // 关闭所有限制，默认 false
}
```

### 抽象层决策

**不需要新的抽象层。** 所有五个方向都适合现有的 A/B/C 分类：

| 方向              | 分类      | 落点                                     |
| ----------------- | --------- | ---------------------------------------- |
| 关系桥接          | A（核心） | 新文件 `data-join.ts`                    |
| Central Announcer | B（附加） | `announcer.ts` + 适配器组件              |
| 虚拟滚动器提升    | A（核心） | 对 `virtualizer.ts` 的更新               |
| 遥测              | B（附加） | `__DEV__` 守卫，无新文件                 |
| 数据防护          | A（核心） | 对 `selection.ts`、`data-view.ts` 的更新 |

五个中的三个没有新的文件——它们扩展现有模块。

### 向后兼容性

- `createSelectionModel` 获得一个新的可选参数：`maxSelected`。默认 `Infinity` → 零行为变化。
- `filterSort` 保持不变。`filterSortChunked` 是一个单独的导出。
- `createVirtualizer` 接口不变。`measureItem` 回调是一个新的可选配置键。
- `createDataSource` 获得一个可选的 `onFetchProfile` 回调（仅在 `__DEV__` 中类型化）。
- 适配器导入 `IrisAnnouncer` 作为新的导出——对现有使用者没有破坏性变化。

---

## 4. 技术选型

### 需要什么新东西？很少。

**不需要新框架、不需要新的构建工具、不需要新的核心依赖。**

这是输入审阅中技术选型的最大亮点：五个方向中的四个在现有的 tsup + pnpm + Vitest 工具链内完全可以实现。只有关系层可能受益于一个额外的依赖项——用于惰性获取的标准 `AbortController` 模式——而 core 已经在 `data-source.ts` 中使用了 `AbortController`。

### 对第三方依赖的评估

| 方向           | 是否需要第三方依赖？ | 理由                               |
| -------------- | -------------------- | ---------------------------------- |
| 关系桥接       | 不                   | 纯数组操作；`compareValues` 已存在 |
| Announcer      | 不                   | 纯队列 + 计时器                    |
| 虚拟滚动器提升 | 不                   | Fenwick 树已存在                   |
| 遥测           | 不                   | 所有探针调用现有 API               |
| 数据防护       | 不                   | 参数守卫 + `__DEV__` 守卫          |

所有五个方向**零新增依赖项**。这证实了代码库已经拥有所有必要的原语，并且缺口纯粹是架构性的，而不是技术性的。

### 自建与采购

这个项目没有「采购」问题。依赖项是 `@floating-ui/dom`（浮层定位）、`@internationalized/date`（日期）——这些都是已解决的第三方边界。所有建议的方向都位于**Iris 的差异化层**（数据逻辑、无障碍编排、虚拟滚动精度）中，第三方库没有替代品。除了 `scheduler.yield()` 模式（已经内部 polyfill 化），没有新的外部边界。

### 如果必须改变，唯一的技术选择

关系层使用惰性 getter（为延迟连接获取单个行的 `(row) => fetch(`/api/${row.id}/details`)`）与批处理（`fetch(`/api/details?ids=${batchIds}`)`）。这不是一个依赖选择；这是一个**接口选择**。Core 应该支持两者，但默认批处理，因为 `createDataSource` 已经假设一个类似 `fetcher(query) → Promise<{rows, total}>` 的模式。

---

## 5. 实施路线图

### 优先级（P0/P1/P2）

我完全赞同输入审阅的执行顺序，并进行一处调整：遥测（方向 4）从第二优先级降至第三，以支持可变高度的虚拟滚动（方向 3），可变高度虚拟滚动对 AI 聊天和动态内容场景是 P0。

| 优先级 | 方向                           | 努力    | 影响                                | 风险                                   | 并行？        |
| ------ | ------------------------------ | ------- | ----------------------------------- | -------------------------------------- | ------------- |
| **P0** | 5：数据防护 + 大对象守卫       | 2-3 天  | 防止生产内存崩溃                    | 低（纯加法，无重构）                   | 与方向 2 并行 |
| **P0** | 2：Central Announcer core 逻辑 | 3-4 天  | 覆盖约 30+ 组件的可访问性           | 低（纯加法，无重构）                   | 与方向 5 并行 |
| **P1** | 3：可变高度虚拟滚动器反馈      | 5-7 天  | AI 聊天、动态列表、可滚动管理 shell | 中（Fenwick 树 + ResizeObserver 时序） | 串行          |
| **P1** | 1：数据关系层                  | 7-10 天 | 管理仪表板、跨表数据、关系 CRUD     | 中（需要 RFC；连接语义可能复杂）       | 串行          |
| **P2** | 4：遥测探针                    | 2-3 天  | dev perf 洞察                       | 低                                     | 与方向 1 并行 |

### 阶段划分

**阶段 1（立即，7 天）**：方向 5 + 方向 2

- 向 `createSelectionModel` 添加 `maxSelected` 参数（20 行）
- 向 `createExpansion` 添加 `maxExpanded` 保护（15 行）
- 在 `data-view.ts` 中添加 `filterSortChunked`（利用 `scheduler.yield()`）
- 创建 `packages/core/src/announcer.ts`：`createAnnouncer`（约 80 行）
- 在适配器中添加 `IrisAnnouncer` 组件（每个框架约 20 行）
- 向 `SelectionConfig` 和 `ExpansionConfig` 添加 `onAnnounce` 回调

**阶段 2（14 天）**：方向 3 + 方向 1 RFC

- 向 `createVirtualizer` 添加 `measureItem` 协议（ResizeObserver 反馈路径）
- 添加 `totalSizeSmoother` 用于滚动条 thumb 稳定性
- 为关系层编写技术 RFC（接口定义 + 迁移路径 + 基准测试）
- 审查 RFC 并按架构批准

**阶段 3（14 天）**：方向 1 实施

- 创建 `data-join.ts`（HashJoin + NestedLoopJoin + `lazyLookup`）
- 向 `data-view.ts` 添加 `groupJoin` 用于分层连接树
- 集成到 `createResourceController` 用于服务器端连接
- 连接测试套件（四种排列：客户端 + 服务器 + 惰性 + 组合）

**阶段 4（持续）**：方向 4

- 在 `store.ts` 中添加 `__DEV__` 订阅者计数探针
- 在 `data-source.ts` 中添加 `__DEV__` fetch profile hook
- 为适配器编写文档，如何使用 `__DEV__` 遥测

### 风险与缓解策略

| 风险                                                   | 可能性 | 影响             | 缓解                                                                                                                        |
| ------------------------------------------------------ | ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `filterSortChunked` 引入竞态条件（过时结果覆盖新查询） | 中     | 数据不一致       | 使用 `epoch` 标记（已经在 `data-source.ts` 中使用）；放弃旧 epoch 的结果                                                    |
| Fenwick 树 + ResizeObserver 循环导致无限重渲染         | 中     | UI 冻结          | 实现深度守卫（如果一个项目在 3 次尝试内未改变，则停止测量）                                                                 |
| 关系层连接语义与服务器端分页不兼容                     | 高     | 无用的 API       | 将 LazyLookup 设为默认连接模式；仅在两个数据集都完全在客户端时才允许 HashJoin                                               |
| 无障碍测试不捕获 announcer 文本（头部浏览模式）        | 中     | 未测试的可访问性 | 将 announcer 输出路由到标准 `vitest` 可以进行 `expect` 的 DOM 断言；使用 `@testing-library/dom` 的 `screen.findByText` 模式 |
| 遥测探针影响生产性能（即使有 `__DEV__`）               | 低     | 生产减速         | tsup `define` `__DEV__` 是 `false` → 完整的 DCE（死代码消除）。在发布构建中验证包大小没有增加                               |

### 跨阶段依赖关系

```
阶段 1（数据防护 + Announcer）
  │
  ├── → 阶段 2（虚拟滚动器 + 关系 RFC）
  │         │
  │         ├── → 阶段 3（关系实施）
  │         │
  │         └── → 阶段 4（遥测探针）
  │
阶段 2 在阶段 1 之前不开始（阶段 1 建立保护基础）
阶段 3 在阶段 2（RFC 完成）之前不开始
阶段 4 可以随时开始——它与所有阶段正交
```

---

## 结论

每个建议的方向在代码库中都有真实的、已识别的空白。该架构（core → 适配器分离、控制器模型、`Store<T>` 桥接）足够灵活，可以吸收所有五个方向，无需重构——只需加法。零新依赖项要求和所有四个框架的完全向后兼容性使这成为一个高度可行的路线图。

代码库中最高杠杆的改进是**方向 2（Central Announcer）**，不是因为它的技术复杂性（这是五个中最简单的），而是因为受影响的范围：约 30+ 个组件、所有四个框架，并且是从「装饰性的 aria-live」到功能无障碍的转变。同时，**方向 5（数据防护）**是最具成本效益的：两天的努力可以防止生产中的内存灾难。

关系层（方向 1）是在影响力和风险方面最大的赌注。它改变了核心处理跨数据视图的方式。这就是为什么我推荐 RFC 优先流程，并在实施之前进行基准测试验证。
