现在我已具备全面的理解，可以进行架构分析了。

---

# 架构分析：Iris UI Desktop OS 集成

## 1. 架构评估

### 优势

1. **分层分解是成熟的**。`@iris-ui/core` 作为框架无关逻辑层的模式已被实际证明—— `window.ts`、`profile.ts`、`commands.ts`、`notifications.ts`、`clipboard-history.ts`、`fs.ts` 均完全无框架，通过 `createStore` 实现可观察状态。任何状态机/UI 模式都可以在此层之上构建，而不会陷入反应式框架之争。

2. **子路径 + tsup 入口点 + barrel 分离实现真正的树摇**。barrel (`index.ts`) 不重新导出桌面模块，因此 `import { createStore } from '@iris-ui/core'` 不会引入窗口管理器代码。仅当消费者显式导入 `@iris-ui/core/window` 时才包含它。这验证了 LGx 的「A 零配置在场，B 不用不进包」设计原则。

3. **桌面 OS 桥接中的纪元系统解决了无穷模式竞态**。对评估中分析的反驳是准确的：`++epoch` 保护 + `token !== epoch` 守卫处理了 setPage+loadMore 竞态和并发 loadMore 调用，不会损坏数据。唯一缺失的是当 `maxRows` 被命中时的 UX 反馈 —— `loadMore` 保持静默且 `hasMore` 为 true。

4. **四框架实现真正对称**。所有四个桌面应用都拥有全套组件（Window、Dock、MenuBar、Taskbar、CommandPalette、Spotlight、SnapPreview、Pager、Panel、Toasts、ContextMenu、Kickoff、StartMenu）以及 app 视图（Assistant、planner、Calculator、Terminal、Files、Photos、Data、Clipboard 等）。这种对称性是通过设计而非蛮力实现的：core 引擎由所有框架共享。

### 局限性

1. **桌面 OS 桥接没有被标准化为可交付产物**。这是整个分析中最大的架构债务。在每个桌面应用中都存在六个半独立的反应式桥接实现：

   | 模块          | React 钩子（在 shell.tsx 中）              | Vue 组合（在 wm.ts 等中）                                  | Solid 上下文   | Svelte 运行时代码    |
   | ------------- | ------------------------------------------ | ---------------------------------------------------------- | -------------- | -------------------- |
   | window        | `useWm`, `useWmState`                      | `useWmState`, 单例 + ref                                   | 上下文 + 信号  | `.svelte.ts` 单例    |
   | profile       | `useProfile`, `useProfileState`, `useApps` | `useProfile`, `useProfileState`, `useApps`, `addCustomApp` | 上下文 + 信号  | `.svelte.ts` 单例    |
   | notifications | `useNotifications`, `useNotificationState` | Vue 组合                                                   | 上下文 + 信号  | `.svelte.ts` 单例    |
   | clipboard     | `useClipboard`, `useClipboardState`        | Vue 组合                                                   | 上下文 + 信号  | `.svelte.ts` 单例    |
   | fs            | `useFs`, `useFsState`                      | Vue 组合                                                   | 上下文 + 信号  | `.svelte.ts` 单例    |
   | commands      | 无导出（使用注册表）                       | `commands.ts` 单例                                         | `commands.tsx` | `commands.svelte.ts` |

   每个桥接是 **30-80 行胶水代码**，乘以 6 个模块 × 4 个框架 = 约 **720-1920 行重复**，这些代码本应存在于适配器包中。这是 `AGENTS.md` 指导下原则的直接违反：「适配器只渲染 + 桥接」 —— 然而这些桥接却存在于应用层。

2. **缺少桌面 OS Provider 组件**。与 `SkinProvider`、`ThemeProvider`、`I18nProvider` 和 `IrisProvider`（用于插件）的模式不同，没有 `DesktopProvider` 或 `ShellProvider` 来包裹桌面应用并注入 WM/Profile/FS/Notification/Clipboard 上下文。每个桌面应用自己搭建 —— 这确保了四框架的对称性，但代价是应用级重复。

