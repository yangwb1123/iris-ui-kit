# Iris UI 架构分析报告

> **依据**：上述 5 方向代码级验证结果 + AGENTS.md 架构原则 + Iris UI 现有代码库结构
> **视角**：系统架构师，关注跨框架一致性、分层完整性、演进性技术债

---

## 1. 架构评估

### 1.1 当前架构的核心优势

| 维度           | 现状                                     | 评价                          |
| -------------- | ---------------------------------------- | ----------------------------- |
| **分层清晰度** | Layer 0–4 + Behaviors + 插件层，契约明确 | ✅ 业界标杆级设计             |
| **跨框架策略** | core 共享逻辑 + 每框架薄桥               | ✅ 已验证 4 框架 149 组件对齐 |
| **A/B/C 分类** | 控制器/插件/纯材料三轨                   | ✅ 可执行性强，避免逻辑漂移   |
| **Token 杠杆** | 30 token ≈ 800 行裸 CSS                  | ✅ 93%+ 节省，换肤零成本      |
| **插件系统**   | `createPlugin` + `runPlugins`，只做加法  | ✅ 防止了 monkey-patch 式扩散 |

这些设计决策是合理的，并且已经通过 4 框架对齐和 ~1500 测试证明了其正确性。

### 1.2 但架构存在三类「已承认的缺口」

根据 AGENTS.md 和实际代码验证，存在三类缺口：

**第一类：Parity 缺口（方向①）**

- AGENTS.md 说「四框架完全对齐」「同名同语义导出」——但 Solid Tree 没有 `loadChildren`
- 这不是技术债，是 **实现遗漏**。核心逻辑（异步展开）已定义在 core 的 `createExpansion`/data-view 中，Solid 适配器未正确桥接。
- 严重性：高。异步加载是 Tree 的核心能力，Solid 用户只能用同步树。

**第二类：性能债（方向②）**

- `createMemoizedFilterSort` 已存在（core L189），对 1000+ 行客户端分页可节省 60%+ 重算
- `createClientDataSource` 直接调用 `filterSort()` —— 每次 render 都全量重算
- 修复仅需 5 行，边际成本极低。问题出在 **「已存在但未消费」** 的集成缺口。

**第三类：架构缺口（方向④⑤）**

- 状态化分组视图（方向④）：这是企业 CRUD 表格需要的第二大模式，却只有 C 层函数，无 A 层控制器
- 冻结窗格（方向⑤）：虚拟化引擎完全未考虑，适配器层用手动 CSS sticky 模拟（React Table L505–540）
- 这些是 **架构层面的能力缺口**，不是 bug

### 1.3 关键设计决策的合理性评估

| 决策                                                 | 合理性                | 潜在代价                                                       |
| ---------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| 四框架共享 core                                      | ✅ 高度合理           | 适配器维护成本 = 4×，但 AGENTS.md 已证明可行                   |
| A/B/C 下沉分类                                       | ✅ 合理               | 但分类边界有**灰色地带**（方向④的 grouping 到底算 A 还是 B？） |
| 插件系统只做加法，不做 `registerComponent`           | ✅ 合理，保护类型安全 | 动态 schema 渲染需要 `widgets` map，增加了使用复杂度           |
| 不内建 QRCode                                        | ✅ 合理，回归核心     | 但不影响架构完整性                                             |
| **方向③：`FieldErrors` 为 `string` 而非 `string[]`** | ❓ 早期设计妥协       | 现在是**涟漪变更**——跨 4 框架 + core 类型 + 测试               |

### 1.4 架构债务总结

按严重性排序：

| #     | 债务类型             | 位置                            | 影响面                                       |
| ----- | -------------------- | ------------------------------- | -------------------------------------------- |
| **1** | Parity 缺口          | Solid IrisTree                  | 框架用户信任；违背 AGENTS.md 核心承诺        |
| **2** | 未集成已有的 memo 化 | `client.ts`                     | 1000+ 行表格性能退化                         |
| **3** | 类型设计涟漪         | `FieldErrors` `string` → 多错误 | 方向③问题，4 框架表单组件 + core 类型 + 测试 |
| **4** | 架构缺口             | 分组视图、冻结窗格              | 企业 CRUD 场景被迫在适配器层手写逻辑         |
| **5** | 竞态处理分散         | AsyncTree 展开（方向①）         | Solid 需额外桥接 `createResource` 取消语义   |

