Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-t-baseline.md` (308 lines). No source files modified — `git status` shows only the new doc.

**Verified against current sources:**

- **Handle object** (`Table.tsx:1980-2046`): all 10 existing methods located; `useTableSort` destructure (`Table.tsx:911-916`) currently omits `setSort`/`setMultiSort` — the only new symbols `clearSort` needs. `setCurrentColumn` helper (`1936-1940`) and the click-path veto guards (`2885-2887`) are the exact patterns `setCurrentRow`/`setCurrentColumn` mirror.
- **`onFiltersChange` already exists** (`props.ts:250`) but is **never fired anywhere** — per spec, `onFilterChange` is skipped and documented as an alias decision (the prop stays, wired when a text-filter UI appears).
- **Expansion is a single shared model** (`expansion.toggle(String(k))` at both `Table.tsx:2964` detail toggle and `3165` tree caret) — one `toggleRowExpand` covers both modes; `onExpandedRowsChange` fires through the model's `onChange` for free.
- **Radio**: body selection cell (`3011-3015`) renders `IrisCheckbox` for both modes; the single-mode header cell is **already empty** in both header paths (flat `4367-4372`, grouped `4219-4240`) — only the body swap is needed, native `input[type=radio]` with `--iris-*` tokens, same attrs/aria/disabled/onChange.
- **Pager** (`4643-4672`): `showTotal` span goes first inside the inner flex div, `t('table.total', { total })` — the `table.total` i18n key does **not exist** in core `i18n.ts` or the zh plugin; both need it (en/zh proposed).
- **vxe parity anchors** confirmed in `/tmp/vxe-ref/es/table/src/table.js` (`setCurrentRow` 6621, `setCurrentColumn` 6747, `clearSort` 6894, `toggleRowExpand` 7133, `scrollToRow` 7684) and `emits.js` (`cell-dblclick`, `toggle-row-expand`, `toggle-tree-expand`, `filter-change`, `radio-change`); `showTotal` is vxe-pager API — the vendored tree ships grid+table only, noted in the doc.
- **`scrollToRow`** uses the existing attribute-locate pattern (`Table.tsx:1674` — getAttribute match on `data-iris-table-row`), works across flat/tree/grouped/virtual rows; virtual-window miss documented as an open question.

File map: `props.ts` (+12 declarations), `Table.tsx` (~+85 lines), `i18n.ts` + zh plugin (+1 key each), new `test/handle-events-radio-total.test.tsx` (~15 tests). 5 open questions listed (form reset interplay, lazy-leaf event, radio size token, virtual scroll limitation, `onHeaderClick` naming deviation).
