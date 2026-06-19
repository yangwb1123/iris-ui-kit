# Cross-framework behavior contracts

This directory holds the **behavioral-parity harness**: framework-agnostic
scenarios that assert all four adapters (React / Vue / Solid / Svelte) exhibit
**identical observable behavior**, not just identical component names.

The manifest's 4-framework parity test guards that every component _exists_ in
all four packages. That's _name_ parity. It cannot see that, say, Solid's tree
shipped with no keyboard navigation while the other three had it, or that three
adapters' selected table rows lacked `aria-selected`. Behavior contracts close
that gap: the same event-script runs against each adapter and the same DOM
assertions must hold. Because the behavior lives in framework-agnostic
controllers in `@iris-ui/core`, identical interactions _must_ yield identical
observable state — a divergence is a bug.

> This harness has already paid for itself: the Pagination and Table-select
> contracts each surfaced a real bug that the per-framework unit tests missed
> (they tested the _controlled_ path; the bugs were _uncontrolled_-only).

## Architecture

Three pieces, cleanly separated so the contract layer stays DOM- and
framework-free:

- **Scenario** (`scenarios/*.ts`) — pure DATA. A sequence of interactions
  (located by `role=` / `data-iris-*` selectors shared by all adapters) plus the
  attribute assertions that must hold after each step. No DOM, no test lib.
- **Driver** (`ContractDriver`, implemented per adapter in each package's
  `contracts.test`) — the thin bridge that owns the real elements + event firing
  (testing-library specifics) and exposes `queryAll` / `click` / `keydown` /
  `pointer` / `type` / `dblclick` / `flush`. `flush()` settles reactivity AND
  drains pending microtasks so async operations resolve before assertions.
- **Runner** (`runner.ts`) — `runContract(scenario, driver, expect)` walks the
  steps: perform the action on the resolved target, `flush()` reactivity, then
  check every assertion via the injected `expect`. A failed assertion throws.

See `types.ts` for the full `ContractScenario` / `ContractStep` /
`ContractAssertion` / `ContractDriver` shapes.

## Adding a new contract

The proven recipe (≈6 files):

1. **Verify selector consistency ×4 first.** Grep all four component sources for
   the selectors + attributes you'll assert. They must be identical across
   adapters (e.g. `[data-iris-segmented-item]` + `aria-checked`). If they diverge
   (different `role`, a `data-iris-*` only some adapters set), either pick a
   selector that _is_ shared, or you've found a parity bug — fix that first.
2. **Author the core scenario** in `scenarios/<name>.ts`, export it from
   `index.ts`. Keep assertions to attributes every adapter shares; prefer
   reading `aria-*` / roving `tabindex` over framework-specific `data-*`.
3. **Wire the React reference** in `packages/react/src/contracts.test.tsx` and
   gate `--filter=@iris-ui/core --filter=@iris-ui/react` green. React is the
   reference implementation; get it passing before fanning out.
4. **Mirror into vue / solid / svelte** `contracts.test` files (one `it()` block
   each: render the component, `await runContract(scenario, driverFor(...),
expect)`). Gate each package green.
5. The **contract-coverage guard** (`packages/manifest/src/
contract-coverage.test.ts`) then enforces that the new scenario is replayed by
   all four adapters — a scenario wired into only three fails CI.

## Adapter control-model cheat-sheet

How to drive a stateful component to a known starting state differs by adapter:

- **React / Solid** — render uncontrolled with `defaultValue` (`defaultPage`,
  `defaultExpandedIds`, …). The component self-manages; click/keydown mutate it.
- **Vue** — most stateful components are `modelValue`-based. Wrap in a tiny
  `defineComponent` harness holding a `ref` bound via `modelValue` +
  `'onUpdate:modelValue'` (see the existing `SwitchHarness` / `SliderHarness`).
  A few (e.g. Table) are uncontrolled-by-default — mount directly.
- **Svelte** — components are true-controlled (`onchange` emits, but the DOM only
  updates when the parent writes `value` back). The shared
  `ContractsHarness.svelte` holds one `$state` per control and writes it back.

## Patterns & gotchas (hard-won — read before authoring)

