Batch X gate complete. Final report:

## 批 X Gate — PASS ✅（vue 适配器功能对齐）

**Review verdict**: PASS（1 medium recommended before merge + 2 low）→ 三个有处方的发现全部修复，新增 4 个回归测试：

1. **MEDIUM — 受控 sort 同步缺口**：Vue 仅在内部状态变化时推送代理，父组件驱动 `v-model:sort`/`v-model:multiSortState` 且 `remoteSort` 时不重查（表头指示与服务器行分歧）。修复：`Table.ts` 新增两条 watch（镜像 React effect 依赖 `proxy/remoteSort/sort/multiSort` 与 `proxy/remoteSort/multiSort/multiSortState`），core `setParams` 值比较去重，点击路径不双请求；新增 3 测试（受控 sort 变更重查 + 页重置、同值新引用不去重不重置、受控 multiSortState 全列表推送）。
2. **LOW — SSR 服务端查询**：proxy `immediate` 在场 watch 在 `renderToString` 期间触发 `ctrl.request()`（浪费/可能出错的服务器 fetch）。修复：首查改为 `onMounted` 触发（`mounted` 标志 + 在场 watch 仅 post-mount kick）——与 React effect 时序一致，服务端 HTML 停在初始态（empty 行）与客户端首渲染一致，hydration 不漂移；新增 `Table.ssr.test.ts`（node 环境：query 零调用 + empty 行 + 无 loading 行）。
3. **LOW — 代理+本地过滤分歧**：Vue 在代理在场且 `remoteFilter` 关时按 `formApplied` 本地过滤，React 仅按 `filters` prop（Vue 未发布该 prop → 代理模式不再本地过滤）。修复：`filteredData` computed 对齐 React（代理模式 merged map 为空 → 不隐藏行；本地模式 `mergeFormFilters` 语义不变）。

### 全仓门结果

| 门                                                    | 结果                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（2m21s，112 cached）                                       |
| Vue tests                                             | **1500/1500**（148 files，+4 新：parity-x 2、parity-x-multi 1、Table.ssr 1） |
| React / core tests                                    | react **1823/1823**（161 files）· core **1249/1249**（81 files）             |
| typecheck / lint                                      | ✅（vue/全部包 typecheck + lint 0 错误）                                     |
| `pnpm audit:security`                                 | **0 vulnerabilities**                                                        |
| `gen:manifest` + `check:manifest`                     | 155 组件 × 4 框架对齐（vue 155/155），manifest 零漂移 up-to-date ✅          |

### 文档

- **comparison doc**：文首新增「vue 对齐（批 X）」段；排序/工具栏/数据代理/搜索表单四行标记 **✅ vue**（react+vue 对齐）；构建状态表新增批 X 行（✅ vue，含 review 修复）；新增「**vue 剩余缺口（批 Y 起）**」清单（批 2–W 的 react-only 能力逐批移植）；测试计数刷新 react 1823 · vue 1500 · core 1249
- DECISIONS.md / batch-x-adapt.md 既有未提交改写随本提交落地（消除 review 的 docs drift INFO）；gate 报告 `docs/vxe-grid/batch-x-gate.md`

### Commit

`git add -A -- . ':!apps/ssr-solidstart/.vinxi'` → `feat(table): vxe-grid 批 X——vue 适配器功能对齐（proxyConfig/formConfig/multiSort/工具栏扩展）`
