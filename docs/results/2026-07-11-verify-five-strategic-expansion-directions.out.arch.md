# 架构分析报告：Iris UI 五大战略方向

## 1. 架构评估

### 1.1 当前架构的核心优势

**分层清晰，核心纯度极高。** `@iris-ui/core` 的 100+ 个模块零框架依赖——`grep -rE "from '(vue|react|solid|svelte)'" packages/core/src` 返回空。这是项目最不可妥协的防线，也是跨框架复用的根本保障。

**契约驱动。** 插件系统 (`createPlugin`/`runPlugins`) 是纯加法设计：插件可以注册 token、messages、store，但**不能**注册组件、不能 mutate 核心、不能劫持渲染管线。这种克制避免了插件间的意外耦合，也保证了 tree-shaking 始终有效。

**Fenwick 树的虚拟滚动算法选择。** `createVirtualizer` 选用 Fenwick/BIT 树做增量大小维护，O(log n) 的 point update + lower-bound search 在数学上是正确的选择。当页面真正承载 10 万行时，O(n) 的 cumulative offset 重建是不可接受的——架构级选型没有短期妥协。

**错误隔离意识已存在。** `runPlugins` 中 teardown 有 `try/catch` 隔离（一个插件的 teardown 抛异常不阻断其他插件的清理），`reloadPlugins` 中 `destroy()` 同样各自隔离。这种"韧性设计"的思维已经在代码中有体现。

### 1.2 核心架构债

**① Behavior 层碎片化——最严重的架构债**

| Behavior     | React                       | Vue                         | Solid                 | Svelte                | 应处位置 |
| ------------ | --------------------------- | --------------------------- | --------------------- | --------------------- | -------- |
| LongPress    | ✅ core `createLongPress`   | ✅ core                     | ✅ core               | ✅ core               | **正确** |
| Sortable     | ✅ core `createSortable`    | ✅ core                     | ✅ core               | ✅ core               | **正确** |
| Resizable    | `useDrag` (primitives/drag) | `useDrag` (primitives/drag) | 🔴 原生 `onMouseDown` | 🔴 原生 `onmousedown` | **core** |
| ClickOutside | 74行 + `ignore` ref         | ~71行                       | 43行, **无 `ignore`** | —                     | **core** |
| Movable      | 适配器内                    | 适配器内                    | 适配器内              | 适配器内              | **core** |
| Hotkey       | 适配器内                    | 适配器内                    | 适配器内              | 适配器内              | **core** |

`createLongPress` 和 `createSortable` 证明了"behavior 下沉 core"是完全可行的回——core 封装状态机/控制器，适配器只需要渲染 + 桥接 PointerEvent。与其重复 4 份用不同方式实现的 Resizable/ClickOutside，不如统一到 core，**消除重复、消除功能差（Solid ClickOutside 缺 ignore）、消除 25% 的适配器代码**。

**② 虚拟器缺少调度层（已完成的基础设施投入未产生杠杆）**

`createVirtualizer` 的 371 行实现了成熟的 Fenwick 树，但：

- 无 `requestAnimationFrame` 节流/合并——高频 `setScroll` 直接触发 `sync()` → `store.setState`，每帧可能触发多次无谓的 VirtualItem 重建
- 无 `IntersectionObserver`——检测 visible 窗口依然用纯 scroll-offset 计算，无法在 CSS `overflow: clip`/虚拟化父容器不可滚动的场景工作
- 无 `scheduler`/`debounce`/`throttle` 注入层——测试中无法精确控制 `computeWindow` 的触发时机
- **零应用消费**——四个桌面 OS 应用、CMS 应用、pro-table 均未使用 `createVirtualizer`

这意味着 371 行的核心基础设施是无杠杆的。投入已经有了，只差"调度层"和一个验证场景（如 pro-table 的分页虚拟列表）就能释放全部价值。

**③ 焦点管理单层化——复合体应用的无障碍缺口**

`useFocusTrap` 的架构是一个"快照"模型：

- 激活时记录 `previouslyFocusedRef`
- 失活时 restore 到那个单一元素
- **无栈式恢复**——当 Dialog 上叠 Dialog，第二个关闭后焦点回到 body 而非第一个 Dialog

