以下是我作为架构师对文档中 5 个方向的深度分析。

---

# 架构分析：Iris UI 五个未覆盖扩展方向

## 1. 架构评估

### 当前架构的优势

Iris UI 的架构质量在同类项目中属于顶尖水平。几个确凿的证据：

- **A/B/C 逻辑分类模型**被严格执行——`@iris-ui/core` 确实零框架依赖，`grep "from '(react|vue|solid|svelte)'" packages/core/src` 为空，这是许多跨框架库承诺但做不到的。
- **契约测试基础设施**（`ContractScenario` / `ContractDriver` / `runContract`）是真正意义上的跨框架行为契约——不是"同名导出"，而是"相同 DOM 交互 → 相同属性结果"。42+ 场景 × 4 框架的覆盖是扎实的质量基座。
- **`check-size.mjs`** 包含包级预算 + 单导出 tree-shake 探针 + 基线对比——其设计质量超越了多数 UI 库的 CI 门禁。
- **Manifest 系统**（`@iris-ui/manifest`）已经在 schema 中记录了每组件的能力（props/events/slots/subComponents/frameworks），为后续工具化打下基础。

### 架构局限性（文档揭示的核心缺口）

文档指出的 5 个方向分属 3 类架构缺陷：

| 缺陷类别                      | 对应方向   | 根本原因                                                                      |
| ----------------------------- | ---------- | ----------------------------------------------------------------------------- |
| **数据（Token）生命周期缺失** | 方向 1 + 4 | Token 从定义到使用的全链路缺少"扫描→追踪→剪枝→版本→弃用"闭环                  |
| **测试策略的集成层真空**      | 方向 2     | 测试金字塔的中间层（交互组合）完全缺失                                        |
| **消费者信息黑洞**            | 方向 3 + 5 | 组件库的"使用成本"（bundle 增量）和"互操作边界"（跨框架数据流）对消费者不透明 |

**关键发现**：方向 1 和 4 共享同一个根源——Token 系统缺少生命周期管理。方向 3 和 5 共享另一个根源——消费者侧的透明度和可组合性未被架构设计考虑。

### 关键设计决策评估

**决策一：`applyTheme()` 全量注入 CSS 变量（`themeCssVarEntries` 遍历整个 `IrisTheme`）**

- ✅ 正确性：运行时全量注入是 SSR 安全和简化逻辑的正确权衡。
- ❌ 优化缺口：没有提供"消费者按需声明使用哪些 token"的 opt-in 路径。
- **改进不动核心**：不修改 `applyTheme()` 的默认行为，而是新增工具层。

**决策二：契约测试按组件独立组织（`scenarios/accordion.ts` / `dialog.ts` ...）**

- ✅ 正确性：单组件测试是基线，组织结构清晰。
- ❌ 集成缺口：`scenarios/` 目录没有组合场景子目录，runner 完全兼容但未利用。
- **修复成本极低**：添加 `compositions/` 子目录即可，复用所有现有基础设施。

**决策三：四框架各自独立发包（`@iris-ui/react` / `vue` / `solid` / `svelte`）**

- ✅ 正确性：这是 v1 的正确选择——隔离框架依赖，避免运行时冲突。
- ❌ 未来缺口：这个决策锁死了"选一个框架"的模式，与微前端/polyglot 组织需求矛盾。
- **不推翻决策**：方向 3 的 `@iris-ui/bridge` 是此模式之上的附加层，不替代现有包结构。

**决策四：Manifest 记录组件信息但不记录依赖图**

- ✅ 正确性：v1 聚焦组件发现和文档生成，这是正确优先顺序。
- ❌ 分析缺口：缺少依赖图导致 size 分析、tree-shaking 决策、冲突检测都需要从源码重新推导。
- **自然演进**：Manifest 已有足够的基础结构扩展依赖追踪。

### 架构债务现状

