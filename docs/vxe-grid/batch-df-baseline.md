Baseline written. No source files modified (git status shows only pre-existing dirt + the new doc; HEAD `ade70967` unchanged).

## 批 DF：批量粘贴增强（iris 独有）— baseline summary

**Output**: `docs/vxe-grid/batch-df-baseline.md`

**Core finding**: Overflow handling lives in `pasteIntoRange` (Table.tsx:6946) — the single-cell streaming branch drops overflow via `if (rowIdx >= body.length) break`; multi-cell (batch AK) fills an exact rectangle and clips. `insertRowInList` is already imported (Table.tsx:66) and used by `handle.insertRow` (:5675), so the change is a pure additive single-cell overflow branch gated by a new prop.

**Exact design**:

1. New top-level single-line prop `pasteOptions?: { insertIfOverflow?: boolean }` in `props.ts` (manifest-scanner NOTE, clipConfig precedent).
2. Destructure + thread into `pasteIntoRange` (dep array `[rowKey, commitRowList, pasteOptions]`).
3. In the single-cell branch, when `insertIfOverflow` and clipboard lines exceed available rows from the anchor, append the overflow lines as new rows via `insertRowInList` (auto-id `max+1` keys, surplus cells dropped, locked/readonly skipped), committed once via `commitRowList(next, 'paste')`.
4. **Fiat**: overflow insertion applies only to single-cell streaming; multi-cell rectangle stays clipped; default off = batch-O byte-identical.

**File map**: props.ts (+1 prop) · Table.tsx (destructure + branch, no new import) · clip-fnr.test.tsx (extend paste describe). types/styles/i18n/core/vue2/vue3/miniprogram/manifest untouched.

**Test plan**: T1–T10 — overflow insertion, multi-line spill, exact-fit no-op, default-off regression, multi-cell clipped fiat, surplus cells dropped, locked-col skip, key-collision safety, empty/no-rowKey no-op, single-commit.
