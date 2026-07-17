现在我已经对整个项目的测试状况有了全面了解，让我给出完整的 QA 评审。

---

# Iris UI 测试子系统 — QA Lead 评审报告

**评审日期**：2026-07-06  
**评审范围**：Iris UI 全仓库（25 包，634 测试文件，149 组件 × 4 框架）  
**项目 AGENTS.md 关键测试描述**："约 1500+ 测试，四道质量门 + size 预算 + RSC + bench + format + arch-check 全绿"

---

## 1. 测试覆盖分析

### 1.1 按包统计

| 包                         | 单元测试            | 集成测试            | 跨框架契约测试   | E2E | 缺口               |
| -------------------------- | ------------------- | ------------------- | ---------------- | --- | ------------------ |
| `@iris-ui/core`            | ✅ ~60+ 文件        | ✅ 表单/数据集成    | ✅ 框架无关场景  | ❌  | 无 E2E，1 个 bench |
| `@iris-ui/react`           | ✅ ~93 原生测试文件 | ✅ 合约驱动 39 场景 | ✅ React 侧契约  | ❌  | 无 E2E/视觉回归    |
| `@iris-ui/vue`             | ✅ ~98 原生测试文件 | ✅ 合约驱动 39 场景 | ✅ Vue 侧契约    | ❌  | 同 React           |
| `@iris-ui/solid`           | ✅ ~92 原生测试文件 | ✅ 合约驱动 39 场景 | ✅ Solid 侧契约  | ❌  | 同 React           |
| `@iris-ui/svelte`          | ✅ ~93 原生测试文件 | ✅ 合约驱动 39 场景 | ✅ Svelte 侧契约 | ❌  | 同 React           |
| 插件(11包)                 | ⚠️ 1-5 文件/包      | ⚠️ 少量             | ❌ 无契约        | ❌  | 插件测试明显不足   |
| `skins/tokens/theme/icons` | ❌ 近乎无           | ❌                  | ❌               | ❌  | **严重缺口**       |
| `manifest`                 | ✅ 5 测试文件       | ✅ 契约覆盖守卫     | —                | —   | 足够               |
| CMS demo 应用 (×4)         | ❌                  | ❌                  | ❌               | ❌  | demo 应用无测试    |

### 1.2 按组件层级统计

| 层级                    | 单元测试         | 集成测试      | 特殊测试               | 缺口                    |
| ----------------------- | ---------------- | ------------- | ---------------------- | ----------------------- |
| **Layer 0** (core 逻辑) | ✅ 全面          | ✅ 表单/数据  | SSR 安全 ✅            | 未见显著缺口            |
| **Layer 1** (元原语)    | ✅ 四框架        | ✅ 契约       | a11y ✅ 水合 ✅ SSR ✅ | 部分复杂组件测试浅      |
| **Layer 2** (复合组件)  | ✅ 四框架        | ⚠️ 部分       | a11y ✅ 水合 ✅ SSR ✅ | Table 操作路径不完整    |
| **Layer 3** (布局)      | ⚠️ 基础存在      | ❌ 组合测试   | —                      | **缺口**                |
| **Layer 4** (系统骨架)  | ✅ Admin 测试    | ⚠️            | —                      | 登录/Dashboard 未充分测 |
| **插件系统**            | ⚠️ 1-5 测试/插件 | ❌ 插件间组合 | —                      | **严重缺口**            |

### 1.3 测试类型覆盖矩阵