---

## 2. 扩展方向

以下按照对架构完整性的影响排序，而非优先级。

### 方向 A：多错误传播框架（修复方向③的架构根因）

**为什么需要**  
方向③反映的是一个更深层的问题：**表单验证的错误模型**与 Iris UI 的「渐进式复杂度」原则不匹配。当前模型是「每个字段保留第一个错误」，这源于 `FieldErrors<V>` 被设计为 `Partial<Record<keyof V, string>>`。当字段级有多个验证规则时（`minLength` + `pattern` + `custom`），用户必须反复提交才能看到全部错误——违背了企业表单的 UX 期待。

**核心挑战**

1. **涟漪效应**：`FieldErrors<V>` 从 `string` 改为 `string[]` 或 `Set<string>` 或分隔符 `string`，4 框架表单组件的错误渲染层全部需要适配
2. **渲染兼容**：Vue/Svelte 通常期望 `string` 直接显示；React/Solid 可能用数组做列表渲染
3. **`createFormStore` 的合并逻辑**：`errors` 的 deep merge 策略需从「覆盖」改为「追加去重」

**架构变更方案**

有三个选项（权衡如下）：

| 选项                                         | 变更量                       | 类型安全 | 性能 | UX 灵活度                |
| -------------------------------------------- | ---------------------------- | -------- | ---- | ------------------------ |
| **A1**: `string` → `string[]` 全链路         | 大（core + 4 框架 + 测试）   | ✅ 最强  | 中等 | 最高（可按字段渲染列表） |
| **A2**: 保留 `string`，`'; '.join` 连接      | 小（core 连接 + 测试）       | ✅ 不变  | 优   | 低（只能展示文本）       |
| **A3**: `string` → `FieldError[]` 自定义类型 | 中（core 类型 + 各框架组件） | ✅ 良好  | 优   | 高（可传递级别/来源）    |

**推荐**：短期走 **A2**（涟漪最小，方向③即可修复），**A3** 做长期重构方向。

**对现有系统的影响**

- A2：仅修改 `standard-schema.ts` 连接逻辑和测试期望值，零框架变更
- A3：需要定义 `IrisFieldError` 类型 + 4 框架的错误渲染组件适配

---

### 方向 B：分组数据视图控制器（方向④）

**为什么需要**  
AGENTS.md 明确说「A 零配置在场，B 不用不进包」。对于企业表格，分组视图（Group By 列）是与排序/筛选/分页同级的基础能力。当前只有 C 层函数（`groupRows()` in `aggregate.ts`），意味着每个适配器都要自己实现组状态的展开/折叠/聚合——已经出现 React Table 手动管理展开状态的迹象。

验证：`grep -rn "group.*Expand\|expand.*Group" packages/` → 仅在 demo 层有模式。

**核心挑战**

1. **状态组合**：分组展开状态（`createExpansion`）需要与排序状态（`createSort`）和筛选状态（`createFilter`）组合为单一数据流：`source → filter → sort → group → paginate`
2. **组级聚合**：每组的计数、子计、汇总行——需要纯函数 + 控制器缓存
3. **组级分页**：展开的组是否计入分页行数？这个选择会影响 `getPageRange` 的签名

**架构变更**

```
packages/core/src/data-view/
├── aggregate.ts          # ✅ 已存在：groupRows()
├── data-view.ts          # ✅ 已存在：flattenTree, treeMatchKeys
├── controller/
│   ├── createSort.ts     # ✅ 已存在
│   ├── createFilter.ts   # ✅ 已存在
│   └── createGrouping.ts # ❌ 新增：分组展开+聚合控制器 ← 新
```

`createGroupedView(rows, groupKey, options)` 的设计模式应与 `createClientDataSource` 对齐：

