Baseline complete: **`/home/u1/iris-ui/docs/vxe-grid/batch-cv-baseline.md`** (15 lines). Zero source files touched — `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md` M, `batch-cu-gate.md` ??), HEAD `15bbc1d4` unchanged.

**Key findings baked in:**

- **Pin state already has one throat**: `pinOf` (Table.tsx:3403) reads controlled `pinnedColumns` / internal `pinsInternal` / static `col.pinned`; `setColumnPinned` (Table.tsx:3408) is the single write channel (uncontrolled flips, controlled fires `onColumnPinnedChange` only). CV rides this channel — zero new pin machinery.
- **The boundary is already computed and sticky**: `pinnedOffsets` (Table.tsx:6144) resolves the boundary x (lead columns + Σ left-pinned widths); the LAST left-pinned leaf header cell's trailing edge IS the boundary and already carries `position: sticky` in both header renders (flat :10248, grouped :10036) — a handle inside it inherits stickiness for free.
- **`ColumnResizeHandle` (Table.tsx:1560) is the template**: `absolute; right:0; width:8px` + `useDrag` + Arrow keys + `role="separator"` + plain-English aria (zero i18n precedent). Grouped header renders no resize handles today (orphaned TableHeader.tsx unwired — verified).
- **columnDrag arm-race avoided**: handle span must `stopPropagation()` on React onPointerDown so `colDragCtrl.press` (:4128) never arms.

**Design** — `pinnedDrag?: boolean` + `onPinnedCountChange?: (count: number) => void` after `onColumnPinnedChange`:272 (propCount 180→182 / eventCount 31→32). Left-only count; 8px handle + 2px token line at the boundary cell; drag = translateX ghost, commit-on-release via pure `pinnedCountFromDrag` (prefix[k] ≤ target, clamped to first right-pinned index); keyboard ±1; commit writes `setColumnPinned('left'|null)` per changed column + fires the count callback; no-op drags fire nothing; boundary-column resize handle suppressed while on (fiat). 9 fiats cover right-block clamp, width approximation, header-only, virtualization, RTL, zero-i18n.

**File map** — props.ts +2 · Table.tsx 7 touch points (destructure / 2 module helpers / boundary memo / commit cb / flat + grouped header branches) · NEW `pinned-drag.test.tsx` · comparison doc 2 spots · manifest regen.

**Test plan** — react +17 (2618→2635): spec-mandated ① handle at boundary ② drag adjusts count (attrs + `onPinnedCountChange` once + per-column change), plus fail-closed pins, both directions, all-pinned/zero clamps, no-op, ghost transform, right-block clamp, controlled no-optimistic-flip, static-declaration seed, keyboard, grouped header, resizableColumns/columnDrag/columnVirtualization combos, width-aware resolution, lead-column exclusion.
