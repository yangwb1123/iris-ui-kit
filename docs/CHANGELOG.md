# CHANGELOG

> Human-readable completed work, newest first. Per-package semver lives in changesets; this is the factory's narrative log.

## Cross-platform + enterprise-table arc (current cycle)

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
