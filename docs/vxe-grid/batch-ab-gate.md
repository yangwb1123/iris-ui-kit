Gate complete — verdict was **FAIL with concrete fixes**, so I fixed → reran → full gate → committed.

## Summary

**Review fixes** (`packages/solid/src/primitives/table/IrisTable.tsx`):

- **MEDIUM 1** — added epoch guards (`sessionGen` parity) to row-mode sessions (`gen` on `RowCellSession`, bumped on cancel/commit) and cell-mode (`cellEditGen`): Escape during a pending async editRules commit no longer writes back; double-Enter commits once.
- **MEDIUM 2** — proxy `loadData`'s `localRows` override is now cleared when the next query result reference lands (pager page change shows fresh rows, no stale page-1 list).
- **LOW** — click path reordered rowMode-first over `cellRange`; same-row dblclick now re-begins the whole row via `switchRowEdit` (React parity).
- **6 regression tests** added (Escape-pending ×2 modes, double-Enter, pager-replaces-loadData, dblclick re-begin, rowMode-first).

**Gate-stage discovery**: batch AB's hoisted `cellEditor` fragment broke ssr-solidstart's hydration test (DOM build eagerly instantiates its `<input>` template per cell — no server counterpart). Fixed by inlining the editor into the Show fallback (batch-AA pattern). Verified attribution via revert, and the cms-svelte failure was transient.

**Full gate**:

| Check                           | Result                                              |
| ------------------------------- | --------------------------------------------------- |
| turbo test/typecheck/lint/build | **180/180 tasks** ✅                                |
| solid                           | **993/993** (959 DOM + 34 SSR; 127 files, +6 tests) |
| react / vue / core              | 1823 / 1531 / 1249 ✅                               |
| audit                           | **0 vulnerabilities**                               |
| manifest                        | gen + check clean, **155 × 4** aligned              |

**Docs**: `vxe-grid-comparison.md` — 批 AB rows (solid: 拖拽/行编辑模式/右键菜单/筛选面板/代理方法) marked done (react+vue+solid), batch-table row + summary paragraph added, gaps refreshed (**svelte 对齐为下一轮**).

**Commits**:

- `8f40aaac` — `feat(table): vxe-grid 批 AB——solid 适配器功能对齐（交互批）` (13 files, +2214/−177)
- `2d04d5a3` — `chore: 批 AB 收尾（gate 报告）` (report at `docs/vxe-grid/batch-ab-gate.md`)

Working tree clean. Note: the 500-line pre-commit gate split the row-edit tests into a new `parity-ab-rowedit.test.tsx`.