3. **`@iris-ui/react` 自选的 RSC 策略创建了错误的抽象层级**。每个 `.js`/`.cjs` 产物的 `'use client'` 注入是一个操作级别的 hack，而不是架构边界。如果某个 desktop OS 钩子适合在服务器上运行（例如，读取初始配置文件），它需要一个明确的 RSC 边界，而不是后处理 banner-injection。这不会破坏任何东西，但会增加认知负担。

4. **CLI/MCP scaffoldSnippet 重复是已确认的重复源**。`packages/cli` 中的简化版本不理解受控组件配对；`packages/mcp` 版本理解，但 CLI 有意避免了 MCP 依赖。这与「B 附加类」原则相矛盾：scaffold 逻辑要么属于 A 类（因此需要同步修复），要么需要被提取到两者都可导入的共享核心模块中。

5. **maxRows 静默溢出是真实但较小的 UX 缺陷**。`loadMore` 在 `s.rows.length >= maxRows` 时无条件返回 `Promise.resolve()`，而 state 中的 `hasMore` 保持为 `true`。UI 看到「加载更多」按钮，点击它却没有任何反馈。修复需要 `maxRowsReached` 或 `overflowCount` 标志。

### 架构债务

| 债务                         | 严重性 | 修复成本        | 备注                                          |
| ---------------------------- | ------ | --------------- | --------------------------------------------- |
| 桌面 OS 桥接未标准化         | 高     | 小（24 个钩子） | 每个 ~40 行，来自 shell.tsx 的端口测试        |
| 没有 `ShellProvider` 组件    | 中     | 小              | 与 Provider 组合模式匹配                      |
| CLI/MCP scaffoldSnippet 重复 | 低     | 微小            | 提取到 `@iris-ui/core` 或 `@iris-ui/manifest` |
| maxRows 静默溢出             | 低     | 微小            | 添加 `overflowCount` 到状态                   |
| 缺少子路径的增量 size 预算   | 低     | 小              | `pnpm size` 仅检查总包大小                    |

---

## 2. 扩展方向

### 方向 1：桌面 OS 适配器标准化（P0）

**为什么需要（高业务价值）：**

- 四框架承诺意味着每个框架的桌面能力应该从框架适配器包中开箱即用。
- 当前模式迫使每个新的桌面 shell 实现 6 个桥接，这阻碍了采用。如果你想让社区构建基于 Iris 的桌面环境，重复桥接代码是一个阻碍因素。
- SSR 安全：每个桥接需要 `useSyncExternalStore`/`shallowRef`/`createSignal`/`$state`，在应用级做错容易，在库级测试好则可靠。

**核心挑战：**

- 不同的框架有不同的反应式模型：`useSyncExternalStore`（React）与 `shallowRef` + 模块单例（Vue）与 createSignal + 上下文（Solid）与 `$state` + 模块导出（Svelte）。
- 单例模式（Vue/Svelte 的做法）与上下文模式（React/Solid 的做法）—— 两者在框架适配器包中都需要支持。
- 需要提供 Provider 组件和钩子，且不破坏现有桌面 shell（向后兼容）。

**预期的架构变更：**

- 在每个适配器包中创建 `packages/react/src/desktop/`、`packages/vue/src/desktop/` 等目录。
- 导出带有标准名称的钩子：
  - `useWindowManager` / `useWindowManagerState`
  - `useUserProfile` / `useUserProfileState`
  - `useNotificationCenter` / `useNotificationCenterState`
  - `useClipboardHistory` / `useClipboardHistoryState`
  - `useVirtualFs` / `useVirtualFsState`
  - `useCommandRegistry`

- 可选项：`ShellProvider` 组件，一次性注入所有 6 个上下文（类似于 `IrisProvider` 的工作方式）。

**对现有系统的影响：**

- 四个桌面应用都可以重构为使用标准化的钩子，移除重复的 `shell.tsx`/`wm.ts`/`profile.ts` 文件。
- 零破坏性变更——桌面应用可以增量迁移。

### 方向 2：`ShellProvider` 和 Shell 上下文组合（P1）

