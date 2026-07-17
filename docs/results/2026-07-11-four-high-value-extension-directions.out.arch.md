现在我已对整个项目有了深入理解，以下是架构分析。

---

# Iris UI 架构分析：四个方向的深入评估

## 1. 架构评估

### 现有架构的优势

Iris UI 的架构设计在现行同类项目中属于一流水平。核心设计决策的合理性体现在：

**1.1 逻辑下沉到 core 的铁律得到了坚持。** `plugin.ts`（301 行）纯框架无关、零 DOM 依赖；`form.ts`（809 行）包含验证引擎、步骤导航、字段值操作、路径系统，全在 core 中——适配器只做 `useForm`/`useField` 桥接。`selection.ts` 的 `createSelectionModel` 被 17+ 组件共享，测试覆盖到位。这不是偶然：`grep -r "from 'react'" packages/core/src` 为空不是巧合，是纪律。

**1.2 插件契约是精心限定的"最小可用"。** `PluginRegistry` 只提供 `registerTokens/registerMessages/registerStore/registerLazyStore/onTeardown`——这是有意为之的克制。插件不能注册组件、不能覆盖现有行为、不能修改 core。这意味着：

- 插件之间零运行时耦合（轻→低心智负担）
- 每个插件可独立 tree-shaking（轻→包体积）
- 移除插件不会留下副作用（干净→按需加载）

**1.3 合同测试系统设计精良。** `Scenario`（纯数据）→ `Driver`（适配器桥接）→ `Runner`（驱动执行）三层分离，与框架无关。39 个场景 × 4 框架的矩阵由 `contract-coverage.test.ts` 强制执行完整覆盖。`assertion-density.test.ts` 禁止无断言的步骤——这种纪律在实际项目中极其少见。

**1.4 选择模型的版本化 O(1) 索引设计**（`selection.ts` 中的 `ensureIndex`/`storeVersion`/`indexVersion`）是高水准的实现。在批处理、外部 setState、模式切换三种场景下都保持了正确的 lazy rebuild 语义。

### 架构债务与局限性

**1.5 最显著的架构债务：表单与数据源之间的缝隙。** 检查四个 CMS 应用的 `UsersPage`——React 版 200+ 行、6 个 `useState`、一个手写的 `saveDraft` 函数、手动管理 `draft` 与 resource controller 之间的同步。同样的模式在 Vue（360 行）、Solid（433 行）、Svelte（372 行）中重复了三次。这不是适配器差异——这是**缺少一个核心级控制器来连接两个已有的核心构建块**（`createFormStore` + `createResourceController`）。

这个税不是一次性的。每增加一个 CRUD 页面→重复胶水代码→重复测试→重复 bug。从架构角度看：**你已经有 form engine（A）和 resource controller（A），但没有 form-resource bridge（应当也是 A）。**

**1.6 虚拟化的渲染模式决策是二元的。** 当前 `VirtualScroll`（在 React 适配器中）的选择是 `itemCount > 0 ? virtual : full`。没有中间地带。Threshold-based 自适应可以在 core 中用 10 行实现并立即生效。

**1.7 插件生态系统已经大到需要协调协议，但当前架构还没有。** 12 个插件存在（admin、calendar、charts、dashboard、editor、form-builder、kanban、locale-zh、markdown、notifications、pro-table、query-builder）。其中几个显然是互补的（form-builder + pro-table + editor），但它们之间零通信。这不是未来的问题——现在是问题。

**1.8 测试对称性的基础设施已经到位，但 SSG 特定缺口仍存在。** 合同测试架构很好，但 SSR 应用目录（`ssr-next`、`ssr-nuxt`、`ssr-sveltekit`）没有等效的 hydration 测试。`ssr-solidstart` 有——其他三个没有。

---

## 2. 扩展方向

### 方向 A（P0）：表单-数据源绑定协议

**为什么需要：**

- 这是**当下**开发者就在付的税。每个 CMS 页面 200-400 行，其中 40-60% 是手动管理 form ↔ resource 同步。
- 收益即时可见：消除胶水代码、减少 bug 面、统一 error/loading/touched 状态流。
- 不依赖其他模块的成熟度（自包含）。

**核心挑战：**

1. **绑定不得强制耦合。** 输入分析文档提出的"强绑定 vs 弱绑定"二元 API 是正确的方向。强制绑定会破坏表单与数据源各自独立的设计哲学。必须同时支持：

   ```
   绑定模式 A（约定）: 表单知道它在编辑用户，自动管理提交→reload
   绑定模式 B（事件）: 表单只发射 onSubmit，应用层决定如何连接
   ```

