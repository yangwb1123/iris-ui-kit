# batch Q review verdict — **FAIL**

Reviewed: `docs/vxe-grid/batch-q-baseline.md` + `batch-q-adapt.md`, `git diff` (5 source files + 1 test), `Table.tsx` render/edit/RO paths, `VirtualScroll.tsx`, `styles.ts`, audit scripts.

**Verification run:** react `test` 155 files / 1721 passed (incl. 12 new batch-Q tests) ✅ · `typecheck` ✅ · `lint` 0 errors, 1 pre-existing `IrisTable` complexity warn ✅ · `iris-ui-spec.py --mode all` 0 violations ✅ · prettier ✅ · **`check:manifest` FAIL** ❌ · core untouched (`packages/core` diff empty, 0 framework imports) ✅ · arch-ratchet/`props.ts` size pre-existing conditions, unchanged by batch Q.

## Findings

**1. MAJOR — autoResize implements the exact approach the baseline explicitly rejected: measured-px inline height instead of `height: 100%`** (`Table.tsx:3787-3788`, RO effect `:2441-2450`).
Baseline design decision (a): _"height-not-set mode uses `height: 100%` (explicit `height: <measured>px` rejected: it stops tracking the parent, so the RO could never see further growth)"_. The RO observes the **root**, not the parent; once the root is pinned to one measured px value its size can no longer change, so the RO never fires again → any later container resize is untracked (stuck height). And in block layout (wrapper div with fixed height — the primary fill-the-parent use case) the first measure is the root's _natural content_ height, not the container height, so a short table never fills the container at all; in flex-column it only fills when content already overflows (flex-shrink clamps the measure). `height: 100%` fills and tracks in both cases. The new tests formalize the divergence (`fireResize(800, 400)` → asserts `style.height === '400px'`).
Fix: per baseline — height-not-set mode renders `height: 100%` on the root; `autoSize` only gates `fixedHeight` (sticky/overflow engagement after a positive measure); height-set mode unchanged; rewrite the 4 autoResize tests to assert `height: 100%` + fixed-height machinery, not measured px.

**2. MAJOR — manifest hygiene: `check:manifest` fails; regenerated manifest picks up batch Q** (`packages/manifest/manifest.json`/`llms.txt`; new props `scrollbarConfig`, `editDirtyConfig`, `autoResize` + type `IrisTableEditDirtyConfig` in the type lists, description text truncated). The adapt claims "all 3 items done" and a green audit, but never ran `gen:manifest`/`check:manifest`; the repo gate (`pnpm check:*`, incl. manifest) fails. Fix: run `pnpm gen:manifest` and commit the regenerated files (I restored the tree to pre-check state after inspecting).

**3. MINOR — `removeRows`/`removeRow` do not prune dirty keys** (`Table.tsx:1767-1784`, map never cleaned except by revert-commit `:1104`). Removed rows leave stale `dirtyCellsRef` entries; harmless only while the key stays absent — re-adding the key (insertRow, proxy refetch, paging back to a page with same ids) renders phantom dirty dots on unedited rows. Fix: in the `removeRow`/`removeRows` handlers delete `${key}:*` entries; consider clearing on wholesale data replace (also the adapt's own open question "stale dirty keys on proxy refetch").

**4. MINOR — dirty key format diverges from baseline** (`Table.tsx:1096` uses `` `${k}:${colKey}` `` single colon; baseline c) specified the existing `cellId` `${k}::${colKey}`). Internal-only (never compared with cellId), but `a`/`b:c` vs `a:b`/`c` collide if keys/colKeys contain `:`. Use the `::` delimiter or a tuple.

**5. MINOR — class name diverges from baseline spec** (`Table.tsx:178` `'iris-cell-dirty'` vs baseline c) documented `iris-table-cell-dirty`). Public API surface; pick one and fix the JSDoc/baseline to match.

**6. MINOR — physical `right: 4px` on the dirty dot** (`Table.tsx:106`), AGENTS.md requires logical props for direction-dependent styles (`inset-inline-end`); dot stays top-right in RTL instead of mirroring. Adapt already self-flagged.

## Passed checks

- scrollbarConfig: attr only for `theme:'thin'`, defaults unchanged; webkit 6px + thumb `--iris-border`/hover `--iris-primary`, FF `scrollbar-width: thin`; selectors cover root **and** `[data-iris-virtual-scroll]` (attr confirmed live at `VirtualScroll.tsx:349`); 2 tests pass. ✅
- editDirty: single `commitValue` funnel (`:1146-1152`) covers cell + row mode; first-commit original capture; revert-to-original clears; `indicator:false`/`className:true`; no config → no attr; tests pass (6). ✅ (with findings 3–5)
- autoResize: jsdom guard, disconnect cleanup, no-RO no-crash, explicit-height-wins — all tested ✅ (but finding 1).
- Additive: props optional + defaults preserve behavior; `fixedHeight` extension inert without autoResize; `className` merge null-safe for existing cell rendering; core framework-free; tokens only (`--iris-primary`/`--iris-border`, no hex); RSC/SSR safe (effect-only RO). ✅

Gate impact: finding 1 breaks the batch's core promise ("fills container… tracks parent"); finding 2 breaks `check:manifest` on the merge gate. Fix findings 1–2 (+3) and re-run, then gate.
