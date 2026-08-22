Baseline 完成。仅写的文件：`/home/u1/iris-ui/docs/vxe-grid/batch-dq-baseline.md`（其余两个 `M` 文件 `DECISIONS.md`、`batch-dp-gate.md` 为工作区既有改动，未触碰；零源码修改）。

## Baseline summary — 批 DQ：行拖拽跨表（iris 独有）

**Exact design** — spec（`rowDragBetween?: Array<{ key: string; onDrop: (row: Row) => void }>`，拖到表格外 `data-iris-drop-zone` 目标区触发 onDrop）**已在 HEAD `fb183262` 完整提交**（`61ec5418` adapter 对齐重构内随 DL–DT 批次落地，`docs/STATE.md` 有批记录），逐行锚定：

- **类型**：`types/base.ts:118-124` `IrisTableRowDragBetweenTarget<Row>`，形状与 spec 内联定义逐字一致
- **opt-in**：`props/editing.ts:84-86`，默认 undefined（缺省零手柄、inert）
- **命中**：`Table.tsx:2413-2423` — `elementFromPoint` → `closest('[data-iris-drop-zone]')` → attribute 匹配 key → 每事件从最新 prop 解析 onDrop
- **拖出不取消**：`Table.tsx:8136` leave 豁免（配 rowDragBetween 时离开表格不中止，窗口级监听 `2563-2581` 接管）
- **命中清线**：`2445-2451` `over(null)` 清 CD 插入线；未命中走表内 `moveOver`
- **释放分流**：`2513-2524` 命中 → `end()` + 按 activeId 找回整行 → `onDrop(row)` 恰一次、提前 return 不落 `onReorder`；未命中 → `2526-2550` 原表内重排（净零不动不通知）
- **测试**：`test/batch-dl-dt.test.tsx:248-271`「DQ drops a row on a matching external zone」——外部 `<div data-iris-drop-zone="archive">` + stub elementFromPoint → press/move/up → `onDrop` 携带 `rows[0]`

**File map**：类型 1 + prop 1（经 props.ts/types.ts 公共出口）+ Table.tsx 8 touch points + 测试 1，零 core/其他框架/i18n/样式改动。

**Test plan**：实跑 3 套件 **39/39 绿**（batch-dl-dt 14/14 含 DQ、row-drag-indicator 10/10、vxe-parity 15/15）；`tsc --noEmit` 0 errors、eslint 0 errors（2 条 Table.tsx 既有 complexity warning，非 DQ 引入）。

**3 条 non-blocking 观察**：① zone 高亮归 parent（表格只读属性，拖拽态信号为行级 `data-iris-row-drag-active` 可作 parent CSS 锚点，无表格侧高亮断言）；② key 不匹配负向、命中 zone 不触发 onReorder 组合、elementFromPoint 缺失防御分支均无显式测试；③ manifest 两条 rowDragBetween 记录缺 description（口径一致，非漂移）。
