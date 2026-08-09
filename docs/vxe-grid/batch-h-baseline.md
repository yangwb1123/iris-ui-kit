Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-h-baseline.md` (180 lines). No source files modified — the only change is the new doc (pre-existing `.vinxi` build artifacts untouched).

**Key findings baked in:**

1. **vxe semantics** (grounded in `/tmp/vxe-grid/package/types`):
   - Select edit-render — `column.d.ts` L261 `EditRender` (`name`/`options`/`optionProps`/`events`); the vxe select editor commits **on change** with the option's **typed** value (numbers stay numbers), unlike text editors (blur/Enter).
   - Context menu — `ContextMenuEventParams` (table.d.ts L6699) carries `row/column/rowIndex/columnIndex/$event`; `MenuFirstOption` (L7257) uses `code`/`name`/`disabled`; grid exposes `contextMenu` config + `onContextMenu` event.
   - Checkbox reserve — `CheckboxConfig.reserve` (L1455): keep checked state across data refresh; header select-all is current-page scoped.

2. **Proposed iris design (additive, react only):**
   - **a)** `IrisTableEditor` gains `'select'` + `IrisTableColumn.editOptions`; the editing render branches to a **native `<select>`** (same `--iris-*` styling as the input, jsdom-testable), change commits immediately, Enter/blur commit, Escape cancels; `coerceValue` matches options by string comparison and returns the **typed** option value so number options stay numbers; validators see the coerced value; synthetic option prevents data loss when the current value matches no option.
   - **b)** `contextMenu?: { items(params), onSelect(key, params) }` — right-click on **leaf body cells only** (header/seq/selection/expand cells excluded per request) opens a menu at the cursor via `useFloating` with a virtual anchor (`getBoundingClientRect → {x, y, width: 0, height: 0}`, cast into the `RefObject<HTMLElement>` slot — no primitive changes); Escape/outside-pointerdown via `useDismiss` + a capture-phase scroll-close listener; selection closes then fires `onSelect`. **Decision: self-drawn** (`useFloating` + `useDismiss`, the same building blocks `IrisMenuContent` uses) — `IrisMenu` is trigger-DOM-anchored and can't host a coordinate-based menu without faking a trigger.
   - **c) Cross-page selection VERIFIED already working** — `selModel` is created once in a ref; proxy page loads only `setLiveData(next)`; nothing resets `displaySelection`; header select-all is page-scoped and the handle `selectAll` unions (batch F). No fix needed — documented as "iris always reserves" (vxe `reserve` is our default; `showReserveStatus` out of scope). The real gap is **test coverage** (no proxy × selection test exists).

3. **File map** — `types.ts` + `props.ts` + `Table.tsx` (~60 additive lines) + new `ContextMenu.tsx` (~90 lines) + 3 new test files; `useFloating`/`useDismiss`/`menu/`/`core/`/`i18n` unchanged.

4. **27-case test plan** (11 select editor, 11 context menu, 5 cross-page) + 8 open questions for the adapt phase (synthetic option, empty `editOptions`, scroll-close granularity, right-click during editing, `visibleMethod`, autofocus, `showReserveStatus`, portal target).
