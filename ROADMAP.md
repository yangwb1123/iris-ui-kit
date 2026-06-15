# Iris UI — 扩展路线图 v3（架构 / 产品视角）

> 评估时间：2026-06（基于一次 9 子系统全局只读审计 → 86 项原始发现 → 5 视角 23 个候选 → 按价值/成本收敛）。
> **基线**：四框架（react/vue/solid/svelte）全量对齐，manifest 实测 **149 组件 / 988 props / 68 enum / 364 default**；五层架构 + 主题/皮肤层 + 正交 Behaviors + 逻辑下沉的 core 控制器层 + 12 个一方插件 + `@iris-ui/mcp`（7 工具）+ 跨框架契约测试；四道质量门 + size + RSC + manifest 常绿。
>
> **上一版（ROADMAP v2）的 5 个方向已全部落地**：① 框架无关数据引擎 `createDataSource`（多列排序 / 操作符过滤 / 分页+无限 / 乐观更新 / 树形选择），② 类型化 AI-native manifest + MCP + codegen + 跨框架契约测试，③ 企业级 a11y + i18n / 全球化（aria-label 走 `t()`、ICU 复数、`localeDirection`/RTL、`forced-colors`、四端 axe 门），④ 生产健壮性（错误边界 / `AbortSignal` 取消 / 陈旧守卫 / 受控时序 / formatter 缓存），⑤ 插件生态播种（charts / form-builder / schema-admin / adminShell 产品化）。v2 全文见 git 历史（`git show HEAD~:ROADMAP.md`），本版取代之。
>
> **v3 的统一主题：从「引擎」到「验证」的最后一公里。** v2 证明了能力，也划定了 v3 的边界——整个库建立在三块**很薄的底座**之上：一个 ~30 行的 `store`、一个退化的状态机 `machine`、一个纯数学的虚拟化模块 `virtual`；而旗舰消费面（pro-table、AI codegen、文档站、SSR 声明）对这三块底座**只部分消费、或根本没消费**。v3 把价值重心收在三件事——**(A) 加深三块 core 底座**，让更多交互逻辑真正下沉到 core（护城河）；**(B) 把已存在的引擎接线进旗舰表格与一个真实参考应用**（采用面）；**(C) 把「断言但未度量」的承诺——规模 / SSR-hydration / 四框架在难点上的一致性——用度量与真实 npm 发布兑现成可验证的保证**（采购门）。下列 5 个方向按**价值/成本**排序，每项给出现状证据（`file:symbol`）、为什么需要、建议范围、边界情况、性能、原则一致性与价值/成本，**且均尊重不可妥协的原则**（逻辑下沉 core、薄桥、AI-native props、B 类能力做插件、token 杠杆）。

---

## 1. 规模化表格 —— store 批处理 + 有度量反馈的虚拟化器 + 无头列状态引擎，接线进 pro-table

> 一句话：把三块**休眠的 core 底座**（`store` / `virtual` 数学 / `columns` 数学）做成一套**被真正消费**的规模引擎，让旗舰表格真正扛住 10 万行变高行 + 列宽/固定/重排。

**现状（证据）**

- **`store` 无批处理 / 无派生**：`store.ts` 的 `setState` 每次都 `for (const l of [...listeners])` 全量遍历派发——无 `batch`/`transaction`；`subscribeWith` 只支持单 store，**无 `derived`**。于是每个控制器操作都**多次 emit**（`data-source.ts` 的 `setSort` 先 `setState` 再 `reloadFromStart→load→setState`），复合控制器只能用 `subscribe→setState` 二跳桥**伪造派生并双 emit**（`resource.ts:117`）。
- **虚拟化是纯数学、从未被旗舰消费**：`virtual.ts:computeVirtualRange` 数学很扎实，但**无 measured-size 缓存、无 `scrollToIndex`、无 scroll-anchoring**，`buildOffsets` 是 O(n)；而 `plugin-pro-table/src/react/index.tsx:229` 直接 `state.rows.map(...)` 把**全量行**塞进 DOM（只 import `createSortable`，**根本没 import 虚拟化器**）——10 万行数据集**直接卡死标签页**。
- **列状态在 core 里不存在**：`columns.ts` 只有表头矩阵 span 数学；**列宽 / 顺序 / 固定 / 可见性**——定义企业级表格的那套能力——core 里查无此物；pro-table 的列重排逻辑被**锁在插件**里，基础 `Table` 无法共享。`contracts/README.md` 把 column-resize / column-state 仅作为**「延期项」**提及。

