Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-el-review.md`.

## What I verified

**Commands run (all green):**

| Check                         | Result                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| core test                     | ✅ 1597/1597, core zero-diff vs parent                                         |
| solid test                    | ✅ 1028/1028 + hydration 38/38                                                 |
| solid typecheck / lint        | ✅ 0 errors                                                                    |
| audit:security / audit:tokens | ✅ 0 vulns / clean                                                             |
| check:manifest                | ✅ nil diff (155×4, 86 tokens, unavailable=0)                                  |
| core framework-free grep      | ✅ clean                                                                       |
| arch-check --ratchet          | ✅ IrisTable.tsx 2339 ≤ 2340; all violations pre-existing (verified at parent) |
| prettier                      | ✅ clean                                                                       |

**Parity vs react AO / vue EK:**

- `getCellValue` 2-arg `memoizedFormulaValue` formula branch — byte-identical, non-formula path untouched (additive-only)
- `isEditableColumn` / `withComputedFormulaCells` — verbatim mirrors; **8** edit entry points guarded (grep confirms zero raw `col.editable` conditionals left outside `utils.ts`)
- Choke-point propagation confirmed: single + multi sort, both filter channels, summary, display resolver, draft/pattern hints, exports ×2, range copy
- `autoDetectTypes` cast cleanup matches react's skip semantics; `col.sorter` precedence preserved
- useTableSort dedup is behaviorally the intended sync and `useTableSort` isn't barrel-exported (no public change)

**Non-blocking findings:**

1. **LOW (docs)** — `docs/vxe-grid-comparison.md` EL row says "七守卫" but there are 8 guard sites (adapt.md correctly says 8)
2. **INFO** — solid `exportCsv` mask-at-export gap vs react: pre-existing, documented fiat; formula computed values do export correctly
3. **INFO** — useTableSort dedup: internal-only, intent is the sync itself
4. **INFO** — `formulaTables` (batch BC) not synced: documented fiat, matches vue EK precedent

No files modified besides the review report.
