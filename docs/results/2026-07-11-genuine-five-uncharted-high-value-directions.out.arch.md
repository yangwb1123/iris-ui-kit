现在我已充分理解当前架构。下面开始输出完整的架构分析报告。

---

# Iris UI 架构分析报告：五个高价值扩展方向

> **日期**：2026-07-12 · **角色**：资深架构师  
> **参考源**：`docs/requirements/2026-07-11-architect-product-deep-scan-five-uncovered-high-value-directions.md`  
> **基础代码库**：28 包 × 4 框架适配器，@iris-ui/core 为核心，token 驱动，插件可扩展

---

## 1. 架构评估

### 1.1 核心架构优势

Iris UI 当前架构于同类中极具前瞻性，其设计决策经得起系统性质证：

| 决策                                         | 验证证据                                                                                | 评估                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **逻辑下沉 core，适配器做薄桥**              | 149 组件 × 4 框架对齐，`grep "from 'react'" packages/core/src` 为空                     | ✅ 架构核心原则已验证。跨框架复用率达 ~70%（同一组件 core 逻辑 4 框架共享）。这是**架构杠杆率最高**的设计决定 |
| **A/B/C 分类心智模型**                       | `createSelectionModel` 消费于 17 组件，`nextEnabledIndex` 消费于 ~19 组件               | ✅ 分类铁律在实践中自洽。A 零配置在场、B 不用不进包——防止了充血模型                                           |
| **`IrisProvider` + `createPlugin` 插件契约** | `registerTokens/registerMessages/registerStore/onTeardown` 四接口                       | ✅ 接口有界（不做 `registerComponent`），保持类型安全和 tree-shaking。这是正确的取舍                          |
| **`createStore` 统一状态原语**               | React `useSyncExternalStore` / Vue `ref` / Solid `createSignal` / Svelte `toStore` 四桥 | ✅ 跨框架复用**不需要**全局状态库（Redux/Pinia）。这是框架无关 UI 库的黄金路径                                |
| **Token 驱动 + CSS 变量**                    | `var(--iris-*)` 全系统使用，skin 系统支持 `extends`                                     | ⚠️ 优势明确，但下文将指出其与 CSS containment 的张力                                                          |
| **`batch` 合并通知**                         | Store 级 emit coalescing                                                                | ✅ 对高频更新场景（拖放、虚拟滚动、表单字段 typing）至关重要                                                  |

### 1.2 架构局限性（本次扫描揭示）

以下五个方向反映了当前架构中的**系统性空白**，而非零散功能缺失：

1. **状态模型是单用户** —— 所有 `Store`、`SelectionModel`、`Expansion`、`ResourceController` 的核心假设是「一个人操作」。这是最深层的架构约束——不是加几个组件能解决的，需要新增一个 `MultiUserStore` 抽象层。

2. **表单步骤是线性序列** —— `FormStep` 接口的 `fields: Key<V>[]` 不含任何条件元信息。这不是参数不足，是**数据类型不够表达分支流**。需要将步骤定义从「字段列表」升级为「DAG 节点」。

3. **Desktop OS 应用是孤岛** —— `AppManifest` 声明了 `id/name/kind/permissions`，但没有声明**能力**（"我能处理什么"）。这不是功能缺失，是**接口契约不完整**——应用模型缺少服务发现层。

4. **运行时零观测点** —— 组件生命周期钩子全部向内（渲染自身逻辑），没有向外发射信号的机制。这是**观测性投资不足**——构建时基准 + 体积预算检测了"静态质量"，没有检测"动态行为"。

5. **渲染层零声明** —— 组件不告诉浏览器「我可以被隔离」。这是**CSS 变量体系的一个二阶效应**——`var(--iris-*)` 的美观抽象掩盖了其传播链的成本。

### 1.3 架构债务与技术债