对于 `AdminLayout`（多面板：Sidebar + Header + Main Content + TabStrip），不存在区域级焦点导航协议（如 `F6` 在 VS Code 风格的多面板间移动）。42 个 contracts 场景中 10 个提到焦点，但都是组件内部焦点行为（弹窗开关焦点移动、OTP 输入格焦点链），不是区域间导航协议。

这直接限制了 Iris UI 在"IDE 型"应用（CMS Admin、低代码编辑器、仪表盘）中的无障碍合规能力——WCAG 2.1 SC 2.4.11 Focus Not Obscured 和 SC 2.4.12 Focus Appearance 在后 L1 组件中难以保证。

**④ 插件系统无事件总线**

`plugin.ts` 中 grep `emit`/`dispatch`/`subscribe`/`EventBus`/`registerChannel`/`registerEvent` 全部零匹配。唯一的跨插件数据共享机制是 `registerStore(key, factory)` + `usePluginStore('key')`——纯 pull 模型。

当两个插件需要协调时（例如：`plugin-editor` 修改文件后 → `plugin-pro-table` 刷新列表），目前只能通过共享这个 store 的 pull 机制，或者通过外部框架代码桥接。没有松耦合的发布-订阅通道。

同时，`runPlugins` 中插件的 `install` 缺少错误隔离——一个插件 install 抛出异常，后续所有插件都不会执行。与 teardown 的隔离形成了矛盾。

**⑤ 启动编排四端重复——违反了「逻辑下沉 core」原则**

四个桌面 OS 应用 `App.tsx`/`App.vue`/`App.svelte` 都做了同一件事：

```
createWindowManager  →  createUserProfile  →  createNotificationCenter
→  createClipboardHistory  →  createVirtualFs  →  await profile.hydrate()
→  restoreSession  →  hydrateFs  →  persist (debounced)
```

相同的 5-6 个 store 实例化 + 相同的 async hydrate 链式依赖 + 相同的 debounced 持久化——却在 React (`useEffect`)、Vue (`onMounted` + `watch`)、Solid (`onMount` + `createEffect`)、Svelte (`$effect`) 各写一遍。

这直接违反项目铁律第一条："一切『换个框架也一样』的逻辑都属于 core——出现在适配器里即是 bug。"启动编排就是换个框架也一样的逻辑。

---

### 1.3 架构健康度评分

| 维度                 | 评分       | 说明                                          |
| -------------------- | ---------- | --------------------------------------------- |
| 核心纯度             | ⭐⭐⭐⭐⭐ | core 零框架依赖，不可妥协                     |
| 分层清晰度           | ⭐⭐⭐⭐   | Layer 0-4 清晰，但 Behavior 跨 Layer 边界模糊 |
| 跨框架一致性         | ⭐⭐⭐     | L1-L2 组件 149 个对齐；Behaviors 不一致       |
| 可扩展性             | ⭐⭐⭐⭐   | 插件系统好，缺事件总线                        |
| 对外发布就绪         | ⭐⭐⭐⭐   | size 预算 + changesets 就绪                   |
| 重大型能力（虚拟化） | ⭐⭐⭐     | 算法选型对，缺调度层、无消费验证              |
| 无障碍深度           | ⭐⭐⭐     | 组件级焦点好，复合体级缺口                    |
| 测试可测性           | ⭐⭐⭐⭐   | 1500+ 测试，jsdom 陷阱明确文档化              |

---

## 2. 扩展方向（3-5 个高价值方向）

### 方向 A：Behavior 统一下沉 core（P0）

**为什么需要：**

- 消除 4 份重复实现，减少适配器代码量约 25%
- 消除功能差（Solid ClickOutside 缺 `ignore` refs）
- 项目铁律第一条的直接执法——这些 Behavior 是"换个框架也一样"的典型
- `createLongPress` + `createSortable` 已经证明模式可行

**核心挑战：**

