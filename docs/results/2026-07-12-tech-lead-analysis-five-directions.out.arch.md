我已经完整阅读了这份 22.7 KB 的分析报告。以下是我的架构分析。

---

# 架构分析：Iris UI 扩展方向技术评估

## 1. 架构评估

### 1.1 现有架构优势

**分层清晰度极高。** Iris UI 的 L0→L4 分层是当前分析中最大的架构护城河。报告中五方向（①数据导入、②跨应用数据、③路由、④降级恢复、⑤运行时元数据）的核心接口全部落在 L0（`packages/core/src/`），而框架桥接仅在 L1/L2 做薄绑定——这与 AGENTS.md 的「逻辑下沉 core，适配器做薄桥」原则严格一致。报告中所有 17 个 TASK 的设计验证了这一分层的抗压能力。

**插件契约设计的可扩展性。** `createPlugin`/`runPlugins` 的注册机制（`registerTokens`/`registerMessages`/`registerStore`）为方向①（`plugin-importer`）、方向④（重试策略）、方向⑤（`ComponentMetadataRegistry` 通过 Provider 激活）提供了天然接入点。报告没有设计新的「插件安装」机制，而是复用现有 `IrisProvider(plugins=[...])` 路径——这是减少架构分歧的正确选择。

**Token 杠杆的降维效果。** 方向⑤的 DevTools 面板依赖 `--iris-*` CSS 变量查询 + `manifest.json` 元数据，而非引入新的样式自省机制。这一决策避免了重复造轮子。

### 1.2 架构局限性与脆弱点

**（A）无统一错误处理协议——这正在成为架构债。**

当前架构中，`createAsyncResource` 有 token 竞态保护，`createDataSource` 有 loading/error/success 状态，但 **没有可组合的错误处理协议**。方向④的 `createRetryable` 试图填补这一空白，但从架构角度看，它只是一个基元（primitive），不是协议（protocol）。真正缺失的是：

- 一个贯穿 core → adapter → plugin 的 `ErrorContext` 类型（含 `source`、`recoverable`、`retryCount`、`fallbackValue`、`degradedColumns`）
- 一个在 `IrisProvider` 级别的 `onError(error: ErrorContext): void` 钩子（供全局错误日志/监控/Toast 拦截）
- 一个「错误传播的停止规则」（即：插件级错误何时冒泡到 Provider 级，何时被局部消化）

方向④ 的 TASK-011/012/013 切入点是正确的，但 **scope 偏窄**——它们将重试视为一种「对异步函数的包装」，而非「系统级错误处理协议的一部分」。如果不把错误处理提升到协议层面，未来每个插件都会自建一套错误模型（`plugin-editor` 的 CodeMirror 崩溃、`plugin-pro-table` 的 CRUD 错误、`plugin-importer` 的解析错误），碎片化将不可控。

> **建议**：在 TASK-011 之前或并行，先定义 `ErrorHandlingProtocol` 接口（core/types.ts），将 retry/degradation/fallback 三者作为可插拔策略，而非独立的函数组合子。

**（B）运行时元数据与构建时元数据之间存在架构断层。**

当前 `manifest.json`（构建时生成）包含组件列表、props/events/slots。方向⑤ 的 `ComponentMetadataRegistry`（运行时）需要这些数据作为 seed。但报告中 TASK-017 只是让 manifest「预加载元数据加速注册」，没有定义两者的**同步契约**：

- 构建时元数据变化了（例如新增 prop），运行时 registry 如何感知？——回答：重新构建 + 部署。这是合理的，但需要一个 `manifestVersion` 校验，防止旧运行时加载新 manifest 导致类型不一致。
- 运行时注册的组件（动态 import / 插件添加的组件）如何回写到 manifest？——回答：不回写，manifest 是快照，运行时 registry 是增量叠加。但这个决策需要在设计中显式写出，否则后续开发人员会试图让 registry 反写 manifest.json（这是危险的反模式）。

**（C）方向③的事实错误暴露了架构知识管理缺口。**

报告中的方向③严重依赖不存在的 `cms-vue` 应用和不存在的 `react-router-dom` 依赖。这不是简单的文档错误——它暗示了：

