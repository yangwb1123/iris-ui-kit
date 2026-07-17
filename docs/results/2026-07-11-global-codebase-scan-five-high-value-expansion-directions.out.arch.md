Now I have a thorough understanding of both the original analysis documents and the fact-checking report. Let me compile the architectural analysis.

---

## 架构师分析报告：基于事实核查的 Iris UI 架构评估

### 分析范围

- **输入**：`2026-07-11-global-codebase-scan-five-high-value-expansion-directions.md`（原始分析）及其 `.out.md`（事实核查报告）
- **参考**：`AGENTS.md`（架构原则）、`docs/ROADMAP.md`（路线图）、`docs/requirements/` 下 80+ 份历史分析文档
- **核心发现**：原始分析的五个方向中，方向三存在严重事实错误，方向四包含虚构代码引用，方向一/五是有效增量，方向二概念有效但已被大量覆盖

---

## 1. 架构评估

### 1.1 当前架构的优势

Iris UI 的五层架构（core → tokens/theme → controllers → adapters → plugins）已证明其设计合理性：

- **核心下沉原则得到验证**：`@iris-ui/core` 零框架依赖，所有跨框架共享逻辑（`createSelectionModel`、`createExpansion`、`createDataSource`、`createFormStore`）集中沉淀。四个适配器（React/Vue/Solid/Svelte）各约 10KB 净桥接代码，没有出现"适配器中写业务逻辑"的反模式。
- **静态分析基础设施成熟**：`@iris-ui/manifest` 的构建时元数据提取（props 类型、JSDoc、跨框架清单）与 `pnpm gen:manifest` 流水线形成可靠的 AI 消费层——这是 `llms.txt` 和 MCP 工具的基石。
- **插件契约干净**：`createPlugin` 的三原语（`registerTokens`、`registerMessages`、`registerStore`）覆盖了主题、i18n、状态共享三类扩展点，且是加法而非 monkey-patch。
- **测试质量门有效**：~1500 测试 + SSR/axe 验证 + size budget + arch-check 的组合在 127 道门中全部通过，保证了质量底线。

### 1.2 当前架构的关键局限性

**① 分析产出质量不可控——分析工具链缺乏事实核验层**

80+ 份分析文档之间存在严重重叠（方向二在 41+ 份分析中被覆盖），同时出现了方向三的"幻觉式"错误（声称不存在的 `apps/cms-vue` 和外部路由依赖）和方向四的虚构代码引用（`errorRetryCount` 不存在）。这说明分析流水线有**系统性质量问题**：

- 没有自动化的**源码引用验证门**：每个 grep 命令应该自动确认结果非空，且引用的文件/行号存在。
- 没有**去重/新颖性检查**：新生成的分析应该自动比对已有分析的标签和关键词，当覆盖度 >80% 时提示合并或淘汰。
- 没有**跨文档一致性校验**：方向三声称的 CMS 四框架外部路由与 `AGENTS.md` 中明确记载的"AdminLayout 内部导航"冲突，但未被检出。

**② 分析过剩，执行不足**

80+ 份分析文档 vs 实际的路线图（ROADMAP.md 中 P1/P2 方向极少）形成巨大反差。大量分析输出后没有转化为 implementation PR。这是一种**分析债**——每一次全库扫描都产生 5 个方向，但团队的消化能力远低于产出的速度。风险在于：重要方向（如实时数据订阅、撤销/重做）在噪声中无法获得足够关注。

**③ Desktop OS 四壳携带大量重复代码**

`AGENTS.md` 确认四框架 CMS 存在于 Desktop 演示中，但方向二证实应用间通信为零。这意味着每个壳的 9-17 个应用都是**独立副本**——同样功能的 Calculator/Files/Settings 在四个壳中各实现一次。虽然这是框架适配器模式的代价，但没有任何机制共享应用层逻辑（工具函数、格式化、业务类型）。这是**显式未决的架构债务**，ROADMAP.md 也未正面承认。

