现在我已全面掌握项目架构与现有的分析图景。以下是综合性的架构分析。

---

# 架构分析：Iris UI — 扩展方向与架构债务

> **分析角色**：资深架构师  
> **依据**：项目 `AGENTS.md`（核心架构文档）+ 全库源码遍历 + 现有 ~200 份分析文档 + 两份最新的综合扫描（`tech-lead-analysis-5-high-value-extensions` / `global-scan-5-high-value-extension-directions`）  
> **分析方法**：在已有分析的基础上提取**跨文档共识**，识别**分析盲区**，并对项目的架构健康状况作**系统性评估**。

---

## 1. 架构评估

### 1.1 当前架构的优势

| 维度               | 优势                                                               | 评注                                                      |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------- |
| **分层架构清晰度** | Layer 0-4 分层 + Behaviors + 插件系统，职责边界明确                | `AGENTS.md` 的四层模型是项目的架构锚点                    |
| **跨框架对齐能力** | 149 组件 × 4 框架，同名同语义导出；子路径 exports 一致             | 这是业界罕见的工程成就，验证了「core 薄桥」模式的可扩展性 |
| **SSR 安全意识**   | `useId` / `'use client'` / `renderToString` 测试 / 无 DOM 测试覆盖 | 从架构的第一天就考虑了 SSR                                |
| **Token 杠杆效应** | 30 token vs 800 行裸 HTML/CSS（93%+ 节省）                         | 主题系统的投入回报率极高                                  |
| **AI 原生设计**    | `manifest.json` + `llms.txt` + 声明式 props + MCP 工具             | 在 UI 框架中具有前瞻性                                    |
| **测试成熟度**     | ~1500 测试 + 四道质量门 + size 预算 + ax + RSC + bench             | 测试基础设施完备                                          |
| **A/B/C 下沉分类** | 核心心智模型清晰：A=身份/B=附加/C=纯材料                           | 降低了「新逻辑放哪里」的决策成本                          |

### 1.2 架构债务与系统性不足

以下不是零散 bug，而是**架构层面的系统性缺口**：

#### 债务 A：数据层存在「能力断层」

可以观察到项目在**数据路径**上存在一个架构缺口：

- 已有 **过滤/排序/分页**（`data-view`）→ 纯函数
- 已有 **数据源**（`data-source`）→ 带 epoch 竞态防护
- 已有 **资源控制器**（`resource`）→ 带 optimistic rollback
- **但无：** 请求缓存 · SWR 模式 · 去重 · 重试策略 · 缓存失效

第 1 层到第 3 层是 A 类逻辑（自动在场），但第 4 层是 B 类（不用不进包）。问题是：**所有消费 data-source 的组件都缺失缓存能力**，且消费者没有简单的 opt-in 方式。这形成了一个架构缺口——生产级 CRUD 必须的缓存层不存在。

**影响**：CMS demo 和 plugin-pro-table 在真实 API 场景下，快速翻页产生 N 倍重复请求、切回已访问页重新 fetch、网络失败无重试。

#### 债务 B：浮层系统「无动画无 Presence」

已检查的 Dialog/Drawer/Popover/Tooltip 全部零入场/出场动画：

- `usePrefersReducedMotion` 存在但零消费
- 关闭时立即 `unmount` → 退出动画不可能播放
- 四个框架均无 `IrisPresence` 等效包装器

**影响**：拥有 150+ 组件的框架，核心浮层无动画——视觉一致性的声誉风险。

#### 债务 C：Behavior 系统「名义正交，实际冲突」

6 个 Behaviors（Resizable/Movable/Hotkey/ClickOutside/Sortable/LongPress）各自独立绑定 `document` 的 pointer events，无协调层：

- Movable 嵌套 Resizable → 两个拖拽行为冲突
- Movable 内嵌 ClickOutside → 拖动时触发 `onOutside`
- 无嵌套优先级语义（内层应优先）
- 触控设备完全未考虑（16+ 处 `touchAction: 'none'`）

**影响**：Desktop OS（窗口管理器 = Movable + Resizable + 多窗口编排）是 Behaviors 最核心的使用场景，但当前 Behaviors 不支持正交组合。

#### 债务 D：壳层代码重复（4×6500 行）

