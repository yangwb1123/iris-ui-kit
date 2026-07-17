## 架构分析报告：Iris UI 五个高价值扩展方向

---

## 1. 架构评估

### 1.1 当前架构的优势

Iris UI 的架构核心是经过深思熟虑的。从 AGENTS.md 和源码证据可以看到几个显著优势：

- **分层清晰**：Layer 0-4 + Behaviors + Plugins 的六层结构，每层职责明确，没有跨层依赖泛滥。
- **逻辑下沉 discipline**：`core` 包零框架依赖，`grep -r "from 'react'" packages/core/src` 为空——这是最难坚持也最有价值的一条原则，已通过四框架对齐验证。
- **Token 杠杆设计**：CSS 变量体系 + 皮肤系统实现了「一行 token 改变整个视觉系统」，这是 UI 基础设施中罕见的架构杠杆点。
- **插件向后兼容**：`createPlugin` 的注册式 API（registerTokens/registerMessages/registerStore）不是 monkey-patch，对现有 Provider 无侵入。

### 1.2 当前架构的局限性

- **安全模型是声明性的，不是强制性的**。方向三（Remote App 沙箱）和方向五（Slot 协议安全）暴露了同一个架构缺陷：系统的安全边界是文档/注释层面的自我约束，而非运行时层面的强制执行。一个声明了 `permissions: ['network']` 的 remote app 可以读写 `localStorage`、发通知、执行 crypto mining——因为没有任何 gate 检查 `isGranted`。

- **架构原则的应用范围在组件层停止**。AGENTS.md 的「逻辑下沉 core，适配器做薄桥」在 Layer 1-4 执行得很好，但在应用层（CMS、Desktop OS）完全未被遵循。这暴露了一个架构治理盲区：**组件层的架构策略没有自动延伸到组合层**。`tabs.ts` 和 `desktopBridge.ts` 在四个框架中逐行相同——这违反「DRY」和「core 存储逻辑」两条原则。

- **组合协议的契约边界未定义**。`IrisSlot`/`mergeSlotProps` 是 Iris UI 的组合核心，出现在 ~30 个组件中，但它的输入/输出契约没有形式化定义。什么 prop 可以被覆盖、什么 prop 受保护、ref 链的合并策略——这些在设计时未被定义，导致运行时行为是偶然的而非必然的。

- **验证桥有骨架无血肉**。`standardSchemaValidator` 的导出是良好的前瞻设计，但它停留在「技术预览」阶段——zero usage、缺 transform、缺竞态、缺路径映射。这指向一个模式：Iris UI 倾向于先落地骨架结构，但「从骨架到完整」的过渡没有机制保障。

### 1.3 架构债务

| 债务类型                 | 位置                      | 影响                    | 偿还窗口   |
| ------------------------ | ------------------------- | ----------------------- | ---------- |
| 安全执行层缺失           | Desktop OS 权限模型       | 旗舰特性不可信任        | P0（当前） |
| 组合协议无白名单         | `mergeSlotProps`          | XSS 面 + 组合语义未定义 | P0（当前） |
| 应用层重复 4x            | CMS/Desktop OS            | 维护成本 4x，增量不一致 | P2→持续    |
| CSS 逻辑属性零使用       | 全库 primitive 组件       | RTL 渲染不正确          | P2         |
| Standard Schema 桥零使用 | `core/standard-schema.ts` | 生态集成能力未交付      | P1         |

---

## 2. 扩展方向

### 2.1 P0：安全执行层 —— 权限模型从声明到强制

#### 为什么需要

这是最严重的架构缺口。Desktop OS 的核心产品叙事是「AI 原生桌面聚合 shell」——用户可以安装任意应用。但当前架构中，一个 remote app：

1. 通过 `loadRemoteApp` 的裸 `import()` 注入任意 JavaScript
2. 拥有完全 DOM/API 权限
3. 通过 `mount()` 可以执行任意代码
4. 权限声明是完全装饰性的（只展示，不执行）

对于一个「App Store」产品，这不只是一个 bug——这是安全模型的设计缺失。异步加载权限声明的 remote app 相当于「门卫只负责开门，不检查谁进来」。

