Now I have sufficient context. Let me provide the full architectural analysis.

---

# 架构师分析：全局源码扫描 — 5 个高价值扩展方向

> **分析依据**：`docs/requirements/2026-07-11-global-source-scan-five-high-value-extension-directions.md`
> **分析角色**：资深架构师
> **分析日期**：2026-07-12

---

## ⚡ 元问题回答：是否需要交叉验证 `.out.md`？

**需要，但有条件。**

### 价值判断

本文档的 5 个方向相较于目录中其他分析的交叉验证价值如下：

| 评估维度             | 判断           | 理由                                                                                                                                                             |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **源码断言密度**     | 高             | 文档包含 15+ 处具体行号引用、6 处 grep 输出、4 处文件目录列举——这些都是可 falsifiable 的断言                                                                     |
| **事实准确性风险**   | 中偏高         | 既有 35+ 份 `.out.md` 中，**多数发现事实性错误**（前面验证报告中方向一/三/四均有错误）。本文档的断言质量看似较高（它引用了精确的文件路径和行号），但仍需独立核实 |
| **文档声明的排他性** | 弱疑点         | 文档声称"均无重复"，但方向⑤与 tech-lead 分析的方向⑤有交集。需验证"侧重点不同"是否成立                                                                            |
| **架构建议的可靠性** | 取决于事实基底 | 如果方向一的数据源缓存行号引用正确，其架构建议可信；但如果方向三的"零视觉测试"存在遗漏工具配置，结论会打折扣                                                     |

### 建议

**生成 `.out.md`，但聚焦于以下三个高优先级验证点**（不必逐方向等力）：

1. **方向一（请求缓存）**：验证 `createDataSource` 的 `load()` 中确无缓存/去重。这是最核心的架构主张，错误则全方向崩塌。✅ _我已初步验证：`data-source/types.ts` 无 `cache`/`dedupe`/`retry` 字段 — 方向一可信。_
2. **方向三（视觉回归）**：验证 CI 配置中无 screenshot/visual 步骤、验证 Playwright/Chromatic 未出现在 `devDependencies`。这是文档说"零匹配"的高风险断言（可能遗漏 `.github/workflows/` 中的工具引入）。
3. **方向五（跨框架安全）**：验证文档列出的 ❌ 列表（Select/Option 等缺失错误检测）是否准确，以及 Context Symbol 方案未实现。

**优先级**：验证方向三 > 方向五 > 方向一 > 方向二 > 方向四。

---

# 完整架构分析

## 一、架构评估

### 1.1 当前架构的优势

本文档 5 个方向的扫描，恰恰反衬出 Iris UI 架构的**核心优势**：

| 优势                 | 体现                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **逻辑下沉彻底**     | DataSource、Selection、Expansion、Machine 等全部在 core——所以方向一才能定位数据层缓存为独立问题 |
| **四框架桥接一致**   | 方向二/四/五能够跨框架讨论同一问题，说明适配器层确实薄、对称、可横切                            |
| **契约测试体系有效** | direction 三的 contract 系统已经能按框架分场景——加入 visual diff 是扩展而非重做                 |
| **Token 杠杆生效**   | 方向二的动画原语如果基于 Token（`--iris-motion-*`），则所有框架一键消费                         |
| **包边界清晰**       | 每个方向都能明确界定工作量在 core / 适配器 / 插件哪个层                                         |

### 1.2 当前架构的局限性（原文 5 个方向暴露的架构缺口）

从架构高度看，5 个方向映射到以下**系统级缺失**：

```
┌──────────────────────────────────────────────┐
│              缺失的系统属性                    │
├──────────────────────────────────────────────┤
│ ① 数据路径缓存             → 方向一          │
│ ② 渲染路径动画             → 方向二          │
│ ③ 视觉路径验证             → 方向三          │
│ ④ 交互路径协调             → 方向四          │
│ ⑤ 组合路径安全             → 方向五          │
└──────────────────────────────────────────────┘
  每个方向对应一条系统横切面，而非孤立功能点
```

这些不是"可有可无的功能"，而是**生产级 UI 基础设施的标配能力**。用一句话概括：Iris 的组件覆盖深度（151 组件 × 4 框架）已远超同类，但**运行时保障系统**（缓存、动画、视觉验证、交互协调、安全护栏）尚未跟进。

### 1.3 架构债务评估