1. 项目缺少一份 **活的架构目录**（living architecture inventory），包含所有应用的路径、依赖、路由方式。
2. `manifest.json` 只扫描了包的 barrel 导出，没有扫描应用的依赖图谱。
3. AI 生成的代码分析缺乏「本地验证」环节——原始文档基于代码模式匹配而非实际运行验证。

> **架构响应**：建议新增一个 `pnpm arch:inventory` 命令，扫描 `apps/*/package.json` + 应用入口文件，产出 `ARCHITECTURE_INVENTORY.json`（含应用路径、路由方式、外部依赖、框架版本）。这条命令应作为 **CI 门禁的一部分**，在每次 PR merge 后重生成，并与 `manifest.json` 一起提交。这样，任何 AI 生成的架构分析文档都可以先引用 `ARCHITECTURE_INVENTORY.json` 做事实校验。

**（D）`StructuredDataPayload` 的大小约束未定义。**

方向②的 TASK-005 定义了 payload 的 mimeType/data/metadata/ref 结构，但没有定义 **大小阈值策略**。架构上这是危险的：

- 多大数据量应该从「嵌入 payload」切换到「引用 payload」？（报告提到 500KB，但这是粗略估计，非架构决策）
- 引用 payload 的 `PayloadStore` 是内存存储还是持久化存储？（对于 Desktop OS 的多窗口场景，内存存储意味着刷新后引用全丢）
- 跨源（cross-origin）场景下 `BroadcastChannel` 不可用，`CustomEvent` 不跨 window，fallback chain 中需要 `postMessage` 作为第三层——报告写了两个 fallback，但 `StructuredDataPayload` 的设计中没有签名机制来防止伪造 payload。

> **建议**：在 TASK-005 的类型定义中加入 `payloadSize: 'inline' | 'ref' | 'stream'` 枚举 + 对应的序列化策略，将大小决策从运行时判断提前到类型层面。

---

## 2. 高价值架构扩展方向

除了报告中的五方向，我从构架层面识别出以下补充方向（3-5 个）。

### 方向 A：统一状态持久化与序列化协议（Undo/Redo 基础设施）

| 维度                 | 分析                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | 当前 `createSelectionModel` / `createExpansion` / `createAdminShell` 都是有状态 controller，但它们的状态是易失的（内存）。一旦涉及「undo/redo」、「草稿恢复」、「应用重启后恢复上次会话」（类似 IDE 的功能），这些 controller 需要一个统一的序列化/反序列化契约。方向④的重试 + 降级解决了「运行时错误恢复」，但没有解决「状态快照与回滚」。                      |
| **核心挑战**         | ① Iris UI 的 controller 是纯 JS 对象（`createStore`），没有统一的 `serialize`/`deserialize` 接口——每个 controller 需要显式实现。② 序列化粒度：是整个应用状态快照，还是单体 controller 的增量 patch？③ 时间旅行（undo/redo）需要 immutable 快照 + 引用比较，这与 react 的 `useSyncExternalStore` 模式可以自然对接，但 Vue/Solid/Svelte 的反应式系统需要额外适配。 |
| **预期架构变更**     | 在 `packages/core/src/store.ts`（`createStore`）中新增可选 `serializer: { serialize(state): JSONValue, deserialize(json): State }` 参数。每个 controller（`createSelectionModel` 等）可以组合使用。新增 `createUndoRedo(store, { maxHistory: 50 })` 组合子，包装任意 `createStore`。`IrisProvider` 新增可选 `onStateSnapshot` 回调供自定义持久化。               |
| **对现有系统的影响** | 向后兼容（`serializer` 可选）。所有现有 controller 无需修改。新 controller 可选接入。undo/redo 组合子是纯函数加法。                                                                                                                                                                                                                                              |

### 方向 B：跨插件通信渠道（Plugin → Plugin 消息总线）

