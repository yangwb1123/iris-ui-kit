Baseline complete. No source files modified — only the new doc (`docs/vxe-grid/batch-eb-baseline.md`, 126 行) was written; the `M` files in git status are all pre-existing dirt.

## 批 EB 列访问统计 baseline（/home/u1/iris-ui/docs/vxe-grid/batch-eb-baseline.md）

**Verified**（HEAD `30c860e1` 批 EA 已合入;manifest 205 props / 33 events → EB → **206 props**,events/components 不变;react 2947/2947、core 1641/1641):

- **点击咽喉**:统一 `handleCellClick`(Table.tsx:3784)+ 两条窄分支(cellRange-only、click-trigger)——三分支互斥,每点击恰经过其一;off 路径 onClick 表达式字节不变
- **编辑咽喉**:cell 模式单咽喉 `beginEdit`(:3619,guards 先滤 locked/readonly/formula,覆盖 dblclick/F2/click-trigger/键盘导航/edit-key remap);row 模式 `createRowSession`(:2401)仅 2 调用点(beginRowEdit 扇出 + 单列重开)
- **面板/工具栏先例**:AuditPanel 模具(useFloating + portal + 触发钮排除外部关闭)、门控表(:7804)、handle 每渲染重建闭包最新(getFilteredData 先例)、getAuditLog 空数组 fail-closed

**Design**:`columnStats?: boolean`(props/editing.ts,pattern/patternFill 后);react 本地 `useState` 计数 map(无 core 控制器——「内部计数」会话本地),`bumpColumnStats(key, kind)` 函数式 setState;点击 3 分支各一处 + 编辑在 beginEdit/createRowSession 各一处,全 `columnStats &&` 门控;`handle.getColumnStats()` 返回 total desc + key asc 决胜的 `{key, clicks, edits, total}[]` 快照(off/无活动 → `[]`);新面板 `ColumnStatsPanel.tsx`(top `COLUMN_STATS_TOP=5`,`data-iris-column-stats-panel/row/rank/empty`,零订阅被动 props、live 刷新);工具栏 `▦` 触发钮 per perfStats 先例;i18n +4 键 en+zh 同批。

**File map**:8 项(editing.ts、Table.tsx、ColumnStatsPanel.tsx 新、types/handle.ts +`getColumnStats`+`IrisTableColumnStat`、test/batch-eb.test.tsx 新、core i18n +4、zh +4、gen:manifest 205→206)。**Test plan**:21 例 = 计数 13(纯表/rowMode/cellRange/click-trigger 双计/dblclick/F2/row 扇出锁列跳过/Escape 仍计/off fail-closed/快照复制/paste-fill 不计/表头不计/排序决胜)+ 面板 8(触发钮门控/top5 截断/行内容/空态/三路关闭/live 刷新/zh 文案/决胜)。**10 条显式 fiat**(表头不计、row 扇出按可编辑列、paste/fill 不计、会话本地不持久化、无清除通道、被动面板零订阅、off 零成本、叶列键、setState 重渲染成本 opt-in 文档化)。
