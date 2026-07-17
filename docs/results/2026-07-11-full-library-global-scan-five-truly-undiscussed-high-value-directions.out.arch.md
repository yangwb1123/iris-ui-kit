I now have a comprehensive understanding of the codebase. Here is my architectural analysis.

---

# 架构分析：Iris UI — 从同行评审到架构决策

## 一、架构评估

### 核心架构优势

Iris UI 的架构设计有若干值得肯定的结构性优势：

**1.1 分层隔离真实有效**

`core`（Layer 0）→ 适配器（Layer 1–4）之间的隔离是通过工具链强制验证的。`grep -rE "from '(vue|react|solid|svelte)'" packages/core/src` 为空这一事实不是偶然——它是架构纪律的证据。store 的 `createStore` + `subscribe` 模式是所有框架反应式的桥接点，这个单点桥接策略降低了适配器心智负担。

**1.2 A/B/C 分类框架是高质量的心智模型**

"拿掉它，改变的是组件「是什么」(A)、「能做什么」(B)、还是「用什么搭的」(C)？"——这个判别问题使设计决策可以廉价地验证。从代码扫描来看，此分类在实际落地中没有明显偏离。`createSelectionModel` (A)、`toCsv` (B)、`compareValues` (C) 的落点与分类一致。

**1.3 插件契约设计克制**

`createPlugin` 只注册 token/messages/store——不做 `registerComponent`。理由是类型安全、tree-shaking、manifest 一致性。这个约束正确：如果插件可以动态注册组件名，manifest 将失去作为"真相源"的权威性。插件不创建新组件类型——只添加 token 层、i18n 包、和共享 store。这是正确的取舍。

**1.4 Store 的设计有前瞻性**

`createStore` 的 `subscribeWith`（带 selector 的订阅）和 `batch`（合并通知）是两个被高估但正确的设计选择。`batch` 是 data-view（filter→sort→paginate 三点更新）能原子性地通知的关键。`subscribeWith` 允许 React 适配器精确订阅 state 切片而非整个 store——这是性能的隐形成就。

**1.5 CommandRegistry 是架构隐藏宝石**

`commands.ts` 的 `createCommandRegistry + fuzzyScore + toMcpTools + Planner` 是一条完整的"注册→发现→执行→AI 桥接"链。它不仅是命令面板（⌘K）的基础，也是 MCP 协议的无缝桥接，还是 LLM planner 的可注入载体。这实际上是一个跨实例注册模式的原型——但它当前被定位为"命令"，而非"通用 scope registry"。

### 架构局限性

**1.6 控制器实例是孤岛——无 scope、无注册、无发现**

`createSelectionModel`、`createExpansion`、`createAdminShell`、`createResourceController` 各自独立创建独立的 `createStore`。它们之间没有"共享同一个 selection model"或"在同一个 data scope 内"的概念。CMS demo 中的主从表场景（点击主表选中行，从表刷新数据）需要开发者手动将选中的 id 作为 prop 传递——这在复杂仪表盘中将导致 prop drilling。

**1.7 MCP codegen 的 CLI 盲点**

`packages/mcp/src/codegen.ts`（618 行）是一个完整的 manifest 驱动代码生成引擎。但它只通过 MCP 协议暴露给 AI agent——开发者无法通过 `pnpm codegen component IrisCombobox` 使用它。这是一个"AI 即开发者体验"的决策，将人类开发者排除在 codegen 消费者之外。

**1.8 性能调节是静态的**

`virtualizer.ts` 的 `buffer`/`overscan` 是静态参数。`data-view.ts` 的 filter→sort→paginate 管线没有工作预算。当前页面渲染 N 个 Iris 实例时，没有协调机制保证帧预算不被耗尽。其根源是：**架构没有"帧预算"这个概念**——每个组件独立行事，假设其他组件不会过度消耗。

**1.9 组件分片在功能域级别，非组件级别**

子路径 `exports` 是 `@iris-ui/react/form`、`@iris-ui/react/theme` 等，而非 `@iris-ui/react/iris-table`。对于 SPA+bundler 场景，tree-shaking 足以消除死代码。但对于 SSR（每个路由独立打包），在路由 `/users` 中引入整个 `form/` 功能域（尽管 tree-shaken）的解析启动时间开销仍然存在——这是 SvelteKit/Next.js 等 RSC 场景的真实痛点。

**1.10 Hydration 恢复策略为零**

`useId` 消除了随机 id 不匹配这一主要来源。但 AI 生成内容中 `new Date()`/`Math.random()` 导致的值差异、以及跨 4 框架不同的 hydration 行为，没有任何恢复策略层。当前的"测试通过 18 个组件的 SSR 安全"仅验证框架代码本身不导致不匹配——但不覆盖应用层数据（LLM 注入的非确定性值）。

