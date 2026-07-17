Now I have a complete picture of the codebase. Let me produce the architectural analysis.

---

# 架构分析报告：Iris UI Core — 五方向实现深度评估与真实扩展方向

> **日期**: 2026-07-12 · **角色**: 资深架构师  
> **分析基础**: 源代码审计（`nav.ts`、`selection.ts`、`path.ts`、`virtualizer.ts`、`window.ts`、`store.ts`、`form.ts`、对应测试文件） + 事实核查报告  
> **核心结论**: 分析文档描述的五个方向**已全部实现并发布**。下文将转向**真实存在的架构缺口**，而非对已完工特性的复盘。

---

## 1. 架构评估

### 1.1 当前架构的优势

经过对 `packages/core/src` 全部六个目标模块的完整源代码阅读，当前架构表现出以下优势：

| 维度                   | 评估          | 证据                                                                                                                                                                                        |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **防御性编程**         | 🔴 **优秀**   | `flattenNav` 有 `seen Set` + `MAX_DEPTH=1000` 双重保护；`parsePath` 有 dev throw + prod warn 模式；`SelectionModel` 有版本号惰性索引；`Virtualizer` 有 `detectCacheSkew()` 诊断             |
| **API 封装安全**       | 🟢 **优秀**   | `ReadonlyStore` 接口分离读写，`SelectionModel.store` 暴露为只读视图，适配器无 `store.setState` 直接调用                                                                                     |
| **测试覆盖全面**       | 🟢 **优秀**   | `nav.test.ts` 含 8 个 cycle 保护场景；`path.test.ts` 含 10+ 畸形输入；`virtualizer.test.ts` 含 `replaceData`、`detectCacheSkew`、`getItemKey` 验证；`window.test.ts` 含 `rebalanceZ` 全场景 |
| **模块化与关注点分离** | 🟢 **优秀**   | 每个核心模块（nav/window/path/selection/virtualizer）职责单一，无跨模块耦合；form 子系统有自己的子目录                                                                                      |
| **框架无关性**         | 🟢 **已验证** | 全部核心模块零框架依赖，使用通用 `Store` 接口桥接                                                                                                                                           |

### 1.2 架构债务与局限性

尽管代码质量高，以下架构债务值得关注：

#### 债务 1：`cloneContainer` 无原型污染防护（严重度：中-高）

`path.ts` 中的 `cloneContainer` 函数和 `setByPath` 路径导航未对 `__proto__`、`constructor`、`prototype` 做拒绝：

```typescript
// path.ts — cloneContainer (当前实现)
function cloneContainer(node: unknown, nextSeg: PathSegment): Record<PathSegment, unknown> {
  if (Array.isArray(node)) return [...node] as unknown as Record<PathSegment, unknown>
  if (node != null && typeof node === 'object') return { ...(node as Record<PathSegment, unknown>) }
  return (isIndex(nextSeg) ? [] : {}) as Record<PathSegment, unknown>
}
```

`setByPath(obj, '__proto__.polluted', true)` 不会通过路径解析报错（`__proto__` 是合法字符串段），且 `cloneContainer` 和路径设定均不拦截。实际影响取决于消费方是否在不可信数据上调用 `setByPath`。**表单系统是主要攻击面**——若 `initialValues` 来自 URL/API，恶意路径可污染原型链。

**技术债等级**: 防御性加固缺失，非运行时爆炸，但违反最低安全预期。

#### 债务 2：`process.env.NODE_ENV` 的全库分散使用（严重度：低-中）

六个核心模块中有五处使用 `process.env.NODE_ENV === 'development'` 条件守卫：

- `nav.ts`：cycle warn、depth warn
- `path.ts`：malformed input throw vs warn
- `virtualizer.ts`：`getItemKey` warn、`detectCacheSkew`
- `form.ts`：initialValues 键名警告
- `selection.ts`：无（但 store.ts 内部有）

没有统一的条件守卫抽象（如 `devOnly(fn)` 助手或编译期 `__DEV__` 常量）。这导致：

1. **打包体积**：条件体内的字符串（警告消息）在 production 中仍存在（即使被 tree-shaken，字符串字面量若被 concatenation 引用是会被保留的）。
2. **一致性**：每个模块独立做 `process.env.NODE_ENV` 检查，难以统一管理。

