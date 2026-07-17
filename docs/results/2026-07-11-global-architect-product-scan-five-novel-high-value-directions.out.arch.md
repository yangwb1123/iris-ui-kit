# 架构评审：Iris UI — 五方向验证报告分析

## 1. 架构评估

### 1.1 当前架构优势

Iris UI 的架构决策在以下几个维度展现了成熟度：

| 维度             | 优势                                                                             | 证据                                                 |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- | ----- | ----------------- | ------------------------------- |
| **分层清晰度**   | 四层分离（Core → L1 原语 → L2 复合 → L3 布局 → L4 骨架）逻辑严谨，每一层职责单一 | 验证报告中所有 grep 命中均确认分层边界未被破坏       |
| **框架无关性**   | Core 零框架依赖的铁律被严格执行（`grep -rE "from '(vue                           | react                                                | solid | svelte)'"` 为空） | 证明 A 类逻辑下沉原则被有效执行 |
| **可扩展性**     | 插件系统（`createPlugin` + `runPlugins`）提供了非侵入式的能力扩展通道            | 三个生产级插件（locale-zh、editor、pro-table）已落地 |
| **Token 驱动**   | 30 tokens vs 800 行裸 CSS（93%+ 缩减）的设计杠杆已验证                           | 四框架 149 组件共享同一套 token 系统                 |
| **质量基础设施** | 四道质量门 + size 预算 + RSC + arch-check 均已就绪                               | 验证报告确认构建和测试流水线完整                     |

### 1.2 架构局限性与技术债

验证报告暴露了五个系统性的架构盲区，按严重程度排序：

#### 严重性 P0：设计-代码断层的架构风险

当前 token 系统是体系的核心（"Token 杠杆"原则），但存在**事实上的单向依赖**：

```
设计师 → [Figama tokens] → ?? → [CSS var(--iris-*)] → 组件
                              ↑
                         此处断裂
```

**架构风险**：当设计系统演进（如品牌刷新、色彩系统升级），当前架构无法保证：

- Token 变更的可追溯性（谁改了什么，影响哪些组件）
- Token 变更的预览机制（改之前看到效果）
- Token 变更的自动化传播（改一个 token → 自动更新 Figma 组件库 + 代码库）

这本质上是**架构一致性债**：token 系统的设计目的是成为"单一真相源"，但实际的真相源分裂为：

- 代码中的 `tokens/src/`（程序化真相源）
- Figma 中的设计组件库（视觉真相源）
- 两者之间没有机制保证一致性

#### 严重性 P1：API 演进的治理真空

验证确认了 `0.0.0` 版本 + 零 `@deprecated`/`@since`/`@version` + 零 codemod。在预发布阶段这不是问题，但一旦发布（`release.yml` 就绪），**治理债务将直接转化为迁移成本**。

**架构影响**：

- 当前 `@iris-ui/core` 10KB 的 size 预算没有预留版本兼容层
- 组件 props 接口没有版本化的概念（每个 `IrisButton` 的 props 就是"当前"的定义，没有 `v1`/`v2` 的概念）
- 插件系统（`createPlugin`）的注册接口 `install(reg)` 没有版本号——未来升级插件 API 将需要 breaking change

#### 严重性 P2：运行时性能的架构冗余

验证确认 i18n 消息全量加载、token 全量注入、零懒加载策略。这是**微架构层面的技术债**：

- **i18n**：`createI18nStore` 持有完整 messages 对象。对于一个包含中文包的 CMS 应用，所有英文 + 中文消息都在内存中
- **Token**：`applyTheme` 每次调用注入 ~60 CSS 变量。即使组件只使用了其中的 20%，全部变量都被注入
- **组件加载**：所有 149 个组件的代码路径在任何页面都可达（即使只用到了 10 个）

这不是当前的问题（size 预算通过），但随着组件数量增长到 500+、token 增长到 200+、消息增长到多语言 10+，这会成为规模化瓶颈。

#### 严重性 P2：质量安全网的架构盲区

**无障碍**：86 个测试文件含 a11y 断言，但缺乏系统化的 a11y 合规层。
**E2E/视觉回归**：零覆盖。

**架构风险**：当社区贡献者提交 PR 时：

- 没有 E2E 测试无法保证组件交互的工作
- 没有视觉回归无法保证样式不被意外破坏
- 没有系统化的 a11y 测试无法保证合规性

