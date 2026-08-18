Done. Batch DK implemented and committed (`22470808`).

## What I did

**Core enhancement** (in `packages/react/src/primitives/table/Table.tsx`, `resolveColDrag`'s committed branch): after a header frozen-zone reorder commits via `columnDrag.onReorder`, it now **also emits the new top-level key list through `onColumnOrderChange`** — the same durable, panel-grade channel the settings panel uses, so a header frozen-zone reorder is persistable for controlled parents. Gated exactly per the baseline fiats:

- `!grouped` (flat leaf tables only — `columnOrder` is top-level-scoped)
- `pinOf(moved) !== null` (pinned mover — the existing clamp already guarantees it stays in its own frozen zone; spec's "target also pinned" is the natural subset)
- full new key list, never `undefined`; free-zone reorders stay `onReorder`-only

**Docs**: extended the `columnDrag` doc comment in `props.ts`.

**Tests**: `test/pinned-reorder.test.tsx` (500 lines, within cap) — 6 new DK tests covering the spec VERIFY: left+right frozen-zone intra-reorder both channels + zones preserved, cross-zone free mover onReorder-only, free-zone intra no-emission, missing-callback no-op, grouped-table gate, net-zero no-fire.

## Constraint compliance

- ✅ Core framework-free (react-only change), additive only, no dist/tgz/node_modules/manifest.json hand-edits
- ✅ Manifest regenerated via `pnpm gen:manifest` (captures the doc-comment change) and committed
- ✅ Tests ≤500 lines; changed files: `Table.tsx` + `props.ts` (source) + test file + regenerated manifest + prior-stage docs
- ✅ CSS unchanged (no tokens touched)
- ✅ No new exported types / interfaces (reused existing `onColumnOrderChange` prop)

## Verification (all green)

- `corepack pnpm --filter @iris-ui-kit/core test` → 1584 passed
- `--filter @iris-ui-kit/react test` → 2776 passed; `typecheck` → clean; `lint` → 0 errors (2 pre-existing complexity warnings)
- `iris-ui-spec.py --mode all --json` → 0 violations
- `gen:manifest` regenerated + committed

## What's left

None for this batch — spec fully delivered. (Note: the pre-commit lint-staged/commit-size script reported a non-blocking "6 changed files" fan-out warning; the commit went through cleanly.)
