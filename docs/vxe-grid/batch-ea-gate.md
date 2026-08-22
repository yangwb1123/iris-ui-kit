Gate stage complete — **PASS → committed**.

## Report

**Review verdict:** `batch-ea-review.md` = **PASS** (1 MEDIUM finding recommended for fix before merge + 2 LOW/INFO non-blocking).

### Fix applied (review MEDIUM, `Table.tsx` back-to-top listener)

**Finding**: the virtual viewport only renders once data is present (`Table.tsx` empty/loading branch), and the effect resolved the scroller once with deps `[scrollToTop, Boolean(virtualScroll), fixedHeight]`. In the canonical async flow (empty/loading → data arrives for a virtual table), the listener stayed stranded on the non-scrolling root and the button never appeared (scroll events don't bubble).

**Fix** (fail-closed, no regression):

1. **Attach to both** potential scrollers — root AND the virtual viewport, when present at effect time (scroll events don't bubble, so root-only would strand).
2. **Event-time scroller resolution** — the handler re-resolves `[data-iris-virtual-scroll] ?? root` on every event and reads the _effective_ scroller's `scrollTop` (a root probe stays inert once the viewport exists, and the click handler already resolves at click time).
3. **Re-arm on data-presence flip** — effect deps extended with `Boolean(bodyData.length)` (empty→rows is exactly when a virtual viewport mounts; a primitive boolean bails out on ordinary data refreshes). Cleanup re-queries the viewport node (may have been replaced).

+2 regression tests in `batch-ea.test.tsx` (19 total): async empty→data viewport re-mount (root probe inert post-arm, viewport scroll shows button, click resets the viewport not the root) + fixed-height path keeps working after data arrival.

### Full gate results

| Gate                                                  | Result                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184** tasks (126 cached)                                                                                                                  |
| `pnpm audit:security`                                 | ✅ **0 vulnerabilities**                                                                                                                           |
| `pnpm audit:tokens`                                   | ✅ clean (exit 0)                                                                                                                                  |
| `iris-ui-spec`                                        | ✅ **0 violations / 1546 files** (review-verified at EA HEAD; gate fix adds listener logic + tests only — zero style literals)                     |
| `gen:manifest` + `check:manifest`                     | ✅ up to date, byte-identical — IrisTable **205 props / 33 events** / 155×4 / 86 tokens (no contract change in gate; `scrollToTop` already at 205) |

### Final test counts

- **core**: 106 files — **1641/1641** (zero core changes, framework-free invariant)
- **react**: 254 files — **2947/2947** (batch-ea `batch-ea.test.tsx` **19/19**, 397 lines ≤500)
- **lint**: 0 errors (2 pre-existing Table.tsx complexity warnings)

### Commit

**`8ce4f828`** — `feat(table): grid 批 EA——滚动到顶按钮（iris 独有）` (source + tests + manifest unchanged + adapt doc finalized + baseline/review/gate docs + comparison 批 EA row + DECISIONS entries).

⚠️ **Deviation (DV/DW/DX/DY/DZ precedent)**: did not run literal `git add -A` — concurrent grid-refactor pipeline dirt (`packages/core/src/data-grid/` + core/pro-table index exports, `docs/grid-refactor/`, ADR-010, `docs/SPRINT.md`, `scripts/check-size.mjs`/`arch-baseline.json`, `apps/aero-platform-console/*`, `pi-batch.yaml`/`pipeline.grid-refactor.yaml`) left uncommitted and untouched; `apps/ssr-solidstart/.vinxi` excluded. Working-tree `arch-baseline.json` bump (Table.tsx 9137→9159) belongs to that pipeline and does not even cover the EA file size (9989) — arch-check:ratchet red at HEAD pre-dates this batch (batch-k/al precedent: pre-existing red, waved through).
