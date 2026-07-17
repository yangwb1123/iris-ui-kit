# 架构深度分析报告：Iris UI 的五方向验证与工程路线图

---

## 1. 架构评估

### 1.1 当前架构的核心优势

**优势 A：逻辑下沉的范式正确性**。`@iris-ui/core` 作为框架无关的逻辑层，其设计决策——`createResourceController` 构建在 `createDataSource` 之上，`ResourceState` 是 `DataSourceState` 的 `derived` 投影——是一个教科书级的组合模式。`derived` 的选择优于手动 `subscribe→setState` 桥接：它保障了引用计数订阅、StrictMode 重挂载安全、无双重发射。这个设计模式应该成为 core 层所有控制器的规范模板。

**优势 B：DataState 协议定义了正确的优先级语义**。`error → loading → empty → content` 的互斥解析 + `hasContent` 的 stale-while-revalidate 短路，覆盖了几乎所有数据组件的状态切换场景。特别是 `hasContent` 的设计解决了"后台刷新时闪烁"这个业界顽疾——Suspense 做不到的它做到了。

**优势 C：四框架 motion 层的同步就绪**。四个适配器都有 `useDataState` 入口动画 + `usePrefersReducedMotion` + 共享 `@keyframes`，说明架构团队已经预见到了跨框架动画的必要性，并且正确地将样式注入（styles.ts）与框架桥接分离。

**优势 D：桌面壳的三重复是个"好债"**。三个壳各自独立实现相同契约，虽然在维护上是债务，但验证了契约的完备性——如果契约有歧义，三个壳的实现不可能趋同。这是 "conformance by independent implementation" 的罕见案例。

### 1.2 关键架构债务

**债务 1：`ResourceState` 与 `DataState` 的类型断层**。`ResourceState` 有 `{ loading, error, ... }` 原始字段，而 `DataState` 是联合类型。每个消费 `ResourceController` 的组件都必须重复：

```ts
const state = resourceController.getState()
const dataState = resolveDataState({
  loading: state.loading,
  error: !!state.error,
  empty: state.rows.length === 0,
  hasContent: state.rows.length > 0,
})
```

这个映射应该在 core 层完成一次，而不是在每个页面组件中重复。`ResourceController` 应当直接暴露 `dataState: Store<DataState>`。

**债务 2：动画 token 定义但不消费**。`iris.transition.fast`/`.normal`/`.slow` 被定义在 token 系统中，但 grep 显示无组件引用。这是 token 系统的"死代码"——降低了 token 集的信噪比，且给下游开发者错误信号（以为用了这些 token，实则没用）。

**债务 3：`generateId()` 计数器不适用于 SSR 多请求场景**。虽然适配器层的 `useId()` 优先使用，但 core 层的 `generateId()` 仍可能被内联使用。模块级计数器在 Node.js 服务器进程中持续递增而不重置，虽不会导致 hydration mismatch（因为 id 不在服务端渲染），但构成理论上的内存泄漏和 id 碰撞风险。

**债务 4：Native 桥的隐式契约**。`window.irisNative` 无 `.d.ts` 类型定义、无版本化、无 CI 跨壳测试。三个壳的实现可能已经悄然产生分化（例如 Wails 和 Tauri 的文件保存对话框可能有不同的错误格式），但没有任何自动化手段探测这种分化的发生。

**债务 5：三个桌面壳的构建配置重复**。Electron 用 `electron-builder`，Tauri 用 Rust `cargo`，Wails 用 Go。CI 中三个不同的构建管道各自独立，没有共享的构建缓存或版本对齐策略。任何"在 shell 中添加新能力"都需要在三个技术栈中分别实现。

### 1.3 架构范式一致性评估

| 原则                 | 符合度 | 说明                                                               |
| -------------------- | ------ | ------------------------------------------------------------------ |
| 逻辑下沉 core        | ✅     | DataState、ResourceController、SelectionModel 全部在 core          |
| 薄桥适配器           | ✅     | motion 层、useDataState 都是纯桥接，无业务逻辑                     |
| Token 杠杆           | ⚠️     | transition token 定义了但未被消费，降低杠杆率                      |
| 渐进式复杂度         | ⚠️     | DataState → DataContainer 的渐进路径缺失，迫使页面组件处理原始状态 |
| 受控+非受控双模      | ✅     | selection、expansion 等全部支持                                    |
| 跨框架不跨设计       | ✅     | motion 层在四框架中完全对等                                        |
| A 零配置在场，B 不进 | ✅     | resource 控制器按需创建，export 函数显式 import                    |
| 原语优先             | ✅     | Dialog/Popover 等使用 `useFloating + useDismiss + IrisSlot` 组合   |

