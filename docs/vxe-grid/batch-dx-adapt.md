Done. Batch DX complete and committed as `43bade0f`.

## Report

**Files changed (3, all + test):**

| File                                                                | Change                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/clipboard-display-helpers.tsx` | +`parseFnrQuery` export — `/pattern/` or `/pattern/flags` → `RegExp                                                                                                                                                               | null`, fail-closed on any other shape (unterminated/empty-body/invalid pattern/non-lowercase or unknown flags), flags canonicalized to always include `g`(replace 全匹配),`lastIndex=0`reset, never throws;`replaceAllOccurrences`gains optional 4th`regex`param → real`String.replace` semantics (`$1`/`$&` expand); absent → byte-identical literal path |
| `packages/react/src/primitives/table/Table.tsx`                     | 4 touch points: import · single `fnrParsed` memo feeding find + both replace sites · `fnrMatches` branch (regexp case-sensitive by default, `/i` opt-in; literal fallback unchanged) · `fnrParsed` passed to active + replace-all |
| `packages/react/src/primitives/table/test/batch-dx.test.tsx` (NEW)  | **253 lines / 18 tests** (≤500 ✓)                                                                                                                                                                                                 |

**Tests added (18):** parser unit (recognition + forced `g`, `/i` opt-in, fail-closed matrix incl. bad flag, escaped slash + stateless lastIndex) · replace unit (`$`-literal regression anchor, null-regex fallback parity, `$1` capture + `$&` expansion) · DOM find (`/l.ce/` wildcard proves regexp semantics, case-sensitivity split `/alice/` vs `/alice/i`, `/[0-9]{2}/` digit class, `/^B/` anchor) · DOM replace (active replace expands captures through `commitRowList`, replace-all rewrites all regexp matches in **one commit**) · typing-state fail-closed (`/alic` literal → closing `/` flips to regexp; `/[/` never throws) · regressions (literal parity, locked-cell skip under regexp replace-all, empty-query clears).

**Counts:** react test 250→**251 files / 2872→2890 tests** · core 106 files / 1641 unchanged · manifest regenerated via `gen:manifest` — **zero diff** (155×4 components / 86 tokens; 202 props / 33 events unchanged, exactly as the baseline predicted — no prop/type/core/i18n changes needed). CSS: no new styles — tokens untouched.

**Verification (all green):**

- core test: 106 files / 1641 ✓
- react typecheck ✓ · react test: 251 files / 2890 ✓
- react lint: **0 errors** (2 pre-existing complexity warnings in Table.tsx, untouched)
- `iris-ui-spec.py --mode all --json`: **0 violations** (exit 0, 1546 files)
- `gen:manifest` regenerated (nil diff — nothing to commit), manifest tests 69 ✓, prettier-clean, commit hooks passed (filesize + change budget: 3 files ≤5, 69 core lines ≤300)

**What is left:** nothing within scope — React-only, additive, core untouched. Pre-existing working-tree dirt (grid-refactor, `docs/*`, `core/src/index.ts`, plugin exports, script baselines, `aero-platform-console`) deliberately left uncommitted/untouched; the batch runner's doc/comparison/DECISIONS entries attach at the gate stage as usual.
