# 批 W adapt 报告 — getFilteredData / exportCurrentViewCsv / showHeaderOverflow / showFooterOverflow

**Commit:** `846b2781` — `feat(table): vxe-grid 批 W——getFilteredData/exportCurrentViewCsv + showHeaderOverflow/showFooterOverflow（react only）`（8 files, +276/−3）

## 变更文件

| 文件                                                                     | 变更                                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                           | `IrisTableHandle` +2 条单行方法（`getFilteredData: () => Row[]`、`exportCurrentViewCsv: () => string`），454/500                                                            |
| `packages/react/src/primitives/table/props.ts`                           | `IrisTableProps` +2 条单行 boolean prop（默认 true），498/500                                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`                          | +19：解构 2 个新 prop（`= true`）+ `cellOverflowOverride` 常量 + 5 处 style 覆写（2 个 header 分支 + summary/footerMethod/footerData）+ 2 条 handle 方法 + `exportCsv` 导入 |
| `packages/react/src/primitives/table/test/export-view-overflow.test.tsx` | 新测试，205 行，9 tests                                                                                                                                                     |
| `packages/manifest/{manifest.json,llms.txt}`                             | 重新生成（react IrisTable props 121→123，纯增量，155 组件全框架对齐不变）                                                                                                   |
| `docs/vxe-grid/DECISIONS.md`                                             | baseline 阶段条目                                                                                                                                                           |

## Handle 方法（types.ts + Table.tsx）

- `getFilteredData()`：`[...filteredData]` —— filteredData memo 的拷贝。handle 对象每次渲染重建（`handleRef.current = {...}`），闭包始终捕获**最新** memo：filter + sort 均即时生效（`sortedData` → `filteredData` 链）；remoteFilter 直通；proxy 模式 = prop `filters` 合并后的当页（batch C 行为）。已验证为拷贝（变异返回值不影响表格）。
- `exportCurrentViewCsv()`：`exportCsv(getFilteredData(), displayColumns)` —— 纯字符串（无 BOM，公式注入已中和），隐藏列天然排除（displayColumns 已剔除 columnVisibility/visibleMethod 隐藏）；调用方自行 `downloadCsv`（与 batch L toolbar 设计一致，Table 不直接触发下载）。

## Overflow props（props.ts + Table.tsx）

- 默认 `true` 与现状逐字节一致（baseCellStyle 的 ellipsis/nowrap 不动）。
- `false` 时在 5 处 style 对象中 `...baseCellStyle` **之后**、用户回调（`headerCellStyle`/`footerCellStyle`/`pinnedStyle`）**之前** spread `{ whiteSpace: 'normal', overflow: 'visible' }`（`as const`，spread null 为 no-op）——覆写必赢过 base、用户内联样式仍可覆盖（vxe 的 inline-over-class 优先级镜像）。
- 覆盖分支：flat header（`data-iris-table-header={col.key}`）、grouped header（含 group 非叶单元格）、summary、footerMethod、footerData。
- 命名与语义对齐 vxe `showHeaderOverflow`/`showFooterOverflow`（`/tmp/vxe-ref/packages/table/src/props.ts:159-167`）。

## 测试（9 个，205 行 ≤500）

1. `getFilteredData` 返回 filter+sort 后的行（filters `'ali'` + age asc → Alice/Alicia）
2. `getFilteredData` 无 filter 返回全量且为拷贝（`not.toBe(rows)`）
3. `exportCurrentViewCsv` 过滤视图 + 隐藏列排除（`'Name\nAlice\nAlicia'`，并与 `exportCsv(getFilteredData(), [name])` 相等）
4. `exportCurrentViewCsv` 无 filter 全页导出（含 Age 列）
5. header 默认 ellipsis（nowrap/hidden/ellipsis）
6. `showHeaderOverflow={false}` flat header 去 ellipsis（normal/visible）
7. `showHeaderOverflow={false}` grouped header（叶 + group 单元格）
8. footer 默认 ellipsis（summary/footerMethod/footerData 三种单元格）
9. `showFooterOverflow={false}` 三种 footer 单元格去 ellipsis

注意：footerMethod 存在时 summary 行不渲染（既有优先级），测试用两次独立 render 分别断言。

## 验证

- react typecheck ✓ · react tests **1819/1819**（161 files，+9 新）· lint **0 errors**（1 既有 complexity warning，IrisTable 179/70）· `iris-ui-spec.py --mode all` **0 violations**（1405 files）
- `pnpm gen:manifest` 重新生成并在同一提交（prettier hook 格式化后再次 gen 确认无漂移，工作树干净）

## 未竟 / 文档化决策

- 无未竟项。基线开放问题沿用既有文档化行为：tree 模式 filter 不隐藏树行（`bodyData` 走 `sortedData`）；`exportCurrentViewCsv` 与 `exportExcel` 无 twin（Excel 导出保持既有 `exportExcel` 助手）；body 级 `showOverflow` 非 vxe 公共 prop，不移植。
- 新增 handle 方法均为单行声明（manifest 扫描器卫生）；无新命名类型，`index.ts` 无需再导出。
