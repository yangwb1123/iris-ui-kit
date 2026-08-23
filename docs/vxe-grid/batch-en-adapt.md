All gates green. Final state verified and committed.

## Report — iris-ui grid 批 EN：vue 同步审计日志（四框架对齐）

**Commit:** `0564fa23` — `feat(vue): grid 批 EN——审计日志同步（auditLog 四框架对齐）`

### Files changed (8, per batch-en-baseline file map — vue bridge only, no other framework touched)

| File                                                                 | Change                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/props.ts`                         | +`auditLog: { type: Boolean, default: false }` (additive, single-line, default off → zero push)                                                                                                                                                                            |
| `packages/vue/src/primitives/table/types.ts`                         | `IrisTableExpose` + `getAuditLog(): ReadonlyArray<AuditLogEntry>` / `clearAuditLog()` (named exported interface, new type via core)                                                                                                                                        |
| `packages/vue/src/primitives/table/Table.ts`                         | core `createAuditLog` 桥接：三漏斗 + `watch(tableData)` re-baseline + 工具栏触发钮 + `useFloating`/`useDismiss`/scroll-capture 面板 + expose 两个 handle                                                                                                                   |
| `packages/vue/src/primitives/table/table-sections.ts`                | `ToolbarSectionContext` + audit 触发钮（`data-iris-audit-trigger`，☰，open 态变色）；toolbar gate 纳入 `auditLog`（无 toolbar 配置也渲染，react parity）                                                                                                                  |
| `packages/vue/src/primitives/table/table-audit.ts` **(new)**         | `auditDiff`（react `interaction-helpers` 同款纯函数）+ `renderAuditPanelSection` + `TableAuditPanel` 组件（Teleport 到 body，DOM/styles 与 react `AuditPanel.tsx` 逐字同构；**组件内订阅** `audit.subscribe` → 原地刷新不重渲染整表，react `useSyncExternalStore` parity） |
| `packages/vue/src/primitives/table/audit-log.test.ts` **(new test)** | 11 例（≤500 行）                                                                                                                                                                                                                                                           |
| `packages/manifest/{manifest.json,llms.txt}`                         | regenerated — vue IrisTable 契约新增 `auditLog?`（与 react 对齐；F8「nil diff」修正：vue 契约按框架原生提取，如实新增）                                                                                                                                                    |

### Design (mirrors react batch AT exactly, via thin bridge)

- **提交点直记 'edit'**（`writeCellValue` 单一咽喉，inline + row 模式逐格）——规避 vue 非 proxy `props.data` 不可变导致的 stale-base 反转（F1，测试守卫）；单格条目与 react diff 逐字节一致
- **`removeRows`** 列表 diff 'remove'；**`loadData`** 列表 diff 'edit'（react `commitRowList` 默认 type parity）
- `watch(tableData)` re-baseline（parent 重喂 / proxy refetch / rowDrag 重排不记账）
- 工具栏审计面板：bottom-end floating、Esc / outside pointer-down（触发钮豁免）/任意 scroll 关闭

### Tests added — 11 (mirror react's 9, minus `insertRow`/`undo` which have no vue entry points)

1. edit 提交记 1 条（type/rowKey/column/old→new + seq 1）· 2. **连续两笔无反转（F1 验收）** · 3. **row 模式逐格各 1 条** · 4. removeRows 'remove' · 5. **loadData 结构 diff** · 6. **proxy + loadData re-baseline**（随后 removeRows 对新列表 diff）· 7. 面板最新在前 + 打开态原地刷新（直接 push 第 3 条）· 8. clear 按钮清空 + 空态 · 9. `clearAuditLog` seq 永不重置 · 10. Esc / outside 关闭 · 11. 无 prop 完全惰性

### Gate results

- `vue typecheck` ✅ clean
- `vue test` ✅ 167 files / **1599 tests**（+11 新审计测试；全量含 SSR）
- `vue lint` ✅ **0 errors**（1 warning 为 `renderRow` 复杂度 76——已用 HEAD 版本复测证实 pre-existing，非本次改动）
- `iris-ui-spec.py --mode all --json` ✅ **0 violations**（全 token 化 `--iris-*`）
- `gen:manifest` ✅ regenerated + committed；`check:manifest`/`framework-parity`/`docs-reference`/vue build 均通过

### What's left

- **「select 编辑器」**：批次标题含此词，但 batch-en-baseline 与 SPEC 均只定义 `auditLog`（react 的 `editor: 'select'` + `editOptions` 在 `editor-surface.tsx`，登录为 61ec5418 早期 commit，无对齐批次）——**不在本批范围**，需独立批次（vue 现仍只有 text/number 编辑器分支）。
- **F7 范围**：insert/paste/fill/undo 等在 vue 无入口未记账——`recordAudit` 已就位，后续批次直接接入。
- **F2**：`auditDiff` 留 vue 侧（react 亦然），core 收敛属独立批。
