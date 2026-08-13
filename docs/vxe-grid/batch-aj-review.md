## Verdict: **FAIL**

Review written to `docs/vxe-grid/batch-aj-review.md`. One confirmed high-severity blocker, everything else green.

### Blocker (HIGH): runtime crash on data shrink with open stats panel

Reproduced empirically with two scratch tests (deleted after, tree clean):

- Select range → open 统计 panel → shrink `data` to `[]` → `TypeError: Cannot read properties of undefined (reading 'count')` at `RangeToolbar.tsx:193`
- Select range rows 3..5 of 6 → open panel → shrink to 2 rows → same crash

Root cause: `Table.tsx:3262` emits `stats: stats[key]`, but core `rangeStats` returns `{}` whenever the row span is fully out of bounds after `bodyData` shrinks — the panel then dereferences `undefined`. **Reachability is first-class here**: select a range → open 统计 → type an NL query (batch AI, fires per keystroke) that empties the view → crash. Fix: guard `stats[key]` presence in the memo (or null-guard `entry.stats` in the panel); add a regression test.

### Other findings

- **[LOW]** Hidden columns (`columnVisibility`) appear as stats rows — `Table.tsx:3250` doesn't apply the `visibleColSet` skip the cell render uses (`Table.tsx:3819`)
- **[LOW]** a11y: `aria-expanded` can be true with no panel; `role="table"` panel lacks an accessible name (`RangeToolbar.tsx:160,165-166`)
- **[INFO]** Empty `''` query captured into view snapshots (`Table.tsx:1354`) — harmless, inconsistent with batch-AI's "empty inactive" convention
- **[INFO]** Doc drift: "+8 i18n keys" claimed, code adds 7 (en + zh)
- **[INFO]** Baseline placement divergence (`data-view.ts` planned, `range-stats.ts` implemented) — non-defect

### Verified PASS

- `rangeStats` semantics match `aggregate` exactly (count = non-null; finite-`Number` only; null for empty numeric subset; `{}` for empty range; clamping; getter indirection) — 9 core tests
- Panel: normalized anchor..end enumeration, row/col indexes verified consistent across flat/grouped/tree/virtual/pinned renders, recompute memo, hoisted open state, dismiss, per-column rows with `—` — 7 new tests
- Query in views: gated on `views` (persistState byte-identical), apply query-first with typeof guard, legacy views safe — 3 new tests
- Commands: core **1300** ✓ · react **1891** ✓ · typecheck ✓ · lint 0 errors ✓ · spec audit 0 violations/1409 files ✓ · `check:manifest` up to date (155×4) ✓ · docs-reference ✓ · zh-locale parity ✓ · tokens: no new undefined tokens (warnings pre-existing)
