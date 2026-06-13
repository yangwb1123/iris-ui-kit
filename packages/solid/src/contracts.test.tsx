import { afterEach, describe, expect, it } from 'vitest'
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
  radioScenario,
  numberInputScenario,
  ratingScenario,
  paginationScenario,
  stepperScenario,
  tableSortScenario,
  tableSelectScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
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
import { IrisRadioGroup, IrisRadio } from './primitives/radio'
import { IrisNumberInput } from './primitives/number-input'
import { IrisRating } from './primitives/rating'
import { IrisPagination } from './primitives/pagination'
import { IrisStepper, IrisStepperStep } from './primitives/stepper'
import { IrisTable } from './primitives/table/IrisTable'

afterEach(cleanup)

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
      if (el) fireEvent.click(el)
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el) fireEvent.keyDown(el, { key })
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
})
