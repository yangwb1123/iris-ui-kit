import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisAccordion } from './Accordion'
import { IrisAccordionItem } from './AccordionItem'

function tripleHarness(opts?: { defaultValue?: string | string[] | null; multiple?: boolean; collapsible?: boolean }) {
  const o = opts ?? {}
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisAccordion,
          {
            defaultValue: o.defaultValue,
            multiple: o.multiple,
            collapsible: o.collapsible,
          },
          {
            default: () => [
              h(IrisAccordionItem, { value: 'a', title: 'A' }, () => 'body A'),
              h(IrisAccordionItem, { value: 'b', title: 'B' }, () => 'body B'),
              h(IrisAccordionItem, { value: 'c', title: 'C', disabled: true }, () => 'body C'),
            ],
          },
        )
    },
  })
}

describe('IrisAccordion', () => {
  it('renders three items, all closed by default', () => {
    const w = mount(tripleHarness())
    expect(w.findAll('[data-iris-accordion-item]').length).toBe(3)
    expect(w.find('[data-iris-accordion-content]').exists()).toBe(false)
  })

  it('clicking a header opens the item (single mode)', async () => {
    const w = mount(tripleHarness())
    const triggers = w.findAll('[data-iris-accordion-trigger]')
    await triggers[0]!.trigger('click')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('true')
    expect(w.findAll('[data-iris-accordion-content]').length).toBe(1)
  })

  it('opening a second item closes the first (single mode)', async () => {
    const w = mount(tripleHarness({ defaultValue: 'a' }))
    const triggers = w.findAll('[data-iris-accordion-trigger]')
    await triggers[1]!.trigger('click')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('false')
    expect(triggers[1]!.attributes('aria-expanded')).toBe('true')
  })

  it('clicking an open item in single mode (no collapsible) keeps it open', async () => {
    const w = mount(tripleHarness({ defaultValue: 'a' }))
    const trig = w.findAll('[data-iris-accordion-trigger]')[0]!
    expect(trig.attributes('aria-expanded')).toBe('true')
    await trig.trigger('click')
    expect(trig.attributes('aria-expanded')).toBe('true')
  })

  it('collapsible=true lets you close the open item', async () => {
    const w = mount(tripleHarness({ defaultValue: 'a', collapsible: true }))
    const trig = w.findAll('[data-iris-accordion-trigger]')[0]!
    await trig.trigger('click')
    expect(trig.attributes('aria-expanded')).toBe('false')
  })

  it('multiple=true allows several items open at once', async () => {
    const w = mount(tripleHarness({ multiple: true }))
    const triggers = w.findAll('[data-iris-accordion-trigger]')
    await triggers[0]!.trigger('click')
    await triggers[1]!.trigger('click')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('true')
    expect(triggers[1]!.attributes('aria-expanded')).toBe('true')
  })

  it('multiple=true clicking again closes that item', async () => {
    const w = mount(tripleHarness({ multiple: true, defaultValue: ['a'] }))
    const triggers = w.findAll('[data-iris-accordion-trigger]')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('true')
    await triggers[0]!.trigger('click')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('false')
  })

  it('disabled items cannot be toggled', async () => {
    const w = mount(tripleHarness())
    const trig = w.findAll('[data-iris-accordion-trigger]')[2]!
    expect(trig.attributes('disabled')).toBeDefined()
    await trig.trigger('click')
    expect(trig.attributes('aria-expanded')).toBe('false')
  })

  it('content has role="region" + aria-labelledby pointing at its header', async () => {
    const w = mount(tripleHarness({ defaultValue: 'a' }))
    const content = w.find('[data-iris-accordion-content]')
    const header = w.findAll('[data-iris-accordion-trigger]')[0]!
    expect(content.attributes('role')).toBe('region')
    expect(content.attributes('aria-labelledby')).toBe(header.attributes('id'))
  })

  it('aria-controls on trigger points at the region id', () => {
    const w = mount(tripleHarness({ defaultValue: 'a' }))
    const trig = w.findAll('[data-iris-accordion-trigger]')[0]!
    const content = w.find('[data-iris-accordion-content]')
    expect(trig.attributes('aria-controls')).toBe(content.attributes('id'))
  })

  it('emits update:modelValue when controlled', async () => {
    const onUpdate = vi.fn()
    const Comp = defineComponent({
      setup() {
        const value = ref<string | null>(null)
        return () =>
          h(
            IrisAccordion,
            { modelValue: value.value, 'onUpdate:modelValue': onUpdate },
            {
              default: () => [
                h(IrisAccordionItem, { value: 'x', title: 'X' }, () => 'body'),
              ],
            },
          )
      },
    })
    const w = mount(Comp)
    await w.find('[data-iris-accordion-trigger]').trigger('click')
    expect(onUpdate).toHaveBeenCalledWith('x')
  })

  it('Enter / Space toggles via keyboard', async () => {
    const w = mount(tripleHarness())
    const trig = w.findAll('[data-iris-accordion-trigger]')[0]!
    await trig.trigger('keydown', { key: 'Enter' })
    expect(trig.attributes('aria-expanded')).toBe('true')
    await trig.trigger('keydown', { key: ' ' })
    // In single non-collapsible mode, Space on an open item is a no-op.
    expect(trig.attributes('aria-expanded')).toBe('true')
  })

  it('title slot wins over title prop', () => {
    const Comp = defineComponent({
      setup() {
        return () =>
          h(IrisAccordion, null, {
            default: () => [
              h(IrisAccordionItem, { value: 'a', title: 'prop' }, {
                title: () => 'slot wins',
                default: () => 'body',
              }),
            ],
          })
      },
    })
    const w = mount(Comp)
    expect(w.find('[data-iris-accordion-title]').text()).toBe('slot wins')
  })
})
