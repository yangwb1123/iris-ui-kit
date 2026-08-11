Batch U gate complete. Final report:

## 批 U Gate — PASS ✅（功能移植收官）

**Review verdict**: PASS（3 非阻塞发现）→ 应用 2 个有处方的修复 + 1 个文档化 INFO：

1. **MEDIUM** — 缩放时 fixed 覆盖层遮住工具栏、✕ 不可达 → 缩放时工具栏内联提升 `zIndex: calc(var(--iris-z-popover, 1000) + 1)`，stylesheet 注释同步更正
2. **LOW** — `zIndex` prop 的 `position: relative` 拆掉 fixed 覆盖层 → 缩放分支在 `...style` 后强制内联 `position: fixed`（+ 既有 `height: 100%`）
3. **INFO** — 列面板两次 Esc 属预期行为，已写入 comparison doc 有意跳过项

新增 2 个回归测试（zoom-layouts-visiblemethod.test.tsx 21/21）。

### 全仓门结果

| 门                                                    | 结果                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（首轮 `ssr-nuxt#typecheck` 因 `nuxi prepare`/`nuxi build` 并发写 `.nuxt` 竞态失败一次，单独重跑通过，全量复跑 180/180） |
| React tests                                           | **1800/1800**（159 files；+2 新）· core 1249 · typecheck ✅ · lint 0 errors（1 既有 complexity warning）                                  |
| `pnpm audit:security`                                 | **0 vulnerabilities**                                                                                                                     |
| `gen:manifest` + `check:manifest`                     | 155 组件 × 4 框架对齐，up-to-date ✅                                                                                                      |

### 文档

- **comparison doc**：文首「最终覆盖总结」改写为收官声明——**vxe-grid 功能面全部移植完成（react）**：tableProps ~90 项 + 方法 + 事件 + grid 特有 layouts/zoom/visibleMethod；工具栏/布局行 ✅（react）；列能力清单补 visibleMethod；批 U 行补 review 修复；总数刷新 **react 1800 · core 1249 · 7401 total**；有意跳过项新增 zoom×列面板两次 Esc 差异
- DECISIONS.md 追加 gate 条目；gate 报告 `docs/vxe-grid/batch-u-gate.md`

### Commit

**`4231f050`** — `feat(table): vxe-grid 批 U——zoomConfig/layouts/visibleMethod（react only，功能移植收官）`（7 files, +186/−95；工作树干净；prettier/format ✅）
