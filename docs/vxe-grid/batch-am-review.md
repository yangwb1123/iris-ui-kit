## Verdict: **PASS** — written to `docs/vxe-grid/batch-am-review.md`

### What I verified

**Checklist 1 — `suggest`** ✅

- Datalist renders only inside `EditorSurface` (mounted per edit session), gated to the text editor: number/select/textarea excluded and tested (`Table.tsx:305–312`).
- `true` → distinct `String` bodyData values via `getCellValue` (`dataIndex ?? key` indirection), sorted, capped 50 — tested with 60 rows → exactly 50 sorted options.
- Array form used verbatim (zero scan), tested.
- `React.useId()` per instance for the `list`↔datalist link, tested via attribute equality.

**Checklist 2 — `valueDistribution`** ✅

- Core: count desc, first-appearance ties, null/`''` excluded, `String` coercion, `[]` for empty — 9 core tests.
- Built-in item appended after user items with reserved-key dedupe (test asserts index 2 of 3); the reserved key never reaches the user `onSelect` (tested).
- Panel: top 20 + muted others fold (test asserts `5 more`); dismiss via Escape/outside-pointer-down/scroll; anchor snapshotted so a later right-click can't move an open panel.

**Checklist 3 — hygiene** ✅

- Additive only; `check:manifest` green (react 130 props, other frameworks' contracts untouched); core framework-free grep = 0; panel uses only canonical `--iris-*` tokens (subset of ContextMenu's set); en + zh i18n with `{count}` placeholder parity (zh drift test passes).

### Command results

- core test **1317 ✅** · react test **1925 ✅** · typecheck **clean** · lint **0 errors** · `check:manifest` **up to date** · `audit:security` **clean**
- `audit:tokens` exits 1 — but all 4 unknown tokens + drift are **pre-existing at HEAD~1** (unchanged files), zero new tokens from this batch
- filesize gate passes with the documented `iris.yaml` exemptions

### Findings (all LOW/INFO)

1. **LOW** `Table.tsx:2350` — `items.push()` mutates the caller-provided context-menu array; use a spread instead.
2. **LOW** `Table.tsx:439` — array-form `suggest` with duplicate String values → duplicate React `<option key>` warning.
3. **INFO** `Table.tsx:2947/2976` + `DistributionPanel.tsx:76` — tree mode rebuilds `bodyData` per render → memo re-scans (perf only).
4. **INFO** — uncommitted doc stage-report entries in `DECISIONS.md`/`batch-am-adapt.md` are the expected report artifact (text-only).

No files were modified beyond the review document.
