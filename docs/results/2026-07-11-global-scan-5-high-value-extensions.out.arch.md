# 架构分析报告：Iris UI 高价值扩展方向

## 1. 架构评估

### 1.1 当前架构的优势

Iris UI 的架构在 **层间解耦** 和 **框架中立** 两个维度达到了极高水平，这在整个开源 UI 生态中属于第一梯队。

| 优势           | 体现                                         | 技术杠杆                                    |
| -------------- | -------------------------------------------- | ------------------------------------------- |
| **逻辑下沉**   | core 零框架依赖，控制器/引擎/纯材料三层分离  | 四框架共享一套逻辑 → 1 份测试覆盖 4 个产物  |
| **插件契约**   | `createPlugin` 的注册式 API 避免了入侵式扩展 | 插件与宿主解耦，可独立版本化、摇树          |
| **Token 杠杆** | 30 token 替代 800 行 CSS，93%+ 表达力压缩    | 皮肤系统 = 配置驱动，无运行时样式覆盖成本   |
| **包边界清晰** | Layer 0–4 的严格分层 + `exports` 子路径      | tree-shaking 友好，按需加载的精度达到组件级 |

### 1.2 关键局限性

分析文档揭示的五个方向，实际上暴露了当前架构的三类结构性问题：

**① "框架无关" 的理想化边界存在渗漏**

`touchAction: 'none'` 硬编码在每个组件的 CSS 中（而非 core 的控制参数）、`ToastViewport` 单独实现 `pan-y`——这违反了 AGENTS.md "逻辑下沉 core" 的铁律。**手势策略是 A 类（核心身份）行为，却散落在适配器代码中。**

**② 多实例协调的架构真空**

当前架构假设每个 `IrisProvider` 实例是自治的。跨标签页同步、窗口管理器、多 Shell 实例之间的状态协调——这些场景在架构上**没有预留扩展点**。`BroadcastChannel` 的零匹配并非"不需要"，而是架构尚浅。

**③ 契约检查仅存在于运行时、单组件粒度**

Context 守卫只检查"缺失祖先"（存在性验证），不检查"组合非法"（层次验证）。这意味着 `IrisProvider` 的 plugin registry、theme store、i18n registry 之间缺乏一个 **静态的组合验证层**。

### 1.3 架构债务与技术债

| 债务类型         | 描述                                                                       | 严重程度               |
| ---------------- | -------------------------------------------------------------------------- | ---------------------- |
| **手势策略散落** | 组件各自声明 `touchAction`，无统一层合并/覆盖                              | 中                     |
| **壳复制 ×4**    | `remoteApp.ts` 100% 相同 ×4，这是 AGENTS.md 定义的"适配器写业务逻辑"的违反 | 高                     |
| **SSR 契约隐性** | 插件缺乏 `'use client'` 声明，SSR 安全依赖于约定而非编译时检查             | 中                     |
| **组合规则隐式** | 哪些组件可以嵌套、哪些不能，由文档而非类型系统或 ESLint 规则承载           | 低（但随规模指数恶化） |

---

## 2. 扩展方向

### 2.1 方向一：跨标签页状态同步层（P1）

#### 为什么需要

Iris UI 的 token/theme/skin 系统已经实现了多框架、多实例的状态一致性。但"多实例"仅限同一标签页（通过 React Context / Vue provide）。当用户打开多个标签页：

- 皮肤切换只作用于当前标签页 → FOUC 防闪脚本只保护单个标签页
- 国际化切换不同步
- 认证状态（admin shell 的 login 状态）在各标签页各自为政

对于 CMS demo 和 admin shell 场景，这是影响生产决策的关键 gap。

#### 核心挑战

1. **数据一致性 vs 并发冲突**：`BroadcastChannel` 是最终一致模型。主题/皮肤这类"覆盖式"状态没问题（最后一次写入获胜），但表单数据/选中状态需要更严谨的策略。
2. **引擎层的侵入面**：`createSkinEngine`、`createThemeStore`、`createAdminShell` 三个控制器需要接收一个可选的 `syncAdapter`，但它们的签名已经稳定。
3. **订阅生命周期**：跨标签页的 `unsubscribe` 需要处理标签页关闭事件（`pagehide`/`beforeunload`），这在 SPA 路由切换时容易误触发。

#### 架构变更

