Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-av-baseline.md` (142 lines). `git status` confirms only the new doc; zero source files touched.

**Key findings (every claim verified against current code):**

**Most of the spec already exists** — the real delta is three things:

- **Home/End** (`first/last cell of the current row`) and **PageUp/PageDown focus math** (`pageSize: 10`, clamped) are already implemented in core `nextGridCell` (roving.ts:147–156) and wired via `handleGridKey` (Table.tsx:3541–3559). No core change needed.
- **Missing 1 — Tab/Shift+Tab**: not in `GRID_NAV_KEYS`; today Tab exits the table. Design: module-scope `nextRowMajorCell` helper (row-major, **no wrap** — stop at bounds; fiat F1), preventDefault unconditionally, `setFocusedCell` (drives the roving tabIndex) + synchronous `.focus()` (legal on tabIndex −1). The existing editing guard (`target.dataset.gridRow === undefined`) keeps editor Tab (`moveEditOnTab`/`moveRowEditOnTab`) untouched.
- **Missing 2 — Enter**: plain alias of ArrowDown (ArrowDown = `scanCol(col, row, +1)` already exists); F2 stays the edit-start key.
- **Missing 3 — virtual PageUp/PageDown scroll**: the only broken path today — a target 10 rows away is often outside the rendered window, so `querySelector` no-ops. Design: scroll the `data-iris-virtual-scroll` viewport by `±10 × itemHeight` (clamped), then a focus-follow-up layout effect keyed on `focusedCell` (the window re-renders only after the scroll event → state → commit), guarded by `pendingGridFocusRef`. Note the spec's "root scrollTop" correction: the root is `overflow: hidden` in the pure-virtual case — the body scroller is the virtual viewport.

**Design constraint met**: `keyboardNavigation` stays a plain boolean — no new props, no `types.ts`/`props.ts` API change; only Table.tsx (handler + one helper + one effect) plus tests.

**File map**: 1 source edit (Table.tsx, ~30 lines) + 1 test file extended (Table.test.tsx grid-nav describe, 8 cases) + 1 new test file (`keyboard-nav-virtual.test.tsx`, 5 cases). 10 numbered fiats (F1–F10) included for gate arbitration.
