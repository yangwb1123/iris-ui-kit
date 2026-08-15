Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ay-baseline.md` (244 lines). `git status` confirms only the new doc — zero source files touched.

**Key findings (all verified against current code):**

- **Display chain has one shared input** — `const raw = getCellValue(row, col)` (Table.tsx:4866, the batch-AO choke point resolving `dataIndex ?? key` + formula columns) feeds every branch: `render` (5110) / `html` (5112) / `link` (5118) / `formatter` (5142) / raw fallback (5146). The mask needs exactly one new per-cell value.
- **Tooltip duplicates the chain** — `cellTooltip` (4556–4564) defaults to `formatter(raw)` or `String(raw)`; mask must land there too.
- **Editing already reads RAW by construction** — all three edit entry points start from `String(getCellValue(row, col))` (2181/2729/2872); `validate`/`editRules` get the raw draft. Zero code change, document only.
- **Export funnels through one serializer** — `exportCurrentViewCsv` (3030) and `exportSelectionCsv` (3041) both call `exportCsv(withComputedFormulaCells(...))`; core `toCsv` reads `row[dataIndex ?? key]`. Masking inside `exportCsv` covers both handles with zero handle changes; the batch-AO shadow-row pattern is the established convention.
- **Copy has a single TSV builder** — `buildRangeTsv` (3795) serves both Ctrl/Cmd+C (3942) and toolbar 复制 (4141).
- **No manifest / i18n gates** — `mask`/`exportRaw` are column-level (IrisTableColumn), not manifest-tracked; no UI strings this batch.

**Design locked:** (a) core `maskValue(value, 'sensitive')` in new `mask.ts` — precedence email → phone (`/^\d{11}$/` → 3+4+4) → generic ≥6 (first2+`****`+last2) → short `'****'` → non-string `String(value)`; (b) `IrisTableColumn.mask` with mask-first-then-formatter display chain (all display branches see masked; editing/validation raw); (c) masked-by-default export/copy with `exportRaw` escape, applied at `exportCsv` + `buildRangeTsv` choke points. 14 numbered fiats (F1–F14) for gate arbitration, including two flagged decisions: null → `''` parity (F1) and `exportExcel` one-line mirror (F10).