| 维度                 | 分析                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | 当前插件系统支持注册 token/i18n/store，但插件 A 如何通知插件 B「数据已变更」？当前只能通过 `IrisProvider` 的共享 store 间接通信。随着插件数量增长（`plugin-locale-zh`、`plugin-editor`、`plugin-pro-table`、`plugin-importer`、`plugin-devtools`），插件的相互依赖会迫使消费者手动组合 store。一个轻量的事件总线可以避免「谁持有哪些 store」的隐式耦合。          |
| **核心挑战**         | ① 避免「插件间强耦合」：总线应该是类型安全的通道（`channel: string` + `payload: unknown`），不是方法调用。② 生命周期：插件 unmount 时自动取消订阅。③ 与方向②的 `InterAppBus` 关系：插件总线是进程内的，`InterAppBus` 是进程间的——两者在概念上同构但实现不同。架构上应避免两个独立实现。                                                                           |
| **预期架构变更**     | 在 `packages/core/src/plugin.ts`（`runPlugins` 内）挂载一个 `PluginBus` 实例，通过 `createPlugin` 的 `install(reg)` 参数暴露 `reg.bus.on('channel', handler)` 和 `reg.bus.emit('channel', payload)`。`PluginBus` 可以复用 `InterAppBus` 的接口（`{ post, subscribe, unsubscribe }`），但底层使用 `EventEmitter`（或 `createNanoEvents`）而非 `BroadcastChannel`。 |
| **对现有系统的影响** | 零影响：新功能不修改现有插件 API。已有插件不接入则不感知。                                                                                                                                                                                                                                                                                                        |

### 方向 C：Schema-Driven 动态表单 / 数据视图生成协议

| 维度                 | 分析                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ | --------------------------- | -------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **为什么需要**       | AGENTS.md 提到「不做 `registerComponent`（动态组件名会牺牲类型/tree-shaking/manifest）——组件保持静态 import；schema 驱动渲染用局部有类型的 `widgets` map」。这是一个有意的架构边界。但 `plugin-pro-table`（CRUD 表格）和方向①的数据导入管线都需要一个「从列类型推断 → UI 控件映射」的协议。如果每个插件自己实现列类型映射，会产生碎片化。 |
| **核心挑战**         | ① 四框架的 widget map 必须是同构的（每个框架有自己的渲染方式）。② 类型推断 vs 类型覆盖：导入 CSV 时自动推断类型（`fromCsv` 的输出），但用户应能覆盖。③ schema 与 token 主题的交互：表格列的控件样式如何继承 `--iris-*` 变量？                                                                                                             |
| **预期架构变更**     | 在 `packages/core/src/schema.ts`（新建）中定义 `ColumnSchema` 类型（`{ field, label, type: 'string'                                                                                                                                                                                                                                       | 'number' | 'date' | 'enum' | 'boolean', widget?: 'Input' | 'Select' | 'DatePicker' | 'Checkbox', options?, validation? }`）。每个框架适配器提供一个 `resolveWidget(schema): IrisComponent` 的映射函数。`plugin-importer`的导入管线接受可选`ColumnSchema[]` 作为列覆盖。 |
| **对现有系统的影响** | 新增模块，零影响现有代码。`plugin-pro-table` 可以逐步接入而非一次性迁移。                                                                                                                                                                                                                                                                 |

### 方向 D：构建时 → 运行时元数据同步契约（manifest Versioning）

| 维度                 | 分析                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **为什么需要**       | 方向⑤的 TASK-017 试图打通构建时 manifest → 运行时 registry seed data。但缺少版本校验机制。没有版本校验，运行时加载旧 manifest 可能导致 `ComponentMeta` 类型不匹配（prop 新增/删除/重命名），产生静默错误。                                                         |
| **核心挑战**         | ① `manifest.json` 的版本生成策略：是 `git commit hash` + `package.json version` 的组合，还是单独递增？② 向后兼容边界：何时 manifest 变更被允许要求运行时升级（breaking）？③ 分布式场景：如果 manifest CDN 缓存 stale，运行时如何检测？                             |
| **预期架构变更**     | 在 `manifest.json` 顶层字段 `manifestVersion: string` + `irisUIVersion: string`。`ComponentMetadataRegistry` 的 `seed(manifest)` 方法检查版本，若 manifest 版本 > registry 版本则 `console.warn`。新增 `pnpm gen:manifest --check` CI 命令，防止版本未更新时合并。 |
| **对现有系统的影响** | `manifest.json` 体积增大两个字段（< 50 bytes）。registry 初始化增加一次比较操作（< 0.01ms）。完全向后兼容。                                                                                                                                                        |