### 架构债务

1. **`codegen.ts` 的桩数据硬编码**：data stub 是内联 literal（`new Date('2025-01-15')` 等），而非 schema 驱动。这使得生成复杂嵌套数据（如 Tree 的 2000 节点）需要维护样板代码。

2. **`commands.ts` 与 scope registry 缺乏桥接**：已经有了注册模式（CommandRegistry）、已经有了命名查找（`search`/`list`）、已经有 AI 桥接（`toMcpTools`）——但 selection/expansion/dataSource 等控制器不能注册自身作为一个"scope"。这个桥接缺失是遗憾的，因为基础设施都在。

3. **4 框架 adapter 的测试工厂未共享**：contract harness（`packages/core/src/contracts/`）定义跨框架场景，但每个适配器有自己的 `ContractHarness.tsx`。对于 22 个组件场景，这是高重复。

---

## 二、扩展方向

### 方向 A：跨实例协调架构（Scope Registry）— P0

**为什么需要**

当前架构中，以下模式重复出现在 CMS 场景：

- 主表选中行 → 从表刷新（用户列表 → 用户详情）
- 级联下拉（省 → 市 → 区）
- 仪表盘卡片交叉过滤
- 多 Table 共用同一 selection (transfer/shuttle)

每个场景开发者都手动 prop-drill 或各自用一个 Context。没有统一的"scope"语义让控制器声明自己属于某个命名作用域。

**核心挑战**

1. **框架 context 边界**：React Context、Vue provide/inject、Svelte context、Solid Context——各有不同传播语义。scope 注册必须在框架之上有一个协调层。
2. **SSR 安全**：scope 状态不应在服务端持久化到客户端（除序列化标识符）。
3. **命名冲突**：两个插件可能定义 `scope="master-detail"`——需要命名空间或注册顺序隔离。

**预期架构变更**

```
// 当前：
const selection = createSelectionModel()  // 独立实例，无 scope

// 扩展后：
const registry = createScopeRegistry()
const selection = registry.scope('users-table', () => createSelectionModel())

// 任意位置通过 key 获取同一实例：
const sameSelection = registry.getScope('users-table')  // return same model
```

核心变更点：

| 变更文件                             | 变更内容                                                                              | 程度            |
| ------------------------------------ | ------------------------------------------------------------------------------------- | --------------- |
| `packages/core/src/scope.ts`（新建） | `createScopeRegistry`——复用 `CommandRegistry` 的注册模式，但泛化为工厂注册            | 新文件，~150 行 |
| `selection.ts`                       | 增加 `scope?: string` 到 `SelectionConfig`，如果提供 scope 且 registry 存在则自动注册 | 增量            |
| `expansion.ts`                       | 同理                                                                                  | 增量            |
| `data-source.ts`                     | 同理                                                                                  | 增量            |
| `resource.ts`                        | 同理                                                                                  | 增量            |
| `plugin.ts`                          | `PluginRegistry` 增加 `registerScope` 方法                                            | 增量            |
| 4 适配器                             | `IrisProvider` 创建/注入 `ScopeRegistry` 到 context                                   | 每框架 ~5 行    |

**对现有系统的影响**

- 向后兼容：`scope` 是可选的，缺失时行为与现在完全一致（独立实例）
- 插件系统：插件可以注册 scope，其他插件或应用代码可以通过 `usePluginStore('scope-registry')` 获取
- 性能：无影响——scope 只是**引用共享**，不是消息广播或数据复制

**选项权衡**

| 选项                            | 描述                                                                            | 优劣                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A1. 基于 `CommandRegistry` 扩展 | `ScopeRegistry` 直接包装 `CommandRegistry`，复用 `register/search/list/execute` | 优：已有测试、已有 MCP 桥接；劣：需要将"工厂"映射为"命令"                      |
| A2. 独立 `createScopeRegistry`  | 从头实现 scope 专用注册中心                                                     | 优：语义精确；劣：增加第三个注册模式（command + plugin + scope），需要独立测试 |
| A3. 合并到插件 store            | 通过 `registerStore('scope-registry', () => createScopeRegistry())` 隐式提供    | 优：零新接口；劣：scope 不是"插件级"能力，而是"core 级"基础设施                |

**推荐 A1**——因为 `CommandRegistry` 的 `register/search/toMcpTools` 模式是已验证的设计，且 MCP 桥接让 scope 可以被 AI 发现。

---

### 方向 B：自适应运行时性能调节器 — P0

**为什么需要**

