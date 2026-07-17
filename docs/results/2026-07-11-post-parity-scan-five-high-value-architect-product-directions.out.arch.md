# 架构评审：Iris UI 技术债务与架构演进分析

## 1. 架构评估

### 1.1 当前架构的核心优势

Iris UI 的架构选择在同类 UI 库中属于**罕见的高明设计**。核心判断依据：

**逻辑下沉 (Layer 0) 策略正确**。将组件行为、控制器、引擎全部沉淀到 `@iris-ui/core`，四框架适配器仅做薄桥，这个决策直接带来了 149 组件 × 4 框架的数据面完全对齐。这是许多跨框架库（如 Reach UI、React Aria）没有做到的——它们要么只支持单一框架，要么在不同框架中行为不一致。

**Token 驱动的主题系统**也是架构级正确定位。`var(--iris-*)` 的 CSS 变量方案避开了 CSS-in-JS 的运行时开销、Tailwind 的编译时耦合、以及传统 BEM 的作用域问题。加上皮肤机制的 `extends` 继承 + 自定义命名空间，主题系统本质上是**一个轻量级 DI 容器**，而不是简单的颜色变量集。

**插件契约（`createPlugin`/`runPlugins`）** 的设计体现了良好的关注点分离——把重型能力（编辑器、pro-table、国际化包）放在插件层，不污染 core 的核心体积。`registerTokens`/`registerMessages`/`registerStore` 三个注册接口覆盖了 UI 库扩展的主要需求面。

### 1.2 架构债务与技术债

五大债务领域，按影响面排序：

#### 债务 ①：销毁协议缺失（最高危）

这是输入文档方向③的核心指认——**50%+ 控制器缺 `destroy()` 方法**。在架构层面，这意味着 core 没有统一的生命周期管理协议。

```
createSelectionModel → subscribe() ✅ → cleanup? ❌
createExpansion      → subscribe() ✅ → cleanup? ❌
createResourceController → 有 destroy() ✅ → 但接口未标准化
createAdminShell     → 有 destroy() ✅ → 同上
```

**为什么是技术债**：控制器是跨框架共享的逻辑层，React 通过 `useEffect` 的清理函数调用 `destroy()`，Vue 通过 `onUnmounted` 调用，Solid 通过 `onCleanup` 调用。如果 `destroy()` 不一致或缺失，框架适配器要么写重复的清理逻辑（破坏薄桥原则），要么产生泄漏（导致内存泄漏 + 重复订阅 bug）。当前的状态意味着**适配器层被迫承担了本属于 core 的生命周期管理责任**——这违背了 AGENTS.md 的原则 1。

#### 债务 ②：跨框架类型结构不一致（高危）

149 组件同名，但同名不等于同类型。以 `IrisButton` 为例，四个框架的 `Props` 接口可能已经出现分歧（variant 的 union 成员顺序不同、可选属性存在/缺失、事件处理函数签名不同）。

**为什么是技术债**：跨框架类型不一致不会在运行时崩溃（每个框架只消费自己的类型），但它破坏了生态建设的基础——社区贡献者在不同框架间的心智模型必须额外维护一份「差异清单」，而不是「一份文档通吃」。更严重的是，manifest 的 `llms.txt`（AI 原生消费层）如果从某框架提取了类型信息，这个信息对另一个框架可能部分错误。

#### 债务 ③：无 deprecation 基础设施（中高危）

当前代码中没有任何 `@deprecated` JSDoc 标记、没有 token 别名机制、没有版本化导出路径。这意味着库发布到 npm 后的第一个 major 升级**将被迫破坏性变更**——用户没有迁移路径，CI 没有警告机制，CHANGELOG 无法自动生成 breaking changes 列表。

这在架构层面反映了一个更深的问题：**项目没有定义「什么是稳定的」**。当一切都可以在任何时候被修改时，实际上没有任何东西是可靠的。

#### 债务 ④：Worker 打包策略未定义（中危）

输入文档已经指出 Worker 化的结构化 clone 成本问题。在架构层面，更本质的问题是：**core 没有「可序列化数据」的接口契约**。`DataView` 的 `loadMore()` 返回的是任意 JS 对象，没有 `structuredClone` 兼容性约束。一旦 Worker 化提上议程，必须回头约束数据接口——这是一种架构级别的前后颠倒：数据流设计应该在执行优化之前定义。

