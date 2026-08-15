Committed as `f8add631 feat(table): grid 批 BH——行分组折叠（iris 独有）`. Working tree clean (only the pre-existing BG-stage `M` entries on `DECISIONS.md` / `batch-bg-gate.md` remain, untouched).

## Report — batch BH: 行分组折叠 (`groupCollapsed`, iris 独有)

### Files changed (4 source + 1 test + manifest regeneration)

| File                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/i18n.ts`                                        | +2 default keys after `table.clearSelection`: `table.groupCollapse` ('Collapse group') / `table.groupExpand` ('Expand group') — the toggle's `aria-label`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/react/src/primitives/table/props.ts`                     | 3 single-line props after `keymap` (:399): `groupCollapsed?: Array<string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | number>`(controlled),`defaultGroupCollapsed`, `onGroupCollapseChange?: (next: Array<string | number>) => void`— mirroring the`selection`/`onSelectionChange` controlled pattern; all captured by the manifest scanner (149→152 props) |
| `packages/react/src/primitives/table/Table.tsx`                    | 3 sites: (1) internal `useState<Set<string>>` seeded from `defaultGroupCollapsed` + `collapsedSet` memo (derives from the prop when controlled — **no optimistic flip**) + `toggleGroupCollapse` firing `onGroupCollapseChange` in BOTH modes, right before the `groupPlan` memo; (2) `groupPlan` memo skips a collapsed group's rows AND per-group summary (header + FULL count stay) — one choke point, both render paths (flat :7707 + virtual `virtualItems` :6098) inherit; (3) `renderGroupHeader` gains a native `<button type="button" data-iris-group-toggle aria-expanded aria-label>` (▸/▾, token-only styling, 8px token gap already present) + `data-iris-group-collapsed` on the row |
| `packages/react/src/primitives/table/types.ts`                     | doc touch — `groupBy` column doc now references the collapse props + toggle contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/react/src/primitives/table/test/group-collapse.test.tsx` | new, 359 lines — **12 tests** (below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `packages/manifest/{manifest.json,llms.txt}`                       | regenerated via `pnpm gen:manifest` + committed: IrisTable propCount **149→152**, eventCount **28→29**, `onGroupCollapseChange` in the events list, props captured single-line. Component count unchanged (155 — pre-existing). React-only (vue/solid/svelte have no groupBy parity)                                                                                                                                                                                                                                                                                                                                                                                                               |

### Tests added (12, all in the new file)

1. initial expanded — every header has `data-iris-group-toggle` (▾, `aria-expanded=true`, aria-label 'Collapse group'), no `data-iris-group-collapsed` anywhere
2. collapse hides group rows + per-group summary; header + **full count** `(2)` stay; QA group untouched
3. expand restores rows + summary (aggregate recomputed 250)
4. `defaultGroupCollapsed` seeds uncontrolled state; toggle clears it
5. controlled — no optimistic flip: callback fires with `['Develop']` but body unchanged until the prop is written back; expand emits `[]`
6. selection coexistence — hidden rows keep selection; selection summary still counts hidden selected rows; expand restores `data-iris-table-row-selected`
7. select-all includes rows hidden inside collapsed groups (4 selected)
8. edit coexistence — committed value + `data-iris-cell-dirty` dot survive collapse/expand
9. seq — collapsed survivors keep ORIGINAL bodyData indices (QA rows still 3, 4)
10. virtual path — collapsed groups drop out of the virtual plan (window via `buffer: 10`, jsdom clientHeight=0)
11. toggle never fires row events (`onRowClick` untouched)
12. stale keys inert; inert without `groupBy`; inert in tree mode (no group toggles, tree renders)

### Verification (all pass, exact commands)

- core test: **1469/1469** (95 files) — `env COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm --filter @iris-ui-kit/core test` (core dist rebuilt first — turbo `test` dependsOn `^build`)
- react typecheck clean; react test: **2163/2163** (192 files); react lint **0 errors** (1 pre-existing complexity warning on `IrisTable`)
- spec validator `--mode all --json`: **0 violations** (1414 files)
- `gen:manifest` regenerated + committed; manifest package tests 69/69; `node checks/manifest.mjs` silent

### Fiats honored (7/7 from baseline)

- Hidden = rows + per-group summary; header + full count stay
- True controlled semantics (no optimistic flip, mirroring selection's documented behavior)
- Callback fires in both modes (lift-ready)
- Collapse never mutates selection/edit/index state (selection summary still counts hidden selected rows; dirty dots survive)
- Stale keys inert; inert without groupBy and in tree mode
- Pure render layer — no `onDataChange`/undo/audit involvement

### Left

- No persisted collapse state across remounts (the `persistState`/`views` features don't cover it — additive prop-only, per baseline)
- vue/solid/svelte untouched (no groupBy parity exists in those frameworks — verified in baseline)
- Accessibility note: the toggle is a native button (Enter/Space work out of the box); no custom keyboard nav added
