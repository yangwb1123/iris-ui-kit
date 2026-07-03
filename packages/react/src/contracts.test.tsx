import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import {
  runContract,
  tabsScenario,
  switchScenario,
  checkboxScenario,
  accordionScenario,
  segmentedScenario,
  toggleGroupScenario,
  sliderScenario,
  radioScenario,
  numberInputScenario,
  ratingScenario,
  paginationScenario,
  stepperScenario,
  toggleGroupMultiScenario,
  tableSortScenario,
  tableSelectScenario,
  tableExpandScenario,
  tableColumnResizeScenario,
  treeScenario,
  calendarScenario,
  rangeSliderScenario,
  tagInputScenario,
  otpInputScenario,
  dialogScenario,
  dropdownScenario,
  popoverScenario,
  drawerScenario,
  overlayFocusScenario,
  overlayDestroyScenario,
  dataSourceScenario,
  dataSourceAsyncScenario,
  tooltipScenario,
  comboboxScenario,
  toastScenario,
  copyButtonScenario,
  selectScenario,
  menuScenario,
  alertScenario,
  bannerScenario,
  splitButtonScenario,
  formScenario,
  tableCellEditScenario,
  listKeyboardScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import { useCallback, useState } from 'react'
import {
  createSyncClientDataSource,
  createClientDataSource,
  type DataViewColumn,
} from '@iris-ui/core'
import { useDataSource } from './data/useDataSource'
import { IrisTabs } from './primitives/tabs/Tabs'
import { IrisTabsList } from './primitives/tabs/TabsList'
import { IrisTabsTrigger } from './primitives/tabs/TabsTrigger'
import { IrisTabsContent } from './primitives/tabs/TabsContent'
import { IrisSwitch } from './primitives/switch/Switch'
import { IrisCheckbox } from './primitives/checkbox/Checkbox'
import { IrisAccordion } from './primitives/accordion/Accordion'
import { IrisAccordionItem } from './primitives/accordion/AccordionItem'
import { IrisSegmented } from './primitives/segmented/Segmented'
import { IrisToggleGroup } from './primitives/toggle-group/ToggleGroup'
import { IrisToggleGroupItem } from './primitives/toggle-group/ToggleGroupItem'
import { IrisSlider } from './primitives/slider/Slider'
import { IrisRadio } from './primitives/radio/Radio'
import { IrisRadioGroup } from './primitives/radio/RadioGroup'
import { IrisNumberInput } from './primitives/number-input/NumberInput'
import { IrisRating } from './primitives/rating/Rating'
import { IrisPagination } from './primitives/pagination/Pagination'
import { IrisStepper } from './primitives/stepper/Stepper'
import { IrisStepperStep } from './primitives/stepper/StepperStep'
import { IrisTable } from './primitives/table/Table'
import { IrisTree } from './primitives/tree/Tree'
import { IrisCalendar } from './primitives/calendar/Calendar'
import { IrisRangeSlider } from './primitives/range-slider/RangeSlider'
import { IrisTagInput } from './primitives/tag-input/TagInput'
import { IrisOtpInput } from './primitives/otp-input/OtpInput'
import { IrisDialog } from './primitives/dialog/Dialog'
import { IrisDialogTrigger } from './primitives/dialog/DialogTrigger'
import { IrisDialogContent } from './primitives/dialog/DialogContent'
import { IrisPopover } from './primitives/popover/Popover'
import { IrisPopoverTrigger } from './primitives/popover/PopoverTrigger'
import { IrisPopoverContent } from './primitives/popover/PopoverContent'
import { IrisDrawer } from './primitives/drawer/Drawer'
import { IrisDrawerTrigger } from './primitives/drawer/DrawerTrigger'
import { IrisDrawerContent } from './primitives/drawer/DrawerContent'
import { IrisDropdown } from './primitives/dropdown/Dropdown'
import { IrisDropdownTrigger } from './primitives/dropdown/DropdownTrigger'
import { IrisDropdownMenu } from './primitives/dropdown/DropdownMenu'
import { IrisDropdownItem } from './primitives/dropdown/DropdownItem'
import { IrisTooltip } from './primitives/tooltip'
import { IrisCombobox } from './primitives/combobox/Combobox'
import { IrisCopyButton } from './primitives/copy-button/CopyButton'
import { IrisAlert } from './primitives/alert/Alert'
import { IrisBanner } from './primitives/banner/Banner'
import { IrisSplitButton } from './primitives/split-button/SplitButton'
import { IrisToastViewport } from './primitives/toast/ToastViewport'
import { IrisList } from './primitives/list/List'
import { pushToast, clearToasts } from './primitives/toast/toastStore'

import { SelectContractHarness } from './SelectContractHarness'
import { MenuContractHarness } from './MenuContractHarness'
import { FormContractHarness } from './FormContractHarness'

afterEach(() => {
  cleanup()
  clearToasts()
})

/**
 * A ContractDriver over a React-testing-library container (fireEvent auto-flushes).
 * Pass the render result's `unmount` to drive the destroy/cleanup contract; the
 * default no-op suffices for scenarios that never use the `'unmount'` action.
 */
function driverFor(container: HTMLElement, unmount: () => void = () => {}): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    unmount,
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) {
        fireEvent.focus(el)
        fireEvent.click(el)
      }
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el) fireEvent.keyDown(el, { key, bubbles: true })
    },
    pointer: (selector, index, event) => {
      const el = at(selector, index)
      if (!el) return
      if (event === 'enter') fireEvent.pointerEnter(el)
      else fireEvent.pointerLeave(el)
    },
    type: (sel, idx, text) => {
      const el = at(sel, idx) as HTMLInputElement
      if (!el) return
      act(() => {
        fireEvent.change(el, { target: { value: text } })
      })
    },
    dblclick: (selector, index) => {
      const el = at(selector, index)
      if (el) fireEvent.doubleClick(el)
    },
    flush: async () => {
      // Allow pending requestAnimationFrame callbacks (e.g. DrawerContent
      // 2-stage mount) to fire, then flush any resulting React updates.
      await act(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      })
    },
  }
}

