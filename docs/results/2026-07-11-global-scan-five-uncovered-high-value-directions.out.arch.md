# 架构师分析报告：Iris UI 跨验证评估

## 1. 架构评估

### 1.1 当前架构的优势

| 优势                           | 说明                                                                                                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **逻辑下沉原则清晰**           | `@iris-ui/core` 承载 A/B/C 三类逻辑，适配器仅做薄桥接。AGENTS.md 的 Rule 1（「逻辑下沉 core，适配器做薄桥」）是项目最坚固的架构契约                                                                                   |
| **插件契约设计整洁**           | `createPlugin`/`runPlugins` 机制隔离框架无关逻辑与 UI 渲染，`reg.registerTokens`/`registerMessages`/`registerStore` 三类注册点覆盖了扩展的核心诉求，且不做 `registerComponent` 是正确决策（避免类型/摇树/清单三牺牲） |
| **四框架对齐的工程投入回报高** | 149 组件四框架对齐的测试覆盖 + manifest 验证，证明了「同一套 core 工厂 + 四条薄桥」模式的可行性和可维护性                                                                                                             |
| **Token 杠杆效应显著**         | `var(--iris-*)` 体系实现了一行 token 管理 ≈800 行裸样式的效果，这是项目「生产就绪面闭环」的核心杠杆                                                                                                                   |
| **A/B/C 下沉分类心智模型成熟** | 「拿掉它，改变的是组件是什么/能做什么/用什么搭的」是高度可操作的判别标准，比传统的「复用 vs 非复用」更贴近架构决策本质                                                                                                |

### 1.2 当前架构的局限性

**局限一：Shell 层的「规则穿透」——核心架构债务**

跨验证揭示了一个关键发现：`packages/desktop` 下的 `permissions.ts`、`catalog.ts`、`depth.ts`、`remoteApp.ts`、`os.ts` 等文件属于 **纯 TypeScript 逻辑**，却没有下沉到 `@iris-ui/core`。这是规则的穿透——当团队在四框架 Shell 项目中快速迭代时，这类「纯逻辑但又不属于 UI 层级」的文件容易逃逸审查。

**影响**：

- 这些逻辑无法被 core 的测试门覆盖
- 无法被插件系统插件化消费
- 将来若扩展到第五个框架，这些文件要再复制一份
- 这是「架构原则逐渐失守」的信号弹

> **定性**：P1 架构债务。不是即刻爆炸，但它是「允许例外」的模式一旦确立后的后续扩散通道。

**局限二：异步数据层的缓存空白**

`createAsyncResource` 和 `createResourceController` 均缺乏缓存基础设施。当前实现中：

- 无请求去重（dedup）
- 无 TTL/过期机制
- 无 SWR（stale-while-revalidate）
- 无失效策略（invalidation）
- 无乐观更新与缓存回滚的联动

这在 CMS demo 等 CRUD 密集型场景中，会导致用户层做大量重复的「请求节流 + 手动缓存」胶水代码。

**影响**：这是 B（附加能力）类缺口。不用不进包，但一旦用上就暴露——目前 plugin-pro-table 等 CRUD 插件依赖此层，缺口直接影响真实应用开发体验。

**局限三：表单引擎缺少扩展点**

当前 `createFormMachine`/`createFormController` 是一个功能完善的表单引擎，但其扩展模型是封闭的（通过 `validators` 选项注入校验函数）。缺少中间件/插件体系意味着：

- 无法拦截 setValue 做联动自动填充（auto-fill）
- 无法在提交前后注入预处理/后处理逻辑
- 难以实现跨字段依赖验证（如 A > B 时 C 必填）
- 第三方插件无法「挂入」表单生命周期

**影响**：这是当前架构中最明显的「扩展性短板」。考虑到 AGENTS.md 已提及 `plugin-form-builder` 的路线图，这个缺口会直接阻塞后续产品化。

**局限四：Window Manager 的企业级缺口碎片化存在**

