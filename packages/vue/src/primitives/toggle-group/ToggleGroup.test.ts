import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisToggleGroup } from './ToggleGroup'
import { IrisToggleGroupItem } from './ToggleGroupItem'

function harness(opts?: {
  type?: 'single' | 'multiple'
  initial?: string | string[] | null
  disabled?: boolean
}) {
  const o = opts ?? {}
  return defineComponent({
    setup() {
      const value = ref<string | string[] | null>(o.initial ?? (o.type === 'multiple' ? [] : null))
      return () =>
        h(
          IrisToggleGroup,
          {
            type: o.type,
            disabled: o.disabled,
            modelValue: value.value,
            'onUpdate:modelValue': (v: string | string[] | null) => {
              value.value = v
            },
          },
          {
            default: () => [
              h(IrisToggleGroupItem, { value: 'a' }, () => 'A'),
              h(IrisToggleGroupItem, { value: 'b' }, () => 'B'),
              h(IrisToggleGroupItem, { value: 'c' }, () => 'C'),
            ],
          },
        )
    },
  })
}

describe('IrisToggleGroup', () => {
  it('renders 3 items', () => {
    const w = mount(harness())
    expect(w.findAll('[data-iris-toggle-group-item]').length).toBe(3)
  })

  it('single mode: root has role="radiogroup", items role="radio"', () => {
    const w = mount(harness({ type: 'single' }))
    expect(w.attributes('role')).toBe('radiogroup')
    expect(w.findAll('[data-iris-toggle-group-item]')[0]!.attributes('role')).toBe('radio')
  })

  it('multiple mode: root has role="group", items use aria-pressed', () => {
    const w = mount(harness({ type: 'multiple' }))
    expect(w.attributes('role')).toBe('group')
    expect(w.findAll('[data-iris-toggle-group-item]')[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('single mode: clicking activates and emits update', async () => {
    const w = mount(harness({ type: 'single' }))
    const items = w.findAll('[data-iris-toggle-group-item]')
    await items[1]!.trigger('click')
    expect(items[1]!.attributes('data-state')).toBe('on')
    expect(items[1]!.attributes('aria-checked')).toBe('true')
  })

  it('single mode: clicking the active one unselects (toggle)', async () => {
    const w = mount(harness({ type: 'single', initial: 'a' }))
    const items = w.findAll('[data-iris-toggle-group-item]')
    expect(items[0]!.attributes('data-state')).toBe('on')
    await items[0]!.trigger('click')
    expect(items[0]!.attributes('data-state')).toBe('off')
  })

  it('multiple mode: clicking adds and clicking again removes', async () => {
    const w = mount(harness({ type: 'multiple' }))
    const items = w.findAll('[data-iris-toggle-group-item]')
    await items[0]!.trigger('click')
    await items[1]!.trigger('click')
    expect(items[0]!.attributes('data-state')).toBe('on')
    expect(items[1]!.attributes('data-state')).toBe('on')
    await items[0]!.trigger('click')
    expect(items[0]!.attributes('data-state')).toBe('off')
    expect(items[1]!.attributes('data-state')).toBe('on')
  })

  it('disabled group blocks all clicks', async () => {
    const onUpdate = vi.fn()
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            IrisToggleGroup,
            { type: 'single', disabled: true, modelValue: null, 'onUpdate:modelValue': onUpdate },
            { default: () => [h(IrisToggleGroupItem, { value: 'a' }, () => 'A')] },
          )
      },
    })
    const w = mount(Comp)
    await w.find('[data-iris-toggle-group-item]').trigger('click')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('item disabled blocks its own click', async () => {
    const onUpdate = vi.fn()
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            IrisToggleGroup,
            { type: 'single', modelValue: null, 'onUpdate:modelValue': onUpdate },
            {
              default: () => [
                h(IrisToggleGroupItem, { value: 'a' }, () => 'A'),
                h(IrisToggleGroupItem, { value: 'b', disabled: true }, () => 'B'),
              ],
            },
          )
      },
    })
    const w = mount(Comp)
    const items = w.findAll('[data-iris-toggle-group-item]')
    await items[1]!.trigger('click')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('Space activates an item', async () => {
    const w = mount(harness({ type: 'single' }))
    const items = w.findAll('[data-iris-toggle-group-item]')
    await items[0]!.trigger('keydown', { key: ' ' })
    expect(items[0]!.attributes('data-state')).toBe('on')
  })

  it('only the active item is in the tab cycle (roving tabindex)', async () => {
    const w = mount(harness({ type: 'single', initial: 'b' }))
    const items = w.findAll('[data-iris-toggle-group-item]')
    expect(items[0]!.attributes('tabindex')).toBe('-1')
    expect(items[1]!.attributes('tabindex')).toBe('0')
    expect(items[2]!.attributes('tabindex')).toBe('-1')
  })

  it('exposes data-iris-toggle-group-type', () => {
    expect(mount(harness({ type: 'single' })).attributes('data-iris-toggle-group-type')).toBe(
      'single',
    )
    expect(mount(harness({ type: 'multiple' })).attributes('data-iris-toggle-group-type')).toBe(
      'multiple',
    )
  })
})
