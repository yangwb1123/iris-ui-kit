import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
  treeScenario,
  calendarScenario,
  rangeSliderScenario,
  tagInputScenario,
  otpInputScenario,
  dialogScenario,
  dataSourceScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import { createSyncClientDataSource, type DataViewColumn } from '@iris-ui/core'
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

afterEach(cleanup)

/** A ContractDriver over a React-testing-library container (fireEvent auto-flushes). */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) fireEvent.click(el)
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el) fireEvent.keyDown(el, { key })
    },
    flush: () => {},
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

  it('satisfies the shared DataSource contract', async () => {
    const { container } = render(<DataSourceHarness />)
    await runContract(dataSourceScenario, driverFor(container), expect)
  })
})
