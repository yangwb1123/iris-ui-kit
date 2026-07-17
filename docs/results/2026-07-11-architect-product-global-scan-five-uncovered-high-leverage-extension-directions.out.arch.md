# Iris UI — 架构分析与扩展方向评估

> **本文档基于** `docs/requirements/2026-07-12-5-uncovered-high-leverage-extensions.md`  
> **角色**: 资深架构师  
> **日期**: 2026-07-12  
> **方法论**: 读取全部 5 个方向的分析 + 交叉验证源码（tokens/types、theme/applyTheme、contracts/runner/types、scripts/check-size、core/src 结构）+ 评估跨方向依赖与权衡

---

## 1. 架构评估

### 1.1 当前架构的优势

项目文档（AGENTS.md）和实践之间的一致性很高，这是成熟的架构标志。

| 优势维度           | 证据                                                                      | 评价                                         |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
| **分层清晰**       | Layer 0–4 + Behaviors + Plugins，core 零框架依赖                          | 可持续的分层，每次验证 149 组件四框架对齐    |
| **契约测试体系**   | `ContractScenario` + `ContractDriver` + `runContract` 跨框架共享 42+ 场景 | 核心创新之一——框架差异被完全抽象到 driver 层 |
| **Size 预算体系**  | `check-size.mjs` 全量包 + 单导出探针双维度                                | 虽不够细，但已有正确的监控方向               |
| **插件契约**       | `createPlugin` + `registerTokens/Messages/Store` 清晰分离                 | 插件是加法不是 monkey-patch，这是正确的设计  |
| **Token 单一来源** | `light.ts` + `dark.ts` → `applyTheme` → CSS 变量，单流                    | 可审计、可继承、可 patch                     |

### 1.2 架构局限性（文档揭示 + 我的补充）

**A. 组件依赖图不可见（方向 5 的深层问题）**

当前 size 基线测量的是入口 barrel gzip → 这是一个**聚合指标**，丢失了组件间依赖关系的信息。深层问题不是"工具缺失"，而是**core 内部的模块边界没有形式化**。打开 `core/src/` 可以看到：`data-source.ts`、`data-view/`、`auto-dismiss.ts`、`cell-edit.ts` 等文件都在同一级——消费者 `import { createDataSource } from '@iris-ui/core'` 时，tree-shaker 能不能消除未使用的 `createAutoDismiss` 取决于这些模块的 `sideEffects` 标记和内部引用图。当前没有显式模块图。

**B. 无版本化 token = 无 API 契约（方向 4）**

Token 系统的 `IrisTheme` 是接口——但无 `version`、无 `$deprecated`、无迁移路径。这在发布前是低成本的编码规范问题；发布后是破坏性变更的源头。更关键的是：**Token 没有消费者签入机制**——一个皮肤或一个自定义组件依赖了 `--iris-primary`，系统不记录这个依赖关系。因此未来无法知道"删除这个 token 会破坏谁"。

**C. 组合交互的架构真空（方向 2）**

单组件契约测试全面，但**组合场景没有对应的架构模式**。这是因为：

- `ContractDriver` 设计为挂载"一个组件"——接口中没有 `mountMultipleComponents` 或 `setupParentChild` 方法。
- 组合场景的失败模式往往是竞态/时序敏感的（Dialog focus-trap 在 Table 分页 click 之前还是之后触发？），这超出了当前 runner 的单步 action→assert 模型。
- 没有"组件交互契约"的类型定义——当前的 `ContractScenario` 只描述"在一个组件内做一系列操作"，不描述"两个组件之间的操作如何协调"。

**D. 跨框架互操作的深层困境（方向 3）**

当前四框架战略的代价是**Context 隔离**。核心问题是：`@iris-ui/core` 的 store 是框架无关的，但每个适配器通过自己框架的反应式系统桥接到渲染。两个框架版本的 store 实例不同、订阅机制不同、销毁生命周期不同。这不是一个"包装一层"能解决的问题——它需要在核心层建立一个**跨框架状态同步协议**。

具体困境量化：

```
React:   useSyncExternalStore(store.subscribe) → 快照读取
Vue:     ref(store.getState()) → 自动追踪 + watch
Solid:   createSignal(store.getState()) → 细粒度订阅
Svelte:  $state(store.getState()) → proxy 代理

问题：当 store 更新时，四者看到的"更新后的值"是同一时刻吗？
- React: 批量 commit 后才看到
- Vue:   同步触发
- Solid: 同步触发但仅通知订阅者
- Svelte: 同步触发
→ 跨框架组件边界存在至少一个 macrotask 的时序窗口
```

