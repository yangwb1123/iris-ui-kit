# vxe-grid 批 V — Adapt 报告（代理方法 + 事件）

**Commit:** `ba5615c3` — `feat(table): vxe-grid 批 V——代理方法 loadData/reloadData/commitProxy/getProxyInfo + 事件 onEditStart/onEditClosed/onSelectAllChange/onScroll（react only）`

## Files changed（4 source + 1 test + docs + manifest = 10）

| File                                                                     | Change                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                           | +3 具名参数接口（`IrisTableEditStartParams` / `IrisTableEditClosedParams` / `IrisTableScrollParams`，均导出）+ `IrisTableHandle` 追加 4 条**单行**类型条目（loadData/reloadData/commitProxy/getProxyInfo） |
| `packages/react/src/primitives/table/props.ts`                           | 4 条单行事件 prop（`onEditStart`/`onEditClosed`/`onSelectAllChange`/`onScroll`），495/500 行（未超限）                                                                                                     |
| `packages/react/src/primitives/table/Table.tsx`                          | ~+93 行：handle 4 方法、beginEdit/cancelEdit/commitEdit 事件、toggleAll 事件、非虚拟 onScroll 原生监听 effect、虚拟列 handler 扩展                                                                         |
| `packages/react/src/primitives/table/index.ts`                           | 3 个新类型再导出                                                                                                                                                                                           |
| `packages/react/src/primitives/table/test/proxy-methods-events.test.tsx` | **新文件**，272 行，10 tests                                                                                                                                                                               |
| `docs/vxe-grid-comparison.md` / `docs/vxe-grid/DECISIONS.md`             | 覆盖总结 + 决策记录                                                                                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`                             | `pnpm gen:manifest` 重新生成（react table 117→121 props、21→25 events、+3 types；155 组件四框架对齐不变，diff 纯增量）                                                                                     |

## 实现要点

- **handle 方法**（mount 期引用，无 stale closure）：
  - `loadData(rows)` → `commitRowList(rows)`（liveData 写回通道，fire onDataChange）；core remote source **无 setData**（已核对控制器字面量 `getState/subscribe/request/refetch/setParams/destroy`），代理 state 的 total/page 在下次 query 前不变（类型文档化）。
  - `reloadData()` = `proxyRef.current?.refetch()` 别名。
  - `commitProxy(overrides)` → `proxyRef.current?.setParams(overrides)`（setParams 已存在且必然发请求）。
  - `getProxyInfo()` → `getState()` 映射 `{ page, pageSize, total }`，无代理时 `null`。
- **onEditStart**：`beginEdit` 内 `cellEdit.startEdit` 之后 fire（`{ row, column, rowIndex }`）；行编辑模式走 `switchRowEdit` 不经 beginEdit → 天然 cell-only。
- **onEditClosed**：包裹 `commitEdit`/`cancelEdit`。提交路径在 `cellEdit.commitEdit()` 返回 true 后读 `cellEdit.getValidated()`（core store 的 `validated` 槽 = 同步提交后的 coerced 值；cancel 时被清空）；取消路径 fire `cancelled: true`。拒绝提交（校验失败）不 fire。文档化简化：行编辑模式（按列独立 store）与异步校验落盘不报告。
- **onSelectAllChange**：`toggleAll`（表头 checkbox onChange 调用点）内 `selModel.toggleAll(keys)` **之前** fire pre-toggle 态 `(allSelected ? true : someSelected ? 'indeterminate' : false)` + `[...displaySelection]`。vxe 无此 emit，增量设计。
- **onScroll**：虚拟列模式扩展既有 JSX onScroll handler 同时 fire `{ scrollTop, scrollLeft }`；非虚拟且传了 onScroll 时，`useEffect` 在 `rootRef` 挂原生 scroll 监听（含 cleanup；presence-gated，仅 `height`/fixedHeight 固定时有意义，否则 overflow hidden 无事件——文档化）。

## Tests added（10）

1. `loadData` 替换行且**不**触发二次 query（mock query 断言 1 次）
2. `reloadData` 再次 query（断言 2 次 + 参数不变）
3. `commitProxy` 合并 overrides 重查（page 3 / pageSize 5）
4. `getProxyInfo` 返回 page/pageSize/total；无代理 `null`
5. `onEditStart` 双击编辑打开时 fire（坐标断言）
6. `onEditClosed` Enter 提交带 coerced 值；Escape 取消 `cancelled: true`（含写回后 live row 断言）
7. 校验拒绝不 fire onEditClosed
8. `onSelectAllChange` 三态：false→全选→indeterminate，含 pre-toggle 语义与选择快照
9. `onScroll` 虚拟列模式（scrollTop/scrollLeft）
10. `onScroll` 非虚拟原生监听 + cleanup 后不再触发

## Verification

- react typecheck ✅（0 错误）
- react tests **1810/1810**（160 files，含新 10）
- react lint **0 errors**（1 pre-existing `IrisTable` complexity 警告，历批已有）
- `iris-ui-spec.py --mode all` → **0 violations**
- `pnpm gen:manifest` ✅ 重新生成并提交
- lint-staged：prettier 通过 · filesize 通过（props.ts 495/500、types.ts 451/500 警告不阻塞）· change budget 通过（8 files ≤10 hard stop，core logic +142 ≤300）

## 未竟（显式决定，均文档化）

1. `loadData` 后代理 total 不变直到下次 query（core remote source 无 setData——类型与 comparison doc 文档化）。
2. 行编辑模式不报 `onEditStart`/`onEditClosed`（每列独立 store 会话，文档化简化）。
3. 异步校验提交落盘（commitEdit 已返回后）不报 `onEditClosed`（sync 路径带值，文档化）。
4. `autoClear` supersede-close 路径不可达（core 声明未实现，历批遗留，非本批引入）。