**为什么需要（架构 + 产品）**

代码库里**最易错的胶水**和**最大的能力缺口**，都指向「底座存在、却未做厚或未接线」。`store` 的多 emit 是全体重渲与 `resource` 双 emit 的根源；虚拟化器缺位是旗舰表格的**规模悬崖**；列状态缺位是企业表格的**定义性能力洞**。从产品看，「带列管理的虚拟化企业表格」是 AntD / AG-Grid / TanStack 买家**第一个跑分**的能力，而今天的规模 demo 字面意义上会崩。从架构看，v2 的 `createDataSource` 解决了**数据轴**；本方向把三条正交的**布局/规模轴**——emit 合并、行/列窗口化、列状态——打包成一个可投资的赌注，且**硬数学大多已就绪**，剩下的只是有状态控制器 + 渲染层接线。

**建议范围**

- `createStore` 增 `batch(fn)`/`transaction(fn)`（把 N 次 `setState` 合并为一次 flush、去重监听）+ `derived(stores[], combiner, equals?)`（自动订阅/退订的只读派生 store）。
- 改造 `data-source`/`resource` 热路径走 `batch`；用 `derived()` 替换 `resource` 的手写桥（**顺带修掉泄漏**，见速赢）。
- `createVirtualizer`（包裹 `virtual.ts`）：按 item-key 的 measured-size 缓存、`measure(index,size)`+remeasure 协议、**增量偏移补丁**（干掉 O(n) 重建）、scroll-anchoring、`scrollToIndex`/`scrollToOffset`；`flattenTree→window` 联动。
- `createColumnState`：有序列 + 每列 `{size,minSize,maxSize,pinned:left|right|null,visible,canResize/Reorder}`；派生表头几何（组合 `columns.ts`）；serialize/deserialize（持久化交消费方）。
- 三者**以「先加后收敛」接线进 pro-table ×4**（保持插件公共 API 不变）：渲染层只映射窗口切片 + spacer、消费 `createColumnState` 取代插件内重排；基础 `Table` 可选开启。
- 为 store-batch 的 emit 计数、虚拟化器 measure 循环、列状态变更补契约场景。

**边界情况**

- 必须保住契约测试钉住的 **sync-then-callback 顺序**与受控选择时序——`batch` 须是**可选包裹器**（加法），不能改默认 emit 语义；改完全量重跑契约门。
- `measure→render→remeasure` 回路是经典的滚动跳动/死循环源——需**可注入的测量源**（jsdom 单测）+ 一条真实浏览器滚动测试。
- 固定列边界 + 四渲染器的拖拽重排；把 pro-table 迁出现有重排而不回归已发布插件。
- 视口上方行高变化时的 scroll-anchoring 不得跳视口。
- 未知总数的无限模式：虚拟化器须在「只增追加」的列表上窗口化（无已知 total）。

**性能**

- 每个用户动作只 emit 一次（而非 N 次）跨 data-source/resource/selection/form——更少全量重渲，10 万行滚动/排序时体感最强。
- 渲染层只挂可视窗口（~几十个节点）而非 10 万 `<tr>`×N cell——**消除头号规模悬崖**。
- 增量偏移补丁取代每次滚动 O(n) 的 `buildOffsets`（变高行）。
- 横向/2D 列虚拟化（`computeGridVirtualRange`，当前零非 core 调用方）用于超宽表。

**原则一致性**：纯 A 类——批处理/派生、测量缓存、列状态全部落 core 做**零配置控制器**；四渲染器各得一条薄「窗口映射 + 测量上报」桥（`ResizeObserver`/`onMount` size report）。B 类消费（pro-table）保持可选、公共 API 经「先加后收敛」稳定。零配置路径上**不新增组件、不增消费方包重**。

**价值/成本**：🟥 价值/成本比最高（一举消除旗舰规模悬崖 + 删掉最易错的胶水 + 补上定义性表格能力洞，且硬数学已就绪）· 成本 中-高（集中在四框架渲染层接线 + measure 回路测试架，是「在正确引擎上接管线」而非「造新架构」）· 风险：中（触及已发布 pro-table，需公共面不变 + 契约门常绿）。

---

## 2. 把承诺度量出来 —— 规模 / SSR-hydration / 难点一致性 的度量 + 契约门