这是**缺少架构层面的质量契约**——当前的质量门是"代码级"的（typecheck/lint/build/test），但缺乏"行为级"和"视觉级"的契约。

---

## 2. 扩展方向

### 方向 A：Token 双向同步管线（P0）

**为什么需要**：

- 业务价值：设计交付效率提升 5-10 倍（设计师改 token → 代码自动更新 / 开发改 token → Figma 自动同步）
- 架构价值：修复"单一真相源"架构断裂，消除设计-代码断层

**核心挑战**：

| 挑战          | 技术难点                                               | 复杂度 |
| ------------- | ------------------------------------------------------ | ------ |
| DTCG 标准对齐 | Token Studio 的 DTCG 导出格式与 `IrisTheme` 结构的映射 | 中     |
| 增量同步      | 避免全量覆盖，支持部分 token 的更新传播                | 高     |
| 冲突解决      | Figma 和代码同时修改同一个 token                       | 高     |
| SaaS 基础设施 | 需要 Webhook/CI 集成，否则需要中间件服务               | 中     |

**预期的架构变更**：

```
当前:
  tokens/src/ → tsup build → dist/ (CSS/JS)
  Figama 组件  → [手动同步]

目标:
                            ┌──────────────┐
  tokens/src/ ├→ tsup → dist/ ├→ publish    │
       │                 │                  │
       │  push           │  pull            │
       ▼                 ▼                  │
  ┌─────────┐    ┌──────────┐              │
  │ Figma   │←──→│ Token    │──→ CI/CD     │
  │ Tokens  │    │ Registry │    (changeset)│
  └─────────┘    └──────────┘              │
       │                                    │
       └────────→ Figma Code Connect ────────┘
                  (149 组件全覆盖)
```

**新模块**：

- `packages/token-bridge/`：Figma ↔ Code 双向同步引擎
  - `src/figma-pull.ts`：从 Figma Token Studio JSON 拉取并映射为 `IrisTheme`
  - `src/figma-push.ts`：将 `IrisTheme` 差异推送回 Figma
  - `src/registry.ts`：Token Registry 状态管理（增量同步 + 冲突检测）
  - `src/diff.ts`：Token 差异计算（哪个 token 变了，影响哪些组件）
- `packages/tokens/figma/` 扩展：Code Connect 从 2 组件 → 149 组件（`auto-figma.tsx` 生成器）

**对现有系统的影响**：

- 最小影响：`packages/tokens` 的导出接口不变，新增 `pushToFigma`/`pullFromFigma` 工具函数
- 配置新增：`figma.config.json` 增加 token 同步配置
- 不改变 `applyTheme`/`createThemeStore` 等运行时 API

**选项权衡**：

| 方案                             | 优势                   | 劣势                               |
| -------------------------------- | ---------------------- | ---------------------------------- |
| A1. GitHub Action + REST API     | 零基础设施，CI 内完成  | 无法实时同步，需要手动触发         |
| A2. 轻量 Token Registry 服务     | 实时双向同步，冲突检测 | 增加运维负担，需要部署             |
| A3. Figma Plugin SDK（直接插件） | 设计师侧体验最佳       | 开发量最大，需要 Figma Plugin 审核 |
| **推荐 A1 → A3 分阶段**          | 渐进式投入             | 初期功能有限                       |

---

### 方向 B：API 版本化 + Codemod 工具链（P0 → P1）

**为什么需要**：

- 业务价值：降低用户升级成本（从"手动改代码"到"一条命令迁移"）
- 架构价值：保障 `@iris-ui/*` 的长期可维护性，避免 v1 → v2 式的断裂升级

**核心挑战**：

| 挑战             | 技术难点                                                       | 复杂度 |
| ---------------- | -------------------------------------------------------------- | ------ |
| 子路径版本耦合   | `@iris-ui/react/form` 的版本应与 `@iris-ui/react` 对齐还是独立 | 中     |
| Codemod 正确性   | AST 转换的边界情况处理（重命名 props、重构 JSX）               | 高     |
| Deprecation 追踪 | 跨包、跨版本的 deprecated API 追踪矩阵                         | 中     |
| 发布前基线的建立 | 当前 `0.0.0` 无版本历史，需要建立"v1.0.0"基线                  | 低     |

