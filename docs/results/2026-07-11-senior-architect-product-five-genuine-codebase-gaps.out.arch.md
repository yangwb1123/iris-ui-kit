# 架构师分析报告：跨框架 API Surface 治理与插件生态质量门

## 1. 架构评估

### 当前架构的显著优势

iris-ui 的"core + 薄适配器"架构是一种**经过验证的正交分解**。将框架无关的逻辑下沉到 `@iris-ui/core`，让四个适配器只做渲染和反应式桥接，这一决策带来了以下难以复刻的优势：

| 优势                 | 具体体现                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **逻辑复用率最大化** | 149 组件 × 4 框架 ≈ 596 组件实例共享同一套 core 控制器（selection/expansion/roving/etc），每新增一个框架适配器 ≈ 重写薄桥而非重写逻辑 |
| **测试杠杆效应**     | core 中的单测一次覆盖所有框架的行为正确性，适配器只需测试渲染 wiring                                                                  |
| **SSR 安全性**       | core 不依赖 DOM，适配器按框架规范实现 SSR（React `'use client'`、Svelte 无 `$state` 命名冲突等）                                      |
| **Token 杠杆**       | 30 token vs 800 行 CSS（93%+ 节省），一次主题设计驱动全框架换肤                                                                       |

### 核心架构债务

尽管分层设计卓越，但**跨框架 API Surface 一致性**是当前架构中**最突出的隐性债务**：

#### 债务 1：Prop 接口定义分散 × 4 倍

每一个组件的 TypeScript 接口/Props 类型在四个适配器中各有一份独立声明。即使 core 中的行为逻辑完全一致，适配器层的接口却可能悄然偏离：

```
packages/react/src/table/IrisTable.tsx       → interface IrisTableProps { ... }
packages/vue/src/table/IrisTable.vue          → defineProps<IrisTableProps>({ ... })
packages/solid/src/table/IrisTable.tsx        → interface IrisTableProps { ... }
packages/svelte/src/table/IrisTable.svelte    → export let prop: T ...
```

**风险**：没有自动化验证确保 `@iris-ui/react` 的 `IrisTableProps` 与 `@iris-ui/solid` 的 `IrisTableProps` 在结构上等价。现实中已存在细微差异（如某个 callback 签名不同、可选 vs 必选不一致、命名风格偏离）。

#### 债务 2：无集中的 Prop 契约层

当前架构缺少一个**框架无关的组件契约定义层**。Core 定义了行为（控制器、引擎），但没有定义**组件外部 API（props）的形状**。这导致：

- 修改一个 prop（如 `onRowClick` 的签名）需要在 4 个适配器中独立更新
- 新增组件时，开发者在四个适配器中可能遗漏某个 prop
- Review 时难以快速判断四个适配器是否对齐

#### 债务 3：Plugin 接口的跨框架实现漂移风险

插件系统的架构设计是正确的（`createPlugin` + `registerTokens/registerMessages/registerStore`），但**插件在不同框架中的组件实现可能不一致**。例如 `plugin-editor` 的 React 版本可能比 Svelte 版本多一个 prop，形成"静默降级"。

#### 债务 4：Codegen 与 Manifest 未覆盖 Prop 级别

`pnpm gen:manifest` 扫描四个 barrel 生成组件清单和 `llms.txt`，但**只验证"同名导出"，未验证"同签名导出"**。Manifest 能告诉你 IrisTable 在四个框架中都存在，但无法告诉你 props 是否对齐。

### 关键设计决策评估

| 决策                                             | 合理性                | 备注                                           |
| ------------------------------------------------ | --------------------- | ---------------------------------------------- |
| 逻辑下沉 core，适配器做薄桥                      | ✅ **正确**           | 这是系统的"基因级"正确决策                     |
| 不做 `registerComponent`                         | ✅ **正确**           | 保持类型安全 + tree-shaking + manifest 可验证  |
| 每个适配器独立 TypeScript 声明                   | ⚠️ **必要但产生债务** | 独立声明能适配框架特性，但需额外工具保证等价性 |
| 零框架依赖 core                                  | ✅ **正确**           | 这是架构的基石                                 |
| `IrisSlot` + `mergeSlotProps` 保留 render 灵活性 | ✅ **正确**           | 维持了 Radix 级 `as-child` 能力                |