### 方向 E：SSR 安全层的架构性加固

| 维度                 | 分析                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **为什么需要**       | 报告中的多方向涉及「SSR 安全」要求（方向③的 `RouterAdapter` 在 SSR 返回空状态、方向⑤的 registry 在服务端为空、方向②的 `InterAppBus` 返回 noop）。但这些保证是 **手动的、每个模块自管的**。没有一个**强制性的 SSR guard**——这意味着新模块可能遗漏 SSR 保护，直到构建时在 `check:rsc` 阶段才发现。 |
| **核心挑战**         | ① 不能使用高阶函数包装所有模块（会改变类型签名）。② 需要区分「SSR 无操作」和「SSR 降级行为」：前者（如 `InterAppBus`）直接返回空实现不报错；后者（如 `RouterAdapter`）可能在 SSR 阶段期望特定行为。③ 测试方面：`// @vitest-environment node` 不是一个架构级的保证。                              |
| **预期架构变更**     | 在 `packages/core/src/ssr.ts`（新建，可能对应现有 `ssr-safe.ts`）中定义 `isSSR(): boolean`（检查 `typeof window === 'undefined'`）和 `SSRAction<T>({ run: () => T, fallback: () => T })` 组合子。新增 ESLint 规则 `@iris-ui/no-ssr-unsafe`，检测 module 级别直接调用 DOM API 的行为。            |
| **对现有系统的影响** | 低。新组合子是加法。ESLint 规则可能需要对现有代码做少量重写以适应规则。                                                                                                                                                                                                                          |

---

## 3. 接口设计建议

### 3.1 设计原则（对报告的补充）

**原则一：新接口优先设计为组合子（combinator），而非基类（base class）。**

报告中所有方向都自然地选择了函数式组合模式（`createRetryable`、`createInterAppBus`、`createClipboardData`、`createComponentMetaRegistry`）。这是正确的。但需要注意：**组合子之间的组合关系应该在类型层面有表达**。例如：

```
// 错误的隐含组合：
createRetryable(fn, config) // 返回 retryableFn
// 然后手动将 retryableFn 传给 createAsyncResource

// 正确的显式组合：
createAsyncResource(fn, {
  retry: retryConfig  // 类型层面组合
})
```

方向④的 TASK-012 正确地选择了显式组合（`AsyncResourceConfig` 新增可选 `retry`）。所有方向应该保持一致：**组合子的消费者不应该需要手动 pipe 输出到输入**。

**原则二：每个新模块必须有一个「Prod 路径的零成本抽象」策略。**

报告中方向⑤已经考虑了 `process.env.NODE_ENV` guard。但需要把这变成所有新模块的硬性要求：

```
// ALL new core modules MUST start with:
if (process.env.NODE_ENV !== 'production') {
  // Dev-only logic
} else {
  // Prod: minimal/no-op path
}
```

这在代码审查中加入 checklist。

**原则三：向后兼容是架构层级的承诺，不是单次 PR 的巧合。**

方向③的 AdminLayout 新增 `router` prop 声明了「可选 → 不破坏现有 `activeKey` 用法」。方向④的 `DataSourceState` 新增 `degradedColumns` 字段声明了「可选新增」。这些都需要 **类型测试**（type-level test）。建议在 CI 中增加 `pnpm check:types-compat`（使用 `tsd` 或 `expect-type` 库），验证：

```typescript
// 验证旧用法在新增 prop 后仍可编译
const layout = <AdminLayout activeKey="tab1" />
```

### 3.2 是否需要新的抽象层

**需要：一个「错误处理协议层」。**

当前架构中，错误分散在各处：

