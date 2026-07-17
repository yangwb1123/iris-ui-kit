# 架构师分析：Iris UI 四框架架构深层评估

> 基于上述 5 方向源码验证文档，结合 `AGENTS.md` 项目上下文，从架构和技术设计角度进行整体评估。

---

## 1. 架构评估

### 1.1 核心优势：已验证的架构模式

| 优势                                              | 验证支撑                                                                                                 | 架构价值                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **「逻辑下沉 core，适配器做薄桥」原则被严格执行** | 5 个方向的分析全部指向 core 层，框架桥仅有反应式/订阅差异，无业务逻辑泄露                                | 这是多框架架构**唯一正确的路径**，项目已形成正循环       |
| **核心控制器架构清晰**                            | `createSelectionModel`、`createExpansion`、`data-view` 管线的 store + derived 模式在多个方向被验证为一致 | 这使 4 框架的同名同语义导出成为可能                      |
| **四框架实现深度对齐**                            | 方向五证明 Vue/Solid/Svelte 三者的 `useStore` 实现机制几乎相同（同步初始化+订阅），React 是唯一的异构体  | 三条桥已经模板化，新增框架（Angular/Qwik）的成本预估准确 |
| **Store 系统的 batch 机制正确**                   | 方向一确认 `batchDepth` + `pendingFlush` 的设计是正确的，框架桥叠加自身 batch 是合理架构                 | 这是跨框架一致性的基础保障                               |

### 1.2 架构局限：5 方向揭示的深层问题

验证文档中 5 个方向实际上暴露了架构的**三类典型裂缝**：

#### 裂缝 A：四桥接口契约未形式化（方向一、五）

当前四条桥的实现是**同构但有差异**的——它们共享了 intent（「订阅 store，响应更新」），但缺少一份**形式化的桥契约清单**来约束：

- `setState` 对函数类型参数的处理方式（方向一——Solid 有 thunk 防护，其他没有）
- 初始化时机的同步性（方向五——React 有 useEffect 窗口）
- `batch` 的跨框架一致行为

这是**最本质的架构债务**：四条桥之间的关系是靠「人读代码来对照」，而非一份契约来约束。

#### 裂缝 B：跨组件时序一致性无防护（方向二、三）

两个问题都指向同一源头：**衍生状态和副作用的时序未被显式建模**：

- `derived` 的引用计数退订/重订没有区分 StrictMode remount 和真正的销毁
- `mutate` 的乐观回滚没有版本标记，并发写入不安全

这是「core 是纯逻辑之家」这一原则执行时**无意留下的灰色地带**——纯逻辑层假设了「理想的时序调用」，而实际运行时（尤其是 React）永远不会是理想时序。

#### 裂缝 C：自动化测试覆盖率未达到「架构承诺」级别（方向四）

组件数量 151，水合测试覆盖 16（占 SSR-safe 的 13.9%）。这个比例是**当前最大的技术债**——不是因为测试少，而是因为：

> 架构承诺了「四框架对齐、SSR 安全」，但交付流水线没有为这个承诺提供自动化闸门。

`manifest.json` 已经扫描了所有组件，`gen:manifest` 已经自动化了组件清单——但**没有从 manifest 到 hydration test 的生成管线**，这就是「自动化断裂链」。

### 1.3 关键设计决策评估

| 决策                                                    | 评估                                                                                                                | 回顾性判断                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Store 用 `getState`/`setState`/`subscribe` 同步 API** | 正确。这使得 Solid（`createSignal`）和 React（`useSyncExternalStore`）都能同步初始化，唯一不匹配点在 useEffect 窗口 | **正确**。异步 store 会让四桥复杂度×指数                                   |
| **`derived` 用引用计数懒订阅**                          | 正确且高效。但未处理 StrictMode remount 的「同一 listener 重复 add/remove」模式                                     | **架构上正确，实现可优化**                                                 |
| **`mutate` 乐观更新用 snapshot + 回滚**                 | 功能上正确。但无版本标记、无 batch 包裹                                                                             | **对未来不充分**——适用于单用户操作，不适用于协作/多 tab 场景               |
| **四条桥各自独立手写**                                  | 已验证 React 有窗口，其他三条几乎相同。如果抽一条 `createFrameworkBridge` 抽象，可以为 Angular/Qwik 降低 70% 成本   | **架构机会成本**——手写四条桥导致没有抽象出「桥契约」                       |
| **SSR 测试集中式（per-framework 13 cases）**            | 16/115 覆盖率说明只能覆盖「架构是否可跑」，不能覆盖「每个组件是否正确出水合」                                       | **到转折点了**——13 个 case 证明 SSR 整体架构可行，但继续手写不是可持续方式 |

