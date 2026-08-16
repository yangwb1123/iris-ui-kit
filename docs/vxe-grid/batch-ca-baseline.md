Baseline written: `/home/u1/iris-ui/docs/vxe-grid/batch-ca-baseline.md` — the **only** new file; zero source files touched (the two pre-existing `M` entries in git status are prior-stage docs, untouched).

## 核验摘要 (batch CA：单元格链接自动检测，iris 独有)

**设计** — 表级 prop `IrisTableProps.autoLink?: boolean`（默认 off，additive，manifest propCount 165→166）：

1. **core** `auto-link.ts` — 框架无关纯函数 `detectAutoLink(text): string | null`（null 永不抛错）；URL `/^https?:\/\/\S+$/i`、email 与 `mask.ts:11` 的 `EMAIL_RE` 逐字节同一；全文本锚定、无嵌入/标点剥离（fiat）。
2. **react 单一咽喉** — 模块级 `renderAutoLinkCell`（`contextCellText :1375` 旁）：显示文本链（掩码→formatter ?? raw）`typeof string` 才检测，命中 `<a data-iris-auto-link href=text target="_blank" rel="noreferrer" onClick=stopPropagation>`（link 分支 :7025-7034 `_blank→noreferrer` 先例逐字）。
3. **链序** — 插在 `col.link`(:7015) 之后、`col.formatter`(:7043) 之前：**link 列配置并存且优先**（分支次序天然实现）；检测失败返回原 text，与 formatter/raw 分支字节同形。

**文件地图** — core +`auto-link.ts`/`index.ts`/`auto-link.test.ts` · react +`props.ts`(compareWith :776 后) +`Table.tsx`(import/destructure :1904/helper/分支 1 处) + NEW `auto-link.test.tsx` · comparison doc 2 处 · manifest 重生成（165→166，eventCount 31 不变）。零改动：types.ts / styles.ts / i18n / 三框架。

**测试计划** — core 8 + react 7（2385→~2392），spec 三块 mandatory（url / email / 无匹配）全覆盖 + link 并存、formatter 链、无 prop 惰性、stopPropagation。

**10 fiats + 2 开放问题**（O1 prop 层级：表级 vs 列级；O2 掩码并存：严格显示链 vs 跳过），全部锚点已对 HEAD `9ac4edb5` 逐行核验。
