Gate stage complete. ✅

## Verdict: PASS (1 LOW / 2 INFO, 0 blockers) → gate executed, committed

### Findings disposition

- **LOW (`generate-rows.ts:127` `intBetween` — non-integer bounds violate the module's own `[min,max]` invariant; probe `min: 0.5, max: 1.5` → 108/200 rows out of range: 0, 2)** — **fixed**: `boundsOf` now clamps fractional bounds to the enclosing integer range (`Math.ceil` min / `Math.floor` max; range with no integer inside pins to `floor(max)` — never empty, never throws), with the min>max swap applied on raw values before clamping. Integer bounds (all documented cases, incl. seed-42 determinism) are byte-unchanged. +2 regression tests (fractional clamp across kinds incl. string length; empty-integer-range pin).
- **INFO (`randomDigits` first-digit rule at min 0)** — documented behavior (first digit 1–9 forces ≥1 digit); invariants mutually exclusive at 0 only; no action.
- **INFO (`__proto__`/`constructor` keys silently dropped)** — schema keys are developer-authored column keys; no action.

## Gate results

| Check                                                 | Result                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `turbo run test typecheck lint build` (concurrency 2) | **180/180 tasks**, exit 0 (one transient ssr-nuxt Nuxt client/server manifest race on first run — passes clean standalone and on rerun; unrelated to BK core-only delta) |
| lint                                                  | 0 errors                                                                                                                                                                 |
| `pnpm audit`                                          | **0 vulnerabilities**                                                                                                                                                    |
| `gen:manifest` + `check:manifest`                     | regenerated, **up to date** — 155×4, 86 tokens (core-only change → zero diff, BF precedent)                                                                              |
| core framework-free / additive                        | `generate-rows.ts` zero imports; delta = 2 core files + docs; no react/vue/solid/svelte/i18n/CSS/token/manifest changes                                                  |

## Doc updates (`docs/vxe-grid-comparison.md`, iris 独有 section)

- 批 BK `generateRows` row: fractional-bound clamp semantics added to kind semantics + test count 28 → **30** (含小数钳制回归 2) + review-fix note; 构建状态 批 BK segment annotated with the review fix; count line core 1503 → **1505** (批 BK +28→+30).

## Commit

**`<filled by git> feat(table): grid 批 BK——测试数据生成（iris 独有）`** (pre-commit prettier/filesize/budget hooks passed)

### Final test counts

- **core 1505/1505** (96 files) · **react 2194/2194** (194 files) · vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration
- 180/180 turbo · audit 0 · manifest 155×4 up to date
