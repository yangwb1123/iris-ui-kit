Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-q-baseline.md` (357 lines, ~21KB). **No source files modified** — `git status` shows only the new doc.

**Verified against current sources:**

- **Root container** (`Table.tsx:3587`, style merge `:3641-3643`): batch-N `fixedHeight` (`:3066`) is the single scroll-container mechanism; a ResizeObserver on `rootRef` already exists for column virtualization (`:2320-2338`) with the exact jsdom guard (`typeof ResizeObserver === 'undefined'`) the autoResize effect reuses.
- **Edit funnel**: every commit path (cell mode `:1096`, row mode `:1152`, async editRules) lands in `commitValue` (`:1048-1076`) — one hook point for dirty write-back; originals capture at `beginEdit` (`:1514`) / `beginRowEdit` (`:1175`); key = existing `cellId(rowKey, colKey)` (`:1023`).
- **Cell render**: body cells render inline in Table.tsx's `renderRow` (`:2646-2650`) — **TableRow.tsx/TableBody.tsx are dormant copies** (batch-N trap); dirty attr goes in the live renderRow only.
- **Live CSS**: the injected singleton is `TABLE_ROW_CSS` inside Table.tsx (`:50-107`); `styles.ts` copy is dormant (mirror-only). Second scroll container: `[data-iris-virtual-scroll]` — thin-scrollbar selectors must cover both.

**Key design decisions (as specified, kept simple):**

- **a)** `autoResize` — RO on root → `autoSize` state; height-not-set mode uses `height: 100%` (explicit `height: <measured>px` rejected: it stops tracking the parent, so the RO could never see further growth), `fixedHeight` extended so the batch-N sticky-header/overflow machinery kicks in after a positive measure; height-set mode keeps explicit height (no visible change); jsdom no-op.
- **b)** `scrollbarConfig` — attr `data-iris-scrollbar-thin` + 6px webkit rules (thumb `--iris-border`, hover `--iris-primary`) + `scrollbar-width: thin` for FF; CSS lives in the live TABLE_ROW_CSS, covering root + virtual scroller descendants.
- **c)** `editDirtyConfig` — `Set<cellId>` + originals `Map` (first-edit capture), `commitValue` marks/clears (clear when `value === original`, baseline re-armed); `indicator: false` suppresses the attr; `className: true` adds `iris-table-cell-dirty` class; dot via `[data-iris-cell-dirty]::after` (top/right 6px, `--iris-primary`).

Divergences documented with vxe line numbers: vxe `editDirtyConfig` is a keep-fields list (`table.ts:589-615`), its dirty marker is `keepSource`-coupled (`col--dirty`, `body.js:428`); vxe scrollbarConfig renders custom scrollbars (`table.ts:632-639`). Test plan A1-A6/S1-S4/D1-D7 + 7 open questions (FF scrollbar-color, stale dirty keys on proxy refetch, indicator-false semantics, virtualScroll nesting, etc.).
