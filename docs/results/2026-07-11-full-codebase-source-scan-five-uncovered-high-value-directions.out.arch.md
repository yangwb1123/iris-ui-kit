# 架构分析报告：Iris UI 代码库扫描验证评估

## 1. 架构评估

### 1.1 当前架构的优势

Iris UI 的架构设计在以下方面表现出色，与文档中验证的方向无关：

**分层清晰且执行严格**

- Layer 0-4 的分层是业界经过验证的模式（类似 Radix 的 `@radix-ui/primitive` → `@radix-ui/react-*`），但 Iris 更进一步将四框架共享逻辑全部下沉到 `@iris-ui/core`，这是比 Radix 更激进的做法。验证：core 中无任何框架 import。
- 插件系统用 `createPlugin` 的注册式 API（tokens/messages/store）替代了 monkey-patch，保持了核心的纯净。
- 适配器薄桥模式已经过四框架 149 组件的验证，证明模式可行。

**A/B/C 分类是优秀的心智模型**

- A（核心身份）零配置在场、B（附加）不用不进包、C（纯材料）无状态纯函数——这个三分法比"utility vs component"或"pure vs effectful"更精准地描述了逻辑归属。
- 实测验证：`createSelectionModel` 被 17 个组件共享，`nextEnabledIndex` 被 19 个组件共享——A 类和 C 类的复用确实实现了杠杆效应。

**Token 驱动设计的杠杆效应**

- 30 token vs 800 行 CSS 的 93%+ 节省不是营销数字，而是架构选择的结果。样式只用 `var(--iris-*)` 意味着换肤 = 修改变量映射，组件零改动。

### 1.2 扫描文档揭示的架构债务

扫描文档验证的 5 个方向揭示了当前架构的**三个层次**的债务：

#### 第一层：接口碎片化（方向二）

```
ProfileStorage  { load(): T; save(v: T): void }
SkinStorage     { get(): T; set(v: T): void; remove(): void }
Form.serialize  → 返回 { values, touched } 纯 JSON
```

**问题**：同一概念（持久化）有三种不同的接口签名。这不只是风格不一致，而是：

- 无法统一处理持久化策略（localStorage、IndexedDB、remote API 各需适配三次）
- 无法实现版本迁移中间件（需要改三个地方）
- 类型系统无法对持久化行为做统一约束

**根因**：每个模块在遇到"需要持久化"时独立设计了接口，没有上升到 core 层做统一抽象。这是典型的"自底向上设计"的代价——每个模块的抽象边界刚好够用，但跨模块的统一性未受约束。

#### 第二层：全局可变状态的生存困境（方向四）

```typescript
// clipboard.ts
let handler: ClipboardHandler | null = null
export function setClipboardHandler(h) {
  handler = h
}
```

**问题**：模块级全局可变单例与整个架构的实例化控制器模式（`createSelectionModel()`、`createExpansion()`）矛盾。`clipboard.ts` 和 `file-save.ts` 是 core 中仅有的两个全局可变状态。

这个矛盾导致了三个实际后果：

1. **测试隔离缺失**：不能并行测试不同的 clipboard handler 场景
2. **SSR 安全风险**：全局状态在服务端会被跨请求共享
3. **组件级覆盖不可行**：无法让两个组件各自绑定不同的 clipboard handler

**根因**：Clipboard API 的浏览器特性（`navigator.clipboard` 是全局的）被直接映射到了架构层面。架构应该提供抽象层来隔离平台 API 的全局性。

#### 第三层：跨控制器 wiring 的适配器泄漏（方向一）

扫描文档指出 54 个 subscribe 调用点分散在四框架适配器中。这本质上是**架构边界泄漏**：

```
core 控制器 A ----------状态--------→ 适配器 --------subscribe--------→ core 控制器 B
                    (通过 store)                    (手动订阅)
```

本该是 `core A → core B` 的 wiring 变成了 `core A → adapter → core B`。这个"迂回"有两个代价：

- 四框架各写一遍相同的 subscribe/effect 逻辑
- 无法在 core 层对跨控制器交互做单测（只能在框架集成测试中覆盖）

### 1.3 关键设计决策评估