| 债务类型                 | 严重程度 | 涉及方向 | 描述                                                                                                                                   |
| ------------------------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **数据层无缓存**         | 🟡 中    | ①        | 每次翻页都重新 fetch——对 CRUD 密集型 CMS 场景影响显著。债务在于 architecture 未将"数据缓存在哪"作为一级设计问题                        |
| **Behaviors 无组合**     | 🔴 高    | ④        | 6 个 Behavior 各自绑定 document 事件——这是"正交可叠加"的设计承诺与"孤立实现"的现实之间的鸿沟。债务在于 Behavior 的架构未定义事件仲裁层 |
| **浮层无动画**           | 🟡 中    | ②        | Dialog/Popover/Drawer 无入场/出场动画——这是 WCAG 2.3.3 的弱合规缺口，也是用户感知质量的直接降级                                        |
| **Context 错误检测不全** | 🟢 低    | ⑤        | Select/Option 等缺少 `throw new Error`——成本极低，属疏忽而非设计问题                                                                   |
| **跨框架视觉无门禁**     | 🔴 高    | ③        | 4 框架对齐的核心承诺缺少最终视觉验证环节。这是项目的"export 对齐"完成了但要"渲染对齐"未完成的债务                                      |

### 1.4 关键设计决策评估

| 决策                            | 评估              | 说明                                                                                             |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| **`createDataSource` 无缓存**   | 🟡 合理的延迟决策 | 在 151 组件对齐阶段不做缓存去重是正确的（范围控制）。但现在是时候进入 P0 规划                    |
| **Behaviors 各自绑定 document** | 🔴 架构欠考虑     | 从第一天就应定义 GestureCoordinator 接口。现有 6 个 Behaviors 是独立开发的证据——重构成本已经产生 |
| **动画只有 react/motion 目录**  | 🟡 合理的延迟决策 | 动画原语本身是 UI 框架的核心部分，但 Iris 选择先铺组件数量再打磨质量——在项目早期阶段合理         |
| **零视觉测试基础设施**          | 🟢 传统合理       | 绝大多数 UI 库在早期阶段不做视觉回归。但 Iris 的"4 框架对齐"承诺使视觉测试的 ROI 远超单框架库    |
| **Context 错误检测部分覆盖**    | 🟢 可接受的渐进   | 从 Dialog/Menu/Tabs 开始——这是最常用的组合组件，策略合理                                         |

---

## 二、扩展方向深化评估

### 2.1 方向一：请求缓存 / SWR 层

#### 为什么需要（架构层面）

`createDataSource` 是 core 中**最重的 IO 路径**——它被 `createResourceController`、`useDataSource` 桥、pro-table 插件、dashboard 插件共同消费。它的无缓存状态意味着：

```
CMS 页面加载 → ResourceController → DataSource.fetch
  → 无缓存：每次组件挂载都 fetch
  → 无去重：同一页两个表格分别 fetch
  → 无后台刷新：用户看到 spinner 而非 stale content
```

从系统角度，这是**核心数据管道的架构断层**。

#### 核心挑战

1. **缓存键生成**：DataSource 的 query 是 `{ page, sort, filter, search }` 组合对象。缓存键需要稳定序列化，且需处理大 filter 对象的性能。`JSON.stringify` 有 key 顺序不稳定性（V8 对象属性顺序稳定但规范不保证）。
2. **缓存失效**：乐观 mutate（`mutate(row => ...)`）后，缓存应与新数据同步。但 mutate 可能是局部（单行更新）或全局（重新排序）。缓存粒度需支持行级更新。
3. **多级缓存**：内存 LRU（页面内）→ 可能扩展为持久化（localStorage/IndexedDB）→ 架构需预留层级扩展点，但不在一阶段实现。
4. **跨组件 key 冲突**：两个不同 DataSource 实例可能意外生成相同 cache key（同名 filter 参数）。需要命名空间注入。

#### 对现有系统的影响

- **core 新增 ~400 行**（`data-source/cache.ts`），`DataSourceConfig` 新增可选字段（向后兼容）
- **影响面收敛**：只影响 `createDataSource` 内部流程，不改变 adapter 桥、不改变组件 API
- **风险等级**：低——缓存层是可选的，默认 `cacheStrategy: 'none'` 保持现有行为

#### 我的建议（与原文的差异点）