| 类别       | 债项                                                                                                                                                                            | 严重度 | 建议                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| **架构债** | 四套 Desktop OS 壳（react/vue/solid/svelte）各自实现了 os.ts、permissions.ts、catalog.ts，但**应用间通信的缺口在四个壳中重复**——这是 AGENTS.md 明确警告的「跨框架 JS 逻辑重复」 | 中     | 将 `AppBus`/`CapabilityRegistry` 下沉到 `@iris-ui/core/desktop` 子路径，四壳消费同一个纯逻辑引擎 |
| **设计债** | `FormStep` 接口定义在 `core/form/types.ts`，没有为条件步骤预留扩展点。现有 `PluginRegistry` 只有 `registerTokens/registerMessages/registerStore`，缺少 `registerStepCondition`  | 低     | 保持 `FormStep` 向后兼容，增加可选 `shouldSkip` 字段                                             |
| **测试债** | 五个方向全部缺乏企业级场景测试——没有多用户测试夹具、没有分支表单的 DAG 验证测试、没有 CSS containment 的渲染性能断言                                                            | 中     | 在现有 vitest 体系下按方向新增测试套件                                                           |
| **文档债** | `llms.txt` 不包含五个方向的组件/API，AI 无法通过 manifest 发现协作/分支/遥测能力                                                                                                | 低     | `pnpm gen:manifest` 扩展                                                                         |

---

## 2. 扩展方向

### 方向 A：表单向导条件分支协议 ← 文档方向②

#### 为什么需要

- **业务价值**：90% 的多步注册/配置/支付流程需要条件跳转。当前线性步骤在 Demo 够用但生产不可用。`plugin-form-builder`（已实现 schema→表单渲染）缺少分支步骤 = 低代码场景关键能力缺口。
- **技术价值**：验证架构的原则 6——**渐进式复杂度**。在 `FormStep` 增加一个可选字段，不改行为。这是最低的进入成本。

#### 核心挑战

| 挑战         | 难度  | 说明                                                             |
| ------------ | ----- | ---------------------------------------------------------------- |
| **循环检测** | 中    | 条件 A→步骤 2→条件 B→步骤 1。需要 DAG 验证：`detectCycle(steps)` |
| **异步条件** | 中    | `shouldSkip` 返回 `Promise` → 步骤导航需要加载态                 |
| **子步骤**   | 低    | 步骤 2a 和 2b 仅在特定条件下可见。嵌套 `FormStep[]`              |
| **URL 同步** | 低    | `history.replaceState` 绑定，框架适配器各自实现                  |
| **向后兼容** | ✅ 零 | 现有 `FormStep` 消费者无 `shouldSkip` = 线性行为不变             |

#### 预期的架构变更

```
FormStep<V> 扩展（只加一个字段）：
  - shouldSkip?: (values: FormValues<V>) => boolean | Promise<boolean>
    （可选，不存在 = 不跳过 = 线性行为）

nextStep() 重写为循环跳过逻辑：
  do {
    const candidate = steps[currentIndex + 1]
    if (!candidate || !(await candidate.shouldSkip?.(getValues()))) break
    currentIndex++
  } while (true)

新增 @iris-ui/core/form/steps.ts 纯函数：
  - detectCycle(steps: ConditionalStep<V>[]): CycleReport
  - resolveStepSequence(steps, values): number[]  (解析条件后的有效路径)

plugin-form-builder 消费：
  - 可视化拖拽「条件节点」→ 生成 shouldSkip
  - 预览模式「模拟路径」→ 高亮当前分支
```

#### 对现有系统的影响

- **无断变**：core 新增 ~150 行纯逻辑，框架适配器零改动（`nextStep`/`goToStep` 接口不变）
- **测试新增**：DAG 验证测试 + 异步条件测试 + 循环阻断测试
- **llms.txt 更新**：新增 `createConditionalStepNavigation`

---

### 方向 B：CSS 渲染优化协议 ← 文档方向⑤

#### 为什么需要

- **业务价值**：ProTable 500 行 + Dashboard 20 widget + AdminLayout 四区布局——这些是 Iris UI 的目标场景。没有 CSS containment，`var(--iris-*)` 的传播链在 500 行表格中造成可感知的 recalc style 延迟。Token 系统的规模和性能成反比，containment 打破这个反比。
- **技术价值**：这是**真正的 zero-cost abstraction**——一行 `contain: strict` 引入零运行时开销，全在浏览器引擎层优化。

#### 核心挑战

| 挑战                                   | 难度 | 说明                                                                                                                                                     |
| -------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`contain: style` 阻断 CSS 变量继承** | 高   | Iris 的核心机制就是 `var(--iris-*)` 从 ancestors 继承。阻断继承链后，组件内无法访问父级 token。需要在 containment 节点内重新声明所需 `--iris-*` fallback |
| **`content-visibility: auto` 与搜索**  | 中   | 浏览器「在页面中查找」可能跳过 `content-visibility: auto` 子树。需要 `contain-intrinsic-size`                                                            |
| **Behaviors 冲突**                     | 中   | `IrisSortable` 依赖几何定位，`contain: layout` 改变定位上下文                                                                                            |
| **SSR 差异**                           | 低   | 服务端渲染时 containment 不生效，hydrate 后切换                                                                                                          |