### 1.4 技术债评分与缓解

| 债务项                        | 等级           | 引入阶段                   | 修复成本                              | 不修复后果                                             |
| ----------------------------- | -------------- | -------------------------- | ------------------------------------- | ------------------------------------------------------ |
| 桥契约未形式化                | **P1 架构债**  | 第一条桥（React）创建时    | 中（抽象 + 类型工具）                 | 后续框架仍需手动排查差异；每次 core 变更可能引入不对称 |
| SSR 测试无自动化管线          | **P1 测试债**  | SSR 测试创建时（始终手写） | 中（manifest-driven generator）       | 覆盖率随组件数量线性下降；新贡献者不感知               |
| `mutate` 无版本标记           | **P2 设计债**  | `data-source.ts` 初版      | 低（条件写入 + epoch）                | 仅当 mutate 期间不锁 UI 时触发；当前实践掩盖了问题     |
| React `useStoreSelector` 窗口 | **P3 效率债**  | React 桥初版               | 低（useSyncExternalStore + 缓存快照） | 一次额外渲染，无数据丢失                               |
| `derived` StrictMode 退化     | **P3 DevX 债** | `store.ts` derived 实现    | 低（同一 listener 判定延迟）          | Dev 环境 2× 计算，不影响 Prod                          |

---

## 2. 扩展方向（3-5 个高价值方向）

### 方向 A：「形式化桥契约」(Bridge Contract Formalization)

> **目标**：将四条桥的「心照不宣」变成一份类型级契约 + 一套跨框架合规测试套件。

#### 为什么需要

方向一（函数值 bug）和方向五（React 窗口）本质上是一个问题的两面：**没有一份文档/Types 约束告诉每条桥「必须实现什么行为」**。当前是靠 code review 和「人对照四条桥源码」来维持一致性。这意味着：

- 每条桥有各自独立的隐式假设（函数参数处理、初始化时机、batch 边界）
- Angular/Qwik 的桥作者需要自己逆向三条桥的差异点

#### 核心挑战

**挑战 1**：框架的反应式原语不同（`useSyncExternalStore` vs `shallowRef` vs `createSignal` vs `readable`），如何在抽象级别定义「桥行为」而不泄露框架细节？

**建议**：定义一份**行为规格清单**（不是代码，而是可断言的规格）：

```
IObservableStore<T> {
  getState(): T
  setState(next: T | ((prev: T) => T)): void
  subscribe(listener: (state: T) => void): () => void  // 返回 unsubscribe
  // 规格：
  // - setState 传入函数时，接收当前 state 返回新 state（必须，框架适配器不能调用它）
  // - subscribe 在 setState 后同步触发（React 可 batch 延迟）
  // - 初始化时 getState() 必须返回初始值（同步）
}
```

这份规格对每条桥的测试来说是可判定的。不需要一个统一的运行时，只需要一个统一的测试矩阵。

**挑战 2**：当前的 `batch` 实现是 core 的；框架桥叠加了各自的 batch（React 的 `unstable_batchedUpdates`、Solid 的 `createBatch`）。跨框架 batch 下的渲染次数一致性怎么测？

**建议**：不要追求「完全相同渲染次数」，而是追求 **batch 收敛后 state 一致**。跨框架合规套件只验证：

1. 批量更新后所有订阅者最终收到正确的 state
2. 在 `batch` 内多次 `setState` 只触发**至多一次**核心订阅者通知

#### 预期的架构变更

- `packages/core/src/store.ts` 的上方扩展一份 `types/Spec.ts`（行为规格的类型注解）
- `packages/core/src/__specs__/bridge.compliance.test.ts`：**框架无关的桥测试**，每条桥 import 一个 `createBridgeComplianceSuite(bridgeFactory)` 来跑相同的断言集合
- 现有四条桥各补一个指向该合规套件的测试入口

#### 对现有系统的影响

- **低**。不改变 core 代码，只增加测试设施
- 新增桥时不再需要逆向工程，`createBridgeComplianceSuite` 会自动验证一致性

---

### 方向 B：「SSR 水合测试自动生成管线」(Hydration Test Auto-generation Pipeline)

> **目标**：从 `manifest.json` 自动生成每个组件的基础 SSR 渲染 + 水合测试，将覆盖率从 13.9% 提升至 90%+。

#### 为什么需要

方向四的验证已经表明：当前覆盖率（16/115 SSR-safe ≈ 13.9%）是「人工扩容不可持续」的典型案例。架构承诺了全部组件支持 SSR，但交付链中没有对应的质量门。