核心风险不是"低端设备"——而是"组件密度飙升"。一个 CMS 仪表盘可能同时有：

- 1 个带 10,000 行虚拟滚动的 `IrisTable`
- 1 个带 filter/sort 的 `IrisDataView`
- 3 个 `IrisCard` 各自独立渲染
- 1 个 `IrisTree`（2000 节点）

虽然 Iris 的虚拟滚动器已经缩小了问题规模，但**当所有组件一同 reconcile 时，16ms 帧预算会被集体耗尽**。当前无任何协调机制。

**核心挑战**

1. **精确度 vs 侵入性**：监控帧预算需要侵入渲染路径（`requestAnimationFrame` + `performance.now()`），但不能破坏现有工作流。
2. **跨实例不跨组件**：需要跨所有 Iris 实例协调，而非单个组件内优化。
3. **收敛而非震荡**：调节器应当快速收敛到一个稳定配置，而非在缓冲大小之间振荡。

**预期架构变更**

```
// 当前：
const buffer = config.buffer ?? 5   // static

// 扩展后：
const governor = usePerformanceGovernor()
const buffer = governor.recommended('virtualizer.buffer', 5)  // dynamic
```

核心变更点：

| 变更文件                                | 变更内容                                                                           | 程度            |
| --------------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| `packages/core/src/governor.ts`（新建） | `PerformanceGovernor` 类：`requestAnimationFrame` 回调计时 + slide window + 推荐器 | 新文件，~120 行 |
| `virtualizer.ts`                        | `buffer`/`overscan` 消费点增加 `governor.recommended()` 路径                       | ~3 行/点        |
| `data-view.ts`                          | compute 管线增加 `governor.recommended()` 路径以限制 filter/sort 复杂度            | ~2 行           |
| `tree.ts`（若存在）                     | 同理                                                                               | ~2 行           |
| `IrisProvider`                          | 可选注入 `PerformanceGovernor` 实例（缺省 = null，无开销）                         | 1 行            |
| 4 适配器                                | `usePerformanceGovernor()` hook                                                    | 每框架 ~5 行    |

**对现有系统的影响**

- 零开箱即用开销：`governor` 默认 null，不注入时性能监视代码全部走 `governor?.recommended(...) ?? defaultValue` 短路
- 调节器状态在整个 app 生命周期内持续——不需要持久化
- 与 `batch()` 协同：`batch` 已经将 N 次 `setState` 合并为一次渲染。Governor 应当**信任 batch**，只测量帧结束时的最终结果

**选项权衡**

| 选项               | 描述                                                         | 优劣                                                                                        |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| B1. 轻量 governor  | 只做 `rAF` 计时 + slide window，推荐虚拟滚动 buffer/overscan | 优：3–5 天可实现，低风险；劣：不覆盖 CPU-bound 操作（filter/sort 大数组）                   |
| B2. 全量 governor  | 包括 `PerformanceObserver` + long task 监听 + GPU 帧监控     | 优：全面覆盖 "组件密度" 问题；劣：2 周+，且 PerformanceObserver 在 jsdom 中不存在，测试复杂 |
| B3. 用户自定义策略 | governor 通过 `config.governor` prop 暴露策略注入点          | 优：灵活；劣：增加了 API 表面积，且大多数用户不需要                                         |

**推荐 B1**——因为问题规模是可控的（6 个静态配置点），不需要 `PerformanceObserver`/`Worker`。

---

### 方向 C：提取 MCP Codegen 为 CLI 工具 — P1

**为什么需要**

当前 codegen 能力存在（618 行），但只有 AI agent 可以调用。开发者场景：

- 创建一个新组件 → 需要手工复制 4 个适配器骨架
- 创建一个新视图（Table + Pagination + Select）→ 手写
- 生成测试骨架（含 spy）→ 手写

**核心挑战**

1. **不破坏 MCP codegen**——提取到共享包后，MCP 和 CLI 应引用同一套渲染器
2. **框架兼容性**：生成的代码必须通过 4 框架各自的类型检查（`pnpm run typecheck`）
3. **Codegen + manifest 双向同步**：CLI 新增组件后应自动更新 manifest

**预期架构变更**

```
packages/
  codegen/          ← 从 packages/mcp/src/codegen.ts 提取
    src/
      index.ts       — 导出所有渲染器函数
      stubs.ts       — 数据桩生成（从 codegen-stubs.ts 提取）
    package.json
    tsup.config.ts
  mcp/               ← 简化，引用 @iris-ui/codegen
    src/
      codegen.ts    — 简化为 re-export + MCP 特定适配
  cli/               ← 新包（可选，或并入 codegen 包）
    src/
      commands/
        component.ts  — pnpm codegen component
        view.ts       — pnpm codegen view
        test.ts       — pnpm codegen test
    package.json
```

