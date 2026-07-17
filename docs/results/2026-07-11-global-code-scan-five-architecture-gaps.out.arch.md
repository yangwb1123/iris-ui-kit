# 架构分析：Iris UI 五方向扩展审核后评估

## 1. 架构评估

### 优势

Iris UI 的整体架构设计在同类 UI 基础设施中展现了几个罕见的成熟特质：

**Layer 0–4 分层 + 插件正交 + Behavior 正交 = 三维正交分解。** 这是架构上的核心优势。绝大多数 UI 库只做二维（组件 + 主题），Iris 把「逻辑在哪里跑」「主题在哪层生效」「插件加到哪个纬度」都做了清晰的分界。Core 层零框架依赖 + 适配器薄桥 + Token 驱动，这三个决策叠加使「四框架对齐」成为可能而非口号。

**A/B/C 下沉分类是实操性极强的模型。** 它不是纯理论分层，而是能在代码评审时直接判别的铁律。`grep "from 'react'" packages/core/src 必须为空` 这种可执行的规则，比文档上的分层图更有约束力。

**插件系统的正交设计（只注册 tokens/messages/stores，不做 `registerComponent`）是深思熟虑的。** 避免了动态组件名破坏 tree-shaking、类型推导、manifest 扫描三大痛点。让插件包采用异构三工具链构建（tsup + svelte-package）也是务实选择——插件是框架无关逻辑 + 框架专属渲染，工具链自然需要分立。

### 局限性

**核心矛盾：插件系统的「契约层」与「实际渲染层」之间的张力。**

当前的 `createPlugin` 契约只注册 tokens/messages/stores，但绝大多数有意义的插件（editor、pro-table、notifications、kanban）都需要渲染组件。这意味着插件实际上**拆分了两部分**：

- `plugin-X/core` — 框架无关逻辑（纯材料 / 控制器 / store）
- `plugin-X/{react,vue,solid,svelte}` — 框架适配器 + 渲染组件

这在代码组织上没问题，但在**版本契约、交叉依赖、测试覆盖**上暴露出缺口：

- 一个插件的 core 可能依赖另一个插件的 store（例如 pro-table 依赖 editor），但版本约束没有工具化
- 插件的测试各自为战，没有统一的质量门（AGENTS.md 提到「测试工具/交叉依赖/版本契约」是缺口）
- 插件的安装顺序、冲突检测、降级策略都是运行时空白

**第二个局限性：Admin Shell 层（Layer 4）的架构边界模糊。**

`createAdminShell` + `createResourceController` 被定义为「greenfield」模式——意味着它们假设从头搭建 CMS。但实际场景中大部分是「brownfield」——已有后端（可能不是 RESTful CRUD）、已有鉴权体系、已有数据模型。当前架构没有为 brownfield 场景提供适配层（gate/adapter/middleware），导致：

- CMS demo 只能连接 mock 数据
- 方向三「服务端数据协议」成为生产就绪的直接障碍
- `createResourceController` 对非标准 API（GraphQL、gRPC、非标 REST、自定义分页）需要额外胶水代码

**第三个局限：Behaviors（Resizable/Movable/Hotkey/ClickOutside）的定位是正交能力，但当前与组件系统的集成深度有限。**

一个 Behavior 包裹任意组件后，它如何与组件的内部状态通信？例如 `<IrisResizable><IrisDialog/></IrisResizable>` — Behavior 的 resize 拖拽事件需要告知 Dialog 更新尺寸，但当前机制是各自为战。要么通过插件 store 共享状态，要么通过 context bridge，这两种方式在复杂场景下都会产生隐式耦合。

### 关键设计决策评估

| 决策                         | 评估      | 说明                                                                                                  |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| Core 零框架依赖              | ✅ 正确   | 四框架对齐的前提，已被验证                                                                            |
| Token 驱动 + `var(--iris-*)` | ✅ 正确   | 换肤和 FOUC 防闪都能优雅解决                                                                          |
| 插件不注册组件               | ✅ 正确   | 保护 tree-shaking 和类型系统                                                                          |
| 适配器只渲染+桥接            | ✅ 正确   | Vue/Svelte/Solid 桥接证明可行                                                                         |
| 状态机仅用于浮层             | ⚠️ 可接受 | 「防 svjs 退化」的判别准则足够严格，但未来复杂状态组件（Wizard、Multi-step Form）可能需要更厚 machine |
| Behavior 独立包裹器          | ⚠️ 可优化 | 正交性正确，但 Behavior 与组件通信机制待完善                                                          |
| 皮肤可继承 + 自定义命名空间  | ✅ 正确   | 这种灵活性是以存储复杂度为代价的（解析时的合并深度），但收益大于成本                                  |