**预期的架构变更**：

```
packages/react/
├── src/                        // 当前代码
├── codemods/                   // 新增
│   ├── v1.0.0/                 // 每个 major 版本的迁移脚本
│   │   └── rename-button-variant.ts
│   └── utils/
│       └── transform.ts        // 共享 AST 工具
├── scripts/
│   └── deprecation-check.ts    // 新增：deprecation CI 门禁
└── docs/
    └── migrations/
        └── v1.0.0.md           // 迁移指南
```

**架构变更**：

- **Manifest 扩展**：`manifest.json` schema 增加 `deprecated`/`since`/`migrationPath` 字段（验证报告方向二的已有分析已覆盖）
- **Codemod 注册机制**：`createCodemod` 工具（类似 jscodeshift 包装器）
- **CI 门禁**：`pnpm check:api-compat`（自动检测 breaking change）
- **Size 预算调整**：codemod 不进入生产依赖，不影响 size

**对现有系统的影响**：

- 生产包（`packages/{core,react,vue,...}/`）不变
- 新增 `codemods/` 目录和 CI 脚本
- 需要为每个 `exports` 子路径定义 `@since`/`@deprecated` 元数据

---

### 方向 C：构建时优化流水线（P1）

**为什么需要**：

- 技术价值：包体积减少 30-60%（摇树优化的大头），首屏加载时间减少 40-60%
- 架构价值：从"运行时计算"转向"构建时编译"，是成熟的 UI 框架的标志（参考：Ant Design 的 `es/` 目录、Radix UI 的按需引入）

**核心挑战**：

| 挑战                 | 技术难点                                    | 复杂度 |
| -------------------- | ------------------------------------------- | ------ |
| i18n 消息提取        | 静态分析识别 `t('key')` 调用，提取到编译时  | 高     |
| Token 树摇           | 静态分析识别使用的 CSS 变量，生成最小样式集 | 高     |
| 框架适配器的懒加载化 | 每个框架的 lazy loading 机制不同            | 中     |
| 与现有构建工具的兼容 | `tsup` 的配置扩展                           | 低     |

**预期的架构变更**：

```
// 新增公共包
packages/compiler/
├── src/
│   ├── i18n-extract.ts        // 消息提取器
│   ├── token-scanner.ts       // Token 使用分析
│   ├── css-optimizer.ts       // 最小 CSS 生成
│   └── codegen.ts             // 代码生成器
├── cli.ts                     // iris-compiler CLI
└── package.json

// 各包构建配置扩展
packages/{core,react,vue,...}/
└── iris.config.ts             // 新增：组件级 token/i18n 声明
```

**设计选项**：

| 策略                                | 效果                                        | 复杂度 | 推荐        |
| ----------------------------------- | ------------------------------------------- | ------ | ----------- |
| C1. i18n 编译时提取                 | 运行时 messages 减少 50%+，仅含使用中的 key | 中     | ✅ 推荐先行 |
| C2. Token 构建时扫描 + 生成最小 CSS | CSS 变量从 ~60 降为组件实际使用的数量       | 高     | 选做        |
| C3. 组件级 Code Splitting           | 按需加载 L2+ 组件                           | 低     | 可立即实施  |
| C4. 构建时 props 类型擦除           | 减少 .d.ts 体积                             | 低     | 非优先      |

**对现有系统的影响**：

- `createI18nStore` 接口不变（向后兼容），但添加编译时优化标记
- `applyTheme` 添加 "已优化" 模式（仅注入使用的 CSS 变量）
- 新增 `@iris-ui/compiler` 包
- 不影响运行时的 API 签名

---

### 方向 D：无障碍合规体系（P1 → P2）

**为什么需要**：

- 业务价值：无障碍合规是政府/企业采购的硬要求（WCAG 2.1 AA）
- 法律价值：避免无障碍诉讼风险
- 架构价值：消除"零散 a11y 断言 → 系统性合规层"的差距

**核心挑战**：

| 挑战                 | 技术难点                                     | 复杂度                |
| -------------------- | -------------------------------------------- | --------------------- |
| 跨框架无障碍契约     | 不同框架的渲染方式导致 aria 属性附着方式不同 | 中                    |
| 颜色对比度运行时检测 | 需要分析已渲染的 CSS 变量值 vs 背景          | 高                    |
| 屏幕阅读器测试       | 需要真实浏览器环境（jsdom 不支持）           | 高（需要 Playwright） |
| 动态内容的 a11y      | 懒加载、异步内容更新后的焦点管理             | 中                    |