**唯一范式断裂点**：桌面壳的三重复违背了"一次实现，四方共享"的架构原则。三个壳的公共逻辑（文件保存、剪贴板、菜单切换）没有下沉到 `@iris-ui/native-bridge` 协议包。

---

## 2. 扩展方向

### 方向 A：`@iris-ui/presence` — 跨框架退出动画协议 ⭐ P0

**为什么需要**：
149 个组件中只有 Drawer 有退出动画，Dialog/Popover/Tooltip/Menu/Toast 均是瞬间出现/消失。在 Radix/Naive UI 已成为品质基线的市场环境中，无动画的 UI 库会被感知为"不成熟"。动画不是装饰——它是用户理解界面状态变化的空间映射（Dialog 从何而来、Toast 往何而去）。

**核心挑战和技术难点**：

1. **跨框架的退出动画定时器管理**。React 需要 `flushSync` 绕开批处理来触发退出的 layout effect；Vue 的 `<Transition>` 有内置的 `leave` 钩子但 Solid 和 Svelte 各有其道。四个框架对"挂载一个元素 → 触发 enter 动画 → 一段时间后卸载 → 触发离开动画 → 卸载"的生命周期控制 API 完全不同。
2. **动画队列与优先级**。当多个 Presence 子元素同时触发（Toast 队列批量消失），需要一个共享的动画调度器确保先后顺序和重叠行为一致。
3. **`prefers-reduced-motion` 的全局切换**。在动画播放过程中用户开启减动效，需要立即终止动画并跳转到终态——这个逻辑不能在每个组件中重复。

**预期的架构变更**：

```
packages/presence/               ← 新包：framework-agnostic animation scheduler
  core/                           ← 纯逻辑层
    presence.ts                   ← createPresenceController()
    queue.ts, spring.ts, …
  react/ | vue/ | solid/ | svelte/  ← 适配器：IrisPresence 组件 + usePresence hook

packages/{react,vue,solid,svelte}/src/primitives/
  dialog/DialogContent.tsx        ← 接入 IrisPresence 包裹
  popover/PopoverContent.tsx      ← 同上
  tooltip/TooltipContent.tsx      ← 同上
  menu/MenuContent.tsx            ← 同上
  toast/Toast.tsx                 ← 同上
```

`IrisPresence` 组件的接口设计：

```ts
interface IrisPresenceProps {
  /** 是否应渲染子元素。当 from={true}→{false} 时，子元素会继续挂载直到退出动画完成 */
  show: boolean
  /** 进入动画持续（ms），默认取自 --iris-transition-normal (200ms) */
  enterDuration?: number
  /** 退出动画持续（ms） */
  exitDuration?: number
  /** 动画完成的回调 */
  onExitComplete?: () => void
  children: ReactNode
}
```

**对现有系统的影响**：

- 向后兼容：不加 `IrisPresence` 的组件行为不变（瞬间出现/消失）
- 增量接入：逐个组件包裹 `IrisPresence`，不影响其他组件
- token 系统：消费已定义的 `--iris-transition-*` token，修复"定义但不消费"的债务

**风险**：四个框架的退出动画同步逻辑不一致（React 的 `onAnimationEnd` vs Vue 的 `@after-leave` vs Solid 的 `onTransitionEnd` vs Svelte 的 `transitionend` event）。需要一个 `createPresenceController` 在 core 层统一管理状态机（进入中/已进入/退出中/已退出），适配器只做事件绑定。

---

### 方向 B：`@iris-ui/responsive` — 断点系统与移动端组件 ⭐ P0

**为什么需要**：
全库零 `--iris-breakpoint-*` token、零触摸手势、零 `IrisBottomNavigation`/`IrisPullToRefresh`。在移动端流量已占 Web 60%+ 的 2026 年，一个 UI 库没有响应式基础设施是不可接受的。且桌面壳的窗口按钮 `<44px` 违反 Apple HIG 和 Material Design 的触摸目标规范——这个 bug 在移动端是体验灾难。

**核心挑战和技术难点**：