更重要的是：**水合失败是一种「静默错误」**——渲染端正常输出 HTML，客户端不报错，但事件绑定丢失或 state 不匹配。手动发现水合失败需要在浏览器中观察交互异常，测试成本极高。

#### 核心挑战

**挑战 1**：不是所有组件都可以自动装配。Button 可以（传 label prop），但 Table 需要 columns + data，Calendar 需要日期 props。自动化生成要解决「智能 fixture」问题。

**建议**：采用**三层 fixture 策略**：

1. **Primitive 级别**（Button/Input/Badge 等，~L1 原语）：manifest 的 `type: 'primitive'` 字段打标，自动生成最小 prop fixture（`<IrisButton>Hello</IrisButton>`）
2. **复合组件级别**（Table/Tree/Calendar 等，~L2+）：在 manifest 中添加 `fixture: './path/to/fixture.tsx'` 字段，允许为每个组件提供一个示例数据文件的路径
3. **fallback**：没有 fixture 的组件在测试报告中标记为 `⏭️ skipped`，而不是失败——这样新组件默认产生一个可行动的待办项

**挑战 2**：如何跨框架复用 fixture？React 的 fixture 用的是 JSX，但 Vue 的 fixture 需要模板语法。

**建议**：fixture 的定义**使用 core 的组件 Props 类型，用 JSON 格式**作为 fixture source，然后由生成器根据框架转换为对应的模板代码。例如：

```json
{
  "component": "IrisPagination",
  "props": { "total": 100, "pageSize": 10, "current": 1 }
}
```

四框架各有一个简单的渲染器将这个 JSON 渲染为框架对应的代码（`<IrisPagination total={100} pageSize={10} current={1} />`）。

#### 预期的架构变更

- **`manifest.json` 扩展**：新增 `ssrSafe: boolean`、`type: 'primitive' | 'composite' | 'overlay' | 'plugin'`、`fixture?: string`（指向 JSON fixture）
- **新增 `@iris-ui/ssr-test-gen` 包**：读取 manifest + fixture JSON → 为四框架各生成 Vitest 测试文件
- **CI 集成**：`pnpm gen:ssr-tests` 在 `gen:manifest` 后执行，生成的测试文件 `packages/*/src/__ssr__/*.test.ts`
- **质量门**：`pnpm check:ssr-coverage` 计算覆盖率，低于阈值（如 80%）则 CI 失败

#### 对现有系统的影响

- **中**。需要创建新包，修改 manifest 生成逻辑，但不会改变现有组件的实现
- 已手动编写的 13 个 SSR case 可以保留作为「黄金案例」，新生成的测试不覆盖它们
- **关键注意**：Solid 和 Svelte 的 SSR 测试需要多一步——它们需要 `renderToString` 环境（与 React/Vue 不同），生成器需要感知框架差异

---

### 方向 C：「乐观更新事务化」(Optimistic Mutation Transaction Layer)

> **目标**：为 `data-source.ts` 的 `mutate` 引入事务语义——版本标记、条件回滚、batch 包裹，使乐观更新在并发写入下安全。

#### 为什么需要

方向三确认了当前 `mutate` 的 `snapshot → 乐观更新 → action → 回滚` 模式有**竞态窗口**：如果在 (B) 乐观更新后、(D) 回滚前，中间有另一个操作（分页/排序/筛选）改变了 store，回滚会无条件用旧数据覆盖当前数据。

这个问题的严重性在于：**当前不触发是因为 UI 层在 mutate 期间锁了交互，但没有框架级保障**。一旦某个插件或高阶组件不锁交互，就会产生静默数据损坏。

#### 核心挑战

**挑战 1**：乐观更新的事务化会引入复杂度。需要权衡：是做一个轻量的 seq token 方案（方向三原方案），还是做一个更通用的乐观事务层？

**建议**：采用**双阶段设计**——先做轻量 epoch 方案（P1），再在未来需要时做通用乐观事务（P2）。

**P1 - Epoch 保护**：

- DataSource store 增加 `_epoch: number` 字段
- `mutate` 在乐观更新前记录 `currentEpoch`，写入 `_epoch + 1`
- 回滚时使用 `setState` 的条件写入形式：`(prev) => prev._epoch === trackedEpoch + 1 ? { ...prev, rows: snapshot } : prev`
- 这个方案不保证嵌套 mutate 正确，但保证**简单并发写入**不会产生数据损坏

**P2 - 乐观事务管理器**（未来）：

- 引入 `createOptimisticTransaction<T>`：持有 `baseState: T`、`operations: Op[]`、`committedVersion: number`
- `mutate` 返回一个 `{ commit, rollback }` 句柄，支持外部协调
- 支持多个乐观更新在同一 base 上叠加（类似 Optimistic UI 的 `useOptimistic` 模式）

