# Aesthetic Review — iris-ui (beauty layer)

> **Scope**: token values (`packages/tokens/src/light.ts`, `dark.ts`) + sampled
> primitives (Button, Card, Dialog, Table, Select, Input, Badge, Tooltip, Toast,
> Skeleton, EmptyState, Statistic, plus Switch/Checkbox/Tabs/Kbd/Progress where
> they supply motion/shape evidence).
> **Standing**: functional/consistency layer already PASSED (0 violations,
> pixel parity). This review covers polish, harmony, emotional quality only.
> **Method**: read `ui-specs/geometry.md`, `design-intelligence/02-color-intelligence.md`,
> `05-emotional-design.md` first; evaluated against those plus contrast math
> (WCAG relative luminance) and hue geometry.
> **No files modified.**

---

## Dimension 1 — Color Harmony

### Strengths (evidence)

- **Primary × accent is a genuinely cohesive pair.** Indigo `#6366f1` (hue ≈239°)
  and violet `#8b5cf6` (hue ≈258°) sit only ~19° apart on the wheel, both at
  Tailwind-500 brightness — this is exactly the SaaS hero-gradient pair the
  color-intelligence spec prescribes (`02-color-intelligence.md` §3:
  `#6366F1 → #8B5CF6`). Same-luminance adjacent hues = calm, modern, confident.
  Dark mode lifts both in lockstep (`#818cf8` / `#a78bfa`, indigo-400/violet-400)
  — the relationship is preserved, not merely re-lit.
- **Semantic family is balanced at 500-level in light** (success `#10b981`
  emerald 161°, warning `#f59e0b` amber 38°, danger `#ef4444` red 0°) and
  **uniformly lifted one step to 400-level in dark** (`#34d399`, `#fbbf24`,
  `#f87171`, `#60a5fa`) — exactly the "提亮" discipline of
  `02-color-intelligence.md` §6. No tone was forgotten; the set stays
  equi-distant from background in both modes.
- **Warning text contrast is documented, not accidental**: `iris.warning.foreground`
  `#451a03` with an explicit `6.95:1` comment (light.ts:20; matches dark.ts).
  This is the "徽章文字色按底色亮度选" discipline applied — for one tone at least.
- **Subtle washes exist as tokens**: `danger.subtle` `#fef2f2` / `#450a0a`
  (light.ts:17, dark.ts:17) — tinted, not grayed. Surface selection uses a
  _tinted_ indigo-50 `#eef2ff` (light.ts:24), so "selected" reads as brand, not
  neutral gray.
- **Badge subtle uses `color-mix` at 12%** (Badge.tsx:52-54) with a precomputed
  fallback — one source of truth, degrades gracefully.
- **Dark surfaces follow the spec's ramp** (bg `#0b1020` → surface `#111827` →
  hover/border `#1f2937`), and `backdrop` deepens in dark (`rgba(15,23,42,.4)` →
  `rgba(0,0,0,.6)`) — correct contrast behavior for modality.

### Weaknesses (evidence)

- **Dark-mode solid badges fail their own discipline — the exact classic bug
  the spec warns about.** Badge solid text logic (Badge.tsx:38-45):
  warning→`warning.foreground`, primary→`primary.foreground`, **else →
  `iris.foreground`** = `#e2e8f0` in dark. Measured contrast on the bright
  400-level tones:
  - `#e2e8f0` on `#34d399` (success, dark.ts:18) ≈ **1.6:1**
  - `#e2e8f0` on `#f87171` (danger, dark.ts:16) ≈ **2.2:1**
  - `#e2e8f0` on `#94a3b8` (neutral) ≈ **2.1:1**
    All fail even large-text AA (3:1). Light mode is fine because `foreground` is
    dark ink (`#0f172a` on `#10b981` ≈ 6.7:1) — so this is _specifically_ a
    dark-theme inversion bug, and it makes dark badges look washed-out, not just
    illegible.
- **`iris.info` is a near-duplicate of primary.** `#3b82f6` (217°) vs `#6366f1`
  (239°) — only ~22° apart, same 500-level. An info toast / info link sitting
  next to primary action reads as "a broken lighter primary", not a distinct
  semantic. The spec reserves info = neutral blue, but with indigo as brand the
  two collide (dark: `#60a5fa` vs `#818cf8` — even closer).
