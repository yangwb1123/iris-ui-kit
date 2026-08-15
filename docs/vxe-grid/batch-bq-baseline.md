Baseline written to **`/home/u1/iris-ui/docs/vxe-grid/batch-bq-baseline.md`** (47 lines, the only new file; `git status` confirms source untouched — the two `M` entries are pre-existing state from the BP batch).

## 核验摘要

**设计** — `editAutosave?: boolean` + `onAutosave?: (rows: Row[]) => void`（props.ts:349，`onEditClosed` 后编辑组内）。单一咽喉 `commitValue`（Table.tsx:2746）——inline 编辑提交的唯一写回漏斗（cell 模式 :2831 / row 模式 :2900 两路汇合），末尾门控触发（`editAutosave` 是特性开关，`onAutosave` 单独无效果，keymap 先例）。**与 onDataChange 的正交性是本批关键事实**：现状 inline 编辑**从不**触发 `onDataChange`（只有 `commitRowList` 发），`onAutosave` 精确填补父持久化钩子缺口；row-list 类写回（paste/fill/FNR/批量）不触发 `onAutosave`。

三个既有机制复用：**ref 镜像**（`cellEdit` 是 `useMemo([])`，闭包必须经 `onAutosaveRef`/`editAutosaveRef` 读——`auditEnabledRef` 同构）；**payload** = 提交后行列表（标准 rowKey 行靠 eager 块同步，rowId 行加 8 行 `autosaveRows` helper 逐字镜像 updater 的 fallback）；**`value === oldValue` 早退**天然覆盖 no-op 不触发。

**fiats**：校验失败/Escape 不触发；async 校验落地时触发一次；row 模式逐列提交逐列触发；双回调正交；纯回调零 UI/i18n/core。

**文件地图**：props.ts +2（156→158）· Table.tsx 3 触点 · 新 `edit-autosave.test.tsx` · comparison doc 3 处 · manifest 重新生成（eventCount 29→30）。

**测试计划**：12 用例，规格强制两项打头——①双击→改值→Enter 触发且载荷为新行列表、②有 `onAutosave` 无 `editAutosave` 不触发；外加 no-op/校验失败/Escape/Tab/row 模式逐列/双回调正交/连续编辑累积/async 落地/rowId 分支。
