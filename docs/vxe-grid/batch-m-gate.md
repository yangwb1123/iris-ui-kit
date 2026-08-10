**Gate PASS — committed.**

## Summary

**Verdict:** PASS (`docs/vxe-grid/batch-m-review.md`) with 1 MEDIUM finding — group summary rows in `groupPlan.map` lacked a `key` (React unique-key warning on every grouped render with a summary column). **Fix applied** (`Table.tsx:3301-3306`): the group-summary branch now returns a keyed `React.Fragment` (`group-summary:${groupKey}`), matching the group-header convention; 12/12 batch-M tests re-verified after the fix.

**Full repo gate (`turbo run test typecheck lint build --concurrency=2`):** ✅ **180/180 tasks** (1m38s, 135 cached)

- **audit**: 0 known vulnerabilities
- **gen:manifest**: ✅ regenerated — **155 components** (all 4 frameworks aligned) / 86 tokens, **byte-identical to HEAD** (no diff)

**Final test counts (fresh runs):**

| Suite                                    | Count                                  |
| ---------------------------------------- | -------------------------------------- |
| react                                    | **1656/1656** (151 files, +12 batch-M) |
| core                                     | **1249/1249** (81 files)               |
| batch M `group-batch-autowidth.test.tsx` | 12/12                                  |

**Docs updated** (`docs/vxe-grid-comparison.md`): 列宽 → `width:'auto'` 自适应（批 M）, 汇总 → 分组汇总（批 M；groupBy 组内汇总 + 全局 footer 同 aggregate ops）, 工具栏 → `toolbar.batch` 批量按钮（批 M）, new 批 M build row, footer → react 1656 · core 1249. Also prettier-formatted flagged docs (adapt/review/DECISIONS) + the new test file (re-verified 12/12 after).

**Commit:** `f81c9c52474b22ed2c90e878c7adbf3175156681` — `feat(table): vxe-grid 批 M——分组统计行/批量工具栏/列宽自适应（react only）`
