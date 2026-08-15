Done. The review verdict was **FAIL** with 2 concrete findings — both fixed, full gate rerun, committed.

## Fixes applied

**HIGH — stripes never rendered (visual marker dead, silent)**

- Moved the `[data-iris-cell-locked="true"]` stripe rule from `styles.ts`'s dead exported `TABLE_ROW_CSS` (imported nowhere) into the live injected stylesheet `#iris-table-row-styles` (Table.tsx local `TABLE_ROW_CSS`).
- Root-caused the second half: converted `fnrCellStyle`'s unconditional `background` **shorthand** → `backgroundColor` **longhand**. The shorthand reset `background-image: none`; worse, my first attempt (inline `backgroundImage` after the shorthand, per review prescription) hit React's shorthand/longhand mixing hazard — **jsdom-verified** that on rerender with a changed background, React skips the unchanged longhand and the shorthand clobbers the stripes (exactly the silent-failure class the review flagged). The conversion removes the root cause; the inline `backgroundImage` re-assertion (single `LOCKED_CELL_STRIPE` source, spread last in the cell style) additionally survives user/conditional/range-fill shorthands.
- Strengthened tests so the failure can't be silent again: assert inline `backgroundImage` + live stylesheet rule content.

**MEDIUM — all-locked range clear spurious no-op commit**

- `clearActiveRange` now skips empty-patch rows (`Object.keys(patches).length > 0` guard, same zero-commit pattern as paste/fill/batch-edit) — no more phantom `onDataChange`/undo/audit entries. 2 new regression tests (all-locked → zero commit, mixed → one commit skipping locked cells).

## Gate results

| Check                                 | Result                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build` | **180/180 tasks successful** (final run, post-format)                                       |
| react tests                           | **2132 passed** (189 files; +13 locked-cells suite)                                         |
| core                                  | 1457 passed, zero diff                                                                      |
| `pnpm audit`                          | **0 vulnerabilities**                                                                       |
| `gen:manifest` + `check:manifest`     | up to date, byte-identical (155 components × 4, propCount 148 — `locked` is a column field) |
| prettier                              | clean on all touched files                                                                  |

`docs/vxe-grid-comparison.md` updated: new「iris 独有」row (`单元格锁定 locked`), batch-table row 批 BE, 构建状态 paragraph (+BD/+BE entries), test-count summary 2119 → 2132.

## Commit

```
1b98c3c96236316f4db4db1132492a024efd6b0f
feat(table): grid 批 BE——单元格锁定（iris 独有）
```

9 files, +604/−40, working tree clean.