| 原文建议                                           | 我的评估                                                                  | 调整建议                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `cacheStrategy?: 'none' \| 'swr' \| 'cache-first'` | ✅ 合理。但需要第四个值 `'network-only'`（与 SWR 不同：不写缓存只读网络） | 加 `'network-only'`                                                    |
| LRU Map<string, CacheEntry>                        | ✅ 标准选择                                                               | 使用 `Map` 而非 `LRU` 更简单——设置最大条目数即可，LRU 顺序不是核心需求 |
| 引用计数 GC                                        | 🟡 过度设计                                                               | 简单 LRU + TTL 更可靠。引用计数在组件热卸载/重新挂载时容易泄漏         |
| 全局单例 vs 本地实例可配置                         | ✅ 正确方向                                                               | 默认使用 DataSource 实例级缓存（非全局），避免 key 污染                |

### 2.2 方向二：动画 / 过渡原语

#### 为什么需要（架构层面）

这是对 Iris UI **"渲染体验完备性"的评判**。当前情况：

- Token 系统驱动静态视觉（颜色、尺寸、间距）✅
- 皮肤系统驱动主题变量 ✅
- 但**时间维度（transition/animation）**完全没有抽象层 ❌

一个完整的 UI 基础设施应该覆盖三个维度：

```
   空间（布局/间距）—— Style Token ✅
   色彩（主题/皮肤）—— Theme + Skin ✅
   时间（过渡/动画）—— ❌ 缺失 ← 方向二
```

#### 核心挑战

1. **Presence 模式的四框架差异**：React 需 `useEffect` + `useSyncExternalStore` 模拟 unmount 延迟；Vue 有 `<Transition>` 原生支持；Solid 的 `<Show>` 需要包裹器；Svelte 的 `transition:` 指令完全内建。**统一 API 必须容忍这些差异**，而不是抹平——否则会失去各框架的 native 体验。
2. **动画值与 Token 系统的桥梁**：`--iris-duration-fast: 150ms`、`--iris-easing-default: cubic-bezier(...)` 应作为动画原始值存在。这需要 Token 系统新增 `motion` 分类。
3. **`prefers-reduced-motion` 的全覆盖**：需要从"检测存在但不使用"变为"系统级开关"——类似 `ThemeProvider` 的 `reducedMotion` prop，默认遵循系统设置，可通过 `IrisProvider` 覆盖。

#### 对现有系统的影响

- **core 新增**：`createPresence` 工厂 + `presenceMachine`（4 态状态机 + reduced-motion 短路）
- **4 适配器新增**：`IrisPresence` 组件（每个框架实现不同，但语义相同）
- **Token 系统新增**：`motion` token 分类（时长、缓动函数、位移量）
- **向后兼容**：Presence 是可选包裹器，现有组件无需修改。但建议 Dialog/Drawer/Popover 逐步迁移。

#### 选项权衡

| 方案                                                 | 成本          | 优势                                            | 劣势                                                      |
| ---------------------------------------------------- | ------------- | ----------------------------------------------- | --------------------------------------------------------- |
| **A：声明式 API + Presence 组件**（原文建议）        | 大（~800 行） | 统一、组件集成简单                              | 四框架桥接复杂；可能失去各框架原生动画体验                |
| **B：仅 Token + CSS transition**（轻量替代）         | 小（~200 行） | 无框架绑定；纯 CSS 性能好                       | 无法实现 enter/exit 动画（无 Presence）；复杂动画序列不够 |
| **C：混合——Token + Presence 仅用于浮层，其他用 CSS** | 中（~500 行） | 80% 的动画场景（浮层）得到解决，剩下用 CSS 过渡 | 边界模糊；用户需要知道何时用哪种                          |

**我的建议：方案 C。** Presence 系统最迫切的需求在浮层（Dialog/Drawer/Popover/Tooltip/Toast），这些组件的 enter/exit 动画无法用纯 CSS 解决。列表排序/网格过渡用 CSS transition + Token 即可。不要一开始就追求"完整的声明式动画系统"——先解决浮层，剩下的自然演进。

### 2.3 方向三：视觉回归测试

#### 为什么需要（架构层面）

这是 "四框架对齐承诺" 的**最终验证层**：

```
逻辑对齐 → 契约测试 ✅
API 对齐 → barrel exports + manifest ✅
渲染对齐 → ❌ 缺少 ← 方向三
```

没有视觉层验证，"四框架完全对齐" 只能成立到 TS 类型和行为的层面，但**用户看到的是像素**。

