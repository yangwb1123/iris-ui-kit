Gate stage complete for grid 批 BY（展开状态持久化，iris 独有）.

## Review verdict

**PASS** — `docs/vxe-grid/batch-by-review.md`：独立重跑全验证（core 1517/1517、react 2373/2373 含 persist-state-expanded 9/9、typecheck/lint 干净、audit 0、check:manifest up-to-date、core framework-free、CSS tokens 零改动）；对照 baseline 全部 5 个源触点一致（types.ts piece+field、ALL_PIECES +1、收集器门 `onExpandedRowsChange && expandableMode`、恢复 `expansion.set(value.map(String))` 全量替换、applyViewSnapshot 对称）；`expandableMode` 探针免 TDZ，两个开放问题已仲裁并记录；9 个 baseline 测试用例齐全。Findings 均非阻断（2 LOW + 3 INFO；LOW 1 为 applyViewSnapshot expandedKeys 分支缺 views 测试、LOW 2 为 lazyLoad 展开模式未测，按 verdict 不阻塞）。

## Gate results

- **Full repo gate** (`turbo run test typecheck lint build --concurrency=2`): **180/180 tasks successful** (125 cached)
- **Audit**: 0 vulnerabilities (`pnpm audit --audit-level low` → `No known vulnerabilities found`)
- **Manifest**: `gen:manifest` regenerated → 155 components × 4 frameworks, 86 tokens; `check:manifest` up-to-date (no diff; IrisTable propCount **165** / eventCount **31** unchanged)
- **Comparison doc**: already current at adapt commit `131ee713` — `persistState` iris 独有 table row 批 BY `expandedKeys` 段（line 28）, 构建状态 append 批 BY（line 293, react 2364→2373）; re-verified against the gate run

## Final test counts

- **core: 1517/1517** · **react: 2373/2373** (+9 persist-state-expanded, 209 files)
- vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration (unchanged; core 零改动、react-only)

## Commit

- **`131ee713`** — `feat(table): grid 批 BY——展开状态持久化（iris 独有）` (implementation + manifest + comparison doc)
- Gate-stage docs delta（本次提交）: DECISIONS stage entries (adapt/review) + batch-by-adapt.md update + batch-by-review.md + batch-by-gate.md
- Working tree clean after commit; `.vinxi` excluded per instruction.