#### 债务 ⑤：feature flag 的「运行时 vs 构建时」混淆（低-中危）

输入文档精准指出了这个坑。架构层面的问题不是 flag 本身，而是**插件系统的扩展点被设计为运行时注入，但性能承诺却隐含了构建时消除**。这是一个 API 契约与实现之间的不匹配。

### 1.3 四项关键设计决策的评估

| 决策                     | 评估            | 风险                                         |
| ------------------------ | --------------- | -------------------------------------------- |
| 四框架共享同一 core      | ✅ 正确         | 需严格类型门（方向⑤）和生命周期契约（方向③） |
| Token-driven 主题        | ✅ 正确         | 无重大风险                                   |
| runPlugins 注册式插件    | ✅ 正确         | Layer 1–3 的 flag gap 需澄清                 |
| 异步操作用 createMachine | ⚠️ 正确但需边界 | 需防 svjs 退化（AGENTS.md 已有）             |

**一个需要修正的决策**：当前 `createResourceController` 的 `methods` 参数模式（`{ list, create, update, remove }`）是对象模式。从架构一致性角度，这应该是 `createMachine` 的状态机模式——因为 CRUD 资源天然有状态（idle → loading → success → error → ...）。当前的对象回调模式意味着资源控制器内部自建了一个隐式状态机，与 core 的显式 `createMachine` 范式不一致。这不是立刻需要修的问题，但值得记入架构债务。

---

## 2. 扩展方向

基于输入文档的 5 个方向 + 我的补充，提出 6 个架构级扩展方向。

### 方向 A：统一生命周期协议（P0）

**为什么需要**：

- 控制器是 Iris UI 的复用核心，当前 50%+ 缺 `destroy()` 意味着 core 的复用逻辑层没有可靠的清理契约
- 每个控制器消费 core 的 `Store` → `subscribe()` 产生订阅关系，这是泄漏的主要路径
- 四框架的卸载机制（React `useEffect` cleanup → Vue `onUnmounted` → Solid `onCleanup` → Svelte `$effect` cleanup）要求每个控制器都有统一的清理入口

**核心挑战**：

1. **契约定义**：不是所有控制器都需要 `destroy()`（纯函数不需要），需要精确标示哪些是可关闭资源
2. **组合清理**：控制器 A 的内部可能创建了控制器 B，`A.destroy()` 需要自动触发 `B.destroy()`（类似 `Disposable` 的 `using` 链）
3. **幂等性**：`destroy()` 调用多次不应报错

**预期的架构变更**：

```
packages/core/src/ 新增目录结构：
  disposable.ts         ← Interface + Symbol.dispose 支持
  disposable.test.ts    ← 单元测试
  各控制器文件 → 实现 Disposable 接口
```

核心接口设计：

```typescript
// core 导出
export interface Disposable {
  [Symbol.dispose](): void
  isDisposed?: boolean // 可选，用于断言
}

// 辅助函数（确保幂等）
export function disposeIfDisposable(target: unknown): void
export function using<T extends Disposable, R>(resource: T, fn: (r: T) => R): R
```

**对现有系统的影响**：

- 对消费方：零影响（`destroy()` 在适配器层调用，对框架用户透明）
- 对适配器层：从「各框架各自猜测清理逻辑」变为「框架无关的 `dispose()` 调用」
- 对测试：破坏性修改→补全后所有测试需要验证 `isDisposed === true`

### 方向 B：跨框架类型一致性门（P1）

**为什么需要**：

- 当前 manifest 只检查「同名」，不检查「同类型」（输入文档方向⑤的精准批评）
- 类型分歧会破坏 AI 原生消费层（`llms.txt` 从 React 提取的类型可能误导 Vue/Solid/Svelte 用户）
- 长期价值（方法 C 的共享类型契约）直接减少 ~75% 的类型定义代码（596 → ~149 个 Props 接口）

**核心挑战**：

1. **规范化比较**：union 成员排序、type alias 展开、泛型实例化——这些在字符串对比中都会产生误报
2. **框架特有属性的过滤**：React 有 `children` 和 `ref`，Vue 有 `v-model` 映射的 `modelValue`，Solid 有 `ref` 但不冲突——类型门需要知道哪些属性是框架特有的并排除
3. **部分对齐策略**：不是所有组件都需要严格类型一致（例如复杂表单组件的验证回调可以容忍轻量分歧）