| 测试类型                 | 现状                                       | 覆盖程度        |
| ------------------------ | ------------------------------------------ | --------------- |
| **单元测试**（业务逻辑） | core 60+ 测试文件，每适配器 90+            | ✅ 极好         |
| **组件渲染测试**         | 所有四框架 149 组件均有 mount 测试         | ✅ 好           |
| **行为测试**（交互驱动） | 契约系统 39 场景 × 4 框架 = 156 条行为测试 | ✅ 优秀         |
| **SSR 测试**             | React/Vue/Solid/Svelte 各有 ssr.test       | ✅ 好           |
| **水合测试** (Hydration) | React/Vue/Solid/Svelte 各有 hydration.test | ✅ 好           |
| **可访问性测试**         | 每框架 `a11y.test` (axe-core, WCAG A/AA)   | ✅ 好           |
| **跨框架行为对等测试**   | `contract-coverage.test.ts` 守卫           | ✅ **极优秀**   |
| **断言密度守卫**         | 禁止 `expect: []` 的空步骤                 | ✅ **优秀实践** |
| **性能基准测试**         | 仅 core 1 个 bench 文件                    | ⚠️ 严重不足     |
| **端到端测试**           | 无 Playwright/Cypress                      | ❌ **严重缺口** |
| **安全测试**             | 无                                         | ❌              |
| **混沌测试**             | 无                                         | ❌              |
| **视觉回归测试**         | 无 (无 Chromatic/Storybook)                | ❌              |
| **皮肤/主题测试**        | 近乎无                                     | ❌ **严重缺口** |
| **i18n 测试**            | core 有 i18n.test，适配器缺少渲染验证      | ⚠️              |
| **插件系统集成测试**     | 插件间组合未测                             | ❌ **缺口**     |

---

## 2. 详细发现

### 🔴 发现 F1 — CI 未强制执行代码覆盖率百分比

| 字段           | 值                                                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Infrastructure                                                                                                                                                                                                                                                                                             |
| Severity       | **Critical**                                                                                                                                                                                                                                                                                               |
| Title          | CI 没有覆盖率百分比阈值门禁                                                                                                                                                                                                                                                                                |
| Location       | `.github/workflows/ci.yml` — `pnpm test:coverage` 步骤                                                                                                                                                                                                                                                     |
| Description    | CI 中的 `pnpm test:coverage` 仅调用 `scripts/test-coverage-report.mjs`，该脚本只检查**测试文件行数**（若高复杂度组件测试文件 <50 行则 warn），**不是真正的代码覆盖率百分比**。没有 `--coverage` 标志，没有 `thresholds` 配置，增量代码可以零覆盖率通过 CI。Vitest 原生支持 `coverage.threshold` 但未启用。 |
| Risk           | 新代码可以无测试覆盖合并，随时间累积测试债务；复杂组件（Table、Tree、DataGrid）的关键路径可能在无测试覆盖下恶化。                                                                                                                                                                                          |
| Recommendation | 在 vitest 配置中启用 `coverage.thresholds`，对 core 和适配器设置分级目标（core ≥90%，适配器 ≥75%，插件 ≥60%）。将覆盖率作为 CI 门禁（非 advisory）：<br>`// vitest.config.ts`<br>`coverage: { provider: 'v8', thresholds: { perFile: true, statements: 80, branches: 70, functions: 75, lines: 80 } }`     |
| Priority       | **P0**                                                                                                                                                                                                                                                                                                     |

### 🔴 发现 F2 — 主题/皮肤/图标/tokens 包无测试

| 字段           | 值                                                                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Coverage                                                                                                                                                                                                                                                                                                                                      |
| Severity       | **Critical**                                                                                                                                                                                                                                                                                                                                  |
| Title          | 主题系统包（tokens/theme/skins/icons）无单元测试                                                                                                                                                                                                                                                                                              |
| Location       | `packages/tokens/`, `packages/theme/`, `packages/skins/`, `packages/icons/`                                                                                                                                                                                                                                                                   |
| Description    | 这四个包是 Iris UI 的**视觉基础**（CSS 变量生成、`applyTheme`/`applyCssVars`/`createThemeStore`、皮肤加载/继承/持久化/FOUC 防闪、`toCssVarName`、RTL 逻辑属性转换、减动效查询、图标结构化节点），但没有任何测试文件。皮肤的市场 SDK（`patch`/`resetPatch`/`createSkinEngine`/`SkinStorage` 可插拔存储）是无测试覆盖的关键基础设施。           |
| Risk           | 主题系统是**每条 CSS 变量的唯一来源**。一个错误的 `toCssVarName`（dots→dashes 转换）会破坏全局换肤；皮肤继承解析 bug 会导致全站样式错误；FOUC 防闪 script 注入错误会导致页面闪烁。这些 bug 在视觉上明显但单元测试可以极低成本捕获。                                                                                                           |
| Recommendation | 为每个包添加基础测试套件：<br>• `tokens`：测试 `toCssVarName`、token 结构完整性<br>• `theme`：测试 `applyTheme`/`applyCssVars`/`createThemeStore`（light/dark 切换、跟随系统）<br>• `skins`：测试 `createSkinEngine`、皮肤继承（`extends`）、解析、`patch`/`resetPatch`、持久化、FOUC script<br>• `icons`：测试所有导出的图标名称和结构完整性 |
| Priority       | **P0**                                                                                                                                                                                                                                                                                                                                        |

