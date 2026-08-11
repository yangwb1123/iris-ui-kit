## Verdict: **FAIL** — written to `docs/vxe-grid/batch-w-review.md`

No source files modified (scratch verification test removed; the two dirty docs pre-date my review).

### Verification results

| Command                          | Result                                                |
| -------------------------------- | ----------------------------------------------------- |
| react test                       | 1819/1819 pass                                        |
| react typecheck                  | pass                                                  |
| react lint                       | 0 errors (1 pre-existing warning)                     |
| iris-ui-spec.py audit            | 0 violations (1405 files)                             |
| check:manifest                   | pass, purely additive (react IrisTable props 121→123) |
| scratch repro (4 tests, removed) | **4/4 fail** — defects confirmed empirically          |

### Findings

**F1 — HIGH — stale after mount** (`Table.tsx:2118-2119`, root cause `2216-2220`): `tableRef.current` is assigned **once** in `useEffect(..., [tableRef])`, so callers hold the mount render's handle forever. The new methods capture that render's `filteredData`/`displayColumns` memo values — the in-code comment claiming "re-created every render → latest memo" is false. Every other handle method that needs fresh data mirrors into refs (`externalDataRef`, `displaySelectionRef`, documented at `Table.tsx:1105`). Confirmed: after `rerender` with `filters={{name:'bob'}}`, `getFilteredData()` still returns `['Alice','Alicia']`; same for `data` shrink, `columnVisibility` (export still emits `Age`). The shipped tests pass only because props never change post-mount. Fix: mirror `filteredData`/`displayColumns` into refs per render and close over them; add post-mount rerender tests; fix the false comments.

**F2 — MEDIUM — grouped export broken** (`Table.tsx:2119`): uses `displayColumns` instead of the baseline-specified `leafColumns`. In grouped mode `displayColumns` holds group-parent columns (no `dataIndex`), so `exportCsv` emits only `'Identity\n\n\n\n'` — leaf data entirely lost. Fix: pass `leafColumns` (same reference as `displayColumns` in flat mode → zero flat regression); add a grouped export test.

**F3 — LOW — informational**: `textOverflow: 'ellipsis'` remains set under the override but is inert (ellipsis requires `hidden`+`nowrap`); matches baseline design, no fix required.

### Checklist

1. getFilteredData fresh+copy — **FAIL** (F1; copy semantics correct)
2. exportCurrentViewCsv — **FAIL** (F1 staleness + F2 grouped; flat/mount path correct, toCsv contract matched)
3. Overflow flags — **PASS** (all 5 sites: flat 4736, grouped 4581, summary 3737, footerMethod 3827, footerData 3887; default `true` → `null` spread byte-identical; body untouched)
4. Additive/manifest/core-free/tokens/≤500 — **PASS** (props.ts 498, types.ts 454)