### 1.3 关键设计决策评估

| 决策                         | 合理度              | 备注                                                   |
| ---------------------------- | ------------------- | ------------------------------------------------------ |
| core 零框架依赖              | ✅ 正确             | 这是四框架可行的基础                                   |
| 适配器只做渲染+桥接          | ✅ 正确             | 验证：core 没有 `from 'react/vue/solid/svelte'`        |
| Token 全量注入（不 purge）   | ⚠️ 可接受           | 发布前是合理简化；发布后需要 purge 机制                |
| 单组件契约测试优先于组合测试 | ⚠️ 可接受           | 80/20 法则：单组件覆盖面更大；但发布前应补少量组合场景 |
| 插件不做 `registerComponent` | ✅ 正确             | 类型安全 + tree-shaking + manifest 三方受益            |
| 不跨框架互操作               | ⚠️ 正确（当前阶段） | 四框架对齐后才值考虑互操作；v2 合适                    |

### 1.4 技术债务识别

| 债务类型                             | 位置                                     | 严重度 | 修复时机                                      |
| ------------------------------------ | ---------------------------------------- | ------ | --------------------------------------------- |
| `applyTheme` 全量遍历所有 token      | `packages/theme/src/applyTheme.ts`       | 🟡 中  | 方向 1（token tree-shaking）时自然修复        |
| `IrisTheme` 无 version 字段          | `packages/tokens/src/types.ts`           | 🟢 低  | 方向 4（版本化），30 行改动                   |
| `check-size.mjs` 只有 4 个单导出探针 | `scripts/check-size.mjs`                 | 🟡 中  | 方向 5（包组成分析器）                        |
| 42 个场景全是单组件                  | `packages/core/src/contracts/scenarios/` | 🟢 低  | 方向 2（组合不变量）                          |
| 容器 `applyCssVars` 无选择性注入     | `packages/theme/src/applyCssVars.ts`     | 🟡 中  | 方向 1 自然修复                               |
| Core 模块边界未形式化                | `packages/core/src/*.ts`                 | 🔴 高  | 方向 5 的前置依赖——无模块图就无法分析组件成本 |

> **最关键的债务**：core 的模块边界未形式化。这不是一个"以后再做"的事情——它影响 tree-shaking 效果、影响 size 分析准确性、影响消费者对"按需导入"的信任。每新增一个 controller/engine 到 core，都应该明确记录其外部依赖。

---

## 2. 扩展方向（含文档补充分析）

文档的 5 个方向都很扎实。以下是我作为架构师对每个方向的补充分析和跨方向关系的识别。

### 2.1 🔧 构建时 Token Tree-Shaking（方向 1）

**文档正确识别了问题**：~25% 死 token，~60 个全注入。但有两个被低估的复杂性：

**复杂性 1：动态 token 引用不是少量边界情况**

```tsx
// 这不是单个组件的问题——这是 Iris UI 的样式范式
const IrisPopoverContent = ({ zIndex }) => (
  <div style={{ zIndex: `var(--iris-${zIndex})` }}>
    {/* zIndex prop 可以是 'z.tooltip' | 'z.modal' | 'z.dropdown' */}
  </div>
)
```

如果全库扫描 `var(--iris-` 静态调用，模式如 `var(--iris-z-${...})` 会导致**所有 z-index token 成为无法静态消除的"活着"引用**。类似模式也可能出现在颜色别名系统中。保守策略（保留所有可能匹配）将使 tree-shaking 对 z-index/transition 类 token 完全无效。

**复杂性 2：皮肤继承链的动态性**

```
Theme dark (60 tokens)
  → Skin A extends dark (覆盖 3 tokens) → 全部 60 tokens 继承
    → Skin B extends Skin A (再覆盖 2 tokens) → 全部 60 tokens 继承
```

构建时无法知道"用户最终会加载哪个 skin"。即使应用只用 45 个 token，但消费者可能通过 `SkinProvider` 动态切换到一个覆盖了不同 token 集的皮肤。**Token purge 必须是"消费者选择式"的（opt-in），不能是默认行为**——否则动态皮肤切换可能触发 token 缺失导致视觉崩溃。

