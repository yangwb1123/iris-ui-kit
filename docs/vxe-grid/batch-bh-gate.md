**Verdict: PASS** (2 LOW findings, 0 blockers) → gate executed, committed.

## Gate results

| Check                                 | Result                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build` | **180/180 tasks** (core 1469/1469 · react 2163/2163 · typecheck clean · lint 0 errors) |
| `audit:security`                      | **0 vulnerabilities**                                                                  |
| `gen:manifest` + `check:manifest`     | regenerated, **up to date** — 155 components ×4, 86 tokens                             |

## Fixes applied during gate

1. **LOW-1 (redundant `ref`)** — `group-collapse.test.tsx`: the select-all test passed both `ref={ref}` (invalid prop on a non-forwardRef component → React stderr warning) and `tableRef={ref}`; removed the redundant `ref`, kept `tableRef`.
2. **Gate blocker (found by full gate)** — `plugin-locale-zh`: the 2 new BH i18n keys (`table.groupCollapse`/`table.groupExpand`) were untranslated, failing the plugin's "translates EVERY built-in key" guard. Added zh `折叠分组`/`展开分组`; full gate then passed 180/180.

## Doc updates (`docs/vxe-grid-comparison.md`, iris 独有 section)

- New capability row: 行分组折叠 `groupCollapsed` (controlled `Set<string>` + `defaultGroupCollapsed` + `onGroupCollapseChange`, no-optimistic-flip, `groupPlan` single choke point hides rows + per-group summary, native toggle button with `aria-expanded`, propCount 149→152 / eventCount 28→29)
- 构建状态 line: appended 批 BH
- Test-counts line corrected to actual gate numbers: react 2140→**2163** (+11 BG keymap, +12 BH group-collapse), core 1457→**1469** (+12 BG keymap)

## Commit

```
faf4330b feat(table): grid 批 BH——行分组折叠（iris 独有）
```

7 files, +86/−67. Working tree clean. Final counts: **core 1469/1469 (95 files) · react 2163/2163 (192 files) · 180/180 turbo · audit 0 · manifest 155×4 up to date**.