#### 核心挑战

1. **抗锯齿差异**：同一 CSS 在不同 OS（macOS/Windows/Linux）和不同浏览器（Chrome/Firefox/Safari）的渲染存在亚像素差异。CI 截图需要 1-2% 容差，但容差设置不当会导致误报/漏报。
2. **框架 scoping 差异**：Svelte 的 `:global` 遗漏、Vue 的 scoped styles、Solid 的 class 合并——这些差异在 DOM 层面可能表现为缺失的 class 或错误的级联顺序。截图 diff 可以检测，但定位根因需要 DOM 快照对比。
3. **动态内容**：很多组件（Table/Calendar/DatePicker）依赖日期或随机数据。截图基线需要 mock 时间或使用固定数据。

#### 选项评估

| 方案                                          | 成本 | 维护负担                   | 可靠性           | 与现有投资对齐度           |
| --------------------------------------------- | ---- | -------------------------- | ---------------- | -------------------------- |
| **A：Playwright + 手动 demo page**            | 中   | 高（demo page 需手动维护） | 高               | 低（与 manifest 无关）     |
| **B：Storybook + Chromatic**                  | 大   | 中                         | 高               | 低（项目明确无 Storybook） |
| **C：Manifest 驱动 + Playwright**（原文推荐） | 中   | 低（自动生成）             | 中（需模板质量） | 高（复用 manifest 系统）   |

**我的建议：方案 C 优先，但分期实施。**

- **Phase 1**：为 20 个核心浮层/交互组件（Dialog/Drawer/Popover/Menu/Select/Table 等）手动创建 demo page，Playwright 截图。不追求覆盖率，先建立基础设施。
- **Phase 2**：开发 manifest 驱动的 demo page 生成器，逐步扩展到全量组件。
- **Phase 3**：加入 DOM 结构 diff（不仅视觉 diff），捕获 Svelte scoping 泄漏等非视觉但不一致性。

### 2.4 方向四：Behavior 组合与约束系统

#### 为什么需要（架构层面）

这是 Iris 架构中 **"可组合行为"的设计承诺与现实的最大差距**。

当前 Behaviors 的实现模式是：

```
每个 Behavior = 独立的包裹器 + 独立的 document listener
组合时 → 事件冲突 → 用户手动协调 → 架构承诺破裂
```

问题的根因不在实现质量，而在**事件消费模型的缺失**。6 个 Behaviors 共享同一物理事件通道（pointer events），但没有任何逻辑仲裁层决定"这个 pointerdown 属于哪个 Behavior"。

#### 核心挑战

1. **事件归属判定**：pointerdown 发生时，需要根据 hit target、手势方向、嵌套层级判定归属 Movable、Resizable 还是 Sortable。这本质上是**一个小型 gesture recognizer**。
2. **嵌套优先级**：内层 Behavior 应优先于外层。但 React 事件冒泡 + document 监听的组合使优先级难以实现。
3. **Gesture 状态共享**：`isDragging`/`isResizing` 当前是每个 Behavior 私有状态。组合时需要全局可查询的 gesture 状态。
4. **无障碍**：Movable/Sortable 的键盘替代操作缺失。一个完整的组合系统应该对键盘事件也应用相同的仲裁逻辑。

#### 建议架构调整（与原文的差异）

原文建议 `createGestureCoordinator()` 作为核心抽象。我同意方向，但建议**不将其下沉到 core**——而应放在 `@iris-ui/behaviors` 独立包（或留在各适配器的 behaviors 目录中），理由：

| 考虑                              | 分析                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| gesture 协调涉及 DOM 事件模型     | core 是无框架的，不能假设 DOM 存在。gesture coordinator 本质上是 DOM API 的消费者 |
| 四种框架的 pointer event 模型不同 | React 合成事件、Vue 原生事件、Solid 委托事件、Svelte 指令——协调器需要适配这些差异 |
| 与无障碍集成                      | 键盘事件的组合逻辑与 pointer 不同，应分开处理                                     |

**层次划分**：

```
core/behavior-types.ts         → 纯类型 + 手势常量（不去 core 的业务逻辑）
adapter/behaviors/coordinator  → GestureCoordinator（框架感知）
adapter/behaviors/Movable      → 使用 coordinator
adapter/behaviors/Resizable    → 使用 coordinator
```

### 2.5 方向五：跨框架安全

