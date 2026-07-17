现在我对代码库有了深入的了解，以下是我的架构分析。

---

# 架构分析：Iris UI

## 1. 架构评估

### 当前架构的优势

**1. 核心/适配器分离已完美实现。** 代码库提供了完整的证据：`@iris-ui/core/src` 中没有一个文件从任何框架导入。`Store<T>` 抽象作为通用反应式桥接——React 使用 `useSyncExternalStore`，Vue 使用 `ref` + 订阅，Solid 使用 `createSignal`，Svelte 使用 `toStore`。这不仅仅是一个架构声明；它经过了 `contracts/` 系统验证，该系统对四个框架运行相同的行为场景。很少有 UI 库能真正做到这一点。

**2. A/B/C 分类在实践中有纪律地执行。** `selection.ts`、`expansion.ts`、`virtualizer.ts` 和 `nav.ts` 是真正的 A 层控制器——它们拥有状态机/循环逻辑，适配器只订阅结果。`table-export.ts`（`toCsv`/`toSpreadsheetXml`）是典型的 B 层——有用但可摇树优化。`color.ts`、`date.ts` 和 `path.ts`（奇异的正则表达式问题除外）是 C 层纯函数。边界确实是明确的。

**3. 合约系统是跨框架正确的秘密武器。** 大多数多框架库最终会因行为漂移而失败——四个独立实现中各自出现细微的 edge-case 不一致。`contracts/runner.ts` + `ContractDriver` 意味着 React/Vue/Solid/Svelte 的 `IrisDialog` 都针对*同一份数据*（`dialogScenario`）进行测试。这不仅仅是测试中的正确性；它还是一种架构强制机制——一个新适配器必须通过相同的合约才能声称兼容。

**4. `createResourceController` 到 `createDataSource` 的复合是正确的。** 查看 `resource.ts`：它使用 `derived([ds.store], project)` 将 `DataSourceState` 映射为 `ResourceState`，并直接暴露 `ds.selection`。没有手动订阅桥接，没有双发 hop，没有在适配器中重写 CRUD 逻辑。这是复合优于继承的一个教科书案例。

**5. 插件系统经过精心设计，范围适当。** `registerTokens`/`registerMessages`/`registerStore` 是插件真正需要的三种能力。有意省略 `registerComponent`（防止类型擦除、树摇和 manifest 生成）是正确的——大多数插件系统正是在这一点上失败的。`topologicalSort` + `orderPlugins` + `lazyStore` 覆盖了真实的用例。

### 当前架构的局限性

**1. 输入验证是后顾之忧（P0 级风险）。** `path.ts` 的 `parsePath` 以正则表达式为中心的方法无法优雅地处理畸形输入——正如审查报告所指出的，输入被静默截断，直到有东西因错误路径而崩溃。几乎每个控制器都使用 `pathKey(ref) → formatPath(parsePath(ref))` 作为 state 键，这使得任何解析器错误都可能变成静默的数据损坏。对 JSON 安全字符串化键的依赖（`formatPath(parsePath(key)) === key`）是一个很好的运行时检查，但它应该在 `dev` 中被断言，而不仅仅是一个有条件的警告。

**2. 没有树级循环引用保护。** `nav.ts` 同时存在 `flattenNav`（无循环保护）和 `findNavPath`（无循环保护），如果 NavNode 数据出现过循环引用，这会导致栈溢出。图形结构的无限递归不太可能由手写数据引起，但它可能由程序化的菜单生成器引入。这个问题不仅仅是一个 P0 bug——它反映了缺乏防御性架构：核心控制器应该*假设*不可信数据，并防御循环引用。

**3. Fenwick 树在虚拟化器中本质上是无界的。** 这不是一个紧迫的运行时问题（审查正确地指出了 CSS `z-index` 分析中的错误），但它是一个架构性的问题：Fenwick 树为每个 `measure` 调用累积小的浮点增量，并且没有内在的重置机制。在长时间的会话中（编辑数十万行），`prefix()` 查询可能会损失低位的精度。这在实践中不会发生，但它意味着虚拟化器缺少一个 `rebalance(options?)` 调用，该调用以新的 `estimateSize` 阈值重建树——一个在成熟的虚拟化库（如 `react-window`）中常见的特性，以防御“测量膨胀”。

