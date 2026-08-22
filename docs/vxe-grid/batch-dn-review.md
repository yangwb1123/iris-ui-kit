**Verdict: PASS** — written to `docs/vxe-grid/batch-dn-review.md`.

## Summary

Verified the verification-style batch: feature (`headerStats`) was pre-shipped at `61ec5418`; DN commit `8258df80` adds only 1 regression test + docs.

**All checks green:**

- core test 104/1597 ✓ · react test 246/2816 ✓ · react typecheck ✓ · lint 0 errors (2 pre-existing complexity warnings, untouched) · `check:manifest` up to date · audit:tokens clean · audit:security clean · arch-check no blockers
- core framework-free grep clean; zero core/vue/solid/svelte/i18n changes

**Spec conformance verified at source:**

- Prop `headerStats?: boolean` (`advanced.ts:201`, default `false` at `Table.tsx:287`) — fail-closed, zero DOM when off
- `headerStatsByKey` memo (`:3953-3967`) over current body via `getCellValue` choke point, finite-number-only, zero-finite columns skipped
- Flat (`:8670`) + grouped leaf (`:8431`) render with `isLeaf` guard; `n=N · avg=X.XX`, `aria-label`, `data-iris-header-stats`
- Muted 12px token styling (`--iris-muted`/`--iris-font-size-xs`/`--iris-space-xxs`), logical property, no hardcoded hex
- Distinct from footer `columnTotals` (separate opt-in, `:7935`)
- New grouped-header test closes the baseline's flagged gap; selectors valid

**Findings (all Info/non-blocking):** (1) `bodyData = flatTree.map(...)` new array per render in tree mode → memo recompute per render, same as pre-existing `columnTotalsValues` pattern; (2) grouped-test group-cell assertion structurally trivially true (grid siblings) but meaningful invariants still covered; (3) pre-existing lint complexity warnings unrelated to DN.
