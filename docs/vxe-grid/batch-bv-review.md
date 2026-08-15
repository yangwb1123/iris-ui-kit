Review complete. **Verdict: PASS** (2 × LOW findings). Written to `docs/vxe-grid/batch-bv-review.md`.

## Summary

**Verification (all pass):**

- core test **1517/1517** · react test **2320/2320** (+14 new) · react typecheck **clean** · react lint **0 errors** (complexity warning pre-existing, confirmed at BU commit)
- `audit:security` 0 vulnerabilities · `audit:tokens` 2 pre-existing warnings (BV adds zero tokens/styles) · `check:manifest` **passed, regenerated no diff** (IrisTable 161 props / 30 events as documented)
- core framework-free grep empty · **additive-only** (zero source deletions; props.ts / diff-rows.ts / styles.ts / vue·solid·svelte untouched)

**Spec correctness — 8/8** against the baseline: view-order removed/changed + snapshot-order added tail; `__iris_diff` marker + i18n `table.compare.diff` en/zh; `maskedOld → maskedNew` composite (mask-before-composition, `exportRaw` bare, formula columns non-self-composite from pristine data); ref-mirror reuse of the render memo; module-level `buildComparisonCsv` with core `toCsv` RFC-4180/OWASP; two-state empty semantics (`''` vs header-only); handle-only, no UI. All 14 tests byte-level assert the core behaviors.

**Findings (both LOW, empirically verified with throwaway probes):**

1. `Table.tsx:1301` — a **masked rowKey column** breaks the composite lookup (composite pass reads the post-mask key) → all changed rows silently lose their `old → new` composite. Fix: extract raw keys before the mask pass.
2. `Table.tsx:1221/1320` — reserved key `__iris_diff` collides with a user column of the same key (duplicate columns + user data overwritten). Fix: hard-reserve in the public doc, or skip/rename the marker when a column uses that key.

No files modified beyond the review markdown; probe tests removed.