**4. `data-source.ts` 作为 monolithic 工厂。** 查看源代码：`createDataSource` 的实现是 ~220 行内联在 `data-source.ts` 中，而不是位于 `data-source/index.ts` + `data-source/engine.ts` + `data-source/mutations.ts` 中。与 `form.ts`（它使用 `form/values.ts`、`form/validation.ts`、`form/steps.ts`）不同，数据源模组将所有内容塞进一个超大的工厂函数中。这使得单元测试特定部分（乐观更新逻辑 vs. 分页逻辑 vs. 竞态条件逻辑）变得更加困难。

**5. Skins 系统没有自己的核心抽象。** `@iris-ui/skins` 存在于 `packages/skins/` 中，但核心控制器的 `index.ts` 中没有一个文件是从主题或皮肤模组导入的。查看 `packages/core/src/index.ts` 的导出：没有 `applyTheme`、`createThemeStore`、`applyCssVars` 或 `SkinProvider`。这并不是严格的架构债务——主题/皮肤是一个正交的层——但它意味着范式切换（“当皮肤改变时我应该做什么？”）目前必须在每个适配器中重新实现，而不是通过核心的 `Store<Theme>` + `derived()` 投影。

### 关键设计决策评估

| 决策                               | 是否正确？  | 理由                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基于 Store 的反应式桥接            | ✅ 是       | `createStore` + `batch` + `derived` 覆盖了状态管理的所有必要用例。使用 `subscribeWith` 的选择性订阅是 `useSyncExternalStore` 需要的并且是原生支持的。                                                                                          |
| 每个组件一个控制器                 | ✅ 是       | `SelectionModel`、`ExpansionModel`、`Virtualizer`、`TabsNav`——每个控制器大约 80-150 行，管理一个明确定义的状态面。没有“实体控制器”。                                                                                                           |
| Fenwick 树用于虚拟化尺寸           | ✅ 是       | `O(log n)` 点更新和 `O(log n)` 前缀查询是在不预先累积重建的情况下实现 100k 行虚拟化的唯一实用方法。                                                                                                                                            |
| parsePath 使用正则表达式           | ⚠️ 混合使用 | 对于预期的输入（`.` 分隔的路径、括号索引、括号键）可以工作，但对于畸形输入（`a..b`、`a."b"`）静默失败。应该使用状态机或使用 `pathToSegments`/`segmentsToPath` 的双遍方法。                                                                     |
| 窗口管理器 zCounter 递增           | ❌ 不理想   | 虽然数值溢出不是实际风险（审查[^1]），但缺少 `rebalanceZ()` 是一个 API 完备性问题。如果 z-order 通过序列化/反序列化循环，z-values 会趋于无限增长。                                                                                             |
| 没有 ResourceController 的加载状态 | ⚠️ 混合使用 | `createResourceController` 从 `DataSourceState` 中暴露 `loading`，但各个控制器（`createSelectionModel`、`createExpansion`、`createVirtualizer`）没有任何加载状态——它们假设数据已经存在。这迫使适配器为某些组件管理加载状态，而不是为其他组件。 |

---

## 2. 扩展方向

### 方向 1：核心运行时验证层

**为什么需要：** 审查确定了两个 P0 风险（循环 nav 引用、parsePath 输入损坏），它们共享一个共同的模式：_核心控制器在面对畸形或不完整的数据时没有防御机制_。一个可选的运行时验证层将在开发期间捕获这些风险，而无需在每个消费者中强制进行防御性检查。

**核心挑战：**

- 验证不得影响生产包大小（必须可树摇）
- 验证功能必须在不改变核心控制器类型签名的情况下工作
- 循环引用检测需要一个 `seen` Set 和一个最大深度阈值

**预期架构变更：**

```
packages/core/src/
  validate.ts          ← 新增：createValidator(config?) + validateTree / validatePath
  nav.ts               ← 修改：walkNav(visit) 共享辅助函数，所有三个遍历都使用它
  path.ts              ← 修改：在 dev 中为 parsePath 添加 formatPath(parsePath(k)) === k 断言
```

**对现有系统的影响：** 从零开始。核心合约不变。`process.env.NODE_ENV` 守卫确保生产载荷无开销。

### 方向 2：插件级引导生命周期和错误恢复

**为什么需要：** 当前的 `runPlugins()` 在第一个错误处抛出——如果 `plugin-editor` 的 CM6 初始化抛出（例如，因为 DOM 还没有准备好），整个 provider 树就会崩溃。对于重型插件（编辑器、pro-table、查询构建器），单个插件的故障不应该使整个 UI 中断。

**核心挑战：**

