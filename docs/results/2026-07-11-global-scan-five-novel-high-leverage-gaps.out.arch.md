# 架构分析：基于同行评审的 Iris UI 架构深度审视

## 1. 架构评估

### 1.1 当前架构的核心优势

同行评审揭示了一个关键事实：Iris UI 的架构文档体系**已经高度成熟**。4/5 的"新方向"在已有分析中以不同形式存在，这本身说明了几个积极信号：

| 优势             | 解读                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **元认知成熟**   | 团队已建立系统化的架构审查流程，多个分析文档从不同角度覆盖相同问题——这不是冗余，而是"多视角交叉验证"                                                              |
| **原则一致性**   | 已有分析的"方向一（壳下沉）"和"方向三（插件版本契约）"在评审中被指出重复，恰恰说明团队成员对核心原则（逻辑下沉 core、插件契约化）有共识——否则不会独立得出相同结论 |
| **抽象层级恰当** | `FormValues = Record<string, unknown>` 作为核心痛点被多人独立发现，说明类型系统的抽象泄漏是真实问题，且已有文档体系已触及但不深入                                 |

### 1.2 架构债务与局限性

评审暴露了五个需要严肃对待的架构问题，按严重程度排序：

---

#### **P0 - 文档体系的信息熵未管理**

**症状**：多份分析文档（`2026-07-10-*`、`2026-07-11-*`）覆盖重叠方向，但**既未交叉引用，也未去重**。一人写了"壳下沉"，另一人写了相同的"壳下沉"，第三人在评审时才发现。

**根因**：缺乏"架构决策注册表"（ADR）或"方向追踪看板"。现有 `/docs/requirements/` 是文件堆积，不是知识管理。

**架构影响**：

- 决策质量下降：重复分析消耗带宽，增量分析被淹没
- 维护者认知过载：5 个方向 × 3 份文档 = 15 个建议，实际只有 5-6 个独立方向，噪音信噪比 3:1
- **这是架构治理问题，不是技术问题**——需要流程而非代码

**建议**：

- 引入 `docs/architecture/decisions/` ADR 目录，每个方向一个编号（ADR-001 ~ ADR-020）
- 新分析必须引用已有的 ADR 编号，注明"扩展" / "替代" / "补充"
- 用 `llms.txt` 或 `manifest.json` 追踪 ADR 状态（proposed / accepted / deprecated / implemented）

---

#### **P1 - 核心类型系统的抽象泄漏**

**证据**：`FormValues = Record<string, unknown>` 是方向一的起点。但更深层的问题是——这与 `DataSource<T>` 的泛型约束缺失（方向五）、插件无能力声明（方向四）是**同一个问题的不同表现**：**类型系统中缺少跨模块的"契约层"**。

**Symptom cluster**:

| 表现                | 现象             | 统一根因                       |
| ------------------- | ---------------- | ------------------------------ |
| `FormValues` 弱类型 | 字段间无静态关联 | 缺少 `FormSchema<T>` 泛型契约  |
| `DataSource` 无事件 | 变更不可观测     | 缺少 `DataSourceEvent<T>` 契约 |
| `IrisPlugin` 无版本 | 依赖不可验证     | 缺少 `PluginManifest` 契约     |
| 四框架壳重复        | 逻辑未共享       | 缺少 `ShellLayoutConfig` 契约  |

**架构诊断**：这是一个**"契约缺失"反模式**——模块边界明确（core | adapter | plugin），但**跨边界协议未类型化**。类型系统只保护模块内部，不保护模块间交互。

**修复合算性**：高投入、高回报。因为是类型级变更，零运行时成本，且 TypeScript 编译期检查意味着可以在现有代码基础上渐近式引入。

---

#### **P1 - 适配器层实际承载了不应承载的协调逻辑**

**评审的核心发现**：方向三的"虚拟滚动+键盘导航"断裂是**适配器层逻辑膨胀的直接后果**。

**逻辑**：

