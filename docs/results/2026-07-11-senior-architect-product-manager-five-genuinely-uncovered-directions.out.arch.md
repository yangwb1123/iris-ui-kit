以下是从架构师视角对《五个真正未被论述的高价值扩展方向》的深度分析。

---

# 架构师分析：Iris UI 五个高价值扩展方向

## 1. 架构评估

### 当前架构的优势

Iris UI 拥有同类 UI 库中罕见的架构清晰度和原则一致性。

- **分层纯净**：Layer 0 → Layer 4 的边界明确，"逻辑下沉 core，适配器做薄桥"在实际代码中得到了严格贯彻（`grep` 验证为零误报）。这在多框架 UI 库中是稀有的——多数项目最终会退化为某一框架的"一等公民 + 其他适配器滞后"。
- **A/B/C 分类模型**：`AGENTS.md` 中的这个分类体系（核心/附加/纯材料）是架构治理的有效工具。它为每个新功能提供了清晰的"归档位"判别流程，避免了"core 膨胀"和"适配器腐败"两个极端。
- **Manifest 系统的先见之明**：在 2026 年看来也许自然，但 `@iris-ui/manifest` 作为"机读消费层"独立存在，不满足于传统的文档生成，而是为 AI 原生交互保留了一个结构化的入口。这是架构级的战略投资。
- **Token 杠杆**："组件一行 ≈ 30 token vs 裸 HTML ≈ 800"不仅是一个 DX 指标，更是一种架构约束——所有样式必须经过 token 系统，这保证了主题系统的可替换性。

### 当前架构的局限性

这五个方向的根本共性：**Iris UI 的架构在"单实例静态声明"层面已经做到极致，但在"多实例动态编排"层面仍是空白。**

| 维度           | 当前状态                        | 瓶颈                                                  |
| -------------- | ------------------------------- | ----------------------------------------------------- |
| **组件创建**   | 手写 4 份适配器代码             | 人力成本 O(4×N)，已有 360+ 文件，每新增一组件乘数固定 |
| **实例关系**   | 每个实例是孤立孤岛              | 无法声明式表达"这两个表共享选中"                      |
| **性能决策**   | 构建时静态预算 + 组件级手动调优 | 无运行时自适应、无设备感知、无帧预算管理              |
| **模块交付**   | 全量 barrel + tree-shaking      | 无组件级物理分片，SSR/MPA 场景有解析损耗              |
| **SSR 健壮性** | 门禁通过但无声失败              | 四框架 hydration 行为各异，无统一恢复协议             |

**架构债务**（已识别但未加速偿还）：

1. **插件框架适配器的"空壳"问题**：13 个插件中，部分插件非 React 框架适配器仅导出 core（无 UI 组件）。这不是技术债务，而是**成本债务**——做 4 份 UI 的工作量是 1 份的 4 倍，而架构没有提供任何工具来消减这个乘数。
2. **子路径粒度的不一致**：`packages/react/package.json` 的 `exports` 定义中，子路径按功能模块划分（`/form`、`/data`、`/admin`），但组件本身无物理分片。这在 MPA 或 SSR 场景中相当于"承诺了按需，交付了全量"。
3. **控制器创建模式缺乏复用机制**：`createSelectionModel`、`createExpansion`、`createDataSource` 的设计都是"每次调用创建独立实例"。它们的设计本身是好的（纯函数、无全局状态），但缺少一个"共享实例"的一等模式——这导致每次组合时开发者要手写 `Context`/`provide`/`setContext` 样板。

---

## 2. 扩展方向

我认同文档中提出的五个方向，但我的优先级排序有所调整，理由见下。

### 方向 A（优先级调整后第 1）：跨实例协调协议 + Manifest 驱动 Codegen（并行启动）

**为什么两个合为 P0？**

它们是同一枚硬币的两面——**"多实例"是运行时的多实例，而"多框架"是构建期的多实例**。两者都在解决"同一个模式在多份副本间复用"的问题：

|      | Manifest 驱动 Codegen               | 跨实例协调协议                    |
| ---- | ----------------------------------- | --------------------------------- |
| 问题 | 4 个框架适配器写 4 份几乎相同的代码 | N 个组件实例无法共享状态          |
| 模式 | 构建期 × 框架维度                   | 运行时 × 实例维度                 |
| 解决 | O(4×N) → O(1.2×N)                   | 手写 watch/context → 声明式 scope |

