现在我已全面理解源码和文档。以下是我的架构分析。

---

# 架构分析：5 个代码级边界面与优化方向

## 1. 架构评估

### 当前架构的优势

在分析这 5 个方向之前，有必要先肯定当前架构中做对的部分：

- **core 下沉模式运行良好**：四框架适配器的 `useForm` 桥是真正的薄层（React/Vue/Svelte 各 ~50 行），所有表单逻辑集中在 `core/src/form.ts`。验证了 AGENTS.md 中"逻辑下沉 core，适配器做薄桥"的原则。
- **无外部依赖的约束是有原则的**：针对 Standard Schema 验证，框架选择自己实现映射层而非依赖 Zod/Valibot，保持了 `@iris-ui/core` 零框架依赖的承诺。
- **Store 抽象统一了框架**：`createStore` 在四个框架间提供了统一的反应式基元，`subscribeWith` 的选择性子订阅是超越朴素实现的附加值。

### 五个方向的架构含义

| 方向                        | 暴露的架构缺口                                                                                                                                   | 严重程度                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 1. Standard Schema 首错即止 | **类型设计限制了功能边界**：`FieldErrors<V>` 的 `string` 值类型预先排除了聚合错误。这是类型即文档（和限制）的情况。                              | **P1** — 类型定义被下游消费，影响形式 |
| 2. Date math DST 边界       | **使用原生 `Date` 对象作为域模型是欠抽象的**：日期类操作应该使用 `CalendarDate` 纯值（类似于 `@internationalized/date`），但选择了更简单的路径。 | **P1** — 数据损坏风险                 |
| 3. Aggregate 浮点精度       | **数字精度被视为非功能性，但实际是功能性的**：对于面向财务的 pro-table 场景，合计行偏差是功能性 bug，不是性能问题。                              | **P2** — 规模触发                     |
| 4. 通知去重/分组/更新       | **通知中心是纯 append-only 的数据结构，不是用户态通知模型**：无分组键、无更新、无计数——这是桌面操作系统的筛选标准，但 core 没达到。              | **P2** — UX 降级                      |
| 5. Debounce cancel 生命周期 | **FormStore 完全没有生命周期管理**：无 `destroy()`/`dispose()`，无需要时清理 debounce 定时器的机制。React 适配器特别脆弱——无显式清理。           | **P1** — 可复现的数据竞争             |

### 关键设计决策评估

1. **"类型即契约" vs "类型即限制"**（方向 1）：`FieldErrors<V> = Record<..., string>` 是一个跨越了"简单就够用"和"为真实场景设计"之间界限的设计决策。对于最基本的表单（每个字段一个错误），它完全足够。但对于复合验证（Zod chains、refinements），它在类型层面切断了完整错误报告的可能性。**这个决策当初是正确的（YAGNI），但现在需要演进。**

2. **原生 Date vs 日期库**（方向 2）：选择原生 `Date` 是为了零依赖。考虑到 Iris UI 的 `Calendar`/`DatePicker` 跨越四个框架 × 多个皮肤，选择一个日期库会在每个框架适配器上产生依赖。零依赖的权衡是 DST bug。**正确的权衡，但缓冲不足**——需要一层防御性抽象。

3. **FormStore 无 dispose**（方向 5）：在 `FormStore` 上不提供 `destroy()` 方法意味着 core 层没有地方可以 cancel debounce、释放订阅或清理副作用。Vue 适配器通过 `onBeforeUnmount` 只清理了订阅，但 React 适配器（使用 ref）没有显式清理，所有四个适配器都没有清理 debounce 定时器。**这是一个架构缺口**——core 拥有状态和定时器，但没有暴露生命周期挂钩让适配器协调清理。

### 架构债务

1. **FormStore 缺少 `destroy()`**：所有四个框架都需要一种方法来告诉表单"我正在卸载，请清理"。当前，core 拥有可变状态和定时器，但上层无法在卸载时发信号。

2. **FieldErrors 作为单值类型**：改变为 `string | string[]` 需要在四个框架中进行类型级更改，但这是向后兼容的（`string` 是 `string | string[]` 的子类型）。

