# 批 DT Review — PASS

All verification completed. Summary of the adversarial review:

## Verdict: **PASS**

The DT capability (表格导出选择, iris 独有) landed in commit `61ec5418` (ancestor of HEAD `28d5fcf5`); this pass made zero source changes.

### Checks

- **Spec correctness** — `exportRowsCsv(keys)` contract at `types/handle.ts:38`; implementation `Table.tsx:3464-3472` byte-identical to the `exportSelectionCsv` pipeline (formula materialization + mask + hidden-column exclusion), body order preserved, empty → `''`, zero dependency on checkbox/`selectable` state; dedicated test `batch-dl-dt.test.tsx:485-489` locks exact CSV output (`[3,1]` → `alice,Paris,1.2\ncara,Berlin,4`), file 492 lines ≤ 500.
- **Additive only** — DT region is pure `+` in `61ec5418`; `61ec5418..HEAD` has 0 diff in core/vue/solid/svelte; working tree has zero src changes (only the 4 pre-existing doc edits). The `exportCsv.ts` delta is `parseCsv` (batch DI, unrelated).
- **Manifest hygiene** — `check:manifest` clean (155×4 contracts, 86 tokens, up to date; handle methods not enumerated by design).
- **Core framework-free** — 0 framework imports in `packages/core/src`.
- **CSS tokens** — no CSS/token changes introduced.

### Gates re-run

| Gate            | Result                                                   |
| --------------- | -------------------------------------------------------- |
| core test       | ✅ 1597/1597 (104 files)                                 |
| react test      | ✅ 2826/2826 (246 files)                                 |
| react typecheck | ✅ clean                                                 |
| react lint      | ✅ 0 errors (2 pre-existing complexity warnings, not DT) |
| pnpm audit      | ✅ 0 vulnerabilities                                     |
| iris-ui-spec.py | ✅ 1535 files, 0 violations                              |

### Findings (all P3 non-blocking, inherited from baseline)

1. No negative-case tests (empty keys / unknown keys / duplicates) — `batch-dl-dt.test.tsx:485`.
2. Hidden-column/formula/mask behavior proxied through AP pipeline, not line-locked for DT.
3. String keys and `rowId` fallback path unasserted.
4. Cross-page proxy keys skip behavior undocumented.

Verdict written to `docs/vxe-grid/batch-dt-review.md`.
