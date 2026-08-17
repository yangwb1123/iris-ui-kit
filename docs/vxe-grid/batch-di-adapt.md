All work is complete and verified. Here's the report.

## 批 DI：导出多表（iris 独有）— 完成

### Files changed (commit `e5afc188`)

- `packages/react/src/primitives/table/props.ts` — new `exportNames?: Array<{ key; ref }>` prop (next to `formulaTables`)
- `packages/react/src/primitives/table/types.ts` — new `IrisTableHandle.exportMultiCsv: () => string` signature + docs
- `packages/react/src/primitives/table/Table.tsx` — `serializeRefRows()` helper, `exportNamesRef` per-render mirror, `handle.exportMultiCsv()` multi-segment assembly
- `packages/react/src/primitives/table/multi-export-csv.test.tsx` — new (294 lines, ≤500)
- `packages/manifest/manifest.json` + `llms.txt` — regenerated (required)
- `docs/vxe-grid/batch-di-adapt.md` — report

### Tests added: 14

- Gating ×2 (absent/empty → byte-identical to `exportCurrentViewCsv`)
- Multi-segment happy path; multiple-ref order
- Current-segment 3-contract inheritance: formula-materialization / mask / hidden-column exclusion
- Ref block serializes by its **own** keys; field order = first-row key order
- Empty ref rows → header only; `''` key skipped
- Stale-closure guard (rerender → latest ref)
- Ref OWASP neutralization (`=`/`+`), downloadCsv smoke

### Counts / verify

- core test: 102 files · **1584** tests ✅
- react test: 242 files · **2758** tests (incl. 14 new) ✅
- react typecheck ✅ · lint **0 errors** (2 pre-existing warnings) ✅
- `iris-ui-spec.py --mode all`: **0 violations** ✅
- `gen:manifest`: regenerated + committed ✅ (prop 189→190)

### Notable fix

The previous (timed-out) attempt had accidentally **replaced `getSelection` with `exportMultiCsv`**, breaking `group-batch-autowidth.test.tsx`. I restored `getSelection` while keeping `exportMultiCsv` — the batch-autowidth regression test now passes.

### What's left

None within this batch scope. Nothing touched in core / `exportCsv.ts` / styles / other three frameworks. Remaining dirty files (`DECISIONS.md`, `batch-dh-gate.md`, `batch-di-baseline.md`) are prior batch-runner records, intentionally left uncommitted.
