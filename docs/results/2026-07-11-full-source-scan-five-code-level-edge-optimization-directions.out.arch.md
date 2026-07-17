以下是对 `analysis-5-edge-directions.md` 的架构与技术设计分析。

---

# 架构分析：5 个代码级边界面

## 1. 架构评估

### 核心架构优势（被这 5 个方向证实）

这 5 个方向的共同特征是——它们**全部命中 core 层，无一触及框架适配器**。这不是巧合，而是 `@iris-ui/core` 分层策略正确的反向证据：

- **逻辑集中化**：表单验证（方向 1）、日期数学（方向 2）、聚合运算（方向 3）、通知状态（方向 4）、表单生命周期（方向 5）——全部在 core。修复一处，四框架受益。
- **薄桥模式有效**：四个适配器没有自己的 form/date/notification 逻辑副本，问题域完全收敛。
- **测得出就是好架构**：这些问题之所以能被精确定位，是因为每个模块职责清晰、接口有限、测试文件与源文件一一对应。

### 当前架构的 5 个局限

| 局限               | 具体表现                                                                                                           | 对应方向 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- |
| **类型天花板**     | `FieldErrors<V>` 值类型为 `string`，一开始就限制了错误表达力                                                       | 方向 1   |
| **半成品抽象**     | `debounce` 工具类正确返回了 `cancel()`，但 `form.ts` 创建了 2 个 Map 来存它们，然后从未调用 `cancel()`——造了桥不走 | 方向 5   |
| **非防御性编码**   | `date.ts` 使用本地时间 getter/setter 时假定本地时区没有 DST——这是 JS 生态已反复踩过的坑                            | 方向 2   |
| **无生命周期契约** | `FormStore` 接口缺少 `destroy()`，所有四框架的 `useForm` 桥只在 mount 时创建 store，unmount 时静默泄漏             | 方向 5   |
| **静默降级**       | `standard-schema.ts` 用 `!(key in errors)` 丢弃错误时不 warn 不 error，用户和开发者都蒙在鼓里                      | 方向 1   |

### 技术债分类

| 债类型     | 严重度 | 模块                        | 说明                                                       |
| ---------- | ------ | --------------------------- | ---------------------------------------------------------- |
| **设计债** | 高     | `FieldErrors` 类型          | 单字符串值类型是一个过早收敛的设计决策，限制了整个验证体系 |
| **实现债** | 高     | `form.ts` 生命周期          | 有 cancel 机制但不调用，属于完成度不足                     |
| **实现债** | 中     | `date.ts` DST 安全          | 用本地时间做日期数学不是错误——不测试 DST 边界才是          |
| **实现债** | 低     | `aggregate.ts` 精度         | Kahan 求和仅 6 行，不修复纯粹是遗漏                        |
| **设计债** | 中     | `notifications.ts` 分组抽象 | 最小可行接口缺少分组/更新/去重的类型设计                   |

---

## 2. 扩展方向

### 方向 A：表单验证管道 2.0 — 多错误聚合 + 表单级错误渲染

**为什么需要**：

- 这是方向 1 的直接延续。`FieldErrors<string>` → `FieldErrors<string[]>` 的转变是类型系统级的升级，全面打开错误展示质量
- 与 React Hook Form（`FieldError` 为数组）、Naive UI（`n-form-item` 支持复合错误状态）对标
- `plugin-pro-table` 的 CRUD 表格行内编辑场景中，同单元格多规则验证（如 `min + max + pattern`）非常常见

**核心挑战**：

- **向后兼容**：现有 `FieldErrors<V>` 的消费者预期 `string` 值。改成 `string[]` 会破坏适配器层所有 `error && <span>{error}</span>` 的渲染模式
- **适配器渲染变更**：四个框架的 `IrisFormField` 都需要支持多错误渲染（错误列表 / tooltip / 轮播）
- **表单级错误路由**：无路径错误（如 `z.refine` 密码匹配）需要决定渲染位置——表单顶部 banner？对相关字段行内？两种都要？

**预期架构变更**：

```
core/standard-schema.ts    ─→  消除 !(key in errors) 守卫
core/form.ts               ─→  FieldErrors<V> 值类型改为 string | string[]
core/form.ts               ─→  新增 formError?: string 字段在 FormState 中存储表单级错误
react/form/Form.tsx         ─→  检测 context 中的 formError 并渲染顶部 banner
vue/solid/svelte/form/      ─→  同上
各框架 FormField           ─→  支持 errors: string[] 列表渲染
```