如果只做其一，另一个会成为新的瓶颈：codegen 生成了 4 份组件，但每个组件实例间仍是孤岛；或者协调协议被接受，但新的协调场景需要手写 4 份适配器才能支持。

**核心挑战——Codegen：**

- **模板的表达力边界**：codegen 不能生成"所有逻辑"——JSX 中条件渲染、事件绑定、反应式桥接（`useSyncExternalStore` vs `ref` vs `createSignal` vs `toStore`）是有实质差异的。模板必须支持"90% 骨架 + 10% 手工填充"的模式，且手工填充的位置必须可预测、可保护（再次 codegen 时不覆盖）。
- **Barrel 一致性验证**：生成的代码必须通过 manifest 检查（`pnpm gen:manifest` 之后组件清单与声明一致）。这要求 codegen 的输出与 manifest 扫描器共享同一份类型定义。
- **增量 vs 全量**：codegen 是"脚手架后每次修改都重新生成"，还是"一次性模板填充后放手"？前者适合紧凑迭代（新增控制器后自动桥接），后者适合稳定的组件集。我建议双模式共存——以 `--watch` 和 `--once` 区分。

**核心挑战——协调协议：**

- **Scope 的生命周期语义**：当 scope `"master-detail"` 的最后一个消费者组件卸载时，scope 中的状态是保留（供后续挂载的实例恢复）还是销毁？这取决于使用场景——dashboard 希望保留，临时弹窗希望销毁。需要引入 `scopeLifetime: 'persistent' | 'auto'` 配置。
- **框架 Context 的桥接一致**：React 的 Context 可以轻易提供 scope 注册中心。但 Solid 和 Svelte 的 Context 在 SSR 环境下的行为不同——注册中心必须是可序列化的（SSR）还是仅客户端？（SSR 场景下 scope 共享通常只涉及 hydration 后的客户端协调，服务端不需要知道 scope 关系）。
- **与插件系统重叠**：`createScopeRegistry` 本质上是一个框架无关的 IoC 容器。插件系统已经有 `registerStore('key', () => …)`——scope registry 会不会是"插件系统的重复发明"？答案是**否**，但接口需要对齐：scope 注册到 `IrisProvider` 的插件上下文，而非独立创建新的 provider。

**预期架构变更：**

```
packages/core/src/
├── scope.ts                # 新增：createScopeRegistry / ScopeRegistry
├── selection.ts            # 修改：createSelectionModel 接收可选 scope
├── expansion.ts            # 修改：同上
├── data-source.ts          # 修改：同上
└── ...                      # 其他控制器逐步添加 scope 参数

packages/codegen/           # 新包
├── src/
│   ├── generator.ts        # manifest → 文件写入
│   ├── templates/
│   │   ├── react.ts        # react 适配器模板
│   │   ├── vue.ts
│   │   ├── solid.ts
│   │   └── svelte.ts
│   ├── validator.ts        # 生成后的 barrel → manifest 一致性验证
│   └── cli.ts              # pnpm codegen
└── package.json
```

**对现有系统的影响：**

- **向后兼容**：scope 参数是可选扩展，`createSelectionModel({ mode })` 继续有效（退化为无 scope 行为）。`codegen` 是新包，不影响现有构建。
- **风险**：scope registry 如果引入为全局单例，可能被插件误用为全局状态管理器。**必须**是 `IrisProvider` 实例级别的注册中心（类似 React Context 的实例隔离）。
- **迁移成本**：已有 360+ 组件文件不需要迁移——codegen 只用于新组件生成。scope 协议从最需要的组件（Table、Tree、Pagination）开始渗透，逐步铺开。

### 方向 B（优先级 2）：通用 SSR 脱水异常恢复系统

**为什么是 P1 而非 P2？**

文档正确地指出了：四个框架的 hydration 恢复行为各不相同（React 丢弃子树重渲、Vue 警告、Solid 不匹配时比较节点、Svelte 静默不一致）。但更关键的是——**AI 生成代码天生容易产生 hydration 不匹配**，因为 LLM 倾向于在 prompt 中填充非确定性值（`Math.random()` 的 ID、`Date.now()` 的时间戳、硬编码的 `navigator.language`……）。如果一个 AI 生成的 Iris UI 页面在 hydration 时闪烁或丢弃子树，用户不会质疑 AI——会质疑 Iris UI 的可靠性。

**核心挑战：**