**为什么需要：**

- 桌面 OS shell 需要 6 个上下文横切关注点（WM、Profile、FS、Notification、Clipboard、CommandRegistry）。逐个导入它们很繁琐且容易出错。
- 遵循 `IrisProvider(plugins=[...])` 建立的模式，其中上下文自动组合。

**核心挑战：**

- 惰性初始化：每个桌面模块有不同的启动成本。Profile 需要 localStorage 恢复，而 WM 需要初始状态。
- 延迟：在组件树中注入 6 个上下文提供者可能会减慢初始渲染。

**预期的架构变更：**

```typescript
// 伪代码
<ShellProvider
  wm={{ workspaces: 4 }}
  profile={{ storage: localStorageProfileStorage('...') }}
  fs={{ root: '~' }}
  notifications={{}}
  clipboard={{ maxEntries: 100 }}
  commands={{}}
>
  <Window />
  <Dock />
  <Taskbar />
</ShellProvider>
```

- `ShellProvider` 引擎盖下使用 `IrisProvider` 的插件槽，或者使用自己的专用上下文。
- 框架适配器 `ShellProvider` 实现提供懒加载的默认值。

**对现有系统的影响：**

- 桌面应用可以完全消除应用级壳代码（每个 ~150 行），替换为声明式的 `<ShellProvider>`。
- 向后兼容通过为每个上下文提供默认值来维持，配置是可选的。

### 方向 2b（替代方案）：动态壳注册表

作为替代，将壳作为第一类插件 (`createShellPlugin`) —— 允许用户将自定义壳（壁纸引擎、tiling 窗口管理器、macOS 仿真器）作为插件加载，而无需分叉 app。

**挑战：** 这会显著增加插件 API 的表面。需要定义 `ShellContext` 接口，包含 `windowManager`、`profile`、`fs`、`notifications`、`clipboard`、`commands` 属性。还需要壳定义虚拟桌面行为、快照布局等的方式。

### 方向 3：`@iris-ui/core` 中使用 `overflowCount` 的无限模式 UX（P2）

**为什么需要：**

- 当 `maxRows`（默认 5000）被命中时，`loadMore` 静默无操作，但 `hasMore` 保持为 `true`。UI 无法检测是「没有更多数据」还是「数据被截断」。
- 对于大型表格来说，这是一个 UX 降级，用户需要知道他们只看到了总数据集的一个子集。

**核心挑战：**

- 需要一个新的状态字段（例如 `maxRowsReached` 或 `overflowCount`）而不会破坏现有消费者。
- `hasMore` 语义需要保持兼容——它由 `nextRows.length < result.total` 计算得出。

**预期的架构变更：**

```typescript
// 在 DataSourceState 中
maxRowsReached?: boolean  // true 时，rows.length >= maxRows 但 hasMore 仍为 true
// 或者
overflowCount: number     // 在无限模式下被截断的额外行数（maxRows 之外的）
```

- `applyResult` 中的变更：当 `mode === 'infinite'` 且 `nextRows.length > maxRows` 时，设置 `maxRowsReached: true` 并切片。
- 适配器桥接（`useDataSource`）将此字段暴露为响应式属性。
- UI 组件可以显示 `"Showing 5,000 of 10,000 rows"`。

**对现有系统的影响：**

- 非破坏性：现有消费者忽略新的 state 字段。
- 测试仅需添加一个检查 `maxRowsReached` 的无限模式测试。

### 方向 4：共享代码生成核心（P2）

**为什么需要：**

- `packages/cli` 和 `packages/mcp` 中的 `scaffoldSnippet` 重复意味着对一个的 bug 修复不会应用到另一个。`detectControlledPair` + `wiredTag` 逻辑（仅 MCP 有）也应被 CLI 使用。

**核心挑战：**

- `packages/cli` 不想把 `@iris-ui/mcp` 作为依赖引入（这是合理的：CLI 应该保持轻量）。
- 提取到 `@iris-ui/core` 是可行的，但 `scaffoldSnippet` 不是运行时逻辑——它是代码生成。它不属于核心。