- 虚拟滚动（core `virtualizer.ts`）→ 纯计算，返回 `{startIndex, endIndex, totalHeight}`
- 键盘导航（core `keyboard-nav.ts`）→ 纯计算，返回 `nextFocusIndex`
- 焦点管理（框架适配器）→ 需要 `scrollIntoView` + `focus()` + `aria-activedescendant` 三者协调

**问题**：这个协调在适配器层"隐式"存在——每个框架适配器要么自己写这段协调，要么遗漏。评审提到 "IrisList.tsx 被列为适配器协调的典型位置但你没有读它验证"——**这正是适配器逻辑膨胀的盲区**。

**架构影响**：

- 违反了 AGENTS.md 铁律：**"一切「换个框架也一样」的逻辑都属于 core——出现在适配器里即是 bug"**
- 虚拟滚动+焦点+键盘导航的协调是**框架无关的**（只有 `focus()` 调用和 `aria-*` 属性管理是框架相关的），应该下沉为 core 控制器

**建议**：创建一个 `createVirtualKeyboardNav` 控制器（core 层），统一的 `scrollToIndex + focusItem + manageActiveDescendant` 三位一体。适配器只做 `element.focus()` 的薄桥。

---

#### **P2 - 插件契约的版本语义未定义**

**评审指出**：`IrisPlugin` 接口缺少 `version`、`compatibleWith`、`dependsOn`。这是插件系统的**致命疏漏**——任何支持动态插件的系统，如果不定义插件间版本契约，迟早陷入"依赖地狱"。

**严重程度**：当前是 P2（因为生态未成熟），但**在首个 npm 发布前必须升至 P0**。一旦发布，版本契约的变更就是 breaking change。

**具体缺失**：

- 无 `semver` 范围表达式（`"^1.2.0"`）
- 无 `capabilities` 清单（插件"能做什么"的声明）
- 无 `peerDependencies` 检查（`plugin-editor` 要求 `core >= 2.0`？）
- 无循环依赖检测

**建议**：参照 VSCode 的 `contributes` 机制 + Webpack 的 `resolve.fallback`，定义 `PluginManifest` 类型：

```ts
interface PluginManifest {
  version: string // semver
  requires: {
    // 宿主系统要求
    core: string // "^1.0.0"
    react?: string // "^18.0.0"
  }
  capabilities: string[] // ["locale:zh-CN", "editor:sql", "table:crud"]
  optionalDependencies?: Record<string, string>
  conflicts?: string[] // 不能同时安装的插件
}
```

---

#### **P2 - 数据变更的"事件" vs "状态" 未区分**

**方向五的表面积累**：`DataSourceChangeType` 枚举 11 种类型 + `Epoch` 版本 + 乐观更新三阶段 = 厚设计。但评审正确指出：**未区分事件（event）和状态（state）**。

**架构问题**：

- 当前 `DataSource` 是**状态**模型（`subscribe` 返回当前值）
- 方向五的 events store 是**事件**模型（每次变更 push 一条记录）
- 两者有本质差异：状态模型是可组合的（`map`/`filter`/`combine`），事件模型是需要管理的（内存上限、重放、持久化）

**未回答的设计问题**：

1. 事件 store 是 `DataSource` 的内置功能还是外挂插件？
2. 如果内置，`DataSource.mutate` 现在是无副作用的——加事件是 breaking change
3. 如果外挂，`createDataSourceWithEvents` 作为高级 API——但用户需要手动启用
4. 撤销/重做需要事件幂等性——这与 `maxEvents: 100` 冲突

**建议**：先明确事件模型的状态管理策略：

- **Option A**（轻量）：事件作为 `DataSource` 的可选能力，`DataSourceOptions.eventLog?: { maxSize: number; enabled: boolean }`
- **Option B**（厚）：独立 `DataSourceEventLog` 类，组合式 `DataSource.use(logger)`——走插件架构
- **推荐 B**：因为与插件系统一致，且不污染核心 `DataSource`