3. **日期操作没有 DST 安全层**：`date.ts` 的函数是纯的但基于本地时间。`startOfDay` 等函数会在 DST 边界返回错误结果，这需要调用方了解。一个围绕 UTC 日期数学的简单包装层将消除这种认知负担。

4. **通知中心只有 append**：`DesktopNotification` 接口缺少 `group`、`count`、`timestamp` 字段。将 `post()` 扩展为支持去重需要接口演进。

---

## 2. 扩展方向

基于对这 5 个方向的架构分析，我确定了 5 个高价值的架构扩展方向，每个都在现有缺口基础上构建。

### 方向 A：表单 Store 生命周期契约

**为什么需要**：5 个方向中的 2 个（方向 1 的标准 Schema 类型和方向 5 的 debounce cancel）源自同一个根源——FormStore 没有正式的 dispose 契约。添加它将一举解决 debounce 清理、验证 token 管理和字段级订阅清理。

**核心挑战**：

- 向后兼容：`destroy()` 必须对所有现有调用方安全（当未调用时，当前行为保持不变）
- 框架集成：每个框架适配器必须在其卸载挂钩（React 的 `useEffect` 清理、Vue 的 `onBeforeUnmount`、Solid 的 `onCleanup`、Svelte 的 `$destroy`/`unsubscribe`）中调用 `destroy()`
- `reset()` vs `destroy()` 语义：reset 不应释放 debounce——它应该 cancel pending 写入然后重新初始化。destroy 是最终的。

**预期架构变更**：

```
// core/src/form.ts
export interface FormStore<V> {
  // 现有方法…
  /** 释放表单：cancel pending 写入和验证；
   *  不调用 store 的订阅清理（适配器负责）；
   *  在此对象上调用任何其他方法都是未定义行为。 */
  destroy(): void
}
```

`destroy()` 实现：

1. 遍历 `fieldDebouncers` 和 `fieldFlushers` 并调用 `.cancel()`
2. 清除所有 buffers 和 maps
3. 可选：设置 `_destroyed` 标志，在已销毁状态下调用 setter 时抛出

**对现有系统的影响**：极低。这是一个纯加法。如果框架适配器选择不调用 `destroy()`，行为完全不变。通过 lint 规则或框架适配器更新来逐步采用。

### 方向 B：FieldErrors 从单值演进为多值

**为什么需要**：方向 1 明确指出了问题——Standard Schema 可以为一个字段返回多条错误，但 `FieldErrors` 类型只允许单条字符串。修复类型将解锁完整的 Zod/Valibot 错误报告。

**核心挑战**：

- 向后兼容：所有现有代码使用 `errors[key]` 作为 `string | undefined`。改变为 `string | string[] | undefined` 需要仔细的消费方处理。
- 渲染层：四个框架中的 `FormField` 组件当前假设 `error` prop 是单个字符串。需要支持渲染多条错误。
- `validate()` 回调的返回类型：`FormConfig.validate` 当前返回 `FieldErrors<V>`。如果值变成数组，自定义验证器需要更新。

**选项和权衡**：

| 选项                              | 描述                                                                  | 权衡                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A. 联合类型**                   | `FieldErrors<V> = Record<..., string \| string[]>`                    | 完全向后兼容；所有现有读取方继续工作（`string` 是 `string \| string[]` 的子类型）。但新读取方需要 `Array.isArray` 检查。 |
| **B. 始终数组**                   | `FieldErrors<V> = Record<..., string[]>`                              | 破坏性变化。简化了消费方逻辑（始终 `error.join(', ')`），但需要更新所有框架适配器和组件。                                |
| **C. 内部数组，对外暴露单字符串** | 内部存储 `string[]`，但 `getFieldError` 返回 `string`（用 `, ` 连接） | 保存完整数据的同时不改变公共 API。但丢失了结构化的多条错误能力（无法单独样式化）。                                       |

**推荐**：**选项 A**（联合类型）。它是最低风险的演进路径。在消费方添加一个 `renderError(error)` 工具函数，统一处理 `string` 和 `string[]`。

**预期架构变更**：

```ts
// core/src/form.ts
export type FieldErrors<V> = Partial<Record<Key<V> | (string & {}), string | string[]>>
```