| 层       | 现有错误处理                                                        |
| -------- | ------------------------------------------------------------------- |
| Core     | `createAsyncResource` 返回 `{error}` 状态，无统一类型               |
| Adapter  | 各框架自行处理渲染错误（React ErrorBoundary / Vue onErrorCaptured） |
| Plugin   | 无协议，插件可能 throw 也可能返回 `Result<T, E>`                    |
| Provider | 无全局错误钩子                                                      |

新增一个 `ErrorHandlingProtocol` 抽象层（在 `packages/core/src/error-protocol.ts`）可以统一这四类：

```typescript
interface ErrorContext {
  source: 'async-resource' | 'data-source' | 'plugin' | 'render' | 'custom'
  code: string
  message: string
  retryable: boolean
  retryCount: number
  degradedColumns?: string[]
  originalError: unknown
}

interface ErrorHandler {
  (error: ErrorContext): ErrorResolution
}

type ErrorResolution =
  | { action: 'retry' }
  | { action: 'degrade'; columns: string[]; fallback: unknown }
  | { action: 'fallback'; value: unknown }
  | { action: 'report' } // 冒泡到 provider
  | { action: 'ignore' }
```

这个层不引入新的运行时开销（Prod 路径为 `action: 'report'` 短路），但为所有方向的错误处理提供了类型安全的基础。

### 3.3 向后兼容策略矩阵

| 变更类型                          | 策略                                 | 验证方法                  |
| --------------------------------- | ------------------------------------ | ------------------------- |
| Core 新增类型/接口                | 新建文件 + barrel export             | 旧 import 不受影响        |
| Core 新增可选字段到已有接口       | `field?: T`（可选）                  | 类型测试（`expect-type`） |
| Core 修改已有接口（新增必选字段） | 需 major 版本                        | 不发生在本次扩展中        |
| Adapter 新增 prop                 | `prop?: T`（可选）+ 内部 `??` 默认值 | 类型测试 + 渲染测试       |
| Adapter 修改已有 prop（类型放宽） | 向后兼容                             | 类型测试                  |
| Adapter 修改已有 prop（类型收紧） | 需评估破坏性                         | 不发生在本次扩展中        |
| Plugin 新增 install 参数          | 新参数可选                           | 旧插件不传入则不调用      |

报告中的所有 TASK 都符合「可选 → 向后兼容」模式。没有需要在本次扩展中做 breaking change 的接口。

---

## 4. 技术选型评估

### 4.1 现有技术栈的充分性

报告中的全部 17 个 TASK 都可以在现有技术栈内完成：

| 需求                        | 现有方案                                                    | 充分性                                                                                  |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| CSV/JSON SpreadsheetML 解析 | 纯 TypeScript + `fast-xml-parser`（新增依赖）               | ⚠️ SpreadsheetML 解析需要评估 `fast-xml-parser` 的 XML namespace 处理能力               |
| 结构化数据序列化            | 原生 `JSON.stringify`/`structuredClone`                     | ✅ 充分                                                                                 |
| 跨窗口通信                  | `BroadcastChannel` + `CustomEvent` + `postMessage` fallback | ✅ 充分                                                                                 |
| 路由适配                    | 纯 TypeScript（hashchange 事件）                            | ✅ 充分，但 SSR safe 需额外注意                                                         |
| 重试策略                    | 纯 TypeScript（指数退避 + jitter）                          | ✅ 充分                                                                                 |
| 组件元数据                  | 纯 TypeScript（registry 模式）                              | ✅ 充分                                                                                 |
| DevTools                    | DOM panel（React 专属初版）                                 | ⚠️ 跨框架 DevTools 可能需要 DOM 操作（非框架渲染），可以考虑 `web-component` 但复杂度高 |

**需要新增的第三方依赖评估：**

| 依赖                        | 方向 | 大小             | 备选                           | 建议                                                                                                            |
| --------------------------- | ---- | ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `fast-xml-parser`           | ①    | ~30KB min        | `sax` / `xml2js`               | **选择**：最小、最快、无依赖。但需锁定 namespace 处理配置                                                       |
| `detect-character-encoding` | ①    | ~200KB（native） | `iconv-lite`（~100KB pure JS） | **不推荐**。对于 CSV 导入，`BOM` + `charset` 声明 + 用户覆盖 三位一体已覆盖 95% 场景。native 模块增加构建复杂度 |

