Done. Batch CK (单元格文本搜索高亮) is complete and committed.

## Report — batch CK：单元格文本搜索高亮（iris 独有）

### Files changed (10 in impl commit `d208c8fc`, 7 source + 3 tests; adapt report in `d967b26f`)

| File                                                            | Change                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/search-highlight.ts`                         | **NEW** — pure `splitSearchHits(text, query): string[] \| null`: case-insensitive literal substring (no regex), non-overlapping forward scan (`'aaa'`+`'aa'` = one hit, fnr parity), alternating `[plain, hit, …]` segments; `null` on empty query/text/no-match (fail-closed fast-path) |
| `packages/core/src/search-highlight.test.ts`                    | **NEW** — 11 tests (hit segments / case-insensitivity / multi-hit / non-overlap / adjacent / no-match / empty ×2 / CJK / metacharacters / whole-text)                                                                                                                                    |
| `packages/core/src/index.ts`                                    | barrel export `splitSearchHits`                                                                                                                                                                                                                                                          |
| `packages/react/src/primitives/table/props.ts`                  | `searchHighlight?: string` after `fnr` (JSDoc `*/` on own line — the batch-CJ P3 lesson)                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/styles.ts`                 | `SEARCH_HIT_STYLE` — `--iris-surface-selected` token (same language as `fnrCellStyle`), token-only                                                                                                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx`                 | 4 touch points: core+styles imports · module helper `applySearchHighlight` (pure, row-arrow budget flat) · prop destructure · formatter branch + raw fallback call sites (mask → formatter ?? raw chain)                                                                                 |
| `packages/react/src/primitives/table/search-highlight.test.tsx` | **NEW** — 11 tests (2 fail-closed / 高亮 ×2 / multi-hit / numeric untouched / formatter / render+html untouched / link wins / **fnr coexistence** — the spec's 与 fnr 区分 proof / rerender clears)                                                                                      |
| `manifest.json` + `llms.txt`                                    | regenerated — IrisTable props **170→171**, events 31 unchanged                                                                                                                                                                                                                           |

### Verification (all green)

- **core test**: 1559 passed (was 1548, +11)
- **react typecheck**: clean · **react test**: 2503 passed (was 2492, +11) · **react lint**: 0 errors (1 pre-existing warning)
- **iris-ui-spec.py**: **0 violations** (1416 files)
- **gen:manifest**: regenerated + `check:manifest` up to date; prettier clean

### What's left

- Review/gate stages: `batch-ck-review.md` / `batch-ck-gate.md` + comparison-doc row (批 CJ precedent puts docs + comparison row in the gate stage).
- `arch-check` ratchet fails identically on clean HEAD (stale `arch-baseline.json` since `d7d281de`) — pre-existing, outside this batch's gates. Pre-existing dirty docs (`DECISIONS.md`, `batch-cj-gate.md`) left untouched.
