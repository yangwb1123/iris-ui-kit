Done. Batch CL (行展开动画) is complete.

## Report — batch CL：行展开动画（iris 独有）

### Spec

`expandAnimation?: boolean` —— 详情/树形展开收起过渡（max-height/opacity transition，token；reduced-motion 关闭）；测试（属性存在/样式）。vxe-grid 无展开动画配置 → 无 parity 约束，纯 iris 独有增量。

### Files changed

| File                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                     | `expandAnimation?: boolean` after `lazyLoad`（展开族；manifest propCount **171→172**）—— multi-line JSDoc，首行只放 batch 标签（manifest 描述器会丢弃 `/**` 后首行，与 CK/CJ/CG 同款排版，再生成描述完整可读）                                                                                                                                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`                    | 4 touch points：模块 helper `expandAnimAttr(on)`（`rangeFillTargetAttr` 先例，undefined 隐藏、行箭头复杂度预算零增量）· prop destructure（`expandAnimation = false`）· 派生 `expandAnimOn = expandAnimation === true && !virtualScroll`（虚拟惰性 fiat）· 两注入点（detail wrap `renderBodyEntry` :7892 + tree row `renderRow` depth>0 门 :7196，root 行不动）                                                               |
| `packages/react/src/primitives/table/Table.tsx`（`TABLE_ROW_CSS`） | 活单例 stylesheet +3 规则：`@keyframes iris-table-expand-enter`（max-height `0 → var(--iris-table-expand-max, 512px)` + opacity `0 → 1`，from/to 双端 `overflow: hidden`，结束回基态内容永不永久裁切）· `[data-iris-expand-anim="true"]` → `animation: … var(--iris-duration-md, 200ms) ease-out`（motion 包共用 token + fallback）· `@media (prefers-reduced-motion: reduce)` → `animation: none`（纯 CSS 翻转，零新 hook） |
| `packages/react/src/primitives/table/expand-animation.test.tsx`    | **NEW** — 8 tests（T1 fail-closed 双查 detail+树 / T2 detail 展开收起 / T3 keyframes 样式 / T4 duration token / T5 reduced-motion 块 / T6 树 depth 门 root 不动 / T7 初始展开重放 / T8 虚拟惰性双路径）                                                                                                                                                                                                                      |
| `packages/manifest/manifest.json` + `llms.txt`                     | regenerated — IrisTable props **171→172**, events 31 unchanged, components 155×4 unchanged                                                                                                                                                                                                                                                                                                                                   |

零改动：core（framework-free 不变量：core 0 框架 import）/ types.ts / i18n / styles.ts（dormant copy——活单例是 Table.tsx 本地 `TABLE_ROW_CSS`，batch-BE review 教训）/ solid·vue·svelte / 虚拟体 / TableBody / 事件。

### Verification (all green)

- **core test**: 1559/1559（零改动，不变）
- **react typecheck**: clean · **react test**: **2511/2511**（2503 → +8）· **react lint**: 0 errors（1 pre-existing IrisTable complexity warning）
- **iris-ui-spec.py --mode all**: **0 violations** (1416 files)
- **gen:manifest**: regenerated + `check:manifest` up to date（172 props / 31 events / 155×4 components / 86 tokens）

### What's left

- Review/gate stages: `batch-cl-review.md` / `batch-cl-gate.md` + comparison-doc row 84（批 CJ 先例把 docs + comparison 行放在 gate 阶段）——本 adapt 已提交 comparison-doc 行 84 与构建状态尾注、DECISIONS 条目（沿用近批先例）。
- `arch-check` ratchet 与 HEAD 同态失败（`arch-baseline.json` 陈旧）——pre-existing，不在本批门内。