### 4.2 需要关注的技术债务

**Svelte 5 rune 兼容性。** 报告在资源评估中安排了 0.5 FTE 用于 Svelte 桥接。但方向⑤的 `useComponentMeta` 需要从 `component.name` 获取组件名——在 Svelte 5 中，`$state()` 声明会破坏 svelte-check 的 rune 识别（AGENTS.md 已警告）。这意味着 Svelte 的元数据获取可能需要**运行时反射**（`__svelte_meta` 类似）而非编译时 `name`。这对 TASK-016 的 Svelte 实现是一个技术风险，需要早期验证。

**测试基础设施的负载。** 报告要求 100% 分支覆盖 + SSR 测试 + axe 测试 + size 预算。方向①的 CSV 解析测试是一个典型的高复杂度测试（BOM 处理、GBK mock、超大文件分片）。如果 4 方向并行，QA 工程师将同时承受来自 5 个方向的测试交付，可能导致测试深度下降。**建议**：在阶段 2（Day 6-12）投入 0.5 FTE 专门做「测试基础设施加固」——包括测试助手函数库（mock factory）、CSV 测试 fixture 自动生成器、跨框架 hook 测试模板生成器。这是一笔**预防性投资**。

### 4.3 自建 vs 采购的决策框架

报告中涉及的所有功能都是自建。这是正确的，原因：

| 功能                          | 为什么不采购                                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV/JSON/XML 解析（导入管线） | 纯函数解析器（无 DOM 依赖）+ 与 `toCsv`/`toSpreadsheetXml` 对称。现有导出是自建的，导入自建保持对称。第三方库（如 `PapaParse`）是 CSV 专用，无法与 Iris UI 的 `DataSourceRow` 类型直接集成。 |
| 结构化剪贴板                  | 浏览器 `Clipboard API` 是标准，`ClipboardItem` 构造是标准。自建的理由是「结构化 payload 需要框架无关的类型定义 + 4 框架桥」。第三方库无法做到四框架对齐。                                    |
| 路由适配器                    | 不是路由库本身，而是「路由库 → Iris UI AdminLayout」的适配层。第三方无法适配。                                                                                                               |
| 重试/降级策略                 | 与 `createAsyncResource`/`createDataSource` 的集成需要深度类型绑定。第三方库无法感知 Iris UI 的 `DataSourceState`。                                                                          |
| 组件元数据                    | 完全自带（manifest scanner + runtime registry）。第三方（如 `react-dev-inspector`）只覆盖单一框架。                                                                                          |

**唯一的例外**：方向①的 SpreadsheetML 2003 XML 解析可以借助 `fast-xml-parser`（轻量，tree-shakeable）。方向②的编码检测可以使用 `detect-character-encoding`，但如上所述，建议不引入。

---

## 5. 实施路线图

### 5.1 优先级重排（基于架构影响面）

报告中的优先级（P0 事实修正 → P1 方向①+⑤ → P2 方向④ → P3 方向② → 待定方向③）基本合理。我从架构影响面角度做微调：

| 优先级   | 方向                   | 架构影响面                                                 | 与报告差异                                                                            |
| -------- | ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **P0**   | 事实修正 + 架构目录    | 跨所有方向                                                 | 一致。但建议将「架构目录生成工具」作为 P0 产出                                        |
| **P1-a** | 方向⑤ 运行时元数据     | **高**——它影响 DevTools、AI 工具集成、第三方开发者体验     | 提升到与方向①并列。理由：元数据基础设施是其他方向（尤其是 DevTools 和 AI 交互）的前提 |
| **P1-b** | 方向① 数据导入管线     | **中-高**——插件模式算中等，但「导入」与现有「导出」对称    | 一致                                                                                  |
| **P1-c** | 补充：统一错误处理协议 | **高**——跨方向④的重试 + 方向②的数据协议 + 所有插件的错误   | 报告中未单独提取，是我新增的架构方向                                                  |
| **P2**   | 方向④ 优雅降级         | **中**——重试基元是错误协议的一部分，但组件级降级是渲染专用 | 一致。建议在统一错误协议（P1-c）完成后立即开始                                        |
| **P3**   | 方向② 跨应用数据协议   | **低**——Desktop OS 专用                                    | 一致。`StructuredDataPayload` 类型可以先做（半天），完整总线留后                      |
| **待定** | 方向③ 路由适配器       | **中**——影响 CMS demo 维护者                               | 一致。取决于利益相关者会议结果                                                        |