**对现有系统的影响**：中等。类型变更需要适配器层逐一适配，但变更模式可预测（`error` → `errors`）。向后兼容方案：`FieldErrors<V>` 保留 `string` 字面量兼容层，通过联合类型 `string | string[]` 逐步迁移。

**选项权衡**：

| 选项                                                           | 复杂度                                 | 破坏性             | 推荐度                      |
| -------------------------------------------------------------- | -------------------------------------- | ------------------ | --------------------------- |
| A1. `string` → `string[]` 硬切换                               | 中（适配器四处改）                     | 是                 | ⚠️ 适合 v2 大版本           |
| A2. `string` → `string \| string[]` 联合                       | 低（consumer 需 `Array.isArray` 判断） | 低（旧值依然有效） | ⭐ **推荐**                 |
| A3. 不改变类型，靠 `standard-schema.ts` 拼接多条错误为单字符串 | 极低                                   | 无                 | ❌ 仅适合 quick fix，丢语义 |

### 方向 B：异步生命周期契约 — 标准化 Core 模块的清理/销毁接口

**为什么需要**：

- 方向 5 不是孤例——`notifications.ts` 的 `setTimeout`（由 shell 拥有）、`data-view` 的异步数据源、`virtual-scroll` 的 RAF 循环，都面临相同的 "组件 unmount 后回调写入已销毁 store" 问题
- 当前每个模块自建清理方案：`createStore` 返回 `subscribe` 返回 `unsubscribe`，但异步操作（debounce/validate/fetch）游离在生命周期管理之外
- `plugin-form-builder` 动态增删字段 + 防抖写入 = 方向 5 的真实杀伤场景

**核心挑战**：

- **不引入框架依赖**：Core 没有 React/Vue/Solid/Svelte。生命周期契约必须纯 JS（`destroy`/`dispose` 方法模式）
- **四框架的触发时机不同**：React `useEffect` cleanup、Vue `onUnmounted`、Solid `onCleanup`、Svelte `$effect` cleanup——桥接层需要统一调用 `destroy()`
- **非侵入式**：现有模块不可用 `destroy()` 不应退化

**预期架构变更**：

```
core/                         ─→  约定：所有返回状态管理对象（createXxx）的模块，
                                   支持可选的 destroy() 或返回 { ..., destroy }
core/form.ts                  ─→  FormStore 接口增加 destroy(): void
                                  reset() 中遍历 fieldDebouncers/flushers 调用 cancel()
core/notifications.ts         ─→  NotificationCenter 接口增加 destroy(): void
                                  （清理 timeout 引用）
react/form/useForm.ts         ─→  useEffect cleanup → form.destroy()
vue/form/                     ─→  onUnmounted → form.destroy()
solid/svelte/form/            ─→  同理
```

**对现有系统的影响**：低。全是加法，无破坏性变更。`destroy()` 是可选调用——不调用的模块保持当前 leak 行为（但可以渐进改善）。

### 方向 C：日期/时间抽象层 — 从原生 `Date` 升级到纯日期值

**为什么需要**：

- 方向 2 暴露了 `date.ts` 在 DST 边界的脆弱性。这不是"加几个 UTC getter"能根本解决的——当日期数学被时间戳的 DST 偏置干扰时，所有基于 `startOfDay`/`addDays`/`addMonths` 的组件都有风险
- Radix UI 和 React Aria 已选择 `@internationalized/date`（`CalendarDate`），Naive 使用 UTC 时间戳。Iris UI 用原生 `Date` 是最脆弱的方式
- `IrisCalendar`/`IrisDatePicker`/`IrisDateRangePicker` 只关心**日历日**，不需要时分秒、时区、DST——纯日期值 `{ year, month, day }` 彻底消除 DST 问题

**核心挑战**：

- **内部实现 vs 外部 API**：纯日期值改变内部实现不破坏公共 API，但若暴露 `Date` 对象给用户，迁移成本高
- **与 `formatLocalISO` 的关系**：`formatLocalISO` 已在做正确的事（getFullYear/getMonth/getDate），UTC 化内部日期数学不改变其行为
- **测试的可信度**：需要添加 DST 边界测试，但 CI 在 UTC 时区——需要 `vi.setSystemTime` 并使用特定时区（如 `America/New_York`）

