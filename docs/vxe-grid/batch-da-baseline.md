Baseline 完成：`/home/u1/iris-ui/docs/vxe-grid/batch-da-baseline.md`（84 行，零源码改动）。

## 核心发现（逐行复核，非引用旧文）

**批 DA 的 spec 已被已提交的批 CU 完整实现**：`5b5c85e9` + `09393338` + `15bbc1d4` 已在 HEAD `8964a7b6` 之前落地，14/14 测试存在且与 spec 逐条对应。DA 正确交付 = 验证式 adapt，不要求新功能代码。

## 验证证据

| 检查                                      | 结果                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `contextCellText` :2098                   | mask → formatter（string）→ `String` 回退，与显示链 byte 对齐                            |
| `buildRangeCopy` :6822                    | 3 参 (range, format, copyWithFormat)，zero-dep                                           |
| 值分支 :6851 (html) / :6881 (tsv/csv)     | formatter-gated；非 formatter 列 byte-identical；`exportRaw` 在 formatter 列被 supersede |
| 双喉 :7049 (Ctrl/Cmd+C) / :7380 (toolbar) | 均穿参 + 成功才 copy-flash                                                               |
| props.ts :678                             | inline 单行 + prettier-ignore（scanner 硬约束，`09393338` 修复）                         |
| types.ts :342-347                         | formatter 文档含 CU 声明                                                                 |
| 测试 14 条                                | describe `batch CU`，主断言 `'25.00'` / `'$25'` / `'M:138****8000'`（掩码优先）          |
| react-only                                | core/vue/solid/svelte 零 `copyWithFormat` 引用                                           |

## 交付内容

- **Exact design**：现状契约（prop/单链/单喉/两分支/掩码优先不变量/fiat 清单）+ Anchor 行号
- **File map**：CU 已交付 5 文件（props.ts +1 字段、Table.tsx +49/−22、types.ts +3、新测试 432 行、manifest 同步），Zero 清单
- **Test plan**：14 测试 → spec 条目映射表 + 7 项建议边角测试（混合列选区、3×3 rect、`''` 边界、`\t`/`\n` 格式化文本等）
- **Do NOT touch**：paste 不对称 fiat、链序（AY 契约）、单行对象 scanner 约束、14/14 回归网

`git status` 确认无源码改动——仅既有 docs dirt 与本次 baseline 输出文件。
