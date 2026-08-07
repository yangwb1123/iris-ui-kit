All evidence gathered. Here is the design-intelligence review report.

---

# Design-Intelligence Review — iris-ui Component Library

**Scope:** `/home/u1/iris-ui` — four-framework, token-driven library; `packages/react/src/primitives` as reference implementation.
**Dimensions:** product-thinking, color-intelligence, information-priority, cognitive-load, emotional-design, data-expression, component-spec adherence.
**Method:** code-level evidence (file:line), contrast math verified, no files modified.

---

## Executive Summary

iris-ui is a **well-engineered, token-disciplined** library: semantic color tokens exist in light/dark with correct dark-mode brightening, complex data components (Table, Tree) have genuinely complete state coverage, and the control-size scale is internally consistent across Input/Select/Combobox/DatePicker/TimePicker. The most significant gaps are (1) **no danger variant anywhere on buttons** (destructive operations cannot be color-encoded), (2) **Badge solid-variant text fails WCAG contrast on all semantic tones** (a `--iris-warning-foreground` token exists precisely for this and is unused), (3) an **"info" tone inconsistency** (three components map it to `--iris-primary`, one to `--iris-info`), and (4) **several component-spec size mismatches** (Button height/radius, Card padding/radius, Dialog padding/width) that stem from a deliberate but undocumented-in-spec dense control scale.

---

## Dimension 1: Information Priority

### Strengths

- **Semantic tone system is pervasive and consistent at the token level.** Alert (`alert/Alert.tsx:9-14`), Badge, Chip, Banner, Toast, Gauge, Progress, ProgressCircle, Result all map tones to `--iris-success/warning/danger` tokens — no per-component semantic palettes.
- **Table communicates state precedence explicitly:** `error → loading → empty → rows` (`table/Table.tsx:1082-1096`), with `data-iris-table-row="error|loading|empty"` hooks, plus summary row (`Table.tsx:1142+`) with `fontWeight: 600` and 2px top border — aggregation is visually distinguished.
- **Calendar encodes hierarchy well:** selected (primary fill), today (`aria-current="date"` + surface-hover), out-of-month (muted), focused, disabled, min/max clamped (`calendar/Calendar.tsx:253-279`).
- **Select communicates value vs placeholder** (foreground vs muted, `select/Select.tsx:170-171`) and selected option (primary fill + `aria-selected`).
- **Sort indicators** use primary for active, muted for idle (`table/Table.tsx:1056-1060`).
- **Statistic** follows the KPI pattern from spec 03 §3: large value (20/28/36px, tabular-nums), muted label, trend arrow + color + magnitude, optional context description (`statistic/Statistic.tsx:22-28, 60-95`).

### Issues

1. **[MECHANICAL] No danger variant on Button or SplitButton — destructive actions cannot be color-encoded.** `core/types.ts:22` defines `Variant = 'solid' | 'outline' | 'ghost' | 'link'`; `split-button/SplitButton.tsx:4` is `'primary' | 'default'`. Spec (component-spec §1) explicitly requires "危险操作（删除/作废）用 danger 样式". Every destructive confirmation dialog must hand-roll a red button via inline styles, breaking the token system's single-source principle.
2. **[MECHANICAL] Select has no empty state.** `select/Select.tsx:230-231` — with `items: []`, the listbox renders completely empty (grep for `emptyText`/`emptyState` in Select.tsx: **0 hits**). Combobox (`combobox/Combobox.tsx:23,154,235`) and Tree have empty states; Select is the outlier in its own family. A "No options" message (like `combobox.empty`) is missing.
3. **[JUDGMENT] Table has no selected-count / bulk-action bar.** Spec §5 requires "批量选择：显示已选数量 + 批量操作栏". Table implements select-all checkbox (`table/TableHeader.tsx:100,191`) and `onSelectionChange`, but renders no count anywhere (`已选` / `selectedCount` grep: 0 hits). Consumers must build the bar themselves — a spec-mandated affordance is missing.
4. **[JUDGMENT] Numeric columns are not right-aligned by default.** `table/types.ts:36` — `align` is opt-in, default left. Spec §5: "数字右对齐". No value-type detection (`typeof col.value === 'number'` never appears in Table). Numbers in default tables align ragged, hurting scanability of financial/quantity columns.
5. **[JUDGMENT] Selected option renders as full primary fill** (`select/Select.tsx:271-275`) — the loudest visual treatment in the library for a single selection. Ant/MUI-style subtle background + checkmark keeps the list scannable; primary fill competes with the trigger's own primary focus state.

