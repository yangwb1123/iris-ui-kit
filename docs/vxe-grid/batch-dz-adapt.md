Done. Committed as `aef146fa` — `feat(table): grid 批 DZ——单元格拖拽复制（iris 独有）`.

## Report

### Files changed (4 source + 1 test + manifest + adapt doc)

| File                       | Change                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `props/query.ts`           | `cellDragCopy?: boolean` (+JSDoc) right after `cellDrag` → manifest **203→204 props / 33 events**                                                                                                                                                                                                                                                                 |
| `styles.ts`                | `RANGE_COPY_STYLE` (12×4 primary pill, `cursor: copy`, `bottom: 2` — bottom edge, RTL-neutral, z 3) + `RANGE_COPY_TARGET_OUTLINE` (`2px solid var(--iris-primary, #6366f1)` — token + spec-verified fallback)                                                                                                                                                     |
| `cell-helpers.tsx`         | 7 module-scope helpers + exported named interface `IrisRangeCopyTarget` (co-located with the presence-outline precedent; row-render arrow complexity untouched)                                                                                                                                                                                                   |
| `Table.tsx`                | +155/−9 — grip state (`cellDragCopyRect` stores the resolved target rectangle + arm ref), down/move/up handlers (CN hit-test mold, keep-last, zero-commit cancel/越界), `copyRangeFromHandle` (CN commit minus phase 2 — source never touched, ONE `commitRowList`), `data-iris-copy-target` + token outline, 3 root-gate widen points, suppress selector widened |
| `test/batch-dz.test.tsx`   | **NEW — 21 tests / 499 lines** (≤500 ✓)                                                                                                                                                                                                                                                                                                                           |
| `manifest.json`/`llms.txt` | regenerated via `gen:manifest`                                                                                                                                                                                                                                                                                                                                    |

### Tests added (21)

fail-closed ×2 · grip bottom-edge render + press-survival · 复制 ×3 (single / 2×2 whole / overlapping snapshot — Excel parity) · 越界忽略 ×3 (beyond last row/col, before first row/col, whole-block boundary + fit contrast: no outline, zero commit) · outline ×2 (dest rect attr+outline, source never marked, cleared on release; keep-last outside body) · 纪律 ×3 (formula never read/written, locked/readonly dest survives, keyless no-op) · 回归 ×5 (no-move no-op, source-block no-op, pointercancel, move+copy coexist, fill+copy coexist, undo).

### Counts (all green)

- **core 106 files / 1641/1641** ✓ (zero core changes — framework-free invariant)
- **react 253 files / 2928/2928** ✓ (+21) · typecheck ✓
- **lint 0 errors** (2 pre-existing complexity warnings, untouched)
- **iris-ui-spec: 0 violations / 1546 files** ✓
- gen:manifest regenerated + committed · `check:manifest` up to date ✓ · manifest tests 69/69 ✓ · prettier clean · filesize gate PASS (test at exactly 500)

### What is left

- review/gate stages (harness) + batch comparison-doc row / DECISIONS entries (gate-stage convention)
- Documented fiats in `batch-dz-adapt.md` (9, per baseline: 越界忽略 vs CN clamp, bottom-edge grip, rect-stored state+arm ref, source-block no-op, selection stays, BE discipline, single commit, re-resolve race guard, token outline)
- `check:docs-reference` stale `apps/docs/components.md` — pre-existing (gitignored, fails on HEAD-clean stash too); pre-existing working-tree dirt untouched
