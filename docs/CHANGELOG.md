# CHANGELOG

> Human-readable completed work, newest first. Per-package semver lives in changesets; this is the factory's narrative log.

## Factory iterations

- **iter 4** — a11y: completed WAI-ARIA treegrid ×4 — core `flattenTree` emits `setSize`/`posInset`; tree rows get `aria-setsize`/`aria-posinset`; keyboard-navigable tree tables use `role="treegrid"`.
- **iter 3** — a11y: tree rows expose `aria-level` (depth+1) for screen-reader hierarchy ×4 frameworks (toggle keeps aria-expanded).
- **iter 2** — excel export mime cleanup: dropped the non-standard `;charset=utf-8;` param on `application/vnd.ms-excel` (react+vue; SpreadsheetML XML declares its own encoding).
- **iter 1** — established `/docs/` autonomous-factory memory system (ROADMAP/TODO/CHANGELOG/DECISIONS/ARCHITECTURE/AGENTS/STATE).

## Cross-platform + enterprise-table arc (prior cycle)

- **color-mix legacy fallback ×4** — theme derives `--iris-{semantic}-subtle` (color ~14% over background); components use source-order cascade (static longhand fallback before color-mix shorthand). Zero modern-browser regression; pre-2022 WebViews now tint correctly.
- **Table virtualization ×4** — flat+tree rows window via `IrisVirtualScroll`, gated `(!treeMode || !hasDetail)`. Solid & Svelte gained a virtual path they previously lacked.
- **Hierarchical tree-row column sort ×4** — core `withSortedChildren` + shared comparator for root + children.
- **Touch-DnD ×3 plugins ×4 fw** — core `createSortable` + `closestCenter`; pointer path coexists with native HTML5 DnD (gated `pointerType!=='mouse'`); `press`/`tryStart` movement-threshold + cached rects (perf).
- **Native-bridge registries** — `setFileSaveHandler` (Table CSV/Excel export) + `setClipboardHandler` (CopyButton) so desktop/mobile shells route to native save/clipboard.
- **Mobile** — `env(safe-area-inset-*)` on Toast/Drawer; `maxHeight:100dvh` on full-height drawers.
- **Docs** — cross-platform deployment guide (Electron/Tauri/Wails/Cordova).
- **Self-review fixes** — copy-button throwing-handler regression ×4; svelte drawer Escape (was unimplemented) + bg token parity; React tree summary arg.
- **Forms** — `useFieldArray` added to Solid + Svelte (React/Vue had it).

## Earlier

See `ROADMAP.md` history + git log for R1–R86 (ROADMAP v2 fully implemented) and the plugin/CLI/eslint/MCP expansion.