**预期的架构变更：**

**选项 A：** `@iris-ui/manifest` 中的共享 `codegen` 模块。Manifest 包已经在处理生成 `manifest.json`/`llms.txt`；添加 `scaffoldSnippet` + `detectControlledPair` 是合理的范围扩展。

**选项 B：** `packages/codegen` 子包共享代码。专用于代码生成逻辑的轻量级独立包。

**对现有系统的影响：**

- CLI 从 `@iris-ui/manifest` 或 `packages/codegen` 导入 `scaffoldSnippet`。
- MCP 从同一源导入，移除 CI 中的行差。

### 方向 5：增量子路径 Size 预算（P2）

**为什么需要：**

- 当前 `pnpm size` 仅检查总包大小。如果某人在 `@iris-ui/core` 中向 `window.ts` 添加了 10KB 的依赖，总 bundle 不会超过预算，但 `@iris-ui/core/window` 的消费者会默默承受膨胀。
- 子路径 size 预算是对 LGx「B 零配置在场，B 不用不进包」原则的验证：每个子路径的增量*应该*是可测量的。

**核心挑战：**

- 工具化：需要按子路径追踪 bundle 大小，而不是按包。
- 基准：需要为每个子路径建立初始基准。
- CI 集成：需要与现有的 `pnpm size` 检查并行运行。

**预期的架构变更：**

- 创建一个 `scripts/check-subpath-sizes.mjs` 脚本（或扩展 `scripts/size-report.mjs`），专门为每个子路径构建 + 测量。
- 在 CI 中，对每个变更运行 `pnpm size:subpaths`，基准存储在文件中（类似于 size-limit）。

---

## 3. 接口设计建议

### 原则

1. **遵循已有的模式**。`DesktopProvider` 应遵循 `SkinProvider` 和 `I18nProvider` 的模式——context 提供者 + 钩子，有显式的 `useXxx` 对缺失上下文的检查。

2. **子路径是真相源**。就像 `@iris-ui/core/window` 导出 `createWindowManager` 一样，`@iris-ui/react/desktop` 应导出 `useWindowManager`——而不是 `@iris-ui/react` barrel 的一部分。

3. **单例 vs 上下文的可组合性**。Vue 桌面使用模块级单例；React 使用 Context。适配器应两者都支持——导出标准的反应式桥接（基于上下文）和便利的单例工厂（`createDesktopShell()`），对于不需要多个 shell 实例的简单应用。

### 提议的接口

最低限度的可交付产物：

```typescript
// @iris-ui/react/desktop

// 提供者（可选组合，如 IrisProvider）
export function ShellProvider(props: ShellProviderProps): JSX.Element

// 每个模块的钩子
export function useWindowManager(): WindowManager
export function useWindowManagerState(): WindowManagerState

export function useUserProfile(): UserProfile
export function useUserProfileState(): ProfileData
export function useApps(): AppManifest[] // 组合：profile + catalog
export function useLaunchApp(): (appId: string) => void

export function useNotificationCenter(): NotificationCenter
export function useNotificationCenterState(): NotificationCenterState

export function useClipboardHistory(): ClipboardHistory
export function useClipboardHistoryState(): ClipboardHistoryState

export function useVirtualFs(): VirtualFs
export function useVirtualFsState(): VfsState

export function useCommandRegistry(): CommandRegistry
export function useCommandPalette(): CommandPaletteState // 如果适用

// 便利工厂（简单应用）
export function createDesktopShell(config: DesktopShellConfig): DesktopShell
```

```vue
// @iris-ui/vue/desktop (或从 @iris-ui/vue 导出)

export const wm: WindowManager                       // 单例
export function useWmState(): Ref<WindowManagerState>

export const profile: UserProfile                    // 单例
export function useProfileState(): Ref<ProfileData>
export function useApps(): ComputedRef<AppManifest[]>
export function launchApp(appId: string): void
// ... 等
```

**关键考虑因素：**

