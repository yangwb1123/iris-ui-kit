**Verdict: PASS** — written to `docs/vxe-grid/batch-l-review.md`.

## Summary

**Verification run:**

- React full suite **1644/1644** (150 files, +15 new) · core **1249/1249** · zh-locale 6/6
- `tsc --noEmit` clean · eslint 0 errors (1 warn-only `IrisTable` complexity 124 — pre-existing category, 92→112→113→124 across batches C–L, accepted since batch C)
- Core framework-free grep clean · diff is +60/−1 additive only, no banned patterns · manifest regeneration byte-identical (scanner only extracts top-level `Iris*Props` members; all three new props are nested in interfaces the scanner ignores)

**Requirement checks (all ✅):**

1. **Proxy seq** — `Table.tsx:2099` precedence `seqMethod > (page−1)*pageSize+idx+1 > idx+seqStartIndex`; `idx` is in-page 0-based in both plain and virtual render paths (shared `renderRow`); non-proxy `seqStartIndex` untouched; `seq` off → page-local (all 4 tests pass, incl. page-2 → 6..10 re-render)
2. **Export button** — `Table.tsx:2566` renders after import, ⇩ ghost style, `data-iris-table-toolbar-export`, fires `onExport`, i18n `table.export` ('Export'/'导出') resolved via rebuilt core dist
3. **Link** — `Table.tsx:2405` chain `render > html > link > formatter > raw`; null/undefined fall-through; label fallback to formatted/raw; `_blank`→`rel=noreferrer`; `stopPropagation` keeps row-click/click-edit out while dblclick editing works; tooltip/editing untouched (9 tests)

**Findings (2 LOW, no blockers):**

1. **LOW** — `rel` applied only for `_blank` (`Table.tsx:2421`) vs baseline's "any target → noopener noreferrer"; documented deviation, security-relevant case covered (`noreferrer` implies `noopener`)
2. **LOW** — `link` type (`types.ts:139`) omits `undefined` though runtime and tests treat it as fall-through
3. **INFO** — manifest correctly left unregenerated (regeneration is a no-op for nested props)
4. **INFO** — jsdom navigation noise when tests click real-href anchors (harmless)

No source files were modified; only the review doc was written.