```
core/src/sync/
├── interface.ts        # SyncAdapter 接口
├── broadcast.ts        # BroadcastChannel 实现
├── shared-worker.ts    # SharedWorker 实现（可选）
├── tabs.ts             # 标签页生命周期管理
└── index.ts
```

**核心接口设计**：

```ts
interface SyncAdapter {
  name: string
  subscribe(channel: string, cb: (data: unknown) => void): () => void
  publish(channel: string, data: unknown): void
  // 可选：获取当前所有活跃实例的最新值（SharedWorker 支持）
  getLatest?<T>(channel: string): T | undefined
}
```

**关键设计决策**：以 **channel** 为单位，而非以 store 为单位。Theme、I18n、Auth 各自一个 channel，互不干扰。

#### 对现有系统的影响

- 零侵入：`syncAdapter` 只在 `IrisProvider` 级别注入，不修改已有控制器签名
- 对 `createSkinEngine` 等：通过 `options.sync` 回调透传，非破坏性
- 对插件：`reg.registerSyncChannel(name)` 可选注册

#### 交叉效应

与方向二（壳共享 SDK）结合：窗口管理器可以自然选择主窗口的 sync channel，实现"标签页 A 打开的对话框，标签页 B 可见"的效果。

---

### 2.2 方向二：壳（Shell）共享内核（P1）

#### 为什么需要

四个框架各有一个 `src/` 目录下 `remoteApp.ts` **100% 相同的 6243–6921 行代码**。这是 AGENTS.md "适配器写业务逻辑"的反面教材。核心问题：

- 四个框架的 admin shell 代码无法一次性修复 bug
- 新增框架需复制粘贴并手动同步
- shell-specific 逻辑（路由守卫、权限矩阵、资源 CRUD 泛型）不应出现在适配器层

#### 核心挑战

1. **框架桥接的泛型参数**：`createResourceController` 已经下沉到了 core，但 shell 的路由表、导航菜单、标签页需要框架具体的 `ComponentType`。下沉需要将泛型边界对齐到框架无关的 `Record<string, unknown>`。
2. **路由抽象**：四个框架使用不同的路由库（React Router / Vue Router / Solid Router / SvelteKit）。需要定义一套框架无关的 "路由描述 + 守卫契约"。
3. **迁移分批**：6243–6921 行不可能一次性迁移。需要确定迁移顺序：先提取"纯逻辑"（权限/守卫/分页逻辑），再提取"路由描述"，最后提取"布局组合"。

#### 架构变更

```
core/src/shell/
├── types.ts              # 路由描述、菜单项、Tab 页签等接口
├── guards.ts             # 路由守卫逻辑（纯函数）
├── resource-table.ts     # CRUD 表格控制器（已存在，增强）
├── createShellStore.ts   # Shell 状态 store（路由历史/权限/用户）
└── index.ts
```

**关键接口设计**：

```ts
// 框架无关的路由描述
interface ShellRoute {
  path: string
  title: string | ((t: I18n) => string)
  icon?: string // icon token name
  children?: ShellRoute[]
  guard?: (auth: AuthState) => boolean | Promise<boolean>
  // 组件引用框架保留，由适配器层映射
  // 不包含 component 字段
}
```

**迁移策略**：先合并 `remoteApp.ts` 和 `catalog.ts`（~90% 一致），再合 `depth.ts`（~95% 一致）。使用 codegen 生成四个适配器层的"存根"（仅 import + 框架桥接）。

#### 对现有系统的影响

- **短期**：零影响，新包 `@iris-ui/shell` 作为 B 类（附加）包，按需引入
- **中期**：cms demos 切换到新 `ShellProvider`，旧 shell 组件标记 `@deprecated`
- **长期**：四个 `apps/cms-*` 共享一个 shell 实现，差异仅在于框架 import

---

### 2.3 方向三：统一手势系统（P2 → P1 考虑）

#### 为什么需要

当前 `touchAction: 'none'` 散落在每个组件的 CSS 中——每个组件的开发者需要自己"想起"加这行。这不仅违反 DRY，而且：

- 影响 SSR：CSS 中有 `touchAction` 没问题，但意味着组件 CSS 必须包含触摸控制，无法按平台选择性加载
- 影响自定义：用户无法全局启用/禁用手势（如 "让 Table 支持水平滑动" 需要改组件代码）
- 无法叠加：AGENTS.md 描述 Behaviors "可嵌套"，但手势行为没有 Behavior 实现