### 架构债务

1. **方向二暴露的插件测试基础设施缺口**：12 个插件中有 8 个会因测试覆盖不足而无法安心发布。这不是单纯的「加测试」问题，而是缺少插件测试框架（mock providers、集成测试编排、版本兼容矩阵）。

2. **CMS 层的「mock 锁死」债务**：`apps/cms-*` 四个框架 demo 都连 mock 数据。这个债务会随时间增长——越晚引入真实后端协议，适配成本越高。

3. **引擎层（machine/form/i18n/virtual/async）的单测覆盖是否反映了「真实竞态」？** 异步操作（表单提交、分页加载、虚拟滚动）的竞态条件最容易在框架桥接层引入 bug。当前测试门（SSR/axe/i18n）覆盖了功能正确性，但**并发安全**（race condition / stale closure / aborted fetch）尚未成为质量门的一部分。

4. **Layer 3–4 组件的样式复杂度**：`NavMenu`、`AdminLayout`、`ProTable` 这类重型组件的 token 用量远高于 L1 原语。如果皮肤系统在 Layer 3–4 遇到样式覆盖冲突（继承链多级 + 自定义命名空间），调试工具目前缺失。

---

## 2. 扩展方向

基于审核修正后的优先级，我提出 5 个架构扩展方向。

### 方向 A（P1）：插件生态基础设施 — 测试工具 + 版本契约 + 交叉依赖

**审核修正的洞察**：之前误认为插件是「薄桩」，实际插件都有完整实现。这反而证明了**缺口不在功能而在生态基础设施**。

#### 为什么需要

- 当前 12 个插件各自测试，没有统一的集成测试框架
- 插件间交叉依赖（pro-table → editor）缺少版本约束
- 发布流水线按包维度设计，插件发布需要特殊的排序和依赖检查
- 插件市场（skin market SDK 已有）需要插件质量评级，当前全覆盖的 12 个插件无法保证未来插件质量

#### 核心挑战

1. **测试编排**：插件需要 `IrisProvider` + 其他插件可能作为依赖。如何低开销地搭建插件测试环境？
2. **版本契约**：插件 A v1.2 依赖插件 B 的 store shape，B 的 breaking change 如何检测？
3. **插件 Store 的 typesafe 共享**：`usePluginStore<T>('key')` 的 `T` 是手动指定的。没有注册中心验证 T 是否匹配实际 store shape。

#### 预期架构变更

```
@iris-ui/plugin-test-utils          # 新包：测试工具
├── createPluginFixture(options)     # 创建隔离插件测试环境
├── PluginTestBed                   # 集成测试容器（mock providers）
└── assertPluginStore<T>(key, shape) # 运行时 store shape 校验

@iris-ui/plugin-contract            # 新包或 core 扩展：插件契约工具
├── definePluginDependency(id, range) # 声明式依赖声明
└── PluginRegistry.validate()       # 启动时依赖冲突检查

每个插件包增加:
├── plugin-X/package.json → peerDependencies 声明 @iris-ui/plugin-Y 版本
└── plugin-X/test/ → 统一测试结构
```

#### 对现有系统的影响

- **完全向后兼容**，新包均为可选引入
- 现有插件需逐步添加 `definePluginDependency` 声明，非破坏性变更
- `createPlugin` 签名可扩展一个 `dependencies` 字段（可选）

---

### 方向 B（P1）：服务端数据协议层 — REST/GraphQL/gRPC 适配器

**审核确认**：这是 CMS 生产就绪的直接障碍。

#### 为什么需要

- `createResourceController` 是纯 client-side 控制器，依赖消费方自己写 fetch
- CMS demo 只能 mock 数据，C-Level 演示无法接入真实后端
- `plugin-pro-table` 的 CRUD 能力依赖于数据层的存在
- 不同后端协议（RESTful / GraphQL / 非标 JSON）需要不同的数据适配策略

#### 核心挑战