**架构变更**：

```
短期（方法 A'）：
  scripts/type-gate/check.ts     ← ts-morph 结构化对比
  scripts/type-gate/known-diffs.json  ← 已知分歧白名单

中期（方法 C 起步）：
  packages/core/src/types/       ← 共享 Props 核心类型定义
  packages/core/src/types/button.ts  ← IrisButtonPropsBase
  各 adapter 从 core import 基础类型，只追加框架特有属性
```

**选择矩阵**：

| 方案                      | 成本        | 收益         | 误报率     | 误漏率             | 推荐场景     |
| ------------------------- | ----------- | ------------ | ---------- | ------------------ | ------------ |
| A（字符串化）             | ~200 行     | 快速扫描     | 高（排序） | 中（alias）        | 不推荐       |
| **A'（ts-morph 结构化）** | **~400 行** | **准确扫描** | **低**     | **低**             | **短期推荐** |
| B（运行时校验）           | ~600 行     | 端到端验证   | 无         | 中（仅运行时路径） | 辅助方案     |
| C（共享契约）             | ~1500 行    | 类型定义减半 | 无         | 无                 | **长期目标** |

**对现有系统的影响**：

- 短期（A'）：零影响，只读扫描
- 长期（C）：适配器层的 Props 定义需要重构——从独立定义改为从 core `extends`

### 方向 C：可序列化数据契约（P1 → 影响 Worker 化决策）

**为什么需要**：

- Worker 化的前提是数据可序列化，当前 core 没有约束 `DataView`/`ResourceController` 的数据形状
- 不仅仅是 Worker，localStorage 持久化、IndexedDB 缓存、跨 tab 通信都依赖于可序列化
- 这是一个「前置条件」扩展方向，不解决它则方向 E（Worker 化）可能被数据形状拖累

**核心挑战**：

1. **哪些数据必须可序列化**：从使用模式反推——表格的 `rows`、表单的 `values`、树组件的 `nodes`——这些是用户数据，天然可序列化。但内部状态（展开状态、选中项）也可能需要持久化
2. **如何在不破坏现有代码的情况下加约束**：不能给所有泛型参数加 `extends Serializable`（太侵入），应该用运行时 checks 或者 branding

**架构变更**：

```typescript
// 非侵入式标记
declare const SERIALIZABLE: unique symbol

export type Serializable<T> = T & { [SERIALIZABLE]: true }

// 断言函数（开发模式检查）
export function assertSerializable(
  value: unknown,
  path?: string,
): asserts value is Serializable<unknown>
```

这不是一个独立的扩展方向，而是 Worker 化、持久化、皮肤存储等方向的基础设施。

**对现有系统的影响**：低。断言函数只在 dev 模式执行，不影响 prod 路径。但如果要把 `DataView` 的泛型约束改为 `extends Serializable`，则需要修改所有消费该泛型的组件——这是一次性成本约 20 个文件修改。

### 方向 D：Layered Feature Flag 系统（P2→P1 如果考虑插件生态大小）

**为什么需要**：

- 当前插件系统是「全有或全无」——加载 `plugin-editor` 就加载了 SQL/JSON/JS 所有编辑器，即使只用 SQL
- 这对管理后台类应用（仅 SQL 编辑器）造成 ~60KB 的不必要负担
- feature flag 是实现渐进式复杂的核心机制（AGENTS.md 原则 6）

**核心挑战**：

1. **输入文档指出的运行时 vs 构建时 gap**——这是最大挑战
2. **flag 的可见性/作用域**：全局 flag vs 组件实例级 flag
3. **插件的 feature 自动发现**：手动枚举（当前方案）不可避免会过期
4. **嵌套 flag**：`editorPlugin` 包含 `sql`、`json`、`js` 三个子 feature，但 `pro-table` 可能包含 `inlineEdit`、`rowDrag`、`export`——需要树形 flag 结构

**架构变更**：