**技术债等级**: 轻微 — 但 `detectCacheSkew` 使用 `...(process.env.NODE_ENV === 'development' ? { detectCacheSkew: ... } : {})` 模式是运行时分支，不会 tree-shake 掉。

#### 债务 3：`ReadonlyStore<T>` 使用不统一（严重度：低）

`store.ts` 定义了 `ReadonlyStore<T>` 接口，`selection.ts` 导出的 `SelectionModel.store` 正确使用了该类型。但 `WindowManager` 和 `Virtualizer` 暴露的是完整的 `Store<T>`（包含 `setState`）。虽然后两者的内部状态设计上允许直接 setState（不像 selection 有 index 不一致问题），但从 API 设计一致性角度看存在差异：

```
SelectionModel.store   → ReadonlyStore<K[]>    ✅ 只读
WindowManager.store    → Store<WindowManagerState>  ❌ 可写
Virtualizer.store      → Store<VirtualizerState>    ❌ 可写
```

**技术债等级**: 低 — 是接口设计的权衡（WindowManager/Virtualizer 允许外部直接 setState 是有意设计），但一致性增强有好处。

#### 债务 4：`nav.ts` 深度截断测试未覆盖（严重度：低）

`nav.test.ts` 有全面的 cycle 保护测试（8 个场景），但缺少对 `MAX_DEPTH = 1000` 深度截断行为的显式测试。`flattenNav` 中的深度检查逻辑从未被直接验证。

#### 债务 5：Fenwick 树的 O(n) 初始化在大列表下的批量开销（严重度：低，需 bench 确认）

`createSizeTree` 的 `build()` 是 O(n)。`replaceData()` 和 `setCount()` 都调用 `tree.reset(n)` 触发重建。对于 100k 行，这仍是毫秒级的，但如果在 `batch` 内多次调用，每次重建都是 O(n)。没有增量重建或延迟重建的优化。

---

## 2. 扩展方向

基于实际代码缺口的审计，以下五个方向是高价值、真实的架构扩展方向（非事后复盘）：

### 方向 A（P1）：路径安全加固 — 原型污染防护 + 深度路径限制

**为什么需要**：`setByPath` 是表单系统的核心路径写入引擎。若表单系统接受用户输入的键名（如动态表单 schema 来自 API），则 `__proto__` 注入是真实威胁。Prototype pollution 可导致全应用崩溃或数据泄露。

**核心挑战**：

- `parsePath` 中的拒绝逻辑必须在解析阶段（而不是写入阶段）做，以避免安全检测被 `formatPath`→`parsePath` roundtrip 绕过
- `cloneContainer` 的 `{ ...(node as object) }` 已经安全了（spread 不会复制原型属性），但 `setByPath` 的核心 `cur[seg] = value` 在 `seg = '__proto__'` 时仍可能污染
- 需区分"表单字段路径"和"对象路径"的使用场景

**预期架构变更**：

1. `parsePath` 增加可选 `options?: ParseOptions` 参数：`{ rejectProtoKeys?: boolean }`（默认 false 保持向后兼容）
2. 或新增 `isSafeKey(key: string): boolean` 工具函数
3. `setByPath` 在路径写入前对每个 segments 做 `Object.hasOwn(cur, seg)` 式安全检查
4. 对应测试：验证 `__proto__`、`constructor`、`prototype` 作为路径段时的行为

**对现有系统的影响**：

- 纯增量，零下游 breakage
- 安全开关默认关闭（opt-in），确保非表单使用场景不受影响

### 方向 B（P1）：统一开发模式守卫抽象

**为什么需要**：5 处分散的 `process.env.NODE_ENV` 检查导致研发体验不一致、production 包体积膨胀、且新模块容易忘记加守卫。统一抽象可提升可维护性并启用编译期 dead code elimination。

**核心挑战**：

- `tsup` 构建配置中需要定义 `__DEV__` 全局常量（按构建环境注入）
- `detectCacheSkew()` 当前是运行时对象扩展模式（`...(cond ? { fn } : {})`），需改为条件导出声明的函数签名
- 迁移需要改动全部 5 处的守卫调用点

**预期架构变更**：

