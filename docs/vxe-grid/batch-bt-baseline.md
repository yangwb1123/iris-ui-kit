Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bt-baseline.md`** written — the only new file (`git status` confirms the two `M` entries are pre-existing batch-BS state; zero source files touched).

## 核验摘要

**设计** — 新表级 prop `selectionDrag?: boolean`（props.ts:484，`checkboxRange` 后；表级 → propCount 159→160、eventCount 30 不变）。规格「行选择列按下拖拽连续勾选（经过的行勾选，checkMethod 尊重）」：multi 模式按下 `__selection` 格（Table.tsx:6029，renderRow 唯一 body 站点，flat/virtual/分组三路径同源）不立即选中 → pointermove 超 **4px 阈值**（row-drag 对齐）进入拖拽：`elementFromPoint` → `closest('[data-iris-table-row]')`（range-fill 命中先例；组头/汇总/详情槽无该 attr 天然忽略）→ String 键域 `findIndex`（rowDrag/scrollToRow 同款，数字/字符串键不混型）→ **锚点与悬停行闭区间**，checkMethod 合格行**追加勾选**（`dragKeys` 单调并集 → `rebaseToProp()` + `selModel.set([...display, ...add])`，selectAll 加法先例 :3977）。点击抑制复用 shift-click 同一机制（cell onClick `preventDefault` 取消 label→input 转发及 change，:6034-6038）；pointer capture + 表根三门（:7878/:7887/:7896）从三拖拽扩为四拖拽分发。

**文件地图**：props.ts +1 · Table.tsx 5 触点 · types.ts 零改动 · 新 `test/selection-drag.test.tsx` · comparison doc 3 处 · manifest 重新生成。

**测试计划**：13 用例，规格强制两项打头——①拖拽勾选（1→4 全勾）、②跳过禁用（checkMethod 行不勾且 disabled）；外加普通点击不抑制、trailing click 防二次翻转、反向拖拽、加法保留、单调回缩、无 prop 惰性、single no-op、受控无乐观翻转、树模式、禁用锚点可起拖、非行区域保持范围。

**10 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验（含 Checkbox 结构、`bodyDataRef`、`data-iris-table-row` 键域、既有三拖拽门的门控表达式）。