Multi-monitor、Alt+Tab 切换顺序、alwaysOnTop、session restore/state persistence 等缺口散落在多个分析文档中，从未被整合为一个统一的「企业级 Windows Manager 补全」方向。这种碎片化状态本身就是一个架构问题——缺乏系统性看待 Window Manager 的能力域。

### 1.3 关键设计决策合理性评估

| 决策                                       | 判断        | 理由                                                                                              |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| 不做 `registerComponent`                   | ✅ 正确     | 动态组件名牺牲类型安全 + tree-shaking + manifest 生成，Schema 驱动渲染用局部 `widgets` map 更合理 |
| 浮层用 `createFloatingMachine` 而非纯 prop | ✅ 正确     | 浮层有 `OPEN/CLOSE/TOGGLE` 明确事件语义，符合状态机判别准则                                       |
| Skin 引擎的 `extends` 机制                 | ✅ 正确     | 部分覆盖 + 继承的设计比完整的「从零定义」更符合皮肤市场的实际使用模式                             |
| IPC 用 `@floating-ui/dom` 而非自研定位引擎 | ✅ 正确     | 核心原则：不重复造已被验证的轮子，除非有不可妥协的产品差异                                        |
| 存储用 `pnpm workspace` + Turborepo        | ✅ 合理     | 大型 monorepo 的当前最佳实践组合，但需注意 `svelte-package` 的工具链异构成本                      |
| `createResourceController` 未内置缓存      | ⚠️ 值得商榷 | 在 CRUD 密集场景（plugin-pro-table）中缓存是不可跳过的需求，延迟引入会导致破坏性变更              |

### 1.4 架构债务清单

| 债务项                                  | 严重度  | 性质       | 估算修复成本                                              |
| --------------------------------------- | ------- | ---------- | --------------------------------------------------------- |
| Shell 层纯逻辑文件未下沉 core           | P1 中型 | 原则穿透   | 3-5 人日（文件移动 + 重构引用 + 验证四框架连通）          |
| AsyncResource/ResourceController 无缓存 | P1 中型 | 功能缺口   | 5-8 人日（设计 + 实现 cache wrapper + 测试）              |
| 表单引擎缺少中间件系统                  | P0 重大 | 架构缺口   | 8-12 人日（契约设计 + core 实现 + 适配器桥接 + 插件联动） |
| Window Manager 缺口碎片化               | P2 轻量 | 组织/意识  | 1-2 人日（系统化文档 + issue 整合 + 迭代计划）            |
| `plugin-form-builder` 尚未启动          | P2 轻量 | 路线图缺口 | —（非修复，是里程碑）                                     |

---

## 2. 扩展方向

### 2.1 方向一：异步数据缓存层（P0，高价值）

**业务价值**：

- `plugin-pro-table` 当前需要自己实现列表缓存，数据层引入缓存后，插件体积可减少 40%+
- CMS demo 中的分页/搜索/排序可直接受益，减少 60%+ 的重复请求
- 任何 CRUD 组件可零配置获得 SWR 体验

**技术价值**：

- 填补 core 层 B 类能力的最大缺口
- 为后续离线优先（Offline-First）能力奠定基础
- 测试覆盖从当前「纯链式调用验证」升级到「缓存行为验证」

**核心挑战**：

1. **去重 vs 幂等性**：相同请求的去重需要请求签名（method + url + params + body）的序列化哈希，但序列化顺序在不同环境下可能不一致
2. **SWR 的竞态处理**：stale 数据 + 后台刷新时需要处理多个并发刷新请求的优先级和取消
3. **乐观更新与缓存回滚**：乐观更新若失败，缓存需要回滚到之前的状态——这意味着缓存必须是版本化的快照，而非就地变异

**预期架构变更**：

```
当前：
createAsyncResource(fetcher, options) → { data, loading, error, run }

变更后：
createAsyncResource(fetcher, options, cache?) → { data, loading, error, run, invalidate }

同时新增：
createCacheProvider({ ttl, maxSize, storage }) → CacheProvider
withCache(resourceController, cacheProvider) → EnhancedResourceController
```

**对现有系统影响**：