- **指针抽象问题：** Resizable/Movable 依赖 pointer 事件序列（mousedown → mousemove → mouseup），不同框架需要不同的桥接方式。React/Vue 已共享了 `useDrag` 作为 primitives/drag，但 Solid/Svelte 用原生事件
- **DOM 访问时机：** ClickOutside 需要 `contains()` 检查，这只能在渲染后执行——core 不碰 DOM，因此 core 层的判断必须通过回掉/注入让适配器完成
- **正交性保持：** Behaviors 应可嵌套、可组合，不能与框架的渲染模型冲突

**预期的架构变更：**

```
packages/core/src/behaviors/
  createLongPress.ts      ← 已有
  createSortable.ts       ← 已有
  createResizable.ts      ← 新增：封装尺寸约束 + 指针增量
  createClickOutside.ts   ← 新增：纯事件坐标判断，适配器提供 DOM 上下文
  createMovable.ts        ← 新增：增量偏移累计
  createHotkey.ts         ← 新增：键绑定注册/注销

各适配器：
  behaviors/Resizable.tsx → 导入 core createResizable，只做事件绑定
  behaviors/ClickOutside.tsx → 导入 core createClickOutside，只传 ref + 回调
```

**对现有系统的影响：**

- 向后兼容：导入路径不变（仍从 `@iris-ui/react` 等导入 `IrisClickOutside`），只在内部实现上切到 core
- 适配器 4 份 `Resizable.tsx` 各减约 50-80 行
- 核心包 size 预算上调约 2-3KB（远小于适配器缩减的量）

**备选方案：**

| 方案                                                  | 优点                         | 缺点                                        |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| A1. 全部下沉 core                                     | 消除重复最多，铁律执法最彻底 | 需要协调四端并行改，行为签名统一压力大      |
| A2. 先下沉 ClickOutside + Resizable（当前碎片最严重） | 影响面小，可逐步推进         | 长期仍碎片化，Hotkey/Movable 需后续继续投入 |
| A3. 只在适配器内共享 `useDrag` 抽象（当前状态）       | 零改动                       | 碎片不消除，功能差不修复                    |

**建议：A1（全部下沉）+ 分步实施，先下沉 ClickOutside + Resizable（Sprint 1），再 Hotkey + Movable（Sprint 2）**

---

### 方向 B：虚拟器调度层 + 应用验证（P0）

**为什么需要：**

- 释放已投入的 Fenwick 树基础设施的杠杆价值
- 为 pro-table 提供原生的虚拟滚动列表（当前 plugin-pro-table 未使用虚拟化）
- 桌面 OS 的 Files 应用（简单的 `fs.list()` 映射，225 行）需要升级为可处理 5000+ 文件的虚拟列表

**核心挑战：**

- 调度策略选择：rAF vs `requestIdleCallback` vs `IntersectionObserver`——不同场景（大型 Table vs 聊天列表 vs Tree）需要不同的策略
- `measure` 的反向压力：当子项渲染后报告实际大小，粒度控制不好会导致"乒乓"（size 变化 → 滚动 offset 重算 → 重新渲染 → 新的 measure）
- 适配器的 `getBoundingClientRect` 在 jsdom 中恒为 0——测试覆盖需要重构 mock 策略

**预期的架构变更：**

```ts
// VirtualizerConfig 新增
export interface VirtualizerConfig {
  // ... 现有字段
  /** 调度策略：'sync' | 'rAF' | 'idle' | 'custom' */
  scheduler?: 'sync' | 'rAF' | 'idle' | ((fn: () => void) => void)
  /** IntersectionObserver 阈值，提供时替代纯 scroll-offset 窗口检测 */
  observer?: IntersectionObserverInit
  /** 滚动合并间隔（ms），默认 0 = 不合并 */
  scrollMergeMs?: number
}
```

**对现有系统的影响：**

- 向后兼容：`scheduler` 默认 `'sync'` 保持现有行为
- 新增 `scheduler` 参数，适配器只需把框架的 `requestAnimationFrame` 传入
- 需要在 `plugin-pro-table` 中新增一个验证场景（如 1000 行表格的虚拟滚动）

**风险点：**

- 调度层设计过度抽象——四个框架各有 rAF 实现（`requestAnimationFrame` 在 SSR 中不存在）
- 缓解：core 内聚一个轻量 `createScheduler` 工厂，`'sync'` = 直接执行，`'rAF'` = `typeof requestAnimationFrame` guard，`'idle'` = `requestIdleCallback` 回退

