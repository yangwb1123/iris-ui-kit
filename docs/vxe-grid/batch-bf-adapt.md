All green. Final verification summary:

## Report — batch BF: 数据导出时间线 (`exportVersionCsv`)

### Files changed (exactly 3, per baseline file map)

| File                                                              | Change                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                    | +2: `exportVersionCsv: (index: number) => string` on `IrisTableHandle`, after `restoreVersion` — single-line function prop, JSDoc documenting PRE-change semantics + `''` for unknown/no-prop                                                       |
| `packages/react/src/primitives/table/Table.tsx`                   | +14: handle method after `restoreVersion` — `history.get(index)` → `undefined` → `''`; else the exact batch-AP pipeline `exportCsv(withComputedFormulaCells(entry.rows, viewColumnsRef.current, formulaTablesRef.current), viewColumnsRef.current)` |
| `packages/react/src/primitives/table/export-version-csv.test.tsx` | new, 147 lines (≤500): 8 tests                                                                                                                                                                                                                      |

(`docs/vxe-grid/DECISIONS.md` M + `batch-bf-baseline.md`/`batch-be-gate.md` ?? are pre-existing stage-runner entries, untouched by me.)

### Tests added (8, per baseline plan)

1. **导出历史版 core**: `exportVersionCsv(0)` = initial rows after first commit
2. Per-commit pre-change semantics: version 1 = state between commits; differs from live view
3. **越界返回空**: `99`/`-1` → `''` (never throws)
4. Ring-trimmed `max: 1`: popped index → `''`, surviving index still exports
5. Inert without `versionHistory` prop → `''`
6. **对比**: after `restoreVersion(0)`, `exportVersionCsv(0) === exportCurrentViewCsv()` byte-identical (locked invariant)
7. Mask consistency (batch AY): `sensitive` mask applied on historical snapshot
8. Formula materialization on shadow rows + hidden-column exclusion

### Verification (all pass)

- core test: **1457/1457** (94 files)
- react typecheck: clean
- react test: **2140/2140** (190 files, incl. 8 new)
- react lint: **0 errors** (1 pre-existing `IrisTable` complexity warning)
- spec validator `--mode all`: **0 violations**
- `gen:manifest`: regenerated — **no diff** (155 components; handle methods are manifest-invisible by design, same as `restoreVersion`/`exportSelectionCsv`)

### Constraints honored

- Core framework-free: zero core changes (controller `get` already existed); react-only, additive-only (one new handle method, no props/i18n/panel changes)
- No dist/tgz/node_modules edits; CSS untouched (no new styling needed)
- Manifest hygiene: single-line function prop, existing exported interface reused

### Left (deliberate, per baseline fiats)

- No UI export button on the version-history panel (spec is handle-only; `restoreVersion` + `exportCurrentViewCsv` covers the panel path)
- Formula materialization uses current formula state (documented approximation — same as restore-then-export)