### Recommendations (ranked)

| #   | Action                                                                                                           | Value                                 | Effort     |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- |
| R1  | Add `danger` (and ideally `success`/`warning` ghost) variant to Button + SplitButton, mapping to `--iris-danger` | High (safety-critical semantics)      | Low        |
| R2  | Add "No options" empty message to Select (i18n `select.empty`)                                                   | Medium (families should behave alike) | Very low   |
| R3  | Table: render selected-count text in header (e.g. "3 selected") + slot for bulk bar                              | Medium (spec §5)                      | Low-Medium |
| R4  | Auto right-align columns whose data is numeric (or document that `align:'right'` is mandatory for numbers)       | Medium                                | Low        |
| R5  | Soften Select selected-option to subtle bg + checkmark glyph (double encoding)                                   | Medium (scanability)                  | Low        |

---

## Dimension 2: Cognitive Load

### Strengths

- **Control-scale consistency across the form family is exemplary.** Input (`input/Input.tsx:12-16`), Select (`select/Select.tsx:12-17`), Combobox (`combobox/Combobox.tsx:16-21`), DatePicker (`date-picker/DatePicker.tsx:98-101`), TimePicker (`time-picker/TimePicker.tsx:141,210`) all use the same 28/34/40px min-height ladder, same border + 6px radius + 3px focus ring pattern, same `0.6` disabled opacity, same muted placeholder color, same danger-border invalid treatment. One mental model across the family.
- **FormField wraps the label/hint/error trio** and wires `aria-describedby` correctly (`form-field/FormField.tsx:40-49`) — the spec's label-16 / placeholder-14 / error-12 inline-danger hierarchy is a consumer's one-liner.
- **Table's behavior budget is met without inventing conventions:** keyboard sort, column resize (`ColumnResizeHandle` with WAI-ARIA separator pattern), pinned columns, virtual scroll, summary row, expandable detail rows — all standard patterns, no bespoke gestures.
- **Tree is the strongest cognitive-load citizen:** tri-state checkbox cascade, roving tabindex, full ARIA tree pattern, per-node lazy loading with per-node loading/error state (`tree/Tree.tsx:67-69,109-112`) — progressive disclosure done properly.
- **Select keyboard nav is single-sourced** in `createKeyboardNav` (core): arrows, typeahead, Home/End, Enter/Space, loop — consistent behavior, not per-component reimplementations.

### Issues