---

### 方向 C：焦点栈 + 区域间导航协议（P1）

**为什么需要：**

- WCAG 2.1 合规：嵌套弹窗场景必须栈式恢复焦点
- AdminLayout/多面板应用需要区域级焦点导航（VS Code 风格的 F6/Ctrl+F6 区域切换）
- 为 CMS demo 和其他 L4 应用解锁无障碍认证

**核心挑战：**

- 焦点栈需要框架无关的实现——core 只维护 `{ trigger, container }` 栈，实际的 `focus()` 调用在适配器
- SSR 中 `document.activeElement` 不存在——栈只能在 client 端初始化
- 区域间导航协议需要区域注册表 + 方向语义（"next region"/"previous region"），不能写死在 AdminLayout 中

**预期的架构变更：**

```ts
// packages/core/src/focus-stack.ts (新增)
export interface FocusTrapRecord {
  container: string // 仅在 client 端解析为 Element 的 id
  trigger: string
  timestamp: number
}
export function createFocusStack(): FocusStackController {
  // push / pop / peek / restoreAll
}

// packages/core/src/region-nav.ts (新增)
export interface Region {
  id: string
  label: string // 供 AT 朗读
  order: number
}
export function createRegionNav(regions: Region[]): RegionNavController {
  // next(forward) / prev(backward) / focus(id)
}
```

**对现有系统的影响：**

- 现有 `useFocusTrap` 内部实现切换到 `createFocusStack`，API 向后兼容
- 新增 `IrisFocusRegion` 组件（四个框架各增加一个组件，manifest 149 → 150）
- `AdminLayout` 可选使用 `IrisFocusRegion` 包装 Sidebar/Header/Main，开启区域导航

**备选方案：**

| 方案                                   | 优点                           | 缺点                                   |
| -------------------------------------- | ------------------------------ | -------------------------------------- |
| C1. 只在 core 加焦点栈，不引入区域导航 | 解决嵌套弹窗焦点恢复，改动最小 | 复合体导航仍需应用层自己实现           |
| C2. 焦点栈 + 区域导航协议都做          | 一次性解决两类缺口             | 接口定义复杂度高，需要至少一个验证场景 |

**建议：C1（焦点栈）先做（P1），C2（区域导航）放到后续（P2），等待有明确的应用需求驱动**

---

### 方向 D：跨插件事件总线（P1）

**为什么需要：**

- 插件间松耦合通信：editor 保存 → pro-table 刷新 → notification 提醒
- 现有 `registerStore + usePluginStore` 的 pull 模型要求消费者知道 store key，是紧耦合的字符串引用
- 插件需要跨生命周期传递事件（如"用户登录"→ 多个插件各自切换数据源）

**核心挑战：**

- 事件类型安全：TypeScript 中如何让不同插件声明自己发出/监听的事件类型？全局 `EventMap` 接口合并（declaration merging）还是每个插件包导出事件类型？
- 内存泄漏：订阅了事件的插件 unmount 后必须自动取消订阅
- 时序：事件发出的时机 vs 订阅者注册的时机——`registerLazyStore` 的场景中，如果 store 未实例化，事件发送给谁？

**预期的架构变更：**

```ts
// PluginRegistry 新增方法
export interface PluginRegistry {
  // ...现有
  /** 注册事件通道，返回 emit/on/off API */
  registerChannel<T extends string>(
    channel: string,
  ): {
    emit(event: T, payload?: unknown): void
    on(event: T, handler: (payload: unknown) => void): () => void // 返回 unsubscribe
  }
}

// CollectedRegistrations 新增
export interface CollectedRegistrations {
  // ...现有
  /** 事件总线实例，插件可通过注册时的引用访问 */
  bus: EventBus
}
```

**对现有系统的影响：**

- 纯加法，向后兼容
- 现有 `registerStore`/`usePluginStore` 路径不受影响
- 新增的 `registerChannel` 是可选的——简单场景仍可通过 store pull 实现

**风险点：**

- 事件总线的"全局可见性"容易退化为隐式耦合，团队需要约定"通道命名空间 = 插件名"（如 `editor:save`、`notifications:show`）
- 缓解：在 API 设计上要求通道名必须包含插件名前缀，违反则 devWarn

