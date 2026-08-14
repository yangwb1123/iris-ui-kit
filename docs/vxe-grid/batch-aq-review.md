## Verdict: **FAIL** — 1 functional defect (Medium)

Wrote the full verdict to `docs/vxe-grid/batch-aq-review.md`. All source files are untouched; the temporary repro test was removed (tree shows only doc artifacts).

### What I verified

**Gates (all run):** react `test` ✅ 1978 passed / `typecheck` ✅ / `lint` ✅ 0 errors (1 pre-existing complexity warning) / `audit:security` ✅ no vulns / `check:manifest` ✅ up-to-date, `rangeFill` native-extracted react-only.

**Checklist:** handle gating (`rangeFill && activeRange`, end-cell placement, `var(--iris-primary)`) ✅ · L-shape target highlight ✅ · cyclic modulo fill correct (A/B/A tests) ✅ · down/right-only `max` clamp ✅ · exactly ONE `commitRowList` ✅ · range extends via `extendRange` ✅ · pointercancel cleans up ✅ · additive-only (core untouched, default off) ✅ · manifest hygiene ✅ · CSS tokens ✅ (`iris.surface.selected` defined at tokens.ts:27; fallback matches pre-existing fnr pattern).

### Finding 1 — [Medium] Stale `suppressRangeDismissRef` breaks Escape-clear after a fill drag

`Table.tsx:3845-3863` — the flag is set on handle `pointerdown` and only re-synced on the _next_ `pointerdown` (never on `pointerup`/`pointercancel`). After a drag, `RangeToolbar`'s `useDismiss` document Escape handler is suppressed. With default config (no `keyboardNavigation`, focus on body), the table-root Escape path doesn't fire either → the range + toolbar survive Escape.

**Reproduced** with a temp vitest test (removed after): control (no drag) → Escape clears ✅; after `dragFillTo(2,0)` → Escape leaves the range selected ❌.

**Fix:** reset the ref in `handleRangeFillPointerUp` and `onPointerCancel`; add an Escape-after-drag test.

### Finding 2 — [Low/Info] `RANGE_FILL_TARGET_BG` hardcoded rgba fallback

Consistent with existing fnr usages (Table.tsx:773, 4326); token exists, so the fallback is dead in themed contexts. No fix required.

### Finding 3 — [Info] AGENTS.md says 154 components, manifest has 155

Pre-existing (verified at `c77a9048^`); AQ added only a prop (133→134), no component. Not a regression.
