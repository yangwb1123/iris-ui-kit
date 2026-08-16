Verdict written to `docs/vxe-grid/batch-cr-review.md`: **PASS**.

## Review summary

**Verification (all executed fresh):**

- Core test 1559/1559, framework-free grep = 0 (zero core changes)
- React test 2582/2582 (2570 + 12 new), typecheck clean, lint 0 errors (1 pre-existing complexity warning)
- `check:manifest` up to date (react 178 props, events 31, 155×4; `columnTotals` react-only)
- Spec audit 0 violations (1416 files); `audit:tokens` exit 1 pre-existing only; `audit:security` 0 vulns
- `arch-check:ratchet` fails but is **pre-existing** on parent commit (stale baseline 1255 vs 10528-line Table.tsx; props.ts/types.ts have no baseline) — not attributable to this batch

**Spec correctness:** `columnTotals?: boolean` (props.ts:459, fail-closed), strip directly below toolbar / before FNR bar (Table.tsx:9491–9519), sum-only via `summary === 'sum'` with the exact summary-row pipeline (`aggregate(bodyData,…)` → `aggregateAccuracy` gate → `renderSummary ?? String` — footer parity verified byte-for-byte against :8348), selection spacer, empty-body `0`, toolbar independence, all five fiats honored.

**Findings (2 LOW + 3 INFO, none blocking):**

1. **LOW** — a11y: strip cells use `role="cell"` with no `role="row"` ancestor (outside the `role="table"` root); inconsistent with the summary row's `role="row"` wrapper. Fix: wrap in `role="row"` or drop roles.
2. **LOW** — no top-corner radius when the strip is topmost (toolbar absent); matches form/FNR precedent, optional polish.
   3–5. **INFO** — leading-track (rowDrag/seq/detail) alignment quirk = documented fiat (matches summary row); strip not gated on loading/error (FNR precedent); arch-check failure pre-existing.

No files were modified besides the required verdict markdown.
