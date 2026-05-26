# Iris UI — 扩展路线图（架构 / 产品视角）

> 评估时间：2026-05。当前状态：**组件层已基本完备** —— 五层架构 + 贯穿主题层 + 正交 Behaviors 层，Vue 3 / React 18 双适配器全量对齐，Table Pro（列宽拖拽 / 行内编辑 / 虚拟滚动 / CSV）两端齐备，约 1450 项测试、四道质量门常绿。
>
> 组件"广度"已经足够；下一阶段的价值不在再加组件，而在 **让现有组件能被真实生产环境采用**：SSR 正确性、无障碍合规、可发现性、打包成本、数据规模。以下 5 个方向按优先级排序，每项给出现状证据、为什么需要、建议范围。

## 概览

| # | 方向 | 视角 | 影响 | 现状风险 |
| --- | --- | --- | --- | --- |
| 1 | SSR / RSC 渲染安全 | 边界情况（正确性） | 阻断在主流部署环境的可用性 | 🔴 已存在缺陷 |
| 2 | a11y 自动化校验 + RTL / i18n | 核心功能 + 边界 | 决定能否进入企业 / 政府 / 全球市场 | 🟠 卖点未验证 |
| 3 | 文档站 + AI 原生消费层 | 核心功能 | 采用率的前置条件；兑现产品论点 | 🟠 承诺未兑现 |
| 4 | 打包体积与 tree-shaking 工程 | 性能 | 选型硬指标 | 🟡 可靠性存疑 |
| 5 | 数据层深化（变高虚拟化 + 异步契约） | 核心功能 + 性能 + 边界 | Table Pro 的商业护城河 | 🟡 能力天花板 |

---

## 1. SSR / RSC 渲染安全 —— 把"能跑在 Next.js / Nuxt 上"变成事实

**现状（证据）**
- `generateId`（`packages/core/src/utils.ts:26`）是 **模块级自增计数器**（`idCounter += 1`），被 **22 个文件** 用于生成 `id` / `aria-labelledby` / `htmlFor`；仅 **2 个文件** 使用框架原生 `useId`。
- `window.innerWidth` 在 `useBodyScrollLock` 中直接访问（目前靠"只在 effect 里调用"规避，但未系统化）。
- 仓库 **没有任何 SSR / hydration 测试**（`renderToString` 之类）。

**为什么需要（架构判断）**
React/Vue 的主流部署形态已经是服务端渲染：Next.js App Router（RSC）、Nuxt。一个**自增计数器**在服务端渲染与客户端 hydration 时的执行时序不同 → 两侧生成的 ID 不一致 → 触发 hydration mismatch，并且让 `aria-labelledby` / `for` 这类**无障碍关联直接断裂**。这不是锦上添花，而是会让库在"最常见的现代环境里开箱即坏"的正确性缺陷。一个定位严肃的组件库若无 SSR 故事，等于把最大的一批潜在用户挡在门外。

**建议范围**
- 组件内的 `generateId` 用法切换为框架原生 `useId`（React 18 / Vue 3.5 均已具备），core 仅保留一个 **SSR 稳定**的兜底实现。
- 系统化审计 `window` / `document` / `ResizeObserver` / `matchMedia` 访问，统一收敛到"挂载后"或加 `typeof` 守卫。
- 新增 `renderToString`（React）/ `@vue/server-renderer` 烟雾测试 + hydration 一致性断言，纳入质量门。
- 明确文档化 RSC 的 `'use client'` 边界，标注哪些 API 是 **client-only**（toast 队列、body-scroll-lock 单例、focus trap、stylesheet 注入）。

---

## 2. 无障碍自动化校验 + RTL / i18n —— 让"WAI-ARIA"从声明变成可验证、可全球化

**现状（证据）**
- 测试以**手写 ARIA 属性断言**为主；任何 `package.json` 的 devDependencies 中 **没有 `axe-core` / `jest-axe`**，即没有自动化无障碍校验。
- **零 RTL 处理**：代码中所有 `dir` / `direction` 出现都是"排序方向"或"flex 方向"，没有任何 `dir="rtl"` / 逻辑方向适配。
- 本地化仅在 6 个文件部分使用 `Intl`；日期 / 时间 / 数字的 locale 未系统化（且早期还踩过 `toISOString` 时区 bug）。

**为什么需要（产品判断）**
"对齐 Radix / Naive 的无障碍质量"是本库的核心差异化卖点之一——但**卖点必须可验证、可防回归**。手写断言只能覆盖"我想到的"用例。更现实的是：WCAG 2.2 / Section 508 / EN 301 549 是企业、教育、政府采购的**硬性门槛**，没有自动化 a11y 证据就过不了合规评审。RTL（阿拉伯语 / 希伯来语等）与本地化则是进入全球市场的前置条件——浮层定位、Drawer 方向、Splitter/Resizer 手柄、文本对齐在 RTL 下都会错位。

**建议范围**
- 每个 primitive 引入 `axe-core`（jsdom 环境）断言，作为质量门的一部分，对"打开态"的浮层 / 对话框 / 菜单跑无障碍扫描。
- 用 CSS logical properties（`inset-inline` / `margin-inline` 等）+ `dir` 感知改造方向相关组件；主题层暴露 `direction`。
- 为日期 / 时间 / 数字 / 范围 picker 注入 locale（`Intl.DateTimeFormat` / `NumberFormat`）；文案通过 i18n provider 外置。

