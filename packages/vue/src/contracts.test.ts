import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
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
import { IrisRangeSlider } from './primitives/range-slider/RangeSlider'
import { IrisRadioGroup, IrisRadio } from './primitives/radio/Radio'
import { IrisNumberInput } from './primitives/number-input/NumberInput'
import { IrisRating } from './primitives/rating/Rating'
import { IrisPagination } from './primitives/pagination/Pagination'
import { IrisStepper } from './primitives/stepper/Stepper'
import { IrisStepperStep } from './primitives/stepper/StepperStep'
import { IrisTable } from './primitives/table/Table'
import { IrisTree } from './primitives/tree/Tree'
import { IrisCalendar } from './primitives/calendar/Calendar'
import { IrisTagInput } from './primitives/tag-input/TagInput'
import { IrisOtpInput } from './primitives/otp-input/OtpInput'

enableAutoUnmount(afterEach)

/**
 * A ContractDriver over a mounted root element. Clicks/keys are native DOM
 * events dispatched on the resolved element (bubbling+cancelable, so Vue's
 * listeners fire); `flush()` awaits a `nextTick()` so the post-step DOM is final
 * before assertions read it. A click on a `<input type=checkbox>` toggles its
 * `.checked` and fires the `change` event the Switch listens to in jsdom.
 */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el)
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    },
    flush: () => nextTick(),
  }
}

/**
 * IrisSwitch is v-model based, so mount it inside a tiny wrapper holding a
 * reactive boolean bound with v-model — clicking the control flips the boolean,
 * re-rendering the switch with the new `aria-checked`. Starts OFF (false),
 * matching the uncontrolled React/Solid/Svelte reference.
 */
const SwitchHarness = defineComponent({
  name: 'SwitchHarness',
  setup() {
    const on = ref(false)
    return () =>
      h(IrisSwitch, {
        modelValue: on.value,
        'onUpdate:modelValue': (v: boolean) => {
          on.value = v
        },
      })
  },
})

/**
 * IrisCheckbox is v-model based (it emits on the native input's `change`), so —
 * exactly like the Switch harness — mount it inside a wrapper holding a reactive
 * boolean bound with v-model. A native click on the hidden `<input type=checkbox>`
 * toggles its `.checked` and fires `change`, flipping the boolean and re-rendering
 * the checkbox with the new `aria-checked`. Starts unchecked (false), matching the
 * uncontrolled React/Solid/Svelte reference.
 */
const CheckboxHarness = defineComponent({
  name: 'CheckboxHarness',
  setup() {
    const checked = ref(false)
    return () =>
      h(IrisCheckbox, {
        modelValue: checked.value,
        'onUpdate:modelValue': (v: boolean) => {
          checked.value = v
        },
      })
  },
})

/**
 * EXACT same setup as the React reference: IrisAccordion with two
 * IrisAccordionItem (value "a"/"b", a title each) and NO defaultValue → both
 * items collapsed by default.
 */
const AccordionHarness = defineComponent({
  name: 'AccordionHarness',
  setup() {
    return () =>
      h(IrisAccordion, null, () => [
        h(IrisAccordionItem, { value: 'a', title: 'A' }, () => 'Panel A'),
        h(IrisAccordionItem, { value: 'b', title: 'B' }, () => 'Panel B'),
      ])
  },
})

/** EXACT same setup as the React reference: defaultValue "a", Tab A/B/C, Panel A/B/C. */
const TabsHarness = defineComponent({
  name: 'TabsHarness',
  setup() {
    return () =>
      h(IrisTabs, { defaultValue: 'a' }, () => [
        h(IrisTabsList, null, () => [
          h(IrisTabsTrigger, { value: 'a' }, () => 'Tab A'),
          h(IrisTabsTrigger, { value: 'b' }, () => 'Tab B'),
          h(IrisTabsTrigger, { value: 'c' }, () => 'Tab C'),
        ]),
        h(IrisTabsContent, { value: 'a' }, () => 'Panel A'),
        h(IrisTabsContent, { value: 'b' }, () => 'Panel B'),
        h(IrisTabsContent, { value: 'c' }, () => 'Panel C'),
      ])
  },
})