- 向后兼容：`withCache` 是可选的 composable wrapper，不改变现有 API
- `createAsyncResource` 新增第三个可选参数 `cache?`，不影响无缓存调用方
- `createResourceController` 的 `list`/`get` 方法在缓存加持下返回同签名数据

### 2.2 方向二：表单中间件系统（P0，高价值）

**业务价值**：

- `plugin-form-builder` 若要在 2026 Q3 启动，中间件是其架构基础
- 跨字段依赖验证（如：当 `userType === 'admin'` 时 `permissions` 必填）的实现成本从 5 组件级行下降到 1 行中间件
- 第三方插件可注入自动填充、日志、分析等能力而无需修改表单组件

**技术价值**：

- 这是当前 core 层「扩展性」的最大缺口
- 中间件模式是插件系统的天然延伸：`reg.registerMiddleware` 可以复用现有的 `createPlugin`/`runPlugins` 基础设施

**核心挑战**：

1. **中间件的执行顺序和优先级**：多个中间件可能冲突（如两个中间件都想修改同一个值），需要定义优先级策略
2. **async 中间件的阻塞与超时**：`beforeSubmit` 中间件可能是 async 的（如校验请求），超时/失败的处理策略
3. **与现有验证系统的集成**：现有的 `validators` 选项和中间件的 `onValidate` 钩子如何共存——是前者委托给后者，还是两者并行执行？

**预期架构变更**：

```
当前：
createFormController({ fields, validators }) → { setValue, submit, ... }

变更后：
createFormController({ fields, validators, middlewares }) → { setValue, submit, ... }

// core 新增中间件类型
interface FormMiddleware {
  name: string
  priority?: number
  beforeSetValue?: (field: string, value: unknown, form: FormState) => MaybePromise<unknown>
  afterSetValue?: (field: string, value: unknown, form: FormState) => MaybePromise<void>
  beforeSubmit?: (values: Record<string, unknown>, form: FormState) => MaybePromise<Record<string, unknown>>
  afterSubmit?: (result: unknown, form: FormState) => MaybePromise<void>
  onFieldRegister?: (field: string, config: FieldConfig) => MaybePromise<FieldConfig>
}

// 插件集成
createPlugin({ name: 'form-auto-fill', install(reg) {
  reg.registerMiddleware('form', autoFillMiddleware)
}})
```

**对现有系统影响**：

- 完全向后兼容：中间件是「新增可选参数」，现有代码无需修改
- 验证系统可逐步迁移：先让 `validators` 内部转换为中间件，对外保持 API 一致
- 适配器变化极小：只需将 `middlewares` 选项向下透传到 core

### 2.3 方向三：Shell 层纯逻辑文件下沉（P1，中高价值）

**业务价值**：

- 消除四框架 Shell 项目的重复维护成本（~5 个纯逻辑文件 × 4 框架 = 20 份副本）
- 权限、分类、深度计算等逻辑可被插件系统和非 Shell 组件消费

**技术价值**：

- 修复架构原则穿透——这是维护「逻辑下沉 core」契约信誉的关键
- 纯逻辑文件下沉后，单测覆盖率和边界条件覆盖会显著提升

**核心挑战**：

1. **依赖解耦**：`permissions.ts` 可能依赖 Shell 特定的枚举/类型，下沉前需要先消除这些依赖
2. **版本兼容**：现有 Shell 组件的导入路径需迁移，需确保四框架同步更新
3. **命名冲突**：core 层的目录结构和命名约定可能需要扩展以容纳「Shell 共享逻辑」

**预期架构变更**：

```
当前：
packages/desktop/src/{react,vue,solid,svelte}/{permissions,catalog,depth,remoteApp,os}.ts

变更后：
@iris-ui/core/desktop-shared 或 @iris-ui/desktop-shared
  ├── permissions.ts
  ├── catalog.ts
  ├── depth.ts
  └── os.ts

各框架 Shell：
packages/desktop/src/{react,vue,solid,svelte}/ 移除上述文件，转导入 @iris-ui/desktop-shared
```

**对现有系统影响**：

