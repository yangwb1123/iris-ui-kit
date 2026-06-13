# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- **P1 (in progress) — Select keyboard-navigation parity (real a11y defect, found iter-20 audit):** react `IrisSelect` has full roving keyboard (Arrow/Home/End/Enter/Escape/typeahead). Gaps: **(a) vue `IrisSelect` has NO keyboard nav at all** (biggest — keyboard users cannot navigate it; `packages/vue/src/primitives/select/Select.ts`); **(b) svelte `IrisSelect` lacks ARROW nav** (`handleListKeyDown` does only Escape+typeahead; `packages/svelte/src/primitives/select/IrisSelect.svelte`); ~~(c) solid lacked Home/End~~ DONE iter-20. NOTE the architectures diverge on active-option marking/focus: react uses `activeIndex` + DOM-focuses the active option (`[data-iris-select-option-index]`); solid uses `activeIndex` + background highlight (no focus); svelte uses DOM focus + typeahead. Mirror react's `activeIndex`/`nextEnabledIndex`/`firstEnabledIndex`/`lastEnabledIndex` model per framework. Do vue + svelte as separate gated commits (each ~1 component + test). Verify no regression to the existing open/click/typeahead behavior.

- **P1 (in progress): expand `@iris-ui/core/contracts`** — the cross-framework behavior-contract harness now covers **8 components** (tabs/switch/checkbox/accordion + iter-16 segmented/toggle-group/slider + iter-17 radio), each event-script asserted identical ×4 adapters; the form-control family is fully covered. Turns "parity by author discipline" (also guarded structurally by the manifest parity test) into asserted BEHAVIORAL parity. Next contract candidates (consistent ×4 selectors, deterministic uncontrolled/keyboard behavior): **tree** expand/select (`aria-expanded`/`aria-selected` — exercises the shared expansion + tree-selection controllers, renders inline = no portal), **select/combobox** open→option-select (CAVEAT: options may render in a portal outside the test container → the container-scoped driver `queryAll` won't see them; needs a document-scoped driver or `disablePortal`), **dropdown-menu** roving focus. Deeper goal: drive a controller-level scenario (selection/sort/expansion/data-source store migrations) through all 4 adapters — **tree** is the natural next step toward this. Multi-iteration; ≤6 files each (1 core scenario + index + ≤4 adapter test blocks). Needs no user input.
- Verification sweeps + invariant guards mode continues (iters 9–15 found real bugs + built 7 guards; iter-18 a **source-level parity audit** found solid tree had zero keyboard nav → fixed). NEW high-yield sweep dimension proven: **per-component cross-framework BEHAVIORAL audit** (read all 4 impls of a stateful component side-by-side, diff the interaction surface — keyboard handlers, aria attrs, focus mgmt). The name-parity guard can't see these. Candidates to audit next: tabs/menu/listbox keyboard, dialog focus-trap, combobox.
- ~~Residual tree-keyboard parity~~ — DONE (iter-19): svelte tree gained Home/End + `aria-level`. All 4 adapters' standalone Tree now implement the full WAI-ARIA keyboard pattern identically.

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