1. 在 `core/src` 新增 `dev.ts` 模块，导出：
   - `const __DEV__: boolean`（由 `globalThis.__DEV__` 或构建注入决定）
   - `devWarn(msg: string): void`（仅在 `__DEV__` 时 console.warn）
   - `devThrow(ErrorClass, msg, ...args): never`（仅在 `__DEV__` 时 throw，prod 时 warn + return fallback）
2. 迁移全部 5 处调用点到新抽象
3. `tsup.config.ts` 添加 `define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') }`

**对现有系统的影响**：

- 中等改动面，但纯机械替换
- 可逐步迁移（按模块逐个替换，不要求原子变更）

### 方向 C（P2）：Fenwick 树增量重建优化

**为什么需要**：`replaceData()` 和 `setCount()` 的 O(n) 重建在大列表（100k+）+高频操作的场景下可能成为性能瓶颈。用户场景：实时搜索过滤表每 100ms 更新数据 → 每次触发 O(n) 重建 → 卡顿。

**核心挑战**：

- Fenwick 树的 `build()` 是结构性的，没有"局部重建"概念
- 增量方案需要记录所有 `sizeAt(i)` 回调的变动，然后只更新变动的树节点（O(m log n)，m = 变动数）
- 或采用懒重建：标记 dirty，在 `lowerBound`/`prefix` 查询时延迟重建

**预期架构变更**：

1. 在 `createSizeTree` 内部添加脏标记机制
2. `setCount` 和 `replaceData` 改为设置 `dirty = true` + 记录 `newCount`
3. `lowerBound`、`prefix`、`sizeOf` 检查 `dirty`，必要时触发一次重建
4. 对外接口不变，纯内部优化

**对现有系统的影响**：

- 零 API 变更
- 仅在 `virtualizer.ts` 内部实现
- 需要新增性能基准测试

### 方向 D（P2）：Fenwick 树切换为 Float64Array（内存优化）

**为什么需要**：当前 `createSizeTree` 使用 `Array<number>` 存储 Fenwick 树和 sizes。对于 1M 行的大列表：

- sizes array: 1M × 8 bytes = 8MB（Float64Array 也是 8MB，但 GC 友好）
- 但 JS array 的 overhead 约 40-80 bytes 每元素 ⇒ 80MB+ 内存
- 实际 Fenwick 树节点数 = n+1 ⇒ 更甚

**核心挑战**：

- `Float64Array` 不支持 `IndexedAccess` 的类型安全引用（但 TS 支持数字索引）
- 需要手动管理下标（1-indexed Fenwick 树）
- 需要使用 `Math.fround()` 或类型转换确保精度（sizes 是 px，整数居多，浮点安全）

**预期架构变更**：

1. `tree` 和 `sizes` 从 `number[]` 改为 `Float64Array`
2. `build()`、`set()`、`lowerBound()`、`prefix()` 全部适配 FlatArray API
3. 对外接口不变

**对现有系统的影响**：

- 纯内部实现替换，零下游 breakage
- 需要 benchmark 验证内存收益和可能的 GC 优化

### 方向 E（P2-P3）：Retrying fetch / 乐观更新 / 竞态控制的数据引擎增强

**为什么需要**：`data-view` 的 `filter-sort` 和 `pagination` 是纯数学工具，而 `resource.ts` 提供了基础的 CRUD resource controller，但缺少现代数据引擎常见的三种能力：

1. **Retry with backoff**：API 失败后的指数退避重试
2. **乐观更新**：在 API 确认前更新 UI，失败时回滚
3. **Stale-while-revalidate + de-dupe**：缓存复用 + 并发请求去重

这三个能力是 admin shell / CMS demo 的真实需求。当前 `resource.ts` 仅有简单的 `refresh`/`load` 模式。

**核心挑战**：

- Retry backoff 需要与 `async.ts` 整合（现有 `createAsyncMachine` 有竞态保护）
- 乐观更新需要 diff/rollback 机制——当前无 undo stack 的通用抽象
- 去重需要 pending request map + timer GC

**预期架构变更**：

1. 新增 `packages/core/src/data-engine.ts` 模块（或扩展 `resource.ts`）
2. 提供 `createRetryable(fn, options)` 包装器
3. 提供 `withOptimisticUpdate(store, mutation, rollback)` 函数
4. 接口设计为纯组合式，与现有 `createResourceController` 可分层使用