对 `codegen.ts` 内部重构：

```
// 当前：codegen.ts 是单一 618 行阻塞文件，函数绑定 MCP 输入 (manifest + name + framework)
// 重构后：
// - generateView()     ← 从 codegen.ts 拆出，无 MCP 引用
// - generateTest()     ← 同上
// - detectControlledPair() ← 纯函数，无 MCP 引用
// - wiredTag()         ← 纯函数
// - stateDecl() / controlledBinding() ← 单元测试的核心
// - MCP 特定管道 (scaffoldSnippet / scaffoldView) 留在 mcp/ 或可选导入
```

**对现有系统的影响**

- `@iris-ui/mcp` 减负（拆出共享包）
- CLI 增加一个 npm script 入口（`pnpm codegen`）
- 需要解决 L4 系统组件（`AdminLayout`/`DashboardGrid`）和 Behaviors（`IrisResizable`/`IrisMovable`）不支持——它们是**显式决定**（这些不遵循受控 value/handler 模式），不是能力缺口

**选项权衡**

| 选项                          | 描述                                  | 优劣                                                                              |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| C1. 提取到 `@iris-ui/codegen` | 新包 + CLI 入口                       | 优：最干净；劣：增加 monorepo 包数量（+1）                                        |
| C2. 直接增强 MCP 包           | 在 `mcp/` 中增加 CLI 入口             | 优：零新包；劣：包命名混乱（MCP 是 AI 协议，不是 CLI）                            |
| C3. 不拆包，仅加 CLI          | 在 `mcp/package.json` 增加 `bin` 字段 | 优：最小改动；劣：mcp 包有 sdk 依赖（@modelcontextprotocol/sdk），生产 CLI 不需要 |

**推荐 C1**——提取 codegen 的逻辑到共享包，MCP 和 CLI 都引用它。这使 codegen 渲染器可以被单元测试直接导入（当前在 618 行文件中只能通过 MCP tools 间接调用）。

---

### 方向 D：声明式组件分片协议 — P1

**为什么需要**

当前分片在"功能域"级别（`form/`, `theme/`, `layouts/`）。对于 SSR 多路由场景：

- `/users` 需要 `IrisTable` + `IrisInput`
- `/dashboard` 需要 `IrisCard` + `IrisTree`

如果每个路由导入 `@iris-ui/react`（尽管 tree-shaken），SSR 的解析/序列化启动时间开销仍然存在。**SSR 场景下，包大小是按路由独立计算的**——全局 tree-shaking 在此失效。

**核心挑战**

1. **依赖图缺失**：manifest 记录组件 props，但不记录依赖（`IrisTable` 依赖 `IrisCheckbox`、`IrisPagination`、`IrisSpinner`）。没有依赖图就做不到按组件分片。
2. **插件边界模糊**：`plugin-pro-table` 同时有 `/core` + 4 框架 UI——分片应切在插件边界还是组件边界？
3. **Svelte 打包特性差异**：Svelte 默认每个 `.svelte` 文件一个 chunk，React 用 barrel 导出——跨框架分片一致性需要元信息驱动。

**预期架构变更**

```
// manifest 增加依赖图字段：
interface ManifestComponent {
  name: string
  group: string
  // ...
  dependencies: string[]  // ← 新增：本组件直接依赖的其他 Iris 组件
}

// 构建时：
// tsup 从 manifest 依赖图自动决定分片边界
// 生成粒度更细的 exports：
//   @iris-ui/react/table
//   @iris-ui/react/table/IrisTable
//   @iris-ui/react/table/IrisPagination  （如果后者被前者引用但也可独立导入）
```

**对现有系统的影响**

- 需要 `pnpm gen:manifest` 扩展来扫描组件 import graph
- 需要调整 `tsup.config.ts` 入口生成逻辑（从"功能域"→"组件"粒度）
- 向后兼容：保留粗粒度的 `@iris-ui/react/form` 路径
- 需要为 Svelte 单独处理（Svelte 的打包器已经自动分片，不需要手动配置 exports）

**选项权衡**

| 选项                                  | 描述                                                                              | 优劣                                               |
| ------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| D1. manifest 依赖图（自动）           | 用 AST 扫描分析各 adapter barrel 中组件间的 import 引用                           | 优：无手动维护；劣：AST 扫描复杂，可能误报内部依赖 |
| D2. manifest 依赖图（手动声明）       | 在每个组件 barrel 入口手动声明 `dependencies: ['IrisCheckbox', 'IrisPagination']` | 优：精确；劣：手动维护，可能落后于代码变更         |
| D3. 不改变分片粒度，优化 tree-shaking | 保持功能域级别分片，增强 sideEffects 声明                                         | 优：零架构变动；劣：SSR 场景无改善                 |

