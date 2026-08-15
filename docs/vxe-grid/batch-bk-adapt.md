All gates green on the committed state. Done.

## Report — grid 批 BK: 测试数据生成 `generateRows`（iris 独有）

### Files changed (4, committed)

| File                                            | Change                                                                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/generate-rows.ts` (NEW)      | `generateRows(schema, count, seed?)` — pure, framework-agnostic, zero-dep deterministic mock generator + `GenerateRowColumn` / `GenerateRowsKind` named exported types + module-local `mulberry32` PRNG (seed `>>> 0`, default **42**) |
| `packages/core/src/generate-rows.test.ts` (NEW) | 288 lines ≤ 500 · **28 tests** (spec-mandatory trio first: 类型 / 范围 / 确定性)                                                                                                                                                       |
| `packages/core/src/index.ts`                    | barrel export `generateRows` + types after `diff-rows` (:196→:202)                                                                                                                                                                     |
| `docs/vxe-grid-comparison.md`                   | iris-only row + 构建状态 批 BK + test count core 1475→1503                                                                                                                                                                             |

### Design (per baseline fiats)

- **Determinism** — every call instantiates its own `mulberry32(seed >>> 0)` (default 42, the spec's 2-arg primary form); same `(schema, count, seed)` triple is byte-stable across calls/processes; no `Math.random`/`Date.now`/timezone (UTC `YYYY-MM-DD`); **row-major draws** (row × schema order — prefix-truncation stable; adding a column re-streams later draws, documented)
- **Per-kind table** — `number` integer [0..1000] · `string` lowercase a–z length [4..12] · `boolean` 50/50 · `date` epoch-**ms** bounds default 2020-01-01..2025-12-31 UTC · `email` local@fixed-fake-domain (local length [4..12]) · `phone` digits-only first 1–9, count [7..11]
- **Guards (never throws, formula precedent)** — `count ≤ 0`/non-finite → `[]`; fractional floored; empty schema → `[]`; min>max swapped; NaN bounds → defaults; runtime-unknown kind → key present with `null`; fresh rows, schema-order keys; input schema never mutated (frozen-input test)
- **React/vue/solid/svelte/i18n/manifest: zero changes** — pure core API, no prop → propCount stays 152; manifest regenerated with **zero diff** (core-only, BF precedent)

### Tests added (28)

类型 6（string/number/boolean/date/email/phone 形态）· 范围 5（string 长度/number 界/date 界含 min=max 单日/email local/phone 位数）· 确定性 4（同种子 toEqual + fresh 对象/默认种子稳定/diff 种子不同/seed 0·负值）· count/schema 边界 5（≤0·NaN·Infinity 空/小数取整/空 schema/精确行数/键序）· 守卫 5（min>max 交换/NaN 界回落/未知 kind null/date 默认域/number·string 默认界）· 独立性 3（6 kind 同 schema 各自契约/种子相同 schema 顺序参与输入空间 + 前缀截断稳定/纯函数不改输入）

### Verification (all green)

- `core test`: **1503/1503** (96 files, pre-BK 1475 + 28) ✓ · `core typecheck` ✓ · `core lint`: **0 errors** (7 pre-existing warnings) ✓
- `react test`: **2194/2194** ✓ · `react typecheck` ✓ · `react lint`: **0 errors** (1 pre-existing `IrisTable` complexity warning) ✓
- `iris-ui-spec.py --mode all --json`: **0 violations** ✓
- `gen:manifest`: regenerated, **zero diff** (155×4, manifest clean) ✓
