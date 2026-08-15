Baseline complete: **`/home/u1/iris-ui/docs/vxe-grid/batch-bp-baseline.md`**（72 行，唯一新建文件；`git status` 确认源码零改动——`DECISIONS.md` 的 M 与 `batch-bo-gate.md` 均为既有状态，未触碰）。

## 核验摘要（每个锚点对当前代码）

**设计**：`copyFormat?: 'tsv' | 'csv' | 'html'` 作为 `clipConfig`（props.ts:466，现为 `{ copy?: boolean; paste?: boolean }`）内联类型新增字段——规格原文「clipConfig 复制输出格式」；未设 = TSV 字节不变。单一咽喉：`buildRangeTsv`（Table.tsx:4782）升级为 `buildRangeCopy` 分发器，**三个序列化器全复用、零新序列化器**：

- `tsv` → 既有 `tsvCell`（:1176）
- `csv` → 既有 `csvRangeCell`（:1207，批 AH RFC-4180 + 中和），headerless 延续范围 fiat
- `html` → core `toHtml`（table-export.ts:87）复用，`leafColumns.slice(start.col, end.col+1)` 列子集 + 合成行（`exportCsv.ts:54` 的 dataIndex 映射逐字），掩码三格式一致（批 AY 不变量）

两消费点（Ctrl+C :4958、工具栏 `copyActiveRange` :5156→RangeToolbar onCopy :8443）同走分发器，写路径 `writeClipboardText` 三阶不变。

**10 条 fiats** 覆盖 gate 仲裁面：非法值 fail-closed 回落 TSV、csv headerless vs html 有表头（toHtml 契约）、粘贴不对称（paste 仍按 `\t`）、写路径 text-only（无 ClipboardItem）、掩码 number→string 失右对齐等。

**文件地图**：props.ts +1 字段 · Table.tsx 3 触点（import toHtml、分发器、两接线）· 新 `copy-format.test.tsx`（13 用例）· comparison doc 3 处（独有表行/构建状态/测试计数）· manifest 重新生成（propCount 156 不变——嵌套字段不增顶层成员，但 clipConfig type 串更新需 `check:manifest`）。零 core/types/styles/i18n/其余框架。

**测试计划**：规格强制的三格式输出打头（TSV 字节 pin / CSV 三要素 / HTML 表格片段 + 范围子集），外加掩码三格式一致、工具栏同源、非法值、粘贴不对称、无范围 no-op 等。