**推荐 D1**（AST 扫描）+ **D2** fallback（对于自动扫描不准的组件，允许手动 override）。这是因为 Iris 已有 manifest 生成管线（`pnpm gen:manifest`），扫描 import graph 是自然的扩展。

---

### 方向 E：SSR 脱水异常恢复协议 — P2

**为什么需要**

当前 Hydration 策略是"使用框架原生机制 + `useId` + 不在 core 中假设 DOM"。这消除了主要的不匹配来源（随机 id）。但剩余风险来自：

1. **AI 生成内容中的非确定性值**：`new Date()`、`Math.random()`、`crypto.randomUUID()`
2. **跨框架行为不一致**：React 无声重建子树，Vue 可能复用错误节点，Solid 警告，Svelte 沉默
3. **用户在不同框架上体验不同**——这与"跨框架对齐"原则矛盾

**核心挑战**

1. **恢复策略比检测重要**：知道 `status === 'mismatch'` 后应该做什么？
2. **AI 生成内容不可预测**：LLM 可能在任意位置注入非确定性值——无法静态检测
3. **框架机制各异**：React 的 `<NoSSR>`、Vue 的 `<ClientOnly>`、Solid 的 `<NoHydration>`、SvelteKit 的 `{% raw %}{#if browser}{% endraw %}`——需要 4 种包装模式

**预期架构变更**

```
// core 定义策略类型，不定义实现（框架无关）：
export type HydrationRecoveryStrategy =
  | 'silent'           // 默认：依赖框架原生行为
  | 'graceful'         // 不匹配子树自动包裹 <ClientOnly>
  | 'log'              // 记录不匹配但不阻止
  | 'force-client'     // 整个页面降级为纯客户端渲染

// 适配器实现（每框架）：
// React:  <HydrationBoundary strategy="graceful">
//           {children}
//         </HydrationBoundary>
// Vue: <HydrationBoundary strategy="graceful">...</>
// Solid/Svelte: 同理
```

**对现有系统的影响**

- `IrisProvider` 增加可选 `hydrationStrategy` prop
- 新增 `packages/core/src/hydration.ts`（纯类型 + 策略枚举，约 50 行）
- 4 适配器各增加 `<HydrationBoundary>` 组件（每框架约 30 行）
- 无测试影响——策略在非 SSR 场景是零开销的
- 与现有 `useId` 策略正交，无需改造

**选项权衡**

| 选项                   | 描述                                         | 优劣                                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| E1. 仅策略枚举 + 日志  | `hydration.ts` 定义类型 + 4 适配器实现       | 优：最小实现，覆盖"静默无声"问题；劣：不提供自动 <ClientOnly> 包装 |
| E2. 完整恢复层         | 包括 E1 + 自动降级 + 焦点保留 + 状态重建     | 优：真正解决 SSR 恢复问题；劣：2 周+，测试复杂                     |
| E3. 延迟到框架原生修复 | 什么都不做，依赖 React/Vue/Svelte 的未来改进 | 优：零工作量；劣：未来不可控                                       |

**推荐 E1**——因为 80% 的价值来自记录和降级策略声明能力，自动 `ClientOnly` 包装是增量改进。E2 可以等 E1 投入生产后再评估是否必要。

---

## 三、接口设计建议

### 3.1 设计原则

**3.1.1 Scope Registry vs Context**

不要用框架 Context 作为跨实例协调的载体。原因：

- React Context 的 value 引用变化会触发生成级重渲染
- Vue provide/inject 没有选择性订阅
- 跨 Context（micro-frontend 场景）无法共享

正确的载体是 **模块级单例 registry + 框架 Context 只承载引用**：

```
// 模块级（core）：registry 是 js module 的 singleton
const globalRegistry = createScopeRegistry()

// 框架级（adapter）：Context 只承载引用，不承载数据
const ScopeRegistryContext = createContext(globalRegistry)
```

**3.1.2 Governor 的"轻触"原则**

PerformanceGovernor 应当是**只读建议者**，不是**强制执行者**。组件应当可以忽略 governor 的建议（如用户手动配置 `buffer=20` 覆盖 governor 的推荐值 `buffer=5`）。模式：

```
buffer = config.buffer ?? governor?.recommended('virtualizer.buffer', 5) ?? 5
```

**3.1.3 Codegen 渲染器必须是纯函数**

`generateView(manifest, intent, framework)` — 相同输入，永远相同输出。这确保了 MCP 和 CLI 输出一致。Codegen 不应有状态、不应有网络调用、不应依赖运行时。

