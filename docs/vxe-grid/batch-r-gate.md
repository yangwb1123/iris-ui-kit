Gate complete. **Review verdict was FAIL → all concrete fixes applied → full gate passed → committed.**

## Review fixes applied

1. **MEDIUM — footer rowspan corruption** (review-fix reversal): `mergeFooterItems` rowspan is now **inert**, matching baseline decision (e) and the batch P precedent. Each footer row is its own grid container, so a span can never cover later rows — covered cells previously rendered `null`, letting the remaining cells of that row auto-place into earlier tracks (data under wrong columns, confirmed in headless Chrome). Fix: the occupy set only marks SAME-row colspan cells to the right; `gridRowEnd` is no longer emitted; covered cells of later rows keep their own data (tracks preserved). JSDoc updated in `props.ts`/`types.ts`; regression test rewritten to assert both rows render all cells with their own values.
2. **LOW — expandAll seed key space**: the seed now uses flattenTree's getKey expression exactly (`treeKeyMap?.get(row) ?? rowKeyOf(row)`) — without rowId, keyless rows seed `"undefined"` again (index keys never matched flattenTree's, breaking the byte-identical additive claim). `rowKeyOf` comment corrected. +1 regression test (seed fires `onExpandedRowsChange(['undefined'])`).
3. **LOW — rowId JSDoc**: documents that clipboard paste and find&replace write-backs address rows by the `rowKey` field only (keyless rows skipped there).
4. **INFO — adapt doc counts**: corrected to 16 tests in `final-gaps.test.tsx`; 156 files (incl. one pre-existing untracked debug test file).
5. Scratch file `expand-debug.test.tsx` (untracked, console.log debug) removed.

## Gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks**
- **React tests 1739/1739** (156 files; 17 batch-R tests — 16 final-gaps + 1 expandAll regression)
- Core tests 1249/1249 (untouched, framework-free) · vue 1444/1444 re-verified individually · svelte 899/899 re-verified individually
- Typecheck 0 errors · lint 0 errors
- `pnpm audit` → **0 vulnerabilities** · `check:manifest` passes (manifest regenerated for the fixed JSDoc) · `check:docs-reference` passes (gitignored generated files, regenerated in place)
- Note: one forced parallel re-run raced with a concurrent batch-S session clobbering `@iris-ui-kit/icons` dist — the package was rebuilt and all suites re-verified green individually.

## Commit

**`735b4def`** — `fix(table): 批 R 收尾——expandAll seed 与 flattenTree key 对齐（treeKeyMap）`（review fixes）
**本提交** — `feat(table): vxe-grid 批 R——zIndex/syncResize/keepSource/rowId/表尾合并配置（react only）`（manifest + docs）

Comparison doc updated: zIndex / syncResize / keepSource / rowId / mergeFooterItems rows marked done (react) + 批 R build row + vxe-tableProps coverage summary (**remaining gap: customConfig only**, batch S baseline) + totals refreshed (react 1739 · core 1249 · 7315 total).