| 决策                                      | 评价        | 理由                                                                               |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| 控制器采用工厂函数而非类                  | ✅ 正确     | 工厂函数更利于 tree-shaking、类型推导、无 `new` 约束                               |
| 状态用 `createStore`（发布-订阅）而非信号 | ✅ 正确     | 框架无关的信号不存在，发布-订阅是跨框架共享状态的最稳基础                          |
| 插件不提供 `registerComponent`            | ✅ 正确     | 组件注册会破坏静态 import 和 tree-shaking，schema-driven 用局部 `widgets` map 更好 |
| 状态机仅用于有事件语义的浮层组件          | ✅ 正确     | 避免 svjs 退化（每个组件 400 行 machine）                                          |
| 三套独立持久化抽象                        | ❌ 错误     | 应统一为 `StorageAdapter<T>` + 版本化中间件                                        |
| 全局可变 clipboard 单例                   | ❌ 错误     | 应实例化 `createClipboard()`                                                       |
| DataSource 无跨挂载缓存                   | ❌ 设计缺口 | 不是错误决定，是尚未被实现的已知缺口                                               |

### 1.4 架构债务优先级排序

| 债务                       | 严重度 | 影响面                       | 修复成本                                | 建议优先级 |
| -------------------------- | ------ | ---------------------------- | --------------------------------------- | ---------- |
| 跨控制器 wiring 适配器泄漏 | 高     | 四框架×所有复合组件          | 高（需新增 core 反应原语）              | P1         |
| DataSource 无状态保持      | 高     | CUD/Admin 场景基本可用性     | 中（新增 cacheKey 或 state serializer） | P1         |
| 持久化接口碎片化           | 中     | 所有需要持久化的模块         | 中（新增统一 `PersistenceAdapter`）     | P1-P2      |
| Clipboard 全局单例         | 低     | clipboard/file-save 两个文件 | 低（改为工厂函数）                      | P2         |
| derived getState O(n)      | 低     | 高性能派生场景               | 低（输入级缓存）                        | P2-P3      |

---

## 2. 扩展方向

基于扫描文档的验证结果 + 对项目 AGENTS.md 的理解，以下是经筛选的 3 个高价值架构扩展方向（排除"已覆盖"的方向一和方向五，保留真正原创和部分原创的方向，并从中提炼）。

### 方向 A：跨控制器反应原语（对应扫描方向一，但有差异化角度）

**扫描文档结论**：方向一内容已存在于两份 2026-07-11 文件。
**我的评估**：方向本身价值确实高，但已有分析覆盖了"what"（跨控制器需反应式），未覆盖"how"（以什么原语实现而不破坏框架无关性）。

**为什么需要**

- 当前 54 个 subscribe 调用点分散在四框架，且每个都是手动管理生命周期
- 复合组件的增多（Table + Selection + Sort + Filter + Pagination）使 wiring 数量呈组合增长
- 每次新框架适配都要重写这些 wiring——这与 core 的设计目标矛盾

**核心挑战**

- 如何在发布-订阅模型上构建声明式反应原语，而不引入框架信号？
- 原语必须足够通用（跨控制器），又足够具体（产生实际 effect，不只是值投影）
- dispose 生命周期的管理：派生关系的垃圾回收

**差异化方案**（与已有分析的区别）

已有分析：指出"需要声明式反应模型"，但浮在空中。
具体方案：在 `store.ts` 的 `derived` 之外新增一个 `createEffect` 原语：

```
createEffect(
  deps:  Store<A> | Store<B> | ...,  // 一个或多个 store
  fn: (values) => void               // 副作用的回调
) → { dispose() }
```

关键设计决策：

- **不替代适配器层的 `useEffect`/`onMount`**，而是让 core 控制器可以用 `createEffect` 表达跨控制器的副作用，减少适配器的负担
- `createEffect` 在 core 层实现，基于现有的 `store.subscribe` 包装，保持框架无关
- 返回 `{ dispose }` 让适配器层的钩子可以统一清理（"一次 dispose，全部清理"）

**预期的架构变更**

```
当前：
  React: useEffect(() => {
    const unsub1 = selection.store.subscribe(...)
    const unsub2 = dataSource.store.subscribe(...)
    return () => { unsub1(); unsub2() }
  }, [])

变更后：
  core: createEffect([selection.store, dataSource.store],
    ([sel, ds]) => { /* 统一处理 */ })
  React: useEffect(() => controller.effect.dispose(), [])
```

