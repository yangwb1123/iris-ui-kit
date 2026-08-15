Gate stage complete — **review verdict was PASS (2 LOW non-blocking) → full gate green → committed**.

## Review verdict

**PASS（2 条 LOW 非阻塞发现）**：core 1517/1517 · react 2255/2255（+13 copy-format）· typecheck 0 · lint 0 errors · audit 0 · check:manifest 通过 · core 零改动 · 纯 additive。

- LOW 1：clipConfig 多行 JSDoc 触发现有 manifest 解析器缺陷（首行与 `*/` 同尾内容行被丢弃）→ description 从 manifest 丢失；check:manifest 自洽测不出。**按 gate 范围不修**（修法已记入 review：改回单行 JSDoc 或修 `packages/manifest/src/props.ts`，留待后续批）。
- LOW 2：文档数字失实——comparison.md「manifest 156×4」实际 155×4；adapt 报告「242 行」实际 351 行。**本 gate 已修正两处**（见下）。

## Doc fixes applied (review LOW 2)

- `docs/vxe-grid-comparison.md` — 「manifest 156×4」→「manifest 155×4」（manifest 实测 155 组件 ×4 框架）
- `docs/vxe-grid/batch-bp-adapt.md` — 测试行数 242 → 351（`copy-format.test.tsx` 实测 351 行）

## Full repo gate

| Gate                                                          | Result                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2 --force` | **180/180 tasks** (exit 0)                                                    |
| audit                                                         | **0 vulns**                                                                   |
| `gen:manifest` + `check:manifest`                             | **155 components** (155×4 frameworks), 86 tokens, generated output up to date |

## Final test counts

- **core: 1517/1517** · **react: 2255/2255**（含 `copy-format.test.tsx` **13/13**）· vue 1531 · solid 974+34 · svelte 916+31
- Full repo: 180 tasks successful, 0 failed

## Commit

```
2337bfb8 feat(table): grid 批 BP——单元格复制格式（iris 独有）
```

includes: manifest regen (no diff — already current from adapt) + comparison.md doc fix + adapt doc line-count fix + DECISIONS.md pipeline entries + batch stage records.