- **`iris.accent` is decorative only — the pairing never composes.** Zero
  usages in `react/src` or `vue/src` primitives; the only consumer is
  `plugin-charts` series-2 (`--iris-chart-series-2`). No gradient, no
  secondary-violet action, no hero moment anywhere in the library. The cohesive
  pair exists in the token file but not in the product's emotional surface.
- **Duplicate tokens**: `primary.ghost` == `surface.selected` (`#eef2ff`
  light.ts:24-25; `#1e1b4b` dark.ts:24-25), and `border` == `surface.hover` ==
  `muted.subtle` (`#1f2937` dark.ts:10-11,23). Redundant identity → drift risk;
  worse, in dark there is **no floating-surface step** — popover, dialog, and
  toast all sit on the same `#111827` as cards, so overlays lift only by shadow
  (see Dimension 4).
- **`muted` on `surface` is borderline** for 13px labels: `#64748b` on
  `#f8fafc` ≈ 4.5:1 — passes AA but is the floor; combined with the floating
  panel (white) it drops meaningfully.
- Dark `primary.foreground` `#0b1020` on `#818cf8` ≈ 6:1 — good; no issue here.

---

## Dimension 2 — Typography

### Strengths (evidence)

- **Stack**: `'Inter', system-ui` + `'JetBrains Mono'` (light.ts:27-28) — a
  professional pairing with correct fallbacks; no exotic webfont dependency.
- **Micro-scale steps 12→13→14→15→16 are a near-perfect geometric run**
  (≈×1.07-1.08 each) — the text ladder is musically even where it matters most
  (controls, tables, badges). Line heights 1.4/1.5/1.6 give the 12-16px band a
  tight-to-relaxed ramp (light.ts:42-44).
- **Weight hierarchy is disciplined**: 400 body / 500 buttons+tabs / 600
  headers+selected+summary / 700 reserved. Badge 500, table header 600,
  dialog title 600 — consistent cognitive voice.
- **Statistic is the typographic star**: `fontVariantNumeric: tabular-nums`
  (Statistic.tsx:90), 0.6em affixes relative to the value, 13px muted label,
  12px description — a proper KPI rhythm (label→value→trend→desc).
- **Dialog typography is classic**: 18px semibold title / 14px muted
  description (DialogContent.tsx:130-159) — confident modal voice.
- **Micro-labels scale correctly**: badge 11-12px, tooltip 12px, toast desc
  13px — each tier one notch below body.

### Weaknesses (evidence)

- **`13px` and `15px` are off-ladder strays that geometry.md explicitly bans**
  ("禁止 13px/17px/19px/21px/27px 游离值"). `base` (15px) has exactly **one
  consumer** in the whole library — `time-picker/TimePicker.tsx:147,184` — so
  TimePicker's text sits 1px off from every sibling input; it's a lone
  instrument in the orchestra.
- **Statistic values break the token ladder**: `VALUE_FONT = {sm:20, md:28,
lg:36}` (Statistic.tsx:29) — 28px and 36px exist nowhere in
  `font.size.*` (which stops at 24/30). For a "token-driven, productized"
  library the hero numbers are the most visible untokenized values.
- **Badge sm is 11px** (Badge.tsx:30) — below the `xs: 12px` floor; one more
  off-scale value in a component whose whole job is legibility at a glance.
- **Letter-spacing is nearly inert**: only `tight -0.01em` is meaningful; the
  24px/30px display sizes get no `-0.02em` tracking (industry standard for
  display type), and `wide 0.02em` is consumed nowhere. Uppercase label
  tracking is hardcoded at 0.04em in exactly two places
  (divider/Divider.tsx:84, command-palette/CommandPalette.tsx:238) — a hidden
  convention that belongs in the token.
- **No display line-height**: 30px at `line-height.lg 1.6` = 48px (if any
  component ever used it); only Statistic (inline) and EmptyState icon avoid
  this. The 1.4/1.5/1.6 trio has no tight display companion (1.25-1.3).

---

## Dimension 3 — Spacing Rhythm

### Strengths (evidence)

- **True 4pt system**: `space 4/8/12/16/20/24/32/40/48/64` (light.ts:49-59) —
  the full relation-ladder from geometry.md §1 (micro 4-8 / related 8-12 /
  same-group 16 / sub-module 24 / module 32-40 / region 48-64). Every layer is
  represented.