- **不要在此层引入新的状态管理。** 使用 `@iris-ui/core` 的 `createStore` 并通过 `useSyncExternalStore`/`shallowRef`/`createSignal`/`$state` 桥接，与所有其他 Iris hooks 的做法一致。

- **每个桌面模块的测试应遵循模式。** 为每个钩子提供 wiring 测试（非 jsdom 场景测试——它们在 core 层）、Provider 上下文检查（缺失时抛出错误）以及 state 订阅正确性。

- **向后兼容。** 现有的桌面应用应保持工作，导入新钩子之前不需要 `<ShellProvider>`。在 v1 中，Provider 可以是可选的——应用仍然可以自己创建上下文。在 v2 中（如果需要），可以弃用。

### 反对 `backendForFrontend` 模块

不要为桌面 OS 模块创建「BFF」拆分。每个 6 个 core 模块已经是正确的抽象级别。在适配器中拆分它们会增加另一个层级而没有收益。相反，标准化已经存在于四个桌面应用中的『薄桥』，并将其向上移动到框架适配器包中。

---

## 4. 技术选型

### 不需要

- **无需新框架或运行时。** 当前的 pnpm + Turborepo + tsup + Vitest 栈已足够。
- **无需新的反应式库。** `useSyncExternalStore`/`shallowRef`/`createSignal`/`$state` 已覆盖所有桌面 OS 桥接。桌面模块使用 `createStore`，它已经提供了 `subscribe`/`getState`/`setState`——这正是每个桥接所需要的。
- **无需 CSS-in-JS 解决方案。** 主题 token 系统已经通过 `var(--iris-*)` CSS 变量处理了所有外观。

### 可能的依赖项需评估

| 提议的依赖                     | Pros                         | Cons                                        | 决策                                     |
| ------------------------------ | ---------------------------- | ------------------------------------------- | ---------------------------------------- |
| `@floating-ui/dom`（已依赖）   | 定位槽、任务栏弹出等         | 已包含                                      | ✅ 已在使用                              |
| `@anthropic-ai/sdk`            | LLM planner 传输             | 加入捆绑包 -> 桌面应用 OTA 更重             | ❌ 保持可注入（`ModelCall` 类型）        |
| `@modelcontextprotocol/sdk`    | 运行时 MCP 集成              | 大型依赖，仅用于 commands.ts 的可选功能     | ❌ 保持为可选导入                        |
| `zustand` / `pinia` / 外部状态 | 桌面 shell 状态管理          | 引入另一个层 -> 冲突的 store 模式           | ❌ 使用 `@iris-ui/core` 的 `createStore` |
| `localforage` / `idb-keyval`   | 更好的 ProfileStorage 持久化 | 额外的 bundle 大小，已经可以用 localStorage | ❌ 保持简单                              |

### 关键设计决策

1. **`ModelCall` 作为注入点是正确的抽象。** 它保持 LLM planner 无网络依赖，且与框架无关。四个桌面应用各自使用自己的 SDK（或 mock）实现 `ModelCall`。这在 `commands.ts` 中已经存在，不应改变。

2. **`AbortController` 纪元模式** 对于数据获取是正确的。评估验证了竞态保护是可靠的。在 `loadMore` 上的 `maxRows` 检查中唯一缺少的是用户可见的反馈，如方向 3 所讨论的。

3. **基于 `createStore` 的桌面状态** 是正确的选择。所有六个桌面模块都围绕 `createStore` 构建，这意味着桥接有统一的需要订阅的 `store.subscribe`/`store.getState` 接口。React 使用 `useSyncExternalStore`，Vue 使用 `shallowRef` + 订阅，Solid 使用 `createSignal` + 订阅，Svelte 使用 `$state` + 订阅。这种统一性证明了「core 是共享逻辑之家」的原则。

### 自建 vs 采购

当前架构中不存在有动机的自建 vs 采购决策——桌面 OS 桥接是薄胶水，不是大型框架。如果 Iris 想要支持 macOS 风格的标签栏、KDE 风格的小部件或 GNOME 风格的扩展，那么「采购」现有实现（例如 gnome-shell 的 `workspace.js`）作为参考设计是有意义的，但运行时始终需要是 Iris 自己的 `createWindowManager`，因为它是框架无关的，并与现有的 token/theme/plugins 生态系统集成。