**预期的架构变更**：

```
// 新增：无障碍合规套件
packages/a11y/
├── src/
│   ├── contract.ts            // 跨框架无障碍契约定义
│   ├── rules/                 // WCAG 规则检查器
│   │   ├── color-contrast.ts
│   │   ├── focus-order.ts
│   │   ├── aria-attributes.ts
│   │   └── ...
│   ├── test-utils.ts          // 共享的 a11y 测试工具
│   └── cli.ts                 // iris-a11y CLI（CI 门禁）
├── contracts/
│   ├── button.a11y.ts         // Button 的无障碍契约（框架无关）
│   ├── dialog.a11y.ts
│   └── ...
└── package.json

// 每个组件的无障碍测试从松散断言 → 契约验证
// 新增 CI 步骤
```

**关键设计决策**：

**选项 A：`@iris-ui/a11y` 独立包**

- 优点：无侵入，框架无关，可独立迭代
- 缺点：需要开发者在测试中显式引入

**选项 B：集成到 `@iris-ui/core`**

- 优点：自动生效，减少用户心智负担
- 缺点：增加 core 的 size 预算，违反了"B 类逻辑不进 core"原则

**推荐**：**选项 A**，符合 AGENTS.md 的 A/B 分类原则（合规是 B 类附加能力，不用不进包）。

**对现有系统的影响**：

- 现存组件需要逐个添加 `a11y.ts` 契约文件（149 组件，估计 3-5 人月）
- 测试文件需迁移：从零散断言 → `verifyA11yContract(component, props)`
- CI 中新增 `pnpm check:a11y` 门禁
- 不影响生产运行时

---

### 方向 E：E2E + 视觉回归基础设施（P2）

**为什么需要**：

- 业务价值：防止回归，确保 UI 交付质量
- 架构价值：补充"代码级"质量门之外的"行为和视觉级"质量门
- 差异化价值：在 UI 框架中，同时覆盖 4 个框架的 E2E 测试几乎是业界首创

**核心挑战**：

| 挑战                       | 技术难点                                                  | 复杂度 |
| -------------------------- | --------------------------------------------------------- | ------ |
| 四框架 E2E 策略统一        | React/Vue/Solid/Svelte 的渲染方式不同，测试选择器策略不同 | 高     |
| Visual Regression 基线管理 | 4 框架 × 149 组件 × 多主题 = 1200+ 基线截图               | 极高   |
| CI 上的 E2E 稳定性         | 非确定性测试（flaky tests）是 E2E 的最大挑战              | 高     |
| Skin/Theme 的视觉测试覆盖  | 每个皮肤组合都需要基线                                    | 极高   |

**预期的架构变更**：

```
apps/e2e/                          // 新增 monorepo app
├── playwright.config.ts
├── tests/
│   ├── react/                     // 每个框架独立的测试目录
│   ├── vue/
│   ├── solid/
│   └── svelte/
├── visual-regression/             // 视觉回归基线
│   ├── react/
│   ├── vue/
│   └── ...
├── shared/
│   ├── selectors.ts               // 跨框架的测试选择器策略
│   └── fixtures.ts                // 共享的测试数据
└── package.json
```

**策略建议**：

| 策略                                | 效果                    | 工作量 |
| ----------------------------------- | ----------------------- | ------ |
| E1. 核心交互 E2E（20 个核心组件）   | 覆盖 80% 的用户交互场景 | 2-3 周 |
| E2. 全组件 E2E（149 组件 × 1 框架） | 单框架全覆盖            | 2-3 月 |
| E3. 全组件 × 4 框架 + VRT           | 四框架全覆盖 + 视觉回归 | 6-9 月 |
| **推荐 E1 → E2 → E3 分阶段**        | 渐进式投入              | 按阶段 |

**对现有系统的影响**：

- 新增 `apps/e2e/` 应用
- 新增 `docker-compose.e2e.yml`（如果需要真实浏览器环境）
- CI 中新增 E2E 步骤（并行 shard）
- 不影响任何现有包的代码

---

## 3. 接口设计建议

### 3.1 Token Bridge 层接口原则