**架构建议：**

```
不是"purge"，而是"subset + fallback"两层策略：

1. 构建时：生成 token-usage.json（从源码扫描的引用集）
   - 保留动态引用的所有可能值（保守白名单）
   - 不自动 purge，只提供"建议子集"

2. 消费模式（两个选项由消费者选择）：
   Option A: applyTheme(fullTheme) ← 当前行为，永远可用
   Option B: applyTheme(optimizeTheme(theme, myComponentSet)) ← 选择式优化
     - optimizeTheme 在构建时或 SSR 时调用一次
     - 运行时切换皮肤时，patch 机制补偿缺失 token

3. SSR 优化（更高 ROI）：内联仅含使用到的 token 的 <style>
   // 这比浏览器端 purge 更有价值——CSS 变量减少 = HTML 体积减少
```

**与方向 4 的关系**：Token 版本化是 token tree-shaking 的前置依赖——如果不知道哪些 token 已弃用，扫描器无法区分"未使用的合法 token"和"已废弃的 token"。建议：**先版本化，再 tree-shaking**。

---

### 2.2 📐 组件组合不变量测试（方向 2）

**文档低估了组合测试的架构挑战**。不是"30 行场景，复用 runner"这么简单。

**挑战 1：ContractDriver 接口需要扩展**

当前 driver 挂载一个组件，驱动它的交互。组合测试需要：

```
// 当前
mount(driver, scenario.component)  // 挂载单组件

// 组合需要
mountParent(driver, ParentComponent, parentProps)
mountChild(driver, ChildComponent, childProps, parentSelector) // 挂载到父组件内
```

这意味着 `ContractDriver` 接口需要新增方法，或者引入一个新的 `CompositionDriver` 接口。这是**向后兼容的扩展**，但四端（React/Vue/Solid/Svelte）的 driver 实现都需要更新。

**挑战 2：Portal 逃逸的语义不明确**

组合场景中（如 Dialog+Table），Table 的分页按钮在 Dialog 内部。当用户点击时：

```tsx
// Table 的分页按钮在 Dialog 的 portal (document.body) 中
// driver.queryAll 是 container-scoped 的（默认）
// 需要使用 global: true 来 escape container
```

当前的 `ContractAssertion` 已支持 `global: true` flag，但 `ContractStep.action.target` 没有 `global` 选项——action 的目标选择器不 escape container。这意味着组合测试中，如果 action 目标在 portal 内，action 无法定位到它。**需要为 action target 添加 global 选项**。

**挑战 3：状态隔离 vs 状态共享**

组合测试需要回答：Dialog 关闭后，Table 的分页状态是否保留？这是 React `useState` vs Vue `ref` 在 unmount/remount 时的行为差异：

```
React: Dialog 关闭 → unmount 内部 Table → 状态丢失（除非 lifted）
Vue:   Dialog 关闭 → v-if 移除 → 状态丢失（除非 keep-alive）
```

组合测试框架需要让测试编写者显式声明"挂载状态"和"移除状态"。这不是当前 `ContractScenario` 能表达的。

**架构建议：**

1. **扩展 `ContractDriver`**，新增 `mount(componentName, props, parentSelector?)` 方法，支持多组件挂载
2. **新增 `CompositionScenario` 类型**，在 `ContractScenario` 基础上增加 `setup` 阶段（声明多个组件和它们的关系树）
3. **优先 3 个高价值场景**（不要 5 个的"建议"——更务实）：
   - `dialog-with-table`：Dialog 打开 → Table 分页 → 排序 → 关闭 → aria-hidden 清除
   - `form-with-select`：FormField + Select → 校验 → Select 弹出层 aria-describedby 链
   - `resize-with-virtual`：Resizable 面板缩小 → VirtualScroll 重测量 → 无空白

---

### 2.3 🧩 跨框架互操作桥（方向 3）

这是文档提出的**最高难度、最高潜在差异化价值**的方向。我完全同意定位为 v2。但需要更诚实地评估技术风险。

**核心难题：反应式系统同步协议**

这不是一个"包装"问题，而是一个**分布式状态同步**问题：

```
框架 A (React)             框架 B (Vue)
  |                           |
  v                           v
storeA ← → Sync Protocol ← → storeB
              |
              v
         IrisBridgeStore
         (核心层，框架无关)
```