1. **数据协议与状态管理的边界**：请求缓存、乐观更新、离线支持——这些应该在 core 层还是数据适配器层？
2. **分页/排序/过滤的协议差异**：`_page`/`_limit`(REST) vs `first`/`after`(Relay Cursor) vs `offset`/`limit`(SQL-like) — 适配器需要归一化到 core 的 data-view 模型
3. **鉴权令牌的生命周期**：access token 刷新、静默过期重试—这是数据层的问题还是 consumer 层的问题？

#### 预期架构变更

```
@iris-ui/data                    # 新包：数据协议层
├── createDataAdapter(config)    # 工厂：创建后端适配器
├── adapters/
│   ├── rest/                    # RESTful JSON 适配器
│   ├── graphql/                 # GraphQL 适配器
│   └── custom/                  # 自定义适配器接口
├── createCacheLayer()           # 请求缓存（可选，不在核心路径）
└── types.ts                     # AdapterConfig / FetchParams / FetchResult

@iris-ui/react/data              # 子路径导出
└── useDataAdapter(config)       # React 桥：生命周期 + useQuery 兼容

@iris-ui/core 扩展:
└── createResourceController 新增 adapter 参数
    createResourceController({ adapter: createDataAdapter({...}) })
```

#### 架构决策点

| 选项                                               | 权衡                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| **A. 数据层在 core 外独立包**                      | 可摇树，不影响 core 体积；但需要额外导入                  |
| **B. 数据层融进 core 的 createResourceController** | 用户零配置，大一统；但 core 体积膨胀，且 GraphQL 等不常用 |
| **C. 抽象接口在 core，实现放独立包**               | 平衡点，但需要依赖注入或 DI 容器                          |

**推荐 C**：`createResourceController` 接受 `DataAdapter` 接口（core 中定义），具体实现在 `@iris-ui/data` 包中。core 不引入任何 HTTP 依赖。

#### 对现有系统的影响

- `createResourceController` 需要泛型参数扩展以支持 adapter
- 现有的 cms demos 需要从 mock 切换到真实 adapter（可在 `env.local` 控制）
- 不影响已有组件的行为

---

### 方向 C（P1.5）：RSC 构建策略 — Server Components 深度集成

**审核修正**：实施复杂度被低估，差异化价值高。

#### 为什么需要

- React 框架适配器已声明 `'use client'`，但 RSC 场景下部分组件可以/应该在服务端渲染
- 当前所有组件标记 `'use client'` 过于保守，失去了 RSC 的 Tree Shaking 和序列化优势
- Svelte 5 runes 和 SolidJS 的 server 模式也在探索类似方向——这是框架无关的架构问题

#### 核心挑战

1. **Token 系统在服务端的渲染**：`var(--iris-*)` 本质是 CSS 变量，在 RSC 中如何预计算静态 token 值注入到 HTML？
2. **`useId` 的 SSR 一致性**：当前 React 的 `useId` 在 RSC 和 Client 端需要保持一致——如果组件在服务端预渲染 HTML，客户端 hydrate 时 ID 必须匹配
3. **`useEffect` 的组件（如 IrisSpinner）**：需要显式标注 `'use client'`，审核已纠正了 IrisSpinner 的分类
4. **Suspense 边界的放置策略**：数据加载组件（pro-table、virtual-scroll）在 RSC 下需要 Suspense 边界，但当前的 `createResourceController` 是同步式的

#### 预期架构变更

```
@iris-ui/react/server           # 新增子路径或包：RSC 组件 + 服务端入口
├── IrisTable.server.tsx        # 服务端数据预取 + 静态 HTML 生成
├── IrisList.server.tsx         # 同上，为可序列化的列表组件
├── IrisThemeProvider.server.tsx # 服务端注入 token CSS 变量（内联 style 块）
└── utils/
    ├── serializeTokens(theme)   # 将 IrisTheme 转为 CSS var 字符串
    └── extractStaticProps(comp) # 提取可在服务端序列化的 props

每个 React 组件需双入口:
├── IrisPopover.client.tsx      # 客户端交互组件（含 useEffect/useState/useFloating）
└── IrisPopover.tsx             # 公共入口：服务端安全导出 + dynamic import 客户端部分

@iris-ui/core 扩展:
├── computeStaticTokens(theme)   # 纯函数：主题 → CSS var 字典（可在 RSC 环境运行）
└── isServerOnly(token)         # 判断 token 是否可在服务端计算
```

#### 风险点

