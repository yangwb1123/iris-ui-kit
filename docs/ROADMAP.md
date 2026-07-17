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
- **2026-07-16 session (concurrent w/ several other autonomous sessions on this same tree) — security hardening + data/resilience foundation, 20 commits, ~290 tests, all landed while 5 other agents actively edited overlapping core files** (technique: isolated-base commits — apply a fix to the last-committed version of a file, verify it compiles/tests standalone, land via a compare-and-swap `git update-ref` that aborts instead of clobbering if a concurrent commit lands first; used only with explicit per-file user sign-off). Confirmed-bug fixes: markdown-plugin XSS (blacklist→allowlist sanitizer), CSV/Excel formula injection (core `toCsv` + react/vue `exportCsv`), skin CSS-injection (remote-skin token names/values), malformed-locale `RangeError` (i18n + date.ts + all 4 framework date components), form-store submit/validator hardening (5 sub-fixes: exception-safety, double-submit guard, circular-ref-safe undo snapshots, `serialize({exclude})` redaction), and the same stuck-validating-flag class in the standalone `form/validation.ts` engine. New public `@iris-ui/core` primitives (tested, DOM-free, exported from the barrel): `createDisposableScope` (lifecycle), `createQueryCache` (dedup/TTL/SWR), `createReconnectingSource` (realtime backoff), `createOutbox` (offline mutation queue), `createEventBus` (typed pub/sub), `createCircuitBreaker`, `createRateLimiter`, and `createResilientFetcher` (composes the last three). Unified `NotificationTone`/`ToastVariant` on `'danger'` (was split `'error'`/`'danger'` across core vs. Alert/Banner). Added Tree/Form scale-benchmark coverage. `restoreSession`'s claimed un-minimize bug was investigated and REFUTED (already correctly guarded + tested — not fixed, correctly left alone). `plugin.ts` contribution-API wiring and E2E/coverage-dependency installation were evaluated but deliberately deferred — see `docs/TODO.md`.

## 推荐方向 (Directions)

### P0 — 正确性 / 技术债 (highest priority per 行为准则)

- Sweep remaining documented micro-debt (excel export mime charset; perf-finding follow-ups). Small, isolated.
- **Contract harness saturated** (21 scenarios × 4 adapters, cross-framework behavioral audits complete across all interactive components). Remaining contract candidates are Blocker-gated (portal overlays — need unified portal-disable API) or need a driver `type` action (text entry).
- **Once the concurrent 2026-07-16 sessions' in-flight core edits (form.ts re-exports, window.ts, store.ts, plugin.ts, data/useGroupedView.ts) land or are dropped**, revisit: (1) wire the 7 new primitives (disposable/query-cache/realtime/outbox/event-bus/circuit-breaker/rate-limiter) into real consumers — they're public but currently unused by any controller/adapter; (2) `plugin.ts` contribution-API wiring (event bus into `PluginRegistry`, contributed commands/nav) — its diff was too dense this session to isolate safely; (3) re-scan for confirmed bugs in files that had dense overlapping concurrent edits this session (deliberately left alone, not yet re-checked against the settled state).
- **E2E (Playwright) + instrumented (v8) coverage**: user-authorized to install despite the shared-lockfile risk; a first attempt (`pnpm add -D -w @playwright/test @vitest/coverage-v8`) resolved `@vitest/coverage-v8@^4.1.10` — a MAJOR-version mismatch against this repo's pinned `vitest@^2.1.8` (coverage-v8 must track vitest's major). Install was reverted before completion (mid-session priority shift, not a failure) — retry pinning `@vitest/coverage-v8@^2.1.8` explicitly, then wire a real coverage config (start with `@iris-ui/core`, tiered thresholds) and a Playwright smoke E2E for one CMS app (react) proving the CRUD journey end-to-end before expanding to all four frameworks.

### P1 — 价值 (value)

- ~~Combobox/Autocomplete~~ — ALREADY EXISTS ×4 with the full WAI-ARIA combobox pattern (role=combobox + aria-expanded/controls/activedescendant/autocomplete). Verified — NOT a gap. (Recorded so it is not re-investigated; ditto a11y/2D-virt below, all DONE.)
- ~~a11y of tree rows~~ DONE (iters 3-4, WAI-ARIA treegrid). ~~2D/horizontal virtualization~~ DONE (iters 5-6). ~~Select haspopup a11y~~ DONE (iters 7-8).
- ~~Productize a real shell demo to validate the native bridges end-to-end~~ — **DONE (Electron): `apps/desktop`** hosts all four CMS demos (React/Vue/Solid/Svelte) and wires `setFileSaveHandler`/`setClipboardHandler` to native `dialog.showSaveDialog`/`clipboard`. Validated headlessly: a Node static-server smoke test (in the turbo pipeline → 127/127) AND a real Electron load under `xvfb` for all four frameworks (app mounted + Iris nodes + `window.irisNative` present). **Tauri + Wails: now DONE too** (`apps/desktop-tauri`, `apps/desktop-wails`) — the WebKitGTK 4.1 dev libs turned out to be present; Tauri's only missing piece (`librsvg2-dev`) was extracted into a user prefix without root. Both host the CMS ×4 with a live Framework switcher + native save/clipboard, validated headlessly (cargo/go tests + xvfb boot). All three shells share the identical `window.irisNative` renderer contract.
- **No confirmed non-blocked feature gaps remain.** Library is feature-complete, parity-complete, accessible, with a working Electron desktop demo. Next real progress = a user-chosen direction OR the blocked items (publish / Tauri-Wails-system-libs).
- **Independent re-verification pass (2026-07-02)**: rather than trusting this doc's "complete" claim at face value, checked a concrete, falsifiable signal — whether every framework actually _consumes_ the newly-added `createKeyboardNav` shared controller the same way the React reference does (not just whether components exist by name in all four, which the manifest test already guards). Found ONE real gap (Accordion had zero arrow-key roving focus between headers in Vue/Solid/Svelte — a genuine WAI-ARIA accordion pattern violation) and fixed it across all three, then locked it with a cross-framework behavior-contract scenario extension (not just per-framework unit tests) so a future regression fails CI, not just a manual re-audit. Four adjacent candidates (Menu typeahead, ToggleGroup, Toolbar, Vue Select) were investigated with the same rigor and correctly ruled out as already-consistent — see `docs/TODO.md` for the per-candidate evidence. Also finished this session's in-flight `IrisSortable`/`IrisLongPress` behavior port (was React-only, now all 4 frameworks) and tightened `manifest.test.ts`'s parity invariant to no longer exempt them.

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