**挑战 2**：epoch 方案与 `batch` 的交互——如果 `mutate` 乐观更新在 `batch` 内，epoch 递增是否应该触发重新渲染？

**决策**：epoch 是 store 内部状态，不暴露给 UI。`setState` 的正常比较逻辑（`eq`）确保 epoch 变更不引起 UI 重渲。epoch 只在回滚时做条件判断。

#### 预期的架构变更

- `packages/core/src/data-view/data-source.ts`：
  - Store 类型扩展 `_epoch: number`
  - `mutate` 实现增加 epoch 追踪和条件回滚
  - 可选项：将 `mutate` 包裹在 `batch` 中，确保乐观更新+异步 action 后续的 setState 在一个 batch 内
- 不需要新增包，不需要修改框架桥

#### 对现有系统的影响

- **低**。内部实现变更，对外 API 不变（`mutate` 签名不变）
- 现有依赖 `mutate` 的组件（`createResourceController` 等）无需修改
- 新增 `mutate` 的回滚保护是纯加法，不会破坏现有行为

---

### 方向 D：「组件 QA 自动化扫描」(Component QA Automation Scanner)

> **目标**：在 CI 中自动化扫描每个组件的 SSR 安全标记、a11y 属性完整性、i18n 按键存在性、skin token 覆盖率，将 AGENTS.md 中列出的质量门从「人脑记」变为「自动扫」。

#### 为什么需要

AGENTS.md 中列出了丰富的质量门：SSR 安全（`'use client'` / 无 DOM 测试）、axe 无障碍、i18n 可覆盖、皮肤 token... 但**这些是「知道该做，但无人验证是否做了」**的规范。方向四的 SSR 测试缺口只是冰山一角——还有更多不可见的缺口：

- 新组件是否遗漏了 `'use client'` 指令？
- 新组件是否使用了非 token 的硬编码颜色？
- 新组件是否缺少 i18n key？是否缺少 `data-testid`？
- 新组件的 skin token 是否被 tokens 包兜底？

#### 核心挑战

**挑战 1**：每个扫描规则首先要**排除误报**。例如，`IrisIcon` 不需要 `'use client'`（纯 SVG），扫描器需要感知组件的类型分类。

**建议**：引入 `manifest.json` 中 `type` 字段（方向 B 也需要的），作为扫描器行为开关：

```json
{
  "IrisButton": { "type": "primitive", "ssrSafe": true, "rscDirective": true },
  "IrisIcon": { "type": "primitive", "ssrSafe": true, "rscDirective": false },
  "IrisDialog": { "type": "overlay", "ssrSafe": false, "rscDirective": true }
}
```

**挑战 2**：扫描器需要跨框架通用。但 `'use client'` 是 React 独有；Vue/Svelte 的 SSR 安全判定标准不同。

**建议**：扫描器采用**插件化规则架构**：

```
core-rules/       # 框架无关规则
  - no-hardcoded-colors       # 扫描 CSS var(--iris-*) 使用
  - token-exists-in-theme     # 验证 skin token 在 tokens 包中

react-rules/
  - has-use-client-directive  # 检查 'use client'
  - no-dom-in-ssr             # 检查 window/document 引用

vue-rules/
  - ssr-friendly-template     # 检查 template 中 client-only API

shared-rules/
  - i18n-key-exists           # 检查 t('key') 中的 key 在默认字典中
  - data-testid-present       # 检查 data-testid 属性
```

#### 预期的架构变更

- **新增 `@iris-ui/qa-scanner` 包**：CLI 工具 + API
- **manifest.json 扩展**（与方向 B 共享的 type/ssrSafe 字段）
- **CI 集成**：在 `lint` 阶段后运行，`pnpm qa:scan`，结果写入 `qa-report.json`，PR 注释中显示
- 现有组件首次扫描会产生大量「已存缺口」，用 `qa-baseline.json` 锁定当前状态，只防止新退化

#### 对现有系统的影响

- **中**。需要创建新包 + 完善 manifest 的 type 字段
- 首次扫描结果可能大量失败——需要至少 1-2 天的「清扫冲刺」来修复已知缺口
- 长远收益高：新组件必须在 QA 扫描通过后才能合入

---

### 方向 E：「桥生成器 + Angular/Qwik 桥」(Bridge Generator + New Framework Bridges)

> **目标**：在桥契约形式化（方向 A）之后，创建一个**桥生成器 CLI**，从契约自动产出桥的骨架代码，并基于此实现 Angular 和 Qwik 的完整桥。

