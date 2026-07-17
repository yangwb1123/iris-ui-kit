# 架构分析报告：Iris UI 全局扫描五大方向

## 1. 架构评估

### 1.1 核心优势

Iris UI 的架构设计有若干值得称道的决策：

**框架适配器模式的正确性验证。** 四框架对齐 149 个组件是极有说服力的证据——"core 做逻辑、adapter 做薄桥"不是纸上谈兵，而是经实测验证、可重复的抽象。core 中 `createSelectionModel`、`createExpansion`、`createVirtualizer` 等控制器被 17-19 个组件共享这个指标，直接证明了相比"每个框架各自实现"的压缩比。

**Token 系统的杠杆效应。** 30 token 覆盖组件 vs 800 行原生 CSS 的 93%+ 压缩比不是虚数——这是主题系统的核心价值主张。`var(--iris-*)` + 逻辑属性（`margin-inline-start`）的设计避免了 RTL 重构陷阱。

**插件契约的克制。** `createPlugin` 仅允许注册 token、i18n message、共享 store——没有 `registerComponent`，没有"组件名到实现的动态映射"。这个克制保护了 Tree-shaking 和 TypeScript 类型不退化。

**状态机的判别准则。** 明确区分"哪种状态配用 Machine"（Popover/Tooltip/Dialog → 事件语义明确；Switch/Input → 纯布尔 prop 足矣），避免 svjs 的"每个组件套 400 行 Machine"陷阱。

### 1.2 架构债务 / 技术债

五大方向实质上是**同一类架构债务的五个表现**：**抽象同步缺口（Abstraction Synchronization Gap）**。

| 债务类型                            | 表现                                                                                                                       | 严重程度                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **跨框架状态管理分歧**（方向一）    | React/Solid 用 Context + Provider；Vue/Svelte 用模块单例。两者 SSR 安全性不对称，测试隔离不对称，生命周期不对称            | **高** — SSR 安全是硬性 bug，不是风格选择 |
| **三原生壳无共享协议**（方向二）    | Electron preload.js / Tauri `inject_bridge()` / Wails Go binding — 同一个 `window.irisNative` 概念，三套完全不同的实现机制 | **高** — 旗舰特性维护成本线性增长         |
| **插件框架子路径零门禁**（方向三）  | exports 映射提供了清晰的框架子路径结构，但零工具门禁。TypeScript 无法区分 `ComponentType<Props>` 的来源框架                | **中** — 风险随插件数量线性放大           |
| **表单验证路径不组合**（方向四）    | `validators` map + `validate` 函数 + `standardSchemaValidator` 三条路径互相替代而不组合。浅合并掩盖了真正的 pipeline 需求  | **中** — 中型表单场景必然遇到             |
| **插件 Size Budget 盲区**（方向五） | 13 插件 × 5 入口 = 65 可独立追踪的产物不在 check-size.mjs 中                                                               | **低** — 维护纪律，不涉及运行时代码错误   |

此外，从源码中还观察到以下架构债务：

**CMS 应用层验证债务。** 四框架 CMS（`cms-react`、`cms-solid`、`cms-svelte`）的结构完全与 `desktop-os-*` 对称——它们也在各自的壳中重复导航、主题切换、异步数据加载的编排逻辑。但 CMS 不在五大方向范围内。CMS 壳是否应该共享 Desktop OS 壳的 `createShellState` 统一工厂？从架构对称性来看应该是的——但当前没有被纳入分析。

**SSR 测试的架构一致性缺口。** AGENTS.md 提到 SSR 测试用 `// @vitest-environment node` + `renderToString`——但四个框架的 SSR 策略不同（Next.js `'use client'`、Nuxt 的 `definePageMeta`、SolidStart 的 `$server`、SvelteKit 的 `+page.ts`）。当前 `ssr-*` 应用 (`ssr-next`、`ssr-nuxt`、`ssr-solidstart`、`ssr-sveltekit`) 的存在说明团队意识到了 SSR 问题，但这些应用没有像 `desktop-os-*` 的 `check-desktop-parity.mjs` 那样的跨框架一致性门禁。

### 1.3 关键设计决策合理性评估