#### 关键决策树：containment 策略

```
选项 A：默认严格（组件自带 containment）
  优：最大性能提升，零用户心智负担
  劣：CSS 变量继承中断，需要全局 token 声明机制
  适合：布局组件（IrisSidebarLayout、IrisDashboardGrid）

选项 B：默认宽松（组件不声明，用户通过 prop 按需开启）
  优：零断变，用户完全控制
  劣：大部分用户不知道 containment 的存在，性能提升不明显
  适合：原语组件（IrisButton、IrisInput）

选项 C：分层策略（按 Layer 决定默认值）
  Layer 0-1（原语）：宽松（不声明 containment）
  Layer 3（布局）：严格（contain: layout paint）
  Layer 4（AdminShell）：最严（contain: strict）
  优：渐进式 containment——越上层收益越高，越下层风险越低
  劣：需要逐组件审计和分类
```

**建议：选项 C**。Align with 项目已有的四层架构分层。Layer 3 和 Layer 4 的组件天然是 containment 的最佳候选——它们锚定布局区域，内部子树与外部通过 `var(--iris-*)` 解耦。

#### 预期的架构变更

```
@iris-ui/core 新增：
  - ContainmentLevel 枚举 (none / layout / paint / style / strict / layout-paint / auto)
  - ComponentContainment 配置接口
  - createContainmentProps(level, tokens): CSSProperties 工厂

组件逐步声明：
  IrisSidebarLayout → contain: layout paint（默认）
  IrisDashboardGrid → contain: layout（默认）
  IrisTable → contain: layout（大列表场景）
  IrisCard → contain: content visibility（默认）

CSS 变量 fallback 模式：
  :where(.iris-contained) {
    --iris-bg: var(--iris-bg, initial);   // 从外部捕获一次
    --iris-text: var(--iris-text, initial);
  }
```

#### 对现有系统的影响

- **CSS 变量继承变化**是最大风险——containment 节点内的组件会失去 `var(--iris-primary)` 访问。需要**两阶段 rollout**：第一阶段只应用于无 CSS 变量依赖的纯布局组件，第二阶段配合 token injection 机制扩展到全组件。
- **测试新增**：渲染性能基准测试（`scale.bench.ts` 扩展）、回归搜索测试（`content-visibility` 不影响 `Ctrl+F`）
- **零 JS 字节新增**（纯 CSS 策略，除非选择 prop API）

---

### 方向 C：Desktop OS 应用间通信与能力宣告 ← 文档方向③

#### 为什么需要

- **业务价值**：Desktop OS 从「窗口管理器集合」进化为「真正操作系统」的必要一跳。没有应用间通信，用户操作停留在操作系统表层——点击图标、打开窗口、关闭窗口。有了通信，才能实现「邮件附件→文件管理器」「浏览器 URL→编辑器链接」「日历事件→邮件邀请」等跨应用流程。
- **技术价值**：当前四套 Desktop OS 壳（react/vue/solid/svelte）各自在应用层重复了「不能通信」的缺口。下沉到 core 解决一次，四壳收益——这是 AGENTS.md 原则 1 的精确应用。

#### 核心挑战

| 挑战                    | 难度 | 说明                                                                                                                |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| **跨窗口/跨标签页路由** | 高   | App A（窗口 1）→ App B（窗口 2，可能不同标签页）。通信不能仅依赖内存共享，需要 `BroadcastChannel` 或 `SharedWorker` |
| **懒启动**              | 中   | App B 被调用时未挂载 → 需要自动挂载机制                                                                             |
| **能力冲突**            | 中   | 两个 App 声明可以处理 `.csv` → 优先级/用户选择                                                                      |
| **远程 App 通信**       | 高   | `kind: 'remote'` 的第三方 App 通过 ESM 加载后如何注册能力？                                                         |
| **权限中介**            | 中   | App A 有剪贴板权限，App B 没有但想读 A 的数据。权限不应透传                                                         |

#### 两个选项权衡