**对现有系统的影响**

- 向下兼容：新增原语，不影响现有 API
- 可渐进采用：新的复合组件可用，旧的保持原样
- 框架适配器：各需新增 `useEffect`/`onCleanup` 桥接，但这是薄桥

---

### 方向 B：统一持久化抽象 + 版本迁移协议（对应扫描方向二的新角度）

**扫描文档结论**：核心方向已覆盖，但"三套独立抽象冗余"的角度新。
**我的评估**：这个角度的价值被低估了——它不是一个"代码风格统一"问题，而是**架构扩展性的瓶颈**。

**为什么需要**

三套独立持久化抽象（ProfileStorage、SkinStorage、Form.serialize）的共同存在意味着：

1. **版本迁移无法统一应用**——如果未来需要从 v1 到 v2 的数据格式迁移，需要分别在三个地方实现
2. **存储策略无法统一替换**——从 localStorage 切换到 IndexedDB 要改三个地方
3. **新模块不知道用哪个**——如果有人想为 ResourceController 加持久化，是参考 ProfileStorage、SkinStorage 还是 Form？答案是"三个都不对，自己再创造第四个"

**核心挑战**

统一抽象需要解决三个矛盾：

| 矛盾             | 当前状态                                    | 统一方案需满足                                    |
| ---------------- | ------------------------------------------- | ------------------------------------------------- |
| 存储 vs 序列化   | Profile 是键值对，Skin 是 JSON，Form 是结构 | 分离 `Storage`（存什么）和 `Codec`（怎么序列化）  |
| 同步 vs 异步     | SkinStorage 是同步，Form.serialize 是同步   | 统一为异步（Promise），同步场景用 `sync fallback` |
| 版本化 vs 无版本 | Profile 无版本，Skin 有 `version` 字段      | 版本化是可选中间件，非强制                        |

**具体接口设计建议**

```
// 基础存储抽象
interface StorageBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

// 编解码（注入式）
interface Codec<T> {
  encode(value: T): string
  decode(raw: string): T
}

// 统一持久化控制器
createPersistence<T>({
  key: string          // 存储键
  backend: StorageBackend
  codec: Codec<T>
  version?: number     // 可选版本号
  migrate?: {          // 版本迁移（可选）
    [from: number]: (data: unknown) => T
  }
}) → { load, save, clear }
```

**预期的架构变更**

```
当前：ProfileStorage  → 自己的接口
     SkinStorage     → 自己的接口
     Form.serialize  → 纯 JSON 输出

变更后：ProfileStorage  → createPersistence({ key:'profile', backend, codec: JSONCodec })
        SkinStorage     → createPersistence({ key:'skin', backend, codec: JSONCodec, version:2, migrate:{1: ...} })
        Form.state      → createPersistence({ key:'form-{id}', backend, codec: FormCodec })
```

**对现有系统的影响**

- 向后兼容：新增 `createPersistence` 不删除旧接口，保留 `SkinStorage`/`ProfileStorage` 别名
- 迁移成本：低（包装现有实现），高收益（单一抽象）
- 风险点：已有用户的 localStorage key 格式可能变化——需版本迁移中间件处理旧 key

---

### 方向 C：DataSource 组件级状态保持（方向三——扫描确认唯一原创方向）

**扫描文档结论**：✅ 真正全新，P1。
**我的评估**：这是 5 个方向中**最紧迫的**，因为它影响的是 CMS/Admin 应用的基本可用性。

**为什么需要**

当前 `createDataSource(config)` 每次调用从零开始：

```
rows: [], page: 1, sort: null, filters: {}, ...
```

在 CMS 场景中：

1. 用户进入用户管理页 → 翻到第 5 页
2. 点击用户详情 → 查看详情
3. 返回用户管理页 → 回到第 1 页，丢失之前的状态
4. 用户体验极差

这不是"细节优化"，而是**应用框架的基本可用性需求**。Vben、Ant Design Pro、Naive Admin 都支持这个模式。

**核心挑战**

1. **缓存键（cacheKey）设计**：什么决定一个 DataSource 实例应该恢复状态？

