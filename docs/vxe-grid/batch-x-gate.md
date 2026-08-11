Gate complete — batch X merged.

## 批 X Gate — PASS ✅（commit `5d63bffe`）

**Review verdict: PASS**（1 MEDIUM recommended before merge + 2 LOW）→ all three concrete findings fixed, 4 regression tests added:

1. **MEDIUM — 受控 sort 同步**：Vue `Table.ts` 新增两条 watch（镜像 React effect 的依赖集），受控 `sort`/`multiSortState` 变更经 `proxyCtrl.setParams` 推送代理，core 值比较去重防双请求。→ 3 测试（受控 sort 重查+页重置 / 同值新引用不重查 / 受控 multiSortState 全列表推送）
2. **LOW — SSR 查询**：首查从 `immediate` 在场 watch 改为 `onMounted` kick（`mounted` 标志），`renderToString` 零请求，服务端 HTML 停初始态 → hydration 不漂移。→ 新 `Table.ssr.test.ts`
3. **LOW — 代理本地过滤分歧**：代理模式下 `filteredData` 不再按 `formApplied` 本地过滤（React 仅 `filters` prop，Vue 未发布该 prop → 不隐藏行）；本地模式语义不变。

## 全仓门结果

| 门                                                    | 结果                                     |
| ----------------------------------------------------- | ---------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（2m21s）               |
| Vue tests                                             | **1500/1500**（148 files，+4）           |
| React tests                                           | **1823/1823**（161 files）               |
| Core tests                                            | **1249/1249**（81 files）                |
| typecheck / lint                                      | ✅ 全包通过，lint 0 错误                 |
| `pnpm audit:security`                                 | **0 vulnerabilities**                    |
| `gen:manifest` + `check:manifest`                     | **155 组件 × 4 框架**，零漂移 up-to-date |

## 文档

- `docs/vxe-grid-comparison.md`：排序/工具栏/数据代理/搜索表单四行标记 **✅ vue**（react+vue 对齐）；构建状态表新增批 X 行；新增「**vue 剩余缺口（批 Y 起）**」清单（批 2–W 的 react-only 能力：rowDrag/undo、seq/spanMethod/columnDrag、columnVisibility/filters、parseCsv/printable、树懒加载/removeRows/Tab 导航、行编辑模式、代理方法、customConfig、zoomConfig/layouts/visibleMethod 等）；测试计数刷新 react 1823 · vue 1500 · core 1249
- Gate 报告 `docs/vxe-grid/batch-x-gate.md`；DECISIONS.md/adapt 报告未提交改写随本提交落地（消除 docs drift INFO）

## Commit

**`5d63bffe`** — `feat(table): vxe-grid 批 X——vue 适配器功能对齐（proxyConfig/formConfig/multiSort/工具栏扩展）`（9 files, +294/−76；工作树干净）

注：`format:check` 仅剩 3 个 svelte 文件告警，验证为 HEAD 上既有漂移（与本次改动无关），未纳入本批。