---

## 5. 实施路线图

### 优先级矩阵

| 方向                   | 优先级 | 努力程度        | 影响                   | 风险               |
| ---------------------- | ------ | --------------- | ---------------------- | ------------------ |
| ① 桌面 OS 适配器标准化 | **P0** | 小（~2-3 天）   | **高**：兑现四框架承诺 | 低——已有双向映射   |
| ② ShellProvider 组合   | **P1** | 小（~1-2 天）   | 中：简化 shell 启动    | 低——可选，向后兼容 |
| ③ 无限模式 maxRows UX  | **P2** | 微小（~2 小时） | 低：UX 美化            | 无——新状态字段     |
| ④ 共享代码生成核心     | **P2** | 小（~半天）     | 中：消除重复           | 低——纯提取         |
| ⑤ 增量子路径 Size 预算 | **P2** | 小（~1 天）     | 中：防止回归           | 低——工具           |

### 路线图

#### 阶段 1：桌面 OS 适配器标准化（P0）—— 第 1 周

**里程碑：** 24 个钩子/组合/上下文从桌面应用移动到框架适配器包，并在四个框架中测试。

**步骤：**

1. **审计与解析**（半天）
   - 从 `apps/desktop-os/src/shell.tsx` 提取所有钩子：`useWm`、`useWmState`、`useProfile`、`useProfileState`、`useOs`、`useNotifications`、`useNotificationState`、`useClipboard`、`useClipboardState`、`useFs`、`useFsState`、`useApps`、`useLaunchApp`。
   - 为 Vue 桌面（`wm.ts`、`profile.ts`、`notifications.ts`、`fs.ts`、`clipboard.ts`、`os-state.ts`）做同样的工作。
   - 为 Solid 桌面（`wm.tsx`、`profile.tsx`、`notifications.tsx`、`clipboard-context.tsx`、`fs-context.tsx`、`os-state.tsx`）做同样的工作。
   - 为 Svelte 桌面（`wm.svelte.ts`、`profile.svelte.ts`、`notifications.svelte.ts`、`clipboard.svelte.ts`、`fs.svelte.ts`、`os-state.svelte.ts`）做同样的工作。
   - 交付物：清单「每个模块 6 个钩子 × 4 个框架」。

2. **创建框架适配器模块**（1 天）
   - React：`packages/react/src/desktop/` 包含 `useWindowManager.ts`、`useUserProfile.ts`、`useNotificationCenter.ts`、`userClipboardHistory.ts`、`useVirtualFs.ts`、`useCommandRegistry.ts` + `index.ts` barrel。
   - Vue：`packages/vue/src/desktop/` 同名组合（`.ts` 文件）。
   - Solid：`packages/solid/src/desktop/` 同名 context+signal 文件。
   - Svelte：`packages/svelte/src/desktop/` 同名 `svelte.ts` rune 文件。
   - 更新每个适配器的 `tsup.config.ts` 将 `desktop` 添加为入口点。
   - 更新每个适配器的 `package.json` 添加 `./desktop` 子路径导出。

3. **从 shell.tsx/wm.ts/etc 移植测试**（半天）
   - React `useWm` 测试：verify context provides, `useWmState` subscribes, 缺失时抛出。
   - Vue `useWmState` 测试：verify ref 是最新的，单例是不变的。
   - Solid/Svelte 同理。

4. **重构桌面应用以使用新钩子**（1 天）
   - `apps/desktop-os/src/shell.tsx`：从 `@iris-ui/react/desktop` 导入 `useWm`、`useProfile` 等，而不是定义它们。删除 shell.tsx 中的 Context 提供者定义？或者让 `ShellProvider` 内部使用它们。
   - `apps/desktop-os-vue/src/wm.ts`、`profile.ts` 等：从 `@iris-ui/vue/desktop` 导入，删除本地定义。
   - 如果适用，将桌面应用重构为使用 `<ShellProvider>`。

