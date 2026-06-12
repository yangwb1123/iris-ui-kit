# STATE

> Compression snapshot — refreshed every 5 iterations. Continue from this to minimize context re-reads.

**当前架构 (Architecture):** 5 layers (tokens → theme → core controllers → 4 adapters → plugins). Behavior in `@iris-ui/core`; adapters are thin reactivity bridges. See `ARCHITECTURE.md`. 25 packages, CI + changesets, 126/126 gates green, 0 skipped tests.

**已完成 (Done) — latest cycle:** cross-platform arc (touch-DnD `createSortable`, safe-area/dvh, file-save/clipboard registries, deploy docs) + enterprise-table (tree hierarchical sort, flat+tree virtualization ×4, solid/svelte gained virtual path) + color-mix legacy fallback (zero modern regression) + self-review fixes (copy-button regression, svelte drawer Escape/token) + `useFieldArray` solid/svelte. ROADMAP v2 (R1–R86) fully implemented earlier.

**未完成 (Open):** P0 — excel mime charset cleanup; `createSortable` contract tests. P1 — virtual-tree a11y audit; 2D/horizontal virtualization; Tauri demo (BLOCKED: no Rust toolchain). P2 — npm publish (maintainer-gated); plugin/MCP expansion.

**技术债 (Debt):** all Low/cosmetic post self-review. Excel charset param the only concrete item.

**下一步推荐 (Next):** Iteration N+1 = P0 excel-mime cleanup (≤5 files, react+vue) OR `createSortable` contract tests. Both small, isolated, correctness/debt-priority.

**Iteration count since last STATE refresh:** 1 (this = factory bootstrap: `/docs/` memory system established).