每个框架保持自己的 store 实例，通过桥接协议同步。同步的触发时机、批量粒度、冲突解决策略都需要明确定义。

**三种同步策略权衡：**

| 策略                           | 一致性模型 | 延迟  | 实现复杂度 | 推荐场景                         |
| ------------------------------ | ---------- | ----- | ---------- | -------------------------------- |
| **主从同步**（React 主导）     | 最终一致   | ~1 帧 | 🟢 低      | Provider 状态桥（Theme/I18n）    |
| **事件驱动同步**（自定义事件） | 最终一致   | ~1ms  | 🟡 中      | `<IrisIsland>` 组件孤岛          |
| **CRDT 状态树**（全序广播）    | 强最终一致 | ~5ms  | 🔴 高      | 多框架共享复杂状态（Table 数据） |

**最小可行架构**（文档中提到的 3 个场景）：

```
@iris-ui/bridge/
├── core/
│   ├── BridgeRegistry       // 跨框架组件注册表
│   ├── SyncChannel          // 消息通道抽象
│   └── Serializer           // 状态序列化（支持 react-__SECRET_INTERNALS 等）
├── provider-bridge/         // 场景 1：Provider 状态桥
│   ├── BridgeThemeProvider  // 接收 React ThemeProvider → 广播给子框架
│   └── BridgeI18nProvider
├── island/                  // 场景 2：<IrisIsland> 自定义元素
│   ├── defineIrisIsland()   // 注册 custom element
│   ├── react-host.ts        // React 侧：渲染 Vue/Solid/Svelte 孤岛
│   └── vue-host.ts
└── schema/                  // 场景 3：Schema 驱动渲染
    ├── SchemaRenderer       // 遍历 schema → bridge.getComponent → 框架无感知渲染
    └── resolver.ts          // "IrisTable" → @iris-ui/react/table 或 @iris-ui/vue/table
```

**对竞品定位的价值**：当前 UI 库市场分为三类——

1. **单框架**（Radix/Naive/AntD/Shadcn）→ 锁定
2. **跨框架但独立**（Ark UI：React/Vue/Solid 各一套 → 不同代码库，但共享 Zag machine）
3. **Web Components 包装**（Ionic/Microsoft FAST）→ 框架味淡

Iris UI 如果实现互操作桥，将成为第一个**四框架共享同一逻辑层 + 互相嵌入**的库。这是一个明显的差异化定位。

---

### 2.4 ⏳ Token 版本化与弃用协议（方向 4）

**这是 5 个方向中 ROI 最高、技术债务最低的**。文档说 30 行代码，我赞同。但有三个设计选择需要权衡：

**选项 A：`version: number`（文档建议）**

```typescript
export interface IrisTheme {
  version: number // 简单，但版本号含义不明
  $deprecated?: Record<string, string>
}
```

**问题**：`version: 2` 意味着什么？是 token 集版本？`IrisTheme` 接口版本？消费者怎么知道"我需要 v2 还是 v3"？

**选项 B：`$schema` + `$version`（JSON Schema 风格）**

```typescript
export interface IrisTheme {
  /** 语义版本，如 "1.0.0" */
  $version: string
  /** 引用定义 meta 文档（可选） */
  $schema?: string
  $deprecated?: Record<string, string>
  /** 迁移映射：old → new，用于自动 codemod */
  $migrations?: Record<string, { to: string; since: string }>
}
```

**优势**：`$version` 可比较（semver）、`$schema` 可验证、`$migrations` 可自动执行迁移。  
**代价**：略多约 10 行类型。

**选项 C：DTCG 标准对齐**

项目已有 `toDtcg`/`dtcgToCss`，DTCD 标准（Design Token Community Group）定义了 `$description`、`$deprecated`、`$extensions` 等字段。如果对齐 DTCG，版本化 = 标准步骤。

**我的建议**：**选项 B，但仅在 token 级别标注 `$deprecated`（不要在 theme 级别加版本号）**——版本号暗示了整体兼容性，但 token 系统是增量演化的。每个 token 可以有独立的生命周期。theme 级版本通过 package.json 的 `version` 字段管理即可。

```typescript
// 不在 IrisTheme 加 version
// 在 IrisTheme 加 $deprecated？（可选）
// 在单个 token 的元数据中标注弃用（dtcg 风格）
```

