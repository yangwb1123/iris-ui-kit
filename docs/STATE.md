# STATE

> Compression snapshot — refreshed every 5 iterations. Continue from this to minimize context re-reads.

**当前架构 (Architecture):** 5 layers (tokens → theme → core controllers → 4 adapters → plugins). Behavior in `@iris-ui/core`; adapters are thin reactivity bridges. See `ARCHITECTURE.md`. 25 packages, CI + changesets, **126/126 gates green**, 0 skipped tests.

**已完成 (Done) — factory iters 1–4 (this cycle):**

- iter 1: established `/docs/` memory system.
- iter 2: excel export mime cleanup (dropped non-standard charset).
- iter 3: tree-row `aria-level` ×4.
- iter 4: completed WAI-ARIA **treegrid** ×4 (core `flattenTree` `setSize`/`posInset` → `aria-setsize`/`aria-posinset` + `role="treegrid"` on keyboard-navigable tree tables).
- Prior cycle: cross-platform arc (touch-DnD, safe-area/dvh, file-save/clipboard registries) + enterprise-table (tree hierarchical sort, flat+tree virtualization ×4, solid/svelte gained virtual path) + color-mix legacy fallback. ROADMAP v2 (R1–R86) fully implemented earlier.

**未完成 (Open) — see `TODO.md`:**

- P1: horizontal/2D virtualization primitive (vertical + column virt already exist; verify the actual gap before committing — may be small). NOTE: a full impl likely touches >5 files → **decompose into ≤5-file iterations** (core range helper → per-fw wiring), else it hits the >10-file Blocker.
- P2 (BLOCKED — Blocker conditions): Tauri demo shell (needs Rust toolchain, absent in sandbox); first npm publish (maintainer/release decision).

**技术债 (Debt):** all Low/cosmetic. None High/Medium open.

**下一步推荐 (Next):** Explicit roadmap P0/P1 now exhausted (iter 5 closed the last — column-virt parity). Remaining named items are BLOCKED (Tauri toolchain, npm-publish decision). Phase 0 RE-DISCOVERY in progress: a cross-framework PARITY audit (column-virt proved gaps exist) to auto-find new bounded work. If it surfaces real gaps → implement top ones as ≤5-file iterations. If it confirms parity → the project is at a quality plateau; refresh roadmap + surface the strategic Blockers (publish) rather than manufacture churn.

**Iteration count since last STATE refresh:** 1 (iter 5).
