All done and committed. Working tree is clean except the pre-existing BJ-stage `M` entries (untouched).

## Report — grid 批 BK: 测试数据生成 `generateRows`（iris 独有）

### Commits

- `0e8f1b24` — `feat(core): grid 批 BK——确定性 mock 数据生成 generateRows（iris 独有）`
- `1a901cfd` — `docs(table): grid 批 BK baseline` (tracked per BJ precedent)

### Files changed (4 + pipeline docs)

| File                                                         | Change                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/generate-rows.ts` (NEW, 172 ln)           | `generateRows(schema, count, seed?)` + named exported types `GenerateRowColumn`/`GenerateRowsKind`; module-local `mulberry32(seed >>> 0)` (default **42**); 6 kinds (string/number/boolean/date/email/phone) with kind-relative min/max; all guards fail-inert |
| `packages/core/src/generate-rows.test.ts` (NEW, 294 ln ≤500) | **28 tests** — spec trio first: 类型 (6) · 范围 (5) · 确定性 (4) + count/schema 边界 (5) · 守卫 (5) · 独立性 (3)                                                                                                                                               |
| `packages/core/src/index.ts` (+1 ln)                         | barrel export after `diff-rows`                                                                                                                                                                                                                                |
| `docs/vxe-grid-comparison.md`                                | iris-only row · 构建状态 批 BK · test count core 1475→1503                                                                                                                                                                                                     |
| `docs/vxe-grid/batch-bk-{baseline,adapt}.md`                 | pipeline trail                                                                                                                                                                                                                                                 |

### Verification (all green)

- **core test** 1503/1503 (96 files, +28) · core typecheck ✓ · core lint **0 errors** (7 pre-existing warnings)
- **react** typecheck ✓ · test 2194/2194 ✓ · lint **0 errors** (1 pre-existing `IrisTable` complexity warning)
- **iris-ui-spec.py --mode all**: **0 violations** · **gen:manifest**: regenerated, **zero diff** (155×4; core-only → no manifest change, BF precedent)

### Notes

- **One baseline correction**: my first test asserted "adding a schema column doesn't re-randomize earlier columns" — that contradicts the baseline's row-major draw design (appending a column shifts later draw positions). Replaced with the actual invariants: schema order is part of the input space, and prefix-truncation is stable (row r depends only on rows < r). Docstring overclaim removed.
- Constraints honored: core zero framework imports · no react/vue/solid/svelte/i18n/prop changes (propCount 152 unchanged) · no dist/tgz/node_modules/manifest.json edits · no CSS touched.
- Left: nothing — review + gate stages are the next pipeline steps (gate per `batch-bk-review.md` when available).
