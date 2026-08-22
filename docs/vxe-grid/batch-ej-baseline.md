Baseline 完成，只读核查零改动。**输出**: `/home/u1/iris-ui/docs/vxe-grid/batch-ej-baseline.md`（232 行，git status 确认唯一新增，其余 dirty 均为会话前已存在）。

## 核查事实（全部逐行实测）

- HEAD `c58f7175`（批 ED 已合入）。`persistState` **仅存在于 react**：vue/solid/svelte/core 零命中——本批是首次跨框架同步。
- **react 参考**（usePersistState.ts + Table.tsx）：收集器逐块「可恢复的才保存」（:1761-1799）、`restorePersistPiece` 回调门（:1823-1900）、pageSize **pre-query 注入**恰一次请求（:1090-1108）、skip-first 挂载保护、JSON 去重、`storage:false`/SSR/坏 JSON fail-inert。
- **svelte 能力差**：有通道 4 块（sort→`onUpdateSort` :158、filters→`onFiltersChange` :107、columnWidths→`onColumnWidthsChange` :663-666 双通道、pageSize→`proxyConfig.onPageChange` 通知）；**无通道 2 块**——`columnVisibility` 仅受控 prop（零回调/UI）、`columnOrder` 完全不存在（grep 零命中，列重排走 `columnDrag.onReorder(columns)` 整列数组）。

## 设计要点

`persistState?: { storage?; key?; include? }` 纯 LOADS/SAVES 协调器，对 react AG 逐字对齐、runes 化：顶层一次性解析（SSR 窗口守卫）→ 代理创建 effect 内 pageSize 注入（`onPageChange(1,size)` + `request({pageSize:size,page:1})` 恰一次）→ 恢复 `$effect`（先于保存、逐块回调门 + 类型守卫、复用提取出的 `applySort` 同一咽喉）→ 保存 `$effect`（每变更收集、skip-first 挂载保护、whole-object JSON 去重、写错误 fail-inert）。**零 core 改动**（批 AG 先例），零 styles/i18n。

**关键 fiat F1**：规格列六块，但 svelte 无 columnVisibility/columnOrder 通道 → 两块恒惰性（永不收集/永不回放），与 react 收集器逐字同构；补齐通道属后续批范围，为 gate 开放问题。另有 F2-F7（pageSize 保存门不对称镜像、一次性解析、列宽恢复双通道超集、piece 类型规格六块非 react 九块、存储守卫留适配器侧、缺通道测试当断言不当跳过）。

## 文件地图（7 项）

`types.ts` +3 型 · `props.ts` +1 单行 prop（:152 后）· **NEW** `table-persist.svelte.ts` · `IrisTable.svelte` 4 触点 + 2 effect · `index.ts` +3 导出 · **NEW** `persist-state.test.ts`（jsdom ≤500 行）+ `persist-state-ssr.test.ts`（node pragma，Badge 先例）· comparison doc 行 + manifest 再生成（adapt 阶段）。

## 测试计划（~19 例）

规格先行：①挂载经回调恢复（sort+filters+widths 原值 + DOM 反映）②变更整包保存 ③**挂载提交永不复写存储** ④`storage:false` ⑤坏 JSON ⑥非纯对象 ⑦include 双向 ⑧自定义 key ⑨**pageSize 首查询前恢复**（单请求 + `onPageChange(1,25)`）⑩无代理跳过 ⑪缺省 localStorage ⑫配额写错不崩 ⑬无 prop 零 IO ⑭columnVisibility/columnOrder 惰性 ⑮无回调双向惰性 ⑯⑰remoteFilter/remoteSort 重查 ⑱窄 include；SSR ⑲窗口守卫 + server render 冒烟。
