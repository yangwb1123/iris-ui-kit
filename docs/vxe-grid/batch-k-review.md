Review complete. Verdict written to `docs/vxe-grid/batch-k-review.md`.

## Verdict: **FAIL** — 2 verified functional races + 1 gate failure

**Verification run:** 1626/1626 react tests (incl. 8 new row-mode/M1/M2 tests) ✓ · typecheck ✓ · lint 0 errors (1 pre-existing complexity warning) ✓ · build ✓ · RSC ✓ · manifest up-to-date (155/155) ✓ · core untouched / framework-free ✓ · token audit diff-identical to HEAD ✓ · arch-check & audit:tokens fail identically at HEAD → pre-existing, not K's fault.

**Checklist results:**

1. **Row mode** — all PASS: all editable columns open on click (`beginRowEdit`), per-cell Enter/blur commit, Escape cancels all, row switch commits previous (sync failure blocks), no-editable-columns click no-ops, cell mode default unchanged (291 pre-existing table tests pass).
2. **M1** — PASS, verified with scratch tests: async Tab defers via `pendingNavRef` + settle-observer, lands on success, stays on failure; sync Tab immediate; **focus empirically confirmed** to land on the next editor after deferred navigation.
3. **M2** — primary scenarios pass, but **race found**: an in-flight `lazyLoad` resolving _after_ a data refresh re-seeds the cleared cache with stale children (reproduced empirically — stale row renders post-refresh).
4. **Additive/hygiene** — PASS except `pnpm format:check` fails on Table.tsx + the new test (3 trivial prettier spots; HEAD was clean).

**Findings (severity, file:line, fix in the review doc):**

1. **MEDIUM** — `Table.tsx:2320` vs `:653`: stale lazy children re-seed after refresh during in-flight fetch → needs an epoch/generation guard in the load callback.
2. **MEDIUM** — `Table.tsx:1059` + `core/src/cell-edit.ts:88`: Escape during an async-pending commit still writes the value back (`onCellEdit` fires after cancel; reproduced) — baseline's documented open question, but violates "Escape cancels all".
3. **LOW** — `Table.tsx:151,2039` + test `:309`: prettier format:check gate failure.

No files were modified; the only write is the new `batch-k-review.md`.
