## Verdict: **PASS** — `docs/vxe-grid/batch-an-review.md`

### Checks

**1. Presets — all pass**

- Factory is framework-neutral: `packages/core/src/column-preset.ts` has zero framework imports; structural `ColumnPresetDescriptor` + generic `C` return gives the react `IrisTableColumn<Row>` call site zero casts (typecheck clean).
- Formatters verified: money `1,234.50` (2 decimals + thousands, sign-safe), progress `42%`, date String-passthrough (no UTC-shift trap).
- Spread precedence: **defined-fields-only** merge — user fields win, `align: undefined` can't kill the default (tested both ways).
- Money editRules present and correct: `pattern` rule (verified against `edit-rules.ts` — a `{type:'number'}` rule would reject every string draft).

**2. Shortcuts — all pass**

- F2 gated: prop on → not-editing (`editTarget.editing`/`rowEditing`) → target is a grid cell (`data-grid-row`) → `focusedCell` exists (only populated under `keyboardNavigation` roving) → `col.editable` checked twice (handler + `beginEdit` re-guard).
- Delete/Backspace → `setCellValue(...,'')` through one `commitRowList` (undo funnel + exactly one `onDataChange`, tested with exact row-list equality).
- Inert without the prop (root handler not even installed) and without `keyboardNavigation` (both tested).

**3. Hygiene — all pass**: additive only (5 source files; zero-preset path reference-preserving) · `check:manifest` up to date (131 props, react only) · core framework-free grep = 0 · no new CSS/hardcoded colors.

**Commands**: core **1330 ✅** · react **1938 ✅** (172 files) · typecheck **clean** · lint **0 errors** (1 pre-existing complexity warning) · `audit:security` **clean** · `check:manifest` **up to date** · spec script **0 violations / 1410 files**.

### Findings (none blocking)

1. **LOW** `Table.tsx:3289` — Delete is a silent no-op for `rowId`-keyed tables (`setCellValue` resolves by `rowKey` field; inline edit has a `viaId` fallback the shortcut lacks).
2. **LOW** `Table.tsx:3290` — `next !== current` never blocks redundant commits on already-empty cells (setCellValue always maps a new array) → spurious undo entry + `onDataChange`.
3. **LOW** `Table.tsx:3281` — F2 in `editConfig.mode='row'` opens an invisible cell session (row-mode render never surfaces cellEdit sessions), leaving shortcuts inert until remount.
   4–6. **INFO** — money pattern rejects typed separators; stale `focusedCell` index after `columnOrder` reorder; uncommitted stage-report entries are expected.

No files modified beyond the review document.