#### 核心挑战

1. **平台检测 SSR 安全**：`ontouchstart` 检测在 SSR 下不可用。需要设计一个 `GestureEngine` 在 hydration 后激活，而非首次 render。
2. **手势优先级和冲突解决**：水平滑动是 "Table 列滚动" 还是 "导航切换标签页"？需要一个类似 pointer-events 的 `gesture-events` 优先级系统。
3. **与现有 touchAction 的兼容**：`ToastViewport` 的 `pan-y` 是一个独立实现，迁移需要保持行为一致。

#### 架构变更

```
core/src/gesture/
├── types.ts              # Pan/Swipe/Pinch/Rotate/Tap/Press 事件定义
├── engine.ts             # GestureEngine（识别 + 分发）
├── priority.ts           # 手势优先级与冲突解决
├── behaviors.ts          # 框架无关的 Behavior 工厂
└── index.ts
```

**关键设计**：

手势引擎作为 **插件扩展**，不是核心：

```ts
const gesturePlugin = createPlugin({
  name: 'gesture',
  install(reg) {
    reg.registerBehavior('pan', createPanBehavior)
    reg.registerBehavior('swipe', createSwipeBehavior)
  },
})
```

**Behaviors 的方式**：

```tsx
// 使用方式（框架适配器层）
<IrisPan onPan={handlePan}>
  <IrisTable />
</IrisPan>
```

#### 对现有系统的影响

- **对组件**：`touchAction: 'none'` 从组件 CSS 中移除，改为在 `IrisProvider` 级别注入（或通过 `GestureEngine` 的 CSS 策略层）
- **对测试**：需要 mock 触摸事件序列（pointerdown → pointermove → pointerup），对当前无触摸测试的代码库是新增依赖
- **对 core 包体积**：手势系统应作为独立 entry（`@iris-ui/core/gesture`），不影响 core 的初始加载

---

### 2.4 方向四：插件 SSR 协议（P1）

#### 为什么需要

当前插件零 SSR 支持意味着任何使用插件的应用都无法进行 SSR。对于 VitePress 文档站和生产级 CMS，这是阻塞性 gap。

关键缺失：

1. 插件注册：`reg.registerTokens` 在 SSR 端无意义（CSS 变量），但 `reg.registerMessages` 必须工作
2. 框架适配层：React 插件需要 `'use client'`，但 Vue/Solid/Svelte 不需要——当前统一缺失
3. 插件 store：SSR 环境无法使用 `usePluginStore`，因为 store 可能在服务端未初始化

#### 核心挑战

1. **声明式 vs 命令式**：`'use client'` 是编译时声明，插件是运行时注册。两者需要桥接——一个 `ssr.json` manifest 或者编译时标记。
2. **Hydration mismatch**：如果插件在服务端不执行，客户端上动态注册 token 和 i18n 消息会导致 hydration 不匹配。
3. **框架差异**：React 的 `'use client'` 是文件级，Vue 的 SSR 安全通过 `onMounted` 保证，Svelte 通过 `browser` 变量。协议需要框架感知。

#### 架构变更

**接口层（~50 行）**：

```ts
// core/src/plugin/ssr.ts
interface PluginSSRManifest {
  name: string
  // SSR Safe 声明
  ssr: 'safe' | 'client-only' | 'hydrate-aware'
  // 需要在 SSR 时预初始化的 store
  ssrStores?: string[]
  // 需要在 SSR 时预注入的 i18n messages
  ssrMessages?: Record<string, Record<string, string>>
}
```

**适配器层变更（~100 行）**：

每个框架的 `IrisProvider` 增加 `ssrMode` 检测和 fallback 编排：

```ts
// 消费侧
<PluginSSRBoundary fallback={<LoadingSkeleton />}>
  <IrisProvider plugins={[editorPlugin]} ssrMode="safe">
    <App />
  </IrisProvider>
</PluginSSRBoundary>
```

#### 对现有系统的影响

- 无破坏性变化：`IrisProvider` 的 `ssrMode` 默认 `undefined`（同当前行为）
- 对插件作者：新增 `ssr` 字段声明，不强制
- 对测试：新增 SSR + 插件的集成测试套件

---

### 2.5 方向五：组合安全治理（P1）

#### 为什么需要

