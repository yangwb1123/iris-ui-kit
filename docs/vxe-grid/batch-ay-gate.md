Gate complete — **PASS**, both review findings fixed, full repo gate green.

## Summary

**Verdict**: FAIL (1 blocking MEDIUM + 1 LOW) → applied all fixes before gating:

1. **MEDIUM (blocking)** — range-toolbar 导出 (`exportActiveRangeCsv`, Table.tsx) exported **raw** masked-column values while the adjacent 复制 button on the same toolbar masked. Now mirrors `buildRangeTsv`: `col.exportRaw ? value : applyCellMask(value, col)` — clipboard TSV and downloaded `table-range.csv` always agree. 2 new range-toolbar tests (mask applies; `exportRaw` opts out).
2. **LOW** — `exportCsv` shadow-write landed at `row[dataIndex ?? key]`, so a **numeric** `dataIndex` on a masked column wrote to a key the serializer never reads (numeric dataIndex is dropped by the column spec) → masked value silently lost, `toCsv` read the raw value. Shadow write now targets the exact key the serializer reads (`typeof dataIndex === 'string' ? dataIndex : key`). 2 new exportCsv tests (numeric dataIndex keeps the mask; mask resolves through a string dataIndex different from the key) + 1 default/`exportRaw` pair test.

**Non-source**: none (no CSS tokens, no public API growth — additive fixes only).

## Full repo gate

| Check                                                 | Result                                           |
| ----------------------------------------------------- | ------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | ✅ 180/180 tasks (64 cached)                     |
| `audit` (`--audit-level low`)                         | ✅ 0 vulnerabilities                             |
| `audit:tokens`                                        | ✅ warnings all pre-existing, none from batch AY |
| `gen:manifest` + `check:manifest`                     | ✅ up to date (155×4)                            |

## Final test counts

- core: 1424 passed (+7 from batch AY)
- react: 2070 passed (+16 from batch AY, +5 from this gate's fixes)
- Full turbo gate: 180/180 tasks successful, 0 failed