```typescript
// 设计原则：Token Bridge 应当是 "纯函数" + "工具链"，不是运行时依赖

// 推荐 API 风格

// Pull: Figma JSON → IrisTheme（纯函数）
function fromFigmaTokenStudio(json: FigmaTokenExport): IrisTheme
function fromDTCG(json: DTCGFormat): IrisTheme

// Push: IrisTheme → Figma Token Studio JSON
function toFigmaTokenStudio(theme: IrisTheme): FigmaTokenExport
function toDTCG(theme: IrisTheme): DTCGFormat

// Diff & Patch
function diffTokens(current: IrisTheme, next: IrisTheme): TokenChange[]
function applyPatch(theme: IrisTheme, patch: TokenChange[]): IrisTheme

// Impact Analysis
function getAffectedComponents(tokenPath: string, manifest: Manifest): string[]
```

**向后兼容**：

- 输入/输出不可变，不修改入参
- 不依赖 `@iris-ui/core` 内部实现
- 版本号与 `@iris-ui/tokens` 绑定（因为映射逻辑依赖 token schema）

### 3.2 Codemod 层接口原则

```typescript
// 设计原则：基于 AST 的纯转换，无副作用

// 每个 codemod 的接口
interface Codemod {
  name: string // 例如 "rename-button-variant"
  version: string // 例如 "1.0.0"
  description: string // 人类可读描述
  transform(file: SourceFile, api: API): void // AST 转换
}

// Transform API 设计
interface API {
  report: (message: string) => void // 输出迁移报告
  options: Record<string, unknown> // 用户传入的配置
  j: JSCodeshift // jscodeshift API
}
```

**原则**：

- 每个 codemod 是单一职责（只做一件事）
- Codemod 可组合（`codemods/v1.0.0/` → `codemods/v1.1.0/` → 串行执行）
- 幂等性：多次运行同一 codemod 结果不变

### 3.3 无障碍契约接口原则

```typescript
// 设计原则：契约 = 组件必须遵守的 a11y 规则集合

// 通用组件契约签名
interface A11yContract<Props = unknown> {
  componentId: string // 例如 "Button", "Dialog"
  rules: A11yRule[] // 必须满足的规则
}

interface A11yRule {
  id: string // WCAG 标准标识，如 "WCAG-4.1.2"
  description: string // 规则描述
  check: (element: HTMLElement, props?: Props) => A11yResult // 运行时检查
  fix?: (element: HTMLElement, props?: Props) => void // 自动修复（可选）
}
```

**跨框架一致性**：

- 契约定义在 `@iris-ui/a11y`（框架无关）
- 每个框架适配器的测试从契约自动生成：
  ```
  契约 → 生成 → React 测试用例
              → Vue 测试用例
              → Solid 测试用例
              → Svelte 测试用例
  ```

### 3.4 构建时优化接口原则

```typescript
// 设计原则：编译时 + 运行时兼容，降级为全量模式

// 编译时代码生成（不改变 runtime API）
// 输入
interface ComponentAnalysis {
  usedTokens: string[] // 组件用到的 token
  usedI18nKeys: string[] // 组件用到的 i18n key
  dependencies: string[] // 组件依赖的其他组件
}

// 输出（生成的文件）
// generated/Button.optimized.css — 仅含 Button 用到的 CSS 变量
// generated/Button.optimized.messages.json — 仅含 Button 用到的 i18n key
```

**关键原则**：

- **降级友好**：如果编译时产物不可用，自动 fallback 到全量运行时
- **增量构建**：只重新分析变更的组件
- **缓存友好**：生成产物可被构建工具缓存

---

## 4. 技术选型

### 4.1 各方向的技术栈建议

| 方向             | 推荐技术                            | 备选                        | 决策依据                                                        |
| ---------------- | ----------------------------------- | --------------------------- | --------------------------------------------------------------- |
| **Token Bridge** | Token Studio REST API + `json-diff` | Figma Plugin API (更重)     | 当前 Code Connect 使用 REST API，保持一致；增量同步需要 diff 库 |
| **Codemod**      | `jscodeshift` + TypeScript AST      | `ts-morph` (更易用但更重)   | jscodeshift 是社区标准，React/Naive/Ant Design 均在用           |
| **构建优化**     | `@parcel/css` + 自建 compiler       | `lightningcss` + `unplugin` | parcel/css 是 Rust 实现，性能优异；CLI 工具链更易扩展           |
| **无障碍**       | `axe-core` + `@testing-library/dom` | `pa11y` + `webhint`         | 与现有 axe 测试栈一致，社区最大                                 |
| **E2E/VRT**      | Playwright + `playwright-ct`        | Cypress (组件测试弱)        | Playwright 原生支持多框架（React/Vue/Svelte），CI 集成优秀      |