四 Desktop OS Shell 各自实现了一套几乎相同的窗口管理器、remote app loader、OS chrome、bridge 系统。`remoteApp.ts` 四壳完全相同（44 行），`depth.ts` 95% 相同。但无共享 SDK。

**影响**：任一功能改进需要在 4 壳中独立实施，维护成本 ×4；功能不对称（Solid 壳有 Terminal/AppStore，其他三壳没有）将持续恶化。

#### 债务 E：分析文档的「信号-噪声比」危机

~200 份分析文档（累计 ~1000+ 方向关键词）→ 信号极度稀疏。`.out.md` dedup 文件的存在说明团队已知此问题，但文件中仍存在大量重复（如「Solid Tree `loadChildren`」至少出现在 3 份独立分析中）。**分析本身的架构缺失了 — 缺少分析治理**。

---

## 2. 扩展方向

### 方向 A（P0）：数据层缓存 / SWR / 去重协议

**为什么需要**：生产级 CRUD 的阻塞项。`data-source` 的 epoch 竞态防护已解决并发写入，但未解决重复请求、缓存复用、网络故障恢复。

**核心挑战**：

- Cache key 的序列化共识（`JSON.stringify(query)` 在非原始值时不稳定）
- SWR 的 stale-while-revalidate 时序——旧数据显示期间用户可能做出的修改与后台新数据冲突
- LRU 的容量策略（多少缓存条目？基于行数还是字节数？）
- 全局单例 vs 本地实例——多租户场景缓存隔离

**架构变更**：

```
DataSourceConfig 新增:
  cacheStrategy: 'none' | 'swr' | 'cache-first'  (default 'swr')
  cacheKey: (query) => string
  retry: { maxRetries: 3, backoffMs: 1000, retryOn: (error) => boolean }
  dedupeWindowMs: 300

core 层新增 DataSourceCache（LRU Map）
  + 引用计数 GC — 组件卸载后 TTL 过期
  + 不引入外部依赖（纯 Map + 定时器）
```

**对现有系统的影响**：向后兼容（`cacheStrategy: 'none'` 为默认，行为与当前完全一致）。只新增 opt-in 配置。

### 方向 B（P0）：插件 SSR 声明协议

**为什么需要**：npm 发布前的阻塞项。当前 13 个插件无任何 SSR 声明——IrisProvider SSR 模式无 fallback、无 SSR 兼容性标记。在生产级 Next.js/Nuxt/SolidStart/SvelteKit 应用中，插件 SSR 断裂是硬错误。

**核心挑战**：

- 每个 client-only 组件的 fallback 要求不同（CodeMirror → 代码块静默显示；Chart → loading 骨架；Kanban → 静态列表）
- 四框架 SSR 机制不同（'use client' / ClientOnly / NoHydration / csr prop）
- 插件作者需要在不了解框架 SSR 细节的情况下声明兼容性

**架构变更**：

```
PluginRegistry 扩展：
  registerSsrComponent(name, component)   // 可 SSR，无需 fallback
  registerClientOnly(name, fallback?)        // 需客户端，可选 SSR fallback

IrisProvider 扩展：
  ssr?: boolean  (自动检测 `typeof window`)
  SSR 模式下: 跳过 useEffect token 应用, store 惰化
  client-only 组件 → 渲染 fallback 或 <div data-iris-ssr-placeholder />

成本预估：core ~50 行 + 四框架桥 ~150 行 + 13 插件审计 ~6h
```

### 方向 C（P1）：组合安全治理（Composition Contract）

**为什么需要**：组件规模达 350+（含插件），嵌套规则日益复杂。当前 Dialog→Popover 非法嵌套只在运行时抛出 cryptic 错误——无静态分析、无 dev 警告、无 AI 工具集成。

**核心挑战**：

- 组件名获取跨框架不一致（React `displayName` vs Vue `__name` vs Solid `name` vs Svelte `component.name`）
- 被 HOC/memo/forwardRef 包裹后组件名丢失
- 跨框架无法检测（React 组件树中嵌入 Vue 微前端）
- 假阳性风险（合法但非常规组合被误报）

**架构变更**：