```ts
// 概念接口（非代码）
createGroupedView(rows, {
  groupBy: 'department',
  sortGroups: { field: 'count', dir: 'desc' },
  groupExpansion: { single: false, defaultExpanded: true },
  aggregateColumns: ['salary'], // 组级聚合
  pageWithinGroups: false, // 组内分页还是全局分页
})
```

**对现有系统的影响**

- 新增文件，**零破坏性**：已有 C 层函数不变
- `createClientDataSource` 可在内部组合 `createGroupedView`，但对外保持向后兼容
- 后续每个框架的 Table 组件可逐步接入组级 UI

---

### 方向 C：虚拟化引擎冻结窗格/粘性列支持（方向⑤）

**为什么需要**  
方向⑤的当前状态——React Table 手动 CSS `position: sticky` 模拟列固定——是典型的「适配器层承接核心能力」的架构违规。按 AGENTS.md：「出现在适配器里即是 bug」。冻结行/列在虚拟滚动表格中是基础设施级需求，不应该由每个框架各自实现。

**核心挑战**

1. **双窗口模型**：`computeGridVirtualRange` 当前返回单一 `{rows, columns}` 窗口。冻结窗格需要**四个窗口**（左上角固定、右上滚动、左下滚动、右下滚动），或者三区域（固定列 + 滚动列 + 固定行）
2. **滚动同步**：冻结区域与滚动区域的水平/垂直滚动需要同步，这通常需要 parent scroll container + scroll event 桥接
3. **偏移量计算**：行/列冻结后，`getPageRange` 需要排除冻结部分

**架构变更方案**

两个选项：

| 选项                                                                  | 复杂度                         | 性能 | 灵活性 |
| --------------------------------------------------------------------- | ------------------------------ | ---- | ------ |
| **C1**: `computeGridVirtualRange` 新增 `frozenRows`/`frozenCols` 参数 | 中（core 纯函数变更）          | 优   | 中等   |
| **C2**: 新增 `createFrozenGridController` 控制器                      | 高（core 控制器 + 4 框架适配） | 优   | 最高   |

**推荐**：**C2**。冻结窗格涉及滚动同步、区域划分、偏移量管理，不适合纯函数。新增控制器符合 A/B/C 分类（A 类：状态化 + 有事件）。

**对现有系统的影响**

- C1：`computeGridVirtualRange` 签名变化，需更新所有调用方（4 框架的 VirtualTable 组件）
- C2：新增控制器，已有函数不变；适配器层逐步接入

---

### 方向 D：AsyncResource 竞态安全协议

**为什么需要**  
方向①引出的是一个跨框架问题：Tree 的 `loadChildren` 是异步资源，在有快速展开/折叠（用户连续点不同节点）时会产生竞态。Solid 用 `createResource` 有内置取消语义（abort signal），React 用 `useEffect` cleanup 或 `AbortController`，Vue 用 `onUnmounted` + `abort`。当前 core 没有定义**异步展开的竞态安全协议**——每个适配器自己处理，导致 Parity 缺口。

验证：`grep -rn "AbortController\|abort\|signal" packages/core/src/` → 仅 2 处，非展开展开场景。

**核心挑战**

1. **跨框架竞态语义不统一**：Solid 的 `createResource` 有自动取消；React/Vue/Svelte 需要手动管理
2. **core 不应该依赖框架特定的竞态机制**，但应该定义资源接口
3. **`onToggleExpand` 回调的竞态保护**：如果 `loadChildren` 是异步的，展开状态需要 pending 状态

**架构变更**

```
packages/core/src/async/
├── createAsyncResource.ts  # 新增：可取消的异步资源 + pending 状态 + 竞态安全
├── withAbort.ts            # 新增：AbortSignal 工具
```

原则：core 只定义**接口**和**纯逻辑**（pending 状态管理、缓存策略、取消注册），不绑定具体框架的取消机制。适配器将 core 的 AsyncResource 桥接到各自框架（React `useEffect` cleanup → core `cancel()`）。

**对现有系统的影响**

- 新增文件，零破坏性
- Tree 的 `createTreeController`（如果存在）或 `createExpansion` 可选择集成
- 长期可替代各框架现存的 `useEffect` + `AbortController` 模式

---

### 方向 E：复合数据源管道（数据流编排）

