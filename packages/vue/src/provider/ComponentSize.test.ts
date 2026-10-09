import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisProvider } from './IrisProvider'
import { IrisButton } from '../primitives/button/Button'
import { IrisInput } from '../primitives/input/Input'
import { IrisNumberInput } from '../primitives/number-input/NumberInput'
import { IrisTextarea } from '../primitives/textarea/Textarea'
import { IrisSwitch } from '../primitives/switch/Switch'
import { IrisCheckbox } from '../primitives/checkbox/Checkbox'
import { IrisRadio } from '../primitives/radio/Radio'
import { IrisRadioGroup } from '../primitives/radio/Radio'
import { IrisSelect } from '../primitives/select/Select'
import { IrisCombobox } from '../primitives/combobox/Combobox'
import { IrisToggleGroup } from '../primitives/toggle-group/ToggleGroup'
import { IrisToggleGroupItem } from '../primitives/toggle-group/ToggleGroupItem'
import { IrisDatePicker } from '../primitives/date-picker/DatePicker'
import { IrisMonthPicker } from '../primitives/month-picker/MonthPicker'

const items = [{ value: 'a', label: 'A' }]

/** Mount a tree and return the wrapper plus a size reader for a selector. */
function mountWith(node: ReturnType<typeof h>) {
  return mount(defineComponent({ render: () => node }))
}

