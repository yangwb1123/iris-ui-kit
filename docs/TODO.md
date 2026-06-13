# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- (empty) — explicit P0/P1 roadmap exhausted; all real parity gaps closed (iters 2–6). Remaining items are Blocker-gated or marginal (below).

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

## Resolved-as-non-issue (recorded so they aren't re-raised)

- vue plugin subscribe-in-onMounted / svelte compact `$effect` — false-positives (lifecycle-paired, negligible window).
- solid/svelte tree `getKey` index-0 — degrades identically to react/vue on malformed data.

## Done (factory iters 2–6)

excel mime (2) · tree aria-level (3) · WAI-ARIA treegrid (4) · column-virtualization parity (5) · column-resizing parity (6).