---

## 2. 扩展方向

基于去重分析，方向一（API Surface 治理）是**唯一真正未覆盖的架构缺口**，方向二（插件 Parity 质量门）在新颖角度上仍有独特贡献。以下聚焦这两个方向及其衍生，同时识别出**三个额外的高价值方向**。

---

### 方向 A：跨框架 API Surface 治理系统（P0）

#### 为什么需要

**根本矛盾**：iris-ui 的"同一组件 × 4 框架"模型在架构上承诺了 API 等价性，但当前没有任何机制验证这个承诺。随着 149 组件规模的增长和未来更多组件的加入，**手动维护 prop 等价性的成本呈 O(n×f) 增长**——n 为组件数，f 为框架数。

**业务价值**：

- 防止用户在迁移框架时遇到"同名组件不同 API"的断裂体验
- 降低新增框架适配器的 review 成本（自动验证而非人工逐行比对）
- 为 AI 原生消费层（`llms.txt`）提供更精确的 API 描述

**技术价值**：

- 建立可复用的多框架接口验证基础设施
- 可作为开源项目的差异化竞争力（目前无主流 UI 库做此级别的跨框架验证）

#### 核心挑战和技术难点

**难点 1：不同框架的 Props 表达形式不可直接比较**

React = TypeScript interface + `React.FC<Props>`
Vue = `defineProps()` + 运行时验证 + `withDefaults`
Solid = TypeScript interface + `mergeProps` defaults
Svelte = `export let` + `$props()` rune 写法

**方案探讨**：

| 方案                                               | 优点                          | 缺点                           |
| -------------------------------------------------- | ----------------------------- | ------------------------------ |
| **A1：Prop Name Canonicalization**（统一 prop 名） | 最轻量，仅对比 prop name 集合 | 不覆盖类型签名差异             |
| **A2：TypeScript Compiler API AST 比对**           | 精确到类型定义级别            | 复杂，需处理泛型/重载/条件类型 |
| **A3：运行时契约测试**（每个组件挂载后读取 props） | 可验证实际行为                | jsdom 无法完整模拟             |
| **A4：双向 diff 生成 + CI 门禁**                   | 自动化程度高，可增量          | 第一次 baseline 建立成本高     |

**推荐：A2 为长期方案，A1 为快速起跑方案**

先用 A1（prop name 集合比对）快速建立基线，迭代到 A2（type-level 比对）。

**难点 2：框架特有 prop 的处理**

某些 prop 是框架独有的（如 Vue 的 `v-model` <-> React 的 `value`+`onChange`）。治理系统需要知道哪些差异是**有意为之的框架适配**，哪些是**意外的漂移**。

解决方案：引入 **Prop Mapping 注解系统**——在四个适配器之间建立一道"翻译表"：

```typescript
// 在 core 或 manifest 层定义
{
  component: 'IrisInput',
  // core prop → framework-specific prop 映射
  props: {
    value: { react: 'value', vue: 'modelValue' },
    onChange: { react: 'onChange', vue: "update:modelValue" },
  },
  // 所有框架共同的 props
  common: ['disabled', 'placeholder', 'size', 'variant'],
}
```

此映射表是**自动生成的**（从四个适配器的类型声明提取 diff），而非手动维护——手动维护本身会成为新的债务源。

**难点 3：泛型组件的类型签名比对**

IrisTable 可能是一个泛型组件 `IrisTable<T>`，不同框架的泛型处理方式不同（React 用 JSX 泛型 `<IrisTable<T> />` vs Vue 用 `defineComponent<typeof IrisTable<T>>()`），这使得类型级比对更为复杂。

**建议**: 泛型组件的 prop 比对分两层——1) 非泛型 prop 的完全比对；2) 泛型 prop 仅比对结构签名（`T extends SomeConstraint`），不比对展开后的实际类型。

#### 预期的架构变更