#### 为什么需要

1. **业务价值**：Angular 在企业级市场（CMS 受众）的渗透率极高；Qwik 在「极致 SSR/水合」场景有差异化优势
2. **技术价值**：如果从四条手写桥可以抽象出一个生成器，说明架构成熟度到了「可复制的模式」级别——这是架构师最想看到的信号
3. **验证方向 A 的成果**：方向 A 的桥契约如果足够精确，它应该可以驱动代码生成；如果生成器产出需要大量手动修复，说明契约不够精确

#### 核心挑战

**挑战 1**：生成器如何产出「不是最差，而是符合社区习惯」的代码？自动生成的桥代码可能可读性差或缺少惯用写法。

**建议**：生成器产生**「70% 骨架 + 30% 手动填充」**——自动产出 store 桥接、状态同步、基本类型映射；手动填充的是「框架特有的惯用模式」（如 Angular 的 `@Output()` 声明、Qwik 的 `$()` 序列化标记）。生成器用注释标记 `// 🛠️ MANUAL: ...` 指示手动填充点。

**挑战 2**：Angular 的信号（Signal）和 Qwik 的 `useSignal` 都是信号原语，但 API 差异大。如何让桥生成器感知「框架信号 API」而非「框架名称」？

**建议**：桥生成器接收一份**框架元数据 JSON**，描述该框架的反应式原语签名，而不是框架名硬编码：

```json
{
  "name": "angular",
  "signals": {
    "state": "signal<T>(initial: T): WritableSignal<T>",
    "derived": "computed<T>(fn: () => T): Signal<T>",
    "effect": "effect(fn: () => void): EffectRef",
    "subscribe": "onDestroy(fn: () => void): void"
  },
  "rendering": {
    "templateLang": "html",
    "componentDir": "src/lib/"
  }
}
```

这样，即使不支持 Svelte 5 runes 的旧版 Qwik，也可以用不同的元数据生成对应的桥。

#### 预期的架构变更

- **新增 `@iris-ui/bridge-gen` 包**（CLI）：`pnpm iris-bridge-gen --framework angular --registry ../../packages`
- 生成器产出的 Angular 桥在 `packages/angular/` 中，Qwik 桥在 `packages/qwik/` 中
- 框架元数据 JSON 保存在 `packages/bridge-gen/frameworks/` 中
- 新桥的测试自动从方向 A 的合规套件生成

#### 对现有系统的影响

- **高**。创建生成器和两条新桥是重大投入
- 但生成器自身不影响现有四条桥（它们仍手写，保持不变）
- 现有桥可以逐步**重构**为生成器产出——但这不应该在 v1 中做
- **不建议在 Angular/Qwik 桥完全稳定前将 React/Vue/Solid/Svelte 桥替换为生成产出**——现有桥经过大量测试和迭代，替换的成本大于收益

---

## 3. 接口设计建议

### 3.1 核心接口原则建议

当前 `@iris-ui/core` 的 store/controller 接口设计总体合理。基于 5 方向分析，建议增加以下设计原则：

#### 原则 1：「所有可变操作应返回版本标记」

当前 `store.setState` 返回 `void`。建议改为返回 `number`（新版本号）：

```ts
setState(next: T | ((prev: T) => T)): number  // 返回更新后的版本号
```

**理由**：

- 方向三的 epoch 方案可以直接复用这个返回值
- `batch` 内部多次 `setState` 时，只有最后一个版本号暴露给外部
- 不改变现有调用点的 API（返回 `void` 的调用忽略返回值）

**向后兼容**：是。`void` 兼容性意味着所有现用 `store.setState(...)` 不受影响。

#### 原则 2：「框架桥应实现 `IObservableStore`」

如方向 A 所述，定义一个 `IObservableStore<T>` 接口，每条桥 import 后实现。这将：

- 明确每条桥必须提供的方法
- 允许 `createBridgeComplianceSuite` 有一个稳定的测试入口
- 让生成器（方向 E）知道产出什么

#### 原则 3：「`derived` 应提供 subscribe 的生命周期上下文」

当前 `derived` 的 `ensureSubscribed/maybeUnsubscribe` 模式无法区分「同一 listener 的 StrictMode remount」和「真正的销毁」。建议在 `subscribe` 签名中增加可选的 `listenerId`（框架在 bridge 层传递 React 组件 identity）：

```ts
subscribe(listener: (state: T) => void, listenerId?: symbol): () => void
```

框架桥在 mount 时用 `Symbol()` 生成 id，在 unsubscribe 时传入同一 id。`maybeUnsubscribe` 判断：如果同一 id 的订阅在同一个 tick 内 add→remove→add，延迟退订。

