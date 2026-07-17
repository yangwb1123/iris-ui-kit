现在我已充分理解了 Iris UI 中适配器桥接架构的真实状态。以下是我的全面架构分析——基于实际代码库探查，而非输入文档（输入文档只包含元对话内容，并未包含实际的分析内容），重点关注**149×4 组件对齐后剩余的真实适配器桥接缺口**。

---

# 架构分析：Iris UI 适配器桥接缺口（后期对齐）

> **分析日期**：2026-07-12 · **角色**：资深架构师  
> **背景**：四框架 149 组件对齐已完成（React/Vue/Solid/Svelte 同名同语义导出）。这份分析评估的是桥接层的架构健康状况——包括真实存在的差异、缺失的抽象、系统性的结构负债，以及在组件对齐完成后仍然存在的合规差距。

---

## 1. 架构评估

### 当前桥接架构的优势

| 方面                     | 评价                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **统一的状态模型**       | `Store<T>` + `createStore` 是经过深思熟虑的抽象。批处理语义（`batch`）、选择性订阅（`subscribeWith`）和惰性推导（`derived`）提供了几乎完整的响应式原语集。四个适配器通过薄壳包装器（每个约 5-10 行）进行桥接。 |
| **基于控制器的逻辑下沉** | `createSelectionModel`、`createExpansion`、`createKeyboardNav` 等将共享行为推入 core。Accordion 展示了这种模式——React 和 Vue 的适配器都调用 `createKeyboardNav`，并且只在适配器中实现渲染/生命周期桥接。       |
| **测试基础设施对齐**     | 四框架都通过 core 中的共享场景定义进行了契约测试（`@iris-ui/core/contracts`）。React/Vue/Solid/Svelte 都运行等效的断言。                                                                                       |
| **SSR 安全性**           | `useStore` 实现从 `store.getState()` 同步初始化，没有 `undefined` 闪烁——这一点所有四个适配器一致。                                                                                                             |

### 架构负债：5 个桥接缺口

通过代码库比较，我发现了 5 个系统性缺口——这些并非功能上的缺失，而是**架构层面**的适配器桥接问题，在 149 组件对齐完成后依然存在。下文将详细论述。

---

## 2. 扩展方向

### 方向一：模块组织结构分裂（Module Topology Fragmentation）

**核心问题**：相同的逻辑功能模块在四个适配器包中位于不同的路径下。

| 模块             | React               | Vue                               | Solid               | Svelte                                            |
| ---------------- | ------------------- | --------------------------------- | ------------------- | ------------------------------------------------- |
| `useMachine`     | `src/useMachine.ts` | **`src/machine/useMachine.ts`**   | `src/useMachine.ts` | `src/useMachine.ts`                               |
| `modal-utils/`   | `src/modal-utils/`  | **`src/primitives/modal-utils/`** | `src/modal-utils/`  | **`src/primitives/modal-utils/`**                 |
| `floating/`      | `src/floating/`     | **`src/primitives/floating/`**    | `src/floating/`     | `src/floating/`                                   |
| Behaviors 文件名 | `ClickOutside.tsx`  | `ClickOutside.ts`                 | `ClickOutside.tsx`  | **`IrisClickOutside.svelte`** + `clickOutside.ts` |

**为什么这是架构负债**：

1. **子路径导出不一致**：如果下游使用 `@iris-ui/vue/machine` 但 `@iris-ui/react/machine` 不存在，则子路径 `exports` 映射要么需要别名（增加认知负荷），要么无法统一遵循一个约定。
2. **四种框架的构建工具链不同，但路径约定必须统一**：tsup 配置（React/Vue/Solid）和 svelte-package（Svelte）的入口点解析不同。路径不一致意味着 `package.json` 中的 `"exports"` 映射不可移植。
3. **深层信号**：将 `modal-utils` 归入某些适配器的 `primitives/` 目录，暗示该模块被视为"原语级"——但在其他适配器中并非如此。这种分类上的不一致是架构上的混乱，时间越长越难理清。