| 决策                                         | 评估            | 理由                                                                                                                                                   |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| core 零框架依赖                              | ✅ 正确         | 这是四框架对齐的前提条件。任何违反（`grep "from 'vue'" core`）即 bug                                                                                   |
| 插件只注册 token/i18n/store，不注册组件      | ✅ 正确         | 保护 Tree-shaking 和类型安全。Schema-driven 渲染用局部 widgets map 更清洁                                                                              |
| 状态机仅限有事件语义的组件                   | ✅ 正确         | 避免了 "svjs 400 行 machine 包装一个布尔 prop" 的退化                                                                                                  |
| 表单 `validators` + `validate` 双路径        | ⚠️ 可改进       | 设计初衷是"简单用 map，复杂用 function"——但用户真实需求是"组合"而非"二选一"                                                                            |
| `standardSchemaValidator` 返回 `FieldErrors` | ⚠️ 有代价的简化 | 保留了 Iris 的框架无关性，但丢弃了 `.transform()` 的值。当前用 `parse`/`transform` 函数弥补这个缺口，但不在验证管道中                                  |
| 原生壳三套实现互不共享                       | ❌ 架构缺口     | 这是最具破坏性的架构债务——旗舰特性（多原生壳）的最低级实现成本正在持续累积。每个壳添加一个新原生能力（如文件拖放、系统通知）需要三种完全不同的实现路径 |

---

## 2. 高价值架构扩展方向

五大方向已经给出了很好的起点。我在此基础上有三个重要的增补和深化建议：

### 方向 2-A （核心扩展）：引擎生命周期统一协议 `IrisEngine`（融合方向一 + 方向四 + 方向二的部分共性）

**为什么要扩展方向一？** 方向一只关注 Desktop OS 壳的 5 个引擎实例的分歧。但实际架构中 core 有**十多个**可创建的引擎（`createWindowManager`、`createUserProfile`、`createNotificationCenter`、`createClipboardHistory`、`createVirtualFs`、`createFormStore`、`createSelectionModel`、`createExpansion`、`createAdminShell`、`createResourceController`、`createVirtualizer`……）——它们面临完全相同的生命周期问题：SSR 安全、测试隔离、HMR、多实例。方向一的 `createShellState` 只解决了 Desktop OS 壳的问题，没有解决**整个引擎生态**的问题。

**建议：定义 `EngineLifecycle` 协议**

```typescript
// 逻辑在 core 中定义——框架无关
interface EngineLifecycle<T> {
  /** 工厂函数：创建引擎实例 */
  create: () => T
  /** 销毁函数：清理副作用（定时器、DOM 事件、store 订阅） */
  destroy?: (instance: T) => void
  /** SSR 安全策略：在非 DOM 环境中是否可创建 */
  ssr?: 'safe' | 'lazy' | 'forbidden'
  /** 测试隔离 hint：每次 create() 是否返回独立副本 */
  isolated?: boolean
}
```

每个 core 引擎在导出时附带一个 `meta` 对象声明其生命周期属性。Adapter 层的 Provider 根据框架最佳实践消费该信息：

- `ssr: 'safe'` → React 的 `useRef`、Vue 的模块级、Svelte 的 `$state` 均可
- `ssr: 'lazy'` → 只有 React/Solid 的 `useRef` 模式安全；Vue/Svelte 需要条件式创建
- `ssr: 'forbidden'` → 所有框架都需要 `onMount`/`useEffect` 内创建

**为什么不是方向一已有的 `createShellState`？**

`createShellState` 对 Desktop OS 壳而言是个正确的统一方案。但它的范围太窄——它假设"壳需要哪些引擎"是固定的。真实的项目中，**插件**也会注册引擎（方向一的观察范围不包含 `plugin-*` 的引擎注册需求）。一个 `plugin-editor` 如果需要在 core 注册自己的引擎，它应该也能受益于统一的生命周期协议。

**核心挑战**：

- 引擎的 `ssr` 评级需要 core 的每个导出者自行声明
- 适配器层需要统一消费 `EngineLifecycle` 的 Provider/Context 模式
- 现有引擎不附带 `meta`，需要一个迁移期

**预期架构变更**：

- `packages/core/src/engine-lifecycle.ts` —— 新文件，定义 `EngineLifecycle` 类型 + `defineEngine` 包装器
- 每个 `create*` 引擎在其声明文件中附带 `meta` 对象
- 适配器层可选的 `IrisEngineProvider` 组件作为 Context 统一入口
- `createShellState` 作为 `EngineLifecycle` 机制的特例（预配置哪些引擎需要被创建）

**对现有系统的影响**：

