# Verdict: **PASS** → `/home/u1/iris-ui/docs/vxe-grid/batch-eb-review.md`

## What I verified (commit `705fd67a`, 11 files exactly as the adapt report claims)

**Spec correctness** — the full topology matches baseline:

- 5 bump sites: throat `handleCellClick` (Table.tsx:3869) + 2 narrow `onClick` branches (7138/7145) for clicks; `beginEdit` (3695, post-guard) + `createRowSession` (2415, both of its 2 call sites) for edits. Ternary branches are mutually exclusive → every click counts exactly once; F2/Tab funnels via `beginEdit` (no clicks), Escape still counts (open-time), paste/fill & header clicks never count, locked columns skipped in row fan-out (all 21 tests confirm).
- `getColumnStats()`: total desc / key asc, fresh copy (mutation-inert), `[]` when off/idle; `ColumnStatsPanel` = AuditPanel mold, top-5, all data attrs, zero-subscription passive, `<▦>` trigger, +4 en/+4 zh i18n keys. All 10 fiats honored.

**Additive / hygiene / architecture**:

- All bumps gated (`columnStatsEnabledRef`), default off → off-path behavior byte-identical; core delta = 4 plain i18n strings (framework-free ✓); panel/trigger styles are `var(--iris-*)` only, no hex ✓; manifest regenerated 205→206 props, 33 events, `columnStats`/`IrisTableColumnStat` react-only ✓.

**Commands run** — core 1641/1641, manifest 69/69, react 2968/2968 (255 files), typecheck clean, lint 0 errors, `iris-ui-spec.py` 0 violations, `check:manifest` up to date, `pnpm size` within budget. `check:docs-reference` passes idempotently (components.md is a gitignored artifact). Pre-existing dirt is untouched by EB.

## Findings (non-blocking)

1. **LOW** `Table.tsx:2825` — `columnStatsTop` sorts every render while `columnStats` is on even with the panel closed; gate on `columnStatsOpen` to drop the closed-panel cost.
2. **INFO** `Table.tsx` 10103 lines vs 9137 arch baseline — violation **predates** EB (file was 9988 at EB's base); ratchet is already red repo-wide, zero violations in EB's own files.
3. **INFO** manifest descriptions truncated mid-sentence — generator-wide behavior, affects all long props identically.
