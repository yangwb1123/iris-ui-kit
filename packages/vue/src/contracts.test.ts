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
  tooltipScenario,
  calendarScenario,
  calendarNavScenario,
  rangeSliderScenario,
  tagInputScenario,
  otpInputScenario,
  dataSourceScenario,
  dataSourceAsyncScenario,
  dataSourceResilientScenario,
  dialogScenario,
  popoverScenario,
  drawerScenario,
  overlayFocusScenario,
  overlayDestroyScenario,
  dropdownScenario,
  comboboxScenario,
  toastScenario,
  copyButtonScenario,
  splitButtonScenario,
  selectScenario,
  menuScenario,
  alertScenario,
  bannerScenario,
  formScenario,
  listKeyboardScenario,
  tableCellEditScenario,
  tableColumnResizeScenario,
} from '@iris-ui-kit/core/contracts'
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
  ColumnResizeHarness,
} from './contracts-harnesses'
import {
  DataSourceHarness,
  DataSourceAsyncHarness,
  DataSourceResilientHarness,
} from './contracts-harnesses-data'
import { IrisList } from './primitives/list/List'
import { IrisTable } from './primitives/table/Table'
import { IrisTree } from './primitives/tree/Tree'
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
import { IrisTooltip } from './primitives/tooltip/Tooltip'
import { IrisCombobox } from './primitives/combobox/Combobox'
import { IrisCopyButton } from './primitives/copy-button/CopyButton'
import { IrisAlert } from './primitives/alert/Alert'
import { IrisBanner } from './primitives/banner/Banner'
import { IrisSplitButton } from './primitives/split-button/SplitButton'
import { SelectContractHarness } from './SelectContractHarness'
import { MenuContractHarness } from './MenuContractHarness'
import { FormContractHarness } from './FormContractHarness'
import { IrisToastViewport } from './primitives/toast'
import { pushToast, clearToasts } from './primitives/toast/store'

enableAutoUnmount(afterEach)

afterEach(() => {
  clearToasts()
})