1. **[MECHANICAL] Select's popover listbox has no max-height/scroll guard for long lists.** `select/Select.tsx:206-208` — the `<ul>` has no `maxHeight`/`overflow`. 100 items → a full-height popover. (Table virtualizes; the select family doesn't need virtualization, but a bounded list is table stakes.) _Note: `--iris-z-dropdown` and popover positioning are fine._
2. **[JUDGMENT] DatePicker lacks a "today" shortcut and clear affordance** (`date-picker/DatePicker.tsx` — trigger renders value or placeholder; no clear button, no today jump). Spec doesn't mandate these, but for the recurring "set to today" task, users must click through the calendar. Low severity; the Calendar itself has today's highlight (`calendar/Calendar.tsx:165,260-261`).
3. **[JUDGMENT] `Select` selected-option primary fill + trigger primary focus both saturated** (see Dimension 1 #5) — two competing "most important" signals in one interaction.
4. **[MECHANICAL] `hover` prop on Card is inert** (`card/Card.tsx:37-39`): it toggles a `transition` declaration but there is no `:hover` rule anywhere in the component (card/ has only 3 files, no stylesheet). Consumers flipping `hover` get a transition that transitions nothing — a false affordance, and a silent API trap.

### Recommendations

| #   | Action                                                                              | Value                    | Effort   |
| --- | ----------------------------------------------------------------------------------- | ------------------------ | -------- |
| R6  | Cap Select listbox height (`maxHeight: ~320px`, overflow auto)                      | Medium                   | Very low |
| R7  | Implement Card `:hover` (shadow-md→lg + slight translate) or remove the prop        | Medium (dead API)        | Very low |
| R8  | Add `clearable` + `showToday` to DatePicker (i18n `clearable.clear` already exists) | Medium (task efficiency) | Low      |

---

## Dimension 3: Emotional Design

### Strengths

- **EmptyState is a proper teaching component** (spec 04 §5): icon + title + description + action, centered, 380px max text width (`empty-state/EmptyState.tsx:10-70`). The API exists for "👋 创建第一个项目" moments.
- **Result double-encodes status**: glyph (✓/✕/i/!) + semantic color circle (`result/Result.tsx:18-23, 60-76`) — readable by color-blind users and screen readers.
- **Toast is operationally humane:** variants, action button, in-place update by id, auto-dismiss with `duration`, safe-area insets for mobile webviews (`toast/ToastViewport.tsx:36-48`).
- **Reduced-motion is respected** in Skeleton (`skeleton/styles.ts:37`) and Spinner (`spinner/styles.ts:17`) — a real accessibility-plus-emotion signal.
- **Alert role semantics are correct**: `role="alert"` for warning/danger, `role="status"` for info/success (`alert/Alert.tsx:62-64`).
- **Data-state transitions are animated** via `useDataState` (`motion/useDataState.ts:37-45`) with re-keyed cross-fade, and drop animation under `prefers-reduced-motion` — loading→content transitions feel alive, not jarring.

### Issues

1. **[JUDGMENT] Default empty/loading copy is terse machine-speak, not teaching.** `core/src/i18n.ts:103-105`: `table.empty: 'No data'`, `table.loading: 'Loading…'`, `table.error: 'Failed to load data'` (same for tree/list). Spec 04 §5: empty state = 产品教学. The components _support_ rich states via `emptyState` props, but the default experience shipped to every consumer is the dead-end "No data" the spec explicitly bans.
2. **[JUDGMENT] No error-recovery affordance in default error states.** Table's error row is a muted text line; spec §7 requires "失败提示 + 重试入口". There is no built-in retry button (the consumer must build it), and error copy ("Failed to load data") gives no hint of what to do — the "无法连接服务器，已自动重试 3 次" style of humane copy is absent.
3. **[JUDGMENT] No micro-interaction on button press** — spec 05 §5 suggests 0.98 scale; `button/styles.ts` has no `:active` rule (verified). The only scale animation in the library is Radio's checked dot (`radio/Radio.tsx:59`). Tactile feedback is uniformly absent.
4. **[JUDGMENT] No count-up / draw-in animation for KPI values.** Statistic renders statically (`statistic/Statistic.tsx` — no animation code); spec 03 §9 recommends number growth for hero metrics. Gauge/ProgressCircle have 200ms stroke transitions (good), but the "storytelling" layer is left entirely to consumers.

### Recommendations

| #   | Action                                                                                                                                                                           | Value                  | Effort     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| R9  | Add `:active` pressed feedback to Button (scale 0.98 + darker solid)                                                                                                             | Medium (tactile layer) | Very low   |
| R10 | Richer default empty copy + built-in retry slot on Table/Tree/List error states (`errorState` default renders `<EmptyState>` with retry button when an `onRetry` prop is passed) | High (spec §7)         | Low-Medium |
| R11 | Optionally animate Statistic value (count-up, ≤300ms, reduced-motion aware)                                                                                                      | Medium                 | Medium     |

---

## Dimension 4: Data Expression

### Strengths

- **Honest value rendering everywhere.** Gauge clamps `(value−min)/(max−min)` and labels the rounded percent (`gauge/Gauge.tsx:49-52, 69-71`); Progress clamps to `[0, max]` (`progress/Progress.tsx:29-31`); ProgressCircle likewise (`progress-circle/ProgressCircle.tsx:21-23`). No unbounded or negative bars can render.
- **ARIA is complete on data components**: `role="meter"` with valuemin/max/now/valuetext on Gauge; `role="progressbar"` + indeterminate handling on Progress (`aria-valuenow` omitted when indeterminate, `progress/Progress.tsx:43-48`); skeleton gets `role="status"` + `aria-busy`.
- **Charts are token-driven, not rainbow-driven**: `plugin-charts/src/core/series.ts:31-38` resolves every series/slice color through `colorToken → CSS var`; no hardcoded hex palettes (spec 02 §5: 图表数据必须来自语义 token). Bars/radial/cartesian all route through `chartColor()`.
- **Statistic uses `tabular-nums` + `fontVariantNumeric`** (`statistic/Statistic.tsx:66`) — KPI digits don't jitter on change.
- **Table summary row aggregates over the full sorted dataset** (`table/Table.tsx:1142-1167`) with custom renderers — totals stay correct when filtered, a classic honesty trap avoided.

### Issues

1. **[JUDGMENT] Statistic trend color is hardcoded to direction, not business semantics.** `statistic/Statistic.tsx:25-27`: `up → --iris-success`, `down → --iris-danger`. Spec 03 §3: "升绿/降红**或按业务语义**". For cost/risk KPIs (expenses ↑, incidents ↑) green-up is semantically wrong, and there is no prop to override tone while keeping the arrow. `IrisStatisticTrend = 'up'|'down'|'neutral'` is direction-only.
2. **[JUDGMENT] Gauge/ProgressCircle status is fully manual** — value 99 with `status="default"` renders primary blue, identical to value 50. No threshold mapping (`value > 80 → danger`) is provided or suggested; every consumer re-derives a common decision. Not wrong (honesty preserved), but the "decision support" layer of spec 06 §3 is absent.
3. **[MECHANICAL] Percent is always the label unit even when min/max are non-0–100.** `gauge/Gauge.tsx:52`: `percent = ratio×100`; `aria-valuetext` is always `${percent}%` (`Gauge.tsx:63`). For a gauge of 0–1000 CPU cores, 37.5% is shown while the raw value is hidden (`showValue` renders percent only) — the most honest number is not displayed by default. ProgressCircle has the same pattern (`progress-circle/ProgressCircle.tsx:38-40`).

### Recommendations

| #   | Action                                                                                                                | Value                     | Effort                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- | --------------------------- | --- |
| R12 | Add `tone?: 'positive'                                                                                                | 'negative'                | 'neutral'`(or`trendColor`) to Statistic, decoupling arrow from color | High (business correctness) | Low |
| R13 | Add `thresholds?: {from, to, status}[]` to Gauge/ProgressCircle for auto status (with manual override still possible) | Medium (decision support) | Low                                                                  |
| R14 | Gauge: default `format` to show raw value + unit (consumer-supplied), keep percent in `aria-valuetext` only           | Medium (honesty)          | Very low                                                             |

---

## Dimension 5: Color Intelligence

### Strengths

- **Semantic token system is exactly what spec 02 §5/§6 prescribes.** `tokens/src/light.ts:16-21` and `dark.ts:18-23`: danger/success/warning/info with dark-mode brightening (danger `#ef4444→#f87171`, success `#10b981→#34d399`, warning `#f59e0b→#fbbf24`, info `#3b82f6→#60a5fa`) — the "语义色深色提亮" rule is followed, with an explicit contrast comment on warning.foreground.
- **Dark surfaces are layered** (`dark.ts:7-10`: background `#0b1020` → surface `#111827` → surface.hover `#1f2937` → border `#1f2937`) — the spec 02 §6 hierarchy, not "black+white".
- **`--iris-warning-foreground` (`#451a03`, 6.97:1 on warning) exists as a token** — the design system _knows_ about the warning-on-light-text problem and solved it at the token level (the failure is in consumption, see issue 1).
- **Subtle tone backgrounds use `color-mix` with precomputed fallbacks** (`alert/Alert.tsx:72-75`, `badge/Badge.tsx:39-42`) — theme-aware tinting that adapts to dark mode automatically.
- **Scattered literals are rare and mostly defensible**: hex values appear only as CSS-var fallbacks (`var(--x, #10b981)`) or in ColorPicker (where raw color is the data). No per-component color palettes anywhere.
- **Primary adapts across themes**: dark primary `#818cf8` with `primary.foreground: #0b1020` (dark text on light-indigo) — contrast maintained in both modes.

### Issues

1. **[MECHANICAL] Badge solid-variant text fails contrast on every semantic tone.** `badge/Badge.tsx:31-34`: `color: 'var(--iris-primary-foreground, #fff)'` on all tones. Measured contrast vs white:
   - warning `#f59e0b`: **2.15:1** (needs 4.5:1 for 12px text) — and `--iris-warning-foreground` (6.97:1) is _right there, unused_
   - success `#10b981`: **2.54:1**; danger `#ef4444`: **3.76:1**; info `#3b82f6`: **3.68:1**

   Spec 02 §6 explicitly warns: "徽章文字色按渲染后底色亮度选黑/白（不能按语义色本身亮度——浅底白字是经典 bug）". This is that exact bug, shipped as a component default. Same pattern in `ribbon/Ribbon.tsx:59`, `result/Result.tsx:73` (30px glyph: warning circle 2.15:1 < 3:1 even for large text).

2. **[MECHANICAL] "info" tone is mapped to two different hues across the library.** `alert/Alert.tsx:9` and `banner/Banner.tsx:7` and `toast/ToastViewport.tsx:23-24, 32-33` map `info → --iris-primary` (indigo `#6366f1`); `result/Result.tsx:22` maps `info → --iris-info` (blue `#3b82f6`). An "info" toast is indigo, an "info" result is blue. The `--iris-info` token is defined and used exactly once. A user learning "info = blue" gets indigo elsewhere.
3. **[MECHANICAL] Focus rings hardcode primary's RGB.** `input/Input.tsx:55`, `combobox/Combobox.tsx:207`, `otp-input/OtpInput.tsx:232`, `tag-input/TagInput.tsx:119`: `rgba(99, 102, 241, 0.18)` (and `rgba(239, 68, 68, 0.18)` for danger in the same files). Under a custom skin/theme with a different primary (skins package exists), focus rings stay indigo — the token discipline breaks exactly where interactivity is communicated.
4. **[MECHANICAL] Dialog backdrop is a hardcoded `rgba(0,0,0,0.5)`** (`dialog/DialogContent.tsx:86`) — acceptable in dark mode, but in light themes the same 50% black is heavy; no token. Minor.
5. **[JUDGMENT] Solid selected-option fill in Select** (Dimension 1 #5) also flips option text to `--iris-primary-foreground` — on a warning/danger-tinted theme, selected options inherit primary's foreground regardless of actual background.

### Recommendations

| #   | Action                                                                                                                                                        | Value                         | Effort   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------- |
| R15 | Badge/Result/Ribbon solid variants: pick text color by rendered-background luminance (or per-tone `--iris-*-foreground` tokens; warning token already exists) | **High (a11y, spec-cited)**   | Very low |
| R16 | Unify `info` → `--iris-info` in Alert/Banner/Toast (align with Result) or delete the token                                                                    | Medium (semantic consistency) | Trivial  |
| R17 | Tokenize focus rings: add `--iris-ring`/`--iris-ring-danger` (e.g. `color-mix(in srgb, var(--iris-primary) 18%, transparent)`) in 4 components                | Medium (skinning)             | Low      |
| R18 | Tokenize dialog backdrop (`--iris-backdrop`)                                                                                                                  | Low                           | Trivial  |

---

## Dimension 6: Component-Spec Adherence

_Spec numbers from `ui-specs/component-spec.md` + `tokens.json`; the library deliberately ships a denser scale (documented in `tokens/src/light.ts:44-46` "dense control scale for 28–34px controls"), so mismatches below are spec-vs-library, flagged as such._

### Strengths

- **Dialog behavior contract is fully met** (spec §4): backdrop click closes, Esc closes, focus trap, body scroll lock, `aria-modal` + auto-labelledby/describedby (`dialog/DialogContent.tsx:37-46, 67-98`).
- **Button loading contract met** (spec §1): spinner replaces leading icon, clicks suppressed, `aria-busy`, disabled + loading both gate `isInteractive` (`button/Button.tsx:72-77`).
- **Table covers spec §5 features**: fixed header (`TableHeader.tsx:91` surface bg), pinned columns, virtual scroll, numeric alignment _available_ via `col.align`, summary row, select-all. Date/currency formatting is delegated to i18n `formatNumber/formatDate` (core `i18n.ts:117-124`) — the "千分位/统一日期" requirement is one call away and locale-correct.
- **Input states are complete** (spec §2): default/hover/focus/disabled/error; readonly is forwarded (though unstyled, see below).

### Issues

1. **[MECHANICAL] Button height is not token-governed and matches no spec value.** `button/styles.ts:7` sets `line-height: 1.2`; `SIZE_STYLES` gives padding/font only. Computed heights: **sm ≈ 26px, md ≈ 31px (28.8 + 2px border), lg ≈ 43px** — spec §1 requires 40 (compact 36); the library's own control ladder is 28/34/40. The md button lands on no value in either system (between 28 and 34), and none of the three sizes hit spec. The Button is the **only** control not built on `--iris-control-height-*`.
2. **[MECHANICAL] Button radius 6 vs spec 8** (`button/styles.ts:11` uses `--iris-radius-md`=6). Also, the radius ladder is 2/6/12 but Card/Dialog/Calendar/Alert all use `md` (6) for large surfaces — `radius-lg` (12) is used **twice** in the entire primitives tree; spec wants Card at 12.
3. **[MECHANICAL] Card metrics deviate from spec §3**: padding `md` = 12px (token `padding.md`) vs spec 20 (compact 16); radius 6 vs 12; shadow `--iris-shadow-md` (`0 4px 6px -1px/0.1`) vs spec level 1 (`0 2 8 rgba(0,0,0,0.06)`).
4. **[MECHANICAL] Dialog padding 20 vs spec 24** (`dialog/DialogContent.tsx:111` uses `--iris-padding-lg`=20); **no width presets** — spec §4: 560 (420 small / 720 large); component has only `maxWidth: 90vw` (line 112).
5. **[MECHANICAL] Drawer default width 320 vs spec 480** (`drawer/Drawer.tsx:37`).
6. **[MECHANICAL] Table row height is content-derived** (`table/styles.ts:20`: cell padding `8px 12px`) vs spec §5 row height 48 (compact 40). No row-height prop at all.
7. **[MECHANICAL] Input md height 34 vs spec 40** (spec §2). This one is the library's own documented dense-scale choice (34 is its md token); it is _internally_ consistent — flagging as spec deviation, not bug. Same for Select/Combobox/DatePicker md (34).
8. **[MECHANICAL] Input `readonly` has no visual state** — `input/Input.tsx` renders it identically to normal (spec §2 lists readonly as a required state); no `data-state="readonly"`, no muted/solid-bg treatment.

### Recommendations

| #   | Action                                                                                                                                                                                      | Value                                   | Effort                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- | ------ | --- |
| R19 | Build Button on `--iris-control-height-*` (sm:28/md:34/lg:40 is the library's own ladder) so md≈34, and document the divergence from the 40px spec in one place                             | High (consistency + predictable layout) | Low                                                        |
| R20 | Card: align with spec (padding 20/radius 12/shadow level 1) **or** bump spec-visible tokens (`radius-lg` adoption) — the current state matches neither spec nor the token ladder's top tier | Medium                                  | Low                                                        |
| R21 | Dialog: add `size="sm                                                                                                                                                                       | md                                      | lg"` preset (420/560/720) + padding 24; Drawer default 480 | Medium | Low |
| R22 | Table: add `rowHeight` (default 48, compact 40) — also stabilizes virtual scrolling math                                                                                                    | Medium                                  | Low-Medium                                                 |
| R23 | Input: `data-state="readonly"` + surface-bg styling                                                                                                                                         | Low                                     | Very low                                                   |

---

## Global Prioritized Recommendations (value/effort)

| Rank | ID          | Action                                                                         | Why                                                                                          |
| ---- | ----------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1    | R15         | Badge/Result solid-text contrast fix (luminance-based or `-foreground` tokens) | Accessibility failure + spec 02 §6 explicitly calls out this exact bug; token already exists |
| 2    | R1          | Button/SplitButton `danger` variant                                            | Destructive-action semantics are unrepresentable; spec §1 mandates it                        |
| 3    | R19         | Button heights from control-height tokens                                      | Only control outside the token ladder; affects every screen                                  |
| 4    | R12         | Statistic trend tone decoupled from direction                                  | Business-correctness (cost-up must not be green)                                             |
| 5    | R10         | Retry affordance + humane empty/error defaults (Table/Tree/List)               | Spec §7 + emotional design; high consumer impact                                             |
| 6    | R16         | Unify `info` → `--iris-info`                                                   | Trivial; removes a real cross-component inconsistency                                        |
| 7    | R2/R3       | Select empty message; Table selected-count bar                                 | Spec-mandated affordances missing                                                            |
| 8    | R17         | Tokenize focus rings                                                           | Skinning correctness across the skins package                                                |
| 9    | R7          | Card `hover` — implement or remove                                             | Dead API trap                                                                                |
| 10   | R20/R21/R22 | Card/Dialog/Drawer/Table spec dimensions                                       | Mechanical alignment with the published spec                                                 |

---

## Notable Strengths Worth Preserving (evidence)

- **Token discipline**: hex literals appear only as CSS-var fallbacks; charts are token-driven (`plugin-charts/src/core/series.ts:31-38`); dark-mode semantic brightening is implemented and commented (`tokens/src/dark.ts:18-23`).
- **State-complete complex components**: Tree and Table both implement loading/error/empty with precedence and custom-slot props (`table/Table.tsx:1082-1096`, `tree/Tree.tsx:35-41`) — this is the state coverage most libraries miss.
- **Form-family consistency** (Input/Select/Combobox/DatePicker/TimePicker share sizes, borders, rings, disabled/invalid treatment) — a genuine cognitive-load win.
- **Honest data rendering** — clamping, ARIA meter/progressbar semantics, and correct indeterminate handling (`progress/Progress.tsx:43-48`) show a library that respects the difference between showing data and decorating it.
- **Reduced-motion and a11y hygiene** (skeleton/spinner media queries, focus traps, `aria-live` on spinner, alert role semantics, safe-area insets) — the emotional-design layer is engineered, not decorative.
