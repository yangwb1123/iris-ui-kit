Gate stage complete. Summary:

## Verdict: FAIL → fixed → PASS ✅

`batch-dw-review.md` found **#1 MEDIUM** (spec-correctness defect — the FAIL trigger): the `onTableEvent` JSDoc in `props/layout.ts:150-151` claimed "snapshot restores and `expandAll` fire no bus event," but the expansion family DOES emit: `expandAll` seeding calls `expansion.merge(keys)` (Table.tsx:4633) and expandedKeys snapshot/URL restore calls `expansion.set(...)` (Table.tsx:1579), both of which go through `createExpansion`'s unconditional `onChange` (core `expansion.ts:61-66`) → `expanded-rows-change` bus event on mount/restore. Empirically confirmed via a black-box jsdom run in /tmp (cleaned; repo untouched). **#2 LOW** — the closed `IrisTableEvent` union was unused: `emitTableEvent(type: string, detail: unknown)` accepted any string. **#3 INFO** — batch-record drift (13-type palette / 402 lines / 18 sites).

### Fixes applied (small + localized, exactly as recommended)

1. **MEDIUM — contract corrected + pinned.** `props/layout.ts` + `types/event.ts` JSDoc rewritten: controllable proxy `sort` updates still fire no event, but the expansion family mirrors the shared `onExpandedRowsChange` channel — EVERY model commit fires `expanded-rows-change` (user toggles, `expandAll` seeding, `persistState`/view `expandedKeys` restores; a restore still gates on `onExpandedRowsChange` + an expandable table). **+2 pinning tests** in `batch-dw.test.tsx` (17 total, 475 lines ≤500): expandAll seed fires `['1','2']` key-order event; persistState `expandedKeys: ['2']` seed fires exactly one `expanded-rows-change` with `['2']`.
2. **LOW — typed funnel.** `emitTableEvent = <K extends IrisTableEvent<Row>['type']>(type: K, detail: Extract<IrisTableEvent<Row>, { type: K }>['detail'])` — all 19 sites typecheck, a typo'd event type now fails typecheck.
3. **INFO — batch records updated:** baseline "13-type" → "14-type palette"; adapt "18 sites / 15 tests / 402 lines" → "19 sites / 17 tests / 475 lines" + corrected design note + gate-review follow-up paragraph.

### Full gate (re-run)

| Gate                                                  | Result                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184** tasks                                                                                       |
| `pnpm audit:security`                                 | ✅ **0 vulnerabilities**                                                                                   |
| `gen:manifest`                                        | ✅ regenerated (only the corrected `onTableEvent` description changed in both react records)               |
| `check:manifest`                                      | ✅ up to date, byte-identical                                                                              |
| `check:pack-install`                                  | ✅ all 27 publishable packages (review's stale-dist note closed — rebuilt dist now carries `onTableEvent`) |

### Final test counts (fresh runs)

- **react**: 250 files — **2872/2872** ✅ (batch-dw 17/17)
- **core**: 106 files — **1641/1641** ✅

Also updated `docs/vxe-grid-comparison.md` (批 DW row, review-fix paragraph) + `docs/vxe-grid/batch-dw-baseline.md`/`batch-dw-adapt.md` (accepted drift corrections).

### Commit

**`<hash>`** — `feat(table): grid 批 DW——表格事件总线（iris 独有）`. Note: the concurrent grid-refactor pipeline's dirty files (`docs/DECISIONS.md`, `docs/SPRINT.md`, `core/src/index.ts`, plugin exports, etc.) were left uncommitted and untouched.
