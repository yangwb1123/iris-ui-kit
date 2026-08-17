Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-di-baseline.md`. Only the new doc was created — no source files modified.

## 批 DI：导出多表（iris 独有）— 基线摘要

**规格**：`exportNames?: Array<{ key: string; ref: () => Row[] }>` —— `handle.exportMultiCsv()` 一个文件导出当前表 + 引用表（多段 CSV）。

**核心发现（逐行复核 Table.tsx / props.ts / types.ts / exportCsv.ts / core table-export.ts）**：

- 序列化单一事实源 = core `toCsv`（RFC-4180 + OWASP 中和）；`exportCsv` 在块前做公式物化/掩码/隐藏列剔除。
- **当前表段直接复用 `exportCurrentViewCsv`**（Table.tsx:5829），三契约自动继承，无重复序列化。
- **handle 是 mount-time 闭包**：渲染期可变输入必须走 per-render ref 镜像（`filteredDataRef`/`viewColumnsRef`/`formulaTablesRef` 纪律），`exportNames` 须同样建 `exportNamesRef`，否则 stale。
- **引用表是裸行集**（只给 `Row[]`、无列定义）→ 不能按主表列序列化，须独立纯助手按自身可枚举键导出。

**精确设计**：

- 新 prop `exportNames`（贴近 `formulaTables`，:222 近旁）+ 渲染期 `exportNamesRef` 镜像。
- 新 handle `exportMultiCsv: () => string` —— **多段格式**：段1 `# current` + 当前表块，段 2..N 按数组顺序 `# <key>` + 引用块，段间空行 `\n\n` 分隔、文件尾无多余换行。
- **单表回退（fail-closed）**：`exportNames` 空/缺省时返回裸当前表 CSV，与 `exportCurrentViewCsv()` **byte-identical**（零回归）。
- 引用段助手 `serializeRefRows(rows)`：首行键为表头、core `toCsv` 中和贯穿；空行集 → 仅段头。

**文件地图**：`props.ts`（+prop）· `types.ts`（+handle 签名/注释）· `Table.tsx`（+`exportNamesRef`、+`serializeRefRows`/多段拼装助手、+handle、+解构）。新增 `multi-export-csv.test.tsx`。不动 exportCsv.ts / core / styles / 其它框架。

**测试计划**（~14 用例，render + handle ref，精确字符串断言）：gating×2（byte-identical 回退）、多段 happy path、多引用顺序、当前表段公式/掩码/隐藏列三契约继承、引用表自身键序列化、字段顺序、空引用段、prop 更新取最新 ref（stale 闭包护航）、`''` 段名跳过、引用段 OWASP 中和、download 冒烟。

**Fiats**：引用表按自身键导出（裸行集）；`# <name>` 段头 + 空行切分（引号字段含换行的解析限制已记录，段头提供鲁棒定位）；无工具栏/默认名集成；对既有 export* handle 零改动。
