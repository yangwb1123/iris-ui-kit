# Iris UI — 扩展路线图（架构 / 产品视角）

> 评估时间：2026-05（基于全局代码扫描刷新）。
>
> **当前基线**：五层架构 + 贯穿主题层 + 正交 Behaviors 层；React 18 / Vue 3.5 双适配器全量对齐（manifest 实测 130 组件两端齐备）；约 2100 项测试、四道质量门常绿。
>
> 价值重心不在再加组件，而在三件事：**(A) 让现有组件拼成真实应用**（表单聚合、数据规模）、**(B) 让它能被选型与采用**（文档/清单、体积、合规）、**(C) 把已知边界与性能天花板补齐**。下列 5 个方向按价值排序，每项给出现状证据、为什么需要、建议范围。**5 个方向（表单引擎 / 文档站 + 清单 + 发布流水线 / a11y + RTL + i18n + 动效合规 / 数据层深化 / 子路径 exports + size 门）均已落地**——见下方「进展」。仅 **首个 npm 发布**（按维护者决定暂缓）与 **QRCode 组件**（按决定跳过）不在交付内。

## 进展（截至 2026-05，5 个方向均已落地）

| #   | 方向                 | 状态      | 已交付（剩余项已全部补齐）                                                                                                                                                                               |
| --- | -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 表单编排引擎         | ✅ 已落地 | `createFormStore`（core）+ `useForm`/`useField`/`<IrisForm>` 两端；`useFieldArray`、提交聚焦首错、Standard Schema 校验适配器均已补齐                                                                     |
| —   | SSR 渲染安全         | ✅ 已落地 | 两端 `useId` 迁移 + 无 DOM 渲染烟雾测试（React/Vue）；React 全量 `'use client'` 客户端边界（RSC/Next.js App Router 安全，`pnpm check:rsc` CI 守门）                                                      |
| 2   | 文档站 + 清单 + 发布 | ✅ 已落地 | `@iris-ui/manifest`→`manifest.json`/`llms.txt`；VitePress 文档站（消费 manifest 生成组件页）；changesets `release.yml`。**首个 npm 发布按维护者决定暂缓**                                                |
| 3   | a11y + i18n + 动效   | ✅ 已落地 | axe-core 门（两端）、i18n 引擎 + 组件接入；RTL（`applyDirection` + 90+ 逻辑属性用点）、内联动效服从 `prefers-reduced-motion`、`prefers-color-scheme`（`watchColorScheme` + `useColorScheme` 两端）       |
| 4   | 数据层深化           | ✅ 已落地 | 变高虚拟化 + `ResizeObserver` 自动测量（Table/VirtualScroll 两端）；异步契约 `createAsyncResource`/`createPaginatedResource`（loading/error/empty/success 三态 + 服务端分页）；Table 横向虚拟化 + 列冻结 |
| 5   | 打包体积工程         | ✅ 已落地 | 子路径 `exports`（`./*` 通配 + 多入口构建，支持 `@iris-ui/react/form` 深导入）；`pnpm size` 预算门（CI）                                                                                                 |

> 下方各方向正文为 2026-05 初始评估快照（其中「现状（证据）」描述的是补齐前的状态）；以上「进展」表为最新真实状态——5 个方向的剩余范围均已落地。仅 **首个 npm 发布**（按维护者决定暂缓）与 **QRCode 组件**（按决定跳过）不在交付内。

## 概览

| #   | 方向                                | 视角                   | 影响                                         | 现状                  |
| --- | ----------------------------------- | ---------------------- | -------------------------------------------- | --------------------- |
| 1   | 表单编排与校验引擎（Form Engine）   | 核心功能               | 决定能否承载"真实表单应用"，而非只做组件皮肤 | ✅ 已落地             |
| 2   | 文档站 + AI 原生清单 + 发布工程     | 核心功能               | 采用漏斗最前端；兑现"AI 原生"产品论点        | ✅ 已落地（发布暂缓） |
| 3   | a11y 自动化 + RTL / i18n + 动效合规 | 核心功能 + 边界        | 企业 / 政府 / 全球市场的硬性准入门槛         | ✅ 已落地             |
| 4   | 数据层深化：变高虚拟化 + 异步契约   | 核心功能 + 性能 + 边界 | Table Pro 的商业护城河与性能天花板           | ✅ 已落地             |
| 5   | 打包体积与 tree-shaking 工程        | 性能                   | 选型硬指标，防"越加越胖"回归                 | ✅ 已落地             |

---

## 1. 表单编排与校验引擎 —— 把"一堆输入控件"变成"能提交的表单"

**现状（证据）**

