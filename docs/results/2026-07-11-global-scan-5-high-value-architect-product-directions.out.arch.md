# 架构分析报告：Iris UI 五方向验证结果审视

> **分析日期**：2026-07-12  
> **角色**：资深架构师  
> **范围**：基于验证报告 5 方向的源码真实性交叉确认，结合全库架构扫描  
> **方法**：源码阅读 + 已有分析文档交叉索引 + 架构债务与技术债评估

---

## 1. 架构评估

### 1.1 当前架构的优势

Iris UI 的架构设计在 UI 基础设施类项目中属于**高水平**。几个关键设计决策值得肯定：

| 优势                          | 证据                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core 逻辑下沉原则严格执行** | `createSelectionModel`、`createExpansion`、`createAdminShell` 等 A 类控制器全部在 core，适配器是薄桥。`grep -rE "from '(vue\|react\|solid\|svelte)'" packages/core/src` 为空 |
| **插件系统契约干净**          | `createPlugin` 只做加法（registerTokens/registerMessages/registerStore），不做动态注册组件。避免类型丢失和 tree-shaking 破坏                                                 |
| **Store 的 batch 语义**       | `batchDepth` + `pendingFlush` 模式正确实现了单 store 的写入合并。这是正确的底层原语                                                                                          |
| **四框架对齐的工程纪律**      | manifest 实测 149 组件全部 4 框架对齐，同名同语义。这是极罕见的工程成就                                                                                                      |
| **渐进式复杂度**              | 从 Button 起步到完整 Admin Shell + 插件系统，每层可选接入                                                                                                                    |

### 1.2 架构债务与技术债

验证报告揭示的 5 个方向暴露了三层不同深度的架构债务：

#### 第一层：**表面不一致性**（修复成本低，但侵蚀开发者体验）

| 债务                                                                                                                                    | 严重度                                                                                                                                      | 修复成本                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Svelte 导出命名偏离约定**：`toMachine`/`toStore` vs `useMachine`/`useStore`                                                           | **中** — 心智模型断裂。开发者从 React/Vue/Solid 迁移到 Svelte 时需要学习第二套命名；文件 `useStore.ts` 但导出 `toStore`，文件名与导出不一致 | ~15 分钟（改名导出，别名兼容旧导出） |
| **Vue `primitives/floating/` 目录偏移**：Vue 在 `primitives/floating/` 而其他三框架在 `floating/`                                       | **低** — 不影响运行，但影响：① manifest 扫描器路径一致性；② AI 代码补全的路径预测；③ 新开发者"为什么 Vue 不同"的认知开销                    | ~5 分钟（移动目录，更新 barrel）     |
| **4 个 CMS 的 `STORAGE_KEY` 碎片化**：`iris-cms-session`, `iris-cms-react-session`, `iris-cms-solid-session`, `iris-cms-svelte-session` | **低** — 仅影响 localStorage 命名空间。但在生产场景中，如果 CMS 切换框架部署（理论上不会），用户登录状态会丢失                              | ~5 分钟（统一 key 或干脆下沉 auth）  |

#### 第二层：**架构侵蚀**（修复成本中，损害长期可维护性）

| 债务                                                                                | 严重度                                                                                                                                                                                                 | 修复成本                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **CMS 四倍体重复（auth/skin/desktopBridge/notifications/menus/tabs）**              | **高** — 方向三（即使已被已有分析覆盖）是实质最严重的架构债务。62 个源文件跨 4 应用，核心逻辑高度重合但各框架自实现。bug fix 需同步 4 次，漂移风险使得 4 个 CMS 随时间推移从"行为相同"退化为"行为相近" | 中高 — 需下沉 `createAdminApp` 到 core + 适配器薄桥。但涉及应用的框架特有代码（JSX/Svelte template）不能简单共享 |
| **`derived.batch()` 无合并**：`onSourceChange` 直接遍历通知，不走 `batchDepth` 管道 | **高** — 虽然注释自述"derived 没有自己的写操作要合并"，但在复合控制器场景中（form validation 依赖多个 field store），一次变更触发 N 个派生 → N 次独立通知 → N 次框架响应式更新。这是经典的反应式瀑布   | 中 — 需要为 `derived` 引入 `notificationDepth` 或 `MicrotaskQueue` 合并机制                                      |