---

## 2. 扩展方向

基于上述评估，我提出 5 个真正"高杠杆"的架构扩展方向——不与已有分析重叠，且直击架构债务的根因。

### 方向一：模块间契约的类型化（Type-Level Contract Layer） ⭐⭐⭐⭐⭐

| 维度                 | 说明                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | 核心类型系统的抽象泄漏（`FormValues`、插件无版本、DataSource 无事件）是同一问题的三种表现。一次性解决所有 "跨模块边界无类型保护" 的问题                                     |
| **核心挑战**         | 在已有运行时接口（`IrisPlugin`、`DataSource`、`createFormBuilder`）上加类型是"非破坏性的"——但加泛型参数可能需要改消费端类型签名。需要**渐近式**而非大爆炸式                 |
| **预期架构变更**     | 新增 `@iris-ui/contracts` 包（或合并到 core 的 `types/` 目录），定义所有跨模块协议的类型。现有接口加泛型默认值保持向后兼容                                                  |
| **对现有系统的影响** | 纯类型变更，零运行时。但 `IrisPlugin` 需要加 version 字段——这是**运行时变化**（JSON 序列化/存储时包含 version）。与其他方向的关系：方向四（插件版本契约）是该方向的一个子集 |

**实施策略**：

1. `FormSchema<T>` 和 `createFormBuilder<T>(schema: FormSchema<T>): FormBuilder<T>` → `T` 默认 `Record<string, unknown>`
2. `IrisPlugin.version?: string` → 可选字段，默认 `"0.0.0"`
3. `DataSource<T>.events?: Store<DataSourceEvent<T>[]>` → 通过 `DataSourceOptions` 可选启用
4. 每个步骤都加 `@since 1.x` 注释，类型变更作为 minor 版本

---

### 方向二：适配器层的"显式协调"下沉（Adapter Coordination Extraction） ⭐⭐⭐⭐⭐

| 维度                 | 说明                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | 虚拟滚动+键盘导航+焦点+无障碍的协调逻辑是框架无关的，但在每个框架适配器中分别实现（或缺失）。这是重复工作的源头，也是方向三故障的根因                                            |
| **核心挑战**         | 下沉不是简单的"提取函数"——需要重新划分边界：core 控制器完成"逻辑决策"（`shouldScroll`, `whereToFocus`），适配器完成"副作用执行"（`element.scrollIntoView()`, `element.focus()`） |
| **预期架构变更**     | 新增 `packages/core/src/keyboard-virtual-nav.ts`（控制器），提供 `createVirtualKeyboardNav()` 工厂；适配器层删除冗余协调代码                                                     |
| **对现有系统的影响** | 重构适配器层。需要在四个框架的 `IrisList`、`IrisTable`、`IrisTree`、`IrisMenu` 中替换现有协调。**风险点**：如果某个适配器有独特的行为（比如 Solid 的细粒度更新），下沉可能会破坏 |

**技术方案**：

```ts
// core 层（框架无关）
interface VirtualKeyboardNavConfig {
  virtualizer: Virtualizer;
  itemCount: number;
  getItemId: (index: number) => string;
  isDisabled?: (index: number) => boolean;
}

interface VirtualKeyboardNavController {
  onKeyDown(event: KeyboardEvent): void;
  getActiveDescendantId(): string | null;
  scrollToCurrent(): void;  // 确保当前项在视口内
  currentIndex: Store<number>;
}

// 适配器层（React 例）
function useVirtualKeyboardNav(config: VirtualKeyboardNavConfig): VirtualKeyboardNavController {
  const ctrl = useMemo(() => createVirtualKeyboardNav(config), [...]);
  return ctrl;
}
```

---

### 方向三：皮肤系统的"变体解析"形式化（Skin Variant Resolution Formalization） ⭐⭐⭐⭐

这是一个**未被任何现有分析提及**的高杠杆方向。