- **框架桥接的成本不对称**。React 有 `suppressHydrationWarning` + `hydrateRoot` 的显式 API，Vue 3 有 `defineAsyncComponent` + `<ClientOnly>`，Solid 有 `<NoHydration>`，Svelte 有 `{#if browser}`。Iris 不可能提供"跨框架一致的通用恢复"——因为底层框架的 hydration 机制本身就是不同的。Iris 能做的是提供一个**恢复策略的声明式描述**，由各框架适配器翻译为对应的框架 API。这个"翻译"的成本与框架的 hydration API 丰富程度成反比——React 最容易，Svelte 最难（因为 SvelteKit 几乎没有内置恢复机制，需要手动 fallback）。

- **"恢复"的定义是什么？** 降级为客户端单渲（丢弃 SSR 产物）是默认行为——但这样 SSR 的 SEO/首屏价值就丢失了。能否实现"不丢弃子树，只修正差异"？这不取决于 Iris，而取决于底层框架。React 18/19 的 `hydrateRoot` 不支持"修补"——`ReactDOM.hydrateRoot` 的语义是"一次水合、永不修补"（不匹配就丢弃整个子树重渲）。React 18 的 `hydrateRoot` 在将来可能会改进，但 Iris 不能等。

- **Store 持久化的 hydration 感知**。如果 `createStore` 的初始值在 SSR 与客户端不同（如 `new Date()`），store 本身需要知道当前是否在 hydration 阶段。当前 `packages/core/src/store.ts` 无 hydration 感知——它的 `subscribe` 不区分"首次水合订阅"和"运行时订阅"。这会触发重复通知。

**预期架构变更：**

```
packages/core/src/
├── hydration.ts            # 新增：HydrationContext / HydrationStatus 类型 + 事件
├── store.ts                # 修改：subscribe 感知 hydration 阶段，批处理 hydration 通知

packages/react/src/
├── IrisHydrationBoundary   # 新增：基于 suppressHydrationWarning 的自动包裹

packages/vue/src/
├── IrisHydrationBoundary   # 新增：基于 ClientOnly 的自动包裹

packages/solid/src/
├── IrisHydrationBoundary   # 新增：基于 NoHydration 的自动包裹

packages/svelte/src/
├── IrisHydrationBoundary   # 新增：基于 {#if browser} 的自动包裹
```

**对现有系统的影响：**

- **最小侵入**：hydration 感知通过 `IrisProvider` 的 `hydrationRecovery` prop 开启，默认 `'off'`（不做任何额外处理，保持现有行为）。
- **测试要求**：每个框架的 `hydrationBoundary.test.*` 需要模拟 hydration 不匹配场景（`vi.stubGlobal` + SSR render + 客户端 hydrate + 断言恢复行为）。这比单元测试更难——它需要 SSR+CSR 两阶段测试环境。
- **与 SSR 门禁的关系**：当前 SSR 测试（18 个 React 组件）只验证"不抛异常"。升级到"验证恢复正确"需要重构测试 harness，引入两阶段渲染 + `console.error` 拦截。

### 方向 C（优先级 3）：声明式组件分片协议

**为什么是 P2？**

tree-shaking 在绝大多数 Vite/webpack 项目中工作良好。组件级物理分片的收益主要集中在**SSR 服务端启动时间**（减少需解析的模块数）和**MPA 场景**（每个页面只加载所需分片）。对单页应用（SPA）——Iris UI 的主要消费场景——tree-shaking 已经能满足需求。所以此方向的用户价值不如前两个方向紧迫。

但它的架构价值很高：**没有物理分片，"插件按需 use"的架构承诺就是一半的空话**——核心组件库本身没有做到组件级按需加载。

**核心挑战：**

- **依赖图是隐式的**。`manifest.json` 知道每个组件导出什么，但不知道组件之间的导入关系（`IrisTable` 依赖 `IrisCheckbox` 吗？依赖 `IrisPagination` 吗？）。分片必须是 DAG 卫计划的：一个分片不能引入循环依赖。需要构建一个 `ComponentGraph` 层（静态分析 import 语句然后输出 JSON），与 manifest 合并产出分片清单。
- **分片粒度的归一化问题**。每个框架的分片结构必须一致——否则 `@iris-ui/react/splits/table` 在 React 中可用，但 `@iris-ui/vue/splits/table` 在 Vue 中不可用会破坏"四框架对齐"。这要求 codegen 工具统一生成所有框架的分片配置。
- **子路径 exports 的膨胀**。如果从"按功能模块分片"下沉到"按组件分片"，`exports` 字段将膨胀到 90+ 条（每个组件一条），可能触发某些打包器的 `exports` 处理瓶颈。折中方案：保持功能域分片（5–8 个分片），与 manifest 中的 `kind` 字段（primitive/layout/composite/admin）对齐。