#### 第三层：**性能基线缺失**（修复成本高，损害可信度）

| 债务                                                                                                                                                                                        | 严重度                                                                                                                                                 | 修复成本                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **`applyTheme` JS 计算管线无缓存**：`mixOver` 每次调用都执行 `hexToRgba`→`rgbToHex` 完整管线。当前基线 50-60 条不可见，但插件注册 30+ 组自定义 token 后可放大到 300+ 条，每次主题切换都重算 | **中** — 虽然当前 Size 不影响 UX（50 hex 混合 ≈ 0.5ms），但无缓存的设计意味着每一个插件/皮肤/主题切换都要重算所有 subtle variant。这是可预见的规模瓶颈 | 低 — 为 `mixOver` 加 WeakMap<`colorHex+bgHex+weight`, `string`> 缓存，约 20 行 |
| **Store 系统（含 derived）零性能基准**：全库仅 1 个 `scale.bench.ts`，只测 store 创建。derived 连锁更新、batch 嵌套、多订阅者场景无任何数字                                                 | **高** — 没有基线就没有回归检测。团队宣称的"四框架行为一致"无法验证其在 1000+ 组件实例下的性能。这是一个盲飞风险                                       | 中 — 增加 5-8 个针对性 bench 场景 + CI 门禁                                    |

### 1.3 验证报告本身的质量评估

验证报告对 5 个方向的源码真实性确认是**严谨的**，但其 novelty 评估存在一个实质问题和一个统计问题：

**实质问题 — 方向三（CMS 架构违规）**：该文档将其标为"新方向"，但已有分析 `2026-07-10-genuine-architectural-product-gaps-senior-scan.md` 的方向一已经以完整篇幅覆盖。这不是增量而是重复。验证报告自己的交叉索引确认了这一点（"❌ 已被完整篇幅覆盖"），但仍然将其列为"5 方向"之一。建议：移除该方向或明确标注为"已有方向延伸"。

**统计问题 — 方向一数值夸大**：报告称"300+ token 条目"，但源码确认当前基线为 ~50-60 条。虽然报告正文中标注了"带 30+ 各注册 10-20 token 的插件时"前缀，但这个数值出现在摘要/标题中会给读者留下"当前表现已经很差"的印象。建议修正为 "~50-60 基线，插件放大可达 300+"。

---

## 2. 扩展方向

基于上述架构评估，以下 5 个方向按**真实业务/技术价值**排序，而非按"是否已有分析提及"排序。

### 方向 A（P0）：🎯 Core Store `derived` 通知合并 — 响应式性能地基

**为什么需要**：`derived.batch()` 当前 inline 运行不做合并，这是四框架共享 core 层的性能冷点。在复合控制器场景中（form validation 依赖 3-5 个 field store、data-view 依赖 filter+sort+page+selection），一次业务操作可以触发 5-10 次派生通知。在 React 中意味着 5-10 次 `useSyncExternalStore` 快照重算 + 重新渲染；在 Vue/Solid/Svelte 中类似。

**核心挑战**：

- 如何在不破坏 lazy subscription（引用计数）的前提下引入通知合并
- 如何区分"用户主动 `setState`"的合并边界和"derived 连锁反应"的合并边界
- 跨 store 的场景（form A 依赖 store B 和 store C）需要跨 store 合并机制

**可选方案**：