- 双入口 + dynamic import 会增加适配器的维护成本
- RSC 与 Vue/Svelte/Solid 的 Server Components 实现不同，框架无关的解决方案需要抽象
- 需要 CI 中持续运行 `check:rsc`（已有）并补充 end-to-end RSC 渲染测试

#### 对现有系统的影响

- **向后兼容**：所有现有组件继续工作，只是 RSC 场景下标记为 `'use client'` 无法获得 RSC 优化
- 新组件需要双入口模式（递进式采用，不需全量改造）
- RSC 测试环境需要 `next` 或自定义 RSC 测试运行器

---

### 方向 D（P2）：跨组件编排协议 — Event Bus + 协调层

**审核确认**：`createResourceController` 已覆盖 80%，但剩余 20%（跨组件非父子通信）是架构盲区。

#### 为什么需要

- Behavior 包裹器（Resizable/Movable）与组件内部状态的通信需要协议
- 插件间交叉依赖（pro-table 点击编辑 → editor 打开）需要类型安全的事件通道
- `IrisProvider` 的 context 中缺少一个跨组件的编排层

#### 核心挑战

1. **事件总线的类型安全**：`emit('row:click', row)` 在 JS 中无约束，TypeScript 需要 `EventMap` 泛型
2. **生命周期绑定**：组件卸载时自动清理事件监听，防止内存泄漏
3. **性能**：大量组件（150+）在同一 context 下的事件分发不能造成全局 rerender

#### 预期架构变更

```
@iris-ui/core 扩展:
├── createEventBus<EventMap>()   # 类型安全的事件总线工厂
├── createCoordinator()          # 协调器：事件总线 + 自动 cleanup + 优先级
└── useCoordinator(config)       # 适配器桥：自动 cleanup on unmount

组件集成示例:
├── IrisProTable 使用 coordinator.emit('table:row-edit', row)
└── IrisCodeEditor 使用 coordinator.on('table:row-edit', (row) => { ... })

Behavior 扩展:
├── IrisResizableCoordinator     # Resizable + Dialog 的协调扩展
└── useBehaviorBridge            # Behavior → 组件通信的 hook
```

#### 对现有系统的影响

- **向后兼容**：事件总线是完全新增的可选能力，零侵入
- 现有 Behavior 和插件可逐步接入 coordinator，非破坏性变更
- `IrisProvider` 需要扩展 `plugins` 支持 `registerEventBus`

#### 权衡：Event Bus vs Store 共享

| 方案                    | 适用场景                                   | 缺点                               |
| ----------------------- | ------------------------------------------ | ---------------------------------- |
| **Event Bus**           | 跨组件一次性事件编排                       | 类型安全需要额外泛型，调试困难     |
| **Shared Store**        | 跨组件状态共享（选中等）                   | 重渲染控制复杂，不适用于一次性事件 |
| **Coordinator（推荐）** | 两者混合，Event Bus + 可选的 Store binding | 复杂度中等，需要清晰文档           |

---

### 方向 E（P2 → P1.5 可议）：Skin Engine 的 Layer 3–4 调试工具

审核未直接提及，但来自方向一（OS 壳层下沉）和 AGENTS.md 中「皮肤由 token 驱动」的架构承诺。

#### 为什么需要

- Layer 3–4 组件的 token 用量大（NavMenu、AdminLayout、ProTable），调试 token 覆盖链困难
- 皮肤继承链（`extends: 'dark'` → 覆盖 → 自定义命名空间）的最终计算值对开发者不透明
- 当前「实时 patch」功能在 playground 中存在但没有可视化工具

#### 核心挑战

1. **CSS 变量计算链**：`var(--iris-primary)` 在浏览器中通过 `getComputedStyle` 获取，但源码中无法追溯覆盖来源
2. **性能**：DevTools 模式不可影响生产性能，需要条件编译或独立包

#### 预期架构变更

```
@iris-ui/skin-devtools           # 新包：可选开发工具
├── SkinInspector                # 可视化 inspector（覆盖 Element Inspector）
├── TokenTimeline                # Token 变更历史（patch/reset 操作追踪）
└── SkinAnalyzer                 # 静态分析：token 使用统计 + 未定义 token 警告

@iris-ui/skins 扩展:
├── createSkinEngine 新增 devMode 选项
└── skinStore 扩展 dev 属性：变更日志、覆盖来源追踪
```

#### 对现有系统的影响

- 纯可选 dev dependency
- 产线模式下（`process.env.NODE_ENV === 'production'`）零成本
- 可未来与「皮肤市场 SDK」集成

