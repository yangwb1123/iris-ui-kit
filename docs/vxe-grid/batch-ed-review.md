Verdict: **PASS** — written to `docs/vxe-grid/batch-ed-review.md`.

## Verification results

| Gate                | Result                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| core test           | ✓ 1641/1641 (106 files)                                                                    |
| react test          | ✓ 3012/3012, batch-ed 22/22                                                                |
| react typecheck     | ✓ clean                                                                                    |
| react lint          | ✓ 0 errors (2 pre-existing complexity warnings outside ED hunks)                           |
| audit:tokens        | ✓ clean                                                                                    |
| check:manifest      | ✓ regenerated == committed, **208 props / 33 events** (baseline predicted 208), react-only |
| manifest tests      | ✓ 69/69                                                                                    |
| plugin-locale-zh    | ✓ 6/6 (builtin-key coverage includes `table.mergeCompare`)                                 |
| core framework-free | ✓ changed core files: string-member + message only, no framework imports                   |
| additive-only       | ✓ `mergeCompare` only in react + zh plugin; vue/solid/svelte untouched                     |

## Spec compliance

All baseline design points hold: prop after `compareWith` · toolbar gate `|| mergeCompare` · text-label button `data-iris-table-compare-merge` after the undo cluster · changed replaced in place / added appended in snapshot order / removed untouched, shallow copies only · disabled + early-return double-safety · single `commitRowList(rows,'merge')` channel → audited/undoable/versioned (all asserted) · `AuditLogType` widened with no exhaustive switch anywhere · token-only inline styles (`var(--iris-muted)`, `var(--iris-font-size-sm)`, no hex).

## Findings (all non-blocking)

1. **LOW** — doc/behavior mismatch: "live-only fields survive" (`advanced.ts:134`, `Table.tsx:8072`, `manifest.json:37262`) is false — a live-only key absent from the snapshot is diffed and overwritten to `undefined` (the test itself encodes the drop). Behavior is required for idempotency; fix is rewording the doc.
2. **INFO** — no dedicated SSR/axe coverage for the new button path (jsdom wiring only).
3. **INFO** — `arch-check:ratchet` fails in the working tree due to pre-existing dirty grid-refactor work (untracked `data-grid/`, baseline/`check-size` edits; HEAD itself already exceeded the committed baseline) — not an ED regression, but the gate stage must reconcile it.
4. **INFO** — the adapt report's `iris-ui-spec.py --mode all` claim couldn't be re-run (script absent here); equivalent manual checks were all green.

No implementation files were modified — only the review doc was created.
