## Verdict: PASS

Wrote `docs/vxe-grid/batch-t-review.md`. No files modified.

**Verification run (all green):** react 1774/1774 tests · typecheck ✓ · lint 0 errors (1 pre-existing complexity warning) · core 1249/1249 · `check:manifest` up to date (155 components, diff = 5 new props only) · `audit:security` clean · core framework-free (grep 0).

**Checklist outcomes:**

1. **Handle methods** ✓ — `scrollToRow` attribute-located + jsdom-guarded; `toggleRowExpand` shares the single expansion model (tree + detail proven by tests); `clearSort` resets both channels (controlled/uncontrolled + change handlers, verified in `useTableSort`); `clearFilter` fires both controlled channels; `setCurrent*` mirror the click-path veto guards exactly.
2. **Events** ✓ — `onCellDblClick` after edit start (non-editable columns too, params match `IrisTableCellClickParams`); `onHeaderClick` after sort toggle in flat + grouped (test asserts `['sort','header']` order); expand events fire with new state incl. lazy branch; diff is strictly additive, existing handlers untouched.
3. **Radio** ✓ — native radio with `checked`/`onChange`/`aria`/`disabled` + `var(--iris-primary)` accent; multi unchanged (4 checkboxes/0 radios asserted); header single empty in both paths.
4. **Pager total** ✓ — `table.total` i18n (en core + zh plugin), DOM position before the size selector asserted.
5. **Additive/manifest/core/tokens** ✓.

**4 LOW findings (non-blocking):**

- **F1** `Table.tsx:2041` — `scrollToRow` selector is raw-interpolated: keys containing `"` make `querySelector` **throw** (verified in jsdom), contradicting the documented no-op; keys `"header"`/`"loading"`/`"empty"` collide with state rows. Fix: `CSS.escape` or attribute iteration.
- **F2** `Table.tsx:2047` — handle `toggleRowExpand` doesn't fire `onExpandChange`/`onTreeExpandChange` (vxe emits them) and bypasses the `rowExpandable` gate.
- **F3** (info) — radios lack `name` (no native group semantics; clicking the checked radio deselects — pre-existing single-mode semantics).
- **F4** (doc) — adapt doc says 17 tests; file has 20.
