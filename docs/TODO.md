# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- [ ] P0: contract tests — add `@iris-ui/core/contracts` scenarios for `createSortable` (press→tryStart→over→end transitions) so all 4 adapters assert identical store migrations.
- [x] ~~P0: excel export mime — drop non-standard `;charset=utf-8;`~~ done (iter 2).

## Later

- [ ] P1: a11y audit of virtualized tree rows (aria-level/setsize/grid roles).
- [ ] P1: horizontal/2D virtualization primitive.
- [ ] P2: Tauri demo shell to validate native bridges (BLOCKED: Rust toolchain absent → Blocker report).

## Deferred-by-design (do NOT pick without explicit ask)

- Variable-height (tree+detail) virtualization — complexity > value.
- First npm publish — maintainer/business decision (Blocker conditions: public release).

## Resolved-as-non-issue (recorded so they aren't re-raised)

- vue plugin subscribe-in-onMounted / svelte compact `$effect` — false-positives (lifecycle-paired, negligible window).
- solid/svelte tree `getKey` index-0 — degrades identically to react/vue on malformed data.
