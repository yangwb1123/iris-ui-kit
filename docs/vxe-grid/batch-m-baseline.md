Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-m-baseline.md` (17KB). No source files modified — `git status` shows only the new doc.

## What I verified against current sources

- **Data pipeline** — `bodyData` (`Table.tsx:1710`) = flatTree rows or `filteredData` (sort → filter → group is the natural order); selection/summary/seq all read `bodyData` indices, so grouping must be render-time composition only.
- **Row composition** — live path is `renderRow` (`:2024-2441`, incl. batch-K EditorSurface branches); **`TableBody.tsx`/`TableRow.tsx` exist but are dormant** (extract commit `c1ab3efd` verified; `Table.tsx`/`index.ts` never import them) — documented so nobody edits the wrong file.
- **Toolbar** — block `:2494-2672`, built-in order refresh→import→export→column-settings→custom buttons; `displaySelection`/`displaySelectionRef` in scope; `--iris-primary`/`--iris-primary-foreground` token precedent in Button.
- **Width** — `'auto'` today passes through the generic string branch as a shrinkable `auto` track; `resolvedColWidths` (`:1908`) and `pinnedOffsets.widthOf` (`:1781-1782`) **already** fall back to `DEFAULT_PINNED_WIDTH` (140) for non-numbers — so c) is one new branch in `gridTemplateColumns` + documenting the existing approximation limitation.
- **Core** — `groupRows` exists (`data-view/aggregate.ts:61`, first-seen order preserved, exported at `index.ts:159-161`), so grouping needs zero core changes.

## Design (additive, react-only)

- **a)** `groupBy?: boolean` on the column — `groupPlan` memo over `bodyData` (first-appearance order) feeding both body render paths (plain + generic `IrisVirtualScroll`); group header rows (`data-iris-group-row`, `gridColumn: 1 / -1`, `--iris-*` tokens) + per-group summary rows (`data-iris-group-summary`, same `aggregate` ops per group) when any column has `summary`; data rows keep their original `bodyData` index (seq/striped/span/checkMethod semantics preserved). Tree mode ignores grouping (fail-closed); proxy mode groups per loaded page — documented.
- **b)** `toolbar.batch?: { label; onClick(keys); icon? }` — rendered when `selectable === 'multi' && displaySelection.length > 0`, after built-ins before custom buttons, primary-token styling, receives the render-scope selection.
- **c)** `width === 'auto'` → `minmax(max-content, max-content)` branch before the generic string branch; pinned/virtualization keep the 140px fallback — limitation documented.

Includes file map, G1-G7/B1-B3/W1-W2 test plan, and 6 open questions (group-summary trigger reading, batch button filled-vs-outline, group label formatter, null keys, virtualization height caveat). The pre-existing draft had 4 wrong line ranges (renderRow, ColumnResizeHandle, summary block, core export lines) — all corrected against the actual file.