| 维度                 | 说明                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **为什么需要**       | `AGENTS.md` 的皮肤定义中包含 `variants: { light: 'sunrise', dark: 'ocean' }`——这是一个"皮肤变体继承"机制。但当前解析逻辑是深埋在 `SkinEngine` 中的，没有形式化验证                         |
| **核心挑战**         | 变体解析图可能形成循环（A 的 dark variant = B，B 的 light variant = A），即**循环依赖**。当前无检测。此外，变体继承的解析策略（深度优先？广度优先？遇到同名 token 时覆盖顺序？）没有文档化 |
| **预期架构变更**     | 在 `@iris-ui/skins` 中新增 `SkinVariantGraph` 类型 + `resolveVariantChain()` 纯函数 + 单元测试覆盖循环检测                                                                                 |
| **对现有系统的影响** | 纯新增，零破坏。如果有已发布皮肤配置中存在未发现的循环依赖，会触发验证警告                                                                                                                 |

**技术方案**：

```ts
// 形式化变体解析
interface SkinVariantGraph {
  [skinId: string]: {
    light?: string // 浅色变体→其他皮肤
    dark?: string // 深色变体→其他皮肤
  }
}

function resolveVariantChain(
  graph: SkinVariantGraph,
  skinId: string,
  mode: 'light' | 'dark',
): SkinId[] {
  // BFS/DFS 解析继承链
  // 检测循环：visited set
  // 返回解析后的有序皮肤 ID 数组（优先级从低到高）
}
```

---

### 方向四：Store 订阅的"反应式依赖图"可观测性（Reactive Dependency Graph） ⭐⭐⭐⭐

| 维度                 | 说明                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | `@iris-ui/core` 使用 `createStore` / `Store<T>` 作为反应式状态基础。但在开发模式下，无法回答"这个 store 更新会触发哪些组件的重新渲染？"——这是调试和性能优化的盲区         |
| **核心挑战**         | 需要侵入 `Store.subscribe` 机制来追踪订阅者——但保持生产环境的零性能开销。需要条件编译（`if (__DEV__) { trackDependencyGraph() }`）                                        |
| **预期架构变更**     | 新增 `@iris-ui/core/src/store/devtools.ts`，提供一个 `createStoreGraph()` 工具，可视化 store → 订阅者 → 组件的关系图。仅在 `process.env.NODE_ENV !== 'production'` 时激活 |
| **对现有系统的影响** | 零运行时开销（dev-only）。但需要修改 `createStore` 内部实现（加法，非破坏性），增加 `__DEV__` 条件分支                                                                    |

**设计权衡**：

| 选项                  | 优点           | 缺点                                    |
| --------------------- | -------------- | --------------------------------------- |
| A: 条件编译 `__DEV__` | 零产物体积影响 | 需要构建工具配合（tsup `define`）       |
| B: 开发版独立 entry   | 不需要条件编译 | 用户需要手动 import `@iris-ui/core/dev` |
| C: Proxy 拦截         | 不需要改源码   | Proxy 性能开销，且无法追踪 class 实例   |

**推荐 A**，因为 tsup 已支持 `define`，且与项目现有构建工具链一致。

---

### 方向五：插件加载时序管理（Plugin Lifecycle Orchestration） ⭐⭐⭐

| 维度                 | 说明                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------ |
| **为什么需要**       | 当前 `IrisProvider(plugins=[...])` 是**一次性收集** → `runPlugins()` 同步注册。没有异步加载、延迟初始化、卸载（teardown）、热重载。这是生态系统的致命限制                             |
| **核心挑战**         | 异步插件加载意味着 `IrisProvider` 的 children 可能在插件就绪前渲染——需要 `loading` / `ready` / `error` 状态管理。卸载（例如插件被移除）需要清理注册的 token、messages、stores         |
| **预期架构变更**     | 在 `@iris-ui/core` 中新增 `PluginLifecycle` 类型（`init` / `ready` / `error` / `destroyed`）+ `registerLifecycleHooks` 函数。`IrisProvider` 增加 `pluginState: 'loading'              | 'ready' | 'error'`和`onPluginError` 回调 |
| **对现有系统的影响** | 当前插件系统是"全同步"的。加异步支持不是简单的加法——`runPlugins()` 的返回类型会从 `void` 变为 `Promise<void>`。需要决定：同步插件保持同步（无破坏），异步插件通过 `loading` prop 暴露 |

