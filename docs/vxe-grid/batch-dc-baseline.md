Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dc-baseline.md`. Zero source files touched — `git status` shows only the pre-existing dirt (`DECISIONS.md` M, `batch-db-gate.md` ??) plus the new doc, HEAD `7e585388` unchanged.

## What the baseline establishes

**Spec**: `pinned 多列拖拽排序（冻结列可互相拖拽调整顺序——冻结区内 reorder）；测试（冻结区排序）`

**Core finding (逐行复核)**: the column drag-reorder machinery already exists (`columnDrag` → `colDragCtrl`/`createSortable` + `colRectsRef` + `resolveColDrag` at Table.tsx:4468-4506) and is **fully decoupled from pin state** — today a drag can drop a pinned column into the unpinned zone, corrupting `pinnedOffsets` sticky layout (offsets accumulate per left-pinned ordinal). The batch is pure **reuse**: clamp the drop into the dragged column's own pin zone via the existing `pinOf` throat (controlled `pinnedColumns` / internal / static `col.pinned`, :2854-2863).

**Exact design**: one new module pure function `clampReorderZone(cols, from, to, zoneOf)` where `zone = pinOf(col) ?? 'free'` — same-zone drop → index as-is (zero-pin tables stay byte-identical); over-before-zone → zone start; over-after → zone end. `resolveColDrag` reorder block (:4487-4493) wires it + a net-zero guard (rowDrag's "net-zero skips onReorder" precedent — only reachable via clamping). Invariant: **a column drag never changes a column's pin zone**; `[left][free][right]` partition preserved (gapped `[A(left),B,C(left)]` states included, per CV's documented gap handling). Composition verified: CH drag-out pin edge check stays first, CV boundary handle is a separate channel, BX menu untouched.

**File map**: Table.tsx only (+1 helper, ~4-line reorder change) · NEW `test/pinned-reorder.test.tsx` · comparison doc 2 spots · manifest regen → **zero diff** (186 props / 32 events). Zero core/types/styles/i18n/other frameworks.

**Test plan**: 15 cases (react 2682 → ~2697) mapping spec's 冻结区排序 — T1/T4 frozen-zone intra-reorder, T2/T3/T5/T15 cross-zone clamp, T6 no-pin regression, T8 net-zero clamp no-call, T11 controlled no-`onColumnPinnedChange`, T12 grouped leaves, T13 gapped-state, T14 CH regression.

**Fiats**: customConfig panel draft reorder (:4722-4737) deliberately not clamped (separate mechanism, parent owns order); `data-iris-col-drag-over` keeps pointer-position semantics (clamp only at commit).
