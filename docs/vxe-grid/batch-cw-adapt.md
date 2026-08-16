Done — committed as `4b4f7f31`. `docs/vxe-grid/batch-cv-gate.md` is deliberately left untracked (prior-stage CV gate dirt, per the batch-CV adapt precedent).

## 批 CW：导入预览（iris 独有）— Complete

### Files changed (9)

| File                                                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                                  | `importPreview?: boolean` after `zoomConfig` (single-line boolean, named JSDoc)                                                                                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/Table.tsx`                                 | destructure · module helper `previewColumnsFromRows` · state `importPreviewRows` · **gate split exactly at the `toolbar.onImport?.(rows)` call** (off → byte-identical) · confirm (onImport with ALL rows) / cancel · open-only Esc listener · fixed centered modal in the toolbar fragment: title + first-5-rows table (`data-iris-import-preview-*`) + `table.total` note when >5 + 取消/确认 footer — `--iris-*` tokens only |
| `packages/react/src/primitives/table/test/import-preview.test.tsx`              | **NEW, 12 tests, 243 lines** (≤500)                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/core/src/i18n.ts` / `plugin-locale-zh/src/core/index.ts`              | +3 keys en+zh (`importPreview.title/confirm/cancel`; total note reuses `table.total`)                                                                                                                                                                                                                                                                                                                                           |
| `packages/manifest/{manifest.json,llms.txt}`                                    | regenerated — propCount **182→183**, eventCount 32 unchanged                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/vxe-grid-comparison.md` · `DECISIONS.md` · `batch-cw-{baseline,adapt}.md` | 构建状态 tail + test-count line + stage bookkeeping                                                                                                                                                                                                                                                                                                                                                                             |

### Tests added (12)

Spec-mandated ① exact-5-of-7 + total note + CSV-ordered headers ② confirm → `onImport` once with all 7, closes ③ cancel → zero calls; plus: off-path byte regression, Esc close, backdrop close, single-line silent no-op, blank-line raw `['']` row, total-note 5/6 boundary, re-import freshness, quoted RFC-4180 fields raw in preview+payload, zh locale chrome.

### Verification (all green)

- core **1559/1559** (logic untouched — 3 i18n default keys only; framework-free invariant intact)
- react typecheck clean · test **2648/2648** · lint **0 errors** (1 pre-existing complexity warning)
- spec **0 violations** (1416 files) · check:manifest + check:docs-reference up to date · prettier clean

### Deviations / what's left

- **`onImport([])` header-only test dropped as infeasible**: `parseCsv` never yields body-less rows (blank lines push `['']`), so the header-only CSV is exactly the preserved `<2`-line no-op — covered by test ⑦; closest reachable shape (blank-line row) covered by ⑧.
- Total note styling uses the `--iris-z-modal` Dialog precedent (fixed overlay), same toolbar-fragment render site as designed.
- First-5 only per spec; confirm is the single commit path (no partial import UI — not asked).
- `docs/vxe-grid/batch-cv-gate.md` left untracked (prior-stage dirt).
