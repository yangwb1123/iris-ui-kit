# DECISIONS (ADRs)

> Architecture Decision Records, append-only. Newest first. One ADR per significant/irreversible choice.

## ADR-008 — file-size governed by a baseline RATCHET, not a hard 500-line gate

日期: 2026-06-19 · 决策: line-count is enforced as a baseline ratchet — `scripts/arch-baseline.json` grandfathers the 19 currently-oversized files (incl. flagship Table ×4, 1100–1512 lines); CI gates `pnpm arch-check:ratchet` (fails ONLY on a new oversized file or GROWTH of a grandfathered one); pre-commit runs `arch-check --diff`; ESLint gains `complexity: ['warn', 15]` (low-noise branching signal — length stays with arch-check); `scripts/change-budget.mjs` reports the AUTONOMOUS ≤5-files/≤300-core-lines/iteration target (advisory — multi-framework fan-out exempt). · 原因: the three-layer constraint system already existed (AGENTS/AUTONOMOUS + arch-check + superpowers/memory) but file-size was advisory-only AND the "advisory" CI step lacked `continue-on-error` (mis-wired — would silently fail the job). A hard 500=fail would force harmful splitting of cohesive flagship files or breed an exemption list that trains agents to bypass the gate; the ratchet forbids regression without a flag-day rewrite. · 影响: new code cannot add oversized files or grow existing ones; grandfathered files stay (run `pnpm arch-check:baseline` to ratchet the ceiling down after shrinking one). Clean Architecture layering was rejected — the 5-layer + logic-sink-to-core model (ADR-002) already governs structure; arch-check keeps guarding the one real dependency invariant (core ⊄ frameworks). · 替代方案: hard 500=fail (rejected — death-rule / exemption-list failure mode); pure advisory (rejected — doesn't stop regression).

## ADR-006 — color-mix fallback via source-order cascade + derived tokens

日期: 2026-06 · 决策: add `--iris-{semantic}-subtle` (derived in `themeCssVarEntries` from color over background) and use a static longhand fallback BEFORE the color-mix shorthand in components. · 原因: legacy WebViews lack color-mix; needed a fallback with ZERO modern regression and no hand-authored values. · 影响: theming contract gains `-subtle` vars; tonal surfaces degrade gracefully. · 替代方案: class migration (heavier); accept degradation (rejected — was a named requirement).

## ADR-005 — tree virtualization gated on `!hasDetail`

日期: 2026-06 · 决策: virtualize tree rows (uniform height) but fall back to non-virtual when `renderDetail` is set (variable height). · 原因: closes the "v1 non-virtualized tree" limit safely. · 影响: all 4 Tables window flat+tree; Solid/Svelte gained a virtual path. · 替代方案: full variable-height virtualization (deferred — complexity > value).

## ADR-004 — native-bridge registries (file-save / clipboard)

日期: 2026-06 · 决策: core `setXHandler` + `doX(): boolean` (return false to decline → web default). · 原因: desktop/mobile shells need native save/clipboard; one host hook beats per-component wiring. · 影响: Table export + CopyButton consult the registry. · 替代方案: per-component callback props (kept `onCopy` as a secondary hook).

## ADR-003 — touch-DnD reuses in-repo `useDrag`, not an external gesture lib

日期: 2026-06 · 决策: build `createSortable` in core + reuse each adapter's pointer primitive. · 原因: dnd-kit/@use-gesture are single-framework → break the one-core-4-adapters model. · 影响: zero new deps; consistent across frameworks. · 替代方案: SortableJS/interact.js (imperative, fights the controlled-store model).

## ADR-002 — logic sinks into framework-agnostic core controllers

日期: earlier · 决策: selection/roving/data-view/data-source/admin-shell/sortable live in `@iris-ui-kit/core`; adapters are thin bindings. · 原因: de-duplicate 4 frameworks; single source of behavior. · 影响: new behavior = core controller + 4 bridges. · 替代方案: per-framework logic (rejected — drift).

## ADR-001 — 4-framework parity over a shared core

日期: project inception · 决策: identical component names/semantics across React/Vue/Solid/Svelte. · 原因: differentiation + AI-native manifest. · 影响: every feature ships ×4. · 替代方案: single-framework (rejected).

## ADR-007 — Table feature parity completed via additive opt-in ports; discovery requires verification

日期: 2026-06 · 决策: port columnVirtualization (iter 5) + interactive column resizing (iter 6) to Solid/Svelte as ADDITIVE, opt-in (default-off) features reusing core `computeVirtualRange` + each adapter's `useDrag`; verify every Explore-discovery candidate against source before acting. · 原因: React/Vue had these; Solid/Svelte didn't — a real parity gap. Opt-in = zero regression to existing tables. Explore agents read excerpts (~85% of the 13 parity candidates were noise/idiom/false-positive). · 影响: all 4 Tables at full feature parity; the discovery loop now has a documented verify-first discipline. · 替代方案: rename-for-parity (rejected — public-interface Blocker); skip (rejected — real gap).

## ADR-008 — Verification-sweep cycle (factory iters 7–10): real bugs fixed, soundness confirmed

日期: 2026-06 · 决策: when the explicit roadmap is exhausted, run targeted VERIFICATION sweeps (a11y patterns, manifest/tooling correctness, i18n completeness, export/import reachability) and fix real bugs found; record by-design/documented limitations rather than churn. · 原因: sweeps surfaced real bugs (Select aria-haspopup=dialog→listbox; manifest missed `export class` → IrisErrorBoundary invisible; 58 untranslated zh keys) AND confirmed soundness elsewhere (all 136 components barrel-reachable ×4; combobox exists; changesets pre-release). · 影响: codebase verified across many dimensions; +drift-guard tests (zh-coverage, manifest class-discovery). KNOWN-BY-DESIGN (not bugs): props.ts is interface-only best-effort (IrisToggleGroup's union-type props → zero extracted); skeleton templates hardcode example aria-labels. · 替代方案: manufacture marginal features (rejected — violates quality>motion); fix by-design items (rejected — fragile/marginal).