- 中等影响：需要修改 4 个 Shell 项目中的 import 路径
- 低影响：不改变任何运行时行为或组件 API
- 需注意：如果这些文件中有与框架相关的导入（如 React hooks），需要先做分离

### 2.4 方向四：Window Manager 企业级补全（P1，中价值）

**业务价值**：

- 多显示器支持是桌面应用的基线需求，非差异化特性
- Alt+Tab 切换顺序（`tabOrder`）和 `alwaysOnTop` 是企业级应用的常见需求
- Session 持久化是「CMS demo → 生产部署」的关键差距

**技术价值**：

- 将散落的缺口整合为统一的能力域，建立系统化的质量基线
- `alwaysOnTop` 的实现涉及 z-index 分层管理，这是一类缺失的能力

**核心挑战**：

1. **平台抽象**：多显示器检测（`Screen` API）和 session 存储（`localStorage`/`IndexedDB`）在不同运行时（electron vs web vs Tauri）的行为差异
2. **Alt+Tab 的 Tab 顺序**：需要定义 `tabOrder` 的计算策略（最近使用 vs 从左到右 vs 用户自定义），且需要与 Window Manager 的状态同步
3. **Session 持久化的序列化边界**：存储哪些状态（窗口位置/大小/是否最小化/打开的文档列表）和哪些不应存储（临时缓存/编辑器未保存内容）

**预期架构变更**：

```
当前：
createWindowManager(initialWindows) → { open, close, focus, minimize, maximize, ... }

变更后：
// 新增多显示器支持
interface MultiMonitorConfig {
  getMonitors: () => Monitor[]
  constrainToMonitor?: boolean
}

// 新增 Z-index 分层
type ZLayer = 'alwaysOnTop' | 'normal' | 'alwaysOnBottom'

// 新增 Alt+Tab 支持
interface TabOrderConfig {
  strategy: 'mru' | 'ltr' | 'custom'
  customOrder?: string[]
}

// 新增 Session 持久化
interface SessionConfig {
  storage: SessionStorage
  serialize: (state: WinState) => SerializableState
  deserialize: (data: SerializableState) => WinState
}
```

**对现有系统影响**：

- 低影响：所有新能力都是 additive options（默认关闭、非破坏性）
- 无需修改现有 Window Manager 的 API 签名
- 但需注意 `alwaysOnTop` 可能影响现有布局引擎的假设

### 2.5 方向五：跨应用消息总线的 Request-Response 增强（P2，中低价值）

**业务价值**：

- Request-response 模式（`request(topic) → Promise<Response>`）比纯发布-订阅更适合配置获取、权限查询等查询场景
- 生命周期感知路由（通过 Window Manager）可以避免「已关闭窗口仍在收消息」的问题

**技术价值**：

- 与现有 IPC 分析形成互补，而非替代
- 为 AppShell 生态的应用间通信提供类型安全的协议

**核心挑战**：

1. **请求超时和错误传播**：`request()` 返回 Promise，需要定义超时行为和错误类型
2. **响应者冲突**：如果多个应用订阅了同一 topic，哪个响应者的回复被采纳？是 first-response-wins 还是 last-response-wins？
3. **Window Manager 集成**：生命周期感知路由需要 Window Manager 暴露窗口状态快照

**预期架构变更**：

```
在当前 IPC 分析的基础上，增加 request-response 模式：
createMessageBus({ windowManager }) → {
  publish: (topic, payload) → void,
  subscribe: (topic, handler) → Unsubscribe,
  request: (topic, payload, options?) → Promise<Response>,
  respond: (topic, handler) → Unsubscribe  // 匹配 request
}
```

**对现有系统影响**：

- 低影响：这是增量增强，不在当前架构中
- 优先级低于上述四个方向，因为现有 IPC 分析已覆盖 80% 相同的设计空间

---

## 3. 接口设计建议

### 3.1 关键设计原则

**原则一：Composable Wrapper 优先于内置选项**

`withCache(resourceController, cache)` 是比 `createResourceController({ cache: true })` 更优的模式：

