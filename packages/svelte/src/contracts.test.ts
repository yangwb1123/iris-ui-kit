import { describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { flushSync, tick } from 'svelte'
import {
  runContract,
  tabsScenario,
  switchScenario,
  checkboxScenario,
  accordionScenario,
  segmentedScenario,
  toggleGroupScenario,
  toggleGroupMultiScenario,
  sliderScenario,
  rangeSliderScenario,
  radioScenario,
  numberInputScenario,
  ratingScenario,
  paginationScenario,
  stepperScenario,
  tableSortScenario,
  tableSelectScenario,
  tableExpandScenario,
  treeScenario,
  calendarScenario,
  comboboxScenario,
  toastScenario,
  copyButtonScenario,
  selectScenario,
  tagInputScenario,
  otpInputScenario,
  dialogScenario,
  popoverScenario,
  dataSourceScenario,
  dataSourceAsyncScenario,
  drawerScenario,
  dropdownScenario,
  tooltipScenario,
  menuScenario,
  alertScenario,
  bannerScenario,
  splitButtonScenario,
  formScenario,
  tableCellEditScenario,
  tableColumnResizeScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import ContractsHarness from './ContractsHarness.svelte'
import RatingContractHarness from './RatingContractHarness.svelte'
import RangeSliderContractHarness from './RangeSliderContractHarness.svelte'
import ToggleGroupMultiContractHarness from './ToggleGroupMultiContractHarness.svelte'
import TableSortContractHarness from './TableSortContractHarness.svelte'
import TableSelectContractHarness from './TableSelectContractHarness.svelte'
import TableExpandContractHarness from './TableExpandContractHarness.svelte'
import TableCellEditContractHarness from './TableCellEditContractHarness.svelte'
import ColumnResizeContractHarness from './ColumnResizeContractHarness.svelte'
import TreeContractHarness from './TreeContractHarness.svelte'
import CalendarContractHarness from './CalendarContractHarness.svelte'
import ComboboxContractHarness from './ComboboxContractHarness.svelte'
import ToastContractHarness from './ToastContractHarness.svelte'
import IrisCopyButton from './primitives/copy-button/IrisCopyButton.svelte'
import IrisAlert from './primitives/alert/IrisAlert.svelte'
import IrisBanner from './primitives/banner/IrisBanner.svelte'
import IrisSplitButton from './primitives/split-button/IrisSplitButton.svelte'
import DataSourceContractHarness from './DataSourceContractHarness.svelte'
import DataSourceAsyncContractHarness from './DataSourceAsyncContractHarness.svelte'
import DialogContractHarness from './DialogContractHarness.svelte'
import PopoverContractHarness from './PopoverContractHarness.svelte'
import DrawerContractHarness from './DrawerContractHarness.svelte'
import DropdownContractHarness from './DropdownContractHarness.svelte'
import TooltipContractHarness from './TooltipContractHarness.svelte'
import SelectContractHarness from './SelectContractHarness.svelte'
import MenuContractHarness from './MenuContractHarness.svelte'
import FormContractHarness from './FormContractHarness.svelte'

/** A ContractDriver over a @testing-library/svelte result container. */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: async (selector, index) => {
      const el = at(selector, index)
      if (el) {
        fireEvent.focus(el)
        await fireEvent.click(el)
      }
    },
    keydown: async (selector, index, key) => {
      const el = at(selector, index)
      if (el) await fireEvent.keyDown(el, { key })
    },
    pointer: async (selector, index, eventType) => {
      const el = at(selector, index)
      if (!el) return
      const ev = new MouseEvent(eventType === 'enter' ? 'pointerenter' : 'pointerleave', {
        bubbles: true,
      })
      Object.defineProperty(ev, 'pointerType', { value: 'mouse' })
      await fireEvent(el, ev)
    },
    flush: async () => {
      // Sync scenarios settle with a single flushSync(). Async ops resolve on the
      // microtask queue (an injectable-latency fetcher; an optimistic-mutate
      // ROLLBACK chains a second `load()`), so interleave flushing with the
      // Svelte scheduler (`tick`) over a few rounds: flushSync() runs the $effect
      // that kicks `load()`, `await tick()` then yields to the resolving fetcher's
      // microtasks and re-runs the store→$state rune effect. The extra rounds are
      // no-ops when nothing async is pending, so sync scenarios are unaffected.
      for (let i = 0; i < 6; i++) {
        flushSync()
        await tick()
        await Promise.resolve()
      }
      flushSync()
    },
    type: (selector, index, text) => {
      const el = at(selector, index) as HTMLInputElement
      if (el) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set
        nativeInputValueSetter?.call(el, text)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
    dblclick: async (selector, index) => {
      const el = at(selector, index)
      if (el) await fireEvent.doubleClick(el)
    },
  }
}

describe('@iris-ui/svelte — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(tabsScenario, driverFor(container), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(switchScenario, driverFor(container), expect)
  })

  it('satisfies the shared Checkbox contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(checkboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(accordionScenario, driverFor(container), expect)
  })

  it('satisfies the shared Segmented contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(segmentedScenario, driverFor(container), expect)
  })

  it('satisfies the shared ToggleGroup contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(toggleGroupScenario, driverFor(container), expect)
  })

  it('satisfies the shared multiple-mode ToggleGroup contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so its
    // three `[data-iris-toggle-group-item]` buttons do not collide with the
    // single-mode group's three in the shared harness — which would make that
    // selector count 6 and break both groups' `count === 3` assertions. See
    // ToggleGroupMultiContractHarness.svelte for the full note.
    const { container } = render(ToggleGroupMultiContractHarness)
    await runContract(toggleGroupMultiScenario, driverFor(container), expect)
  })

  it('satisfies the shared Slider contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(sliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared RangeSlider contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // range slider's TWO role="slider" thumbs do not collide with the IrisSlider
    // thumb in the shared harness — which would make the shared Slider scenario's
    // globally-unique `[role="slider"]` (count === 1) assertion see 3 and break.
    // IrisRangeSlider is `value`-controlled (a `[number, number]`) + emits
    // `onchange`, so the harness holds local `value` state seeded to [20, 80] and
    // writes the emitted pair back; ArrowRight/Left on a thumb steps only that
    // thumb's `aria-valuenow`. See RangeSliderContractHarness.svelte for the full
    // note.
    const { container } = render(RangeSliderContractHarness)
    await runContract(rangeSliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared Radio contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(radioScenario, driverFor(container), expect)
  })

  it('satisfies the shared NumberInput contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(numberInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Pagination contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(paginationScenario, driverFor(container), expect)
  })

  it('satisfies the shared Stepper contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(stepperScenario, driverFor(container), expect)
  })

  it('satisfies the shared Rating contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // rating's role="slider" container does not collide with the IrisSlider thumb,
    // which would break the shared Slider scenario's globally-unique `[role="slider"]`
    // (count === 1) assertion. See RatingContractHarness.svelte for the full note.
    const { container } = render(RatingContractHarness)
    await runContract(ratingScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table column-sort contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // table's many header/row/cell elements stay out of the shared container and
    // can't collide with other scenarios' role-based selector counts. Sort is
    // uncontrolled (no `sort` prop), so the harness holds no state — the table
    // cycles aria-sort none→ascending→descending→none internally. See
    // TableSortContractHarness.svelte for the full note.
    const { container } = render(TableSortContractHarness)
    await runContract(tableSortScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table multi row-selection contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // table's many header/row/cell elements stay out of the shared container and
    // can't collide with other scenarios' role-based selector counts. Selection
    // is uncontrolled (no `selection` prop), so the harness holds no state — the
    // table flips each selectable row's aria-selected false↔true internally as
    // its native selection checkboxes are toggled. See
    // TableSelectContractHarness.svelte for the full note.
    const { container } = render(TableSelectContractHarness)
    await runContract(tableSelectScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table row-expansion contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // table's many header/row/cell elements stay out of the shared container and
    // can't collide with other scenarios' role-based selector counts. Expansion
    // is uncontrolled (no `defaultExpandedRowKeys`/controlled expanded prop), so
    // the harness holds no state — providing `renderDetail` adds the leading
    // expand-toggle column, and each toggle flips its row's aria-expanded and
    // mounts/unmounts its `[data-iris-table-detail-cell]` internally. See
    // TableExpandContractHarness.svelte for the full note (incl. the Svelte
    // function-prop renderDetail idiom).
    const { container } = render(TableExpandContractHarness)
    await runContract(tableExpandScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table column-resize contract', async () => {
    const { container } = render(ColumnResizeContractHarness)
    await runContract(tableColumnResizeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table cell-edit contract', async () => {
    const { container } = render(TableCellEditContractHarness)
    await runContract(tableCellEditScenario, driverFor(container), expect)
  })

  it('satisfies the shared Tree keyboard contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // tree's many `role="treeitem"` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // Expansion is uncontrolled (no `expanded`/`defaultExpanded` prop), so the
    // harness holds no state — both roots start collapsed, activeId starts null
    // (so item 0 is roving-active via the `idx===0 && !activeId` tabindex
    // fallback), and the tree's per-item keydown handler expands the active node
    // and migrates roving focus internally. Svelte attaches its handler per-item,
    // and the shared driver dispatches a bubbling keydown on the
    // `[role="treeitem"][tabindex="0"]` active node, firing it directly. See
    // TreeContractHarness.svelte for the full note.
    const { container } = render(TreeContractHarness)
    await runContract(treeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Calendar contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // calendar's full month of `role="gridcell"` day cells stay out of the shared
    // container and can't collide with other scenarios' role-based selector
    // counts. IrisCalendar is `value`-controlled (a `Date | null`) + emits
    // `onValueChange`, so the harness holds local `selected` state seeded to null
    // (nothing selected initially) and writes the emitted date back; `defaultMonth`
    // is fixed to June 2024 so the `data-iris-calendar-day-iso` cells are
    // deterministic. Clicking a day selects it and clears the prior one. See
    // CalendarContractHarness.svelte for the full note.
    const { container } = render(CalendarContractHarness)
    await runContract(calendarScenario, driverFor(container), expect)
  })

  it('satisfies the shared TagInput contract', async () => {
    // Lives in the shared ContractsHarness: IrisTagInput renders no
    // role="slider"/role="spinbutton" element, so its three
    // `[data-iris-tag-input-tag]` spans can't collide with the Slider/Rating/
    // NumberInput scenarios' role-based selector counts. IrisTagInput is
    // `value`-controlled (a `string[]`) + emits `onchange`, so the harness holds
    // local `tagValue` seeded to ['Alpha', 'Bravo', 'Charlie'] and writes the
    // emitted array back; clicking a tag's `[data-iris-tag-input-remove]` button
    // drops that tag and the remaining tags reflow.
    const { container } = render(ContractsHarness)
    await runContract(tagInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared OtpInput contract', async () => {
    // Lives in the shared ContractsHarness: IrisOtpInput renders only
    // role="group" + plain `<input>` cells (no role="slider"/role="spinbutton"),
    // so its five `[data-iris-otp-input-cell]` inputs can't collide with the
    // Slider/Rating/NumberInput scenarios' role-based selector counts, and it is
    // the only OTP rendered there (so exactly five cells exist). IrisOtpInput is
    // `value`-controlled (a `string`) + emits `onchange`, so the harness holds
    // local `otpValue` seeded to '123' over length={5} (five cells, first three
    // filled) and writes the emitted contiguous string back; a Backspace keydown
    // on a filled cell removes that char and the value contracts left.
    const { container } = render(ContractsHarness)
    await runContract(otpInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Dialog contract', async () => {
    // Rendered in a dedicated harness so the dialog's `[role="dialog"]` and
    // `[data-iris-dialog-trigger]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisDialog is uncontrolled (no `open` prop), starts closed (`defaultOpen`
    // defaults to `false`). The harness passes closeOnOutsideClick={false} so
    // the contract-driven Escape key is the only close mechanism, and
    // portalTarget={false} so the dialog content renders inline in the test
    // container (the contract driver's `queryAll` is container-scoped). See
    // DialogContractHarness.svelte for the full note.
    const { container } = render(DialogContractHarness)
    await runContract(dialogScenario, driverFor(container), expect)
  })

  it('satisfies the shared Popover contract', async () => {
    // Rendered in a dedicated harness so the popover's `[role="dialog"]` and
    // `[data-iris-popover-trigger]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisPopover is uncontrolled (no `open` prop), starts closed
    // (defaultOpen={false}). The harness passes portalTarget={false} so the
    // popover content renders inline in the test container (the contract
    // driver's `queryAll` is container-scoped). Unlike Dialog, the popover's
    // trigger TOGGLES — clicking it opens AND closes. See
    // PopoverContractHarness.svelte for the full note.
    const { container } = render(PopoverContractHarness)
    await runContract(popoverScenario, driverFor(container), expect)
  })

  it('satisfies the shared DataSource contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so its
    // live `[data-iris-ds-row]` rows and sort/filter/clear triggers stay out of
    // the shared container — exactly like the React reference's dedicated
    // <DataSourceHarness>. The Svelte `useDataSource` bridge exposes the live
    // engine state through a `$state` rune, so the harness's `{#each}` over
    // `ds.state.rows` re-renders REACTIVELY on each store emission (initial
    // sync-client load → setSort → setFilter → clearFilters), with no manual
    // bookkeeping. See DataSourceContractHarness.svelte for the full note.
    const { container } = render(DataSourceContractHarness)
    await runContract(dataSourceScenario, driverFor(container), expect)
  })

  it('satisfies the shared async DataSource contract', async () => {
    // Dedicated async harness over the infinite-mode engine driven by an
    // injectable-latency (microtask-resolving) fetcher: loadMore append, optimistic
    // mutate commit + rollback, reload re-fetch. The driver's `flush()` drains
    // microtask rounds + re-flushes so each async write settles before assertions.
    const { container } = render(DataSourceAsyncContractHarness)
    await runContract(dataSourceAsyncScenario, driverFor(container), expect)
  })

  it('satisfies the shared Drawer contract', async () => {
    // Rendered in a dedicated harness so the drawer's `[role="dialog"]` and
    // `[data-iris-drawer-trigger]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisDrawer is uncontrolled (no `open` prop), starts closed
    // (defaultOpen={false}). The harness passes portalTarget={false} so the
    // drawer content renders inline in the test container (the contract
    // driver's `queryAll` is container-scoped). Unlike Popover, the drawer
    // trigger only OPENS (it does not toggle); Escape is the canonical close.
    // See DrawerContractHarness.svelte for the full note.
    const { container } = render(DrawerContractHarness)
    await runContract(drawerScenario, driverFor(container), expect)
  })

  it('satisfies the shared Dropdown contract', async () => {
    // Rendered in a dedicated harness so the dropdown's `[role="menu"]` and
    // `[data-iris-dropdown-trigger]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisDropdown is uncontrolled (no `open` prop), starts closed
    // (defaultOpen={false}). The harness passes portalTarget={false} so the
    // dropdown menu renders inline in the test container (the contract
    // driver's `queryAll` is container-scoped). Like Popover, the dropdown
    // trigger TOGGLES — clicking it opens AND closes; Escape is the keyboard
    // dismiss mechanism. See DropdownContractHarness.svelte for the full note.
    const { container } = render(DropdownContractHarness)
    await runContract(dropdownScenario, driverFor(container), expect)
  })

  it('satisfies the shared Tooltip contract', async () => {
    // Rendered in a dedicated harness so the tooltip's `[role="tooltip"]` and
    // `[data-iris-tooltip-trigger]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisTooltip is uncontrolled (no `open` prop), starts closed. The harness
    // passes openDelay={0} (instant open) and closeDelay={0} (instant close),
    // and portalTarget={false} so the tooltip renders inline in the test
    // container (the contract driver's `queryAll` is container-scoped). The
    // scenario: closed → pointer enter → open → pointer leave → closed.
    const { container } = render(TooltipContractHarness)
    await runContract(tooltipScenario, driverFor(container), expect)
  })

  it('satisfies the shared Combobox contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // combobox's `[role="listbox"]` and `[data-iris-combobox-option]` elements
    // stay out of the shared container and can't collide with other scenarios'
    // role-based selector counts. The harness is uncontrolled (no `value` prop),
    // so the combobox manages its own open/close/filter state internally — the
    // scenario: closed → click input → listbox opens → type "Ap" → options
    // filtered (Apple, Apricot) → click first option → listbox closes, value
    // reflects the selection.
    const { container } = render(ComboboxContractHarness)
    await runContract(comboboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Toast notification contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // toast's `[data-iris-toast]` and `[data-iris-toast-push]` elements stay
    // out of the shared container and can't collide with other scenarios'
    // role-based selector counts. The harness renders an inline viewport
    // (portalTarget={false}) and a push button. The scenario: empty viewport
    // → click push → toast appears with title → click dismiss × → toast gone.
    // clearToasts() runs in afterEach via the before/after hooks below.
    const { container } = render(ToastContractHarness)
    await runContract(toastScenario, driverFor(container), expect)
  })

  it('satisfies the shared CopyButton contract', async () => {
    const { container } = render(IrisCopyButton, { props: { text: 'hello' } })
    await runContract(copyButtonScenario, driverFor(container), expect)
  })

  it('satisfies the shared Select contract', async () => {
    const { container } = render(SelectContractHarness)
    await runContract(selectScenario, driverFor(container), expect)
  })

  it('satisfies the shared Menu contract', async () => {
    // Rendered in a dedicated harness so the menu's `[role="menu"]` and
    // `[aria-haspopup="menu"]` elements stay out of the shared container
    // and can't collide with other scenarios' role-based selector counts.
    // IrisMenu is uncontrolled (no `open` prop), starts closed
    // (defaultOpen={false}). The harness passes portalTarget={false} so the
    // menu content renders inline in the test container (the contract
    // driver's `queryAll` is container-scoped). Like Popover and Dropdown,
    // the menu trigger TOGGLES — clicking it opens AND closes; Escape is
    // the keyboard dismiss mechanism.
    const { container } = render(MenuContractHarness)
    await runContract(menuScenario, driverFor(container), expect)
  })

  it('satisfies the shared Alert contract', async () => {
    const { container } = render(IrisAlert, { props: { closable: true } })
    await runContract(alertScenario, driverFor(container), expect)
  })

  it('satisfies the shared Banner contract', async () => {
    const { container } = render(IrisBanner, { props: { closable: true } })
    await runContract(bannerScenario, driverFor(container), expect)
  })

  it('satisfies the shared SplitButton contract', async () => {
    const { container } = render(IrisSplitButton, {
      props: {
        actions: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ],
      },
    })
    await runContract(splitButtonScenario, driverFor(container), expect)
  })

  it('satisfies the shared Form contract', async () => {
    const { container } = render(FormContractHarness)
    await tick()
    await runContract(formScenario, driverFor(container), expect)
  })
})