- **向后兼容**：`EngineLifecycle` 是标记型接口（类型级别），现有 `create*` 函数的签名不变
- 迁移路径：每个引擎逐步添加 `meta` 声明，无需一次性改造
- 插件系统：`createPlugin` 的 `install(reg)` 可以允许 `reg.registerEngine('myEngine', { create: ..., destroy: ..., ssr: 'lazy' })`

---

### 方向 2-B（新增方向）：组件/引擎构成分析（Composition Registry）— 回答"IrisButton 用了多少 core"

**为什么需要？** 当前 size budget 只监控包级别的 gzip 体积（`check-size.mjs` 的 `BUDGETS` 对象）。包级别监控的问题是：它无法回答架构层面的关键问题——"消费一个 IrisButton 到底拉入了多少 core 逻辑？"、"哪些组件共享了哪个引擎的实例？"

这是一个**架构透明度**工具——不是运行时功能，而是构建时/分析时工具。

**建议：`@iris-ui/manifest` 的扩展方向**

当前 `@iris-ui/manifest` 只做"扫描 barrel 输出组件清单"。扩展为按组件粒度分析构成：

```
IrisButton →
  ├─ core: useButton (selection model?)
  ├─ core: createStore (for state?)
  ├─ tokens: --iris-button-* (token count)
  ├─ CSS: 注入的 stylesheet 大小
  └─ 树摇风险：导入 IrisButton 实际导致多少未使用代码
```

**核心挑战**：

- 解析工具的选型：esbuild 的 metafile、webpack 的 stats、Rollup 的 `bundleAnalysis`？
- 跨框架 alias 解析：`@iris-ui/react/button` 映射到 `@iris-ui/core/button` 的哪个组件？
- 结果的可视化（VitePress 文档站中的"组件 cost 卡片"）

**业务价值**：

- 确保 "Button 是一个元原语" 的事实被量化（而不是仅凭信念）
- 为 `check-size.mjs` 的 budget 决策提供数据支撑——当需要提高 budget 时，有"哪个组件导致的"的数据
- 在 PR 流程中自动标注 "此 PR 使 IrisButton 体积从 1.2KB → 1.5KB (↑25%)"

**与方向五的关系**：方向五要求扩展 `check-size.mjs` 加入插件包的 budget。组件构成分析是方向五的**补充升级**——从"监控包体积"到"理解组件 cost 构成"。

---

### 方向 2-C（新增方向）：跨壳集成测试基础设施统一

**为什么需要？** 方向二指出了三原生壳各自缺少 CI 守卫——Tauri/Wails 的 `gate.sh` 在缺少 Rust/Go 环境时静默跳过。但问题不仅是"缺少测试"，更大的问题是**跨壳测试基础设施完全不存在**。

Desktop OS 4 个 Web 壳有 `check-desktop-parity.mjs` 门禁，但该门禁只做静态文本检查（app 目录 + OS skin 集合是否存在），不检查**运行时行为一致性**。四个壳之间的行为差异（比如 Solid 壳的窗口关闭逻辑在某个 edge case 下与 React 壳不一致）只有靠人手动审查才能发现。

**建议：跨壳行为一致性集成测试套件**

```
scripts/desktop-integration/
  ├── parity-tests.config.ts      # 四个壳的起点 URL、窗口标识
  ├── suites/
  │   ├── window-management.test.ts   # 打开/关闭/切换窗口
  │   ├── app-launch.test.ts          # 启动/终止应用
  │   ├── native-bridge.test.ts       # saveFile / writeClipboard 桥接
  │   └── persistent-state.test.ts    # localStorage / session
  └── runners/
      ├── playwright.runner.ts        # Web 壳（四个壳都可用 Playwright 测试）
      ├── electron.runner.ts          # Electron 壳主进程 + 渲染进程
      ├── tauri.runner.ts             # Tauri 壳（需要 Rust 环境）
      └── wails.runner.ts             # Wails 壳（需要 Go 环境）
```

注意：不是每个 runner 都需要在每次 PR 中执行。分层策略：

| 层级 | 覆盖范围                    | 执行时机         | 环境要求                  |
| ---- | --------------------------- | ---------------- | ------------------------- |
| L1   | 四个 Web 壳的核心行为一致性 | PR 必须通过      | 纯 Node.js + Playwright   |
| L2   | 三原生壳的核心行为一致性    | nightly / 发布前 | Electron + Rust + Go 环境 |
| L3   | 全壳全行为扫描              | 发布门禁         | 完整开发环境              |