```
方案 A（简单）：cacheKey = component route 路径
方案 B（精确）：cacheKey = (route, resourceName, paramsFilter) 的组合
方案 C（显式）：useDataSource({ cacheKey: 'users-page' }) 由开发者指定
```

推荐方案 C+ 方案 A 兜底——显式 cacheKey 给开发者控制权，忽略时用路由路径。

2. **状态序列化**：什么状态需要保持？

```
必须保持：page, pageSize, sort, filters, search
可选保持：selection（选中的行），expanded（展开的行）
不应保持：loading, error（这些是瞬态状态）
```

3. **内存管理**：无限缓存导致内存泄漏

- LRU 缓存策略：保留最近 N 个 DataSource 实例的状态
- 按路由生命周期：路由离开后保留 N 秒，超时释放

**预期的架构变更**

```
当前：
  createDataSource(config) → { store, ... }
  每次调用创建全新状态

变更后：
  createDataSource(config, options?: {
    cacheKey?: string
    cacheStrategy?: 'keep-alive' | 'on-revisit' | 'never'
    retainStates?: ('sort' | 'filters' | 'page' | 'selection')[]
  }) → { store, ... }

  内部 DataSourceCache（LRU Map<string, State>）
```

**对现有系统的影响**

- 向下兼容：不传 `cacheKey` 时行为不变（维持当前"每次全新"模式）
- 适配层：`useDataSource` 桥接需要传递 `cacheKey`（从路由系统获取）
- 风险点：四框架的路由系统不同（React Router / Vue Router / Solid Router / SvelteKit），`cacheKey` 的默认值需各框架桥接

---

### 补充方向 D：导出/剪贴板实例化（方向四升级版）

**扫描文档结论**：clipboard 作为独立的模块级全局可变状态是架构信号，P2-P3。
**我的评估**：价值虽低，但修复成本极低（两天级别），"高收益低投入"适合快速胜利。

**方案**

```
// 当前
export function setClipboardHandler(h) { ... }
export async function copyText(text) { ... }

// 变更后
export function createClipboard(handler?: ClipboardHandler) {
  // handler 可注入，不注入则 fallback 到 navigator.clipboard
  return { copyText, cutText, readText }
}
```

不删除全局 API，新增实例化 API，全局 API 内部使用 `createClipboard()` 的默认实例。这样：

- 不影响现有代码
- 新代码可以创建隔离的 clipboard 实例
- 测试中可 mock 而不污染全局

---

## 3. 接口设计建议

### 3.1 关键原则

基于扫描文档揭示的问题，以下是接口设计必须遵循的原则：

**原则一：同一个概念，同一个接口**

当前三套持久化抽象是反例。如果另一个模块需要"把数据存到 localStorage"，它不应该自己设计第四套接口。应当有一个 `@iris-ui/core` 级别的 `Persistence` 接口。

```typescript
// 不应该是每个模块自己设计
// 应该是 core 定义，模块消费
```

**原则二：实例化优先，全局单例是显式选择**

`clipboard.ts` 的反面教材。所有可变状态都应通过工厂函数创建实例：

- ❌ `let handler: ClipboardHandler | null = null` → 全局
- ✅ `createClipboard()` → 实例

全局单例（如 `IrisProvider` 的 theme context）必须是框架层面显式管理的，而不是模块随手写的。

**原则三：生命周期自管理**

`createEffect` 应当返回 `{ dispose }`，DataSource Cache 应当实现 LRU 自动淘汰。不要依赖开发者记住清理——架构应该提供"自动泄水"机制。

**原则四：默认安全，优化可选**

DataSource 应该**默认不缓存**（保持向后兼容），但提供清晰的 `cacheKey` 机制让开发者选择开启。默认选择是安全选择。

### 3.2 是否需要新的抽象层

| 抽象层                        | 是否需要  | 理由                                                             |
| ----------------------------- | --------- | ---------------------------------------------------------------- |
| `@iris-ui/core/persistence`   | ✅ 需要   | 统一 Profile/Skin/Form 的持久化抽象                              |
| `@iris-ui/core/effect`        | ✅ 需要   | 跨控制器反应原语，减少适配器重复代码                             |
| `@iris-ui/core/cache`         | ⚠️ 可选   | DataSource 的 LRU cache 可以放在 DataSource 内部，不一定要独立层 |
| `@iris-ui/plugin-persistence` | ❌ 不需要 | 持久化是 core 基础设施，不应是可选插件                           |