#### 核心挑战

1. **ESM 原生不可隔离**。`import()` 加载的模块在同一个主线程执行上下文运行，没有 Worker 的隔离边界，没有 iframe 的 sandbox 属性。要实现 ESM 隔离，要么走 iframe（性能损耗大，通信复杂），要么走 Worker + 代理（兼容性受限），要么在 mount 点注入受限上下文（侵入式）。

2. **权限作用域不是二进制开关**。一个 app 可能需要在某个页面使用 `network`，但在另一个页面访问 `clipboard`——作用域粒度需要设计。`isGranted` 检查是全局的还是细粒度的？

3. **IrisProvider context 泄漏**。插件注册的 store 通过 `PluginStoreContext` 暴露给整个组件树——remote app 的 mount 在不经意间可以读写任意 plugin store。上下文隔离需要一种「安全通道」模式。

#### 架构变更

```
当前：
  AppManifest.permissions → useGrants (存储) → 无人消费
  loadRemoteApp(url) → import(url) → mount(ctx) → 全权限

建议：
  AppManifest.permissions → useGrants → GateKeeper (执行)
  loadRemoteApp(url) →
    1. CSP 校验 (origin whitelist)
    2. timeout guard (10s)
    3. ErrorBoundary wrap
    4. mount(securityCtx) —— 只暴露 granted API
```

核心架构变更：引入 `SecurityContext` 作为 remote app 的唯一通信通道。

#### 对现有系统的影响

- `loadRemoteApp` 签名改变：`(url, grants) => Promise<RemoteAppModule>`（破坏性变更，但 desktop-os 目前是 demo 质量）
- `useGrants` 从单纯存储改为存储 + 执行层
- `remoteApp.ts` 从 ~30 行膨胀到 ~150 行（但这是必要的安全厚度）
- 现有 `kind: 'remote'` 应用需适配安全上下文（向后兼容可通过沙箱级别降级支持）

### 2.2 P0：组合协议契约规范化 —— `IrisSlot`/`mergeSlotProps` 安全边界

#### 为什么需要

`as-child` 模式是 Iris UI 组合的传输层——出现在 ~30+ 组件中。`mergeSlotProps` 是这层的核心函数。它的当前实现是「所有 prop 要么被合并（event/style/class），要么被覆盖（其他）」。这是不安全的：

- `dangerouslySetInnerHTML` 可从子元素注入
- `ref` 链被无条件覆盖
- `role`/`aria-*` 可被子元素静默替换
- CSS 变量可被子元素的 style 覆盖（绕过主题系统）

对于一个向「AI agent 合成的 UI」演进的系统，组合协议必须比「自由覆盖」更严格。

#### 核心挑战

1. **特殊 prop 白名单的跨框架统一**。React 的 `dangerouslySetInnerHTML`、`suppressHydrationWarning`、`ref`、`key`——在 Vue 中是对应什么？Solid 的 `children` 是惰性函数，Svelte 的 `$$slots` 是编译时。需要一份跨框架的「保护 prop 清单」。

2. **向后兼容 vs 安全收紧**。现在收紧白名单会破坏使用 `asChild` 覆盖 style/className 的已有代码。迁移策略需要软过渡（warn → error）还是硬过渡（breaking change）+ 文档 changelog？

3. **CSS 变量注入防御**。子元素 style 覆盖 `--iris-*` 是主题绕过——但 `--custom-*` 允许注入。判断逻辑是前缀匹配还是完整匹配？是否需要区分 iris 命名空间和自定义命名空间？

#### 架构变更

```
当前 mergeSlotProps 行为：
  child[key] !== undefined → merged[key] = childValue (无条件覆盖)

建议行为：
  1. 保护白名单: dangerouslySetInnerHTML, ref, key, suppressHydrationWarning,
                 以及 role, aria-* (语义保护)
  2. 事件处理: composeEventHandlers (已有, 不变)
  3. style: shallow merge, 但过滤 --iris-* 前缀
  4. className: 字符串拼接 (已有, 不变)
  5. children: 合并而非覆盖 (slot 的默认内容 + 子元素内容)
  6. 嵌套 slot: 显式策略 "latest wins" vs "deepest wins"
```

