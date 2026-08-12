Baseline complete: `/home/u1/iris-ui/docs/vxe-grid/batch-ag-baseline.md` (132 lines, the only change — no source files touched; the `M` files pre-date this session).

Key findings baked in (all verified against the actual code):

**a) persistState** — every one of the seven pieces is already parent-owned via existing change callbacks, so the table is a pure LOADS/SAVES coordinator with zero new state. Two implementation-critical facts surfaced:

- `filters`/`filterValues`/`columnVisibility`/`columnOrder` are **controlled-only** (no internal mode) — restore via callback is the only path, matching the spec's gating rule exactly.
- `pageSize` is the **documented special case**: no callback exists (proxy `onPageChange` is a notification); restore must hook into the proxy-creation effect _before_ `ctrl.request()` or the first query fires with default 10 → double fetch.
- Ordering trap specified: restore effect runs before save subscriptions, with per-channel skip-first refs, so the mount commit never overwrites storage with pre-restore values.

**b) Variable-height virtualization** — the entire pipeline already supports per-item sizes:

- `VirtualScroll.tsx` `itemHeight` already accepts `(index) => number` (offset-tree variable mode, 2 existing tests pin it) — **zero changes**.
- `core/virtual.ts` `computeVirtualRange` already supports `itemSize` functions + precomputed `buildOffsets` — **zero changes**.
- Only work: widen `IrisTableVirtualOptions.itemHeight` in `types.ts` (the sole blocker) and let the existing pass-through at L4997 flow. Renderer untouched — the wrapper's `translateY`/`height` already derive from the same fn. The batch-AE recompute path (count change → virtualizer rebuild → re-clamp; new fn identity → `remeasure()`) covers expansion shifts. Documented the index-space trap: fn receives the _virtual plan index_, not bodyData index — which also lets apps size detail slots explicitly.

File map: 1 new hook (`usePersistState.ts`), 3 small react edits, 0 core/VirtualScroll changes; ~20 new tests across two spec files; doc updates specified for `vxe-grid-comparison.md` (批 AG row, `persistState` as iris-only increment, fn `itemHeight` as the iris take on vxe's `virtualYConfig` 增强模式).