| 债务项                 | 严重程度                          | 偿还窗口   | 是否在 5 方向中覆盖 |
| ---------------------- | --------------------------------- | ---------- | ------------------- |
| Token 无版本/弃用      | 🔴 高                             | **发布前** | 方向 4              |
| 组件组合无集成测试     | 🟡 中                             | 发布前     | 方向 2              |
| 消费者无法量化导入成本 | 🟡 中                             | 发布同时   | 方向 5              |
| 全量 token 注入无剪枝  | 🟢 低                             | 发布后     | 方向 1              |
| 框架间无法互操作       | 🟢 低（当前）→ 🔴高（微前端场景） | 发布后 v2  | 方向 3              |

**底线**：方向 4 和 2 是发布前必须偿还的债务；方向 5 是发布同时应建立的消费者信任基础设施；方向 1 和 3 可以延后但应在 roadmap 中有明确位置。

---

## 2. 扩展方向（深化与补充文档分析）

以下是我基于文档 5 个方向，叠加个人架构师判断后的**重组和深化**分析。

### 方向 A：统一 Token 生命周期管理平台（合并文档方向 1 + 4）

**为什么不是两个独立方向？**

文档将方向 1（Tree-Shaking）和方向 4（版本化/弃用）分开论述，但它们是同一个问题的两面：**Token 缺少从定义到消亡的全生命周期管理**。Tree-shaking 关注"哪些 token 活着"，弃用关注"哪些 token 已死"——共享同样的数据源（token usage scan）。

**合并后的建议架构：**

```
@iris-ui/token-lifecycle (新增包)
├── register.ts          # Token 注册中心：声明 token 名、类型、引入版本
├── scanner.ts           # 扫描器：静态分析 var(--iris-*) + 动态模式匹配
├── usage-db.ts          # 使用数据库：{ token: string, files: string[], components: string[] }
├── versioning.ts        # 版本追踪：$deprecated 映射生成 + 版本断言
├── purger.ts            # 剪枝器：根据 usage-db 生成主题子集
├── codemod.ts           # 迁移 CLI：rename-token --from iris.primary --to iris.accent
└── report.ts            # 报告生成：dead-token 比例、迁移进度
```

**核心设计决策：**

| 选项     | 方案                                 | 权衡                                                         |
| -------- | ------------------------------------ | ------------------------------------------------------------ |
| 扫描策略 | **A: 静态 AST 扫描**（推荐）         | 精确但无法处理动态 `var(--iris-${x})`；可配合运行时白名单    |
|          | B: 运行时采样                        | 捕获动态但增加生产环境成本且不完整                           |
| 剪枝粒度 | **A: 按主题子集**（推荐）            | 生成 `light-subset.ts` / `dark-subset.ts`，消费者显式 import |
|          | B: 运行时按需注入                    | 灵活但增加首次渲染延迟                                       |
| 弃用警告 | **A: dev-only console.warn**（推荐） | 零生产开销，开发者友好                                       |
|          | B: 构建时报错                        | 更严格但可能阻塞 CI                                          |

**关键挑战：**

1. **动态 Token 引用**——`style={{ background: `var(--iris-${colorVar})` }}` 无法被静态扫描捕获。缓解：提供 `registerDynamicToken()` API，让开发者主动声明动态 token。
2. **插件 Token 的可见性**——`plugin.registerTokens()` 在运行时执行，构建时扫描器无法感知。缓解：要求插件在 `package.json` 中声明 `"irisTokens": [...]`。
3. **继承链 Token 的去重**——Skin A `extends` Skin B 时，A 覆盖其中 3 个 token 但继承其余。Purger 需要解析继承链的全量展开。

**对现有系统的影响**：极低。`@iris-ui/token-lifecycle` 是全新的独立包，不修改现有 `applyTheme()` 或 `IrisTheme` 类型。版本化改造只需在 `IrisTheme` 中加入 `version: number` 和可选的 `$deprecated`（20 行类型变更）。

---