#### 为什么需要（架构层面）

这是一个**信任问题**。项目的核心价值主张之一是"四框架对齐"，但如果用户在同一个项目中混用 React 和 Vue 组件（Monorepo 场景），系统应该：

1. **优雅失败**（throw 清晰错误）而非静默失效
2. **开发时预警**（ESLint 规则或 dev warning）而非等到运行时崩溃

当前 Context 错误检测覆盖了最常用的组合组件，但 Select/Option、Combobox 等缺失。这是一个**低成本的信任投资**。

#### 核心挑战

1. **Context Symbol 碰撞**：如果两个框架的 IrisProvider 使用相同的 Context key（例如 `'iris.context'`），在一个框架内嵌套另一个框架的 Provider 可能导致 Context 错误穿透。React 的 `createContext` 默认不会与其他框架冲突（每个 `createContext` 是新对象），但 Vue 的 `provide/inject` 和 Svelte 的 `setContext` 使用字符串 key——存在碰撞风险。
2. **ESLint 规则的精度**：检测 `import { IrisButton } from '@iris-ui/vue'` 在 React 项目中需要知道项目的框架类型。这通过 `package.json` 的 `"irisMeta": {"framework": "react"}` 可以实现，但用户需要手动配置，或通过解析 `tsconfig`/`vite.config` 自动推断。
3. **Plugin Store 跨框架共享**：如果 plugin store 在不同框架的 IrisProvider 间共享（错误的 Monorepo 配置），错误更难检测——看似正常的 `usePluginStore('key')` 不会报错，但返回的 store 实例可能是另一个框架隔离域的。

#### 分层防御

| 层                 | 机制                          | 成本                    | 效果                   |
| ------------------ | ----------------------------- | ----------------------- | ---------------------- |
| **编译时**         | ESLint 规则检查跨框架 import  | 低（~100 行规则代码）   | 阻止 import 层面的错误 |
| **运行时**         | Context Symbol + 框架标识检测 | 低（每 Provider ~5 行） | 阻止渲染层面的错误     |
| **Component 边界** | 扩展现有的 `throw new Error`  | 极低（每组件 ~3 行）    | 提供友好错误消息       |
| **包级**           | `package.json` 中标记框架类型 | 极低（1 行）            | 支持工具链检查         |

**建议**：三层全做。每个方向的成本评估如下：

```
ESLint 规则:        ~100 行规则代码 + ~30 行测试
Context Symbol:     ~20 行（4 适配器各 ~5 行）
Error 覆盖扩展:     ~30 行（10 个缺失配对各 ~3 行）
总计:               ~180 行
```

这是 5 个方向中**成本最低、回报最确定**的。

---

## 三、接口设计建议

### 3.1 数据层缓存接口

```typescript
// DataSourceConfig 新增（向后兼容）
interface DataSourceConfig<T> {
  // ... 现有字段

  // 新增：可选缓存策略
  cache?: {
    strategy?: 'swr' | 'cache-first' | 'network-only' | 'none'
    key?: (query: DataSourceQuery) => string
    ttl?: number // ms，默认 30000（30s）
    maxEntries?: number // 默认 50
  }
}
```

**设计原则**：

- `cache` 字段是可选对象——不传则表现完全同现状
- `cache.key` 默认使用稳定序列化（排序 key 后 `JSON.stringify`）
- `cache.strategy` 默认 `'none'`——不破坏现有行为
- 缓存存储是 DataSource 实例局部（非全局），避免 key 污染

### 3.2 Presence 接口

```typescript
// core 层（框架无关）
interface PresenceConfig {
  animate?: boolean // 是否启用动画，默认 !prefersReducedMotion
  onEnter?: () => void
  onExit?: () => void
  onAfterEnter?: () => void
  onAfterExit?: () => void
  duration?: number // ms
}

function createPresence(config?: PresenceConfig): PresenceStore
// 返回 { state: 'entering'|'entered'|'exiting'|'exited', ... }
```

**设计原则**：

- `animate` 作为顶层开关——IrisProvider 可通过 context 覆盖（类似 `theme`）
- Presence 状态机 = 4 态，`reducedMotion` 时直接跳转 `entering→entered`、`exiting→exited`
- 不做动画值定义（时长/缓动通过 Token `--iris-motion-*`），保持 core 的框架无关性

### 3.3 Gesture Coordinator 接口