```
core 层:
  CompositionContract 类型: { componentName, allowedChildren[], forbiddenAncestors[], requiredContexts[], ssrSafe }
  registerContract/getContract/validateComposition

适配器层:
  withCompositionGuard(Component, contract) — HOC / composable / directive
  Dev 模式: mount 时调用 validateMount + console.warn
  Prod 路径: process.env.NODE_ENV guard → 零开销

CI:
  合同测试生成器 → 28 组件 × 合法+非法组合
  MCP validateUsage(snippet) — 静态分析 JSX 检测违规
```

### 方向 D（P1）：Desktop OS 壳共享 SDK（`@iris-ui/desktop`）

**为什么需要**：代码重复导致维护成本 ×4。纯几何函数（depth.ts）、remote app loader（remoteApp.ts）、OS chrome 定义（barInsets、snapGeometry）全部为框架无关逻辑——应下沉到共享包。

**核心挑战**：

- 四壳已有差异积累——下沉前需逐文件 `diff` 选最优版
- 壳间的功能不对称需要补缺
- 包名冲突（检查是否有已有 `@iris-ui/desktop`）
- 不要下沉 UI 组件（V1 只下沉纯逻辑）

**架构变更**：

```
新建 @iris-ui/desktop 包:
  geometry.ts     — snapGeometry, barInsets, windowLayout, 蛇形走位 (纯函数)
  remote-app.ts   — loadRemoteApp, RemoteAppModule, RemoteImporter
  catalog.ts      — AppManifest, AppCategory, getDefaultApps, createCatalog
  chrome.ts       — OsChrome 类型 + macOS/Windows11/ChromeOS 预置
  bridges/        — createPermissionsBridge, createClipboardBridge, etc.

四壳: import 替换本地副本, 移除 ~2000 行/壳
```

### 方向 E（P2）：统一动画 / Presence 原语

**为什么需要**：150+ 组件的 UI 框架，核心浮层无入场/出场动画，视觉质量与市场竞争力的差距。`prefers-reduced-motion` 存在但不被消费——检测能力与消费之间断裂。

**核心挑战**：

- 四框架 Presence 模式各不相同（React `AnimatePresence`、Vue `<Transition>`、Solid `<Transition>`、Svelte `transition:`）
- 退出动画要求 DOM 保持（条件渲染时提供 `onExit` callback）
- 布局动画（FLIP）与虚拟化冲突——虚拟化的 DOM 回收后 FLIP 没有参考点
- 自定义动画 vs 预设动画——框架应提供预设（fade/scale/slide）但允许覆盖

**架构变更**：

```
core 层:
  createPresence() → Store<'entering'|'entered'|'exiting'|'exited'>
    + onEnter/onExit/onAfterEnter/onAfterExit
    + reducedMotion 短路

适配器层:
  React: <IrisPresence> → useSyncExternalStore + useEffect
  Vue: <IrisPresence> → v-if + Transition 桥
  Solid: <IrisPresence> → Show + createEffect
  Svelte: <IrisPresence> → {#if} + transition: 指令

组件集成:
  IrisDialogContent 包裹 <IrisPresence> → entering: opacity 0→1, exiting: opacity 1→0
  IrisToastViewport 使用 Presence + auto-dismiss machine
```

---

## 3. 接口设计建议

### 3.1 核心设计原则

| 原则                               | 说明                                                                            | 违反例                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **新增永远是 opt-in，非 breaking** | 所有现有组件的 API 不变；新能力通过新增 prop 或新组件暴露                       | 若 cache 层改名 dataSourceConfig 现有字段（如 `immediate`），必须保留别名 |
| **类型优先于配置**                 | 用泛型约束而非运行时校验；`cacheKey: (query) => string` 优于 `cacheKey: string` | `CompositionContract` 应在 TS 类型中定义合法组合，不在运行时推断          |
| **核心零框架依赖**                 | `grep -rE "from '(vue\|react\|solid\|svelte)'" packages/core/src/` 必须为空     | Desktop SDK 的 `OsChrome` 类型必须纯 TS                                   |
| **桥接层不做逻辑决策**             | 四框架桥仅做「渲染 + 订阅」，不做「当 X 时怎么办」的判断                        | SSR 模式中 `isSsr` 判断在 core 完成，桥只读取 flag                        |
| **A 自动在场，B 按需接入**         | 缓存/AI 组合验证等 B 类能力走 opt-in 或插件                                     | `cacheStrategy: 'none'` 为默认，保留当前行为                              |

