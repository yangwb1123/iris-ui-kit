Baseline written: `/home/u1/iris-ui/docs/vxe-grid/batch-dz-baseline.md` (166 行，批 DZ 单元格拖拽复制). No source files modified — `git status` shows only the new doc plus pre-existing dirt.

**Verified** (HEAD `b0a75395` 批 DY 已合入，manifest 203 props / 33 events — DZ → 204 props):

- 批 CN cut-move 全链可复用：`cellDrag` at `props/query.ts:68`、拖拽三件套 + `moveRangeFromHandle`（Table.tsx:5715-5830）、elementFromPoint 命中模具、grip（`interaction-helpers.tsx:234/253`、`RANGE_MOVE_STYLE`）、工具栏防误关 selector（:5933-5940）
- 跳过纪律（批 BE）：formula 永不读写、locked/readonly 双相存活、keyless 跳过、单次 `commitRowList`、选区跟随
- outline 先例：presence 内联 outline（cell-helpers）、fill 用 token 背景——DZ 取 token outline
- 测试配方：cell-drag-move.test.tsx 拖拽模拟 + `test/` 目录新批测惯例（batch-dx/dy）

**Design 要点**：`cellDragCopy?: boolean`（props/query.ts 紧跟 `cellDrag`）；`data-iris-range-copy` 12×4 pill 在左上格 **bottom 边缘**（与 CN 的 top-edge move pill 零碰撞）；state 直接存目标矩形 `cellDragCopyRect`，纯函数 `resolveCopyTarget` 整块适配才给矩形——**越界忽略**（无 outline、松手零提交，与 CN 的 clamp 刻意分歧并列为 fiat 1）；`data-iris-copy-target` + token outline 打在目标矩形；`copyRangeFromHandle` = CN 提交减去 phase-2 清空（源块不动）；suppress selector 并入 `[data-iris-range-copy]`。9 条显式 fiat、6 文件 map（4 源码 + 1 新测 + manifest 再生成）、21 例测试计划（复制 3 + 越界忽略 4 + outline 3 + 纪律 4 + 回归 7）。