/** Shared harness data for the DataSource contract (Charlie/Alice/Bob, name filterable). */
interface DsRow extends Record<string, unknown> {
  id: number
  name: string
  age: number
}
const dsData: DsRow[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
]
const dsColumns: DataViewColumn<DsRow>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'age', getValue: (r) => r.age },
]

/** Tiny component exercising the useDataSource bridge for the DataSource contract. */
function DataSourceHarness() {
  const ds = useDataSource<DsRow>({
    fetcher: createSyncClientDataSource(dsData, dsColumns),
    pageSize: 10,
  })
  return (
    <div>
      <button data-iris-ds-sort onClick={() => ds.setSort({ key: 'age', direction: 'asc' })}>
        sort
      </button>
      <button data-iris-ds-filter onClick={() => ds.setFilter('name', 'li')}>
        filter
      </button>
      <button data-iris-ds-clear onClick={() => ds.clearFilters()}>
        clear
      </button>
      {ds.state.rows.map((r) => (
        <div key={r.id} data-iris-ds-row>
          {r.name}
        </div>
      ))}
    </div>
  )
}

/** Async-contract dataset: 5 rows, infinite mode, pageSize 2 (page 1 = Ann/Ben). */
const dsAsyncData: DsRow[] = [
  { id: 1, name: 'Ann', age: 20 },
  { id: 2, name: 'Ben', age: 21 },
  { id: 3, name: 'Cara', age: 22 },
  { id: 4, name: 'Dan', age: 23 },
  { id: 5, name: 'Eve', age: 24 },
]

/**
 * An injectable-latency fetcher for the async contract: wraps the async client
 * data source but RESOLVES ON A MICROTASK (never synchronously), so every op
 * round-trips through the engine's Promise path. `getFetches()` returns how many
 * times it has resolved (proving a re-fetch fired). Identical ×4 harness.
 */
