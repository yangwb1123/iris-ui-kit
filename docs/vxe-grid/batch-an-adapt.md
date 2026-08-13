Done. Batch AN implemented, verified, and committed (`aeed28c8`, working tree clean).

## Report

**Commit:** `aeed28c8` — `feat(table): batch AN column presets + table shortcuts`

**Files changed (5 source + 2 test + 2 docs + 2 generated):**

- `packages/core/src/column-preset.ts` **(new)** — framework-neutral preset factory + pure helpers
- `packages/core/src/index.ts` — barrel export
- `packages/react/.../table/types.ts` — `IrisTableColumn.preset?: ColumnPreset` (single line)
- `packages/react/.../table/props.ts` — `tableShortcuts?: boolean` (single line — manifest hygiene)
- `packages/react/.../table/Table.tsx` — `presetColumns` memo (recursive over `children`, reference-preserving) feeding `orderedColumns`; `handleTableShortcutKey`; root `onKeyDown` gate extended
- `packages/react/.../table/Table.shortcuts.test.tsx` **(new, 247 lines)** + `packages/core/src/column-preset.test.ts` **(new, 138 lines)**
- `docs/vxe-grid-comparison.md` (iris 独有 +2 rows + usage snippet + 构建状态 + batch row), `batch-an-adapt.md` + `DECISIONS.md`
- `packages/manifest/{manifest.json,llms.txt}` — regenerated via `pnpm gen:manifest` (IrisTable 130→131 props)

**Design decisions (framework-neutral approach, documented):**

- `applyColumnPreset<C extends ColumnPresetDescriptor>(column, preset): C` — structural typing like `ColumnAccessor`; generic returns `C` so react `IrisTableColumn<Row>` needs **zero casts**. `formatter` is `unknown` in the descriptor because strictFunctionTypes makes fixed-arity function types incompatible with adapter formatters of different arity (react's `(value, row) => ReactNode`).
- **Defined-fields-only merge** — preset fills only `undefined` fields; `align: undefined` can't kill the default; user fields always win.
- Presets: `money` (2-decimals + thousands separators, right, number editor, numeric-string pattern editRules — a `{type:'number'}` rule would reject every commit since drafts reach validation as raw strings), `progress` (0..1 → `${Math.round(v*100)}%` else raw+`%`, right), `date` (String passthrough, left — locale formatting is the caller's job), `status` (UPPERCASE text, center).
- Shortcuts: F2 → `beginEdit` (gated `col.editable`); Delete/Backspace → `setCellValue(rowKey, col.key, '')` through **one `commitRowList`** (undo-covered; `onCellEdit` not fired — paste parity). Requires `keyboardNavigation`'s focused-cell state — without it the shortcuts are inert (documented). Inert while editing (cell-mode `editTarget.editing` + row-mode `rowEditing` gates); event target must be a grid cell so header focus never triggers on a stale cell.

**Counts:** core **1330 passed** (+13) · react **1938 passed** (+13, 172 files) · react typecheck clean · lint **0 errors** (1 pre-existing `IrisTable` complexity warning 209→211) · spec script **0 violations** (1410 files) · prettier clean · core framework-free grep 0.

**What's left:** vue/solid/svelte wiring for `preset`/`tableShortcuts` (core material ready, one prop + bridge per adapter); full-repo turbo gate per the workflow's review/gate stages; first npm release remains maintainer-authorized.