| 方案                                                                                                               | 复杂度       | 效果                       | 风险                                             |
| ------------------------------------------------------------------------------------------------------------------ | ------------ | -------------------------- | ------------------------------------------------ |
| **微任务合并**：在 `onSourceChange` 中用 `queueMicrotask` 或 `Promise.resolve().then()` 合并同一 tick 内的多次变更 | 低 — ~30 行  | 覆盖同一调用栈内的连锁更新 | 异步化可能改变通知时序，影响 `getState()` 同步性 |
| **`notificationDepth` 计数器**：类似 `batchDepth` 但在 `derived` 层实现嵌套通知合并                                | 中 — ~60 行  | 覆盖嵌套的 derived 链      | 不覆盖跨 store 场景                              |
| **跨 store 事务协议**：在 core 引入全局 `tickDepth` 计数器，所有 store/derived 共享                                | 高 — ~150 行 | 覆盖全部场景               | 全局锁增加了复杂度，可能与框架响应式时序冲突     |

**推荐**：先实施**方案 A（微任务合并）**，因为它是成本最低且覆盖最广（同一调用栈内 N 次 setState → 1 次通知）的方案。后续可根据 bench 数据决定是否升级到方案 C。

**对现有系统影响**：`derived.onSourceChange` 改为 `queueMicrotask(flush)`。订阅者侧无感知（仍然是 `subscribe` 回调），但 `getState()` 在微任务执行前返回前一快照——这已经在 `ensureSubscribed` 中通过 `refresh()` 处理。**需要增加测试覆盖时序边界**。

### 方向 B（P0）：🏗️ CMS 应用逻辑下沉 — Dogfooding 完整性

**为什么需要**：4 个 CMS demo 是 Iris UI 的**旗舰应用**——它们展示全部 4 框架的能力。当前 62 个文件中的四倍重复使得：

- 维护者每改一个 auth 逻辑（例如从 localStorage 迁移到 cookie-based）需要改 4 次
- 新框架适配器（如果未来有 Angular/SolidStart）需要复制第 5 份
- 项目对外展示时，4 个 CMS 的行为漂移会直接破坏"四框架同名同语义同行为"的品牌承诺

**核心挑战**：

- auth/notifications/skin 等有**少量的框架特定代码**（JSX 渲染 vs Svelte template vs Vue template），不能完全下沉到 core
- `createResourceController` 已在 core，但 CMS 未充分利用（CMS 的 CRUD 页面自己管理列表状态）
- `createAdminShell` 已在 core，但 CMS 的 menus/tabs 管理仍各框架独立实现

**推荐的架构变更**：

```
当前：
  apps/cms-{react,vue,solid,svelte}/src/
    ├── auth.ts (×4, 几乎相同)
    ├── skin.ts (×4, 几乎相同)
    ├── desktopBridge.ts (×4, 完全相同)
    ├── menus.ts (×4, 几乎相同)
    └── tabs.ts (×4, 几乎相同)

提出：
  apps/cms-shared/
    └── src/
        ├── auth.ts         ← createAuthController() in core
        ├── skin.ts         ← 复用现有 createSkinEngine
        ├── desktopBridge.ts ← 通用桥接
        ├── menus.ts        ← NavNode 定义（从 @iris-ui/core 导入）
        └── tabs.ts         ← 复用 createTabsNav

  apps/cms-{react,vue,solid,svelte}/src/
    ├── auth-bridge.tsx     ← 薄桥：React.createContext / Vue provide / Svelte setContext
    ├── App.tsx / App.svelte ← 仅 UI 组装
    └── pages/              ← 页面组件（框架特有）
```

**但注意**：CMS 本质是 demo 应用，不是框架产品。对 demo 的投资需要与其产品价值匹配。**建议判断**：如果 4 个 CMS 继续用于网站文档、E2E 测试平台、以及生态示例，则下沉是 P0；如果 CMS 只是临时 demo 且长期重心在 docs 的 mini-playground，则下沉是 P2。

### 方向 C（P1）：⚡ Theme `applyTheme` JS 计算管线优化

