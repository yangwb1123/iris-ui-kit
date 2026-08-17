All verification green, working tree clean. Final summary:

## 批 DB：编辑历史侧边 `editSidebar`（iris 独有）— Done ✅

### Commits

- `4d802ba9` — `feat(table): grid 批 DB——编辑历史侧边 editSidebar（iris 独有）`（10 files, +814/−3）
- `653af8b0` — `docs: batch 账本`（DECISIONS + DA gate 遗留 dirt 一并入库）

### Files changed (5 impl + 1 test + manifest)

| File                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/.../table/props.ts`             | +1 prop `editSidebar?: boolean`（`recentFilters` 后，完整契约文档）                                                                                                                                                                                                                                                                                                                                                            |
| `react/.../table/Table.tsx`            | +37：import / 解构 / `editSidebarOpen` state / 工具栏门追加 / ⏳ 触发器（`data-iris-edit-sidebar-trigger`，接 history 之后，样式与兄弟触发器逐字一致）/ 面板挂载（fail-closed 双源：`versionHistory ? history : null`、`auditLog ? audit : null`；onRestore → `restoreVersion` + 关闭）                                                                                                                                        |
| `react/.../table/EditHistoryPanel.tsx` | **新 315 行**：`TableEditHistoryPanel`（portal、fixed 360px、无 backdrop 非模态、`--iris-*` 全 token、`insetInlineEnd`/`borderInlineStart` 逻辑属性）+ 导出 `mergeEditTimeline`（稳定两指针合并，同毫秒 tie audit 在前）+ 导出 `EditHistoryTimelineItem`；双 `useSyncExternalStore` 就地刷新；Esc/外部 pointer-down/任意 scroll 关闭 + 触发器豁免；版本条目点击恢复不重推；审计条目 `#seq+钟表+type+rowKey+column+老→新`；空态 |
| `core/src/i18n.ts`                     | +2 键（`table.editSidebar` / `table.editSidebar.empty`）                                                                                                                                                                                                                                                                                                                                                                       |
| `plugin-locale-zh/src/core/index.ts`   | +2 中译（locale-zh 测试断言 `defaultMessages` 全覆盖，**不加必红**；AT/BA 同款先例）                                                                                                                                                                                                                                                                                                                                           |
| `edit-sidebar.test.tsx`                | **新 367 行（≤500 ✓），11 测试**：面板 5（触发+portal 常驻 / 就地刷新双环 / 三路关闭 / toggle 豁免 / 空态）+ 列表 6（合并顺序+同毫秒 tie / 单源透传 / version 条目+点击恢复不重推 / audit 条目 / 单源渲染隔离 / 8 类 type 冒烟）                                                                                                                                                                                               |
| `packages/manifest/*`                  | 重新生成 155 components × 4（面板内部不入 barrel，AT/BA 先例）                                                                                                                                                                                                                                                                                                                                                                 |

### Verification (all green)

- **core test 1580/1580** ✓（框架无关零改动）
- **react typecheck clean** ✓ · **react test 2682/2682** ✓（2671 → +11）
- **react lint 0 errors** ✓（1 既有 `IrisTable` complexity warning）
- **iris-ui-spec.py --mode all → 0 violations** ✓
- **gen:manifest + check:manifest up to date** ✓ · prettier clean ✓ · locale-zh 6/6 ✓

### What is left

1. **review 阶段**（`batch-db-review.md` 对抗审查）+ **全仓 gate**（turbo 四框架 build/audit/E2E/视觉回归——本任务只执行 VERIFY 列出的命令）。
2. RTL/视觉回归未跑：方向相关已用 CSS 逻辑属性、样式纯 token，无 left/right 硬编码。
3. 核心控制器/types/vue/solid/svelte **零改动**——`editSidebar` 为纯视图层集成（批 AT/BA 记录层就位，prop 只挡 UI），后续四框架扩展只需各加薄桥。
