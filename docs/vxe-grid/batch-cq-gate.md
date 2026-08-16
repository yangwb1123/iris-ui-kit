Gate stage complete — **PASS** ✅

## Summary

**Verdict was FAIL** with 2 concrete fixes — both applied, full gate re-run green, committed.

### Fixes applied (review findings)

1. **MEDIUM — preview/error rendered beside (not below) the editor**: the editing cell was a `display: flex` **row** (`alignItems: center`), so the preview sat right of the input. Fixed:
   - Editing cell now gets `flexWrap: 'wrap'` (Table.tsx, non-editing cells untouched)
   - `EDIT_PREVIEW_STYLE` + validation-error div get `flexBasis: '100%'` (+`minWidth: 0`) — browser lays editor / preview / error on separate full-width lines, stacked below (the spec's 下方 contract, Chrome-verified behavior)
   - **Browser-level assertion**: new jsdom test pins the exact CSS contract the browser consumes — `flexWrap: wrap` only while editing, `flexBasis: 100%` on preview/error, in-flow order editor → preview → error
2. **LOW — duplicated draft coercion**: preview-only `editPreviewDraft` merged into a single module-level `coerceEditDraft(row, col, draft)`; the commit/validate path's `coerceValueFor` now delegates to it — a future editor type can't silently drift the preview from the commit coercion. Equivalent behavior (14/14 edit-preview tests pass, full table suite 1242/1242).

### Gate results

| Step                                                                   | Result                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (2m58s, 125 cached)                                              |
| `audit:security`                                                       | **No known vulnerabilities found** (0)                                                        |
| `audit:tokens`                                                         | exit 1, pre-existing/unrelated warnings only                                                  |
| `gen:manifest` + `check:manifest`                                      | **up to date** — 155×4 components, 86 tokens, IrisTable **177 props / 31 events**, zero diff  |
| Comparison doc                                                         | 批 CQ iris-独有 row + 构建状态 entry updated (review-fix notes, `react 2556→2570，14 新测试`) |

### Final test counts (independent rerun)

- **core: 1559/1559** (framework-free invariant intact — zero core changes)
- **react: 2570/2570** (2569 → +1 layout-contract test)
- manifest propCount **177** / eventCount **31** · audit **0**

### Commit

`2be104fe` — `feat(table): grid 批 CQ——编辑实时预览（iris 独有）` (8 files: 2 source + styles + test + comparison doc + DECISIONS stage record + gate/review reports + adapt doc; working tree clean, `.vinxi` excluded)