**核心挑战**：

- Playwright Web 壳测试已经可行，但四个壳的异步行为时序不同（Solid 的 signal 调度 vs Vue 的 nextTick）——测试断言需要容忍框架微妙的渲染时序差异
- Electron/Tauri/Wails 在 CI 中的搭建（方向二提到的 `gate.sh` 静默跳过问题需要解决——建议用 `docker-compose` 或 nix-shell 为原生壳提供开发环境）
- `irisNative` 桥在三个原生壳中的不同返回类型（Electron: Promise; Tauri: Promise; Wails: Go binding 同步）——测试套件需要统一 await

**业务价值**：

- 直接保护旗舰特性（"一个 UI 库跑在四个壳上"）不出现行为退化
- 降低原生壳 bug 修复的"认知复位成本"——当前修复一个 Electron 壳 bug 后，需要人工检查 Tauri/Wails 壳是否会同样受影响。集成测试可以自动覆盖

---

### 方向 2-D（深化方向二）：`@iris-ui/native-bridge` 协议包的扩展建议

方向二建议定义一个 `@iris-ui/native-bridge` 协议包。我从架构角度对此建议做两个扩展：

**2-D-1：协议包应包含**类型验证层**，不仅是接口定义**

当前方向二建议的 `IrisNativeBridge` 接口只包含方法签名。但三原生壳的行为差异（Electron 的 `saveFile` 是 Promise，Tauri 是 Promise，Wails 是同步 `bool`）意味着**接口的异步一致性**也需要规定。

建议协议包包含一个类型层来强制异步签名：

```typescript
// packages/native-bridge/src/types.ts
export interface IrisNativeBridge {
  readonly platform: 'electron' | 'tauri' | 'wails' | 'web'
  readonly framework: 'react' | 'vue' | 'solid' | 'svelte'

  /** 所有桥接方法必须返回 Promise——壳实现内部可能需要 await IPC / FFI */
  saveFile(payload: FileSavePayload): Promise<FileSaveResult>
  writeClipboard(text: string): Promise<boolean>
  readClipboard?(): Promise<string | null> // 可选——Wails 当前未实现

  /** 生命周期钩子——壳可以附加清理逻辑 */
  onFrameworkSwitch?(fw: string): void | Promise<void>
}
```

**2-D-2：协议包应提供一个** mock 实现**用于测试**

```typescript
// packages/native-bridge/src/mock.ts
export function createMockNativeBridge(overrides?: Partial<IrisNativeBridge>): IrisNativeBridge {
  let fs = new Map<string, string>()
  let clipboard = ''

  return {
    platform: 'web',
    framework: 'react',
    saveFile: async (payload) => {
      fs.set(payload.filename, payload.content)
      return { success: true, path: `/mock/${payload.filename}` }
    },
    writeClipboard: async (text) => {
      clipboard = text
      return true
    },
    readClipboard: async () => clipboard,
    ...overrides,
  }
}
```

这个 mock 可以让 `@iris-ui/core` 的 `file-save.ts`、`clipboard.ts` 的测试不再需要 mock `window.irisNative`，而是注入 mock bridge。

**2-D-3：Electron 壳的 preload 机制应成为其他壳的安全参考**

方向二指出"安全性不均"——Electron 用 `contextIsolation` + `preload.js`（安全），Tauri 用 `<script>` 注入（无沙箱），Wails 用 Go binding（无隔离）。协议包应定义一个"安全等级"：

```typescript
export const SECURITY_LEVELS = {
  electron: 'isolated', // contextIsolation + preload
  tauri: 'injected', // HTML injection, same origin
  wails: 'binding', // Go binding, no isolation
} as const
```

这个安全等级可以用于：

- 开发者文档中明确不同壳的安全承诺
- 运行时检测（`isNativeShellSecure()`）
- 未来 Tauri 2.0 或 Wails v3 支持 `contextIsolation` 式的预加载时，协议包可以做版本感知

---

### 方向 2-E（深化方向三）：ESLint 规则的架构级设计——不仅是框架子路径检测

方向三建议增加一条 ESLint 规则检测插件框架子路径的跨框架导入。从架构角度，这是一个**更大容量可寻址问题**的入口——不仅是"React 项目导入 Vue 子路径"，还包括：

**2-E-1：禁止 core 包导入框架代码**（已有一条规则但应强化）