- 全局搜索 `useForm` / `createForm` / `IrisForm` / schema resolver：**零命中**。表单能力只到**字段级** `IrisFormField`（`packages/{react,vue}/src/primitives/form-field/`），负责 label / hint / error / `aria-describedby` 关联。
- **没有任何表单级状态容器**：值聚合、脏/触碰（dirty/touched）追踪、校验编排、提交生命周期、字段数组（动态增删行）、跨字段联动、错误聚焦——全部缺位。
- 校验时机（onChange / onBlur / onSubmit）因无引擎而**未统一**，由调用方各自手写。

**为什么需要（架构 + 产品判断）**
真实业务里，"表单"几乎是 B 端应用的核心载体；而表单的难点从来不在单个输入框，而在**编排**：N 个字段的值与校验状态如何聚合、何时校验、错误如何定位与聚焦、动态字段数组如何增删、提交时如何序列化。当前用户要用 Iris UI 做一个登录/设置/向导表单，仍必须自行引入 `react-hook-form` / `vee-validate` 并手工桥接每个受控组件——这恰恰削弱了"开箱即用"的卖点。
更关键的是**它天然契合本库的架构哲学**：表单的值聚合、校验调度、状态机（idle→validating→submitting→success/error）属于**纯框架无关逻辑**，应当沉淀到 `@iris-ui/core`，React/Vue 各做一层薄桥接（`useForm` / `useField` vs `<IrisForm>` provide/inject）。这是把"逻辑下沉到 core"原则从交互组件延伸到数据编排的自然一步，也是与"只做样式"的组件库拉开差距的护城河。

**建议范围**

- `@iris-ui/core`：与框架无关的 `createFormStore`（值 / errors / touched / dirty / isSubmitting / isValid）+ 校验调度器（支持同步/异步校验、可插拔 schema 适配如 Zod/Valibot/Yup，但不强绑定）。
- 双适配器薄桥接：React `useForm()` / `useField()` / `<IrisForm>`；Vue `useForm()` / `<IrisForm>` + provide/inject；统一受控对接现有 field primitives（它们已支持 `id` / `invalid` / `ariaDescribedby` 注入）。
- 标准能力：字段数组（`useFieldArray`）、提交时滚动并聚焦首个错误、防重复提交、`reset` / `setFieldValue` / `setErrors`。
- 边界：异步校验竞态（取消过期请求）、卸载中字段、SSR 下初值水合一致。

> ✅ **已交付**：`createFormStore`（core，统一 onChange/onBlur/onSubmit + 异步竞态防护）；两端 `useForm`/`useField`/`<IrisForm>`；`useFieldArray`；提交聚焦首个错误字段；Standard Schema 校验适配器（可插拔，不强绑定具体校验库）。

---

## 2. 文档站 + AI 原生清单 + 发布工程 —— 采用的前置条件，也是产品论点的兑现物

**现状（证据）**

- **没有 `apps/docs`**（仅 `apps/playground` + `apps/playground-react` 两个人工浏览 demo）。
- **没有任何机器可读的组件 / 属性清单**（`manifest.json` / `llms.txt` 全局零命中）。
- 发布工程不完整：`.changeset/config.json` 已配置，但 `.github/workflows/` 下**只有 `ci.yml`，没有 release workflow**；包尚未发布。

**为什么需要（产品判断）**
没有文档，采用率≈0——这是漏斗最前端的拦路虎，与代码质量无关。更关键的是逻辑闭环：`AGENTS.md` 把"**AI 原生**——下游项目在自己的 AGENTS.md 声明组件清单，让 AI 直接调用"列为核心差异化，但目前**没有任何结构化 API 清单**来支撑这个承诺。要让"AI 直接消费组件"从口号变成能力，必须产出一份枚举"组件 / props / events / slots / 所属层 / token 列表"的机读清单——这是本库相对传统组件库**最独特的杠杆**，却恰好缺位。

**建议范围**

- VitePress `apps/docs`：实时示例 + **从 TypeScript 类型自动生成 props 表**，每个组件给出 Vue/React 双代码片段。
- 从两端 barrel + 类型生成 `manifest.json` / `llms.txt`（构建产物随包发布）——"AI 原生"的落地物，也可反哺文档站 props 表，单一数据源。
- 补齐 changesets release workflow + 语义化版本；首个 `0.x` 发布到 npm（哪怕是 canary）。

> ✅ **已交付**：`@iris-ui/manifest` 生成 `manifest.json` / `llms.txt`（确定性、随包发布）；VitePress `apps/docs` 消费 manifest 生成组件参考页；changesets `release.yml` 发布流水线就绪。⏸ **首个 npm 发布按维护者决定暂缓**（流水线已备，等待授权 + 版本决定）。

---

## 3. a11y 自动化 + RTL / i18n + 动效合规 —— 让"无障碍 / 全球化"从声明变成可验证

**现状（证据）**