> 一句话：把 v2「断言但未度量」的三个头条承诺（10 万行规模、SSR/RSC-ready、四框架完全一致）变成 **CI 守住的保证**，并修掉门会照出来的真泄漏/真不匹配。

**现状（证据）**

- **规模零度量**：全仓 `*.bench.*` 一个没有，无 tinybench/vitest bench，**没有任何测试在 1 万~10 万行渲染表格**——一次改动把热路径劣化 10×，CI 仍绿。
- **SSR 是断言出来的**：`react/src/ssr.test.tsx` 只跑 `renderToStaticMarkup`；全仓测试**从不调用 `hydrateRoot`/`hydrate`**；Solid/Svelte **两个完整框架零 SSR 测试**——真正的生产故障模式（hydration mismatch、`getServerSnapshot` 漂移、Solid `createUniqueId` id-drift）**完全不可见**。`apps/` 里没有 Next/Nuxt/SvelteKit/SolidStart 应用；`check-rsc-directive.mjs` 只扫 dist banner 字符串。
- **一致性只覆盖了简单面**：契约场景 `contracts/scenarios/` **21 个 / 149 组件**，全是 form/table 简单原语；**漏掉每一个 overlay**（Dialog/Popover/Tooltip/Menu/Drawer/Toast/Combobox）**外加 v2 keystone `createDataSource`**——恰恰是四条手写适配器**最容易发散**的地方。
- **两处确证泄漏**：`data-source.ts` 的 `selection.store.subscribe(...)` 返回的退订函数被丢弃，`destroy()` 从不退订；`resource.ts:117` 的 `ds.subscribe(...)` 桥同样丢弃退订——多小时 CMS 会话里每次路由卸载都把控制器图钉住。
- **size 门是钝的**：`check-size.mjs` 只 gzip `dist/index.js` 对手抬的天花板（注释里 13→18KB），对 per-export/tree-shake 成本**盲视**；icons 作为单个不可摇树的对象字面量出货。

**为什么需要（架构 + 产品）**

库的三个头条声明**今天结构上不可验证**：一次回归能 10× 某热路径而 CI 全绿；SSR 的真实故障面看不见；旗舰一致性门只覆盖了**最不会发散**的 21 个简单组件、漏掉所有 overlay 和卖库的数据引擎。从产品看，企业采购**会**要 Next/Nuxt/SvelteKit/SolidStart 支持、**会**拿 sort/filter/scroll 在 10 万行对标 AG-Grid/TanStack——两者今天都没证据。这是**最便宜的高杠杆缺口**，也是**让方向 1 站得住的后盾**：不先有基线，就无法可信地证明虚拟化/批处理的收益，也无法证明 overlay 时序四端一致。两处确证泄漏就活在这里，必须被门守住。

**建议范围**

- `benches/` 工作区（vitest bench / tinybench）：`createDataSource` sort/filter @1万/10万（按比值断言 O(n log n) 形状）、增量偏移构建、formatter 缓存命中率、10 万行选择 toggle、虚拟范围成本；CI perf job 记录 JSON 基线、对大回归告警（先 advisory 吸收 runner 抖动）。
- 每适配器一条**真 hydration 测试**（`renderToString→hydrateRoot/hydrate`，断言无 mismatch 警告），覆盖 overlay/portal/Table/`createDataSource`；为 Solid 建立 hydration 上下文。
- `apps/` 下四个薄 meta-framework 冒烟应用（Next App Router / Nuxt / SvelteKit / SolidStart），import overlay + 数据组件，CI 里 build+hydrate 断言。
- 契约场景 + 每适配器 driver 覆盖 **overlay 开关/dismiss/focus 生命周期**与 **`createDataSource`**（sort→回第 1 页、乐观 mutate+回滚、无限追加 `hasMore`、陈旧 load 被取代）；更新 `contract-coverage.test.ts` 要求新类目。
- **修两处确证泄漏**（两个 `destroy` 路径里捕获并调用退订）+ data-source/resource/async/selection/form 的「destroy 完整」契约场景。
- 升级 `check-size.mjs` 为 per-PR size diff + per-export/tree-shake 导入成本检查（单图标导入成本、`IrisButton` 图大小）；加 `@vitest/coverage` 非阻塞下限。

**边界情况**

