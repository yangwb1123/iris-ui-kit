Gate stage complete — **PASS** ✅

## Report

**Verdict**: FAIL with concrete fixes → fixes applied, full gate re-run, **PASS** ✅ (review of `358fb1c6`/`b6f6623e` against `batch-cq-baseline.md`: 2 blocking findings — MEDIUM layout + LOW duplicated coercion — both fixed and re-verified)

**Gate commit**: `feat(table): grid 批 CQ——编辑实时预览（iris 独有）`

| Step                                                                   | Result                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (2m58s, 125 cached)                                         |
| `audit:security`                                                       | **No known vulnerabilities found**                                                       |
| `audit:tokens`                                                         | exit 1, all pre-existing/unrelated warnings (identical to HEAD)                          |
| `gen:manifest` + `check:manifest`                                      | up to date — 155×4 components, 86 tokens, IrisTable **177 props / 31 events**, zero diff |
| Comparison doc                                                         | 批 CQ iris-独有 row + 构建状态 entry updated (review-fix notes + counts)                 |

**Final test counts** (independent rerun):

- **core: 1559/1559** (framework-free invariant intact — zero core changes)
- **react: 2570/2570** (2569 → +1 layout-contract test; edit-preview file 13 → 14)

manifest propCount **177** / eventCount **31** · audit **0**

## Review fixes applied (both blocking findings)

1. **MEDIUM — preview/error must stack BELOW the editor** (`Table.tsx` cell style + `styles.ts` `EDIT_PREVIEW_STYLE` + error div):
   - The editing cell now gets `flexWrap: 'wrap'` while editing; the preview (`EDIT_PREVIEW_STYLE`) and the validation error div each get `flexBasis: '100%'` (+`minWidth: 0`), so the browser lays the editor, preview, error on **separate full-width flex lines, in flow** — the spec's 下方/下面 contract (previously flex-row side-by-side: input shrank, preview sat right of it).
   - Browser-level assertion: new jsdom test (`edit-preview.test.tsx`) pins the exact CSS contract the browser consumes — cell `flexWrap: wrap` only while editing (non-editing cells stay `''`), preview/error `flexBasis: 100%` + `minWidth: 0`, and in-flow order editor → preview → error. (jsdom cannot compute layout; the flex properties are the layout's source of truth, the same contract the reviewer verified headless-Chrome.)
2. **LOW — single shared draft coercion**: `editPreviewDraft` (preview-only, option-list parameter) was merged into one module-level `coerceEditDraft(row, col, draft)`; the commit/validate path's `coerceValueFor` now delegates to it (was a byte-identical duplicate). A future editor type cannot silently drift the preview from the commit coercion. 0 deletions semantics preserved; additive only.