**对现有系统的影响**：

- 全部增量，不修改现有模块
- 新模块独立打包，不影响 core bundle size
- 可以和 `plugin-pro-table` 整合

---

## 3. 接口设计建议

### 3.1 关键模块的接口设计原则

基于现有架构的审计，提出以下接口设计原则：

| 原则                 | 说明                                                                                                            | 适用模块                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **最小暴露**         | 类/函数对外暴露的 API 应正好是外部需要的，收窄 `Store` 为 `ReadonlyStore` 是正确方向                            | `selection.ts` ✅ 已做；`window.ts`、`virtualizer.ts` ❌ 待做 |
| **可组合而非可配置** | 不要增加巨型 config 对象。用组合函数（如 `withRetry(createResourceController(...))`）替代 config 中的 20 个参数 | `data-engine.ts`（待建）                                      |
| **类型优先**         | 每个新 API 的 TypeScript 签名应精确到不允许非法状态。使用 branded type 或 union discriminator 编码 invariants   | `path.ts` 的 `PathSegment` ✅                                 |
| **安全默认值**       | `parsePath` 等解析器应默认拒绝危险输入；安全降级到宽松模式需显式 opt-in                                         | `parsePath` 的 `{ rejectProtoKeys?: boolean }`                |

### 3.2 是否需要引入新的抽象层

**建议新增一个抽象层：`__DEV__` 守卫抽象**

```typescript
// packages/core/src/dev.ts — 新模块提议
// 目标：统一所有开发模式逻辑，支持编译期 dead code elimination

/** Compile-time constant: `true` in dev/test, `false` in production builds. */
declare const __DEV__: boolean

/** Warn only in development. A no-op in production. */
export function devWarn(message: string, ...args: unknown[]): void {
  if (__DEV__) {
    console.warn(`[iris-ui] ${message}`, ...args)
  }
}

/**
 * Throw `error` in development; warn and return `fallback` in production.
 * The fallback is a thunk so its computation is tree-shaken in production.
 */
export function devThrowOrWarn<T>(error: Error, fallback: () => T): T {
  if (__DEV__) {
    throw error
  }
  console.warn(`[iris-ui] ${error.message}`)
  return fallback()
}
```

**不推荐引入的新抽象层**：

