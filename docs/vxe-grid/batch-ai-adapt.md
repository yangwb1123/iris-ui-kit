Done. Batch AI is implemented, verified, and committed (`8cdcaebd`).

## Files changed (15)

**Core (framework-free, additive):**

- `packages/core/src/query-parser.ts` (NEW, 382 lines) — `parseTableQuery` + named exported types `ParsedTableQuery`/`ParseTableQueryOptions`. Grammar: `field op value` (`= != > >= < <= contains in`), single/double-quoted values, `in (a, b, c)`, trailing `sort by field asc|desc`, case-insensitive fields (canonical matched key; unknown field → error string, never throws), empty query → empty result. OR: same-field `=`/`in` folds into `inValues`; same-field `contains`/relational OR → fail-closed error; cross-field OR → AND.
- `packages/core/src/query-parser.test.ts` (NEW, 36 tests, 233 lines)
- `packages/core/src/data-view.ts` — `matchesRule` private→public export (react reuses `filterSort` rule semantics)
- `packages/core/src/index.ts` — exports `parseTableQuery` + types + `matchesRule`
- `packages/core/src/i18n.ts` — `table.queryPlaceholder` (en)
- `packages/plugin-locale-zh/src/core/index.ts` — zh「自然语言筛选，如 age > 25 and role = Test」

**React:**

- `props.ts` — `query?: string` + `onQueryChange?: (next: string) => void` (single-line func prop, inside named interface)
- `Table.tsx` — parse memo (`queryParsedRef` last-valid-parse kept on error → `data-iris-query-error` muted hint); `filteredData` merge: `filters` AND into text channel, `inValues` into filterValues channel (OR-match), rules via `matchesRule`; proxy mode comma-joins substring/in into remote filter map (first request carries it); `querySort` seeds only with no sort prop **and non-remoteSort** (I added the `remoteSort` guard — the previous attempt's code claimed it but didn't implement it); toolbar renders `data-iris-table-query-input` after the title when `query !== undefined`; CSS `--iris-*` tokens only
- `query-input.test.tsx` (NEW, 6 tests, 149 lines): placeholder render + `onQueryChange`, local filter `age > 25`, `in`-list, error hint + last-valid-parse retention, proxy comma-join, `sort by` seeding

**Docs/artifacts:** `vxe-grid-comparison.md` (iris 独有 row + build status + batch row + corrected test counts), `DECISIONS.md`, `batch-ai-baseline.md` + `batch-ai-adapt.md` (NEW), regenerated `manifest.json`/`llms.txt`.

## Cleanup of the failed prior attempt

- Resolved a leftover stash-merge conflict in `contracts.test.tsx` (kept upstream's Form contract test; no-op vs HEAD)
- Reverted its unstaged doc-reword noise in `props.ts`
- Compressed `props.ts` doc comments (footerMethod/footerSpanMethod/query docs) to fit the **blocking** 500-line filesize gate: 516 → 491 lines
- Corrected its test-count claims (36 core tests, not 30)

## Verification (all on the final committed tree)

| Gate                                                                         | Result                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| core test                                                                    | **1291/1291** (+36)                                          |
| react typecheck                                                              | ✓                                                            |
| react test                                                                   | **1883/1883** (+6)                                           |
| react lint                                                                   | **0 errors** (1 pre-existing `IrisTable` complexity warning) |
| `iris-ui-spec.py --mode all`                                                 | **0 violations**                                             |
| `pnpm gen:manifest`                                                          | regenerated + committed                                      |
| prettier / husky filesize / core framework-free grep (`0` framework imports) | ✓                                                            |

## Left

- None of the task scope. Pre-existing `IrisTable` complexity warning grows +3 (warning-class, non-blocking, same as prior batches). `AGENTS.md`'s "154 组件" is stale pre-existing (HEAD manifest already had 155); batch AI added no components.