**预期架构变更**：

```
选项 C1（推荐——最小侵入）：
  core/src/date.ts  ─→  内部函数使用 UTC 方法：
                         startOfDay: setUTCHours(0,0,0,0) 替代 setHours
                         addDays: 基于时间戳 days*86400000 替代 setDate
                         addMonths: UTC 版本的逐月运算
                         公共 API 签名不变（仍返回 Date）

选项 C2（深度——纯日期值）：
  core/src/date.ts  ─→ 引入 CalendarDate = { year, month, day } 内部类型
                        所有数学基于整数运算
                        边界返回 Date（兼容现有 API）或 CalendarDate
  适配器层           ─→ DatePicker 输出格式不变

选项 C3（外部依赖）：
  引入 @internationalized/date，替换全部 date.ts
```

**对现有系统的影响**：

| 选项        | 内部复杂度 | 外部破坏性           | 测试成本          | 推荐                    |
| ----------- | ---------- | -------------------- | ----------------- | ----------------------- |
| C1 UTC 改写 | 低         | 无（API 不变）       | 中（需 DST mock） | ⭐ **P1 首选**          |
| C2 纯日期值 | 中         | 低（返回 Date 兼容） | 中                | 未来方向                |
| C3 外部依赖 | 低         | 无                   | 低                | ❌ 与零外部依赖原则冲突 |

**选项 C1 的 UTC 方案原理**：

```ts
// 当前（DST 脆弱）
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0) // 本地时区
  return d
}

// UTC 方案（DST 免疫）
export function startOfDay(date: Date): Date {
  const d = new Date(date.getTime())
  d.setUTCHours(0, 0, 0, 0) // UTC —— 所有日期数学一致
  return d
}
```

关键区别：`setHours(0,0,0,0)` 在本地时区，受 DST 偏移回调影响；`setUTCHours(0,0,0,0)` 在 UTC 零时区，所有日期数学基于同一参考系。返回的 `Date` 对象在用户本地时区渲染时，UI 格式化（`getFullYear/getMonth/getDate` 或 `Intl`）会正确转换——因为 UI 显示用本地方法，但日期数学（比较/偏移/范围判断）基于 UTC 零时区时间戳，跨 DST 边界稳定。

### 方向 D：数值精度框架 — Kahan 求和 → 可扩展精度层

**为什么需要**：

- 方向 3 的修复成本极小（6 行 Kahan 求和），但更根本的问题是：`aggregate.ts` 之后可能增加更多聚合算子（`stddev`、`variance`、`weightedAvg`、`product`），每个都需要精度考虑
- `pro-table` 的底行合计是 CMS 应用的标准配置。10 万行 $0.10 的误差在财务审计场景中不可接受
- 如果今天在 `sum`/`avg` 上修了 Kahan，明天 `product` 加入时开发者可能忘记——需要架构级的引导

**核心挑战**：

- **不是所有聚合都需要补偿**：`min`/`max`/`count` 无精度问题。`sum`/`avg` 需要；`product` 可能需要更高精度（对数域计算）
- **性能 vs 精度**：Kahan 求和比朴素累加多 ~3 次浮点运算/元素。对于 100 万行数据，现代引擎上差异 < 5ms，可忽略
- **测试断言标准**：浮点数比较用 `toBeCloseTo` 而非 `toBe`，且需明确 epsilon 阈值策略

**预期架构变更**：

```
core/src/data-view/aggregate.ts  ─→  新增 kahanSum() 内部函数
                                       sum/avg 改用 kahanSum
                                       将来可扩展为 precisionMath 工具模块
core/src/data-view/aggregate.test.ts  ─→  新增大规模精度测试（100k 随机两位小数）
```

**对现有系统的影响**：零。纯内部实现变更，API 签名、返回类型都不变。

### 方向 E：通知系统成熟化 — 分组/更新/去重语义

**为什么需要**：

- 方向 4 是旗舰用例（`apps/desktop-os-*`）的明显短板。无去重、无分组、无更新的通知中心是"玩具级"实现
- `plugin-notifications` 是插件系统的重要展示窗口，其基础 API 应匹配桌面 OS 通知标准
- 实际场景中 WebSocket 持续推送同类告警是常态，当前实现 100 条填满列表 = 不可用