### 方向 B：组合契约测试框架（文档方向 2，深化）

**文档的判断正确**：组合测试是测试策略中最高 ROI 的缺口。我补充以下几点：

**更深层的架构价值**：

1. **跨框架差异放大检测器**。单组件测试无法捕获的差异，往往在组合场景中暴露——例如 React 的 `useSyncExternalStore` 批量更新时序 vs Svelte `$state` 同步特性在 Dialog + Table 组合中的行为差异。组合测试是唯一能系统捕获这类差异的手段。

2. **Manifest 驱动场景生成**。Manifest 已经记录了组件间关系（subComponents、plugin owner）。它可以扩展记录 `interactionPairs`（高交互密度的组件对），自动生成组合测试桩。

**建议的架构扩展：**

```
packages/core/src/contracts/scenarios/compositions/
├── pairs.json              # 显式声明的组合对 { pair: "dialog+table", risk: "focus-trap eats pagination" }
├── dialog-with-table.ts    # 手工编写的高价值场景
├── form-with-select.ts
├── resize-with-virtual.ts
├── tabs-with-virtual.ts
├── behavior-plus-component.ts
└── generated/              # auto-generated 从 pairs.json + manifest 生成的场景
    ├── dialog-with-tree.ts
    ├── popover-with-form.ts
    └── ...
```

**关键决策：手工编写 vs 自动生成**

- **高价值场景（5-8 个）**：手工编写，覆盖旗舰组件组合（Dialog+Table, Form+Select, Resizable+VirtualScroll, Tabs+VirtualScroll, Movable+Dialog）。
- **中价值场景（20-30 个）**：从 Manifest 的 `interactionPairs` 自动生成，使用模板化步骤（打开 A → 在 A 中操作 B → 断言状态）。
- **低价值（避免）**：不覆盖所有 N×N 组合——这是组合爆炸陷阱。

**测试运行架构**：直接复用现有的 `runContract()` runner。组合场景的定义格式与单组件场景完全一致（`ContractScenario` 类型）。四框架已有 driver 实现——只需确认各 driver 支持在多组件实例中按 selector 定位。

**价值：** 组合测试覆盖是项目进入"生产就绪"状态的必要条件。CMS 应用零测试（文档指出）的风险可以部分通过组合测试缓解——不需要 E2E 测试就能覆盖关键的交互路径。

---

### 方向 C：基于 Web Components 的跨框架互操作桥（文档方向 3，重构方案）

**文档的方案是合理的**，但我想提出一个不同的架构基点。

**文档提出的方案**：`@iris-ui/bridge` 包 + `<IrisIsland>` 自定义元素，在每个框架中提供 hook 来嵌入其他框架的组件。

**我的建议**：**不要直接在框架之间搭桥，而是让每个 Iris 组件都能以 Custom Element 渲染。**

核心思路：

```
IrisComponent (React/Vue/Solid/Svelte 原生实现)
    └── 通过 defineCustomElement() 包装器暴露为 CE
        └── 在任意框架中通过 <iris-button variant="solid"> 使用
```

**为什么这比框架对框架桥更好？**

| 方案                          | 复杂度                           | 维护成本                        | 通用性                    | 性能                |
| ----------------------------- | -------------------------------- | ------------------------------- | ------------------------- | ------------------- |
| 框架→框架桥                   | O(N²) —— 4 框架需 12 个桥        | 每个框架版本升级都要更新 N 个桥 | 仅限于 Iris 组件          | 直接函数调用        |
| **Custom Element 桥**（推荐） | **O(N)** —— 每组件一个 CE 包装器 | 框架升级时只改 CE 包装器        | **任何框架 + 无框架页面** | CE 边界有序列化开销 |

**架构变更：**