**④ 无持久化层是最显著的"该有而没有"的能力**

ROADMAP.md 的 P0/P1 方向集中在小修复和已验证的能力上，但 `createStore`、`createDataSource`、`createFormStore`、`createWindowManager` 全部是纯内存状态——这是当前架构中最突出的软肋。用户一次 F5 就丢失全部状态。这一缺失在方向五（另一份分析）中得到充分论证，而在原始分析的五个方向中完全缺失。

### 1.3 关键设计决策再评估

| 设计决策                      | 评估                  | 建议                                                                         |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Core 零框架依赖               | ✅ 正确               | 继续坚持                                                                     |
| 插件不做 `registerComponent`  | ✅ 正确               | 保持——会导致类型丢失和 tree-shaking 失效                                     |
| AdminLayout router-agnostic   | ✅ 方向正确，但缺薄桥 | 方向三提出的 `RouterAdapter` 接口概念上有效，即使原始分析的实现证据是虚构的  |
| Desktop OS 四壳各维护一套应用 | ⚠️ 架构抗性合理       | 应用层逻辑重复是已知代价；方向二的跨应用协议属附加能力，不应以此否定四壳设计 |
| 无持久化/无撤销/无实时数据    | ❌ 能力缺口           | ROADMAP 的 P2 战略方向太保守——这些是 P1 级能力，不是"战略"                   |

---

## 2. 扩展方向

基于事实核查结果，我提出以下 5 个方向，**严谨避开虚构证据和已有分析噪声**：

### 方向 A：状态持久化与 URL 同步原生层（P1）

**为什么需要**：当前所有 store 纯内存。表格排序/筛选/分页、表单草稿、皮肤选择、窗口布局——刷新即丢。这是企业应用的最基本持久性需求，不是"可选功能"。且现有基础设施就绪（`createStore`、`createFormStore`、`createWindowManager`）但缺一个统一的 `persist()` 装饰器。

**核心挑战**：

- URL 长度限制（2000 字符）→ 自动降级到 localStorage 并用 hash 引用
- SSR 安全：hydration 只在 `typeof window !== 'undefined'` 时执行
- 多标签页冲突：`BroadcastChannel` 或 `storage` 事件同步
- 要够通用：`persist(store, { key, storage, partial, throttle, serialize, deserialize })` 应能包裹任意 `createStore` 产物

**预期架构变更**：

- `@iris-ui/core/persist`：新增 `persist` 纯函数 + `PersistenceAdapter` 接口
- 内置适配器：`urlPersistence`、`localPersistence`、`sessionPersistence`、`customPersistence`
- 四框架桥接：`usePersistedStore(key, factory, config)` 在每个框架中注入 storage 监听
- 向后兼容：`persist()` 是装饰器而非破坏性变更；不传则旧行为不变

**对现有系统的影响**：纯加法，零侵入。预计 1-2 周核心 + 1 周四框架桥接。

---

### 方向 B：重试/退避/优雅降级组合子（P1）

**为什么需要**：两个异步控制器（`createAsyncResource`、`createDataSource`）共享 token/epoch 竞态保护模式，但都没有重试。这不是缺少"高级功能"，而是**企业用 UI 必须内建的基础可靠性**。ROADMAP.md 也完全未提及此方向。

**核心挑战**：

- 写操作重试需要幂等键（idempotency key）——否则 POST 操作会重复提交
- 乐观更新 → 失败 → 回滚 → 自动重试的生命周期状态机
- 部分成功回滚（批量 1000 行中第 500 行失败）
- 永不重试的操作（用户确认后的 delete）
- 与现有 `AbortSignal`/`epoch` 竞态保护组合

**预期架构变更**：

- `@iris-ui/core/async`：新增 `createRetryable<T>(fn, { maxRetries, backoff, jitter, onRetry, idempotencyKey })` 组合子
- `createDataSource` 接受 `retryPolicy` 选项参数（可选，默认无重试）
- `createAsyncResource` 同理，注入 retry
- 适配器层在 loading 态中增加重试计数显示（`第 2/3 次重试…`）
- 升级策略：重试耗尽 → `onMaxRetriesExceeded`（通知 → 静默降级 → 显示错误页）