```
Layer 1（运行时）：现有方案 + usePluginFlags() hook
Layer 2（懒加载）：插件代码重构为 dynamic import 子模块
  plugin-editor/
    src/
      sql/index.ts    ← dynamic import
      json/index.ts   ← dynamic import
      js/index.ts     ← dynamic import
Layer 3（构建时）：新的 @iris-ui/bundler-plugin 包
  // 读取 pnpm config 或 JSON config
  // 在 build 阶段消除未注册的 dynamic import 路径
```

**对现有系统的影响**：

- Layer 1：对现有插件系统无侵入（只是消费侧多一个 prop）
- Layer 2：插件作者需要重构为子路径导出（现有 `plugin-editor` 已经是子路径模式，成本低）
- Layer 3：需要全新包，引入 bundler 插件依赖（webpack/vite/rollup）

### 方向 E：Off-Main-Thread Pipeline（P2，有前置条件）

**为什么需要**：

- 输入文档已经详细论证了结构化 clone 成本和真实痛点区间（5k–50k 行）
- 从产品角度看，这是 Iris UI 表格组件对标 AG Grid/Handsontable 的关键能力
- 技术栈上，`@floating-ui/dom` 已经证明了库可以优雅封装 DOM 操作

**核心挑战**：

1. **输入文档指出的 break-even 分析**——结构化 clone 成本可能抵消 Worker 化收益
2. **TSup 打包 Worker**——库模式下的 Worker 打包已知痛点
3. **SSR 降级**——Worker 不可用的环境（SSR）需同步 fallback
4. **四框架桥接**——每个框架的 Worker 生命周期管理不同

**前置条件**：

- 方向 C（可序列化数据契约）必须就绪——否则 Worker 通信的数据形状可能不可预测
- 建议在方向 A（destroy 协议）就绪后实施——Worker 生命周期也是 Disposable

**架构变更**：

```
packages/core/src/
  worker/
    WorkerPipeline.ts       ← 框架无关的 Worker 管理
    WorkerPayload.ts        ← 序列化/反序列化协议
    filtersort.worker.ts    ← Worker entry

注意事项：
  - 框架适配器只负责 worker URL 的解析
  - SSR 降级通过 import() 失败 catch 实现
  - Transferable 作为可选优化路径
```

**真实收益计算（修正输入文档的表）**：

| 行数     | 场景                 | Worker 收益                      | 净延迟影响        |
| -------- | -------------------- | -------------------------------- | ----------------- |
| <1k      | 简单列表             | 无（Worker 启动成本 > 排序成本） | +10–15ms          |
| 1k–10k   | 小型数据集           | 可接受（不卡主线程）             | +5–10ms           |
| 10k–50k  | **Iris UI 核心靶心** | **最高收益**                     | **≈持平，但不卡** |
| 50k–200k | 大型数据集           | 收益递减（clone 成本上升）       | +20–40ms          |
| >200k    | 超大表格             | 必须服务端分页，不应依赖 Worker  | —                 |

**推荐实施时机**：方向 A + C 就绪后，作为 v0.5+ 特性。

### 方向 F：Pluggable Store Backend（P3，新增方向）

**输入文档没有覆盖的一个长期方向**。

**为什么需要**：

- 当前 `createStore` 是内存单例模式，对于 `plugin-editor` 的文档状态、`plugin-pro-table` 的 CRUD 缓存，可能需要 IndexedDB 持久化
- 管理后台应用经常需要「刷新后保持选中/展开状态」，当前的 `localStorage` 持久化是硬编码在适配器层的，破坏了跨框架一致性
- 如果 core 提供可插拔的 store backend，四个框架可以共享同一套持久化策略

**核心挑战**：

1. **同步 vs 异步**：内存 store 是同步的，IndexedDB 是异步的——两者接口必须统一
2. **跨 tab 同步**：IndexedDB 需要 `BroadcastChannel` 或 `storage` 事件
3. **序列化约束**：同方向 C

**架构变更**：

```typescript
// 当前
export function createStore<T>(initial: T, options?: StoreOptions<T>): Store<T>

// 扩展后
export function createStore<T>(
  initial: T,
  options?: StoreOptions<T> & {
    backend?: StoreBackend<T> // 可插拔
  },
): Store<T>

// StoreBackend 接口
interface StoreBackend<T> {
  read(): Promise<T>
  write(value: T): Promise<void>
  subscribe(notify: () => void): () => void // 跨 tab 同步
}
```

