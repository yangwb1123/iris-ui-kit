Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dk-baseline.md`. No source files were modified.

**Summary of what I found and the baseline design:**

This is batch **DK** (批 DJ "表格快捷键监听增强" already completed separately — visible in the docs and memory index).

**Current state (batch DC already delivered the frozen-zone reorder):**

- `clampReorderZone` (Table.tsx:243) clamps a column-drag drop index into the dragged column's own pin zone (`zoneOf` = `pinOf ?? 'free'`); cross-zone drops clamp to the zone edge; net-zero moves skip.
- `resolveColDrag` (Table.tsx:4591) commits a frozen-zone reorder **only** through `columnDrag.onReorder(columns)` (~4626).
- The controlled, persisted channel `onColumnOrderChange(order: string[] | undefined)` (props.ts:336) is _already_ wired by the settings panel (`handleCustomConfirm`, Table.tsx:4891) and is what `persistState` persists as `columnOrder` (Table.tsx:3853).

**DK = channel enhancement:** the header-drag frozen-zone reorder additionally emits through `onColumnOrderChange` with the new top-level key list, so a header frozen-zone reorder is durable for controlled parents via the same channel the panel uses. The frozen-zone reorder logic itself is unchanged.

**Documented fiats:**

1. `onColumnOrderChange` emission only for flat leaf tables (`!grouped`) — `columnOrder` is top-level-scoped, so grouped leaf swaps keep `columnDrag.onReorder` only.
2. Trigger = committed non-net-zero reorder where the moved column is pinned (clamp guarantees any committed pinned reorder stays within its own frozen zone; spec's "target also pinned" is the natural subset).
3. Free-zone reorders stay `onReorder`-only (spec concerns pinned zones; byte-identical preservation).
4. Emits the full new key list (panel draftOrder semantics), never `undefined`.

**File map:** `Table.tsx` (one addition in `resolveColDrag`'s committed branch) · optional doc comment in `props.ts:columnDrag` · tests appended to `test/pinned-reorder.test.tsx`. Nothing else touched.

**Test plan: ~9 cases** reusing the existing harness (left/right frozen intra-reorder both channels, cross-zone unaffected, free-zone no-emission gate, missing-callback no-op, flat harness DOM follows key list, grouped-table gate, net-zero no-fire, persistState export regression).

Verification on implementation: `make ci` + `quality.py --strict` + the table test gate.