**为什么需要**  
当前的数据源模型是两级：`createClientDataSource`（客户端全量）和 `createServerDataSource`（服务端全量）。但企业场景需要**混合**：先发请求拿到 1000 条，再在客户端做筛选/排序/分组。当前模型要么把 10000 条全拉到客户端（内存爆炸），要么每次都发请求（网络开销）。

此外，`filter → sort → group → paginate` 的管道顺序当前是硬编码在 `createClientDataSource` 内部的。用户不能自定义管道顺序或插入步骤。

**核心挑战**

1. **可组合管道**：需要类似 `pipe(dataSource).filter(...).sort(...).group(...).page(...)` 的声明式 API，同时每个步骤可替换为服务端调用
2. **混合策略**：`take(50)` + 客户端 `sort` + 服务端 `filter` 的混合是常见但复杂的场景
3. **性能保障**：memo 化需要在管道级别做，而不是每个步骤独立做

**架构变更**

```
packages/core/src/data-source/
├── pipe/
│   ├── DataSourcePipe.ts  # 新增：可组合管道类型
│   ├── clientStep.ts      # 新增：客户端步骤适配器
│   └── serverStep.ts      # 新增：服务端步骤适配器
```

概念模式：

```ts
// 概念接口
dataSource
  .pipe(
    source.filter({ field: 'status', value: 'active' }),
    source.sort({ field: 'name', dir: 'asc' }),
    source.group({ by: 'department' }),
    source.page({ size: 50 })
  )
  .subscribe(result => ...)
```

每个步骤可以是 `client`（本地执行）或 `server`（发送请求），甚至 `hybrid`（部分在客户端、部分在服务端）。

**对现有系统的影响**

- 新增文件，向后兼容：`createClientDataSource` 和 `createServerDataSource` 保留作为默认管道配置的工厂
- 插件可注册自定义步骤（例如 `plugin-pro-table` 可以注册服务端分组步骤）
- 测试复杂度增加（管道组合爆炸）

---

## 3. 接口设计建议

### 3.1 关键模块接口设计原则

Iris UI 已经建立了很好的接口设计模式（受控/非受控双模、`model.sync` 镜像）。以下建议针对此次识别的缺口：

**原则：从「函数工厂」到「可组合控制器」**

- 当前模式：`createXxx(options)` → 返回 `{ state, actions }`
- 演进方向：`createXxx(options)` → 返回 `{ state, actions, pipe(otherController) }` 可组合
- 案例：`createGroupedView` 的 `state` 应该可以被 `createClientDataSource` 的 `state` 消费

**原则：异步资源协议统一**

- 每个异步操作（`loadChildren`、`fetchPage`、`submitForm`）应该有统一的生命周期：
  `{ pending, data, error, cancel(): void, retry(): Promise<T> }`
- 当前 mixins 分散：`useAsync`（core？）、`useResource`（各框架）、`loadChildren` 回调

**原则：保持 `exports` 子路径精简但有策略**

- 当前子路径：`@iris-ui/react/form`、`@iris-ui/react/table` 等
- 新控制器应该放在原路径下，而不是新建子路径——除非该控制器产生大量组件（如分组视图可能需要新的 Table 变种）

### 3.2 是否需要新的抽象层

**判断矩阵**

| 新抽象                    | 需要？  | 理由                                 |
| ------------------------- | ------- | ------------------------------------ |
| `AsyncResource` 协议      | ✅ 是   | 跨框架竞态安全，解决方向①根因        |
| `DataSourcePipe`          | ✅ 是   | 方向④ + 未来混合数据源的基础设施     |
| `IrisFieldError` 类型     | ⚠️ 可选 | 方向③可通过 A2 规避，A3 才需要       |
| `VirtualFrozenController` | ✅ 是   | 方向⑤，冻结窗格涉及滚动同步/区域划分 |
| `IrisGrouping` 控制器     | ✅ 是   | 方向④，将 C 层函数提升为 A 层控制器  |

**关键决策**：不建议为了方向③新增 `IrisFieldError` 类型，因为涟漪太大。建议 A2（连接字符串），等表单系统下一次大重构再统一改。