```
// 每框架适配器新增（示例：React 版）
// packages/react/src/ce/index.ts
import { defineCustomElement } from './defineCustomElement'
import { IrisButton } from '../primitives/button'

export const IrisButtonElement = defineCustomElement(IrisButton, {
  props: ['variant', 'size', 'disabled', 'loading', ...],
  events: ['onClick'],  // → CE 'click' event
})

// 消费者用法（在 Vue 应用中）：
<iris-button variant="solid" @click="handleClick">Save</iris-button>
```

**关键挑战：**

1. **Context/Provide 桥接**——React Context、Vue `provide/inject`、Svelte `setContext` 在 CE 边界中不可见。需要为每个 Provider（`IrisProvider` / `SkinProvider` / `I18nProvider`）提供 CE 兼容的桥接。
2. **事件转发**——CE 使用原生 DOM 事件，而框架组件使用框架事件系统（React `onClick` → 合成事件）。需要有统一的 `@iris-ui/bridge/events` 做事件映射。
3. **样式隔离 vs 穿透**——CE 的 Shadow DOM 会隔离样式，与 Iris UI 的 `var(--iris-*)` 全局变量模式冲突。解决方案：使用 `inherit` 策略或 `adoptedStyleSheets`。
4. **Portal/Teleport 逃逸**——CE 内的 Portal 需要逃逸到 `document.body` 而不是 CE shadow root。

**推荐实施顺序**（不更改文档给出的 v2 时机）：

- Phase 1：Provider 状态桥（将 theme/skin/i18n 状态通过 `postMessage` 或共享 store 暴露）
- Phase 2：`<IrisIsland>` 自定义元素，但不使用 Shadow DOM（继承全局样式）
- Phase 3：完整的 `defineCustomElement` 包装器生成器

---

### 方向 D：组件级 bundle 分析器（文档方向 5，深化 + 与 Manifest 集成）

**文档的方案已经很好**——我补充架构层面的集成建议。

**核心洞察**：`@iris-ui/manifest` 已经记录了组件名、导入路径、框架、插件归属。size analyzer 可以基于 Manifest 的组件图做分析，而不需要重新扫描源码。

**建议架构：**

```
@iris-ui/size-analyzer (新增包)
├── index.ts                   # 入口：analyzeAll() → SizeReport
├── graph.ts                   # 从 Manifest + 源码构建组件依赖图
│   ├── nodes: 每个组件 + 每个 core 模块
│   └── edges: import 关系（static vs dynamic）
├── measure.ts                 # 对每个子路径入口运行 esbuild minify + gzip
├── incremental.ts             # 边际成本计算（"加一个组件多少钱"）
├── report.ts                  # 报告生成（markdown / json / GitHub Comment）
└── cli.ts                     # pnpm size:component-card

# 集成到 Manifest Schema——增加依赖图信息
IrisManifest {
  // ... 现有字段
  dependencyGraph?: {
    nodes: { name: string, type: 'component' | 'module' | 'plugin' | 'external' }[]
    edges: { from: string, to: string, weight: 'static' | 'dynamic' | 'lazy' }[]
  }
}
```

**消费者可看到的信息（以 React 为例的假设数据）：**

| 导入路径                  | gzip 净增 | 累计    | 占总包比例 |
| ------------------------- | --------- | ------- | ---------- |
| `@iris-ui/react` (barrel) | 73.4 KB   | 73.4 KB | 100%       |
| `import { IrisButton }`   | 22.9 KB   | 22.9 KB | 31%        |
| `+ IrisInput`             | +4.2 KB   | 27.1 KB | 37%        |
| `+ IrisDialog`            | +8.7 KB   | 35.8 KB | 49%        |
| `+ IrisTable`             | +18.3 KB  | 54.1 KB | 74%        |
| `+ IrisVirtualScroll`     | +12.1 KB  | 66.2 KB | 90%        |
| `+ IrisSelect`            | +7.2 KB   | 73.4 KB | 100%       |

**这个表的核心价值**：开发者可以准确回答"用 Iris UI 写一个带表格的弹窗要多少钱"。

**边界情况处理：**

