Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-s-baseline.md` (232 lines). No source files modified — `git status` shows only the new doc (the `manifest.json` modification pre-exists).

**What was verified against current sources:**

- **Existing menu/channels** (`Table.tsx:743-763, 1488, 1507-1512, 3655-3712`): `safeColumns`/`displayColumns` filter by `columnVisibility[key] !== false`; `toggleColumnVisibility` already fires `onColumnVisibilityChange` — the visibility channel the panel needs exists today. The column-settings popup is `absolute right:0 top:100%` under the `position: relative` toolbar.
- **createSortable pattern (batch 2)** (`Table.tsx:1428, 1515-1560, 2754-2768, 3893-3906` + core `sortable.ts:14-172`): `press`/`isPending`/`tryStart` (4px threshold) → rect collection on first movement → `moveOver` closest-center → `end()` splice → `onReorder`; active/over chips via data attrs. The panel clones this for its rows.
- **Props** (`props.ts:244-246, 267-286`): no panel config exists today; `columnVisibility`/`onColumnVisibilityChange` are the only channels.
- **i18n**: en defaults in `packages/core/src/i18n.ts:110-113`, zh in `packages/plugin-locale-zh/src/core/index.ts:46-58` — both files need the new keys.
- **vxe reference** (real path `/tmp/vxe-ref/es/table/src/props.js:287`): `customConfig` + panel impl (`module/custom/panel.js`, `hook.js`) + defaults (`ui/index.js:111-147`); note vxe's panel has **no search box** — that's the iris addition.

**Key decisions (as specified):**

- **a)** EXTEND the existing `toolbar.columnSettings` button — it opens the full panel replacing the checkbox menu (element name kept so `vxe-parity.test.tsx:329` stays green). Search is display-only; drag commits through the new `onColumnOrderChange` (drop = commit, rowDrag pattern); reset emits `onColumnVisibilityChange({})` + declared order (no per-column `defaultVisible` in iris — documented simplification, Q1).
- **b)** `toolbar.customConfig?: { resetText?: string }` + `columnOrder?: string[]`/`onColumnOrderChange` — order state mirrors the `columnWidths` controlled/internal pattern with a reference-preserving shortcut (byte-identical without the props); grouped tables address top-level columns only.
- **c)** `table.customConfig.search` / `table.customConfig.reset` in core en defaults + zh plugin.

File map: `props.ts` (+3 declarations), `Table.tsx` (~+110-140 lines), core `i18n.ts` + zh plugin (+2 keys each), new `test/custom-config.test.tsx` with 10 tests. 4 open questions (reset snapshot, close behavior, grouped cross-level drag, panel gate).