**核心挑战**：Vue 适配器将其 `machine/` 目录作为 `src/machine/`（顶级），而其他适配器只有一个 `useMachine.ts`。这是有意设计的（Vue 的 `useMachine` 跨越多个文件），还是历史遗留的无心之失？无论哪种情况，对齐工作需要明确判断哪个模式是正确的，然后统一调整。

**预期变更**：

- **选项 A（最小变更）**：为四个适配器统一入口路径，在 `package.json` 中添加别名 `exports` 以保持向后兼容。例如，`@iris-ui/vue/floating` → `./src/primitives/floating/index.js`，与 React 的 `./src/floating/index.js` 匹配。
- **选项 B（重组）**：为所有四个适配器采用一个单一的路径约定——要么所有特定框架的模块都放在 `src/` 顶层（如 React/Solid），要么都放在 `src/primitives/` 下（如 Vue）。选择其中一个并重构另外三个。
- **选项 C（混合）**：将适配器包精简为仅包含框架桥接逻辑；将所有纯 UI 模块移入共享包（如 `@iris-ui/shared-react`、`@iris-ui/shared-vue`），但这些包并非真正的跨框架。

**我的推荐**：**选项 A**——调整 `package.json` 中的 `exports` 映射以规范化外部接口，同时允许内部组织结构在短期内保持原有状态。这为外部消费者提供了一致的行为，而对现有开发者工作流程的干扰最小。在下一个主要版本（major bump）中再考虑选项 B。

**影响**：低（仅构建配置）；影响所有四个适配器包。

---

### 方向二：行为实现差异（Behavior Implementation Divergence）

**核心问题**：Behaviors（Resizable、Movable、Hotkey、ClickOutside）在不同适配器中的实现方式不同——有的作为包裹器组件，有的作为 Svelte action，有的作为渲染函数——而且非 Svelte 适配器之间的内部签名也不同。

```ts
// React 和 Solid：组件包裹器
<IrisResizable><div>...</div></IrisResizable>

// Vue：渲染函数包裹器（defineComponent）
h(IrisResizable, ..., () => h('div', ..., slots))

// Svelte：组件包裹器
<IrisResizable><div>...</div></IrisResizable>

// 但也存在 Svelte action（非组件）：
use:clickOutside={{ handler }}
```

**为什么这是架构负债**：

1. **命名惯例分歧**：Solid 的 `IrisSortable.tsx` 与 React/Vue 的 `Sortable.tsx` 不一致。Svelte 对所有内部文件使用 `IrisXxx.svelte` 前缀，而 React/Vue 通常在源文件名中省略 `Iris` 前缀（但导出时使用 `Iris` 前缀）。
2. **API 表面分歧**：Svelte 的 `clickOutside` 作为一个 action 存在——这实际上是一个不同的 API（指令式 vs 声明式）。对于在不同框架间切换的开发者来说，这种差异增加了认知成本。
3. **Behaviors 是适配器桥接的核心**：项目文档（AGENTS.md）强调 Behaviors 是"renderless/薄定位包裹器，可嵌套"。如果 Behaviors 的实际实现方式不同，那么"行为可跨框架移植"的承诺就被削弱了。

**核心挑战**：Svelte actions 是 Svelte 生态中的重要模式（类似于 Vue 的自定义指令）。强行将 Svelte actions 转化为组件包装器可能会违背 Svelte 惯例。同样，Vue 的指令系统与 `v-resizable` 类似，但在 React 中并不存在。

**预期变更**：

- 记录官方 API 风格：每个行为**必须**作为包裹器组件存在。
- 允许特定框架的额外 API（Svelte action、Vue directive）作为**辅助**入口，但**不替代**包裹器组件。
- 统一文件名惯例：所有适配器中的源文件应使用 `IrisResizable.tsx`（带 `Iris` 前缀）以确保清晰度；Barrel 文件可以保持一致。

**影响**：中（需要重命名文件、更新 barrel、调整测试导入路径）。

---

### 方向三：未对齐的 Provider/插件存储访问（Misaligned Provider / Plugin Store Access）

**核心问题**：插件存储的访问模式在适配器之间并不一致。

