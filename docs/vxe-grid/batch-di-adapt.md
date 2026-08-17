# 批 DI：导出多表（iris 独有）— 适配报告

**规格**：`exportNames?: Array<{ key: string; ref: () => Row[] }>` —— `handle.exportMultiCsv()` 一个文件导出当前表 + 引用表（多段 CSV）。

## 变更文件（仅 react / additive / core 无关）

1. `packages/react/src/primitives/table/props.ts` — 新增 prop `exportNames`（紧邻 `formulaTables`）。
2. `packages/react/src/primitives/table/types.ts` — `IrisTableHandle` 新增 `exportMultiCsv: () => string` 签名 + 文档注释。
3. `packages/react/src/primitives/table/Table.tsx` — 新增：
   - `serializeRefRows(rows)` 纯助手：按引用行集自身可枚举键导出（首行键为表头），core `toCsv` 中和贯穿；空行集 → `''`。
   - 渲染期 `exportNamesRef` 镜像（per-render ref-mirror 纪律，`formulaTablesRef` 同款），handle 按需读取最新值。
   - `handle.exportMultiCsv()`：多段拼装（`# current` + 当前表块，段 2..N 按数组顺序 `# <key>` + 引用块，段间 `\n\n`、文件尾无多余换行）；空/缺省 → 裸当前表 CSV（byte-identical 回退）；`''` 段名整段跳过；空引用行 → 仅段头。
4. `packages/react/src/primitives/table/multi-export-csv.test.tsx` — 新增 14 用例。

> 修复上一轮超时遗留 bug：旧 diff 曾把 `getSelection` 误替换为 `exportMultiCsv`，已恢复 `getSelection`（`batch-autowidth` 回归测试得以通过）。

## Manifest（必需再生成）

`pnpm gen:manifest` 已再生成并纳入：`packages/manifest/manifest.json` + `llms.txt`（react `exportNames` 单行函数 prop、propCount 189→190）。

## 测试（14，渲染 + handle ref，精确字符串断言）

- gating ×2：缺省 / 空数组 → 与 `exportCurrentViewCsv()` byte-identical。
- 多段 happy path；多引用顺序。
- 当前表段三契约继承：公式物化 / 掩码 / 隐藏列剔除。
- 引用段按自身键序列化；字段顺序 = 首行键序。
- 空引用行 → 仅段头；`''` 段名跳过。
- prop 更新取最新 ref（stale 闭包护航）。
- 引用段 OWASP 中和（`=`/`+` 前缀）。
- multisegment CSV 可直投 `downloadCsv`（download 冒烟）。

## 验证结果

| 门禁                         | 结果                                   |
| ---------------------------- | -------------------------------------- |
| core test                    | ✅ 102 files / 1584 tests              |
| react test                   | ✅ 242 files / 2758 tests（含本批 14） |
| react typecheck              | ✅                                     |
| react lint                   | ✅ 0 errors（2 既有 warning）          |
| `iris-ui-spec.py --mode all` | ✅ 0 violations                        |
| `pnpm gen:manifest`          | ✅ 已再生成 + 纳入                     |

## 收尾

- Fiat：引用表按自身键导出（裸行集，无列定义）；`# <name>` 段头 + 空行切分；无工具栏/默认名集成；对既有 export* handle 零改动。
- 未动：core / exportCsv.ts / styles / 其它三框架。
