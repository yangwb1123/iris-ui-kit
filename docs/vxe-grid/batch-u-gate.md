Gate complete. Final report:

## 批 U Gate — PASS ✅（功能移植收官）

**Review verdict**: PASS（3 个非阻塞发现：1 MEDIUM + 1 LOW 有明确修复处方，1 INFO）

### Review fixes applied

1. **MEDIUM — 缩放时工具栏被覆盖层遮住**：fixed 覆盖层（z-index popover 1000、不透明底）画在工具栏兄弟节点之上，✕ 退出按钮不可达。修复：缩放时工具栏内联提升 `zIndex: calc(var(--iris-z-popover, 1000) + 1)`（仍 `position: relative`），✕ 始终可达；stylesheet 注释同步更正（vxe 把工具栏放进缩放根内，本实现等效提升）。
2. **LOW — `zIndex` prop 拆盖**：`zIndex` prop 的内联 `position: relative` 覆盖样式表 `position: fixed`，zoom + `zIndex` 时覆盖层永不固定。修复：缩放分支在 `...style` 之后强制内联 `position: fixed`（连同既有 `height: 100%`），调用方 style/zIndex 无法再拆盖。
3. **INFO — 列设置浮层 Esc 两次退出**：浮层随工具栏提升后不再被遮挡；Esc 先关浮层再退出缩放的两次按键为预期行为，已文档化到 comparison doc 有意跳过项。

新增 2 个回归测试（zoom-layouts-visiblemethod.test.tsx：21 tests 全绿）。

### Full gate results

| 门                                                    | 结果                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（3m5s；首轮 ssr-nuxt#typecheck 因 `nuxi prepare`/`nuxi build` 并发写 `.nuxt` 竞态失败一次，单独重跑通过，全量复跑 180/180） |
| React tests                                           | **1800/1800**（原 1798 + 2 新）· core 1249/1249 · typecheck ✅ · lint 0 errors（1 个既有 complexity warning）                                 |
| `pnpm audit:security`                                 | **0 vulnerabilities**                                                                                                                         |
| `gen:manifest` + `check:manifest`                     | 155 组件 × 4 框架对齐（react/vue/solid/svelte），up-to-date ✅                                                                                |

### Docs

- **comparison doc**：文首「最终覆盖总结」改写为收官声明——**vxe-grid 功能面全部移植完成（react）**：tableProps ~90 项 + 方法 + 事件 + grid 特有 layouts/zoom/visibleMethod；工具栏/布局行已标 ✅（react）；列能力清单补 visibleMethod（批 U ✓ react）；批 U 构建行补 review 修复说明；总数刷新（react 1800 · core 1249 · 7401 total）；有意跳过项新增 zoom 与列面板同开的两次 Esc 差异
- DECISIONS.md 追加 gate 条目（含 commit 哈希）

### Commit

**`9e294599`** — `feat(table): vxe-grid 批 U——zoomConfig/layouts/visibleMethod（react only，功能移植收官）`
