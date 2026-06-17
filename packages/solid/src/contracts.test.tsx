import { afterEach, describe, expect, it } from 'vitest'
import { For } from 'solid-js'
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
  dialogScenario,
  popoverScenario,
  drawerScenario,
  dropdownScenario,
  tooltipScenario,
  comboboxScenario,
  toastScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import { createSyncClientDataSource, type DataViewColumn } from '@iris-ui/core'
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

/**
 * A ContractDriver over a Solid-testing-library container. Solid reactivity is
 * synchronous in tests, so `flush()` is a no-op; `fireEvent` settles updates.
 */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
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
    flush: () => {},
  }
}

describe('@iris-ui/solid — cross-framework behavior contracts', () => {
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
})