**预期架构变更：**

```
packages/manifest/src/
├── dependency-graph.ts     # 新增：静态分析 import → 组件依赖图
├── split.ts                # 新增：依赖图 → 分片清单 + 验证无循环依赖

# 各框架 package.json
├── exports                 # 修改：新增 "./splits/table": "./dist/splits/table.js" 等
```

### 方向 D（优先级 4）：自适应运行时性能调节器

**为什么放在最后？**

不是因为不重要——而是在"组件密度飙升"（Token 系统带来的）和"AI 不可预测组合"到来之前，先解决前三个方向提供了更迫切的**功能完整性**。性能调节器是**安全网**，不是**功能缺口**。A → B → C 三个方向填补的是"多实例、多框架、多场景"的功能空白，而性能调节器优化的是"已有功能在资源受限时的表现"。

**但以下情况将改变这个优先级**：

1. 如果 playground 或 CMS demo 在真实低端设备（Moto G / 低端 ChromeBook）上的性能数据被量化采集，且验证了当前的静态 buffer 导致可见卡顿。
2. 如果 AI agent（如 pi）被用于批量生成 Iris UI 页面，用户反馈组合包含多个大 Table 时的真实 FPS 下降。

在此之前，`recommendedBuffer()` 和 `shouldReduceMotion()` 可以作为高级 API 设计，但不作为核心交付物。

**核心挑战：**

- **框架桥接的复杂性**。`shouldReduceMotion` 在 core 中判断，但 `IrisDialog` 的入场动画在各框架的实现方式不同（React CSS transition、Vue `<Transition>`、Svelte `transition:`）。让动画统一响应 governor 状态需要每个框架适配器将一个"禁用动画"信号映射为该框架的动画抑制机制。
- **Anti-flicker 设计**。如果 `recommendedBuffer()` 在两次渲染之间变化，虚拟滚动组件可能出现"跳一下"——用户感知为布局不稳定。需要 `lerp` 或 `smooth transition` 式的 buffer 平滑过渡。
- **性能检测的成本**。`mark`/`measure` 本身的开销不能超过它要检测的工作。在低端设备上，每帧运行 `performance.now()` 和 `requestAnimationFrame` 的埋点可能吃掉 2–3ms 帧预算。

**架构变更量级**：中低。核心新增 `performance-governor.ts`（约 200 行纯逻辑 + 测试），各适配器新增 governor 注入点。

---

## 3. 接口设计建议

### 关键设计原则

**原则 1：所有新增接口都必须满足"不为当前用户增加认知负担"**

Scope 协议提案中最容易犯的错误是：要求所有组件显式声明 `scope="..."`。这对简单场景（单个 Table，无协调需求）是噪音。方案：

```ts
// 好的设计：scope 是显式的，但可选；无 scope=无开销
<IrisTable />                    // 独立实例（行为不变）
<IrisTable scope="master" />     // 协调实例
<IrisTable scope="detail" />     // 同 scope 共享选中

// 更好的设计：scope 不只在组件 prop，更是一个 IrisProvider 级别的注册入口
<IrisProvider
  scopes={{
    selection: {
      "master-detail": { mode: 'single' }
    }
  }}
>
  <IrisTable scope="master-detail" />
  <IrisDetail scope="master-detail" />
</IrisProvider>
```

第二种方式的优点：scope 的配置集中化，组件只用声明"属于哪个 scope"，不用声明"scope 的行为是什么"（mode/initialValue 等）。缺点是增加了 `IrisProvider` 的肥胖风险——太多的"横向关注点"涌入 provider 层。建议将 scope 集中配置与插件系统合并：

```ts
// 合并到插件系统——scope 配置就是插件
createPlugin({
  name: 'master-detail',
  install(reg) {
    reg.registerScope('selection', 'master-detail', { mode: 'single' })
  },
})
```

**原则 2：抽象层不增加可观测性，就是债务**

新的抽象（ScopeRegistry、PerformanceGovernor、HydrationBoundary）必须满足：**可测试、可序列化（用于 SSR）、可 debug（日志/DevTools 可见）**。任何"新增抽象层但无法验证其是否正确工作"的设计都是坏设计。

