# Iris UI — 扩展路线图 v2（架构 / 产品视角）

> 评估时间：2026-06（基于一次 7 维度全局只读审计，62 项发现，按价值/杠杆收敛）。
> **基线**：四框架（react/vue/solid/svelte）全量对齐，manifest 实测 135 组件；五层架构 + 主题/皮肤层 + 正交 Behaviors + **逻辑下沉的 core 控制器层**（selection/expansion/data-view/roving/admin-shell/resource）+ **插件层**（locale-zh / editor(CM6) / pro-table）；四道质量门 + size + RSC + manifest 常绿。
>
> **上一版 5 个方向（表单引擎 / 文档站+清单+发布 / a11y+i18n+动效 / 数据层深化 / 体积工程）已全部落地。** 本版是**下一地平线**：价值重心从「补齐基础」转向三件事——**(A) 把数据层做成真正护城河**、**(B) 兑现"AI 原生"差异化**、**(C) 跨过企业/政府/全球的硬性准入门**。下列 5 个方向按价值排序，每项给出现状证据（`file:symbol`）、为什么需要、建议范围、价值/成本。
>
> **首轮已落地（2026-06，10 个 core 增量提交 `6249a42`→`f4031e4`，全程 78 门常绿、core 231 测试）**：选择模型 Set 化（O(n²)→O(n)）· createStore 派发安全 · Intl formatter 缓存 · `localeDirection`/`localeWeekStartsOn` · resolveDataState SWR · 插件 teardown 契约 · createAsyncResource AbortSignal 取消 · data-view 过滤操作符+多列排序 · **createTreeSelection（级联+半选引擎）** · **resource 控制器补 sort/filter+乐观 mutate**。覆盖方向 1（数据引擎 perf+深度）、3（globalization 助手）、4（健壮性）的多个高价值/速赢项。剩余多为框架层接线（桥接 teardown/cancel/SWR/setSort 到适配器）与方向 2/5。

---

## 1. 框架无关数据引擎（Data Engine）—— 把数据层从「够用」做成护城河

> 一句话：把分裂的 CRUD 编排（`resource.ts` 桩 vs `pro-table` 私有实现）+ 数据视图 + 选择模型，**收敛为一套生产级、四框架共享的数据引擎**，并顺手清掉规模性能天花板。

**现状（证据）**

- **两套发散的服务端 CRUD 编排**：被消费的 `createResourceController`（`core/resource.ts`，114 行）只有 list+page+select+reload，`ResourceQuery` = `{page,pageSize}`，**没有 sort/filter**；而真正有深度的逻辑（排序 `cycleSort`、过滤、内联编辑、CSV/Excel 导出、客户端/服务端双模）被困在 `plugin-pro-table/src/core/index.ts`（330 行）里独立重造。四个 cms demo 的 UsersPage 都用前者，**因此都不能排序/过滤**。
- **`data-view` 过滤是子串-only**（`data-view.ts:60-91`）——无操作符、无多列排序、无分组/聚合。
- **缺企业表格的硬功能**：无树形行 / 可展开详情行 / 多级表头、无汇总/聚合行、无可编辑单元格校验、无网格键盘导航、`VirtualScroll` 仅纵向（无 2D/横向虚拟化原语）、Tree 无虚拟化、**无树形勾选级联 + 半选（indeterminate）引擎**（每框架各自重造）。
- **规模性能天花板**：选择模型用 `array.includes`（O(n) 单查，表格每渲染 O(n²)）；`filterSort` 每次按键跑全量管线、无 memo/debounce；`createStore` 每次替换整个 state 对象 → **全体订阅者重渲**（无选择性订阅）；Table 不开虚拟化时渲染全部行；变高虚拟化每次测量重建全量偏移表 O(n)。

**为什么需要（架构 + 产品）**

