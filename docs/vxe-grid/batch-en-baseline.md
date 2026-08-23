Baseline complete — 只读核查零源码改动，唯一新增交付品：

## 交付：`/home/u1/iris-ui/docs/vxe-grid/batch-en-baseline.md`（76 行）

**核查结论**（HEAD `91df1997`，批 EM svelte 已合入）：审计日志目前 **react-only**（批 AT）——vue/solid/svelte 全包零命中。react 批 AT 是直接先例（`AuditPanel.tsx` + `audit-log.test.tsx` 9 例）。core `createAuditLog` 框架无关、11 核心测试已存，且经 `resilience-exports.ts` 从主 barrel 再导出——vue 同路径**零改动复用**。`auditDiff` 在 react 侧（`interaction-helpers.tsx`）非 core，需 vue 携带同款纯函数。`table.audit` 三键已在 core 英文默认（批 AT 内置），vue i18n **零改动**；manifest 预期 nil diff（`auditLog` 已在共享条目的 react 超集）。

**关键架构发现**：vue 编辑统一走 `writeCellValue` 单一咽喉（inline + 行模式逐格）；结构写漏斗 = `removeRows`/`loadData` handle；re-baseline 点 = `tableData` computed 三源（parent 重喂/proxy refetch/rowDrag 内部写）。**vue 非 proxy 编辑不写行表**（props.data 不可变）——react 的「patch(liveData)+diff」在 vue 会产生 stale-base 反转（第二笔把第一笔的 new 当 old 报），是本批核心设计分歧。

**设计**（镜像 react AT 薄桥）：`auditLog?: boolean` prop + setup 一次 `createAuditLog`（push 由 `props.auditLog` 实时门控，off 零 push）+ 三漏斗——`writeCellValue` **提交点直记** 'edit'（规避反转；单格条目与 react diff 逐字节一致）、`removeRows` 列表 diff 'remove'、`loadData` 'edit'（react commitRowList 默认类型 parity）；`watch(tableData)` re-baseline（react effect parity，rowDrag 重排不记账）；工具栏触发钮 + 浮动面板（`useFloating`/`useDismiss`/scroll-capture/Teleport，DOM 与 react 逐字同构）+ `auditEntries` 订阅 ref 原地刷新（不重渲染整表）+ handle `getAuditLog`/`clearAuditLog`（seq 永不重置）。

**文件地图**：vue 包 5 改（props/types/table-sections/Table + 新 `table-audit.ts`）+ 2 新测试文件？：1 新测试 `audit-log.test.ts`（~10 例）+ comparison 行；**零 core/i18n/样式/manifest 改动**。

**测试计划**：11 例镜像 react 9 例 + vue 专属——连续两笔无反转守卫（F1 验收）、行模式逐格、proxy + loadData re-baseline。

**8 条 fiat 留 gate 仲裁**：F1 提交点直记 vs 列表 diff（vue 专属反转规避）、F2 `auditDiff` 留 vue 侧（core 收敛独立批）、F3 loadData 记账 / 重喂重排 re-baseline、F4 触发钮位置与 gate、F5 controller 惰性、F6 行模式逐条 + emit 顺序不动、F7 scope 边界（insert/paste/fill/undo 等 vue 无入口，留后续批复用 `recordAudit`）、F8 manifest nil diff 断言。