| 抽象                | 可测试性                                                 | SSR 可序列化                        | Debug 可见                      |
| ------------------- | -------------------------------------------------------- | ----------------------------------- | ------------------------------- |
| ScopeRegistry       | ✅ 单元测试：注册→消费→销毁                              | ❌ Scope 通常只客户端（SSR 不协调） | ✅ scope 名称可在 DevTools 显示 |
| PerformanceGovernor | ⚠️ 需要 mock `performance.now` + `requestAnimationFrame` | ⚠️ SSR 中不需要性能调节             | ✅ `getRenderCounts()` 可导出   |
| HydrationBoundary   | ⚠️ 需要两阶段 SSR+CSR harness                            | ✅ 状态机是序列化的                 | ✅ `HydrationStatus` 可观测     |

**原则 3：codegen 是"脚手架 + 胶水"，不是"神奇的 AI 代码生成器"**

codegen 的接口温层必须精心设计，避免用户期望过高。

```
# 好的边界声明
pnpm codegen            # 交互式：选择组件名、类型、要生成的框架
pnpm codegen --list     # 列出所有可以生成的组件（从 manifest 读取待办清单）
pnpm codegen IrisCombobox  # 生成所有框架的骨架代码

# 不做
pnpm codegen --from-ai-prompt "一个带搜索的 Combobox"   # 这会模糊合约
```

codegen 输出的是**机械重复的部分**（文件结构、import/export、类型桩、store 连接骨架、简易测试模板）。**不生成**的是业务逻辑（搜索算法、键盘导航的细节、多选交互的完整实现）。

### 是否需要引入新的抽象层

| 方向      | 新抽象层                                 | 必要性                                  |
| --------- | ---------------------------------------- | --------------------------------------- |
| Codegen   | `TemplateEngine` + `FileWriter`          | ✅ 核心 — 管理多框架模板差异            |
| Scope     | `ScopeRegistry` + `ScopedController`     | ✅ 核心 — 实例协调的核心机制            |
| Hydration | `HydrationContext` + `HydrationBoundary` | ✅ 核心 — 框架无关的 hydration 感知     |
| Split     | `DependencyGraph` + `SplitConfig`        | ⚠️ 拓展 — 可内聚到 manifest 包          |
| Governor  | `PerformanceGovernor` + `FrameBudget`    | ⚠️ 拓展 — 可独立为 `@iris-ui/perf` 插件 |

**不需要**引入的抽象层：

1. **全局 Event Bus**。ScopeRegistry 的"共享实例"模式可以表达跨实例通信，不需要额外的 pub/sub 总线。Scope 内部使用已有的 store `subscribe` 机制。
2. **Plugin API 的再抽象**。现有的 `createPlugin`/`runPlugins` 足以表达 scope 注册和 hydration 策略注入。新增的部分（`registerScope`）作为 `PluginRegistrar` 的方法扩展即可。

### 向后兼容策略

| 方向          | 兼容策略                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Codegen**   | 纯新包，不修改现有组件。现有 360+ 文件不迁移，新组件才使用。通过 `--target` 参数可以逐渐将存量组件纳入 codegen 管理（但初期不建议）。 |
| **Scope**     | core 控制器的现有签名不变。`scope?: string` 是可选参数。无 scope 行为完全不变。组件 props 也同理：`scope` 是可选 prop，默认不存在。   |
| **Hydration** | `IrisProvider` 的 `hydrationRecovery` 默认 `'off'`。开启时才注入 hydration boundary 逻辑。                                            |
| **Split**     | 现有 `exports` 子路径不变，新增 `./splits/*` 子路径。用户可选择继续使用 `@iris-ui/react` 全量 barrel 或迁移到分片路径。               |
| **Governor**  | `IrisProvider` 的 `performanceGovernor` 默认 `undefined`（不做任何额外检测，性能零开销）。                                            |

---

## 4. 技术选型

### 新技术栈评估