| 维度     | Wrapper 模式                               | 内置选项模式                 |
| -------- | ------------------------------------------ | ---------------------------- |
| 可测试性 | Cache 逻辑可独立测试                       | 需要完整的 controller 上下文 |
| 可摇树   | 不用缓存不进包                             | 选项编译时无法排除           |
| 组合性   | 可多层嵌套（withCache(withRetry(resCtl))） | 多层选项导致配置爆炸         |
| 向后兼容 | 零影响                                     | 需要默认值处理               |

**建议**：所有「附加能力」优先采用 wrapper 模式，仅当该能力是组件不可分割的身份特征时才内置。

**原则二：可选参数的渐进接口**

中间件/缓存/Window Manager 增强都采用「可选参数，渐进暴露」的策略：

```
// 第一阶段：支持中间件
createFormController({ middlewares: [...] })

// 第二阶段：支持开箱即用的中间件（从不改变已有 API）
createFormController({ middlewares: [autoFill, logChanges] })

// 第三阶段：插件注入
reg.registerMiddleware('form', autoFillMiddleware)
```

**原则三：框架无关的接口契约**

所有新接口定义在 `@iris-ui/core`，适配器仅做类型透传。这是 AGENTS.md Rule 1 的延伸应用。

### 3.2 引入新的抽象层

**建议引入以下抽象层**：

| 新抽象层                                    | 位置                   | 理由                                                           |
| ------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `@iris-ui/cache` (或 `@iris-ui/core/cache`) | 独立模块或 core 子路径 | 缓存逻辑与异步操作独立，且可能被多个 consumer 共享             |
| `@iris-ui/desktop-shared`                   | 独立包                 | Shell 纯逻辑文件下沉的合理归宿，避免在 core 中引入桌面特定概念 |
| `FormMiddleware` 类型系统                   | `@iris-ui/core/form`   | 中间件类型是表单引擎的核心扩展点                               |

**不建议引入**：

| 建议引入但否决             | 理由                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| 独立的 IPC 中间件层        | IPC 当前用户故事不足以支撑抽象层，一个 `createMessageBus` 函数足矣 |
| Window Manager 的插件系统  | Window Manager 的扩展点有限，用选项配置优于插件注册                |
| 独立的 `IrisShellProvider` | Shell 的跨框架共享逻辑占比较低（~5 文件），不值得新增 Provider     |

### 3.3 向后兼容策略

| 变更                                              | 兼容策略                                                   |
| ------------------------------------------------- | ---------------------------------------------------------- |
| 新增 `createAsyncResource` 的 `cache` 参数        | 可选参数，不传则行为与当前完全一致                         |
| 新增 `createFormController` 的 `middlewares` 参数 | 可选参数，不传则中间件列表为空                             |
| `withCache` wrapper                               | 完全组合式，不改变任何已有 API                             |
| Shell 纯逻辑文件移动                              | 旧路径保留 `deprecated` 标记导出一周期，新版本文档通知迁移 |
| Window Manager additive options                   | 所有新选项默认关闭，默认行为不变                           |
| 新增 `@iris-ui/desktop-shared`                    | 新包，不影响现有依赖                                       |

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

**不需要引入新的框架或库**。所有五个方向均可基于现有技术栈实现：

| 方向                 | 可能考虑的新依赖         | 建议                                                                             |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| 缓存层               | `lru-cache`、`quick-lru` | **自建**：缓存需求简单（TTL + LRU + 可插拔存储），不应引入第三方。~50 行核心逻辑 |
| 表单中间件           | —                        | **零依赖**：纯控制流模式，无需新依赖                                             |
| Shell 下沉           | —                        | **零依赖**：纯文件移动                                                           |
| Window Manager       | `screen` API             | **平台 API**：浏览器原生 `Screen` API + `localStorage`，无需第三方               |
| IPC request-response | —                        | **零依赖**：在现有 `MessageBus` 之上增强                                         |