### 🔴 发现 F3 — 无端到端测试

| 字段           | 值                                                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Test Types                                                                                                                                                                                                                             |
| Severity       | **Critical**                                                                                                                                                                                                                           |
| Title          | 全仓库无 E2E 测试（Playwright/Cypress）                                                                                                                                                                                                |
| Location       | 全仓库                                                                                                                                                                                                                                 |
| Description    | 虽有 1500+ 单元/集成/契约测试，但**零 E2E 测试**。CMS demo（4 框架变体）、playground、文档站点都没有 Playwright/Cypress 配置。关键用户流程（登录→导航→CRUD 操作→登出）从未在真实浏览器环境中验证。                                     |
| Risk           | 单元/集成测试在 jsdom 中运行，不捕获真正的浏览器行为：样式层叠、实际渲染布局、网络条件、重定向、cookie/令牌刷新、真实焦点管理。SSR 水合错误可能只在真实浏览器中显现。跨框架 CMS demo 可能在某些浏览器中完全损坏而未被发现。            |
| Recommendation | • 为 CMS demo 添加 Playwright：覆盖「用户浏览→查看列表→创建/编辑→删除」CRUD 循环<br>• 为文档站点添加 E2E：覆盖导航、搜索、主题切换<br>• 重点关注**四框架 CMS**的跨框架对等 E2E 测试<br>• 最少 P0：一个完整 CRUD 流程 + 主题切换 + 登录 |
| Priority       | **P0**                                                                                                                                                                                                                                 |

### 🟠 发现 F4 — 插件测试严重不足

| 字段           | 值                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Coverage                                                                                                                                                                                                                                                                                                                                                |
| Severity       | **High**                                                                                                                                                                                                                                                                                                                                                |
| Title          | 11 个插件包中每个仅有 1-5 个基础测试                                                                                                                                                                                                                                                                                                                    |
| Location       | `packages/plugin-*/`                                                                                                                                                                                                                                                                                                                                    |
| Description    | 11 个插件（admin/calendar/charts/dashboard/editor/form-builder/kanban/locale-zh/markdown/notifications/pro-table/query-builder）各有极少量测试（通常 core 一个测试 + 每个框架一个基础 mount 测试），没有测试插件安装/注册、插件间组合、usePlugin 集成、插件 store 共享、插件 token/i18n 注册。locale-zh 插件应该测试中文本地化覆盖，但只有 mount 测试。 |
| Risk           | 插件是 Iris UI 的**扩展性故事**。如果插件安装 buggy、插件间 token 冲突、或 usePluginStore 在某些框架上断裂，整个「按需插拔」价值承诺就会破碎。插件通常是最少审查的代码路径。                                                                                                                                                                            |
| Recommendation | • 每个插件至少应有：安装注册测试、i18n 消息注入测试、token 注册测试、核心逻辑单元测试<br>• 添加跨插件组合测试（如 plugin-editor + plugin-pro-table）<br>• locale-zh：测试 `t()` 返回中文而非默认英文                                                                                                                                                    |
| Priority       | **P1**                                                                                                                                                                                                                                                                                                                                                  |

### 🟠 发现 F5 — 性能基准测试不足（仅 1 个 bench 文件）

