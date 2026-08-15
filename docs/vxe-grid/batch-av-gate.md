Gate complete — **PASS** ✅

## Verdict

`docs/vxe-grid/batch-av-review.md` = **PASS** (2 low / 3 info findings, none blocking). Applied both concrete LOW fixes before the gate:

1. **docs JSDoc** — moved the keyboard key map out of the gitignored hand-edit `apps/docs/components.md` into the source of truth `packages/react/src/primitives/table/props.ts` (`keyboardNavigation` JSDoc). Note: the manifest prop parser drops text on the `/**` opening line and on the line containing `*/`, so the JSDoc puts all prose on `*` lines. `gen:manifest` + `gen:docs-reference` now reproduce the exact key-map text and `check:docs-reference` exits 0 (was exiting 1 per review).
2. **rAF frame cap** — the virtual PageUp/PageDown focus follow-up poll (`Table.tsx`) is now bounded to `GRID_FOCUS_MAX_POLL_FRAMES = 30` frames; a stale pending (cell never rendered in time) is dropped instead of polling forever.

## Gate results

| Check                                                 | Result                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **180/180 tasks successful** (exit 0)                    |
| `pnpm audit`                                          | ✅ **0 vulnerabilities** ("No known vulnerabilities found") |
| `gen:manifest`                                        | ✅ 155 components × 4 frameworks, 86 tokens                 |
| `check:manifest`                                      | ✅ output up to date (2 files)                              |
| `check:docs-reference`                                | ✅ output up to date (3 files) — was failing, fixed         |
| Working tree                                          | ✅ clean after commit                                       |

## Final test counts (turbo cached test run)

- **core:** 1396 · **react:** 2034 · **vue:** 1531 · **solid:** 1531+34 (jsdom + node env suites) · **svelte:** 916+35
- plugins: pro-table 46+13 · markdown 57 · charts 49 · calendar 36 · dashboard 36 · kanban 35 · form-builder 38 · query-builder 29 · admin 29 · editor 22 · notifications 18 · cms-shared 23
- infra: theme 61 · skins 46 · cli 35 · mcp 65 · manifest 69 · icons 29 · tokens 24 · marketplace 14
- apps: desktop-os 13 · todo-app 14 · ssr/desktop shells green
- **TOTAL: 7919 tests — all passing** (react 2034 matches the review's verified count)

## Commit

```
86a3c1eae3c6f1df8962cc077b49a5fc898c7354  feat(table): grid 批 AV——电子表格键盘完整化（Tab/Home/End/PageUp/PageDown/Enter）
```