| 方向                     | 建议技术选型                                                                                   | 备选方案                                              | 选择理由                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codegen                  | **模板函数**（TS 渲染函数，如 `renderReactComponent`）vs 纯模板引擎                            | Handlebars / EJS / AST transform（ts-morph / recast） | **选择模板函数**：Iris UI 的适配器代码模式高度结构化（import → 组件函数 → JSX/TSX → export），模板函数可以提供类型安全（`components: ComponentDef[] ⟶ string`），且不需要引入额外的模板语法。AST transform 更安全但成本过高（需要理解 4 种框架语法）。 |
| Scope registry           | **core 层 WeakMap-based 注册中心**，非全局单例                                                 | 全局 `Map<string, Controller>` / Symbol 注入          | **WeakMap** 确保 scope 实例不被泄漏——当 `IrisProvider` 卸载时，所有关联 scope 自动 GC。全局 Map 会泄漏。                                                                                                                                               |
| Performance detection    | `PerformanceObserver` + `requestAnimationFrame` 双路检测                                       | Web Workers / `LongTaskObserver`                      | **`requestAnimationFrame` 为主**，因为 `LongTaskObserver` 在移动端 Safari 支持不足。`PerformanceObserver`（`'measure'` 事件类型）辅助。成本低且框架无关。                                                                                              |
| Dependency graph（分片） | **静态 import 分析**（自定义简单解析器）                                                       | Webpack/rollup 插件（stats.json）                     | 内部工具，不需要全量 bundle stats。只需找出"组件 A 从哪个文件 import 了什么"即可。可以用 `@babel/parser` + 简单遍历，200 行以内。                                                                                                                      |
| SSR hydration            | **框架原生 API 的薄桥**（见上：`suppressHydrationWarning` / `<ClientOnly>` / `<NoHydration>`） | 自建 post-hydration reconciliation（不可行）          | 底层框架的 hydration 机制不可替换。Iris 只能 wrap，不能 replace。                                                                                                                                                                                      |

### 依赖引入的评估标准

新增依赖必须通过以下检查：

| 条件                      | 说明                                                                              | 例                                                   |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| ✅ **framework-agnostic** | 依赖不能依赖 React/Vue/Solid/Svelte                                               | `@babel/parser` ✅ / `astexplorer` ❌                |
| ✅ **tree-shakable**      | 导入什么带走什么，不含副作用                                                      | `@babel/parser` 仅用于 CLI，不进入运行时 bundle ✅   |
| ✅ **zero runtime cost**  | 运行时包不额外引入依赖                                                            | `PerformanceObserver` 是 Web API，零成本 ✅          |
| ✅ **SSR safe**           | 不依赖 `window`/`document`                                                        | 模板函数纯字符串处理 ✅                              |
| ⚠️ **bundle size budget** | codegen CLI 不受 size budget 约束（仅在开发环境），但运行时新增依赖会触发预算检查 | scope registry 在 core 包中，新增 50 行无外部依赖 ✅ |

**应避免的依赖类型**：

- `handlebars` / `ejs` — 引入新的模板语法，增加学习曲线，且与框架适配器的 TSX 不兼容。TS 模板字符串 + 辅助函数足够。
- `cuid` / `nanoid` — scope ID 不需要加密强度，`Symbol()` 即可。
- `rxjs` — scope 的事件传播直接用 store 的 `subscribe`，不需要响应式流库。这是 svjs 防退化的直接应用。

### 自建 vs 外部依赖

| 组件                 | 决策                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Codegen 模板引擎** | **自建**（~400 行 TS 渲染函数）。模式太固定（import → component → export），外部模板引擎需要适配三套不同的模板语法（JSX、Vue SFC、Svelte SFC），不如自建 4 个轻量渲染器。 |
| **性能检测**         | **自建**（依托 Web API `performance.now()` / `requestAnimationFrame() / PerformanceObserver`）。无可靠第三方。                                                            |
| **依赖图分析**       | **半自建**：`@babel/parser` 用于解析 + 简单遍历。不需要转译/转换，只提取 import 语句。不引入 `eslint`/`typescript-estree`（太重）。                                       |
| **Hydration 桥接**   | **框架原生 API 直接使用**。不引入任何第三方 hydration 库。                                                                                                                |

---

## 5. 实施路线图

### 优先级重排

**调整后的优先级矩阵**：

```
P0（立即启动，并行）
├── 📦 Manifest 驱动 Codegen     [2–3 周]  成本：★★★  价值：★★★★★
└── 🔄 跨实例协调协议              [1–2 周]  成本：★★    价值：★★★★★

P1（紧接着）
└── 🛟 通用 SSR 恢复系统          [2 周]    成本：★★★  价值：★★★★

P2（规划阶段）
├── 🧩 声明式组件分片              [1–2 周]  成本：★★    价值：★★★
└── ⚡ 自适应运行时性能调节器      [2 周]    成本：★★★  价值：★★★★
```

**调整理由**：