**与方向 1 的关系**：Token 版本化是方向 1 的前提。tree-shaking scanner 需要知道"未使用的 token"是**可安全删除的**还是**已弃用但仍在被引用**。

**与方向 5 的关系**：Token 使用分析器可以同时输出"token 使用活跃度报告"——哪些 token 使用频率高、哪些从未被引用、哪些仅被已弃用组件引用。

---

### 2.5 📦 组件级包组成分析器（方向 5）

**文档正确识别了 gap 但低估了前置依赖**。当前无法回答"import IrisTable 要花多少钱"的根本原因不是工具缺失，而是**模块边界未形式化**——core 没有声明"createDataSource 依赖哪些其他模块"。

**前置依赖：Core 模块依赖图**

需要先做这一步才能做组件级分析：

```json
// 当前的 core barrel 导出 ~50+ 个名字
// 但组件分析需要知道：
// IrisTable → createDataSource → createStore + createSelectionModel + ...
//            → paginate + filterSort
//            → getPageRange
// 如果这些函数分布在不同的文件中，tree-shaker 能消除 createVirtualizer 吗？
// 如果它们在同一个文件中（co-located），tree-shaker 不能。
```

**当前 core 的模块结构存在风险**：许多 controller/engine 在同一个文件中导出（如 `data-view/` 目录可能包含 filter/sort/paginate 在一个 barrel 中）。这意味着 `import { paginate }` 可能拖入 `filter` 和 `sort` 的实现。

**架构建议的优先级**：

1. **第 1 步**：创建 `packages/core/module-graph.json`——手动维护的依赖关系清单（类似 manifest），声明每个导出名称的依赖文件列表
2. **第 2 步**：用 esbuild 的 `metafile` 自动验证 module-graph 的准确性
3. **第 3 步**：基于 module-graph 实现 `analyzeComponentGraph(componentName, framework)`——聚合所有间接依赖的 gzip 大小
4. **第 4 步**：生成 `size-card.json`

**size 报告的结构不应只是"单组件大小"**，应该包含：

```
IrisTable (React) — total: ~18KB gzip
├── @iris-ui/core
│   ├── createStore (core)          ~2.1 KB
│   ├── createSelectionModel (core) ~3.4 KB
│   ├── paginate (core)             ~1.2 KB
│   ├── filterSort (core)           ~2.8 KB
│   ├── getPageRange (core)         ~0.3 KB
│   ├── createExpansion (core)      ~1.8 KB
│   └── flattenLeafColumns (core)   ~0.5 KB
├── @iris-ui/theme
│   └── useTheme (theme)            ~0.8 KB
├── react runtime (shared)          ~1.5 KB
└── IrisTable (react adapter)       ~3.6 KB (JSX template + bridge)
══════════════════════════════════════════
Total                               ~18.0 KB
Shared with other imports           ~12.0 KB (core + react runtime)
IrisTable-unique                     ~6.0 KB
```

这回答了消费者的真实问题：**"加一张表的边际成本是 6KB"**——而不是"18KB"。

---

## 3. 接口设计建议

### 3.1 Token 版本化接口

```typescript
// packages/tokens/src/types.ts — 增量改动

/** 单个 token 的弃用声明（与 dtcg 兼容） */
export interface DeprecatedToken {
  /** 推荐替换的 token 名（如 'iris.accent'） */
  recommended: string
  /** 弃用引入的版本（如 '2.0.0'），便于消费者判断是否必须迁移 */
  since: string
  /** 可选的迁移说明 */
  message?: string
}

/** 弃用映射表 */
export type DeprecatedTokens = Record<string, DeprecatedToken>

export interface IrisTheme {
  name: string
  type: IrisThemeType
  // ... 现有字段不变 ...

  /** @optional 弃用 token 映射 —— 新增 */
  $deprecated?: DeprecatedTokens

  /** @optional 扩展元数据（dtcg 兼容）—— 新增 */
  $extensions?: Record<string, unknown>
}
```

**设计原则**：

- `$deprecated` 是可选的（`?`），向后兼容
- key = 弃用的 JS token 名（如 `'iris.primary'`），不是 CSS 变量名
- `recommended` 指向替换的 token 名——可被 `codemod:rename-token` 工具消费
- DTCG 兼容的 `$description`/`$extensions` 留出扩展空间

### 3.2 组合测试接口