| 字段           | 值                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Test Types                                                                                                                                                                                                                                                                                                                                      |
| Severity       | **High**                                                                                                                                                                                                                                                                                                                                        |
| Title          | 性能基准测试只有 1 个文件（scale.bench.ts）                                                                                                                                                                                                                                                                                                     |
| Location       | `packages/core/src/scale.bench.ts`                                                                                                                                                                                                                                                                                                              |
| Description    | 全仓库只有 1 个基准测试文件（覆盖 `scale` 模块），在大约 60+ core 模块中。关键性能敏感模块（virtualizer 的 Fenwick 树、data-view 的 filter→sort→paginate pipeline、selection 模型在大数据集上的操作、form 验证引擎、resource controller 的 CRUD 操作）没有基准测试。CI 中 benchmark 步骤被标记为 `continue-on-error: true`（advisory 非门禁）。 |
| Risk           | 重构 core 逻辑（如从数组切换到 Set 或 Fenwick 树）时，无基准测试就无法察觉性能退化。`createVirtualizer` 的 Fenwick/BIT 树用于 O(log n) 增量偏移计算是其核心价值，但没有性能基准。在大数据集（10k+ 行）上的 Selection 操作可能 O(n²) 退化而不被发现。                                                                                            |
| Recommendation | • 为以下模块添加 vitest bench：`virtualizer`（各种数据规模下的 findIndex/totalSize）、`selection`（10/100/1000/10000 键的 toggle/selectAll）、`data-view`（排序/过滤不同大小数组）、`pagination`（getPageRange 大页面数）<br>• 设置性能回归阈值（p95 < 基准 × 1.5）<br>• 将 bench 从 advisory 升级为关键模块的必过门禁                          |
| Priority       | **P1**                                                                                                                                                                                                                                                                                                                                          |

### 🟠 发现 F6 — 布局组件（Layer 3）测试覆盖不足

| 字段           | 值                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Category       | Coverage                                                                                                                                                                                               |
| Severity       | **Medium**                                                                                                                                                                                             |
| Title          | 布局组件（Stack/Container/Grid/Sidebar/DashboardGrid）测试浅                                                                                                                                           |
| Location       | `packages/*/src/primitives/*/` 布局组件                                                                                                                                                                |
| Description    | 布局组件渲染 DOM 结构但缺乏：<br>• 响应式 breakpoint 测试<br>• 嵌套布局组合测试<br>• 间距/spacing 合并规则测试<br>• Sidebar 折叠/展开交互测试<br>• DashboardGrid 拖拽重排测试<br>• 逻辑属性（RTL）测试 |
| Risk           | 布局组件形成**页面脚手架**。间距合并 bug 导致页面布局破碎，或 RTL 方向 bug 影响整个应用，这些是低频率但高影响的故障模式。                                                                              |
| Recommendation | • 为每个布局组件添加：响应式 prop 测试、spacing 合并逻辑测试、RTL 方向测试<br>• 添加布局组合集成测试（Sidebar + Header + Content 如何协同）                                                            |
| Priority       | **P1**                                                                                                                                                                                                 |

### 🟡 发现 F7 — 复杂组件（Cascader/DatePicker/ColorPicker）测试浅

| 字段           | 值                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Coverage                                                                                                                                                                                                                                                                                                                                                                          |
| Severity       | **Medium**                                                                                                                                                                                                                                                                                                                                                                        |
| Title          | 高复杂度组件测试低于 attention-needed 阈值                                                                                                                                                                                                                                                                                                                                        |
| Location       | 由 `scripts/test-coverage-report.mjs` 中的 HIGH_COMPLEXITY 列表定义                                                                                                                                                                                                                                                                                                               |
| Description    | 高复杂度组件（cascader/date-picker/date-range-picker/color-picker/transfer/tree-select/mentions/tag-input/time-picker/combobox/pro-table/tree/table）的测试文件可能 < 100 行。项目已有脚本检测到这一点，但**没有强制门禁**——脚本仅在 p95 过高时 exit 1，不是每个组件都有阈值。这些组件比 Button/Input 有更多内部状态（面板展开/折叠、选中值、搜索过滤、键盘导航、多种选择模式）。 |
| Risk           | 这些是用户**日常使用的复杂组件**。无测试覆盖的交互路径（如 cascader 的键盘导航、date-picker 的边界月份、color-picker 的 HSV → RGB 转换）是回归热点。                                                                                                                                                                                                                              |
| Recommendation | • 为每个高复杂度组件创建最简测试清单并跟踪完成度<br>• 设置组件级测试行数阈值（高复杂度 ≥ 150 行，或更理想的是：按交互路径数 \* 变体数）<br>• 在 CI 中使 attention-needed 检查成为门禁                                                                                                                                                                                             |
| Priority       | **P2**                                                                                                                                                                                                                                                                                                                                                                            |

### 🟡 发现 F8 — 无模糊/随机测试（Fuzz Testing）

