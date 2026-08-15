Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-bn-review.md`: **PASS**.

## Review summary

**Verification run (all green):**

- core test 1517/1517 · react test 2232/2232 (+13 new) · react typecheck clean · react lint 0 errors (1 pre-existing complexity warn — verified pre-batch = 261, now 264, both over the 70 threshold) · audit 0 vulns · `check:manifest` up-to-date, 155×4 components, react Table 155 props

**Spec correctness — verified against baseline fiats:**

- `props.ts:413` `rowHeight?: number | ((index: number) => number)` after `virtualScroll`, before `persistState`, single-line fn type (manifest-scanner safe)
- Single throat `effectiveRowHeight = rowHeight ?? virtualScroll?.itemHeight` (`Table.tsx:1756`) feeds all three consumers: virtual slot height (:8243, number → closed-form fixed window, fn → core Fenwick offset tree via `estimateSize`, zero core changes), non-virtual inline height via module-level `rowHeightStyleOf` (:6375, detail wraps/group headers keep content height), PageUp/PageDown (:4636, same resolved source, `Math.max(1,…)` + clamp semantics preserved)
- `rowStyle` merges after `extraStyle` → escape hatch wins; unset = byte-identical (tests assert `style.height === ''` and itemHeight fallback); rowHeight-wins precedence and plan-index trap both test-locked
- propCount 154→155, docs 3 sites +13 tests synced

**Additive only / core framework-free / CSS tokens:** commit touches only props.ts, Table.tsx, new test, regenerated manifest, docs; zero core/styles/i18n/other-framework diffs; no new tokens or hardcoded colors.

**Findings (3, all non-blocking):** redundant `?? virtualScroll.itemHeight` at Table.tsx:4636 (nit); fn-form virtual group-header/summary slots also consume the fn at plan indices — documented via fiat but worth one doc sentence clarifying the data-row-only scope applies to the non-virtual path; complexity 261→264 pre-existing warning drift.