内置 backend 包括 `MemoryBackend`（默认）、`LocalStorageBackend`、`IndexedDBBackend`；插件可提供自定义 backend。

**对现有系统的影响**：零影响（默认行为不变）。这是一个纯加法扩展。

---

## 3. 接口设计建议

### 3.1 核心原则

在输入文档的五方向基础上，我总结六个接口设计原则：

1. **可推理性优先**：一个函数的返回类型应该能仅从输入类型推导，不隐含框架上下文
2. **默认安全**：`createStore` 的订阅/清理应该是自动配对的，不是「记得调用 unsubscribe」
3. **渐进式发现**：一个 `IrisProvider` 可以 `use()` 插件、传 `pluginFlags`、加 `theme`、切换 `skin`——这些应该是「知道多少用多少」，不是「必须全掌握」
4. **框架中立接口不引用框架类型**：`@iris-ui/core` 的接口不应出现 `Ref<T>`、`Signal<T>`、`Writable<T>`——只出现原始 TS 类型
5. **向后兼容的默认值**：新 prop 必须有默认值（`default: false`/`undefined`），不得破坏现有调用
6. **单一职责的 Prop 接口**：`IrisSplitterProps` 不应该包含 `columns`（Table 专属），每个组件的 Props 应该只包含该组件需要的属性

### 3.2 是否需要新的抽象层

**需要新增的两个抽象层**：

**Abstract Layer 1：`Disposable` 资源协议**

```
当前：
  controller.destroy()            → 纯命名约定，无类型约束
  component.unmount() → onCleanup → ？(各框架各自猜测)

新增 Disposable：
  controller[Symbol.dispose]()    → 类型约束 + 自动链式清理
  component.unmount() → using()   → 四框架统一
```

这个抽象层使得四框架的适配器桥接代码从「猜测清理逻辑」变为「调用标准接口」。效果类似于 `Promise` 统一了异步协议——你不需要知道一个函数是同步的还是异步的，只需要 `.then()`。

**Abstract Layer 2：`Serializable` 数据契约**

```
当前：
  DataView<T> 的 T 无约束           → Worker 通信时可能出错

新增 Serializable：
  DataView<T extends Serializable>  → Worker 通信安全
  Store<T extends Serializable>     → IndexedDB 持久化安全
```

这个抽象层是不应该被跳过的——大部分 UI 库的数据持久化/Worker 化问题最终都可以追溯到「没有在接口层面约束数据可序列化性」。

**不需要新增的抽象层**：

- 不要新增「PluginHost」抽象层：当前 `IrisProvider` 的插件注册已经足够，再加一层只会增加学习成本
- 不要新增「MachineRegistry」：当前 `createMachine` 是工厂函数模式，每个组件各自 create，无需全局注册

### 3.3 向后兼容性策略

基于方向④的分析，提出三层兼容性策略：

**Layer 1：API Deprecation**

```typescript
// v0.3：标记废弃 + 别名
/** @deprecated Use `IrisTableProps['pagination']` instead. Will be removed in v1.0. */
export const tablePagination = ... // 仍可用，但 JSDoc 警告

// v0.4：warn（dev 模式）
export function usePagination(...) {
  // ... 实现 ...
  deprecate('usePagination', 'v0.3', 'v1.0', 'Use useTable().pagination instead')
}
```

**Layer 2：Token Deprecation**

实现输入文档的「双值周期」——在 tokens 包中：

```typescript
// tokens/v0.3/src/deprecated.ts
export const deprecatedTokens = [
  {
    token: '--iris-fg-dim',
    replacedBy: '--iris-fg-muted',
    since: '0.3.0',
    removeIn: '1.0.0',
    type: 'color',
    default: 'var(--iris-fg-muted)', // 别名
  },
]
```

dev 模式下 `applyTheme` 检测到已废弃 token 时 `console.warn`。

**Layer 3：Exports Deprecation**

`package.json` 的 `exports` 不直接删除，采用淘汰周期：

```
v0.3：exports 中保留全部 + @deprecated JSDoc
v1.0：移除 deprecated exports，但提供 migration codemod
v2.0：彻底移除
```

