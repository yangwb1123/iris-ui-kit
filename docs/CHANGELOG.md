# CHANGELOG

> Human-readable completed work, newest first. Per-package semver lives in changesets; this is the factory's narrative log.

## Factory iterations

- **iter 13** — test: filled 10 missing component-module tests (solid + svelte each had 5 untested: avatar/form-field/input/switch + breadcrumb[solid]/drag-useDrag[svelte]) mirroring react coverage (+88 tests); flipped solid vitest isolate:false→true (fixed a latent cross-file reactive-owner leak flake; matches react/vue defaults). No component source changed.

- **iter 11-12** — test(manifest): two CI-enforced invariant guards — (11) barrel reachability (every component must be package-exported; catches "implemented but not exported"), (12) 4-framework parity (every component must exist in all 4). Converts manual verifications into permanent regression guards.

- **iter 10** — fix(locale-zh): added 58 missing Chinese translations (zh covered only 46/104 built-in keys) + drift-guard tests (zh must cover every defaultMessages key; placeholders preserved). Found via i18n sweep.

- **iter 9** — fix(manifest): discovery regex now matches `export class` (was const/function only) — React's class-based `IrisErrorBoundary` was invisible to the AI-native manifest/llms.txt/MCP/docs (react 148 vs 149). Regenerated the also-stale manifest.json + llms.txt. Now 149/149 ×4. (Found via a verification sweep — real bug, not noise.)
- **iter 7–8** — a11y: Select trigger announces `aria-haspopup="listbox"` (react+vue) instead of the popover's `dialog` default — real WAI-ARIA fix (solid/svelte were already correct). Found via verified a11y audit.
- **iter 6** — port interactive **column resizing** to solid+svelte (resize handles via useDrag + controlled/uncontrolled widths + onColumnWidthsChange). Completes Table feature parity ×4. Opt-in → zero regression.
- **iter 5** — port opt-in `columnVirtualization` (horizontal) to solid+svelte (react/vue had it). All 4 Tables now have vertical + tree + horizontal virtualization parity. Additive/opt-in → zero regression.
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
