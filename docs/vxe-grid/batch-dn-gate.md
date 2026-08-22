Done. **Gate PASS path completed.**

## Verdict

`batch-dn-review.md` → **PASS**（验证式 adapt：功能已在 `61ec5418` 交付，`8258df80` 补 1 个分组叶回归测试 + 交付记录；本轮 gate 确认全绿）

## Gate results

- **Full repo gate** — `env COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful**（135 cached；test/typecheck/lint/build 全绿）
- **Audit** — `pnpm audit:security` → **No known vulnerabilities found (0)**；`pnpm audit:tokens` → **Audit clean (exit 0)**
- **Manifest** — `pnpm gen:manifest` → 155 components × 4（react/vue/solid/svelte 全满）、86 tokens，`headerStats` ×2 manifest.json + llms.txt props 列表已列；`pnpm check:manifest` → **up to date**（2 files，manifest.json + llms.txt 无漂移）

## Docs updated（`docs/vxe-grid-comparison.md`，iris 独有 section）

- **新增 批 DN 行**：`headerStats` 列头小统计——`props/advanced.ts:201` 默认 off fail-closed（`Table.tsx:287`）；`headerStatsByKey` memo（:3951-3967）从当前 body 经 `getCellValue` 咽喉只收有限数字、零有限值列跳过；平面（:8670）与分组叶（:8431 `isLeaf` 守卫）表头 `n=N · avg=X.XX` + `aria-label` + `data-iris-header-stats`；muted 12px token 样式（`--iris-muted`/`--iris-font-size-xs`/`--iris-space-xxs`）；与列汇总条 `columnTotals` 独立（:7935）
- **构建状态 summary 行追加** 批 DN 摘要（react 2815→2816、manifest 零 diff）
- **批 DL–DT 记录表** DN 行措辞收敛（表头小统计 + 有限数值咽喉 + 与 columnTotals 独立）

## Commit

- **Hash:** `9fff46f16ec06eb385b8d54eee5807030f0d711f` — `feat(table): grid 批 DN——列头统计（iris 独有）`
- **Message:** `feat(table): grid 批 DN——列头统计（iris 独有）`

## Final test counts

| Suite                                              | Files | Tests                |
| -------------------------------------------------- | ----- | -------------------- |
| react（含 DN 分组叶回归于 `batch-dl-dt.test.tsx`） | 246   | **2816**             |
| core                                               | 104   | **1597**             |
| vue                                                | 165   | 1573                 |
| solid                                              | 142   | 1013 (+38 hydration) |
| svelte                                             | 144   | 969 (+35 hydration)  |
| turbo                                              | —     | **180/180**          |
| audit:security / audit:tokens                      | —     | **0 / clean**        |
