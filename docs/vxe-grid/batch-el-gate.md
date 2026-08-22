Gate stage for **批 EL（solid 同步：公式列，四框架对齐）** complete — **PASS → committed**.

## Verdict

`docs/vxe-grid/batch-el-review.md` = **PASS**（solid 公式列：`getCellValue` 2 参 `memoizedFormulaValue` 公式分支字节镜像 react AO / vue EK、`isEditableColumn`/`withComputedFormulaCells` 逐字薄桥、8 编辑触点全守卫、咽喉传播与 `useTableSort` 去重归档、arch ratchet 2339 ≤ 2340 守住；非阻塞按审查接受）。

## Gate results

| 门禁                                                  | 结果                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184**（142 cached + 42 实跑，2m0.585s；无 ssr-nuxt 类并发 flake）               |
| `audit:security` / `audit:tokens`                     | ✅ 0 vulnerabilities / exit 0（audit clean）                                             |
| `gen:manifest` + `check:manifest`                     | ✅ nil diff（155×4、86 tokens、unavailable=0；`formula` 是列字段非 prop 不增 propCount） |
| `format:check`                                        | ✅ clean（prettier 校正 4 份流水线文档对齐——ek-gate/el-adapt/el-review/DECISIONS）       |
| core framework-free                                   | ✅ `grep core/src from '(vue\|react\|solid\|svelte)'` = 0（批 EL 零触碰 core 与三框架）  |

## Final test counts（逐包直跑实测）

- **core** 104 files / **1597**（formula 24/24，未触碰）
- **solid** 143 files / **1028**（+15 批 EL `formula.test.tsx`，263 行）+ hydration **38/38**
- **react** 257 files / **3012** · **vue** 166 files / **1588** · **svelte** 146 files / **988 + 35 hydration**
- turbo **184/184** · audit:security **0** · manifest **155×4**（check:manifest 通过）

## Docs

`comparison.md` 批 EL 行补 gate 实测注 + 8 触点清单 + 构建状态行「七守卫→八守卫」（review LOW 闭合）；`batch-el-gate.md` 本报告 + DECISIONS.md 日志（批 EL baseline/adapt/review/gate 四条目）随批入库；`batch-ek-gate.md`/`batch-el-adapt.md` 已按流水线紧凑格式重写并在本批 prettier 校正。

## Commit

`<hash>` — `feat(table): grid 批 EL——solid 同步：公式列（四框架对齐）`（6 files：comparison.md、DECISIONS.md、el-gate/el-review/el-adapt/ek-gate 文档）。

按 DV/DW/…/EK 先例，并行任务的 `apps/aero-platform-console` 与 `pnpm-lock.yaml` 工作树改动原样未动（未跑字面 `git add -A`）。`apps/ssr-solidstart/.vinxi` 亦排除。
