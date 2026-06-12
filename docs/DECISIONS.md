# DECISIONS (ADRs)

> Architecture Decision Records, append-only. Newest first. One ADR per significant/irreversible choice.

## ADR-006 — color-mix fallback via source-order cascade + derived tokens

日期: 2026-06 · 决策: add `--iris-{semantic}-subtle` (derived in `themeCssVarEntries` from color over background) and use a static longhand fallback BEFORE the color-mix shorthand in components. · 原因: legacy WebViews lack color-mix; needed a fallback with ZERO modern regression and no hand-authored values. · 影响: theming contract gains `-subtle` vars; tonal surfaces degrade gracefully. · 替代方案: class migration (heavier); accept degradation (rejected — was a named requirement).

## ADR-005 — tree virtualization gated on `!hasDetail`

日期: 2026-06 · 决策: virtualize tree rows (uniform height) but fall back to non-virtual when `renderDetail` is set (variable height). · 原因: closes the "v1 non-virtualized tree" limit safely. · 影响: all 4 Tables window flat+tree; Solid/Svelte gained a virtual path. · 替代方案: full variable-height virtualization (deferred — complexity > value).

## ADR-004 — native-bridge registries (file-save / clipboard)

日期: 2026-06 · 决策: core `setXHandler` + `doX(): boolean` (return false to decline → web default). · 原因: desktop/mobile shells need native save/clipboard; one host hook beats per-component wiring. · 影响: Table export + CopyButton consult the registry. · 替代方案: per-component callback props (kept `onCopy` as a secondary hook).

## ADR-003 — touch-DnD reuses in-repo `useDrag`, not an external gesture lib

日期: 2026-06 · 决策: build `createSortable` in core + reuse each adapter's pointer primitive. · 原因: dnd-kit/@use-gesture are single-framework → break the one-core-4-adapters model. · 影响: zero new deps; consistent across frameworks. · 替代方案: SortableJS/interact.js (imperative, fights the controlled-store model).

## ADR-002 — logic sinks into framework-agnostic core controllers

日期: earlier · 决策: selection/roving/data-view/data-source/admin-shell/sortable live in `@iris-ui/core`; adapters are thin bindings. · 原因: de-duplicate 4 frameworks; single source of behavior. · 影响: new behavior = core controller + 4 bridges. · 替代方案: per-framework logic (rejected — drift).

## ADR-001 — 4-framework parity over a shared core

日期: project inception · 决策: identical component names/semantics across React/Vue/Solid/Svelte. · 原因: differentiation + AI-native manifest. · 影响: every feature ships ×4. · 替代方案: single-framework (rejected).
