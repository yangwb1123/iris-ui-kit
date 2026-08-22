Done. Batch DN (列头统计) delivered and verified.

## Report

**Nature of the batch**: The baseline was written in **verification-style** — the feature (`headerStats`) was already fully shipped at commit `61ec5418` (pre-existing commit, not this session). This session verified every spec point against source, closed the one flagged gap, ran the full gate, and recorded/committed the batch.

**Files changed (4, committed `8258df80`)**:

| File                                                            | Change                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | **+1 test**: grouped-header DN regression (leaf header shows `n=3 · avg=2.57`; group row + text leaf stay empty) — closes baseline's flagged gap; now 256 lines (≤500) |
| `docs/vxe-grid/DECISIONS.md`                                    | batch DN baseline/gate records                                                                                                                                         |
| `docs/vxe-grid/batch-dm-gate.md`                                | gate record (pre-existing `M`)                                                                                                                                         |
| `docs/vxe-grid/batch-dn-baseline.md`                            | baseline (this task's file)                                                                                                                                            |

**Zero source/manifest/core/vue/solid/svelte changes** — implementation verified as spec-exact, additive, fail-closed (default off → zero DOM):

- Prop `headerStats?: boolean` (`props/advanced.ts:201`), destructured `= false` (`Table.tsx:287`)
- `headerStatsByKey` useMemo over **current body** (`Table.tsx:3951-3967`): finite-number-only via `getCellValue`, zero-finite columns skipped, deps `[headerStats, leafColumns, bodyData]`
- Flat (`:8670-8683`) + grouped leaf (`:8431-8444`, `isLeaf` guard) render; text `n=N · avg=X.XX` (`toFixed(2)`), `aria-label`, `data-iris-header-stats`; muted 12px token styling (`--iris-muted`/`--iris-font-size-xs`/`--iris-space-xxs`); distinct from footer `columnTotals`

**Tests added: 1** (grouped path; existing flat DN test pre-shipped)

**Gate results**:

- core test: **104 files / 1597 tests ✓**
- react typecheck ✓ · react test **246 files / 2816 tests ✓** (was 2815)
- react lint: **0 errors** (2 pre-existing complexity warnings on `Table.tsx`, untouched)
- `iris-ui-spec.py --mode all`: **0 violations** (1535 files)
- `pnpm gen:manifest`: regenerated — **no diff** (manifest/llms.txt already current: `headerStats` ×2 + llms props list; 155 components × 4 frameworks)

**What is left**: Nothing blocking. The two lint warning lines and the grouped-path coverage note in the baseline are now fully addressed; commit hook budget check passed (4 files, 0 core lines).