```typescript
// 放在适配器层（非 core），因为涉及 DOM event 模型
interface GestureHandler {
  kind: 'drag' | 'resize' | 'longpress' | 'click'
  onPointerDown(event): 'capture' | 'ignore'
  onPointerMove(event): void
  onPointerUp(event): void
  priority?: number // 更高 = 优先
}

interface GestureCoordinator {
  register(handler: GestureHandler): () => void // 返回 unregister
  getActive(): string | null // 当前活跃 gesture kind
}
```

**设计原则**：

- `onPointerDown` 返回 `'capture'` 表明消费该事件——coordinator 随后只向该 handler 发送 move/up
- 各 Behavior 内部从"直接绑定 document"改为"注册到最近 BehaviorHost 的 coordinator"
- 嵌套时，coordinator 沿 BehaviorHost 的 context 链向上传播约束

---

## 四、技术选型评估

### 4.1 是否需要新增依赖

| 方向           | 建议技术选型                         | 新增依赖                              | 理由                                                                                       |
| -------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| ① 缓存         | 自建                                 | 无                                    | 缓存逻辑简单（Map + TTL + 序列化），不依赖第三方；swr/reattempt/tanstack-query 都太重      |
| ② 动画         | 自建 + CSS                           | 无                                    | Presence 状态机在 core，渲染层用各框架原生过渡（Vue `<Transition>`、Svelte `transition:`） |
| ③ 视觉测试     | **Playwright**（新增 devDependency） | `@playwright/test` + `pixelmatch`     | 截图 diff 需要浏览器环境；Playwright 是行业标准                                            |
| ④ Gesture 协调 | 自建                                 | 无                                    | 领域简单，`pointer capture` API 已是浏览器标准                                             |
| ⑤ 跨框架安全   | 自建 ESLint 规则                     | 无（`@iris-ui/eslint-plugin` 已存在） | 规则逻辑简单                                                                               |

### 4.2 自建 vs 第三方库

| 能力              | 自建理由                                                                                                                          | 外部方案评估                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **SWR 缓存**      | DataSource 的 query 结构是 Iris 特有的，外部库（react-query/swr）需要额外适配层。缓存逻辑 ~200 行即可实现。                       | react-query: 80KB gzipped，重；swr: 12KB，但设计为 React hook，与 4 框架需求不匹配 |
| **动画/Presence** | 每个框架已有原生过渡方案（Vue `<Transition>`、Svelte `transition:`），不需要 framer-motion 级别的库。只需统一 Presence 布尔状态。 | framer-motion: 128KB gzipped；react-spring: 34KB。与 4 框架目标严重冲突            |
| **视觉截图**      | 不适用——截图测试必须使用 Playwright/Cypress。                                                                                     | Playwright 是唯一合理选择。Cypress 截图能力没有 Playwright 成熟                    |

### 4.3 不用引入的新工具

以下工具被明确排除（与项目"无 Storybook"、"无 CSS-in-JS"的既有决策一致）：

| 工具          | 排除理由                                                           |
| ------------- | ------------------------------------------------------------------ |
| Storybook     | 项目中已明确不使用。Manifest 驱动的方案更符合架构                  |
| Chromatic     | 依赖 Storybook，排除                                               |
| Framer Motion | React-only，与 4 框架目标冲突                                      |
| GSAP          | 重（40KB+），且动画需求仅限浮层 enter/exit，无需完整的 JS 动画引擎 |

---

## 五、实施路线图

### 5.1 优先级排序

| 优先级 | 方向                                 | 成本            | 影响面                   | 依赖                                | 判定理由                                     |
| ------ | ------------------------------------ | --------------- | ------------------------ | ----------------------------------- | -------------------------------------------- |
| **P0** | ⑤ 跨框架安全                         | 极小（~180 行） | 开发者信任 + 生态安全    | 无                                  | 成本最低、回报确定、提升"四框架"承诺的可信度 |
| **P0** | ① 请求缓存/SWR                       | 中（~400 行）   | CRUD 性能 + 数据层完备性 | 无                                  | 生产就绪的核心缺口；CMS demo 直接受益        |
| **P1** | ② 动画原语（Phase 1：浮层 Presence） | 中（~500 行）   | UX 质量 + WCAG 合规      | 无                                  | 浮层动画是 UI 框架的基线期望                 |
| **P1** | ④ Behavior 组合                      | 大（~600 行）   | Desktop OS + 高级交互    | 与②有交集（gesture 期间的动画禁止） | Behavior 的设计承诺缺口                      |
| **P2** | ③ 视觉回归测试                       | 中（基础设施）  | 跨框架质量门禁           | 方向①⑤完成后再启动                  | 对用户不可见，是内部质量工具                 |

