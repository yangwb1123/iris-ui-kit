Complete. Final report:

## 批 DB：编辑历史侧边 `editSidebar`（iris 独有）— Done ✅

### What shipped

`editSidebar?: boolean` —— 工具栏 ⏳ 触发器 → **右侧边面板**（portal、`position: fixed`、360px、无 backdrop 非模态），把批 AT 的审计环（`createAuditLog`）与批 BA 的版本环（`createVersionHistory`）**合并成一条时间线**（`at` 降序，同毫秒并列 audit 在前——按记录顺序的确定性裁决）。纯视图层集成：底层两个 controller 无条件创建、prop 只挡 UI（对照 :3263/:3314），**零 core 控制器改动**。

### Files changed

| File                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `props.ts`                           | +1：`editSidebar?: boolean`（`recentFilters` 后），非受控独立 UI 门                                                                                                                                                                                                                                                                                                                                                                                    |
| `Table.tsx`                          | +37/−0：`TableEditHistoryPanel` import；`editSidebar` 解构；`editSidebarOpen` state；工具栏门追加 `editSidebar`（同 `versionHistory` 同等待遇）；⏳ 触发器（`data-iris-edit-sidebar-trigger`，接 version-history 触发器之后，toggle 语义，aria-label/title 走 i18n）；面板挂载（`versionHistory ? history : null` / `auditLog ? audit : null` **fail-closed 双源**，onRestore 走 `restoreVersion` + 关闭，onClose 关闭）                               |
| `EditHistoryPanel.tsx`               | **新文件 313 行**：`TableEditHistoryPanel`（portal 渲染，role=dialog、fixed 360px、`--iris-*` 全 token）+ 导出 `mergeEditTimeline`（双环两指针稳定合并）+ 导出类型 `EditHistoryTimelineItem`（v/a 判别联合）；双 `useSyncExternalStore` 就地刷新（null 源用稳定 no-op 绑定）；Esc / 外部 pointer-down / 任意 scroll 三路关闭 + 触发器豁免；版本条目可点（恢复 + 不重推，同 version-history 面板）；审计条目 `#seq+钟表+type+rowKey+column+老→新`；空态 |
| `core/src/i18n.ts`                   | +2：`table.editSidebar` / `table.editSidebar.empty`（defaultMessages，表段）                                                                                                                                                                                                                                                                                                                                                                           |
| `plugin-locale-zh/src/core/index.ts` | +2：`编辑历史` / `暂无编辑`（locale-zh 测试断言 `defaultMessages` 无未译键——不加必红）                                                                                                                                                                                                                                                                                                                                                                 |
| `edit-sidebar.test.tsx`              | **新文件 359 行，11 测试**（< 500 ✓）：面板 5 例（触发+portal 常驻 / 就地刷新双环 / 三路关闭 / 触发器 toggle 豁免 / 空态 fail-closed）+ 列表 6 例（合并顺序+同毫秒 tie / 单源透传 / version 条目渲染+点击恢复不重推 / audit 条目渲染 / 单源渲染隔离 / 8 类 type 冒烟）                                                                                                                                                                                 |
| `packages/manifest/*`                | 重新生成（155 components × 4；editSidebar 为 prop——props 计数 +1，面板内部组件不入 barrel，与 AT/BA 先例一致）                                                                                                                                                                                                                                                                                                                                         |

Changed count：**5 源码 + 1 测试** —— 核心实现 4 件（props + Table + 新面板 + core i18n），zh 同步 1 件为 AT/BA 同款先例（locale-zh 测试断言 `defaultMessages` 全覆盖，不加必红）；manifest 为生成物。全部 additive，core 控制器/types/三框架零改动。

### Verification（全部 green）

| Check                         | Result                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| core test                     | **1580/1580** ✓（框架无关零改动）                             |
| react typecheck               | clean ✓                                                       |
| react test                    | **2682/2682** ✓（2671 → +11）                                 |
| react lint                    | **0 errors**（1 既有 Ir​​isTable complexity warning，exit 0） |
| iris-ui-spec.py --mode all    | **0 violations** ✓（CSS 全 token）                            |
| gen:manifest + check:manifest | 155×4 重新生成、up to date ✓                                  |
| plugin-locale-zh test         | 6/6 ✓                                                         |

### What is left

1. **review 阶段**：`batch-db-review.md`（作对抗审查）+ 全仓 gate（turbo 四框架 build/audit/E2E 未跑——本任务只执行 VERIFY 列出的命令）。
2. **多框架 RTL/视觉**：面板方向相关全部用 CSS 逻辑属性（`insetInlineEnd`/`borderInlineStart`），无 left/right 硬编码；视觉回归由仓库视觉门禁覆盖（本批未跑）。
3. 交接 `docs/vxe-grid/DECISIONS.md` 的 adapt PASS 条目由 review/gate 阶段记账追加。