- hydration 门**会**照出真不匹配（Solid `createUniqueId`、overlay portal、模块加载期读 `localStorage`）——然后必须修，范围会扩，但这正是目的。
- overlay 行为部分活在适配器 floating hook 而非纯 core——每个场景须**收敛到「控制器可观测的契约」**或经渲染 DOM 断言，以保持 jsdom 有效。
- bench 对 runner 抖动敏感——用比值/形状 + op 计数断言、而非绝对 ms；门先 advisory 直到基线稳定。

**性能**

- 把每条 perf 声明从「断言」变「度量」；抓住 sort/filter/offset/formatter-cache 热路径的静默 10× 回归。
- per-export/tree-shake size 检查暴露不可摇树的 icon 对象字面量与 gzip-天花板门漏掉的体积蠕变。
- 修掉一处确证的慢内存泄漏（每次路由卸载留下活监听钉住控制器图，多小时会话致命）。

**原则一致性**：纯验证/测试基建——除泄漏修复外无公共 API 变更，契约场景是加法。保持逻辑在 core（场景驱动无头控制器）、薄桥（per-adapter driver 是机械的）、18KB core 预算（size 门守它）。meta-framework 应用住在 `apps/`，不进出货包。

**价值/成本**：🟥 价值 很高 · 成本 在便宜的一半上极低（bench、泄漏修、契约场景都是加法且逻辑已在），meta-framework hydration 应用中-高且可能照出 bug——**但「照出来」本身就是采购价值**。直接回答数据表格 + SSR 买家的评估清单，并为方向 1 的收益背书。

---

## 3. 让「AI 原生」与「四框架」可触可证 —— manifest 接地的接线式 codegen + 一个旗舰 CRUD admin + 四框架活体浏览器

> 一句话：在买家真正检验的三处把护城河做实——把 manifest 从「逐组件片段」升级成**接线式 codegen**、出**一个完整 CRUD admin**、让文档把**四框架活体**展示出来。

**现状（证据）**

- **AI codegen 止步占位符**：`README.md:9` 标语「the native output format for AI-generated application UIs」，但 `mcp/src/tools.ts:107` 的 `scaffoldView` / `:80` 的 `componentTag` 只 emit `import` + 带 `{/* type */}` 占位的标签——**零 state/handler/data 接线**；agent 仍要手写全部胶水，尽管 manifest 是 v0/Lovable/shadcn-registry **都没有**的接地资产（已验证的 prop 契约、不会幻觉 props）。
- **旗舰 demo 让库显得比实际更弱**：真实 admin 需要的引擎**都已存在却没接线**——`resource.ts:332` 的乐观 `mutate`+回滚、`nav.ts:119` 的 `filterNavByAccess` RBAC（但 `NavNode` 无 `roles` 字段）；而 4 个 CMS demo 只有 Dashboard/Users/Settings/Generic **静态页**，`grep mutate|onSubmit|delete|drawer` 为空，`grep react-router|vue-router` 跨 `apps/cms*` 为空（**无 CRUD、无 auth、无路由**）。
- **「四框架」在文档里看不见**：标语是四框架一致，但 `apps/docs/.vitepress/generate-components.mjs:15` 的 `DEMOS` 硬编码 **8 个 Vue-only** demo，`IrisDemo.vue` 是无控件的静态 `ClientOnly` 槽，`config.ts` **无 search 块**——评估者**字面上看不到 React/Solid/Svelte 渲染或切 prop**。manifest 还带着 **97 events + 138 slots**，文档生成器全忽略。

**为什么需要（架构 + 产品）**

最深的技术投资，恰好在买家评估它们的**那三处**隐形。AI 原生：标语承诺「AI 生成 UI 的原生输出格式」，但 codegen 只给 import+占位标签——agent 仍手写全部胶水，而 manifest 这块**唯一接地资产**白白浪费。旗舰：真实 admin 要的引擎全有却没接，demo 反让库显得**比实际更不能干**。一致性：头条是四框架，文档却只渲染 8 个 Vue-only demo。这些都是**头 10 分钟购买决策面**：AntD Pro/Refine/Vben 靠**可信的 admin 参考**赢单，shadcn/MUI/Radix 靠**逐框架可交互 demo**赢单，AI 原生是**独有差异化**却恰在会被检验处未交付。为什么现在：接地资产、引擎、四个 playground 应用**都已存在**——这是组合 + 接线 + 一处小 core 改动（`NavNode.roles`），不是新架构。

**建议范围**