function makeLatencyFetcher() {
  const base = createClientDataSource<DsRow>(dsAsyncData, dsColumns)
  let fetches = 0
  const fetcher = async (q: Parameters<typeof base>[0]) => {
    await Promise.resolve()
    const result = await base(q)
    fetches += 1
    return result
  }
  return { fetcher, getFetches: () => fetches }
}

/** Component exercising the async useDataSource bridge (infinite append, mutate, reload). */
function DataSourceAsyncHarness() {
  const [{ fetcher, getFetches }] = useState(makeLatencyFetcher)
  const ds = useDataSource<DsRow>({ fetcher, mode: 'infinite', pageSize: 2 })
  const rename = (suffix: string, fail: boolean) =>
    void ds
      .mutate(() => (fail ? Promise.reject(new Error('boom')) : Promise.resolve()), {
        optimistic: (rows) =>
          rows.map((r, i) => (i === 0 ? { ...r, name: `${r.name}${suffix}` } : r)),
        skipReload: !fail,
      })
      .catch(() => {})
  return (
    <div>
      <button data-iris-ds-loadmore onClick={() => void ds.loadMore()}>
        loadMore
      </button>
      <button data-iris-ds-reload onClick={() => void ds.reload()}>
        reload
      </button>
      <button data-iris-ds-rename onClick={() => rename('*', false)}>
        rename
      </button>
      <button data-iris-ds-rename-fail onClick={() => rename('!', true)}>
        renameFail
      </button>
      <div
        data-iris-ds-meta
        data-hasmore={String(ds.state.hasMore)}
        data-loading={String(ds.state.loading)}
        data-fetches={String(getFetches())}
      />
      {ds.state.rows.map((r) => (
        <div key={r.id} data-iris-ds-row>
          {r.name}
        </div>
      ))}
    </div>
  )
}

function DrawerContractHarness() {
  return (
    <div>
      <IrisDrawer defaultOpen={false}>
        <IrisDrawerTrigger data-iris-drawer-trigger>Open</IrisDrawerTrigger>
        <IrisDrawerContent portalTarget={false}>
          <p>Drawer content</p>
        </IrisDrawerContent>
      </IrisDrawer>
    </div>
  )
}

/**
 * Trigger + overlay for the focus-lifecycle contract. Renders inline
 * (`portalTarget={false}`) so the container-scoped `[role="dialog"]` count works;
 * the focus assertions only read the in-container trigger via document.activeElement.
 */
function OverlayFocusContractHarness() {
  return (
    <div>
      <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
        <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <p>Dialog body</p>
        </IrisDialogContent>
      </IrisDialog>
    </div>
  )
}

/**
 * Trigger + overlay for the destroy/cleanup contract. The overlay PORTALS to
 * document.body (its default — no `portalTarget={false}`), so the document-scoped
 * (`global: true`) assertions genuinely exercise portal cleanup on unmount.
 */
function OverlayDestroyContractHarness() {
  return (
    <div>
      <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
        <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
        <IrisDialogContent>
          <p>Dialog body</p>
        </IrisDialogContent>
      </IrisDialog>
    </div>
  )
}