当前 `@iris-ui/eslint-plugin` 有 `no-internal-import` 规则禁止内路径导入（如 `@iris-ui/core/src/...`）。但一个更隐蔽的违规是：**core 包进口了框架适配器的类型或值**。这在导入静态分析中可能不触发现在的规则（因为导入路径是合法的 package name）。

建议扩展一条 `no-framework-in-core` 规则：

```
❌ packages/core/src/button.ts:
   import { ComponentType } from 'react'   // 禁止——core 应零框架依赖

✅ packages/core/src/button.ts:
   export interface ButtonProps { ... }      // 纯类型
```

类型依赖是一类特例（有些 `@iris-ui/core` 的类型可能从框架类型继承）。规则需要维护一个"许可框架类型"白名单。

**2-E-2：`usePluginStore` 的 key 类型安全**

方向三的运行时守护建议（`typeof React?.createElement === 'undefined'`）固然成本低，但其覆盖范围有限。一个更深层的方案是用 TypeScript 的**类型级框架标记**：

```typescript
// 框架适配器入口文件顶部注入框架标记
// plugin-editor/src/react/index.ts
import type { ReactFramework } from '@iris-ui/core/framework'
const _framework: ReactFramework = {} // 仅类型使用，运行时无开销
```

然后 `plugin-*/react` 子路径导出的组件在 props 中携带这个标记——其他框架的组件无法静默赋值：

```typescript
// 一个 Vue 组件不能接受 ReactFramework 标记的 prop
export interface IrisCodeEditorProps {
  value?: string
  // ...
  /** @internal 框架标记——禁止在非 React 项目中使用 */
  __framework?: ReactFramework
}
```

```typescript
// 2-E-1: 禁止 core 导入框架
import type { ComponentType } from 'react'
// ↑ 如果能通过 AST 扫描发现 → 应报错

// 2-E-2: 框架标记
import type { ReactFramework } from '@iris-ui/core/framework'
```

这是 TypeScript 的类型系统技巧——`__framework` prop 在 Vue/Solid/Svelte 组件签名中不存在，TypeScript 会报 prop 不存在。缺点是：

- 每个组件 props 接口增加一个 `@internal` 标记
- 对 `{...spread}` 模式可能漏检
- 对 `any` 类型的 props 没有防护

---

## 3. 接口设计建议

### 3.1 引擎生命周期协议 `EngineLifecycle` 的接口原则

```
// 设计原则 1: 声明式 + 渐进式
// 不需要所有引擎一次性迁移。新增 meta 是可选增强
interface EngineMeta {
  ssr: 'safe' | 'lazy' | 'forbidden'
  isolated: boolean
  displayName: string
}
```

```
// 设计原则 2: 框架适配器消费模式化
// 每个 adapter 提供 <IrisEngineProvider>，内部处理 map 语义
// React: createContext + useRef + useEffect 清理
// Vue: provide + ref + onUnmounted
// Solid: createContext
// Svelte: setContext + $state + onDestroy
```

```
// 设计原则 3: 不与现有 Provider 冲突
// EngineLifecycle Provider 与 Theme/Skin/I18n Provider 同层
// 插件系统的 registerEngine 在 IrisProvider(plugins) 中一并接入
```

### 3.2 表单验证管道的接口设计权衡

设计一个 `ValidationPipeline` 替代当前的 `validators` + `validate` 双路径，有若干设计选项：

**选项 A：数组式管道（方向四的建议）**

```typescript
createFormStore({
  validationPipeline: [
    standardSchemaValidator(z.object({ email: z.string().email() })),
    { fields: ['email'], validate: (v) => ... },
    { crossField: true, validate: (values) => ... },
  ],
})
```

- 优点：天然的"短路组合"——前一个失败后一个不执行。易于维护
- 缺点：与现有 API 不兼容——现有用户需要迁移
- 缺点：流水线步骤的命名和类型推断复杂（步骤可以是 schema、per-field map、cross-field function）

**选项 B：装饰器式组合（保留现有 API，加法引入）**

```typescript
createFormStore({
  validators: { email: ... },   // 现有 API 保持不变
  validate: pipeline(           // pipeline() 是组合器
    standardSchemaValidator(z.object({ email: z.string().email() })),
    (values) => ... // cross-field
  ),
})
```

- 优点：向后兼容，现有代码无 break
- 优点：`pipeline()` 是一个纯函数组合器，类型安全简单
- 缺点：不能"短路"（因为 `validate` 函数接口要求返回 `FieldErrors`，不能表达"不需要执行"）