```
选项 A：纯消息总线（轻量）
  定义：AppBus 接口（request/onRequest/broadcast），基于 BroadcastChannel
  能力：应用间发消息、请求响应
  不做：能力发现、类型安全路由
  优：~200 行 core 逻辑，极低门槛
  劣：应用需要知道对方 ID 才能通信，没有服务发现

选项 B：能力宣告 + 路由层（完整）
  定义：
    AppCapability（{ type, schemes, actions }）
    CapabilityRegistry（register/find/resolve）
    AppBus（基于选项 A + 类型安全路由）
  能力：应用声明"我能处理 .csv"→ 系统解析 → 路由到合适应用
  优：完整的 OS 级服务发现
  劣：~500 行 core + 各壳桥接代码

建议：选项 A 是 P2 快速迭代，选项 B 是 P1 最终目标。
  阶段 1：AppBus（消息总线，`@iris-ui/core/app-bus`）
  阶段 2：CapabilityRegistry + AppBus 路由集成
```

#### 预期的架构变更

```
@iris-ui/core 新增（框架无关）：
  - createAppBus(): AppBus  — 消息总线（request/onRequest/broadcast）
  - CapabilityRegistry     — 能力注册/发现
  - AppCapability 类型      — 能力声明接口
  - resolve(uri: string)    — URI → 应用映射

AppManifest 扩展：
  interface AppManifest {
    ...原有字段
    capabilities?: AppCapability[]  // [新增]
  }

四壳适配：
  IrisDesktopProvider 集成 AppBus 实例
  每个壳的 os.ts 消费 createAppBus + CapabilityRegistry
```

#### 对现有系统的影响

- **无断变**：`AppManifest` 增加可选 `capabilities` 字段，现有 catalog 条目不动
- **四壳 JS 逻辑去重**：当前 `os.ts` / `permissions.ts` 中各壳有 ~200 行同类但不同实现的状态管理。下沉到 core 后各壳删掉这些重复逻辑，改为薄桥消费
- **测试新增**：AppBus 单元测试（同窗口/跨窗口/错误处理）+ 各壳集成测试

---

### 方向 D：实时协作 UI 原语层 ← 文档方向①

#### 为什么需要

- **业务价值**：多人协作是 Iris UI 从「单人 UI 库」到「协作平台」的能力跃迁。149 组件 × 4 框架对齐是单人 UI 的完整度天花板。协作 UI 原语层是**下一个数量级的差异化**——远程光标、在线感知、冲突可视化。
- **技术价值**：已有分析覆盖了 CRDT 数据同步层（数据一致性问题），但同步后的 UI 呈现是一个独立问题。core 已经提供了 `SelectionModel`/`Expansion`/`ResourceController`——协作原语是这些模型的**自然多用户扩展**。

#### 核心挑战

| 挑战               | 难度 | 说明                                                                                 |
| ------------------ | ---- | ------------------------------------------------------------------------------------ |
| **高频更新节流**   | 中   | 每个 mousemove 发送光标位置 = 30-60次/秒。需要 requestAnimationFrame 合并 + 空间采样 |
| **多用户聚合性能** | 高   | 20+ 用户同时在线 → 20 个光标 + 20 个头像。组件渲染策略需要虚拟化或限流               |
| **框架适配器差异** | 中   | 各框架的动画/过渡系统不同，光标动画和选区高亮需要 4 套适配器桥接                     |
| **与 CRDT 层集成** | 高   | 协作 UI 需消费 CRDT 同步层的状态（在场用户、操作序列、冲突状态）——但 CRDT 层尚未实现 |
| **SSR 安全**       | 低   | 协作 UI 只在客户端工作，需要 `typeof window === 'undefined'` 守卫                    |
| **密码字段隐私**   | 低   | 需要 `data-iris-no-cursor` 标记——某些输入不应暴露光标                                |

#### 预期的架构变更

```
@iris-ui/collaboration 新包（或 @iris-ui/core/collaboration 子路径）：

  core（框架无关）：
    - createPresenceStore(roomId, userId): PresenceEngine
      在线感知：join/leave/status/peek

    - createRemoteCursorStore(): RemoteCursorEngine
      远程光标：upsert/batch/prune/throttle

    - createCollaSelectionModel(): SelectionModel 扩展
      多用户选择同步：远程选区的合并/冲突

    组件（四框架适配器）：
      IrisRemoteCursorOverlay — 远程光标渲染层
      IrisPresenceAvatar      — 在线头像
      IrisPresenceAvatarGroup — 头像组（+N 溢出）
      IrisConflictBanner      — 冲突提示条
      IrisLockIndicator       — 编辑锁定图标

  Core 控制器扩展：
    createSelectionModel 可选传入 remoteSelections（多用户）
    createExpansion 可选传入 remoteExpansions
```

