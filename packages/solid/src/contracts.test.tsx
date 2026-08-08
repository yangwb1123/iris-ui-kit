import { afterEach, describe, expect, it } from 'vitest'
import { createSignal, createMemo, For } from 'solid-js'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
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
  tagInputScenario,
  otpInputScenario,
  dataSourceScenario,
  dataSourceAsyncScenario,
  dataSourceResilientScenario,
  dialogScenario,
  overlayFocusScenario,
  overlayDestroyScenario,
  popoverScenario,
  drawerScenario,
  dropdownScenario,
  tooltipScenario,
  comboboxScenario,
  toastScenario,
  copyButtonScenario,
  selectScenario,
  menuScenario,
  alertScenario,
  bannerScenario,
  splitButtonScenario,
  tableCellEditScenario,
  tableColumnResizeScenario,
  formScenario,
  listKeyboardScenario,
  type ContractDriver,
} from '@iris-ui-kit/core/contracts'
import {
  createSyncClientDataSource,
  createClientDataSource,
  filterSort,
  paginate,
  type DataViewColumn,
  type DataSourceQuery,
} from '@iris-ui-kit/core'
import {
  IrisTabs,
  IrisTabsList,
  IrisTabsTrigger,
  IrisTabsContent,
} from './primitives/tabs/IrisTabs'
import { IrisSwitch } from './primitives/switch/Switch'
import { IrisCheckbox } from './primitives/checkbox'
import { IrisAccordion, IrisAccordionItem } from './primitives/accordion'
import { IrisSegmented } from './primitives/segmented'
import { IrisToggleGroup, IrisToggleGroupItem } from './primitives/toggle-group'
import { IrisSlider } from './primitives/slider'
import { IrisRangeSlider } from './primitives/range-slider'
import { IrisRadioGroup, IrisRadio } from './primitives/radio'
import { IrisNumberInput } from './primitives/number-input'
import { IrisRating } from './primitives/rating'
import { IrisPagination } from './primitives/pagination'
import { IrisStepper, IrisStepperStep } from './primitives/stepper'
import { IrisTable } from './primitives/table/IrisTable'
import { IrisTree } from './primitives/tree'
import { IrisCalendar } from './primitives/calendar'
import { IrisTagInput } from './primitives/tag-input'
import { IrisOtpInput } from './primitives/otp-input/IrisOtpInput'
import { IrisDialog } from './primitives/dialog/IrisDialog'
import { IrisDialogTrigger } from './primitives/dialog/IrisDialogTrigger'
import { IrisDialogContent } from './primitives/dialog/IrisDialogContent'
import { IrisPopover, IrisPopoverTrigger, IrisPopoverContent } from './primitives/popover'
import { IrisDrawer, IrisDrawerTrigger, IrisDrawerContent } from './primitives/drawer'
import { IrisDropdown, IrisDropdownTrigger, IrisDropdownMenu } from './primitives/dropdown'
import { IrisTooltip } from './primitives/tooltip'
import { IrisCombobox } from './primitives/combobox/IrisCombobox'
import { IrisCopyButton } from './primitives/copy-button'
import { IrisAlert } from './primitives/alert'
import { IrisBanner } from './primitives/banner'
import { IrisSplitButton } from './primitives/split-button'
import { IrisList } from './primitives/list'
import { SelectContractHarness } from './SelectContractHarness'
import { MenuContractHarness } from './MenuContractHarness'
import { FormContractHarness } from './FormContractHarness'
import { IrisToastViewport } from './primitives/toast'
import { pushToast, clearToasts } from './primitives/toast/toastStore'
import { useDataSource } from './data/useDataSource'

afterEach(() => {
  cleanup()
  clearToasts()
})

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

