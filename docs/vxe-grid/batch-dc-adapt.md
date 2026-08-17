All verification green. Final summary:

## 批 DC：冻结列多列拖拽排序（冻结区内 reorder，iris 独有）— Done ✅

### Commits

- `cc1b1b59` — `feat(table): grid 批 DC——冻结区内列拖拽排序钳制（iris 独有）`（5 files, +542/−5：Table.tsx +47 / pinned-reorder.test.tsx 新 402 行 / comparison doc 2 处 + DECISIONS + adapt 文档）

### What was built

**Spec**：`pinned 多列拖拽排序（冻结列可互相拖拽调整顺序——冻结区内 reorder）；测试（冻结区排序）`。

列拖拽重排机制早已存在（`columnDrag` → `colDragCtrl`/`createSortable` + `colRectsRef` + `resolveColDrag`），且**完全与 pin 状态解耦**——此前一个拖拽可把固定列丢进未固定区，`pinnedOffsets` sticky 布局（偏移按左固定序数累积）随之损坏。本批是**纯复用**：把落点钳制进拖拽列自己的固定区。

| 文件                                           | 改动                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react/.../table/Table.tsx`                    | +1 模块级纯函数 `clampReorderZone`（:231，`zone = pinOf(col) ?? 'free'`——与 pinnedOffsets 同一 `pinOf` 咽喉；同区落点原样通过、跨区越前钳区首/越后钳区尾）+ `resolveColDrag` 重排块（:4521-4540）接线 + net-zero 守卫（钳回原位跳过 `onReorder`，rowDrag `from === insertIndex` 先例；仅钳制可达）                                                                                                                |
| `react/.../table/test/pinned-reorder.test.tsx` | **新 402 行（≤500 ✓），15 测试**（react 2682→2697）：T1/T4 冻结区内重排 / T2/T3/T5/T15 跨区钳制（含孤立固定列净零）/ T6 零固定回归（vxe 重排字节同形）/ T7 双 pin 间自由区重排 / T8 net-zero 钳制不回调 / T9 钳制提交 + DOM 跟随 / T10 孤立右固定列净零 / T11 受控 + 无 onColumnPinnedChange（pin 通道零触碰）/ T12 分组叶列 / T13 gapped 态 `[A(left),B,C(left),D]` / T14 CH 拖出固定回归 + 菜单开启带内重排仍活 |
| `docs/vxe-grid-comparison.md`                  | 2 处：iris 独有表新增批 DC 行 + `columnDrag` 行（批 CH）追加钳制语义                                                                                                                                                                                                                                                                                                                                              |

### Key design

- **不变式**：列拖拽永不改变列的固定区——`[left][free][right]` 分区保持，gapped 态含内（批 CV gap 处理同款）。
- **零固定表字节不变**：全部 'free' → 区跨全表 → 落点原样 → 与改动前逐字一致（vxe parity 回归锁）。
- **正交审计**：CH 拖出固定边缘检查保持最先（固定手势优先）、CV 边界句柄独立通道、BX 菜单零触碰、customConfig 面板草稿重排刻意不钳（父拥有顺序，fiat）、`data-iris-col-drag-over` 保持指针位置语义（仅提交时钳制，fiat）。

### Verification (all green)

- **core test 1580/1580** ✓（框架无关零改动）
- **react typecheck clean** ✓ · **react test 2697/2697** ✓（2682 → +15）
- **react lint 0 errors** ✓（1 既有 `IrisTable` complexity warning，非本批引入）
- **iris-ui-spec.py --mode all → 0 violations** ✓
- **gen:manifest → 零 diff**（propCount 185/eventCount 32/155×4 不变，无新导出新 prop）+ **check:manifest up to date** ✓

### What is left

1. **review 阶段**（`batch-dc-review.md` 对抗审查）+ **全仓 gate**（turbo 四框架 build/audit/E2E/视觉回归——本任务只执行 VERIFY 列出的命令）。
2. vue/solid/svelte 对齐 deferred（react-only 范围——钳制是 `resolveColDrag` 内的适配器逻辑，三框架后续各加薄桥即可；core 零改动）。
3. RTL/视觉回归未跑：本批零样式改动。
