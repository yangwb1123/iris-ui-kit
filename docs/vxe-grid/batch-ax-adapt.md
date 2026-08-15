Done. Batch AX (grid conditional formatting) implemented, verified, and committed as `4e3e1858`.

## Report

**Files changed** (4 modified + 6 new + 2 generated, committed in one commit):

- Modified: `packages/core/src/index.ts` (barrel export), `packages/react/src/primitives/table/props.ts` (single-line `conditionalStyles` prop after `cellStyle`, `// prettier-ignore`-pinned for the manifest scanner), `.../types.ts` (`IrisTableConditionalStyle<Row>`), `.../Table.tsx` (module-scope `conditionalCellStyle` helper F11 + one spread after the `cellStyle?.(…)` merge site)
- New: `packages/core/src/conditional-styles.ts` (`matchConditionalStyles<Row, Style>` + `ConditionalStyleRule`, pure ordered-rule evaluator), `packages/core/src/conditional-styles.test.ts` (6 tests), `packages/react/src/primitives/table/conditional-styles.test.tsx` (8 tests), `apps/docs/guide/table-conditional-formatting.md` (iris 独有 guide page, token-safe example), `docs/vxe-grid/batch-ax-adapt.md`, `docs/vxe-grid/DECISIONS.md` entry
- Generated: `packages/manifest/{manifest.json,llms.txt}` — IrisTable now **141 props**, `conditionalStyles` captured with the full single-line type

**Tests added / counts:**

| Check                                                                             | Result                                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| core test                                                                         | 91 files, **1417 passed** (was 1411, +6)                                                       |
| react typecheck                                                                   | clean                                                                                          |
| react test                                                                        | 182 files, **2053 passed** (was 2045, +8)                                                      |
| react lint                                                                        | **0 errors** (1 pre-existing `IrisTable` complexity warning — verified pre-existing via stash) |
| `iris-ui-spec.py --mode all`                                                      | **0 violations**                                                                               |
| `gen:manifest` / `check:manifest` / `gen:docs-reference` / `check:docs-reference` | up to date, committed                                                                          |
| prettier                                                                          | clean on all changed files                                                                     |

**Design (per baseline):** rules evaluate inline per visible cell (cost = visibleCells × rules, no memo — virtual scroll bounds it; JSDoc tells callers to memoize the array); merge order `cellStyle` → rules, later matches win on conflicts; `value` is the raw cell value through the batch-AO `getCellValue` choke point (dataIndex ?? key resolved, formula computed); style is `import('react').CSSProperties` and the core `Style` generic makes the react bridge cast-free (no framework types in core); no i18n strings (no en/zh parity gate this batch); no CSS files touched (rule styles use inline `var(--iris-*)` tokens, per the token constraint).

**What is left:** the pipeline's gate stage — full repo `turbo run test typecheck lint build` plus the 27-package checks, browser E2E/visual regression, and `pnpm bench`, per the batch pipeline (not part of this task).