#### 对现有系统的影响

- **高风险 / 高回报**：这是五个方向中工程成本最高、交付周期最长的。依赖 CRDT 同步层的前置完成
- **包拆分决策**：建议独立 `@iris-ui/collaboration` 包（而非 core 子路径），因为协作组件体积大（光标 SVG 渲染、动画系统），不应影响 core 的体积预算
- **测试投入最大**：需要多用户测试夹具（两个 `createPresenceStore` 实例模拟两个用户）+ 高频更新测试 + 冲突模拟

---

### 方向 E：组件级生产遥测 SDK ← 文档方向④

#### 为什么需要

- **业务价值**：当前质量基建（构建时基准 + 体积预算 + CI 性能门）覆盖了「静态质量」。生产环境的实际性能特征可能与基准相差 10 倍（真实用户设备、真实网络、真实数据量）。没有遥测 SDK，性能退化只能等用户报 bug。
- **插件生态量化**：IrisProvider 插件市场需要知道哪些插件被广泛使用、哪些功能用户实际交互。没有遥测，插件作者只能根据 GitHub issue 数判断活跃度。

#### 核心挑战

| 挑战                 | 难度 | 说明                                                                                                                                                 |
| -------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **生产环境性能开销** | 高   | 每个组件每次渲染触发回调 → 测量本身变成性能瓶颈。必须分层：`verbose`（开发）→ `sampled`（生产，1%采样）→ `off`                                       |
| **PII/隐私**         | 中   | `IrisFormField` 的 onChange 事件包含用户输入。事件需 `PII: boolean` 标记，自动脱敏                                                                   |
| **框架差异**         | 中   | React `useEffect` 计数 vs Vue `onBeforeUpdate` vs Solid `onCleanup` vs Svelte `$effect`。四框架钩子不同，但 core 提供一个统一的 `TelemetrySink` 接口 |
| **SSR 无效呼叫**     | 低   | 服务端渲染也会触发生命周期。需要 `typeof window === 'undefined'` 守卫                                                                                |

#### 两个选项权衡

```
选项 A：组件内联呼叫（IrisProvider 内置）
  每个 Iris 组件在生命周期钩子中调用 telemetry.push()
  优：零配置，所有组件自动上报
  劣：~149 组件逐个修改，工作量 1-2 周
  劣：框架适配器中都需要修改（4 × 149 = 596 个文件）

选项 B：AOP 包装器（IrisProvider 层拦截）
  IrisProvider 在渲染时用 Proxy/decorator 包装组件
  优：不改组件代码，一劳永逸
  劣：Proxy 在渲染层有性能开销
  劣：框架差异大（React 的 Profiler API vs Vue 的 onBeforeUpdate）

建议：混合方案
  - 渲染计数 / 挂载寿命：利用各框架的 Profiler API（React <Profiler>、Vue devtools hook、Svelte $effect）——不改组件
  - 用户交互（点击/选择）：监听 IrisProvider 子树的事件委托——不改组件
  - 错误上报：IrisErrorBoundary 已有的 componentDidCatch 扩展——已集成
  - 功能采用率：插件手动声明 `telemetryNamespace`——插件作者选择加入
```

#### 预期的架构变更

```
@iris-ui/core 新增：
  interface TelemetryEvent {
    type: 'mount' | 'update' | 'unmount' | 'interaction' | 'error' | 'custom'
    component: string
    framework: string
    timestamp: number
    duration?: number
    metadata?: Record<string, unknown>
    pii?: boolean           // 隐私标记
  }
  interface TelemetrySink { push(event): void; flush(): Promise<void> }
  type SamplingRate = number  // 0-1

IrisProvider 扩展：
  <IrisProvider telemetry={{
    enabled: true,
    sampleRate: 0.01,       // 生产环境 1% 采样
    sink: mySink,
    onError: true,          // 自动上报错误
  }}>
```

#### 对现有系统的影响

- **无断变**：`telemetry` 是 `IrisProvider` 的可选 prop，缺省 disabled
- **组件不改**：利用 Profiler API + 事件委托，不必改 149 组件
- **零新增依赖**：纯 TypeScript 实现，无外部遥测库——sink 接口标准化，用户可以使用任何后端（Datadog / Sentry / 自建）

---

## 3. 接口设计建议

### 3.1 关键设计原则

