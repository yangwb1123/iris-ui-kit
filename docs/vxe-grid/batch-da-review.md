Review complete. Verdict written to `docs/vxe-grid/batch-da-review.md`.

## Verdict: **PASS**

批 DA spec（格式化复制补充：选区按列 formatter 输出 + 掩码优先 + 测试）经逐行核对，已被已提交的批 CU（`5b5c85e9`/`09393338`/`15bbc1d4`）完整覆盖——本次 adapt 是纯验证式交付，零源码改动（提交 `9f771530` 仅 4 个 docs 文件）。

**Spec correctness（每条均有代码 + 测试锚点）**

- 选区整体按列 formatter：`buildRangeCopy(range, format, copyWithFormat)` Table.tsx:6822，html :6851 / tsv·csv :6881 双分支 formatter-gated 遍历整个 rect
- 掩码优先：`contextCellText` :2098 先 `applyCellMask` 再 formatter，测试钉 `M:138****8000`
- 14 条测试（432 行 ≤500），主断言 `25.00`/`$25`

**检查维度**

- Additive only：0 source files ✅
- Manifest hygiene：`check:manifest` up to date、`gen:manifest` zero diff（155×4、86 tokens）、props.ts:678 单行 + prettier-ignore ✅
- Core framework-free：core/vue/solid/svelte 零 `copyWithFormat` 引用，core 零 react import ✅
- CSS tokens：纯数据变换，零 CSS ✅

**命令实跑**：core test 1580/1580 · react typecheck clean · react test 2671/2671 · react lint 0 errors（1 既有 complexity warning）· audit 0 vulns · check:manifest ✅ · gen:manifest zero diff ✅ · spec validator 0 violations

**Findings**（3 条，全 Info，无阻断）：① 工作树有未提交的 DECISIONS.md/adapt.md 文档 dirt（gate 会收编）；② baseline 的 7 条边角测试有意未加（spec 已有 1:1 映射、文件逼近 500 行上限）；③ html 分支 exportRaw supersede 无独立测试（与 tsv 路径代码对称，风险可忽略）。