服务端驱动的 CRUD 列表是每个 admin 应用的**主力工作负载**，也是本库自我定位的 Vben 式 CMS 的核心。当前「被消费的那个太薄、有深度的那个被锁在插件里」是典型的逻辑分裂——与本库刚完成的「下沉去重」原则自相矛盾。把它们收敛成一个 `createDataSource`/`createTableController`（排序+过滤+分组+聚合+树形行+乐观更新+逐行状态+无限/分页，客户端/服务端对称），(a) 让被消费的控制器真正可用，(b) 让 pro-table、基础 Table、resource 共享一套引擎而非三份拷贝，(c) 成为**真正的护城河**：一个 TanStack-Table 级、跨四框架的数据引擎，竞品无人提供。性能修复（Set 化选择、索引化/memo 化管线、选择性订阅）天然属于同一引擎，顺带把规模天花板抬到 10 万行级。

**建议范围**

- core 新增 `createDataSource`（统一查询契约：多列排序 + 过滤操作符 + 分组/聚合；客户端/服务端对称；乐观 mutate + 逐行 pending/error 态 + 无限模式），pro-table / 基础 Table / resource 全部改为消费它。
- `createTreeSelection`（父→子级联 + 半选三态，一套测试），统一 Tree / TreeSelect / 权限选择器。
- 虚拟化升级：横向/2D 虚拟化原语；变高偏移表增量维护（非每次重建）。
- 性能：选择模型 `Set` 化；`filterSort` memo + 输入 debounce；`createStore` 增量/选择性订阅（path 或 selector 订阅）。

**价值/成本**：🟥 价值 高（护城河 + 主力负载 + 规模天花板）· 成本 高 · 风险：触及已发布表格 API，需保持公共面不变 + 测试常绿。

---

## 2. 兑现「AI 原生」护城河 —— 从「名字清单」到「类型化契约 + MCP/codegen」

> 一句话：本库最独特的卖点目前**只有一层深**——`manifest.json`/`llms.txt` 只列组件名，AI 仍要猜每个 prop。把它升级成类型化契约，再在其上长出 MCP / codegen / 文档自动化。

**现状（证据）**

- `manifest` 的 `ManifestComponent` = `{name, group, module, frameworks, importFrom}`，**仅此而已**；`discover.ts:21` 用正则抓 `export const/function IrisX`，从不打开各组件的 `types.ts`；`llms.txt` 每个组件渲染成一行 `- IrisSelect [react/...]`。**富 Props 类型在源码里真实存在**（`packages/*/src/primitives/*/types.ts`）却被丢弃。
- **没有 MCP / codegen / prompt-to-UI**（全仓 grep `mcp|codegen|scaffold` 为空）；AI 原生的唯一产物就是一个静态文本文件。
- **文档站**是 `generate-components.mjs` 生成的「名字表格」——**零 live demo、零按组件的 props 页**；四个 playground/cms demo 未在文档中呈现。
- **插件对 manifest 完全不可见**（`discover.ts:65` 只扫 4 个 adapter 包）——`IrisCodeEditor`/`IrisProTable` 在 manifest 里查无此物。
- **没有跨框架行为一致性测试**——只校验 manifest 的「名字一致」；「同语义」靠作者纪律，Svelte 桥的行为 bug 会绿灯通过。
- **无设计 token 互操作**：tokens 是 21 个 `as const` 字符串数组，无 W3C Design Tokens 导出 / Style Dictionary / Figma 往返。

**为什么需要（产品判断）**

这是**整个差异化的命门**。卖点（「AI 生成 UI 的原生输出格式」、AGENTS.md 原则 5：30 token vs 800）只有在「AI 不靠猜就能正确调用」时才成立；只给名字 = 强迫它做本库声称要消灭的 guess-and-check。原料（类型化 Props + JSDoc + 核心 union 类型）已在源码里——一次 `ts-morph`/`react-docgen` 抽取就能让 manifest 价值 10 倍，且是下游一切 AI 玩法的前置。在类型化 manifest 之上，`@iris-ui/mcp`（`get_component_api` / `scaffold(prompt)→四框架代码`）是 shadcn/Radix/MUI **都没有的可演示护城河**；同一份类型化数据还能**自动生成**按组件 API 页 + live demo，让「四框架一致」从断言变成可见。这是「技术很深，但买家/agent 第一眼摸到的采用面最薄」这一矛盾的解法。