1. **Codegen + Scope 并行启动**（而非文档建议的串行"先 Codegen 再 Scope"）。两者服务于不同的"重复"维度（构建期 vs 运行时），并行开发不影响对方。代码的唯一依赖是 Scope 的 core 修改（新增 `scopeRegistry`）比 Codegen 的 core 修改（零修改——纯新包）多一些，但 scope 的 core 修改量极小（150–200 行），不是 Codegen 的阻塞依赖。

2. **SSR 恢复提到 P1**（与文档一致）。理由已在前述——AI 生成代码的 hydration 不匹配是一个"时间炸弹"，在 AI 生成页面的使用场景达到某个阈值后爆发。在爆发之前完成恢复系统，比爆发之后应急来得理智。

3. **性能调节器降级**（文档建议 P4，我认为合理）。但标注了一个**触发条件**：一旦有真实低端设备数据证明显性性能下降，上升至 P1。

### 阶段划分与里程碑

```
Phase 1（Week 1–2）：基础设施
├── M1.1  @iris-ui/codegen 包创建 + 模板引擎原型
│     ├── 支持 React 适配器骨架生成（单一框架验证）
│     ├── 支持从 manifest 读取组件清单 + 类型声明
│     └── 测试：生成 IrisButton（React）→ 通过 manifest 验证
│
├── M1.2  ScopeRegistry + SelectionModel scope 支持
│     ├── core/src/scope.ts 核心实现
│     ├── selection.ts 增加 scope 参数
│     └── 测试：两个 selection model 通过 scope 共享状态
│
└── M1.3  各框架 scope 桥接（react/vue/solid/svelte Context 注入）
      └── 测试：四框架各自验证<IrisTable scope="x">共享选中

Phase 2（Week 3–4）：扩展覆盖
├── M2.1  Codegen 多框架扩展
│     ├── Vue/Solid/Svelte 模板引擎
│     ├── Barrel 自动更新（index.ts + manifests）
│     ├── 测试模板生成（--all-frameworks 模式）
│     └── CLI 完善（--type, --subpath, --name）
│
├── M2.2  Expansion / DataSource / TabsNav 的 scope 支持
│     └── scope 协议覆盖所有 A 类控制器
│
└── M2.3  HydrationContext 核心实现
      ├── core/src/hydration.ts
      ├── React IrisHydrationBoundary
      └── 测试：hydration 不匹配场景 + 恢复验证

Phase 3（Week 5–6）：交付 + 文档
├── M3.1  Vue/Solid/Svelte HydrationBoundary
│     └── 每个框架的 hydration 恢复桥接完成
│
├── M3.2  manifest + DependencyGraph → 分片清单生成
│     └── 分片原型 + 一个框架的子路径验证（如 React：/table, /form, /overlay）
│
├── M3.3  PerformanceGovernor 原型
│     └── 基础帧检测 + recommendedBuffer 消费
│
└── M3.4  文档 + 示例 + 迁移指南
      ├── 如何使用 codegen（新组件开发流程）
      ├── 如何声明 scope 协调
      ├── SSR 恢复配置
      ├── 分片导入路径
      └── 性能调节器配置（dev 指南 + prod 建议）
```

### 风险点与缓解策略

| 风险                                                                                                                                                                              | 概率 | 影响 | 缓解                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Codegen 模板维护成本超过收益**。四框架模板各有差异，维护 4 套模板的工作量可能抵消节省的人力。                                                                                   | 中   | 高   | ● **严格差异化**：先对模板做 diff 分析，确认跨框架差异点不超过 15%（预期实际差异点 ~150 行中的 10–15 行）。如果差异率超过 20%，重新考虑 codegen 范围——改为"共享骨架+框架特异占位符"模式。<br>● **差异化清单必须文档化**：每次新增框架特异逻辑前，必须先更新占位符清单。 |
| **Scope 的跨框架 Context 语义不一致**。React Context 是"Provider 树"、Vue provide/inject 是"组件树"、Solid 是"Context 树"——但 Svelte 的 `setContext` 在不同 Svelte 版本行为不同。 | 高   | 中   | ● Scope registry 是**纯 core 实现**，不依赖框架 Context。框架 Context 只做"注册中心实例传递"。如果某框架的 Context 不适合，fallback 到手动 prop 透传。<br>● 测试覆盖：四框架的 scope 集成测试必须检查"卸载重建后 scope 状态是否保留"。                                  |
| **SSR 恢复系统被框架升级打破**。React 19→20 的 hydration API 可能变化。Svelte 5→6 的 `$state` runes 可能改变。                                                                    | 中   | 高   | ● **IrisHydrationBoundary** 设计时考虑版本兼容：内部版本检测 + 备选策略。每个框架适配器包维护 `hydration-bridge.ts` 文件，内聚所有框架版本依赖。<br>● 每次框架发布，CI 快速检查 hydration 测试。                                                                        |
| **PerformanceGovernor 的 `mark`/`measure` 被过度使用**。组件开发者滥用 governor 做性能埋点，污染帧预算。                                                                          | 低   | 中   | ● **`mark` 仅在 development/build 模式下生效**（类似 `__DEV__` 标记）。production 下 `mark` 是空函数，零开销。<br>● 在 DevTools 插件中提供"启用 performance mark"开关。                                                                                                 |
| **分片协议导致 `exports` 字段膨胀，打包器性能退化**。90+ 组件 × 4 框架 = 360+ 子路径。                                                                                            | 低   | 低   | ● **不上组件级分片，上功能域分片**（5–8 个 vs 90 个）。以 manifest 的 `kind` 字段为基础（primitive/layout/composite/admin），保证每个分片 15–25 个组件，粒度适中。<br>● `exports` 的生成由 `pnpm gen:split` 自动化，不手动维护。                                        |