### 3.2 具体接口建议

**数据层缓存**：

```
// 不修改现有 DataSourceConfig 接口，通过高阶函数扩展
const ds = createDataSource(fetcher, {
  cache: { strategy: 'swr', key: (q) => JSON.stringify(q) }
})
// 或保持 DataSourceConfig 新增可选 cache 字段（推荐）
```

选择理由：高阶函数的 tree-shaking 更好，但 `DataSourceConfig` 扩展更符合项目「每个状态都有 prop」的模式。建议用后者。

**插件 SSR**：

```
// PluginRegistry 的扩展是加法——不影响现有插件
registerSsrComponent(name, component)
registerClientOnly(name, fallback?)  // fallback 可选——默认 <div data-iris-ssr-placeholder />
```

**组合契约**：

```
// 以数据驱动而非代码生成——契约是 JSON 可序列化的
const dialogContract: ComponentCompositionContract = {
  componentName: 'IrisDialog',
  forbiddenAncestors: ['IrisPopover', 'IrisDialog', 'IrisDrawer'],
  allowedChildren: ['IrisDialogContent', 'IrisDialogHeader', 'IrisDialogBody', 'IrisDialogFooter'],
}
registerContract(dialogContract)
```

选择理由：在 DevTools 中可查看、在 MCP 中可消费、在 CI 中可验证。

### 3.3 向后兼容策略

| 变更类型        | 兼容策略                               | 示例                                                                 |
| --------------- | -------------------------------------- | -------------------------------------------------------------------- |
| 新增 prop       | 默认值与当前行为一致                   | `cacheStrategy: 'none'`                                              |
| 新增 store 方法 | 不修改现有方法签名                     | `createCrossTabSync` 是新函数，非 `createStore` 重载                 |
| 重构（壳下沉）  | 旧文件保留为 alias，标注 `@deprecated` | 四壳本地 `depth.ts` 改为 `export * from '@iris-ui/desktop/geometry'` |
| 框架桥扩展      | 新 HOC/composable 与现有组件不冲突     | `withCompositionGuard` 是可选包装，非强制                            |

---

## 4. 技术选型

### 4.1 需要引入的新技术栈

| 能力              | 推荐方案                                 | 备选                  | 理由                                                                |
| ----------------- | ---------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| 视觉回归测试      | Playwright + pixelmatch（Manifest 驱动） | Storybook + Chromatic | 项目中无 Storybook——引入会增加维护成本。Manifest 已知道所有组件路径 |
| 动画/过渡         | 自建（基于 core `createPresence`）       | framer-motion / GSAP  | 四框架需要统一 API，外部库无法跨框架一致                            |
| WASM 加速（未来） | 不引入（V1）                             | —                     | 当前性能瓶颈不在 WASM，在缺少缓存和 memoize                         |
| 基准测试          | Vitest bench (built-in)                  | Benchmark.js          | 已有 Vitest 体系，零额外依赖                                        |

### 4.2 第三方依赖的评估标准

结合项目当前依赖和架构原则，评估新依赖的标准：

| 标准              | 说明                                      | 容忍度      |
| ----------------- | ----------------------------------------- | ----------- |
| **零框架耦合**    | 不依赖 React/Vue/Solid/Svelte             | ❌ 不能接受 |
| **类型安全**      | 提供完备的 TypeScript 类型                | ❌ 不能接受 |
| **tree-shakable** | 可按需 import 不增加整体包体积            | ⚠️ 必要     |
| **SSR 兼容**      | 在 Node.js 中可用（或提供 noop fallback） | ❌ 不能接受 |
| **无副作用**      | 不在 import 时执行全局代码                | ❌ 不能接受 |
| **许可**          | MIT/Apache 2.0                            | ❌ 不能接受 |
| **维护活跃**      | 最近 1 年有提交 + 有 semver 发布          | ⚠️ 建议     |