**对现有系统的影响**：向后兼容（`retryPolicy` 可选）。核心变更较小（`createRetryable` 约 80 行），适配器 UI 反馈是主要工作量。预计 1 周核心 + 1 周二框架适配。

---

### 方向 C：跨容器拖放系统（P1/P2）

**为什么需要**：现有 `createSortable` 只支持同一 DOM 树内排序。`IrisTransfer` 用按钮而不是拖放。`plugin-form-builder` 和 `plugin-kanban` 都需要跨容器拖放，但当前无法实现。这是多个插件的**阻塞依赖**。

**核心挑战**：

- 触摸设备：`touchstart/touchmove/touchend` → 映射到 pointer events + `setPointerCapture`
- 嵌套拖放区的命中检测和冒泡策略
- 自动滚动（拖动到容器边缘时触发）
- 多选拖动（Table 多选行 → 拖到外部）
- iframe 边界桥接（`postMessage`）
- 跨容器拖放后的数据状态回滚（与方向 B 的重试编排）

**预期架构变更**：

- `@iris-ui/core/dnd`：`createDnDController({ zones, items, strategies })` + `accepts` 类型过滤器
- 四个 renderless Behavior 包裹器：`IrisDraggable`、`IrisDroppable`、`IrisDndProvider`、`IrisDragOverlay`
- 适配到现有组件：`IrisTree` 节点自动 draggable、`IrisTable` 行为 droppable
- 文件拖放：`useDropzone` 接受 `File[]`，类型/大小验证

**对现有系统的影响**：新建模块与现有 `createSortable` 共存。中等复杂度——预计 2-3 周核心 + 2 周适配器 + 1 周适配到插件。

---

### 方向 D：分析流水线质量门 + 去重机制（P0，工程债）

**为什么需要**：80+ 份分析文档中方向二被覆盖 41 次、方向三存在虚构 CMS 引用、方向四引用不存在的代码——这说明分析工具链产生的价值边际递减严重，且缺乏事实验证。这是"分析债"的源头。

**核心挑战**：

- 如何自动检测分析方向与已有文档的重叠程度（关键词匹配、源码引用哈希）
- 如何验证源码引用的存在性（每个 grep 命令的输出应自动校验非空且路径存在）
- 如何在分析生成过程中注入"novelty check"——如果一个方向已被覆盖 N 次，自动降级或合并

**预期变更**（工程改进，非产品特性）：

- 分析生成脚本增加 `--check-references` 模式：自动跑所有 grep 命令并验证结果
- 分析生成脚本增加 `--deduplicate` 模式：比对 `docs/requirements/` 下已有文档的标签摘要
- 分析输出增加 novelty 分数（1-5），低于阈值时要求人工判断
- 非破坏性：现有文档保留，新文档标记 novel 状态

**对现有系统的影响**：仅影响文档/分析工具链，不影响产品代码。预计 3-5 天。

---

### 方向 E：运行时组件元数据与 DevTools 基础设施（P2）

**为什么需要**：`@iris-ui/manifest` 是构建时的——AI 可以静态知道"有哪些组件"，但无法动态知道"这个组件当前什么 prop 状态"、"这棵组件树长什么样"。这是从 AI 原生清单到 AI 原生运行时理解的关键跃迁，也是 DevTools 的前提。

**核心挑战**：

- 元数据注册应 tree-shake 掉（prod 构建中不包含）
- 高阶组件/HOC 的元数据继承链
- SSR 场景：服务器端不保留元数据引用
- 四框架注册方式差异（React `displayName` vs Svelte `component.name` vs Vue `__name` vs Solid `name`）
- 用户自定义组件如何接入——需要 `registerComponentMeta` 开放 API

**预期架构变更**：