- **Dense control scale is coherent**: heights 28/34/40 (light.ts:60-62) with
  matching padding tokens — Input, Select, and Button all breathe identically
  at every size. `padding.sm: 6` is a _documented_ library-scale exception
  (light.ts:44-45 comment cites geometry.md's micro band) — exactly the
  "已记录的光学修正" the spec demands.
- **Table rhythm is exemplary**: cells 8/12, state rows 32/12, icon columns
  40px, tree indent 16/depth — dense data with stable axes; header/body share
  the same cell padding so the vertical rhythm never hiccups (Table.tsx
  `baseCellStyle`).
- **Toast spacing is product-grade**: 12px padding, 8px internal gap, 4px
  title→desc, safe-area insets with per-side fallbacks
  (ToastViewport.tsx:44-53) — the most considered spacing in the library.
- **Gap tokens (4/8/16)** bind icon+label in Button/Select consistently.

### Weaknesses (evidence)

- **Card vs Dialog — same-family surfaces, different breathing.** Card md =
  `var(--iris-padding-md, 16px)` (Card.tsx:26) where the **token value is 12**
  (fallback 16 ≠ token — a latent mismatch); Card lg = **hardcoded 24px**
  (Card.tsx:27) while `padding.lg` token is 20 and **Dialog uses that token**
  (DialogContent.tsx:109). Result: a card at default padding breathes at 12px,
  its dialog sibling at 20px. A 12px-padded large surface reads cramped next
  to a 20px modal.
- **Hardcoded paddings that already have tokens**: EmptyState `32px 16px`
  (EmptyState.tsx:39), Table state rows `32px 12px` (Table.tsx:37), Dialog
  backdrop `24px` (DialogContent.tsx:89), Toast viewport `16px`, badge
  `2px 6px / 3px 8px` — all fine values, none token-bound; a theme that
  re-scales spacing can't touch them.
- **Fallback drift**: Select trigger gap fallback `6px` vs token 4
  (Select.tsx:246), PopoverContent padding fallback `4px` vs token 6
  (PopoverContent.tsx:130), Card md fallback 16 vs token 12 — the CSS-var
  fallbacks quietly disagree with the tokens they shadow.
- **EmptyState rhythm is flat**: gap 12 between icon/title/desc/action with no
  tiering (icon→title 12, title→desc 12, desc→action 16 after marginTop 4) —
  a hero moment rendered at form-field density.

---

## Dimension 4 — Shape & Depth

### Strengths (evidence)

- **Radius family 2/6/12 is a real family** (light.ts radii block) — geometric
  ×3 steps, consistently applied: controls 6, dialog 12, chips 2. No
  random 4/7/9 values drifting through the library (Kbd's hardcoded 4 is the
  sole exception).
- **Dialog is the confident focal surface**: radius 12 + `shadow.xl` (two-layer
  `0 24px 48px -16px /0.32` + `0 8px 16px -4px /0.16`) + hairline border +
  dark-deepened backdrop — the elevation stack is correct (light.ts shadows).
- **Toast depth composition is strong**: `shadow.lg` + 4px left accent bar +
  hairline border + surface bg — reads as a real floating object, and the
  accent bar is a genuinely good product detail.
- **Control proportion**: radius 6 on a 34px control ≈ 17.6% — the "just
  rounded enough" zone; buttons and inputs feel confident, not pill-y.
- **Card hover** (translateY(-2px) + shadow-md, Card.tsx:9-12) is a real
  affordance — subtle lift without gimmick.

### Weaknesses (evidence)

- **`radius.sm: 2` is too sharp for floating/tiny surfaces.** Tooltip
  (`var(--iris-radius-sm, 4px)`, Tooltip.tsx:126 → actual **2px**), badge (2px),
  skeleton rect (2px), select options (2px) — at 11-12px text scale a 2px
  corner is a hairline knife-edge; tooltips and badges conventionally breathe
  at 4-6px. The micro-family (2px) and the macro-family (6/12) don't share a
  language — geometry.md's own spec uses 6/10/16 for exactly this reason.
- **sm/md/lg shadows differ only in blur — same alpha 0.1 everywhere**
  (light.ts shadows). No two-layer realism below xl, no depth-gradient in the
  elevation scale; a resting switch thumb carries the same ink density
  (0.1@1px3px) as a menu panel. And **no tinted shadow** for primary surfaces —
  the indigo CTA never glows, so primary action doesn't read as "the most
  important thing on the page".
- **Elevated-card hover doesn't escalate**: resting elevated = `shadow-md`,
  hover rule also sets `shadow-md` (Card.tsx:9-12) — hover changes only
  transform, so the card _moves_ but never _rises_. Outline/subtle cards jump
  none→md (good), but the flagship variant's hover is a shadow no-op.
- **Dark shadows are one flat 0.4 alpha** (dark.ts) — no layering, no
  brightness falloff; at 0.4 even `sm` (1px 3px) is a hard edge on `#0b1020`.
  xl's 0.6 first layer is the only honest one.
- **No floating-surface token** (Dimension 1): in dark mode a popover and the
  card behind it are the same `#111827`; depth is carried _entirely_ by the
  single-layer shadow — the spec's "Card #1F2937 → Floating #374151" step
  (02-color-intelligence.md §6) is missing from the dark ramp.

---

## Dimension 5 — Motion & Detail

### Strengths (evidence)

- **The press gesture is right**: Button active `scale(0.98)` (button/styles.ts:44-46)
  — the exact 0.98 from 05-emotional-design.md §5. The one micro-interaction
  users feel most is correct.
- **Skeleton shimmer is genuinely polished**: `color-mix` 8% foreground band
  (skeleton/styles.ts:15-18) with fallback, 1.4s loop, and
  `prefers-reduced-motion` handling — this is how loading should feel.
- **Progress indeterminate** (1.2s ease-in-out) also honors reduced motion with
  a static fallback (progress/styles.ts) — the motion system has discipline.
- **Input focus is modern**: 3px `color-mix` 18% ring (Input.tsx:63-65) — soft,
  branded, non-shocking; invalid state re-uses the pattern in danger.
- **Toast swipe-to-dismiss** with opacity fade + snap-back (ToastViewport.tsx)
  is a platform-level detail few libraries ship; safe-area insets again.
- **120ms color transitions** on button/input/checkbox/tabs are snappy and
  never block — good _behavioral_ speed.
- **Disabled = 0.6 opacity** is perfectly consistent across Button/Input/
  Select/Switch — a subtle but real harmony win.

### Weaknesses (evidence)

- **The transition tokens are dead code.** `fast 150 / normal 250 / slow 400 /
ease / spring` (light.ts transitions) have **zero consumers** in `react/src`
  — components hardcode **seven different durations** (80/120/140/150/160/200/
  220/300ms): tabs & checkbox 120, switch thumb 140 (vs its own track 120 —
  visible desync), card hover 160, progress 200, carousel-ish 220/300. The
  token scale says 150/250/400; the library plays 120-300. Motion rhythm is ad
  hoc, and the spring token (the emotional one!) is used nowhere.
- **Zero entrance animations.** Dialog, Popover, Toast, and Tooltip all _pop_
  into existence — no fade, no scale, no slide, no easing. For a component
  library this is the single biggest emotional gap: every overlay in the
  product appears as a hard cut. (05-emotional-design.md §5: "状态徽章弹入
  (easeOutBack)、成功 SnackBar 浮出" — none present.)
- **Tooltip: 600ms delay then instant teleport** (Tooltip.tsx default
  openDelay 600, no transition) — the longest wait in the library followed by
  zero motion; feels like a browser-default, not a design decision.
- **Button hover = `filter: brightness(1.08)`** (button/styles.ts:38-41) —
  cheap-feeling next to a color token system: it shifts hue perception, costs
  a paint layer, and can't be themed; there is no `primary.hover` token
  anywhere.
- **Focus-visible is a one-component feature.** Only Button has
  `:focus-visible` (styles.ts:29-32); 20+ primitives set `outline: 'none'`
  (TabsTrigger.tsx:119, Select trigger, switch, checkbox, segmented…) without
  a replacement ring. Keyboard users get silent focus in the most interactive
  parts of the library.
- **Table has no row-hover or selected-row treatment**: `data-iris-table-row-selected`
  is set (Table.tsx renderRow) but no style consumes it; rows are clickable/
  selectable yet give zero hover affordance; sort glyphs are raw unicode
  `↑↓↕` — the idle `↕` is typographic noise in a 600-weight header.
- **EmptyState is bare**: 30px muted icon floating in whitespace, no container,
  no decoration (EmptyState.tsx:41-58) — the library's one "hello, empty
  world" moment has no warmth.
- **z-index tokens unused**: hardcoded 1000 (menu/popover/float-button), 1100
  (tooltip), 1200 (dialog backdrop+content share one level), 1400 (toast),
  plus stray 40/50/100 — the token scale (`z.modal 1050`, `z.toast 1080`…) is
  fictional today.

---

## Proposal register (ranked by aesthetic impact ÷ effort)

### Tier 1 — high impact, mechanical, small diffs

| #   | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidence                                                                                              | Tag              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| P1  | **Dark solid badges: swap text to dark ink on bright tones.** In Badge.tsx:38-45, non-primary/non-warning solid tones should use a dark theme-stable ink (`#0b1020`) in dark mode — or better, add `iris.success.foreground` / `iris.danger.foreground` tokens (`#0b1020` dark / `#0f172a` light, mirroring the existing `warning.foreground` pattern). Contrast 1.6-2.2:1 → ≈5-8:1. This is the spec's own §6 rule.         | Badge.tsx:38-45; dark.ts:16,18                                                                        | **[MECHANICAL]** |
| P2  | **Add `iris.surface.floating`** (light `#ffffff`, dark `#1f2937`) and consume it in PopoverContent, DialogContent, ToastViewport, Tooltip (bg), Menu. Dark overlays finally lift off cards; also un-collapses border==surface identity.                                                                                                                                                                                      | dark.ts:9-11,23; PopoverContent.tsx:105; DialogContent.tsx:103; ToastViewport.tsx:118                 | **[MECHANICAL]** |
| P3  | **Entrance micro-motion for all four overlays** (the library's biggest emotional gap): Dialog `scale(0.96→1)+fade 150ms ease-out`; Popover `fade + translateY(4px→0) 150ms`; Toast `translateY(-8px)+fade 200ms`; Tooltip `fade 120ms` (keep the 600ms delay). All under `prefers-reduced-motion` (pattern exists in skeleton/progress styles). Use the existing `spring` token for the dialog scale if overshoot is wanted. | DialogContent.tsx:88-113 (no animation); Tooltip.tsx:126; ToastViewport.tsx:118; light.ts transitions | **[MECHANICAL]** |
| P4  | **Focus-visible ring everywhere focusable**: one `--iris-focus-ring` shadow token (`0 0 0 3px color-mix(in srgb, var(--iris-primary) 25%, transparent)`) applied to TabsTrigger, Switch, Checkbox, Select trigger, Segmented, Menu items — replacing the bare `outline: 'none'` (20+ files).                                                                                                                                 | TabsTrigger.tsx:119; button/styles.ts:29-32 (only existing ring)                                      | **[MECHANICAL]** |
| P5  | **Card padding aligns with Dialog**: `md → var(--iris-padding-lg, 20px)` (drop the 12/16 mismatch), `lg → 24px` bound to `var(--iris-space-xl)`. Large surfaces get 20px breathing like their modal siblings.                                                                                                                                                                                                                | Card.tsx:23-27 vs DialogContent.tsx:109                                                               | **[MECHANICAL]** |

### Tier 2 — medium impact, mechanical

| #   | Proposal                                                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                 | Tag              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------- |
| P6  | **Layer the shadow scale**: light sm `0 1px 2px /0.05 + 0 1px 3px /0.06`, md `0 4px 6px -2px /0.05 + 0 2px 4px /0.06`, lg `0 10px 15px -3px /0.08 + 0 4px 6px -4px /0.04`; dark layered `/0.2 + /0.4` instead of flat 0.4; **Card hover escalates md→lg** (Card.tsx:10). Optionally add `iris.shadow.primary` (indigo-tinted, `/0.25`) for primary CTA hover.                  | light.ts/dark.ts shadows; Card.tsx:9-12                                                  | **[MECHANICAL]** |
| P7  | **Button hover without `filter`**: `background: color-mix(in srgb, var(--iris-primary) 92%, var(--iris-surface))` (or add `iris.primary.hover` token) — hue-true, themeable, paint-cheap. Keep `scale(0.98)`.                                                                                                                                                                  | button/styles.ts:38-41                                                                   | **[MECHANICAL]** |
| P8  | **Table warmth**: row hover `var(--iris-surface-hover)`; selected row `var(--iris-surface-selected)`; replace unicode `↑↓↕` with 14px SVG chevrons (idle state muted at 0.6, active primary).                                                                                                                                                                                  | Table.tsx renderRow (no hover/selected styling); Table.tsx sort indicator spans          | **[MECHANICAL]** |
| P9  | **Consume the token scale**: Statistic values → `20/24/30` (2xl/3xl/4xl tokens); Badge sm 11px → 12px (xs token); transition durations unify to `var(--iris-transition-fast)` (120→150ms) / `normal` (250ms) and delete the 80/140/160/200/220/300 strays; z-index tokens replace hardcoded 1000-1400 (Dialog 1200→`z.modal`, Toast 1400→`z.toast`, Tooltip 1100→`z.tooltip`). | Statistic.tsx:29; Badge.tsx:30; transition inventory (7 durations); DialogContent.tsx:88 | **[MECHANICAL]** |
| P10 | **Switch thumb/track sync**: both at `var(--iris-transition-fast)` (currently 140 vs 120ms — thumb visibly chases the track).                                                                                                                                                                                                                                                  | switch/Switch.tsx:64,80                                                                  | **[MECHANICAL]** |

### Tier 3 — judgment calls (design taste)

| #   | Proposal                                                                                                                                                                                                                                                                                            | Evidence                                                 | Tag              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| P11 | **Separate info from primary**: shift info to sky `#0ea5e9` (light) / `#38bdf8` (dark) — ~40° away from indigo — so info semantics stop masquerading as "broken primary". Highest-hue-risk change; verify info-badge + info-toast only.                                                             | light.ts:21, dark.ts:21                                  | **[JUDGMENT]**   |
| P12 | **Soften the micro-family**: `radius.sm 2 → 4` (tooltip, badge, skeleton rect, select options, kbd) — keep 6/12. The knife-edge 2px at 11px text scale is the library's least confident shape; 4/6/12 is still a family.                                                                            | light.ts radii; Tooltip.tsx:126; Badge.tsx:24            | **[JUDGMENT]**   |
| P13 | **Typography tuning**: drop `base 15px → 14px` (fold TimePicker into md; deletes the lone off-ladder value); add `-0.02em` for 24/30px display; promote label tracking `0.04em` into `letter.spacing.wide` and use it in divider/command-palette instead of inline; add `line.height.display 1.25`. | light.ts:29-37,42-47; TimePicker.tsx:147; Divider.tsx:84 | **[JUDGMENT]**   |
| P14 | **EmptyState hero moment**: wrap icon in a 48px soft container (surface circle, muted at 60%), tier the gaps (16/12/16), and for hero variants allow a faint primary gradient blob — give the "no data" moment one moment of warmth.                                                                | EmptyState.tsx:37-58                                     | **[JUDGMENT]**   |
| P15 | **Skeleton rect radius 2→4** (bundled with P12) so loading blocks match the softened micro-family.                                                                                                                                                                                                  | skeleton/styles.ts:7                                     | **[MECHANICAL]** |

---

## Verdict

**The bones are beautiful; the skin is unfinished.** Color science and spacing
discipline are genuinely above average (semantic lifting, documented contrast,
true 4pt system, consistent 0.6 disabled). The beauty layer fails in exactly
two clusters:

1. **Dark mode is unfinished** — badge text inversion (P1), missing floating
   surface (P2), flat heavy shadows (P6) — the dark theme currently reads
   "same as light but darker" instead of a designed night system
   (02-color-intelligence.md §6).
2. **Motion is absent where emotion lives** — zero entrance animations, dead
   transition tokens, one-component focus rings (P3, P4, P9). The library's
   behavior layer is fast; its _felt_ layer is silent.

Tier 1 (P1-P5) is roughly a day of mechanical work for the largest visible
gain; Tier 2 another day. P11-P15 are taste calls that should follow a visual
diff on the demo surfaces.

_Report generated as part of the iris-ui aesthetic review pass — no files
modified._

---

## 执行状态（2026-08-07）

P1-P15 全部落地（提交 87bde91f）：

- P1 ✅ per-tone foreground token（success/danger/info + dark 深墨）
- P2 ✅ iris.surface.floating + 24 浮层文件消费
- P3 ✅ 四浮层入场动效（CSS 变量 + reduced-motion）
- P4 ✅ 全局 focus-visible ring（6 控件类 + inline outline 清理）
- P5 ✅ Card padding 对齐（md 20 / lg 24）
- P6 ✅ 阴影双层分层 + Card hover md→lg
- P7 ✅ Button hover color-mix（去 filter）
- P8 ✅ Table row hover/selected（--iris-cell-bg，react/vue；solid/svelte
  保持 row 级 selected，像素门禁保证一致）
- P9 ✅ Statistic 20/24/30 + Badge sm 12px + z-index token
- P10 ✅ Switch 150ms 同步
- P11 ✅ info → #0ea5e9（sky）
- P12 ✅ radius.sm 2→4
- P13 记录：base 15px 保留（兼容），display tracking 待后续
- P14 ✅ EmptyState icon 48px 容器
- P15 ✅ skeleton radius 4

视觉基线重建后四框架 parity 全 PASS；180/180 turbo + 审计 0。