/**
 * Mirrors the React DataSource harness in Solid idioms. `useDataSource` returns
 * `state` as a Solid accessor, so rows are read via `ds.state().rows` and
 * rendered through `<For>` so the list re-renders reactively on
 * setSort / setFilter / clearFilters. A sync client fetcher keeps it
 * deterministic — no timers, no async settling.
 */
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
      <For each={ds.state().rows}>{(r) => <div data-iris-ds-row>{r.name}</div>}</For>
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
 * Mirrors the React async DataSource harness in Solid idioms (infinite append,
 * mutate, reload). The injectable-latency fetcher wraps the async client data
 * source but resolves ON A MICROTASK (never synchronously), so every op round-
 * trips through the engine's Promise path; it bumps a Solid signal on each
 * resolve so `data-fetches` re-renders reactively (proving a re-fetch fired).
 */
function DataSourceAsyncHarness() {
  const [fetches, setFetches] = createSignal(0)
  const base = createClientDataSource<DsRow>(dsAsyncData, dsColumns)
  const fetcher = async (q: Parameters<typeof base>[0]) => {
    await Promise.resolve()
    const result = await base(q)
    setFetches((n) => n + 1)
    return result
  }
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
        data-hasmore={String(ds.state().hasMore)}
        data-loading={String(ds.state().loading)}
        data-fetches={String(fetches())}
      />
      <For each={ds.state().rows}>{(r) => <div data-iris-ds-row>{r.name}</div>}</For>
    </div>
  )
}

/**
 * Resilient-contract dataset: 3 rows, paged mode, pageSize 10, TTL 60s. The
 * fetcher reads a MUTABLE backing store and returns per-row COPIES (never
 * aliasing it), so the rename mutation becomes visible ONLY through a real
 * re-fetch — and `data-fetches` proves cache hits (reload within TTL) vs.
 * genuine network reads (multiSort key change, post-mutate invalidation).
 * Identical ×4 harness.
 */
const dsResilientData: DsRow[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
]