```
当前：
  @iris-ui/core (行为定义)
    → @iris-ui/react (props 声明 A)
    → @iris-ui/vue (props 声明 B)
    → @iris-ui/solid (props 声明 C)
    → @iris-ui/svelte (props 声明 D)
    无 A/B/C/D 等价性验证

建议新增：
  @iris-ui/manifest
    └── prop-surface.ts (从四个适配器提取类型信息)
    └── prop-diff.ts (比较差异，生成 report)
    └── prop-mappings.ts (维护已知的跨框架映射)

  CI 新增：
    pnpm check:props → 对每个组件检查四个适配器的 prop 一致性
```

**对现有系统的影响**：

- **零改动**——纯新增工具链，不影响运行时代码
- Manifest 包是自然归属（已做组件清单扫描）
- CI 门禁可先 warn 后 block，渐进式收紧

---

### 方向 B：插件实现 Parity 质量门（P0 – 领域内新角度）

#### 为什么需要

交叉去重结果已确认：`2026-07-10-architectural-expansion-frontiers.md` 方向四覆盖了"插件生态质量治理"的上层概念，但**未覆盖用 `wc -l` 行数对比检测 stub 实现**这一攻击角度。

**具体问题**：插件（如 `plugin-editor`）按架构应该有 4+ 个框架的 UI 实现（`/react`、`/vue`、`/solid`、`/svelte`），但在开发过程中，团队可能先完成一个框架的完整实现，其他框架只写 stub（骨架代码 + 抛出 "not implemented" 异常）。这些 stub 在 CI 中可能通过编译和基础测试，但实际不可用。

**`wc -l` 检测的原理**：如果一个插件的 React 实现有 2000+ 行代码（真实实现），而同类插件的 Svelte 实现只有 50 行（import + throw），行数差异本身就是一个强烈的异常信号。

#### 核心挑战

| 挑战           | 说明                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| **误报管理**   | 某些框架的代码可能天然更简洁（Svelte vs React）。需要建立 baseline 而非简单阈值 |
| **非代码文件** | template、style 等文件不计入行数可能导致低估实际工作量                          |
| **渐进式开发** | 允许某些框架先 stub 后补全，但要明确标记在 manifest 中                          |

#### 预期架构变更

```
packages/plugin-*/ 新增质量门配置：

plugin-parity.config.json:
{
  "id": "plugin-editor",
  "checks": {
    "lineCountRatio": { "threshold": 0.3 },  // 任何框架的实现行数低于最完整框架的 30% → WARN
    "componentExport": true,                  // 验证所有框架导出了同名组件
    "stubPattern": "throw|not.implemented|TODO"  // 检测 stub 代码
  }
}
```

**CI 新增**：`pnpm check:plugin-parity` → 在所有 `plugin-*` 包上运行上述检查

---

### 方向 C：组件契约的中间表示层（P1 – 核心架构新增）

#### 为什么需要

这是方向 A 的自然延伸。当前架构在"core 行为逻辑"和"适配器渲染"之间缺失一个**显式的组件契约层**——它描述的是：

> **"组件 IrisTable 的 props 是多少？每个 prop 的类型、默认值、是否必填？"**

而 core 描述的是：

> **"组件 IrisTable 的行为逻辑是什么？selection/sort/filter/pagination 如何工作？"**

两者互补，但当前架构只有后者。

#### 契约层设计草图

```
@iris-ui/core
├── behaviors/    (createSelectionModel, createExpansion, ...)
├── engines/      (createMachine, createFormEngine, ...)
├── materials/    (compareValues, getPageRange, ...)
├── plugin/       (createPlugin, runPlugins)
└── contracts/    ← NEW: 无框架依赖的组件契约描述
    ├── IrisTable.contract.ts
    ├── IrisButton.contract.ts
    └── ...
```

每个 `contract.ts` 声明：

```typescript
// 概念性框架无关描述——不是运行时代码，是供工具和人类读取的元数据
export const IrisTableContract = {
  name: 'IrisTable',
  props: {
    data: { type: 'T[]', required: true },
    columns: { type: 'ColumnDef<T>[]', required: true },
    selectionMode: { type: "'single' | 'multiple' | 'none'", default: 'none' },
    loading: { type: 'boolean', default: false },
    onRowClick: { type: '(row: T, index: number) => void', optional: true },
    // ...
  },
  slots: {
    cell: { params: { row: 'T', column: 'ColumnDef<T>' } },
    header: { params: { column: 'ColumnDef<T>' } },
  },
} as const
```