### 5.2 阶段划分与里程碑（强化版）

**Day 1-2: 架构资产数字化（P0 修正）+ 错误协议设计**

```
Day 1:
  AM: 方向三利益相关者会议（30min → 明确 scope 或挂起）
  AM: 实现 pnpm arch:inventory（扫描 apps/* → ARCHITECTURE_INVENTORY.json）
  PM: 将 ARCHITECTURE_INVENTORY.json 加入 CI（PR merge 后自动更新）
  PM: 起草 ErrorHandlingProtocol 接口（设计文档 + 类型定义）

Day 2:
  AM: 方向一/五/四 的设计文档定稿（含勘误标注）
  PM: 编写 core 新模块的 index.ts barrel 脚手架（空文件 + 类型占位）
```

**关键决策**：Day 1 的利益相关者会议可能产生三种结果：

| 选项             | scope                                                                            | 影响                                             |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| **A** 维持方向三 | AdminLayout 路由桥 + 四框架外部 router 适配器                                    | 需要额外 1 FTE（CMS demo 维护者），总工期 +3 天  |
| **B** 缩小方向三 | 仅内置 hash router adapter + AdminLayout router prop（不实现外部 router 适配器） | 2 个 TASK（TASK-008 + TASK-010 核心部分），约 4h |
| **C** 挂起方向三 | 仅保留设计文档，不实现                                                           | 释放 1 FTE 到其他方向                            |

**Day 3-7: Core 纯函数 + 错误协议实现**

```
Day 3-5:
  TASK-014 ComponentMetadataRegistry（高优先级，他人依赖）
  TASK-001 fromCsv（高优先级，4 任务串行起点）
  ErrorHandlingProtocol 类型 + 默认实现

Day 6-7:
  TASK-002 fromJson/XML
  TASK-011 createRetryable（依赖 ErrorHandlingProtocol）
  TASK-015 Props 校验器
```

**Day 8-14: 框架桥 + 集成（并行高峰）**

```
Day 8-10（最紧张时期）:
  TASK-016 useComponentMeta（四框架桥）—— 高工作量
  TASK-004 useFileImport（四框架桥）—— 高工作量
  TASK-012 重试集成到 AsyncResource/DataSource
  TASK-009 路由桥（四框架）

Day 11-14:
  TASK-003 plugin-importer 核心协议（依赖 TASK-002）
  TASK-017 DevTools + manifest 联动
  TASK-013 组件级降级
  TASK-010 AdminLayout 集成
```

**Day 15-20: 质量门 + 文档 + 发布**

与报告一致，无修改。

### 5.3 风险点和缓解策略（补充）

