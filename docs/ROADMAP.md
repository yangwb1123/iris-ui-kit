# ROADMAP

> Autonomous Software Factory roadmap. Token-lean living doc. Detail lives in git history + `docs/CHANGELOG.md`. Updated each iteration (Phase 6).

## 当前状态 (Current state)

Iris UI — token-driven, 4-framework (React/Vue/Solid/Svelte) UI infrastructure over a shared `@iris-ui/core`. **Feature-complete & at parity.**

- 25 packages (all publishable, CI + changesets wired), 23 turbo task groups, **126/126 gates green**, 0 skipped tests.
- 5-layer architecture (tokens → theme → core controllers → framework adapters → plugins). See `docs/ARCHITECTURE.md`.
- Recently landed: cross-platform arc (touch-DnD via `createSortable`, safe-area/dvh, `setFileSaveHandler`/`setClipboardHandler` native bridges, deployment docs) + enterprise-table (hierarchical tree sort, flat+tree virtualization ×4) + color-mix legacy fallback (zero modern regression) + a self-review pass that fixed a real copy-button regression.

## 推荐方向 (Directions)

### P0 — 正确性 / 技术债 (highest priority per 行为准则)

- Sweep remaining documented micro-debt (excel export mime charset; perf-finding follow-ups). Small, isolated.
- Expand `@iris-ui/core/contracts` cross-framework behavior coverage to the controllers added recently (`createSortable`, file-save/clipboard registries) — turns "parity by author discipline" into asserted parity.

### P1 — 价值 (value)

- ~~Combobox/Autocomplete~~ — ALREADY EXISTS ×4 with the full WAI-ARIA combobox pattern (role=combobox + aria-expanded/controls/activedescendant/autocomplete). Verified — NOT a gap. (Recorded so it is not re-investigated; ditto a11y/2D-virt below, all DONE.)
- ~~a11y of tree rows~~ DONE (iters 3-4, WAI-ARIA treegrid). ~~2D/horizontal virtualization~~ DONE (iters 5-6). ~~Select haspopup a11y~~ DONE (iters 7-8).
- Productize a real shell demo (Tauri) to validate the native bridges end-to-end. **BLOCKED**: needs Rust toolchain (not available in sandbox) → Blocker.
- **No confirmed non-blocked feature gaps remain.** Library is feature-complete, parity-complete, accessible, 126/126 green. Next real progress = a user-chosen direction OR the blocked items (publish/Tauri).

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
