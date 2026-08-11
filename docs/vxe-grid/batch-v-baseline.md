Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-v-baseline.md` (337 lines). No source files modified — `git status` shows only the new doc.

**Key findings from the read-through:**

1. **Proxy bridge** (`Table.tsx:833-898`): `proxyRef.current = createRemoteTableSource(...)` in a ref, null-proxy fallback via `EMPTY_PROXY_STATE` + `noopProxySubscribe`. **Core `remote-table.ts` has NO `setData`** — verified against the controller literal (`getState/subscribe/request/refetch/setParams/destroy` only), and `setParams` always fires a request. So `loadData` writes `liveData` via the existing `commitRowList` channel (`Table.tsx:1998-2001`) and the proxy state stays untouched until the next request (documented; the data-sync effect at `926-934` only re-seeds when `proxyState.data` reference changes, so the push survives until the next query).

2. **Edit flow**: exactly 3 `startEdit` sites (`1864` cell / `1387` row / `1967` row-reopen). Session close is observable at the core store transition `editing → null` with `validated !== undefined` ⇒ committed (value), else cancelled — works uniformly for sync/async commits and both edit modes (each row session is its own store; `EditorSurface`'s idle effect at `262-265` already watches this). Supersede-close is unreachable today (`autoClear` declared but never implemented — noted as an open question).

3. **Select-all**: `toggleAll` (`2369-2380`) computes the checkMethod-eligible page keys; `allSelected`/`someSelected` at `2382-2388`; header checkbox at `4354-4358` (multi mode only). `onSelectAllChange` fires pre-toggle state + eligible keys.

4. **Scroll**: root `onScroll` (`4333-4335`) exists only in column-virtualization mode; non-virtual mode needs a native listener effect on `rootRef` (only meaningful with `fixedHeight`, else overflow is `hidden`).

5. **vxe anchors**: `loadData`/`reloadData` (`es/table/src/table.js:4924-4945`), `commitProxy('query')` (`es/grid/src/grid.js:894`), `getProxyInfo` (`grid.js:1529`), `edit-activated`/`edit-closed` (`packages/table/module/edit/hook.ts:370,415`), `scroll` emit. `select-all-change` is NOT in vxe's emits — our additive naming documented.

Design: handle +4 methods, props +4 single-lines with 3 named param interfaces in `types.ts`, `Table.tsx` ~+90 lines, new test file ~17 tests. 6 open questions listed (total patch, unchanged-params refetch, per-cell row-close events, pre/post-toggle checked, hidden-overflow scroll, autoClear supersede).