- `install()` 是同步的，但核心编辑器初始化可能涉及异步加载（动态 `import()`、Web Workers）
- 回退 UI 需要针对每个插件——当 CM6 失败时，`IrisCodeEditor` 应该渲染什么？
- `destroy()` 的 LIFO 排序假设 DAG——一个失败的插件应该在重试之前为其他插件的清理留出空间

**预期架构变更：**

```ts
// plugin.ts 中的新类型
type InstallResult = { status: 'ok' } | { status: 'deferred'; promise: Promise<void> }
// 或者一个 try/catch 包装器，向 registry 注册错误
interface PluginRegistry {
  onError(name: string, error: unknown): void // 新注册
}
```

**对现有系统的影响：** 向后兼容。插件 `install` 函数保持同步；错误处理是一个可选的加法。

### 方向 3：合同驱动的跨框架兼容性测试基础设施

**为什么需要：** 审查证明合同场景存在于 `packages/core/src/contracts/` 中——有 50+ 个场景（`dialogScenario`、`popoverScenario`、`formScenario`……）——但它们依赖于跨四个框架运行的*单独测试配置*。没有统一的 CI 门说：“运行所有 50 个场景 × 4 个框架，如果一个失败就中断。”

**核心挑战：**

- 框架测试运行器不同：`vitest`（React/Vue/Solid） vs. `svelte-package`（Svelte）
- jsdom 和真实的浏览器有不同的行为（浮点定位、滚动、焦点管理）
- 合同步骤目前使用文本选择器（`data-iris-*`），这些选择器必须保持框架间完全一致

**预期架构变更：**

```
packages/contract-runner/     ← 新包：一个单一 vitest 配置，为所有四个框架导入场景
  index.ts                    ← 迭代 scenario[]，为每个适配器导入 + runContract
packages/core/src/contracts/  ← 修改：添加 metadata（dsl 版本、依赖关系）
```

**对现有系统的影响：** 仅对 CI 有影响。该包仅在测试时使用，从不发布。添加一个 `pnpm check:contracts` 脚本到根 `package.json`。

### 方向 4：Store 持久化抽象

**为什么需要：** 审查确定了 `window.ts` 中的 `serializeSession`/`restoreSession`——一个内置的、框架无关的序列化机制，被埋没在窗口管理器中。表单有 `serialize()`/`hydrate()`。插件可以注册 stores。但没有统一的持久化契约——每个控制器都实现自己的序列化，消费者必须手动协调它们（例如，“在离开之前保存表单草稿 + 窗口布局 + 标签页状态”）。

**核心挑战：**

- 序列化格式必须可组合（表单状态可以嵌入在窗口状态中吗？）
- 存储后端是可插拔的（localStorage、IndexedDB、OPFS、REST API）
- 恢复解析必须重新创建控制器实例，而不是仅仅设置值（`restoreSession` 调用 `wm.open()`，不仅仅是 `store.setState`）

**预期架构变更：**

```ts
// 核心中的新类型（plugin.ts 或新的 persistence.ts）
interface Persistable {
  serialize(): unknown
  hydrate(state: unknown): void
}
// runPlugins 收集 persistables 并公开一个统一的 save/load
```

**对现有系统的影响：** 从零开始。现有控制器（窗口、表单、插件 stores）将实现新的 `Persistable` 接口或包装器。

### 方向 5：数据视图引擎解耦

**为什么需要：** `data-view.ts` 是一个单一的 ~400 行的文件，导出了 `filterSort`、`paginate`、`aggregate`、`summarize`、`groupRows`、`flattenTree`——六个截然不同的操作塞进一个 C 层模块中。`data-view/pagination.ts` 和 `data-view/filter-sort.ts` 已经存在，但导出路径不一致（你通过 `@iris-ui/core` 的 `filterSort` 导入，而不是通过更深层次的路径）。随着你添加更多高级操作（数据透视表、交叉表、递归树过滤），这可能会变得混乱。

**核心挑战：**

- 向模块添加新操作不应要求用户知道它是一个子路径还是核心的一部分
- 树展平和表格展平共享相同的基于 Set 的循环保护——但 duplication 目前是隐式的

**预期架构变更：**

```
data-view/
  index.ts        ← 现有内容（重新导出）
  filter-sort.ts  ← 已存在，好
  pagination.ts   ← 已存在，好
  aggregation.ts  ← 从 data-view.ts 中提取
  tree.ts         ← 从 data-view.ts 中提取（flattenTree、withSortedChildren、treeMatchKeys）
  group.ts        ← 从 data-view.ts 中提取 groupRows
```