- **MCP codegen（纯、可测）**：把 `tools.ts` 从占位标签推进——为 `value`+`onValueChange` 受控对 emit `useState`/`ref` 脚手架，把 `ProTable`/`FormBuilder`/`Select` 接到 `createDataSource`/schema 桩，从一句简短意图组合多组件视图（模板驱动、确定性）；加 `generate_view`/`generate_test` 工具。
- **旗舰 admin（React 参考实现 + 另 3 框架配方文档）**：mock auth provider + 登录 + 会话；给 `NavNode` 加 `roles`/权限并接 `filterNavByAccess` 让菜单按角色门控；`activeKey↔URL` 绑路由（deep-link/前进后退/刷新）；一个资源的真 CRUD（list + 新建/编辑 drawer + 删除 + 选区批量）经 `resource.mutate` 打 MSW；把 CommandPalette + NotificationCenter 接进壳 header。
- **文档浏览器**：manifest 驱动的活体 demo 组件（prop/enum 控件自动派生、复制代码、逐框架代码 tab），用现有 playground 应用为 top ~30–40 组件**四框架**挂真实 demo；加 VitePress search 块；在生成页面里**呈现 manifest 的 events/slots**。
- **可选 Phase 2（GTM 物料，外部 LLM）**：一个托管的「描述视图 → 可运行 Iris 代码 + 活体预览」playground，由 manifest 接地，复用浏览器的活体预览基建。

**边界情况**

- 确定性模板 codegen 只能逼近真实接线——Phase 1 收敛到「组合好、接到桩、能编译运行」的视图；开放式部分留给可选 LLM 阶段（manifest 接地以防幻觉 props）。
- 旗舰守住「**一个资源做到极致**」（不做功能完备 CMS）；路由 deep-link/前进后退/刷新必须保 nav/tab/active-page 同步。
- 浏览器在一个文档站嵌 4 套框架运行时需 island/bundle 隔离——先做已半成的 React+Vue demo，再 Solid/Svelte。

**性能**

- 浏览器从 manifest 自动派生控件，封顶逐组件作者成本。
- 浏览器与可选 prompt-to-page playground 共享活体预览基建，避免第二套运行时。
- 零消费方包重影响：codegen 是 `@iris-ui/mcp` 里的纯 manifest 逻辑，demo 住 docs/playground 应用。

**原则一致性**：AI-native props 是地基——codegen 与浏览器都消费声明式 prop/enum/default 契约而非新组件逻辑。旗舰接线**既有** core 引擎（resource/nav/command-palette），唯一 core 改动是 `NavNode.roles` 小字段（属 core 的框架无关 nav 材料）。薄桥与 token 杠杆不动。

**价值/成本**：🟥 价值 高（采用漏斗 + 差异化护城河可见可触）· 成本 中-高（集中在接线 + 四框架 demo 作者，非造引擎）· 一个出色的 React 参考 + 配方文档是可接受的 v1，浏览器逐组件成本由 manifest 自动派生封顶；托管 LLM playground 是唯一高成本/带基建的件，**显式可延期**。

---

## 4. 提升状态机 —— 把交互时序请进 core（delays/after、entry/exit、一级嵌套），并把 tooltip/toast/longpress 下沉进去

> 一句话：把退化的 `machine` 做厚，让 hover-intent、开关延迟、自动消失、长按变成**声明式、可测的 core 逻辑**，而非逐适配器各自漂移的 `setTimeout`。

**现状（证据）**

- `machine.ts:19` 的 `StateNode` 只有 `on`；`send()` 是 `:59` 的扁平查表；**无 `after`/延迟转移、无 entry/exit 动作、无嵌套**。
- 唯一消费方 `floating.ts` 只用 ~2 个状态——状态机**几乎不承载任何真实行为**。
- 于是 tooltip hover-intent、toast 超时、longpress 各自**在任何状态机之外**手搓 `setTimeout`；记忆里那个 **flaky Solid tooltip** 正是「时序在适配器」的症状。
- `contracts/scenarios/` **无任何 overlay/时序场景**（与方向 2 配对）。

**为什么需要（架构 + 产品）**