1. **断点系统的设计决策**：设备宽度断点（`sm`/`md`/`lg`/`xl`） vs 容器查询（`@container`）。Iris UI 的原子性（每个组件独立）倾向于容器查询——因为同一个组件在 Sidebar 和 Fullscreen 中的断点行为应该不同。但容器查询的浏览器兼容性（Safari 16+）是门槛。
2. **触摸手势系统需要跨框架**。Swipe/long-press/pinch-zoom 需要 pointer events → 手势识别 → 距离/速度计算 → 事件冒泡。这个逻辑必须在 core 层实现（像 `hover-intent.ts` 一样），四个适配器只做桥接。
3. **PWA 技术栈引入**。`manifest.json` 是静态资源，Service Worker 需要 `workbox` 或自建 `sw.ts`。这与 Iris UI 的"组件库"定位有张力——PWA 是应用层的关注点，而非组件库的。决策：Iris UI 应该提供 `@iris-ui/pwa` 工具包（模板 + 构建插件），而不是将 PWA 逻辑嵌入组件。

**预期的架构变更**：

```
packages/theme/src/
  breakpoints.ts              ← --iris-breakpoint-sm: 640px, --iris-breakpoint-md: 768px, ...
  containerQueries.ts         ← @container helpers

packages/core/src/
  gesture.ts                  ← createGestureController(supported: ['swipe','long-press','pinch'])
  touchTarget.ts              ← ensureTouchTarget(el, minSize: 44)

packages/{react,vue,solid,svelte}/src/primitives/
  bottomNavigation/            ← IrisBottomNavigation 新组件
  pullToRefresh/              ← IrisPullToRefresh 新组件
  tabBar/                     ← IrisTabBar 新组件

packages/{react,vue,solid,svelte}/src/behaviors/
  useSwipe.ts / useLongPress.ts   ← 新 Behaviors 包裹器

apps/docs/...
```

**接口设计原则**：

```ts
// core 层的 gesture 控制器
interface GestureConfig {
  swipeThreshold?: number    // 默认 50px
  longPressDuration?: number // 默认 500ms
  pinchThreshold?: number   // 默认 20px delta
}
type GestureEvent = { type: 'swipe'; direction: 'left'|'right'|'up'|'down'; distance: number; velocity: number }
                 | { type: 'long-press'; position: {x:number; y:number} }
                 | { type: 'pinch'; scale: number }

// 与现有 Behavior 模式一致
<IrisSwipe onSwipeLeft={() => goBack()} threshold={30}>
  <IrisPanel />
</IrisSwipe>
```

**对现有系统的影响**：

- 断点 token 的引入与现有 `--iris-*` 命名体系兼容
- 移动端新组件从 L1→L2 层新增，不修改现有组件
- 桌面壳窗口按钮的 touch target 修复是样式级修改（CSS `min-width: 44px; min-height: 44px`）
- 手势 Behavior 的引入与现有的 Resizable/Movable/Hotkey/ClickOutside 模式完全一致

---

### 方向 C：`@iris-ui/data-state` 上层容器 ⭐ P1

**为什么需要**：
`DataState` 联合类型 + `resolveDataState()` + `useDataState` hook + 入口动画已存在于四框架——唯一的缺口是 `IrisDataContainer` 和 `IrisAsyncBoundary` 容器组件。当前每个页面组件都在重复：

```ts
const state = resolveDataState(...)
if (state === 'loading') return <Spinner />
if (state === 'error') return <ErrorPanel error={...} />
if (state === 'empty') return <EmptyState />
return <DataView data={...} />
```

这不仅重复，而且没有标准化 loading/error/empty 的视觉呈现（不同页面可能使用不同的 Spinner 组件）。

**核心挑战和技术难点**：

1. **`IrisDataContainer` 的设计需要解决验证报告指出的"边界退化"问题**：API 返回空数组 vs 403 vs 超时——三者在当前 `DataStateInput` 中无法区分（`error` 只有 `boolean` 没有错误类型）。需要扩展 `DataStateInput.error` 为 `Error | boolean`，让容器可以按错误类型渲染不同的错误 UI。
2. **`IrisAsyncBoundary` 需要错误捕获边界**。React 有 `ErrorBoundary`（class component），Vue 有 `onErrorCaptured`，Solid 有 `ErrorBoundary`，Svelte 有 `onmount` + try/catch。四个框架的机制不同，但行为契约相同：捕获子组件抛出的错误 → 渲染 fallback → 提供 retry。这个"行为契约"应该定义在 core 层。

