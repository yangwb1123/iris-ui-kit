Review complete. Verdict written to `docs/vxe-grid/batch-ay-review.md` — **FAIL** (1 blocking finding).

## Summary

**Verification (all green):**

- core test 1424 passed (+7) · react test 2065 passed (+11) · react typecheck clean · lint 0 errors (1 pre-existing complexity warning) · `audit:security` clean · `check:manifest` up to date (155×4) · core framework-free (`mask.ts` zero imports, grep empty) · `audit:tokens` warnings all pre-existing, none from batch AY

**Checklist:**

1. **maskValue** ✅ — email → 11-digit phone (3+4+4) → generic ≥6 → short `'****'` → null `''` (F1); non-string coerced; fail-open; 7 tests incl. boundary
2. **display** ✅ — mask-first at the single `displayValue` choke point (Table.tsx:4880); render/html/link/formatter/raw + tooltip all masked; edit entry points read raw `String(getCellValue(...))` (2181/2729/2872, zero change)
3. **export/copy** ⚠️ — `exportCsv` + both handles + `buildRangeTsv` copy masked by default, `exportRaw` escape works — **but** the range-toolbar CSV export (`exportActiveRangeCsv`, Table.tsx:4151) exports **raw** values while the adjacent 复制 button on the same toolbar masks
4. **additive/manifest/tokens** ✅ — unmasked behavior byte-identical; no CSS tokens; no public API growth

**Findings:**

1. **MEDIUM (blocking)** — Table.tsx:4151/4161: range-toolbar 导出 downloads `table-range.csv` with raw masked-column values (copy masks, export doesn't — same toolbar). Fix: mirror `buildRangeTsv` with `col.exportRaw ? value : applyCellMask(value, col)` + test
2. **LOW** — exportCsv.ts:41+57: non-string `dataIndex` on a masked column → shadow writes at numeric key, serializer drops it, `toCsv` reads `row[key]` raw
3. **INFO** — `exportExcel` raw (F10, baseline pre-flagged out-of-scope; one-line mirror deferred)
4. **INFO** — `iris-ui-spec.py` claim unverifiable (tool absent)

No source files modified during review.