2. **字段级绑定是必须的，不是边缘情况。** 一个表单有时要从多个数据源读取字段。当前的 `formStore` 使用路径系统（`address.city`、`items[2].sku`）——字段级绑定可以复用这个路径系统。

3. **编辑锁不是表单的概念，是 resource 的概念。** 输入的文档正确地指出了这点。锁协议应该放在 `ResourceController` 中，表单只是观察者/消费者。

**预期的架构变更：**

- 在 core 中新增 ~200 行，不改变现有 `createFormStore` 或 `createResourceController` 的接口
- 新增 `createFormResourceBinding` 工厂函数，组合两者的 store
- 在 `resource.ts` 中新增可选的锁事件（`onBeforeEdit`/`onAfterCommit`/`onAbandonEdit`）

**对现有系统的影响：** 兼容。现有使用 `formStore` 或 `resourceController` 的代码无需改动。

---

### 方向 B（P0）：插件间协调协议

**为什么需要：**

- 12 个插件存在，其中 form-builder + pro-table + editor + notifications 有明显集成需求
- 当前的 `usePluginStore`（零匹配）证明了要么不需要（假），要么需要通过手动桥接（真）——读取现有代码库，许多插件注册了自己的 store，但没有一个读取其他插件
- 这是 v2 插件系统从"挂载"到"集成"的升级

**核心挑战：**

1. **协调协议必须保留插件系统的加法属性。** 不能允许插件 A 覆盖插件 B 的行为。`requireCapability` 必须是只读获取，不是修改。

2. **版本化的能力宣告。** 插件 A 宣告 `registerCapability('editor', { languages: ['sql', 'json'] })`，插件 B `requireCapability('editor')` 然后检查 `languages.includes('sql')`——这个能力形状必须类型安全。

3. **`PluginRegistry` 的向后兼容。** 现有 12 个插件使用当前的纯注册接口，新接口必须是可选的加法。

**输入分析文档提出的分层（L1/L2/L3）建议：**

我同意 L1（进程内）是最优边界。L2（跨 Provider）和 L3（跨窗口）应该明确标记为非目标——它们的需求由"跨应用事件总线"（已作为独立方向覆盖）满足。

**预期的架构变更：**

- 在 `plugin.ts` 的 `PluginRegistry` 中新增两个可选方法（`registerCapability`/`requireCapability`）
- 新增 `CapabilityProvider<T>` 泛型类型，用于类型安全的宣告
- 在 `runPlugins` 中新增拓扑排序的依赖检查（现有排序机制已有 `dependsOn`）

**对现有系统的影响：** 最小。现有插件无需改动。新功能只有在插件选择使用时才生效。

---

### 方向 C（P1）：合同测试对称性升级

**为什么需要：**

- 39 个场景 × 4 框架的矩阵是好的覆盖率，但 SSR hydration 缺口真实存在且可能在生产中隐藏 bug
- 合同系统中缺少"典型 CRUD 流程"端到端场景——这个场景可以同时服务于方向 A 和 B 的集成测试

**核心挑战：**

1. **跨框架 DOM 结构不等价是事实。** Vue 渲染注释节点（`<!---->`），Svelte 有 SSR 标记，React 没有。但输入分析文档做出了**一个不准确的假设**——合同测试系统**已经在使用语义断言**而非 DOM 快照。当前的 `ContractAssertion` 使用 `selector` + `read` + `equals`（读取 `aria-*`、`data-*`、`textContent`），而非 DOM 快照。所以"标准化序列化器"的成本是不需要的——系统已经正确设计。真正的缺口是：
   - 缺少"典型 CRUD 流程"场景（form → resource → list → refresh）
   - SSR app 目录缺少 hydration 测试

2. **每组件每框架的 selector 验证是手工负担。** 当前 README 列出的步骤 1 是"验证所有四个框架的选择器一致性"——这可以是自动化的。

**预期的架构变更：**

- 新增 `scenarios/crud.ts`：从打开编辑弹窗 → 加载数据 → 修改 → 保存 → 刷新表格的完整流程
- 在四个 SSR 应用目录中各新增一个 `hydration.test.ts`
- 新增 `selector-consistency.test.ts` 在 CI 中自动验证四个框架的 `data-iris-*` 属性保持一致

**对现有系统的影响：** 零。加法变更。

---

### 方向 D（P2）：自适应渲染引擎（阉割版）

**为什么需要：**