**预期的架构变更**：

```
packages/core/src/
  data-state.ts              ← 扩展 DataStateInput.error 为 Error | boolean
  async-boundary.ts          ← createAsyncBoundaryController()

packages/{react,vue,solid,svelte}/src/primitives/
  dataContainer/             ← IrisDataContainer 组件
    IrisDataContainer.tsx    ← 接收 DataStateInput + loadingSlot/errorSlot/emptySlot/contentSlot
    IrisDataContainer.test.tsx
  asyncBoundary/
    IrisAsyncBoundary.tsx    ← 错误捕获 fallback
```

**接口设计**：

```ts
interface IrisDataContainerProps {
  state: DataStateInput
  /** 自定义插槽，不传则使用默认（全局注册的）Loading/Error/Empty 组件 */
  loading?: ReactNode
  error?: ReactNode | ((e: Error) => ReactNode)
  empty?: ReactNode
  children: ReactNode
}
```

**对现有系统的影响**：

- 完全向后兼容：`DataStateInput` 的扩展（`error: boolean → Error | boolean`）通过 union type 兼容旧用法
- `IrisDataContainer` 不改变任何现有组件的内部状态
- 利用已有的 `useDataState` 动画调度器，容器自动获得进入动画

---

### 方向 D：`@iris-ui/native-bridge` — 三壳协议统一 ⭐ P1

**为什么需要**：
三个桌面壳（Electron/Tauri/Wails）各自独立实现了相同的原生能力集——多框架托管、文件保存、剪贴板、应用菜单。当前无共享类型、无版本化、无 CI 交叉验证。每次添加新能力（如系统托盘、自动更新、深层链接）需要在三个技术栈中实现三次，且无法保证行为一致。

**核心挑战和技术难点**：

1. **契约设计需要覆盖三壳的能力交集但不被最小公分母限制**。Electron 有 `autoUpdater`，Tauri 有 `updater` 插件，Wails 无内置更新——协议应该定义为可选能力（`capabilities: string[]`），而不是固定的接口集。
2. **版本化与演进**：桥协议需要语义化版本。当桌面壳新增一个方法时，前端如何探测是否可用？选择：`window.irisNative.available('file.save')` 能力检测 vs 版本号检测。
3. **预加载注入的标准化**：每个壳的预加载机制不同（Electron `preload.js`/`contextBridge`，Tauri `tauri://` IPC，Wails Go 绑定）。协议包应该只定义类型，每个壳有单独的"适配器"包装。

**预期的架构变更**：

```
packages/native-bridge/
  package.json               ← @iris-ui/native-bridge (纯 TS 类型包，零运行时)
  src/
    types.ts                  ← IrisNativeBridge 接口定义
    capabilities.ts           ← 能力枚举
    version.ts                ← 协议版本

apps/desktop/src/
  bridge.ts                   ← 导入 @iris-ui/native-bridge，实现 IrisNativeBridge

apps/desktop-tauri/src/
  bridge.ts                   ← 同上

apps/desktop-wails/src/
  bridge.ts                   ← 同上
```

**接口设计**：

```ts
// 协议版本 1.0
interface IrisNativeBridge {
  readonly protocolVersion: '1.0'
  readonly capabilities: readonly NativeCapability[]

  // 文件系统
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>
  showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>
  writeFile(path: string, data: Uint8Array): Promise<void>
  readFile(path: string): Promise<Uint8Array>

  // 剪贴板
  clipboard: {
    writeText(text: string): Promise<void>
    readText(): Promise<string>
  }

  // 窗口
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
  }

  // 应用
  getVersion(): Promise<string>
  quit(): Promise<void>
}

// 能力枚举
type NativeCapability =
  | 'file.save'
  | 'file.open'
  | 'clipboard'
  | 'window.control'
  | 'autoUpdate'
  | 'deepLink'
  | 'systemTray'
```

**对现有系统的影响**：

- 零组件影响：不影响 149 个组件中的任何一个
- 三个壳的现有实现需要适配新的 `IrisNativeBridge` 接口——如果现有实现已趋同，适配成本低；如果分化，适配过程会暴露分化点
- CI 增加：需要跨壳测试（启动每个壳 → 调用每个方法 → 验证行为一致）

---

### 方向 E：`generateId()` SSR 安全修复 ⭐ P99

