Gate stage complete for 批 DP（表格滚动条增强）. Verdict was **PASS** (4 LOW/INFO, no blockers).

## 执行结果

| 门禁项                                                                 | 结果                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Review verdict                                                         | **PASS**                                              |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks** (135 cached, 1m41s)                 |
| `pnpm audit:security`                                                  | **0 vulnerabilities**                                 |
| `gen:manifest` + `check:manifest`                                      | **up to date** — 155×4 / 86 tokens，重新生成后零 diff |
| `git diff --check` / commit hooks                                      | clean · filesize + 变更预算 5 files / 0 core lines ✓  |

## 最终测试计数

| Suite                                                                | Files | Tests       |
| -------------------------------------------------------------------- | ----- | ----------- |
| react（含 DP `batch-dl-dt.test.tsx` **14/14**，开态注入 + 关态负向） | 246   | **2819**    |
| core（零变更）                                                       | 104   | **1597**    |
| turbo                                                                | —     | **180/180** |

## 文档更新（`docs/vxe-grid-comparison.md` iris 独有 节）

- 新增 **批 DP 行**：`scrollbarThumb` opt-in 默认 off（`props/advanced.ts:198`、关态零根标记 `Table.tsx:8070`）→ `table-css.ts:153-175` 8×8px 细条 + radius-sm 圆角 + Firefox `scrollbar-color`，hover 真实现（rest `color-mix` primary 60% → hover 全量 primary，观察① no-op 修复），覆盖根 + `[data-iris-virtual-scroll]` 双滚动面，core/三框架零改动，观察②孪生副本留待单源化
- 构建状态段追加 批 DP 摘要
- `batch-dp-gate.md` 重写为真实 gate 报告（DO 先例）；`DECISIONS.md` 追加 gate 记录

## Commit

**`fb183262`** `feat(table): grid 批 DP——表格滚动条增强（iris 独有）` — 5 files, +118/−20。工作树干净（0 未跟踪/未暂存）。