重要实现细节：**`package.json` 的 `exports` 不能有 JSDoc**，所以 deprecation 信息必须在 JSDoc 中和额外的 `deprecated.json` 清单文件中沉淀。AI 原生消费层的 `llms.txt` 可以根据 `deprecated.json` 生成「不要使用 v0.2 之前导出的这些函数」的人类说明。

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

经评估，六个方向均不需要引入新的 UI 框架或语言。但可能需要：

| 方向               | 新依赖                 | 理由                                  | 风险             |
| ------------------ | ---------------------- | ------------------------------------- | ---------------- |
| B（类型门）        | `ts-morph`（dev 依赖） | AST 结构化对比比字符串对比准确        | 低，dev only     |
| D（构建时 flag）   | `unplugin` 系列        | 构建时消除未用模块需要 bundler plugin | 中，影响构建流程 |
| E（Worker）        | `comlink`（可选）      | 简化 Worker postMessage 调用          | 低，可内联实现   |
| F（Store Backend） | `idb-keyval`（可选）   | IndexedDB 封装                        | 低               |

**关键结论**：五个方向基本不需要新运行时依赖（均是 dev 依赖或可选依赖）。只有方向 D 的 Layer 3（构建时 flag）需要 `unplugin`，但那是 v0.5+ 的远期目标。

### 4.2 第三方依赖评估标准

借鉴输入文档的严谨度，提议四维评估标准（适用于**每个新依赖**）：

1. **必要性**（0-5）：
   - 5 = 100 行内无法实现
   - 3 = 200-500 行可替代
   - 1 = 简单工具函数，不应引入

2. **稳定性**（0-5）：
   - 5 = SemVer 严格 + 2 年以上 + 周下载 > 10⁶
   - 3 = 稳定但 API 变动记录不佳
   - 1 = 实验性/维护不活跃

3. **树摇友好**（0-5）：
   - 5 = ESM + sideEffects: false + tree-shakeable exports
   - 3 = CommonJS 但可以 tree-shake
   - 1 = 全局依赖

4. **类型覆盖**（0-5）：
   - 5 = 内置 TS 类型，完全覆盖
   - 3 = 有 DefinitelyTyped
   - 1 = 无类型

**阈值**：新增依赖总分 ≥ 16/20。`ts-morph` 约 17/20（必要性 4 + 稳定性 5 + 树摇 3 + 类型 5）。`comlink` 约 14/20（必要性 2 + 稳定性 4 + 树摇 4 + 类型 4）——低于阈值，建议内联。

### 4.3 自建 vs 采购决策

| 能力                             | 自建                                                             | 采购                                                            | 决策                                |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Store Backend（方向 F）          | 内存/ localStorage / IndexedDB 三种实现 ≤ 200 行/backend         | `zustand`/`valtio`/`nanostores`——但都是前端 store，不是 backend | **自建**（core 已有 `createStore`） |
| Worker Pipeline（方向 E）        | 核心逻辑 ≤ 500 行（输入文档的估算偏乐观，我认为约 800 行含测试） | `observer.js`/`synaptic`——太重                                  | **自建**                            |
| Type Gate（方向 B）              | `ts-morph` 脚本 ≤ 400 行                                         | 无对应产品                                                      | **自建**                            |
| Leak Detector（方向③）           | 引用计数方案 ≤ 200 行                                            | 无对应产品                                                      | **自建**                            |
| Deprecation 工具（方向④）        | `deprecate()` 函数 + 清单 ≤ 150 行                               | `depd`——Node-only                                               | **自建**（浏览器 + Node 兼容）      |
| Bundler Plugin（方向 D Layer 3） | 基于 `unplugin` ≤ 300 行                                         | `webpack-remove-code`/`rollup-plugin-purge`——但不够精确         | **自建**（短期 Layer 1 已够用）     |

**明确结论**：所有五个方向的能力都应该自建。核心原因是——这些能力都是**与 Iris UI 的架构深度耦合的**，现有第三方库要么太通用（无法精确匹配 Token/插件系统），要么太重（引入不必要的代码体积）。

---

## 5. 实施路线图

### 5.1 优先级排序

综合输入文档的分析 + 我的架构评审，排序如下：