**3.1.4 组件分片的"渐进式 exports"**

不要一次性把所有组件拆到独立 exports。采用 3 级粒度：

1. **全量 barrel**：`@iris-ui/react` — 向后兼容，SPA 场景
2. **功能域**：`@iris-ui/react/form` — 当前粒度，大部分场景
3. **单组件**：`@iris-ui/react/iris-table` — SSR 场景，按需生成

3 级粒度共存，每个包的 `package.json#exports` 同时定义所有路径。

### 3.2 新抽象层

是否需要新的抽象层？评估结果：

| 新抽象层              | 需要的方向       | 推荐                                                     |
| --------------------- | ---------------- | -------------------------------------------------------- |
| `ScopeRegistry`       | 跨实例协调       | **需要**——当前无等价物。CommandRegistry 是最近似但未泛化 |
| `PerformanceGovernor` | 自适应性能       | **需要**——但应当是一个 ~120 行的类，不是架构层           |
| `CodegenRenderer`     | MCP codegen 提取 | **需要**——从 codegen.ts 提取为 `@iris-ui/codegen` 包     |
| `HydrationBoundary`   | SSR 恢复         | **需要**——但只做策略枚举 + 日志，不做自动降级            |
| `DependencyGraph`     | 组件分片         | **需要**——manifest 的扩展，不是独立抽象层                |

**不推荐**的新抽象层：

- **`ComponentRegistry`**（动态组件注册）——与 manifest 确定性原则矛盾
- **`EventBus`**（全局消息总线）——scope registry 已经覆盖了"发现 + 引用"场景，不需要 pub/sub
- **`MiddlewareChain`**（请求拦截链）——Iris UI 不是 HTTP 框架，不需要中间件

### 3.3 向后兼容策略

**3.3.1 Scope Registry**

```
// v1 API（保持）
createSelectionModel(config)          // 独立实例

// v2 API（新增）
createScopeRegistry()                 // 注册中心
createSelectionModel({ scope: 'users-table', registry })  // 作用域实例

// 互操作：
// scope 未提供 = v1 行为（独立实例）
// scope 提供但 registry 未提供 = throw 或 warn（取决于配置）
// scope + registry 提供 = 共享实例
```

**迁移路径**：

1. 无破坏性变更——`scope` 是可选参数
2. 插件可以在 `install` 中注册 scope
3. 1 个 major 版本后可将 `registry` 参数标记为 `@deprecated`（如果决定标准化为仅 `scope`）

**3.3.2 Codegen 提取**

```
// 旧：packages/mcp/src/codegen.ts（在 mcp 包内）
// 新：packages/codegen/src/index.ts（新包）
//     packages/mcp/src/codegen.ts → re-export from @iris-ui/codegen

// 迁移：
// 1. 创建 @iris-ui/codegen 包，导出所有渲染器
// 2. mcp 包的 codegen.ts 改为 re-export（或直接导入）
// 3. CLI 包引用 @iris-ui/codegen
// 4. 3 个月后删除 mcp 包的 codegen.ts 原实现
```

**3.3.3 组件分片**

```
// 旧：package.json#exports → { "./form": "./src/form/index.ts" }
// 新：package.json#exports → {
//       ".": "./src/index.ts",
//       "./form": "./src/form/index.ts",
//       "./form/iris-input": "./src/form/IrisInput.tsx"  // 新增，不删除旧路径
//     }

// 向后兼容：旧路径全部保留，新路径是增量添加
// bundler 遇到新路径时，tree-shaking 自动消除未引用代码
```

---

## 四、技术选型

### 4.1 是否需要新框架或新工具

| 方向                 | 需要新工具                              | 理由                                                                                                                                |
| -------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Scope Registry       | **不需要**                              | 纯 core 逻辑，~150 行 TS，零额外依赖                                                                                                |
| Performance Governor | **不需要**                              | `requestAnimationFrame` + `performance.now()`，无第三方依赖                                                                         |
| Codegen CLI          | **`commander` 或 `cac`**                | CLI 参数解析。`commander`（2.4MB 压缩）和 `cac`（<100KB 压缩）之间选择 `cac`——它已通过 Tsup 的依赖在 monorepo 中                    |
| 组件分片             | **`@rollup/plugin-babel` 或 `oxc` AST** | 需要 AST 扫描分析 import graph。`oxc`（Rust 写的 JS parser）比 Babel 快 10x，但增加 Rust 构建依赖。推荐先用 Babel AST（现有工具链） |
| SSR 恢复             | **不需要**                              | 纯 TS 类型 + 每框架约 30 行组件代码                                                                                                 |

