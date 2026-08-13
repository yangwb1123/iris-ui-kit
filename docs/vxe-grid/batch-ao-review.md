**Verdict: PASS** — written to `docs/vxe-grid/batch-ao-review.md`.

## Verification results

| Command                               | Result                                              |
| ------------------------------------- | --------------------------------------------------- |
| core test                             | ✅ 1354 passed (+21)                                |
| react test                            | ✅ 1952 passed (+14)                                |
| core/react typecheck                  | ✅ clean                                            |
| react lint                            | ✅ 0 errors (1 pre-existing complexity warning 215) |
| check:manifest / check:docs-reference | ✅ up to date                                       |
| pnpm audit                            | ✅ 0 vulnerabilities                                |
| prettier (8 touched files)            | ✅ clean                                            |
| core framework-free grep              | ✅ 0                                                |

## Checklist

1. **Evaluator — PASS.** Recursive descent with correct precedence/parens/left-assoc; no `eval`/`Function`; every failure → null, never throws; concat `+`, numeric-only `-* /%`, `=` strip both forms, whitespace, 512/32 bounds. I ran ~45 live probes beyond the tests (nested `SUM(SUM())`, `2*SUM(1,2,3)`, exponent/`.5`/`5.` rejection, trailing junk) — all correct.
2. **Formula columns — PASS.** `getCellValue` choke point covers render/filter/group/summary/range-stats/clipboard/distribution; the two bypass paths (`useTableSort.buildSorter` + `querySortedData`) are explicitly wired; CSV shadow-row export; edit ignored at all 10 entry points via `isEditableColumn`; WeakMap memo correct under the immutable-row contract.
3. **Cell refs — PASS.** `columnLetter` bijective (AA/ZZ/AAA verified); badges index data-leaf columns only in both header variants (seq/selection skipped); all 6 track sites + body + both headers flipped to `seq || showCellRefs`; no duplicate row column when `seq` on.
4. **Additive/manifest/framework-free/tokens — PASS.** New props default off; `formula` on `IrisTableColumn` absent from manifest, consistent with existing `preset`/`sortBy`/`dataIndex`; zero framework imports in core; only canonical `--iris-*` tokens.

## Findings (non-blocking)

1. **[LOW]** `pasteIntoRange` (Table.tsx:3412) / `clearActiveRange` (:3614) write `row[col.key]` for formula columns without the `isEditableColumn` guard — display unaffected (formula reads referenced fields, not its own key) but stale backing values + undo entries; pre-existing pattern for non-editable columns.
2. **[LOW]** formula.ts:179 uses `in` (prototype chain) for unknown-field detection — `toString`/`constructor` refs fail closed via NaN (safe), but a row field named like an Object.prototype member is read as data; `Object.hasOwn` would be stricter.
3. **[INFO]** `arch-check:ratchet` + `audit:tokens` fail repo-wide — verified pre-existing at `fb159110` (8 over-500 files, 4 legacy tokens); AO added only +11/+13 lines to already-over-limit files, no new tokens.
4. **[INFO]** 2 harness-bookkeeping docs uncommitted at report time (no source changes).

No source files were modified.