#### 对现有系统的影响

- `mergeSlotProps` 的 prop 白名单变更——可能影响 `asChild` 的现有行为
- 需要全库 ~30 个使用 `asChild` 的组件的回归测试
- 需要跨框架合同测试（React/Vue/Solid/Svelte 的 `asChild` 行为一致）

### 2.3 P1：Standard Schema 验证桥 —— 从骨架到网关

#### 为什么需要

`standardSchemaValidator` 是一个设计了但未完成的产品特性。它当前的状态（骨架存在、零使用）意味着 Iris 表单引擎与第三方 schema 生态之间存在隔阂。企业用户几乎必定已有 Zod 层——迫使他们二选一不是产品设计，是竞品赠予。

#### 核心挑战

1. **`.transform()` 的值管道**。Zod 的 transform 不止验证——它改变值。`standardSchemaValidator` 当前返回 `FieldErrors`，不返回转换后的值。需要一种机制让 transform 的输出流回表单 store。这涉及 `createFormStore` 的 `validate` 返回签名变更：`(values) => FieldErrors | Promise<FieldErrors>` 变为 `(values) => {errors: FieldErrors, values?: TransformedValues}`。

2. **跨字段校验路径映射**。`z.object().refine((data) => ..., { path: ['confirm'] })` 中 Standard Schema 的 path 是相对于 refine 的 schema 作用域的。Iris 的表单引擎需要完整字段路径（如 `user.confirm`）。需要一个 `mapPath` 函数将 schema-relative path 映射到 form-absolute path。

3. **异步竞态与超时**。Zod refine 链可以异步。当前 `createValidationEngine` 已使用 token 机制进行竞态防护——但 `standardSchemaValidator` 没有与这个 token 机制集成。如果 schema 的 validate 在上次验证返回后完成，可能导致 stale validation 覆盖新值。

4. **Vendor 差异矩阵**。Valibot 的 path 是数字索引数组，ArkType 的报错结构是树形的，Zod 是字符串路径。`segmentOf` 的归一化需要测试矩阵覆盖。

#### 架构变更

```
standardSchemaValidator 当前:
  (schema) => (values) => FieldErrors  // 一元，单向

建议扩展:
  standardSchemaValidator(schema, options?) => {
    validate: (values) => ValidationResult  // 现有，加强
    transform: (values) => TransformedValues  // 新增值管道
    getFieldDependencies: () => string[][]  // 新增跨字段依赖声明
  }
```

不需要新的抽象层——是在现有 `standard-schema.ts` 文件上增加能力，保持 `standardSchemaValidator` 的签名向后兼容（可选参数）。

#### 对现有系统的影响

- `standard-schema.ts` 从 ~60 行扩张到 ~200 行
- 新增 `transform` 输出管道需要 `createFormStore` 对 validate 返回值的处理调整
- 零破坏性变更——当前只有一个定义文件，零使用，所以不会破坏任何现有代码
- 测试矩阵需要覆盖 Zod/Valibot/ArkType/Yup 的生态互操作

### 2.4 P2：CSS 逻辑属性全库审计和迁移

#### 为什么需要

这是「原则 vs 实践」的最大缺口。AGENTS.md 明确要求「勿写死 left/right」——但全库 ~33 处物理属性，零逻辑属性。RTL 支持是产品承诺（`IrisI18nProvider` 已支持 `autoDirection`），但组件层完全不生产 RTL 输出。对于 Iris UI 来说，RTL 不是「锦上添花」——它是一个 UI 基础设施项目的必备能力。

#### 核心挑战

1. **逐处判别的语义判断**。不是所有 `left: 0` 都应改为 `inset-inline-start: 0`。绝对定位的覆盖层、Tooltip 的固定锚点、弹窗的居中——有些 left/right 是方向中性或物理锚定语义的，迁移需要逐个分析。

2. **动画 keyframes**。`@keyframes` 中的 left/right 没有逻辑等价物。解决路径：用 `transform: translateX()` 替代，或用 `@property` 注册自定义属性 + transition。