**唯一可考虑的第三方**：`@vueuse/core` 等框架工具库的 `useStorage`/`useMediaQuery`——但 iris-ui 已有自己的 `createThemeStore`/`SkinStorage` 抽象，应优先复用。

### 4.2 第三方依赖评估标准

对于未来可能引入的新依赖，建议采用以下四维评估：

```
必要性（1-5）：有无替代方案？
  5 = 无可替代的核心能力（如 Tiptap 对于富文本编辑器）
  1 = 纯语法糖（如 lodash.get）

稳定度（1-5）：生产就绪度？
  5 = 1.0+，每周下载量 > 100 万，有企业用户
  1 = < 1.0，维护者 < 2 人

体积（1-5）：对 bundle 的影响？
  5 = < 5KB gzip
  1 = > 50KB gzip

集成成本（1-5）：与现有架构的契合度？
  5 = 零配置，纯 ESM，框架无关
  1 = 需要 adapter/wrapper，有副作用

总分 >= 16：可考虑
总分 10-15：需架构评审
总分 < 10：拒绝
```

**示例**：如果未来需要离线存储，评估 `idb`（IndexedDB wrapper）：

- 必要性：4/5（IndexedDB API 太底层，但不缺替代如 Dexie）
- 稳定度：5/5（成熟，广泛使用）
- 体积：3/5（~8KB gzip）
- 集成成本：4/5（纯 ESM，无框架绑定）

总分 16 → **可考虑**，但推荐自建更轻量的 wrapper。

### 4.3 自建 vs 采购决策依据

Iris UI 的定位是 UI 基础设施，其架构原则天然偏向自建：

| 层                                    | 自建            | 采用第三方             |
| ------------------------------------- | --------------- | ---------------------- |
| **Core 逻辑**（cache/middleware/IPC） | ✅ 始终自建     | ❌ 核心身份不可委托    |
| **渲染层**（富文本/图表/地图）        | ❌ 自建成本极高 | ✅ 通过插件封装第三方  |
| **工具/材料**（color/date 计算）      | ✅ 自建（已有） | ⚠️ 可参考但不应依赖    |
| **测试/构建**                         | ❌ 不是价值所在 | ✅ Vitest/esbuild/tsup |

**关键决策规则**：

1. 如果该能力是「A 核心/身份」→ 自建，零妥协
2. 如果该能力是「B 附加」且通过插件封装 → 可考虑第三方，但插件内部的适配仍由 iris-ui 控制
3. 如果该能力是「构建/部署/测试」工具链 → 采用行业标准，不自建

---

## 5. 实施路线图

### 5.1 优先级排序

```
P0（立即 — 2026 Q3）
├── 表单中间件系统（方向⑤）
│   └── 理由：plugin-form-builder 的架构依赖；完全新颖；影响范围可控
│
P0（立即 — 2026 Q3）
├── 异步数据缓存层（方向③）
│   └── 理由：plugin-pro-table 的即时受益者；CRUD 密集场景的核心缺口
│
P1（2026 Q3-Q4）
├── Shell 纯逻辑文件下沉（方向①）
│   └── 理由：修复架构原则穿透；需跨团队协调四框架同步
│
P1（2026 Q4）
├── Window Manager 企业级补全（方向④）
│   └── 理由：多用户/企业场景需求；新增能力默认关闭，风险低
│
P2（2027 H1）
├── IPC Request-Response 增强（方向②）
│   └── 理由：与现有分析 80% 重叠；需与 IPC 分析作者合并设计
```

### 5.2 阶段划分和里程碑