**为什么需要**：当前每次 `applyTheme` → `themeCssVarEntries` → `mixOver(5 subtle sources × bg)` 执行 5 次完整的 hex→rgba→blend→rgb→hex 管线。在当前 ~50-60 条 token 下不可见（<0.5ms），但具有**线性增长且无缓存的隐患**。插件生态扩大后，每个插件注册 10-20 个自定义 token，30 个插件 → 300+ 条 token → 每次主题切换都全量重算。

**核心挑战**：

- `mixOver` 的输入空间（hex 值）是 16^6 × 16^6 × 权重 = 天文数字。不能用简单 Map 缓存
- **推荐实现**：用 WeakMap 以 `colorHex + bgHex + weight` 的字符串 key 做缓存，或在 `themeCssVarEntries` 中增加 `computed` 缓存层
- 更激进：将 subtle 预计算移到主题构建/编译步骤，不在运行时计算

**预期的架构变更**：

```
当前：
  themeCssVarEntries(theme) → 每次全量计算 mixOver × 5

提出：
  方案 1（轻量）：
    mixOverCache = new WeakMap<object, Map<string, string | null>>()
    缓存以 theme 对象为 key，colorHex+bgHex+weight 三元组为 subkey

  方案 2（中型）：
    在 IrisTheme 中增加 optional `precomputedSubtles?: Record<string, string>`
    主题作者在构建时预计算 subtle，运行时跳过 mixOver

  方案 3（生态）：
    创建 `computeTheme` 函数：一次性计算 theme → CssVarEntries + 缓存
    下次相同 theme 实例 → 返回缓存
```

**对现有系统影响**：方案 1 零 API 变更，只在 `mixOver` 内部增加缓存逻辑。方案 2 需要主题类型扩展但在插件场景有价值。**推荐先做方案 1**。

### 方向 D（P1）：🔀 跨框架命名约定统一

**为什么需要**：方向二和方向四揭示的问题虽然单个修复成本低，但累积的"不一致"会侵蚀开发者对系统的信任。当一个新开发者发现"Vue 的 floating 在 primitives 下，React 的 floating 在根目录"或"React 用 `useMachine`，Svelte 用 `toMachine`"时，其下意识的反应是"这个系统还没有做决策"——即使 99% 的架构决策都正确。

**三个层面的统一**：

| 层面                | 当前                             | 目标                            | 修复方式                               |
| ------------------- | -------------------------------- | ------------------------------- | -------------------------------------- |
| **Svelte 导出命名** | `toMachine` / `toStore`          | `useMachine` / `useStore`       | 新增别名导出，旧导出标记 `@deprecated` |
| **Svelte 文件名**   | `useMachine.ts` 导出 `toMachine` | 保持或改 `toMachine.ts`         | 文件名与导出对齐                       |
| **Vue 目录结构**    | `primitives/floating/`           | `floating/`（与其他三框架一致） | 移动目录，更新 barrel + 子路径 exports |

**对现有系统影响**：零 API 破坏——旧的导出名可以保留为 `@deprecated` 别名，在下一个 major 版本中移除。目录移动只影响内部，外部消费者通过 barrel 导入不受影响。

### 方向 E（P2）：🧩 插件开发工具链 — 从契约到体验

**为什么需要**：方向三的交叉分析揭示了插件开发工具链的空白。当前的 `createPlugin` + `runPlugins` 契约是正确的，但围绕它的工具链为零。这使得贡献者编写插件时缺少脚手架、验证、模板。结果是插件包的构建配置（三工具链异构）成为障碍。

**核心挑战**：

- 四框架 + core 的构建异构（tsup × N + svelte-package）是技术债务
- 没有 `pnpm create iris-plugin` 脚手架的标准化入口

**建议的架构变更**：

- CLI 工具 `@iris-ui/create-plugin`（或扩展现有 MCP/CLI 包）
- 插件模板仓库（monorepo 中的 `templates/plugin/`）
- 插件验证命令 `pnpm iris verify-plugin`（检查 exports 格式、必填字段、包名合规）