**核心挑战**：

- **去重策略的可选性**：硬编码去重（按 title+body+appId 合并）对所有通知场景都不适用。需要调用方声明 `groupKey`
- **`DesktopNotification` 接口的向后兼容**：新增 `group`/`count`/`timestamp` 字段必须为可选，不可破坏现有消费者
- **`NotificationCenter` 接口的扩展**：`update(id, input)` 需要定位已发布通知——`O(1)` 查找依赖 id Map，当前实现基于数组扫描

**预期架构变更**：

```
core/src/notifications.ts:
  DesktopNotification ─→  新增 group?: string        // 分组键
                           count?: number            // 同组累积计数
                           timestamp: number         // 发布时间戳（补齐缺失字段）
  NotificationCenter  ─→  新增 update(id, Partial<NotificationInput>): void
                          新增 dismissGroup(group: string): void
                          新增 dismissApp(appId: string): void
  post()              ─→ 可选：当输入包含 group 且同组通知已存在 → 替换/递增 count
                          否则 → append（当前行为）
  内部存储            ─→  Map<string, DesktopNotification> 用于 O(1) id 查找 + 数组排序
```

**对现有系统的影响**：低到中。新增字段和方法全是加法。唯一非向后兼容的点：若调用方依赖 `DesktopNotification` 的精确属性结构，新增可选字段不影响。

---

## 3. 接口设计建议

### 3.1 关键原则

1. **可感知的变迁**：所有类型变更（如 `FieldErrors` 值类型拓宽）应使旧代码产生 TypeScript 编译错误（而非静默运行时退化）。TS 编译错误 = 文档。
2. **渐进可用性**：新增方法（`destroy()`、`update(id)`、`dismissGroup()`）不强制使用。调用方可逐步迁移。
3. **从下游看上游**：接口设计先扫四框架适配器的消费模式，再确定 core 接口形态。方向 1 的 `FieldErrors` 类型变更前应检查四个框架的 `IrisFormField` 渲染代码。

### 3.2 是否需要新抽象层

| 方向         | 是否需要新抽象层 | 理由                                                                           |
| ------------ | ---------------- | ------------------------------------------------------------------------------ |
| 1 多错误聚合 | ❌ 不需要        | `FieldErrors<string[]>` + 适配器渲染变更即可                                   |
| 2 DST 安全   | ⚠️ 可能          | 如果选 C2（纯日期值），需要 `CalendarDate` 类型；如果选 C1（UTC 改写），不需要 |
| 3 浮点精度   | ❌ 不需要        | Kahan 求和是内部实现细节                                                       |
| 4 通知去重   | ❌ 不需要        | 现有接口追加方法即可                                                           |
| 5 生命周期   | ⚠️ 可能需要      | 若发现 `destroy()` 模式跨 5+ 模块重复出现 → 提取 `Disposable` 类型             |

**对生命周期可选的抽象**：

```ts
// 全在 core——无框架依赖
interface Disposable {
  destroy(): void
}

// createFormStore 返回类型兼容
interface FormStore<V> extends Disposable { ... }

// 适配器 useForm 在 cleanup 中调用
useEffect(() => () => form.destroy(), [])
```

### 3.3 向后兼容策略

| 变更类型         | 策略                                    | 示例                                                |
| ---------------- | --------------------------------------- | --------------------------------------------------- |
| 类型拓宽         | 联合类型 + 类型守卫                     | `FieldErrors<V>` 值 `string` → `string \| string[]` |
| 新增方法         | 直接加在接口，旧代码不调用则无影响      | `destroy()`、`update()`、`dismissGroup()`           |
| 内部实现变更     | API 不动，测试更新                      | `kahanSum()`、`setUTCHours`                         |
| 行为变更（去重） | 可选开启（通过 `group` 字段），默认 off | 有 `group` 才去重，否则 append                      |

---

## 4. 技术选型

### 4.1 是否需要新依赖

