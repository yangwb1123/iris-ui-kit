Baseline written: `/home/u1/iris-ui/docs/vxe-grid/batch-dx-baseline.md` (批 DX：fnr 正则替换, iris 独有). No source files modified — `git status` shows only the new doc plus pre-existing dirt.

**What I verified** (HEAD `bb5a8475`, 批 DW):

- `fnr` prop at `props/query.ts:85`; full FNR chain in Table.tsx — `fnrMatches` memo (:5776, case-insensitive substring over `String(getCellValue(...))`), `replaceFnrActive` (:5848), `replaceAllFnrMatches` (:5869), both funneling through `replaceAllOccurrences` (`clipboard-display-helpers.tsx:150`, literal-escaped `'gi'` with function replacement keeping `$` literal); bar JSX + `data-iris-fnr-*` attrs, locked/readonly skip (批 BE), undo via commitRowList.

**Exact design** (in the doc):

- `parseFnrQuery` (new export): `/pattern/` or `/pattern/flags` auto-recognized (spec-literal), body non-empty, `new RegExp` in try/catch → any invalid/unterminated form fails closed to literal substring, never throws during typing; flags canonicalized to always include `g` (→ "replace 全匹配"), `lastIndex=0` reset before each find `.test()`; regexp mode is case-sensitive by default (`/i` opt-in — documented fiat divergence).
- `replaceAllOccurrences` gains optional 4th `regex` param → real `.replace` semantics with `$1`/`$&` expansion; absent → byte-identical existing path.
- `fnrMatches` branches on the parsed regex; single `fnrParsed` memo feeds find + both replace call sites. Zero JSX/prop/type/core/i18n/manifest changes (202 props / 33 events unchanged).

**File map**: `clipboard-display-helpers.tsx` (+parser, +1 optional param) · `Table.tsx` (~12 lines / 4 touch points) · NEW `test/batch-dx.test.tsx` (repo's recent batch-file convention).

**Test plan**: ~14 cases — parser unit (recognition/fail-closed/escaped slash), replace unit (`$` literal regression anchor, capture expansion), DOM find (`/l.ce/` wildcard proves regexp semantics, case-sensitivity split, `/[0-9]{2}/` recognition, anchor), DOM replace (active + replace-all with captures, one-commit), typing-state fail-closed (`/unclosed` → literal, closing `/` flips), and parity/locked-cell/empty-query regressions.