### 3.2 是否需要新的抽象层

| 候选抽象           | 建议                                      | 理由                                                                                                                                                             |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **跨框架桥抽象层** | ⚠️ **暂不引入运行时抽象，先引入测试契约** | 四条桥已稳定且完全手写。引入运行时抽象（如一个统一的 `createBridge` 函数）会改变现有代码结构，风险大而收益有限。先做契约（方向 A）和测试，再考虑是否值得统一实现 |
| **乐观更新事务层** | ✅ 引入轻量版 (P1)                        | 当前 `mutate` 的 epoch 方案在 DataSource 内部实现，不对外暴露 API，风险低                                                                                        |
| **SSR 测试生成层** | ✅ 引入新包                               | 与已有测试体系解耦，独立演化                                                                                                                                     |
| **组件 QA 扫描层** | ✅ 引入新包                               | 作为 Lint 的扩展，插件化规则架构                                                                                                                                 |

### 3.3 向后兼容性策略

所有建议变更遵循以下规则：

1. **现有 API 签名不变**：`store.setState` 返回值从 `void` → `number` 是向上兼容的
2. **manifest.json 扩展**：新增字段（`type`, `ssrSafe`, `fixture`）是可选字段，现有解析器不会崩溃
3. **新包不改变现有包**：`@iris-ui/ssr-test-gen`、`@iris-ui/qa-scanner`、`@iris-ui/bridge-gen` 都是独立包
4. **新增 epoch 字段在 store 内**：`_epoch` 以下划线前缀，表示「内部实现细节，不保证 API 稳定性」
5. **桥契约的类型接口**：只作为类型约束引入，不需要桥重写现有代码——如果现有桥的类型签名兼容，不需要修改；如果现有桥有微小不兼容，TypeScript 会指出，修正成本低

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

| 方向         | 技术栈需求        | 推荐方案                                | 理由                                                               |
| ------------ | ----------------- | --------------------------------------- | ------------------------------------------------------------------ |
| 桥契约测试   | 无——纯 TypeScript | 现有 Vitest 即可                        | 不需要新框架，只需要组织好断言                                     |
| SSR 测试生成 | 模板引擎          | 直接用 TypeScript AST（`ts-morph`）操作 | 生成的是代码文件，不是运行时模板。ts-morph 允许类型安全的 AST 操作 |
| QA 扫描器    | AST 解析器        | `ts-morph` + `postcss`（CSS 扫描）      | ts-morph（TypeScript）和 postcss（CSS 变量扫描）是成熟组合         |
| 桥生成器     | 模板引擎          | `ejs` 或 `handlebars`                   | 生成器产出的是代码骨架，模板引擎够用且轻量                         |
| 新框架桥     | 目标框架本身      | Angular 18+ (Signals) / Qwik 1.x        | 两者都基于信号原语，与 core 的同步 store 模型天然匹配              |

**不推荐的引入**：

- ❌ Playwright 或 Cypress 做 SSR 测试——太重，`renderToString` + jsdom 更适合 CI
- ❌ ESLint 自定义规则做 QA 扫描——规则太复杂（需要文件间交叉引用），独立扫描器更灵活
- ❌ 运行时依赖注入框架——core 是零框架依赖，不应引入 DI

### 4.2 第三方依赖评估标准

为这些方向选择第三方依赖时，应遵循以下标准（按优先级）：

1. **零运行时依赖**（或仅 devDependency）：扫描器/生成器是构建时工具，不应进入生产包
2. **TypeScript 原生支持**：类型定义必须一流（`@types/*` 是减分项）
3. **Tree-shakeable**：如果不得不在运行时使用（如桥生成器的模板引擎用于 CLI），应该可以被 tree-shake
4. **维护活跃度**：Commits < 3 个月即视为 warning，< 6 个月视为 blocker
5. **License 兼容**：MIT/Apache 2.0 首选，GPL 系列 blocker

### 4.3 自建 vs 采购决策

| 需求          | 自建                   | 采购/复用                                                        | 决策                                           |
| ------------- | ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| SSR 测试生成  | ✅ 需要自建            | 市面上无现成的「component manifest → SSR test generator」        | 自建，利用现有 manifest 数据                   |
| QA 扫描器规则 | 部分自建（core rules） | 复用 `eslint-plugin-jsx-a11y`、`stylelint`、`eslint-plugin-i18n` | 混合策略：扫描器编排现有工具，再叠加自定义规则 |
| 桥生成器      | ✅ 需要自建            | 市面上无「存 cross-framework store bridge generator」            | 自建，但利用 `ejs`/`handlebars` 模板引擎       |
| 乐观事务      | ✅ 需要自建            | 现有乐观更新库（如 `@tanstack/query`）不适应 Iris store 模型     | 自建轻量方案                                   |