**为什么需要**：
`packages/core/src/utils.ts` 的 `generateId()` 使用模块级计数器，在 SSR 多请求场景中计数器持续递增。虽然适配器层的 `useId()` 优先使用，但 core 层仍存在直接调用 `generateId()` 的路径。

**核心挑战**：
不需要系统级投入——这是一个点修复。方案选择：

1. 改用 `crypto.randomUUID()`（Node 19+/浏览器）——但 `crypto` 在部分 jsdom 测试环境中不可用
2. 注入 `adapter.useId` 依赖——但 core 层不能依赖框架
3. 使用 `Math.random().toString(36)` 代替计数器——非加密安全但场景不需要加密安全

**建议方案**：core 层提供一个可替换的 `IdGenerator`：

```ts
// core/src/utils.ts
export type IdGenerator = () => string
let idGenerator: IdGenerator = () => Math.random().toString(36).slice(2, 10)
export function setDefaultIdGenerator(fn: IdGenerator) {
  idGenerator = fn
}
export function generateId(): string {
  return idGenerator()
}
```

适配器在初始化时通过 `setDefaultIdGenerator` 注入框架的 `useId`。**但注意**：`generateId()` 是同步函数，而 `useId()` 是 hook（只能在组件树中调用）。所以更实际的方案是 core 层改用 `Math.random()` 或 `crypto.randomUUID()` 的同步版本，消除模块级计数器。

---

## 3. 接口设计原则

### 3.1 核心原则

**原则 1：每个协议层提供 TypeScript 类型作为信源**。`native-bridge` 的 `IrisNativeBridge` 接口、`data-state` 的 `DataStateInput` 类型、`presence` 的 `PresenceController` 接口——这些类型定义应该被独立测试（契约测试），确保实现与接口一致。

**原则 2：框架适配器只做"三件事"——渲染、事件绑定、生命周期桥接**。任何条件逻辑（if/switch/三元）出现在适配器层都是可疑的。例如 `IrisPresence` 的退出动画定时器管理不应在 React 组件逻辑中实现，而应调用 core 层的 `createPresenceController`。

**原则 3：** **新接口优先以"包容旧值"的 union type 向后兼容**。例如 `DataStateInput.error` 从 `boolean` 扩展为 `Error | boolean` 时，`true` 仍然有效（表示"有错误但无具体错误对象"）。旧代码不需要修改。

**原则 4：** **Behaviors 优先于 HOCs，HOCs 优先于修改现有组件**。新能力（手势触摸、Presence 包裹）以 Behavior 包裹器的形式提供，避免侵入组件 props interface。这与现有的 `IrisResizable`/`IrisMovable`/`IrisHotkey` 模式一致。

### 3.2 是否需要新的抽象层

**需要：`IrisPresence` 组件层**。当前零退出动画协议的原因是每个组件各自手动管理动画（如 Drawer 的 `EXIT_DURATION_MS`）。引入 `IrisPresence` 作为共享抽象，消除手动管理。这是"原语优先"原则的体现。

**需要：`@iris-ui/native-bridge` 类型包**。当前三壳的隐式契约必须显式化才能管理其演化。纯 TS 类型包的引入不增加运行时体积，但极大改善类型安全和开发者体验。

**不需要：PWA 抽象层**。PWA 是应用基础设施而非组件库能力。Iris UI 应该提供文档 + 模板（如 `apps/pwa-template`），但不是 `@iris-ui/pwa` 运行时包。

### 3.3 保持向后兼容的策略

