# TODO

> Current actionable backlog. Pulled from ROADMAP P0/P1 + review residue. One line each; promote to an iteration when picked.

## Now (next iterations)

- [ ] P1 (iter 6): port Table **column resizing** (resizableColumns/columnWidths/onColumnWidthsChange + resize handles) to solid+svelte — VERIFIED gap (solid 0/0/0; svelte prop-stub only; react/vue full). Additive/opt-in. Same shape as column-virt.
- [ ] P0: contract tests — add `@iris-ui/core/contracts` scenarios for `createSortable`.

### Parity-discovery (wf wumk73p7o) triage — VERIFIED before acting

- REAL+large: column resizing (above).
- REAL+cosmetic (rename = public-interface Blocker; only via additive alias): textarea `autoResize`(solid) vs `autosize`(others); otp-input `autoFocus` casing. Low priority.
- NEEDS deeper check (grep ambiguous): checkbox aria-label (react/svelte may handle via rest-spread); Banner close-callback naming; Select renderTrigger; Table custom-cell-render signature.
- FALSE POSITIVE (dismissed): Tour onOpenChange "missing in react" — react HAS it (vue=0). Explore agents are excerpt-based → always verify.
- [x] ~~P0: excel export mime — drop non-standard `;charset=utf-8;`~~ done (iter 2).

## Later

- [x] ~~P1: a11y of tree rows — aria-level (iter 3) + aria-setsize/posinset + role=treegrid (iter 4). WAI-ARIA treegrid pattern complete ×4.~~
- [x] ~~P1: horizontal/2D virtualization — columnVirtualization ported to solid+svelte (iter 5); all 4 at virtualization parity.~~
- [ ] P2: Tauri demo shell to validate native bridges (BLOCKED: Rust toolchain absent → Blocker report).

## Deferred-by-design (do NOT pick without explicit ask)

- Variable-height (tree+detail) virtualization — complexity > value.
- First npm publish — maintainer/business decision (Blocker conditions: public release).

## Resolved-as-non-issue (recorded so they aren't re-raised)

- vue plugin subscribe-in-onMounted / svelte compact `$effect` — false-positives (lifecycle-paired, negligible window).
- solid/svelte tree `getKey` index-0 — degrades identically to react/vue on malformed data.