- 当前的 `VirtualScroll` 使用二元决策（`itemCount > 0 ? virtual : full`），对于中等数据量（50-200 行）会产生不必要的虚拟化开销
- 输入分析文档正确地指出了全局 `DOMBudgetManager` 的风险很高

**核心挑战：**

1. **阈值自适应是纯的，DOM Budget Manager 不是。** 前者的实现是确定的、SSR 安全的、零副作用。后者需要运行时测量、单例状态、SSR hydration 的不匹配修复。

2. **device tier 检测不可靠。** `navigator.hardwareConcurrency` 在旧安卓设备上不存在。回退策略是必需的。

**输入分析文档的建议（"只做阈值自适应，不做全局 DOM Budget"）是正确的。** 以下是修正后的实施范围：

**预期的架构变更：**

- 在 `core/src/virtual.ts` 中新增 `resolveRenderMode(itemCount, threshold)` 纯函数
- 在 `VirtualScrollProps` 中新增可选的 `virtualizeAfter` prop（默认 200）
- 新增 `selectVirtualizeThreshold`——一个基于设备能力的智能默认值选择器

**不做的：**

- 全局 `DOMBudgetManager` 单例
- `deviceTier` 复杂检测（只用 `hardwareConcurrency` 或 `deviceMemory`，回退到默认阈值）
- 运行时渲染模式切换（模式在初始化时决定一次，不切换）

**对现有系统的影响：** 最小。新增 prop，现有行为不变。

---

## 3. 接口设计原则

### 3.1 新接口的设计约束

所有四个方向的接口设计应遵循以下原则：

| 原则             | 含义                                 | 应用场景                                                                              |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| **向后兼容优先** | 新增 API 不改变现有 API 签名         | 特别是方向 A（form binding 不改变 formStore 接口）和方向 B（不改变 PluginRegistry）   |
| **核心优先**     | 所有逻辑在 core 中，适配器只做桥接   | 方向 A 的 binding 逻辑在 core 中，方向 D 的阈值计算在 core 中                         |
| **类型安全**     | 泛型参数确保消费方得到正确的类型推断 | 方向 B 的 `CapabilityProvider<T>` 必须有类型参数                                      |
| **语义单元测试** | 新接口可以用纯函数测试，不需要 DOM   | 方向 D 的 `resolveRenderMode` 是纯函数，方向 A 的 `FormResourceBinding` 用 store 测试 |

### 3.2 不需要新的抽象层

我不同意引入"插件总线"或"DI 容器"之类的全局抽象。方向的实施应保持在现有的抽象层内：

- 方向 A：`form.ts` + `resource.ts` 已有现有工厂——加一个新的 `createFormResourceBinding`
- 方向 B：`plugin.ts` 已有现有 registry 模式——在 `PluginRegistry` 上加两个方法
- 方向 C：`contracts/scenarios/` 已有现有格式——加一个新场景文件
- 方向 D：`virtual.ts` 已有现有纯函数——加一个新函数

过度抽象的风险是真实存在的，特别是在方向 B 上。输入文档的"协议"一词很合适：它是一组打字检查的约定，不是运行时框架。

### 3.3 向后兼容性的具体策略

```
formStore.subscribe  → 保持现有（form binding 读取 store 的 subscribe）
resourceController.mutate  → 保持现有（form binding 调用 mutate）
PluginRegistry 现有方法  → 保持现有（新增 registerCapability/requireCapability）
ContractScenario 格式  → 保持现有（新增 steps 只是更多数组元素）
VirtualScroll props  → 保持现有（virtualizeAfter 是可选的，默认 0 = 当前行为）
```

---

## 4. 技术选型

### 4.1 不需要引入新技术栈

四个方向都不需要引入新的框架、语言或构建工具。现有技术栈（TypeScript strict、pnpm monorepo、Vitest、tsup、svelte-package）足够涵盖所有需求。

### 4.2 唯一的第三方依赖讨论：方向 B 的依赖版本化

方向 B 的能力宣告如果不需要类型安全的版本语义，可以使用现有的 TypeScript 泛型实现。不需要 SemVer 解析库或依赖图库。`dependsOn` 已经在 `plugin.ts` 中实现了拓扑排序——可以重用于能力依赖。

### 4.3 自建 vs 采购

| 方向                      | 决策 | 理由                                                                                        |
| ------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| A (form-resource binding) | 自建 | 这是 core 级别的整合，没有合适的第三方满足"适配 Iris 现有 form + resource controller"的需求 |
| B (插件协调)              | 自建 | 现有的 PluginRegistry 模式已经存在——扩展它比引入新的事件系统更一致                          |
| C (测试对称化)            | 自建 | 合同测试基础设施是自建的——SSR hydration 测试只是补齐                                        |
| D (自适应渲染)            | 自建 | 阈值自适应是 10 行纯函数，不需要引入 react-window 或其他库                                  |