- `@iris-ui/core/metadata`：`ComponentMetadataRegistry` 单例 + `registerComponentMeta(config)` + `useComponentMeta(component)`
- 每组件在 mount 时调用 `registerComponentMeta({ name, props, slots, tokens, ariaRole })`，通过 `IrisProvider` 激活
- 适配器层在 dev 模式下启用运行时 prop 验证
- 四框架各增 `useComponentTree()` 返回组件树快照

**对现有系统的影响**：纯加法，零侵入，但需要对 149 组件逐个注入元数据注册。预计 2-3 周。

---

## 3. 接口设计建议

### 3.1 关键模块的接口设计原则

基于当前架构验证有效的部分和方向 A-E，提炼以下接口原则：

**原则一：接口是"把已有模式封装成正式契约"，而非引入新概念**

- 示例：`createStore` 已有 `subscribe`/`getState`/`setState` → `persist()` 只是包裹这个模式
- 反例：不要为拖放新造"zone manager"概念接口——`createDnDController` 应像 `createSortable` 一样，接受 `zones` 数组 + 策略函数

**原则二：所有跨框架接口在 core 定义，适配器只做"框架反应式桥接"**

| Core 接口                     | React 桥                      | Vue 桥              | Solid 桥            | Svelte 桥           |
| ----------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------- |
| `persist(store, config)`      | `usePersistedStore`           | `usePersistedStore` | `usePersistedStore` | `usePersistedStore` |
| `createRetryable(fn, opts)`   | 返回 Promise，无桥需要        | 同                  | 同                  | 同                  |
| `createDnDController(config)` | `useDraggable`/`useDroppable` | 同                  | 同                  | 同                  |
| `ComponentMetadataRegistry`   | `useComponentMeta`            | 同                  | 同                  | 同                  |

各方向 B-E 的接口可以全部沿用这一模式。

**原则三：可选优于配置，组合优于继承**

- `createDataSource` 的 `retryPolicy` 可选参数 → 不传则行为不变（旧代码零影响）
- `persist(store)` 不依赖 store 本身的改动 → 不影响非持久化场景

### 3.2 是否需要新的抽象层

| 方向              | 新抽象层                              | 理由                                                 | 风险                             |
| ----------------- | ------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| A（持久化）       | 需要 `PersistenceAdapter` 接口        | 支持 localStorage/URL/sessionStorage/自定义 四种后端 | 接口设计需覆盖加密、迁移、版本号 |
| B（重试）         | 不需要；只需 `createRetryable` 组合子 | 复用现有 token/epoch 模式                            | 幂等键设计是隐藏复杂度           |
| C（跨容器 DnD）   | 需要 `DnDZone` 和 `DndController`     | 与现有 `createSortable` 概念对齐                     | 触摸 + 滚动的组合是最大风险      |
| D（分析质量门）   | 不需要；工具链改进                    | Shell 脚本 + TS 验证脚本即可                         | 无                               |
| E（运行时元数据） | 需要 `ComponentMetadataRegistry`      | 全局单例，四框架共享                                 | Tree-shaking 和 SSR 安全需验证   |

### 3.3 向后兼容策略

五个方向全部是纯加法，向后兼容约束宽松：

1. **方向 A**：`persist()` 独立函数，不改变任何现有 API 签名
2. **方向 B**：`retryPolicy?` 可选参数，默认 `undefined` = 无重试
3. **方向 C**：新模块，不与 `createSortable` 冲突（提供新接口，旧接口保留）
4. **方向 D**：不影响产品代码
5. **方向 E**：`process.env.NODE_ENV !== 'production'` 包裹，prod 构建 tree-shake 移除

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