**对现有系统影响**：纯工具链扩展，不影响运行时。

---

## 3. 接口设计建议

### 3.1 关键模块接口设计原则

基于 5 方向验证结果，以下接口设计原则需要强化：

**原则 1：导出命名 = 文件名 = 功能语义，三位一体**

当前 Svelte 包的 `useStore.ts` → `toStore` 违反了这一原则。文件系统是人阅读代码的第一层接口，文件命名与导出名不一致会在代码搜索（IDE 的 Go to Definition）时制造认知断裂。

**建议**：

- 文件名与主要导出名保持一致
- 如果一种功能在不同框架上有不同的函数签名（例如 Svelte 的 toStore 返回 Readable，不同于 React 的 useStore 返回状态），函数名应反映其**使用方式**而非底层实现
- 但四框架的 bridge 函数名应该相同——因为它们在**概念**上是同一件事（将 core store 桥接到框架响应式系统）

**原则 2：框架适配器目录结构与 core 的模块结构有映射关系**

React 的 barrel 导出按 Layer 分层组织（`// ── Layer 0 ──` 等注释），但 Vue 的 barrel 没有。每个适配器的 barrel 目录结构应当遵循统一的"四个 Layer + Behaviors + Provider"布局，即使具体导出的组件列表因框架而异。

**建议**：

- 新增 `ARCHITECTURE.md` 在每个适配器包中，声明 barrel 导出布局约定
- 将 Vue 的 `primitives/floating/` 移动到 `floating/` 以统一路径
- manifest 扫描器可增加路径一致性验证

**原则 3：应用层 demo 代码不应是接口的一部分**

CMS 的 auth/skin/desktopBridge 重复暴露了一个问题：demo 应用没有明确的"我是否应该使用已有 shared 抽象"的决策机制。`createAdminShell` 已存在于 core，但 CMS 没有使用它来管理 tabs/menus 的联动。

**建议**：

- 建立 CMS demo 的代码审查门禁：新文件首先检查是否可放进 `apps/cms-shared/` 或下沉到 core 的控制器
- `createAdminApp` 作为 `createAdminShell` + `createTabsNav` + `createAuthController` 的组合体，为 CMS 提供真正的"一键初始化"

### 3.2 是否需要新的抽象层

**不需要**引入新的层。当前的四层架构（Layer 0-4）在概念设计上是正确的。问题不在于缺少抽象层，而在于**现有抽象层未被充分使用**：

- `createAdminShell`（Layer 4，core）未在 CMS 中使用
- `createResourceController`（Layer 2，core）在 CMS 中只被部分页面使用（UsersPage 用了，其他页面手写列表状态）
- `derived` 的 batch 语义需要强化但不需要新抽象

**一个例外**：如果 CMS 的用户管理页面从 1 个增长到 10+ 个 CRUD 页面，可能需要一个 **`createAdminApp` 组合控制器**，将 auth + adminShell + resourceController 绑定为一个单元。但这不是当前 priority。

### 3.3 向后兼容性

所有 5 方向的修复都可以做到向后兼容：

| 方向                     | 兼容策略                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Store derived batch 合并 | 内部实现变更，对外接口不变。`batch()` 返回类型不变，`subscribe` 回调签名不变                     |
| Svelte 命名              | 旧导出保留为 `@deprecated` 别名至 major 版本                                                     |
| Vue 目录                 | barrel 导出继续 `export * from './primitives/floating'` 和新增 `export * from './floating'` 并存 |
| CMS 下沉                 | 旧文件保留但标记为 `@deprecated`（自动导入路径不变），新代码从 `cms-shared` 导入                 |
| Theme 缓存               | `themeCssVarEntries` 签名不变，内部新增缓存层                                                    |

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈或框架

**不需要**。5 方向揭示的问题**全部可以在现有技术栈内解决**：