---

## 5. 实施路线图

### 5.1 优先级排序

| 优先级 | 方向                                | 标识                                                | 理由                                               |
| ------ | ----------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| **P0** | 方向 B：SSR 水合测试自动生成        | 🔴 当前覆盖率 13.9% 是架构承诺和交付之间的最大缺口  | 每次新增组件都在扩大缺口；自动化后一劳永逸         |
| **P0** | 方向 C：乐观更新事务化（P1 轻量版） | 🟠 epoch 方案：实现难度低，消除一个潜在的数据损坏源 | 代码量小，风险低，收益直接                         |
| **P1** | 方向 A：桥契约形式化                | 🟡 奠定四桥一致性基础，也为 Angular/Qwik 做准备     | 不修复不影响当前系统的运行，但会持续制造信息不对称 |
| **P1** | 方向 D：QA 扫描器（核心规则子集）   | 🟡 从 a11y 和 RSC 指令扫描开始，逐步扩展            | 让 AGENTS.md 的质量门从「知道」变为「自动化验证」  |
| **P2** | 方向 E：桥生成器 + Angular/Qwik     | 🔵 重大投入，需要前 4 个方向提供的基础              | 生成器依赖桥契约；新框架桥依赖 SSR 测试管线        |
| **P2** | 方向 C：乐观事务管理器（P2 通用版） | 🔵 功能扩展                                         | 在 P1 验证 epoch 方案一年后再评估是否值得做通用版  |
| **P3** | 方向 A 的运行时统一桥抽象           | ⚪ 理论优雅但当前 ROI 低                            | 五条桥都生成后，运行时抽象的价值才显现             |

### 5.2 阶段划分与里程碑

```
Phase 1：基础加固（4-6 周）
├── 方向 C P1：DataSource epoch + 条件回滚（1 周）
│   ├── test: 并发 mutate + 分页变更测试
│   └── milestone: mutate 防竞态保护就绪
├── 方向 B P0：SSR 测试生成器最小可用（3-4 周）
│   ├── 第 1 周：manifest 扩展（type/ssrSafe/fixture 字段）
│   ├── 第 2 周：JSON fixture 模型 + 四框架渲染器（React/Vue/Solid/Svelte）
│   ├── 第 3 周：生成器 CLI 产出 Vitest 测试文件
│   └── milestone: 覆盖率从 13.9% → 60%+（manifest 中 type 已标明的组件全覆盖）
└── Phase 1 验收：pnpm check:ssr-coverage > 60%

Phase 2：质量自动化（6-8 周）
├── 方向 A：桥契约形式化（2-3 周）
│   ├── IObservableStore 接口定义
│   ├── createBridgeComplianceSuite 实现
│   ├── 四桥各接入合规套件测试
│   └── milestone: 四桥通过同一套合规测试
├── 方向 D：QA 扫描器最小可用（3-4 周）
│   ├── core-rules: token 扫描 + i18n key 扫描
│   ├── react-rules: 'use client' 扫描 + 无 window/document 引用
│   ├── CI 集成 + qa-baseline.json 基线
│   └── milestone: L1 primitives 全部通过 QA 扫描
└── Phase 2 验收：pnpm qa:scan 全部 L1 绿 + 四桥合规测试 100% 通过

Phase 3：能力扩展（8-12 周）
├── 方向 B 扩展：SSR 测试覆盖率目标 90%+（4 周）
│   ├── 为 L2 复合组件编写 JSON fixture
│   ├── overlay/portal 类组件标记为 ssr=false（不含水合测试）
│   └── milestone: 覆盖率 > 90%（排除 ssr=false 组件后）
├── 方向 E：桥生成器（4 周）
│   ├── 框架元数据 JSON 模型
│   ├── 生成器 CLI（ts-morph + ejs）
│   ├── 产出 Angular 桥骨架（20% 手动填充）
│   └── milestone: Angular 桥通过方向 A 合规套件 + 3 个基础组件渲染
└── Phase 3 验收：SSR 覆盖率 90%+ + Angular 桥 MVP

Phase 4：扩展成熟（12-16 周，规划性）
├── 方向 E 继续：Angular 桥全组件对齐
│   └── milestone: 四框架全组件 + Angular 桥（manifest 149 组件对齐）
├── 方向 E：Qwik 桥（复用生成器，4-6 周）
│   └── milestone: Qwik 桥 L1 原语就绪
├── 方向 A 扩展：桥生成器反向重构现有桥（可选）
│   └── 基于成本收益评估决定是否将 React/Vue/Solid/Svelte 桥切换为生成产出
└── 方向 D 扩展：扩展 QA 规则到 L2+ 组件
```

