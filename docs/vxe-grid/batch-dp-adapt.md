Working tree clean, commit coherent, DP suite still 14/14 post-format. All gates green.

## 批 DP：表格滚动条增强 — 完成报告

### 结论

Baseline 锚定全部验证在位（feature 骨架已于 `61ec5418` adapter 对齐提交交付），本批次**补齐 spec 中唯一真实缺口**：hover 色增强此前是 no-op（`primary → primary`，baseline 观察①），现改为真实现，并补默认关态负向断言（观察③）。

### Files changed（commit `107bf8af`）

| 文件                                                            | 变更                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/table-css.ts`              | DP CSS 块：thumb rest `color-mix(in srgb, var(--iris-primary) 60%, transparent)` → `:hover` 全量 `--iris-primary`；8px 细条、`border-radius: var(--iris-radius-sm, 4px)` 圆角不变；覆盖 root + `[data-iris-virtual-scroll]` |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | DP 用例强化（断言圆角/8px/color-mix hover 增强）+ 新增默认关态无属性负向用例                                                                                                                                                |
| `docs/vxe-grid/batch-dp-baseline.md` / `DECISIONS.md`           | 观察① 处置记录为已修复、③ 已补；追加 do 阶段证据                                                                                                                                                                            |
| `docs/vxe-grid/batch-do-gate.md`                                | 前序会话遗留证据一并提交（worktree 原已脏）                                                                                                                                                                                 |

### Tests added

+1 用例（默认关态负向，观察③），DP 现 2 用例；测试文件 ~328 行 ≤500 ✓

### Verification counts

- **core test**: 104 files / **1597** pass ✓（core 零变更，框架无关铁律未触及）
- **react typecheck**: clean ✓；**react test**: 246 files / **2819** pass（batch-dl-dt **14/14**）✓
- **react lint**: **0 errors**（2 条 Table.tsx 既有 complexity warning，非本批次引入）✓
- **iris-ui-spec.py --mode all**: 1535 files / **0 violations** ✓
- **gen:manifest**: 155×4 / 86 tokens，重新生成后**无 diff**（prop 早已计入，无新组件/类型）✓

### Constraints check

- Core framework-free ✓（未触碰 core）；react only ✓；additive only ✓（CSS 细化 + 新断言，零删除）
- 无 dist/node_modules/tgz；manifest 仅重新生成未 hand-edit ✓；`--iris-*` token only（color-mix over token，零硬编码色）✓
- 预提交钩子：filesize ✓、变更预算 Files 5/5 · core lines +6 ✓

### What is left

- 观察②（`styles.ts:295` TABLE_ROW_CSS 孪生副本缺 DP 规则）未动——仅 density-toggle 排序测试消费，非运行时源，避免扩漂移面；如后续批次新增该表规则，建议顺手同步或改由 `table-css.ts` 单源导出
- Firefox 端 `scrollbar-color` 无法表达 hover 增量（原生限制），rest/hover 增强落在 WebKit 层