**建议范围**

- **类型化 manifest**（keystone）：抽取 props（名/类型/默认/JSDoc）、events、slots、子组件组合关系、所属层；插件组件 + 安装/激活片段一并纳入 discover。
- 在其上：`@iris-ui/mcp` server（list/get-api/scaffold 工具）；文档站按组件 API 页 + live demo（同源自动生成）。
- **跨框架行为契约测试**：用同一事件脚本驱动四个 adapter，断言相同的 core-store 迁移（core 控制器架构天然使其可行）。
- 设计 token 互操作：W3C-DTCG 导出 + Style Dictionary + Figma Code Connect 往返。

**价值/成本**：🟥 价值 高（唯一差异化、采用漏斗、生态复利）· 成本 高（但类型化 manifest 一项即解锁其余）· 风险：低（增量产物，不改运行时）。

---

## 3. 企业级 a11y + i18n / 全球化合规 —— 把「演示过」做成「普遍成立」

> 一句话：基础是真的（`createI18n` + axe 门 + 逻辑属性 RTL），但呈「点状演示、非普遍」特征；几处是企业/政府/全球采购的**硬性 disqualifier**。

**现状（证据）**

- **~23 处硬编码英文 `aria-label` 绕过了 i18n**（ColorPicker `Hex/Red/...`、ToastViewport `Dismiss`、Table `Select all`、TimePicker、Tree toggle、Calendar `Previous month`…；ProTable 四框架全把 `Select all`/`Filter ${title}`/`Prev`/`Next` 写死）——西语/阿语应用对**读屏器仍说英文**，正是审计第一项 spot-check。
- **`t()` 仅字符串插值，无 ICU plural/select**（`i18n.ts:103`）——内置计数串（`rating.value`/`tour.step`…）写死英语语法，斯拉夫/阿语/CJK 无法正确复数。
- **locale 与方向/`lang` 完全脱节**：切到阿语**不翻转 UI**、不设 `<html lang>`（读屏发音不切）；RTL 全靠消费方手动。
- **全仓零 `forced-colors`/高对比度支持**——Windows 高对比模式下焦点环/选中态/纯图标按钮会消失（WCAG 1.4.x / 508 常见否决项）。
- **Calendar 网格结构非法**（42 个 `gridcell` 无 `role=row` 包裹）+ 日期格仅以数字命名 + `weekStartsOn` 不随 locale；**ProTable 排序/过滤键盘+读屏不可达**（裸 `<th onClick>`，无 `aria-sort`/`scope`/键盘）——旗舰付费面比免费 Table 还不可达。
- **Solid/Svelte 适配器无任何 axe 门**——两个完整框架（134/132 组件）零自动无障碍扫描，与 React/Vue 基线静默漂移。

**为什么需要**

无障碍 + 全球化是企业/政府/全球市场的**硬准入门**，且本库把「Radix/Naive 级 a11y」+「可本地化文案」同列为卖点——而 a11y×i18n 的交叉漏洞（读屏说英文、计数错复数）恰好同时戳破两者。多数修复是机械且低风险的（aria-label 走 `t()`、`localeDirection(tag)` 一个 helper、axe 门复制到 solid/svelte），但**不补就是采购硬伤**。ProTable 的 a11y 回归尤其危险：把旗舰面做得比基础面更不可达，是可信度与采购双重风险。

**建议范围**

- 所有 `aria-label` 走 `t()` + 补 i18n key（含 ProTable 四框架）；`t()` 增可选 ICU（懒加载 `IntlMessageFormat` 或小 plural-rules 路径）。
- `localeDirection(locale)` + Provider 联动（自动翻转 `dir`、设 `lang`、推断 `weekStartsOn`）；useFloating/MenuSub 读方向翻转 `-start/-end` 与子菜单侧。
- `@media (forced-colors: active)` 系统色系统性接入（走现有单例注入路径）。
- 修 Calendar 网格结构 + 逐格 `aria-label` + provider 驱动 locale；ProTable 补 `aria-sort`/`scope`/键盘/grid roles。
- axe 门扩到 Solid + Svelte（已有两份现成范式）。

