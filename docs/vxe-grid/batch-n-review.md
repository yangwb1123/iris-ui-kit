Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-n-review.md`.

## Summary

**Verification run:** react typecheck ✅ clean · 1673 tests/152 files ✅ (14 new) · lint ✅ 0 errors (1 pre-existing complexity warning) · arch-check/audit-tokens ⚠️ violations all pre-existing at HEAD, none from batch N · core framework-free grep ✅.

**Checklist:**

1. **height** ✅ — `fixedHeight` from any of height/min/max; root becomes `overflow:auto` scroller with sticky header (`z-index:2` > pinned cells' 1); sticky rule matches **both** flat (`Table.tsx:3154`) and grouped (`:2967`) headers; column-virtualization keeps the root as single scroller so `onScroll→scrollLeft` sync is untouched.
2. **headerAlign/footerAlign** ✅ — `prop > col.align > default` in flat header, grouped leaves (group cells keep center default), summary, footerMethod, and footerData cells; number→right default preserved.
3. **footerMethod** ✅ — summary path gated `!footerMethod` (no double render, tested), multi-row map with index marker, footerData renders below (order tested), empty return/empty data renders nothing.
4. **highlightHoverRow** ✅ — default true (attr absent), false adds `data-iris-no-hover` gating the hover rule via `:not()`; no stylesheet re-injection needed.
5. **Additive/manifest/core/tokens** ✅ — core untouched, both new types exported from the barrel, no manifest hand-edit, token-only CSS, RTL-safe.

**Findings (non-blocking):** 1 MINOR — footerMethod rows copy the pre-existing summary-row gap of omitting `__drag`/`__seq`/`__expand` leading cells, so footers misalign with body columns when `seq`/`hasDetail`/`rowDrag` are enabled (fix: placeholder cells or explicit `gridColumnStart`); 4 INFO — formatter not applied to footer-method cell text (documented, matches footerData), adapt doc says 13 tests but there are 14, complexity warning grew 131→143 (warning only), and minor test-coverage gaps (empty-array return, fixedHeight×columnVirtualization combo) acceptable under jsdom.
