import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
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
  tableExpandScenario,
  treeScenario,
  calendarScenario,
  rangeSliderScenario,
  tagInputScenario,
  otpInputScenario,
  dataSourceScenario,
  dialogScenario,
  popoverScenario,
} from '@iris-ui/core/contracts'
import {
  driverFor,
  SwitchHarness,
  CheckboxHarness,
  AccordionHarness,
  TabsHarness,
  SegmentedHarness,
  ToggleGroupHarness,
  ToggleGroupMultiHarness,
  SliderHarness,
  RangeSliderHarness,
  RadioHarness,
  NumberInputHarness,
  RatingHarness,
  PaginationHarness,
  StepperHarness,
  CalendarHarness,
  TagInputHarness,
  OtpInputHarness,
  DataSourceHarness,
} from './contracts-harnesses'
import { IrisTable } from './primitives/table/Table'
import { IrisTree } from './primitives/tree/Tree'
import { IrisDialog } from './primitives/dialog/Dialog'
import { IrisDialogTrigger } from './primitives/dialog/DialogTrigger'
import { IrisDialogContent } from './primitives/dialog/DialogContent'
import { IrisPopover } from './primitives/popover/Popover'
import { IrisPopoverTrigger } from './primitives/popover/PopoverTrigger'
import { IrisPopoverContent } from './primitives/popover/PopoverContent'

enableAutoUnmount(afterEach)

describe('@iris-ui/vue — cross-framework behavior contracts', () => {
  const makeHost = () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }
  const run =
    (
      harness: Parameters<typeof mount>[0],
      driverForEl: (wrapper: ReturnType<typeof mount>) => HTMLElement = (w) =>
        w.element as HTMLElement,
    ) =>
    async (scenario: Parameters<typeof runContract>[0]) => {
      const el = makeHost()
      const wrapper = mount(harness, { attachTo: el })
      await nextTick()
      await runContract(scenario, driverFor(driverForEl(wrapper)), expect)
    }

  it('satisfies the shared Tabs contract', () => run(TabsHarness)(tabsScenario))
  it('satisfies the shared Switch contract', () => run(SwitchHarness)(switchScenario))
  it('satisfies the shared Checkbox contract', () => run(CheckboxHarness)(checkboxScenario))
  it('satisfies the shared Accordion contract', () => run(AccordionHarness)(accordionScenario))
  it('satisfies the shared Segmented contract', () => run(SegmentedHarness)(segmentedScenario))
  it('satisfies the shared single-mode ToggleGroup contract', () =>
    run(ToggleGroupHarness)(toggleGroupScenario))
  it('satisfies the shared multiple-mode ToggleGroup contract', () =>
    run(ToggleGroupMultiHarness)(toggleGroupMultiScenario))
  it('satisfies the shared Slider keyboard contract', () => run(SliderHarness)(sliderScenario))
  it('satisfies the shared RangeSlider contract', () =>
    run(RangeSliderHarness)(rangeSliderScenario))
  it('satisfies the shared Radio contract', () => run(RadioHarness)(radioScenario))
  it('satisfies the shared NumberInput contract', () =>
    run(NumberInputHarness)(numberInputScenario))
  it('satisfies the shared Rating contract', () => run(RatingHarness)(ratingScenario))
  it('satisfies the shared Pagination contract', () => run(PaginationHarness)(paginationScenario))
  it('satisfies the shared Stepper contract', () => run(StepperHarness)(stepperScenario))
  it('satisfies the shared Calendar contract', () => run(CalendarHarness)(calendarScenario))
  it('satisfies the shared TagInput contract', () => run(TagInputHarness)(tagInputScenario))
  it('satisfies the shared OtpInput contract', () => run(OtpInputHarness)(otpInputScenario))

  it('satisfies the shared Table sort contract', async () => {
    const el = makeHost()
    const wrapper = mount(IrisTable, {
      attachTo: el,
      props: {
        columns: [
          { key: 'name', title: 'Name', sortable: true },
          { key: 'age', title: 'Age', sortable: true },
        ],
        data: [
          { id: '1', name: 'Bravo', age: 30 },
          { id: '2', name: 'Alpha', age: 25 },
          { id: '3', name: 'Charlie', age: 35 },
        ],
      },
    })
    await nextTick()
    await runContract(tableSortScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Table multi row-selection contract', async () => {
    const el = makeHost()
    const wrapper = mount(IrisTable, {
      attachTo: el,
      props: {
        selectable: 'multi',
        columns: [{ key: 'name', title: 'Name' }],
        data: [
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ],
      },
    })
    await nextTick()
    await runContract(tableSelectScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Table expandable-detail contract', async () => {
    const el = makeHost()
    const wrapper = mount(IrisTable, {
      attachTo: el,
      props: {
        columns: [{ key: 'name', title: 'Name' }],
        data: [
          { id: '1', name: 'Bravo' },
          { id: '2', name: 'Alpha' },
          { id: '3', name: 'Charlie' },
        ],
        renderDetail: (row: Record<string, unknown>) => h('div', `Detail ${String(row.name)}`),
      },
    })
    await nextTick()
    await runContract(tableExpandScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Tree keyboard contract', async () => {
    const el = makeHost()
    const wrapper = mount(IrisTree, {
      attachTo: el,
      props: {
        nodes: [
          {
            id: 'a',
            label: 'A',
            children: [
              { id: 'a1', label: 'A1' },
              { id: 'a2', label: 'A2' },
            ],
          },
          { id: 'b', label: 'B' },
        ],
      },
    })
    await nextTick()
    await runContract(treeScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Dialog contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(
      () =>
        h(
          IrisDialog,
          { defaultOpen: false, closeOnOutsideClick: false },
          {
            default: () => [
              h(IrisDialogTrigger, { 'data-iris-dialog-trigger': '' }, () => 'Open'),
              h(IrisDialogContent, { portalTarget: false }, () => h('p', 'Dialog body')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(dialogScenario, driverFor(host), expect)
  })

  it('satisfies the shared Popover contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(
      () =>
        h(
          IrisPopover,
          { defaultOpen: false },
          {
            default: () => [
              h(IrisPopoverTrigger, { 'data-iris-popover-trigger': '' }, () => 'Open'),
              h(IrisPopoverContent, { teleport: false }, () => h('p', 'Popover content')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(popoverScenario, driverFor(host), expect)
  })

  it('satisfies the shared DataSource contract', async () => {
    const el = makeHost()
    const wrapper = mount(DataSourceHarness, { attachTo: el })
    await nextTick()
    await nextTick()
    await runContract(dataSourceScenario, driverFor(wrapper.element as HTMLElement), expect)
  })
})