相应的适配器桥接和 `FormField` 组件需要支持渲染多条错误。

### 方向 C：日期数学抽象——从原生 Date 到 UTC-first CalendarDate

**为什么需要**：方向 2 中详述的 DST bug 源于对原生 `Date` 的依赖。一旦日期组件跨越 DST 边界，出错的不是边缘情况——它是时间处理中一个已知的反模式。Radix UI 使用 `@internationalized/date` 的 `CalendarDate` 有充分的理由。

**核心挑战**：

- 零依赖约束：`@internationalized/date` 是 12KB（压缩前）。添加它会破坏 `@iris-ui/core` 当前的零依赖状态。
- API 兼容性：所有日期组件和许多工具函数目前接收/返回 `Date`。改变为新的日期类型将需要对所有四个框架的 Calendar、DatePicker、DateRangePicker、TimePicker 进行重大重构。
- 序列化：`Date` 序列化为 JSON 为 ISO 字符串。自定义 `CalendarDate` 类型需要自己的序列化策略。

**选项和权衡**：

| 选项                                | 描述                                                                                                                                                            | 权衡                                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. 自建 UTC-only 包装器**         | 在内部将所有日期数学切换为 UTC 方法（`getUTCFullYear`/`setUTCDate`/…）。公共 API 仍接受/返回 `Date`，但所有计算在 UTC 下进行。                                  | 零依赖。修复了 DST bug。但公共 API 返回的 `Date` 对象具有 UTC 时间（例如 `00:00:00Z`），当转换为本地显示时可能显示为前一天的 `19:00`。显示层需要注意。 |
| **B. 使用 @internationalized/date** | 采用 Radix 使用的库。创建纯日期值（`CalendarDate`），不具备时区概念。                                                                                           | 增加 12KB 依赖。最安全的日期处理。需要更改所有日期组件和四个框架。                                                                                     |
| **C. 当前时间戳数学 + UTC 防御**    | 仅修复 `date.ts` 中已知有问题的函数：将 `setHours(0,0,0,0)` 切换为 `setTime(date.getTime() - date.getTime() % 86400000)`；将 `addDays` 切换为基于时间戳的加法。 | 零依赖。最小更改。但 `addMonths` 等更复杂的函数仍面临 DST 问题。长期来看不太安全。                                                                     |

**推荐**：**混合方案——选项 C 立即修复 + 选项 A 作为中期路线图**。立即用 UTC/时间戳替代替换已知有问题的函数。在下一个主要版本中，引入一个内部的 `CalendarDate` 辅助类型（零依赖）并逐步迁移组件。
对于目标 DST，只需在 `date.ts` 中将 `setHours(0,0,0,0)` 替换为 `d.setTime(d.getTime() - d.getTime() % 86400000)`（取模到天数边界），并将 `addDays` 替换为基于时间戳的加法。

### 方向 D：通知中心的语义扩展——去重、分组、更新

**为什么需要**：方向 4。桌面操作系统案例（`apps/desktop-os-*`）是 Iris UI 最面向公众的项目。通知中心是操作系统的核心 UX 组件。当前的纯 append-only 实现与其说是通知中心，不如说是一个 toast 列表。

**核心挑战**：

- 向后兼容的接口演进：添加 `update()` 和 `dismissGroup()` 方法不能破坏现有消费者。`post()` 需要去重语义。
- 去重策略：按 `title + body` 去重？按 `appId + 自定义 group key`？需要一个配置项。
- 计数语义：当同组通知合并时，一个 `count` 字段允许 UI 显示"3 条新消息"而不是三条重复消息。

**预期架构变更**：

```ts
// core/src/notifications.ts
export interface DesktopNotification {
  id: string
  title: string
  body?: string
  icon?: string
  appId?: string
  tone: NotificationTone
  timeout: number
  /** 新增 */
  group?: string // 分组键（例如 appId + category）
  count?: number // 同组通知的累积计数
  timestamp: number // 排序/过期
}

export interface NotificationInput {
  title: string
  body?: string
  icon?: string
  appId?: string
  tone?: NotificationTone
  timeout?: number
  group?: string // 可选分组
  /** true = 如果找到同 title+body 的已有通知则原地更新，否则正常追加 */
  dedupe?: boolean
}

export interface NotificationCenter {
  // 现有方法…
  post(input: NotificationInput): string
  dismiss(id: string): void
  dismissAll(): void
  list(): DesktopNotification[]
  // 新增
  update(id: string, input: Partial<NotificationInput>): void
  dismissGroup(group: string): void
  dismissApp(appId: string): void
}
```

