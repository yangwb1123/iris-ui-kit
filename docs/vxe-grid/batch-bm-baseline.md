Baseline written: **`/home/u1/iris-ui/docs/vxe-grid/batch-bm-baseline.md`** (44 lines) — the only file created (`git status` shows only the pre-existing BL-stage `M` entries plus the new `??` baseline; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code — batch AZ/BB annotation machinery, `useFloating`/`useDismiss` APIs, context-menu virtual-anchor precedent):

- **Prop** — `notePopover?: boolean` at props.ts after `cellNote` (:504), before `annotationEditing` (:506). Additive, default off; off = byte-identical current behavior.
- **Title replacement (one throat)** — `cellTitle` (:5479, sole call site :5830) gains a `notePopover` param; only the note branch becomes `undefined` — compare/sparkline/tooltipConfig branches and the editing exemption untouched.
- **Hover state** — single table-level `noteHover { cellKey, text } | null` + `noteHoverAnchorRef` virtual anchor (context-menu rect-snapshot shape verbatim), handlers placed after the annotate block (~:3298); cell div gets a conditional `{ onMouseEnter, onMouseLeave }` spread only when `notePopover && note` — zero cost when off.
- **Panel** — module-level `TableNotePopover` after `TableAnnotatePanel` (~~:1448): useFloating virtual anchor (placement `top`, offset 8, flip/shift on) + useDismiss (Esc/outside) + capture scroll-close + portal; `data-iris-note-popover` + `data-iris-note-cell`, `role="tooltip"`, `pre-wrap`, `pointerEvents: none` (pure display like the native title); no seq token (documented). Rendered after the annotate panel (~~:8166).
- **Zero** i18n (content-only), zero core, propCount 152→153.

**8 fiats** for gate arbitration (title replaced only on noted cells; mouseleave matches native-title semantics; snapshot anchor; editing cells still preview; placement divergence from annotate panel justified as tooltip semantics; no keyboard open — 1:1 replacement of non-ARIA title).

**File map**: props.ts +1 · Table.tsx 5 touch points · NEW note-popover.test.tsx · comparison doc 3 sites (:66/:281/:339) · manifest regenerated · zero: core/types/styles/i18n/vue/solid/svelte.

**Test plan**: ~11 cases, spec-mandated pair first — 渲染 (hover → bubble + text, title replaced, badge intact) and 关闭 (mouseleave / Esc / outside pointerdown / scroll), plus no-prop no-op, dynamic cellNote, A→B follow, pre-wrap, compare-priority.