3. **`env(safe-area-inset-*)`**。没有逻辑属性等价。需要 RTL 检测 + 条件 CSS 变量映射。

4. **跨框架统一**。四框架的 style 定义可能分散在不同的 `.tsx`/`.ts`/`.vue`/`.svelte` 文件中——需要全部清理。

#### 架构变更

```
建议模式:
  1. 创建 @iris-ui/tokens 的 CSS 逻辑属性工具函数:
     - logicalProperty(physical: string, direction?: 'ltr' | 'rtl') => string
     - logicalValue(property: string, value: string) => string
  2. 每个组件迁移采取 "先测后改"——迁移前添加 RTL 快照测试
  3. 将 RTL 正确性纳入 axe 无障碍门 (已在 AGENTS.md 提及)

  不是引入新抽象，而是 token 层的一个正交扩展。
```

#### 对现有系统的影响

- 15-20 组件需修改 inline style/CSS
- 新增 RTL 快照测试 ~15-20 个
- keyframes 迁移需组件级重构（~2-3 处）
- 零 API 破坏——纯视觉变更

### 2.5 P2→持续：跨框架应用层代码重复治理

#### 为什么需要

这不是一个「一次性项目」——它是一个需要「持续治理」的策略。当前 ~240 应用层文件需要跨框架同步。组件层的四框架对齐已经达成，但应用层是「四倍体技术债」——每次新增页面/视图都是 4 倍工作量，Bug 修复在 4 个框架中几乎必定遗漏。

#### 核心挑战

1. **「纯逻辑」vs「框架桥接」的边界判据**。应用中的 `tabs.ts` 是纯 core 调用的，显然应下沉。但 `desktopBridge.ts` 有一些 Electron/Tauri 的框架桥接——哪些部分下沉？下沉后如何保持框架特定的启动/生命周期集成？

2. **共享包的位置**。`@iris-ui/cms-shared` 还是 core 子路径（`@iris-ui/core/cms`）？前者更干净（不污染 core），但增加了包管理和 CI 复杂度。

3. **治理门禁设计**。新应用文件在提交时如何判断「是否能下沉」？自动化的 lint rule（检测 import 路径）还是代码 review checklist？

4. **不完整的「同名同语义」**。即使逻辑下沉，路由、Shell 组合、页面数据流的差异仍导致四个框架同一功能不同——这些「必需差异」需要文档化和合同测试覆盖。

#### 架构变更

```
治理策略:
  1. 识别可下沉模块 (tabs.ts, desktopBridge.ts 的纯逻辑部分)
  2. 提取至 @iris-ui/cms-core 或 @iris-ui/desktop-core (框架无关包)
  3. 建立 lint rule: "应用层文件禁止包含可下沉至 @iris-ui/*-core 的逻辑"
  4. 新框架适配器 (如 Angular) → 只需写 Shell + 路由，core 逻辑复用

  这不是一个包，是一个策略 + 工具链。
```

#### 对现有系统的影响

- 需要创建 1-2 个共享包
- 现有 4 个框架的代码需逐步迁移（≈ 工具化迁移，而非手动复制）
- 迁移期间四框架行为可能短暂不一致——需要合同测试兜底
- 长期减少跨框架同步成本

---

## 3. 接口设计建议

### 3.1 关键模块的接口设计原则

**原则 1：安全默认，而非文档声明**

当前架构太依赖「开发者会读文档然后遵循」——但安全边界应默认收紧，通过 opt-out 放宽。具体：

- `mergeSlotProps` 应默认阻止 `dangerouslySetInnerHTML` 透传，除非显式 `allowDangerousProps`
- `loadRemoteApp` 应默认执行权限 gate，除非显式 `bypassSecurity`
- 白名单优于黑名单：明确什么可以，而不是什么不可以

**原则 2：松耦合的入点，紧耦合的出点**

这是从 `standardSchemaValidator` 零使用中学到的教训。验证桥的接口应该：

- 入点（schema 输入）—— 接受任何兼容 Standard Schema 的 vendor
- 出点（form 集成）—— 紧密集成 Iris 表单引擎的验证生命周期（token 竞态、路径映射、transform 输出）