**对现有系统的影响：** 纯重构。公共 API（`@iris-ui/core/data-view`）没有变化；只有内部提纯。

---

## 3. 接口设计建议

### 核心设计原则

**1. 每个 Store 都是一个边界。** 查看接线：`createStore<T>(initial)` → `store.subscribe(listener)`。周期性的存储引用。每个控制器（`SelectionModel`、`Virtualizer`、`FormStore`）都暴露一个 `Store<T>` 作为其状态输出。适配器订阅它。插件注册它。这是架构中最重要的接口模式——*任何*改变控制器状态的消费者必须通过其 Store 来进行。

**2. 避免“实体控制器”。** 查看 ResourceController：它现在正确地组合了 DataSource + SelectionModel——一个清晰、狭窄的责任范围。这个模式应该持续下去。一个“PageController”（包含数据、选择、展开、路由、面包屑、标签页、权限）将是架构衰退的开始。

**3. 适配器是纯桥接——没有业务逻辑。** 如果逻辑不仅因框架而异，而且因适配器实现的框架而异，那么它属于 core。在 React `useEffect` 中发现的选择逻辑是一个 bug——它应该被拉到 core 中的一个控制器中。

### 关键接口问题

**问题：`SelectionModel.sync()` 在 batch 内不稳定。**

当前的接口：

```ts
interface SelectionModel {
  store: Store<K[]> // 公开暴露
  sync(keys: K[]): void // 不触发 onChange
}
```

`store` 的公开暴露是使外部 `store.setState(...)` 成为可能的机制——这正是审查场景 A 中使用的机制。修复：

