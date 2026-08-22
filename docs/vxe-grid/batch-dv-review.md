## Verdict: **FAIL** ❌

Verdict written to `docs/vxe-grid/batch-dv-review.md`. No implementation files touched (diagnostic probe deleted; `packages/react/src/primitives/table/` byte-identical to HEAD).

### Verification results — all gates green

- core test: 106 files / **1641** ✓ · react typecheck ✓ · react test: 249 files / **2855** (incl. batch-dv 13/13 + SSR 5/5) ✓ · react lint: 0 errors ✓ · `pnpm audit:security`: 0 vulnerabilities ✓ · `check:manifest`: byte-identical ✓ · `iris-ui-spec.py --mode all`: 0 violations / 1545 files ✓ · additive-only confirmed (diff touches only react table files + manifest + tests) · core untouched, no CSS changes.

### Why FAIL (findings)

**#1 medium — `Table.tsx:1763-1777`**: a fully-uncontrolled table (`urlState` on, zero owning callbacks) **destroys a seeded `_table` deep link at mount**. All pieces gate out → payload serializes to `null` → `writeUrlTableState(null)` deletes the param (empirically confirmed: `?_table=…&keep=1` → `?keep=1` before first post-mount render). This contradicts the code's own invariant at `Table.tsx:1697-1698` and the commit message ("uncontrolled pieces are inert in both directions — the URL never claims a channel the table cannot replay"), and diverges from the persistState precedent's explicit no-clobber guard (`usePersistState.ts:177-179`: "Nothing the parent owns → nothing to write"). Fix: skip the write entirely when no owning channel exists; keep "empties remove `_table`" only for tables that own channels but are currently inactive.

**#2 low — `batch-dv.test.tsx:353-362`**: the "uncontrolled inert in BOTH directions" test is **vacuous** — `before` is captured after `render()`, by which time mount has already stripped the param, so `before === after` passes trivially; the comment at :359 ("The URL keeps the seeded payload untouched") states the opposite of observed behavior. Fix: capture `before` pre-render or assert the seed survives.

**#3–#5 info**: URLSearchParams codec vs baseline's literal `encodeURIComponent` (wire-equivalent, documented); popstate-to-clean-URL re-injection on next render (transient back-button semantics, baseline's known observation); StrictMode double-restore (matches persistState precedent).

**Recommendation**: #1+#2 are one defect hidden by a weak test; the fix is small and localized. Re-review after fix — everything else is green.
