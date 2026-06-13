# STATE

> Compression snapshot — refreshed every ~5 iterations. Continue from this to minimize context re-reads.

**当前架构 (Architecture):** 5 layers (tokens → theme → core controllers → 4 adapters → plugins). Behavior in `@iris-ui/core`; adapters are thin reactivity bridges. See `ARCHITECTURE.md`. 149 components ×4 at full parity, 25 packages, CI + changesets, **126/126 gates green**, 0 skipped tests, packages at 0.0.0 (pre-first-publish).

**已完成 (Done) — factory cycle, condensed:**

- **iters 1–14** (earlier; see CHANGELOG for detail): `/docs/` memory system; Table feature parity ×4 (treegrid a11y, column virtualization + resizing); REAL bugs fixed via verification sweeps (Select `aria-haspopup`, manifest `export class` discovery, 58 zh i18n keys); **7 CI-enforced invariant GUARD tests** (barrel reachability, 4-fw name parity, module test-coverage, CSS-var validity, token-export completeness, zh coverage+placeholders, manifest class-discovery) + 10 backfilled tests + solid `isolate:true` flake fix.
- **iters 15–17** — **expanded `@iris-ui/core/contracts` behavioral-parity harness 4→8 components** (added segmented/toggle-group/slider/radio scenarios, each replayed ×4 adapters with zero divergence). Asserts BEHAVIORAL parity (beyond the name-parity guard) for 8 stateful components; the **form-control family (switch/checkbox/radio/segmented/toggle-group) is fully contract-covered**. Recipe: author core scenario + React reference inline → fan out 3 parallel agents (vue/solid/svelte) to mirror → full gate + one commit. Adapter split: React/Solid uncontrolled `defaultValue`; Vue `v-model` harnesses; Svelte controlled `$state` harness (in a shared `ContractsHarness.svelte`). Radio clicks the inner `<input>` (reads `data-state` from the `[data-iris-radio]` wrapper) to dodge jsdom `<label>`-click flakiness.
- **iters 18–19** — **fix(a11y): full 4-fw standalone-Tree keyboard parity.** A source-level behavioral audit (while scoping a tree contract) found **solid `IrisTree` had NO keyboard nav at all** (react/vue/svelte implement the WAI-ARIA tree pattern) — a real a11y + parity bug the name-parity guard cannot see. iter-18 added roving `tabindex` + container-level `onKeyDown` (↑↓ move, → expand/into-child, ← collapse/to-parent, Home/End, Enter/Space) + `aria-level`/`aria-disabled` to solid (+8 tests). iter-19 closed the tail: svelte lacked Home/End + `aria-level` (+4 tests; svelte tree had had zero keyboard tests). All four adapters' Tree now keyboard-navigate identically.

**关键经验 (Key lesson this cycle):** **source-level cross-framework BEHAVIORAL audits are high-yield** — reading all 4 impls of a stateful component side-by-side and diffing the _interaction surface_ (keyboard handlers, aria attrs, focus mgmt) surfaces real bugs the structural/name-parity guards are blind to (found solid-tree-no-keyboard). The contract harness makes such parity _asserted+regression-proof_ once written; the audit is how you find what to assert.

**未完成 (Open) — no confirmed blocked-free feature/bug backlog; all candidates are quality investments:**

- **Continue behavioral-parity audits** (highest-yield proven dimension): tabs/menu/listbox keyboard, dialog/drawer focus-trap, combobox `aria-activedescendant`. Diff the 4 impls; fix gaps; optionally add a contract once parity holds.
- **Continue contract expansion** (≤6 files each = 1 core scenario + index + ≤4 adapter blocks): clean candidates = number-input / rating / pagination / stepper (all exist ×4 with consistent `data-iris-*` + `aria-*` + onClick). **Tree contract is deferred** — the per-item (vue/svelte) vs container-level (react/solid) keydown-handler split + roving-active-node state make a single shared scenario fragile; revisit only if a thin per-fw driver shim absorbs it. Select/combobox/dropdown-menu are blocked by **portal rendering** (options mount outside the container-scoped driver `queryAll` → needs a document-scoped driver or `disablePortal`).

**技术债 (Debt):** all Low/by-design — props.ts interface-only extractor misses IrisToggleGroup union-type props; skeleton templates hardcode example aria-labels. (Possible tiny follow-up: svelte tree could gain `data-iris-tree-node={id}` to match react/solid's per-id selector — cosmetic, only if a test needs it.) See TODO.

**GATED (need user / external):** publish v0.1.0 (irreversible — will NOT run `npm publish` autonomously; maintainer's call); Tauri E2E demo (no Rust toolchain in sandbox); new product direction (Angular/Qwik adapter, new plugin, deeper MCP codegen).

**下一步推荐 (Next):** Sustainable autonomous mode = (1) source-level behavioral-parity audits of stateful components → fix real gaps (P1 correctness); (2) lock verified parity into the contracts harness or a guard test (P5 automation); (3) clean click-based contract additions. Both need no user input. Avoid marginal/cosmetic churn; do NOT run irreversible publish.

**Iteration count since last STATE refresh:** 0 (refreshed at iter-19 boundary).