describe('@iris-ui-kit/vue — cross-framework behavior contracts', () => {
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
      mountProps: Record<string, unknown> = {},
    ) =>
    async (scenario: Parameters<typeof runContract>[0]) => {
      const el = makeHost()
      const wrapper = mount(harness, { attachTo: el, props: mountProps })
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
  it('satisfies the shared Calendar keyboard-roving contract', () =>
    run(CalendarHarness, undefined, {
      initialValue: new Date(2024, 5, 10),
      min: new Date(2024, 5, 10),
      max: new Date(2024, 6, 20),
      locale: 'en-US',
    })(calendarNavScenario))
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

  it('satisfies the shared Table column-resize contract', async () => {
    // Controlled first-column width (initial 200) so `measure()` returns the
    // override, not jsdom's layout-less 0; the probe exposes it observably.
    const el = makeHost()
    const wrapper = mount(ColumnResizeHarness, { attachTo: el })
    await nextTick()
    await runContract(tableColumnResizeScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Table cell-edit contract', async () => {
    const el = makeHost()
    const wrapper = mount(IrisTable, {
      attachTo: el,
      props: {
        columns: [
          { key: 'name', title: 'Name', editable: true },
          { key: 'age', title: 'Age' },
        ],
        data: [
          { id: '1', name: 'Charlie', age: 30 },
          { id: '2', name: 'Alpha', age: 25 },
          { id: '3', name: 'Bravo', age: 35 },
        ],
      },
    })
    await runContract(tableCellEditScenario, driverFor(wrapper.element as HTMLElement), expect)
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
    mount(
      () =>
        h(
          IrisDialog,
          { defaultOpen: false, closeOnOutsideClick: false },
          {
            default: () => [
              h(IrisDialogTrigger, { 'data-iris-dialog-trigger': '' }, () => 'Open'),
              h(IrisDialogContent, { teleport: false }, () => h('p', 'Dialog body')),
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
    mount(
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

  it('satisfies the shared Tooltip contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mount(
      () =>
        h(
          IrisTooltip,
          { content: 'Tooltip text', openDelay: 0, closeDelay: 0, teleport: false },
          {
            default: () => h('button', { 'data-iris-tooltip-trigger': '' }, 'Hover me'),
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(tooltipScenario, driverFor(host), expect)
  })

  it('satisfies the shared Drawer contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mount(
      () =>
        h(
          IrisDrawer,
          { defaultOpen: false, closeOnOutsideClick: false },
          {
            default: () => [
              h(IrisDrawerTrigger, { 'data-iris-drawer-trigger': '' }, () => 'Open'),
              h(IrisDrawerContent, { teleport: false }, () => h('p', 'Drawer body')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(drawerScenario, driverFor(host), expect)
  })

  it('satisfies the shared overlay focus-lifecycle contract', async () => {
    // Inline overlay (`teleport: false`) so the container-scoped [role="dialog"]
    // count works; focus assertions read the in-container trigger via global
    // document.activeElement (so portaling would be irrelevant either way).
    const host = document.createElement('div')
    document.body.appendChild(host)
    mount(
      () =>
        h(
          IrisDialog,
          { defaultOpen: false, closeOnOutsideClick: false },
          {
            default: () => [
              h(IrisDialogTrigger, { 'data-iris-dialog-trigger': '' }, () => 'Open'),
              h(IrisDialogContent, { teleport: false }, () => h('p', 'Dialog body')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(overlayFocusScenario, driverFor(host), expect)
  })

  it('satisfies the shared overlay destroy/cleanup contract', async () => {
    // Overlay PORTALS to document.body (default teleport — no `teleport: false`),
    // so the document-scoped (`global: true`) assertions exercise portal cleanup
    // on unmount. The driver's `unmount` tears down the whole component.
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
              h(IrisDialogContent, () => h('p', 'Dialog body')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(
      overlayDestroyScenario,
      driverFor(host, () => wrapper.unmount()),
      expect,
    )
  })

  it('satisfies the shared Dropdown contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mount(
      () =>
        h(
          IrisDropdown,
          { defaultOpen: false },
          {
            default: () => [
              h(IrisDropdownTrigger, { 'data-iris-dropdown-trigger': '' }, () => 'Open'),
              h(IrisDropdownMenu, { teleport: false }, () => h('p', 'Dropdown body')),
            ],
          },
        ),
      { attachTo: host },
    )
    await nextTick()
    await runContract(dropdownScenario, driverFor(host), expect)
  })

  it('satisfies the shared Combobox contract', async () => {
    const el = makeHost()
    mount(
      () =>
        h(IrisCombobox, {
          options: [
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana' },
            { label: 'Apricot', value: 'apricot' },
            { label: 'Grape', value: 'grape' },
          ],
        }),
      { attachTo: el },
    )
    await nextTick()
    await runContract(comboboxScenario, driverFor(el), expect)
  })

  it('satisfies the shared Toast notification contract', async () => {
    const el = makeHost()
    mount(
      () =>
        h('div', [
          h(
            'button',
            {
              type: 'button',
              'data-iris-toast-push': '',
              onClick: () => pushToast({ title: 'Hello Toast' }),
            },
            'Push Toast',
          ),
          h(IrisToastViewport, { portalTarget: false }),
        ]),
      { attachTo: el },
    )
    await nextTick()
    await runContract(toastScenario, driverFor(el), expect)
  })

  it('satisfies the shared CopyButton contract', async () => {
    const el = makeHost()
    mount(() => h(IrisCopyButton, { text: 'hello' }), { attachTo: el })
    await nextTick()
    await runContract(copyButtonScenario, driverFor(el), expect)
  })

  it('satisfies the shared Alert contract', async () => {
    const el = makeHost()
    mount(() => h(IrisAlert, { closable: true }, { default: () => 'Hello' }), { attachTo: el })
    await nextTick()
    await runContract(alertScenario, driverFor(el), expect)
  })

  it('satisfies the shared Banner contract', async () => {
    const el = makeHost()
    mount(() => h(IrisBanner, { closable: true }, { default: () => 'Hello' }), { attachTo: el })
    await nextTick()
    await runContract(bannerScenario, driverFor(el), expect)
  })

  it('satisfies the shared SplitButton contract', async () => {
    const el = makeHost()
    mount(
      () =>
        h(
          IrisSplitButton,
          {
            actions: [
              { key: 'a', label: 'A' },
              { key: 'b', label: 'B' },
            ],
          },
          {
            default: () => 'Main',
          },
        ),
      { attachTo: el },
    )
    await nextTick()
    await runContract(splitButtonScenario, driverFor(el), expect)
  })

  it('satisfies the shared Select contract', async () => {
    const el = makeHost()
    mount(() => h(SelectContractHarness), { attachTo: el })
    await nextTick()
    await runContract(selectScenario, driverFor(el), expect)
  })

  it('satisfies the shared Menu contract', async () => {
    const el = makeHost()
    mount(() => h(MenuContractHarness), { attachTo: el })
    await nextTick()
    await runContract(menuScenario, driverFor(el), expect)
  })

  it('satisfies the shared DataSource contract', async () => {
    const el = makeHost()
    const wrapper = mount(DataSourceHarness, { attachTo: el })
    await nextTick()
    await nextTick()
    await runContract(dataSourceScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared async DataSource contract', async () => {
    const el = makeHost()
    const wrapper = mount(DataSourceAsyncHarness, { attachTo: el })
    await nextTick()
    await nextTick()
    await runContract(dataSourceAsyncScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared resilient DataSource contract', async () => {
    const el = makeHost()
    const wrapper = mount(DataSourceResilientHarness, { attachTo: el })
    await nextTick()
    await nextTick()
    await runContract(
      dataSourceResilientScenario,
      driverFor(wrapper.element as HTMLElement),
      expect,
    )
  })

  it('satisfies the shared List keyboard contract', async () => {
    const el = makeHost()
    mount(IrisList, {
      attachTo: el,
      props: {
        items: [
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Bravo' },
          { value: 'c', label: 'Charlie' },
        ],
      },
    })
    await nextTick()
    await runContract(listKeyboardScenario, driverFor(el), expect)
  })

  it('satisfies the shared Form contract', async () => {
    const el = makeHost()
    mount(() => h(FormContractHarness), { attachTo: el })
    await nextTick()
    await runContract(formScenario, driverFor(el), expect)
  })
})
