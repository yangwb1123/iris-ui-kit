# Gate Report — batch AN (shortcuts + column presets)

**Verdict source**: `docs/vxe-grid/batch-an-review.md` — **PASS** (no blocking findings; 3 LOW + 3 INFO non-blocking noted for future batches)

## Commands

| Step                                                  | Result                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **180/180 tasks** (55 cached, 4m17s)                          |
| `pnpm audit`                                          | ✅ **0 vulnerabilities**                                         |
| `pnpm gen:manifest` + `check:manifest`                | ✅ up to date — 155 components × 4 frameworks (all 4), 86 tokens |
| Commit                                                | ✅ `a345ae341a0438018dfda187ea076b11066a8281`                    |

## Final test counts

| Suite | Tests           | Files |
| ----- | --------------- | ----- |
| core  | **1330 passed** | 85    |
| react | **1938 passed** | 172   |

## Review findings status

- 1–3 (LOW: Delete no-op on rowId tables / redundant commits on empty cells / F2 row-mode invisible session) — non-blocking, tracked for a future batch.
- 4–6 (INFO) — accepted as-is.

## Notes

- Only docs files were staged beyond the earlier adapt commit: `DECISIONS.md`, `batch-an-adapt.md`, `batch-an-review.md`.
- `cms-shared#build` emitted the usual "no output files found" turbo warning — non-blocking, pre-existing.
