Review complete. Verdict: **PASS** (1 medium finding recommended for fix before merge).

## Summary

**Verification (all green):**

- core test: 1641/1641 ✓ · react test: 2945/2945 (incl. batch-ea 17/17) ✓ · typecheck ✓ · lint 0 errors ✓
- `audit:tokens` clean ✓ · `iris-ui-spec --mode all`: 0 violations/1546 files ✓ · `check:manifest` up to date (react IrisTable 204→205 props) ✓ · prettier clean ✓

**Spec conformance confirmed:** dual-scroller resolution (virtual viewport wins, fixed-height root fallback), sticky zero-height endcap anchor (z3 > header z2 / pinned z1, < panels z1000+), threshold-flip boolean state, `scrollTo({top:0,behavior})` + `scrollTop=0` fallback, reduced-motion → `'auto'`, presence-gated + printable-suppressed, reuses existing `backTop.label` i18n (zero messages changes), pure additive (`+112/−0` in Table.tsx, zero core/stylesheet changes).

**Findings:**

1. **[MEDIUM]** `Table.tsx:7653-7661` — the virtual viewport only renders when data is present (`Table.tsx:9636-9644`), and the effect resolves the scroller once with deps `[scrollToTop, Boolean(virtualScroll), fixedHeight]`. In the canonical async flow (empty/loading → data arrives for a virtual table), the listener stays stranded on the non-scrolling root and the button never appears (scroll events don't bubble). Fix: event-time scroller resolution + attach to both, or extend deps. Fail-closed, no regression.
2. **[LOW]** baseline's 19-case plan delivered 17 — zoom and dedicated SSR tests missing (SSR is safe by construction).
3. **[INFO]** adapt doc reports "+112/−3" but numstat is +112/−0 (the −3 lives in manifest regeneration).

Verdict written to `docs/vxe-grid/batch-ea-review.md`.