```typescript
// 新增：packages/core/src/contracts/composition-types.ts

/** 组合场景中一个组件的声明 */
export interface ComponentMount {
  /** 适配器的组件名（如 'IrisDialog', 'IrisTable'） */
  component: string
  /** 传递给组件的 props */
  props?: Record<string, unknown>
  /**
   * 可选：挂载到指定选择器下（父组件内部）。
   * 未指定时挂载到容器根节点。
   */
  mountTarget?: string
  /**
   * 该组件的 JSX 子节点模板（框架无关标记语言？还是直接传 children string？）。
   * 简化 MVP：用 children 字符串（如 "Table content"）或 null。
   */
  children?: string
}

export interface CompositionScenario {
  name: string
  description: string
  /** 要挂载的组件列表（按顺序挂载） */
  mount: ComponentMount[]
  /** 交互步骤（与 ContractScenario 重用） */
  steps: ContractStep[]
}
```

### 3.3 跨框架桥核心接口

```typescript
// packages/bridge/core/types.ts

/**
 * 跨框架组件注册表中的一个条目。
 * 不保留框架运行时引用——用工厂函数延迟加载。
 */
export interface BridgeComponentEntry {
  name: string
  framework: 'react' | 'vue' | 'solid' | 'svelte'
  /** 返回一个渲染函数，接收宿主框架提供的容器 DOM 节点 */
  mount: (container: HTMLElement, props: Record<string, unknown>) => () => void
  /** 可选：预加载器（返回 Promise，framework chunk 的懒加载信号） */
  load?: () => Promise<void>
}

/** 桥接注册表 */
export interface BridgeRegistry {
  register(entry: BridgeComponentEntry): void
  get(name: string, framework?: string): BridgeComponentEntry | undefined
  /** 列出某框架可用的所有桥接组件 */
  list(framework?: string): BridgeComponentEntry[]
}
```

### 3.4 是否引入新的抽象层？

| 抽象层              | 方向     | 建议                                |
| ------------------- | -------- | ----------------------------------- |
| `ModuleGraph`       | 方向 5   | ✅ 需要——core 模块边界的显式声明    |
| `CompositionDriver` | 方向 2   | ✅ 需要——在 `ContractDriver` 上扩展 |
| `SyncChannel`       | 方向 3   | ✅ 需要——跨框架同步的核心抽象       |
| `TokenManifest`     | 方向 1+4 | ⚠️ 可选——可并入现有 manifest        |

---

## 4. 技术选型

### 4.1 是否需要新的技术栈？

| 方向               | 技术需求                 | 选型建议                                                                             | 理由                                                                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Token tree-shaking | 静态源码扫描             | **自建**（`@parcel/watcher` or 纯 `fs` + regex）                                     | 不需要完整 AST，`var(--iris-` 模式匹配即可 + 动态引用的保守分析。避免引入 PostCSS/ purgeCSS 等重型工具 |
| 组合测试           | 多组件挂载 + Portal 感知 | **扩展现有**（修改 `ContractDriver` + `runner.ts`）                                  | 不应引入新测试框架；与 vitest 保持绑定                                                                 |
| 跨框架桥           | Custom Elements + Proxy  | **自建** + **`@webcomponents/custom-elements` polyfill**（只在不支持 CE 的浏览器）   | 没有成熟的跨框架桥库。Lit？太重且引入自己的反应式模型。自建更可控                                      |
| Token 版本化       | 类型变更                 | **纯类型**—零运行时依赖                                                              | 不需要新 deps                                                                                          |
| 包组成分析         | Bundle 测量              | **esbuild API**（已存在 `check-size.mjs`）+ **`rollup-plugin-visualizer`**（可视化） | esbuild 已有 `metafile`，可作为分析源                                                                  |

**关键决策**：Token tree-shaking 是否使用 AST 级别的分析？我的建议是 **不用完整 AST，用 `@typescript-eslint/parser` 的 tokenizer 级别分析**（即仅词法分析，不构建语法树）。原因是：

- `var(--iris-` 是 CSS 函数调用，语法简单，模式匹配足够
- AST 级别的分析成本高 10 倍且对精度提升有限（动态引用仍是模式匹配）
- 但如果要扫描动态引用（`var(--iris-${v})`），需要 AST 的模板字符串分析——**只在这些边界情况回退到 AST**，用 `@typescript-eslint/parser` + 访问者模式

