The remaining untracked file (`batch-df-gate.md`) belongs to the parallel DF batch, not my DG work. All done.

## Report

**Batch DG: 列宽自适应增强 (autoResizeColumns)** — Complete.

### Files changed (4 + regenerated manifest/docs)

- `packages/react/src/primitives/table/props.ts` — added `autoResizeColumns?: boolean` (single-line, on named exported `IrisTableProps`).
- `packages/react/src/primitives/table/Table.tsx` — added module-level `measureColumnContentWidth(container, colKey)` helper (max of header+body cell `scrollWidth`, which already includes 12px×2 padding); added optional `onAutoFit` to the local `ColumnResizeHandle` + `span onDoubleClick` (stopPropagation); wired at the consumption point to measure → clamp min/max → `Math.round` → `setColumnWidth` → `onColumnWidthsChange`; destructured `autoResizeColumns = false`.
- `packages/react/src/primitives/table/auto-resize-columns.test.tsx` (new, ~350 lines, 13 tests ≤500).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated (propCount 187→188, no component-count change).
- `docs/vxe-grid/DECISIONS.md` — baseline/gate record appended.

### Tests added (13)

gating ×2, happy-path write-back + grid update, cross-cell max, padding-included (`scrollWidth` no extra term), min clamp, max clamp, rounding, no-op when measured ≤0 (jsdom), controlled-mode onChange (no optimistic flip) + rerender applies, drag/dblclick non-interference, dblclick doesn't trigger header sort.

### Verification (all green)

- core test: **1584 passed**
- react typecheck: **pass** (0 errors)
- react test: **2732 passed** (incl. 13 new) — filtered run + full suite
- react lint: **0 errors** (1 pre-existing complexity warning on `IrisTable`, unrelated)
- `iris-ui-spec.py --mode all`: **0 violations**
- `pnpm gen:manifest`: regenerated + committed (`a967e275`)

### Constraints honored

Core untouched (framework-free, react-only); additive-only; no dist/tgz/node_modules; manifest scanner hygiene (bool prop, named interface); `--iris-*` tokens only (no new CSS needed — reuses existing handle/cell styles); ≤4 source changes + tests; within change budget (5 files, 52 logic lines).

### What's left

- A gate/adapt/review doc for DG (a gate stage will run the full repo gate and record its verdict, matching the sibling-batch workflow); the untracked `batch-df-gate.md` is from the parallel DF batch and left untouched.
- No runtime DOM measurement tested under jsdom (scrollWidth stubbed via `Object.defineProperty`), per the jsdom pitfall — a visual/E2E test would validate real rendering, as with prior resize features.