`machine.ts` 诚实地退化：无头逻辑层的直接对标物（Zag.js、XState）把 hover-intent 延迟、tooltip/toast 时序、longpress、focus 时序**放进状态机**。因为 Iris 的状态机**表达不了延迟**，每个这类组件都在任何 machine **之外**手搓 `setTimeout`——于是「状态机」几乎不承载真实交互逻辑，这从**结构上封顶了能下沉到 core 的行为量**，即便技术上不违反原则 1，精神上已违反。从产品看，这是让 tooltip/popover/menu/toast/longpress 交互变成**声明式跨框架契约场景**（而非逐适配器漂移计时器）的使能件，并直接关掉审计点名的 flaky-Solid-tooltip 类 bug。为什么现在：v2 稳住了 store 与控制器，**交互时序层是「逻辑卡在适配器」的最后前沿**，且与方向 2 的新 overlay 契约场景配对（契约门获得首个时序覆盖）。

**建议范围**

- 扩展 `createMachine`：`after`（延迟转移，状态退出时自动取消，测试用确定性计时器注入）、entry/exit 动作数组、可选一级嵌套状态 + 一个微小的 invoked-effect 钩子（承载带清理的副作用：计时器/监听）。
- 把真实交互时序下沉进 core 状态机、由既有薄桥桥接：tooltip/popover 开关延迟 + hover-intent、toast 自动消失、longpress。
- 为新时序状态机补契约场景（契约门首个 overlay/时序覆盖），用注入计时器。

**边界情况**

- 范围蠕变成 XState 克隆——停在 `after`/entry-exit/一级嵌套（覆盖 80% 组件时序的那 20%）；**不做** parallel/actors/spawned children。
- 可注入计时器是关键，否则 jsdom 测试照样 flaky（现有 flaky Solid tooltip 是前车之鉴）。
- 保 `send`/store 契约向后兼容，`floating.ts` 与既有消费方零改动。

**性能**

- 用「退出即取消」的单计时器模型取代逐适配器 `setTimeout`——更少泄漏/重复计时器、确定性消失。
- 集中时序消除导致冗余开关抖动的适配器漂移。

**原则一致性**：正中逻辑下沉 core——它抬高了「多少交互行为能沉到 A 类」的天花板，让适配器**更薄**（计时器移出去）。`send`/store 契约向后兼容；不新增组件，除状态机小幅做厚外无消费方包重。

**价值/成本**：🟧 价值 高（护城河的结构性使能件，让更多行为住进 core 并可被一致性测试）· 成本 中（由刻意的 80/20 范围封顶）· 排在 1–3 之后，因它**加深既有底座**而非直接解锁采用/采购，且其收益多经方向 2 的契约门兑现。

---

## 5. 嵌套路径表单引擎 —— 字段/错误/touched/dirty 走 dot/bracket 路径，解锁字段数组与子表单校验

> 一句话：把扁平键的表单模型换成路径模型，让 `items[2].sku` 的**逐行错误**能浮现——这是把 form-builder 从「7 个扁平字段类型」做成真表单设计器的 table-stakes 缺口。

**现状（证据）**

- `form.ts:15` `Key<V> = keyof V & string`；`:22` `FieldErrors`/`FieldFlags` 是 `Partial<Record<topLevelKey,…>>`；`updateArray` 操作整个顶层数组字段——**无逐元素状态**。
- `standard-schema.ts:32` 的 `issueKey` 只读 `issue.path?.[0]`——把 `items[2].sku` 的**嵌套校验错误塌缩到顶层 `items`**。
- `plugin-form-builder` 的 `FieldType` **无 array/repeater/sub-form**；嵌套逐行错误**今天根本无法浮现**。

**为什么需要（架构 + 产品）**

`form.ts` 很深（逐字段 async token、debounce 校验、跨字段依赖、wizard、数组助手）但**扁平**：错误只到顶层键，`issueKey` 只读 `path[0]`，把嵌套 Zod/Valibot 错误塌缩成 `items`。于是字段数组内的**逐行错误结构上无法浮现**，也没有逐元素的 touched/dirty/validation。这是**正确性天花板，不是 nicety**：一个 wizard/repeater 表单——恰是 `plugin-form-builder` 的目标——**报不出哪一行失败**。从产品看，每个真实企业表单都有 `address.city` 与 `items[2].sku`；RHF/Formik/TanStack-Form 全按路径 key 状态。v2 造好了难的 async/race 机制，**嵌套路径是剩下的 table-stakes 缺口**，也是把 form-builder 的数组/子表单字段类型产品化的前置。为什么现在：async 底座已稳，这是把 form-builder 从「7 个扁平字段 demo」变成真表单设计器的**那一个加法重构**。

**建议范围**