### 5.3 风险点和缓解策略

| 风险                                                                                   | 概率     | 影响                                  | 缓解策略                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SSR 测试生成器产出测试不稳定**（fixture JSON 不兼容实际 runtime）                    | 中       | 高——CI 产生误报降低信任               | 1) 生成的测试不替换手写黄金 case；2) fixture 首次生成后人工审查再合并；3) 添加 `expect(...).toMatchSnapshot()` 让开发者可以快速检查变化                                        |
| **epoch 方案误伤正常回滚**（epoch 被中间操作推进导致不应跳过的回滚被跳过）             | 低       | 中——乐观更新不回滚，数据留在错误状态  | 1) epoch 方案的语义是「只在不冲突时回滚」——在冲突时不回滚更安全；2) 增加 warning 日志记录 epoch 冲突；3) 通过测试验证：中间执行 `setPage(2)` 后的回滚不会覆盖 page 2 的 rows   |
| **桥契约约束了框架特有能力**（React 的 tearing prevention 无法用通用接口表达）         | 中       | 中——契约太严格会导致 React 桥降低性能 | 1) 契约只约定行为，不约定实现；2) `IObservableStore` 的 `subscribe` 返回 `void` 不限制 React 用 `useSyncExternalStore`；3) 合规测试只验证 functional correctness，不测渲染次数 |
| **Angular/Qwik 社区参与度不够**（生成了桥但没人维护）                                  | 中       | 中——长期维护成本                      | 1) 先在社区 survey 收集 Angular/Qwik 兴趣（GitHub issue）；2) 只做桥骨架 + 基础组件对齐，全组件对齐作为社区贡献者任务；3) 如果 3 个月内无活跃维护者，标记为「社区维护」        |
| **Phase 2 的 QA 扫描器产生大量噪音**（现有组件大量不达标）                             | 高       | 高——开发者抵触                        | 1) **必须引入基线机制**：`qa-baseline.json` 锁定当前状态，CI 只比较新 PR 是否引入新违规；2) 基线清扫作为一个独立的「快速清理 sprint」在 Phase 2 中安排 3 天                    |
| **桥契约合规测试在四个框架中行为一致但渲染次数不同**（React 有额外渲染，其他三个没有） | 确定发生 | 低——方向五已验证                      | 在合规测试中显式标注：只测试功能正确性，不测试渲染次数。渲染次数作为性能基准（benchmark），不作为合规通过标准                                                                  |

---

## 附录：关键决策点速查

| 决策                      | 选项 A                                             | 选项 B                   | 推荐                                      |
| ------------------------- | -------------------------------------------------- | ------------------------ | ----------------------------------------- |
| `derived` StrictMode 优化 | `queueMicrotask` 延迟（有 listener identity 判定） | 不做优化（当前功能正确） | **A**（低风险，开发体验收益）             |
| `mutate` 防护             | epoch 条件写入                                     | seq token 链             | **epoch**（更简单，嵌套 mutate 时安全）   |
| SSR 测试 fixture 格式     | JSON + 框架渲染器                                  | JSX/TSX 跨框架共享       | **JSON**（框架无关，可被 manifest 引用）  |
| 桥契约形式                | 类型接口 + 合规测试                                | 运行时桥抽象层           | **类型接口 + 测试**（不引入运行时开销）   |
| Angular 桥优先级          | 先做合规测试 + 生成器                              | 手写 Angular 桥          | **生成器优先**（一次投入，Qwik 也可复用） |
| QA 扫描器架构             | 独立 CLI 包                                        | ESLint 规则              | **独立 CLI**（ESLint 规则约束了输入范围） |
| 现有桥是否迁移到生成器    | 是（统一）                                         | 否（保持手写）           | **否**（现有桥已稳定，不值得重构）        |

---

以上分析基于验证文档中 5 个方向的源码级证据，结合 `AGENTS.md` 中的架构承诺和质量门，给出了从当前状态到下一阶段的完整评估和路线图。核心观点可总结为：

1. **架构模式（逻辑下沉 core）是正确的**——5 方向分析中没有任何证据表明这个原则需要修正
2. **最大缺口是「质量自动化的断裂链」**——架构承诺了 SSR 安全/四桥对齐/主题杠杆，但交付链路中没有自动验证
3. **第一阶段应该聚焦「最低风险的加固」**——epoch 方案（1 周）和 SSR 测试生成器（3-4 周）可以在不重构任何现有组件的情况下消除两个最真实的风险
