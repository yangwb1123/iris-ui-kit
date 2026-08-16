## Verdict: **PASS** — written to `docs/vxe-grid/batch-by-review.md`

### Verification run (all independently re-run)

| Gate                   | Result                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| core test              | 1517/1517 ✅                                                                                                       |
| react test             | 2373/2373 (incl. new `persist-state-expanded` 9/9, `persist-state` 14, SSR 1, `views` 16, `pin-column-menu` 20) ✅ |
| react typecheck / lint | clean / 0 errors (1 pre-existing complexity warning) ✅                                                            |
| `pnpm audit:security`  | 0 vulnerabilities ✅                                                                                               |
| `check:manifest`       | up-to-date; IrisTable 165 props / 31 events unchanged (diff = docs only) ✅                                        |
| core framework-free    | `grep` empty; zero core files in commit ✅                                                                         |
| CSS tokens             | zero `styles.ts`/token changes (`audit:tokens` red is repo-wide pre-existing) ✅                                   |

### Checklist vs baseline

All 5 source contacts match the spec: `types.ts` piece+field, `ALL_PIECES` +1 (three loops + skip-first auto-covered), collector gate `onExpandedRowsChange && expandableMode`, restore `expansion.set(value.map(String))` full-set replace firing the callback, `applyViewSnapshot` symmetric. The `expandableMode` probe (≡ `hasDetail || treeMode`) correctly avoids the TDZ the baseline itself flagged; both open questions arbitrated as documented. All 9 baseline test cases present.

### Findings (non-blocking)

1. **LOW** — `Table.tsx:2877-2878` `applyViewSnapshot` expandedKeys branch untested (adapt report claims views coverage; `views.test.tsx` has none). Fix: one views save/apply test.
2. **LOW** — `lazyLoad` mode in `expandableMode` untested (only `getSubRows` tree + detail covered).
3. **INFO** — commit bundles sanctioned BX review fixes (`pinOf` fallback is a behavior change, but exactly the `batch-bx-review.md` finding-1 fix, tests pass); runner must still re-review/gate BX separately.
4. **INFO** — restore fires `onExpandedRowsChange` at mount (documented restore channel, consistent with all other pieces).
5. **INFO** — empty `[]` expandedKeys always captured when gated (like `pageSize`); idempotent and harmless.

No files modified beyond the review doc.
