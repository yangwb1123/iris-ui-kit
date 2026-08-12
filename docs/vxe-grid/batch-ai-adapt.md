# 批 AI adapt 报告 — 自然语言查询（iris 独有）

基线：`docs/vxe-grid/batch-ai-baseline.md`（语法与合并路径已对照实际代码验证）。

## 变更文件（7 源码 + 3 新测试/源码 + 2 文档 + 生成物）

**新增（4）：**

- `packages/core/src/query-parser.ts`（~380 行）— `parseTableQuery` + 命名接口
  `ParsedTableQuery` / `ParseTableQueryOptions`。语法：`field op value`
  （`= != > >= < <= contains in`）、单/双引号值、`in (a, b, c)`、尾部
  `sort by field asc|desc`、字段名大小写不敏感（`fields` 给出时返回匹配到的
  规范 key，未知字段 → 错误字符串而非抛出）、空查询 → 空结果无错误。
  OR 语义（fail-closed）：同字段 `=`/`in` OR 折叠进 `inValues`；同字段
  `contains`/关系/mixed OR → 解析错误；跨字段 OR 归一为 AND。
- `packages/core/src/query-parser.test.ts`（36 测试）— ops、引号值、in 列表、
  sort 子句、AND/OR 折叠与错误、字段校验/大小写、空白容忍。
- `packages/react/src/primitives/table/query-input.test.tsx`（6 测试，≤500 行）
- `docs/vxe-grid/batch-ai-adapt.md`（本文件）

**编辑（5 源码）：** `packages/core/src/data-view.ts`（`matchesRule` 私有→公开导出，
供 react 复用 filterSort 同款规则语义）、`packages/core/src/index.ts`
（导出 `parseTableQuery` + 类型 + `matchesRule`）、`packages/core/src/i18n.ts`
（`table.queryPlaceholder` en）、`packages/plugin-locale-zh/src/core/index.ts`
（`table.queryPlaceholder` zh「自然语言筛选，如 age > 25 and role = Test」）、
`packages/react/src/primitives/table/props.ts`（`query?: string` +
`onQueryChange?: (next: string) => void`，单行函数 prop、接口内新增）。

**编辑（1 大文件）：** `packages/react/src/primitives/table/Table.tsx` —
① 解析 memo（`queryParsedRef` 保留上次有效解析，错误时返回旧值 + 暴露
`queryError`）；② 代理 `initialParams.filters` 与 `mergedProxyFilters` /
remoteFilter effect 均并入解析出的子串/in 通道（逗号合并，同 filterValues
序列化，首请求即携带，无双请求）；③ `querySortedData`：`sort by` 仅在所有
sort prop 缺席且非 remoteSort（服务器拥有排序，本地不再排）时播种（排序
交互立即接管）；④ `filteredData` memo：解析
`filters` AND 并入文本通道（查询胜出，last-typed-wins）、`inValues` 并入
checked-set 通道（OR-match，与 filterValues 同语义）、rules 经 `matchesRule`
AND 通道；代理 + remoteFilter 下服务器拥有过滤（本地不藏行）；⑤ 工具栏：
`(toolbar || views || query !== undefined)` 渲染，标题之后左侧
`data-iris-table-query-input`（i18n placeholder，受控 onChange →
onQueryChange），错误显示 muted `data-iris-query-error` 提示。

**文档/生成物：** `docs/vxe-grid-comparison.md`（iris 独有表新增
「自然语言查询 `query`」行 + 构建状态 + 批 AI 行 + 测试计数更新）、
`manifest.json`/`llms.txt`（重新生成）。

## 测试计数

- core：1255 → **1291**（+36 parseTableQuery）
- react：1877 → **1883**（+6 query-input）

## 验证（全部绿）

- `pnpm --filter @iris-ui-kit/core test` → 1291/1291 ✓
- `pnpm --filter @iris-ui-kit/react typecheck` ✓
- `pnpm --filter @iris-ui-kit/react test` → 1883/1883 ✓
- `pnpm --filter @iris-ui-kit/react lint` → 0 errors（1 个既有
  `IrisTable` complexity 警告 197→200，警告类）✓
- `iris-ui-spec.py --mode all --json` → **0 violations**（1409 files）✓
- `pnpm gen:manifest` 重新生成并提交 ✓

## 约束遵守

core 框架无关（新代码零框架依赖）；react only；纯 additive（无 query prop
时既有过滤/排序行为字节不变）；无 dist/tgz/node_modules 手改（manifest 仅
重新生成）；测试文件 ≤500 行、源码改动 ≤4 大文件 + 测试；manifest 扫描器
卫生：新 props 单行、命名导出接口、新类型已导出；CSS 仅 `--iris-*` token
（输入/提示均 token + 刻度内 spacing）。

## 遗留

- `IrisTable` complexity 警告 +3（既有警告类，非阻断）。
- 树模式不走 `filteredData` memo（既有 `filters` 行为一致）——query 过滤
  仅作用于扁平 body 路径，已在比较文档注明。
- 代理模式关系 rules 保持本地-only（无文本序列化通道，文档化决策；
  `age > 25` 在 remoteFilter 下不推送给服务器）。