| 被提议的抽象层                    | 是否推荐  | 理由                                                                                                                    |
| --------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Result<T, E>` 类型（Rust-style） | ❌ 不推荐 | 全库连锁改动。`AGENTS.md` 已明确反对（"避免引入 Result 类型以避免全库连锁改动"）。当前 dev throw + prod warn 方案更务实 |
| 路径的 branded type               | ❌ 不推荐 | 当前 `Path = string \| readonly PathSegment[]` 足够好。Branded type 会破坏与普通字符串的兼容性                          |
| 虚拟化的 adapter interface        | ❌ 不推荐 | 当前 `Virtualizer` 接口已经是框架无关的。四框架各做薄桥是职责清晰的设计                                                 |

### 3.3 如何保持向后兼容性

1. **新增接口默认 opt-in**：`parsePath` 的 `rejectProtoKeys` 默认 `false`，不影响现有调用者
2. **废弃标记而非 break**：如需废弃某个 API，使用 `@deprecated` JSDoc + `devWarn` 而非直接移除
3. **功能对等的 API 命名**：新方法命名不与现有冲突（如 `replaceData` ✅、`rebalanceZ` ✅）
4. **只扩展不修改签名**：为接口增加方法，不修改已有方法的参数类型（除非是可选参数）

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

| 提议技术                                 | 方向               | 推荐度        | 理由                                                                                            |
| ---------------------------------------- | ------------------ | ------------- | ----------------------------------------------------------------------------------------------- |
| `Float64Array` / `Int32Array` TypedArray | 方向 D             | ✅ **推荐**   | 零外部依赖，原生浏览器 API，精准满足内存优化需求                                                |
| `es-toolkit` / `lodash`                  | 方向 E（retry）    | ❌ **不推荐** | 自建 retry 不足 30 行（指数退避 + jitter）。引入外部库的包体积成本 > 收益                       |
| `immer` 结构共享                         | 方向 E（乐观更新） | ❌ **不推荐** | 当前 `setByPath` 已经实现了 spine-only cloning（结构共享）。Immer 的 proxy 开销更大             |
| `@tanstack/query`                        | 方向 E（数据引擎） | ❌ **不推荐** | 框架耦合（React-only）。当前 core 要保持框架无关。若需要，作为独立插件 `plugin-data-query` 可选 |

### 4.2 第三方依赖的评估标准

针对 Iris UI Core 的特质（框架无关、tree-shakable、bundle 预算敏感），评估任何新依赖应采用以下标准：

```
1. 零框架依赖？          → 必须（core 原则）
2. Bundle impact < 1KB？  → 必须（~30KB core 总预算）
3. 无 DOM 依赖（SSR safe）？ → 必须
4. 类型定义质量高？       → 必须
5. 无 module side effects？ → 必须
6. 可被 tree-shake？      → 必须
7. 许可证兼容（MIT/Apache-2.0）？ → 必须
```

当前 core 的外部依赖量表：

| 依赖                 | 当前是否使用         | 建议                                                 |
| -------------------- | -------------------- | ---------------------------------------------------- |
| `@floating-ui/dom`   | 否（在 adapters 层） | 正确——core 不依赖 DOM，floating 留在适配器           |
| `date-fns` / `dayjs` | 否                   | 保持——`color.ts` 和 `date.ts` 是纯数学，不依赖日期库 |
| `immer`              | 否                   | 保持——`setByPath` 已经足够                           |

### 4.3 自建 vs 采购的决策依据

```
条件                                   → 决策
---------------------------------------------------------------
逻辑高度领域特定（路径模型、虚拟化）    → 自建 ✅（已经自建）
逻辑是通用基础设施（retry with backoff）→ 30 行自建 vs 100KB 库 → 自建 ✅
逻辑涉及框架绑定（数据请求 cache）      → 插件 + 框架桥 → 保持选项开放
逻辑已有稳定标准（form validation）     → 自建 schema-agnostic engine ✅（已经自建）
```

**具体决策**：

- **Retry with backoff**：自建 ~25 行（指数退避 + 随机 jitter + 最大重试次数）。引入 `async-retry`（1.3KB）不划算。
- **乐观更新 rollback**：自建 ~80 行（diff snapshot → mutate → rollback on error）。不引入 immer/undo。
- **请求去重**：自建 ~40 行（Map<key, Promise> + GC）。不引入 `p-limit`/`p-queue`。

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级    | 方向                        | 代码影响                   | 总工时估计 | 业务价值               | 风险                             |
| --------- | --------------------------- | -------------------------- | ---------- | ---------------------- | -------------------------------- |
| **P1**    | A: 路径安全加固（原型污染） | `path.ts` + `path.test.ts` | ~6h        | 高（安全关键）         | 低                               |
| **P1**    | B: 统一 `__DEV__` 守卫抽象  | 新 `dev.ts` + 5 处调用迁移 | ~8h        | 中（维护性+包体积）    | 中（需确认 tsup 支持 `__DEV__`） |
| **P2**    | C: Fenwick 树增量重建       | `virtualizer.ts`（内部）   | ~10h       | 中（大列表性能上限）   | 中（需 bench 确认效果）          |
| **P2**    | D: TypedArray 优化          | `virtualizer.ts`（内部）   | ~6h        | 中（大列表内存）       | 低                               |
| **P2-P3** | E: 数据引擎增强             | 新 `data-engine.ts`        | ~24h       | 高（admin 生产级功能） | 中（API 设计需多次迭代）         |

### 5.2 阶段划分和里程碑

```
Phase 1 (Safety):       Day 1-3
  ├── Direction A: 路径安全加固
  └── Direction B: __DEV__ 守卫抽象 + 迁移

Phase 2 (Performance):  Day 4-8
  ├── Direction C: Fenwick 增量重建
  ├── Direction D: TypedArray 优化
  └── 性能基准门禁（1M rows render, 100k scroll）

Phase 3 (Capability):   Day 9-16
  ├── Direction E: 数据引擎增强
  │   ├── E1: retryWithBackoff  (Day 9-10)
  │   ├── E2: optimisticUpdate  (Day 11-13)
  │   └── E3: request dedupe    (Day 14-16)
  └── 全量集成测试 + 文档更新