| 候选                                    | 方向       | 评估结论                                                                                |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `@internationalized/date`（React Aria） | 2 DST 安全 | ❌ 不引入。零外部依赖是 `@iris-ui/core` 的价值主张。C1 UTC 改写方案自行解决，~30 行代码 |
| `decimal.js` / `bignumber.js`           | 3 浮点精度 | ❌ 不需要。Kahan 求和 6 行解决。若未来需 `decimal128`精度（财务场景），走插件而非 core  |
| `zod`（已在 devDeps）                   | 1 验证管道 | ✅ 已有。仅用于测试，验证标准 schema 行为                                               |
| 新测试工具（timezone mock）             | 2 DST      | 🤔 `vitest` + `vi.setSystemTime` + `process.env.TZ` 即可，无需第三方库                  |

**结论**：5 个方向**零新外部依赖**。所有修复可用纯 JS/TS 实现。

### 4.2 自建 vs 采购决策矩阵

| 决策维度             | 方向 1 多错误    | 方向 2 DST                   | 方向 3 精度       | 方向 4 通知     | 方向 5 生命周期 |
| -------------------- | ---------------- | ---------------------------- | ----------------- | --------------- | --------------- |
| 实现成本（人天）     | 0.5              | 0.5                          | 0.1               | 1               | 0.3             |
| 第三方方案质量       | N/A（core 逻辑） | `@internationalized/date` 高 | `decimal.js` 高   | N/A（业务语义） | N/A             |
| 与 zero-dep 原则兼容 | ✅               | ❌（若引入）                 | ❌（若引入）      | ✅              | ✅              |
| 决策                 | **自建**         | **自建（UTC 改写）**         | **自建（Kahan）** | **自建**        | **自建**        |

### 4.3 测试技术选型

| 测试需求     | 方案                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| DST 边界测试 | `vitest` `vi.setSystemTime('2024-03-10T02:00:00-05:00')` + `process.env.TZ='America/New_York'` |
| 浮点精度断言 | `expect(received).toBeCloseTo(expected, precision)`，财务精度 10 位                            |
| 多错误验证   | Standard Schema mock 返回多 issues，断言 `errors` 包含全部                                     |
| 生命周期清理 | `vi.useFakeTimers()` + 调用 `destroy()` 后断言 `setTimeout` 未执行                             |
| 通知去重     | `post` 两次相同 group，断言列表长度为 1                                                        |

---

## 5. 实施路线图

### 优先级总排序

```
P0 (this sprint)         P1 (this sprint)        P2 (next sprint)
   无                     1. 多错误聚合            3. Kahan 精度
                          2. DST 安全 UTC 改写     4. 通知去重/分组/更新
                          5. 生命周期 destroy
```

无 P0。——方向 1、2、5 是用户可见的数据正确性问题，但触发条件有限（DST 每年 2 次、debounce 残留需 unmount 前快速输入、多规则验证属于高级用例）。非数据丢失级别的生产事故，不足以标记 P0。

### 阶段一：Core 内部修复（第 1–3 天）

**里程碑**：5 个 core 模块修复 + 单测全绿

| Day | 方向 | 具体任务                                                                                                                                                             | 验证标准                                |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | 1    | `standard-schema.ts` 消除 `!(key in errors)` 守卫；`FieldErrors` 类型改为 `string \| string[]`；聚合同字段多条错误；form-level 错误路由到新 `formError` 字段         | 多错误测试 + form-level 错误测试        |
| 1   | 5    | `form.ts`：`reset()` 中遍历 `fieldDebouncers`/`fieldFlushers` 调用 `cancel()`；`FormStore` 接口增加 `destroy()`；在 `destroy()` 中 cancel + 清除 buffer              | `afterEach` 测试无 pending timer        |
| 2   | 2    | `date.ts`：`startOfDay`/`addDays`/`addMonths`/`startOfMonth`/`endOfMonth`/`isOutOfRange` 改为 UTC getter/setter；`formatLocalISO` 不动                               | DST 边界测试（`TZ='America/New_York'`） |
| 3   | 3    | `aggregate.ts`：实现 `kahanSum()`，`sum`/`avg` 改用；10 万行精度测试                                                                                                 | 100k 随机小数值误差 < 1e-10             |
| 3   | 4    | `notifications.ts`：`DesktopNotification` 增加 `group`/`count`/`timestamp`；`NotificationCenter` 增加 `update`/`dismissGroup`/`dismissApp`；`post()` 支持 group 去重 | 去重/更新/分组测试                      |

### 阶段二：适配器层适配（第 4–5 天）

**里程碑**：四框架适配器更新 + 端到端无 diff

