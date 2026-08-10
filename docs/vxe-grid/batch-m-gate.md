**Batch M gate: PASS — committed.** Working tree clean.

## Summary

**Verdict:** PASS — but with 1 MEDIUM finding, so I applied the concrete fix first: group summary rows in `groupPlan.map` lacked a `key` (React unique-key warning on every grouped render with a summary column). Fixed at `Table.tsx` — the group-summary branch now wraps `renderSummaryRow` in a keyed `React.Fragment` (`group-summary:${groupKey}`, matching the group-header convention).

**Full repo gate** (`turbo run test typecheck lint build --concurrency=2`): ✅ **180/180 tasks** (1m38s)

- **audit** → **0** known vulnerabilities
- **gen:manifest** → ✅ 155 components (all 4 frameworks aligned) / 86 tokens, **byte-identical to HEAD** (no diff)
- Batch M test file re-verified 12/12 after both the key fix and prettier formatting

**Final test counts (fresh runs):**

| Suite                                    | Count                                  |
| ---------------------------------------- | -------------------------------------- |
| react                                    | **1656/1656** (151 files, +12 batch M) |
| core                                     | **1249/1249** (81 files)               |
| batch M `group-batch-autowidth.test.tsx` | 12/12                                  |

**Docs updated** (`docs/vxe-grid-comparison.md`): 列宽 → `width:'auto'` 自适应（批 M）· 汇总 → 分组汇总（批 M；groupBy 组内汇总 + 全局 footer 同 aggregate ops）· 工具栏 → `toolbar.batch` 批量按钮（批 M）· new 批 M build row · footer counts → react 1656 · core 1249. Also wrote `docs/vxe-grid/batch-m-gate.md` per convention and prettier-formatted the flagged docs + test.

**Commit:** `102d3b80b2e234a0dbe48913b47218cab3ced75c` — `feat(table): vxe-grid 批 M——分组统计行/批量工具栏/列宽自适应（react only）`