5. **质量门**（半天）
   - 在每个四个框架中运行 `pnpm turbo run test typecheck lint build`。
   - 运行 `pnpm size` 验证适配器包的增量是否在预算内（每个包 ~0.5KB）。
   - 运行 SSR 检查（`pnpm check:rsc`）确认 `desktop/` 入口正确添加了 `'use client'`。

**风险与缓解：**

| 风险                                                              | 可能性 | 缓解                                                                                          |
| ----------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Vue 单例模式 vs React 上下文模式导致 API 不一致                   | 中     | 两种都导出，让应用选择。提供 `ShellProvider`（上下文）和 `createDesktopState()`（单例工厂）。 |
| 应用级函数（`launchApp`、`addCustomApp`）在 core 模块中引用了目录 | 中     | 保持应用级函数在应用层；只提取纯的「core 状态桥接」到适配器。                                 |
| 测试因 jsdom 限制（`getBoundingClientRect`、`PointerEvent`）失败  | 低     | 遵循建立的无 DOM 测试模式——只测试 wiring/状态订阅，而非布局。                                 |

#### 阶段 2：ShellProvider 组合（P1）—— 第 2 周

**里程碑：** `<ShellProvider>` 组件在四个框架中可用，桌面应用可选使用。

**步骤：**

1. 在每个适配器包中创建 `ShellProvider` 组件（遵循 `IrisProvider` 的上下文注入模式）。
2. 将 `useWindowManager`、`useUserProfile` 等设置为由 `ShellProvider` 自动提供（类似于 `useI18n` 随 `I18nProvider` 工作）。
3. 在桌面应用中使 `ShellProvider` 可选——如果不存在，则回退到本地上下文创建（向后兼容）。
4. 测试：确保在没有 `ShellProvider` 的情况下 `useWindowManager()` 会抛出；`ShellProvider` 上下文创建能正确初始化所有 6 个模块。

#### 阶段 3：增量子路径 Size 预算（P2）—— 第 3 周

**里程碑：** CI 流水线对每个子路径变更进行基准测试和警告。

**步骤：**

1. 创建 `scripts/check-subpath-sizes.mjs`，为 `@iris-ui/core` 的每个子路径构建最小 bundle 并测量其大小。
2. 将初始基准存储为 `benchmarks/subpath-sizes.json`。
3. 将 `pnpm size:subpaths` 添加到 CI 流水线，并在任何子路径增长超过阈值（例如 +5%）时失败。

#### 阶段 4：maxRows UX + 共享 scaffold（P2）—— 第 3-4 周

**里程碑：** Infinite 模式报告溢出；CLI 和 MCP 共享生成代码。

**步骤：**

1. 在 `DataSourceState` 中添加 `maxRowsReached` 字段。在 `applyResult` 中设置。为非破坏性向后兼容性保持 `hasMore` 不变。
2. 将 `scaffoldSnippet` + `detectControlledPair` 从 MCP 提取到 `@iris-ui/manifest` 或新的 `packages/codegen` 子包。CLI 从那里导入。删除重复的 CLI 实现。

---

## 总结

评估文件（原始分析）在对现有架构的理解上基本上是准确的，但对两个方向（不对称和树摇）的事实错误导致虚假的结论。修正后的评估留下了三个真实的改进机会（P0-P2）。

最重要的发现是**桌面 OS 框架适配器标准化**是一个 P0 缺口，投入产出比高：每个钩子约 30-40 行，提取到适配器包中，自动为所有四个框架带来 SSR 安全、测试覆盖和文档。这直接关联到项目的「四框架对齐」承诺。

`ShellProvider` 组合是一个自然的 P1 扩展，可以减少样板代码。省略它不会破坏任何东西——现有的桌面应用继续工作——但拥抱它会降低新 shell 的进入门槛。

其他问题（maxRows UX、scaffold 重复、size 预算）是有实际价值的 P2 完善，但不是阻止性的。完整的纠正路线图可以在两个 sprint 内交付（一个专门用于适配器标准化和提供者组合，一个用于剩下的）。
