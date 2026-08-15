Done. All gates green.

## 批 BP 完成报告 — 单元格复制格式 `copyFormat`（iris 独有）

**实现按 baseline 验证方案，零偏差**：`copyFormat?: 'tsv' | 'csv' | 'html'` 作为 `clipConfig` 内联类型新增字段（props.ts）；未设 = TSV 字节不变。

### 实现

- **Prop** — `props.ts` `clipConfig?: { copy?: boolean; paste?: boolean; copyFormat?: 'tsv' | 'csv' | 'html' }`（单行类型，manifest 扫描器卫生达标；无新命名类型 → 无 types.ts 改动；propCount 156 不变——嵌套字段不增顶层成员，clipConfig type 串更新）
- **单一咽喉 `buildRangeCopy`**（`buildRangeTsv` 升级为分发器，`(range, format)` 双参）——**三个序列化器全复用、零新序列化器**：
  - `'tsv'` → 既有 `tsvCell`（批 O 字节不变）
  - `'csv'` → 既有 `csvRangeCell`（批 AH RFC-4180 + OWASP 中和），headerless 延续范围 fiat（与工具栏 导出 CSV 下载同序列化器）
  - `'html'` → **core `toHtml` 复用**：`leafColumns.slice(start.col, end.col + 1)` 列子集 + 合成行按 **toHtml 实际读取键** key 化（string `dataIndex` 优先、否则 `key`——exportCsv 影子行约定逐字，numeric dataIndex 回落 key，非 `dataIndex ?? key` 防数字键陷阱）；数字右对齐 / XML 转义均 toHtml 契约
- **掩码三格式一致**（批 AY 不变量）——html 分支同样 `col.exportRaw ? value : applyCellMask(value, col)`；数字被掩成字符串即失 HTML 右对齐（fiat）
- **两消费点同源**：Ctrl/Cmd+C（keydown effect）与工具栏 `copyActiveRange`（RangeToolbar onCopy）都走 `buildRangeCopy(range, clipConfig?.copyFormat ?? 'tsv')`；写路径 `writeClipboardText` 三阶不变（text-only，无 ClipboardItem）
- **fail-closed**：非法运行期值（`'xlsx' as never` 测试验证）回落 TSV；粘贴不对称——paste 仍按 `\t` 解析，copyFormat 只影响输出

### 测试（13 新，`copy-format.test.tsx` 242 行 ≤500）

TSV 字节 pin（未设 / 显式 `'tsv'`）· CSV 三要素（headerless / RFC-4180 引号 + 公式中和）· HTML（全表格片段 + 数字右对齐 / **列子集** / XML 转义）· 掩码三格式一致（sensitive phone）· 掩码数字失右对齐 fiat · **工具栏同源**（复制按钮写 HTML）· 非法值 fail-closed 回落 TSV · 粘贴不对称 · 无范围 no-op

### 验证（全部 ✅）

| 门                            | 结果                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| core test                     | 1517/1517（零 core 逻辑改动）                                                         |
| react typecheck               | ✅                                                                                    |
| react test                    | **2255/2255**（+13）                                                                  |
| react lint                    | **0 errors**（1 个既有 IrisTable complexity warn，stash 对比确认 pre-existing）       |
| spec `--mode all --json`      | **0 violations**                                                                      |
| gen:manifest + check:manifest | ✅ 155 组件、react Table **156 props**（不变）、clipConfig type 串更新、llms.txt 同步 |

### 剩余

- vue/solid/svelte 对齐留待后续批（react-only，批范围如此；clipConfig 本为批 O react 既有能力）
- 批 runner 后置：review/gate 阶段