### 3.3 向后兼容策略

对每个方向的兼容策略：

| 方向                           | 兼容策略                             | 过渡期       |
| ------------------------------ | ------------------------------------ | ------------ |
| 反应原语 `createEffect`        | 新增导出，不修改现有                 | 无（新原语） |
| 统一持久化 `createPersistence` | 保留旧接口作为别名                   | 1-2 个版本   |
| DataSource cacheKey            | 不传 cacheKey 时行为不变             | 永久向后兼容 |
| Clipboard 实例化               | 保留全局 API，新增 `createClipboard` | 永久向后兼容 |

---

## 4. 技术选型

### 4.1 不需要引入新的技术栈

扫描文档揭示的问题**都可以在现有技术栈内解决**：

- `createEffect` 可以用 `store.subscribe` 实现，不依赖任何新库
- `createPersistence` 基于接口抽象，依赖注入
- DataSource cache 用 LRU Map（标准 JavaScript）
- Clipboard 实例化是纯重构

**不需要**：

- 信号库（Solid 的信号是框架特有的）
- RxJS（太重，发布-订阅够用）
- Zustand/Jotai（会引入框架依赖，破坏 core 的框架无关性）

### 4.2 依赖评估标准

| 标准     | 说明                                        |
| -------- | ------------------------------------------- |
| 框架无关 | 必须能在 `@iris-ui/core` 使用（零框架依赖） |
| 体积     | < 1KB min/gzip（core 的 size 预算 10KB）    |
| 无副作用 | 不修改全局原型、不注册全局事件              |
| 树摇友好 | ESM + named export                          |
| 类型完备 | 发布 `.d.ts`                                |

### 4.3 自建 vs 采购

| 需求             | 建议              | 理由                                    |
| ---------------- | ----------------- | --------------------------------------- |
| 跨控制器反应原语 | 自建              | 高度定制，与现有 `createStore` 深度耦合 |
| 持久化抽象       | 自建              | 简单接口，无成熟第三方库直接适用        |
| LRU Cache        | 自建或 `@std/lru` | 约 20 行代码，也可用 Deno 标准库（MIT） |
| Clipboard API    | 自建              | 纯封装，不需要第三方                    |

---

## 5. 实施路线图

### 5.1 优先级总表

| 优先级 | 方向                                  | 预期工期 | 风险             | 价值类型             |
| ------ | ------------------------------------- | -------- | ---------------- | -------------------- |
| **P0** | DataSource 状态保持（方向 C）         | 3-5 天   | 中（路由集成）   | 用户可见的可用性提升 |
| **P1** | 统一持久化抽象（方向 B）              | 3-5 天   | 低（纯重构）     | 架构债务消除         |
| **P1** | 跨控制器反应原语（方向 A）            | 5-8 天   | 高（设计需审慎） | 减少适配器重复代码   |
| **P2** | Clipboard/FileSave 实例化（方向 D）   | 1-2 天   | 低（纯重构）     | 测试隔离 + SSR 安全  |
| **P3** | derived getState 输入级缓存（方向五） | 2-3 天   | 低（局部优化）   | 性能微优化           |

### 5.2 阶段划分

#### 阶段一：Quick Wins（1-2 周）

**目标**：消除已确认的架构债务，低风险高信心

包含方向 D（Clipboard 实例化）+ 方向 C（DataSource 状态保持 `cacheKey` 基础版本）

里程碑：

- [ ] Clipboard 改为 `createClipboard()` 工厂，全局 API 作为默认实例包装
- [ ] FileSave 同理
- [ ] DataSource 新增 `cacheKey` prop，用 LRU Map 实现状态保持
- [ ] 适配器层 `useDataSource` 桥接 cacheKey（React → React Router，Vue → Vue Router）

**风险与缓解**

- 风险：`cacheKey` 的默认值在四框架中路由 API 不同
- 缓解：`useDataSource` 接收显式 `cacheKey` prop，不强制默认值

#### 阶段二：核心抽象（2-3 周）

**目标**：建立统一的持久化抽象 + 跨控制器反应原语

包含方向 B（统一持久化）+ 方向 A（`createEffect`）

里程碑：