**价值**：

1. 单真相源——四个适配器从此契约生成类型声明（而非各自编写）
2. Manifest/`llms.txt` 可从此自动生成精确的 API 文档
3. AI Codegen 可从此生成正确的组件调用代码
4. Breaking change 检测——契约变化自动标记影响范围

**权衡**：

- **维护成本**：需要为每个组件维护一份 contract，与 core 行为逻辑同步更新
- **类型表达力**：TypeScript 的复杂类型（泛型约束、重载、条件类型）在 JSON 式描述中管理困难

**是否做**：方向 C 是方向 A 的**可选升级路径**。可以先做方向 A（被动检测 prop 漂移），在验证其价值后再决定是否投资方向 C（主动定义 prop 契约）。

---

### 方向 D：组件 API 变更影响分析系统（P1）

#### 为什么需要

当一个 prop 在 React 适配器中从 `optional` 改为 `required`，或者在 core 中某个 controller 的返回值结构改变时，当前架构没有自动检测**这会影响多少个下游组件**。

现有工具链的盲区：

- TypeScript 编译能检测直接的使用处错误，但无法跨包分析"改了这个类型会波及哪些组件"
- Manifest 扫描组件清单，但不跟踪 prop 级别的依赖
- Changesets 管理版本发布，但不分析 API 语义变更的影响范围

#### 核心方案

基于方向 A 的 prop 契约信息 + 方向 C 的契约层（如果引入），构建**API 变更影响矩阵**：

```
IrisTable.onRowClick 从 (row: T) => void 改为 (row: T, event: MouseEvent) => void
  → 影响: @iris-ui/react/src/table (源)
           @iris-ui/vue/src/table (需同步)
           @iris-ui/solid/src/table (需同步)
           @iris-ui/svelte/src/table (需同步)
           @iris-ui/plugin-pro-table (消耗此 prop)
           apps/cms-* (使用方法)
  → Breaking? Yes (签名变更)
  → 建议版本: major bump
```

**CI 门禁**：`pnpm check:api-impact` → PR 时自动输出 API 变更的影响范围报告，辅助 human reviewr 判断是否需要同步修改其他框架。

---

### 方向 E：AI Codegen 的精确上下文层（P2 – 前瞻性）

#### 为什么需要

项目 AGENTS.md 强调"AI 原生 API"和 `llms.txt`，但当前 `llms.txt` 只列出了组件存在性（"IrisTable 在四个框架中均存在"），没有给出 prop 级别的精确描述。

当 AI（如当前 session 中的用户）被要求"帮我在 Vue 中写一个带 selection 的 IrisTable"，它需要知道：

1. `@iris-ui/vue` 中 IrisTable 的 props 是什么
2. selection 相关 props 的名称和类型
3. 与 core `createSelectionModel` 的关系

如果方向 A/C 落地，`llms.txt` 可以自动包含每个组件的完整 prop 描述，**使 AI 消费层达到 prop 级精确度**。

#### 方案

在 `pnpm gen:manifest` 中加入 `--llms` flag，输出增强版 `llms.txt`，包含每个组件的 prop 签名（来自 contracts 层或 diff 结果）。

---

## 3. 接口设计建议

### 关键模块接口原则

| 原则           | 说明                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| **声明式先行** | 所有跨框架 API 差异应记录在声明式配置中，而非隐藏在代码注释或代码审查习惯中         |
| **可渐进采纳** | 治理工具应允许先 warn 后 error，先覆盖核心组件再扩展到全部 149 组件                 |
| **可机器消费** | 所有输出（diff report、影响矩阵、`llms.txt`）应以结构化格式（JSON/JSON Schema）输出 |
| **可人工审查** | 每次 PR 的 prop diff 应以人类可读的格式输出，辅助 reviewer 快速判断                 |

### 是否需要新的抽象层

