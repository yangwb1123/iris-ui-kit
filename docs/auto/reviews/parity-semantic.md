# Cross-framework semantic audit

Read-only audit; no repository files were modified. `check:parity:print` is useful for triage, but prop-count divergence alone was not treated as a defect.

## Findings

### 1. [P1] React exposes a substantially richer `IrisTable`

**Evidence:** `packages/manifest/manifest.json:47376-47795` reports React 208 props vs Vue 68, Solid 88, and Svelte 86, with many React-only capabilities. Examples: `annotations`/`annotationEditing` (`packages/react/src/primitives/table/props/query.ts:159-192`), `cellClassName` (`.../props/layout.ts:113-120`), `headerStats` (`.../props/advanced.ts:235-237`), and `rangeFill`/`cellDrag` (`.../props/layout.ts:55-68`).

**Symptom:** Consumers cannot port annotation, range editing, autosave, history, refresh, and other table workflows between adapters.

**Minimal fix:** Move feature logic into shared core/plugin controllers and add thin adapter bridges. If React-only is intentional, split/document it as a framework-specific capability and exclude it from parity claims.

**Test:** Cross-framework table capability matrix covering `rangeFill`, annotations, autosave, and version history.

---

### 2. [P1] Portaled nested menus dismiss incorrectly

**Evidence:** React/Solid/Svelte dismiss only excludes trigger/content refs (`packages/react/src/primitives/menu/MenuContent.tsx:53-58`, `packages/solid/src/primitives/menu/IrisMenuContent.tsx:31-35`, `packages/svelte/src/primitives/menu/IrisMenuContent.svelte:27-31`). React submenus are portaled (`packages/react/src/primitives/menu/MenuSub.tsx:208-210`). Vue protects the entire menu tree with `excludePredicate` and `data-iris-menu-tree` (`packages/vue/src/primitives/menu/MenuContent.ts:42-52`, `packages/vue/src/primitives/menu/MenuSub.ts:278-281`).

**Symptom:** Pointer interaction inside a portaled submenu can be interpreted as an outside click and close the root menu.

**Minimal fix:** Add a shared menu-tree marker/predicate to all adapters.

**Test:** Open a nested submenu, pointer down on its portaled content, and assert the root remains open.

---

### 3. [P1] Svelte `IrisList` selects keyboard items twice

**Evidence:** The `<ul>` handles keydown (`packages/svelte/src/primitives/list/IrisList.svelte:214-223`, `:159-170`), while each `<li>` also handles Enter/Space without stopping propagation (`:244-259`).

**Symptom:** Enter/Space invokes `select` twice. In multi-select mode the value may toggle on and immediately off.

**Minimal fix:** Keep keyboard selection at the list level, or stop propagation after item-level handling.

**Test:** Dispatch Enter on a focused option; assert one callback and the expected selected state.

---

### 4. [P1] Svelte `IrisColorPicker` emits on initialization

**Evidence:** Its reactive synchronization effect calls `onValueChange` (`packages/svelte/src/primitives/color-picker/IrisColorPicker.svelte:52-68`). React only emits from `commit` (`packages/react/src/primitives/color-picker/ColorPicker.tsx:93-97`). The Svelte test currently clears the spy after mount (`packages/svelte/src/primitives/color-picker/IrisColorPicker.test.ts:77-84`).

**Symptom:** Mounting or externally updating the picker emits a change without user interaction.

**Minimal fix:** Separate external synchronization from user commits; invoke the callback only from interaction paths.

**Test:** Assert no callback on mount or controlled prop update, and exactly one callback per user edit.

---

### 5. [P1] Tree single-selection semantics differ

**Evidence:** React keeps a selected node selected (`packages/react/src/primitives/tree/Tree.tsx:318-327`); Vue and Svelte do the same (`packages/vue/src/primitives/tree/Tree.ts:260-272`, `packages/svelte/src/primitives/tree/IrisTree.svelte:254-265`). Solid toggles the selected node off (`packages/solid/src/primitives/tree/IrisTree.tsx:248-259`).

**Symptom:** Clicking the same node twice clears selection only in Solid.

**Minimal fix:** Align single mode with `set([id])`, or standardize the behavior through a shared selection model.

**Test:** Click/activate the same single-select node twice in every adapter.

---

### 6. [P1] Tree data-state precedence and SWR behavior diverge

**Evidence:** Core defines `error → loading → empty → content` and `hasContent` stale-while-revalidate behavior (`packages/core/src/data-state.ts:17-40`). Vue passes `hasContent` (`packages/vue/src/primitives/tree/Tree.ts:94-101`), but React omits it (`packages/react/src/primitives/tree/Tree.tsx:115-119`), and Solid/Svelte replace content with state nodes (`packages/solid/src/primitives/tree/IrisTree.tsx:392-423`, `packages/svelte/src/primitives/tree/IrisTree.svelte:315-343`). Svelte checks loading before error, reversing core precedence.

**Symptom:** Existing nodes disappear during refresh, and simultaneous `loading` + `error` renders differently by framework.

**Minimal fix:** Resolve top-level state through the shared core function and consistently pass `hasContent`.

**Test:** Matrix-test empty/content revalidation and `{ loading: true, error: true }`.

---

### 7. [P2] Alpha color-picking capability is missing in Solid/Svelte

