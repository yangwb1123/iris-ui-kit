Done. Committed as `011ac0b1`.

## 批 BP 完成报告 — 单元格复制格式 `copyFormat`（iris 独有）

**实现**（按 baseline 方案零偏差，纯 additive、core 零改动、react-only）：

- **`props.ts`** — `clipConfig?: { copy?: boolean; paste?: boolean; copyFormat?: 'tsv' | 'csv' | 'html' }`（内联字段，未设 = TSV 字节不变）
- **`Table.tsx`** — import `toHtml`；`buildRangeTsv` 升级为 `buildRangeCopy(range, format)` 分发器，**三个序列化器全复用、零新序列化器**：`tsv` → `tsvCell` · `csv` → `csvRangeCell`（RFC-4180 + 中和，headerless 范围 fiat）· `html` → core `toHtml`（列子集 `slice(start.col, end.col+1)` + 合成行按 toHtml 读取键 key 化，exportCsv 影子行约定逐字）；掩码三格式一致（批 AY）；两消费点（Ctrl+C、工具栏 复制）同源；非法值 fail-closed 回落 TSV；粘贴不对称（paste 仍按 `\t`）；`writeClipboardText` 三阶不变

**测试**：新 `copy-format.test.tsx` **13 用例**（351 行 ≤500）— TSV 字节 pin（未设/显式）/ CSV 三要素 + RFC-4180 引号 + 公式中和 / HTML 全片段 + 数字右对齐 + 列子集 + XML 转义 / 掩码三格式一致 / 掩码数字失右对齐 fiat / 工具栏同源 / 非法值回落 / 粘贴不对称 / 无范围 no-op

**文件变更**（8 committed + 1 新增测试）：`props.ts` · `Table.tsx` · `copy-format.test.tsx`(新) · `manifest.json` · `docs/vxe-grid-comparison.md`（独有表行/构建状态/测试计数 3 处）· `DECISIONS.md` · `batch-bp-{baseline,adapt}.md`(新)

**验证**（全部 ✅）：

| 门                            | 结果                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| core test                     | 1517/1517                                                                              |
| react typecheck               | ✅                                                                                     |
| react test                    | **2255/2255**（+13）                                                                   |
| react lint                    | 0 errors（1 个既有 complexity warn，stash 对比确认 pre-existing）                      |
| spec `--mode all --json`      | **0 violations**                                                                       |
| gen:manifest + check:manifest | ✅ 155 组件、react Table propCount **156 不变**、clipConfig type 串更新、llms.txt 同步 |

**剩余**：vue/solid/svelte 对齐留待后续批（react-only 批范围）；批 runner 后置 review/gate 阶段。工作树仅剩 runner 预存的 `batch-bo-gate.md` 未跟踪文件，未触碰。