### 3.3 如何保持向后兼容

对于每个新增控制器：

| 新增                      | 向后兼容策略                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| `createGrouping`          | 纯新增，不影响 `createClientDataSource` 的签名；后者可**选择性组合**前者 |
| `AsyncResource`           | 新增类型 + 工厂，不影响现有 `createExpansion` 的接口；后者可选升级       |
| `DataSourcePipe`          | 新增模式，`createClientDataSource` 保留为快捷工厂（facade）              |
| `VirtualFrozenController` | 新增，不影响 `computeGridVirtualRange` 的现有签名                        |

**核心策略**：所有新控制器走「新增不修改」路线，采用 facade/适配器模式将旧 API 包裹在新抽象之上，而非替换。

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

**方向 A（多错误传播）**：不需要新技术。纯 core 逻辑变更 + 4 框架渲染组件适配。

**方向 B（分组数据视图）**：不需要新技术。现有 `createExpansion` + `createSort` 的组合即可。

**方向 C（冻结窗格）**：可能需要考虑 `@floating-ui/dom` 的 `autoUpdate` 用于滚动同步。但更推荐直接使用原生 `IntersectionObserver` + scroll event，避免额外依赖。

**方向 D（AsyncResource）**：不需要新技术。`AbortController` 是 Web 原生 API，core 里可以直接使用。

**方向 E（DataSourcePipe）**：这是最可能引入新技术栈的方向。如果要做声明式管道，可以考虑：

| 方案                                            | 优点                                   | 缺点                     |
| ----------------------------------------------- | -------------------------------------- | ------------------------ |
| 手写 pipe 模式                                  | 无依赖，类型安全                       | 需要较多的样板代码       |
| **使用现有函数式组合**（compose/pipe 高阶函数） | 零额外依赖，Iris UI 已有类似模式       | 需要类型体操             |
| 借鉴 RxJS Observable 模式                       | 管道操作符丰富，取消/重试/合并原生支持 | 引入 5KB+ 依赖，学习曲线 |

**推荐**：手写 pipe 模式。Iris UI 核心原则包含「core 零框架依赖」，同样应尽量零第三方依赖。调用链可以用 builder pattern（`ds.filter().sort().page()`）实现，足够覆盖 95% 场景。

### 4.2 第三方依赖评估标准

Iris UI 当前对第三方依赖的态度已经明确（AGENTS.md: `@floating-ui/dom` 用于定位、CodeMirror 6 用于编辑器插件）。对于架构扩展方向，评估标准应为：

```
严拒       ⚠️ 审慎      ✅ 可接受      推荐
Tailwind   tiny library   @floating-ui   原生 API
CSS-in-JS   >5KB dep    标准 WS 类型    AbortController
Emotion                  class-variance-authority
```

### 4.3 自建 vs 采购

这次分析的所有 5 个方向都涉及 core 自身的补齐或修复，不存在「采购」选项。唯一可能考虑第三方的是：

- 分组表格 UI（如 ag-Grid）：但 Iris UI 的定位是框架无关的组件库，不可能依赖 ag-Grid
- 虚拟化冻结窗格：可以借鉴 TanStack Virtual 的冻结列思路（它们也不支持），但需要自建

**结论**：全部自建，这与 Iris UI「基础能力沉淀 core」的使命一致。

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级 | 方向                                | 预估工作量 | 架构影响 | 理由                                   |
| ------ | ----------------------------------- | ---------- | -------- | -------------------------------------- |
| **P0** | **① Solid Tree loadChildren**       | 0.5—1 天   | 低       | Parity bug，违反 AGENTS.md 核心承诺    |
| **P0** | **② 集成 createMemoizedFilterSort** | 0.5 天     | 极低     | 5 行修复，0 API 破坏，性能收益立竿见影 |
| **P1** | **③ 多错误传播（A2 方案）**         | 0.5—1 天   | 低       | UX 改善，涟漪面小                      |
| **P1** | **④ 状态化分组视图控制器**          | 3—5 天     | 中       | 架构缺口填补，企业必需能力             |
| **P2** | **⑤ 虚拟化冻结窗格**                | 5—10 天    | 中       | 复杂度高，但手动 CSS sticky 可临时覆盖 |
| **P2** | **⑥ AsyncResource 竞态协议**        | 2—3 天     | 中       | 长期跨框架竞态安全的基础设施           |
| **P2** | **⑦ DataSourcePipe**                | 5—8 天     | 高       | 数据流编排的架构升级，依赖分组视图完成 |