**选项 C：配置对象 = Standard Schema（面向未来）**

```typescript
createFormStore({
  // validate 现在接受 schema 实例、函数、或函数数组
  validate: z.object({ email: z.string().email() }),
  // validators map 仍然作为"字段级 quick rules"存在
  validators: { customField: (v) => ... },
})
```

- 优点：Standard Schema 正在成为社区事实标准
- 缺点：Standard Schema 规范版本 1 只定义了 `validate`，没有定义"组合"、"条件"等
- 缺点：现有用户依赖字符串 `validate` 函数签名

**我的推荐：选项 B** — 在保持向后兼容的同时引入 `pipeline()` 作为组合器。原因：

1. 不影响现有代码（93 个使用 `createFormStore` 的文件不需要修改）
2. `pipeline()` 可以在 core 中作为一个纯函数实现，0 框架依赖
3. 未来 Standard Schema 规范升级（组合语法）后，可以适配为 `pipeline()` 的一个接口变形

### 3.3 `@iris-ui/native-bridge` 的接口设计

```
interface IrisNativeBridge {
  // ── 只读标识 ──
  readonly platform: 'electron' | 'tauri' | 'wails' | 'web'
  readonly framework: 'react' | 'vue' | 'solid' | 'svelte'
  readonly version: string           // 壳的版本

  // ── 必需能力 ──
  saveFile(payload: FileSavePayload): Promise<FileSaveResult>
  writeClipboard(text: string): Promise<boolean>

  // ── 可选能力（缺失 == resolve('not supported')） ──
  readClipboard?(): Promise<string | null>
  getPlatformInfo?(): Promise<PlatformInfo>

  // ── 壳层能力宣告（运行时自描述） ──
  readonly capabilities: ReadonlySet<
    'native-dialog' | 'clipboard' | 'native-menu' | 'system-notification'
  >
}
```

```
// 每个壳打包 native-bridge 时，强制实现接口并运行一个冒烟测试：
const electronBridge: IrisNativeBridge = {
  platform: 'electron',
  framework: detectFramework(),
  version: '1.0.0',
  saveFile: async (payload) => ipcRenderer.invoke('iris:save-file', payload),
  writeClipboard: async (text) => ipcRenderer.invoke('iris:write-clipboard', text),
  capabilities: new Set(['native-dialog', 'clipboard', 'native-menu']),
}
verifyNativeBridge(electronBridge) // 编译时检查 + 运行时冒烟
```

### 3.4 向后兼容性策略

对于五大方向的所有建议变更，核心原则：

1. **加法不做减法**：`validators` map + `validate` 函数保持可用；`EngineLifecycle` meta 是可选声明
2. **新接口独立发布**：`@iris-ui/native-bridge` 作为新包发布，版本 0.x 期间允许接口调整
3. **ESLint 规则可配置**：`correct-framework-import` 规则默认 warn（可升级为 error）
4. **引擎生命周期 meta**：`defineEngine()` 包装器与 `create*()` 函数接受不同类型——meta 通过函数重载注入，非破坏性

---

## 4. 技术选型

### 4.1 是否引入新框架/依赖？

| 方向                         | 技术需求           | 自建 vs 采购     | 建议                                                                                       |
| ---------------------------- | ------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| `EngineLifecycle`            | 引擎 meta 声明系统 | **完全自建**     | 这是纯类型级别的协议，不需要运行时依赖。在 `@iris-ui/core` 中新增 `engine-lifecycle.ts`    |
| `@iris-ui/native-bridge`     | 平台抽象层         | **自建**         | 对外的类型定义 + 每个壳参考实现。零外部依赖                                                |
| 跨壳集成测试                 | Playwright         | **采购**         | Playwright 已经满足跨框架测试需求。原生壳（Electron/Tauri/Wails）各自有自己的 test harness |
| 组件构成分析                 | 打包工具 metafile  | **利用现有工具** | esbuild 的 metafile 已经能输出"每个入口点的依赖树"。`@iris-ui/manifest` 包扩展这个功能     |
| 运行时框架检测（方向三增强） | 无                 | **不需要**       | TypeScript 类型标记方案完全在类型层面，无运行时开销                                        |

**核心结论：不需要引入新的运行时框架或第三方依赖。所有扩展都在现有技术栈内完成。**