| 边界                                                  | 处理方案                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| tree-shaking 优化差异（webpack vs esbuild vs rollup） | 用 esbuild 测量（提供"最佳情况"基线），同时标注"实际值取决于 bundler" |
| 子路径导入的非对称性                                  | 同时对 barrel 入口和子路径入口（`@iris-ui/react/table`）做测量        |
| CSS 运行时注入成本                                    | 扩展 `measure.ts` 计算 `applyTheme()` 生成的 CSS 文本 gzip 大小       |
| 插件动态导入                                          | 标注为 `type: 'lazy'`，在报告中显示为"条件性加载"                     |

---

### 方向 E：从 Manifest 到依赖性"物料清单"（本轮新增，未在文档中涉及）

这是一个**全新的方向**，文档中的 5 个方向都没有覆盖的面：

**现状**：Manifest 记录组件→框架映射和组件元数据，但**没有任何"谁依赖谁"的信息**。

**问题**：

- 不知道 `IrisProTable` 依赖哪些 core 控制器（`createDataSource` / `createCellEdit` / `createExpansion` / `filterSort` / `paginate`）
- 不知道两个插件是否依赖同一个 core 模块的不同版本
- 无法回答"如果我移除 `IrisTable`，可以删除哪些 core 代码？"
- 仲裁工具（如 ESLint `no-restricted-imports`）无法精确限制不必要的深层依赖

**建议：**

```
# 新增：Component Bill of Materials (@iris-ui/manifest 的扩展)

# 生成方式：在 pnpm gen:manifest 时，除组件发现外，扫描 import 图
# 存储结构：
IrisManifest {
  // ...
  billOfMaterials: {
    // 每个组件依赖哪些 core 控制器
    components: {
      "IrisTable": {
        imports: [
          "createStore", "createSelectionModel", "createExpansion",
          "filterSort", "paginate", "dataIndexOf", "flattenLeafColumns",
          "computeVirtualRange"
        ],
        plugins: [],  // 依赖哪些插件
        peerDependencies: ["@floating-ui/dom"],
      },
      "IrisProTable": {
        imports: [
          ...IrisTable.imports,  // 继承父组件依赖
          "createDataSource", "createCellEdit", "createResourceController"
        ],
        plugins: ["@iris-ui/plugin-pro-table"],
      }
    }
  }
}
```

**价值场景**：

1. **Tree-Shaking 配置**：从 BOM 自动生成 webpack/rollup 的 `sideEffects` 配置
2. **插件冲突检测**：两个插件如果依赖同一 core 控制器但版本不同 → 告警
3. **ESLint 规则**：禁止组件导入其不需要的 core 模块（架构守门）
4. **CLI 脚手架**：`pnpm iris add IrisTable` 自动安装所有间接依赖
5. **Size 分析的数据源**：BOM 是方向 D（bundle analyzer）的依赖图数据源

---

## 3. 接口设计建议

### 关键模块接口设计原则

**原则一：Consumer 接口保持零感知**

工具类和基础设施（token-optimizer / size-analyzer / token-lifecycle）**不应要求消费者做任何事**来获得基础收益。例如：

- ✅ `token-lifecycle` 默认：`applyTheme()` 在 dev 模式自动检测弃用 token 并 `console.warn`
- ❌ 不要求：消费者手动 import `deprecationChecker` 并调用

**原则二：工具产生可消费的数据产物，而非运行时依赖**

```
# 构建时产物（check-in 到 repo）
manifest.json          # 已存在
token-usage.json       # 新增：{ "used": ["iris.primary", ...], "declared": [...], "dead": [...] }
size-card.json         # 新增：{ "button": 22.9, "input": 4.2, "dialog": 8.7, ... }
component-bom.json     # 新增：{ "IrisTable": { imports: [...], plugins: [...] } }

# CI 使用这些产物做门禁，而不在运行时做分析
```

**原则三：向后兼容性优先于一切**

