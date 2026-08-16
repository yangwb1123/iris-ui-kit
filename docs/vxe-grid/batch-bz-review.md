**Verdict: PASS** — written to `/home/u1/iris-ui/docs/vxe-grid/batch-bz-review.md` (no source files modified).

## Review summary

**Implementation inspected** (commit `e6e01ae5`): `IrisTableHandle` +2 handle-only methods — `exportStateJson()` (9 spec blocks from the shared `persistSnapshot` collector, `multiSortState` stripped at the boundary) and `importStateJson(json)` (reuses `applyViewSnapshot`: query-first, per-piece eligibility + type guards, `pageSize` → `onPageChange(1,size)` + exactly one request, `expandedKeys` full-set replace; invalid JSON/non-object → `false` zero-apply). Two ref mirrors (`persistSnapshotRef`/`applyViewSnapshotRef`) correctly solve the mount-closure staleness problem; 12 new tests.

**Verification re-run independently:**

- core test **1517/1517** · react test **2385/2385** (+12) · react typecheck clean · react lint 0 errors (1 warning: Table.tsx:1786 complexity 279/70 — pre-existing; BZ removed a branch, so complexity went _down_, and the handle arrows are separate functions)
- **check:manifest up to date** (165/31 unchanged; both react + union `tableRef` descriptions regenerated)
- **audit:tokens**: pre-existing warnings only (Solid Tree / Vue admin) — BZ touches zero styling

**Checklist results:**

- **Spec correctness** ✅ — all 9 blocks, lazy gating, round-trip byte-identity, invalid-input semantics all match baseline and are tested
- **Additive only** ✅ — core/vue/solid/svelte/theme/tokens/styles.ts byte-identical; traced all three `persistSnapshot` consumers to confirm the collector gate-widening is behavior-neutral (persist save loop has no `query` key + `hasConfig` gate; views config-gated)
- **Manifest hygiene** ✅ · **core framework-free** ✅ (zero core changes, react-only per BF/BV precedent) · **CSS tokens** ✅ (no styling added)

**Findings (4, all non-blocking):**

1. **LOW** — Table.tsx:4651 / types.ts:631: "restorable" doc claim vs collector: `pageSize` captured whenever `proxyConfig` exists (unimportable without `onPageChange`), `query` whenever set (unimportable without `onQueryChange`). Inherited AG/AJ semantics; round-trip unaffected.
2. **LOW** — Table.tsx:2758-2759: stale `persistState`/`views` memo deps after gate removal (harmless).
3. **INFO** — adapt reports 483 test lines; actual 482.
4. **INFO** — baseline anchors drifted a few lines post-commit (cosmetic).