### 4.2 第三方依赖评估标准

当前项目的依赖评估实践（从 package.json 和 tsup config 观察）：

| 标准           | 说明                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| 框架依赖范围   | React 等 peer dependency 范围宽松（不锁定主版本）                                     |
| 重型依赖外部化 | CodeMirror 6 在 plugin-editor 中 externalized，不打包进 Iris 核心                     |
| 运行时依赖极小 | `@iris-ui/core` 零运行时依赖；`@floating-ui/dom` 仅用于浮层组件（IrisPopoverContent） |

建议增加一条评估标准：

**门禁验证级库（Gate-Level Dependency）**：当一个新依赖对 size budget、SSR 安全性、跨框架一致性有重大影响时——必须在 `docs/requirements/` 中进行架构评估。这不是拖延决策，而是确保"加一个依赖"这件事和"加一个组件"一样有可见性：

```
评估项目：
  1. 这个依赖解决了什么架构问题？
  2. 如果不加，在现有技术栈内能否实现？
  3. 加依赖带来的 tree-shaking 收益是否大于其打包成本？
  4. 这个依赖的 SSR 兼容性如何？
  5. 所有四个框架都支持同样的用法吗？
```

### 4.3 ESLint 规则的自建决策

方向三建议增加 ESLint 规则——这本质上是一个**零运行时基础设施决策**。ESLint 规则只影响开发阶段，不影响生产 bundle。所以"自建"是毫无疑问的：

```
// packages/eslint-plugin/rules/correct-framework-import.ts
// 输入：当前文件路径 + 文件中所有的 import 声明
// 逻辑：
//   1. 从文件路径推断框架（tsconfig.json 的 jsxImportSource）
//   2. 扫描 import 声明匹配 @iris-ui/plugin-*/{react,vue,solid,svelte}
//   3. 如果子路径和框架不匹配 → 报错
// 输出：ESLint 错误消息
```

核心挑战不是"是否能做"，而是**准确推断当前文件的框架归属**。在一个 monorepo 内有四个框架的源文件共存（`packages/plugin-editor/src/{react,vue,solid,svelte}/`），`jsxImportSource` 可能在不同目录层级不同。规则需要理解 project 的 tsconfig 层级。

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级 | 方向                           | 投入         | 核心价值                      | 风险等级                     |
| ------ | ------------------------------ | ------------ | ----------------------------- | ---------------------------- |
| **P0** | 方向一（Shell 状态管理）       | 中 (2-3周)   | SSR 合规是硬性 bug，不可妥协  | 低（模式清晰，改造路径明确） |
| **P0** | 方向二（原生桥协议）           | 大 (3-5周)   | 旗舰特性保护，未来壳扩展经济  | 中（三壳行为对齐需要协调）   |
| **P1** | 方向四（验证管道组合）         | 中 (2-3周)   | 每日开发者痛点，表单是核心 UX | 低（向后兼容的加法）         |
| **P1** | 跨壳集成测试（新方向 2-C）     | 大 (3-4周)   | 防止四壳 + 三原生壳行为偏移   | 中（CI 基础设施成本）        |
| **P2** | 方向三（插件框架导入验证）     | 小 (0.5-1周) | DX 保护，插件生态增长信号     | 低                           |
| **P2** | 组件构成分析（新方向 2-B）     | 中 (2-3周)   | 架构透明度，budget 决策数据化 | 低                           |
| **P3** | 方向五（插件 Size Budget）     | 很小 (0.5周) | 维护纪律，不涉及运行时代码    | 低                           |
| **P3** | 引擎生命周期协议（新方向 2-A） | 大 (4-6周)   | 长期架构净化                  | 中（需要全量引擎 meta 声明） |

### 5.2 阶段划分

**阶段一：「SSR + 原生桥」（2026-07 中 → 08 初）**

- P0: 方向一 `createShellState` 统一工厂 + 4 壳改造
- P0: `@iris-ui/native-bridge` v0.1（类型定义 + React mock + Electron 参考实现）
- P1: 跨壳集成测试套件 L1（Playwright 覆盖四个 Web 壳）

**阶段二：「表单 + 门禁」（2026-08 → 09）**

- P1: 方向四 `pipeline()` 组合器（验证管道 API）
- P2: 方向三 ESLint 规则 `correct-framework-import`
- P3: 方向五 扩展 `check-size.mjs` 加入插件包 Budget
- P2: 组件构成分析初版（`@iris-ui/manifest` 扩展）