### 4.2 第三方依赖评估

```
⭐ = 建议引入     ⚠️ = 可选     ❌ = 不引入
```

| 依赖                             | 方向   | 评估                                                                           | 决策                                     |
| -------------------------------- | ------ | ------------------------------------------------------------------------------ | ---------------------------------------- |
| `esbuild`（已有）                | 方向 5 | 已有且成熟，`metafile` 是组件图分析的关键                                      | ✅ 继续用                                |
| `@typescript-eslint/parser`      | 方向 1 | ~2MB，但有精确的 AST 信息。token 扫描只需 `var(--iris-` 模式匹配，AST 过于重型 | ⚠️ 仅在动态引用分析时引入，且应为 devDep |
| `rollup-plugin-visualizer`       | 方向 5 | 生成火焰图/treemap，互补 esbuild 的 CLI 输出                                   | ✅ 建议（devDep 场景）                   |
| `@webcomponents/custom-elements` | 方向 3 | ~3KB gzip，用于不支持 Custom Elements v1 的旧浏览器（IE11/旧 Edge）            | ✅ 建议，但只作为 polyfill               |
| `postcss` / `purgecss`           | 方向 1 | 重型管道（~5MB），Iris 不需要完整的 PostCSS 生态                               | ❌ 自建轻量扫描器                        |
| `svelte-package`（已有）         | —      | 已用于 Svelte 包的构建                                                         | ✅ 维持现有                              |
| `tsup`（已有）                   | —      | 已用于 React/Vue/Solid 包的构建                                                | ✅ 维持现有                              |

### 4.3 自建 vs 采购的决策

| 方向            | 决策                    | 理由                                                          |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| Token 扫描      | **自建**                | 需求极其特化（`var(--iris-` 模式），没有现成 library 做这件事 |
| 跨框架桥        | **自建**                | 这是差异化能力——不应外包给第三方。竞品也没有现成解决方案      |
| 包组成分析      | **自建 + 复用 esbuild** | `esbuild` 提供 metafile，我们在上层封装"组件级"语义           |
| 组合测试 runner | **扩展现有**            | 已有一个好 runner，不要重写                                   |

---

## 5. 实施路线图

### 5.1 跨方向依赖图

```
方向 4（Token 版本化）
  ├→ 方向 1（Token tree-shaking 需要知道哪个 token 已弃用）
  └→ 方向 5（Token 使用分析需要版本化的 token 集合）

方向 2（组合不变量）—— 独立，不依赖其他方向

方向 5（包组成分析）
  ├→ 依赖 Core 模块图（手动创建）
  └→ 可复用方向 1 的扫描结果（token 使用 = component 使用）

方向 3（跨框架桥）—— 独立，但建议在所有方向之后
```

**关键路径**：方向 4 → 方向 1 → （方向 2 可并行进行）→ 方向 5 → 方向 3

### 5.2 优先级排序

```
P0（发布前必做）：
  方向 4 — Token 版本化（0.5 天）
  方向 2 — 3 个组合场景（1-2 天）

P1（发布时做）：
  方向 1 — Token tree-shaking 基础设施（3-5 天）
  方向 5 — 包组成分析器 v1（3-4 天）

P2（发布后 v2）：
  方向 3 — 跨框架桥 MVP（2-3 周）
```

### 5.3 阶段划分

**阶段 0（发布前，2-3 天）—— 最小风险覆盖**

```
Day 1: Token 版本化
  - IrisTheme 增加 $deprecated 字段
  - applyTheme dev 模式下检查弃用并 console.warn
  - audit-tokens.mjs 扩展：输出 token 使用统计
  - 验证：pnpm lint typecheck test 全绿

Day 2-3: 组合不变量测试（3 个场景）
  - 扩展 ContractDriver：mount(name, props, parentSelector?)（4 框架）
  - 新增 ContractStep.action.target 的 global 选项（portal 支持）
  - 编写 dialog-with-table、form-with-select、resize-with-virtual 场景
  - 验证：pnpm test 包含新场景
```

**阶段 1（发布同时，1 周）—— 消费者可见基础设施**