---

### 方向 E：启动编排器统一化（P1）

**为什么需要：**

- 直接违反项目铁律第一条——"启动编排换个框架也一样"
- 四个桌面 OS 应用、CMS 应用都存在相同的 5-6 个 store 实例化 + hydrate + 持久化模式
- 统一后可减少约 200 行/应用的重复代码，启动逻辑变更只需改 core

**核心挑战：**

- **框架差异：** 不同框架的 lifecycle hooks 不同（`useEffect` vs `onMounted` vs `$effect`），但这些只是"什么时候调用 `start()`"的区别，不是"启动流程做什么"的区别
- **异步管道：** `profile.hydrate()` 返回 Promise，不同框架处理 async 的方式不同（React 用 `.then` + `setState`，Vue 用 `await` + 响应式，Svelte 用 `$effect`）
- **OS vs CMS vs Playground** 启动需求不同，`createBootOrchestrator` 不能是重型框架

**预期的架构变更：**

```ts
// packages/core/src/boot.ts (新增)
export interface BootConfig {
  stores: {
    windowManager?: { workspaces: number }
    profile?: { storage: ProfileStorage }
    notifications?: {}
    clipboard?: {}
    fs?: {}
    commands?: {}
  }
  onHydrated: () => void | Promise<void>
}

export function createBootOrchestrator(config: BootConfig) {
  // 同步实例化所有 store
  // 提供 start() / onTeardown() / isHydrated() 统一接口
}
```

**对现有系统的影响：**

- 各框架的 `App.tsx` 从"手写 5-6 个 `useRef` + `useEffect`"变为：

```ts
// 使用前（React，65 行）
const profile = React.useRef(createUserProfile(...)).current
const wm = React.useRef(createWindowManager(...)).current
const fs = React.useRef(createVirtualFs()).current
// ... 大量 useEffect ...

// 使用后（React，15 行）
const orchestrator = useBootOrchestrator({
  stores: { windowManager: { workspaces: 4 }, profile: { storage: '...' }, /* ... */ }
})
```

- 对 Vue/Solid/Svelte 同样减至 10-20 行
- 向后兼容——现有代码无变化，新应用可选择使用

**备选方案：**

| 方案                                                       | 优点                          | 缺点                                   |
| ---------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| E1. 只提取 store 工厂列表（声明式）                        | 最轻量，只消除 store 创建重复 | 不消除 hydrate + persist 的重复        |
| E2. 完整启动编排器（store + hydrate + persist + teardown） | 消除全部重复                  | 设计复杂，需要覆盖 4 框架 × 2 应用类型 |
| E3. 不做，保持现状                                         | 零改动                        | 铁律违规继续存在                       |

**建议：E2 但分两阶段——Sprint 1 只提取 store 工厂列表 + hydrate 生命周期（轻量编排），Sprint 2 加入 persist 模式**

---

## 3. 接口设计建议

### 3.1 关键模块接口原则

**Behavior 下沉 core（方向 A）的接口设计原则：**

```ts
// 原则 1：core 层只管理状态 + 纯判断，不碰 DOM
// ❌  错误——core 层不应知道 DOM
function createClickOutside(container: HTMLElement, callback: () => void)

// ✅  正确——core 层管理"是否在内部"的判断逻辑
function createClickOutside(config: {
  onOutside: () => void
  enabled: boolean
  /** 适配器在 render 后调用 */
  isInside: (target: EventTarget) => boolean
}): ClickOutsideController

// 适配器只需要：
function IrisClickOutside(props) {
  const ctrl = useRef(createClickOutside({ onOutside: props.onOutside })).current
  const wrapperRef = useRef(null)
  // 适配器提供 DOM 上下文
  const enhanced = useMemo(
    () => ({
      ...ctrl,
      isInside: (target) => wrapperRef.current?.contains(target) ?? false,
    }),
    [ctrl],
  )
  // ...
}
```

**原则 2：Core 控制器返回 `{ store, events }`，适配器桥接到框架反应式**