---

## 3. 文档站 + AI 原生消费层 —— 采用的前置条件，也是兑现产品论点的关键

**现状（证据）**
- 没有 `apps/docs`；仅有一个面向人工浏览的 playground demo。
- **没有任何机器可读的组件 / 属性清单**（component manifest / `llms.txt`）。
- 发布工程不完整：`.changeset` 已配置但无 release workflow，包尚未发布。

**为什么需要（产品判断）**
没有文档，采用率≈0，与代码质量无关——这是采用漏斗最前端的拦路虎。更关键的是逻辑闭环：本项目在 `AGENTS.md` 里明确把"**AI 原生 + 下游项目在自己的 AGENTS.md 声明组件清单，让 AI 直接调用**"作为核心论点，但目前**没有任何机器可读的 API 清单**来支撑这个承诺。要让"AI 直接消费组件"从口号变成能力，必须产出一份枚举了"组件 / props / 事件 / tokens"的结构化清单。这是本库相对传统组件库**最独特的杠杆**，却恰恰缺位。

**建议范围**
- VitePress `apps/docs`：实时示例 + 从 TypeScript 类型**自动生成 props 表**，每个组件给出 Vue/React 双代码片段。
- 从两端 barrel + 类型生成 `manifest.json` / `llms.txt`（组件名、props、事件、所属层、token 列表），作为构建产物发布——这是"AI 原生"的落地物。
- 补齐发布工程：changesets release workflow + 语义化版本。

---

## 4. 打包体积与 tree-shaking 工程 —— 选型的硬性性能指标

**现状（证据）**
- 所有包的 `exports` 仅有 `"."` **单入口**，没有 `@iris-ui/react/button` 这样的子路径深度导入。
- playground 全量打包约 **287 KB（Vue）/ 307 KB（React）**；CI **无 size-limit / bundlewatch 预算门**。
- `sideEffects: false` 已正确设置（样式注入走 effect，import 时无副作用），这是好的基础。

**为什么需要（架构判断）**
打包体积是团队技术选型的首要硬指标之一；一个"只用了 3 个组件却被迫打进整库"或"tree-shaking 不可靠"的库，会被性能敏感团队直接淘汰。单一 barrel 入口在不同打包器（webpack / Vite / Rollup / esbuild）下的 tree-shaking 可靠性参差，且无法支持深度导入与按需文档/类型加载。体积透明化（CI 预算门）还能防止"组件越加越胖"的隐性回归。

**建议范围**
- tsup 多入口 + `package.json` `exports` 子路径映射（每组件一个入口），支持 `@iris-ui/react/table` 深度导入。
- CI 引入 size-limit 预算门（按组件 + 按整包），把体积变化变成可见的 PR 反馈。
- 审计 barrel re-export 与 `@iris-ui/icons` 等 external 依赖对最终 tree-shaking 的实际影响。

---

## 5. 数据层深化：变高虚拟化 + 异步数据契约 —— Table Pro 的商业护城河

**现状（证据）**
- `IrisVirtualScroll` **仅支持固定行高**（`itemHeight: number`，注释明确"All items share this height"）；因此 Table / List / Tree 无法承载换行文本、可展开详情行等可变高度内容。
- Table / Tree / List **没有统一的异步数据契约**（服务端分页、无限滚动、异步树节点、loading/error/empty 三态）。
- 宽表 **不做横向虚拟化**。

**为什么需要（产品判断）**
真实的数据密集型 UI 几乎都有两个特征：**内容高度可变**（多行文本、内嵌组件、展开行）与 **数据服务端驱动**（百万行、分页、增量加载）。路线图把 "Table Pro" 列为首个付费方向——而它的护城河恰恰在于"处理大规模 + 复杂数据"的能力，而不是再多几个表格皮肤。固定行高 + 纯客户端数据是当前的能力天花板，直接限制了最有付费意愿的场景。

**建议范围**
- 基于 `ResizeObserver` 的**动态测量虚拟化**（支持变高行），保持滚动位置稳定。
- 统一**异步契约**：async row / node loader、服务端 sort/filter/pagination、infinite scroll，以及 loading / error / empty 三态的标准化插槽。
- 宽表**横向虚拟化** + 列冻结（pinned columns）。

---

## 建议的推进顺序

1. **先做 #1（SSR）**——它是正确性缺陷，且阻断面最大，应优先于一切增强。
2. **并行 #3（文档 + manifest）**——采用漏斗最前端，且与代码改动解耦，可独立推进。
3. **再做 #2（a11y/RTL）与 #4（体积）**——把质量与性能卖点坐实，互相独立。
4. **#5（数据层）**作为"Table Pro"商业化的专项投入，按价值单独立项。

> 原则不变（见 `AGENTS.md`）：业务逻辑下沉到 `@iris-ui/core` 与框架无关工具，适配器只做薄桥接；任何方向都应保持 Vue / React 双端语义对齐，并通过四道质量门。
