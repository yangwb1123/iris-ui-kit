# 🏗️ Iris UI 架构分析与扩展设计

> 基于交叉验证报告 + 源码事实核查，从架构师视角进行技术设计分析

---

## 目录

1. [架构评估](#1-架构评估)
2. [高价值扩展方向](#2-高价值扩展方向)
3. [接口设计建议](#3-接口设计建议)
4. [技术选型](#4-技术选型)
5. [实施路线图](#5-实施路线图)

---

## 1. 架构评估

### 1.1 当前架构优势

**A/B/C 分类原则在实践中验证有效**。交叉验证报告多项发现印证了这一点：

| 资产                                        | 归属                    | 验证结论                     |
| ------------------------------------------- | ----------------------- | ---------------------------- |
| `createSortable` / `closestCenter`          | A (core)                | ✅ 四框架共享，Kanban 已证明 |
| `resolveDataState` / `useDataState`         | A (core → 桥)           | ✅ 框架可用，仅 2 组件消费   |
| `buildHeaderMatrix` / `computeVirtualRange` | A (core)                | ✅ 已实现，适配器引用        |
| `when` 条件可见性                           | B (plugin-form-builder) | ✅ 基础已实现                |
| `IrisVirtualScroll` → `createVirtualizer`   | B (组件包装)            | ✅ Fenwick tree O(log n)     |
| 粘性表头 / 三面板架构                       | **缺口**                | 架构未定义，组件内手动处理   |

**核心判断**：A/B/C 分类在过去一年成功指导了代码产出，但存在一个**未被预期的架构裂缝**——Layer 2 复合组件（Table/Form）的复杂性在四框架对齐过程中暴露了 A/B/C 分类的边界模糊区。

### 1.2 关键架构裂缝

#### 裂缝 1：Layer 2 复合组件缺乏「子架构」定义

表格是**四层复合体**：

```
Table (容器)
├── TableHeader (表头矩阵)       ← 有 buildHeaderMatrix 但无独立的粘性上下文
├── TableBody (虚拟化行)         ← 有 IrisVirtualScroll 但独立溢出不可控
├── TableSummary (汇总行)        ← 与表体共享滚动
└── TableRow / TableCell (行列)  ← 有 pinnedStyle 但 z-index 缺失
```

当前架构的问题不在某个功能缺失，而在**没有一个文档化/类型化的「表格子架构」**来规定：

- 哪个层控制滚动
- 哪个层负责 `overflow` 裁剪
- 粘性元素之间的 `z-index` 层级协议
- 固定列与虚拟化列的交互契约

**后果**：粘性表头（`top:0`）需要表头与表体分离到不同滚动容器，但当前 `TableHeader` 与 `TableBody` 共享同一个 `overflow`。这不是代码 bug——是架构没有定义「表头应该有自己的滚动上下文」。

#### 裂缝 2：「行为」与「数据」的桥接层厚度不一

从 cross-validation 数据看：

| 桥接层                  | 厚度      | 问题                                             |
| ----------------------- | --------- | ------------------------------------------------ |
| `useDataState` (React)  | ~15 行    | 忽略 `hasContent`，不支持 stale-while-revalidate |
| `useSelectionModel`     | ~30 行    | ✅ 完整桥接 `model.sync`                         |
| `createSortable` 各框架 | ~40-60 行 | ✅ 包含完整生命周期桥接                          |
| `useDrag`               | ~50 行    | ✅ 完整桥接指针状态                              |

**规律**：当桥接层**只透传**时（`useDataState`），容易遗漏核心功能；当桥接层**有完整生命周期映射**时（sortable/drag），反而更可靠。

**架构建议**：薄桥 ≠ 简单桥。薄桥应该是对 core 逻辑的**1:1 语义映射**，不是「挑几个 prop 暴露」。

#### 裂缝 3：Cross-cutting concerns 没有架构归属

交叉验证报告中多次出现的「系统性缺口」：

| 问题           | 涉及组件               | 当前状态               |
| -------------- | ---------------------- | ---------------------- |
| `z-index` 层级 | Table 粘性列 + 表头    | 手动 `zIndex: 1`       |
| SSR 条件渲染   | Portal/Dialog/Toast    | `typeof document` 模式 |
| 加载状态视觉   | List/Tree/Table/Select | 各自 if/else           |

这些都不是某一个组件的 bug——它们是**跨组件的契约缺失**。当前架构中，跨组件契约的承载点是：

- Token（`--iris-z-index-dropdown` 等）——✅ 有，但不完整
- 组件文档（`<Component /> usage`）——❌ 没有架构级文档
- `AGENTS.md`——✅ 有约定，但不够细

**建议**：引入 **ADR（Architecture Decision Record）** 目录 `docs/adr/`，记录跨组件契约。例如 `ADR-001: Z-index 层级协议`。

### 1.3 架构债务清单

| #   | 债务                                  | 类型       | 影响面         | 偿还成本 |
| --- | ------------------------------------- | ---------- | -------------- | -------- |
| 1   | `useDataState` 缺失 `hasContent` 桥接 | 桥接遗漏   | 多组件加载态   | 🟢 低    |
| 2   | Table 表头与表体共享溢出容器          | 架构缺失   | 粘性表头不可用 | 🔴 高    |
| 3   | 列虚拟化用裸 `computeVirtualRange`    | 实现降级   | 大表格列性能   | 🟡 中    |
| 4   | 详情行导致虚拟滚动禁用                | 逻辑冲突   | 详情行性能     | 🟡 中    |
| 5   | Portal SSR 无统一抽象                 | 模式缺失   | RSC 兼容性     | 🟢 低    |
| 6   | Vue/Solid/Svelte 无 `useDataState`    | 适配器缺口 | 非 React 框架  | 🟢 低    |
| 7   | `z-index` 无跨组件层级协议            | 契约缺失   | 分层元素重叠   | 🟢 低    |

**关键判断**：除 #2（高成本重构）外，其余债务均为低-中成本，属「高价值早期偿还」类型。

---

## 2. 高价值扩展方向

基于交叉验证的事实修正，以下是 5 个架构层面的扩展方向，按杠杆率排序。

---

### 方向 A：DataState 统一数据状态层

**为什么需要**

当前 `resolveDataState` + `useDataState` 已在 core 和 React 桥接层就绪，但仅 2/10+ 组件使用。每个组件手动实现 `loading ? <Spinner /> : error ? <Error /> : empty ? <Empty /> : <Content />` 模式——这是**重复代码**，也是**不一致的来源**。

ROI 极高：已有底层，仅需上层铺开。

**核心挑战**

1. **状态 → 视觉的映射多样性**：不仅是 `<Spinner />` vs `<Skeleton />` vs `<InlineLoader />`——Table 可能需要在 loading 时保留旧数据（stale-while-revalidate），Tree 可能需要在 loading 时显示骨架行。`useDataState` 的 `{ loading, error, empty }` 三元组不足以表达「正在加载但已有内容」。

2. **`hasContent` 桥接缺失**：core 的 `resolveDataState` 支持 `hasContent` 作为输入，但 `useDataState` React 桥接没有暴露这个参数——导致 stale-while-revalidate 在 React 端无法使用。

3. **Skeleton 集成**：`IrisSkeleton` 已存在，但架构没有定义「什么状态下使用 Skeleton vs Spinner」。需要一个视觉策略模式。

**预期架构变更**

```
当前：
  Component.tsx:
    if (loading) return <Spinner />
    if (error) return <Error error={error} />
    if (!data.length) return <Empty />
    return <ActualContent data={data} />

目标：
  const { loading, error, empty } = useDataState({ items, loading, error, hasContent: items.length > 0 })
  // 默认渲染模式 useDataState 接管，组件只关注内容渲染
```

架构变更很轻——主要是桥接层补全 + 组件消费模式统一。不需要新的抽象层。

**对现有系统的影响**

- **积极**：消除 10+ 组件的重复状态处理代码；统一 loading 视觉语言
- **风险**：现有组件可能已经有个性化加载状态（如 Table 的 `loadingOverlay`），需要检查兼容
- **兼容策略**：`useDataState` 作为可选接入，不影响现有 prop API

---

### 方向 B：Table 三层面板架构

**为什么需要**

交叉验证修正了原始分析的 4 处源码错误，但核心缺口仍然真实——粘性表头（`top:0`）缺失是因为**表头与表体同容器的架构限制**，不是代码没写。

表头 + 左固定列 + 右固定列 + 可滚列 + 虚拟化行 = 当前 Table 需要同时满足的 5 个正交维度。当前架构把它们全放在一个组件树里，导致：

- 粘性表头：❌ 需要独立溢出容器
- 固定列：✅ 但 `z-index` 管理脆弱
- 列虚拟化：⚠️ 裸 computeVirtualRange
- 详情行 + 虚拟滚动：❌ 互斥

**核心挑战**

1. **三面板滚动同步**：左固定面板（`overflow:hidden`）+ 中可滚面板（`overflow:auto`）+ 右固定面板（`overflow:hidden`）需要同步 `scrollTop`。当启用虚拟滚动时（`IrisVirtualScroll` 接管 body），同步逻辑更复杂。

2. **表头行高管理**：分组表头（`buildHeaderMatrix`）有多行，固定列的表头行高必须与滚动区域的表头行高对齐——grid 布局下不是问题，但当表头分离到不同容器后需要 `ResizeObserver` 协调。

3. **`z-index` 层级协议**：
   - 表体行 → `z-index: auto`
   - 滚动表头 → `z-index: 1`（粘性 `top:0`）
   - 固定列单元格 → `z-index: 2`（粘性 left/right）
   - 固定列 + 表头交叉区域 → `z-index: 3`
   - 需要 token 化：`--iris-z-index-table-sticky-header` / `--iris-z-index-table-pinned-cell`

4. **详情行高动态**：`createVirtualizer` 的 measured-size cache 正是为这个场景设计，但当前代码直接跳过。需要支持 `accordionDetail` + `virtualScroll` 共存。

**预期架构变更**

这是一个**中等规模的架构变更**，涉及 Table 的内部重构：

```
当前（单容器）：
  Table (overflow: auto)
    ├── TableHeader (grid columns)
    ├── TableBody (IrisVirtualScroll)
    └── TableSummary

目标（三面板）：
  Table
    ├── LeftPanel (overflow: hidden, sticky 定位列)
    │   ├── TableHeader (左固定列表头)
    │   └── TableBody (左固定列行)
    ├── ScrollPanel (overflow: auto, 主滚动)
    │   ├── TableHeader (粘性 top:0)
    │   ├── TableBody (IrisVirtualScroll)
    │   └── TableSummary
    └── RightPanel (overflow: hidden, sticky 定位列)
        ├── TableHeader (右固定列表头)
        └── TableBody (右固定列行)
```

**对现有系统的影响**

- **负向**：重大重构。所有使用 Table 的应用（playground、CMS 四个框架 demo）都需测试
- **兼容策略**：
  - 新架构在 `pinnedColumns.length > 0 || stickyHeader` 时启用，否则维持单容器（默认兼容）
  - 使用三面板时，`TableProps` 不变——重构对外暴露的 API 不变
  - 分步实施：先 `stickyHeader`（+独立滚动），再 `pinnedColumns`（+三面板），最后 `z-index` 层级治理

---

### 方向 C：Sortable 集成契约

**为什么需要**

`createSortable` + `IrisSortable` + `useDrag` 已在 core 和所有四框架就绪，Kanban 已证明架构有效。但 Table/List/Transfer 这三个最需要拖拽排序的组件**完全没有集成**。

这不是代码问题——是**架构没有定义「如何给组件附加可排序能力」的模式**。

**核心挑战**

1. **排序与数据变更的生命周期**：拖拽排序不只是视觉重排，它需要触发数据变更（`onReorder: (fromIndex, toIndex) => void`）。当前 `IrisSortable` 行为不关心数据来源——组件需要自己处理 `reorder` 后的数据更新。

2. **树形数据的放置语义**：`closestCenter` 只做最近中心查找（O(n)），不关心层级。需要：

   ```ts
   type DropPosition = 'before' | 'inside' | 'after'
   ```

   这需要 `useDrag` 支持**在节点上 1/3 分割**判断 hover 区域，且对于 Tree 的展开/收起状态有交互影响。

3. **边缘自动滚动**：拖拽到容器边缘时自动滚动（`autoScroll`）——`useDrag` 的 `delta` 已有坐标信息，但缺一个「边界检测 + 触发滚动」包装器。

4. **无障碍**：拖拽排序必须支持键盘（上下/左右箭头移动）。当前 `createSortable` 的可排序列表没有键盘排序语义——需要 `aria-roledescription="sortable"` + `aria-grabbed` + 键盘 reorder。

**预期架构变更**

不需要新的抽象层，需要的是一个**集成契约**——即每个可排序组件需要实现的接口：

```
对组件的期望：
  props: { sortable?: SortableOptions; onReorder?: (payload: ReorderEvent) => void }
  内部:
    const { activeId, overId, direction, ... } = useSortable({ items: data, ... })

    拖拽手柄渲染:
      <IrisSortable.Handle /> 或 as-child 模式的拖拽触发器

    reorder 逻辑:
      onReorder({ fromIndex, toIndex }) → 组件更新自身数据
```

**对现有系统的影响**

- **积极**：单组件约 50-80 行接入代码，适合渐进式集成
- **风险**：Tree 的层级拖拽需要 `useDrag` 扩展，属于 core 变更（A 类），需谨慎设计
- **兼容策略**：`sortable` prop 默认为 `false`，不影响现有用法

---

### 方向 D：富条件表单引擎

**为什么需要**

交叉验证发现 `when` 条件可见性已在 `plugin-form-builder` 实现，但：

- 只有显示/隐藏（`when`）没有必填/禁用条件（`requiredWhen` / `disabledWhen`）
- core 的 `createFormStore` 对条件字段零感知
- 不支持路径嵌套条件（`items[].type === 'other'` → 显示 `items[].otherField`）

当前 `createFormStore` 负责「表单状态管理」（值/验证/提交），`plugin-form-builder` 负责「表单定义」（schema/条件/步骤）。两组件的职责边界在条件字段上交叉了——条件需要**值变化触发表单状态变更（验证/必填/禁用）**，这条路必须通过 `createFormStore`。

**核心挑战**

1. **条件与验证的耦合**：当前 `validators[field.name]` 在 `form-builder` 层已经使用 `isVisible` 跳过隐藏字段的必填验证。但 `requiredWhen` 需要更精细的「动态规则」——验证器必须能响应其他字段的值变化。这需要 `createFormStore` 支持**依赖追踪**：

   ```ts
   dependsOn: string[] // 声明依赖字段 → 当被依赖字段变化时重算本字段验证
   ```

2. **条件与值的时序**：一个字段隐藏时，它的值应该：
   - 被从提交值中排除？✅（当前 `stepFields` 过滤可做到）
   - 被保留但标记为隐藏？可能需要（多步骤表单跨步保留值）
   - 当前架构对这一步的定义不清晰

3. **路径嵌套条件**：`items[].type === 'other'` 这种数组内条件需要 `lodash.get` / `path` 风格的值访问器。当前 `when: (values: FormValues) => boolean` 对整个 values 对象都可见，技术上可以实现，但需要约定规范。

**预期架构变更**

```
当前：
  core/createFormStore  ─── 值/验证/提交（无条件感知）
  plugin-form-builder   ─── schema + when（条件在插件层）

目标：
  core/createFormStore ─── 值/验证/提交 + dependsOn + 条件重验
  plugin-form-builder  ─── schema + when/requiredWhen/disabledWhen
```

需要在 `createFormStore` 中新增 **条件依赖管理**——这是一个 A 类变更，影响所有四框架适配器。但影响面可控：只扩展内部 `validators` 逻辑，不改变外部 API。

**对现有系统的影响**

- **中等**：`createFormStore` 是 core 的核心模块，四框架都有桥接。但条件依赖是添加而非修改现有逻辑，兼容性好
- **风险**：条件字段的验证重算可能导致无限循环（A 依赖 B，B 依赖 A）。需要依赖图拓扑排序 + 循环检测
- **兼容策略**：现有 `validators` 用法不变；新的 `dependsOn` / `requiredWhen` 为可选扩展

---

### 方向 E：SSR/Hydration 安全模式

**为什么需要**

交叉验证确认 Portal SSR 缺口真实存在。虽然 React 19 RSC 不会因 `typeof document` 条件而崩溃，但：

1. **Layout shift**：Portal 内容在服务器 HTML 中不存在，客户端首次渲染突然出现
2. **Toast 队列的独特问题**：`IrisToastViewport` 作为 portal 容器，服务器无输出但客户端有——hydration 不匹配在 React 19 下更严格
3. **所有四框架都有相同缺口**，跨框架的通用性问题比单个框架严重

**核心挑战**

1. **Portal 的 SSR 架构选项**：

   | 方案                        | 成本 | 效果                                                    |
   | --------------------------- | ---- | ------------------------------------------------------- |
   | A. 服务器渲染 Portal 占位符 | 低   | 渲染 `<div data-iris-portal="toast" />`，客户端 hydrate |
   | B. `useEffect` 延迟挂载     | 低   | 默认行为，但 React 19 下可能触发 warning                |
   | C. 客户端专属渲染标记       | 低   | `suppressHydrationWarning`，放弃服务端匹配              |
   | D. Portal 内容的 Streaming  | 高   | RSC 流式下发 portal 内容，架构重                        |

   **推荐**：方案 A（占位符）+ 方案 C（特定组件 fallback）。A 覆盖 Portal 容器；C 覆盖内容完全不在服务端渲染的场景。

2. **测试覆盖率系统性不足**：当前 SSR 测试只覆盖 16 个无 Portal 组件。需要建立**「每组件 SSR 测试」**的 CI 门禁标准——新增组件时必须包含 SSR 测试（根据 AGENTS.md 的质量门，已有格式检查，但 SSR 测试未列入门禁）。

3. **四框架 SSR 测试设施不统一**：React 有 `renderToString` + jsdom；Vue 有 `@vue/server-renderer`；Solid 有 solid-ssr；Svelte 有 `svelte/server`。当前仅 React 有 SSR 测试。

**预期架构变更**

不需要新的抽象层。需要的是**架构约束**：

```
1. 所有 Portal 组件必须提供 SSR-safe 占位符
   模式: <IrisPortal fallback={<div data-iris-portal />}>

2. 新增组件必须包含 SSR 测试
   CI 门禁: pnpm test:ssr → 所有组件均通过（含 Portal）

3. 四框架统一 SSR 测试脚本
   当前仅 React → 扩展为四框架并行 (pnpm turbo run test:ssr)
```

**对现有系统的影响**

- **积极**：防患于未然。React 19 RSC + Next.js App Router 正在成为主流，现在修复比被用户报告 bug 后再修成本低 10x
- **风险**：新增 SSR 测试可能发现现有组件的隐藏问题（如 `useId` 在非 React 框架下的 SSR 稳定性）
- **兼容策略**：占位符渲染不影响客户端行为；`suppressHydrationWarning` 仅用于明确不匹配的场景

---

## 3. 接口设计建议

### 3.1 核心接口设计原则

基于交叉验证发现的模式，提炼四条原则：

**原则 1：每个核心模块需要明确的「边界契约」**

当前 `createFormStore` 没有文档化它与 `plugin-form-builder` 的职责边界。建议每个 core 模块（`createFormStore` / `createSelectionModel` / `createResourceController` 等）声明：

```
// 每个模块顶部应有如下注释（已在 AGENTS.md 约定，但未强制执行）
/**
 * @scope core - 表单状态管理（值/验证/提交）
 * @scope plugin - schema 驱动、条件字段、步骤导航
 * @bridge React - createFormStore → useFormStore
 */
```

**原则 2：桥接层必须 1:1 映射核心语义**

`useDataState` 遗漏 `hasContent` 违反了此原则。桥接层应该**暴露所有核心语义**，或者显式声明「此语义不在本框架支持」。

```
// 桥接层应遵循的检查清单：
// - 是否暴露了 core 模块的所有输入参数？
// - 是否暴露了 core 模块的所有返回值？
// - 如果某个参数/返回值不支持，是否有显式注释说明原因？
```

**原则 3：复合组件需要有「子架构规格说明书」**

Table / Form / Menu / AdminShell 这些 Layer 2+ 组件包含多个子组件，需要文档化：

- 子组件之间的交互协议（如：TableHeader 与 TableBody 共享哪个溢出容器？）
- 状态传递路径（如：筛选状态从 Table → TableBody → 数据请求 → 更新）
- `z-index` 层级图表

**原则 4：跨组件契约用 token，跨模块契约用类型**

- 跨组件契约（`z-index` 层级 / 间距 / 颜色）→ `--iris-*` token
- 跨模块契约（`onReorder` 类型 / `DataState` 类型 / `FormField` 类型）→ TypeScript 接口定义在 core

### 3.2 是否需要新的抽象层

| 候选抽象层                           | 是否需要  | 理由                                                                                                                                              |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDataState` 通用桥接补全          | ✅ 需要   | 补全 `hasContent` 参数，所有四个框架各加一个 ~20 行的桥接。**不是新层，是现有层补全**                                                             |
| Table 三面板布局容器                 | ✅ 需要   | 现有 Table 组件需要内部重构，新增 `TablePanel`（内部组件，不导出）用于管理三个面板的滚动同步。这是内部实现细节，对外 API 不变                     |
| Sortable 集成 mixin/helper           | ❌ 不需要 | 每个组件 50-80 行的 sortable 接入代码不需要共用的抽象层——各组件的数据重排逻辑不同，无法通用抽象。提供文档化的「接入模式」比提供假共用的抽象更可靠 |
| Form 条件依赖追踪引擎                | ⚠️ 需要   | `createFormStore` 需要内部扩展，新增 `dependsOn` 支持。这是 core 现有模块的增强，不是新层                                                         |
| Portal SSR 安全包装器                | ✅ 需要   | `IrisPortal` 组件（已在计划中）可以作为所有 Portal 用法的统一出口，内置 SSR 占位符逻辑                                                            |
| 滚动同步管理器（ScrollSynchronizer） | ⚠️ 可选   | 三面板 + 虚拟滚动的滚动同步是一个通用需求（也适用于 AdminLayout 的侧边栏 + 主内容）。可以独立为 core 模块，但需要评估复用场景是否足够             |

**核心判断**：不需要引入任何全新架构层。所有缺口都可以通过**现有层的增强**填补。如果未来有 3+ 组件需要滚动同步，再独立为 `ScrollSynchronizer`。

### 3.3 向后兼容策略

| 变更类型                | 兼容策略                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `useDataState` 新增参数 | `hasContent` 为可选参数，默认 `false`（即当前行为），强制用户无感知                 |
| Table 三层重构          | `pinnedColumns.length > 0 \|\| stickyHeader` 时启用新架构；无这些 prop 时维持单容器 |
| `createFormStore` 增强  | `dependsOn` 字段在验证器元数据中新增，现有 `validators` 用法不变                    |
| Sortable 接入           | `sortable` prop 默认 undefined，不影响现有代码                                      |
| Portal SSR 占位符       | 组件内部变更，对外 API 不变                                                         |

**关键原则**：所有增强都必须向下兼容。如果某个变更需要 breaking change，它应该被推迟到 v2 或设计为插件。

---

## 4. 技术选型

### 4.1 是否需要新框架/库

基于交叉验证，当前技术栈（pnpm/Turborepo/tsup/Vitest/TypeScript strict）完全足够支撑 5 个方向。不需要引入新框架。

唯一需要评估的第三方依赖：

| 候选依赖                     | 场景                  | 建议    | 理由                                                                                                                               |
| ---------------------------- | --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@dnd-kit/core`              | 拖拽排序（替代自建）  | ❌ 放弃 | 自建 `createSortable` + `useDrag` 已在四框架对齐且 Kanban 验证通过。替换成本 > 收益                                                |
| `@tanstack/react-virtual`    | 虚拟滚动（替代自建）  | ❌ 放弃 | `IrisVirtualScroll` 已封装 `createVirtualizer` + Fenwick tree，功能完整                                                            |
| `react-hook-form` / `formik` | 表单（替代自建）      | ❌ 放弃 | `createFormStore` 是四框架通用的核心资产，替换将破坏四框架一致性                                                                   |
| `zod` / `yup`                | 表单验证 schema       | ⚠️ 评估 | 当前 `validators: Record<string, ValidateFn>` 是手写验证函数。引入 `zod` schema 可以与 `when` 条件一起使用。但需要评估四框架一致性 |
| `react-aria-components`      | 无障碍（参考）        | ⚠️ 参考 | 不引入，但可参考其 keyboard/roving/focus 模式来完善 Iris 组件                                                                      |
| `react-stately`              | 数据/选择状态（参考） | ⚠️ 参考 | 不引入，但 `createSelectionModel` 的 API （`selectedKeys`/`onSelectionChange`）对齐了 react-stately 的 pattern                     |

**结论**：当前技术栈无需新增。核心价值主张（四框架一致 + 框架无关 core）决定了自建方案优于引入框架特定依赖。

### 4.2 第三方依赖评估标准

对于未来任何第三方依赖评估，建议建立统一的评估维度：

```
评估矩阵：
1. 🏗️ 四框架兼容性（权重：高）
   - 能在 React/Vue/Solid/Svelte 中一致使用？
   - 还是只支持 React？

2. 🔄 可替换性（权重：高）
   - 依赖是否可被内部实现替换？
   - 是否使用了核心逻辑（如 floating-ui 的定位算法）vs 仅仅是一个工具函数？

3. 📦 体积影响（权重：中）
   - 纳入后对 core/adapter/skins 各包的 size 预算影响

4. 🔒 维护风险（权重：中）
   - 依赖的发布频率、维护者活跃度、许可证

5. 🔧 SSR 安全性（权重：高 — 基于交叉验证）
   - 依赖是否支持 SSR？
   - 是否使用了 `document`/`window` 等浏览器 API？
```

### 4.3 自建 vs 采购决策

基于交叉验证数据，当前自建策略总体正确。特别验证：

| 自建资产             | 验证结果 | 理由                                                          |
| -------------------- | -------- | ------------------------------------------------------------- |
| `createSortable`     | ✅ 正确  | 四框架对齐 + 完整生命周期（press→drop→cancel）+ 已用于 Kanban |
| `createVirtualizer`  | ✅ 正确  | Fenwick tree O(log n) + measured-size cache + scrollToIndex   |
| `createFormStore`    | ✅ 正确  | 四框架共享 + 与 plugin-form-builder 的边界清晰                |
| `useFloating` 封装   | ✅ 正确  | 基于 `@floating-ui/dom`，但 IrisPopover/IrisTooltip 做薄封装  |
| `pinnedStyle` 粘性列 | ✅ 正确  | 原生 CSS `position: sticky` + `offsets` 计算，无需第三方      |

**唯一需要重新评估的自建**：

- `computeVirtualRange` 的列虚拟化 → 是否应该用 `createVirtualizer` 统一？当前列虚拟化用裸 `computeVirtualRange` 而 `IrisVirtualScroll` 用 `createVirtualizer`——两个虚拟化实现不一致。建议**统一到 `createVirtualizer`** 或者**复用 `IrisVirtualScroll`** 作为列虚拟化容器。

### 4.4 测试基础设施增强

交叉验证暴露的测试缺口需要技术选型层面的响应：

| 缺口                         | 当前工具         | 增强方案                                                                               |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| SSR 测试覆盖率低             | `renderToString` | 新增 CI 门禁：`pnpm test:ssr` 必须覆盖所有组件                                         |
| 无组合测试（粘性+固定+虚拟） | 无               | 新增集成测试分类 `integration/`，用真实滚动容器测试                                    |
| 四框架 SSR 测试不统一        | 仅 React         | 各框架新增 `test:ssr` 脚本（Vue/VitePress SSR、Solid/solid-ssr、Svelte/svelte/server） |
| Hydration 测试仅 8 组件      | `hydrateRoot`    | 扩充覆盖到所有 Portal/Modal/Toast 组件                                                 |

**建议**：将「新增组件必须包含 SSR 测试」写入 `AGENTS.md` 质量门部分（当前只有 `pnpm turbo run test typecheck lint build`，缺少 `test:ssr`）。

---

## 5. 实施路线图

### 5.1 优先级排序

基于交叉验证修正后的优先级，结合架构影响：

```
P0++（最高 ROI，最低成本）
  └── 方向 A: DataState 统一数据状态层
      ├── 补全 useDataState hasContent 桥接
      ├── 覆盖 8+ 组件（含 Vue/Solid/Svelte 桥接）
      └── 预计增量: ~400 行（含测试）

P0（高产品影响，中等成本）
  ├── 方向 D: Sortable 集成契约
  │   ├── Table 行拖拽排序
  │   ├── List 拖拽排序
  │   ├── Transfer 拖拽排序
  │   └── Tree 层级拖拽排序（含 useDrag 扩展）
  │
  ├── 方向 E: Portal SSR/Hydration 安全
  │   ├── IrisPortal SSR-safe 包装器
  │   ├── 四框架 Portal 组件的 SSR 测试
  │   └── CI 门禁
  │
  └── 方向 B: Table 三层面板架构
      ├── Phase 1: 粘性表头层分离（stickyHeader）
      ├── Phase 2: 三面板同步（pinnedColumns + 虚拟滚动）
      └── Phase 3: z-index 层级治理 + 详情行+虚拟共存

P1（中等杠杆率）
  └── 方向 C: 富条件表单引擎
      ├── createFormStore dependsOn 支持
      ├── plugin-form-builder requiredWhen / disabledWhen
      └── 路径嵌套条件
```

### 5.2 阶段划分

```
Phase 1 — 基础设施补全（2 周）
  [A] DataState 桥接补全 + 8 组件替换（React 优先）
  [A] Vue/Solid/Svelte useDataState 桥接
  [E] IrisPortal SSR-safe 包装器
  [E] CI 门禁：新增组件必须 SSR 测试

Phase 2 — 产品质量提升（4 周）
  [E] 四框架 Portal 组件 SSR 测试全覆盖
  [E] Hydration 测试扩充到 20+ 组件
  [B] Table Phase 1: 粘性表头层分离（stickyHeader）
  [D] Table/List/Transfer 拖拽排序接入

Phase 3 — 核心能力扩展（4 周）
  [B] Table Phase 2: 三面板同步 + 列虚拟化统一
  [B] Table Phase 3: z-index 层级 + 详情行+虚拟共存
  [D] Tree 层级拖拽排序（useDrag 扩展 + DropPosition 类型）
  [C] createFormStore dependsOn 支持

Phase 4 — 高级模式（4 周，可选）
  [C] plugin-form-builder requiredWhen / disabledWhen
  [C] 路径嵌套条件
  [B] ScrollSynchronizer 独立 core 模块（如复用场景充足）
```

### 5.3 风险点和缓解策略

| 风险                                          | 影响  | 概率  | 缓解策略                                                                                      |
| --------------------------------------------- | ----- | ----- | --------------------------------------------------------------------------------------------- |
| Table 三层面板重构破坏现有用法                | 🔴 高 | 🟡 中 | 默认不启用（优化路径），仅 `stickyHeader`/`pinnedColumns` 时激活；100% 回归测试               |
| `createFormStore` 条件依赖导致无限循环        | 🟡 中 | 🟢 低 | 依赖图拓扑排序 + 循环检测 + `maxDepth` 保护                                                   |
| Tree 层级拖拽的放置语义设计错误               | 🟡 中 | 🟡 中 | 先出 RFC/ADR，评审后再实现；实现时用 Flag 切换（默认 flatten-only）                           |
| React 19 RSC 对 Portal 的限制超出预期         | 🟡 中 | 🟢 低 | 监控 next.js 主分支 issue；当前 `typeof document` 模式可保底，但可能需改为 `client-only` 组件 |
| 四框架 SSR 测试基础设施差异导致回归遗漏       | 🟡 中 | 🟡 中 | 先统一 React 完备覆盖，后三框架并行，不追求同一天上线                                         |
| `useDataState` 替换现有组件加载态产生行为差异 | 🟢 低 | 🟡 中 | 每个组件替换时对照现有视觉快照；走 `feature flag` 渐进替换                                    |

### 5.4 架构决策记录（建议新增）

每个 Phase 的关键设计决策应记录为 ADR：

| ADR # | 主题                     | 触发 Phase | 决策点                                                                 |
| ----- | ------------------------ | ---------- | ---------------------------------------------------------------------- |
| 001   | Z-index 层级协议         | Phase 3    | 定义所有粘性/浮层组件的 z-index token 命名和层级顺序                   |
| 002   | Table 三面板内部架构     | Phase 2    | 选择「grid 布局 + overflow 各自控制」vs「三独立容器 + ResizeObserver」 |
| 003   | 条件依赖图的循环检测策略 | Phase 3    | 编译时（类型级别）vs 运行时（拓扑排序）检测                            |
| 004   | 拖拽放置语义的树形支持   | Phase 3    | `before`/`inside`/`after` 的 1/3 分割策略 + 键盘支持                   |
| 005   | Portal SSR 占位符策略    | Phase 1    | 统一 `<div data-iris-portal>` vs 每个 Portal 组件各自定义              |
| 006   | SSR/集成测试门禁         | Phase 1    | 新组件必须包含 SSR 测试 + 每个组件至少一个集成测试                     |

---

## 总结

**核心发现**：交叉验证修正了原始分析中 4 处具体的代码断言错误，但 5 个方向的**产品缺口判断全部成立**。方向一（Table 三层架构）的标题应从「修复已存在代码」改为「重构表格容器架构」——不是代码修 bug，而是架构推重构。

**最紧急的架构动作**（按顺序）：

1. **Phase 1 立即启动**：DataState 桥接补全 + SSR 安全包装器。这两项是最低成本、最高 ROI 的架构补全
2. **Phase 2 并行准备**：Table 三层架构的设计评审（ADR-002）。这是最高产品影响、最多技术细节的架构变更
3. **Phase 1+2 之间**：建立 SSR 测试门禁 + 集成测试基础设施。没有测试保护就做 Table 重构是自掘坟墓

**最终建议**：针对这 5 个方向实施**「分步增强，不经重构」**的策略——除 Table 三层架构外，其余 4 个方向都可以通过**现有层的补全和组件的渐进式接入**完成。Table 三层架构是唯一需要内部架构变更的方向，且可以通过 `stickyHeader` prop 控制启用路径，实现 100% 向后兼容。