基于 Iris UI 现有架构的成功模式（A/B/C 分类、框架无关 core、薄适配器），对五个方向的接口设计建议：

#### 原则 1：可选字段优先于新接口

现有 `FormStep`、`AppManifest` 等接口增加**可选字段**，而非创建平行接口。这保证向后兼容。

```
// ✅ 好：可选字段
interface FormStep<V> {
  id?: string
  fields: Key<V>[]
  shouldSkip?: (values: V) => boolean | Promise<boolean>  // [新增]
}

// ❌ 不好：平行接口
interface ConditionalFormStep<V> { ... }  // 导致类型分裂
```

#### 原则 2：core 层只定义契约，不包含框架特定实现

参考 `createStore` 模式——`AppBus` 接口在 core 定义，BroadcastChannel 桥接在适配器层注入。

```
// core 层（框架无关）
interface AppBus {
  request(targetId: string, action: string, payload: unknown): Promise<unknown>
  onRequest(action: string, handler: AppRequestHandler): () => void
  broadcast(action: string, payload: unknown): void
}
export function createAppBus(): AppBus  // 纯逻辑实现

// react 适配器
// useAppBus() 在 IrisDesktopProvider 中注入
```

#### 原则 3：遥测/协作等重型能力走独立包（非 core 子路径）

```
@iris-ui/collaboration       // 独立包，不影响 core 体积
@iris-ui/telemetry           // 独立包，生产环境按需引入
```

#### 原则 4：使用 `mergeSlotProps` 模式为已有组件添加扩展视觉

远程光标、ConflictBanner 等协作视觉层应通过 `IrisSlot` + `mergeSlotProps` 附加到现有组件，而不是修改组件自身。

```
<IrisTable slots={{
  remoteCursor: IrisRemoteCursorOverlay,
  presence: IrisPresenceAvatarGroup,
}}>
```

### 3.2 是否需要新的抽象层

| 方向            | 新抽象层                                        | 理由                                         |
| --------------- | ----------------------------------------------- | -------------------------------------------- |
| 表单向导分支    | 不需要                                          | 只是在 `FormStep` 加一个可选字段             |
| CSS 渲染优化    | 不需要                                          | 纯 CSS 策略，JS 仅需 `ContainmentLevel` 枚举 |
| Desktop OS 通信 | **需要** `AppBus` + `CapabilityRegistry`        | 这是全新的 OS 服务发现层                     |
| 协作 UI         | **需要** `PresenceStore` + `RemoteCursorEngine` | 全新的多用户状态模型                         |
| 遥测 SDK        | **需要** `TelemetrySink` 接口                   | 新的观测性契约层                             |

### 3.3 向后兼容策略

```
表单向导分支：✅ 零断变（optional field）
CSS 渲染优化：⚠️ 需要两阶段（默认 off → opt-in → on-by-default）
Desktop OS 通信：✅ 零断变（optional field）
协作 UI：✅ 零断变（新包，独立导入）
遥测 SDK：✅ 零断变（可选 IrisProvider prop）
```

---

## 4. 技术选型

### 4.1 是否需要引入新技术栈

| 方向            | 技术选型                                                                                                                               | 选项权衡                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 表单向导分支    | **无需新依赖**                                                                                                                         | 纯 TypeScript 实现条件求值 + DAG 检测                                                                                                                      |
| CSS 渲染优化    | **无需新依赖**                                                                                                                         | 纯 CSS，JS 仅需类型枚举                                                                                                                                    |
| Desktop OS 通信 | 选项 A：`BroadcastChannel` API（浏览器原生）                                                                                           | ✅ 零依赖，跨标签页 ✅ 简单（~50行包装） ❌ 不兼容 SharedWorker（可 fallback）                                                                             |
|                 | 选项 B：`SharedWorker`（浏览器原生）                                                                                                   | ✅ 跨标签页共享状态 ✅ 支持复杂 app 生命周期 ❌ iframe 中不支持                                                                                            |
|                 | **建议：先 A 后 B**。初期用 BroadcastChannel（最简单），需要状态共享时升级到 SharedWorker                                              |
| 协作 UI         | 选项 A：**自建**轻量协作原语                                                                                                           | ✅ 零外部依赖 ✅ 与 Iris core 类型系统无缝集成 ❌ 缺少 CRDT 基础库（需要自己实现冲突解决）                                                                 |
|                 | 选项 B：**集成 Yjs**（成熟 CRDT 库）                                                                                                   | ✅ 经过验证的 CRDT 引擎 ✅ 原生支持 Awareness Protocol（Yjs 内置 Presence） ✅ CodeMirror 6 集成已有（可复用） ❌ ~40KB 体积增量 ❌ 需要适配成 Iris plugin |
|                 | **建议：`@iris-ui/collaboration` 自建 Presence/光标 UI 层，底层 CRDT 可插拔** —— 初期用 `BroadcastChannel` mock 协作数据，后期接入 Yjs |
| 遥测 SDK        | **无需新依赖**                                                                                                                         | 纯 TypeScript + `Sink` 接口标准化。用户自选后端（Datadog/Sentry/自建）                                                                                     |

