Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-co-baseline.md`. Zero source files touched — `git status` shows only the new baseline plus the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cn-gate.md`), HEAD `6f30435a` unchanged.

## Baseline summary — 批 CO：表格时间线导出（iris 独有）

**Design** — `IrisTableHandle.exportTimelineCsv(): string`（handle 方法，manifest 不可见——批 BF/BV 先例，零 prop/i18n/events/core 改动），把批 AT 审计环经 core `toCsv` 序列化为 **spec 字面 6 列** `time,type,rowKey,column,old,new`：

- **time** = `formatClock(new Date(e.at))`（HH:MM:SS 本地）——与审计面板时间格逐字同源（display/export 一致原则）；fiat：不带日期（面板即此粒度，原始 `at` 仍在 `getAuditLog()`）。
- **type/rowKey/column/old/new** 原值直通；undefined → 空串（行级结构变更行尾三列空）；数字保持裸数字；字符串走 RFC-4180 引号 + **OWASP 公式中和**（审计内容是不可信数据）。
- **顺序** = 环序（最新优先，与面板/`getAuditLog` 同一视图）；**空语义 fail-closed 家族**：`auditLog` 关 → `''`（exportVersionCsv/exportComparisonCsv 先例）、开但空环 → 仅表头（`getAuditLog().length` 判别两态）；**无 UI**（面板不加导出钮，批 BF 非目标）。
- 零新 import（`toCsv`:73、`formatClock`:20 已导入）；core 1559 / i18n / events 31 / manifest 174 props 全不变。

**File map** — `types.ts`（handle 声明，:628/629 后）· `Table.tsx`（handle 方法，:5342 后 inline，批 BZ 同款）· NEW `export-timeline-csv.test.tsx` · `docs/vxe-grid-comparison.md` 新增行（adapt 阶段）· 无 gen:manifest。

**Test plan** — react +9（2535→**2544**），全内容断言：fail-closed `''`、单 edit 行（time 正则 + rowKey/column/old/new 精确）、最新优先环序、insert 结构行尾三空列、空环/clear 后仅表头、RFC-4180 引号、OWASP `=` 中和、数字裸值、与 `getAuditLog` 逐字段同源。