**价值/成本**：🟥 价值 高（采购门 + 兑现卖点）· 成本 中（多为机械，含数个速赢）· 风险：低。

---

## 4. 生产健壮性（Production Hardening）—— 压力下的正确性

> 一句话：一组在压力/边界下会真炸的脆弱点，分散但同源，构成「会不会在生产崩」的信任面。

**现状（证据）**

- **全仓无 error boundary**——一个抛错的插件/渲染会**整树崩溃**（插件契约也无 teardown/uninstall，eager store 卸载即泄漏）。
- **异步 fetcher 能被取代但从不取消**——无 `AbortSignal` 契约、无卸载取消（陈旧请求继续跑、可能写回已卸载组件）。
- **`useFloating.update()` 无陈旧结果守卫**（`useFloating.ts:113` 还写死 `left:0`）——快速开关/滚动会应用过期坐标。
- **受控选择漂移**：`model.toggle()` 在 prop-sync effect 前先改 store，受控父若不回写会闪烁/回弹。
- **`createStore.setState` 在派发时遍历活监听 Set**——派发中 subscribe/unsubscribe 行为未定义。
- 其余：scroll-lock 存/恢复在交错宿主变更 + StrictMode 下脆弱；`formatDate/formatNumber` 每次新建 `Intl` 实例（日期密集列表的性能悬崖）；`createResourceController` 在 React 渲染相里发网络请求且泄漏选择订阅；focus-trap 恢复目标可能已卸载；`DataState` 把 error 钉在 loading 之上（重试/重载时 UI 卡在错误态）。

**为什么需要**

这些不是「缺功能」，是「会出错」。错误边界、请求取消、陈旧守卫、受控同步时序——都是组件库「敢上生产」的信任底座；多个是**低成本高价值**（stale 守卫、监听快照、formatter 缓存、错误边界包裹）。本库已为正确性下过重注（form/async 的 token 竞态防护），这一组是把同等严谨度补到尚未覆盖的热路径。

**建议范围**

- 每框架一层 `IrisErrorBoundary`（至少包裹插件/动态渲染）；插件契约加 `teardown`（卸载/swap 时清 store/副作用）。
- `createAsyncResource` 引入 `AbortSignal` 契约 + 卸载取消；fetcher 收 `{signal}`。
- 守卫：`useFloating.update` 陈旧令牌；`createStore.setState` 迭代前快照监听集；受控选择改为「先同步后回调」时序。
- `Intl` formatter 按 (locale,options) 缓存；`useResourceController` 把 load 移出渲染相 + effect 清订阅；`DataState` 重载时保 loading 优先。

**价值/成本**：🟧 价值 高（信任/正确性）· 成本 中（含多个速赢）· 风险：低（多为加守卫，不改 API）。

---

## 5. 插件生态扩张 —— charts / 表单构建器 / schema 化 admin

> 一句话：插件层是可扩展/可变现的生态面；当前只有 3 个一方插件，几个高需求竖类缺位，且已建的 L4 控制器未产品化。

**现状（证据）**

- **`createAdminShell` 是死代码**：core 里建好且测过（`admin-shell.ts`，78 行），但全仓除 barrel/dist 外**零消费**；4 个 AdminLayout 仍各自重造 navigate/syncFromTab（其自身注释承认这点），且无 `useAdminShell` 桥。
- **表单引擎缺真实表单三件套**：无 wizard/多步、无数组字段（push/insert/remove 全无）、依赖字段不联动重校验（`setFieldValue` 只校验改动字段）。
- **最常被点名缺失的 charts/dataviz**：全仓无任何图表代码。
- **无 schema→UI**：表单引擎有状态但无 schema 驱动渲染；admin 控制器存在但未产品化成「配置即应用」。
- 插件契约：无 teardown、无 async/懒加载 store、无插件间依赖/排序/版本契约；pro-table 的编辑/列/导出逻辑是私有的，未暴露为可复用 core 控制器。

