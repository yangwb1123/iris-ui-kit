Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bk-baseline.md`** (46 lines) — the only file created; `git status` confirms the pre-existing BJ-stage `M` entries untouched, zero source files modified.

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Location** — spec says "core generateRows" → **NEW `packages/core/src/generate-rows.ts`** (framework-agnostic pure module, zero deps — `value-distribution.ts`/`formula.ts`/`diff-rows.ts` precedent). `generateRows(schema, count, seed?)` — spec's 2-arg form is primary; **`seed` optional, default 42** (spec's "种子随机"): determinism with no args, variation on demand.
- **PRNG** — module-local `mulberry32(seed >>> 0)`; draws in fixed row-major order (row×schema order) → byte-stable across calls/processes: no `Math.random`, no `Date.now`, no timezone (UTC dates).
- **Per-kind table** — `number` integer [min,max] default 0..1000 · `string` lowercase a–z, length [min,max] default 4..12 · `boolean` 50/50 · `date` ISO `YYYY-MM-DD` UTC string, min/max = epoch ms (defaults 2020-01-01..2025-12-31) · `email` `local@domain` (local length, fixed fake-domain list) · `phone` digits-only, first digit 1–9, digit count bounds.
- **Guards** — count ≤ 0 → `[]`; fractional floored; empty schema → `[]`; min>max swapped; NaN bounds → defaults; unknown runtime kind → key present with `null` (never throws — formula.ts precedent); fresh rows, schema-order keys.
- **Export** — core barrel after `diff-rows` (:196); **no react re-export** (react imports `@iris-ui-kit/core` directly — exportCsv precedent).

**File map**: 2 new core files + 1 core index.ts line + `docs/vxe-grid-comparison.md` 3 sites (iris-only row after :63, 构建状态 :279, test count :337). Zero: react/vue/solid/svelte/i18n/manifest — **no prop → propCount 152 unchanged; core-only → manifest 无 diff** (BF precedent).

**Test plan**: ~20 vitest cases — the spec-mandatory trio first: 类型 (6 kind checks) · 范围 (5 bounds checks) · 确定性 (same seed `toEqual` / default-seed stable / different seeds differ) + count/schema edges, min>max swap, NaN bounds, runtime-unknown-kind null, row shape, field independence.