### 5.2 阶段划分

```
Sprint 1（P0 快速胜利）
├── 方向⑤：Context Error 覆盖扩展（Select/Option, Combobox, RadioGroup, Stepper, ToggleGroup）
├── 方向⑤：Context Symbol 框架标识注入（4 适配器各 ~5 行）
├── 方向⑤：ESLint 规则 no-cross-framework-import
└── 方向①：DataSource 去重（dedupeWindow）+ 基本 SWR（先不引入 LRU）

Sprint 2（P1 核心能力）
├── 方向①：完整 LRU 缓存 + cache strategy 枚举 + TTL
├── 方向②：Token 系统新增 motion 分类（时长/缓动/位移）
├── 方向②：createPresence core 工厂
└── 方向②：IrisPresence 适配器（4 框架统一实现框架）

Sprint 3（P1 组合能力）
├── 方向④：GestureCoordinator 接口定义 + 实现
├── 方向④：Movable/Resizable 迁移到 coordinator
├── 方向④：Sortable/LongPress 迁移到 coordinator
└── 方向②：浮层（Dialog/Drawer/Popover/Tooltip）集成 Presence

Sprint 4（P2 质量门禁）
├── 方向③：Playwright 基础设施搭建
├── 方向③：核心 20 组件 demo page + 截图基线
├── 方向③：CI 集成 pixelmatch diff
└── 方向③：Manifest 驱动的 demo page 生成器（自动扩展）
```

### 5.3 风险矩阵

| 方向 | 风险                                                    | 概率 | 影响 | 缓解策略                                                     |
| ---- | ------------------------------------------------------- | ---- | ---- | ------------------------------------------------------------ |
| ①    | LRU 缓存与 optimistic mutate 的交互 bug                 | 中   | 中   | 单元测试覆盖 mutate + cache 的交叉场景；初期只读缓存不写缓存 |
| ②    | Presence 在四框架中行为不一致（enter/exit 时序差异）    | 高   | 高   | 为每个框架编写独立的 contract scenario；使用 timeout 保底    |
| ③    | 截图阈值调优困难（false positive 率过高）               | 中   | 中   | CI 中先允许 failure（informational only），稳定后再设门禁    |
| ④    | GestureCoordinator 与现有 Behavior 的不兼容（重构中断） | 高   | 中   | 兼容层包装：旧 Behavior 可继续使用直接绑定，逐步迁移         |
| ⑤    | ESLint 规则误报（合法跨框架场景）                       | 低   | 低   | 规则级别设为 warn 而非 error，提供 `eslint-disable` 逃生口   |

### 5.4 关键里程碑

```
M1（Sprint 1 结束）：数据源不再重复请求；跨框架 import 有 ESLint 警告
M2（Sprint 2 结束）：Dialog/Drawer 有淡入动画；数据源有完整的 LRU 缓存
M3（Sprint 3 结束）：Movable 窗口可嵌套 Resizable；Desktop OS 拖拽体验一致
M4（Sprint 4 结束）：视觉回归 CI 门禁就绪；20 核心组件跨框架截图基线建立
```

---

## 六、总结

本文档的 5 个方向覆盖了 Iris UI 架构从"组件完备"走向"系统完备"的必经路径。其中：

- **方向⑤（跨框架安全）**和**方向①（请求缓存）** 应作为 P0 立即启动——它们是生产就绪的基础设施缺口，成本可控且回报确定。
- **方向②（动画）**和**方向④（Behavior 组合）** 是 UX 质量的跃升，也是架构设计中"正交组合"承诺的兑现。建议分期实施，先解决 80% 的场景（浮层动画 + gesture 协调）。
- **方向③（视觉回归）** 是内部质量保障投资——对用户不可见但对团队信心至关重要。建议在 P0/P1 完成后启动。

最关键的主线判断：**本文档的所有方向都可以在 `@iris-ui/core` + 4 适配器的既有分层中实现，不需要引入新包、新工具链或新架构概念。** 这是架构健康的标志——所有扩展都落在已有的分层边界内，没有迫使架构重组的"大爆炸"式变更。
