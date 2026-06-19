import { defineComponent, h, nextTick, ref } from 'vue'
import type { ContractDriver } from '@iris-ui/core/contracts'
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
import { IrisCalendar } from './primitives/calendar/Calendar'
import { IrisTagInput } from './primitives/tag-input/TagInput'
import { IrisOtpInput } from './primitives/otp-input/OtpInput'
import { IrisTable } from './primitives/table/Table'

/**
 * A ContractDriver over a Vue-test-utils mounted container. Pass the mounted
 * wrapper's `unmount` (e.g. `() => wrapper.unmount()`) to drive the
 * destroy/cleanup contract; the default no-op suffices for scenarios that never
 * use the `'unmount'` action (the interface still requires the method).
 */
export function driverFor(container: HTMLElement, unmount: () => void = () => {}): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    unmount,
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el)
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    },
    pointer: (selector, index, event) => {
      const el = at(selector, index)
      if (el) {
        const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
        if (typeof PointerCtor === 'function') {
          el.dispatchEvent(
            new (PointerCtor as typeof PointerEvent)(`pointer${event}`, {
              bubbles: true,
              cancelable: true,
            }),
          )
        } else {
          el.dispatchEvent(new Event(`pointer${event}`, { bubbles: true, cancelable: true }))
        }
      }
    },
    type: (selector, index, text) => {
      const el = at(selector, index)
      if (!el) return
      el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      ;(el as HTMLInputElement).value = text
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    },
    dblclick: (selector, index) => {
      const el = at(selector, index)
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    },
    flush: async () => {
      // Drain a few microtask rounds so async ops settle (an injectable-latency
      // fetcher resolves on a microtask; an optimistic-mutate ROLLBACK then chains
      // a second `load()` fetch) — then let Vue's scheduler render. Sync scenarios
      // are unaffected (extra microtask awaits are no-ops when nothing is pending).
      for (let i = 0; i < 4; i++) await Promise.resolve()
      await nextTick()
      // Let any pending requestAnimationFrame callbacks fire (the focus trap
      // restores focus to the trigger on close inside a rAF; DrawerContent's
      // 2-stage mount also uses rAF), then settle Vue once more. A no-op when
      // nothing is scheduled.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await nextTick()
    },
  }
}

export const SwitchHarness = defineComponent({
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

export const CheckboxHarness = defineComponent({
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

export const AccordionHarness = defineComponent({
  name: 'AccordionHarness',
  setup() {
    return () =>
      h(IrisAccordion, null, () => [
        h(IrisAccordionItem, { value: 'a', title: 'A' }, () => 'Panel A'),
        h(IrisAccordionItem, { value: 'b', title: 'B' }, () => 'Panel B'),
      ])
  },
})

export const TabsHarness = defineComponent({
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

export const SegmentedHarness = defineComponent({
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

export const ToggleGroupHarness = defineComponent({
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

export const ToggleGroupMultiHarness = defineComponent({
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

export const SliderHarness = defineComponent({
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

export const RangeSliderHarness = defineComponent({
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

export const RadioHarness = defineComponent({
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

export const NumberInputHarness = defineComponent({
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

export const RatingHarness = defineComponent({
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

export const PaginationHarness = defineComponent({
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

export const StepperHarness = defineComponent({
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

export const CalendarHarness = defineComponent({
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

export const TagInputHarness = defineComponent({
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

export const OtpInputHarness = defineComponent({
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

/**
 * Controlled column-resize harness mirroring the React reference. The first
 * column ('name') width is CONTROLLED at an initial 200 via a Vue ref bound to
 * `columnWidths` + `onUpdate:columnWidths`, so the Table's `measure()` returns
 * the explicit override (not jsdom's layout-less 0). A sibling probe element
 * exposes the current width as `data-col-width` for the contract to read.
 */
export const ColumnResizeHarness = defineComponent({
  name: 'ColumnResizeHarness',
  setup() {
    const widths = ref<Record<string, number>>({ name: 200 })
    return () =>
      h('div', null, [
        h(IrisTable, {
          resizableColumns: true,
          columnWidths: widths.value,
          'onUpdate:columnWidths': (next: Record<string, number>) => {
            widths.value = next
          },
          columns: [
            { key: 'name', title: 'Name' },
            { key: 'age', title: 'Age' },
          ],
          data: [
            { id: '1', name: 'Charlie', age: 30 },
            { id: '2', name: 'Alpha', age: 25 },
            { id: '3', name: 'Bravo', age: 35 },
          ],
        }),
        h('div', { 'data-col-width': String(widths.value.name) }),
      ])
  },
})