| 变更                                               | 策略                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DataStateInput.error: boolean → Error \| boolean` | Union type：旧值 `true` 兼容，新代码可传入 `Error` 实例                                                                                                  |
| 新组件 `IrisDataContainer`                         | 新文件，不修改任何现有导出                                                                                                                               |
| 新 Behavior `IrisSwipe`                            | 新文件，与现有 `IrisResizable` 同级                                                                                                                      |
| `--iris-transition-*` token 的消费                 | 在组件样式中增加 `var(--iris-transition-normal, 200ms)`——有 fallback，未定义 token 的旧主题不受影响                                                      |
| 桌面壳迁移到 `@iris-ui/native-bridge`              | 三个壳的现有 `window.irisNative.*` 调用被包装器适配，旧调用标记为 `@deprecated`，在 2 个 minor 版本后移除                                                |
| `generateId()` 修改                                | 不改变函数签名，只改变内部实现。`Math.random()` 替代计数器——输出格式变化，但 id 的唯一性不受影响（`Math.random()` 碰撞概率低于计数器重置导致的碰撞概率） |

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

| 方向     | 需要引入                                              | 评估                                                              |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Presence | 不需要新依赖                                          | 使用 Web Animations API 或 CSS `@keyframes` + `animationend` 事件 |
| 响应式   | 可能需要 `gesture` 库（Hammer.js 已死，推荐自建轻量） | 自建 `core/src/gesture.ts` 约 200 行，不需要第三方                |
| PWA      | `workbox` 或 `@serwist`                               | 仅模板依赖，非组件库依赖                                          |
| 桌面协议 | 不需要新依赖                                          | 纯 TS 类型包                                                      |
| SSR 修复 | 不需要新依赖                                          | `Math.random()` 原生可用                                          |

**关键决策**：手势识别自建 vs 采购。

| 方案            | 优势                               | 劣势                                       |
| --------------- | ---------------------------------- | ------------------------------------------ |
| 自建 200 行     | 零依赖、跨框架可控、tree-shakeable | 需要维护边缘情况（多指触控、浏览器差异）   |
| 采购 hammerjs   | 经过验证，边缘情况全面             | 已停止维护 5+ 年、gzipped 4KB、非 ESM 友好 |
| 采购 @egjs/axes | 活跃维护、ESM、支持各种输入        | 学习成本、API 与 Iris UI 风格不一致        |

**建议**：自建轻量手势识别（`swipe`/`long-press`/`pinch`），以 `createGestureController` 形式放在 `@iris-ui/core`。如果需要更复杂的手势（旋转、双击拖拽），再引入 OSS 方案。这个决策与 Iris UI 的"core 是复用逻辑之家"原则一致。

### 4.2 第三方依赖评估标准

引入任何新依赖前必须回答的问题：

1. **是否可以在 core 层实现？** 如果是，走 core → 不做依赖
2. **是否四个框架都在用？** 如果是，依赖应该是 agnostic 的（非 React/Vue 绑定）
3. **是否与现有 token 系统集成？** 依赖产生的样式应该通过 `var(--iris-*)` 表达
4. **是否影响 SSR 安全？** 依赖应该在 `renderToString` 环境中工作
5. **size budget 是否允许？** 每个新依赖的 gzip 大小应计入对应包的 size 预算

### 4.3 自建 vs 采购：Presence 动画

|          | 自建 `IrisPresence`         | 采购 `framer-motion` / `auto-animate` |
| -------- | --------------------------- | ------------------------------------- |
| 体积     | 自建 < 1KB gzip (core + 桥) | framer-motion ~20KB gzip              |
| 框架支持 | 四框架原生，适配器薄        | React only (framer) / jQuery (auto)   |
| 可控性   | 完全控制                    | 受库 API 限制                         |
| 维护     | 需要维护四份动画桥          | 框架升级可能破坏                      |

**建议**：自建。Motion 已经是 Iris UI 现有基础设施的一部分（`useDataState`、`usePrefersReducedMotion`、transition tokens、Drawer exit animation），缺失的只是一个通用的 Presence 协议。自建的增量成本远低于引入一个破坏现有架构模式的第三方库。

---

## 5. 实施路线图

### 5.1 优先级排序

```
P0（本轮迭代）
  ├── 方向 A: IrisPresence 协议 —— 工程成本低 × 用户可见性极高 × 基础设施就绪
  └── 方向 B: 响应式/移动端 —— 工程成本高 × 市场缺口最大 × 品牌差异化最强

P1（下轮迭代）
  ├── 方向 C: IrisDataContainer —— 利用已有 DataState，纯上层容器
  └── 方向 D: @iris-ui/native-bridge 协议 —— 零组件影响，纯接口规范化

P99（随手修复，不构成独立方向）
  └── 方向 E: generateId() SSR 安全修复 + infinite 计数器清理