所有 5 个方向的引入方式：

| 方向              | 引入方式             | 对现有消费者的影响                           |
| ----------------- | -------------------- | -------------------------------------------- |
| Token Lifecycle   | 新包，可选 import    | 零影响——现有 `applyTheme()` 继续可用         |
| Composition Tests | 新增测试场景         | 零影响——只增加测试覆盖率                     |
| Framework Bridge  | 新包，可选使用       | 零影响——现有框架适配器不修改                 |
| Size Analyzer     | 新工具脚本           | 零影响——只增加 CI 门禁                       |
| Component BOM     | Manifest schema 扩展 | 向后兼容——新增字段可选，旧 manifest 继续可用 |

### 是否需要新的抽象层

**需要两个新的抽象层：**

**抽象层一：Token 注册中心**

```
当前：token 分散在 light.ts / dark.ts / plugin-editor/registerTokens() / skin.patch()
                                    ↓
目标：所有 token 集中注册（构建时 + 运行时双通道）
@iris-ui/token-lifecycle/register
  ├── declare(token: TokenDefinition)    // 构建时声明
  ├── register(token: TokenDefinition)   // 运行时注册（插件用）
  └── resolve(name: string): TokenDef    // 查询 token 元数据
```

**为什么需要**：当前无法回答"项目所有 token 中，哪些正在使用，哪些已弃用"。注册中心提供了单一真相源。

**抽象层二：组件依赖图**

```
当前：依赖关系隐式存在于 import 语句中，没有任何数据结构描述
                                    ↓
目标：@iris-ui/manifest 扩展 dependencyGraph
  ├── nodes: { name, type, package, framework }
  ├── edges: { from, to, kind ('static'|'lazy'|'plugin') }
  └── metadata: { coreModules: string[], peerDeps: string[] }
```

**为什么需要**：方向 D（size analyzer）和方向 E（BOM）都依赖依赖图数据。手动维护不可行，需要自动从源码扫描生成。

---

## 4. 技术选型

### 需要引入的新技术/库

| 工具                               | 替代方案                                | 建议                                                 | 理由                                                             |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **AST 解析器**（Token scanning）   | `@swc/core` / `@babel/parser` / `regex` | **`@swc/core`**                                      | 项目已用 swc；wasm 版可无 node-gyp；parse-only 模式极快          |
| **Bundler 分析**（Size profiling） | `esbuild` / `rollup` / `webpack-stats`  | **esbuild**（已用）                                  | 现有 `check-size.mjs` 已依赖 esbuild；API 一致；速度满足         |
| **CLI 框架**（codemod + 工具）     | `commander` / `yargs` / `citty`         | **`citty`**                                          | 极轻（0 dep，树摇友好）；项目已在 MCP 中使用                     |
| **Custom Element 生成**            | `Lit` / `Stencil` / 手写                | **手写 + `@webcomponents/custom-elements` polyfill** | 避免引入完整 CE 框架；每个组件包装器 ~50 行；Iris 组件已解耦框架 |
| **依赖图可视化**                   | `d3-graphviz` / `viz.js` / `mermaid`    | **mermaid**（在 CI comment 中渲染）                  | 文档站已用 VitePress；mermaid 流程图可直接嵌入 GitHub 评论       |

### 第三方依赖评估标准

对于 5 个方向，评估新依赖的标准：

| 标准                         | 权重    | 执行方式                                                                   |
| ---------------------------- | ------- | -------------------------------------------------------------------------- |
| **0 运行时依赖**             | 🔴 必须 | 工具/分析器必须是 devDependencies，不进入消费者 bundle                     |
| **Tree-shake 友好**          | 🟡 重要 | 如果工具代码进入运行时路径（如 Custom Element 桥），选中可 tree-shake 的库 |
| **TypeScript 原生类型**      | 🟡 重要 | 减少类型胶水代码                                                           |
| **无 node-gyp / 原生二进制** | 🟢 推荐 | 避免跨平台构建问题（SWC wasm 版满足）                                      |
| **包体积 < 50KB gzip**       | 🟢 推荐 | 工具类包不应成为安装负担                                                   |