- **选项 A**：使 `store` 为私有只读（`返回类型中的 `readonly store`）。破坏现有消费者的条件。
- **选项 B**：保留 `store` 的公开暴露，但在 `serialize + restore` 模式周围添加文档警告（“不要直接从外部调用 `store.setState`——使用 `set()` 或 `sync()`”）。
- **选项 C**：添加一个 `batch(fn)` 方法到 SelectionModel（和 ExpansionModel），它包裹 `store.batch` 并确保 `index` 在 batch 内更新。

**推荐：选项 C**。向后兼容。不需要框架适配器进行任何更改。

**问题：`parsePath` 的输入验证缺失。**

当前的接口：

```ts
function parsePath(path: Path): PathSegment[]
// 没有验证，没有异常，静默丢弃畸形输入
```

修复：

- **选项 A**：添加一个 `validatePath(path: string): boolean` 帮助函数 + 在 fmt 上的开发断言
- **选项 B**：用基于字符的状态机重写 `parsePath`，明确地抛出格式错误的输入
- **选项 C**：在 `formatPath` 中添加反一致性检查 `formatPath(parsePath(key)) === key`，如果不等则触发 `console.warn`

**推荐：选项 A + C**。选项 B 引入了回归风险（改变解析语义）。A + C 在开发期间捕获不一致性，而无需触及运行时路径。

### 新的抽象层

**持久化层。** 正如 §2 方向 4 中所讨论的，一个统一的 `Persistable` 接口将允许开发人员编写一次“保存会话”代码：

```ts
interface Persistable {
  serialize(): unknown
  hydrate(data: unknown): void
}
// 用法
const session = [formStore, windowManager, pluginRegistry].map((s) => s.serialize())
localStorage.setItem('session', JSON.stringify(session))
```

这不需要改变任何控制器的内部状态——它只需要每个控制器实现两个方法，加上一个收集它们的 `runPlugins` 钩子。

### 向后兼容性

| 变化                             | 中断风险 | 缓解措施                     |
| -------------------------------- | -------- | ---------------------------- |
| 向 Store 添加 `batch()`          | 无       | 新方法                       |
| 向 SelectionModel 添加 `batch()` | 无       | 新方法                       |
| 向 parsePath 添加开发断言        | 低       | 仅开发，可以被 polyfill 覆盖 |
| 向 nav.ts 添加 walkNav(visit)    | 无       | 现有函数重构为使用它         |
| rebalanceZ() 到窗口管理器        | 无       | 新方法，现有行为不变         |
| 使 store 为只读                  | 中等     | 选项 B 或 C 替代             |

---

## 4. 技术选型

### 新依赖项

| 用例                       | 选项                                             | 决定                                                                                               |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 路径解析（替代正则表达式） | 自建状态机 `parsePath2()`                        | ✅ 自建。路径语法是语义版本控制的原生部分；外部解析器引入了兼容性风险。                            |
| 循环图检测                 | 自建 `walkGraph(nodes, visit, opts?)`            | ✅ 自建。核心中的 `walk` 模式太小，无法证明依赖项的合理性。                                        |
| 合同跨框架运行器           | `vitest`（现有）+ `playwright` 用于真实浏览器    | ⚠️ 长期使用 Playwright。Vitest + jsdom 对于初级交互来说足够了；Playwright 用于焦点/滚动/动画合同。 |
| 持久化存储后端             | 自建抽象 + 适配器（localStorage/IndexedDB/OPFS） | ✅ 自建。存储 API 足够简单（`getItem`/`setItem`），不值得依赖第三方。                              |
| 皮肤构建/主题化            | `@iris-ui/tokens`（现有）+ CSS 自定义属性        | ✅ 无变化。范式已经是正确的（CSS 变量 + JS 键）。                                                  |

### 评估标准

1. **大小预算。** core 目前大约 10KB（压缩后）。一个新的依赖项必须为新增的每个 KB 增加同等的功能。
2. **Tree-shakeability。** 如果包不是 ESM 或没有副作用标记，它就进不去。`path` 解析器被编译到 core 中；你不能只用摇树优化来移除它。
3. **无框架冲突。** Vue 插件必须不能导入 React 符号。Solid 的响应式代理必须不能与 Vue 的 ref 冲突。这正是当前架构所保护的——新依赖项不得引入框架作为传递依赖。
4. **无浏览器环境。** core 必须在没有 DOM 的 Node.js 中运行。使用 `globalThis.document` 或 `window` 的依赖项被禁止。

### 自建 vs. 采购

| 模块           | 自建的理由                                                  | 采购的理由                                                         |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| 持久化层       | 核心中大约 80 行。集成现有 Store 接口。                     | localStorage 包装器（如 `store2`）提供了它，但增加了不必要的抽象。 |
| 循环检测       | 一个 20 行的 `walkGraph` 函数。比导入 `graphology` 更简单。 | 不相关——即使是最小的图库也太重了。                                 |
| 路径解析状态机 | 大约 100 行，状态转换，完全匹配当前的 `parsePath` 语义。    | 没有匹配这个路径语法的库（`a.b[2]['c d']`）。                      |
| 合同运行器     | 已经存在（`contracts/runner.ts`）——只需要 CI 基础设施。     | Playwright 的 `@playwright/test` 用于真实的浏览器合同。            |

### 关于外部依赖的核心架构规则

当前架构设置了正确的边界。**core 导入的任何东西都会被传递到所有四个适配器**。因此：

- `@floating-ui/dom` 在 core 中是可以的——它是一个框架无关的定位引擎
- CM6（用于编辑器插件）在 core 插件中是可以的——它是 lazyStore 且是 scoped 的
- 在 core 中 `lodash.merge` 或 `immer` 是**不行**的——它们是不可摇树的传递依赖

这个规则是不可协商的。如果一个依赖项不能从 core 中对四个框架透明，那它就必须是一个 lazyStored 插件依赖项。

---

## 5. 实施路线图

### 优先级排序（修正后）

| ID  | 方向                                                              | 优先级 | 影响             | 风险 | 工作量估计 |
| --- | ----------------------------------------------------------------- | ------ | ---------------- | ---- | ---------- |
| F1  | Nav 循环引用修复（`flattenNav` + `visibleNav` + `findNavPath`）   | **P0** | 安全崩溃修复     | 低   | 1-2 天     |
| F2  | Path 输入验证（`parsePath` 开发断言 + `formatPath` 反一致性检查） | **P0** | 数据损坏修复     | 低   | 2-3 天     |
| F3  | SelectionModel batch 内同步                                       | **P2** | 正确性           | 低   | 1 天       |
| F4  | Virtualizer 默认 getItemKey 警告                                  | **P2** | DX 改善          | 低   | 0.5 天     |
| F5  | WindowManager rebalanceZ()                                        | **P3** | API 完备性       | 低   | 1 天       |
| E1  | 合同 CI 流水线                                                    | **P1** | 质量门           | 中   | 1 周       |
| E2  | 共享 walkNav(visit) 辅助函数                                      | **P1** | 代码健康         | 低   | 1 天       |
| E3  | Core 验证层                                                       | **P1** | 防御性运行时检查 | 低   | 3-4 天     |
| E4  | 持久化层                                                          | **P2** | 新能力           | 中   | 1-2 周     |
| E5  | 数据视图引擎解耦                                                  | **P3** | 可维护性         | 中   | 1 周       |
| E6  | 插件引导/错误恢复                                                 | **P2** | 弹性             | 中   | 1 周       |
| E7  | 皮肤核心抽象                                                      | **P3** | 范式一致性       | 低   | 3-5 天     |

### 阶段划分

**阶段 1（修复——接下来 2 周）：P0 + P1**

```
第 1 周：
  F1 — 所有三个 nav 遍历中的循环保护
  F2 — parsePath 验证 + formatPath 反一致性检查
  E2 — walkNav(visit) 共享辅助函数（由 F1 自然产生）