AGENTS.md 明确声明 Iris UI 是 "AI 原生" 的。AI 生成 React/Vue/Solid/Svelte 组件组合时，最常见的错误就是**非法嵌套**：

- `Dialog` 内嵌 `Popover` → 焦点管理冲突
- `Menu` 内嵌 `Dialog` → z-index 层级混乱
- 两个 `DragBehavior` 叠加 → 拖拽冲突

当前系统只在运行时检查 "缺失祖先"（`useBodyScrollLock` 的 context 守卫），不做组合层次验证。AI 生成代码的上下文里，compile-time 错误远优于 runtime 错误。

#### 核心挑战

1. **类型系统表达力不足**：TypeScript 不支持 "这个组件不能在那个组件内部" 的层次约束（无需声明式代数类型）。需要 ESLint 规则或 codegen。
2. **框架差异**：React 的 children 是 props，Vue 的 slots，Solid 的 children，Svelte 的 snippets。验证逻辑必须框架无关。
3. **组合规则需要维护**：随着组件增加，非法组合的规则也会增加。需要规则"就近维护"（组件附近）而非全局列表。

#### 架构变更

```
tools/composition-guard/
├── rules/                 # 组合规则（每个组件一个文件）
│   ├── dialog.ts          # Dialog 不能作为 Popover/Drawer 的子元素
│   ├── popover.ts
│   └── ...
├── framework-adapters/    # 各框架的验证适配
│   ├── react.ts           # jsx-ast 遍历
│   ├── vue.ts             # template-ast 遍历
│   └── ...
├── core/
│   └── guard.ts           # 运行时守卫（轻量，仅 warning）
└── eslint-plugin/         # ESLint 规则包
    └── rules/
        ├── no-illegal-composition.ts
        └── no-missing-ancestor.ts
```

**组合规则的数据驱动形式**：

```ts
// 在组件目录中（如 packages/react/src/dialog/）：
export const compositionRules = {
  illegalChildren: ['Popover', 'Drawer', 'Menu'],
  requiredAncestors: ['IrisProvider'],
  conflictingBehaviors: ['DragBehavior'], // Dialog 本身可拖动？
}
```

#### 对现有系统的影响

- 对组件：新增 `compositionRules` 导出，不影响运行时包体积（tree-shake 友好）
- 对构建：ESLint 规则可选，不影响 `pnpm build`
- 对 manifest：新增字段后 `pnpm gen:manifest` 自动生成组合约束表，AI 可消费

---

## 3. 接口设计建议

### 3.1 通用原则

| 原则                       | 说明                                                | 应用场景                                                 |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **接口下沉，实现上浮**     | 接口定义在 core，实现可分层                         | SyncAdapter 接口在 core，BroadcastChannel 实现可选       |
| **可选参数，非侵入式**     | 所有扩展点以 `options` 对象透传，不修改核心函数签名 | `createSkinEngine({ sync })` vs `createSkinEngine(sync)` |
| **运行时兼容，编译时严格** | 运行时降级（无报错），类型系统提供指导              | `ssrMode` 默认 `undefined`，类型提示可选                 |
| **注册优先于配置**         | 扩展点声明式注册，非命令式调用                      | `reg.registerSyncChannel` vs `window.BroadcastChannel`   |

### 3.2 是否需要新抽象层

| 抽象层               | 是否需要    | 理由                                                                                        |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| **SyncAdapter**      | ✅ 是       | 支撑方向一 + 方向二的交叉效应；`BroadcastChannel`/`SharedWorker`/`postMessage` 间需统一接口 |
| **GestureEngine**    | ⚠️ 可插拔   | 不需要成为核心层，作为插件 + Behavior 的组合即可；核心只提供 `GestureEvent` 类型            |
| **ShellRoute**       | ✅ 是       | 解决 `remoteApp.ts ×4` 重复；框架无关的路由表是复用前提                                     |
| **SSRManifest**      | ⚠️ 声明式   | 只需在 `createPlugin` 的返回类型中增加一个字段，不需要新抽象层                              |
| **CompositionGuard** | ✅ 独立工具 | 不进入 `@iris-ui/core`，作为 `@iris-ui/composition-guard` 独立包                            |

### 3.3 向后兼容策略

1. **所有扩展以可选导入为主**：`@iris-ui/core/sync`、`@iris-ui/core/gesture`、`@iris-ui/composition-guard`
2. **破坏性变化集中在大版本**：方向二的 shell 下沉（移除四个重复文件）推迟到 v2
3. **deprecation 周期**：旧 shell 组件标记 `@deprecated` → 3 个月后移除 → 在新版本文档中说明迁移路径