### 4.2 第三方依赖评估标准

参照项目现有实践（无外部状态库、无 CSS-in-JS、无通用 UI 库），评估标准应为：

| 标准                 | 权重   | 说明                                                    |
| -------------------- | ------ | ------------------------------------------------------- |
| 体积增量             | **高** | 必须是 tree-shakeable。Yjs ~40KB 是协作方向的可接受上限 |
| 框架无关性           | **高** | 依赖必须是纯 JS/TS，不耦合任何框架                      |
| SSR 兼容             | **中** | Yjs 在 SSR 中静默即可，协作方向不是 SSR 优先            |
| 与 Iris 类型系统对齐 | **高** | 依赖类型定义必须完整                                    |
| 许可合规             | **中** | Yjs 是 MIT，兼容                                        |

### 4.3 自建 vs 集成决策框架

```
自建条件：
  ✓ 能力是核心差异化（Presence UI、AppBus）
  ✓ 需要与 Iris core 类型系统无缝集成
  ✓ 体积敏感（core 10KB 预算）
  → 自建：AppBus、CapabilityRegistry、PresenceStore、TelemetrySink、FormStepCondition

集成条件：
  ✓ 能力是成熟领域（CRDT 同步、CodeMirror 协作绑定）
  ✓ 社区经过验证（Yjs 9000+ stars）
  ✓ 自建成本高（CRDT 算法实现需 1-2 个月）
  → 集成：Yjs（底层 CRDT）、y-codemirror.next（编辑器协作绑定）
```

---

## 5. 实施路线图

### 5.1 优先级排序

```
P0（当前）：保持现有质量门 + 发布 pipeline 稳定
P1（下一个迭代）：表单向导分支 + CSS 渲染优化  ← 成本最低，影响最直接
P2（Desktop OS 发布前）：Desktop OS 应用间通信  ← Desktop OS 完整性必需品
P3（企业版 / 生态版）：协作 UI 原语 + 遥测 SDK  ← 重型投入
```

### 5.2 阶段划分

#### 阶段 1：Quick Wins（1-2 周）

| 任务                                              | 方向         | 工作量          |
| ------------------------------------------------- | ------------ | --------------- |
| `FormStep.shouldSkip` 可选字段实现                | 表单向导分支 | core ~80 行     |
| `nextStep()` 循环跳过逻辑重写                     | 表单向导分支 | core ~50 行     |
| `detectCycle()` DAG 验证函数                      | 表单向导分支 | core ~50 行     |
| `ContainmentLevel` 枚举 + `ContainmentProps` 工厂 | CSS 优化     | core ~60 行     |
| Layer 3 布局组件 containment 声明                 | CSS 优化     | 各组件 ~5 行/个 |

**门禁**：`pnpm turbo run test typecheck lint build` 全绿 + 新测试覆盖

#### 阶段 2：Desktop OS 通信协议（2-3 周）

| 任务                                          | 工作量                     |
| --------------------------------------------- | -------------------------- |
| `createAppBus()` 实现（BroadcastChannel 桥）  | core ~150 行               |
| `AppCapability` 类型 + `CapabilityRegistry`   | core ~150 行               |
| 四壳 `os.ts` 重构：消费 AppBus → 删除重复状态 | 每壳 ~50 行删改 + 测试调整 |
| catalog 条目扩展：首批 3 个 app 声明能力      | 各壳 catalog.ts 修改       |
| Desktop OS 集成测试（跨 app 通信场景）        | 各壳 ~50 行                |

**门禁**：跨 app 调用集成测试通过（Files → ProTable .csv 打开）

#### 阶段 3：协作 UI 原型（4-6 周）