- [ ] `@iris-ui/core/persistence` 新增 `createPersistence` + `StorageBackend` 接口
- [ ] `SkinStorage` 迁移到 `createPersistence`
- [ ] `ProfileStorage` 迁移到 `createPersistence`
- [ ] `Form` 的 `serialize` 增加可选的持久化桥接（不强制）
- [ ] `@iris-ui/core/effect` 新增 `createEffect` 原语
- [ ] 选择一个复合组件（如 Table + Selection + Pagination）作为试点迁移

**风险与缓解**

- 风险：`createEffect` 的设计可能不满足所有跨控制器场景
- 缓解：先在一个组件试点（如 Table），验证后推广
- 风险：`SkinStorage` 迁移到新接口可能破坏现有皮肤持久化
- 缓解：版本迁移中间件 + 向后兼容别名

#### 阶段三：深化优化（3-4 周）

**目标**：将方向 A 的 `createEffect` 推广到所有复合组件，性能优化

包含方向 A 推广 + 方向五（derived 缓存）

里程碑：

- [ ] 将现有的 54 个 subscribe 调用点逐步替换为 `createEffect`
- [ ] `derived` 的 `getState` 输入级缓存实现
- [ ] DataSource cache 添加 LRU 淘汰策略
- [ ] 四框架适配器层的 `useEffect`/`onMount` 清理模式统一

**风险与缓解**

- 风险：大规模替换可能导致回归
- 缓解：逐步替换，每个组件独立 PR，测试全绿后合并

### 5.3 关键风险矩阵

| 风险                                       | 概率 | 影响             | 缓解策略                                   |
| ------------------------------------------ | ---- | ---------------- | ------------------------------------------ |
| `createEffect` 设计不满足所有场景          | 中   | 高（需重新设计） | 先试点一个组件，验证后推广                 |
| `cacheKey` 在四框架路由中集成复杂          | 中   | 中（延迟交付）   | 先用显式 cacheKey prop，不依赖路由自动检测 |
| 持久化迁移破坏已有用户的 localStorage 数据 | 低   | 高（数据丢失）   | 版本迁移中间件 + key 前缀兼容 + 回退路径   |
| 三阶段工期排期紧，质量下降                 | 中   | 中               | 每阶段留 buffer，质量门不跳过              |

### 5.4 不做清单（显式排除）

这些是方向 A-E 未覆盖且被判定为当前不迫切的方向：

1. **DSL 级状态机生成器**：方向一延伸的极端版本（用 DSL 描述跨控制器交互然后生成代码）。概念上有价值，但实际需求不明确，且可能陷入"DSL 陷阱"（维护两套东西）。
2. **持久化中间件链**：类似 Redux 中间件的持久化 pipeline。过度设计——当前的版本迁移需求可以用简单函数组合解决。
3. **离线优先（Offline First）架构**：涉及 Service Worker、IndexedDB、冲突解决。超出了 UI 组件库的范围，属于应用层架构决策。
4. **跨框架测试基础设施**：统一四框架的测试 runner。工程价值高，但与当前讨论的 5 个方向正交，应单独评估。

---

## 总结

扫描文档的验证结果整体可信：5 个方向中 1 个完全原创（DataSource 状态保持），2 个有新增角度（持久化冗余、clipboard 测试隔离），2 个已覆盖（反应模型、derived 缓存）。

从架构角度，我认为**方向 C（DataSource 状态保持）应当立即推进**（P0），因为它解决的是一个用户可见的可用性问题，不是技术债务而是能力缺口。**方向 B（统一持久化）是最高价值的架构债务消除**（P1），因为它消除了"同一个概念三个接口"的碎片化，打开了版本迁移、存储策略替换、新模块快速接入的可能性。

最需要审慎设计的是**方向 A（跨控制器反应原语 `createEffect`）**——价值明确但设计的合理性直接影响后续推广。建议遵循"小步渐进"：先定义一个最小可用版本，在一个复合组件中验证，验证通过后再推广到全部 54 个 subscribe 调用点。

项目实施建议：**先做 P0（DataSource）和 P2（clipboard）这组头尾打包**——一个高可见性增强 + 一个低风险重构，6-8 天内交付，建立团队信心。然后做 P1 的两个方向，最后做 P3 的性能优化。