第 2 周：
  E1 — 合同 CI 流水线（在预提交时运行所有 50 个场景 × 4 个框架）
  F3 — SelectionModel batch(fn) + 测试
```

**阶段 2（弹性——第 3-4 周）：P1 + P2**

```
第 3 周：
  E3 — 核心运行时验证层（createValidator、walkGraph）
  F4 — Virtualizer getItemKey 开发警告
第 4 周：
  E6 — 插件错误恢复（try/catch install、onError 注册）
  F5 — WindowManager rebalanceZ()
```

**阶段 3（能力——第 5-8 周）：P2 + P3**

```
第 5-6 周：
  E4 — 持久化层（Persistable 接口、runPlugins 集成、表单/窗口适配器）
  E5 — 数据视图引擎解耦（从 data-view.ts 中提取 6 个操作）
第 7-8 周：
  E7 — 皮肤核心抽象（createThemeStore、applyCssVars 到 @iris-ui/core）
  E6（续）— 插件 `destroy()` 排序 + HMR 安全重载
```

### 风险与缓解

| 风险                                    | 可能性 | 影响 | 缓解                                                                                                                   |
| --------------------------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| `parsePath` 验证破坏了现有的合法输入    | 低     | 高   | 在带有快照测试的特性分支上推出。用 1000 个随机有效的路径字符串回归测试路径解析器。                                     |
| 合同 CI 流水线对于 Svelte 来说是脆弱的  | 中     | 中   | 开始仅使用 React + Vue + Solid（它们都使用 vitest）。稍后添加 Svelte，使用 `svelte-package` 构建然后使用 vitest 测试。 |
| 持久化层增加了过多的样板代码            | 低     | 中   | 坚持一个狭窄的范围：只持久化状态，而不持久化控制器实例。如果启动扩展到 5 个以上的控制器，则重新评估。                  |
| 皮肤核心抽象与现有的皮肤包重复          | 中     | 低   | `@iris-ui/skins` 保持不变（它是一个构建时主题生成器）。核心抽象是关于运行时交换/补丁——一个不同的模型。                 |
| 插件 `destroy()` 排序在 plugin-x 上失败 | 低     | 中   | 将 LIFO 行为记录为契约性的。如果发现真正的用例，稍后添加显式的 `priority` 字段。                                       |

### 不可妥协的约束

1. **不改变核心导出的 API**，除非 P0 漏洞修复需要它。
2. **不向 core 添加框架导入。** `grep -r "from 'react'" packages/core/src` 必须永远为空。这在 2026 年已经是正确的，并且必须在第 1 阶段之后保持正确。
3. **不添加超过 500 字节（压缩后）的新传递依赖。** 任何新的依赖项都必须经过#4 的批准过程。
4. **合同是向后兼容的门。** 如果你在 `IrisDialog` 中更改了 `aria-*` 属性，`dialogScenario` 中的相应断言也必须更新。一个失败了所有四个框架的 PR 不得合并。
5. **修复优先于功能。** 如果阶段 1 的修复需要比预期更长的时间，就不要在完成第 7 阶段之前宣布第 2 阶段的功能。

---

### 最终总结

Iris UI 的架构在框架无关 UI 库方面是 state-of-the-art 的。核心/适配器分离、合约系统和插件契约都是*正确完成*的——不仅在理论上，而且在 149 个组件 × 4 个框架的规模上得到了经验验证。审查确定的五个方向在严重程度上各不相同，但都源于同一个根本原因：_防御性编码作为一种架构实践是事后才想到的_。循环引用保护、输入验证、批量内部一致性——这些都是一个已经达到生产质量的系统的成长烦恼。架构轨迹是健康的：核心规模适度（10KB），适配器保持薄层，合约在四个框架上执行统一的行为。接下来的两个月（第 1-4 阶段）应该将这些修复从“我们知道它坏了”转移到“我们永远不能再破坏它”。
