Gate stage complete — **review verdict PASS → full repo gate green → committed**.

## Review verdict

**PASS** — reviewed commit `982dc909`（多列分组 `groupBy` 数组嵌套）against baseline；全部门独立重跑通过：core 1517/1517 · react **2281/2281**（13 new in `group-multicol.test.tsx`）· typecheck 0 · lint 0 errors · audit 0 · check:manifest 通过 · core 零改动 · 纯 additive。

LOW 处置：

- **LOW 1（docs）** — comparison.md「react 2280 tests」实际 **2281**（stale 计数传播）。**本 gate 已修**：2280 → 2281，并补注「BQ 遗留探针 zz-bq-probe +1」。
- **LOW 2（design，已文档化）** — 复合组键 `::` 遇单元格值本身含 `::` 时键可能歧义（如 `Eng::A`+`B` vs `Eng`+`A::B`），共享折叠态。baseline 明确选择 + 文档化，**非阻塞不修**（可选加固：段内转义 `::`，留待后续）。
- **INFO** — `groupBy={[]}` + 列级旗标仍按旗标分组（匹配「byte-identical fallback」契约；仅无旗标场景有测试）。不修。

## Full repo gate

| Gate                                                  | Result                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks** (exit 0)                                                                                                     |
| audit                                                 | **0 vulns**                                                                                                                    |
| `gen:manifest` + `check:manifest`                     | **155 components** (155×4 frameworks), 86 tokens, react Table propCount **159**（158→159），生成输出 up to date（gen 零 diff） |

## Final test counts

- **core: 1517/1517** · **react: 2281/2281**（含 `group-multicol.test.tsx` **13/13**；另含 BQ 批 review 遗留探针 `zz-bq-probe.test.tsx` **1/1**——rowId 行模式 switchRowEdit 多提交载荷透传回归，随本门禁 `git add -A` 一并入库）· vue 1531 · solid 974+34 hydration · svelte 916+31 hydration
- Full repo: 180 tasks successful, 0 failed

## Commit

```
9cc25f9f feat(table): grid 批 BS——多列分组（iris 独有）
```

includes: comparison.md 计数修正（review LOW 1）+ 本门禁报告 + DECISIONS.md pipeline 记录 + batch stage 记录 + 遗留探针入库。实现本体见批 BS adapt 提交 `982dc909`。