**结论**：当前 5 个方向都不需要引入新框架或运行时。仅 CLI 可能需要 `cac`（20KB 级别），AST 扫描可以使用现有 `typescript` 包的 parse API（已在 devDependencies 中）。

### 4.2 第三方依赖评估标准

| 标准           | 通过条件                      | 缘由                                |
| -------------- | ----------------------------- | ----------------------------------- |
| **包大小**     | 压缩后 < 50KB                 | Iris 有 size 预算门禁，core 仅 10KB |
| **jsdom 兼容** | 无 DOM API 依赖               | 测试环境无真实 DOM                  |
| **框架无关**   | 不引用 react/vue/solid/svelte | core 零框架依赖原则                 |
| **SSR 安全**   | 不调用 `window`/`document`    | 服务端渲染                          |
| **类型安全**   | TS 类型导出                   | 强类型优先                          |
| **无原生模块** | 纯 JS/TS                      | monorepo 构建环境一致性             |

当前所有第三方依赖（`@floating-ui/dom`、`@modelcontextprotocol/sdk`）均满足。新方向的依赖评估：

| 候选                        | 通过      | 说明                                       |
| --------------------------- | --------- | ------------------------------------------ |
| `cac` (CLI)                 | ✅ 通过   | 20KB gzip，纯 JS，无 DOM，框架无关         |
| `commander` (CLI)           | ❌ 过大   | 2.4MB gzip，超出预算                       |
| `typescript` (AST)          | ✅ 通过   | 已在 devDependencies，生产环境无需额外安装 |
| `oxc` (AST)                 | ❌ 不通过 | 需要 Rust 构建流程，增加 CI 复杂度         |
| `long-task-scheduler` (gov) | ❌ 不通过 | 浏览器 API 依赖，jsdom 无 polyfill         |

### 4.3 自建 vs 采购决策

| 能力                 | 决策                           | 理由                                                      |
| -------------------- | ------------------------------ | --------------------------------------------------------- |
| Scope Registry       | **自建**                       | 无现成的 framework-agnostic scope registry npm 包         |
| Performance Governor | **自建**                       | ~120 行 TS，不值引入依赖                                  |
| Codegen CLI + 渲染器 | **自建（从已有提取）**         | 618 行已有代码，只是重新打包入口                          |
| 组件分片依赖图       | **自建（扩展 manifest 管线）** | AST 扫描 ≈ 30 行逻辑（已存在 barrel→manifest 的扫描管线） |
| SSR 恢复             | **自建**                       | 框架特定实现，无公共抽象                                  |

**结论**：5 个方向全部自建。没有合理的采购替代品——这些问题太领域特定（如 scope registry 绑定到 `createSelectionModel`、performance governor 绑定到 `virtualizer.buffer`），通用 npm 包无法覆盖。

---

## 五、实施路线图

### 优先级矩阵（修正版）

| 方向                               | 用户价值 | 架构影响 | 实现成本     | 风险 | 优先级 |
| ---------------------------------- | -------- | -------- | ------------ | ---- | ------ |
| A. Cross-instance Coordination     | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 低（1 周）   | 低   | **P0** |
| B. Adaptive Performance Governor   | ⭐⭐⭐   | ⭐⭐⭐   | 低（3–5 天） | 低   | **P0** |
| C. MCP Codegen → CLI               | ⭐⭐⭐⭐ | ⭐⭐⭐   | 低（1 周）   | 低   | **P1** |
| D. Declarative Component Splitting | ⭐⭐⭐   | ⭐⭐⭐⭐ | 中（1–2 周） | 低   | **P1** |
| E. SSR Hydration Recovery          | ⭐⭐⭐   | ⭐⭐⭐   | 低（3–5 天） | 低   | **P2** |

### 阶段划分

**Phase 1（2 周）—— Scope Registry + Performance Governor**

```
Week 1: Scope Registry
  - core: createScopeRegistry() + 测试
  - selection.ts / expansion.ts / data-source.ts 增加 scope 参数
  - PluginRegistry 增加 registerScope
  - IrisProvider 创建/注入 ScopeRegistry
  - CMS demo 添加主从表示例（users→details）

Week 2: Performance Governor
  - core: PerformanceGovernor 类 + 测试
  - virtualizer.ts: buffer/overscan 消费点增加 governor 路径
  - data-view.ts: filter/sort 复杂度限制
  - 4 适配器：usePerformanceGovernor() + IrisProvider 注入
```

**Phase 2（2 周）—— Codegen CLI + 组件分片依赖图**