---

## 3. 接口设计建议

### 关键模块接口设计原则

**原则 1：适配器接口与 core 接口的「镜像」关系应显式化。**

当前 `createSelectionModel` 的适配器桥使用 `model.sync` 实现 prop 镜像，这是一种「隐式约定」。当适配器数量从 4 增长到更多时，需要一份**适配器接口契约文档**（或 TypeScript `interface`）来约束：

```typescript
// @iris-ui/core 中定义
interface AdapterBridge<Controller, Props> {
  // 从 props 同步到 controller 的受控值
  sync(controller: Controller, props: Props): void;
  // 从 controller 获取当前状态，映射为框架响应式值
  toReactive(controller: Controller): /* 框架特有类型 */;
}
```

这不是引入新抽象，而是将已存在的模式文档化+类型化。

**原则 2：插件 store 的注册与访问需要更严格的类型守卫。**

当前 `usePluginStore<T>('key')` 的 `T` 是手动指定，运行时可能在 `'key'` 不存在时抛出。应引入**注册时类型见证**：

```typescript
// 插件安装时
reg.registerStore('notification', () => createNotificationStore())
// 类型系统自动推导 store shape，使用者：
usePluginStore('notification') // 自动推导类型，不需要泛型
```

这需要 TypeScript 的 declaration merging 或模板字面量类型。实施复杂度中等。

**原则 3：DataAdapter 接口应极简。**

数据协议层（方向 B）的接口应控制在 3 个方法以内：

```typescript
interface DataAdapter<T> {
  fetch(params: FetchParams): Promise<FetchResult<T>>
  // 如果支持 CRUD
  mutate?(action: MutateAction<T>): Promise<T>
  // 如果支持流式/订阅（GraphQL subscription / SSE）
  subscribe?(query: string, cb: (data: T) => void): () => void
}
```

极简接口使 adapter 实现成本低，未来的 GraphQL/gRPC 适配器不需要理解 Iris 的状态管理——只需将后端响应映射为 `FetchResult<T>`。

### 是否需要新的抽象层

**是，需要两个轻量抽象层：**

1. **数据适配器层（DataAdapter）** — 如上所述。核心需求：将后端协议差异隔离在 adapter 中，`createResourceController` 只消费归一化的 `FetchResult`。

2. **插件协调层（Coordinator）** — 跨组件编排的事件管道。它不是一个「层」而是一个「模式」，可内嵌在 `IrisProvider` 的 context 中。

**不需要的抽象：**

- 不需要 UI 引擎层（当前 Layer 0–4 已足够）
- 不需要服务端渲染抽象层（RSC 是框架特定的，应保持在适配器层）
- 不需要「组件元数据注册表」（manifest 是基于文件系统的静态扫描，不是运行时注册表）

### 如何保持向后兼容性

**版本策略**：

- Core 层语义化版本：主版本号变更需所有框架适配器同步更新
- 插件版本独立于 core
- 数据层包（`@iris-ui/data`）从 v0.x 开始，成熟后切 1.0
- 新接口（DataAdapter、Coordinator）全部为可选的**mixin 方式**附加，不修改现有接口签名

**具体机制**：

- `createResourceController` 新增可选的 `adapter` 参数，不传则保持当前行为（需要用户手动 fetch）
- `IrisProvider` 新增可选的 `coordinator` 参数，不传则无事件总线
- 插件新增 `dependencies` 声明为可选字段
- 所有新增包 (`@iris-ui/plugin-test-utils`, `@iris-ui/data`, `@iris-ui/skin-devtools`) 为独立 npm 包，不影响已有依赖图

---

## 4. 技术选型

### 是否需要引入新技术栈

| 方向         | 新技术                              | 必要性                                                                                               | 风险                                 |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 数据协议层   | 轻量 HTTP 客户端（无 / fetch 内置） | 可选。使用原生 `fetch` 可减少依赖，但缺少拦截器/重试/超时。**推荐考虑 `ky`**（2KB，tree-shakable）   | 低。替换为原生 fetch 成本极低        |
| RSC 构建策略 | Next.js 专用包 vs 框架无关实现      | **不需引入 Next 作为依赖**。@iris-ui/react/server 应在纯 React 下工作，next 集成可走微调文档或独立包 | 依赖 Next 会失去框架自由度           |
| 插件协调器   | 事件总线库（mitt / eventemitter3）  | 可选。`mitt`(200B) 是极简选择，但缺少类型安全。**推荐自建极简类型安全 EventBus**（约 50 行 core）    | 依赖第三方事件库若改签名，迁移成本低 |
| 皮肤调试工具 | 浏览器扩展 vs 内嵌 DevTools         | **推荐内嵌 overlay**（类似 React DevTools 的组件树高亮），不依赖浏览器扩展 API                       | 跨浏览器兼容需额外测试               |