- 测试以**手写 ARIA 断言**为主；devDependencies 中**无 `axe-core` / `jest-axe`**，没有自动化无障碍扫描。
- **零 RTL**：`dir="rtl"` 与 CSS 逻辑属性（`inset-inline` / `margin-inline` 等）全局**零命中**，所有方向都写死物理方向。
- **i18n 仅覆盖日期系**：`Intl` 只在 6 个文件（calendar / date-picker / date-range-picker）使用；`Pagination` / `FileUpload` / `CommandPalette` 等组件文案**硬编码英文**，无统一 i18n provider。
- **动效合规有盲区（边界情况）**：`prefers-reduced-motion` 仅在 3 个采用**注入式样式表**的组件（progress / skeleton / spinner）通过 `@media` 生效；而 `Radio` / `Switch` / `Drawer` / `Dialog` 等大量组件用**内联 `transition`**，内联样式无法被 `@media` 约束 → 前庭障碍用户开启"减少动态效果"时仍会触发动画。
- 主题仅 light / dark 手动切换；**无 `prefers-color-scheme` 自动跟随系统**（全局零命中）。

**为什么需要（产品判断）**
"对齐 Radix/Naive 的无障碍质量"是核心卖点，但**卖点必须可验证、可防回归**。WCAG 2.2 / Section 508 / EN 301 549 是企业、教育、政府采购的**硬门槛**，手写断言只能覆盖"想到的"用例。RTL（阿拉伯语/希伯来语）与本地化是进入全球市场的前置条件——浮层定位、Drawer 方向、Splitter/Resizer 手柄、文本对齐在 RTL 下都会错位。而动效合规与系统主题跟随，是"细节质感"与无障碍法规的交叉项，缺失会在严肃评审中被直接点名。

**建议范围**

- 每个 primitive 在 jsdom 下引入 `axe-core` 断言，对"打开态"的浮层 / 对话框 / 菜单跑扫描，纳入质量门。
- 用 CSS 逻辑属性 + `dir` 感知改造方向相关组件；主题层暴露 `direction`，浮层定位接入 RTL。
- 外置 i18n provider：日期/时间/数字注入 `Intl` locale，组件文案走可覆盖的 messages 字典。
- **动效合规系统化**：把内联 `transition` 收敛为可被 `prefers-reduced-motion` 统一关闭的方案（CSS 变量开关 / data-attr + 注入式 @media）；主题层支持 `prefers-color-scheme` 自动模式。

> ✅ **已交付**：axe-core 无障碍门（两端）；i18n 引擎（`Intl` + 可覆盖 messages 字典）+ 组件接入；RTL（主题层 `applyDirection` + 90+ 逻辑属性用点，浮层 RTL 感知）；内联动效服从 `prefers-reduced-motion`；`prefers-color-scheme` 自动跟随（`watchColorScheme` + 两端 `useColorScheme`）。

---

## 4. 数据层深化：变高虚拟化 + 异步契约 —— Table Pro 的护城河与性能天花板

**现状（证据）**

- `IrisVirtualScroll` **仅支持固定行高**（`packages/react/src/primitives/virtual-scroll/VirtualScroll.tsx:13` `itemHeight: number`，总高直接 `items.length * itemHeight`）。换行文本、可展开详情行、内嵌组件等**可变高度内容无法承载**。
- Table / Tree / List **没有统一的异步数据契约**：在它们的 `types.ts` 中搜索 `loading` / `error` / `empty` / `async` / `loadMore` / `serverSide` 等——**无命中**。即服务端分页、无限滚动、异步树节点、loading/error/empty 三态均未标准化。
- 宽表**不做横向虚拟化**，无列冻结（pinned columns）。

**为什么需要（产品判断）**
数据密集型 UI 几乎都有两个特征：**内容高度可变**与**数据服务端驱动**（百万行、分页、增量）。路线图把 "Table Pro" 列为首个付费方向，其护城河恰在"处理大规模 + 复杂数据"，而非再多几个表格皮肤。固定行高 + 纯客户端数据是当前能力天花板，直接挡住最有付费意愿的场景；缺三态契约则让"加载中/失败/空"的 UI 行为在真实后端下处于未定义状态。

**建议范围**

- 基于 `ResizeObserver` 的**动态测量虚拟化**（变高行），保持滚动锚点稳定；与现有 Table 每行独立 grid 布局兼容。
- 统一**异步契约**：async row/node loader、服务端 sort/filter/pagination、infinite scroll，以及 loading / error / empty 三态的标准化插槽/slot。
- 宽表**横向虚拟化** + 列冻结。
- 边界：测量抖动与无限增长滚动条、异步加载竞态、空数据/全失败/部分失败的可访问性提示。