**向后兼容策略**：所有新增字段和方法都是可选的。现有的 `post({ title, body })` 调用在没有 `group` 或 `dedupe` 的情况下保持完全相同的 append 行为。`update()` 和 `dismissGroup()` 是纯加法。

### 方向 E：Kahan 求和作为聚合精度层

**为什么需要**：方向 3。虽然 Kahan 求和对于均匀分布的数据集上的双精度浮点数来说被夸大了（例如 10000 个 `0.1`），但真正的价值在于：

1. **架构安全性**：`aggregate.ts` 是 pro-table CRUD 和 CMS 仪表盘的核心材料。一个已知的舍入误差来源应该被消除，即使它很少触发。
2. **防御性设计**：Kahan 求和是 6 行纯函数——没有外部依赖，没有测试风险。类比：水管的"防回流阀"——你 99.9% 的时间不需要它，但当你需要时，你非常需要它。
3. **审计信任**：财务合计中的一分钱误差就会破坏信任。

**对现有系统的影响**：无。纯替换实现。所有现有测试继续通过。性能影响可忽略（每次加法增加 3 次操作）。

---

## 3. 接口设计建议

### 关键模块接口设计原则

1. **FormStore：用 `destroy()` 补全生命周期**

当前缺失。建议增加：

```
FormStore.destroy(): void
```

契约：

- 幂等：多次调用是安全的
- Cancel 所有 pending debounce、验证、异步操作
- 不清除 store 的订阅（适配器拥有返回的 unsubscribe 函数）
- 可选：在已销毁状态下调用 setter 时抛出错误（通过标志）

2. **FieldErrors：用联合类型演进**

```
type FieldErrors<V> = Partial<Record<Key<V> | (string & {}), string | string[]>>
```

并且在 `core/src/form.ts` 中添加一个辅助函数：

```
function normalizeFieldError(error: string | string[] | undefined): string[]
```

在消费方使用，统一处理两种形式。

3. **日期：UTC-first 内部表示**

不对外改变 `Date` API，但在内部将所有日期数学切换为 UTC：

```
// 内部实现模式
function startOfDay(date: Date): Date {
  const d = new Date(date)
  // 使用 UTC 方法避免 DST 偏移
  d.setTime(d.getTime() - d.getTime() % 86400000)
  return d
}
```

4. **通知中心：用可选去重扩展**

所有新增字段和方法都有默认行为，与当前实现完全相同。`post()` 的 `dedupe?: boolean` 参数可选——当为 `true` 时，检查 `title + body + group` 是否匹配已有通知并在原地更新 `count`。

### 是否需要新的抽象层

| 新抽象层                                          | 必要吗？ | 理由                                                                                                    |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `FormLifecycle` (用于 dispose/cleanup 的独立接口) | **否**   | 将 `destroy()` 添加到 `FormStore` 就足够了。独立的接口会增加不必要的复杂性。                            |
| `CalendarDate` (纯日期值)                         | **可能** | 如果切换到选项 B（使用 `@internationalized/date`），则隐式需要。如果停留在 UTC-first `Date`，则不需要。 |
| `NotificationGroupStrategy` (去重/分组策略)       | **否**   | 一个可选的 `dedupe` 标志和 `group` 字符串就足够了。策略模式在这里是过度工程化。                         |
| `PrecisionStrategy` (可插入的求和算法)            | **否**   | Kahan 求和应该是默认且唯一的实现。让求和算法可配置会增加复杂性而没有收益。                              |

### 向后兼容性策略

对于所有五个方向，向后兼容是可能的：