```

### 5.2 阶段划分

**Phase 1 — Presence 协议落地（4-6 周）**

| 周次 | 里程碑                                  | 关键产出                                                                                                                           |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| W1   | `IrisPresence` 状态机设计 + core 层验证 | `core/src/presence.ts`：`createPresenceController` — 管理 `entering → entered → exiting → exited` 状态机，可测试（纯逻辑，无 DOM） |
| W2   | 四框架桥接                              | `react/IrisPresence.tsx`、`vue/IrisPresence.vue`、`solid/IrisPresence.tsx`、`svelte/IrisPresence.svelte` — 每个 <100 行桥接代码    |
| W3   | Dialog/Popover/Tooltip 落地             | 三个浮层组件包裹 `IrisPresence`，使用 `--iris-transition-normal` token，`prefers-reduced-motion` 感知                              |
| W4   | Menu/Toast 落地 + 无障碍验证            | Toast 队列动画（staggered exit），axe 验证（`prefers-reduced-motion` 下无未完成动画）                                              |
| W5   | Size 预算 + 文档 + 跨壳测试             | 确保 `@iris-ui/presence` core + 桥接 < 1KB gzip，VitePress 文档（含动画示例），四框架 playground 各页面确认动画一致                |
| W6   | 发布 + 回归测试                         | `changeset` 发布 `@iris-ui/presence`（v0.1.0-alpha），149 组件全量回归                                                             |

**关键风险**：退出动画期间的内存泄漏（组件已被 React 卸载但动画定时器仍持有引用）。缓解：`createPresenceController` 的 `destroy()` 方法取消所有未完成的动画帧 + `resolve` 挂起的 Promise。

**Phase 2 — 响应式基础设施（6-8 周）**

| 周次 | 里程碑                         | 关键产出                                                                                                                                                               |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1   | 断点 token 设计 + 容器查询策略 | `--iris-breakpoint-{sm,md,lg,xl}` token、`@container` 策略文档、确定 touch target 基线（`--iris-touch-target-min: 44px`）                                              |
| W2   | 手势 controller core 层        | `core/src/gesture.ts`：swipe/long-press/pinch 识别，单元测试覆盖边缘情况（方向判断、速度阈值、多指冲突）                                                               |
| W3   | 四框架手势 Behavior            | `useSwipe`/`useLongPress` 作为新 Behavior 包裹器，与 `IrisResizable` 同级                                                                                              |
| W4   | 移动端组件：BottomNavigation   | 四框架 `IrisBottomNavigation` 组件（L2），接受 `items` 数组 + `value/onChange`，支持徽标、图标、选中指示器                                                             |
| W5   | 移动端组件：PullToRefresh      | 四框架 `IrisPullToRefresh` 容器组件，整合手势 Behavior                                                                                                                 |
| W6   | 现有组件响应式适配             | IrisTable 水平滚动 + 列响应式隐藏、IrisDrawer 全屏模式（`size="full"`）、IrisDialog 移动端 bottom-sheet 模式（`placement="bottom"`）、桌面壳窗口按钮 touch target 修复 |
| W7   | PWA 模板 + 文档                | `apps/pwa-template`（Vite PWA + manifest.json + Service Worker + 离线 fallback），文档：如何在 Iris UI 项目中启用 PWA                                                  |
| W8   | 回归 + 发布                    | 所有移动端组件 axe 验证（touch target 4 5 x 4 5、color contrast）、size 预算更新                                                                                       |

**关键风险**：容器查询的浏览器兼容性（Safari <16.2 不支持）。缓解：提供基于 ResizeObserver 的 polyfill fallback，或者在 Phase 2 中不阻塞于容器查询——先以媒体查询为主，容器查询作为 future enhancement。

**Phase 3 — DataContainer 上层容器（2-3 周）**

| 周次 | 里程碑                    | 关键产出                                                                                                                      |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| W1   | `DataStateInput` 扩展     | `error` 字段扩展为 `Error \| boolean`，`resolveDataState` 适配，下游兼容性测试                                                |
| W2   | `IrisDataContainer`       | 四框架容器组件 + 默认插槽（全局注册 Loading/Error/Empty 组件）+ 自定义插槽 override + `createAsyncBoundaryController` core 层 |
| W3   | `ResourceController` 映射 | `ResourceState` 扩展 `dataState: Store<DataState>` 字段，CMS demo 页面迁移到 `IrisDataContainer`                              |

**Phase 4 — Native Bridge 协议（3-4 周）**

| 周次 | 里程碑                      | 关键产出                                                                                                      |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| W1   | `@iris-ui/native-bridge` 包 | TS 类型定义 + 能力枚举 + 版本号 + 接口文档                                                                    |
| W2   | Electron 适配               | 重写 `apps/desktop/src/preload.js` + `bridge.ts`，适配新类型，添加 `@deprecated` 标记到旧 `window.irisNative` |
| W3   | Tauri + Wails 适配          | 同上，确保三个实现通过契约测试（`pnpm test:native-bridge` 跨壳测试）                                          |
| W4   | CI 集成 + 文档              | 跨壳测试 CI job（三个壳顺序构建 + 测试），更新 AGENTS.md 中的桌面壳契约文档                                   |

**P99 随手修复**：

- W1：`generateId()` 的内部实现从模块级计数器改为 `crypto.randomUUID?.() ?? Math.random().toString(36).slice(2,10)`
- W1：清理 `--iris-transition-*` 的"定义但不消费"——在 Phase 1 Presence 组件中开始消费

### 5.3 总体时间线

```
Phase 1 (Presence)       ████████████████████                         W1–W6   ← 并行走
Phase 2 (Responsive)     ████████████████████████████████████         W1–W8   ← 并行走
Phase 3 (DataContainer)  ████████████████████                         W1–W3   ← Phase 1 后
Phase 4 (Native Bridge)  ████████████████████                         W1–W4   ← Phase 2 后

                         ▸ Q3 2026                                  ▸ Q4 2026
