**Verdict: PASS** — written to `/home/u1/iris-ui/docs/vxe-grid/batch-ba-review.md`.

## Summary

All required checks verified against commit `1cc821d0`:

**Core** (`version-history.ts`, 145 lines) — ring limit (default 20, `0` unlimited, pop-trim), newest-first (`unshift`), `get(index)` copy/undefined, `clear()` wipes but monotonic index never resets, Set-based `subscribe`/`getVersion` — all confirmed, audit-log mold parity, framework-free.

**React** — snapshot-before-mutation confirmed: `recordHistory` runs first in `commitRowList` (Table.tsx:3001) before `recordAudit`'s eager ref sync, pushing true pre-change rows + the batch-AT type hint; restore routes through `commitRowList(rows,'undo')` with `historySuppressRef` (no re-push, but auditable + undoable); panel (newest-first entries, click-restores-and-closes, Esc/outside/scroll close, empty state, no clear button) mirrors the audit panel; `getVersions()` lightweight / `restoreVersion(index)` no-op-on-unknown handles.

**Hygiene** — additive only (single-line prop, gated, toolbar admitted); `check:manifest` up to date (prop 143→144, no new components — the 154-vs-155 count is pre-existing); CSS all `var(--iris-*)`; i18n en+zh.

**Verification** — core 1438 ✅ · react 2087 ✅ · react typecheck ✅ · react lint 0 errors (pre-existing complexity warning) ✅ · spec audit 0 violations ✅ · check:manifest ✅.

**Findings** (non-blocking):

1. **LOW** — no `@iris-ui-kit/core/version-history` subpath/tsup entry (all sibling ring controllers like `./audit-log`, `./undo` have one); flagged by the implementer, breaks packaging-level mold parity.
2. **INFO** — `IrisTableVersionEntry.type` duplicates the `AuditLogType` union inline instead of importing from core (drift risk).
3. **INFO** — a value-identical `updateRow` still pushes a version (pre-existing audit-funnel semantics, faithfully mirrored, not a regression).

No files modified (runner bookkeeping `DECISIONS.md`/`batch-ba-adapt.md` untouched).
