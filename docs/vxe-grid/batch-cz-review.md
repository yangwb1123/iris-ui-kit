## 批 CZ Review — 跳到行 `goToRow` — **PASS** ✅

后续记录：本 review 中提到的批 CY 未消费 `responsive` prop 已按
`docs/vxe-grid/batch-cy-baseline.md` 独立补齐；其实现与验证见
`docs/vxe-grid/batch-cy-adapt.md`。

Review 已写入 `docs/vxe-grid/batch-cz-review.md`。全部检查独立复跑：

**验证结果（全绿）**

- core test **1580/1580** · react test **2671/2671** · react/core typecheck clean · react lint 0 errors（1 既有 complexity warning）· `pnpm audit` 0 vulns · `check:manifest` up to date（155×4 components；props **185**/events **32**，goToRow 为 handle 不入计数）· `iris-ui-spec.py --mode all` 0 violations（CSS 全 token）· core 无框架 import（grep 空）· 工作树仅 docs 记账

**Spec 符合性** — baseline 每一条都对上：`goToRow(key)` handle（`types.ts:627`，`scrollToRow` 后）· `findTableRowEl` 共享提取（`Table.tsx:245-253`，scrollToRow 零行为变化）· `scrollIntoView({block:'nearest'})` · `data-iris-row-target` + `ROW_TARGET_MS=2000` 定时移除（`Table.tsx:1439,5783-5789`）· 单目标/重呼重启/卸载清理（mount-time handle 只读 refs，`Table.tsx:5957`）· 未知键 no-op · 引号键双路径 · 不触发 `onCurrentRowChange` · CSS 紧跟 `[data-iris-row-current]`（`styles.ts:315-318`，color-mix 18% primary over background 双设）；11 个测试覆盖 spec ① ② ③ + 8 条加固，质量高（⑧ detached 保留 attr 确实能证明 timer 已清）。

**Findings（0 阻塞，5 条 LOW/INFO）**

1. **LOW** — commit `73a295b4` 混入批 CY 未完成 dirt（core responsive/i18n/props）且**修改**了其死脚手架（删声明+hoist），CZ 粒度非 add-only；已披露、树绿、CY core 原样保留 → 建议 CY 单独 commit
2. **LOW** — `props.ts:1049` `responsive` prop 已进 manifest（185）但当前零消费 → 死 API 面，CY 续接或回退
3. **INFO** — `styles.ts:317` `background` shorthand vs copy-flash 的 longhand 纪律（对比行先例一致，无实害）
4. **INFO** — target 规则源序在 compare 行规则前，双属性共存时 goToRow 染色输给 compare 色（与 spec 字面一致）
5. **INFO** — 目标行表内被移除时轻量孤儿 timer（detached 节点无害）

结论：**PASS**，无需代码修复；F1/F2 交 CY retry 决策。
