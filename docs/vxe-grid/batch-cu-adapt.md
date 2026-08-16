All gates pass on the final committed state. Work complete.

## Report — 批 CU：带格式复制（iris 独有）

### Situation

The feature itself was already implemented and committed (`5b5c85e9 feat(table): grid 批 CU——带格式复制`), but the follow-up session had timed out mid-fix, leaving a **broken working tree**: a half-applied scanner-hygiene change (single-line `clipConfig`) whose `// prettier-ignore` comment contained a literal `` `{` `` — an unbalanced brace inside the interface body that made `interfaceBody`'s naive brace counting fail, **dropping ALL 180 IrisTable props** from the regenerated manifest (`props: []`), plus a degraded `"type": "{"` on `clipConfig` and a failing `framework-contracts` test.

### What I changed (1 file, commit `09393338`)

`packages/react/src/primitives/table/props.ts` — completed the scanner-hygiene fix correctly:

- Single-line inline `clipConfig` object under a bare `// prettier-ignore` directive (exact match required — trailing explanation text breaks Prettier 3.9's directive recognition).
- Rationale `// NOTE` comment placed outside the JSDoc so it doesn't leak into the manifest description.
- Result: manifest regenerates **byte-identical to the committed manifest** (180 props / 31 events, full single-line `clipConfig` type with `copyWithFormat`), zero diff.

### Feature state (committed `5b5c85e9`, verified on final HEAD)

- **Implementation**: `buildRangeCopy` gains 3rd param `copyWithFormat`; 2 value branches (html + tsv/csv) switch formatter columns onto the existing `contextCellText` chain (mask → formatter → String — same as context-menu 复制值); both copy throats (Ctrl/Cmd+C + toolbar 复制) pass `!!clipConfig?.copyWithFormat`; all three serializers (tsv/csv/html) carry the formatted string (RFC-4180 + OWASP still apply). Formatter-gated: non-formatter columns byte-identical; `exportRaw` copy-path skip superseded on formatter columns; paste asymmetric; zero core changes (framework-free).
- **Files changed**: 3 source (`props.ts`, `Table.tsx`, `types.ts`) + 1 new test (`copy-with-format.test.tsx`) + manifest + comparison doc/DECISIONS/adapt doc.
- **Tests added**: 14 (432 lines ≤ 500) — ① TSV byte pin `25.00` not `25`, ② formatted-not-raw `$25`, toolbar same-throat, no-formatter regression, mask→formatter order, exportRaw supersede + off-state, non-string fallback, csv quoting + OWASP, html escaping, copyFormat orthogonality loop, row-aware formatter, paste asymmetry, no-range no-op, formula+formatter.

### Gate counts (all on final HEAD)

| Gate               | Result                                                     |
| ------------------ | ---------------------------------------------------------- |
| core test          | **1559/1559** (untouched)                                  |
| react typecheck    | clean                                                      |
| react test         | **2618/2618** (2604 + 14)                                  |
| react lint         | **0 errors** (1 pre-existing IrisTable complexity warning) |
| spec `--mode all`  | **0 violations** (1416 files)                              |
| gen:manifest       | regenerates to committed state (zero diff)                 |
| manifest pkg tests | 69/69                                                      |
| prettier check     | pass                                                       |

### What is left

- Pipeline: review stage (`batch-cu-review.md`) then full-repo gate stage per batch process.
- Pre-existing dirt not touched: `docs/vxe-grid/batch-ct-gate.md` (untracked, prior stage).