describe('@iris-ui-kit/vue IrisProvider componentSize', () => {
  it('controls default to md with no provider', () => {
    const w = mount(IrisButton)
    expect(w.attributes('data-iris-button-size')).toBe('md')
  })

  it('a control without an explicit size inherits the nearest provider', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'lg' }, () => [
        h(IrisButton, null, { default: () => 'x' }),
        h(IrisInput),
        h(IrisNumberInput),
        h(IrisTextarea),
        h(IrisSwitch),
        h(IrisCheckbox),
        h(IrisRadio, { value: 'a' }),
        h(IrisSelect, { items }),
        h(IrisCombobox, { options: [] }),
        h(IrisToggleGroup, null, {
          default: () => h(IrisToggleGroupItem, { value: 'a' }, { default: () => 'A' }),
        }),
        h(IrisDatePicker),
        h(IrisMonthPicker),
      ]),
    )
    const sizes = (sel: string) => w.find(sel).attributes('data-iris-button-size')
    expect(w.find('[data-iris-button-size]').attributes('data-iris-button-size')).toBe('lg')
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('lg')
    expect(w.find('[data-iris-number-input-size]').attributes('data-iris-number-input-size')).toBe(
      'lg',
    )
    expect(w.find('[data-iris-textarea-size]').attributes('data-iris-textarea-size')).toBe('lg')
    expect(w.find('[data-iris-switch-size]').attributes('data-iris-switch-size')).toBe('lg')
    expect(w.find('[data-iris-checkbox-size]').attributes('data-iris-checkbox-size')).toBe('lg')
    expect(w.find('[data-iris-radio-size]').attributes('data-iris-radio-size')).toBe('lg')
    expect(w.find('[data-iris-select-size]').attributes('data-iris-select-size')).toBe('lg')
    expect(w.find('[data-iris-combobox-size]').attributes('data-iris-combobox-size')).toBe('lg')
    expect(w.find('[data-iris-toggle-group-size]').attributes('data-iris-toggle-group-size')).toBe(
      'lg',
    )
    expect(w.find('[data-iris-date-picker-size]').attributes('data-iris-date-picker-size')).toBe(
      'lg',
    )
    expect(w.find('[data-iris-month-picker-size]').attributes('data-iris-month-picker-size')).toBe(
      'lg',
    )
    expect(sizes('[data-iris-button-size]')).toBe('lg')
  })

  it('an explicit control size always overrides the provider', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'lg' }, () => [
        h(IrisButton, { size: 'sm' }, { default: () => 'x' }),
        h(IrisInput, { size: 'md' }),
        h(IrisSwitch, { size: 'sm' }),
        h(IrisSelect, { items, size: 'md' }),
      ]),
    )
    expect(w.find('[data-iris-button-size]').attributes('data-iris-button-size')).toBe('sm')
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('md')
    expect(w.find('[data-iris-switch-size]').attributes('data-iris-switch-size')).toBe('sm')
    expect(w.find('[data-iris-select-size]').attributes('data-iris-select-size')).toBe('md')
  })

  it('a nested provider without componentSize inherits its parent', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'sm' }, () => [
        h(IrisButton, null, { default: () => 'outer' }),
        h(IrisProvider, null, () => [
          h(IrisButton, null, { default: () => 'inner' }),
          h(IrisInput),
        ]),
      ]),
    )
    const buttons = w.findAll('[data-iris-button-size]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('data-iris-button-size')).toBe('sm')
    expect(buttons[1].attributes('data-iris-button-size')).toBe('sm')
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('sm')
  })

  it('a nested provider with its own componentSize wins for its subtree only', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'sm' }, () => [
        h(IrisInput),
        h(IrisProvider, { componentSize: 'lg' }, () => [h(IrisInput)]),
        h(IrisInput),
      ]),
    )
    const inputs = w.findAll('[data-iris-input-size]')
    expect(inputs.map((i) => i.attributes('data-iris-input-size'))).toEqual(['sm', 'lg', 'sm'])
  })

  it('re-renders when the provider componentSize changes', async () => {
    const size = ref<'sm' | 'md' | 'lg'>('sm')
    const Host = defineComponent({
      setup() {
        return () => h(IrisProvider, { componentSize: size.value }, () => [h(IrisInput)])
      },
    })
    const w = mount(Host)
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('sm')
    size.value = 'lg'
    await nextTick()
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('lg')
    size.value = undefined as never
    await nextTick()
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('md')
  })

  it('reacts to a control size prop change without a provider', async () => {
    const size = ref<'sm' | 'md'>('sm')
    const Host = defineComponent({
      setup() {
        return () => h(IrisInput, { size: size.value })
      },
    })
    const w = mount(Host)
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('sm')
    size.value = 'md'
    await nextTick()
    expect(w.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('md')
  })

  it('adds no wrapper element around its children', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'sm' }, () => h('div', { class: 'child' }, 'kid')),
    )
    // The provider renders exactly its child element — no extra DOM node.
    expect(w.html()).toBe('<div class="child">kid</div>')
  })

  it('independent application roots do not leak size into each other', () => {
    const a = mountWith(h(IrisProvider, { componentSize: 'lg' }, () => [h(IrisInput)]))
    const b = mountWith(h(IrisProvider, { componentSize: 'sm' }, () => [h(IrisInput)]))
    expect(a.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('lg')
    expect(b.find('[data-iris-input-size]').attributes('data-iris-input-size')).toBe('sm')
  })

  it('applies the size metrics to the real control box', () => {
    const w = mountWith(h(IrisProvider, { componentSize: 'lg' }, () => [h(IrisInput)]))
    const style = w.find('[data-iris-input]').attributes('style') ?? ''
    expect(style).toContain('min-height: var(--iris-control-height-lg, 40px)')
    expect(style).toContain('font-size: var(--iris-font-size-lg, 16px)')
  })

  it('a radio group passes its size down to its radios', () => {
    const w = mountWith(
      h(IrisProvider, { componentSize: 'lg' }, () => [
        h(IrisRadioGroup, null, () => [
          h(IrisRadio, { value: 'a' }),
          h(IrisRadio, { value: 'b', size: 'sm' }),
        ]),
      ]),
    )
    const radios = w.findAll('[data-iris-radio-size]')
    expect(radios[0].attributes('data-iris-radio-size')).toBe('lg')
    expect(radios[1].attributes('data-iris-radio-size')).toBe('sm')
  })
})