### 5.2 阶段划分

```
里程碑            时间点      交付物
─────────────────────────────────────────────────────────
M1: Parity+Perf   Day 1-2    ① loadChildren(Solid) + ② memo filter
M2: UX QuickWin   Day 3-4    ③ 多错误传播(A2)
M3: Grouping      Day 5-12   ④ createGrouping 控制器
                              + React/Vue Table 接入组级 UI
M4: Async Core    Day 13-17  ⑥ AsyncResource 协议
                              + Solid Tree 接入 → 消除竞态
M5: Virtual Pro   Day 18-30  ⑤ VirtualFrozenController
                              + 四框架 VirtualTable 接入
M6: Pipe Arch     Day 31-45  ⑦ DataSourcePipe
                              + createClientDataSource 作为 facade
                              + 插件可注册自定义数据源步骤
```

### 5.3 风险点和缓解策略

| 风险                                                                                                   | 概率 | 影响 | 缓解                                                                            |
| ------------------------------------------------------------------------------------------------------ | ---- | ---- | ------------------------------------------------------------------------------- |
| **方向④分组视图蔓延到插件**：需求太大，导致「分组组件」变成新复杂度中心                                | 中   | 高   | 严格限制 `createGrouping` 的职责：只做状态，不做渲染；渲染样式部分走 token      |
| **方向⑤冻结窗格在 Svelte 适配困难**：Svelte 的 `bind:this` 方式与 React ref 差异大，双窗口同步可能复杂 | 高   | 中   | C2 方案将滚动同步逻辑下沉 core，适配器只处理模板绑定；Svelte 可用 `use:` action |
| **方向⑦ DataSourcePipe 与现有 `createClientDataSource` 不兼容**                                        | 中   | 高   | 保留旧工厂为 facade，不删除；迁移期共存；用 `@deprecated` 标记                  |
| **测试组合爆炸**：方向④⑥⑦的组合状态很多（2级分组 × 3层展开 × 分页 × 排序 × 4框架）                     | 高   | 中   | 测试集中在 core（框架无关），每框架只测渲染+桥接；避免 E2E 全覆盖               |
| **方向③ A2 方案被否决**，团队坚持 A3                                                                   | 中   | 高   | A3 涟漪面大，需要单独排期（预估 3-5 天全链路）                                  |

### 5.4 架构决策记录（ADR）建议

以下决策点应该在实施前记录 ADR：

1. **ADR-001**：多错误传播选择 A2（`string` 连接）vs A3（`string[]` 全链路）
2. **ADR-002**：`createGrouping` 是独立控制器 vs 作为 `createClientDataSource` 的内部步骤
3. **ADR-003**：`VirtualFrozenController` 使用四窗口分割 vs 三区域 + CSS sticky 混合
4. **ADR-004**：`DataSourcePipe` 使用 builder pattern vs 函数式 compose vs RxJS

建议在 M1 完成后立即启动 ADR-002 的讨论，因为它直接影响方向②的 memo 化接口设计。

---

## 总结

这份代码级分析揭示的 5 个方向，从架构视角看可以归为三类：

1. **执行缺口**（方向①②）：核心逻辑已存在但未消费——P0 修复，零或低架构讨论
2. **类型设计债**（方向③）：早期设计妥协产生涟漪——推荐走最小修复路径（A2），预留重构空间
3. **架构成熟度缺口**（方向④⑤⑥⑦）：企业级能力从「适配器手写」提升为「core 控制器」——这是架构的自然演化，需要 1-2 个月的持续投入

最值得肯定的发现是：**分析中的 5 个方向没有一个是「选错了技术栈」或「需要推倒重来」**。它们都是增量补齐式改进，验证了 Iris UI 的架构本身是正确的，只是还在成熟过程中。