- 路径模型（按 `a.b[2].c` get/set/del）覆盖表单状态；错误/touched/dirty/validating 按**全路径** key；把 `standard-schema` 的 `issue.path[*]` 映射到全路径而非 `[0]`。
- 逐元素字段数组校验/touched/dirty；适配器 `useField` 增路径支持。
- 扁平键用法 **100% 向后兼容**（裸键即 1 段路径）；解锁 `plugin-form-builder` 的 array/sub-form 字段类型。

**边界情况**

- 对有状态表单内部做路径重构有回归既有扁平表单契约（最常用面）与逐字段 async-token race 防护的风险——必须是**加法**（路径是键的超集），由既有全套表单测试 + 新嵌套场景守门。
- 对 **Zod 与 Valibot 两种 path 形状**都验证（`issue.path` 元素形态不同）。
- 数组 reorder/insert/remove 必须正确重 key 逐元素的 error/touched/dirty 状态。

**性能**

- 路径 get/set 须避免每键击全量克隆——只沿被触路径做结构共享更新。
- 不引入新订阅抖动：保既有逐字段选择性订阅模型。

**原则一致性**：A 类且严格加法——表单是核心身份，路径是键的超集，适配器保持薄（`useField` 增可选路径）。在不把逻辑移出 core 的前提下解锁 B 类插件（form-builder）。扁平路径零包重影响。

**价值/成本**：🟧 价值 高（表单竖类的正确性天花板，非 nicety）· 成本 中 · 排末位，因它**竖类专属（表单）**而非护城河级或采购解锁，且变现它的 form-builder 产品化是后续件。若 forms/wizard 竖类是近期 GTM 优先级，**强烈建议前移**。

---

## 速赢清单（低成本、高价值，可穿插各方向先做）

> 这些是审计里 effort=low / value=high 的项，建议作为各方向的「开胃菜」先落地，快速兑现可见收益。

| 速赢                                                                                          | 所属方向 | 收益                                                              |
| --------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| 修两处确证泄漏（`data-source.ts` selection 桥、`resource.ts:117` ds 桥）——`destroy` 里退订    | 2        | 消除每次路由卸载钉住控制器图的生产内存泄漏，几行 + 一条契约测试   |
| `store.ts` 加 `derived(stores[], combiner)` 并用它重写 `resource` 桥                          | 1        | 一招删掉最易错胶水 + 消除双 emit + 修掉 resource 泄漏             |
| `apps/docs/.vitepress/config.ts` 加 VitePress search 块（本地或 Algolia）                     | 2/3      | 149 组件参考当前**不可搜索**，一个 config 块即让文档可导航        |
| 把组件级 JSDoc + `@example` 收进 manifest（`schema.ts:26` 已有 description 字段，0/149 携带） | 3        | ~80% 已就绪，倍增每个 AI 面（suggest/validate/llms.txt/docs）     |
| 在生成的文档页里呈现 manifest 已有的 **97 events + 138 slots**                                | 3        | 数据已跟踪却被生成器忽略，纯生成器改动，立得完整度                |
| 编写 `createDataSource` 契约场景（sort→回页 1、乐观回滚、无限追加、陈旧取代）                 | 2        | v2 keystone 引擎当前零契约覆盖，场景是加法且逻辑已在              |
| 加 `generate_view`/`generate_test` MCP 工具（薄包扩展后的 `scaffoldView`）                    | 3        | codegen 落地即把接线式生成暴露为一等 agent 工具，纯 manifest 逻辑 |
| `eslint-plugin` 硬编码的 3/13 插件清单补全                                                    | 5/DX     | 一处便宜修，消除清单漂移                                          |

## 排期建议（sequencing）