/**
 * IrisSegmented is v-model based (options + modelValue), so — like the Switch
 * harness — mount it inside a wrapper holding a reactive string bound with
 * v-model. Clicking a segment emits `update:modelValue`, flipping the ref and
 * re-rendering with the new `aria-checked`. Starts on "a", matching the
 * uncontrolled React reference (`defaultValue="a"` over three options a/b/c).
 */
const SegmentedHarness = defineComponent({
  name: 'SegmentedHarness',
  setup() {
    const value = ref('a')
    return () =>
      h(IrisSegmented, {
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
        ],
        modelValue: value.value,
        'onUpdate:modelValue': (v: string) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisToggleGroup (`type="single"`) is v-model based (modelValue: string | null),
 * so — like the Switch harness — mount it inside a wrapper holding a reactive
 * string bound with v-model, rendering three IrisToggleGroupItem children with
 * values a/b/c. Clicking a distinct item emits `update:modelValue`, flipping the
 * ref and re-rendering with the new `aria-checked` (radio semantics). Starts on
 * "a", matching the uncontrolled React reference (`defaultValue="a"`).
 */
const ToggleGroupHarness = defineComponent({
  name: 'ToggleGroupHarness',
  setup() {
    const value = ref<string | null>('a')
    return () =>
      h(
        IrisToggleGroup,
        {
          type: 'single',
          modelValue: value.value,
          'onUpdate:modelValue': (v: string | string[] | null) => {
            value.value = (v as string | null) ?? null
          },
        },
        () => [
          h(IrisToggleGroupItem, { value: 'a' }, () => 'A'),
          h(IrisToggleGroupItem, { value: 'b' }, () => 'B'),
          h(IrisToggleGroupItem, { value: 'c' }, () => 'C'),
        ],
      )
  },
})

/**
 * IrisToggleGroup (`type="multiple"`) is the multi-selection counterpart: its
 * `modelValue` is a `string[]`, so — like the single-mode harness — mount it
 * inside a wrapper holding a reactive `string[]` bound with v-model, rendering
 * three IrisToggleGroupItem children with values a/b/c. In multiple mode items
 * expose `aria-pressed` (toggle, not radio) and each toggles INDEPENDENTLY:
 * pressing a second item emits `update:modelValue` with the combined array
 * (first stays pressed), and re-pressing an active item removes it from the
 * array (toggles off). Starts EMPTY (`[]`) → none pressed, matching the
 * uncontrolled React reference (`defaultValue={[]}`).
 */
const ToggleGroupMultiHarness = defineComponent({
  name: 'ToggleGroupMultiHarness',
  setup() {
    const value = ref<string[]>([])
    return () =>
      h(
        IrisToggleGroup,
        {
          type: 'multiple',
          modelValue: value.value,
          'onUpdate:modelValue': (v: string | string[] | null) => {
            value.value = Array.isArray(v) ? v : v == null ? [] : [v]
          },
        },
        () => [
          h(IrisToggleGroupItem, { value: 'a' }, () => 'A'),
          h(IrisToggleGroupItem, { value: 'b' }, () => 'B'),
          h(IrisToggleGroupItem, { value: 'c' }, () => 'C'),
        ],
      )
  },
})

/**
 * IrisSlider is v-model based (modelValue: number), so — like the Switch harness —
 * mount it inside a wrapper holding a reactive number bound with v-model. Keyboard
 * input on the `[role="slider"]` thumb emits `update:modelValue`, flipping the ref
 * and re-rendering with the new `aria-valuenow`. Starts at 50 over min=0/max=100/
 * step=10, matching the uncontrolled React reference (`defaultValue={50}`).
 */
const SliderHarness = defineComponent({
  name: 'SliderHarness',
  setup() {
    const value = ref(50)
    return () =>
      h(IrisSlider, {
        modelValue: value.value,
        min: 0,
        max: 100,
        step: 10,
        label: 'Volume',
        'onUpdate:modelValue': (v: number) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisRangeSlider is v-model based with a two-element `[number, number]`
 * modelValue (start/end), so — like the Slider harness — mount it inside a
 * wrapper holding a reactive tuple bound with v-model. Each thumb
 * (`[data-iris-range-slider-thumb]`, `role="slider"`) owns its own
 * `aria-valuenow`; ArrowRight/Left on a thumb emits `update:modelValue` with the
 * new tuple, flipping the ref and re-rendering only that thumb's value (the two
 * thumbs are independent and never cross). Starts at `[20, 80]` over min=0/
 * max=100/step=10, matching the uncontrolled React reference
 * (`defaultValue={[20, 80]}`).
 */
const RangeSliderHarness = defineComponent({
  name: 'RangeSliderHarness',
  setup() {
    const value = ref<[number, number]>([20, 80])
    return () =>
      h(IrisRangeSlider, {
        modelValue: value.value,
        min: 0,
        max: 100,
        step: 10,
        'onUpdate:modelValue': (v: readonly [number, number]) => {
          value.value = [v[0], v[1]]
        },
      })
  },
})

/**
 * IrisRadioGroup is v-model based (modelValue: string | null), so — like the
 * Switch/ToggleGroup harnesses — mount it inside a wrapper holding a reactive
 * string bound with v-model, rendering three IrisRadio children with values
 * a/b/c. A native click on a distinct radio's hidden `<input type=radio>` fires
 * `change`, routing `setValue(value)` to the group which emits
 * `update:modelValue`, flipping the ref and re-rendering every radio wrapper
 * with the new `data-state` (single-selection: the prior sibling auto-unchecks).
 * Starts on "a", matching the uncontrolled React reference (`defaultValue="a"`).
 */
const RadioHarness = defineComponent({
  name: 'RadioHarness',
  setup() {
    const value = ref<string | null>('a')
    return () =>
      h(
        IrisRadioGroup,
        {
          modelValue: value.value,
          'onUpdate:modelValue': (v: string | number | boolean) => {
            value.value = v as string
          },
        },
        () => [
          h(IrisRadio, { value: 'a' }, () => 'A'),
          h(IrisRadio, { value: 'b' }, () => 'B'),
          h(IrisRadio, { value: 'c' }, () => 'C'),
        ],
      )
  },
})

/**
 * IrisNumberInput is v-model based (modelValue: number | null), so — like the
 * Slider harness — mount it inside a wrapper holding a reactive number bound with
 * v-model. Clicking the inc/dec buttons calls `increment(±1)`, emitting
 * `update:modelValue`, flipping the ref and re-rendering the `[role="spinbutton"]`
 * input with the new `aria-valuenow`. Starts at 5 over min=0/max=10/step=1,
 * matching the uncontrolled React reference (`defaultValue={5}`).
 */
const NumberInputHarness = defineComponent({
  name: 'NumberInputHarness',
  setup() {
    const value = ref<number | null>(5)
    return () =>
      h(IrisNumberInput, {
        modelValue: value.value,
        min: 0,
        max: 10,
        step: 1,
        'aria-label': 'Quantity',
        'onUpdate:modelValue': (v: number | null) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisRating is v-model based (modelValue: number), so — like the Slider harness —
 * mount it inside a wrapper holding a reactive number bound with v-model. Clicking a
 * star emits `update:modelValue` (whole-star, no allowHalf → star index i sets i+1),
 * flipping the ref and re-rendering the `[role="slider"][data-iris-rating]` container
 * with the new `aria-valuenow`. Starts at 0 over max=5, matching the uncontrolled
 * React reference (`defaultValue={0}`). Unlike Slider, IrisRating puts `role="slider"`
 * on its OWN root element, so we wrap it in a host `<div>` — the driver's
 * `container.querySelectorAll` only matches descendants, mirroring React's `render`
 * container that wraps the component.
 */
const RatingHarness = defineComponent({
  name: 'RatingHarness',
  setup() {
    const value = ref(0)
    return () =>
      h('div', null, [
        h(IrisRating, {
          modelValue: value.value,
          max: 5,
          'aria-label': 'Score',
          'onUpdate:modelValue': (v: number) => {
            value.value = v
          },
        }),
      ])
  },
})

/**
 * IrisPagination is modelValue-based (emits `update:modelValue`), so — like the
 * Slider harness — mount it inside a wrapper holding a reactive number bound with
 * v-model. Clicking a page button emits `update:modelValue`, flipping the ref and
 * re-rendering with `aria-current="page"` moved to the new active page button.
 * Starts at 1 over total=30/pageSize=10 (→ exactly 3 always-visible page buttons,
 * no ellipsis), matching the uncontrolled React reference (`defaultValue={1}`).
 */
const PaginationHarness = defineComponent({
  name: 'PaginationHarness',
  setup() {
    const value = ref(1)
    return () =>
      h(IrisPagination, {
        modelValue: value.value,
        total: 30,
        pageSize: 10,
        'onUpdate:modelValue': (v: number) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisStepper is modelValue-based (emits `update:modelValue`) and is a compound
 * component (IrisStepper + IrisStepperStep children, passed via the default
 * slot exactly like ToggleGroup/Accordion). So — like the Pagination harness —
 * mount it inside a wrapper holding a reactive step index bound with v-model,
 * rendering three IrisStepperStep children. With `linear: false`, every step's
 * `[data-iris-stepper-step-trigger]` button is clickable; clicking one calls
 * `goTo`, emitting `update:modelValue`, flipping the ref and re-rendering with
 * `aria-current="step"` moved to the new active step `<li>`. Starts at 0 over
 * three steps, matching the uncontrolled React reference (`defaultValue={0}`).
 */
const StepperHarness = defineComponent({
  name: 'StepperHarness',
  setup() {
    const value = ref(0)
    return () =>
      h(
        IrisStepper,
        {
          modelValue: value.value,
          linear: false,
          'onUpdate:modelValue': (v: number) => {
            value.value = v
          },
        },
        () => [
          h(IrisStepperStep, { title: 'Step 1' }),
          h(IrisStepperStep, { title: 'Step 2' }),
          h(IrisStepperStep, { title: 'Step 3' }),
        ],
      )
  },
})

/**
 * IrisCalendar is modelValue-based (a `Date | null`), so — like the Slider
 * harness — mount it inside a wrapper holding a reactive `Date | null` bound with
 * v-model. Clicking a day cell emits `update:modelValue` with that date, flipping
 * the ref and re-rendering with `aria-selected` moved to the newly-selected day
 * (single-date: the prior day clears). `defaultMonth` fixes the visible month to
 * June 2024 so the `2024-06-10`/`2024-06-20` day cells are deterministic. Starts
 * with `null` (nothing selected), matching the uncontrolled React reference
 * (no `defaultValue`).
 */
const CalendarHarness = defineComponent({
  name: 'CalendarHarness',
  setup() {
    const value = ref<Date | null>(null)
    return () =>
      h(IrisCalendar, {
        modelValue: value.value,
        defaultMonth: new Date(2024, 5, 1),
        'onUpdate:modelValue': (v: Date | null) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisTagInput is modelValue-based with a `string[]` value, so — like the Slider
 * harness — mount it inside a wrapper holding a reactive `string[]` bound with
 * v-model. Each tag renders a `[data-iris-tag-input-tag][data-value="<tag>"]`
 * chip plus a `[data-iris-tag-input-remove]` button; clicking a remove button
 * emits `update:modelValue` with that index filtered out, flipping the ref and
 * re-rendering the chip list (the removed tag drops, the rest shift down).
 * Starts with `['Alpha', 'Bravo', 'Charlie']`, matching the uncontrolled
 * React/Solid/Svelte reference (`defaultValue={['Alpha', 'Bravo', 'Charlie']}`).
 */
const TagInputHarness = defineComponent({
  name: 'TagInputHarness',
  setup() {
    const value = ref<string[]>(['Alpha', 'Bravo', 'Charlie'])
    return () =>
      h(IrisTagInput, {
        modelValue: value.value,
        'onUpdate:modelValue': (v: string[]) => {
          value.value = v
        },
      })
  },
})

/**
 * IrisOtpInput is modelValue-based (a contiguous `string`) over a `length` prop,
 * so — like the Slider harness — mount it inside a wrapper holding a reactive
 * string bound with v-model. The component renders `length` cells, each a
 * `[data-iris-otp-input-cell]` `<input>` carrying `data-filled="true"` when it
 * holds a char (absent → null when empty). Its keydown handler is bound PER-CELL
 * capturing that cell's index (`onKeydown: (e) => onKeyDown(i, e)`), so the
 * driver's keydown on the index-th cell fires the right handler directly without
 * relying on focus — Backspace on a filled cell emits `update:modelValue` with
 * that char removed, flipping the ref and re-rendering the contracted (still
 * contiguous) value. Starts with `'123'` over `length=5`, matching the
 * React/Solid reference (uncontrolled `defaultValue="123"`).
 */
const OtpInputHarness = defineComponent({
  name: 'OtpInputHarness',
  setup() {
    const value = ref('123')
    return () =>
      h(IrisOtpInput, {
        modelValue: value.value,
        length: 5,
        'onUpdate:modelValue': (v: string) => {
          value.value = v
        },
      })
  },
})

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

/**
 * Drives the Vue `useDataSource` bridge over the SAME `createSyncClientDataSource`
 * data/columns as the React reference. The bridge mirrors the core store into a
 * reactive `state` ref (a `shallowRef` updated on every store emission), so reading
 * `ds.state.value.rows` inside the render function tracks reactively — setSort /
 * setFilter / clearFilters re-render the row list. Renders the shared selectors:
 * `data-iris-ds-sort` / `data-iris-ds-filter` / `data-iris-ds-clear` triggers and a
 * `data-iris-ds-row` per live row (text = the row's `name`). A thin bridge — all
 * logic lives in `@iris-ui/core`.
 */
const DataSourceHarness = defineComponent({
  name: 'DataSourceHarness',
  setup() {
    const ds = useDataSource<DsRow>({
      fetcher: createSyncClientDataSource(dsData, dsColumns),
      pageSize: 10,
    })
    return () =>
      h('div', null, [
        h(
          'button',
          {
            'data-iris-ds-sort': '',
            onClick: () => ds.setSort({ key: 'age', direction: 'asc' }),
          },
          'sort',
        ),
        h(
          'button',
          {
            'data-iris-ds-filter': '',
            onClick: () => ds.setFilter('name', 'li'),
          },
          'filter',
        ),
        h(
          'button',
          {
            'data-iris-ds-clear': '',
            onClick: () => ds.clearFilters(),
          },
          'clear',
        ),
        ...ds.state.value.rows.map((r) => h('div', { key: r.id, 'data-iris-ds-row': '' }, r.name)),
      ])
  },
})

describe('@iris-ui/vue — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(TabsHarness, { attachTo: host })
    await nextTick()
    await runContract(tabsScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(SwitchHarness, { attachTo: host })
    await nextTick()
    await runContract(switchScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Checkbox contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(CheckboxHarness, { attachTo: host })
    await nextTick()
    await runContract(checkboxScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(AccordionHarness, { attachTo: host })
    await nextTick()
    await runContract(accordionScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Segmented contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(SegmentedHarness, { attachTo: host })
    await nextTick()
    await runContract(segmentedScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared single-mode ToggleGroup contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(ToggleGroupHarness, { attachTo: host })
    await nextTick()
    await runContract(toggleGroupScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared multiple-mode ToggleGroup contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(ToggleGroupMultiHarness, { attachTo: host })
    await nextTick()
    await runContract(toggleGroupMultiScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Slider keyboard contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(SliderHarness, { attachTo: host })
    await nextTick()
    await runContract(sliderScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared RangeSlider contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(RangeSliderHarness, { attachTo: host })
    await nextTick()
    await runContract(rangeSliderScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Radio contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(RadioHarness, { attachTo: host })
    await nextTick()
    await runContract(radioScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared NumberInput contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(NumberInputHarness, { attachTo: host })
    await nextTick()
    await runContract(numberInputScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Rating contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(RatingHarness, { attachTo: host })
    await nextTick()
    await runContract(ratingScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Pagination contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(PaginationHarness, { attachTo: host })
    await nextTick()
    await runContract(paginationScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Stepper contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(StepperHarness, { attachTo: host })
    await nextTick()
    await runContract(stepperScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  /**
   * IrisTable manages sort UNCONTROLLED by default: the `sort` prop is omitted
   * (`undefined`), so the table keeps internal sort state and cycles it on each
   * header click (none → asc → desc → none) — no v-model harness needed, so we
   * mount it directly like the React reference. The sortable `name` column
   * header (`[data-iris-table-header="name"]`, `role="columnheader"`) exposes
   * `aria-sort` reflecting that state. Same `{ key, title, sortable }` column
   * shape + `data` array as every other adapter.
   */
  it('satisfies the shared Table sort contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(IrisTable, {
      attachTo: host,
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

  /**
   * IrisTable manages row selection UNCONTROLLED by default: with `selectable`
   * "multi" and no controlled selection prop, the table keeps an internal
   * selection model and toggles it per-row on each row-checkbox click (multi =
   * independent toggles) — no v-model harness needed, so we mount it directly
   * like the React reference. Each selectable body row (`[role="row"]`) carries
   * `aria-selected` ("true"/"false"); selection checkboxes are the native
   * `input[type="checkbox"]` rendered by IrisCheckbox (index 0 = the master
   * select-all in the header, body-row checkboxes follow at 1/2/3).
   */
  it('satisfies the shared Table multi row-selection contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(IrisTable, {
      attachTo: host,
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

  /**
   * IrisTable accepts the expandable detail panel via the `renderDetail` PROP (a
   * function `(row, rowIndex) => VNodeChild`, per types.ts) — NOT a slot — so we
   * mount it directly like the React reference, passing `renderDetail` in `props`.
   * Providing it adds a leading expand-toggle column where every row gets a
   * `[data-iris-table-expand-toggle]` button owning `aria-expanded`. Expansion is
   * UNCONTROLLED by default (no controlled prop → the internal core `createExpansion`
   * model toggles on click), so no v-model harness is needed. Clicking a toggle
   * mounts/unmounts that row's full-width `[data-iris-table-detail-cell]`. Same
   * `{ key, title }` column shape + three-row `data` array as the other adapters.
   */
  it('satisfies the shared Table expandable-detail contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(IrisTable, {
      attachTo: host,
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

  /**
   * IrisTree manages expansion + roving focus UNCONTROLLED by default: with no
   * `expanded`/`selected` props it keeps internal state, so we mount it directly
   * like the React reference, passing the `nodes` array (`{ id, label, children }`
   * shape) in `props`. The tree starts collapsed (no `defaultExpanded`) with the
   * first node roving-active (`tabindex="0"`); the rest are `-1`. Vue attaches its
   * keydown handler PER-ITEM (`onKeyDown(event, flatNode)`), but `role="treeitem"`
   * and `tabindex` live on the SAME element, so the scenario's `[role="treeitem"]
   * [tabindex="0"]` target dispatches the bubbling keydown straight onto the active
   * item — firing its handler directly. ArrowRight expands the active parent
   * (revealing its two children → 4 visible items), ArrowDown roves focus to the
   * first child, and ArrowLeft from that leaf child returns focus to the parent.
   */
  it('satisfies the shared Tree keyboard contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(IrisTree, {
      attachTo: host,
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

  /**
   * IrisCalendar is modelValue-based, so we mount it via the CalendarHarness
   * (a `ref<Date | null>(null)` bound with v-model) with `defaultMonth` fixed to
   * June 2024. Day cells carry `data-iris-calendar-day-iso="YYYY-MM-DD"` +
   * `aria-selected` ("true"/"false"); clicking June-10 then June-20 moves the
   * single-date selection, matching the React/Solid/Svelte reference.
   */
  it('satisfies the shared Calendar contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(CalendarHarness, { attachTo: host })
    await nextTick()
    await runContract(calendarScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared TagInput contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(TagInputHarness, { attachTo: host })
    await nextTick()
    await runContract(tagInputScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared OtpInput contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(OtpInputHarness, { attachTo: host })
    await nextTick()
    await runContract(otpInputScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  /**
   * The Vue `useDataSource` bridge over `createDataSource` (the unified data
   * engine) — mounted via the DataSourceHarness whose render function reads
   * `ds.state.value.rows` (a reactive `shallowRef`), so setSort / setFilter /
   * clearFilters re-render the row list. The harness kicks its initial sync
   * client load from `onMounted`, so we await one extra `nextTick()` after mount
   * for the first rows to render before the driver runs. Same data/columns/
   * behavior as the React reference.
   */
  it('satisfies the shared DataSource contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(DataSourceHarness, { attachTo: host })
    await nextTick()
    await nextTick()
    await runContract(dataSourceScenario, driverFor(wrapper.element as HTMLElement), expect)
  })
})
