Review complete. Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-dw-review.md`.

## Verdict: **FAIL**

**Verification runs (all green)**: core test 1641 ✓ · react test 2870 ✓ · react typecheck ✓ · react lint 0 errors (2 pre-existing complexity warnings) ✓ · `check:manifest` up-to-date (202 props / 33 events, react-only) ✓ · `check:tokens` clean ✓ · `pnpm size` within budget ✓ · scope audit: zero core/style/i18n/other-framework changes ✓.

**Findings**:

1. **MEDIUM — spec-correctness defect (the FAIL trigger)** — `props/layout.ts:150-151` JSDoc claims "snapshot restores and `expandAll` fire no bus event," but the expansion family does emit: `expandAll` seeding calls `expansion.merge(keys)` (Table.tsx:4633) and expandedKeys snapshot/URL restore calls `expansion.set(...)` (Table.tsx:1579), both of which go through `createExpansion`'s unconditional `onChange` (core `expansion.ts:61-66`) → `expanded-rows-change` bus event on mount/restore. **Empirically confirmed** via a black-box jsdom run against a freshly rebuilt dist (scratch in /tmp, cleaned up; repo untouched — dist is gitignored). Also uncovered in the same probe: the previously-built packaged dist was stale (no `onTableEvent` at all) — worth noting for the gate's pack-install phase. Fix: correct the contract text to state the expansion family mirrors the shared `onExpandedRowsChange` channel (expandAll seed + restores DO fire), and pin both paths with tests.
2. **LOW** — the exported closed `IrisTableEvent` union is unused: `emitTableEvent(type: string, detail: unknown)` (Table.tsx:601-604) and the spec-literal prop accept any string, so a typo'd event type compiles silently. All 19 sites are currently correct; type the funnel against the union.
3. **INFO** — batch-record drift: baseline says "13-type palette" (14 implemented); adapt says "402 lines" (424, still ≤500) and "18 sites" (19).

`git status` confirms no repo files were modified (review file is the only write).
