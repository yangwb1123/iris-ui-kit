Verdict written to `docs/vxe-grid/batch-r-review.md` — **FAIL** (one functional defect, empirically confirmed).

## Summary

**Verification run:** react test 1738/1738 ✓ · typecheck ✓ · lint 0 errors ✓ · build ✓ · audit 0 vulnerabilities ✓ · check:manifest ✓ (155 components, all 5 props extracted) · check:docs-reference ✓ (after one-time local regen — gitignored artifacts) · prettier ✓ · core framework-free ✓ · CSS tokens ✓.

**Check-list results:**

1. **zIndex** ✓ — applied only when set, `position: relative` rides along, before `...style`, caller override tested.
2. **syncResize** ✓ — gates `!autoResize` + no-height; measures on data/loading/error/footerData/size/bordered + visibilitychange; direct measure, no RO crash path.
3. **keepSource** ✓ — mount seed copy, re-feed hand-off, table immutable either way.
4. **rowId** ✓ — rowKey > rowId > idx fallback; selection/edit/tree-flatten key spaces internally consistent (treeKeyMap + lazy-cache landing share one key space).
5. **mergeFooterItems** — colspan/occupied/function-wins/coordinate-space all correct; **rowspan is broken**.
6. **Additive** ✓ — core untouched; manifest regenerated and committed.

**Findings:**

1. **[MEDIUM]** rowspan covered cells render `null` → remaining cells of the covered footer row auto-place into earlier tracks (data under wrong columns). **Confirmed in headless Chrome**: row cells land at tracks 0/1 instead of 1/2. Also reverses batch P's explicit review-fix ("footer rowspan inert") and deviates from baseline decision (e). Fix: track-preserving placeholder cells, or inert rowspan per baseline. `Table.tsx:3262-3300, 3328, 3425, 3484`.
2. **[LOW]** "byte-identical without rowId" claim fails for keyless rows (keys change `undefined` → index; expandAll seed vs flat-index check mismatch). `Table.tsx:1735-1740, 2087`.
3. **[LOW]** paste/fnr write-backs skip keyless rowId rows (`Table.tsx:2322, 2466-2468, 2486`); documented in adapt doc but not prop JSDoc.
4. **[INFO]** adapt doc says 19 tests/155 files — actually 16 tests/156 files.
5. **[INFO]** docs-reference was stale locally (gitignored generated files, pre-dating batch R); passes after regen.

Note: `arch-check:ratchet` is red on pre-existing Select/Tree files — unrelated to batch R.
