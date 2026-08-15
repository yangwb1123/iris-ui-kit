Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-az-baseline.md` (62 lines, ~13KB). Only the new doc appears in `git status` — zero source files touched.

**Key verified findings:**

1. **Key format is free** — `cellId` (Table.tsx:1988) is exactly `` `${rowIdent}::${colKey}` ``; `dirtyKey` (Table.tsx:307) already uses the same collision-safe `::` delimiter. The static lookup is literally `annotations[cellId(k, col.key)]`, and `k = rowKeyOf(row, idx)` (Table.tsx:4693) always resolves (falls back to `idx`), so keys are well-formed.

2. **baseCellStyle has no `position`** (Table.tsx:4558–4565) — the badge needs `position: relative` on the cell, matching the dirty-dot `posStyle` pattern (`dirtyCellState` → `{ position: 'relative' }` spread right after baseCellStyle).

3. **One body-cell render site** — `renderRow` (Table.tsx:4687) serves both the flat map (7067) and virtual path (7044); footer cells (5375+) are separate, so annotations are body-only with no footer change.

4. **Title chain** (Table.tsx:4622): `editing → compare → cellTooltip`. The note slots in as the first non-editing branch — wins over `tooltipConfig`/`cellTooltip` (mandated); note-vs-compare proposed as note-wins, flagged F4.

5. **`--iris-warning` IS in the tokens** (#f59e0b light / #fbbf24 dark, iris-tokens.css:16/109) → use `var(--iris-warning, var(--iris-primary))`, the codebase's existing token-with-fallback pattern.

6. **Mechanism correction (F5)** — the dirty dot already owns the cell's single `::after` (`[data-iris-cell-dirty]::after`, styles.ts:151); a second `::after` rule would cascade-override it and the dirty dot would vanish on noted cells. Locked: real `<span data-iris-cell-note aria-hidden="true">` + `CELL_NOTE_STYLE` const in styles.ts (the `renderRangeFillHandle` precedent) — zero nodes when no note exists.

7. **Manifest gate: 141 → 143** — both props are TABLE-level (`mask`/`exportRaw` were column-level, which is why AY didn't bump it); `gen:manifest`/`check:manifest` + docs-reference regen required. No new types in types.ts.

Design locked per spec (a/b/c), file map, 7-test plan, and 13 fiats (F1–F13) included for gate arbitration.