| 方向               | 技术                                           | 理由                                                                     |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| derived batch 合并 | 原生 JS `queueMicrotask` / `Promise.resolve()` | 不需要第三方调度库。Microtask 队列是浏览器原生提供的最轻量的异步合并机制 |
| Theme 缓存         | ES WeakMap + 字符串 key                        | 不需要 `memoize` 库。WeakMap 提供自动 GC，适合 theme 对象的生命周期管理  |
| CMS 下沉           | 现有 `createStore` / `createAdminShell`        | 不需要引入新状态管理库。core 的 store 系统已经足够                       |
| 跨框架命名统一     | 纯重命名 + 别名导出                            | 零新依赖                                                                 |
| 插件工具链         | tsup / esbuild / 模板引擎（已存在）            | 扩展现有 CLI，不需要新构建系统                                           |

**一个注意点**：如果未来 `derived` 需要跨 store 的全局事务合并（方案 C），可以考虑一个轻量的 `Scheduler` 抽象——但这也应该用纯 JS 实现，不需要引入 RxJS 或类似的响应式库。

### 4.2 第三方依赖的评估标准

以 `mixOver` 的缓存为例展示评估框架：

| 标准         | WeakMap 方案                 | Map 方案           | 第三方 LRU       |
| ------------ | ---------------------------- | ------------------ | ---------------- |
| **包体积**   | 0 KB（内置）                 | 0 KB               | ~1-3 KB minified |
| **GC 友好**  | ✅ 自动回收 theme 对象的 key | ❌ 需要手动清理    | ✅ 有大小上限    |
| **内存上限** | 无（但 theme 对象有限）      | 无（需手动 prune） | 可配置           |
| **兼容性**   | ES2015+, 全浏览器            | ES2015+            | 依赖具体库       |
| **复杂度**   | ~10 行                       | ~15 行             | ~30 行 + 配置    |

**结论**：WeakMap 是最优选择——主题对象生命周期有限（通常只有 2-4 个全局实例），不需要 LRU 淘汰。

### 4.3 自建 vs 采购的决策依据

当前场景中不存在"采购"选择（UI 基础设施本身就是自建的）。但存在**在下沉到 core vs 留在适配器/vs 留在应用**中的三选一决策：

| 决策            | 情境                                               | 判据                                                             |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| **下沉到 core** | 逻辑框架无关且在不同适配器间重复                   | ✅ CMS auth 操作、STORAGE_KEY 管理、desktopBridge 的 socket 逻辑 |
| **留在适配器**  | 逻辑依赖框架特定 API（context/provide/setContext） | ✅ auth 的 Provider 组件、JSX/Svelte template 渲染               |
| **留在应用**    | 逻辑是应用特有的组合（用户管理页面的特定数据获取） | ✅ CMS UsersPage 的特定列渲染、Role 过滤                         |

当前 CMS 问题本质是**应该下沉的逻辑没有下沉**（auth 操作、STORAGE_KEY 读写、desktopBridge socket），而**应该留在适配器的逻辑也被留在应用**（Provider 在应用层实现而非适配器层）。

---

## 5. 实施路线图

### 5.1 优先级排序

```
P0（必须在下一迭代处理）：[方向 B] CMS 应用逻辑下沉 · [方向 C 子项] derived batch 合并
P1（下一迭代/下下迭代）：   [方向 A] Theme 缓存 · [方向 D] 跨框架命名统一
P2（季度级）：             [方向 E] 插件开发工具链 · CMS 追加（AdminApp 组合）
```

**P0 判据**：影响长期可维护性（CMS 四倍体不断累积漂移）或影响运行时正确性（derived 通知未合并导致的不必要重渲染）。

**P1 判据**：影响性能基线（Theme 缓存是可预见的规模瓶颈）或开发者体验（命名不一致是持续的认知摩擦）。

**P2 判据**：纯增量价值，不影响已有功能。

### 5.2 阶段划分和里程碑

