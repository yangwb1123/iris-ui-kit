Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-bd-baseline.md`** (184 lines) — the only file I created; zero source files modified (the `M` entries in git status were pre-existing BC-batch changes, untouched).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Type**: `IrisTablePresenceEntry { id; name; color; cellKey }` in `types.ts` (entry-shapes cluster, after `IrisTableVersionEntry`)
- **Cell-key language**: `cellKey` = `${rowKeyVal}::${colKey}` — reuses the canonical `cellId` delimiter (Table.tsx:2254) and the batch-AZ `annotations` key format; no new key invention (fiat 1)
- **Prop**: `presence?: IrisTablePresenceEntry[]` in `props.ts` after `onAnnotationsChange` (:501), annotations cluster
- **Rendering** (clone of the proven batch-AZ/AQ hot-cell pattern): render-scoped memo groups by cellKey (O(1) per visible cell); 3 module helpers (`presenceOf`/`presenceStyle`/`renderPresenceLabels`, pattern: `cellNoteState`) keep the cell arrow's complexity budget flat; cell gets `data-iris-presence="true"` + `outline: 2px solid <first.color>` + `position: relative`; labels (`data-iris-presence-label` + `-id`/`-name`) anchor top-left (`insetInlineStart`, RTL-safe) — corner budget verified free (dirty dot/note badge top-right, fill handle bottom-right)
- **Re-render**: fully controlled prop — new array reference rebuilds the memo → re-render; in-place mutation doesn't (documented, same as `data`/`annotations`). **Pure display**: no state/store/subscription/effect/handle/i18n/core changes
- **Label style**: token-driven (`font-size-xs`, `space-xxs` padding, `primary-foreground` fallback), background = entry color verbatim (data exception, fiat 4)

**File map**: 5 edits (types.ts, props.ts, styles.ts, Table.tsx, index.ts) + 1 new test file (presence.test.tsx)

**Test plan**: 9 cases modeled on `annotations.test.tsx` — render cursor+label, `::` delimiter, multi-cell, same-cell stacking (first-wins outline), **no presence → nothing**, empty array, **presence change re-renders** (spec), unknown cellKey inert, token/style assertions

**10 numbered fiats** for gate arbitration (key format, attr shape, multi-entry semantics, color-as-data exception, controlled-prop contract, zero-interference, cost, fail-inert, corner budget, react-only scope).
