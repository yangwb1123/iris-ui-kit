# 批 EC gate 报告

**FAIL → 修复 → PASS → committed.** Gate stage complete.

## Review 结论

`batch-ec-review.md` = **FAIL**（1 HIGH + 1 LOW）：

1. **HIGH — clamp feedback trap**（`cell-helpers.tsx`/`Table.tsx`）：一旦行被钉住（inline `height: h`），该行布局盒高 **就是** `h`——之后内容增长（数据提交/变窄 resize/字体/density）被单元格 inline `overflow: hidden` 裁掉，而 `row.offsetHeight` 仍读回钉住的 `h` → 同值 bail → 行永久冻结（也永不缩）。**jsdom 看不见**（测试直 stub offsetHeight，绕过了 pin↔read 反馈环）。修复：`measureAdaptiveRowHeights` **读数前清 inline 高**（`row.style.height = 'auto'`）；另加真实浏览器 Playwright 验证路径。
2. **LOW（可选）— perf**：依赖无关 layout effect 每 commit 重测全部行（selection/hover 也触发），identity bail 只止渲染噪声不止布局成本。建议 dep-gate 到内容影响变更。

## 修复落地

| 修复                    | 实现                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH 主修复             | `adaptive-height.ts`（新模块）：`measureAdaptiveRowHeights` 只清**已钉住**行（未钉行本就自然高，不触碰 inline），清→读→原位还原三趟 = 整扫描 **ONE 次强制布局**；同 commit 兄弟 layout effect 仍见高度 map；bail 路径 DOM≡map 无漂移。来源文件 `cell-helpers.tsx` 499→**447** 行（≤500 压线，helpers 拆出新模块） |
| HIGH 验证（jsdom）      | `batch-ec.test.tsx` 19→**22**：+1 helper 单测（offsetHeight getter 模拟浏览器「钉住=读回 pin / 清空=自然高」语义，验证清读还原 + 自然高重测）+2 集成（clamp-trap 增长自愈 44/120、收缩释放 30/40——无修复必冻结）                                                                                                  |
| HIGH 验证（真实浏览器） | `apps/cms-react/e2e/adaptive-height.spec.ts` **3 tests**：数据行内容换行行高差异 · 钉住行增长后自愈变高（`expect.poll` 高度上升）· 表头保持单行。`VxeGridExamplePage` 增「内容自适应行高」演示区 + 增长按钮（数据 commit 路径）。**Chrome 实测 3/3**（dev server + playwright chromium）                          |
| LOW                     | 保持依赖无关（正确性优先——editing/paging/filter/sort 等内部状态无法枚举进 dep 数组，dep-gate 会重引入冻结行回归；代码注释写明取舍）；布局成本经两趟清读降至 **1 次强制布局/commit**，identity bail 照旧止重渲                                                                                                     |

## 全门禁结果

| 门禁                                                  | 结果                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184**（125 cached）                                                                                         |
| `audit:security`                                      | ✅ **0** vulnerabilities                                                                                             |
| `audit:tokens`                                        | ✅ clean（exit 0）                                                                                                   |
| `check-filesize --diff`                               | ✅ 4 files **0 failed**（cell-helpers 447 / adaptive-height 74，均 ≤500；测试文件豁免）                              |
| `gen:manifest` + `check:manifest`                     | ✅ up to date，nil diff — **207 props / 33 events / 155×4 / 86 tokens**（修复零新 prop，manifest 与 committed 一致） |

### 最终测试计数

- **react**: 256 files — **2990/2990**（batch-ec **22/22**：= 已提交 19 + 修复新增 3）
- **core**: 106 files — **1641/1641**（零 core 逻辑改动，framework-free）
- **manifest**: 69/69（含 framework-contracts、contract-coverage）
- **cms-react app test**: 2 files — 3/3
- **lint**: 0 errors（2 条 Table.tsx 既有 complexity warning，base HEAD 同款）
- **typecheck**: ✅（react/core/full 通过）
- **Playwright（真实浏览器）**: `adaptive-height.spec.ts` **3/3**（chromium，本机 Chrome channel；不属于 turbo gate，CI E2E 另行运行）

## 文档

`docs/vxe-grid-comparison.md`「iris 独有」节新增 **批 EC 行**（紧跟批 EB）：`adaptiveRowHeight` 激活门（BN 咽喉三态 inert）、CSS 换行释放（保留角色 :not 排除）、每-commit/RO/resize 自愈、clamp-trap 修复（清读还原 + ONE 布局 + jsdom 模拟 + Playwright 双验证）、identity bail / ≤0 自然高 / rowStyle 逃生舱、`adaptive-height.ts` 拆模、22 jsdom + 3 Playwright 测试计数、manifest 206→207。

## Commit

**`ea3c25f6`** — `feat(table): grid 批 EC——内容自适应行高（iris 独有）`（impl：adaptive-height.ts/cell-helpers/Table/batch-ec.test + cms-react demo+e2e + comparison 批 EC 行 + review 文档）＋本文档门禁提交（同条 feat msg，EB 先例两提交）

⚠️ **Deviation（DV/DW/DX/DY/DZ/EA/EB 先例）**：未跑字面 `git add -A`——并行 grid-refactor 管线的工作树改动（`packages/core/src/data-grid/`、`plugin-pro-table/src/core/grid/`、SPRINT/ADR、`check-size.mjs`/`arch-baseline.json`、aero-platform-console、pipeline yamls、既有批次 gate/adapt 文档改写）全部原样未动；EC 提交仅含批次自身文件。`apps/ssr-solidstart/.vinxi` 本就不在提交集内。
