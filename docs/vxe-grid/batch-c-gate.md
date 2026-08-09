Batch C gate complete. **Verdict was FAIL** → all 5 defects fixed at the root, gates re-run green, committed.

## Fixes applied (all review defects, implementation + regression tests)

| #   | Defect                                                                                                                                 | Fix                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1  | `applyParams` page-reset keyed on _presence_, not _value_ → inline controlled `sort`/`filters` props spuriously reset page 1 + refetch | Value-compare via `sortEqual`/`filtersEqual` before reset; fresh-identity same-value props are no-ops                                                                                                  |
| M2  | `''` filter entries forwarded verbatim (`{name:''}` ≠ `{}` for dedupe)                                                                 | Single `normalizeFilters` point (initial seed + every merge): `''` stripped, `{name:''}` ≡ `{}`                                                                                                        |
| L1  | autoLoad effect `[]`-deps missed late proxyConfig + skipped destroy                                                                    | Effect keyed on proxy **presence**; late attach auto-loads + registers cleanup; removal/unmount tears down; StrictMode-safe (recreate + forceRender on remount so `useSyncExternalStore` resubscribes) |
| L2  | total shrink below current page → stale query, unrecoverable                                                                           | Core `loadClamped()`: after a successful load, jump to last valid page + re-query                                                                                                                      |
| L3  | explicit-`undefined` initialParams → NaN paging / `Object.keys(undefined)`                                                             | Per-field `??` defaults instead of spread                                                                                                                                                              |

New regression tests: **+4 core** (value-identity no-op, `''` stripping/dedupe, `undefined` initialParams, total-shrink clamp), **+3 react** (same-value controlled sort keeps page 2, cleared filters go out as `{}` and dedupe, late proxyConfig auto-loads). No checks silenced.

## Gate results

- **Turbo `test typecheck lint build --concurrency=2`: 180/180 tasks pass**
  - core: **1217 tests** (79 files, +4)
  - react: **1528 tests** (141 files, +3)
- **`iris-ui-spec.py --mode all --json`: 0 violations** (1401 files)
- **`gen:manifest`**: regenerated → 155 components (was 154), `manifest.json` + `llms.txt` committed
- **Docs**: `docs/vxe-grid-comparison.md` — 数据代理 row marked ✅ (react, core 控制器), 批 C row added, counts updated; fix record appended to `batch-c-review.md`
- **Commit**: `cb4d1e95` `feat(table): vxe-grid 批 C——proxyConfig 服务端数据源（react only）` — husky filesize gate passed (only non-blocking budget warnings); working tree clean apart from pre-existing `.vinxi` artifacts