**渐进路径**：

1. 当前：`plugins: IrisPlugin[]`（同步，✅ 已有）
2. 步骤 1（P2）：加 `asyncPlugins?: () => Promise<IrisPlugin>[]`——延迟求值
3. 步骤 2（P1）：加 `PluginLoaderProps`——`asyncPlugins + loading = IrisProvider` 在异步插件加载期间显示 fallback
4. 步骤 3（P0）：加 `teardown` 钩子——`IrisPlugin.install` 返回 `{ uninstall: () => void }`

---

## 3. 接口设计建议

### 3.1 关键接口设计原则

基于评审发现的根本问题，我建议以**五项原则**作为接口设计的北极星：

| 原则                 | 含义                                 | 审计问题                                         |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| **P1: 契约显式化**   | 每个跨模块边界的协议都必须有类型表示 | 插件无版本 = ❌                                  |
| **P2: 改造无害化**   | 加泛型必须设默认值                   | `FormSchema<T>` 但 `T = Record<string, unknown>` |
| **P3: 日志可观测化** | 所有"中间发生什么"不可见 → 加事件    | DataSource mutate 无事件 = ❌                    |
| **P4: 深度框架无关** | 每个函数问"换个框架是否一样逻辑"     | 虚拟滚动+焦点协调在适配器 = ❌                   |
| **P5: 卸载一等公民** | 注册了必须能注销                     | `usePlugin` 无清理 = ❌（当前仅 store 有清理？） |

### 3.2 是否需要新的抽象层

**结论：不需要新增独立包/层，但需要在 core 内引入一个"跨模块契约"领域**。

| 假想层                              | 理由                 | 否决原因                                   |
| ----------------------------------- | -------------------- | ------------------------------------------ |
| `@iris-ui/contracts`                | 所有接口定义集中管理 | 过于分离——核心类型应该靠近其实现           |
| `@iris-ui/core/types/contracts.ts`  | ✅ 轻量，下沉即可    | 注意不要和已有 `types/` 目录重叠           |
| `@iris-ui/core/src/plugin/types.ts` | ❌ 分散到子模块      | 跨模块契约需要跨包引用，分散后心智模型破碎 |

**最终建议**：在 `@iris-ui/core/src` 下新增 `contracts/` 目录，每个文件提供一个领域的契约定义：

```
packages/core/src/contracts/
├── plugin.ts        # IrisPlugin, PluginManifest, PluginLifecycle
├── data-source.ts   # DataSourceEvent, DataSourceChangeType, Epoch
├── schema.ts        # FormSchema<T>, FieldSpec<T>, createFormBuilder<T>
├── skin.ts          # SkinVariantGraph, SkinResolutionResult
└── index.ts         # 导出所有契约
```

### 3.3 向后兼容策略

核心规则：**类型系统层面的向后兼容 ≠ 运行时向后兼容**。需要区分：

| 变更类型                               | 兼容承诺         | 策略                                                                       |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| 加泛型参数 + 默认值                    | Major 需要 2.x？ | 如果现有代码 `createFormBuilder(schema)` 可编译且运行一致 → Minor（`1.x`） |
| 加可选字段（`version?: string`）       | Minor ✅         | 旧版 plugin 继续工作                                                       |
| 变必须字段                             | **Major ❌**     | 只能在新 major 版本做                                                      |
| 加异步返回（`void` → `Promise<void>`） | **Major ❌**     | 异步需要新函数，不改旧签名                                                 |

**推荐版本策略**：

