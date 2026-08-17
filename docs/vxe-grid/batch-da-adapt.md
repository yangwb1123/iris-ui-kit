Done. Working tree clean, all gates green.

## Report — 批 DA：单元格格式化复制增强（iris 独有）

### 结论：验证式 adapt

Per `docs/vxe-grid/batch-da-baseline.md`（我逐行复核、未引用旧文）：**该 spec 已被已提交的批 CU 完整实现**（`5b5c85e9` + `09393338` + `15bbc1d4` 均在 HEAD `8964a7b6` 之前落地）。本次会话直接对磁盘代码逐项验证，零新增功能代码（additive-only）：

| Spec 条目                                        | 代码证据（本次验证）                                                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 复制选中区域按列 formatter 输出（单格→选区整体） | 单格链 `contextCellText`（Table.tsx:2098，批 BW 已有）→ CU 扩展至 `buildRangeCopy(range, format, copyWithFormat)`（Table.tsx:6822）逐格切换 formatter 列 |
| 与 mask 组合（掩码优先）                         | `contextCellText` 先 `applyCellMask` 再 `formatter`（formatter 收到掩码串）；测试钉 `M:138****8000`                                                      |
| 测试（选区格式化复制）                           | `copy-with-format.test.tsx` 14/14（432 行 ≤500），spec 逐条 1:1 映射                                                                                     |

双喉（Ctrl/Cmd+C :7049 + 工具栏 :7380）均穿参；三序列化器（tsv/csv/html）都带格式化字符串（RFC-4180 + OWASP 仍生效）；非 formatter 列 byte-identical；paste 不对称；react-only。**有意不加** baseline 建议的 7 条边角测试——每句 spec 已有对应测试、14/14 是被门禁的 CU 契约、文件将逼近 500 行上限。

### Changed files

**0 source files**（全部属于 CU 已交付：props.ts +1 字段单行 clipConfig · Table.tsx · types.ts · copy-with-format.test.tsx）。本次提交 `9f771530` 仅 docs：`batch-da-adapt.md`（新）+ `DECISIONS.md`（adapt 条目）+ 顺手收编上阶段遗留的 `batch-cz-gate.md`/`batch-da-baseline.md`（175 insertions）。

### Tests & counts

- core test **1580/1580** ✓（102 files，框架无关未触碰）
- react typecheck clean ✓ · react test **2671/2671** ✓（236 files）
- react lint **0 errors** ✓（1 既有 IrisTable complexity warning）
- spec `--mode all` **0 violations** ✓（1416 files）
- gen:manifest **zero diff** ✓（155×4、86 tokens，CU 已同步）→ 已跑但无可提交内容

### Left

- pipeline review（`batch-da-review.md`）+ 全仓 gate 阶段
- 工作树干净；无未完成项