**为什么需要**

插件是「重型能力按需 use、core 保持精简」的可变现层。三个高需求竖类——**charts**（数据 admin 的刚需）、**schema 化表单构建器**（B 端配置化表单）、**schema 化 admin shell**（把已建的 `createAdminShell`+`createDataSource` 产品化成「配置即 CMS」）——能直接扩大可寻址用例。其中 admin-shell 产品化是**低垂果实**（消费代码已按框架存在，是消费/去重而非新建），同时消灭一处与「逻辑下沉 core」原则自相矛盾的死代码。表单引擎补 wizard/数组/依赖字段是 charts/form-builder 的前置，也是 Naive/AntD 对等的 table-stakes。

**建议范围**

- 产品化 `createAdminShell`：4 个 `useAdminShell` 薄桥 + 改造 AdminLayout 消费它（删 byte-for-byte 重复）。
- `@iris-ui/plugin-charts`（薄包 ECharts/Chart.js，token 桥接主题）。
- `@iris-ui/plugin-form-builder`（schema→四框架表单，复用 form 引擎；前置：表单引擎补 wizard/`useFieldArray`/`dependsOn` 联动校验）。
- `@iris-ui/plugin-admin`（schema 驱动 CMS 壳：nav + 数据引擎 + CRUD 页，组合 adminShell + dataSource）。
- 插件契约硬化：`teardown` / async+懒加载 store / 插件间依赖与排序。

**价值/成本**：🟧 价值 高（可寻址市场 + 可变现）· 成本 高（除 adminShell 产品化为低）· 风险：中（依赖方向 1 的数据引擎成熟）。

---

## 速赢清单（低成本、高价值，可穿插各方向先做）

> 这些是审计里 effort=low / value=high 的项，建议作为每个方向的「开胃菜」先落地，快速兑现可见收益。

| 速赢                                                            | 所属方向 | 收益                     |
| --------------------------------------------------------------- | -------- | ------------------------ |
| 选择模型 `Set` 化（O(n²)→O(n)）                                 | 1        | 大表渲染性能             |
| `localeDirection(locale)` + Provider 联动（dir/lang/weekStart） | 3        | RTL/全球化一键成立       |
| axe 门复制到 Solid + Svelte                                     | 3        | 四框架 a11y 一致性闭合   |
| 所有 `aria-label` 走 `t()`                                      | 3        | 兑现 a11y×i18n 卖点      |
| 插件接入 `discover.ts`（manifest 可见）                         | 2        | 生态对 AI 可发现         |
| `useFloating.update` 陈旧守卫 + `createStore` 监听快照          | 4        | 消除两类竞态崩溃         |
| `IrisErrorBoundary` 包裹插件/动态渲染                           | 4        | 防整树崩溃               |
| `Intl` formatter 缓存                                           | 3/4      | 日期密集列表性能悬崖     |
| 产品化 `createAdminShell`（删死代码）                           | 5        | 消灭原则自相矛盾的死代码 |
| README/docs 刷新到「四框架 / 135 组件」                         | 2        | 落地页不再少卖两个框架   |

## 排期建议（sequencing）

1. **先做穿插速赢**（上表）——低风险、立刻可见，且为大方向铺路。
2. **方向 2 的类型化 manifest** 是 keystone——解锁文档自动化 + MCP + codegen，优先于其余 AI 原生工作。
3. **方向 1 的数据引擎** 是最高杠杆技术投资——但成本最高、触及已发布 API，需在行为契约测试（方向 2）就位后推进以防回归。
4. **方向 3（合规）** 与 1/2 并行——多为机械、独立、可增量。
5. **方向 5（生态）** 依赖方向 1 的数据引擎 + 表单引擎成熟，排在其后；`createAdminShell` 产品化可提前作为速赢。

> 不在本路线内（显式决定，非能力缺口）：首个 npm 发布（流水线就绪，按维护者授权）、QRCode 组件（按决定跳过）。