**Evidence:** React and Vue expose and render `showAlpha` (`packages/react/src/primitives/color-picker/ColorPicker.tsx:5-16,228-234`, `packages/vue/src/primitives/color-picker/ColorPicker.ts:17-22,264-272`). Solid’s public props have no alpha option (`packages/solid/src/primitives/color-picker/IrisColorPicker.tsx:5-11`), and Svelte has neither `showAlpha` nor `defaultValue` (`packages/svelte/src/primitives/color-picker/IrisColorPicker.svelte:17-24`).

**Symptom:** An alpha-enabled color-picker scenario cannot be expressed consistently across adapters.

**Minimal fix:** Add shared alpha state/rendering and adapter props; align uncontrolled initialization.

**Test:** Render alpha controls and commit an RGBA value in all four adapters.

---

### 8. [P2] Menu selection cannot consistently opt out of closing

**Evidence:** React has `keepOpen` (`packages/react/src/primitives/menu/MenuItem.tsx:5-10,26-35`), Solid has `closeOnSelect` (`packages/solid/src/primitives/menu/IrisMenuItem.tsx:4-23`), while Vue and Svelte always close (`packages/vue/src/primitives/menu/MenuItem.ts:12-33`, `packages/svelte/src/primitives/menu/IrisMenuItem.svelte:4-20`). Solid/Svelte also close after user handlers run, even if they call `preventDefault`.

**Symptom:** The same “select without dismissing” action behaves differently by framework.

**Minimal fix:** Add a canonical close policy (`closeOnSelect` or equivalent) and honor cancellation consistently.

**Test:** Verify default close, opt-out close, and `preventDefault()` for click and keyboard selection.

---

### 9. [P2] Vue `IrisList` is controlled-only in practice

**Evidence:** Vue has only `modelValue` (`packages/vue/src/primitives/list/List.ts:40-58`) and derives selection directly from it (`:89-109`); no internal selection is maintained. React and Solid support defaults/internal state (`packages/react/src/primitives/list/List.tsx:74-114`, `packages/solid/src/primitives/list/IrisList.tsx:80-99`).

**Symptom:** Without `v-model`, Vue emits a selection event but `aria-selected` never updates.

**Minimal fix:** Add an internal selection ref with controlled synchronization, or explicitly document controlled-only behavior and align the other adapters.

**Test:** Mount without `modelValue`, click an option, and assert its selected state changes.

---

### 10. [P2] Tour uncontrolled behavior exists only in React

**Evidence:** React supports `defaultOpen` and internal state (`packages/react/src/primitives/tour/Tour.tsx:11-16,56-70`). Vue exposes only `open` (`packages/vue/src/primitives/tour/Tour.ts:45-53`); Solid and Svelte default `open` to false without internal close state (`packages/solid/src/primitives/tour/IrisTour.tsx:46-62`, `packages/svelte/src/primitives/tour/IrisTour.svelte:28-48,81-84`).

**Symptom:** The same tour opened without parent state is uncontrolled in React but controlled-only elsewhere.

**Minimal fix:** Add `defaultOpen`/internal state everywhere, or remove React’s uncontrolled mode and document controlled-only semantics.

**Test:** Open with default state and invoke skip/finish without a parent update.

---

### 11. [P2] Exported Svelte `useDataState` is not reactive

**Evidence:** The hook creates a `readable` store and evaluates `input()` only in its start callback (`packages/svelte/src/motion/useDataState.ts:18-25`). Vue and Solid derive reactively (`packages/vue/src/motion/useDataState.ts:32-43`, `packages/solid/src/motion/useDataState.ts:22-34`).

**Symptom:** Updating the getter’s underlying props does not update the Svelte store after subscription.

**Minimal fix:** Accept a reactive Svelte store as input and derive from it, or implement the bridge inside a rune-aware component context.

**Test:** Change `loading`/`error` after mount and assert the returned state changes.

---

### 12. [P2/A11y] Breadcrumb current-item inference differs

**Evidence:** React and Vue automatically mark the last child (`packages/react/src/primitives/breadcrumb/Breadcrumb.tsx:41-52`, `packages/vue/src/primitives/breadcrumb/Breadcrumb.ts:47-63`). Solid explicitly requires `current` (`packages/solid/src/primitives/breadcrumb/Breadcrumb.tsx:13-17`, `.../BreadcrumbItem.tsx:3-7`), while Svelte renders children unchanged (`packages/svelte/src/primitives/breadcrumb/Breadcrumb.svelte:23-26`).

**Symptom:** The same last breadcrumb with `href` is a link without `aria-current` in Solid/Svelte.

**Minimal fix:** Either implement one canonical inference policy or make explicit `current` mandatory/documented for all adapters.

**Test:** Render a last linked crumb without an explicit current flag and compare element type plus `aria-current`.

## Acceptable asymmetries

- `modelValue`/`v-model`, event casing, `class` vs `className`, CSS-object vs CSS-string styles, and slots/snippets are framework idioms.
- CSS-generated separators, chart host attributes, `IrisAspectRatio` wrappers, and framework-specific virtual-scroll handles are acceptable when behavior and accessibility remain equivalent.
- `keepOpen` vs `closeOnSelect` is acceptable as naming; the missing equivalent behavior is not.
- Explicit breadcrumb `current` can be accepted if it becomes the documented canonical contract across all adapters.

No implementation changes were made.