**阶段三：「引擎协议 + 全壳测试」（2026-09 → 10）**

- P3: `EngineLifecycle` 协议设计 + core 引擎 meta 声明迁移
- P3: 适配器层的 `IrisEngineProvider` 实施
- P1: 原生壳集成测试 L2（Electron + Tauri + Wails nightly runner）
- P3: `@iris-ui/native-bridge` v0.2（Tauri + Wails 参考实现）

### 5.3 风险缓解

| 风险                                                         | 概率  | 影响                   | 缓解策略                                                                                                                                           |
| ------------------------------------------------------------ | ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方向一改造破坏现有 Desktop OS 壳运行                         | 低-中 | 高（应用层破坏）       | 分步迁移：先添加 `createShellState` 工厂，新旧模式共存 1 个 sprint，再移除旧实现                                                                   |
| 原生桥协议方向二的 Tauri/Wails 壳维护者不同意接口            | 中    | 中（协议需要协商）     | 协议初始 v0.1 定义为"建议性"（非强制），每个壳逐步适配。`verifyNativeBridge()` 冒烟测试提供迁移可见性                                              |
| 验证管道 `pipeline()` 组合器与现有 `validators` map 语义冲突 | 低    | 中（需要文档澄清）     | 文档明确："如果同时使用 `validators` + `validate: pipeline(...)`，validators 先运行，pipeline 后运行——与现有 `validators` + `validate` 的行为一致" |
| CI 中安装原生壳依赖（Rust/Go）导致构建时间暴增               | 高    | 中                     | 使用分层策略（L1 纯 Web 壳在每次 PR 中执行，L2/L3 原生壳 nightly 执行 + 发布前 mandatory gate）。可以用 GitHub Actions matrix strategy 控制        |
| `EngineLifecycle` 重构范围过大（20+ 引擎需要声明 meta）      | 中    | 高（需大量 core 改动） | 采用"adoption-driven"策略：仅当前使用 Context 的引擎（Desktop OS 壳的 5 个引擎）先迁移，其余引擎在新增功能时逐步添加 meta。非一次性全量改造        |

### 5.4 关键里程碑

```
M1（2周后）：  createShellState 工厂 + React 壳改造完成
                所有 Desktop OS 壳通过更新后的 check-desktop-parity.mjs
                @iris-ui/native-bridge v0.1 发布（类型 + mock + Electron 参考实现）

M2（5周后）：  跨壳 Playwright L1 套件运行
                pipeline() 组合器 + 验证管道文档
                ESLint correct-framework-import 规则可用

M3（8周后）：  check-size.mjs 覆盖 65 个插件入口
                @iris-ui/manifest 的组件构成分析可用
                原生壳 Tauri/Wails 参考实现发布

M4（12周后）： EngineLifecycle 协议设计定稿
                core 引擎逐步添加 meta（重点：高频使用的 createSelectionModel /
                createExpansion / createFormStore / createResourceController）
                原生壳集成测试 L2 nightly pipeline 运行
```

---

## 总结

Iris UI 的架构核心是健康的——框架适配器模式 + Token 系统 + 插件契约都是经过验证的正确决策。五大方向揭示的问题本质上不是"架构错了"，而是**架构同步没有跟上项目增长的速度**：

- 当组件从 ~50 增长到 149 时，Shell 状态管理分叉出现
- 当原生壳从 1 个扩展到 3 个时，无共享协议的维护成本显现
- 当插件从 5 个增长到 13 个时，代码 65 个框架子路径的门禁缺失变成可感知的风险

这些是**增长疼痛（Growing Pains）**，不是**设计错误**。处理方式不是推翻现有架构重新设计，而是为现有的正确模式补充以下基础设施：

1. **生命周期透明度**（`EngineLifecycle`）——让引擎的 SSR/隔离/清理属性显式化
2. **跨壳测试覆盖**（集成测试套件）——让旗舰特性的行为一致性被自动验证
3. **插件生态的工具门禁**（ESLint + Size Budget）——让开发者的自律有自动化兜底
4. **表单管道组合**（`pipeline()`）——在保持 backward compat 的前提下解锁更复杂的表单场景

所有建议的变更都是**加法式的、向后兼容的、可增量实施的**。没有一个方向需要"砍掉重来"。这正是健康架构的标志——扩展方向是对现有设计的补充，而不是替代。