describe('@iris-ui-kit/vue control width contract', () => {
  it('IrisInput supports width + fullWidth', () => {
    const w = mount(IrisInput, { props: { width: 240 } })
    expect(w.attributes('style')).toContain('width: 240px')
    const wide = mount(IrisInput, { props: { fullWidth: true } })
    expect(wide.attributes('style')).toContain('width: 100%')
    const custom = mount(IrisInput, { props: { width: '20rem' } })
    expect(custom.attributes('style')).toContain('width: 20rem')
  })

  it('IrisNumberInput supports width + fullWidth', () => {
    expect(mount(IrisNumberInput, { props: { width: 180 } }).attributes('style')).toContain(
      'width: 180px',
    )
    expect(mount(IrisNumberInput, { props: { fullWidth: true } }).attributes('style')).toContain(
      'width: 100%',
    )
  })

  it('IrisSelect trigger supports width + fullWidth', () => {
    expect(
      mount(IrisSelect, { props: { items, width: 200 } })
        .find('[data-iris-select-trigger]')
        .attributes('style'),
    ).toContain('width: 200px')
    expect(
      mount(IrisSelect, { props: { items, fullWidth: true } })
        .find('[data-iris-select-trigger]')
        .attributes('style'),
    ).toContain('width: 100%')
  })

  it('picker triggers support width + fullWidth', () => {
    expect(
      mount(IrisDatePicker, { props: { width: 220 } })
        .find('[data-iris-date-picker-trigger]')
        .attributes('style'),
    ).toContain('width: 220px')
    expect(
      mount(IrisMonthPicker, { props: { fullWidth: true } })
        .find('[data-iris-month-picker-trigger]')
        .attributes('style'),
    ).toContain('width: 100%')
  })
})

describe('@iris-ui-kit/vue NumberInput geometry contract', () => {
  it('is border-box and its min-width covers the whole control', () => {
    const style = mount(IrisNumberInput).attributes('style') ?? ''
    expect(style).toContain('box-sizing: border-box')
    expect(style).toContain('min-width: calc(96px + 2 * var(--iris-padding-md) + 2px)')
  })

  it('drops the stepper allowance when controls are hidden', () => {
    const style =
      mount(IrisNumberInput, { props: { showControls: false } }).attributes('style') ?? ''
    expect(style).toContain('min-width: calc(40px + 2 * var(--iris-padding-md) + 2px)')
  })
})

describe('@iris-ui-kit/vue Select trigger contract', () => {
  it('keeps a min-width floor and ellipsizes long labels', () => {
    const label = 'A very long selected label that must not overflow the trigger'
    const w = mount(IrisSelect, { props: { items: [{ value: 'a', label }], modelValue: 'a' } })
    const style = w.find('[data-iris-select-trigger]').attributes('style') ?? ''
    expect(style).toContain('min-width: 140px')
    const labelEl = w.find('[data-iris-select-trigger] > span')
    expect(labelEl.text()).toBe(label)
    expect(labelEl.attributes('style')).toContain('text-overflow: ellipsis')
    expect(labelEl.attributes('style')).toContain('overflow: hidden')
  })
})

describe('@iris-ui-kit/vue accessible naming on real controls', () => {
  it('Input forwards aria-label / aria-labelledby to the native input', () => {
    const w = mount(IrisInput, { attrs: { 'aria-label': 'Full name', 'aria-labelledby': 'lbl' } })
    const input = w.find('input')
    expect(input.attributes('aria-label')).toBe('Full name')
    expect(input.attributes('aria-labelledby')).toBe('lbl')
    expect(w.attributes('aria-label')).toBeUndefined()
  })

  it('NumberInput forwards aria-label to the native spinbutton', () => {
    const w = mount(IrisNumberInput, { attrs: { 'aria-label': 'Quantity' } })
    const input = w.find('input')
    expect(input.attributes('role')).toBe('spinbutton')
    expect(input.attributes('aria-label')).toBe('Quantity')
  })

  it('Switch forwards aria-label to the native checkbox', () => {
    const w = mount(IrisSwitch, { attrs: { 'aria-label': 'Notifications' } })
    expect(w.find('input').attributes('aria-label')).toBe('Notifications')
    expect(w.attributes('aria-label')).toBeUndefined()
  })

  it('Radio exposes ariaLabel on the native radio input', () => {
    const w = mount(IrisRadio, { props: { value: 'a', ariaLabel: 'Option A' } })
    const input = w.find('input')
    expect(input.attributes('aria-label')).toBe('Option A')
    expect(input.attributes('aria-checked')).toBe('false')
  })
})
