Batch W complete. Working tree clean.

## Report

**Commits:**

- `846b2781` — `feat(table): vxe-grid 批 W——getFilteredData/exportCurrentViewCsv + showHeaderOverflow/showFooterOverflow（react only）`
- `a9e29dc2` — `docs(table): 批 W adapt 报告`

**Files changed (8):**

| File                                                      | Change                                                                                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                                | +2 single-line handle methods (`getFilteredData`, `exportCurrentViewCsv`) — 454/500                                                                               |
| `props.ts`                                                | +2 single-line boolean props (default `true`) — 498/500                                                                                                           |
| `Table.tsx`                                               | +19: destructuring, `cellOverflowOverride` const, 5 spread sites (flat + grouped header, summary, footerMethod, footerData), 2 handle methods, `exportCsv` import |
| `test/export-view-overflow.test.tsx`                      | new — 205 lines, **9 tests**                                                                                                                                      |
| `manifest.json` / `llms.txt`                              | regenerated (react IrisTable props 121→123, purely additive; 155 components × 4 frameworks unchanged)                                                             |
| `DECISIONS.md`, `batch-w-baseline.md`, `batch-w-adapt.md` | docs                                                                                                                                                              |

**Key implementation notes:**

- `getFilteredData()` → `[...filteredData]` — handle object re-created every render, so it always closes over the **latest** memo (verified: filter `'ali'` + age asc → `[Alice, Alicia]`, and returned array is a copy)
- `exportCurrentViewCsv()` → `exportCsv(getFilteredData(), displayColumns)` — hidden columns excluded via `displayColumns`; plain string, caller downloads (`downloadCsv`)
- Overflow override spread **after** `baseCellStyle` (wins over ellipsis base), **before** user cell-style callbacks (mirrors vxe inline-over-class precedence); `as const` typed

**Verification (all pass):**

- typecheck ✓ · react tests **1819/1819** (161 files, +9) · lint **0 errors** (1 pre-existing `IrisTable` complexity warning) · `iris-ui-spec.py --mode all` **0 violations** (1405 files) · `gen:manifest` regenerated, re-run after prettier hook confirmed zero drift

**Unfinished:** none. Baseline open questions documented as-is (tree-mode filters don't hide rows, no Excel twin, no body-level `showOverflow` — all matching existing documented behavior).