| Day | 具体任务                                                                                               | 风险                         |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 4   | React `useForm`：`useEffect cleanup` → `form.destroy()`；`IrisFormField`：支持 `errors: string[]` 渲染 | 低                           |
| 4   | Vue `useForm`：`onUnmounted` → `form.destroy()`；类似 FormField 更新                                   | 中（Vue 响应式桥接不同）     |
| 5   | Solid `useForm`：`onCleanup` → `form.destroy()`                                                        | 低                           |
| 5   | Svelte `useForm`：`$effect` cleanup → `form.destroy()`                                                 | 中（Svelte runes 模板语法）  |
| 5   | 四框架的 DatePicker/DateRangePicker/Calendar 回归测试                                                  | 低（API 不变，内部实现变更） |

### 阶段三：文档 + 发布准备（第 6 天）

**里程碑**：changeset + 迁移指南 + 版本决策

| 任务           | 说明                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| 生成 changeset | 方向 1 是类型变更（patch 或 minor 取决于兼容策略），方向 2-5 为 patch            |
| 迁移指南       | `FieldErrors<string>` → `FieldErrors<string \| string[]>` 升级指引               |
| 版本决策       | 如果 A2 方案（联合类型），`minor` 即可；如果 A1（硬切 `string[]`），需要 `major` |

### 风险点及缓解策略

| 风险                                     | 概率 | 影响 | 缓解措施                                                                             |
| ---------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------ |
| **UTC 改写破坏现有日期行为**             | 低   | 高   | `date.test.ts` 全覆盖 + 四框架 DatePicker 端到端测试；DST 边界 + 非 DST 边界全部回归 |
| **`FieldErrors` 类型变更大范围编译错误** | 中   | 中   | 选 A2（联合类型）而非 A1（硬切）；提供 codemod 或 ESLint rule                        |
| **Svelte `$state` 与 `destroy()` 互斥**  | 低   | 中   | 参考 AGENTS.md 的 Svelte rune 命名陷阱，`destroy` 作为方法名安全                     |
| **`notifications.ts` 去重逻辑过于激进**  | 中   | 低   | 默认关闭去重（需要 `group` 键才启用），保持向后兼容                                  |
| **CI 中 DST 测试因时区配置失败**         | 中   | 低   | `package.json` 的 `test` 脚本设置 `TZ`；或用 `vitest` 的 `process.env.TZ` 全局 mock  |
| **四框架适配器 destroy 时机不一致**      | 低   | 中   | 定义 `destroy()` 为幂等调用（可多次调用、第二次是 no-op），框架间顺序差异不影响      |

---

## 关键决策汇总

| 决策                 | 选项                                                    | 推荐                              | 理由                           |
| -------------------- | ------------------------------------------------------- | --------------------------------- | ------------------------------ |
| `FieldErrors` 值类型 | A1 `string[]` / A2 `string \| string[]` / A3 拼接字符串 | **A2**                            | 最低破坏性，最大兼容性         |
| 日期数学 DST 方案    | C1 UTC 改写 / C2 纯日期值 / C3 外部依赖                 | **C1**                            | 零依赖、API 不变、~30 行代码   |
| 聚合精度             | Kahan / Decimal lib / 保留现状                          | **Kahan**                         | 6 行代码，零依赖，零 API 变更  |
| 通知去重策略         | 硬编码去重 / 按 group 可选 / 保留现状                   | **按 group 可选**                 | 最灵活，向后兼容               |
| Form lifecycle       | 仅 form.ts destroy / 提取 Disposable 抽象               | **仅 form.ts** + 观察模式是否重复 | 不早抽象，等重复 3+ 模块再提取 |

---

**总结**：这 5 个方向代表了 `@iris-ui/core` 从"能用"到"可靠"的必经之路。它们不改变 Iris UI 的架构方式（薄桥、core 逻辑、零外部依赖），而是在现有架构内完成**精度补齐**、**类型拓宽**、**生命周期完善**。方向 1 的 `FieldErrors` 类型和方向 5 的 `destroy()` 模式是其中最有架构意义的两个变更——前者解除了验证体系的天花板，后者建立了一个可跨模块复用的生命周期契约。建议按照 P1（1→5→2）→ P2（3→4）的顺序执行，P1 的 3 个方向互不阻塞，可并行修复。
