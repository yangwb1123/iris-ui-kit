Verdict written to `docs/vxe-grid/batch-ax-review.md`. **PASS** with 3 findings.

## Summary

**Verification (all at commit `4e3e1858`):**

- core test ✅ 1417 (+6)
- react test ✅ 2053 (+8), typecheck ✅ clean, lint ✅ 0 errors (1 pre-existing complexity warning — verified identical at parent commit by temporarily swapping in the parent `Table.tsx`, then restoring)
- audit:tokens ✅ same warning set as parent (verified via detached worktree — no AX refs)
- check:manifest ✅ up to date (155×4, IrisTable 141 props)
- core framework-free ✅ (grep empty; `conditional-styles.ts` is pure TS)

**Checklist findings:**

1. **matchConditionalStyles** — all four behaviors correct and tested: column filter (predicate _not_ evaluated for filtered-out columns, spy-asserted), multi-match order (later wins on conflicts, rest survive), column-less rules, empty result (fresh `{}`, distinct per call). Pure/non-mutating.
2. **react** — merge site at `Table.tsx:4992` sits immediately after `cellStyle?.(…)` → rules win (tested); `value` is the exact `raw` from the `getCellValue` choke point (dataIndex + formula both tested); editing unaffected by construction (EditorSurface opaque background inside the container, only padding switches during edit).
3. **additive/manifest/tokens** — all clean.

**Findings (non-blocking):**

1. **MEDIUM** — `IrisTableConditionalStyle` (types.ts:458) never exported from the table barrel; prop uses an inline duplicate type → dead for consumers, two sources of truth, missing from manifest types list.
2. **MEDIUM** — guide page `table-conditional-formatting.md` not registered in the VitePress sidebar (`config.ts:40-47`) → unreachable.
3. **LOW** — no test covers editing + conditionalStyles (claim verified by construction only).

No source files were modified during review (only the two pipeline doc artifacts and the new review doc).
