Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-m-review.md`. No source files modified (only the review doc added).

## Summary

**Verification:** react suite 1656/1656 (12 new tests) · tsc clean · eslint 0 errors · `gen:manifest` byte-identical · core untouched (framework-free) · all styles `var(--iris-*)`.

**Requirement checks — all pass:**

1. **Groups** — `groupPlan` over post-sort/filter `bodyData` via core `groupRows` (first-appearance order, empty groups impossible); per-group summaries share the footer's `aggregate` ops (250/200 vs global 450 verified); tree fail-closed; rows keep original indices so selection/seq/striped/span are untouched; both plain + virtual paths covered
2. **Batch** — `selectable === 'multi' && selection > 0` only, after built-ins before custom buttons, `[...displaySelection]` keys, hides when empty, single-select tested
3. **Auto width** — `minmax(max-content, max-content)` branch before generic string; pinned/virtual 140px fallback unchanged
4. **Additive** — only extraction of `renderBodyEntry`/`renderSummaryRow` (byte-identical JSX); manifest hygiene clean

**Findings:**

1. **MEDIUM** — `Table.tsx:3302`: group summary rows lack a `key` in `groupPlan.map` → React "unique key" warnings on every grouped render with a summary column (reproduced in test output + confirmed by probe: 0 warnings without summary, ≥1 with). One-line fix: wrap in keyed Fragment.
2. **LOW** — no tests for sort-before-group, proxy-mode grouping, hidden `groupBy` column
3. **LOW** — `String(value)` turns null/undefined into `"null"`/`"undefined"` group labels (documented limitation)
4. **INFO** — adapt doc's "all gates pass" overstates: `arch-check`/`audit:tokens` exit 1, but every violation is pre-existing at HEAD (Table.tsx already 3287 > 1255 baseline; `--iris-cell-pad-y`/`--iris-shadow-none` from batch L) — nothing introduced by M
5. **INFO** — Table.tsx now 3448 lines (pre-existing ratchet trend)
