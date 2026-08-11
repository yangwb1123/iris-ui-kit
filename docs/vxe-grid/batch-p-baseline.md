Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-p-baseline.md` (88 lines, 17.9KB). No source files modified — `git status` shows only the new doc.

**Notes on verification:**

- `/tmp/vxe-ref` was missing (prior sessions' download); re-downloaded `vxe-table@4.20.11` from npm and extracted to `/tmp/vxe-ref` to verify every parity claim against the real `props.js`/`table.js`/`footer.js` source (quoted line numbers included).
- All seven props exist in vxe (`mergeHeaderCells: Array` `:138`, `footerSpanMethod` `:147`, `round` "是否圆角边框" `:38`, deprecated boolean `padding` `:33`, `aggregateAccuracyConfig` `:215`, `headerTooltipConfig`/`footerTooltipConfig` `:249/:251`).

**Design decisions (as specified, kept SIMPLE where asked):**

- **a)** `mergeHeaderCells` — flat header only, `row` always 0; leaf-index coordinate space (matching `spanMethod`), same occupy-skip technique keyed `(row, col)` (future-proof for grouped); `rowspan` ignored (vxe parity: `showCustomHeader=false` rejects header rowspan); grouped headers and `columnVirtualization` fail-closed/inert, documented.
- **b)** `footerSpanMethod` — applies to the primary footer block (summary row **or** footerMethod rows, whichever renders); `rowIndex` 0-based over that block; own occupy ref (body/footer key collision avoided); footerData rows span-free (flagged as an open question since vxe's footer-data IS its footer).
- **c)** `round` → `border-radius: var(--iris-radius-lg, 10px)` only when `bordered && round`; `padding` → `--iris-cell-pad` var on root, `baseCellStyle` (`Table.tsx:2345`, not `styles.ts`) reads `var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)` — strict superset, byte-identical fallback.
- **d)** `aggregateAccuracy` — single rounding point in `renderSummaryRow` (`Number(x.toFixed(n))`), applies to global + per-group summaries, before `renderSummary` (custom renderers see the rounded value).
- **e)** `headerTooltipConfig`/`footerTooltipConfig` — native `title` on flat+grouped header cells and summary/footerMethod/footerData cells; empty content drops the title (batch-G `cellTooltip` pattern).

File map: `types.ts` +4 types, `props.ts` +7 props, `Table.tsx` ~+90 lines, new `test/merge-header-footer-round.test.tsx`; core/i18n/styles.ts untouched. Test plan H1-H9/F1-F8/R1-R3/P1-P3/A1-A5/T1-T5 plus 7 open questions.