当前实现只有入点没有出点——验证结果没有反馈到 form 的验证流程。

**原则 3：安全上下文的显式传递**

Remote app 的 `mount(ctx)` 现在接收到的是完整的应用上下文。应改为：

```ts
// 当前：隐式全权限
mount({ container, context })

// 建议：显式受限上下文
mount({
  container,
  securityCtx: {
    hasPermission: (p: Permission) => boolean,
    readStore: <T>(key: string) => T | undefined, // 只读，不可写
    fetch: (url: string, init?) => Promise<Response>, // 受 CSP/proxy 保护的 fetch
  },
})
```

### 3.2 是否需要引入新的抽象层

**需要引入 `SecurityContext`（方向三）**。这是从声明到执行的桥梁。当前 `useGrants` 是存储层，`loadRemoteApp` 是加载层——缺少执行层 `GateKeeper`。这个新层：

- 职责：验证 `AppManifest.permissions` → 创建受限 `SecurityContext` → 注入 `mount()`
- 位置：`@iris-ui/desktop-core` 或 desktop-os 内的 `security/` 目录
- 不影响现有 `kind: 'internal'` 应用（它们不经过 `loadRemoteApp`）

**不需要引入新抽象层的方向**：

- 方向一（CSS 逻辑属性）：纯 token 层扩展，无新抽象
- 方向二（Standard Schema）：现有文件的扩展，无新抽象
- 方向五（Slot 协议）：`mergeSlotProps` 的行为收紧，无新抽象

### 3.3 向后兼容性策略

| 方向                 | 兼容性影响                         | 策略                                                                  |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| ① CSS 逻辑属性       | 零破坏（纯视觉）                   | 直接迁移，无需兼容                                                    |
| ② Standard Schema 桥 | 零破坏（zero usage）               | 直接扩展，签名保持                                                    |
| ③ Remote App 沙箱    | **破坏性**——`loadRemoteApp` 签名变 | 可降级：加 `sandbox?: 'none' \| 'csp' \| 'secure'` 参数，默认 `'csp'` |
| ④ 应用层重复治理     | 零破坏（提取，不改 import）        | 新包 + 旧包 re-export 过渡                                            |
| ⑤ Slot 协议安全      | **可能破坏**——白名单收紧           | 分阶段：V1 加 `console.warn` + 可覆盖；V2 硬限制                      |

---

## 4. 技术选型

### 4.1 是否需要引入新的技术栈

| 方向                 | 新栈                                                 | 理由                                            | 风险            |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------- | --------------- |
| ① CSS 逻辑属性       | 无                                                   | CSS 原生支持逻辑属性                            | —               |
| ② Standard Schema 桥 | 无（引入 `standard-schema` 类型包作为 devDep）       | 仅类型依赖，非运行时                            | —               |
| ③ Remote App 沙箱    | **考虑** iframe sandbox 或 `@ungap/structured-clone` | 如果走 iframe 隔离路线，需要 postMessage 通信层 | 性能 + 通信延迟 |
| ④ 应用层重复治理     | 无（已有 pnpm workspace + Turborepo）                | —                                               | —               |
| ⑤ Slot 协议安全      | 无                                                   | —                                               | —               |

**不推荐 Worker 沙箱**。Web Worker 的兼容性（`importScripts` vs `import`）、DOM 不可用、通信都是全量序列化——对于渲染 UI 组件的 remote app 来说限制太大。如果是纯逻辑模块（如 data processing app）才值得考虑 Worker。Remote app 的沙箱策略应该是「iframe first，Worker second，ESM wrapper last」。

### 4.2 第三方依赖评估标准

当前架构的依赖策略是合理的（core 零依赖、adapter 对标 Radix/Naive）。5 个方向的第三方依赖检查表：

```
准入标准：
  □ 是纯类型依赖？ → 无条件准入
  □ 运行时 < 2KB gzip？ → 考虑
  □ 有明确退出策略？（esm/cjs/browser 三格式） → 必要条件
  □ 维护者活跃度 > 1 年？ → 必要条件
  □ 有 TypeScript 类型？ → 必要条件
  □ 可用 Core 子路径替代？ → 不引入

退出标准：
  □ 包 size 超过 10KB gzip
  □ 维护者超过 6 个月无回应
  □ 有安全漏洞且无补丁
```

