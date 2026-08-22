Done. Batch DO (单元格右键格式, iris 独有) delivered and verified.

## Report

**Nature of the batch**: verification-style baseline — the feature was already shipped at commit `61ec5418` (pre-existing commit, not this session). This session verified every spec point against source, closed the baseline's two actionable non-blocking observations with explicit tests, ran the full gate, and recorded/committed the batch.

**Files changed (5, committed)**:

| File                                                            | Change                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | **+2 tests** (13 total, 312 lines ≤500): (1) format keys never reach the user `onSelect` — clicking `__iris-format-number` calls nothing, a user `custom` item still routes through; (2) zero-commit — `format-number` on a text cell + `format-upper` on a number cell leave the row data byte-identical, `onDataChange` not called |
| `docs/vxe-grid/DECISIONS.md`                                    | batch DO baseline/adapt records                                                                                                                                                                                                                                                                                                      |
| `docs/vxe-grid/batch-dn-gate.md`                                | real gate report (leftover `M` from the DN gate stage)                                                                                                                                                                                                                                                                               |
| `docs/vxe-grid/batch-do-baseline.md`                            | baseline (this task's file, rewritten by baseline stage)                                                                                                                                                                                                                                                                             |
| `docs/vxe-grid/batch-do-adapt.md`                               | this report (placeholder rewritten)                                                                                                                                                                                                                                                                                                  |

**Zero source/manifest/core/vue/solid/svelte/types/style changes** — implementation verified as spec-exact, additive, opt-in:

- **Opt-in**: `contextMenu.formatActions?: boolean` (`props/query.ts:232`), default false → menu gains zero items when off
- **Preserved keys**: `table-constants.ts:18-19` — `__iris-format-number` / `__iris-format-upper`
- **Menu mounting**: `Table.tsx:3041-3048` — after copy/clear (batch BW), before annotate (batch BB), same dedupe guard; labels via `t('table.formatNumber'/'table.formatUpper')`
- **Core**: `formatContextSelection` (`Table.tsx:2947-2979`) — active range via `cellRangeCtrl.getRange()` else the right-clicked cell; current body rows + leaf columns; formula / locked / readonly skipped; number && finite → `toFixed(2)` (written back as string), string → `toUpperCase()`; non-matching values byte-identical; `next !== current` guard before commit
- **Write-back**: `commitRowList(next, 'edit')` (`Table.tsx:3282`) — same funnel as the Delete shortcut: version ring / undo / audit / `setLiveData` / `onDataChange` exactly once per batch
- **Intercept**: `Table.tsx:8917-8918` — format keys short-circuit before user `onSelect`
- **i18n**: zh `数字格式（2 位）`/`文本大写` (`plugin-locale-zh/src/core/index.ts:72-73`) + en `Format number (2 decimals)`/`Uppercase text` (`core/src/i18n-messages.ts:87-88`)

**Tests**: spec-mandated pair (range number `'1.20'/'2.50'` with `onDataChange` exactly once + clicked-cell uppercase fallback `ALICE`) was pre-shipped; this session added 2 tests closing the baseline's observations #1 (user callback never sees format keys) and #2 (no-match → zero commits). Observation #3 (number format writes back a string) is inherent spec semantics, not actionable. DO-anchored suites now 43 tests: `batch-dl-dt` 13 + `context-quick-actions` 13 + `context-menu-select` 17.

**Gate results**:

- core test: **104 files / 1597 tests ✓**
- react typecheck ✓ · react test **246 files / 2818 tests ✓** (+2)
- react lint: **0 errors** (2 pre-existing complexity warnings on `Table.tsx`, untouched)
- `iris-ui-spec.py --mode all`: **0 violations** (1535 files)
- `pnpm gen:manifest`: regenerated — **no diff** (manifest/llms.txt already current: 155 components × 4 frameworks, 86 tokens; format keys are UI constants, not manifest entities)

**What is left**: Nothing blocking. The two baseline observations that were actionable are now covered by explicit tests; the manifest is current; the commit respects the change budget (5 files, 0 core logic lines — tests + docs only).