```ts
// createResizable 返回
interface ResizableController {
  store: Store<ResizableState> // { size, isResizing }
  startDrag(e: { clientX: number; clientY: number }): void
  moveDrag(e: { clientX: number; clientY: number }): void
  endDrag(): void
}

// React 适配器
function useResizable(ctrl: ResizableController) {
  return useSyncExternalStore(ctrl.store.subscribe, ctrl.store.getState)
}
```

**原则 3：`PluginRegistry` 的事件总线方法签名——装饰器模式，不改现有接口**

```ts
// 扩张 PluginRegistry 而非修改
interface PluginRegistry {
  // ... 现有 registerTokens / registerMessages / registerStore / registerLazyStore / onTeardown
  // 新增（纯加法）
  registerChannel(name: string, events?: string[]): ChannelHandle
}

// 通道名强制命名空间前缀
function validateChannelName(name: string): boolean {
  return /^[a-z][a-z0-9-]+:[a-z][a-z0-9-]+$/.test(name)
  // e.g. 'editor:document' 'notifications:toast'
}
```

### 3.2 是否需要新的抽象层

**需要：** 调度层抽象（方向 B 的 `Scheduler`）

```ts
// packages/core/src/scheduler.ts
export type SchedulerFn = (fn: () => void) => () => void
// 返回 cancel 函数

export const SyncScheduler: SchedulerFn = (fn) => {
  fn()
  return () => {}
}
export const RAFScheduler: SchedulerFn = (fn) => {
  const id = requestAnimationFrame(fn)
  return () => cancelAnimationFrame(id)
}
// 框架注入式——适配器传入框架的 batchUpdate
export function createBatchedScheduler(batch: (fn: () => void) => void): SchedulerFn {
  return (fn) => {
    batch(fn)
    return () => {}
  }
}
```

**不需要：** 通用的 "App Bootstrap Framework"（重型启动框架会变成另一个 Spring Boot）。方向 E 应该是一个轻量的 helper（100-150 行），不是一个框架。

### 3.3 向后兼容策略

所有变更遵循以下优先级：

1. **纯加法：** 新 API（`registerChannel`、`scheduler`、`focusStack`）不修改旧 API 签名
2. **默认值兼容：** 新增参数有合理默认值（`scheduler: 'sync'`、`focusStack: false`）
3. **弃用期：** 如果需要修改旧 API，提供 3 个月的 `deprecated` 警告期 + 迁移指南
4. **导入路径不变：** `@iris-ui/react` 的子路径 exports 不动，内部实现切到 core

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

**结论：不需要引入新的框架或语言。**

五个方向都可在现有技术栈（TypeScript + pnpm + Turbo + tsup）内解决，原因：

| 方向                  | 所需能力                     | 现有栈是否满足                            |
| --------------------- | ---------------------------- | ----------------------------------------- |
| A. Behavior 下沉 core | 纯 TypeScript 状态管理       | ✅ `createStore` + `createMachine` 已就绪 |
| B. 虚拟器调度         | rAF/idle callback 的轻量封装 | ✅ 无额外依赖                             |
| C. 焦点栈             | 栈数据结构的 TS 实现         | ✅ `createFocusStack` = 数组 + push/pop   |
| D. 事件总线           | 发布-订阅模式                | ✅ 20 行工厂函数                          |
| E. 启动编排           | store 组合 + async 管道      | ✅ 纯函数组合                             |

**唯一需要评估的新依赖：`IntersectionObserver` polyfill**

- 如果虚拟器调度层支持 `IntersectionObserver` 模式，旧浏览器需 polyfill
- 建议：不在 core 中添加 polyfill，而是让适配器在应用层注入（`createBootOrchestrator` 可选接收 `observerPolyfill`）

### 4.2 自建 vs 采购/复用

