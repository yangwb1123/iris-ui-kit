Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-dh-review.md`.

## Summary

I reviewed batch DH (`pattern`, iris 独有 cell-pattern-fill) at commit `2da7b046` and ran all requested verification:

- **Core framework-free**: 0 framework imports in core ✅
- **Core tests**: 102 files / 1584 passed ✅
- **React tests**: 241 files / 2744 passed (incl. all 12 new `pattern-fill` tests) ✅
- **React typecheck**: clean ✅
- **React lint**: 0 errors (2 pre-existing complexity warnings, unchanged) ✅
- **Audit**: no known vulnerabilities ✅
- **check:manifest**: regenerated manifest in sync (React IrisTable 189 props / 32 events, +1) ✅

**Spec correctness**: `pattern?: boolean` (default off, fail-closed); same-column RAW-value matching (`String(raw) === String(draft)`, same caliber as `beginEdit`); editing cell exempt; empty draft fail-closed; realtime per keystroke via the existing `cellEdit.store` + component `useStore` subscription (zero new state); commit clears hints; row-edit mode correctly does not participate (per-column sessions never touch the shared store) — all backed by the 12 tests. Additive only: no changes to types/core/styles/i18n/other frameworks; longhand `background-image` spread follows BE ordering (after conditional styles, before `lockedRender.style`).

**Findings** (both non-blocking):

1. **Low — token hygiene**: new `--iris-input-hint` token exists only inline in the React adapter (not in the framework-agnostic theme model), adding to the `check:tokens` single-framework-only audit (which exits 1). This is a documented fiat and the gate was already red pre-DH from other React-only tokens, so it's pre-existing debt mildly extended — suggest registering the token or adding it to the exceptions list.
2. **Info**: hardcoded rgba fallback inside the `var()` slot — acceptable per convention, could reference a semantic token default.

Implementation left untouched, per instructions.