### 自建 vs 采购决策

| 方向                | 自建                         | 采购/复用                                            | 决策                                                                          |
| ------------------- | ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Token 静态扫描      | `@swc/core` AST 遍历 ~200 行 | `purgecss`（通用 CSS）但无法理解 `--iris-` 语义      | **自建**：项目特定逻辑多（Plugin token 白名单、继承链解析），通用工具无法满足 |
| Size 分析           | esbuild 打包 + gzip ~300 行  | `webpack-bundle-analyzer` / `vite-bundle-visualizer` | **混合**：核心测量逻辑自建（已有 `check-size.mjs`），可视化层用现有工具       |
| Custom Element 包装 | 每个组件手写包装器 ~50 行    | `Lit` 框架渲染                                       | **自建**：Lit 会引入额外运行时；CE 包装器只需将 props/events 映射到原生属性   |
| 组合测试自动生成    | template 引擎 ~200 行        | 无现成方案                                           | **自建**：用 Manifest 的 `interactionPairs` 驱动模板生成                      |

---

## 5. 实施路线图

### 优先级排序

```
P0（发布前，立即）：方向 4（Token 版本化）+ 方向 2（组合测试）
P1（发布同时）：     方向 5（Size Analyzer）+ 方向 E（Component BOM）
P2（发布后 v2）：    方向 1（Token Tree-Shaking）+ 方向 3（Framework Bridge）
```

**优先级逻辑推导**：

- **P0 = 发布前必须完成**：Token 版本化是发布后的 breaking change 风险规避。组合测试是生产就绪质量门。两者都是"不做就出问题"。
- **P1 = 发布同时最佳窗口**：Size 分析和 BOM 是消费者信任基础设施，发布时建立基线最自然。"发布后再补"会丢失初始基线。
- **P2 = 发布后 v2**：Tree-shaking 是性能优化而非正确性修复。Framework Bridge 是差异化但高成本的功能——需要 v1 使用数据验证需求强度。

### 阶段划分和里程碑

```
Phase 0（2026-07 下旬，3 天）
├── IrisTheme 增加 version + $deprecated 类型（2 文件变更）
├── applyTheme() dev 模式检测弃用并 console.warn（1 文件变更）
├── scripts/audit-token-deprecations.mjs（新脚本）
├── 3 个组合测试场景：dialog+table、form+select、resizable+virtual-scroll
├── 确认 runner 兼容性（无变更，直接写场景文件）
└── 门禁：组合测试加入 CI

Phase 1（2026-07 末→08 初，1 周）
├── @iris-ui/size-analyzer MVP
│   ├── component-graph.ts（从 Manifest + 源码构建）
│   ├── measure.ts（esbuild 逐组件 minify + gzip）
│   └── report.ts（markdown 输出）
├── @iris-ui/manifest 扩展 billOfMaterials（Build-time 扫描）
├── CI 门禁：pnpm size:component-card 对比 PR baseline
└── 产物体检：发布前手动运行一次，生成 size-card.md 附入文档站

Phase 2（2026-08，2 周）
├── @iris-ui/token-lifecycle
│   ├── scanner.ts（@swc/core AST 扫描 var(--iris-*)）
│   ├── purger.ts（从 usage-db 生成 light-subset / dark-subset）
│   └── codemod.ts（rename-token CLI）
├── pnpm gen:manifest 集成 token-usage.json
└── 文档：Token 生命周期最佳实践

Phase 3（2026-09+，按市场反馈触发）
├── @iris-ui/bridge phase 1：Provider 状态桥
├── @iris-ui/bridge phase 2：<IrisIsland> 自定义元素
├── @iris-ui/bridge phase 3：defineCustomElement() 包装器生成器
└── 文档：跨框架互操作指南 + 微前端集成演示
```