- 当前状态 → `1.0.0-alpha.x`（预发布）
- 上述兼容变更 → `1.0.0-beta.x`（加 `version`）、`1.1.0`（加 `FormSchema<T>`）
- Breaking changes → `2.0.0`

---

## 4. 技术选型

### 4.1 不需要引入新的技术栈

评审揭示的问题（契约缺失、协调下沉、可观测性）**全部在现有技术栈的可解空间内**：

| 问题         | 解决方案                   | 所需工具（已有）           |
| ------------ | -------------------------- | -------------------------- |
| 类型契约     | TypeScript 泛型 + 条件类型 | ✅ 已有                    |
| 协调下沉     | 纯函数 + Store 组合        | ✅ core 已用               |
| 可观测性     | 条件编译 `__DEV__` + Store | ✅ tsup `define`           |
| 插件生命周期 | Promise + 状态机           | ✅ core 已有 createMachine |
| 版本契约     | semver 比较 + 运行时验证   | ✅ 可纯函数实现，无需依赖  |

**强行引入新框架（如 Zod 做运行时验证、XState 做状态机、MobX 做响应式）会引入额外的技术债**，因为：

- 新依赖需要对齐四框架 + SSR + tree-shaking
- 增加 bundle size（Iris UI 有 size 预算门）
- 降低"框架无关"纯度（Zod 有 Node.js 依赖，XState 是运行时状态机而非 Iris 的声明式 machine）

### 4.2 第三方依赖的评估标准

当前的依赖选择标准隐含在 AGENTS.md 中，但未显式化。基于架构视角，建议明文化为**五星依赖评估框架**：

| 标准                   | 权重 | 解释                                       |
| ---------------------- | ---- | ------------------------------------------ |
| ⭐ 框架无关性          | 必须 | 不能有 React/Vue/Solid/Svelte 依赖         |
| ⭐ SSR 安全            | 必须 | 不能依赖 `window`/`document`（或提供回退） |
| ⭐ tree-shaking 可达   | 必须 | ESM export，CJS fallback                   |
| ⭐ 体积 < 10KB（gzip） | 高   | core 已有 10KB 预算                        |
| ⭐ 无 Node.js API 依赖 | 高   | 浏览器和 SSR 环境均可                      |

**建议新增的依赖（经审计安全）**：

- `semver` 轻量版本比较（插件版本契约需要） → 体积 ~1KB，无 DOM 依赖，SSR 安全
- `fast-deep-equal` → core 已有 `compareValues`，但需要深度比较时（插件配置合并）可能需要

**建议避免的依赖**：

- `zod` / `io-ts`（运行时类型检查——与 Iris 的"类型级优先"哲学冲突，且增加体积）
- `xstate`（已声明式 machine——core 的 `createMachine` 已覆盖）
- `immer`（`DataSource.mutate` 已提供不可变更新模式）
- `rxjs`（事件流太重——Iris 的 `Store` + `subscribe` 已覆盖）

### 4.3 自建 vs 采购的决策依据

| 能力     | 自建                      | 采购（依赖）                          | 决策                                |
| -------- | ------------------------- | ------------------------------------- | ----------------------------------- |
| 版本比较 | Pascal 实现               | `semver` 包                           | ✅ `semver`（2KB，稳定，无重叠）    |
| 虚拟滚动 | ✅ 已有 `Virtualizer`     | `react-virtual` / `@tanstack/virtual` | ❌ 自建——已有、SSR 安全、框架无关   |
| 键盘导航 | ✅ 已有 `keyboard-nav.ts` | `ariakit` / `react-aria`              | ❌ 自建——已有、框架无关、四框架复用 |
| 类型契约 | ✅ 全 TypeScript          | `zod` / `runtypes`                    | ❌ 自建——运行时检查不必要           |
| 事件日志 | 新增 ~200 行              | `pino` / `winston`                    | ❌ 自建——太重、SSR 不安全           |