### 未尽决策（依赖维护者）

1. **Codegen 的"侵入性"边界**：是否允许 codegen 修改已存在的组件文件（如新增 scope 参数后自动更新组件的类型声明）？还是 codegen 只负责**新建文件**，**绝不动已有代码**？我建议后者——"不修改已存在文件"的约束让 codegen 的 contract 更清晰。但如果 codegen 不能修改 barrel，每次生成后需要手动 `pnpm gen:manifest` 更新清单——这可以接受，因为 `pnpm gen:manifest` 已经是现有工作流。

2. **Scope 的生命周期事件**：是否引入 `scope.on('destroy', ...)` 或 `scope.on('instance-join', ...)` 事件？这增加了协议的表达力，也增加了实现复杂度。我建议**暂时不做**——初始版本只要求"声明式共享"，不要求"声明式事件监听"。如果后续有"第三个 Table 挂载时自动更新第一列"的场景，可以引入 scope 事件。

3. **Scope 是否进入插件系统**：`reg.registerScope` 在 `PluginRegistrar` 中是好的抽象，但 scope 的核心消费者是**框架适配器**（负责将 scope ID 映射为 shared 实例）。如果 scope 完全在插件中声明，而插件通过 `install` 注册 scope，框架适配器在渲染 `<IrisTable scope="xxx">` 时从插件 store 中读取已注册的 scope——这种间接性是否值得？我倾向"scope 注册 = provider 配置"，因为 scope 是应用级配置，和 locale/theme 同层级，不应该是插件概念。

---

## 总结与个人判断

**这个文档提出的五个方向填补了 Iris UI 架构的一个明确的空白：从"单实例静态声明"迈向"多实例动态编排"。**

文档中令我印象最深刻的"看不见的洞察"是：**manifest 目前是一个"只读"的基础设施——它知道一切，但什么都不做**。codegen 和分片协议本质上是让 manifest 从"扫描器"进化到"编译器"——它不再只是回答问题（"组件清单是什么？"），而是驱动作业（"基于清单，生成组件/配置分片"）。

**最让我担心的是 scope 方向的风险**。不是技术风险，而是**设计风险**：scope 很容易被过度设计。如果 scope 协议最终变成"小型的 IoC 容器"（注册、依赖注入、生命周期管理、事件总线……），它就违背了 Iris 的"svjs 北极星"原则——**"下沉若让消费 API 变复杂，就不要下沉"**。一个 scope 的 API 应该简单到极致：

```
<IrisTable scope="a" /> + <IrisTable scope="a" /> = 共享选中
```

仅此而已。任何需要阅读文档超过 30 秒才能理解的 scope 语义都是失败的。

**关于实施节奏，我的核心建议是：**

1. Codegen 和 Scope 在**同一迭代**启动，不要一个做完再做另一个。它们是互补的（构建期效率 vs 运行时协调），不是互斥的。
2. SSR 恢复在**第一个 AI 生成页面进入生产环境之前**完成。这是真正的时间线压力——不是 "2 周内做完"，而是 "AI 用户遇到闪烁之前做完"。
3. 性能调节器和分片协议可以留在路线图上，标注触发条件，不必急于实现。它们解决的是"你可能会有问题"而非"你现在就有问题"。
