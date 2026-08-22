Gate stage for **批 DV：URL 状态深链（iris 独有）** complete. ✅

## Verdict

`batch-dv-review.md` = **FAIL** → fixes applied at gate → re-verified **PASS** ✅

Review findings **#1 (medium)** + **#2 (low)** are one defect hidden by a weak test; **#3–#5 (info)** documented, no action. Fix is small and localized; everything else was already green.

### Fix delivered

- **#1 — `Table.tsx` URL write effect (no-clobber guard)**: a fully-uncontrolled table (`urlState` on, zero owning callbacks) no longer writes the URL. The effect gates on `ownsChannel = (multiSort ? onMultiSortChange : onSortChange) || onFiltersChange || onFilterValuesChange || (proxy && proxyConfig?.onPageChange)` and returns early when nothing is owned — the persistState precedent verbatim ("Nothing the parent owns → nothing to write"). A seeded `_table` deep link survives a urlState-only view (pre-fix: empty payload serialized to `null` → `writeUrlTableState(null)` deleted `_table` at the first post-mount render — empirically `?_table=…&keep=1` → `?keep=1`). "Empties remove `_table`" is preserved for tables that DO own channels but currently have nothing to encode.
- **#2 — `batch-dv.test.tsx` de-vacuoused test**: `before` is now captured **pre-render** and the seed is explicitly asserted to survive both the mount write and an internal uncontrolled sort flip. Verified the test **fails against the pre-fix Table.tsx** (`?keep=1` — param stripped at mount) and passes with the fix — no longer vacuous.

### Gates re-run

| Gate                                                  | Result                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **188/188** tasks (106 cached, 82 forced)                                                        |
| `pnpm audit:security`                                 | ✅ **0 vulnerabilities**                                                                            |
| `gen:manifest`                                        | ✅ regenerated — **zero diff** (155×4 components, 86 tokens, 201 react props / 32 events unchanged) |
| `check:manifest`                                      | ✅ up to date, byte-identical                                                                       |

### Final test counts (fresh runs)

- **react**: 249 files — **2855/2855** ✅ (incl. batch-dv 13/13 at `batch-dv.test.tsx`, 373 lines ≤ 500 + SSR 5/5 at `batch-dv-ssr.test.tsx`)
- **core**: 106 files — **1641/1641** ✅
- Source scope: only `packages/react/src/primitives/table/Table.tsx` (+12 lines) + the DV test file — additive, no core/CSS/other-framework changes.

### Comparison doc (`docs/vxe-grid-comparison.md`, iris 独有 section)

- **批 DV** row updated: review-gate fix paragraph appended (no-clobber `ownsChannel` guard, seeded deep-link survival, de-vacuoused test, gate counts).

### Note on environment

The first full-gate attempt hit `desktop-os-vue#build` failing on `previewColumnsFromRows` — the installed `@iris-ui-kit/core@0.2.1` in `node_modules` was a stale registry copy while the committed lockfile specifies `workspace:* link:../core`. Repaired node_modules (git-invisible, relinked 5 `@iris-ui-kit/*` packages to the workspace) → full gate green. No tracked file touched for this; unrelated working-tree changes from the concurrent grid-refactor pipeline left uncommitted and untouched.
