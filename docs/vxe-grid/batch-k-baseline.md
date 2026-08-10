Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-k-baseline.md` (22KB). No source files modified — the only change is the new doc (`?? docs/vxe-grid/batch-k-baseline.md`).

## What the baseline contains

**Code evidence (verified against current sources):**

- Singleton `createCellEdit` at `Table.tsx:665`; `commitEdit` returns false for Promises (`cell-edit.ts:146-150`) — root of M1; `commitAsync` sets `validated` on success / resets on cancel (`cell-edit.ts:97-99` vs `:58-65`) — the settlement discriminator the M1 design keys on
- `moveEditOnTab` (`Table.tsx:963-995`), `lazyChildrenRef` (`:1171`), liveData sync effect with `lastExternalRef` gate (`:410-427`), three editor branches (`:1887-2004`), `TABLE_ROW_CSS` (`:46-56`), `editConfig` inline type (`props.ts:240-247`)

**Proposed design (react-only, additive):**

- **a) Row mode** — `editConfig.mode?: 'cell' | 'row'` (default 'cell'). Row mode holds a `Map<cellId, CellEdit>` (one controller per editable column, each with its own draft/validate/commit through the existing machinery — per-cell `onCommit` write-back reused verbatim); click on a row with ≥1 editable column activates; `data-iris-row-editing` + token-driven highlight; Escape cancels the whole row, Enter commits the focused editor, blur on the last editor commits the row, Tab moves focus between the row's editors; the shared editor JSX becomes session-parameterized
- **b) M1 fix** — `pendingNavRef` + a settle-observer effect on the already-subscribed store state: the adapter knows async-ness (it owns `validate`), so `moveEditOnTab` defers navigation on pending; the effect checks `validated !== undefined && editing === null` → navigate, `error` set → stay with the error visible. No core change (avoids the `onCommit`-runs-before-clear race)
- **c) M2 fix** — one line in the existing sync effect: `lazyChildrenRef.current = new Map()` when `next !== lastExternalRef.current` (external data/proxy page only; internal write-backs keep the cache). Verified against the probe scenario: fresh `getSubRows` children render, caret reappears, keys reloadable

**File map**: `props.ts` +5, `Table.tsx` +130, `styles.ts` +3, new `row-edit.test.tsx` (~200), `lazy-tree-batch.test.tsx` extension (~120); core untouched. **Test plan**: R1-R10 (row mode), M1.1-M1.4 (async-Tab), M2.1-M2.4 (cache invalidation, including the id-2-hidden/id-7-shown regression). **5 open questions** — trigger interplay in row mode, Escape-during-pending core quirk, select-dropdown blur, expansion state across refresh, and failing-cell-during-row-commit UX.
