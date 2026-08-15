Review complete. **Verdict: PASS** — verdict written to `docs/vxe-grid/batch-av-review.md`.

## Summary

**Spec checks (all verified against code, not just tests):**

1. **Tab/Shift+Tab** ✅ — `nextRowMajorCell` (Table.tsx:893-903) is row-major with no-wrap clamping at both bounds (fiat F1); `setFocusedCell` drives roving tabindex + synchronous `.focus()`; the `target.dataset.gridRow === undefined` guard (Table.tsx:3572) plus the editor input carrying no `data-grid-row` keeps batch J's `moveEditOnTab`/`moveRowEditOnTab` byte-identical (confirmed via git diff).
2. **Home/End/PageUp/PageDown/Enter** ✅ — Home/End and PageUp/PageDown focus math reuse core `nextGridCell` (roving.ts:143-150, `pageSize: 10` clamped); virtual tables scroll the `data-iris-virtual-scroll` viewport ±10×itemHeight clamped to `[0, max]`, non-virtual scroll the root; focus follow-up via `pendingGridFocusRef` + rAF-poll layout effect; Enter = ArrowDown alias.
3. **Inert/additive/tokens** ✅ — first-line guard + no `data-grid-row` without the flag (tested: no preventDefault); zero new props, core untouched, manifest no diff; diff adds zero `var(--iris-*)` references.

**Verification:** react test **2034 passed**, typecheck clean, lint 0 errors (pre-existing complexity warning), `audit:security` clean (`audit:tokens` failures are all pre-existing cross-framework items, zero batch-AV token refs), spec script 0 violations (1412 files), `check:manifest` up to date.

**Findings (non-blocking):**

1. **LOW** — the claimed docs change is a hand-edit to the _gitignored_ `apps/docs/components.md`; the source of truth `props.ts:360` JSDoc wasn't updated, regeneration reverts it, and `pnpm check:docs-reference` now exits 1 (verified). Fix: move the key map into the props.ts JSDoc.
2. **LOW** — the rAF poll claims "bounded to a few frames" but has no frame cap (Table.tsx:3643-3647); benign in practice, should cap frames.
   3-5. **INFO** — Tab trap is deliberate (fiat F1); row-major math ignores spanMethod occupancy (pre-existing class, same as arrows); no test covers editing-Tab _with_ `keyboardNavigation` on, and the adapt report's 228-line claim vs actual 170.

No source files were modified during review; the working tree is back to its pre-review state (only the runner's doc-log entries remain).
