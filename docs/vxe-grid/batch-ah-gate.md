**Gate complete — PASS (review FAIL → all findings fixed + regression tests).**

## Verdict

Review **FAIL**: 1 HIGH (dead spread `onClick` shadowed → `cellRange` + `onCellClick` combo left the range toolbar anchored to null → `visibility: hidden`), 1 MEDIUM (`applyViewSnapshot` re-implemented gating without `restorePersistPiece`'s per-piece type guards), 2 LOW (sentinel-name view collision; toolbar `aria-label` was "Copy").

## Fixes applied

| #   | Finding                                                   | Fix                                                                                                                                                                                                | Regression test                                                                                                                               |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH — anchor never updated when `onCellClick` also wired | Anchor update moved into `handleCellClick`'s `cellRange` branch (the ONLY path when `onCellClick`/`rowMode` present); dead `onClick` removed from the `cellRange` spread                           | `cellRange + onCellClick: the unified click path still anchors the bar` (asserts the bar becomes **visible**, not just rendered)              |
| 2   | MEDIUM — no per-piece type guards on view apply           | `applyViewSnapshot` routes every piece through `restorePersistPiece` (same callback gating + type guards); `pageSize` keeps its documented mount-sequence reproduction behind the eligibility gate | `tampered snapshot pieces never reach the callbacks` (`{sort:42, columnOrder:'nope', pageSize:-3}` rejected, well-formed piece still applies) |
| 3   | LOW — `__iris-save-view` view unselectable                | Sentinel exported from `useTableViews.ts` (`IRIS_TABLE_VIEWS_SAVE_ITEM`); dropped at read, refused at save; `TableViews.tsx` imports it                                                            | `a view named like the save sentinel is dropped at read and refused at save`                                                                  |
| 4   | LOW — whole-toolbar `aria-label` = "Copy"                 | New i18n key `table.range.toolbar` (en `Cell range actions` / zh `单元格区域操作`)                                                                                                                 | `toolbar aria-label describes the bar, not the first action`                                                                                  |

+1 i18n key (en+zh) → 批 AH total **+7 keys**.

## Gate results (all green)

| Gate                              | Result                                                 |
| --------------------------------- | ------------------------------------------------------ |
| turbo `test typecheck lint build` | **180/180 tasks** (58 cached, 4m24s)                   |
| `pnpm audit`                      | **0 vulnerabilities**                                  |
| `gen:manifest` + `check:manifest` | **155 × 4 frameworks**, 86 tokens, up-to-date, no diff |

## Final test counts (forced fresh run of the full `test` graph)

| Suite            | Tests                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| core             | 1255                                                                   |
| **react**        | **1877** (table suite 549/549; +4 from review-fix regression)          |
| vue              | 1531                                                                   |
| solid            | 974 (+34 hydration)                                                    |
| svelte           | 916 (+31 hydration)                                                    |
| plugins/tools    | 562 across manifest/mcp/cli/theme/skins/plugin-* + eslint/tokens/icons |
| SSR node:test    | 10 (next 3 · nuxt 3 · solidstart 2 · sveltekit 2)                      |
| desktop (go)     | tauri 2 passed + wails ok                                              |
| **vitest total** | **7621 passed, 0 failed**                                              |

## Docs + commit

- `docs/vxe-grid-comparison.md`: 批 AH row updated (16 + 11 new tests, +7 i18n keys, review fixes noted); test-count line `react 1877（批 AH +27）`
- Added `docs/vxe-grid/batch-ah-gate.md` gate report + DECISIONS.md gate entry
- **Commit**: `3b875f1c82e314bab5868f1172e5c60ccf6a79d4` — `feat(table): grid 批 AH——命名视图预设 + 区域浮动工具栏（iris 独有）` (11 files, +198/−47); working tree clean
