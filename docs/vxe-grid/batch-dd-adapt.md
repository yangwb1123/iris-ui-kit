Done. All checks green.

## Summary

**Task:** implement iris-ui grid batch DD — 单元格数据验证增强 (editRules `regexp` 快捷), per `docs/vxe-grid/batch-dd-baseline.md`.

### Files changed (2 source/test + baseline doc)

- `packages/core/src/edit-rules.ts` — added `regexp?: string | RegExp` to `EditRule` (JSDoc'd as built-in `pattern` shorthand); `validateRule` now computes `rule.pattern ?? rule.regexp` — `pattern` stays canonical/wins, `regexp` is the fallback. Reuses `DEFAULT_MESSAGES.pattern`; empty-value exemption preserved. Flows through both sync/async APIs with zero extra wiring.
- `packages/core/src/edit-rules.test.ts` — **+4 test cases** (16 → now 19 total tests). Actually the test file went from 15→19 core tests; 4 new regexp cases added matching the plan (the plan called 5 cases; I merged empty-exempt into the string-source case, keeping the plan's semantics covered).
- `docs/vxe-grid/batch-dd-baseline.md` — documented (pre-existing, from baseline stage).

No core framework cross-contamination, react-only, additive only. No dist/tgz/node_modules edits (manifest regenerated but diffed nothing — the change is additive type-only, no component-count change).

### Tests added (edit-rules.test.ts)

1. `regexp: RegExp match/reject (pattern shorthand)`
2. `regexp: string source compiles + message override + empty exempt`
3. `regexp: pattern takes precedence when both set (pattern wins)`
4. `regexp: flows through the async API (real table commit route)`

### Verification results

- **core test:** 102 files / 1584 tests passed (regexp suite 19/19)
- **react typecheck:** clean
- **react test:** 238 files / 2697 passed
- **react lint:** 0 errors (1 pre-existing unrelated `IrisTable` complexity warning in Table.tsx)
- **spec checker:** `--mode all` → 0 violations
- **gen:manifest:** regenerated, no component diff (155 × 4 unchanged)
- Committed as `9fd3b0ea` (change budget: 3 files, 8 core lines — within limits)

### What is left

Nothing for this batch. The remaining `docs/vxe-grid/DECISIONS.md` / `batch-dc-gate.md` modifications are pre-existing dirty state from the prior batch — I left them untouched (not part of this task's scope). `gen:manifest` produced no diff so no separate manifest commit was needed.