```
Phase 1: Core 扩展（2026 Q3, ~6-8 周）
├── Week 1-2：表单中间件契约设计 + core 实现
│   └── Milestone: FormMiddleware 类型 + 执行引擎通过单测
├── Week 3-4：缓存层设计 + withCache wrapper
│   └── Milestone: CacheProvider + withCache 通过单测
├── Week 5-6：四框架适配器桥接
│   └── Milestone: 表单中间件 + 缓存层在四个 playground 可用
└── Week 7-8：plugin-pro-table 集成缓存
    └── Milestone: pro-table CRUD 缓存场景端到端测试通过

Phase 2: 架构清洗（2026 Q4, ~4-5 周）
├── Week 1-2：Shell 纯逻辑文件下沉分析 + 依赖解耦
│   └── Milestone: 所有纯逻辑文件可独立导入 core
├── Week 3：新包 @iris-ui/desktop-shared 发布
│   └── Milestone: 四框架 Shell 迁移至新包
└── Week 4-5：Window Manager 增强
    └── Milestone: multi-monitor + alwaysOnTop + Alt+Tab 策略

Phase 3: 场景深化（2027 H1, ~6-8 周）
├── IPC request-response + Window Manager 集成
├── Plugin-form-builder 基于中间件启动
└── 全量回归测试 + size预算 + arch-check
    └── Milestone: 所有新能力通过质量门
```

### 5.3 风险点和缓解策略

| 风险                                                          | 概率 | 影响 | 缓解策略                                                                   |
| ------------------------------------------------------------- | ---- | ---- | -------------------------------------------------------------------------- |
| **缓存层与现有 `createAsyncResource` 的 API 兼容性问题**      | 中   | 高   | 采用 wrapper 模式（零侵入）；在阶段一预留「内部迁移」窗口                  |
| **表单中间件与其他提交后行为（如 toast/导航）的执行顺序冲突** | 中   | 中   | 中间件支持 `priority` 字段；在设计中做冲突矩阵测试                         |
| **Shell 逻辑文件依赖桌面特定类型，无法干净下沉**              | 高   | 中   | 先做依赖分析图；必要时在 core 中新增 `desktop-shared` 子路径而非核心模块   |
| **Window Manager 增强在 Svelte 适配中遇到 rerender 问题**     | 低   | 高   | 参考 Svelte 测试陷阱清单；在阶段二引入，优先在 React playground 验证再铺开 |
| **团队疲劳导致架构原则再次失守**                              | 中   | 高   | 新增 `arch-check` 规则：禁止纯逻辑文件出现在适配器目录中；CI 门新增检查    |
| **IPC request-response 与现有分析合并设计时的方向分歧**       | 中   | 低   | 在阶段三启动前先做 `rfc` 流程，合并设计文档 + 架构评审                     |

### 5.4 风险缓解的工具/流程建议

1. **新增 `arch-check` 规则**：在 CI 中增加一步，扫描 `packages/*/src/{react,vue,solid,svelte}` 目录下所有不包含框架 API（`React.createElement`/`h()`/`createSignal`/`$state`）的 TypeScript 文件，**标记为潜在架构违规**。这是防止「原则再次失守」的自动化护栏。

2. **新增 `rfc`（Request for Comments）流程**：对跨包、影响多框架的架构变更，要求在 `docs/rfc/` 下提交设计文档，至少一位非原作者架构师 review 后进入实施。这适用于 IPC request-response 和 Window Manager 这类「需要合并多个分析视角」的方向。

3. **在 `manifest.json` 中增加「能力标签」**：每条导出记录增加 `category: 'core' | 'controller' | 'hooks' | 'util' | 'plugin'`，配合 `arch-check` 可自动审计「插件逻辑驻留在 core 包」等违规。

---

## 总结

本次跨验证评估的五个方向中，**表单中间件系统（⑤）** 和 **异步数据缓存层（③）** 是最具架构价值的两个方向。前者填补了 core 层扩展性的最大缺口，后者的 `withCache` wrapper 模式比已有的 `AsyncResource` 缓存分析更清洁。

最关键的建议是：**从「发现缺口」转向「建立护栏」**。Shell 层纯逻辑文件的「原则穿透」不是一次性事件，而是缺乏自动化检测的结果。在推进上述五个方向的同时，建立 `arch-check` 自动审计机制比修复任何一个方向都更具长期价值——因为它让「架构原则」从文字变成可执行的代码。

五个方向中，唯一需要谨慎对待的是 IPC request-response——不是因为它没有价值，而是因为与现有分析的重叠度高达 80%，需要在合并设计后以「增量」而非「替代」的姿态推进。