| 方向                 | 兼容策略                                                                               |
| -------------------- | -------------------------------------------------------------------------------------- |
| 1. FieldErrors 多值  | `string \| string[]` 联合类型——`string` 值赋值给 `string \| string[]` 字段是类型安全的 |
| 2. DST 安全的日期    | 纯内部实现更改；公共签名不变                                                           |
| 3. Kahan 求和        | 纯内部实现更改；公共签名不变                                                           |
| 4. 通知去重/分组     | 新增可选字段和纯加法方法                                                               |
| 5. FormStore destroy | 纯加法方法；不破坏现有代码                                                             |

---

## 4. 技术选型

### 是否需要引入新的技术栈或框架

| 方向                      | 需要新依赖吗？          | 推荐                                                                         |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| 1. Standard Schema 多错误 | 否                      | 纯类型 + 逻辑更改                                                            |
| 2. DST 安全的日期         | 否 (短期) / 可能 (长期) | 短期：UTC-first `Date` 数学。长期：考虑 `@internationalized/date` ≥ 主要版本 |
| 3. Kahan 求和             | 否                      | 6 行纯 TypeScript                                                            |
| 4. 通知去重/分组          | 否                      | 纯逻辑更改                                                                   |
| 5. FormStore destroy      | 否                      | 纯逻辑更改                                                                   |

**结论**：这五个方向都不需要新的依赖。Iris UI 目前的零外部依赖约束是可行的。

### 第三方依赖评估标准

如果将来确实需要依赖（例如，`@internationalized/date` 用于主要 DST 修复），这里是评估标准：

| 标准         | 要求                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 包大小       | < 5KB 压缩后（对于 `@iris-ui/core`）；如果是框架适配器依赖则可以更大 |
| 框架特定性   | 框架无关（如果用于 core）                                            |
| TS 严格性    | 严格的 TypeScript 支持                                               |
| 许可证兼容性 | MIT/Apache-2.0                                                       |
| 浏览器覆盖率 | 支持 > IE11                                                          |
| 树摇         | 必须支持                                                             |
| 维护者       | 活跃维护（过去 12 个月内有发布）                                     |
| 备选方案     | 至少存在一个稳定的备选方案                                           |

### 自建 vs 外包决策

对于这些方向，所有都是"自建"——这正是 Iris UI 架构的优势所在：

| 方向              | 为什么自建正确                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| Kahan 求和        | 6 行代码。如果使用 Lodash 的 `sumBy` 是荒谬的——它甚至没有 Kahan 求和。 |
| FieldErrors 多值  | 纯类型逻辑。没有库提供"表单错误类型演化"。                             |
| DST 安全的日期    | 零依赖约束使自建成为唯一选项（除非我们放弃零依赖，我认为不应该放弃）。 |
| 通知去重          | 纯逻辑。没有专门的"通知去重"库。                                       |
| FormStore destroy | 框架特定基础设施。                                                     |

---

## 5. 实施路线图

### 优先级排序

```
P0（立即——本周）
├── 方向 5: FormStore.destroy() + debounce cancel
│   ├── 在 core/src/form.ts 中实现
│   ├── 四个框架适配器中调用
│   └── 测试：unmount 时 cancel，动态字段移除时 cancel
│
├── 方向 2: 日期数学 DST 修复（在 date.ts 中，UTC-first）
│   ├── 将 setHours(0,0,0,0) 替换为时间戳数学
│   ├── 将 addDays 替换为基于时间戳的加法
│   ├── addMonths：使用 UTC 边界
│   └── 测试：DST 转换日的具体用例
│
└── 方向 1: FieldErrors 联合类型 + 聚合错误
    ├── 类型定义变更
    ├── standardSchemaValidator 移除首错即止
    └── 测试：Zod 链、refine、superRefine

P1（下一个迭代）
├── 方向 4: 通知中心去重/分组/更新
│   ├── DesktopNotification 新增字段
│   ├── post() 支持 dedupe
│   ├── update() / dismissGroup()
│   └── 测试：去重、分组计数、更新
│
└── 方向 3: Kahan 求和
    ├── 在 aggregate.ts 中实现
    └── 测试：大/小数量级混合数据集

P2（长期）
├── 方向 C: 完整的日期抽象（CalendarDate / @internationalized/date）
│   └── 主要版本更改，如果决定做
│
└── 方向 A: 框架级 FormStore 生命周期集成
    └── React useForm 中 useEffect 清理，等等
```