### 4.4 禁止的依赖模式

- **方向 B 不引入事件发射器模式**（EventEmitter、mitt、rxjs）。插件应当通过宣告的能力和共享的 store 进行通信，而不是发布/订阅事件。后者的全局状态太难推理和测试。
- **方向 D 不引入 device detection 库**（mobile-detect、ua-parser-js）。阈值回退是安全的，不需要 UA 解析。

---

## 5. 实施路线图

### 优先级调整 （vs 输入分析文档的建议）

我同意输入分析文档的优先级调整，但有一个修正：

| 方向                    | 优先级 | 理由                                                                              |
| ----------------------- | ------ | --------------------------------------------------------------------------------- |
| A: 表单-数据源绑定      | **P0** | 当前痛点最大、收益最直接、不依赖其他方向                                          |
| B: 插件协调             | **P0** | 插件生态已够大（12 个），互补插件对（form-builder + pro-table + editor）已存在    |
| C: 测试对称化           | **P1** | 在 npm 发布前至少一个季度开始——但必须早于 A 的集成测试落地，否则 A 没有跨框架验证 |
| D: 自适应渲染（阉割版） | **P2** | 价值明确但范围小，可以随时插入                                                    |

### 阶段划分

**Phase 1（当前 sprint + 1）：方向 A MVP**

```
- core: createFormResourceBinding 工厂（～200 行）
  - 强绑定模式：bindResource(resource, { rowKey, mapRecordToValues, mapValuesToRecord })
  - 弱绑定模式：on('submit', handler)
- resource.ts: 新增 lockRow/unlockRow（可选，编辑锁协议）
- form.ts: 无变化（仅消费现有的 FormStore 接口）
- 一个 CRUD 合同场景（方向 C 的先行——顺序重要）
```

**Phase 2（下一个 sprint）：方向 B MVP**

```
- plugin.ts: PluginRegistry 新增 registerCapability/requireCapability
- 类型定义：CapabilityProvider<T> 泛型
- 一个 demo 集成：plugin-pro-table 宣告 'selection' 和 'editor' 能力
- plugin-form-builder 消费它们
```

**Phase 3（Phase 1 + 2 稳定后）：方向 C 补齐**

```
- contracts/scenarios/crud.ts: 完整 CRUD 场景
- ssr-next/ssr-nuxt/ssr-sveltekit: 每个加一个 hydration.test.ts
- packages/manifest: 新增 selector-consistency.test.ts
```

**Phase 4（按需）：方向 D**

```
- core/virtual.ts: resolveRenderMode(itemCount, threshold) 纯函数
- VirtualScroll props: 新增 virtualizeAfter
- 一个简单的能力检测：selectVirtualizeThreshold()
```

### 风险点与缓解策略

| 风险                                 | 影响               | 概率 | 缓解                                                 |
| ------------------------------------ | ------------------ | ---- | ---------------------------------------------------- |
| 方向 A 的字段级绑定增加大量复杂度    | Phase 1 延迟       | 中   | MVP 先只做整表绑定，字段级绑定作为 Phase 1.5         |
| 方向 B 的能力宣告版本化变得复杂      | Phase 2 范围 creep | 低   | 首发不使用版本语义——只做类型安全的能力检查           |
| SSR hydration 测试发现修复成本高     | Phase 3 痛苦但必要 | 中   | 先添加测试（失败是已知的），再修复；不是先修复再测试 |
| 方向 D 的 200 默认阈值不适合所有设备 | 某些设备性能不佳   | 低   | 从 200 开始，根据用户反馈调整；不需要复杂的自适应    |

### 最终建议的顺序

```
Phase 1:  方向 A (form-resource binding) → 最直接影响开发者体验
Phase 1.5: 方向 C+ (CRUD contract scenario) → 必须随 A 一起落地以验证
Phase 2:  方向 B (plugin coordination) → 插件生态已准备好
Phase 3:  方向 C (SSR hydration tests + selector consistency) → npm 发布前 must-have
Phase 4:  方向 D (threshold-based adaptive rendering) → 随时可以做
```

关键洞察是方向 A 和方向 C 的 CRUD 合同场景应该一起落地——前者提供功能，后者提供跨框架验证。它们之间的依赖性不是技术性的，而是质量性的：没有跨框架合同的方向 A 会导致四个 CMS demo 中标量修复。