| 风险                                                                                   | 等级  | 说明                                                                           | 架构缓解策略                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方向①的 SpreadsheetML 解析遇到无法处理的边界（合并单元格、嵌套公式）                   | 🟡 中 | 可能导致方向①的「解析器」无法交付完整的 100% 分支覆盖                          | 架构上：将 SpreadsheetML 解析分为「简单表格模式」（cell 内的纯文本数据，不处理公式/合并）和「完整模式」（V2）。简单模式通过验收标准即可发布。`UnsupportedFeature` 错误类型提前定义                                                                                            |
| 方向⑤的 Prod tree-shake 验证在 CI 中发现 Rollup/Webpack 未正确删除 `component-meta.ts` | 🟡 中 | 导致 core 包体积超标                                                           | 架构上：将 `ComponentMetadataRegistry` 放在独立文件 `component-meta.ts`，**不**通过 `process.env.NODE_ENV` guard 导入 barrel（即：barrel 始终导入，但内部代码被 DCE 删除）。如果 DCE 失败，改为条件 `require`（dynamic import 在 ESM 中不可 DCE）。这是架构设计时就需要决策的 |
| 四框架并行开发中的「桥接不对齐」                                                       | 🟡 中 | React 桥实现了 `useFileImport`，但 Vue 桥因为 composition API 差异无法对齐行为 | 架构上：每个方向的核心 TASK（TASK-001/005/008/011/014）必须有 **框架无关的验收测试**（纯 core 单测），框架桥的验收标准是「通过核心集成测试 + 渲染不变」。如果一个框架的桥接遇到不可逾越的障碍，**不阻塞其他框架发布**——缺少的框架标记为 `// @todo`                            |
| 方向二/三/五 都需要「SSR safe 空实现」但各自实现方式不同                               | 🟢 低 | 代码重复，未来统一困难                                                         | 架构上：在 P1-c（统一错误协议）阶段同时定义 `SSRModule` 基类型（`{ isSSR(): boolean; noop(): void }`），所有需要 SSR safe 的模块继承此契约。详见方向 E                                                                                                                        |

### 5.4 如果只有 2 FTE 的架构调整方案

报告给出了「仅 Core + React 各一」的 6-8 周方案。我完全同意它的优先级（方向①+⑤ 核心部分 → 方向④ → 方向② 精简）。但从架构角度，补充一个决策：

**在 2 FTE 约束下，建议用一个 TASK 的时间先完成统一错误协议（P1-c），然后再做方向①/④/⑤。**

理由：

| 场景                           | 无统一错误协议                            | 有统一错误协议                                      |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| 方向① 解析错误（单行解析失败） | 手动抛 `ParseError[]`，与表级错误处理无关 | 复用 `ErrorContext.degradedColumns`，标记为列级降级 |
| 方向④ 重试失败                 | 手动检查 `retryCount > maxRetries`        | `ErrorHandler` 自动触发 `action: 'fallback'`        |
| 方向⑤ 组件校验失败             | 各自 `console.warn`                       | `ErrorContext.source: 'component-meta'` 统一上报    |

同时，统一错误协议的全部代码可以写在 **~150 行 TypeScript**（类型定义 + 默认实现），1 个 TASK 的工时（3h）。这是架构层面「小投入、大收益」的典范。

---

## 总结

| 维度                     | 评估                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **报告质量**             | 事实核查严谨（能找到 `cms-vue` 不存在、`errorRetryCount` 不存在），任务分解粒度合理（2-4h），并行策略清晰。文档的质量门部分（§5）延续了 AGENTS.md 的严格标准。                                                                                                                            |
| **最关键架构缺漏**       | 缺少统一错误处理协议（我补充为 P1-c）。五个方向各自的错误处理分散，如果不提前收敛，三个月后会出现 5 种不同的错误模型。                                                                                                                                                                    |
| **最关键技术风险**       | 方向①的 SpreadsheetML 解析边界（`fast-xml-parser` 的 namespace 处理能力）、方向⑤的 Prod tree-shake 验证（`process.env.NODE_ENV` guard 的可 DCE 性）、四框架 Svelte 的元数据获取（`$state` 对 `component.name` 的干扰）。                                                                  |
| **建议优先执行的三件事** | ① Day 1 利益相关者会议确定方向三命运（30min 决策 → 影响 1 FTE 的释放或合并）；② Day 1-2 增加 `ErrorHandlingProtocol` 作为 P1-c，否则四个方向的错误处理会各自为政；③ Day 1-2 增加 `pnpm arch:inventory` + CI 集成，防止未来 AI 生成的架构分析再次出现事实错误。                            |
| **长期架构风险**         | 无。这份分析报告显示 Iris UI 的架构设计有足够的前瞻性，五方向扩展都被约束在 L0-L4 分层内，没有要求突破现有架构边界（如将渲染逻辑下沉 core、或引入框架依赖到 core）。这表明架构师在项目初期做的设计决策（A/B/C 分类、薄桥模式、token 驱动）经过 149 组件的考验后，仍然能容纳新方向的扩展。 |
