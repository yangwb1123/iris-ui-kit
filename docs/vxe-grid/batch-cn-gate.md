Gate stage complete. Working tree clean.

## Report

**Verdict → action**: Review **PASS** (2 informational P4s, non-blocking — no fixes required). Source implementation already landed at `0b7b0bd4`; this gate commit adds reports + harness docs.

### Gate results

| Step                                                                   | Result                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (2m21s, 137 cached)                                                                                              |
| `audit`                                                                | **0 vulnerabilities**                                                                                                                         |
| `gen:manifest` + `check:manifest`                                      | up to date — 155×4 components, 86 tokens, IrisTable propCount **174** / eventCount **31** (`cellDrag` present, immediately after `rangeFill`) |
| Comparison doc                                                         | already committed in `0b7b0bd4` (iris 独有 row 86 + 构建状态 批 CN)                                                                           |
| Prettier                                                               | clean on all changed files                                                                                                                    |

**Note on first runs**: two attempts hit the documented parallel-load flakes (`@iris-ui-kit/react:test` CommandPalette A1 10k-item render vs 5s timeout + `@iris-ui-kit/react:build` ELIFECYCLE, both only under full-repo parallel load); both green in isolation (react **2535/2535** + build ✓), clean **180/180** on rerun. No fix needed (pre-existing, unrelated to this batch).

### Final test counts

- **core: 1559/1559** (zero core changes, framework-free invariant intact)
- **react: 2535/2535** (16 new cell-drag-move tests, 2519→2535)
- manifest propCount **174** / eventCount **31** · audit **0**

### Commit

`HEAD` — `feat(table): grid 批 CN——单元格拖拽移动（iris 独有）` (files: batch-cn-gate/review reports + DECISIONS stage records + harness doc normalization; `.vinxi` excluded)