---

## 4. 技术选型

### 4.1 方向一：跨标签页同步

| 选项               | 优点                       | 缺点                                 | 推荐        |
| ------------------ | -------------------------- | ------------------------------------ | ----------- |
| `BroadcastChannel` | 原生 API，零依赖，适合同源 | 不支持跨域；标签页关闭事件需手动处理 | ✅ P0 实现  |
| `SharedWorker`     | 持久连接，中间状态管理     | 额外线程；调试困难；有浏览器不兼容   | ⚠️ 可选增强 |
| `ServiceWorker`    | 离线支持 + 跨标签页消息    | 生命周期复杂；不适合短连接通信       | ❌ 过度设计 |

**推荐**：P0 用 `BroadcastChannel`（浏览器兼容 ~96%），P1 提供 `SharedWorker` 作为增强。接口 `SyncAdapter` 允许用户自定义实现。

### 4.2 方向三：手势系统

| 选项                        | 优点                                          | 缺点                                       | 推荐                    |
| --------------------------- | --------------------------------------------- | ------------------------------------------ | ----------------------- |
| 自研手势引擎                | 轻量（~2KB minzip）；与 iris 架构对齐；可树摇 | 需要维护手势算法；调试工具不成熟           | ⚠️ 可行，但优先级低     |
| 集成 `@use-gesture/vanilla` | 成熟（~5KB）；社区已验证；框架无关            | 外部依赖，升级节奏不可控；枚举手势不如按需 | ✅ 推荐（vanilla 版本） |
| 集成 `Hammer.js`            | 成熟；跨浏览器测试充分                        | 已不再维护；API 过时                       | ❌                      |

**推荐**：`@use-gesture/vanilla` 作为底层引擎，Iris UI 封装 `GestureEngine` 作为薄桥层。这样：

- 手势识别由社区维护
- Iris UI 只负责框架桥接 + 优先级/冲突解决
- 用户可以自行替换引擎（通过 `GestureEngine.setDriver()`）

### 4.3 方向五：组合安全

| 选项                | 优点                              | 缺点                                        | 推荐      |
| ------------------- | --------------------------------- | ------------------------------------------- | --------- |
| ESLint 规则         | compile-time 反馈；开发者最易接受 | 需要组件导出元数据；需要每个框架的 AST 解析 | ✅ P0     |
| 运行时 warning      | 测试可见；无需工具链              | 用户看不到（生产环境被忽略）；晚反馈        | ⚠️ 辅助   |
| TypeScript 类型体操 | 零运行时成本                      | 难以表达"禁止嵌套"；不同框架类型不兼容      | ❌ 不可行 |

**推荐**：ESLint 规则为主（`@iris-ui/eslint-plugin`），运行时 warning 为辅（`process.env.NODE_ENV === 'development'`）。

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级 | 方向                  | 投入（人·天） | 价值                                   | 依赖                   |
| ------ | --------------------- | ------------- | -------------------------------------- | ---------------------- |
| **P0** | 方向四：插件 SSR 协议 | 5-7 天        | 解锁 SSR 生产场景；AI 原生体验关键能力 | 无                     |
| **P0** | 方向五：组合安全治理  | 8-10 天       | 与 AGENTS.md "AI 原生" 定位直接绑定    | 方向四的 manifest 扩展 |
| **P1** | 方向二：壳共享内核    | 15-20 天      | 消除 ~6000×4 行重复；降低框架扩增成本  | 无                     |
| **P1** | 方向一：跨标签页同步  | 10-12 天      | 多标签页一致性；admin shell 生产化     | 方向二的 shell 接口    |
| **P2** | 方向三：统一手势系统  | 12-15 天      | 移动端体验增强                         | 无                     |

### 5.2 阶段划分