### 第三方依赖评估标准

引入新的第三方依赖前，应通过以下五道门：

1. **体积预算先决**：该依赖是否会突破当前包的 size budget？(core ≤10KB, adapter ≤5KB 每框架, plugins ≤15KB 每包含 core)
2. **框架锁定风险**：该依赖是否会引入框架特异性（例如 `@floating-ui/react` 是 React 特定的，不可用于 Vue/Solid/Svelte）？
3. **TypeScript 深度**：依赖是否提供原生 TypeScript 类型？类型是否精确（非 `any` 滥发）？
4. **Bundle 策略**：是否为 ESM + tree-shakable？CommonJS 只有时是否需要双重构建？
5. **维护生命力**：GitHub stars > 1000？最近更新在 6 个月内？issues 响应活跃？

**当前依赖的健康检查**：

- `@floating-ui/dom` ✅ — 框架无关，tree-shakable，类型完整，活跃维护
- `@codemirror/*` ✅ — CodeMirror 6 是 modular 架构，每个包 ≤10KB
- `ky` ⏳（未引入，候选）— 2KB，原生 fetch 封装，tree-shakable，类型完整

### 自建 vs 采购

| 场景               | 推荐                    | 理由                                                                                                              |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 事件总线           | **自建**                | 50 行实现，类型安全，无外部依赖；mitt 缺少类型安全，eventemitter3 过大(10KB)                                      |
| HTTP 客户端        | **采购**（ky / wretch） | 重试/超时/拦截器是基础设施，不值得自建；原生 fetch 缺少这些                                                       |
| 数据适配器 GraphQL | **半自建**              | 不需要引入 Apollo/URQL（过于重型）。自建轻量适配器（接受 `query` string + `variables`，返回归一化 `FetchResult`） |
| 浏览器扩展         | **暂不采购**            | 皮肤 DevTools 先做内嵌版，验证需求后再评估浏览器扩展方案                                                          |
| 测试运行器         | **自建 PluginTestBed**  | 定制化程度高，通用测试框架（vitest/jsdom）无法直接模拟 IrisProvider + 多插件嵌套环境                              |

---

## 5. 实施路线图

### 优先级排序（审核修正版）

| 方向                 | 优先级   | 理由                                  | 估算（人月） |
| -------------------- | -------- | ------------------------------------- | ------------ |
| B — 数据协议层       | **P0.9** | CMS 生产就绪的直接障碍；路径最清晰    | 2–3          |
| A — 插件生态基础设施 | **P1**   | 12 个插件的质量保证缺口；但影响中等   | 1.5–2        |
| C — RSC 构建策略     | **P1.5** | 高差异化价值，但实施周期长            | 3–4          |
| D — 跨组件编排协议   | **P2**   | `createResourceController` 已覆盖 80% | 1–1.5        |
| E — 皮肤调试工具     | **P3**   | 开发者体验改进，不阻塞发布            | 1            |

### 阶段划分

#### 阶段 1（2026 Q3）：数据协议层 + 插件测试基础设施

**里程碑 M1**：`@iris-ui/data` v0.1 + 一个 REST adapter + createResourceController adapter 参数

```
任务：
1. 定义 DataAdapter 接口（core 中）
2. 实现 @iris-ui/data 包（REST 适配器 + 错误处理 + 请求取消）
3. createResourceController 扩展 adapter 参数（向后兼容）
4. 实现 @iris-ui/plugin-test-utils（createPluginFixture + PluginTestBed）
5. 将 plugin-notifications, plugin-kanban 迁移到统一测试框架
6. 更新 cms-react demo：连接真实 REST API（可配置）
```

**风险与缓解**：

- 风险：REST adapter 的接口设计过度泛化 → **缓解**：以 cms-react 的 API 形状为真实用例，逆向设计 DataAdapter 接口，不超过 3 个方法
- 风险：现有 CMS demo 的 mock 数据与真实 API shape 不匹配 → **缓解**：mock 数据使用 MSW（Mock Service Worker），统一 `FetchParams` 格式