```

**并行策略说明**：Phase 1 和 Phase 2 可以并行，因为它们的代码变更涉及不同的包目录（`packages/presence/` vs `packages/theme/breakpoints.ts` + `packages/core/gesture.ts`）。但需要确保：

- Phase 2 的 gesture 控制器不依赖 Phase 1 的 presence 控制器（或 vice versa）
- 两个 Phase 共享同一个 `@iris-ui/core` 版本，避免依赖冲突

### 5.4 风险矩阵

| 风险                                                             | 概率 | 影响 | 缓解策略                                                                                                                                    |
| ---------------------------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Presence 退出动画在 Solid/Svelte 中的时序不一致                  | 中   | 高   | 在 core 层用状态机统一控制（`entering→entered→exiting→exited`），适配器只监听状态变化 → 渲染对应帧，不控制时机                              |
| 响应式断点决策（媒体查询 vs 容器查询）导致后续重构               | 中   | 中   | Phase 2 先以媒体查询落地，半年后评估容器查询生态成熟度再升级——文档明确标注"当前使用媒体查询，容器查询规划中"                                |
| 三桌面壳的 native 桥实现已经分化，统一成本高于预期               | 中   | 中   | Phase 4 W1 先做差异分析（对比三个壳的 `window.irisNative` 实现差异），如果差异过大，降级为"定义接口 + 每个壳独立适配"而非"重构三壳统一实现" |
| 移动端组件在四框架中的测试覆盖率不足，导致行为不一致             | 低   | 高   | 每个移动端组件必须有四框架的 playroom 页面 + 自动化视觉回归（`playwright` 截图对比），新组件必须通过 a11y 门 + size 预算门                  |
| `IrisDataContainer` 引入后，旧代码不迁移导致两个模式并存长期割裂 | 中   | 低   | 文档 + codemod 脚本辅助迁移，不强制删除旧模式——渐进式采用                                                                                   |

---

## 总结

Iris UI 的架构质量总体优秀——core 层逻辑下沉、适配器薄桥、四框架对齐的原则在实践中得到了验证。五个方向的分析揭示的不是架构缺陷，而是**基础设施就绪但上层组合缺失**的模式。

- **Presence**：token 定义了、`usePrefersReducedMotion` 实现了、Drawer exit animation 证明了可行性——缺的只是一个 `IrisPresence` 组件将现有碎片串联成协议。
- **DataContainer**：`DataState` + `useDataState` + 入口动画都已存在——缺的是 `IrisDataContainer` 容器组件消除页面模版代码。
- **Native Bridge**：三个独立的实现验证了契约——缺的是将隐式契约显式化为 TS 类型 + 版本化。
- **Responsive**：这个方向是真正的"最重投入"，因为它是唯一一个需要新 token 体系 + 新控制器（gesture）+ 新组件（BottomNavigation/PullToRefresh）+ 现有组件重构（Dialog bottom-sheet / Table 响应式列）的综合方向。

**核心建议**：Presence 和 DataContainer 在 Phase 1 中优先交付，因为它们底层就绪程度最高、用户感知最强、工程质量成本最低。这两个方向的交付将为 Phase 2（响应式）建立信心——证明 Iris UI 的"core 逻辑 + 四框架薄桥"模式可以高效地扩展到新的交互范式。