### 风险点和缓解策略

| 风险                                                                                | 概率  | 影响  | 缓解策略                                                                                       |
| ----------------------------------------------------------------------------------- | ----- | ----- | ---------------------------------------------------------------------------------------------- |
| **Token 版本化的类型膨胀**——`$deprecated` 记录在 `IrisTheme` 类型中可能导致类型臃肿 | 🟡 中 | 🟡 中 | 使用 `@internal` 标记 + `version` 可选字段；`$deprecated` 仅在开发构建中包含类型，生产构建剥离 |
| **组合场景的组合爆炸**——团队倾向覆盖所有 N×N 组合                                   | 🟢 低 | 🟡 中 | 强制 80/20 规则：前 5 个高价值场景覆盖 80% 真实交互模式。超出 8 个场景需要架构评审             |
| **Size analyzer 数据不稳定**——不同 bundler 版本产生不同结果                         | 🟡 中 | 🟡 中 | 固定 esbuild 版本做测量基准；报告标注"典型值"，不承诺精确值                                    |
| **Framework Bridge 增加 CI 矩阵复杂度**——每个 PR 需要验证 4+ 框架的桥接             | 🔴 高 | 🔴 高 | **Phase 3 才做**。先收集社区反馈验证需求强度。如果需求不足，不投入                             |
| **Token scanner 误报率**——静态分析无法处理动态 token 引用                           | 🟡 中 | 🟢 低 | 提供 `registerDynamicToken()` 白名单机制。误报保守处理（保留而非删除）                         |
| **部署窗口冲突**——发布延迟                                                          | 🟢 低 | 🔴 高 | Phase 0 严格控制在 3 天内完成；不阻塞发布流程。如果 Phase 1 未完成，不影响发布                 |

### 关键依赖链

```
                    ┌─────────────────────────────────────┐
                    │      @iris-ui/manifest 扩展 BOM      │
                    │  (新增 dependencyGraph + billOfMat)  │
                    └──────────┬──────────────────────┬────┘
                               │                      │
                    ┌──────────▼──────┐    ┌──────────▼──────┐
                    │  Size Analyzer │    │ Component BOM    │
                    │  (消费 BOM)    │    │ (消费 Manifest)  │
                    └──────────┬──────┘    └──────────┬──────┘
                               │                      │
                    ┌──────────▼──────────────────────▼──────┐
                    │         Token Lifecycle Platform        │
                    │ (scanner 消费 Manifest BOM 做白名单)    │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────┐
                    │          Framework Bridge            │
                    │ (消费 Manifest 的组件/框架映射)       │
                    └────────────────┬────────────────────┘
                                     │
                    ┌────────────────▼────────────────────┐
                    │        CMS / 微前端 集成          │
                    └─────────────────────────────────────┘
```

**无需等待的并行路径**：方向 2（组合测试）完全独立于其他所有方向，且已就绪的基础设施让它可以立即开始。

---

## 总结

这 5 个方向不是随机的"好点子"——它们是一套从代码仓库的架构缝隙中自然生长出来的**系统性补充**。

它们共享一个共同主题：**Iris UI 的组件和 token 系统在"定义"层非常健壮，但在"审计/分析/优化/生命周期"层几乎空白**。Manifest 是唯一的分析产物，但它记录的是组件做什么而不是组件花多少钱、依赖什么、哪些已过时。

对我而言，文档中最有力的论断是："Token 版本化现在建立比发布后建立成本低 10 倍"——这一条单独就值得将 Phase 0 作为发布前必须项。

**最后建议**：不要试图在发布前完成所有 5 个方向。在 Phase 0 完成 Token 版本化和组合测试后的第二天就应该发布——这两个方向确保的是**正确性和可维护性**，而不是功能完整性。剩下方向的好处在发布后通过消费者真实使用数据来验证和驱动。