**原则**：只有当外部依赖的**核心逻辑与 Iris 的设计约束完全一致**（框架无关、SSR 安全、tree-shakable、< 10KB）时，才考虑采购。否则自建。

---

## 5. 实施路线图

### 5.1 优先级矩阵

基于三个维度打分（影响、风险、紧急度），每个方向 1-5：

| 方向                   | 影响          | 风险                   | 紧急度                | **总分** | 排序      |
| ---------------------- | ------------- | ---------------------- | --------------------- | -------- | --------- |
| ① 模块间契约类型化     | 5（DX 质变）  | 2（纯类型）            | 4（阻止生态增长）     | **11**   | **P1 🥇** |
| ② 适配器协调下沉       | 4（消除重复） | 4（重构风险）          | 3（无障碍合规需要）   | **11**   | **P1 🥇** |
| ③ 皮肤变体解析形式化   | 3（防崩溃）   | 1（纯函数+测试）       | 2（仅在多皮肤时触发） | **6**    | P3        |
| ④ Store 依赖图可观测性 | 3（开发体验） | 2（条件编译）          | 2（无紧急业务需求）   | **7**    | P2        |
| ⑤ 插件生命周期管理     | 4（生态前提） | 3（异步+卸载设计复杂） | 5（npm 发布前置条件） | **12**   | **P0 🥇** |

### 5.2 阶段划分

#### Phase 0（立即 — 1 周）

**目标**：修复文档治理 + 插件系统可发布性

| 任务                                                                      | 产出                           | 风险               |
| ------------------------------------------------------------------------- | ------------------------------ | ------------------ |
| 建立 ADR 目录 `/docs/architecture/decisions/`                             | ADR-001 ~ ADR-005              | 低——纯文档         |
| `IrisPlugin` 加 `version?: string` 和 `requires?: Record<string, string>` | 类型定义 + 运行时检查 + 测试   | 低——加法兼容       |
| 实现 `runPlugins` 的版本冲突检测                                          | 控制台警告 + `@since 1.x` 文档 | 低——纯函数         |
| 评审现有 5 份分析文档，去重 + 交叉引用                                    | 合并后的单一真理源             | 中等——需要团队对齐 |

**门禁**：`pnpm build` + `pnpm test` 继续全绿。

---

#### Phase 1（1-3 周）

**目标**：修复两个 P1 架构债务——契约类型化 + 适配器协调下沉

| 任务                                                         | 产出                                                   | 风险                                        |
| ------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------- |
| `FormSchema<T>` 泛型化 + `createFormBuilder<T>` 加泛型       | `packages/core/src/contracts/schema.ts`                | 中等——需要验证已有 `createFormBuilder` 调用 |
| `DataSourceEvent<T>` 类型定义 + `DataSourceOptions.eventLog` | `packages/core/src/contracts/data-source.ts`           | 中等——`DataSource.mutate` 需要加事件发射    |
| `createVirtualKeyboardNav` 控制器实现                        | `packages/core/src/contracts/navigation.ts` + 协调下沉 | **高**——四框架适配器替换                    |

**风险缓解**：

- `FormSchema<T>`：先在 `plugin-form-builder` 实验性导出，单框架验证后再合并到 core
- 协调下沉：先在 React 适配器做 prototype（评估协调逻辑的框架依赖性），再扩展到 vue/solid/svelte

**门禁**：`pnpm check:rsc` + `pnpm size` 无退化 + 无障碍测试（axe）通过。

---

#### Phase 2（4-6 周）

**目标**：插件生命周期管理 + Store 可观测性

| 任务                                  | 产出                                  | 风险                                     |
| ------------------------------------- | ------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| 异步插件支持 + `IrisProvider.loading` | `PluginLifecycle` + `useAsyncPlugin`  | 中等——需要决定同步/异步的分型走哪个 prop |
| 插件 teardown 钩子                    | `IrisPlugin.install` 返回 `void       | { uninstall: () => void }`               | 低——加法，现有插件受影响？检查：有已发布的 `install` 返回非 void 的插件吗？ |
| Store devtools（**DEV** 条件编译）    | `createStoreGraph()` + VitePress 文档 | 低——dev-only                             |

