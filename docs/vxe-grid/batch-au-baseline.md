Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-au-baseline.md` (215 lines). `git status` confirms only the new doc; zero source files touched.

**Key findings (every claim verified against current code):**

- **Single live row-render path** — `renderRow` in `Table.tsx:4453` serves flat/grouped/tree/virtual bodies (`renderBodyEntry :4982`, virtual `renderItem :6789`). Row attrs (`data-iris-table-row`/`-selected`/`-editing`/`-current`) at `:4467–4475`. **`TableRow.tsx`/`TableBody.tsx` are dead code** (only TableBody imports TableRow; nothing else references either) — compare work touches Table.tsx only.
- **Cell render** — `data-iris-table-cell={col.key}` + native `title={editing ? undefined : cellTooltip(row, col)}` at `:4674`; `cellTooltip` closure at `:4381–4392` is the tooltipConfig title path a change tooltip overrides locally. Highlight mechanism is the `--iris-cell-bg` var (cells read it at `:4546/:4605`; CSS sets it on hover/selected/editing at `:168–177`) — the compare styles plug into the same var.
- **rowKey machinery** — `rowKeyOf` at `:2723–2737`; cell-diff keys reuse the batch-Q `::` delimiter. `liveData` (`:1277`) is the single mutation funnel → it is `currentData`.
- **Tokens verified**: `--iris-success-muted` / `--iris-primary-tint` **do not exist**. Picked two distinct families: changed → `--iris-surface-hover`; added → success tint via `color-mix(in srgb, var(--iris-success) 12%, var(--iris-background))`; removed → danger tint (token-only, no magic rgba, degradation documented).

**Design:** (a) core `diffRows(before, after, rowKeyField)` — added/removed/changed keyed by rowKeyField, `Object.is` per column (deliberately ≠ batch-AT `auditDiff`'s `!==`), after's column order, ~10 pure-function tests; (b) `compareWith?: Row[]` after `auditLog` (props.ts:534) → memo `diffRows(liveData, compareWith, rowKey)` + O(1) rowStatus/cellChanges maps, row attrs `data-iris-row-added/-removed/-changed`, cell `data-iris-cell-changed` + title override `旧值: X → 新值: Y`; (c) no toolbar change (documented, gate `:5447` untouched).

**File map:** 2 new core files + 2 react edits (props/Table.tsx + CSS) + 1 new react test + manifest regen (propCount 138→139); zero changes to types/i18n/other frameworks — plus 12 numbered fiats for gate arbitration.