**短期（方向 A）**：不需要新的抽象层。现有 `@iris-ui/manifest` 包扩展即可——只需新增 prop 扫描和比对能力。

**长期（方向 C）**：需要新增 `contracts/` 层在 `@iris-ui/core` 中。这是架构层面的新增，因为它改变了"prop 定义写在哪"的基本约定——从每个适配器各自声明，变为从 core 契约生成。

**决策框架**：

```
问题规模 < 50 组件  →  方向 A 足够（被动检测 prop 漂移）
问题规模 50-200 组件 →  方向 A + 方向 D（检测 + 影响分析）
问题规模 > 200 组件  →  方向 A + C + D + E（契约驱动 + 检测 + 影响分析 + AI codegen）

当前规模：149 组件 → 方向 A 是立即启动点，方向 C 是下阶段
```

### 向后兼容性

**方向 A 的向后兼容设计**：

```
Phase 1 (0 breaking changes):
  - 新增 pnpm check:props 可选命令
  - 输出 JSON report，不阻断 CI

Phase 2 (0 breaking changes):
  - CI 中 check:props 设为 warn 级别
  - 在 PR comment 中附加 prop diff 报告

Phase 3 (soft breaking — 新政策):
  - 对新组件要求 prop parity 通过才能合并
  - 对现有组件建立 "parity gap" 清单，渐进修复
  - CI 中 check:props 对新增组件为 error，对老组件为 warn
```

**方向 C 的向后兼容设计**：

契约层是**增量引入**的——不需要一次性为 149 组件编写 contract。可以先为核心组件（Table/Dialog/Popover/Tree/Form）编写契约，验证流程后再扩展。

```
Step 1: 选 3-5 个核心组件写 contract
Step 2: 验证从 contract 生成 prop diff 报告
Step 3: 验证从 contract 生成适配器类型声明原型
Step 4: 铺开到全部 Layer 2+ 组件
Step 5: 铺开到 Layer 1 组件（可选，L1 组件多但 prop 简单，ROI 较低）
```

---

## 4. 技术选型

### 核心工具的技术选型

| 需求                | 推荐方案                                  | 备选                           | 选择理由                                                               |
| ------------------- | ----------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| TypeScript AST 解析 | `ts-morph` (基于 TypeScript Compiler API) | `typescript` compiler API 原生 | `ts-morph` 提供更友好的遍历 API，适合快速原型；原生 API 更适合深度定制 |
| 跨框架 Diff 输出    | 自建 JSON Schema 格式                     | GraphQL schema diff            | JSON Schema 生态成熟，与当前 manifest 的 JSON 输出一致                 |
| CI 集成             | GitHub Actions + `pnpm` 工作流            | —                              | 项目已使用此栈，直接复用                                               |
| 报告可视化          | 终端 diff 输出 + PR comment bot           | 独立 Dashboard                 | MVP 阶段低开销，Dashboard 在达到 >100 组件覆盖后需要                   |
| Prop 映射存储       | JSON/YAML 配置文件 + JSON Schema 校验     | 数据库                         | 配置随代码库版本管理，与 monorepo 流程一致                             |

### 第三方依赖评估

**引入新依赖的原则**：

```
是否必须？            →  核心功能无法自建
是否轻量？            →  < 50KB gzip
是否维护中？          →  npm 上周下载量 > 10k + 最近 commit < 6 month
是否框架无关？        →  不能依赖 react/vue/solid/svelte
是否类型安全？        →  提供 TypeScript 声明
```

**方向 A 可能需要引入的依赖**：

- `ts-morph` (对 TypeScript source file 做类型提取) — 满足上述所有标准
- `typescript` (作为 peer dependency，项目已使用)
- `json-diff` 或自建 — 轻量 JSON diff 库

**方向 D 可能需要引入的依赖**：

- `semver` (项目已使用，用于 changesets)
- 自建影响分析矩阵生成器（不引入框架，纯 TypeScript + JSON）

### 自建 vs 采用

