# ROADMAP

> Autonomous Software Factory roadmap. Token-lean living doc. Detail lives in git history + `docs/CHANGELOG.md`. Updated each iteration (Phase 6).

## 当前状态 (Current state)

Iris UI — token-driven, 4-framework (React/Vue/Solid/Svelte) UI infrastructure over a shared `@iris-ui/core`. **Feature-complete & at parity.**

- 25 packages (all publishable, CI + changesets wired), 22 turbo tasks, **127/127 gates green**, 0 skipped tests.
- 5-layer architecture (tokens → theme → core controllers → framework adapters → plugins). See `docs/ARCHITECTURE.md`.
- **Cross-platform arc landed**: touch-DnD via `createSortable`, safe-area/dvh, `setFileSaveHandler`/`setClipboardHandler` native bridges, deployment docs.
- **Enterprise-table complete**: hierarchical tree sort, flat+tree virtualization ×4.
- **Desktop demos validated ×3 shells** (Electron/Tauri/Wails) — each hosts all four CMS apps (React/Vue/Solid/Svelte) with live Framework switcher + native save/clipboard, validated headlessly in CI (`check:desktop-parity` gate).
- **Full behavioral-parity audit complete**: 5 waves across the entire component surface, 29 real cross-framework defects fixed, ~85 new tests, contract harness at 21 scenarios × 4 adapters.

## 推荐方向 (Directions)

### P0 — 正确性 / 技术债 (highest priority per 行为准则)

- Sweep remaining documented micro-debt (excel export mime charset; perf-finding follow-ups). Small, isolated.
- **Contract harness saturated** (21 scenarios × 4 adapters, cross-framework behavioral audits complete across all interactive components). Remaining contract candidates are Blocker-gated (portal overlays — need unified portal-disable API) or need a driver `type` action (text entry).

### P1 — 价值 (value)

- ~~Combobox/Autocomplete~~ — ALREADY EXISTS ×4 with the full WAI-ARIA combobox pattern (role=combobox + aria-expanded/controls/activedescendant/autocomplete). Verified — NOT a gap. (Recorded so it is not re-investigated; ditto a11y/2D-virt below, all DONE.)
- ~~a11y of tree rows~~ DONE (iters 3-4, WAI-ARIA treegrid). ~~2D/horizontal virtualization~~ DONE (iters 5-6). ~~Select haspopup a11y~~ DONE (iters 7-8).
- ~~Productize a real shell demo to validate the native bridges end-to-end~~ — **DONE (Electron): `apps/desktop`** hosts all four CMS demos (React/Vue/Solid/Svelte) and wires `setFileSaveHandler`/`setClipboardHandler` to native `dialog.showSaveDialog`/`clipboard`. Validated headlessly: a Node static-server smoke test (in the turbo pipeline → 127/127) AND a real Electron load under `xvfb` for all four frameworks (app mounted + Iris nodes + `window.irisNative` present). **Tauri + Wails: now DONE too** (`apps/desktop-tauri`, `apps/desktop-wails`) — the WebKitGTK 4.1 dev libs turned out to be present; Tauri's only missing piece (`librsvg2-dev`) was extracted into a user prefix without root. Both host the CMS ×4 with a live Framework switcher + native save/clipboard, validated headlessly (cargo/go tests + xvfb boot). All three shells share the identical `window.irisNative` renderer contract.
- **No confirmed non-blocked feature gaps remain.** Library is feature-complete, parity-complete, accessible, 127/127 green, with a working Electron desktop demo. Next real progress = a user-chosen direction OR the blocked items (publish / Tauri-Wails-system-libs).

### P2 — 战略 (strategic)

- First npm publish (pipeline ready; maintainer-gated — a 发布 decision).
- Plugin ecosystem expansion (data-viz depth, schema-admin).
- AI-native: grow the manifest/MCP surface (codegen quality).

## 技术债 (Technical debt)

See `docs/TODO.md` (High/Medium/Low). Currently all Low/cosmetic after the self-review pass.

## Edge Cases (watch)

- Touch-DnD without `setPointerCapture` on ancient WebViews (self-heals next drag; documented).
- Tree + `renderDetail` + virtualization intentionally non-virtual (variable height).

## 性能优化机会 (Perf)

- Rect caching + movement-threshold already shipped for touch-DnD.
- Variable-height virtualization (tree+detail) — deferred (complexity vs niche value).
- `createStore` selective subscription already available (`subscribeWith`).