| 字段           | 值                                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Test Types                                                                                                                                                                                                                                                                              |
| Severity       | **Medium**                                                                                                                                                                                                                                                                              |
| Title          | 无模糊测试覆盖边界输入                                                                                                                                                                                                                                                                  |
| Location       | 全仓库                                                                                                                                                                                                                                                                                  |
| Description    | 没有使用 fast-check、zod 或其他基于属性的测试框架。边界输入值（NaN、undefined、超大数字、深层嵌套对象、Unicode 字符串）通过显式单元测试检查，而非由 property-based 生成器穷举覆盖。这对于数据操作函数（compareValues、cycleSort、getPageRange、formatLocalISO）和 path 模块特别有价值。 |
| Risk           | 非预期的输入组合（如 `compareValues(undefined, null, 'desc')` 或 `getPageRange(-1, 'abc')`）可能导致静默错误返回值或运行时异常。                                                                                                                                                        |
| Recommendation | • 对 core 纯函数（`compareValues`、`cycleSort`、`getPageRange`、`nextEnabledIndex`、`color`/`date`/`nav` 数学）添加 property-based 测试<br>• 使用 `fast-check` 生成随机输入并断言不变量<br>• 优先覆盖 path 模块（路径解析对输入格式敏感）                                               |
| Priority       | **P2**                                                                                                                                                                                                                                                                                  |

### 🟡 发现 F9 — CI 超时限制（15 分钟）可能过紧

| 字段           | 值                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Infrastructure                                                                                                                                                                                                                                                                                                                                          |
| Severity       | **Medium**                                                                                                                                                                                                                                                                                                                                              |
| Title          | CI 作业超时 15 分钟对 1500+ 测试可能过紧                                                                                                                                                                                                                                                                                                                |
| Location       | `.github/workflows/ci.yml` — `timeout-minutes: 15`                                                                                                                                                                                                                                                                                                      |
| Description    | CI 运行：install → format:check → lint → typecheck → build → check:manifest → size → audit:tokens → test:coverage → check:desktop-parity → check:rsc → **test (1500+)** → bench → arch-check:ratchet → arch-check → change-budget。15 分钟超时对全量测试集可能是一个漂移风险：随着测试增加（新组件/新适配器/新契约场景），单次 `pnpm test` 时间会增长。 |
| Risk           | 当测试数量超过 CI 超时阈值时，测试会突然开始静默失败（不在开发者机器上复现），导致"CI 红但是本地绿"的调试噩梦。                                                                                                                                                                                                                                         |
| Recommendation | • 添加 `pnpm test --parallel` 或使用 Turbo 的并行能力<br>• 考虑测试分割（core / react / vue / solid / svelte / plugins / manifest 各一个 job）<br>• 将超时提升到 30 分钟<br>• 在 CI 中添加测试耗时跟踪以监控漂移                                                                                                                                        |
| Priority       | **P2**                                                                                                                                                                                                                                                                                                                                                  |

### 🟢 发现 F10 — 无安全测试（XSS/SQLi/注入）

| 字段           | 值                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category       | Test Types                                                                                                                                                                                               |
| Severity       | **High**                                                                                                                                                                                                 |
| Title          | 无安全相关测试                                                                                                                                                                                           |
| Location       | 全仓库                                                                                                                                                                                                   |
| Description    | 组件接受用户提供的字符串（标签、描述、值），但无测试验证 XSS 预防（如 `dangerouslySetInnerHTML` 使用守卫、`textContent` vs `innerHTML`）。表达式编辑器（作为插件规划中）和文档渲染路径可能需要额外关注。 |
| Risk           | 如果任何组件使用 `innerHTML`（即使只在使用者的数据上），恶意输入可能导致 XSS。皮肤系统接受自定义 token 值，如果 CSS 注入未验证则是攻击面。                                                               |
| Recommendation | • 审计所有 `innerHTML`/`dangerouslySetInnerHTML` 使用并添加测试确保它们被 sanitize<br>• 对皮肤 token 值添加注入测试<br>• 将安全扫描工具（如 `eslint-plugin-security`）添加到 linting pipeline            |
| Priority       | **P2**                                                                                                                                                                                                   |

---

## 3. 关键测试场景覆盖状态