| 组件                | 决策                                       | 理由                                                   |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| TypeScript 类型提取 | **采用** `ts-morph`                        | 此领域成熟，自建不划算                                 |
| Prop diff 引擎      | **自建**                                   | 纯逻辑（约 200-300 行），对 iris-ui 的契约结构高度定制 |
| 影响矩阵分析器      | **自建**                                   | 需深度理解 iris-ui 的组件间依赖关系                    |
| 报告输出格式化      | **采用**已有工具 (`chalk`/`terminal-link`) | 项目已使用，统一输出风格                               |
| 可视化 Dashboard    | **延后决策**                               | MVP 阶段 CLI 输出足够；达到 100+ 组件覆盖后再评估      |

---

## 5. 实施路线图

### 优先级评定标准

- **P0**：必须做（当前架构存在可量化的债务，不做会影响系统的可持续性）
- **P1**：应该做（显著提升工程效率或质量保证）
- **P2**：值得做（前瞻性投资，ROI 在中长期体现）

### 阶段划分

```
Phase 1 (2-3 sprints): 方向 A 快速闭环
  ↓ 证明"prop 漂移"是可检测、可防范的

Phase 2 (3-4 sprints): 方向 B + A 的深化
  ↓ 扩展到插件生态 + CI 门禁化

Phase 3 (4-6 sprints): 方向 C/D 决策点
  ↓ 根据 Phase 1-2 的经验决定是否投资契约层
```

### Phase 1：Prop 漂移检测 MVP（方向 A 最小闭环）

**P0 — 当前 sprint 即可启动**

| 任务                                           | 估计   | 产出                                        |
| ---------------------------------------------- | ------ | ------------------------------------------- |
| 1.1 选择 3 个跨框架组件做手工 prop 比对标杆    | 1-2 天 | 验证 prop 漂移存在的真实证据，建立 baseline |
| 1.2 编写 prop name 提取脚本（基于 `ts-morph`） | 3-5 天 | 从四个适配器的类型定义提取 prop name 集合   |
| 1.3 编写 prop name 交叉比对引擎                | 2-3 天 | 生成 prop name diff 报告（缺失/多余/偏离）  |
| 1.4 在 Manifest 包中集成，输出 JSON report     | 1-2 天 | `pnpm check:props` 命令就绪                 |
| 1.5 在 3 个标杆组件上运行并修复发现的差异      | 2-3 天 | prop parity baseline 达成                   |

**风险**：1.1 可能发现大量差异，导致修复工作量超出预期。

**缓解策略**：

- 设定可接受的偏差阈值（如 <5% prop name 差异）
- 将发现的差异标记为"已确认的框架适配"（不是 bug）vs "意外的漂移"（需要修复）
- 先修复后者，对前者建立 prop mapping

**里程碑 M1**：`pnpm check:props` 可对核心 10 个组件输出 prop diff，且 CI warn 级别通过。

### Phase 2：CI 门禁化 + 插件 Parity 质量门

**P0-P1 — 接续 Phase 1**

| 任务                                                 | 估计   | 产出                       |
| ---------------------------------------------------- | ------ | -------------------------- |
| 2.1 将 prop 检测扩展到 Layer 1-2 全部 50+ 组件       | 3-5 天 | 覆盖范围提升               |
| 2.2 建立 prop name mapping（框架特有 prop 的映射表） | 3-5 天 | 降低误报率                 |
| 2.3 CI 集成：PR comment 自动输出 prop diff           | 2-3 天 | PR review 辅助             |
| 2.4 CI 集成：新组件强制 prop parity (error 级别)     | 1-2 天 | 增量质量门                 |
| 2.5 插件 Parity 检测（`wc -l` + stub 模式检测）      | 3-5 天 | `pnpm check:plugin-parity` |
| 2.6 插件 Parity CI 集成                              | 1-2 天 | 插件质量门                 |

**风险**：2.2 的 prop mapping 维护会成为新债务。

**缓解策略**：

- prop mapping 应是自动生成的（从 diff 结果自动推断映射关系）
- 人工只在"无法自动推断"的 case 中介入（如 Vue `v-model` ↔ React `value+onChange`）
- 新增一个 `pnpm gen:prop-mappings` 命令，自动更新 mapping 表

**里程碑 M2**：所有 PR 自动包含 prop diff 报告 + 插件 parity 报告；新增组件必须通过 prop parity 门禁。