**现有依赖中需要缓入的**：`@floating-ui/dom`、`standard-schema` 是合理的；不需要为动画引入 framer-motion（太重量级且框架耦合）。

### 4.3 自建 vs 采购的决策

| 能力          | 决策                      | 理由                                                                                     |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 数据层缓存    | **自建**                  | LRU Map + SWR 逻辑约 200 行 core 纯函数，无状态管理库可跨框架一致                        |
| 动画 Presence | **自建**                  | 四框架统一抽象必须自建；框架原生方案（Vue Transition / Svelte transition）可在桥接层消费 |
| 手势系统      | **自建**                  | 现有 touchAction 集中+现有长按状态机可复用；外部 DnD 库无法跨框架                        |
| 视觉回归      | **Playwright + 自定脚本** | 自建 demo page 生成器（利用 manifest）+ 截图 + pixelmatch                                |
| 跨标签页同步  | **自建**                  | `BroadcastChannel` 是标准 API；三层降级方案简单可控                                      |

**总判断**：所有扩展方向**均不需要引入新的外部依赖**。全部在现有技术栈内完成——这是架构健康的信号。

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级 | 方向               | 成本（人天） |          依赖          |         业务价值         |   技术紧迫性    |
| :----: | ------------------ | :----------: | :--------------------: | :----------------------: | :-------------: |
| **P0** | ④ 插件 SSR 协议    |     ~4.5     |           无           |      npm 发布阻塞项      |   🔴 **阻塞**   |
| **P0** | ① 数据层缓存/SWR   |      ~5      |           无           |     生产级 CRUD 必须     | 🟡 **能力缺口** |
| **P1** | ⑤ 组合安全治理     |      ~8      |           无           | AI 原生差异化 + 质量基建 |     🟡 中等     |
| **P1** | ② 壳共享 SDK       |      ~6      |           无           |      维护成本 ×4→×1      |     🟡 中等     |
| **P2** | ③ 统一手势系统     |     ~8.5     | 方向③C（Behavior协调） |  Desktop OS 多窗口拖放   |     🟢 增量     |
| **P2** | ⑥ 动画/Presence    |     ~10      |      浮层组件框架      |      视觉质量入场券      |     🟢 增量     |
| **P2** | Core：分组数据视图 |      ~3      |           无           |      Table 功能补齐      |     🟢 增量     |

**建议的初始聚焦（前三 Sprint）**：

|    Sprint    | 焦点     |     方向      | 关键产出                                                                    |
| :----------: | -------- | :-----------: | --------------------------------------------------------------------------- |
| **Sprint 1** | 发布阻塞 | ④ + 已有 bug  | 插件 SSR 声明 + 13 插件审计 + Solid Tree `loadChildren` + schema 多错误修复 |
| **Sprint 2** | 核心能力 |     ① + ⑤     | 数据层缓存 + CompositionContract + 28 组件填充                              |
| **Sprint 3** | 架构清理 | ② + ⑥（暂缓） | `@iris-ui/desktop` V1 + 壳瘦身                                              |

### 5.2 阶段划分

```
Phase 0 — 发布就绪（2 周）
├── T-001: PluginRegistry SSR 接口扩展 (~2d)
├── T-002: 13 插件 SSR 审计 (~3d, 可并行)
├── T-003: IrisProvider SSR 模式 + 四框架桥 (~3d)
├── T-004: Solid Tree loadChildren 修复合入 (~0.5d, 立即)
├── T-005: standardSchemaValidator 多错误修复合入 (~0.5d, 立即)
└── T-006: clientDataSource memoize 优化合入 (~0.5d, 立即)

Phase 1 — 能力补齐（3 周）
├── T-007: DataSourceCache LRU + SWR + retry (~4d)
├── T-008: CompositionContract 数据层 (~3d)
├── T-009: 28 组件契约填充 + 运行时检测 (~4d)
├── T-010: withCompositionGuard 四框架桥 (~2d)
└── T-011: CI 合同测试生成器 ~ MCP (~2d)

Phase 2 — 架构清理（2 周）
├── T-012: @iris-ui/desktop 包脚手架 (~1d)
├── T-013: depth.ts + remoteApp.ts 下沉 (~2d)
├── T-014: catalog.ts + chrome.ts 下沉 (~2d)
├── T-015: Bridges 工厂下沉 (~2d)
└── T-016: 四壳瘦身验证 (~2d)

Phase 3 — 增量体验（3 周，资源允许）
├── T-017: createPresence + IrisPresence 四桥 (~5d)
├── T-018: 浮层组件动画集成 + reducedMotion 消费 (~4d)
├── T-019: createGestureCoordinator (~4d)
└── T-020: Behaviors 迁移到协调器 (~3d)
```

