Complete. Final report:

## 批 CZ：跳到行 `goToRow`（iris 独有）— Done ✅

Commits (working tree clean):

- `73a295b4` — `feat(table): grid 批 CZ——跳到行 goToRow（iris 独有）`（17 files, +736/−71；含批 CY 遗留未提交 dirt 一并入库，另有 `069fc0ce`/`95b5905b` 两个 docs 记账提交）

### Files changed (3 impl + 1 test + manifest + docs)

| File                          | Change                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                    | +1：`IrisTableHandle.goToRow(key)` 单行成员（`scrollToRow` 后），文档说明 2s 高亮/单目标/no-op/零事件                                                                                                                                                                                                                                                                                         |
| `Table.tsx`                   | `ROW_TARGET_MS=2000` 常量（copyFlash 模具）；模块级 `findTableRowEl` 定位 helper（从 `scrollToRow` 提取，CSS.escape + jsdom 属性迭代回落）；`scrollToRow` 改走同一 helper（零行为变化）；新 handle `goToRow`（`scrollIntoView({block:'nearest'})` + `data-iris-row-target` + 定时器移除，单目标先标行立即清、重呼重启、卸载 effect 清理、未知键 no-op）；+ 批 CY 遗留 typecheck/lint 阻断修复 |
| `styles.ts`                   | +1 规则 `[data-iris-row-target="true"]`（紧跟 `[data-iris-row-current]` 之后）：color-mix `--iris-primary` 18% over `--iris-background`，`--iris-cell-bg`+`background` 双设，纯 token 零魔术值                                                                                                                                                                                                |
| `test/go-to-row.test.tsx`     | **新文件 213 行，11 测试**：spec ① 滚动 nearest ② 高亮 attr ③ 2s 移除；plus 重呼重启 / A→B 单目标 / 未知键 no-op / 引号键 / 卸载清理（detached 保留 attr 证明定时器已清）/ 无 handler 正交 / scrollToRow 只滚不高亮 / setCurrentRow 不设 target                                                                                                                                               |
| `packages/manifest/*`         | 重新生成（155 components、props **185**/events **32**——184 基线 + 批 CY `responsive` prop；goToRow 为 handle 方法零计数 diff）                                                                                                                                                                                                                                                                |
| `docs/vxe-grid-comparison.md` | 批 CZ 行（表第 72 行）+ 构建状态段尾补 CZ 条款                                                                                                                                                                                                                                                                                                                                                |
| `docs/vxe-grid/DECISIONS.md`  | adapt PASS 条目                                                                                                                                                                                                                                                                                                                                                                               |

### Verification (all green, post-commit)

- core test **1580/1580** · react **2671/2671**（2660→+11）
- react typecheck clean · react lint **0 errors**（1 既有 complexity warning，exit 0）
- `iris-ui-spec.py --mode all` → **0 violations**（新 CSS 全 token）
- `gen:manifest` + `check:manifest` up to date
- `go-to-row.test.tsx` ≤ 500 行 ✓ · 实现改动文件 ≤ 4 + 测试 ✓ · additive only（core 零改动、vue/solid/svelte 零改动）✓

### What is left

1. **Batch CY 的 React 桥未完成**（历史遗留）：core `computeResponsiveColumns` + `responsive` prop 声明 + en/zh `table.scrollHint` 键已入库，但 ResizeObserver 测量 / 列折叠应用 / scroll-hint 渲染缺位。我把其死代码 scaffolding（未用 `responsiveNarrowActive`/`responsiveLeadWidth`/缺 import）移除以过 typecheck/lint——props 声明与 core 原样保留，CY retry 可从本提交续接并做 spec 需要的 `responsive-narrow.test.tsx`（react 2674 目标、propCount 185→185）。
2. 高亮视觉的「源序赢 selection 后衰减回」是纯 CSS 行为，jsdom 无法断言——测试锁定 attr 生命周期，视觉由 token 规格门禁覆盖。
3. 全量 turbo gate（四框架 build/audit/E2E）未跑——仅执行任务 VERIFY 列出的命令。
