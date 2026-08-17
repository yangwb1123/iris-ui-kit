All gates pass on final HEAD (`8964a7b6`). Work complete.

## Report — 批 DA：单元格格式化复制增强（iris 独有）

### Situation — verify-style adapt, no new feature code

Per `batch-da-baseline.md` (line-by-line recheck, not restating old docs): **the DA spec was already fully implemented by committed batch CU** — `5b5c85e9` + `09393338` (scanner hygiene) + `15bbc1d4` are ancestors of HEAD `8964a7b6`. I re-verified every spec claim directly against the code on disk rather than trusting the baseline:

| Spec item                                                                  | Code evidence (verified this session)                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 复制选中区域时按列 formatter 输出（copyWithFormat 已有单格——扩展选区整体） | Single-cell 复制值 chain `contextCellText` (Table.tsx:2098, batch BW) pre-existed; CU extended it to the WHOLE selection: `buildRangeCopy` gains 3rd param `copyWithFormat` (Table.tsx:6822) and switches formatter columns onto the `contextCellText` chain per-cell across the range rect                                                                 |
| 与 mask 组合（掩码优先）                                                   | `contextCellText` runs `applyCellMask` (mask) FIRST, then `formatter` receives the **masked string** — the display chain invariant; test pins `M:138****8000` (mask → formatter)                                                                                                                                                                            |
| 测试（选区格式化复制）                                                     | 14/14 tests in `copy-with-format.test.tsx` (432 lines ≤ 500) — TSV `25.00`/`$25` pins, toolbar same-throat, non-formatter byte-identical, mask-before-formatter, exportRaw superseded + off-state, non-string fallback, csv RFC-4180 + OWASP, html escaping, copyFormat orthogonality, row-aware formatter, paste asymmetry, no-range no-op, formula column |

Range-copy contract as built: both copy throats (Ctrl/Cmd+C Table.tsx:7049 + toolbar 复制 Table.tsx:7380) pass `!!clipConfig?.copyWithFormat`; all three serializers (tsv/csv/html) carry the formatted STRING (RFC-4180 quoting + OWASP neutralization still apply); only `col.formatter` columns switch chains — non-formatter columns stay byte-identical; `exportRaw`'s copy-path skip is superseded on formatter columns; paste stays raw TSV (asymmetry fiat). Zero core/vue/solid/svelte references (`copyWithFormat` is react-only).

### What I changed (0 source files)

Nothing — additive-only + gate-verify. All files belong to the committed CU batch:

- `packages/react/src/primitives/table/props.ts` (+1 field, single-line `clipConfig` — scanner hygiene, 09393338)
- `packages/react/src/primitives/table/Table.tsx` (buildRangeCopy + two throats)
- `packages/react/src/primitives/table/types.ts` (formatter doc carries CU statement)
- `packages/react/src/primitives/table/copy-with-format.test.tsx` (14 tests, 432 lines)

I deliberately did NOT add the baseline's 7 suggested edge tests: every DA spec sentence already maps 1:1 to a test, the 14/14 net is the gated CU contract the baseline says not to touch, and the file would approach the 500-line limit.

### Gate counts (final HEAD `8964a7b6`)

| Gate                              | Result                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| core test                         | **1580/1580** (102 files) — framework-free, untouched                                            |
| react typecheck                   | clean                                                                                            |
| react test                        | **2671/2671** (236 files) — incl. the 14 CU tests                                                |
| react lint                        | **0 errors** (1 pre-existing IrisTable complexity warning, Table.tsx:2580)                       |
| spec `--mode all`                 | **0 violations** (1416 files)                                                                    |
| gen:manifest                      | regenerates byte-identical — **zero diff** (155 components × 4, 86 tokens; already sync'd by CU) |
| prettier / arch / manifest checks | not re-run in full; no source touched so prior CU gate results stand                             |

### What is left

- Pipeline: review stage (`batch-da-review.md`) then full-repo gate stage per batch process.
- Pre-existing dirt not touched: `docs/vxe-grid/DECISIONS.md` (mod), `docs/vxe-grid/batch-cz-gate.md` (untracked), `docs/vxe-grid/batch-da-baseline.md` (untracked, this stage's evidence).