- **Dedicated harness for selector collisions (Svelte).** The shared
  `ContractsHarness.svelte` mounts many controls at once. If a new component
  shares a generic selector with one already there and a scenario asserts a
  global count, they collide — e.g. Rating + Slider both use `role="slider"`
  (breaks Slider's `count===1`); single + multiple ToggleGroup both use
  `[data-iris-toggle-group-item]`. Give such a component its own
  `*ContractHarness.svelte` (mirrors React's per-test isolated containers). The
  Table contracts also use dedicated harnesses to keep their many DOM nodes out
  of the shared one.
- **Root-element accessible node needs a host wrapper (Vue).** The driver's
  `queryAll` is container-scoped (`container.querySelectorAll`), which matches
  _descendants_, not the container itself. If a component puts the asserted role
  on its ROOT (e.g. Rating's `role="slider"`), the Vue harness must wrap it in a
  host `<div>` so the role becomes a descendant. (React's `render()` already
  returns a wrapping container, so it's fine there.)
- **Hidden native inputs — click the input, read the wrapper.** Radio and Table
  row-selection wrap a visually-hidden `<input>`. Click the inner
  `input[type=…]` (jsdom runs the native activation), but read selection state
  from the styled wrapper (`[data-iris-radio]` `data-state`, `[role="row"]`
  `aria-selected`). For multi-checkbox controls the master/select-all is index 0;
  rows follow.
- **Roving-tabindex keyboard targeting (Tree, and any roving-focus widget).**
  Adapters may attach the keydown handler differently — React/Solid at the
  container (the event bubbles up), Vue/Svelte per-item. A single shared keydown
  target still works: aim at `[role="treeitem"][tabindex="0"]` — the one
  roving-active node. A bubbling keydown there reaches the container handler AND
  fires the active item's own handler. This is how the Tree contract (long
  deferred for exactly this handler-split reason) was finally written.
- **Read `aria-*` + roving `tabindex`, not selection-mode-specific state**, to
  keep a scenario mode-agnostic (e.g. the Tree contract reads only
  `aria-expanded` + `tabindex`, so it passes regardless of `selectionMode`).
- **`equals: null` means the attribute is absent** (`getAttribute` → `null`).
  Use it to assert e.g. `aria-current` is unset on non-active items.
- **Prefer a reflected ATTRIBUTE; an input `.value` reader exists for the rest.**
  Most state is best observed via `getAttribute` (`aria-*`, roving `tabindex`, a
  `data-*` reflection) — e.g. OTP cells expose `data-filled="true"`, so the
  contract reads fill-state structurally. For state that genuinely lives in an
  input value, the runner now also supports `read: 'value'` (it reads the live
  `<input>.value` property), and the driver exposes a `type` action that sets a
  value + fires `input`/`change` plus a `dblclick` action — so text-entry and
  edit-in-place flows (e.g. the Table cell-edit contract: `dblclick` a cell,
  `type` into the input, read the committed `value`) are now contractable.

## Once-deferred, now landed

Several classes the original harness punted on are now covered — recorded here so
the gotchas that unblocked them aren't relearned:

- **Overlays** (Dialog / Popover / Drawer / Dropdown-menu / Tooltip / Combobox /
  Select / Menu) — now have **open + dismiss** contracts. The portal-scoping
  problem was solved by mounting each in a dedicated harness with the portal
  disabled per-test (React/Solid `portalTarget={false}`, Vue host wrapper,
  Svelte dedicated container), so the floating content lands _inside_ the
  driver's container-scoped `queryAll`. Reads `role`/`aria-expanded`/presence,
  not portal-specific internals, to stay adapter-agnostic.
- **Table column-resize + cell-edit** — both landed. Column-resize drives a
  pointer sequence (`pointerdown`→`pointermove`→`pointerup`) and reads the
  reflected width; cell-edit uses the new `dblclick` action + `type` action +
  `read: 'value'` to edit-in-place and assert the committed value.
- **Text ENTRY** — the `ContractDriver` grew a `type` action (sets an input value
  - fires `input`/`change`) and a `dblclick` action, and the runner grew a
    `read: 'value'` reader. Edit/entry flows are now first-class (no more
    keydown-on-seeded-state workaround).
- **Async data-source timing** — the `DataSource` contract now has an **async**
  sibling (`dataSourceAsyncScenario`): an infinite-mode harness driven by an
  injectable-latency (microtask-resolving) fetcher exercises `loadMore` append,
  optimistic `mutate` commit + rollback, and `reload` re-fetch. The unblocking
  trick was making each adapter's `flush()` drain a few microtask rounds (and,
  for Svelte, interleave `flushSync()` + `tick()`) so a resolved fetch settles
  before assertions — the sync scenarios are unaffected (the extra awaits are
  no-ops when nothing async is pending).

## Genuinely still deferred

- **True on-body portal mode** — the overlay contracts disable the portal so
  content is container-scoped. The _portalled_-to-`document.body` rendering path
  (the production default) is not asserted by the shared runner, whose `queryAll`
  is container-scoped. Verified per-framework instead. Lifting this needs a
  body-scoped driver variant.
- **Focus lifecycle** — focus _trapping_, restore-on-close, and initial-focus
  placement for overlays aren't asserted (jsdom's focus model is unreliable and
  varies by test lib). Covered by per-framework unit tests.

## Coverage at a glance

**39 scenarios across 33 components/behaviors**, every one replayed on all four
adapters (React / Vue / Solid / Svelte):

- **Form controls** — tabs, switch, checkbox, accordion, segmented, toggle-group
  (single + multiple), slider, range-slider, radio, number-input, rating,
  stepper, calendar, tag-input, otp-input.
- **Navigation / disclosure / overlays** — pagination, tree (keyboard), and the
  overlay set with open + dismiss contracts: dialog, popover, drawer, dropdown,
  tooltip, combobox, select, menu.
- **Feedback / actions** — toast, alert, banner, copy-button, split-button, form.
- **Table** — sort, multi-select, row-expand, cell-edit (dblclick + `type` +
  `read: 'value'`), and column-resize (pointer-drag).
- **Data engine** — the `useDataSource` bridge over `createDataSource`, both the
  **sync** happy-path (`load` / `setSort` / `setFilter` / `clearFilters`) and the
  **async** contract (`dataSourceAsyncScenario`: infinite `loadMore` append,
  optimistic `mutate` commit + rollback, `reload` re-fetch, via an injectable-
  latency fetcher).

Two guards keep this honest:

- **`contract-coverage`** (`packages/manifest/src/contract-coverage.test.ts`)
  enforces the full N-scenarios × 4-adapters matrix — a scenario wired into only
  three adapters fails CI.
- **assertion-density** (`packages/core/src/contracts/assertion-density.test.ts`)
  forbids a step with `expect: []` — every step must assert at least one
  observable, so coverage can't be padded with no-op steps that pass green while
  the behavior is broken.
