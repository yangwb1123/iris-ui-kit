✅ **Gate PASS complete** — 批 DO (单元格右键格式, iris 独有)

## Gate results

| Check                                                                  | Result                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (135 cached)       |
| `pnpm audit:security`                                                  | **0 vulnerabilities**                           |
| `pnpm gen:manifest` + `check:manifest`                                 | **Up to date** — 155×4, 86 tokens, DO zero diff |
| `git diff --check` + commit hooks                                      | Clean; 5 files, 0 core logic lines              |

## Final test counts

| Suite                                                                          | Files | Tests       |
| ------------------------------------------------------------------------------ | ----- | ----------- |
| react (incl. DO +2 in `batch-dl-dt.test.tsx`)                                  | 246   | **2818**    |
| core                                                                           | 104   | **1597**    |
| DO suites (batch-dl-dt 13 · context-quick-actions 13 · context-menu-select 17) | —     | **43/43**   |
| turbo                                                                          | —     | **180/180** |

## Docs updated

- `docs/vxe-grid-comparison.md` — added 批 DO row to **iris 独有** section (`contextMenu.formatActions` opt-in, `__iris-format-number`/`__iris-format-upper` keys, `formatContextSelection` toFixed(2)/toUpperCase via `commitRowList 'edit'`, onSelect interception, i18n en+zh) + appended 构建状态 summary
- `docs/vxe-grid/batch-do-gate.md` — rewritten as the real gate report (DN precedent)
- `docs/vxe-grid/DECISIONS.md` — gate record appended

## Commit

**`b2dc79b9`** `feat(table): grid 批 DO——单元格右键格式（iris 独有）` — 5 files, +106/−42

Working tree clean. Feature commit `916d4209` (adapt stage, +2 tests) + gate docs commit `b2dc79b9` complete the batch. Nothing blocking.
