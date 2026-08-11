# Batch U Review — **PASS** (3 non-blocking findings)

Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-u-review.md`.

## Checklist verification

| Item                                                                                                                           | Result                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Zoom gated by `showButton`                                                                                                     | ✅ `Table.tsx:4144`; no button without toolbar/config                                                                                   |
| Fixed overlay + z-index + bg                                                                                                   | ✅ `Table.tsx:145-151` — `position: fixed; inset: 0; z-index: var(--iris-z-popover, 1000); background: var(--iris-surface)`, token-only |
| Esc exits (window listener only while zoomed)                                                                                  | ✅ tested                                                                                                                               |
| Toolbar unaffected otherwise                                                                                                   | ✅ additive only                                                                                                                        |
| layouts: hidden suppresses, defaults unchanged, all 3 sections                                                                 | ✅ `form`/`toolbar`/`pager` each independently tested                                                                                   |
| visibleMethod: false hides, true/absent renders, veto wins over `columnVisibility: true`, `columnVisibility: false` still wins | ✅ both directions tested                                                                                                               |
| Evaluated in the `displayColumns` memo, once per render                                                                        | ✅ call-count test; reference-preserving when unused                                                                                    |
| Additive / manifest / core framework-free / tokens / props.ts ≤500                                                             | ✅ all confirmed                                                                                                                        |

## Fresh verification

- React tests **1798/1798** (159 files, incl. 19 new) · typecheck ✅ · lint 0 errors (1 pre-existing complexity warning)
- `pnpm audit:security` clean · `check:manifest` up to date · core 1249/1249 · zh 6/6 parity guard
- `audit:tokens` exit 1 = 4 **pre-existing** warnings only; batch U introduces none

## Findings

1. **MEDIUM** — `Table.tsx:145-151` + `3877`: while zoomed, the fixed root (z-index 1000, opaque bg) paints **above** the toolbar sibling (z-index auto) → the ✕ exit button and toolbar are hidden behind the overlay; only Esc exits. The comment (141-143) and adapt doc claim the toolbar stays "above the overlay" (vxe parity) — inaccurate; vxe keeps its toolbar inside the zoomed root. Fix: lift the toolbar above the overlay while zoomed (or correct the docs).
2. **LOW** — `Table.tsx:4355`: the `zIndex` prop's inline `position: relative` overrides the stylesheet `position: fixed`, so zoom + `zIndex` prop never pins the overlay. Caveat only mentions caller `style`. Fix: force `position: fixed` inline while zoomed, after `...style`.
3. **INFO** — column-settings popover (`Table.tsx:3982-3986`) occluded at equal z-index if open before zooming; its Esc `stopPropagation` then needs two presses to exit zoom.

No files modified beyond the verdict doc.