function DataSourceResilientHarness() {
  const [fetches, setFetches] = createSignal(0)
  // createMemo with no reactive reads → the backing store is created ONCE, not
  // per render: the engine captures the first-render fetcher, whose closure
  // must keep reading the SAME array the rename mutation writes.
  const backing = createMemo(() => dsResilientData.map((r) => ({ ...r })))
  const fetcher = (q: DataSourceQuery) => {
    const processed = filterSort(backing(), dsColumns, {
      filters: q.filters,
      sort: q.sort,
      multiSort: q.multiSort,
      filterRules: q.filterRules,
    })
    setFetches((n) => n + 1)
    return {
      rows: paginate(processed, q.page, q.pageSize).map((r) => ({ ...r })),
      total: processed.length,
    }
  }
  const renameFirst = () => {
    backing()[0] = { ...backing()[0]!, name: `${backing()[0]!.name}!` }
  }
  const ds = useDataSource<DsRow>({
    fetcher,
    pageSize: 10,
    resilient: { ttlMs: 60000 },
  })
  return (
    <div>
      <button data-iris-ds-reload onClick={() => void ds.reload()}>
        reload
      </button>
      <button
        data-iris-ds-multisort-a
        onClick={() => ds.setMultiSort([{ key: 'age', direction: 'asc' }])}
      >
        sortAge
      </button>
      <button
        data-iris-ds-multisort-b
        onClick={() => ds.setMultiSort([{ key: 'name', direction: 'desc' }])}
      >
        sortName
      </button>
      <button data-iris-ds-mutate onClick={() => void ds.mutate(async () => renameFirst())}>
        mutate
      </button>
      <div data-iris-ds-meta data-fetches={String(fetches())} />
      <For each={ds.state().rows}>{(r) => <div data-iris-ds-row>{r.name}</div>}</For>
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

/**
 * A ContractDriver over a Solid-testing-library container. Solid reactivity is
 * synchronous in tests, so `flush()` only drains pending microtasks +
 * requestAnimationFrame callbacks. Pass the render result's `unmount` to drive
 * the destroy/cleanup contract; the default no-op suffices for scenarios that
 * never use the `'unmount'` action.
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
        el.focus()
        fireEvent.click(el)
      }
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el) fireEvent.keyDown(el, { key })
    },
    type: (selector, index, text) => {
      const el = at(selector, index) as HTMLInputElement
      if (el) {
        el.value = text
        fireEvent.input(el)
      }
    },
    pointer: (selector, index, event) => {
      const el = at(selector, index)
      if (el) fireEvent(el, new MouseEvent(`pointer${event}`, { bubbles: true }))
    },
    dblclick: (selector, index) => {
      const el = at(selector, index)
      if (el) fireEvent.doubleClick(el)
    },
    // Solid reactivity is synchronous on signal writes, so sync scenarios need no
    // settling. Async ops still resolve on the microtask queue (an injectable-
    // latency fetcher; an optimistic-mutate ROLLBACK chains a second `load()`),
    // so drain a few microtask rounds — a no-op when nothing is pending. The
    // dialog focus trap also defers its open-focus / dismiss-restore to a
    // requestAnimationFrame, so wait one rAF (then a microtask) for the overlay
    // focus-lifecycle contract to observe the settled document.activeElement.
    flush: async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await Promise.resolve()
    },
  }
}

describe('@iris-ui-kit/solid — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const { container } = render(() => (
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          <IrisTabsTrigger value="c">Tab C</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b">Panel B</IrisTabsContent>
        <IrisTabsContent value="c">Panel C</IrisTabsContent>
      </IrisTabs>
    ))
    await runContract(tabsScenario, driverFor(container), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const { container } = render(() => <IrisSwitch />)
    await runContract(switchScenario, driverFor(container), expect)
  })

  it('satisfies the shared Checkbox contract', async () => {
    const { container } = render(() => <IrisCheckbox />)
    await runContract(checkboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="A">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    await runContract(accordionScenario, driverFor(container), expect)
  })

  it('satisfies the shared Segmented contract', async () => {
    const { container } = render(() => (
      <IrisSegmented
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
        ]}
        defaultValue="a"
      />
    ))
    await runContract(segmentedScenario, driverFor(container), expect)
  })

  it('satisfies the shared ToggleGroup contract', async () => {
    const { container } = render(() => (
      <IrisToggleGroup type="single" defaultValue="a">
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
        <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    await runContract(toggleGroupScenario, driverFor(container), expect)
  })

  it('satisfies the shared ToggleGroup (multiple) contract', async () => {
    const { container } = render(() => (
      <IrisToggleGroup type="multiple" defaultValue={[]}>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
        <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    await runContract(toggleGroupMultiScenario, driverFor(container), expect)
  })

  it('satisfies the shared Slider contract', async () => {
    const { container } = render(() => (
      <IrisSlider defaultValue={50} min={0} max={100} step={10} label="Volume" />
    ))
    await runContract(sliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared RangeSlider contract', async () => {
    const { container } = render(() => (
      <IrisRangeSlider defaultValue={[20, 80]} min={0} max={100} step={10} />
    ))
    await runContract(rangeSliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared Radio contract', async () => {
    const { container } = render(() => (
      <IrisRadioGroup defaultValue="a">
        <IrisRadio value="a">A</IrisRadio>
        <IrisRadio value="b">B</IrisRadio>
        <IrisRadio value="c">C</IrisRadio>
      </IrisRadioGroup>
    ))
    await runContract(radioScenario, driverFor(container), expect)
  })

  it('satisfies the shared NumberInput contract', async () => {
    const { container } = render(() => (
      <IrisNumberInput defaultValue={5} min={0} max={10} step={1} aria-label="Quantity" />
    ))
    await runContract(numberInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Rating contract', async () => {
    const { container } = render(() => <IrisRating defaultValue={0} max={5} aria-label="Score" />)
    await runContract(ratingScenario, driverFor(container), expect)
  })

  it('satisfies the shared Pagination contract', async () => {
    const { container } = render(() => <IrisPagination defaultPage={1} total={30} pageSize={10} />)
    await runContract(paginationScenario, driverFor(container), expect)
  })

  it('satisfies the shared Stepper contract', async () => {
    const { container } = render(() => (
      <IrisStepper defaultValue={0} linear={false}>
        <IrisStepperStep title="Step 1" />
        <IrisStepperStep title="Step 2" />
        <IrisStepperStep title="Step 3" />
      </IrisStepper>
    ))
    await runContract(stepperScenario, driverFor(container), expect)
  })

  it('satisfies the shared TableSort contract', async () => {
    const { container } = render(() => (
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
      />
    ))
    await runContract(tableSortScenario, driverFor(container), expect)
  })

  it('satisfies the shared TableSelect contract', async () => {
    const { container } = render(() => (
      <IrisTable
        selectable="multi"
        columns={[{ key: 'name', title: 'Name' }]}
        data={[
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ]}
      />
    ))
    await runContract(tableSelectScenario, driverFor(container), expect)
  })

  it('satisfies the shared TableExpand contract', async () => {
    const { container } = render(() => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ]}
        renderDetail={(row) => <div>Detail {String(row.name)}</div>}
      />
    ))
    await runContract(tableExpandScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table column-resize contract', async () => {
    // Controlled first-column width (initial 200) so `widthOf()` returns the
    // override, not jsdom's layout-less 0; the probe exposes it observably.
    function ResizeHarness() {
      const [widths, setWidths] = createSignal<Record<string, number>>({ name: 200 })
      return (
        <>
          <IrisTable
            resizableColumns
            columnWidths={widths()}
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
          <div data-col-width={String(widths().name)} />
        </>
      )
    }
    const { container } = render(() => <ResizeHarness />)
    await runContract(tableColumnResizeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Table cell-edit contract', async () => {
    const { container } = render(() => (
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
      />
    ))
    await runContract(tableCellEditScenario, driverFor(container), expect)
  })

  it('satisfies the shared Tree contract', async () => {
    const { container } = render(() => (
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
      />
    ))
    await runContract(treeScenario, driverFor(container), expect)
  })

  it('satisfies the shared Calendar contract', async () => {
    const { container } = render(() => <IrisCalendar defaultMonth={new Date(2024, 5, 1)} />)
    await runContract(calendarScenario, driverFor(container), expect)
  })

  it('satisfies the shared TagInput contract', async () => {
    const { container } = render(() => (
      <IrisTagInput defaultValue={['Alpha', 'Bravo', 'Charlie']} />
    ))
    await runContract(tagInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared OtpInput contract', async () => {
    const { container } = render(() => <IrisOtpInput length={5} defaultValue="123" />)
    await runContract(otpInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared DataSource contract', async () => {
    const { container } = render(() => <DataSourceHarness />)
    await runContract(dataSourceScenario, driverFor(container), expect)
  })

  it('satisfies the shared async DataSource contract', async () => {
    const { container } = render(() => <DataSourceAsyncHarness />)
    await runContract(dataSourceAsyncScenario, driverFor(container), expect)
  })

  it('satisfies the shared resilient DataSource contract', async () => {
    const { container } = render(() => <DataSourceResilientHarness />)
    await runContract(dataSourceResilientScenario, driverFor(container), expect)
  })

  it('satisfies the shared Dialog contract', async () => {
    const { container } = render(() => (
      <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
        <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <p>Dialog body</p>
        </IrisDialogContent>
      </IrisDialog>
    ))
    await runContract(dialogScenario, driverFor(container), expect)
  })

  it('satisfies the shared overlay focus-lifecycle contract', async () => {
    const { container } = render(() => <OverlayFocusContractHarness />)
    await runContract(overlayFocusScenario, driverFor(container), expect)
  })

  it('satisfies the shared overlay destroy/cleanup contract', async () => {
    const { container, unmount } = render(() => <OverlayDestroyContractHarness />)
    await runContract(overlayDestroyScenario, driverFor(container, unmount), expect)
  })

  function PopoverContractHarness() {
    return (
      <div>
        <IrisPopover defaultOpen={false}>
          <IrisPopoverTrigger data-iris-popover-trigger>Open</IrisPopoverTrigger>
          <IrisPopoverContent portalTarget={false}>
            <p>Popover content</p>
          </IrisPopoverContent>
        </IrisPopover>
      </div>
    )
  }

  it('Popover contract', async () => {
    const { container } = render(() => <PopoverContractHarness />)
    await runContract(popoverScenario, driverFor(container), expect)
  })

  function DrawerContractHarness() {
    return (
      <div>
        <IrisDrawer>
          <IrisDrawerTrigger data-iris-drawer-trigger>Open</IrisDrawerTrigger>
          <IrisDrawerContent portalTarget={false}>
            <p>Drawer content</p>
          </IrisDrawerContent>
        </IrisDrawer>
      </div>
    )
  }

  it('Drawer contract', async () => {
    const { container } = render(() => <DrawerContractHarness />)
    await runContract(drawerScenario, driverFor(container), expect)
  })

  function DropdownContractHarness() {
    return (
      <div>
        <IrisDropdown>
          <IrisDropdownTrigger data-iris-dropdown-trigger>Open</IrisDropdownTrigger>
          <IrisDropdownMenu portalTarget={false}>
            <p>Dropdown content</p>
          </IrisDropdownMenu>
        </IrisDropdown>
      </div>
    )
  }

  it('satisfies the shared Dropdown contract', async () => {
    const { container } = render(() => <DropdownContractHarness />)
    await runContract(dropdownScenario, driverFor(container), expect)
  })

  function TooltipContractHarness() {
    return (
      <div>
        <IrisTooltip content="Hello" openDelay={0} portalTarget={false} data-iris-tooltip-trigger>
          <span>hover me</span>
        </IrisTooltip>
      </div>
    )
  }

  it('satisfies the shared Tooltip contract', async () => {
    const { container } = render(() => <TooltipContractHarness />)
    await runContract(tooltipScenario, driverFor(container), expect)
  })

  function ComboboxContractHarness() {
    return (
      <IrisCombobox
        options={[
          { label: 'Apple', value: 'apple' },
          { label: 'Banana', value: 'banana' },
          { label: 'Apricot', value: 'apricot' },
          { label: 'Grape', value: 'grape' },
        ]}
      />
    )
  }

  it('satisfies the shared Combobox contract', async () => {
    const { container } = render(() => <ComboboxContractHarness />)
    await runContract(comboboxScenario, driverFor(container), expect)
  })

  function ToastContractHarness() {
    return (
      <div>
        <button
          type="button"
          data-iris-toast-push
          onClick={() => pushToast({ title: 'Hello Toast' })}
        >
          Push Toast
        </button>
        <IrisToastViewport portalTarget={false} />
      </div>
    )
  }

  it('satisfies the shared Toast notification contract', async () => {
    const { container } = render(() => <ToastContractHarness />)
    await runContract(toastScenario, driverFor(container), expect)
  })

  it('satisfies the shared CopyButton contract', async () => {
    const { container } = render(() => <IrisCopyButton text="hello" />)
    await runContract(copyButtonScenario, driverFor(container), expect)
  })

  it('satisfies the shared Select contract', async () => {
    const { container } = render(() => <SelectContractHarness />)
    await runContract(selectScenario, driverFor(container), expect)
  })

  it('satisfies the shared Menu contract', async () => {
    const { container } = render(() => <MenuContractHarness />)
    await runContract(menuScenario, driverFor(container), expect)
  })

  it('satisfies the shared Alert contract', async () => {
    const { container } = render(() => <IrisAlert closable>Hello</IrisAlert>)
    await runContract(alertScenario, driverFor(container), expect)
  })

  it('satisfies the shared Banner contract', async () => {
    const { container } = render(() => <IrisBanner closable>Hello</IrisBanner>)
    await runContract(bannerScenario, driverFor(container), expect)
  })

  it('satisfies the shared SplitButton contract', async () => {
    const { container } = render(() => (
      <IrisSplitButton
        actions={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
      >
        Main
      </IrisSplitButton>
    ))
    await runContract(splitButtonScenario, driverFor(container), expect)
  })

  it('satisfies the shared List keyboard contract', async () => {
    const { container } = render(() => (
      <IrisList
        items={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Bravo' },
          { value: 'c', label: 'Charlie' },
        ]}
      />
    ))
    await runContract(listKeyboardScenario, driverFor(container), expect)
  })

  it('satisfies the shared Form contract', async () => {
    const { container } = render(() => <FormContractHarness />)
    await runContract(formScenario, driverFor(container), expect)
  })
})