describe('@iris-ui/react — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const { container } = render(
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          <IrisTabsTrigger value="c">Tab C</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b">Panel B</IrisTabsContent>
        <IrisTabsContent value="c">Panel C</IrisTabsContent>
      </IrisTabs>,
    )
    await runContract(tabsScenario, driverFor(container), expect)
  })

  it('satisfies the shared List keyboard contract', async () => {
    const { container } = render(
      <IrisList
        items={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Bravo' },
          { value: 'c', label: 'Charlie' },
        ]}
      />,
    )
    await runContract(listKeyboardScenario, driverFor(container), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const { container } = render(<IrisSwitch />)
    await runContract(switchScenario, driverFor(container), expect)
  })

  it('satisfies the shared Checkbox contract', async () => {
    const { container } = render(<IrisCheckbox />)
    await runContract(checkboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const { container } = render(
      <IrisAccordion>
        <IrisAccordionItem value="a" title="A">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>,
    )
    await runContract(accordionScenario, driverFor(container), expect)
  })

  it('satisfies the shared Segmented contract', async () => {
    const { container } = render(
      <IrisSegmented
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
        ]}
        defaultValue="a"
      />,
    )
    await runContract(segmentedScenario, driverFor(container), expect)
  })

  it('satisfies the shared single-mode ToggleGroup contract', async () => {
    const { container } = render(
      <IrisToggleGroup type="single" defaultValue="a">
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
        <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
      </IrisToggleGroup>,
    )
    await runContract(toggleGroupScenario, driverFor(container), expect)
  })

  it('satisfies the shared Slider keyboard contract', async () => {
    const { container } = render(
      <IrisSlider defaultValue={50} min={0} max={100} step={10} label="Volume" />,
    )
    await runContract(sliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared Radio contract', async () => {
    const { container } = render(
      <IrisRadioGroup defaultValue="a">
        <IrisRadio value="a">A</IrisRadio>
        <IrisRadio value="b">B</IrisRadio>
        <IrisRadio value="c">C</IrisRadio>
      </IrisRadioGroup>,
    )
    await runContract(radioScenario, driverFor(container), expect)
  })

  it('satisfies the shared NumberInput contract', async () => {
    const { container } = render(
      <IrisNumberInput defaultValue={5} min={0} max={10} step={1} aria-label="Quantity" />,
    )
    await runContract(numberInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Rating contract', async () => {
    const { container } = render(<IrisRating defaultValue={0} max={5} aria-label="Score" />)
    await runContract(ratingScenario, driverFor(container), expect)
  })

  it('satisfies the shared Pagination contract', async () => {
    const { container } = render(<IrisPagination defaultValue={1} total={30} pageSize={10} />)
    await runContract(paginationScenario, driverFor(container), expect)
  })

  it('satisfies the shared Stepper contract', async () => {
    const { container } = render(
      <IrisStepper defaultValue={0} linear={false}>
        <IrisStepperStep title="Step 1" />
        <IrisStepperStep title="Step 2" />
        <IrisStepperStep title="Step 3" />
      </IrisStepper>,
    )
    await runContract(stepperScenario, driverFor(container), expect)
  })

  it('satisfies the shared multiple-mode ToggleGroup contract', async () => {
    const { container } = render(
      <IrisToggleGroup type="multiple" defaultValue={[]}>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
        <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
      </IrisToggleGroup>,
    )
    await runContract(toggleGroupMultiScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table column-sort contract', async () => {
    const { container } = render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name', sortable: true },
          { key: 'age', title: 'Age', sortable: true },
        ]}
        data={[
          { id: '1', name: 'Bravo', age: 30 },
          { id: '2', name: 'Alpha', age: 25 },
          { id: '3', name: 'Charlie', age: 35 },
        ]}
      />,
    )
    await runContract(tableSortScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table multi row-selection contract', async () => {
    const { container } = render(
      <IrisTable
        selectable="multi"
        columns={[{ key: 'name', title: 'Name' }]}
        data={[
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ]}
      />,
    )
    await runContract(tableSelectScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table row-expansion contract', async () => {
    const { container } = render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ]}
        renderDetail={(row) => <div>Detail {String(row.name)}</div>}
      />,
    )
    await runContract(tableExpandScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table cell-edit contract', async () => {
    const { container } = render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name', editable: true },
          { key: 'age', title: 'Age' },
        ]}
        data={[
          { id: '1', name: 'Charlie', age: 30 },
          { id: '2', name: 'Alpha', age: 25 },
          { id: '3', name: 'Bravo', age: 35 },
        ]}
      />,
    )
    await runContract(tableCellEditScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table column-resize contract', async () => {
    // Controlled first-column width (initial 200) so `measure()` returns the
    // override, not jsdom's layout-less 0; the probe exposes it observably.
    function ResizeHarness() {
      const [widths, setWidths] = useState<Record<string, number>>({ name: 200 })
      return (
        <>
          <IrisTable
            resizableColumns
            columnWidths={widths}
            onColumnWidthsChange={setWidths}
            columns={[
              { key: 'name', title: 'Name' },
              { key: 'age', title: 'Age' },
            ]}
            data={[
              { id: '1', name: 'Charlie', age: 30 },
              { id: '2', name: 'Alpha', age: 25 },
              { id: '3', name: 'Bravo', age: 35 },
            ]}
          />
          <div data-col-width={String(widths.name)} />
        </>
      )
    }
    const { container } = render(<ResizeHarness />)
    await runContract(tableColumnResizeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Tree keyboard contract', async () => {
    const { container } = render(
      <IrisTree
        nodes={[
          {
            id: 'a',
            label: 'A',
            children: [
              { id: 'a1', label: 'A1' },
              { id: 'a2', label: 'A2' },
            ],
          },
          { id: 'b', label: 'B' },
        ]}
      />,
    )
    await runContract(treeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Calendar contract', async () => {
    const { container } = render(<IrisCalendar defaultMonth={new Date(2024, 5, 1)} />)
    await runContract(calendarScenario, driverFor(container), expect)
  })

  it('satisfies the shared RangeSlider contract', async () => {
    const { container } = render(
      <IrisRangeSlider defaultValue={[20, 80]} min={0} max={100} step={10} />,
    )
    await runContract(rangeSliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared TagInput contract', async () => {
    const { container } = render(<IrisTagInput defaultValue={['Alpha', 'Bravo', 'Charlie']} />)
    await runContract(tagInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared OtpInput contract', async () => {
    const { container } = render(<IrisOtpInput length={5} defaultValue="123" />)
    await runContract(otpInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Dialog contract', async () => {
    const { container } = render(
      <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
        <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <p>Dialog body</p>
        </IrisDialogContent>
      </IrisDialog>,
    )
    await runContract(dialogScenario, driverFor(container), expect)
  })

  it('satisfies the shared Popover contract', async () => {
    const { container } = render(
      <IrisPopover defaultOpen={false}>
        <IrisPopoverTrigger data-iris-popover-trigger>Open</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>
          <p>Popover content</p>
        </IrisPopoverContent>
      </IrisPopover>,
    )
    await runContract(popoverScenario, driverFor(container), expect)
  })

  it('satisfies the shared Drawer contract', async () => {
    const { container } = render(<DrawerContractHarness />)
    await runContract(drawerScenario, driverFor(container), expect)
  })

  it('satisfies the shared overlay focus-lifecycle contract', async () => {
    const { container } = render(<OverlayFocusContractHarness />)
    await runContract(overlayFocusScenario, driverFor(container), expect)
  })

  it('satisfies the shared overlay destroy/cleanup contract', async () => {
    const { container, unmount } = render(<OverlayDestroyContractHarness />)
    await runContract(overlayDestroyScenario, driverFor(container, unmount), expect)
  })

  it('satisfies the shared DataSource contract', async () => {
    const { container } = render(<DataSourceHarness />)
    await runContract(dataSourceScenario, driverFor(container), expect)
  })

  it('satisfies the shared async DataSource contract', async () => {
    const { container } = render(<DataSourceAsyncHarness />)
    await runContract(dataSourceAsyncScenario, driverFor(container), expect)
  })

  it('satisfies the shared Tooltip contract', async () => {
    const { container } = render(
      <div>
        <IrisTooltip openDelay={0} closeDelay={0} portalTarget={false} content="Tooltip text">
          <span data-iris-tooltip-trigger>Hover me</span>
        </IrisTooltip>
      </div>,
    )
    await runContract(tooltipScenario, driverFor(container), expect)
  })

  it('satisfies the shared Dropdown contract', async () => {
    const { container } = render(
      <div>
        <IrisDropdown defaultOpen={false}>
          <IrisDropdownTrigger data-iris-dropdown-trigger>Open</IrisDropdownTrigger>
          <IrisDropdownMenu portalTarget={false}>
            <IrisDropdownItem>Item</IrisDropdownItem>
          </IrisDropdownMenu>
        </IrisDropdown>
      </div>,
    )
    await runContract(dropdownScenario, driverFor(container), expect)
  })

  it('satisfies the shared Combobox contract', async () => {
    const { container } = render(
      <div>
        <IrisCombobox
          data-iris-combobox-input="wrapper"
          options={[
            { value: 'apple', label: 'Apple' },
            { value: 'banana', label: 'Banana' },
            { value: 'apricot', label: 'Apricot' },
            { value: 'grape', label: 'Grape' },
          ]}
        />
      </div>,
    )
    await runContract(comboboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Toast notification contract', async () => {
    function ToastContractHarness() {
      const push = useCallback(() => pushToast({ title: 'Hello Toast' }), [])
      return (
        <div>
          <button type="button" data-iris-toast-push onClick={push}>
            Push Toast
          </button>
          <IrisToastViewport portalTarget={false} />
        </div>
      )
    }
    const { container } = render(<ToastContractHarness />)
    await runContract(toastScenario, driverFor(container), expect)
  })

  it('satisfies the shared CopyButton contract', async () => {
    const { container } = render(<IrisCopyButton text="hello" />)
    await runContract(copyButtonScenario, driverFor(container), expect)
  })

  it('satisfies the shared Select contract', async () => {
    render(<SelectContractHarness />)
    // Document-scoped driver: Select portals its listbox to document.body via
    // IrisPopoverContent, so a container-scoped queryAll won't find it.
    const q = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
    const docDriver: ContractDriver = {
      unmount: () => {},
      queryAll: (sel) => q(sel),
      click: (sel, idx) => {
        const el = q(sel)[idx ?? 0]
        if (el) {
          el.focus()
          el.click()
        }
      },
      keydown: (sel, idx, key) => {
        const el = q(sel)[idx ?? 0]
        if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      },
      type: () => undefined,
      pointer: (_sel, _idx, _event) => undefined,
      dblclick: () => undefined,
      flush: async () => {
        await act(() => {})
      },
    }
    await runContract(selectScenario, docDriver, expect)
  })

  it('satisfies the shared Menu contract', async () => {
    render(<MenuContractHarness />)
    const q = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
    const docDriver: ContractDriver = {
      unmount: () => {},
      queryAll: (sel) => q(sel),
      click: (sel, idx) => {
        const el = q(sel)[idx ?? 0]
        if (el) {
          el.focus()
          el.click()
        }
      },
      keydown: (sel, idx, key) => {
        const el = q(sel)[idx ?? 0]
        if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      },
      type: () => undefined,
      pointer: () => undefined,
      dblclick: () => undefined,
      flush: async () => {
        await act(() => {})
      },
    }
    await runContract(menuScenario, docDriver, expect)
  })
  it('satisfies the shared Alert contract', async () => {
    const { container } = render(<IrisAlert closable>Hello</IrisAlert>)
    await runContract(alertScenario, driverFor(container), expect)
  })

  it('satisfies the shared Banner contract', async () => {
    const { container } = render(<IrisBanner closable>Hello</IrisBanner>)
    await runContract(bannerScenario, driverFor(container), expect)
  })

  it('satisfies the shared SplitButton contract', async () => {
    render(
      <IrisSplitButton
        actions={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
      >
        Main
      </IrisSplitButton>,
    )
    const q = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
    const docDriver: ContractDriver = {
      unmount: () => {},
      queryAll: (sel) => q(sel),
      click: (sel, idx) => {
        const el = q(sel)[idx ?? 0]
        if (el) {
          el.focus()
          el.click()
        }
      },
      keydown: (sel, idx, key) => {
        const el = q(sel)[idx ?? 0]
        if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      },
      type: () => undefined,
      pointer: () => undefined,
      dblclick: () => undefined,
      flush: async () => {
        await act(() => {})
      },
    }
    await runContract(splitButtonScenario, docDriver, expect)
  })

  it('satisfies the shared Form contract', async () => {
    const { container } = render(<FormContractHarness />)
    await runContract(formScenario, driverFor(container), expect)
  })
})
