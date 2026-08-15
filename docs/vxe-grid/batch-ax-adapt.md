# batch AX adapt — grid conditional formatting (iris 独有)

Implement per `/home/u1/iris-ui/docs/vxe-grid/batch-ax-baseline.md` + AGENTS.md.

## Files changed (4 modified + new + generated)

| File                                                              | Change                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/conditional-styles.ts`                         | NEW: `matchConditionalStyles<Row, Style>` + `ConditionalStyleRule` — pure ordered-rule evaluator, framework-free                                                        |
| `packages/core/src/conditional-styles.test.ts`                    | NEW: 6 tests (match / column filter + predicate-not-evaluated / multiple merge order / none → `{}` / column-less / input transparency + fresh objects)                  |
| `packages/core/src/index.ts`                                      | barrel export                                                                                                                                                           |
| `packages/react/src/primitives/table/props.ts`                    | `conditionalStyles` single-line prop after `cellStyle` (`// prettier-ignore` pinned for the manifest scanner)                                                           |
| `packages/react/src/primitives/table/types.ts`                    | NEW type `IrisTableConditionalStyle<Row>`                                                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`                   | module-scope `conditionalCellStyle` helper (F11) + one spread after `cellStyle?.(…)` merge site; `raw` value passed through                                             |
| `packages/react/src/primitives/table/conditional-styles.test.tsx` | NEW: 8 tests (highlight / column filter / merge order / no-match unchanged / cellStyle-before-rules / dataIndex raw value / formula computed value / core bridge types) |
| `apps/docs/guide/table-conditional-formatting.md`                 | NEW guide page (token-safe example, core direct-use section)                                                                                                            |
| `packages/manifest/{manifest.json,llms.txt}`                      | regenerated (IrisTable 141 props, `conditionalStyles` captured)                                                                                                         |

## Verify

- `pnpm --filter @iris-ui-kit/core test` → 91 files, **1417 tests** passed (was 1411, +6)
- `pnpm --filter @iris-ui-kit/react typecheck` → clean
- `pnpm --filter @iris-ui-kit/react test` → 182 files, **2053 tests** passed (was 2045, +8)
- `pnpm --filter @iris-ui-kit/react lint` → **0 errors** (1 pre-existing IrisTable complexity warning, verified pre-existing via stash)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `pnpm gen:manifest` + `check:manifest` → up to date; `gen:docs-reference` + `check:docs-reference` → up to date

## Design notes

- Cost = visibleCells × rules, inline per cell, no memo (virtual scroll bounds it; JSDoc tells callers to memoize the array).
- Merge order: `cellStyle` first, conditional rules after → later matching rules win on conflicting keys (same override latitude `cellStyle` already had).
- `value` is the raw cell value via the batch-AO `getCellValue` choke point (dataIndex ?? key, formula computed) — zero extra reads.
- No i18n strings this batch (no en/zh parity gate).

## Left

- Gate stage (full repo `turbo run test typecheck lint build` + 27-package checks) per the batch pipeline.