```
Week 3: MCP Codegen 提取
  - 创建 @iris-ui/codegen 包（从 mcp/src/codegen.ts 提取）
  - 渲染器函数重构为纯函数 + 单元测试
  - mcp 包 re-export 而非原实现
  - CLI: pnpm codegen component + pnpm codegen view

Week 4: 组件分片依赖图
  - manifest 扫描管线扩展：AST 分析 import 依赖
  - tsup 配置动态生成单组件 exports
  - Svelte 适配器验证（确保 component-level chunking）
  - SSR demo 验证按路由独立打包
```

**Phase 3（1 周）—— SSR 恢复**

```
Week 5: Hydration Recovery
  - core: hydration.ts（策略枚举 + 类型）
  - 4 适配器：HydrationBoundary 组件
  - IrisProvider 增加 hydrationStrategy prop
  - SSR 测试扩展：验证各策略在 hydration 不匹配时的行为
```

### 风险矩阵

| 风险                                                                                          | 概率 | 影响 | 缓解策略                                                                                     |
| --------------------------------------------------------------------------------------------- | ---- | ---- | -------------------------------------------------------------------------------------------- |
| Scope registry 在 micro-frontend 场景中跨 shell 丢失                                          | 中   | 高   | 早期集成 micro-frontend demo（Webpack Module Federation 或 Vite federation plugin）          |
| Performance governor 在 4 框架上行为不一致（如 Solid 的同步 reconcile 与 React 的异步 batch） | 中   | 中   | Governor 仅测量 wall-clock 时间，不关心框架 reconcile 模式；在多框架 contract harness 中验证 |
| Codegen CLI 生成的代码通过 React 类型检查但 Vue/Solid/Svelte 失败                             | 低   | 中   | codegen 测试逐个框架生成 + 类型检查（可复用现有质量门 `pnpm run typecheck`）                 |
| 组件分片导致 Svelte chunk 数量激增                                                            | 中   | 低   | Svelte 的打包器已自动处理 chunk；manifest 依赖图仅用于 React/Vue/Solid 的 tsup 入口生成      |
| SSR 恢复策略 `graceful` 在 4 框架上的实现语义不一致                                           | 高   | 中   | `graceful` 只做日志 + 框架默认行为。自动 `<ClientOnly>` 包装是 E2（Phase 3 明确不做）        |
| 新包 `@iris-ui/codegen` 增加了 monorepo 构建时间                                              | 中   | 低   | codegen 包无新依赖（纯 TS 提取），Turborepo 缓存使其增量构建 < 1s                            |

### 里程碑

| 里程碑               | 时间         | 交付物                                                     | 验证门禁                                               |
| -------------------- | ------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| M1: Scope + Governor | Phase 1 结束 | `createScopeRegistry` + `PerformanceGovernor` + 主从表示例 | `pnpm turbo run test typecheck lint build` + size 预算 |
| M2: Codegen CLI      | Phase 2 结束 | `@iris-ui/codegen` 包 + `pnpm codegen component/view/test` | 从零用 CLI 生成 4 框架组件骨架 + CI 通过               |
| M3: 组件分片         | Phase 2 结束 | manifest 依赖图 + 单组件 exports                           | SSR demo 路由 `/users` 打包不含 `IrisCard`/`IrisTree`  |
| M4: SSR Recovery     | Phase 3 结束 | `HydrationBoundary` + 4 策略                               | 在 hydration 不匹配场景下验证各策略行为                |
| M5: 全量集成         | Phase 3 结束 | 5 方向全量 + CMS demo 集成主从表/性能/CLI/SSR              | E2E demo 覆盖全部新能力                                |

---

## 总结：核心架构决策回顾

| 决策                                     | 选择 | 理由                                               |
| ---------------------------------------- | ---- | -------------------------------------------------- |
| Scope Registry 复用 CommandRegistry 模式 | ✅   | 已有测试、MCP 桥接、注册/搜索/执行模式——纯增加泛化 |
| Governor 只做建议者，不做强制执行        | ✅   | 零侵入，用户配置优先                               |
| Codegen 提取到独立包                     | ✅   | MCP 和 CLI 共享同一渲染器，保证输出一致            |
| 组件分片推荐 AST 自动扫描                | ✅   | 避免手动声明依赖的维护成本                         |
| SSR 恢复第一期只做策略定义 + 日志        | ✅   | 最小实现覆盖 80% 问题（了解不匹配发生 + 降级入口） |
| 所有方向自建，不引入新框架               | ✅   | 全部在现有技术栈内可解决                           |

**一句话总结**：当前架构的核心约束（core 零框架依赖、A/B/C 分类、插件为加法）是正确的——5 个方向都不需要修改这些约束，而是在约束之上增加 scope 语义、性能协调、开发者工具、和 SSR 稳健性。