#### 阶段 2（2026 Q4）：插件版本契约 + RSC 起步

**里程碑 M2**：插件间依赖声明生效 + React RSC 首个组件（IrisTable.server 原型）

```
任务：
1. definePluginDependency 添加到 createPlugin 签名
2. PluginRegistry.validate() 实现
3. IrisThemeProvider.server — 服务端注入 CSS token
4. IrisTable.server — 服务端数据预取 + 静态 HTML 生成
5. check:rsc 扩展：增加 RSC 渲染测试用例
6. 更新 manifest 生成工具：标记哪些组件有 .server 入口
```

**风险与缓解**：

- 风险：RSC 实现被 Next.js 锁定 → **缓解**：server 组件基于 React 19 `react-server` 条件导出，不依赖任何框架
- 风险：插件版本契约增加发布复杂度 → **缓解**：在 CI 中添加 `changeset` 的依赖图分析，自动检测版本冲突

#### 阶段 3（2027 Q1）：跨组件编排 + 渐进式 RSC 推进

**里程碑 M3**：Coordinator 可用 + React 适配器 50% 组件有 server 入口

```
任务：
1. createEventBus 实现（core）
2. IrisProvider 可选 coordinator 参数
3. Behavior 集成 Coordinator（Resizable + Dialog 协调）
4. pro-table + editor 通过 coordinator 通信原型
5. React 组件双入口改造：优先级最高的 20 个组件（Popover/Dialog/Table/Select/Menu）
6. Vue/Solid/Svelte 的 Server Components 调研（输出评估文档，不一定实施）
```

**风险与缓解**：

- 风险：Coordinator 与 Behavior 现有通信方式冲突 → **缓解**：Coordinator 是可选能力，现有 Behavior 保持不动
- 风险：30+ 组件双入口改造成本高 → **缓解**：从高频交互组件开始（Popover/Dialog），纯展示组件延迟改造

### 全局风险矩阵

| 风险                                                              | 概率 | 影响 | 缓解策略                                                       |
| ----------------------------------------------------------------- | ---- | ---- | -------------------------------------------------------------- |
| DataAdapter 接口设计过度工程，无法覆盖非标 API                    | 中   | 高   | 极简接口原则（3 方法）；提供 `custom adapter` 逃生口           |
| RSC 与 Vue/Solid 的 Server Components 不兼容                      | 低   | 中   | RSC 策略保持 React 专有；Vue/Solid 用各自平台的 server 模式    |
| 插件测试工具增加 CI 时间                                          | 高   | 低   | 插件测试并行化（Turborepo 已支持）；按需运行（仅 affected）    |
| `createResourceController` 的 adapter 参数增加 API surface 复杂度 | 中   | 中   | 参数类型使用 discriminated union，IDE 自动提示；文档示例全覆盖 |
| 四框架的 RSC 差异化导致适配器维护成本激增                         | 低   | 高   | 决定：RSC 仅 React 实现，不向 Vue/Solid/Svelte 承诺 RSC 支持   |

---

## 总结

审核文档中最大的修正并非方向二插件状态的误判，而是这个误判揭示了一个更深层的结构性问题：**Iris UI 的插件体系在「功能完整度」上已经超过了「生态基础设施」的成熟度**。12 个插件的完整实现（总计数千行，看板 787 行、表单构造器 837 行）意味着插件能力本身不是瓶颈——瓶颈在于：

1. 如何保证这些插件在版本演化中不相互破坏（版本契约）
2. 如何让第三方开发者也能写出同等质量的可测试插件（测试工具）
3. 如何让插件间的组合使用是类型安全而非「拿到 store 自己 cast」（store 类型推导）

数据协议层（P0.9）和 RSC 构建策略（P1.5）的优先级在审核后成立。前者解决了「Demo 永远连 mock」的生产就绪障碍，后者的实施复杂度被审核明确指出需要重估——我估算 3–4 人月是保守值，主要风险在于将四个框架的 server component 策略统一到一套抽象下。

最终建议：**阶段 1 聚焦 DataAdapter 这一个接口**。`createResourceController` 的一个 adapter 参数就能解锁 CMS 的生产就绪，杠杆率最高。插件生态基础设施并行推进，RSC 在阶段 1 不投入工程资源但可出 RFC 文档。
