All checks pass. The batch DT work was already fully landed at HEAD (commit `61ec5418`, an ancestor of HEAD `28d5fcf5`) as the baseline documented — this pass was verification + manifest regen.

## Report: batch DT（表格导出选择，iris 独有）

**Status**: ✅ Complete — spec already implemented at `61ec5418` ("feat(adapters): align primitives and grid capabilities"), verified here end-to-end. **Zero source changes needed; nothing to commit.**

### Anchors (spec-literal)

- **Handle contract** — `packages/react/src/primitives/table/types/handle.ts:38`:
  `exportRowsCsv: (keys: Array<string | number>) => string` — pure handle method, single-line, named exported interface `IrisTableHandle` (hygiene ✓, no new types).
- **Implementation** — `Table.tsx:3464-3472`: `new Set(keys)` → `bodyDataRef.current.filter((row, i) => wanted.has(rowKeyOf(row, i)))` → empty → `''` → `exportCsv(withComputedFormulaCells(rows, viewColumnsRef.current, formulaTablesRef.current), viewColumnsRef.current)` — byte-identical serializer pipeline to `exportSelectionCsv` (formula materialization + mask + hidden-column exclusion), body order preserved, unknown keys silently skipped.
- **Test** — `test/batch-dl-dt.test.tsx:485-489` (DT 定向: `exportRowsCsv([3, 1])` → `'Name,City,Amount\nalice,Paris,1.2\ncara,Berlin,4'`), file total **492 lines ≤ 500** ✓. Additive-only: react handle + Table.tsx + test (3 files), core/other frames/`exportCsv.ts` untouched, no CSS touched.

### Verification results

| Gate                                            | Result                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm --filter @iris-ui-kit/core test` | ✅ 104 files / **1597/1597**                                                                                                                                                       |
| `--filter @iris-ui-kit/react typecheck`         | ✅ tsc --noEmit clean                                                                                                                                                              |
| `--filter @iris-ui-kit/react test`              | ✅ 246 files / **2826/2826** (incl. DT + AP/mask/跨表公式 回归)                                                                                                                    |
| `--filter @iris-ui-kit/react lint`              | ✅ **0 errors** (2 pre-existing `complexity` warnings on the monolithic `IrisTable` render fn — untouched by DT)                                                                   |
| `iris-ui-spec.py --mode all --json`             | ✅ 1535 files, **0 violations**                                                                                                                                                    |
| `pnpm gen:manifest`                             | ✅ regenerated — **zero diff** (manifest already in sync at HEAD; scanner doesn't enumerate handle methods by design, consistent with `exportSelectionCsv`/`exportCurrentViewCsv`) |

### Files changed

- None by this pass (implementation, contract, test all landed at `61ec5418`).
- Working tree retains only the 3 pre-existing batch doc edits (`DECISIONS.md`, `batch-ds-gate.md`, `batch-dt-baseline.md`) — baseline explicitly says 工作区既有改动未触碰, so left uncommitted.

### What is left

- Nothing source-side. Commit requirement satisfied in substance: `gen:manifest` is a no-op because the manifest was already regenerated and committed at HEAD with the DT capability.
- Baseline's 4 non-blocking review observations from the original gate remain noted (no negative-case tests for empty/unknown keys; hidden-column/formula/mask behavior proxied through the AP pipeline rather than line-locked; no string-key/rowId-fallback assertion). They were accepted as non-blocking by the original `batch-dt-gate.md` review, and the spec's required scope (指定 keys 导出 + 指定行导出测试) is fully covered.