| 方向                  | 自建原因                                                                                                             | 为什么不复用外部库             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| A. Behavior 下沉 core | 1. 已有 `createLongPress`/`createSortable` 模式<br>2. 外部库（react-dnd、dnd-kit）绑定 React 生态，不透 svelte/solid | 与框架无关的铁律冲突           |
| B. 虚拟器调度         | 1. `@tanstack/virtual` 不提供自定义调度层<br>2. Fenwick 树已自建                                                     | 需要与现有 Fenwick 树集成      |
| C. 焦点栈             | 1. `focus-trap` 是单层，不规则栈<br>2. 需要栈式恢复 + 区域导航（外部库无此组合）                                     | 外部库不做区域导航             |
| D. 事件总线           | 1. mitt/eventemitter3 是通用方案<br>2. 但需要与 `PluginRegistry` 深度集成                                            | 与 registry 的集成是自定义价值 |
| E. 启动编排           | 1. 无现有库做"跨框架启动编排统一"<br>2. 这是 Iris UI 特有的架构模式                                                  | 纯自定义                       |

**总体判断：自建成本低（每个方向 100-300 行），复用外部库反而需要在 core 中引入框架特定依赖。**

### 4.3 第三方依赖评估标准

如果未来需要引入新依赖，评估清单：

```
□ 是否框架无关？（是否只导入到 core？）
□ 是否可 tree-shake？
□ SSR 是否安全？（无 document/window 全局引用）
□ jsdom 测试是否可行？
□ 大小预算（gzip < 2KB 优先）
□ 是否与 Fenwick 树 / createStore 等基础设施冲突？
```

---

## 5. 实施路线图

### 优先级排序

| 优先级 | 方向                       | 理由                               |
| ------ | -------------------------- | ---------------------------------- |
| **P0** | A. Behavior 下沉 core      | 铁律执行 + 碎片最严重 + 有成功先例 |
| **P0** | B. 虚拟器调度层 + 应用验证 | 释放已投入的基础设施杠杆           |
| **P1** | D. 跨插件事件总线          | 插件生态扩展的必要条件             |
| **P1** | E. 启动编排器统一化        | 铁律执行 + 实际重复验证            |
| **P2** | C. 焦点栈 + 区域导航协议   | 重要但当前无立即的无障碍合规时间⏰ |

### 阶段划分

#### 阶段 1（Sprint 1-2，~3 周）：Behavior 下沉 core + 虚拟器调度

**里程碑 M1：Core 新增 `createResizable`、`createClickOutside`、`createHotkey`、`createMovable`**

任务：

- [ ] core 实现 `createClickOutside(config: ClickOutsideOptions): ClickOutsideController`（含 `ignore` refs 支持）
- [ ] core 实现 `createResizable(config: ResizableOptions): ResizableController`
- [ ] core 实现 `createMovable(config: MovableOptions): MovableController`
- [ ] core 实现 `createHotkey(config: HotkeyOptions): HotkeyController`
- [ ] 四端适配器各减 50-80 行，改用 core 控制器
- [ ] Solid 的 ClickOutside 补上 `ignore` 功能
- [ ] 单测覆盖 4 个新控制器（core 层纯逻辑，无需 DOM）

**里程碑 M2：Core `Scheduler` + Virtualizer 调度集成**

任务：

- [ ] core `scheduler.ts`：`SyncScheduler`、`RAFScheduler`、`createBatchedScheduler`
- [ ] VirtualizerConfig 新增 `scheduler` 参数
- [ ] Virtualizer 内部 `setScroll`/`sync` 走 scheduler
- [ ] core 单测用 `SyncScheduler` 保持测试确定性
- [ ] plugin-pro-table 新增一个虚拟滚动验证场景（1000 行表格）

**质量门：**

- Behavior 下沉后四端测试全绿（1500+）
- pro-table 虚拟列表 end-to-end 通过
- size 预算：core +3KB，各适配器 -15KB 累计

#### 阶段 2（Sprint 3-4，~3 周）：事件总线 + 启动编排

**里程碑 M3：PluginRegistry 事件通道**

任务：

- [ ] `PluginRegistry.registerChannel(name, options?)` API
- [ ] `CollectedRegistrations.bus: EventBus` 返回
- [ ] 通道名命名空间校验（`plugin-name:event-name`）
- [ ] `runPlugins` 中隔离插件 install 异常（try/catch + devWarn）
- [ ] 在 `plugin-editor` 中验证：保存文档后 emit `editor:save`
- [ ] 在 `plugin-pro-table` 中验证：监听 `editor:save` 后自动刷新

**里程碑 M4：`@iris-ui/core/boot` 启动编排器**

任务：

