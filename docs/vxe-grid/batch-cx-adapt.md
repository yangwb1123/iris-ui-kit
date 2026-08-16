Done — committed as the 批 CX adapt commit (see `git log`; the gate stage amends this report with the final hash, per the batch-CW precedent). Prior-stage dirt (`docs/vxe-grid/DECISIONS.md`, `docs/vxe-grid/batch-cw-gate.md`) deliberately left untracked; `batch-cx-baseline.md` committed with the adapt (batch-CV/CW precedent).

## 批 CX：列类型自动检测（iris 独有）— Complete

### Files changed (6 impl/docs + 2 tests + manifest)

| File                                                                  | Change                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/column-type.ts`                                    | **NEW** — framework-free pure `detectColumnType(values)` + named exported type `DetectedColumnType` (`'string' \| 'number' \| 'date' \| 'boolean'`)                                                                                     |
| `packages/core/src/index.ts`                                          | `export { detectColumnType, type DetectedColumnType } from './column-type'` (+2 exports)                                                                                                                                                |
| `packages/react/src/primitives/table/props.ts`                        | `autoDetectTypes?: boolean` after `footerAlign` (single-line boolean, named JSDoc block) — propCount 183→**184**, eventCount 32 unchanged                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`                       | import +2 · destructure · `detectedTypes` state + `detectTypesRef` + `detectedColumns` memo (between preset and order; `orderedColumns` consumes it) · one-shot effect on first non-empty `liveData` (after the freshness-stamp effect) |
| `packages/react/src/primitives/table/test/auto-detect-types.test.tsx` | **NEW, 12 tests, 230 lines** (≤500)                                                                                                                                                                                                     |
| `packages/core/src/column-type.test.ts`                               | **NEW, 10 tests, 66 lines** (≤500)                                                                                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`                          | regenerated — propCount **183→184**, eventCount 32 unchanged, `autoDetectTypes` present                                                                                                                                                 |
| `docs/vxe-grid-comparison.md`                                         | 批 CX row in the iris-独有 table (after 批 CW) + 构建状态 paragraph tail segment                                                                                                                                                        |

### Detection semantics (core `detectColumnType`)

- samples = first **50 non-nullish** values; **all-samples-agree** → typed, anything mixed → `'string'` fail-safe.
- `number`/`boolean` by `typeof` (non-finite NaN/Infinity still vote number — `typeof` parity with the existing per-cell numeric fallback).
- `date` = `Date` instance or ISO-8601 string regex (date-only + full timestamp).
- **numeric / boolean strings stay string** (CSV imports are all strings — no coercion).
- empty / all-nullish → `'string'`.

### React bridge

- One-shot effect on first non-empty `liveData` (mount `data`, first proxy page, first post-hydration data); `detectTypesRef` guard — later re-feeds / edit write-backs never re-detect; SSR-safe (effects never run in `renderToString`).
- `detectedColumns` memo fills `align` + `sortType` **only where `undefined`** — number → right + `'number'`; string/date/boolean → left + `'string'`. Explicit fields always win; preset defaults survive; **formula columns skipped** (sortType is the caller's contract on the computed value).
- **Closes the header-align gap** (body/footer already right-align numbers per-cell; header stayed left — detection fills `col.align` so the header follows).
- Off path byte-identical (memo returns `presetColumns` when prop off or nothing detected).
- 12 explicit fiats per baseline: header-gap fix, one-shot, first-page-only proxy inference, preset interplay, SSR post-hydration, `sortBy` orthogonality, types.ts zero-change, zero i18n, zero styles, zero events, zero other frameworks, formula skip.

### Tests added (22)

- core +10: all-number / all-string / Date+ISO-string / boolean / mixed fail-safe / numeric-strings-stay-string / boolean-strings-stay-string / non-finite / nullish-skip + empty / 50-sample cap.
- react +12: spec ① header right-align (closes the gap) ② heterogeneous-row numeric sort (nullish skipped, numeric order, null first) ③ type inference ×3 (number / string / date / boolean — align + sort order), plus off-byte-identical, explicit-fields-win, preset interplay, one-shot (re-feed no re-detect), async arrival (empty → first non-empty), grouped leaves (group cell stays centered), formula skip + mixed fail-safe.

### Verification (all green)

- core **1569/1569** (1559+10) · react **2660/2660** (2648+12) · typecheck clean (both) · lint **0 errors** (pre-existing complexity warnings only)
- spec **0 violations** (1416 files) · prettier clean · `turbo run test typecheck lint build` on both packages 12/12 tasks
- `gen:manifest` regenerated (propCount 184 / eventCount 32); core rebuilt before react tests (react resolves core via dist)

### What's left

- vue/solid/svelte deliberately untouched (react-only bridge per baseline — same as 批 CP–CW).
- A column whose first 50 samples agree but a later row disagrees keeps the one-shot inference (documented fiat).
- No UI surface for the inferred type (align + sortType only) — not in spec.
