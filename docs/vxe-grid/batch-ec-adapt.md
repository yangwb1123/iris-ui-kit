# 批 EC adapt 报告

**Implemented: batch EC — 内容自适应行高 (`adaptiveRowHeight`, iris 独有 — vxe `autoHeight` 是撑满视口，无内容换行行高)** — committed as `db121dfb feat(table): grid 批 EC——内容自适应行高（iris 独有）`.

## Files changed (8, incl. manifest + baseline doc)

| File                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/editing.ts`             | `adaptiveRowHeight?: boolean`（single-line，排在 `rowHeight` 之后）                                                                                                                                                                                                                                                                                                                                                              |
| `packages/react/src/primitives/table/Table.tsx`                    | `adaptiveHeights` state（null = 未钉住/自然高）+ ref 镜像 + `adaptiveOn = adaptiveRowHeight === true && effectiveRowHeight == null && !virtualScroll`（对 BN 咽喉三态 inert）；依赖无关 layout effect 每 commit 测量、同值 identity bail、window resize + ResizeObserver 重测、off 清空；根标记 `data-iris-adaptive-height`；`renderBodyEntry` 用 `rowHeightStyleOf ?? adaptiveHeightStyleOf(...)`（`rowStyle` spread 最后仍赢） |
| `packages/react/src/primitives/table/cell-helpers.tsx`             | `adaptiveHeightStyleOf` + `measureAdaptiveRowHeights` 两个模块 helper + `ADAPTIVE_ROW_ATTR_SKIP`（jsdom 可单测，模块级保 renderBodyEntry 平）                                                                                                                                                                                                                                                                                    |
| `packages/react/src/primitives/table/table-css.ts`                 | TABLE_ROW_CSS 新增 `[data-iris-table][data-iris-adaptive-height="true"] [role="row"][data-iris-table-row]:not(header/summary/loading/empty/error/footer-*) [role="cell"]` → `white-space: normal !important + word-break: break-word`（压过 inline nowrap 基底；表头/汇总/页脚/状态行仍 nowrap）                                                                                                                                 |
| `packages/react/src/primitives/table/test/batch-ec.test.tsx`（新） | 299 行，19 例                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `packages/manifest/{manifest.json,llms.txt}`                       | 重新生成 — IrisTable **206 → 207 props**，events 33 不变                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/vxe-grid/batch-ec-baseline.md`                               | baseline doc                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Tests added (19, 299 行 ≤ 500)

helper 单测 2（measure 建图/保留角色排除/≤0 跳过/detail wrap 排除/同值 identity bail/stale key 收缩；styleOf off/未知/≤0→undefined、String 键归一）· 门控 5（默认 fail-closed 无标记；`rowHeight`/`virtualScroll` 双 inert；on 有标记；中途关掉清标记+释放钉住高度；空 body 无崩溃）· 行高差异/自愈 8（**32 vs 63 差异保留**；数据 commit 重测重钉；同值 bail 无回路无常量漂移；window resize 无 commit 重测；≤0 行自然高永不 0px；保留角色键碰撞 fiat；rowStyle escape hatch 赢；分组模式数据行测量 + 组头不钉）· 契约 3（props 类型、CSS 规则具名门控 + 无裸 hex、SSR renderToString 安全带标记）。

## Verification (committed state)

- `core test` — 1641/1641 ✓ · `manifest test` 69/69 ✓
- `react typecheck` ✓ · `react test` — 256 files, **2987/2987**（+19）✓
- `react lint` — **0 errors**（2 条既有复杂度 warning，base HEAD 相同）✓
- `iris-ui-spec.py --mode all --json` — **0 violations** ✓
- `gen:manifest` 重新生成并提交 ✓ · `node cli.mjs check-filesize --diff` PASS（cell-helpers.tsx 压到 500 行内）

## Design points / fiats honored

CSS 换行走数据属性规则（零单元格渲染点改动；!important 压 inline nowrap 基底——表头/汇总/页脚/状态行 :not 排除）；测量 = 依赖无关 layout effect 每 commit 读 offsetHeight、整体 diff 一次 setState、同值返回同一引用（React bail，无回路）；`≤0`（jsdom/SSR/hidden）跳过保留自然高——永不 0px 塌陷；window resize + ResizeObserver 重测；数据/编辑/字体/density 变化经重渲自愈；`rowStyle` escape hatch 赢；virtual/rowHeight 双 inert；行键=attr 保留词碰撞预存在接受（文档化 fiat）；零外围（无 i18n/core/types/styles/VirtualScroll/其余框架改动）。

## What's left

Nothing for this batch: full repo `turbo run test typecheck lint build` gate + `batch-ec-gate.md`/review docs are the pipeline's post-commit stage. `origin/main` divergence: branch has 18 local commits vs 1 remote — pre-existing (prior batches), not caused here. Pre-existing dirty files (`docs/*` gates, `packages/core/src/data-grid/`, `scripts/*` baselines, apps Dockerfile) were intentionally not committed.