```
Week 1: Token tree-shaking 工具链
  - 实现 scan-var-usage.ts（静态扫描）
  - 实现 build-whitelist.ts（合并 manifest + plugin 声明）
  - 实现 generate-subset.ts（生成 token 子集）
  - 集成到 pnpm gen:manifest（可选输出 token-usage.json）
  - 更新文档：消费者使用 optimizeTheme() 的指南

Week 1 (并行): 包组成分析器 v1
  - 创建 packages/core/module-graph.json（维护）
  - 实现 component-graph.ts（从 manifest 构建 DAG）
  - 实现 measure-subpath.ts（esbuild metafile 分析）
  - 实现 report-card.md 生成器
  - 集成 pnpm size:component-card
```

**阶段 2（发布后 v2，2-3 周）—— 战略差异化**

```
Week 1-2: 跨框架桥 MVP
  - core/BridgeRegistry + core/SyncChannel
  - provider-bridge: Theme + I18n 状态桥
  - <IrisIsland> custom element（React 宿主 → Vue/Solid？）
  - 测试：用 React shell + Vue 子应用演示

Week 2-3: 桥接 Schema 渲染
  - SchemaRenderer（遍历 → resolver → bridge）
  - 集成到 CMS 演示（cms-react 允许嵌入 Vue 的组件）
  - 端到端测试（跨框架属性传递 + 事件冒泡）
```

### 5.4 风险点和缓解策略

| 风险                                               | 方向 | 概率  | 影响  | 缓解策略                                                                                                                                  |
| -------------------------------------------------- | ---- | ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Token tree-shaking 导致动态皮肤切换视觉崩溃        | 1    | 🟡 中 | 🔴 高 | 默认不启用 purge；消费者显式 opt-in；`optimizeTheme` 要求传入"可能使用的皮肤列表"                                                         |
| 组合测试调式困难（失败时不知道是 A 还是 B 的 bug） | 2    | 🔴 高 | 🟡 中 | 每个组合场景的步骤必须有**清晰的上下文标签**；断言消息包含组件名+步骤名                                                                   |
| 跨框架桥性能问题（bridge 成为瓶颈）                | 3    | 🟡 中 | 🔴 高 | provider-bridge 只桥接低频变化状态（Theme/I18n——变化一次）；`<IrisIsland>` 组件间通信限制为 props + custom events；不做自动状态图双向同步 |
| Core 模块图不完整（分析的组件成本不准）            | 5    | 🟡 中 | 🟡 中 | module-graph 标记为"最佳努力"而非精确；esbuild metafile 自动验证 + 列出未覆盖的模块                                                       |
| 版本化 token 后，老版本皮肤在新系统不兼容          | 4    | 🟢 低 | 🟡 中 | `applyTheme` 运行时：如果检测到 `$deprecated` 中的 token 被使用，自动映射到最新名 + warn（模仿 React 的 `UNSAFE_` 策略）                  |

**一个关键的未量化风险**：**方向 3 和方向 1 之间的张力**。跨框架桥需要在运行时加载"框架 B 的组件的完整 token 集"——但 token tree-shaking 尝试在构建时消除未使用的 token。如果 Bridge 动态加载一个远程组件（如 Vue 框架的 IrisDataGrid 使用 Solid 壳中），它的 token 需求是构建时未知的。

缓解：Bridge 组件在注册时同时声明其 token 依赖（`registerComponent({ name: 'IrisDataGrid', tokens: ['iris.primary', 'iris.surface', ...], ... })`），使 token optimizer 可以保守地保留这些 token。

---

## 总结

五个方向的根本性质不同，不能简单用同一优先级处理：

| 方向               | 性质           | 技术债务 vs 新能力      | 建议优先级   |
| ------------------ | -------------- | ----------------------- | ------------ |
| Token 版本化       | **架构补全**   | 偿还债务 + 建立未来契约 | P0（发布前） |
| 组合不变量         | **质量护栏**   | 补全测试覆盖的架构空白  | P0（发布前） |
| Token tree-shaking | **性能优化**   | 新能力，但有债务含义    | P1（发布时） |
| 包组成分析         | **开发者体验** | 新工具链                | P1（发布时） |
| 跨框架互操作       | **战略差异化** | 全新架构层              | P2（v2）     |

**对团队的建议**：不要试图在首次发布前同时推进 5 个方向。集中火力在 P0（2-3 天），确保发布时光洁无重大架构缺口。P1 是"发布后第一周"的热门话题。P2 则按独立节奏——它对核心质量无害，但对市场定位有战略价值。
