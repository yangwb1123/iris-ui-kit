Done. All 47 audit violations (plus 1 scanner-blind case) fixed, gates green.

## Change Report

### Audit result

- **Before**: 47 violations in `packages/react/src` (all `魔法间距` spacing; font/hex/shadow were already clean from a prior session's uncommitted work)
- **After**: **0 violations** (fresh `--mode all --pkg react` run, `docs/ui-audit/react.json`)

### Files changed (32, all in `packages/react/src`, source only)

| Area                | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin               | `admin/AdminTabs.tsx` (2), `admin/NavMenu.tsx` (2)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| form-ish primitives | `input/Input.tsx`, `textarea/Textarea.tsx` (2), `number-input/NumberInput.tsx`, `password-input/PasswordInput.tsx`, `cascader/Cascader.tsx` (2), `combobox/Combobox.tsx` (3), `select/Select.tsx` (2), `tree-select/TreeSelect.tsx`, `date-picker/DatePicker.tsx`, `date-range-picker/DateRangePicker.tsx`, `time-picker/TimePicker.tsx`, `copy-button/CopyButton.tsx`, `tag-input/TagInput.tsx` (2), `mentions/Mentions.tsx`, `file-upload/FileUpload.tsx`, `transfer/Transfer.tsx` (2) |
| overlay/nav         | `dropdown/DropdownItem.tsx`, `menu/MenuItem.tsx`, `menu/MenuSub.tsx`, `list/List.tsx`, `command-palette/CommandPalette.tsx` (3), `split-button/SplitButton.tsx` (4), `segmented/Segmented.tsx` (2)                                                                                                                                                                                                                                                                                       |
| misc                | `calendar/Calendar.tsx`, `fieldset/Fieldset.tsx`, `kbd/Kbd.tsx` (2), `range-slider/RangeSlider.tsx`, `ribbon/Ribbon.tsx`, `table/Table.tsx`, `table/TableRow.tsx`                                                                                                                                                                                                                                                                                                                        |

### Violations fixed per category

- **spacing: 48** (47 reported + 1 extra) — all in style-object `padding` shorthands, mapped per-value per spec §2:
  - `6px`/`5px` → `var(--iris-padding-sm, 6px)`; `4px`/`2px`/`3px` → `var(--iris-space-xxs, 4px)`; `8px` → `var(--iris-space-xs, 8px)`; `10px`/`12px` → `var(--iris-space-sm, 12px)`/`var(--iris-padding-md, 12px)` (padding family when shorthand is compact/6px-led, per spec examples); `14px`→space-md; `18px`→space-lg; `28px`→space-xl; `0` kept as `0`
  - e.g. `'6px 28px 6px 12px'` → `'var(--iris-padding-sm, 6px) var(--iris-space-xl, 24px) var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)'`
- **font: 0 / hex: 0 / shadow: 0** remaining (already clean)
- Existing `var(--iris-padding-md, 12px)` second values left untouched per "已是 var 的不要改" rule

### Deviations

1. **NavMenu.tsx:134** — `'8px 10px'` inside a ternary (`padding: collapsed ? 10 : '8px 10px'`) is invisible to the scanner regex (value isn't a bare quoted string), but it's a genuine magic spacing; fixed to `'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)'` for consistency (spec's exact `'8px 10px'` example).
2. **No test edits needed** — no tests assert padding values (the prior session had already updated font assertions in `Input.test.tsx`/`Kbd.test.tsx`).

### Gates

- `pnpm --filter @iris-ui-kit/react test`: **132 files / 1388 tests passed** (only pre-existing `act(...)` warnings)
- `pnpm --filter @iris-ui-kit/react typecheck`: **clean** (`tsc --noEmit`)

Not committed, as instructed. Untouched: dist/, tgz, node_modules, manifest/llms, tokens/theme, other frameworks.
