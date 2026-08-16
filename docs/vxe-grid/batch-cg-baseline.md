Baseline complete — written to `/home/u1/iris-ui/docs/vxe-grid/batch-cg-baseline.md` (199 lines). Zero source files touched; git status shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cf-gate.md`), HEAD `8b0285a7`.

## Baseline essence (batch CG：单元格字数统计 — iris 独有)

**Design** — one additive prop, two gated render sites, fail-closed:

- **Prop** (`props.ts:395`, after `editAutoHeight`): `charCount?: boolean` — manifest n 168→169. Neither mode enables the other's flag: editing badge needs only an editable column; selection badge needs `charCount && cellRange` (derives from `activeRange`).
- **编辑时实时** — badge lives in the shared `EditorSurface` (Table.tsx:793), so cell AND row modes get it from one render site. Live count = `String(state.draft ?? '').length`, recomputed per keystroke via the existing session-store subscription (zero new state — the cell arrow doesn't subscribe to the draft, so the badge must live in the surface). Cell gains `position: relative` while `editing && charCount` via a module helper (hot-arrow budget discipline).
- **选区时复用 rangeStats** — badge at the range's bottom-right cell (`activeRange.end`, the fill handle's corner) is a pure reduction over the EXISTING `rangeStatsData` memo (Table.tsx:6688) that the 统计 panel already consumes: count = Σ column non-null counts, sum = Σ numeric column sums (`null` = no numeric data), rounded via the same `aggregateAccuracy` gate as selectionSummary. Fill-handle collision: badge shifts to `bottom: 10px` when the host is also the handle host.
- **i18n** — 3 keys (`table.charCount` / `.range` / `.rangeSum`), EN in core `defaultMessages` + zh in `plugin-locale-zh`. Hard gate: the zh plugin test asserts full key coverage + placeholder parity, so both files must land together in the same change.
- **Zero change** to types.ts / core (except i18n keys) / solid·vue·svelte / TableRow dead code.

**File map**: `props.ts` · `Table.tsx` (helpers + surface + 2 call sites + style branch + badge render + memo) · `styles.ts` (2 token-only chip styles) · core i18n · zh plugin · NEW `test/char-count.test.tsx` · manifest regenerated.

**Test plan**: 13 cases — 编辑计数 6 (live up/down, textarea newlines, row mode per-column, fail-closed no-badge, zh `5 字`) + 选区计数 7 (text-only `4 cells`, numeric sum, mixed columns, Escape cleanup, fail-closed, fill-handle coexistence with 10px shift, aggregateAccuracy rounding), plus CI gates (zh parity, manifest 168→169, existing edit/range/fill suites stay green).
