# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- **P1 (in progress): expand `@iris-ui/core/contracts`** — the cross-framework behavior-contract harness now covers **7 components** (tabs/switch/checkbox/accordion + iter-16 segmented/toggle-group/slider), each event-script asserted identical ×4 adapters. Turns "parity by author discipline" (also guarded structurally by the manifest parity test) into asserted BEHAVIORAL parity. Next contract candidates (consistent ×4 selectors, deterministic uncontrolled/keyboard behavior): **radio** (needs `userEvent` not `fireEvent` — hidden `<input>` in `<label>`), **select/combobox** open→option-select (`aria-expanded`/`aria-activedescendant`), **dropdown-menu** roving focus, **tree** expand/select (`aria-expanded`/`aria-selected`). Deeper goal: drive a controller-level scenario (selection/sort/expansion/data-source store migrations) through all 4 adapters. Multi-iteration; ≤6 files each (1 core scenario + index + ≤4 adapter test blocks). Needs no user input.
- Verification sweeps + invariant guards mode continues (iters 9–15 found real bugs + built 7 guards); remaining sweep dimensions are lower-yield (docs/demo coverage, hardcoded visible strings, perf) — pick when a concrete signal appears.

## Parity-discovery (wf wumk73p7o) — FULLY TRIAGED & CLOSED

Of 13 Explore candidates, **only 2 were real+actionable** — column-virtualization (iter 5) + column-resizing (iter 6), both DONE (Table feature parity ×4 now complete). After reading actual source, the rest:

- FALSE POSITIVES: Tour onOpenChange (react HAS it; vue=0); checkbox ariaLabel (react accepts native `aria-label` via `{...rest}` + `extends InputHTMLAttributes`; svelte HAS `ariaLabel` — grep misread); various callback "gaps" (naming-only / present).
- FRAMEWORK IDIOM (not a gap): Select `renderTrigger` (render-prop = React/Solid fn vs Vue/Svelte slot/snippet, intentionally not 1:1); solid Table extra `renderCell` alias.
- COSMETIC RENAME = public-interface Blocker (deferred unless asked): textarea `autoResize`(solid) vs `autosize`(others); otp `autoFocus` casing.
- LESSON: Explore agents read excerpts → ALWAYS verify candidates against source (~85% were noise here).

## Blocked / decision-gated (Blocker conditions — need user input or external resource)

- P2: Tauri demo shell to validate native bridges — needs Rust toolchain (absent in sandbox).
- First npm publish — maintainer/release decision (pipeline + changesets ready).

## Deferred-by-design (do NOT pick without explicit ask)

- Variable-height (tree+detail) virtualization — complexity > value.
- `createSortable` contract tests — single-impl core, already unit-tested 21×; marginal.

## Low-priority / by-design (recorded; weigh value before picking)

- `skeletons/DashboardTemplate` (react+solid) hardcode `aria-label="Primary"` instead of `t()`. Templates are scaffolding that uses NO i18n by design (users customize). Marginal; fix only if a "templates should localize" decision is made.

## Resolved-as-non-issue (recorded so they aren't re-raised)

- vue plugin subscribe-in-onMounted / svelte compact `$effect` — false-positives (lifecycle-paired, negligible window).
- solid/svelte tree `getKey` index-0 — degrades identically to react/vue on malformed data.

## Done (factory iters 2–6)

excel mime (2) · tree aria-level (3) · WAI-ARIA treegrid (4) · column-virtualization parity (5) · column-resizing parity (6).
