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

**下一步推荐 (Next):** Iteration 5 = scope the 2D/horizontal virtualization gap (Phase 1 read of the existing column-virtualization in Table + `computeVirtualRange` in core). If the gap is real and large, decompose; if already mostly covered, mark P1 done and pick the next. Otherwise the remaining roadmap is blocked/strategic → surface a Blocker for publish/Tauri rather than manufacture churn.

**Iteration count since last STATE refresh:** 0 (just refreshed at the iter-4/5 boundary).