| 优先级 | 方向          | 名称                                    | 工期估算（人周） | 产出物                                      |
| ------ | ------------- | --------------------------------------- | :--------------: | ------------------------------------------- |
| **P0** | **A + ④**     | **统一生命周期 + Deprecation 基础设施** |       3–4        | 接口、destroy 审计补全、deprecated 清单     |
| **P1** | **B**         | **跨框架类型门**                        |       2–3        | ts-morph 扫描脚本、已知分歧清单             |
| P1     | C             | 可序列化数据契约                        |       1–2        | 断言函数、接口标记                          |
| P2     | D (Layer 1–2) | Feature Flag 运行时 + 懒加载            |       2–3        | `pluginFlags` prop、dynamic import 重构     |
| P2     | F             | Pluggable Store Backend                 |       2–3        | StoreBackend 接口、内置 backend 实现        |
| P3     | E             | Worker Pipeline                         |       3–4        | WorkerPipeline + SSR 降级 + break-even 测试 |
| P3     | D (Layer 3)   | 构建时 flag                             |        2         | `@iris-ui/bundler-plugin` 包                |

### 5.2 阶段划分

**阶段 1：「诊断期」— 发布前就绪（v0.3）**

目标：暴露当前所有风险，建立修复机制。

```
PR 1 — Destroy 审计 + 补全（方向 A）
  - 审计所有控制器 destroy() 状态
  - 补全缺失的 destroy()
  - Disposable 接口定义
  - 适配器层统一调用

PR 2 — 跨框架类型扫描（方向 B）
  - ts-morph 脚本
  - 首版差异清单
  - CI gate 加入

PR 3 — Deprecation 基础设施（方向④）
  - deprecate() 工具函数
  - JSDoc 规范 + ESLint 规则
  - token 别名机制
  - SemVer 承诺文档（更新 AGENTS.md/CONTRIBUTING.md）
  - deprecated.json 清单生成
```

**阶段 2：「巩固期」— v0.3 → v0.5**

目标：补全必须的前置条件，为性能优化铺路。

```
PR 4 — 可序列化数据契约（方向 C）
  - assertSerializable 函数
  - Store/DataView 的序列化约束
  - dev 模式警告

PR 5 — Feature Flag Layer 1–2（方向 D）
  - pluginFlags prop
  - 插件子路径 dynamic import 重构
  - usePluginFlags() hook

PR 6 — Store Backend 接口（方向 F）
  - StoreBackend 接口
  - MemoryBackend / LocalStorageBackend
  - 文档 + 示例
```

**阶段 3：「优化期」— v0.5+**

目标：性能 + 插件生态。

```
PR 7 — Worker Pipeline MVP（方向 E）
  - WorkerPipeline core 实现
  - 四框架桥接
  - SSR 降级
  - break-even 测试（确保只在实际有收益的场景 Work）

PR 8 — 构建时 Flag（方向 D Layer 3）
  - @iris-ui/bundler-plugin
  - 集成到 CI size 预算检查
```

### 5.3 风险点与缓解策略

| 风险                                          | 可能性 |             影响             | 缓解策略                                                                        |
| --------------------------------------------- | :----: | :--------------------------: | ------------------------------------------------------------------------------- |
| destroy() 补全导致测试大规模失败              |   中   |              高              | PR 1 分批进行（每个控制器补全 + 对应测试修复做同一 PR）                         |
| Type Gate 产生过多 false positive，开发者抵触 |   高   |              中              | 设 known-diffs.json 白名单；先扫描不阻止 CI，告警模式运行一迭代后再切 hard fail |
| Worker 打包的 tsup 配置复杂度超出预期         |   中   |              中              | 先做 POC（~200 行验证），再做完整实现                                           |
| 插件生态中的 feature flag 维护负担            |   中   | 低（Layer 1 不影响现有生态） | 可从文件系统自动发现子 feature，不用手动枚举                                    |
| SemVer 承诺对快速迭代形成约束                 |   高   |              中              | 采用「major 版本每年不超过 2 次」的节奏；minor 版本可高频（每 2-4 周）          |
| 四框架桥接的不一致引入新泄漏                  |   中   |              高              | 每个适配器版本都要经过方向 B 的类型门验证                                       |

### 5.4 依赖拓扑图

