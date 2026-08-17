All done. Final report:

## 批 DC：冻结列多列拖拽排序（冻结区内 reorder，iris 独有）— Done ✅

### Files changed (committed `2c0cfcb6` + docs sweep `24ff1b0c`, tree clean)

| File                                                               | Change                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/Table.tsx`                    | **+47** — module-level pure fn `clampReorderZone` (:231, `zone = pinOf(col) ?? 'free'` through the SAME `pinOf` throat as pinnedOffsets) + `resolveColDrag` reorder block (:4521-4540) wiring + net-zero guard |
| `packages/react/src/primitives/table/test/pinned-reorder.test.tsx` | **new 402 lines (≤500 ✓), 15 tests**                                                                                                                                                                           |
| `docs/vxe-grid-comparison.md`                                      | 2 spots: new 批 DC row in the iris 独有 table + `columnDrag` (批 CH) row appended                                                                                                                              |
| `docs/vxe-grid/batch-dc-adapt.md` · `docs/vxe-grid/DECISIONS.md`   | adapt report + ledger entry (+ baseline/gate dirt swept per precedent)                                                                                                                                         |

### What was built (per baseline, zero drift)

- **Spec**: 冻结区多列拖拽排序——same-zone drops pass through index as-is (**zero-pin tables byte-identical** — vxe parity locked); over-before-zone → zone start; over-after → zone end. Invariant: **a column drag never changes a column's pin zone** — `[left][free][right]` partition preserved, gapped states included (批 CV gap handling).
- **Net-zero guard**: clamp landing back on the source index skips `onReorder` (rowDrag `from === insertIndex` precedent, only reachable via clamping — lone-pin zones).
- **Orthogonality audited**: CH drag-out pin edge check stays first · CV boundary handle separate channel · BX menu untouched · customConfig draft reorder deliberately unclamped (fiat) · `data-iris-col-drag-over` keeps pointer-position semantics (clamp at commit only, fiat).
- **Zero core/props/types/styles/i18n/other frameworks** — pure reuse of the existing columnDrag machinery. Manifest zero diff (186 props / 32 events, 155×4).

### Tests added (15, mapping spec 冻结区排序)

T1/T4 frozen-zone intra-reorder · T2/T3/T5/T15 cross-zone clamp (incl. lone-pin net-zero, both directions) · T6 no-pin regression (byte-identical vxe) · T7 free-zone between pins · T8 net-zero no-call · T9 clamped commit + DOM follows · T10 lone right-pin net-zero · T11 controlled + no `onColumnPinnedChange` (pin channel untouched) · T12 grouped leaves · T13 gapped `[A(left),B,C(left),D]` · T14 CH drag-out regression + in-band reorder alive with menu on.

### Counts

- core test **1580/1580** ✓ (framework-free unchanged) · react test **2697/2697** (238 files, 2682 → +15) ✓ · react typecheck **clean** ✓ · react lint **0 errors** (1 pre-existing `IrisTable` complexity warning) ✓ · **spec --mode all → 0 violations** ✓ · **gen:manifest zero diff + check:manifest up to date** ✓

### What is left

1. **Review stage** (batch-dc-review.md adversarial review) + **full-repo gate** (turbo 4-framework build/audit/E2E/visual regression — this task only ran the VERIFY-listed commands).
2. vue/solid/svelte alignment deferred (react-only scope — the clamp lives in `resolveColDrag` adapter logic; core is untouched, so future frameworks only add thin bridges).
3. RTL/visual regression not run — zero style changes in this batch (no CSS, tokens, or i18n touched).
