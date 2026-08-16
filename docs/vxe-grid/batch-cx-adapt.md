All gates green. Final summary:

## 批 CX：列类型自动检测（iris 独有）— Complete ✅

Commit: **`ee15bbae`** `feat(table): grid 批 CX——列类型自动检测（iris 独有）` — 11 files, +530/−8.

### Files changed (4 impl + 2 tests + manifest + docs)

| File                                                                  | Change                                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/column-type.ts`                                    | **NEW** — framework-free pure `detectColumnType(values)` + named exported `DetectedColumnType` (`string/number/date/boolean`)                                   |
| `packages/core/src/index.ts`                                          | +2 exports (`detectColumnType`, `DetectedColumnType`)                                                                                                           |
| `packages/react/src/primitives/table/props.ts`                        | `autoDetectTypes?: boolean` after `footerAlign` — propCount 183→**184**, events 32 unchanged                                                                    |
| `packages/react/src/primitives/table/Table.tsx`                       | 4 touch points: import · destructure · `detectedTypes`/ref + `detectedColumns` memo (preset→**detected**→order) · one-shot effect on first non-empty `liveData` |
| `packages/react/src/primitives/table/test/auto-detect-types.test.tsx` | **NEW** 12 tests, 230 lines                                                                                                                                     |
| `packages/core/src/column-type.test.ts`                               | **NEW** 10 tests, 66 lines                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`                          | regenerated — 184 props, 32 events                                                                                                                              |
| `docs/vxe-grid-comparison.md` + `batch-cx-{baseline,adapt}.md`        | 批 CX row + 构建状态 segment + reports                                                                                                                          |

### Detection semantics (core)

First 50 non-nullish samples, all-samples-agree; `number`/`boolean` by typeof (NaN/Infinity vote number — typeof parity with the existing per-cell fallback); date = `Date` instance or ISO regex; **numeric/boolean strings stay string** (CSV-safe); mixed/empty → `'string'` fail-safe.

### React bridge

Number → right + `'number'` sort; string/date/boolean → left + `'string'` — filling **only undefined** fields (explicit wins, presets survive, formula columns skipped). One-shot per mount (re-feeds/proxy pages never re-detect), SSR-safe, off-path byte-identical. **Closes the header-align gap** (body/footer right-aligned numbers, header stayed left).

### Verification (all green)

- core **1569/1569** (+10) · react **2660/2660** (+12), typecheck clean · lint **0 errors**
- spec **0 violations** (1416 files) · prettier clean · turbo (test/typecheck/lint/build) 12/12 on both packages
- `gen:manifest` regenerated + committed; re-run shows zero diff

### Tests added (22)

Core 10: per-type inference (number/string/Date/ISO-string/boolean), mixed fail-safe, numeric-string/boolean-string stay string, non-finite, nullish-skip/empty, 50-sample cap. React 12: spec ① header right-align ② heterogeneous-row numeric sort ③ type inference ×3, plus off-byte-identical, explicit-fields-win, preset interplay, one-shot, async arrival, grouped leaves, formula skip + mixed fail-safe.

### What's left

- vue/solid/svelte untouched (react-only bridge per baseline — same as 批 CP–CW).
- A column whose first 50 samples agree but a later row disagrees keeps the one-shot inference (documented fiat).
- No UI surface for the inferred type (align + sortType only) — not in spec.

### Gate (后置，批 CX)

- Verdict `batch-cx-review.md` **PASS** (4 LOW non-blocking; F4 docs-reference regenerated this stage).
- Full repo gate **180/180 tasks** · audit **0 vulns** · check:manifest zero diff (184 props/32 events) · check:docs-reference up to date.
- Final counts: core **1569/1569** · react **2660/2660** · repo total **8718** — all green.
- Gate commit: `feat(table): grid 批 CX——列类型自动检测（iris 独有）` (bookkeeping only; implementation + manifest + comparison doc in `ee15bbae`).