```
Phase 1（2 周）：零破坏性基础设施
├── @iris-ui/core: PluginSSRManifest 接口 + ssrMode 支持
├── @iris-ui/eslint-plugin: composition-rules 基础规则
├── docs: SSR 插件开发指南 + 组合规则贡献指南
└── 测试: SSR+插件集成测试 + 组合规则测试

Phase 2（3 周）：核心消重
├── @iris-ui/shell: 框架无关的 shell 内核（深度优先）
│   ├── ShellRoute 类型系统
│   ├── createShellStore（路由历史/权限/用户）
│   └── guards.ts（路由守卫逻辑）
├── @iris-ui/core/sync: SyncAdapter 接口 + BroadcastChannel 实现
└── 迁移: react/vue shell 接入新内核，solid/svelte 继续使用旧版本

Phase 3（2 周）：对齐 + 增强
├── solid/svelte shell 迁移到新内核
├── @iris-ui/core/gesture: GestureEngine + @use-gesture/vanilla 桥接
├── @iris-ui/plugin-gesture（作为独立插件）
└── 文档 + 示例完善

Phase 4（1 周）：收尾 + 发布
├── 删除旧 shell 组件（四个框架 `remoteApp.ts`）
├── 端到端测试（多标签页同步 + shell + 手势组合场景）
├── pnpm gen:manifest 更新
└── changeset 发布（minor bump）
```

### 5.3 风险点和缓解策略

| 风险                                     | 影响             | 可能性 | 缓解                                               |
| ---------------------------------------- | ---------------- | ------ | -------------------------------------------------- |
| Shell 下沉遇到框架泛型不兼容             | 高（沉不下去）   | 中     | 先用 `unknown` + 类型守卫，逐步收窄                |
| BroadcastChannel 遇到企业防火墙/隐私模式 | 中（降级不可用） | 低     | SyncAdapter 设计为可选，用户可传入空实现           |
| 手势引擎 + Vue/Solid 的响应式桥接复杂度  | 中（工期延长）   | 中     | 采用 `@use-gesture/vanilla` 而非框架专属版本       |
| ESLint 规则覆盖不全面（新组件漏注册）    | 低（安全盲点）   | 中     | 运行时 warning 兜底 + `pnpm gen:manifest` 自动扫描 |
| SSR 协议与现有插件不兼容                 | 中（插件需更新） | 高     | `ssr: 'client-only'` 作为默认值，零迁移成本        |

### 5.4 关键里程碑

| 里程碑 | 交付物                                            | 时间         |
| ------ | ------------------------------------------------- | ------------ |
| M1     | SSR 插件协议可用 + 3 个内置插件标记 SSR 安全      | Phase 1 结束 |
| M2     | `@iris-ui/eslint-plugin` 覆盖 Top 20 组件组合规则 | Phase 1 结束 |
| M3     | React/Vue shell 通过新内核构建                    | Phase 2 结束 |
| M4     | 多标签页同步 Demo（CMS 应用）                     | Phase 3 结束 |
| M5     | 手势系统 + 壳共享完全落地，旧代码删除             | Phase 4 结束 |

---

## 6. 总结

### 架构决策矩阵

| 决策             | 选择                                            | 备选                                      |
| ---------------- | ----------------------------------------------- | ----------------------------------------- |
| 跨标签页同步抽象 | `SyncAdapter` 接口 + `BroadcastChannel` 实现    | 直接集成 `BroadcastChannel`（耦合度更高） |
| Shell 下沉粒度   | 纯逻辑（路由/权限/store）下沉，组件渲染留适配器 | 全量下沉（需要框架感知的虚拟 DOM）        |
| 手势系统         | 插件化，`@use-gesture/vanilla` 作为底层         | 自研（维护成本高）                        |
| SSR 协议         | `ssr` manifest 字段 + `ssrMode` prop            | 纯约定（不可检查）                        |
| 组合安全         | ESLint 规则 + 运行时 warning                    | 纯运行时（反馈延迟）                      |

### 核心建议

1. **方向四和方向五作为 P0 立即启动**——两者的交叉效应最强（SSR 协议中的 `ssr` 字段可以被组合规则读取，AI 脚手架可以根据 manifest 同时校验 SSR 安全和组合合法性），且与 Iris UI 的 "AI 原生" 定位直接挂钩。

2. **方向二不下沉完所有代码前，不要新增框架**——每新增一个框架，6243–6921 行的复制成本将再次翻倍。

3. **方向一的 `SyncAdapter` 接口设计要预留 SharedWorker 扩展空间**，避免以后需要破坏性修改。

4. **所有五个方向共享同一个核心原则**：**"接口不下沉到 core 就不是基础设施，下沉到 core 但不提供默认实现就是半成品"**——这是评估每个方向完成度的门控标准。