1. **Phase 0（随处穿插，按天计）**：纯加法正确性速赢——泄漏修、docs search、manifest events/slots 呈现、组件 JSDoc 收割。即时回报、降风险，不依赖哪个大赌注先跑。
2. **Phase 1 — 先立方向 2 的「度量」半边**（bench + per-export size 检查 + `createDataSource`/overlay 契约场景 + 泄漏门）。理由：这是最便宜的高杠杆工作，**也是让方向 1 可证的后盾**——没有基线就无法可信地落批处理/虚拟化收益。
3. **Phase 2 — 方向 1**（store 批处理 → `createVirtualizer` → `createColumnState` → 三者接线进 pro-table）。先 batching+derived（最小，解锁泄漏速赢、降 emit 抖动），再定高行窗口化接进 pro-table（体感规模收益），最后 measure 反馈回路与列状态。每步对 Phase 1 的 bench + 契约门设门。
4. **Phase 3 — 方向 2 的「验证」半边**（四个 meta-framework hydration 应用），待引擎稳定后做——门会在方向 1 触及的 overlay/数据组件里照出不匹配，**在它们落地后修比落地中修更好**。
5. **Phase 4 — 方向 3**（codegen → 旗舰 admin → 四框架浏览器）。先做 manifest 接地的 codegen（纯、可测），再旗舰 admin（接既有引擎 + 新 `NavNode.roles`），再浏览器（复用 playground 运行时 + manifest 控件）。可选托管 LLM playground 最后做，门控于维护者基建决策。
6. **Phase 5 — 方向 4、5**（状态机提升、嵌套路径表单）作为并行加深轨。方向 4 天然与 Phase 1/3 的 overlay 契约场景配对；若 forms/wizard 竖类成近期 GTM 优先级，把方向 5 前移到与 Phase 2 并行。
7. **横切 GTM 门：真 npm 0.1.0 发布**（repository/homepage/keywords + `publishConfig.provenance` + 翻 `private:false` + changeset version + dry-run + VitePress 部署）是**不可逆的维护者授权决策**——排在 Phase 1 的 size/hydration 证据给出「首发不会暴露打包故障」的信心**之后**、Phase 4 的采用面**之前**（让浏览器/admin 出货时已有 install + 文档 URL）。视为「go 决策 + 既有流水线上的小收尾」，不作为投资方向。

## 不在本路线内（显式决定，非能力缺口）

- **npm 0.1.0 首发本身**不作为「方向」——它是维护者 go 决策 + 既有流水线（changesets + release.yml + 四门 + size 预算）上的一把 flag（repository/homepage/keywords、`publishConfig.provenance`、翻 `private:false`、changeset version+tag、dry-run、VitePress 部署）。作为横切排期门，非可投资工程赌注。
- **复述 v2 为新工作**：`createDataSource`/resource 收敛、类型化 manifest + enum/default prop 契约、7 工具 MCP、a11y/i18n、健壮性 pass、插件播种（12 插件）、跨平台/触摸 DnD 适配——**全部已 DONE**；v3 只**接线或验证**它们，绝不重建。
- **完整 XState 克隆**（parallel states / actors / spawned children）——方向 4 刻意停在 `after`/entry-exit/一级嵌套。
- **AG-Grid/FullCalendar/RHF 功能对等重建**——表格（方向 1）、日历（下延）、表单（方向 5）赌注都收敛到具体缺失原语，非功能完备克隆。
- **静态/可抽取 CSS 层**（zero-runtime CSS、FOUC 修）——真有价值，但**高成本**触及每组件 ×4 框架、有视觉漂移风险；延到视觉回归基线（它本就需要）与方向 2 的 size 门就位后再做。不在 v3 首地平线。
- **第 5 个 Web Components 适配器**（Lit/vanilla）——最高成本新适配器，门控于上面的静态 CSS 抽取（shadow DOM 没它会无样式出货）。排在 v3 之后；框架无关 core 让它后续可达，但当下非最高杠杆。
- **可选网络韧性层**（数据引擎上的 retry/backoff/offline/staleTime/dedup）——真新逻辑，须保持可摇树的 B 类、离 18KB core 路径；有价值但次于「接线与验证已有的」。并入后续数据引擎迭代。
- **独立的 date/DST + 时区感知日历事件方向**——收窄为一个快速正确性修（`clampDate`/`isOutOfRange` 日一致性 + 一个 TZ 矩阵测试）并入方向 2 的门；完整时区感知事件模型留在 `plugin-calendar`（B 类），不在 v3 core 范围。
- **`create-plugin` 生成器 + 插件 versioning/coreCompat 元数据 + 编辑期 ESLint/LSP 校验**——值得做的 DX，但第三方作者杠杆只在 npm 发布 + 旗舰采用落地后才显现；延到 post-v3 生态地平线（`eslint-plugin` 硬编码的 3/13 插件清单是其中唯一便宜修，可作速赢）。

---

> 评估方法：本版由一次 9 子系统并行只读审计（core / 四适配器 / 12 插件 / CMS+admin / AI 工具链 / 主题 token / 构建发布桌面 / 测试文档 / v2 守卫）→ 5 视角（架构 / PM / 性能 / 可靠性 / DX）提炼 23 候选 → 单点收敛为上述 5 方向。每条证据均经源码抽验。
