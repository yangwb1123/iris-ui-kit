Done. The review verdict was **PASS** → full gate green → committed.

## Gate results

| Gate                                                  | Result                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks** (exit 0)                                                                                                           |
| `pnpm audit`                                          | **0 vulns**                                                                                                                          |
| `gen:manifest` + `check:manifest`                     | **155 components × 4 frameworks**, 86 tokens, react Table **propCount 159** (158→159), generated output up to date (gen → zero diff) |

## Final test counts

- **core: 1517/1517** · **react: 2281/2281**（13 new in `group-multicol.test.tsx`）· vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration

## Review LOWs handled

1. **LOW (docs)** — comparison.md "react 2280" → **2281** (fixed) + annotated the +1 from the BQ-leftover probe `zz-bq-probe.test.tsx` (rowId row-mode multi-commit regression, swept in via the instructed `git add -A`; passing, counted in the 2281).
2. **LOW (design)** — `::` composite-key ambiguity is a baseline-documented explicit choice; not gate-blocking, no code change.
3. **INFO** — `groupBy={[]}`+flag behavior matches the documented byte-identical fallback contract; no action.

## Commits

- **`9cc25f9f`** — `feat(table): grid 批 BS——多列分组（iris 独有）` (8 files: comparison.md count fix, gate report, review verdict, DECISIONS.md/stage records, leftover probe)
- **`71634f70`** — `docs(table): 批 BS 门禁报告落 commit hash` (hash fill, mirroring the `1503ecce` precedent)
- Implementation itself was already on main at `982dc909` (adapt stage).

Working tree is clean.
