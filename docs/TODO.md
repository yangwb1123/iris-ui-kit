# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- ~~Select keyboard-navigation parity~~ — **DONE (iters 20–21).** All four adapters' `IrisSelect` now have full WAI-ARIA listbox keyboard nav (Arrow/Home/End/Enter/Escape/typeahead). Net real gaps fixed: solid lacked Home/End (iter-20); svelte lacked arrows + open-focus (iter-21). **vue was a FALSE alarm** — it composes `IrisPopover` + `IrisList`, and `IrisList` already supplies full keyboard nav (the iter-20 audit grep was dir-scoped + missed the delegation; verified before touching vue, so no wasted edit). LESSON reinforced: when a component COMPOSES others, audit the composed primitives too, not just the wrapper's own file.

- **P1 DONE: `@iris-ui/core/contracts` expansion** — harness now **17 scenarios** across 14 components (form controls + single/multi-select + navigation + flagship Table's sort/multi-select/row-expand trio + **Tree keyboard, the last deferral, unblocked iter-33**), each asserted identical ×4, guarded by the iter-32 contract-coverage CI test. The harness paid for itself twice (pagination iter-24, table-select iter-30 — both real a11y bugs caught). **Only remaining contract = Table column-resize** (pointer-drag with coords, jsdom-awkward, low value — pick only on concrete need). Portal-gated overlays (select/combobox/dropdown-menu/dialog) stay deferred — Blocker-gated (need unified portal-disable props = public-API change). **The pagination contract paid for the whole harness** — caught a real Solid uncontrolled-`aria-current` bug (iter-24) per-fw unit tests missed. Thesis validated.
- **NEXT primary thread — resume source-level a11y behavioral audits** (the other high-yield dimension): already CLEAN (don't re-run): tabs/menu/combobox keyboard, dialog/drawer focus-trap. Candidates not yet audited: listbox/select `aria-activedescendant` vs roving-focus, accordion/disclosure keyboard, toast/notification auto-dismiss timing + pause-on-hover, form-field↔control error wiring (`aria-invalid`/`aria-describedby`), menu typeahead. Diff all 4 impls; fix gaps; lock with a test. **Harness gotcha discovered (iter-23):** a component whose accessible element is its ROOT (e.g. Rating's `role="slider"`) needs the Vue harness to wrap it in a host `<div>` (the driver's container-scoped `querySelectorAll` matches descendants only, not the container itself); and two components sharing a generic role (Rating + Slider both `role="slider"`) cannot co-exist in svelte's single shared `ContractsHarness.svelte` if any scenario asserts a global count for that role → give such a component its own dedicated harness (mirrors React's per-test isolated containers). Turns "parity by author discipline" (also guarded structurally by the manifest parity test) into asserted BEHAVIORAL parity. Next contract candidates (consistent ×4 selectors, deterministic uncontrolled/keyboard behavior): **tree** expand/select (`aria-expanded`/`aria-selected` — exercises the shared expansion + tree-selection controllers, renders inline = no portal), **select/combobox** open→option-select (CAVEAT: options may render in a portal outside the test container → the container-scoped driver `queryAll` won't see them; needs a document-scoped driver or `disablePortal`), **dropdown-menu** roving focus. Deeper goal: drive a controller-level scenario (selection/sort/expansion/data-source store migrations) through all 4 adapters — **tree** is the natural next step toward this. Multi-iteration; ≤6 files each (1 core scenario + index + ≤4 adapter test blocks). Needs no user input.
- Verification sweeps + invariant guards mode continues (iters 9–15 found real bugs + built 7 guards; iter-18 a **source-level parity audit** found solid tree had zero keyboard nav → fixed). NEW high-yield sweep dimension proven: **per-component cross-framework BEHAVIORAL audit** (read all 4 impls of a stateful component side-by-side, diff the interaction surface — keyboard handlers, aria attrs, focus mgmt). The name-parity guard can't see these. Candidates to audit next: tabs/menu/listbox keyboard, dialog focus-trap, combobox.
- ~~Residual tree-keyboard parity~~ — DONE (iter-19): svelte tree gained Home/End + `aria-level`. All 4 adapters' standalone Tree now implement the full WAI-ARIA keyboard pattern identically.

## Parity-discovery (wf wumk73p7o) — FULLY TRIAGED & CLOSED

Of 13 Explore candidates, **only 2 were real+actionable** — column-virtualization (iter 5) + column-resizing (iter 6), both DONE (Table feature parity ×4 now complete). After reading actual source, the rest:

- FALSE POSITIVES: Tour onOpenChange (react HAS it; vue=0); checkbox ariaLabel (react accepts native `aria-label` via `{...rest}` + `extends InputHTMLAttributes`; svelte HAS `ariaLabel` — grep misread); various callback "gaps" (naming-only / present).
- FRAMEWORK IDIOM (not a gap): Select `renderTrigger` (render-prop = React/Solid fn vs Vue/Svelte slot/snippet, intentionally not 1:1); solid Table extra `renderCell` alias.
- COSMETIC RENAME = public-interface Blocker (deferred unless asked): textarea `autoResize`(solid) vs `autosize`(others); otp `autoFocus` casing.
- LESSON: Explore agents read excerpts → ALWAYS verify candidates against source (~85% were noise here).

## Low-priority sweep findings (recorded; weigh value before picking)

- **plugin-notifications hardcoded aria-labels** (found iter-34 i18n sweep): `IrisNotificationCenter` hardcodes `aria-label="Dismiss"` + `aria-label="{n} unread"` in all 4 adapters — user-visible screen-reader strings not localizable. This plugin uses **prop-based** localization (`title`/`emptyText` props with English defaults), NOT the core `t()` system, so the consistent fix = add defaulted props (`dismissLabel`, `unreadLabel`) ×4 (additive/backward-compat, completes the existing prop pattern). Deferred: marginal value, expands 4 plugin APIs. Pick only if a localization need is raised. NOTE: the core primitives (Breadcrumb/Pagination/Table/etc.) correctly use `t()` — this gap is isolated to the notifications plugin's prop-based design.

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
