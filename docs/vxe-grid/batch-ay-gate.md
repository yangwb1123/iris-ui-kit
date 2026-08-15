**Gate PASS** — both review findings fixed, full repo gate green.

## Verdict

Review was **FAIL** with 1 blocking MEDIUM + 1 LOW. Both applied with regression tests:

1. **MEDIUM (blocking)** — range-toolbar 导出 (`exportActiveRangeCsv`, Table.tsx) exported **raw** masked values while the adjacent 复制 button masked. Now mirrors `buildRangeTsv`: `col.exportRaw ? value : applyCellMask(value, col)` — clipboard TSV and `table-range.csv` always agree. +2 range-toolbar tests (mask applies / `exportRaw` opts out).
2. **LOW** — `exportCsv` shadow-write landed at `row[dataIndex ?? key]`, so a numeric `dataIndex` on a masked column wrote to a key the serializer never reads → mask silently lost. Shadow write now targets exactly what `toCsv` reads (`typeof dataIndex === 'string' ? dataIndex : key`). +3 exportCsv tests.

## Gate results

| Check                                                 | Result                                           |
| ----------------------------------------------------- | ------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **180/180 tasks** (64 cached)                 |
| `audit --audit-level low`                             | ✅ **0 vulnerabilities**                         |
| `audit:tokens`                                        | ✅ warnings all pre-existing, none from batch AY |
| `gen:manifest` + `check:manifest`                     | ✅ up to date (**155×4**, 86 tokens)             |

## Final test counts

- core: **1424 passed** (+7 batch AY)
- react: **2070 passed** (+16 batch AY, +5 from gate fixes)
- Full turbo gate: 180/180 successful, 0 failed

## Commit

**`13a5537a`** `feat(table): grid 批 AY——数据掩码（脱敏列，显示/导出双轨）` — 8 files, +161/−54 (fixes, tests, review + gate docs). Working tree clean; affected tests re-verified post-commit (31/31 pass).
