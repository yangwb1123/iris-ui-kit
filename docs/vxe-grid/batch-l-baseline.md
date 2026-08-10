Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-l-baseline.md` (12KB). No source files modified — `git status` shows only the new doc.

## What the baseline contains

**Code evidence (verified against current sources):**

- **Seq column** — `seq` prop (`Table.tsx:490`), `seqStartIndex`/`seqMethod` (`:446-447`); the seq cell at `:2087-2100` renders `seqMethod ? seqMethod({rowIndex: idx, columnIndex: 0}) : idx + seqStartIndex` with `data-iris-table-cell="__seq"`. `idx` is the absolute page-row index in BOTH render paths (plain map `:3040` and virtual scroll `:3035`, where `VirtualScroll.tsx:322/341` passes absolute `items[i]`), so a page-based formula works under virtualization.
- **Proxy state** — `proxyState.params` (`core/remote-table.ts:36-43`) already carries 1-based `page` + `pageSize` in the adapter's render scope; `setParams({page})` re-renders automatically.
- **Toolbar** — block at `:2466-2612`: refresh (`:2489`) → import (`:2511-2537`, hidden file input + ⇪ ghost button) → column settings (`:2538`) → custom buttons (`:2597`); shared ghost style + i18n `aria-label`/`title`.
- **Body chain** — `:2393-2408`: `editing ? editor : render ? : html ? : formatter ? : raw`.
- **i18n** — `table.import` etc. in `packages/core/src/i18n.ts:109-111`; missing keys resolve to the literal key (`:292-294`), so `table.export` must be added there (single core touch, batch J precedent).

**Proposed design (react-only, additive):**

- **a) `IrisTableProxyConfig.seq?: boolean`** — when true AND table `seq`, the seq cell renders `(page-1) * pageSize + idx + 1` (from `proxyState.params`); precedence `seqMethod > proxy-cumulative > idx + seqStartIndex`; cumulative ignores `seqStartIndex` (documented).
- **b) `toolbar.onExport?: () => void`** — export button `data-iris-table-toolbar-export` inserted between import and column settings, symmetric ghost style, ⇩ glyph, `t('table.export')`; callers wire it to the existing `exportCsv`/`exportExcel` helpers.
- **c) `IrisTableColumn.link?: (value, row) => { href; label?; target? } | string | null`** — branch inserted between `html` and `formatter`, **precedence `render > html > link > formatter > raw`** (link wraps the formatted text, reusing the `cellTooltip` non-string fallback); `null` falls through; `target` implies `rel="noopener noreferrer"`; anchor `stopPropagation` keeps `onRowClick`/click-edit out, double-click editing still works.

**File map**: `props.ts` +8, `types.ts` +6, `Table.tsx` +30, core i18n +1, 3 test files extended (~155). **Test plan**: A1-A6 (proxy seq incl. page-2 re-render + regressions), B1-B4 (export button), C1-C10 (link precedence, per-row opt-out, stopPropagation, virtual scroll). **5 open questions** — seqMethod×proxy-seq precedence, glyph vs text, tooltip on link cells, non-string formatter label, `rel` hardening.
