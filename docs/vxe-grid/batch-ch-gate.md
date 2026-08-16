Gate stage complete. Working tree clean.

## Summary

**Review verdict: PASS** (`docs/vxe-grid/batch-ch-review.md` — 0 blocker / 0 major; 2 low / 1 info, none blocking, no code fixes required).

**Gate results:**

| Step                                                                   | Result                                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (2m04s, 125 cached)                                                                                             |
| `audit:security`                                                       | **0 vulnerabilities**                                                                                                                        |
| `audit:tokens`                                                         | exit 1 with **only pre-existing warnings** — 0 new (batch CH added zero CSS/tokens)                                                          |
| `gen:manifest` + `check:manifest`                                      | up to date, **zero diff** — 155 components × 4 frameworks, 86 tokens, **propCount 169 / eventCount 31** (columnDrag description text only)   |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` updated — iris 独有 section (new `列宽双栏拖拽（columnDrag 拖出固定）` row) + 构建状态 paragraph (批 CH entry) |
| Framework-free invariant                                               | core untouched (0 framework imports), verified by review                                                                                     |

**Final test counts:**

- **react: 2467/2467** (218 files; 13 new column-pin-drag tests, 2454→2467 — re-verified standalone)
- **core: 1533/1533** (unchanged)
- manifest propCount 169 / eventCount 31 · spec 0 violations · audit 0

**Commit:** `57677bda1f128cb51e5ae6c57f6ccf912df7f974` — `feat(table): grid 批 CH——列宽双栏拖拽（iris 独有）` (6 files, +116/−31; docs only — implementation + tests + manifest were committed at `4f07fd8a` during adapt). Note: the lint-staged hook flags 6 files vs target 5 as a non-blocking budget warning (multi-doc fan-out).

Implementation recap (from `4f07fd8a`): `columnDrag` 拖出固定 — drag a column header past the table's left edge and release → auto pin-left, combined with `columnPinMenu` (shared dual-channel throat, zero new props/core/i18n); `resolveColDrag` edge-check-first (never reorders, controlled no optimistic flip), window-level `pointerup`/`pointermove`/`pointercancel` listeners fix the previously-stuck `activeId` on outside-root release; plain `columnDrag` keeps vxe parity with zero global hooks.
