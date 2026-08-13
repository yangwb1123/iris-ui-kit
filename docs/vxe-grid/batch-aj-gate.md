## Gate complete — PASS

The review verdict was **FAIL** with one confirmed HIGH blocker; I applied the fixes (blocker + 2 LOW + 2 INFO), reran the full gate, and committed.

### Fixes applied

**HIGH — runtime crash on data shrink with open stats panel** (`Table.tsx`): core `rangeStats` returns `{}` whenever the row span is fully out of bounds after `bodyData` shrinks (e.g. a batch-AI NL query emptying the view), so `stats[key]` was `undefined` and the panel dereferenced `entry.stats.count` → `TypeError`. The per-column stats memo now guards `stats[key]` presence and drops columns with no stats; when nothing remains it returns `null` (panel hides) while the hoisted `statsOpen` state stays true, so the panel reappears when the range becomes valid again. The memo moved after the `visibleColSet` declaration (TDZ-safe) and gained the dep.

**Regression test** added to `range-stats-view.test.tsx`: select rows 1..2 of 3 → open 统计 → shrink the view below the range via a controlled query (the exact NL-query reachability) → asserts no crash, panel hidden, `aria-expanded="false"`, bar intact, and the panel reappears when data grows back.

**[LOW]** Hidden columns: the stats memo now applies the same `visibleColSet` skip the cell render uses — scrolled-out/virtualized columns never appear as stats rows.

**[LOW]** a11y (`RangeToolbar.tsx`): `aria-expanded` now reflects actual panel presence (`statsOpen && stats != null && stats.length > 0`), not the hoisted open state; the `role="table"` panel gained an accessible name via `aria-label={t('table.range.stats')}`.

**[INFO]** Empty `''` query is no longer captured into view snapshots (batch-AI "empty inactive" convention); restore path unchanged (legacy `''` snapshots still restore harmlessly).

**[INFO]** Doc drift: `batch-aj-adapt.md` "+8 keys" corrected to "+7 keys" (en + zh: `table.range.stats` + 6 panel headers).

### Full gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** (4m16s)
- `pnpm audit` → **0 vulnerabilities**
- `gen:manifest` + `check:manifest` → **155×4 frameworks, 86 tokens, up-to-date, no diff**

### Final test counts

- **vitest: 7210 passed, 0 failed** — react **1892** (range-stats-view 8/8 incl. the new shrink regression; range-toolbar 11/11), core 1300, vue 1531, solid 974 + 34 (SSR), svelte 916 + 31 (SSR), plugins/tools/apps 532
- SSR node:test 7 (next 2 · nuxt 2 · solidstart 2 · sveltekit 1); desktop: tauri 2 + wails ok + electron smoke ok

### Commit

- **`<hash>`** — `feat(table): grid 批 AJ——区域统计 + 查询视图联动（iris 独有闭环）`