**风险缓解**：

- 异步插件加载：`IrisProvider` 加 `fallback?: ReactNode` prop，在异步插件加载期间渲染。不破坏现有同步用法
- Teardown：在 playground 中验证 `useEffect(() => { const p = usePlugin('editor'); return p.uninstall; }, [])` 模式

**门禁**：`pnpm bench` 无性能退化 + `pnpm lint` 全绿。

---

#### Phase 3（7-8 周）

**目标**：皮肤形式化 + 文档治理闭环

| 任务                                | 产出                                         | 风险       |
| ----------------------------------- | -------------------------------------------- | ---------- |
| `SkinVariantGraph` + 循环检测       | `packages/core/src/contracts/skin.ts` + 测试 | 低——纯函数 |
| 已有 ADR 评审 + `llms.txt` 更新     | 所有 ADR 链接到 `llms.txt`                   | 低——文档   |
| `manifest.json` 新增 contracts 导出 | AI 可发现契约类型                            | 低——自动化 |

**门禁**：`pnpm gen:manifest` 成功 + 所有 ADR 在 `docs/architecture/` 可读。

---

### 5.3 风险登记册

| 风险                                                      | 可能性 | 影响 | 缓解策略                                                                              |
| --------------------------------------------------------- | ------ | ---- | ------------------------------------------------------------------------------------- |
| `FormSchema<T>` 导致现有 `createFormBuilder()` 调用 break | 中     | 高   | 默认泛型 `= Record<string, unknown>`，发布前在 `apps/playground-*` 中验证四框架       |
| 协调下沉破坏某个框架的特殊行为（如 Solid 的信号粒度）     | 中     | 中   | React 先做，验证后推广；下沉的控制器暴露 `onBeforeFocus?: () => void` 钩子            |
| 插件 teardown 钩子与现有 `usePluginStore` 的清理冲突      | 低     | 高   | 在 `usePluginStore` 中自动注册 teardown，框架生命周期自动清理                         |
| 团队接受 ADR 流程的文化阻力                               | 中     | 中   | 认可"ADR = 输入，不是审批"——降低流程负担到"写 ADR = 好的实践，不写 = 问题追踪"        |
| 异步插件导致 `IrisProvider` 的 SSR 输出包含 loading 状态  | 中     | 高   | 异步插件在 SSR 期间用 `await plugin.install()` 阻塞，直到就绪。SSR 环境默认无 loading |

---

### 5.4 最终架构建议矩阵

总结所有建议，映射到对应问题的根因：

| 根因                 | 表现                                                 | 架构建议                 | 优先级 | 方向编号 |
| -------------------- | ---------------------------------------------------- | ------------------------ | ------ | -------- |
| 跨模块契约未类型化   | `FormValues` 弱类型 / 插件无版本 / DataSource 无事件 | 方向一：契约类型化       | **P1** | ①        |
| 适配器逻辑膨胀       | 虚拟滚动+键盘+焦点协调在四框架重复                   | 方向二：协调下沉         | **P1** | ②        |
| 皮肤变体解析未形式化 | 变体循环依赖无检测                                   | 方向三：变体图形式化     | **P3** | ③        |
| 调试盲区             | Store 订阅不可追踪                                   | 方向四：依赖图可观测性   | **P2** | ④        |
| 插件生命周期缺失     | 无卸载、无异步加载                                   | 方向五：插件生命周期管理 | **P0** | ⑤        |
| 文档信息熵           | 多份重复分析，无交叉引用                             | ADR + 文档治理           | **P0** | —        |

---

**文档元信息**：

- 基于审阅文档：`2026-07-11-peer-review.md`（同行评审的分析审查）
- 项目架构参照：`/home/u1/iris-ui/AGENTS.md`
- 角色：资深架构师级技术方向制定
- 日期：2026-07-12