```
发布的依赖拓扑：

Phase 1                          Phase 2                       Phase 3
┌─────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│ A: Disposable    │───────→│ C: Serializable  │───────→│ E: Worker Pipeline │
│   (生命周期)     │        │   (数据契约)      │        │   (性能优化)       │
└─────────────────┘        └──────────────────┘        └───────────────────┘
         │                          │                           │
         ▼                          ▼                           ▼
┌─────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│ ④: Deprecation  │        │ D(L1→L2): Flag   │        │ D(L3): 构建时消除  │
│   (稳定性契约)   │        │   (渐进式复杂)    │        │   (体积优化)      │
└─────────────────┘        └──────────────────┘        └───────────────────┘
         │
         ▼
┌─────────────────┐
│ B: Type Gate     │
│   (跨框架质量)   │
└─────────────────┘
  (独立运行，不依赖其他方向)
```

关键依赖链：

- **Worker Pipeline** 依赖 **Disposable**（Worker 生命周期管理）+ **Serializable**（数据序列化）
- **Feature Flag Layer 2–3** 依赖 **Deprecation**（废弃旧路径时需 flag 切换过渡）
- **Type Gate** 是独立诊断工具，不依赖其他方向，可最早实施
- **Deprecation** 是横向基础设施，影响所有其他方向的 API 变更

---

## 6. 补充建议：方向 0 — 发布 readiness checklist

输入文档已经提及这个 gap，我在此提供一个完整的发布检查清单框架，作为所有方向之上的顶层约束：

### 必须完成（P0，阻止发布）

```
□ 方向 A — 全部控制器实现 Disposable，所有 subscribe() 必须有对应 unsubscribe()
□ 方向 B — 至少完成一次全库类型扫描，已知分歧已在文档中记录
□ 方向 ④ — deprecate() 工具可用，@deprecated JSDoc 在所有废弃导出上存在
□ SemVer 承诺文档已在 AGENTS.md 或 CONTRIBUTING.md 中明确定义
□ package.json 的 exports 字段已审查，无意外遗漏或暴露
```

### 强烈建议（P1，建议发布前完成）

```
□ 方向 C — Serializable 断言在 dev 模式可用
□ LeakDetector 工具（基于引用计数，非 FinalizationRegistry）在测试套件中运行
□ 所有测试在 cleanup 后验证 subscriberCount() === 0
□ manifest/llms.txt 已重新生成，反映任何 API 变更
□ size 预算已更新，反映任何新增包体积
```

### 可延迟（P2–P3，发布后迭代）

```
□ Worker Pipeline — v0.5+ 特性
□ Feature Flag Layer 2–3 — v0.5+ 特性
□ Store Backend 插件化 — v1.0+ 特性
```

---

## 总结

这是一个质量极高的 UI 基础设施项目，其核心架构设计（逻辑下沉、token 驱动、插件系统）在同类项目中属于领先水平。五个分析方向的选择和输入文档的论证都是有深度的。

我的核心补充判断是：

1. **销毁协议缺失是当前最危险的架构债务**——不是在运行时崩溃的意义上，而是在「让四框架测试全部可信」的意义上。没有统一的 `Disposable` 契约，任何「四框架行为一致」的宣称都是脆弱的。

2. **类型门不应该被推迟到 Post-MVP**——它是诊断工具，不是功能特性。在首次发布前完成一次全库类型扫描，列出所有已知差异，比试图在发布前消除所有差异更有价值。透明胜过完美。

3. **Worker 化的 ROI 被高估**——结构化 clone 成本和 break-even 分析表明它的真正收益空间比直觉上窄。建议在发布路线图中把 Worker Pipeline 推迟到 P3，除非有明确的产品需求（如 10k+ 行客户端表格）驱动。

4. **Feature Flag 需要管理用户期望**——当前的建议形态只承诺了运行时 flag（Layer 1），但伴随的「仅打包 SQL 所需的 60KB 节省」暗示了构建时消除（Layer 3）。这个 gap 如果不沟通清楚，会在社区中产生信任成本。

5. **最被低估的是方向 C（可序列化数据契约）**——它本身不是一个独立的亮点方向，但它是 Worker、持久化、跨 tab 同步、皮肤存储四个方向的前置条件。在当前路线图中作为 P1 是对的，但不能被推迟到 P2。

以上分析基于源码证据、架构推理和实际工程经验。如有需要深入讨论的维度，欢迎补充。