```ts
// React（通过 provider context）
const store = usePluginStore<T>('key')

// Solid（有专门的 PluginStoreContext）
const store = usePluginStore<T>('key')

// Vue（通过 provider hooks）
const store = usePluginStore<T>('key')

// Svelte（通过 provider context）
const store = usePluginStore<T>('key')
```

接口看起来相同，但实现不同：

| 方面                  | React                  | Vue                          | Solid                   | Svelte                             |
| --------------------- | ---------------------- | ---------------------------- | ----------------------- | ---------------------------------- |
| Provider 结构         | 上下文 + hooks         | `provider/hooks.ts` + 上下文 | `PluginStoreContext.ts` | `provider/context.ts` + `hooks.ts` |
| `usePluginStore` 位置 | `provider/context.ts`  | `provider/hooks.ts`          | `PluginStoreContext.ts` | `provider/hooks.ts`                |
| Store 解析            | 从 IRIS_KEY 上下文读取 | 上下文 + 回退                | 独立上下文              | 上下文 + 回退                      |

**为什么这是架构负债**：

1. **维护开销**：虽然面向用户的 API 相同，但四个实现各有差异。`runPlugins` 在 core 中是统一的，但桥接到框架上下文的方式却不同。如果添加一个新的插件能力（比如 `registerComponent`），就需要在四个适配器中分别修改上下文实现。
2. **缺少插件健康面板**：现有的 `2026-07-10-5-uncovered-directions.md` 正确指出了故障隔离（方向四），但当前的插件提供者基础设施使得添加这样的面板变得困难——诊断信息没有被暴露到上下文之外。
3. **测试难度**：不同适配器有不同的提供者结构，编写跨框架的插件集成测试更加困难。

**预期变更**：

- 定义一个**共享的提供者桥接契约**（作为 TypeScript 接口，而非运行时），所有四个适配器都必须遵循。
- 在 core 中添加一个 `createPluginProvider` 辅助函数，该函数返回框架无关的 store/context 管理逻辑。
- 适配器只进行渲染和上下文注入——所有状态管理都委托给 core。

**影响**：中（对 `provider/` 目录进行重大重构；插件 API 本身不变）。

---

### 方向四：缺乏框架级渲染优化桥接（Missing Framework-Level Render Optimization Bridges）

**核心问题**：现有的 `2026-07-10-5-uncovered-directions.md` 文档讨论了 AI 原生渲染优化作为一个通用方向，但没有专门从四个适配器桥接的角度进行分析。

React 适配器中的现状：

```ts
// packages/react/src/primitives/tree/Tree.tsx —— 仅有的 useMemo 之一
const flattened = useMemo(() => flattenTree(data), [data])

// 112 个组件中只有 2 处 useMemo（非故事用途）
```

这类问题的适配器桥接视角揭示了一个更深层次的缺口：**渲染优化策略无法跨适配器共享**。

| 优化技术              | React                   | Vue                                         | Solid                                 | Svelte                             |
| --------------------- | ----------------------- | ------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `React.memo` / 记忆化 | 只有 2 处 `useMemo`     | 通过 `computed` 进行 Vue 响应式追踪（自动） | 通过信号进行细粒度更新（不需要 memo） | Svelte 5 通过 runes 进行细粒度更新 |
| 虚拟滚动              | 使用 core `virtualizer` | 使用 core `virtualizer`                     | 使用 core `virtualizer`               | 使用 core `virtualizer`            |
| `content-visibility`  | 无                      | 无                                          | 无                                    | 无                                 |
| 布局偏移预防          | 无                      | 无                                          | 无                                    | 无                                 |

**关键见解**：React 和 Vue/Solid/Svelte 在此处存在根本分歧：

- **React** 需要显式的 `React.memo` / `useMemo`，因为默认是自顶向下重新渲染。
- **Vue** 的响应式追踪意味着组件只有在依赖发生变化时才会重新渲染——不需要显式的记忆化。
- **Solid** 的细粒度信号意味着默认情况下不存在过度重新渲染的问题。
- **Svelte** 5 的 runes 提供类似 Solid 的细粒度更新。

