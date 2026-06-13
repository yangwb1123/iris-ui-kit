# STATE

> Compression snapshot — refreshed every ~5 iterations. Continue from this to minimize context re-reads.

**当前架构 (Architecture):** 5 layers (tokens → theme → core controllers → 4 adapters → plugins). Behavior in `@iris-ui/core`; adapters are thin reactivity bridges. See `ARCHITECTURE.md`. 149 components ×4 at full parity, 25 packages, CI + changesets, **126/126 gates green**, 0 skipped tests, packages at 0.0.0 (pre-first-publish).

**已完成 (Done) — factory cycle iters 1–14 (this session):**

- iters 1–6: `/docs/` memory system · excel mime · WAI-ARIA treegrid (aria-level/setsize/posinset + role) · column-virtualization parity · column-resizing parity → Table at full feature parity ×4.
- iters 7–10: REAL bugs fixed via verification sweeps — Select `aria-haspopup` dialog→listbox; manifest discovery missed `export class` (IrisErrorBoundary invisible) + stale snapshot; **58 untranslated zh i18n keys**.
- iters 11–14: **structural invariant GUARD tests** (CI-enforced, prevent regression) — barrel reachability (every component exported); 4-framework parity (every component ×4); 10 backfilled missing tests + solid `isolate:true` flake fix; module test-coverage (every module has a test). Plus pre-existing guards: token-export completeness, zh-coverage + placeholder preservation, manifest class-discovery.
- iters 15–17: two more CI guards (module test-coverage, CSS-var reference validity) + **expanded `@iris-ui/core/contracts` 4→8 components** (segmented/toggle-group/slider/radio behavioral contracts replayed ×4 adapters; zero divergence). Harness now asserts BEHAVIORAL parity (not just name parity) for 8 stateful components; form-control family (switch/checkbox/radio/segmented/toggle-group) fully contract-covered.
- iter 18: **fix(a11y/solid) — solid `IrisTree` had NO keyboard nav** (real WAI-ARIA + behavioral-parity gap vs react/vue/svelte; found by source audit, not a guard). Added roving tabindex + container `onKeyDown` (arrows/Home/End/Enter/Space) + aria-level/aria-disabled; +8 tests. Demonstrates the value of source-level parity audits beyond the name-parity guard.

**未完成 (Open):** No confirmed non-blocked feature/bug backlog. Comprehensively verified across ~9 dimensions; invariants now guarded. GATED items: publish v0.1.0 (irreversible release — won't run `npm publish` autonomously, but the decision is the user's), Tauri E2E demo (absent Rust toolchain), new product direction (user choice: Angular/Qwik adapter, new plugin, MCP codegen depth).

**技术债 (Debt):** all Low/by-design (props.ts interface-only extractor → IrisToggleGroup union-type props; skeleton templates hardcode example aria-labels). See TODO.

**下一步推荐 (Next):** SUSTAINABLE AUTONOMOUS MODE = (1) targeted verification sweeps that occasionally surface real gaps (coverage gap found iter 13; i18n iter 10) → fix; (2) convert each verified invariant into a permanent GUARD test. Both are correctness(P1)/automation(P5) work needing no user input. Candidate next sweeps: CSS-var reference validity (typos), docs/demo coverage per component, i18n usage (hardcoded visible strings), cross-fw behavior contracts expansion. Avoid marginal/cosmetic churn; do NOT run irreversible publish.

**Iteration count since last STATE refresh:** 4 (iter-18; last full refresh at iter-14 boundary — **full STATE refresh due next iteration**).
