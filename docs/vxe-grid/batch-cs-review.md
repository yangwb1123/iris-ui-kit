Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-cs-review.md` (the deliverable; no source files modified).

## Summary

**Spec correctness** — Implementation is spec-literal vs `batch-cs-baseline.md`: pixel scrollTop was correctly identified as _not_ the gap; the feature re-locates the content anchor (first visible plan entry + partial offset) in the new plan and writes `newIndex × slotHeight + relativeTop`. I hand-traced the anchor math through all 12 tests (tree expand above/below, collapse above, detail, partial offset, deep-collapse clamp, anchor-removed, handle path, variable/non-virtual/flat fiats) — all consistent. Child-effect-before-parent ordering claim verified against IrisVirtualScroll's re-clamp (VirtualScroll.tsx:278).

**Verification (all on committed state f7d38344):**

- core test 1559/1559, framework-free grep 0
- react test 2594/2594 (12 new), typecheck clean, lint 0 errors (1 pre-existing complexity warning)
- `check:manifest` up to date (propCount 179, events 31, 155×4)
- iris-ui-spec 0 violations (1416 files); prettier clean
- `audit:tokens` exit 1 is **pre-existing** — 5 legacy-token warnings identical on the parent commit; this batch adds zero CSS/token changes

**Checks** — Additive only (1 fail-closed prop, previously-unused `onScroll` wired, type-only `BodyPlanEntry` hoist with byte-identical keys); core/other frameworks untouched; manifest regenerated with correct description extraction (CM-P4 precedent).

**Findings** — 0 MAJOR/MEDIUM; 4 P4 informational notes:

1. Render-phase ref write (Table.tsx:8581) — works today via stable store identity, but silently goes inert if a future controlled `expandedKeys` breaks reference equality; recommend documenting the invariant
2. JSDoc fiat imprecision — a persistState replay differing by exactly one key re-anchors instead of the documented "re-clamp" (benign, but doc is imprecise)
3. Scope note — `groupCollapsed` toggles aren't anchored (in-baseline scope, silently inert)
4. Mechanism note — 1-frame child-window sync via scroll event (same proven batch-AV pattern, benign)