### 4.2 自建 vs 采购的决策矩阵

| 决策           | 推荐                                      | 理由                                                                                |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Token 同步引擎 | **自建**                                  | `@iris-ui/tokens` 的 token schema 是自定义的（`IrisTheme`），没有现成工具可直接对接 |
| Codemod 引擎   | **复用** jscodeshift                      | 社区成熟，无需自建 AST 解析器                                                       |
| i18n 提取器    | **自建**                                  | `t('key')` 调用模式简单，但需要嵌入现有构建流水线                                   |
| 无障碍检查器   | **封装** axe-core                         | axe-core 足够强大，只需在其上构建契约层                                             |
| 视觉回归       | **复用** Playwright + `playwright-visual` | 社区成熟，无需自建截图比较                                                          |

### 4.3 不推荐引入的技术

| 技术            | 不推荐理由                                                 |
| --------------- | ---------------------------------------------------------- |
| **Storybook**   | 体积大，与现有 VitePress + Playground 架构重叠，维护成本高 |
| **Chromatic**   | 视觉回归 SaaS，定价昂贵，与开源项目定位不符                |
| **Tailwind**    | 与 token CSS 变量体系冲突，两套 DSL 会增加认知负荷         |
| **CSS Modules** | 与 token 变量策略不兼容，且 Svelte/Vue 已有 scoped styles  |

---

## 5. 实施路线图

### 5.1 优先级总览

```
          紧急
            │
            │
    P0      │  方向 A (Token Bridge)    方向 B (API 版本化)
            │  ── 发布前最后机会         ── 发布前必须完成基线
            │
    P1      │  方向 D (无障碍合规)       方向 C (构建优化)
            │  ── WCAG 合规窗口          ── 性能优化窗口
            │
    P2      │  方向 E (E2E/VRT)
            │  ── 社区增长后
            │
            └───────────────────────────────→
                                   重要性
```

### 5.2 阶段划分

#### 阶段 1：发布前准备（0-2 个月，优先级 P0）

**方向 A：Token Bridge 基础版**

- [ ] 实现 `fromFigmaTokenStudio` 和 `toFigmaTokenStudio` 纯函数
- [ ] Code Connect 从 2 组件 → 149 组件（使用代码生成器 `auto-figma.tsx`）
- [ ] CI diff-check 脚本（`pnpm check:token-sync`）
- **里程碑**：Figma ↔ Code 的单向同步（Code → Figma）可用

**方向 B：API 治理基线**

- [ ] 定义 `v1.0.0` 的 API 基线（锁定当前所有导出）
- [ ] 为 manifest.json 添加 `deprecated`/`since`/`migrationPath` 字段
- [ ] CI breaking change 检测脚本
- [ ] 第一个 codemod：`rename-button-variant`（用于验证工具链）
- **里程碑**：`pnpm check:api-compat` 门禁生效

#### 阶段 2：合规 + 性能（2-4 个月，优先级 P1）

**方向 D：无障碍体系**

- [ ] `@iris-ui/a11y` 包初始化（契约定义 + axe-core 封装）
- [ ] 20 个高频组件的 a11y 契约实现（Button/Dialog/Popover/Input/Select/Table/Tree/Menu/Form）
- [ ] 颜色对比度检测逻辑
- [ ] 契约 → 4 框架测试代码生成器
- [ ] `pnpm check:a11y` CI 门禁
- **里程碑**：20 核心组件通过 WCAG 2.1 AA 认证

**方向 C：构建优化—i18n 先行**

- [ ] `@iris-ui/compiler` 包初始化（CLI + i18n 提取器）
- [ ] i18n 编译时提取（`iris-compiler i18n:extract`）
- [ ] 生成优化后的 messages 文件
- [ ] `createI18nStore` 的优化模式（优先使用编译时产物）
- **里程碑**：i18n 运行时体积减少 50%