| 任务                                  | 工作量         |
| ------------------------------------- | -------------- |
| `createPresenceStore()` 实现          | core ~150 行   |
| `createRemoteCursorStore()` 实现      | core ~200 行   |
| 四框架 `IrisRemoteCursorOverlay` 组件 | 各框架 ~100 行 |
| 四框架 `IrisPresenceAvatar` 组件      | 各框架 ~80 行  |
| Yjs 集成适配（可选底层）              | 独立包 ~300 行 |
| 协作测试夹具 + 集成测试               | ~200 行        |

**门禁**：双浏览器窗口可通过 BroadcastChannel 看到对方光标移动

#### 阶段 4：遥测 SDK（2-3 周）

| 任务                                              | 工作量          |
| ------------------------------------------------- | --------------- |
| `TelemetrySink` 接口 + `createTelemetryCollector` | core ~120 行    |
| IrisProvider 遥测 prop 集成                       | 四框架各 ~30 行 |
| React Profiler / Vue hook / Svelte $effect 适配   | 各框架 ~50 行   |
| 事件委托交互采集                                  | core ~80 行     |
| 文档 + 使用示例                                   | 文档 ~50 行     |

**门禁**：示例页面 10 次点击 → TelemetrySink 收到 10 个交互事件

### 5.3 风险点和缓解策略

| 风险                                           | 概率 | 影响                        | 缓解策略                                                                                             |
| ---------------------------------------------- | ---- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| **CSS containment 导致 token 继承中断**        | 高   | 高（组件视觉损坏）          | 阶段 1 只应用于无 CSS 变量依赖的布局组件；阶段 2 接入 token injection 机制后扩展到全组件             |
| **BroadcastChannel 在 iframe/Safari 中不兼容** | 中   | 中（Desktop OS 通信不可用） | 提供 `MessageChannel` fallback 桥接 + 文档提示浏览器兼容性                                           |
| **协作 UI 性能低（20 光标同时移动）**          | 中   | 高（用户感知卡顿）          | 1) requestAnimationFrame 合并 2) 空间采样（光标移动 <3px 不更新）3) 虚拟化光标（不渲染所有远程光标） |
| **遥测 SDK 在 SSR 中误触发**                   | 低   | 中（污染遥测数据）          | `typeof window === 'undefined'` 守卫 + SSR 检测 flag                                                 |
| **四框架协作组件不一致（渲染差异）**           | 中   | 中（品牌体验不一致）        | 为协作组件编写跨框架视觉回归测试（E2E + screenshot diff）                                            |
| **plugin-form-builder 无法消费分支步骤**       | 低   | 中（低代码场景推迟）        | form-builder 在阶段 2 接入条件步骤——与分支协议同迭代                                                 |

### 5.4 里程碑总结

```
Week 1-2:  里程碑 1 — 表单向导分支 + CSS containment 就绪
           交付：FormStep.shouldSkip + 布局组件 containment
           验证：现有 demo 表单零变化 + Perf 基准无退化

Week 3-5:  里程碑 2 — Desktop OS 应用间通信完成
           交付：AppBus + CapabilityRegistry + 四壳集成
           验证：Desktop OS demo "Files → ProTable" 跨 app 打开

Week 6-11: 里程碑 3 — 协作 UI 原型可用
           交付：PresenceStore + RemoteCursor + 四框架组件
           验证：双窗口光标同步 demo

Week 12-14:里程碑 4 — 遥测 SDK 发布
           交付：TelemetrySink + IrisProvider 集成 + 文档
           验证：playground 集成遥测仪表盘 demo
```

---

## 总结

Iris UI 的现有架构是**经过验证的**——core-centric 分层、A/B/C 分类心智模型、插件契约、token 驱动——这些设计决策使其成为 AI 原生、框架无关的 UI 基础设施的领先者。

五个扩展方向不是零散功能堆积，而是填补当前架构的**结构性空白**：

- **表单向导分支**：补全表单系统的最后一个生产能力鸿沟——最直接的工程 ROI
- **CSS 渲染优化**：打破「token 系统越丰富，性能成本越高」的反比——架构级的性能投资
- **Desktop OS 应用间通信**：让四个壳的应用模型从「窗口集合」进化为「操作系统」——架构完整性投资
- **协作 UI 原语**：从单用户到多用户——架构能力的数量级跃迁
- **遥测 SDK**：从构建时静态质量到运行时动态可观测——质量基建的闭环

建议立即启动「P1 Quick Wins」阶段（表单向导分支 + CSS containment），在保持当前质量门禁的前提下，以最低成本填补最明显的能力缺口。
