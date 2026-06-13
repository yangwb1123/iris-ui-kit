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

**下一步推荐 (Next):** iters 7–8 fixed a real a11y bug (Select trigger `aria-haspopup` was `dialog`, should be `listbox`; react+vue, via the popover-trigger default). Follow-up targeted audits all confirmed SOUND (no further gaps): the haspopup thread (date-pickers correctly `dialog`, menus `menu`), Select active-option (valid roving-focus, not a gap), changesets (pre-release `0.0.0` + `initial-release.md` covers v0.1.0). The verified-audit method (targeted concern → read source → fix ×4) works; broad Explore discovery is ~85% noise.
Combobox/Autocomplete was checked as a candidate NEW component but ALREADY EXISTS ×4 with the full WAI-ARIA pattern (verified — 3rd time verification prevented wasted work: parity-discovery noise, then nearly-duplicated Select-haspopup, now nearly-rebuilt an existing Combobox). **No confirmed non-blocked feature gaps remain.** Library is feature-complete, parity-complete, accessible, well-tested. Continued iterations are now VERIFICATION (confirming soundness — legitimate quality work but produces no code change since nothing is broken) rather than feature/fix. Genuine next progress requires a USER DIRECTION (publish v0.1.0? new product thrust? Angular/Qwik adapter?) or unblocking a gated item (Tauri toolchain). Do NOT manufacture cosmetic/marginal churn — violates priority order (quality > motion).

**Iteration count since last STATE refresh:** 4 (iters 5–8). iters 7–8 + verification sweep this session.
