Baseline complete and verified. All anchors confirmed against current code.

## Summary

**Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-bc-baseline.md` (231 lines). Zero source files touched — `git status` shows only the new doc.**

**Key findings baked in (every claim verified against current code):**

1. **Core evaluator extension** (`packages/core/src/formula.ts`):
   - `!` added to TOKEN_RE (L54) as a new `bang` token; `parsePrimary`'s ident branch (L166-183) resolves `table!field` → `formulaTables[table][0][field]` via a new `resolveTableField` — **fail-closed**: missing tables arg / missing table / empty table / missing field → whole formula null, mirroring the batch-AO "unknown field poisons the formula" contract; a known nullish field still coerces (Excel parity).
   - `memoizedFormulaValue` cache key extends to **(row, tablesRef, formula)** via nested WeakMaps + a module sentinel for 2-arg calls — byte-compatible with the AO cache behavior; `evaluateFormula` gains an optional 3rd param, backward-compatible.
2. **React threading** — `formulaTables?: Record<string, Row[]>` on `IrisTableProps` (propCount 146→147); **dual-channel design**: module-level `currentFormulaTables` serves the 30 render-time `getCellValue` call sites + querySortedData comparator (React's synchronous render walk guarantees isolation), while the 2 CSV-export handle call sites (`exportCurrentViewCsv` L3356, `exportSelectionCsv` L3370) take an explicit param from the `formulaTablesRef` mirror — multi-table pages would otherwise race (flagged as fiat 2). `useTableSort.ts` is a **4th evaluation point** discovered (L65-66) — gains an optional `formulaTables` option threaded into `buildSorter` with dep-array updates.
3. **File map**: 4 mandated edits (formula.ts / props.ts / Table.tsx / useTableSort.ts) + 2 new test files + optional types.ts doc touch — BB-structure aligned.
4. **Test plan**: ~17 core cases (跨表取值、组合运算、函数实参、**缺失表**、**缺失字段**、空表、feature-off、nullish 强制转换、非法 bang 位置、边界、memo 键) + ~10 react cases (渲染、排序、过滤、两条 CSV handle、display-only、immutable 重算).
5. **6 numbered fiats** for gate arbitration — including the two flagged calls: fail-closed poison semantics (missing table/field → whole formula null, not local 0) and the dual-channel threading rationale.