具体方向：

- **方向二**：`standard-schema`（https://github.com/standard-schema/standard-schema）只需 `@types/standard-schema` 或通过 devDependency 引入类型——无运行时加载。**推荐引入**。
- **方向三**：如果走 iframe sandbox 路线，需评估 `postMessage` 通信的序列化/反序列化开销。**不引入新库**——用原生 `postMessage` + `structuredClone`。

### 4.3 自建 vs 采购决策

| 方向               | 自建                   | 采购                    | 决策                               |
| ------------------ | ---------------------- | ----------------------- | ---------------------------------- |
| CSS 逻辑属性       | ✅ CSS 原生即可        | 无                      | 自建（零代码）                     |
| Standard Schema 桥 | ✅ ~200 行扩展         | `@formkit/zod` 等不应换 | **自建**（核心集成点，不应外包）   |
| Remote App 沙箱    | ✅ iframe 方案可自建   | 无针对性市售方案        | **自建**（安全是核心差异，不外包） |
| 应用层重复治理     | ✅ 策略 + 门禁         | 无                      | **自建**                           |
| Slot 协议安全      | ✅ mergeSlotProps 修改 | 无                      | **自建**                           |

---

## 5. 实施路线图

### 5.1 优先级排序与阶段划分

```
P0 (当前 — 4-6 周)
├── 方向⑤ Slot 协议安全治理
│   └── Week 1-2: mergeSlotProps 白名单 + 测试
├── 方向③ Remote App 沙箱 (第一阶段)
│   └── Week 3-6: SecurityContext + iframe sandbox + CSP 校验
│
P1 (Q3 2026 — 2-3 周)
├── 方向② Standard Schema 验证桥
│   └── transform 管道 + 路径映射 + 竞态集成 + 测试矩阵
│
P2 (Q4 2026 — 5-8 周 + 持续)
├── 方向① CSS 逻辑属性审计与迁移
│   └── 审计 → 分类 → 逐组件迁移 → RTL 快照
├── 方向④ 应用层重复治理
│   └── 建立门禁 → 识别可下沉模块 → 提取 core → 迁移
```

### 5.2 每个阶段的里程碑

**Phase 0 (P0, Week 1-6)**

| Week | 方向        | 里程碑                                                                 | 验证指标                                                        |
| ---- | ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1-2  | ⑤ Slot 协议 | `mergeSlotProps` 白名单 + 保护 prop 集成 + ~30 组件回归                | 全库 src 扫描 `dangerouslySetInnerHTML` 通过 slot 注入 → 0 通过 |
| 3-4  | ③ 沙箱      | `SecurityContext` + `permissions.enforce()` + `loadRemoteApp` CSP 校验 | 恶意 remote app 注入 → 全部阻止                                 |
| 5-6  | ③ 沙箱      | iframe sandbox 隔离 + `kind: 'remote'` 应用改造                        | 运行 alert(document.cookie) → block                             |

**Phase 1 (P1, Week 7-9)**

| Week | 方向     | 里程碑                                                    | 验证指标                                 |
| ---- | -------- | --------------------------------------------------------- | ---------------------------------------- |
| 7    | ② Schema | `transform` 返回值管道 + `createFormStore` 适配           | `form.validate()` 后返回转换值而非原始值 |
| 8    | ② Schema | 异步竞态 + 超时 + token 集成                              | 慢 schema 验证不会覆盖新值               |
| 9    | ② Schema | Zod/Valibot/ArkType 测试矩阵 + `plugin-form-builder` 集成 | 三方库验证结果一致                       |

**Phase 2 (P2, Week 10-17+)**

| Week   | 方向   | 里程碑                                                        | 验证指标                                                                      |
| ------ | ------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 10-11  | ① RTL  | 全库审计 → 分类表（语义RTL / 物理锚定 / 动画）                | 审计报告                                                                      |
| 12-15  | ① RTL  | 逐组件迁移 + keyframes 改造 + RTL 快照                        | `grep "left:\|right:\|marginLeft\|marginRight" packages/*/src/primitives` → 0 |
| 16-17+ | ④ 重复 | 门禁 lint rule + `tabs.ts` 提取 + `desktopBridge.ts` 部分提取 | 4 框架 `tabs.ts` 行数差 = 0                                                   |

