Working tree clean, commit `916d4209` complete. All gates green.

## Report — 批 DO：单元格右键格式（iris 独有）

**Batch nature**: verification-style baseline. The feature was already shipped at `61ec5418` (pre-existing commit). This session verified every spec anchor against source, closed the baseline's 2 actionable non-blocking observations with explicit tests, ran all gates, and committed.

**Files changed (5, commit `916d4209`)**:

| File                                                            | Change                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | **+2 tests** (13 total, 312 lines ≤500)                                        |
| `docs/vxe-grid/DECISIONS.md`                                    | DO baseline/adapt records                                                      |
| `docs/vxe-grid/batch-do-baseline.md`                            | baseline artifact (baseline stage rewrite)                                     |
| `docs/vxe-grid/batch-do-adapt.md`                               | this report (placeholder rewritten)                                            |
| `docs/vxe-grid/batch-dn-gate.md`                                | leftover DN gate-stage rewrite, committed with the batch (DN-commit precedent) |

**Tests added (2)** — verified implementation matches spec: (1) format keys never reach user `onSelect` (custom user item still routes through); (2) zero-commit — `format-number` on a text cell and `format-upper` on a number cell leave data byte-identical, `onDataChange` not called. Observation #3 (toFixed(2) writes back a string) is spec-inherent, not actionable.

**Verified anchors**: `formatActions?: boolean` opt-in default false (`props/query.ts:232`) · keys at `table-constants.ts:18-19` · menu mounted after copy/clear before annotate (`Table.tsx:3041-3048`) · `formatContextSelection` with range fallback, formula/locked/readonly skip, byte-identical no-match (`Table.tsx:2947-2979`) · `commitRowList(next,'edit')` funnel (`Table.tsx:3282`) · interception before user callback (`Table.tsx:8917-8918`) · zh `plugin-locale-zh:72-73` + en `i18n-messages.ts:87-88`.

**Counts**:

- core test: 104 files / **1597** tests ✓
- react typecheck ✓ · react test: 246 files / **2818** ✓ (+2)
- react lint: **0 errors** (2 pre-existing `Table.tsx` complexity warnings, untouched)
- `iris-ui-spec.py --mode all`: **0 violations** (1535 files)
- DO suites: **43** tests (13+13+17) — `batch-dl-dt` 13 · `context-quick-actions` 13 · `context-menu-select` 17
- `pnpm gen:manifest`: regenerated → **no diff** (155×4, 86 tokens; format keys are UI constants, not manifest entities)
- commit hooks: filesize pass, change-budget pass (5 files, 0 core logic lines)

**Constraints honored**: core framework-free (zero core/vue/solid/svelte/types/style changes, additive only), no dist/tgz/node_modules/manifest edits, test files ≤500 lines (256→312), manifest scanner hygiene untouched (no new exported types needed).

**What is left**: Nothing blocking. All spec points verified, both actionable baseline observations now covered by explicit tests, gates all green, manifest current, committed.