这意味着**通用的 `IrisStable` 包裹器是不合理的**——在 Solid 或 Svelte 中它基本是空操作，而在 Vue 中边际效益很低。优化策略需要特定于框架，但发现哪些组件可以从记忆化中获益的逻辑可以共享。

**预期变更**：

- 在 core 中添加一个**渲染配置文件**，用于声明组件的渲染特性（"纯展示"、"以状态为中心"等）。
- 每个适配器读取这个配置并应用框架特定的优化（React：添加 `React.memo` 到纯展示组件；Vue/Solid/Svelte：确保响应式依赖键是正确的）。
- 不要尝试在所有适配器中统一优化——接受它们的不同之处，但要记录清楚。

**影响**：低到中（core 中的声明式元数据；适配器中的框架特定优化包装器）。

---

### 方向五：Svelte 5 Rune 迁移与命名空间冲突（Svelte 5 Rune Migration & Namespace Collision）

**核心问题**：如 AGENTS.md 中所述，Svelte 适配器存在一个已知的命名冲突："**Svelte: 不要把 `$state` 变量命名为 `state`**（`$state` 会被当成 store 自动订阅而报错）。"

但这只是冰山一角。Svelte 5 的 rune 系统（`$state`、`$derived`、`$effect`）与传统 Svelte store（`readable`、`writable`）和 Iris UI 的 `toStore` 桥接之间存在张力。

```ts
// packages/svelte/src/useStore.ts
export function toStore<T>(store: Store<T>): Readable<T> {
  return readable(store.getState(), (set) => store.subscribe(set))
}

// 在 Svelte 组件中使用：
let count = $state(0) // Svelte 5 rune
$: doubled = count * 2 // Svelte 4 反应式声明（在 v5 中已弃用）
```

**为什么这是架构负债**：

1. **双重反应式系统**：`toStore` 返回一个 Svelte 4 风格的 `Readable` store，但在 Svelte 5 中，官方的反应式原语是 `$state` + `$derived`。Svelte 适配器桥接到旧版 store API，而 Svelte 社区正在转向 runes。
2. **Rune 兼容性层缺失**：目前没有办法将 Iris 的 core `Store<T>` 直接桥接到 `$state`/`$derived` 而不经过 `toStore` 的中间转换。Svelte 5 的新 `useSnapshot` API（`svelte/reactivity`）本可以解决这个问题，但尚未被利用。
3. **`$state` 变量命名限制**：Svelte 适配器中的开发者必须完全避免将任何变量命名为 `state`，这既容易出错又不可测试。

**预期变更**：

- **选项 A（最小）**：添加一个 `toRune` 桥接，它返回一个类似 Svelte 5 rune 的 getter/setter 对，而不是 Readable store。
- **选项 B（主动）**：将 Svelte 适配器完全迁移到 Svelte 5 runes，弃用 `toStore` 并添加 `useStore`（返回一个 `$state` 兼容的 signal）。
- **选项 C（文档）**：记录 `$state` 命名空间冲突的解决方案，并保留当前的双重桥接方法。

**我的推荐**：**选项 A**——添加一个 `toSignal` 函数（返回 `{ get, set }` 或 `() => T`），使 Svelte 5 组件可以直接使用 core store，同时保持与现有 `toStore` 的向后兼容性。

**影响**：低到中（Svelte 适配器中的附加导出；不破坏现有 API）。

---

## 3. 接口设计建议

### 适配器桥接的核心接口原则

现有 `useStore`/`toStore` 模式是正确的。以下是我的精炼设计原则：

```
原则 1：桥接统一，渲染分化
- 通用：从 core Store 到框架反应式的桥接 API
- 特定框架：组件渲染、生命周期注册、事件处理

原则 2：一个适配器一个桥接点
- useStore（React/Vue/Solid）或 toStore（Svelte）是唯一的反应式桥接点
- 所有其他导出（useMachine、useStoreSelector 等）都建立在其之上

原则 3：内部 API 一致 = 外部 API 一致
- 私有文件名应跨适配器对齐（IrisButton.tsx 始终为 IrisButton.tsx）
- Barrel 导出应始终映射 IrisXxx（即使是内部文件命名为 button.tsx）
```