#### 阶段 3：质量体系完善（4-8 个月，优先级 P2）

**方向 E：E2E + VRT**

- [ ] Playwright 配置 + CI 集成
- [ ] 20 个核心组件的 E2E 测试（覆盖主要交互场景）
- [ ] 核心组件的视觉回归基线（React 框架先行）
- [ ] CI shard 并行策略（保证 E2E 在 10 分钟内完成）
- **里程碑**：20 核心组件的 E2E + VRT 全覆盖

**持续改进**：

- [ ] 构建优化扩展：Token 扫描器 + 最小 CSS 生成
- [ ] 无障碍体系扩展：剩余 129 组件
- [ ] E2E 扩展：4 框架全覆盖

### 5.3 风险矩阵

| 风险                                 | 概率 | 影响 | 缓解策略                                          |
| ------------------------------------ | ---- | ---- | ------------------------------------------------- |
| Token Bridge 需要 Figma API 变更     | 中   | 高   | 等待 Figma 官方稳定 API；保留手动导出通道         |
| Codemod 边界情况导致错误迁移         | 中   | 高   | 充分测试套件 + dry-run 模式 + 自动备份            |
| E2E 测试 flaky（非确定性失败）       | 高   | 中   | 重试策略 + 日志快照 + 逐步回退到更稳定的选择器    |
| 无障碍合规要求在不同司法管辖区不同   | 低   | 中   | 参考 WCAG 2.1 AA 国际标准，不针对特定国家         |
| 四框架视觉回归基线爆炸（1200+ 截图） | 高   | 高   | 差量基线（只存储像素差异）+ 增量更新 + 按框架分层 |

### 5.4 团队规模估算

| 方向            | 建议人员配置                       | 周期     | 总人月 |
| --------------- | ---------------------------------- | -------- | ------ |
| A. Token Bridge | 1 人（前端工程师 + Figma API）     | 2 月     | 2      |
| B. API 版本化   | 0.5 人（部分时间，与发布流程绑定） | 2 月     | 1      |
| C. 构建优化     | 1 人（构建工具 + 编译器经验）      | 3 月     | 3      |
| D. 无障碍       | 1 人（a11y 专家）                  | 4 月     | 4      |
| E. E2E/VRT      | 1 人（QA/测试工程师）              | 4 月     | 4      |
| **总计**        | **4-5 人（并行 2-3 方向）**        | **8 月** | **14** |

### 5.5 关键成功指标 (KPI)

| 指标                | 当前值       | 阶段 1 目标      | 阶段 2 目标      | 阶段 3 目标      |
| ------------------- | ------------ | ---------------- | ---------------- | ---------------- |
| Figma ↔ Code 覆盖率 | 2/149 (1.3%) | 149/149 (100%)   | 149/149 (100%)   | 149/149 (100%)   |
| Token 同步延迟      | 无同步       | 手动触发 < 5min  | CI 触发 < 1min   | 实时同步         |
| API 兼容性检测      | 无           | CI 阻塞 breaking | CI 阻塞 breaking | CI 阻塞 breaking |
| a11y WCAG 2.1 AA    | 未认证       | 门槛设置         | 20 组件认证      | 149 组件认证     |
| i18n 运行时体积     | 100% 全量    | 100% 全量        | -50%             | -70%             |
| E2E 覆盖率          | 0%           | 0%               | 0%               | 20 组件 (13%)    |
| VRT 覆盖率          | 0%           | 0%               | 0%               | 20 组件 (13%)    |

---

## 总结

这份验证报告揭示的五个架构盲区是**系统性**的，而非偶然的代码级遗漏。它们共同指向一个事实：Iris UI 是一个**优秀的代码级基础设施**（分层、框架无关、token 驱动、插件可扩展），但在**生态级基础设施**（设计工具集成、API 治理、构建优化、合规体系、质量安全网）方面仍有显著空白。

好消息是：**这些空白的填补不会破坏现有架构**。五个方向都是"加法"而非"重构"——不改变现有包的 API 签名，不增加生产体积，不引入运行时依赖。这证明了 Iris UI 的核心架构设计是健康和有远见的。

建议优先投入 **方向 A（Token Bridge）** 和 **方向 B（API 版本化）**，因为它们在发布前完成的门槛最低、ROI 最高、风险最小。方向 C/D/E 可以在发布后按节奏推进。