| 场景                          | 类型 | 优先级 | 当前状态                  |
| ----------------------------- | ---- | ------ | ------------------------- |
| Store 创建/获取/订阅/取消订阅 | 单元 | P0     | ✅ 全面                   |
| Selection 模型单/多/同步/范围 | 单元 | P0     | ✅ 全面                   |
| Form 验证（同步/异步/时机）   | 单元 | P0     | ✅ 全面                   |
| 浮层定位 + 关闭（12+ 组件）   | 契约 | P0     | ✅ 33 组件 39 场景        |
| 键盘 Roving 导航              | 契约 | P0     | ✅ Tree/Pagination 等     |
| SSR 渲染无 DOM 不抛错         | SSR  | P0     | ✅ React/Vue/Solid/Svelte |
| 水合无 mismatch               | 水合 | P0     | ✅ React 为主，其他适配器 |
| WCAG A/AA 无障碍              | a11y | P0     | ✅ 四框架 axe 测试        |
| 跨框架行为一致性              | 契约 | P0     | ✅ **39 场景 × 4 框架**   |
| 主题/皮肤应用 + 继承          | 单元 | P0     | ❌ **无测试**             |
| 皮肤持久化 + FOUC 防闪        | 单元 | P0     | ❌ **无测试**             |
| 插件安装/注册/Store           | 集成 | P0     | ❌ **测试不足**           |
| CMS CRUD 端到端流程           | E2E  | P0     | ❌ **无 E2E**             |
| RTL 方向布局                  | 单元 | P1     | ⚠️ 逻辑属性使用但未测试   |
| 大数据集中虚拟滚动            | 基准 | P1     | ⚠️ 仅 1 个 bench          |
| 异步数据源乐观更新            | 集成 | P1     | ✅ Core/契约              |
| 并发 Store 访问               | 单元 | P1     | ⚠️ 有限测试               |
| 错误路径（网络失败、超时）    | 集成 | P1     | ⚠️ 部分覆盖               |
| 日期/时间区域处理             | 单元 | P1     | ✅ Core 测试存在          |
| 插件间组合（表 + 编辑器）     | 集成 | P1     | ❌                        |

---

## 4. 已有测试的优秀实践（亮点）

在指出缺口的同时，必须表彰 Iris UI 测试策略中的**杰出实践**：

1. **跨框架契约系统**（`packages/core/src/contracts/`）—— 这是我看到过的最优秀的跨框架行为对等测试方法之一。39 场景 × 4 框架 = 156 条行为测试，使用框架无关的场景定义 + 框架特定 driver。README 详尽，模式/gotcha 记录清晰，还有 `assertion-density` 守卫禁止空断言步骤。**行业领先实践。**

2. **断言密度守卫**（`assertion-density.test.ts`）—— 禁止 `expect: []`，确保每个步骤至少断言一个可观察结果。这是针对"覆盖率幻觉"的巧妙防护。

3. **契约覆盖守卫**（`contract-coverage.test.ts` in manifest）—— 执行 N 场景 × 4 适配器矩阵完整性，防止场景只接入部分框架。

4. **SSR 测试 + 水合测试** —— 分开 `ssr.test.tsx`（`renderToStaticMarkup` 在 node 环境中）和 `hydration.test.tsx`（`hydrateRoot` + 监视 `console.error` 捕获水合不匹配），且清晰记录了覆盖范围排除（portal 组件超出范围 = 设计决策而非缺口）。

5. **架构棘轮机制**（`arch-check.mjs`）—— 自动检查源文件/测试文件行数、core 不依赖框架、God Object 检测、`as any` 计数，使用 baseline 棘轮允许逐步收紧而非一次性强制。

6. **Size 预算门禁** —— 每个包的 dist/index.js gzip 后设置预算，附详细注释说明每次预算增加的原因。防止"组件越来越胖"的退化。

7. **测试文件即文档模式** —— form 测试按功能分开到 `__tests__/` 目录（`validation.test.ts`、`lifecycle.test.ts`、`step-navigation.test.ts`、`field-value-ops.test.ts`），测试即文档。

8. **RSC 指令检查** —— 自动确保 React 适配器在正确文件中有 `'use client'` 指令，防止 SSR/RSC 渲染时断裂。

---

## 5. 最终总结