### 5.3 风险缓解

| 风险                                         | 等级  | 阶段 | 缓解策略                                                                                  |
| -------------------------------------------- | :---: | :--: | ----------------------------------------------------------------------------------------- |
| 插件 SSR 审计遗漏（13 插件 × 52 适配器文件） | 🟡 中 |  P0  | 审计脚本自动化：检查每个插件出口是否有 `'use client'` 或 SSR fallback；批量修改而非逐文件 |
| 缓存策略选择错误（SWR 时序冲突）             | 🟢 低 |  P1  | V1 只做 `cache-first` + `cache-first-with-revalidation`；SWR 标记为 V2                    |
| 壳下沉破坏现有壳功能                         | 🔴 高 |  P2  | 每下沉一个文件：冻结四壳当前 git commit → 下沉 → 全壳 `pnpm build` + 启动测试             |
| 组合契约数据量过大（28 组件 → 膨胀）         | 🟢 低 |  P1  | 契约在 build 时从 core 包中导出，不打包到产物；Dev 模式只读                               |
| 四框架动画行为不一致                         | 🟡 中 |  P3  | Presence 状态机在 core 层统一调度；适配器只做 DOM 映射；单测覆盖所有状态转换              |

### 5.4 质量门增强建议

| 现有门                                     | 扩展建议                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `pnpm turbo run test typecheck lint build` | 新增：`composition:test`（28 组件组合契约）+ `ssr:plugin`（13 插件 SSR 烟雾）  |
| `pnpm size`                                | 新增：`@iris-ui/desktop` 预算 + core + 4KB（缓存+契约+SSR）                    |
| `pnpm check:rsc`                           | 扩展：检查 client-only 插件在 SSR 构建产物中无 `document` 引用                 |
| `pnpm format:check`                        | 不变                                                                           |
| 新建议：**`pnpm check:parity`**            | 扫描四框架 Tree/Table 等组件的 API surface 是否一致——从 manifest 生成          |
| 新建议：**分析治理门**                     | `docs/requirements/` 新增分析文档时自动合并到 `.out.md` 去重文件，防止方向重复 |

---

## 总结：架构健康度雷达

| 维度             | 评分  | 关键观察                                 |
| ---------------- | :---: | ---------------------------------------- |
| **分层清晰度**   | ★★★★★ | Layer 0-4 + Behaviors + 插件，边界明确   |
| **跨框架一致性** | ★★★★★ | 149 组件 × 4 框架对齐，业界罕见          |
| **SSR 安全性**   | ★★★★☆ | 核心组件已覆盖，插件层缺失               |
| **数据层成熟度** | ★★☆☆☆ | 有竞态防护但无缓存/SWR/重试              |
| **视觉一致性**   | ★★★☆☆ | 无视觉回归测试；浮层无动画               |
| **组合安全**     | ★★☆☆☆ | 有缺失祖先检查，无非法组合验证           |
| **代码复用度**   | ★★★☆☆ | 壳层 4×6500 重复；core 复用优秀          |
| **测试覆盖**     | ★★★★☆ | ~1500 测试，但缺少视觉+合同测试          |
| **分析治理**     | ★☆☆☆☆ | ~200 份重复分析，无去重机制              |
| **AI 原生能力**  | ★★★★★ | Manifest + llms.txt + MCP + 声明式 props |

**架构总评**：Iris UI 拥有业界领先的跨框架对齐能力和清晰的分层架构。核心架构决策（逻辑下沉、Token 杠杆、插件契约）正确且已充分验证。**主要债务集中在数据层缓存缺失、浮层动画空白、壳层代码重复、分析文档治理缺失**四个领域。其中，插件 SSR 协议是 npm 发布的唯一阻塞项，应作为 P0 优先处理。
