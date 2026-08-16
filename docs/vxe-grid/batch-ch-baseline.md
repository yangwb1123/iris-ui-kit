Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ch-baseline.md` (17 lines, matching the checked-in summary convention). Zero source files touched — git status shows only the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cg-gate.md`) plus the new baseline.

## Baseline essence (batch CH：列宽双栏拖拽 — columnDrag 拖出固定, iris 独有)

**Design** — zero new props, one shared resolution throat, window-level release:

- **Gating** (spec's "与 columnPinMenu 组合"): drag-out pin activates only when `columnDrag && columnPinMenu`. Plain `columnDrag` (vxe parity) stays byte-identical. The pin menu already owns the state channel (`pinOf` throat + `setColumnPinned` dual-channel + `onColumnPinnedChange`) — the drag is a second gesture into the same channel; no new state or i18n keys (`table.pinLeft`/`unpin` exist).
- **Mechanism**: `handleColDragPointerUp` (:3855) → `resolveColDrag(x, y)` taking release coords; root `onPointerUp` (:9108) passes the event, and a new window `pointerup` listener (effect gated on `colDragActive` in the gated config) covers release **outside the root** — the actual drag-out gesture, which today leaves the controller stuck in `activeId`. Resolution: edge check **first** — `x < rootRect.left` → `setColumnPinned(key, 'left')` (skip if already left, moves right→left, both channels, no optimistic flip when controlled, no reorder) — else the existing closestCenter reorder path byte-for-byte. Window listeners also include `pointermove` (fresh overId) and `pointercancel`; dedupe is free via `end()`'s capture-and-clear.
- **Scope cut**: right edge keeps today's semantics; no drag-unpin (menu convention — spec has no pin-right action); no hover indicator (spec silent).

**File map**: `props.ts` (:306 doc comment only, no type change) · `Table.tsx` (resolveColDrag + root pointerup coords + window-listener effect + module-level edge helper) · NEW `test/column-pin-drag.test.tsx` · manifest regenerated (**no diff** — propCount 169 / eventCount 31).

**Test plan** — 13 cases (react 2454→2467), spec's ①拖出固定 mapped to T1 (controlled pin + callback, no reorder) / T2 (uncontrolled internal state), plus gate fail-closed (T3 columnDrag-only, T4 columnPinMenu-only), state edges (T5 already-left no-op, T6 right→left flip), reorder regression (T7 in-band, T8 same-column), release paths (T9 window pointerup incl. stuck-state fix, T10 tap cancel, T11 pointercancel), controlled no-optimistic-flip (T12), grouped-header leaf (T13).
