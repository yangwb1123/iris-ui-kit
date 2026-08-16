Done. All gates pass on the committed state.

## Report — 批 CU：带格式复制（iris 独有）

**Commit**: `feat(table): grid 批 CU——带格式复制（iris 独有）`

### Files changed (3 source + 1 test + manifest + docs)

| File                                                                 | Change                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                       | `clipConfig` inline type + `copyWithFormat?: boolean` (nested field — propCount **180** / eventCount **31** unchanged, batch BP precedent) + JSDoc batch CU block   |
| `packages/react/src/primitives/table/Table.tsx`                      | `buildRangeCopy` 3rd param `copyWithFormat: boolean` (empty-dep memo legal) · 2 value branches (html + tsv/csv) · 2 call-site args (`!!clipConfig?.copyWithFormat`) |
| `packages/react/src/primitives/table/types.ts`                       | `formatter` JSDoc + 1 sentence (batch CU the range copy carries the formatted text)                                                                                 |
| `packages/react/src/primitives/table/copy-with-format.test.tsx`      | **NEW — 14 tests, 401 lines** (≤500 ✓)                                                                                                                              |
| `packages/manifest/{manifest.json,llms.txt}`                         | regenerated (**180** props / **31** events unchanged, 155×4, 86 tokens; clipConfig type string + description updated)                                               |
| `docs/vxe-grid-comparison.md` + `batch-cu-adapt.md` + `DECISIONS.md` | 批 CU row, build tail (`react 2604→2618`), test-count line, stage bookkeeping                                                                                       |

### Implementation

Spec-literal: `copyWithFormat` copies the **formatted text** (not the raw value) of formatter columns. **One throat** — `buildRangeCopy` gains a 3rd param and both consumption points (window Ctrl/Cmd+C + range toolbar 复制 via `copyActiveRange`) pass `!!clipConfig?.copyWithFormat`, reusing the existing `contextCellText` module helper (`mask → formatter → String`, the same display chain as the context-menu 复制值 & `cellTooltip` — zero new helpers). **Formatter-gated**: only `col.formatter` columns switch to the `contextCellText` chain on the copy path; non-formatter columns stay byte-identical (blast radius = formatter columns only — eliminates the negative-number neutralization hazard). All three `copyFormat` serializers (tsv/csv/html) receive the formatted **string** through the SAME serializers (RFC-4180 quoting + OWASP neutralization still apply to formatted text; html via `toHtml` escaping, formatted strings lose numeric right-align — fiat).

**Fiats pinned by tests**: formatter input is always the masked value (batch AY contract) — `copyWithFormat` supersedes `exportRaw`'s copy-path skip on formatter columns (mask → formatter always; exports untouched — the exportRaw combination test also pins the off-state byte regression); non-string formatter results fall back to `String(masked)` exactly like 复制值; paste stays raw `\t` (asymmetry); no live range → no-op; formula columns (batch-AO `getCellValue` choke point) materialize then format.

### Tests added (14)

① formatter TSV byte pin (`25.00` not `25`) · ② formatted-not-raw (`$25`) · toolbar same-throat · no-formatter byte regression · mask→formatter order (`M:138****8000`) · exportRaw combination (supersede + off-state regression) · non-string fallback · csv RFC-4180 quoting + OWASP neutralization on formatted text · html escaping + right-align loss · copyFormat orthogonality (tsv/csv/html loop) · row-aware formatter · paste asymmetry · no-range no-op · formula+formatter (batch-AO choke point)

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (untouched, framework-free)
- `@iris-ui-kit/react typecheck`: clean · test: **2618/2618** (2604+14)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing complexity warning)
- spec script: **0 violations** (1416 files)
- `gen:manifest` regenerated + committed; `check:manifest` up to date; manifest pkg tests 69/69

### What is left

- Review stage (`batch-cu-review.md`) then full-repo gate stage per the batch pipeline.
- Pre-existing: prior-stage dirt (`DECISIONS.md` M, `batch-ct-gate.md` ??); 3 heavy virtual-scroll tests flaky under full parallel load (pass in isolation); arch-check ratchet staleness noted in prior batches.
