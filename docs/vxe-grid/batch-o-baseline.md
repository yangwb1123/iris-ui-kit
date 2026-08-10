Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-o-baseline.md` (107 lines). No source files modified — `git status` shows only the new doc.

**Verified against current sources:**

- **Key path**: root div `Table.tsx:2907`, `onKeyDown` at `:2920-2927` (attached for `keyboardNavigation || cellRange`) — both feature sets plug in here; editor inputs guarded via `dataset.irisTableEditor` (same pattern as `handleGridKey`'s `dataset.gridRow` guard).
- **Range machinery**: `cellRangeCtrl` (`:1880-1886`) exposes synchronous `getRange()` → normalized rectangle (core `cell-range.ts`), ideal for copy; cells carry `data-iris-cell-row/col`.
- **Write-back**: `commitRowList` (`:1533-1537`) = `setLiveData` + `externalDataRef` + `onDataChange` — the row-op channel; chosen for paste/replace (batch write, no per-cell `onCellEdit`; documented).
- **`toCsv`** can't be used as-is (header + comma quoting) — design adds a sibling `toTsv` in `table-export.ts` (no header, `\t`/`\n`, same neutralize logic) called with synthetic rows from the range.
- **Clipboard precedent**: core `clipboard.ts` `copyText` indirection exists (IrisCopyButton) — copy routes through it before `navigator.clipboard.writeText`, then execCommand textarea.
- **i18n trap**: `plugin-locale-zh` has a guard test requiring _every_ `defaultMessages` key translated — the 5 `fnr.*` keys must land in both `core/src/i18n.ts` and `plugin-locale-zh/src/core/index.ts`.
- **Layout**: JSX order is form → toolbar (`:2696-2890`) → root; fnr bar docks between toolbar and root (sibling of the scroll container, so fixed-height sticky header is untouched).

Design covers both features (clipConfig copy TSV/paste into range with overflow ignored; fnrConfig Ctrl+F bar with match/active highlighting via `--iris-*` tokens, scrollIntoView, replace-one/all through the write-back channel), file map, C1-C6 + F1-F8 test plan (jsdom clipboard/scrollIntoView stubs), and 7 open questions (paste into non-editable columns, onCellEdit granularity, overflow growth deferred, virtualization caveats, TSV formula neutralization, Esc conflict test).