### Phase 3：影响分析系统 + 契约层决策

**P1-P2 — 根据 Phase 1-2 的实际效果决策**

**决策树**：

```
Phase 1-2 中 prop drift 被频繁发现 (> 10% 组件受影响) ?
  ├─ Yes → 说明问题严重，需要更治本的解决方案 → 推进方向 C（契约层）
  └─ No  → 说明被动检测已足够，契约层 ROI 不高 → 停留在方向 A+B

Phase 1-2 中团队认为 prop diff 报告对 review 有帮助 ?
  ├─ Yes → 进行方向 D（影响分析系统）
  └─ No  → 重新评估工具的用户体验，迭代到团队接受
```

如果推进方向 C（契约层）：

| 任务                                                      | 估计   | 产出                    |
| --------------------------------------------------------- | ------ | ----------------------- |
| 3.1 定义契约层数据结构和 JSON Schema                      | 2-3 天 | `contracts/` 目录结构   |
| 3.2 为 3 个核心组件编写 contracts（Table/Dialog/Popover） | 3-5 天 | 验证契约格式可行性      |
| 3.3 编写从契约生成 prop diff 的适配器                     | 2-3 天 | 契约 → 质量报告         |
| 3.4 编写从契约生成 TypeScript 声明原型                    | 5-8 天 | 探索"代码生成"可行性    |
| 3.5 影响分析系统 MVP（API 变更 → 波及组件列表）           | 3-5 天 | `pnpm check:api-impact` |

**里程碑 M3**：核心组件从"各自声明 props"迁移到"从契约生成 props"模式；API 变更影响分析自动输出。

### 阶段风险总览

| 风险                                                    | 概率 | 影响 | 缓解                                           |
| ------------------------------------------------------- | ---- | ---- | ---------------------------------------------- |
| Phase 1 发现大量 prop 漂移，修复工作冲击现有 sprint     | 中   | 高   | 建立"已知漂移"清单，分批修复；先堵新组件的缺口 |
| ts-morph 无法稳定处理某些 TypeScript 模式（泛型、重载） | 低   | 中   | 降级到 prop name 级别的比对；复杂类型靠人工    |
| 团队对 prop mapping 维护产生抵触                        | 中   | 中   | 自动化 mapping 生成，降低人工维护成本          |
| CI 门禁导致 PR 合并延迟                                 | 中   | 中   | Phase 1 只用 warn，Phase 2 只对新组件用 error  |
| 方向 C 投资回报不明确                                   | 中   | 高   | 用决策树，不做强迫推进                         |

---

## 总结

本报告聚焦于交叉去重后的两个独特贡献方向，并基于它们识别出 iris-ui 架构中一个**被系统性忽略的缺口**：跨框架 API Surface 的一致性保障。

| 方向                                      | 评级   | 核心价值                                       | 时机             |
| ----------------------------------------- | ------ | ---------------------------------------------- | ---------------- |
| **A: API Surface 治理** (Prop Drift 检测) | **P0** | 填补架构中最明显的隐性债务                     | 立即启动         |
| **B: 插件 Parity 质量门**                 | **P0** | 以新颖角度（行数对比）强化现有插件质量框架     | Phase 2          |
| **C: 组件契约中间层**                     | **P1** | 从被动检测升级到主动定义，但投资大，需 P1 验证 | 决策点 @ Phase 3 |
| **D: 变更影响分析**                       | **P1** | 辅助 breaking change 管理，提升发布质量        | Phase 2-3        |
| **E: AI Codegen 精确上下文**              | **P2** | 前瞻性投资，乘数效应在 A/C 落地后显现          | Phase 3+         |

核心建议是**两条腿走路**：

1. **立即**启动方向 A 的快速 MVP（`pnpm check:props`），用 1-2 周时间验证"prop 漂移是可检测的"
2. **同时**方向 B 的低成本切入点（`wc -l` 基线对比），与方向 A 共用 CI 基础设施

在 Phase 1 数据积累后，关于方向 C（契约层）的决策将基于真实数据而非猜测——这是最工程化的推进方式。