> ✅ **已交付**：变高虚拟化（core 数学 + 两端 `VirtualScroll`）+ `ResizeObserver` 自动测量（Table / VirtualScroll）；异步契约 `createAsyncResource` / `createPaginatedResource`（loading/error/empty/success 三态 + 服务端分页，含竞态防护）；Table 横向（列）虚拟化 + 列冻结；Table / List / Tree 组件级 loading/error/empty 三态 UI（core `resolveDataState` + 两端 `useDataState` / `usePrefersReducedMotion` 动画 hook，服从 `prefers-reduced-motion`）。

---

## 5. 打包体积与 tree-shaking 工程 —— 选型的硬性性能指标

**现状（证据）**

- 全部 6 个包的 `exports` **仅有 `"."` 单入口**（core / tokens / theme / icons / react / vue 均如此），不支持 `@iris-ui/react/table` 这样的子路径深度导入。
- playground 全量产物约 **Vue 287 KB / React 306 KB（gzip ~90 KB）**；CI **无 size-limit / bundlewatch 预算门**。
- `sideEffects: false` 已正确设置（样式注入走 effect，import 无副作用），这是好基础。

**为什么需要（架构判断）**
打包体积是技术选型首要硬指标之一；"只用 3 个组件却被迫打进整库"或"tree-shaking 不可靠"的库会被性能敏感团队直接淘汰。单一 barrel 入口在不同打包器（webpack / Vite / Rollup / esbuild）下 tree-shaking 可靠性参差，且无法支持深度导入与按需类型/文档加载。体积透明化（CI 预算门）还能防止"组件越加越胖"的隐性回归。

**建议范围**

- tsup 多入口 + `package.json` `exports` 子路径映射（每组件一个入口），支持 `@iris-ui/react/table` 深度导入。
- CI 引入 size-limit 预算门（按组件 + 按整包），把体积变化变成可见 PR 反馈。
- 审计 barrel re-export 与 `@iris-ui/icons` 等 external 依赖对最终 tree-shaking 的实际影响。

> ✅ **已交付**：tsup 多入口构建 + `exports` `./*` 通配子路径映射（支持 `@iris-ui/react/form` 等深度导入）；`pnpm size` gzip 预算门（按包，纳入 CI）；`sideEffects` 精确声明以保 tree-shaking。

---

## 附：边界情况 & 性能优化清单（扫描所得，可独立排期）

**边界情况（Edge cases）**

- ✅ **内联动效受 `prefers-reduced-motion` 约束**：方向 3 已系统化收敛，开启"减少动态效果"时内联 `transition` 一并关闭。
- ✅ **`prefers-color-scheme` 系统跟随**：`watchColorScheme` + 两端 `useColorScheme`（方向 3 已落地）。
- ✅ **VirtualScroll 变高**：已支持 `itemHeight` 为 size 函数（两端）+ `ResizeObserver` 自动测量。
- ✅ **数据组件 loading/error/empty 三态与异步竞态**：`createAsyncResource` / `createPaginatedResource` 统一三态契约 + 竞态防护；Table / List / Tree 组件级三态 UI + 入场动画 hook（`useDataState`，服从 reduced-motion）（方向 4 已落地）。
- ✅ **i18n 覆盖**：引擎 + 组件接入；RTL（`applyDirection` + 逻辑属性）已落地（方向 3）。
- ✅ **表单聚合校验时机统一**：`createFormStore` 统一 onChange/onBlur/onSubmit + 异步竞态防护。

**性能优化**

- ✅ **tree-shaking 可靠性**：多入口 + `./*` 子路径 exports + `pnpm size` 预算门（方向 5）。
- ✅ **大数据天花板**：变高 + `ResizeObserver` 自动测量 + 横向虚拟化/列冻结均已解（方向 4）。
- ✅ **SSR 烟雾测试**：React + Vue 均已落地（`// @vitest-environment node`），纳入质量门防回归。

---

## 状态小结

核心引擎（表单 / i18n / 虚拟化 / 异步契约 / SSR / 清单 / a11y 门）与工程化补齐（RTL + 动效合规 + 系统主题、子路径 exports + size 门、文档站 + 发布流水线）**均已落地**，并保持 Vue / React 双端语义对齐、四道质量门 + size + `check:rsc` + `format:check` 常绿。

**唯二未交付项均为显式决定，非能力缺口：**

1. **首个 npm 发布**——流水线（changesets `release.yml`）已就绪；属不可逆的对外动作，按维护者决定暂缓，待授权 + 凭据 + 版本决定后执行。
2. **QRCode 组件**——需要正确的 QR 编码器（Reed–Solomon / 掩码），其可扫描性无法在 jsdom 验证，故不手搓；按决定跳过（如重启，应接入经审计的依赖或对照测试向量的移植）。

> 原则不变（见 `AGENTS.md`）：业务逻辑下沉到 `@iris-ui/core` 与框架无关工具，适配器只做薄桥接；任何方向都应保持 Vue / React 双端语义对齐，并通过四道质量门。