```
Phase 1：地基（1-2 周）
  ├── derived.batch 微任务合并
  ├── themeCssVarEntries WeakMap 缓存
  └── 增加 5 个 bench 场景 + CI 门禁

Phase 2：统一（1-2 周）
  ├── Svelte 导出别名（useMachine = toMachine, useStore = toStore）
  ├── Vue floating 目录对齐
  └── manifest 扫描器新增路径一致性验证

Phase 3：下沉（2-4 周）
  ├── apps/cms-shared/ 目录建立
  ├── auth 下沉（core 层 createAuthController + 适配器薄桥）
  ├── desktopBridge 下沉（core 层通用桥接）
  ├── menus/tabs 迁移到现有 createAdminShell
  └── CI 新增 check:cms-parity 门禁（4 CMS 的关键 API 返回相同结果）

Phase 4：工具化（季度目标）
  ├── pnpm create iris-plugin 脚手架
  ├── plugin 验证命令
  └── 模板仓库
```

### 5.3 风险点和缓解策略

| 风险                                                                                             | 概率 | 影响 | 缓解                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 的微任务合并改变通知时序**，导致 React/Vue/Solid/Svelte 的桥接测试失败                 | 中   | 高   | 1) 增加"同步链"测试（同一调用栈内的 setState→derived→subscribe） 2) 在 CI 中运行全部 4 框架的合同测试（当前约 44 场景 × 4 = 176 测试）       |
| **CMS 下沉导致 4 应用构建破坏**（cms-shared 包依赖未在 turbo pipeline 中声明）                   | 中   | 高   | 1) 先在一个框架（推荐 React）做完整下沉验证 2) 再同步到其他 3 框架 3) Turborepo 依赖图提前声明 `cms-shared` 的 build 顺序                    |
| **Svelte 命名别名导出导致 tree-shaking 效率下降**（旧导出保留为 `@deprecated` 会增加未引用导出） | 低   | 低   | 旧导出不做实际实现，只做 `export { useMachine as toMachine }` 的别名重定向。tree-shaker 可安全移除未使用的别名                               |
| **Theme 缓存的空间泄漏**（WeakMap key 为 theme 对象但开发者长期持有未 GC）                       | 低   | 低   | theme 对象通常是全局单例（`lightTheme`、`darkTheme`），不会被 GC，所以不构成泄漏风险                                                         |
| **Phases 1-4 的工作被"新组件"优先级排挤**                                                        | 高   | 中   | 将这些方向作为架构门禁绑定到 CI 中（size budget / bench regression / manifest path consistency），使其成为"不修不能合"的硬约束，而非可选优化 |

---

## 总结

验证报告揭示的 5 个方向，按**真实架构价值**重新排序后的建议如下：

| 原始方向                       | 重新评估                       | 建议处理方式                             |
| ------------------------------ | ------------------------------ | ---------------------------------------- |
| 🏗️ CMS 架构违规（原方向三）    | **最高价值**，即使已被分析覆盖 | 作为 P0 实施，但明确引用已有分析         |
| 🔄 Derived batch（原方向五）   | **第二高价值**，深度分析有增量 | 作为 P0 实施，引用已有分析的边缘情况描述 |
| ⚡ Theme JS 成本（原方向一）   | **中等价值**，数字需修正       | 作为 P1 实施，WeakMap 缓存即可           |
| 🔀 Svelte API 命名（原方向二） | **低修复成本高符号价值**       | 作为 P1 实施，别名导出                   |
| 📁 Vue 目录不对称（原方向四）  | **最低成本但高符号价值**       | 作为 P1 实施，移动目录                   |

核心建议：**不要被 novelty 声明迷惑**。CMS 四倍体重复是最严重的架构债务，即使它已被之前的多份分析覆盖。`derived.batch` 无合并是最影响 4 框架消费者的性能隐患。这两个方向应立即处理。其他三个方向可以在同一迭代中顺便修复（每个的修复成本 < 1 天）。