### 5.3 风险点和缓解策略

| 风险                                                      | 影响方向 | 概率  | 影响等级 | 缓解策略                                                            |
| --------------------------------------------------------- | -------- | ----- | -------- | ------------------------------------------------------------------- |
| 方向③ iframe 隔离导致性能退化                             | ③        | 🟡 中 | 🟠 高    | POC 阶段测量 LCP/TBT；如果退化 > 10%，退回 CSP-only 方案            |
| 方向⑤ 白名单收紧破坏已有 asChild 使用                     | ⑤        | 🟠 高 | 🟠 高    | 第一阶段只 warn 不 break，收集破坏场景；第二阶段硬限制              |
| 方向② Standard Schema 版本升级不兼容                      | ②        | 🟢 低 | 🟢 低    | 只依赖 type-level 接口，运行时走 adapter 解耦                       |
| 方向④ 应用层治理被团队忽视（无执行动力）                  | ④        | 🟠 高 | 🟡 中    | 门禁自动化（lint + PR check），无手动豁免                           |
| 方向① 动画 keyframes 无法迁移                             | ①        | 🟢 低 | 🟢 低    | 用 `transform: translateX()` 替代，保留 1-2 处 won't fix            |
| P0+P1 并行开发资源不足                                    | ③+⑤      | 🟡 中 | 🟠 高    | 方向⑤ 影响面小（core 1-2 file），可并行给 junior；方向③ 需要 senior |
| 跨框架 slot 语义不一致（React vs Vue vs Solid vs Svelte） | ⑤        | 🟡 中 | 🟡 中    | 合同测试覆盖四框架 `asChild` 行为                                   |

### 5.4 关键架构决策记录 (ADR)

**ADR-001：远程应用沙箱走 iframe 隔离，不引入 Worker**

- **上下文**：`loadRemoteApp` 当前裸 `import()`，无沙箱
- **决策**：对 `kind: 'remote'` 应用创建隐藏 iframe + sandbox 属性 + postMessage 通信
- **理由**：iframe 支持所有浏览器，sandbox 属性是标准化的隔离机制；Worker 无 DOM 访问，不适用于 UI 组件
- **后果**：引入 `postMessage` 通信层的序列化开销；`mount()` 需包装为 iframe-ready API
- **替代方案**：CSP-only（不够安全）、Worker-only（丢失 UI 能力）、WebAssembly sandbox（太实验）

**ADR-002：`standardSchemaValidator` 返回类型扩展（非破坏性）**

- **上下文**：当前返回 `FieldErrors`，不支持 transform 输出
- **决策**：扩展返回类型为 `{ errors: FieldErrors; values?: unknown }`，兼容旧签名
- **理由**：旧调用方只读 `errors`，新调用方可读 `values`——松耦合入点，紧耦合出点原则
- **后果**：`createFormStore` 需要适配新的返回签名

**ADR-003：CSS 逻辑属性迁移不引入新工具链**

- **上下文**：~33 处物理属性分布在 15-20 组件
- **决策**：人工逐处判断 + 自动化 grep 门禁，不引入 codemod 或 ESLint 插件
- **理由**：每处物理属性需要语义判断（「是 RTL 可翻转」还是「物理锚定」），codemod 无法自动做这个判断
- **后果**：迁移周期较长（~2 周），但准确率更高

---

## 总结

这 5 个方向揭示了一个清晰的模式：Iris UI 的组件层架构质量很高（分层、对齐、token 驱动），但安全层和集成层存在「骨架化」问题——声明但不执行、导出但不连接、定义但不使用。最紧急的两个方向（③ 和 ⑤）都涉及**安全**——不是功能缺失，是架构的信任基底缺失。优先解决它们，然后扩展生态集成（②），最后是视觉完善和长期维护成本治理（① 和 ④）。