- [ ] `createBootOrchestrator(config: BootConfig)` 实现
- [ ] 支持 `{ windowManager, profile, fs, notifications, clipboard, commands }` 的声明式配置
- [ ] `onHydrate` 生命周期回调
- [ ] 桌面 OS 四个应用切换到 `useBootOrchestrator`
- [ ] 验证：React/Vue/Solid/Svelte 四端 App.tsx 各 ≤ 25 行

**质量门：**

- 现有 plugin 测试全绿（registerStore 不受影响）
- desktop OS 四端启动行为与切换前一致
- 编辑器保存 + 表格刷新的跨插件集成测试通过

#### 阶段 3（Sprint 5-6，P2）：焦点栈 + 区域导航

**里程碑 M5：Core `createFocusStack` + 适配器集成**

任务：

- [ ] `createFocusStack(): FocusStackController`（push/pop/peek/clear）
- [ ] `useFocusTrap` 内部切换到焦点栈
- [ ] DialogContent/DrawerContent 双层弹窗焦点恢复验证

**里程碑 M6：IrisFocusRegion + AdminLayout 集成（可选）**

任务：

- [ ] `createRegionNav(regions): RegionNavController`
- [ ] IrisFocusRegion 组件（四个框架各一个）
- [ ] AdminLayout 集成 IrisFocusRegion
- [ ] 键盘快捷键 F6/Ctrl+F6 区域导航

**质量门：**

- 嵌套弹窗焦点恢复测试
- axe 无障碍测试包含焦点栈场景
- AdminLayout 区域导航验收

---

### 风险点和缓解策略

| 风险                                            | 概率 | 影响 | 缓解                                                                                     |
| ----------------------------------------------- | ---- | ---- | ---------------------------------------------------------------------------------------- |
| Behavior 下沉后四端适配器出现回归               | 中   | 高   | 分步下沉（先 ClickOutside + Resizable），每步四端全量测试                                |
| 虚拟器调度层与现有 pro-table 的分页逻辑冲突     | 低   | 中   | 默认 `scheduler: 'sync'`，调度层默认不生效                                               |
| 事件总线被滥用为全局状态管理                    | 中   | 中   | 通道命名空间强制 + API 只提供 emit/on/off，不提供全局 store                              |
| 启动编排器在 SSR 中调用 `requestAnimationFrame` | 低   | 高   | `BootOrchestrator` 只应在 client 端启动（框架的 `useEffect`/`onMount` 本就不执行在 SSR） |
| 焦点栈与现有单层 `useFocusTrap` 的集成冲突      | 低   | 中   | 默认单层模式（`stack: false`），opt-in 到栈模式                                          |
| 四框架并行修改的协同成本                        | 中   | 中   | 统一 PR 模板 + `core` 变更集中，适配器变更每人认领一个框架                               |

---

## 总结

Iris UI 的架构基础非常扎实——core 纯度、分层清晰度、插件契约、Fenwick 树的算法选择都证明了架构判断力。五大方向中，**P0 的两个方向（Behavior 下沉 + 虚拟器调度）不是"修复坏味道"而是"释放已存杠杆"**：`createLongPress`/`createSortable` 的成功已经为 Behavior 下沉铺好了路，Fenwick 树的选型已为虚拟滚动做好了算法准备。

实施的总增量代码量估计：

| 方向             | core 增量   | 适配器减少          | 净效应      |
| ---------------- | ----------- | ------------------- | ----------- |
| A. Behavior 下沉 | +600-800 行 | -800-1200 行        | **-400 行** |
| B. 虚拟器调度    | +150 行     | +50 行（pro-table） | **+200 行** |
| D. 事件总线      | +200 行     | 0                   | **+200 行** |
| E. 启动编排      | +200 行     | -400 行（四应用）   | **-200 行** |
| C. 焦点栈        | +300 行     | +100 行（适配器）   | **+400 行** |

**总净变化：约 +200 行（三个方向减少的代码抵消了新增焦点栈的投入）。**

这五个方向完成后，Iris UI 将补齐从"优秀的 L0-L2 组件库"到"可承载重型应用（IDE、CMS、仪表盘）的 UI 基础设施"的最后几个架构缺口。