### 新抽象层需求

我在代码库探查中没有发现对全新抽象层的需求。现有的分层（core → 适配器桥接 → 适配器渲染）是正确的。但**桥接层内部**需要一个更清晰的契约：

```
┌─────────────────────────────────────────┐
│  @iris-ui/core                           │
│  Store<T> / derived / batch / subscribe  │
│  selection / expansion / keyboardNav     │
│  plugin.ts / runPlugins()                │
├─────────────────────────────────────────┤
│  BRIDGE CONTRACT（新接口，非运行时）      │
│  StoreBridge<T> = {                      │
│    subscribe, getState,                  │
│    toFrameworkReactive(): FrameworkRef    │
│  }                                       │
├────────────────┬───────────┬────────────┤
│  @iris-ui/react │ @iris-ui/vue │ @iris-ui/solid │ @iris-ui/svelte │
│  useStore()    │ useStore() │ useStore() │ toStore()         │
│  useMachine()  │ useMachine()│ useMachine()│ toMachine()      │
└────────────────┴───────────┴────────────┘
```

这个"桥接契约"是一个 TypeScript 接口（非运行时），文档化了每个适配器必须提供的内容，而**不需要**一个公共的抽象基类。

### 向后兼容性策略

| 变更类型       | 兼容策略                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| 重命名内部文件 | 不破坏：在旧路径下添加 `export { ... } from './new-path'`，标记为 `@deprecated` |
| 新增导出       | 安全的加法：新增导出不影响现有消费者                                            |
| 新增子路径     | 安全的加法：在 package.json 中添加 `"exports"` 条目                             |
| 移除导出       | 在 major bump 中发布，提前一个 minor 版本 deprecate                             |

**前缀重命名的具体策略**：如果决定将 `Sortable.tsx` 统一重命名为 `IrisSortable.tsx`，需要在旧路径下保留重导出，标记为 `@deprecated`，并在下一个 major 版本中移除。

---

## 4. 技术选型

### 不需要新的框架或运行时

目前的工具链选择是合理的：

| 层面     | 选择                                 | 评估 |
| -------- | ------------------------------------ | ---- |
| 构建     | tsup（库）+ svelte-package（Svelte） | ✅   |
| 测试     | Vitest + jsdom                       | ✅   |
| 类型检查 | TypeScript strict                    | ✅   |
| 包管理   | pnpm 9 + Turborepo 2                 | ✅   |

### 需要的：适配器桥接验证工具

有一个严重的工具缺口：**目前没有办法自动验证四个适配器桥接是否一致**。现有的契约测试系统（`@iris-ui/core/contracts`）验证组件行为，但不验证桥接层本身。

**推荐方案**：创建一个**桥接审计脚本**（作为 `@iris-ui/manifest` 的一部分或一个独立的工具），该脚本：

1. 扫描四个适配器的所有导出，并报告差异（例如"React 有 `useMachine`，Vue 有 `machine/useMachine`"）
2. 验证命名约定（`Iris` 前缀是否存在，文件名是否对齐）
3. 检查 `package.json` 中的 `exports` 映射是否跨包一致

**自建 vs 采用**：这个工具与 Iris 的架构紧密相关，不适合采用第三方方案。预期代码量约为 200-300 行 TypeScript。

### 第三方依赖评估标准

| 标准     | 权重 | 说明                                                |
| -------- | ---- | --------------------------------------------------- |
| 框架无关 | 高   | 依赖不能锁定某个特定框架（因为四个适配器共享 core） |
| 可树摇   | 高   | 寄生依赖会导致包体积膨胀                            |
| SSR 安全 | 高   | 依赖不能在客户端外抛出错误                          |
| 类型稳定 | 中   | 频繁的 breaking changes 会增加维护成本              |
| 测试友好 | 中   | 在 jsdom 中 mockable                                |

---

## 5. 实施路线图

### 优先级矩阵

