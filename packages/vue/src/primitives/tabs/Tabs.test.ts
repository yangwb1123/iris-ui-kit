import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTabs } from './Tabs'
import { IrisTabsList } from './TabsList'
import { IrisTabsTrigger } from './TabsTrigger'
import { IrisTabsContent } from './TabsContent'
import { __resetTabsStyles, __TABS_STYLE_ID } from './styles'

enableAutoUnmount(afterEach)

function Harness(
  opts: {
    defaultValue?: string
    controlled?: import('vue').Ref<string | undefined>
    triggers?: Array<{ value: string; label: string; disabled?: boolean }>
    orientation?: 'horizontal' | 'vertical'
  } = {},
) {
  const triggers = opts.triggers ?? [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
  ]
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisTabs,
          {
            defaultValue: opts.defaultValue,
            value: opts.controlled?.value,
            orientation: opts.orientation,
            ...(opts.controlled
              ? { 'onUpdate:value': (v: string) => (opts.controlled!.value = v) }
              : {}),
          },
          {
            default: () => [
              h(IrisTabsList, null, () =>
                triggers.map((t) =>
                  h(
                    IrisTabsTrigger,
                    { value: t.value, disabled: t.disabled, key: t.value },
                    () => t.label,
                  ),
                ),
              ),
              ...triggers.map((t) =>
                h(IrisTabsContent, { value: t.value, key: t.value }, () => `Content ${t.label}`),
              ),
            ],
          },
        )
    },
  })
}

describe('IrisTabs', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    __resetTabsStyles()
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    __resetTabsStyles()
  })

  it('renders one trigger per child and a tablist wrapper', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="tab"]').length).toBe(3)
  })

  it('uses Iris classes without component-authored inline styles', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a' }), { attachTo: host })
    await nextTick()
    const list = wrapper.find('[role="tablist"]')
    const trigger = wrapper.find('[role="tab"]')
    expect(list.classes()).toContain('iris-tabs-list')
    expect(trigger.classes()).toContain('iris-tabs-trigger')
    expect(list.attributes('style')).toBeUndefined()
    expect(trigger.attributes('style')).toBeUndefined()
    expect(document.getElementById(__TABS_STYLE_ID)?.textContent).toContain(
      ':where(.iris-tabs-trigger)',
    )
  })

  it('preserves explicitly supplied classes and styles', async () => {
    const Styled = defineComponent({
      setup() {
        return () =>
          h(IrisTabs, { defaultValue: 'a' }, () => [
            h(IrisTabsList, { class: 'consumer-list', style: { gap: '9px' } }, () =>
              h(
                IrisTabsTrigger,
                {
                  value: 'a',
                  class: 'consumer-trigger',
                  style: { paddingTop: '11px' },
                },
                () => 'A',
              ),
            ),
            h(IrisTabsContent, { value: 'a' }, () => 'Content A'),
          ])
      },
    })
    const wrapper = mount(Styled, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="tablist"]').classes()).toEqual(
      expect.arrayContaining(['iris-tabs-list', 'consumer-list']),
    )
    expect(wrapper.find('[role="tablist"]').attributes('style')).toContain('gap: 9px')
    expect(wrapper.find('[role="tab"]').classes()).toEqual(
      expect.arrayContaining(['iris-tabs-trigger', 'consumer-trigger']),
    )
    expect(wrapper.find('[role="tab"]').attributes('style')).toContain('padding-top: 11px')
  })

  it('first registered trigger becomes default active when no value given', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    const triggers = wrapper.findAll('[role="tab"]')
    expect(triggers[0]!.attributes('aria-selected')).toBe('true')
    expect(triggers[1]!.attributes('aria-selected')).toBe('false')
  })

  it('respects defaultValue', async () => {
    const wrapper = mount(Harness({ defaultValue: 'b' }), { attachTo: host })
    await nextTick()
    const triggers = wrapper.findAll('[role="tab"]')
    expect(triggers[1]!.attributes('aria-selected')).toBe('true')
  })

  it('clicking a trigger activates its panel and hides others', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a' }), { attachTo: host })
    await nextTick()
    expect(wrapper.text()).toContain('Content A')
    expect(wrapper.text()).not.toContain('Content B')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Content B')
    expect(wrapper.text()).not.toContain('Content A')
  })

  it('ArrowRight moves focus and active to next enabled trigger', async () => {
    const wrapper = mount(
      Harness({
        defaultValue: 'a',
        triggers: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ],
      }),
      { attachTo: host },
    )
    await nextTick()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    // Disabled 'b' should be skipped → 'c' becomes active.
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('ArrowLeft wraps from first to last', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a' }), { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('Home / End jump to first / last enabled', async () => {
    const wrapper = mount(Harness({ defaultValue: 'b' }), { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
    await wrapper.findAll('[role="tab"]')[2]!.trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('roving tabindex: only active trigger has tabindex=0', async () => {
    const wrapper = mount(Harness({ defaultValue: 'b' }), { attachTo: host })
    await nextTick()
    const triggers = wrapper.findAll('[role="tab"]')
    expect(triggers[0]!.attributes('tabindex')).toBe('-1')
    expect(triggers[1]!.attributes('tabindex')).toBe('0')
    expect(triggers[2]!.attributes('tabindex')).toBe('-1')
  })

  it('disabled trigger does not become active on click', async () => {
    const wrapper = mount(
      Harness({
        defaultValue: 'a',
        triggers: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
        ],
      }),
      { attachTo: host },
    )
    await nextTick()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('controlled mode emits update:value', async () => {
    const value = ref<string | undefined>('a')
    const wrapper = mount(Harness({ controlled: value }), { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    await nextTick()
    expect(value.value).toBe('c')
  })

  it('lazy=true (default) unmounts inactive panels', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a' }), { attachTo: host })
    await nextTick()
    expect(wrapper.findAll('[role="tabpanel"]').length).toBe(1)
    expect(wrapper.findAll('[role="tabpanel"]')[0]!.text()).toContain('Content A')
  })

  it('Trigger outside Tabs throws', () => {
    expect(() =>
      mount(defineComponent({ setup: () => () => h(IrisTabsTrigger, { value: 'x' }) })),
    ).toThrow(/IrisTabsTrigger/)
  })

  it('ArrowRight wraps from last to first', async () => {
    const wrapper = mount(Harness({ defaultValue: 'c' }), { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[2]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('ArrowDown in vertical orientation moves to next trigger', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a', orientation: 'vertical' }), {
      attachTo: host,
    })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
  })

  it('ArrowUp in vertical orientation moves to previous trigger', async () => {
    const wrapper = mount(Harness({ defaultValue: 'b', orientation: 'vertical' }), {
      attachTo: host,
    })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
  })

  it('ArrowDown skips disabled trigger in vertical orientation', async () => {
    const wrapper = mount(
      Harness({
        defaultValue: 'a',
        orientation: 'vertical',
        triggers: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ],
      }),
      { attachTo: host },
    )
    await nextTick()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('ArrowUp wraps from first to last in vertical orientation', async () => {
    const wrapper = mount(Harness({ defaultValue: 'a', orientation: 'vertical' }), {
      attachTo: host,
    })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('Content outside Tabs throws', () => {
    expect(() =>
      mount(defineComponent({ setup: () => () => h(IrisTabsContent, { value: 'x' }) })),
    ).toThrow(/IrisTabsContent/)
  })
})
