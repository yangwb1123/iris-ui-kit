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
  type ContractDriver,
} from '@iris-ui/core/contracts'
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
import { IrisRadioGroup, IrisRadio } from './primitives/radio/Radio'
import { IrisNumberInput } from './primitives/number-input/NumberInput'
import { IrisRating } from './primitives/rating/Rating'
import { IrisPagination } from './primitives/pagination/Pagination'
import { IrisStepper } from './primitives/stepper/Stepper'
import { IrisStepperStep } from './primitives/stepper/StepperStep'
import { IrisTable } from './primitives/table/Table'

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
})