| 方向           | 需新依赖 | 建议选型                                                                                        | 理由                                                            |
| -------------- | -------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A 持久化       | 否       | 纯浏览器 API（`URLSearchParams`、`localStorage`、`sessionStorage`）                             | 现有项目无依赖；避免引入 `store2`/`localforage`                 |
| B 重试         | 否       | 纯 JS（`setTimeout` + `AbortSignal`）                                                           | 重试逻辑 < 100 行，自建比依赖更轻                               |
| C 跨容器 DnD   | 是       | **现有依赖优先**：复用 `@floating-ui/dom`（已在浮层中使用）的碰撞检测，补充 `setPointerCapture` | 避免新增 `@dnd-kit`（太重用，50KB+）或 `interactjs`（GPL 冲突） |
| D 质量门       | 否       | 纯 Node.js 脚本 + vitest                                                                        | 已有工具链内完成                                                |
| E 运行时元数据 | 否       | 纯 TS 注册表模式                                                                                | < 200 行接口定义                                                |

**核心原则**：五个方向中没有一个需要引入全新的第三方框架或库。C 方向如果必须新增，优先考虑从现有依赖 (`@floating-ui/dom`) 中复用碰撞检测算法。

### 4.2 自建 vs 采购的决策依据

| 场景                                                    | 自建          | 参考开源                                                             | 判断                                                                   |
| ------------------------------------------------------- | ------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| CSV/Excel 导入解析（方向 A 从原始分析中保留的有效部分） | ❌ 自建不划算 | **Papa Parse**（CSV，轻量<10KB）、**SheetJS**（Excel，但 1MB+ 太大） | CSV 解析用 Papa Parse，Excel 解析走可选插件 `plugin-importer` 可选依赖 |
| DnD 引擎                                                | ✅ 自建       | @dnd-kit / react-beautiful-dnd                                       | 自建可复用 `@floating-ui` 碰撞检测，且跨框架必须自建                   |
| 持久化                                                  | ✅ 自建       | store2 / localforage                                                 | 仅需 80 行装饰器函数，不值得引入依赖                                   |
| 重试                                                    | ✅ 自建       | async-retry / p-retry                                                | 仅需 < 100 行组合子函数                                                |

**决策矩阵**：依赖 > 10KB min + 非跨框架兼容 → 自建；纯逻辑 < 200 行 → 自建；格式解析（CSV/Excel/JSON Schema）→ 用专库。

### 4.3 第三方依赖评估标准

当前项目已有清晰准则（`tsup` 构建、无运行时框架依赖、size budget），扩展方向应补充：

1. **零框架依赖**：新依赖必须在 core 层面保持框架无关（仅 `@floating-ui/dom` 级别的 DOM 库可接受）
2. **< 10KB min+gzip**：C 方向的拖放引擎如果自建超出此预算，应作为可选插件而非 core 依赖
3. **MIT/Apache-2.0**：严禁 GPL/AGPL（已确认当前依赖全部合规）
4. **有 TypeScript 类型**：无类型定义的库拒绝引入
5. **树摇友好**：ESM-only，支持 sideEffects: false

---

## 5. 实施路线图

### 5.1 优先级排序

基于**用户可见价值 × 对现有基础设施的依赖度 × 实现复杂度**三维评估：

| 优先级 | 方向                  | 价值                   | 复杂度 | 依赖                 | 周期估计 |
| ------ | --------------------- | ---------------------- | ------ | -------------------- | -------- |
| **P0** | D 分析流水线质量门    | 高（工程债偿还）       | 低     | 无                   | 3-5 天   |
| **P1** | A 持久化原生层        | 很高（所有应用刚需）   | 中     | 无                   | 2-3 周   |
| **P1** | B 重试/优雅降级组合子 | 高（企业可靠性基线）   | 低-中  | 无                   | 2 周     |
| **P2** | C 跨容器拖放          | 高（插件依赖）         | 高     | 方向 A（持久化可选） | 4-5 周   |
| **P2** | E 运行时组件元数据    | 中（AI 原生/DevTools） | 中     | 无                   | 3 周     |

### 5.2 阶段划分和里程碑

**阶段 1（2026-07 下旬～2026-08 上旬）：工程债 + 起步**

