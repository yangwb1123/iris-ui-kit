Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-de-baseline.md`. No source files touched — `git status` shows only the pre-existing dirt (`DECISIONS.md` M, `batch-dd-gate.md` ??) plus the new doc. HEAD `df0d3735` unchanged.

## What was established — 批 DE：表格状态对比（iris 独有）

**Spec**: `handle.compareStates(a: string, b: string): string` — 两个状态 JSON 对比（字段级差异文本）；测试（差异输出）。

**Core finding (逐行复核)**: the exported-state shape is already locked by `exportStateJson` (Table.tsx:5978 — 9 spec 块去 `multiSortState`) / `importStateJson` (:5991), with `state-export-import.test.tsx` green. `IrisTableHandle` (types.ts:581) is a pure-method interface wired at :5672. The batch is a **pure additive handle method** — no new prop, no state, no ref mirror — with its pure core following the `exportCsv.ts` precedent (standalone stdlib module imported into the handle) to avoid growing the Table.tsx god-file (DA/DB dogfooding concern).

**Exact design**: a new pure module `compareStates.ts` (`deepEqual` + recursive `diff`), deterministic by **sorted keys + structural deep-equal** (order-independent); orientation a=before, b=after; git-diff symbols — `+` added / `-` removed / `~ changed old → new`; identical → `''`; invalid JSON → `! compareStates: invalid JSON` (never throws). Root scalar → `~ pageSize: 25 → 50`; object blocks descend → `~ sort.direction: "asc" → "desc"`; record maps per-key → `~ columnWidths.name: 120 → 160`; arrays elementwise by index → `~ columnOrder[0]: "age" → "name"`.

**File map**: NEW `compareStates.ts` (pure) · `Table.tsx` (+1 import +1 handle line) · `types.ts` (+1 method JSDoc) · NEW `compare-states.test.ts` (pure vitest). No props/index/styles/i18n/core/vue2/vue3/miniprogram/manifest changes.

**Test plan**: 12 cases — T1–T11 pure output assertions (identity, key-order independence, scalar/block/nested-record/array diffs, multi-block deterministic order, invalid-JSON fail-closed, orientation flip) + T12 optional render-backed integration reusing the `ControlledHarness` to close the `exportStateJson → compareStates → importStateJson` audit loop.

**Fiats**: pure read-only (no callbacks/live-state mutation), no edits to export/import/collector shape, no merge/apply output, no i18n/events.