里程碑 M1 (Day 3):      Path 安全加固合入 + __DEV__ 抽象 MVP
里程碑 M2 (Day 8):      虚拟化性能优化合入 + bench 门禁
里程碑 M3 (Day 16):     数据引擎新增 API 合入 + llms.txt 更新
```

### 5.3 风险点和缓解策略

| 风险                                               | 涉及方向 | 概率 | 缓解                                                                                                              |
| -------------------------------------------------- | -------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `__DEV__` 在 tsup 构建中未正确注入                 | B        | 中   | Pre-merge CI 中运行 `node -e "require('./dist/core/index.js')"` 确认 production 构建不包含 `console.warn` payload |
| 原型污染防护的假阳性（合法 field 名含 `__proto`）  | A        | 低   | 防护仅拒绝完整匹配 `__proto__`、`constructor`、`prototype`（全字匹配），不加通配符                                |
| 增量重建在有大量 `measure()` 调用的场景退化为 O(n) | C        | 中   | 在 bench 中设监控。若增量方案复杂度过高，退化为懒重建（标记 dirty，在 `lowerBound` 时一次性重建）                 |
| 数据引擎 API 设计偏离用户预期                      | E        | 中   | 先在 `plugin-pro-table` 中 prototype（快速验证），稳定后再下沉到 core                                             |
| 团队不熟悉 `Float64Array` API                      | D        | 低   | TypedArray 是标准 Web API，不增加外部依赖；可做 pair review                                                       |

### 5.4 已实现的"五方向"的后续维护建议

虽然分析文档描述的五个方向已在生产代码中实现，以下维护建议应纳入日常：

1. **`nav.ts` 深度截断测试**（~1h）：添加 `it('truncates at max depth 1000')` 测试，构造深度 1001 的树验证截断。这是极低成本补丁。
2. **`path.ts` 原型污染防护**（方向 A 的子集，~3h）：在 `cloneContainer` 和 `setByPath` 写入前过滤 `__proto__`/`constructor`/`prototype`。这是唯一的真实安全缺口。
3. **`selection.ts` 的版本号惰性重建已正确**——验证通过，无需改动。
4. **`window.ts` 的 rebalanceZ 已正确**——验证通过，无需改动。
5. **`virtualizer.ts` 的 `replaceData`/`detectCacheSkew`/`getItemKey` 警告已正确**——验证通过，无需改动。

---

## 总结

### 对分析文档的定位修正

分析文档 `2026-07-12-tech-lead-five-directions-implementation-analysis.md` 实际上是**追溯性文档**而非前瞻计划——描述的五个方向（`seen Set`、`rebalanceZ`、`PathError`、版本号索引、`replaceData`）**全部已实现、已测试、已合入主分支**。原分析的 21 个任务、61h 工时估算、M1-M4 里程碑全部「已达成」，不应作为未来计划。

### 真实架构缺口优先级

```
立即 (P1):  path.ts 原型污染防护 (~3h) + nav.test.ts 深度截断测试 (~1h)
本周 (P1):  __DEV__ 守卫抽象 + 迁移 (~8h)
此迭代 (P2): Fenwick 增量重建 + TypedArray 优化 (~16h)
下迭代 (P2-P3): 数据引擎增强 (retry + optimistic + dedupe, ~24h)
```

### 架构原则再确认

经过全面的源代码审计，Iris UI Core 的架构原则得到了实证支持：

- **A/B/C 分类法**：确实验证了 `selection.ts` 是 A 类（控制器）、`toCsv`/`replaceData` 是 B 类（附加）、`formatPath`/`snapRect` 是 C 类（纯材料）
- **逻辑下沉 core，适配器做薄桥**：`selection.ts` 的 187 行逻辑 = 四框架原来各自 150+ 行重复实现
- **防御性编程规范**：现有实现的防御深度（双重保护、版本号、dev throw）符合生产级库的标准

唯一需要修正的原则表述：**「A 零配置在场，B 不用不进包」在实际执行中得到验证——`rebalanceZ`、`replaceData`、`escapePathSegment` 均在主 bundle 内而不是可选插件，但它们属于核心模块的标准接口而非重型插件**，这一分类正确。