- **P0-D**：分析工具链增加引用验证 + 去重检测
- **P1-A 核心**：`@iris-ui/core/persist` 接口定义 + `persist()` 函数 + 三种内置适配器
- **P1-B 核心**：`@iris-ui/core/async` 的 `createRetryable` 组合子

**里程碑 M1**：`persist()` 通过单测验证 + 可与 `createStore` 组合；`createRetryable` 通过重试/退避/竞态保护单测

**阶段 2（2026-08 中旬～2026-09 上旬）：适配器桥接**

- **P1-A 四框架**：`usePersistedStore` 桥 + 集成到 `IrisProvider`
- **P1-B 适配器**：loading 态增加重试 UI 反馈
- **P2-C 核心**：`createDnDController` 设计 + `DnDZone` 类型 + 碰撞检测策略

**里程碑 M2**：ProTable 的排序/筛选/分页状态可持久化到 URL；`createDataSource` 在失败后自动重试

**阶段 3（2026-09 中旬～2026-10）：深层集成**

- **P2-C 适配器**：`IrisDraggable`/`IrisDroppable` Behavior × 四框架 + 适配到 Tree/Table/Transfer/Kanban
- **P2-E 核心**：`ComponentMetadataRegistry` + `registerComponentMeta` + 元数据 TS 类型定义
- **可选：插件化**：`plugin-importer`（方向一剩余有效部分）作为 B 类插件

**里程碑 M3**：桌面 OS 的应用间可拖放数据；DevTools 可在浏览器插件中展示组件元数据

### 5.3 风险点和缓解策略

| 风险                                   | 概率 | 影响             | 缓解策略                                                                                                         |
| -------------------------------------- | ---- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| P2-C 跨容器 DnD 的触摸兼容             | 中   | 高               | 在 `createDnDController` 中统一使用 `PointerEvent`，退化到 `touch` fallback；初期只支持 desktop，touch 推迟到 V2 |
| P1-B 重试导致幂等性问题                | 低   | 极高（数据重复） | 要求所有写操作重试必须提供 `idempotencyKey`；默认对 POST/PUT/PATCH 不自动重试，只对 GET 重试                     |
| P1-A URL 持久化长度超限                | 中   | 中               | 自动降级：URL 超过 1500 字符 → 只保留 `?s=hashId` 引用，状态存 localStorage                                      |
| 分析流水线改造被忽视                   | 高   | 中               | 列为 P0 即最高优先级；单次 3-5 天投入即可显著提升后续分析质量                                                    |
| 五个方向并行实施导致 context switching | 中   | 中               | 严格遵守阶段划分：同一时间最多 2 个方向并行（1 个核心 + 1 个适配器）                                             |

---

## 结语

### 核心建议

1. **立即修复分析工具链（P0-D）**：当前 80+ 份分析文档噪声大于信号。增加引用验证和去重机制是性价比最高的工程债偿还——它直接影响后续所有方向的提案质量。

2. **优先投入方向 A（持久化）和方向 B（重试）**：这是缺失的企业级基础能力，对现有 149 组件的可用性有直接、可量化的提升。ROADMAP.md 低估了它们的优先级。

3. **方向 C（跨容器 DnD）应仅当 plugin-form-builder 或 plugin-kanban 的阻塞依赖时才启动**：其复杂度（4-5 周）是方向 A/B 的两倍，价值却并非普适。

4. **方向三路由适配器不应完全废弃，但需重新做事实核查**：方向三在概念上有效（RouterAdapter 接口确实是现有架构的自然扩展），文档称为"事实严重错误"的是执行证据而非概念本身。应基于 CMS 实际使用的自定义 hash router（47 行 `router.ts`）重新分析。

5. **建立"分析→验证→实施→关闭"闭环**：当前分析文档积累到 80+ 份但实施极少。建议每个方向提案在生成时自动触发事实核查（`--check-references` 模式），核查通过后将 novelty score、source reference count、span estimate 写入统一仪表盘，由维护者 weekly triage 决定是否推进。不推进的文档打 `[parked]` 标签归档，而非无限积累。
