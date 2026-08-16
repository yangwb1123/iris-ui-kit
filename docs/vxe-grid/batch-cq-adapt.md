Batch CQ complete and committed. Working tree clean.

## Report — 批 CQ：编辑实时预览（iris 独有）

**2 commits:**

- `358fb1c6` — `feat(table): grid 批 CQ——编辑实时预览（iris 独有）`
- `b6f6623e` — `docs(vxe-grid): batch CQ adapt report`

### Files changed (9 + adapt doc)

| File                                                             | Change                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                   | `editPreview?: boolean` single-line prop after `charCount` (propCount 176→177)                                                                                                                                                              |
| `packages/react/src/primitives/table/styles.ts`                  | `EDIT_PREVIEW_STYLE` — muted small line, token-only (`--iris-font-size-xs`/`--iris-muted`/`--iris-space-xxs`, `pointer-events: none`)                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx`                  | `EditorSurfaceProps` +`editPreview?`/`row` props · module `editPreviewDraft` helper · preview node (after editor, before validation error; `editPreview && col.formatter` double gate) · Table destructure + 2 call sites (cell + row mode) |
| `packages/react/src/primitives/table/test/edit-preview.test.tsx` | **NEW — 13 tests, 232 lines** (≤500 ✓)                                                                                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`                     | regenerated (176→177 props, 31 events, 155×4)                                                                                                                                                                                               |
| `docs/vxe-grid-comparison.md`                                    | 批 CQ row in 「iris 独有」section + 构建状态 tail                                                                                                                                                                                           |

### Tests added (13)

preview renders · live grow/shrink updates · no-formatter gate · fail-closed default · mask-before-formatter parity · row-aware formatter · number-editor coercion (`.toFixed` never crashes on string draft) · select typed-value · textarea newlines · row-mode per-editor · Enter commit teardown · Escape cancel teardown · muted-token style + error coexistence with DOM order.

### Verification (all ✅)

- core test **1559/1559** (core untouched, framework-free intact)
- react typecheck **clean** · react test **2569/2569** (2556→+13)
- react lint **0 errors** (1 pre-existing IrisTable complexity warning, identical to HEAD)
- spec script **0 violations** (1416 files)
- `gen:manifest` regenerated + committed

### Deviations from baseline (2, documented in adapt report)

1. **13 tests not 12** — the baseline's arithmetic disagreed with its own 13-case enumeration; implemented per enumeration.
2. **Draft coercion** (`editPreviewDraft`) — baseline's raw-string-draft formula would feed formatters a string where the commit path writes a number (`.toFixed` → crash; not byte-faithful). Added commit-path-equivalent coercion to be truly "byte-faithful to the committed cell", text/textarea paths unchanged.

### What is left

- Runner's review/gate stages; vue/solid/svelte parity deferred (react-only, iris-独有 scope).