### 阶段划分和里程碑

| 阶段                    | 时间    | 产出                                                                                                                                | 包含方向 |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **M1: 核心完整性**      | 第 1 周 | `FieldErrors` 支持多值；`FormStore.destroy()` 实现并用于所有适配器；`date.ts` DST 安全；所有测试通过                                | 1, 2, 5  |
| **M2: 用户体验完整性**  | 第 2 周 | 通知中心支持分组/去重/更新；`aggregate` 使用 Kahan 求和；`pro-table` 合计行使用新 aggregate                                         | 3, 4     |
| **M3: 架构文档 + 审计** | 第 3 周 | 新增 DST 测试套件（覆盖北美/欧洲 DST 窗口）；新增 debounce 生命周期测试；所有 4 框架集成测试；更新 `AGENTS.md` 记录新的生命周期契约 | 所有     |

### 风险点和缓解策略

| 风险                                         | 概率 | 影响 | 缓解策略                                                                                                                                                            |
| -------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **FieldErrors 联合类型破坏下游消费方**       | 低   | 中   | 确保所有官方框架适配器在消费错误时处理 `string                                                                                                                      | string[]`。发布为小版本。提供 codemod。 |
| **UTC 日期修复引入基于 UTC 的显示 bug**      | 中   | 高   | 从 `formatLocalISO` 开始严格测试——它使用本地时间 getter，不应受影响。其他函数（`startOfDay`、`addDays`）在 DST 转换日进行测试。                                     |
| **FormStore.destroy() 被遗忘——适配器不调用** | 中   | 中   | React 适配器必须在 `useEffect` 清理中调用。Vue 需要 `onBeforeUnmount` 更新。添加 lint 规则。如果 `destroy` 存在，让核心在 `console.warn` 未被调用的情况下定期清理。 |
| **通知分组的 API 过度设计**                  | 低   | 低   | 坚持使用最小的加法 API。`group` 只是一个字符串；`dedupe` 只是一个布尔值。不要使用策略/插件。                                                                        |
| **Kahan 求和引入性能退化**                   | 低   | 低   | 基准测试 1000 万条数字：Kahan vs 朴素。如果差异 < 5%，接受它。如果 > 5%，使 Kahan 成为基于大小/幅度阈值的有条件路径。                                               |

### 关键跟踪指标

在实施过程中，以下是需要跟踪的具体指标：

1. **FieldErrors 类型覆盖率**：在所有四个框架中，有多少消费方正确处理了 `string | string[]`？（lint 可以检查 `Array.isArray` 的使用）
2. **DST 测试覆盖率**：`date.test.ts` 中 DST 转换日的测试数量（最少：3 个测试——北美春季、北美秋季、欧洲春季）
3. **FormStore destroy 调用覆盖率**：`destroy()` 在四个框架适配器中被调用的频率（自动化 lint 规则）
4. **通知去重效率**：`post({ title, body, dedupe: true })` 当 title+body 匹配时确实替换而非追加的测试

---

## 总结：核心见解

这五个方向虽然不同，但有一个统一的主题：**Iris UI 的简洁性——零依赖、类型即契约、薄桥——在扩展时产生了原本不存在的摩擦点**。这不是对架构的批评；每个选择在当时都是正确的。只是它们现在需要演进。

- **方向 1 和方向 5**（FieldErrors 和 FormStore 生命周期）是**纯架构债务**——由于发展优先级在构建 149 个组件的四倍并行性上，而对错误聚合和 dispose 契约的考虑被推迟而产生的缺口。
- **方向 2**（DST）是**零依赖约束的实际成本**——选择一个成熟的日期库可以完全避免它，但会增加 10-15KB。
- **方向 3 和方向 4**（Kahan 求和和通知去重）是**来自已知未实现功能的规模摩擦**——它们被记录在"未完成"部分中，但现在 pro-table 和服务端 CMS 用例使它们触手可及。

总体而言，这五个方向只需约 50 行新逻辑（不包括测试）和一个类型定义更改。它们是高杠杆的修复，将系统从不一致/有 bug 的状态推向完整功能就绪的状态。
