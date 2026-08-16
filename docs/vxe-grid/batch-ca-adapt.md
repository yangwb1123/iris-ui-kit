Done. Batch CA (单元格链接自动检测) is complete.

## Files changed (single commit)

**`feat(table): grid 批 CA——单元格链接自动检测（iris 独有）`**

- `packages/core/src/auto-link.ts` (NEW) — framework-free `detectAutoLink(text): string | null` (never throws): URL `/^https?:\/\/\S+$/i` (http/https only, case-insensitive) + email byte-identical to `mask.ts` `EMAIL_RE`; whole-text anchored (embedded URLs not matched, trailing punctuation is part of the link — fiat)
- `packages/core/src/index.ts` — barrel export `detectAutoLink`
- `packages/core/src/auto-link.test.ts` (NEW) — **8 tests, 91 lines**
- `packages/react/src/primitives/table/props.ts` — `autoLink?: boolean` (after `compareWith`, scanner-convention JSDoc)
- `packages/react/src/primitives/table/Table.tsx` — 3 touch points: core import `detectAutoLink`, destructure `autoLink = false`, module helper `renderAutoLinkCell` (next to `contextCellText`, same mask → formatter ?? raw display chain, `typeof string` gate, returns the plain text/ReactNode byte-identically when unmatched), render branch inserted AFTER `col.link` / BEFORE `col.formatter` (link column wins; detection fall-through byte-同形)
- `packages/react/src/primitives/table/auto-link.test.tsx` (NEW) — **7 tests, 122 lines**
- `packages/manifest/manifest.json` + `llms.txt` — regenerated via `gen:manifest` (165→**166** props, 31 events unchanged, `autoLink` captured with doc)
- `docs/vxe-grid-comparison.md` — persistState row + build-status append（对照「comparison doc 2 处」基线）

Zero changes: `types.ts` / `styles.ts` / i18n / vue / solid / svelte / `usePersistState` et al.

## Tests added (15)

Core 8 — https URL · http URL with tail · scheme case-insensitivity · email (mask-parity pattern) · plain text null · embedded URL null (whole-text anchor) · empty string null · non-http scheme / bare host null.

React 7 — URL cell → `<a data-iris-auto-link>` href/_blank/noreferrer · email cell → anchor · non-matching text stays plain (no anchor) · explicit `col.link` wins over `autoLink` (`data-iris-table-link`, no auto-link) · formatter output is the detection target (formatted string → anchor href) · no prop → zero anchors (lazy) · anchor click stops propagation (onCellClick not fired).

## Verification (all ✅)

- core test **1525/1525** (1517→1525) · react typecheck **clean** · react test **2392/2392** (2385→2392) · react lint **0 errors** (1 pre-existing complexity warning 279→280, verified pre-existing via stash)
- `iris-ui-spec.py --mode all` → **0 violations** (1415 files) · `gen:manifest` regenerated (propCount 165→166, eventCount 31 unchanged; manifest package tests 69/69)
- Constraints: core framework-free (zero framework imports) · react-only bridge · additive (default off, no prop lazy) · test files 91/122 lines (≤500) · ≤4 changed files + tests · CSS untouched (no styles needed, anchor uses default link styling — styles.ts zero-change per baseline)

## What is left

- Runner's review/gate stage
- vue/solid/svelte alignment deferred (react-only scope, per baseline); the open questions O1 (table-level vs column-level prop) / O2 (strict display chain) were resolved per baseline fiats: table-level `autoLink?: boolean`, mask → formatter detection chain