| 维度              | 评分             | 说明                                                            |
| ----------------- | ---------------- | --------------------------------------------------------------- |
| **总体测试健康**  | **良好（Good）** | Core + 四适配器单元/集成/契约/SSR/a11y 覆盖极好，但存在显著缺口 |
| **单元测试**      | ⭐⭐⭐⭐⭐       | Core ~60 文件，每适配器 ~93 文件，同生共死模式                  |
| **集成/契约测试** | ⭐⭐⭐⭐⭐       | 39 场景 × 4 框架，断言密度守卫，跨框架一致性                    |
| **SSR/水合/a11y** | ⭐⭐⭐⭐         | 四框架都有，但 Svelte/Solid 水合测试较 React 弱                 |
| **基准测试**      | ⭐               | 1 个文件，CI advisory，严重不足                                 |
| **E2E 测试**      | ⭐               | 零存在                                                          |
| **主题/皮肤测试** | ⭐               | 无                                                              |
| **插件测试**      | ⭐⭐             | 仅基础 mount，无安装/组合/注册测试                              |
| **安全测试**      | ⭐               | 无                                                              |
| **CI 基础设施**   | ⭐⭐⭐⭐         | 多门禁（lint/type/build/size/rsc/arch/manifest）但无覆盖率%门禁 |

### 关键缺口（P0，投入生产前必须解决）

1. **🔴 CI 未强制执行覆盖率百分比** —— 没有 `coverage.thresholds`，新代码可以零覆盖率通过。
2. **🔴 主题/皮肤/图标/tokens 包零测试** —— 视觉基础设施的关键组件未测试。
3. **🔴 无 E2E 测试** —— 无真实浏览器验证，CMS demo 无保护。

### 高优先级缺口（P1，应该解决）

4. **🟠 插件测试严重不足** —— 扩展性承诺的测试基础薄弱。
5. **🟠 性能基准测试不足** —— 仅 1 个 bench 文件，且 CI 中为 advisory。
6. **🟠 布局组件测试浅** —— Layer 3 测试覆盖不足。

### 测试策略改进建议

| 改进                       | 工作量                      | 影响     |
| -------------------------- | --------------------------- | -------- |
| 启用 `coverage.thresholds` | **低**（仅配置）            | **极高** |
| 为主题/皮肤包添加基础测试  | **中**（3-5 测试/包）       | **高**   |
| 为 CMS 添加 Playwright E2E | **高**（2-3 天搭建）        | **极高** |
| 为关键 core 模块添加 bench | **中**（5-10 基准测试）     | **高**   |
| 提升插件测试深度           | **中**（2-5 追加测试/插件） | **高**   |
| 为高复杂度组件设置测试阈值 | **低**（CI 配置）           | **中**   |
| 添加 property-based 测试   | **中**（对纯函数）          | **中**   |

### 快速胜利（低投入高价值）

1. 在 `vitest.config.ts` 中添加 `coverage.thresholds`（各包配置 30 分钟）
2. 为 `skins/src/createSkinEngine.ts` 添加 3 个测试（继承解析 + `patch`/`resetPatch` + FOUC script 生成 ≈ 2 小时）
3. 为 `tokens/src/toCssVarName.ts` 添加测试（dots→dashes 转换 + 自定义命名空间 ≈ 1 小时）
4. 为 `theme/src/applyTheme.ts` 添加测试（light/dark 切换 + CSS 变量生成 ≈ 2 小时）
5. 为 `virtualizer` 添加一个基准测试（Fenwick 树 findIndex 不同规模 ≈ 2 小时）
6. 提升 CI 超时到 30 分钟（5 分钟改动）

### 测试债务总结

Iris UI 的测试策略有其**核心优势**（跨框架契约测试、SSR 分离、断言密度守卫、arch 棘轮、size 预算门禁），但也有**明确的盲点**——主题系统、E2E、基准测试、安全。按 P0→P1→P2 的优先级处理上述缺口，将把这个项目从"良好"提升到"优秀"类别，与 Radix、Naive UI 等一线组件库保持一致。

最令人担忧的单一发现是：当你在 `AGENTS.md` 中说"约 1500+ 测试，四道质量门全绿"时，你在广告测试文化——但缺少覆盖率门禁意味着这些数字在基线中可能已包含了许多无覆盖组件。建议立即对 `core` 和 `react` 包运行一次实际覆盖率报告以建立真实基线。