| 方向                  | 当前损伤                       | 修复成本              | 用户可见性                     | 优先级 |
| --------------------- | ------------------------------ | --------------------- | ------------------------------ | ------ |
| ① 模块组织分裂        | 低（下游未广泛使用子路径导入） | 低（仅 build config） | 低                             | **P2** |
| ② 行为实现分歧        | 中（API 表面不一致）           | 中                    | 中（影响框架切换的用户）       | **P1** |
| ③ 提供者/插件存储对齐 | 中（增加维护成本）             | 中                    | 低（插件消费者看不到实现差异） | **P2** |
| ④ 渲染优化桥接        | 中（AI 原生场景）              | 低到中                | 中高（影响真实性能）           | **P2** |
| ⑤ Svelte 5 Rune 桥接  | 低（无 rune 桥接可用）         | 低（一个导出函数）    | 中（Svelte 用户）              | **P1** |

### 分阶段实施

**阶段 1（P1：方向② + ⑤）——约 1-2 周**

- 方向②：统一行为文件名（`IrisSortable.tsx` → 一致使用 `Iris` 前缀；为旧名称添加 @deprecated 重导出）
- 方向②：记录官方 API 风格（包裹器组件是必须的；指令/action 是可选的附加层）
- 方向⑤：添加 `toSignal`（返回 `() => T` 与 Svelte 5 的 `$state` 兼容）
- 方向⑤：在 Svelte 适配器中添加测试覆盖率，以验证 `$state` 变量名不会触发自动订阅错误
- **里程碑**：所有四个适配器中的行为导出名称一致；Svelte 5 rune 桥接可用。

**阶段 2（P2：方向①）——约 0.5 周**

- 审计四个适配器中所有子路径导出
- 统一 package.json 中的 `"exports"` 映射（例如 `@iris-ui/vue/floating` → `./src/primitives/floating/index.js` 通过别名）
- 添加桥接审计脚本以自动检测未来的路径分歧
- **里程碑**：所有四个适配器具有相同的子路径导出集。

**阶段 3（P2：方向③ + ④）——约 2-3 周**

- 定义一个共享的提供者桥接契约接口
- 在 core 中提取 `createPluginProvider` 以共享 store/上下文管理逻辑
- 添加渲染配置文件（core 中的元数据）用于声明组件的渲染特性
- 在 React 适配器中应用 `React.memo` 到所有纯展示组件（Badge、Chip、Divider 等）
- **里程碑**：提供者实现在四个适配器中保持一致；React 适配器中的默认记忆化。

### 风险与缓解策略

| 风险                                 | 可能性                                       | 缓解措施                                                                                                       |
| ------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 文件名重命名破坏消费者导入           | 低（如果消费者导入 barrel 名称而非内部路径） | 在旧路径下保留 1 个版本的 @deprecated 重导出；在 major bump 中移除                                             |
| Svelte 5 向 rune 的转变仍在进行中    | 中                                           | 提供 `toSignal` 作为可选附加，不弃用 `toStore`；在 Svelte 6 稳定后再重新评估                                   |
| 提供者对齐需要过多的适配器特定代码   | 中                                           | 如果 `createPluginProvider` 变得过于复杂，则放弃——接受四种适配器之间的差异，但通过文档和测试强制保证功能对等性 |
| React.memo 增加 React 适配器的包体积 | 低                                           | 每次添加都与基准比较（`pnpm size`）；仅对无 Prop 的展示组件添加                                                |

### 成功标准

- **桥接审计脚本**通过，无差异（所有导出、命名、路径在四个适配器间一致）
- **行为测试**验证所有四个适配器中的 API 签名相同
- **Svelte 5 测试**在没有 `$state` 命名冲突警告的情况下通过
- **React 基准测试**在添加 memo 后显示渲染时间改进

---

**总结**：Iris UI 的适配器桥接架构在概念上是正确的（统一 core + 薄框架桥接），但实现中存在 5 个系统性缺口。方向②（行为）和⑤（Svelte 5 runes）是 P1 优先级，因为它们影响日常的开发者体验和框架对等性。方向①（模块组织）虽然收益较低，但修复成本也低（主要为构建配置变更）。方向③（提供者）和④（渲染优化）具有较高的长期价值，但需要更谨慎的设计。
