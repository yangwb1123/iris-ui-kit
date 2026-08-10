import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSelect } from './Select'
import type { IrisListItem } from '../list/List'

const items: IrisListItem<string>[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
]

describe('IrisSelect', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  it('renders a trigger with the placeholder when no value', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, placeholder: 'Pick' },
      attachTo: host,
    })
    expect(wrapper.text()).toContain('Pick')
  })

  it('renders the selected item label', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: 'b' },
      attachTo: host,
    })
    expect(wrapper.text()).toContain('Banana')
  })

  it('uses defaultValue and updates its label in uncontrolled mode', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, defaultValue: 'a', teleport: false },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-select-trigger]').text()).toContain('Apple')
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.find('[data-iris-select-trigger]').text()).toContain('Banana')
  })

  it('emits one v-model update and the framework-neutral valueChange event', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
    expect(wrapper.emitted('valueChange')).toEqual([['b']])
  })

  it('closes a controlled teleported list after selection without ref errors', async () => {
    const value = ref<string | undefined>('a')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisSelect, {
            items,
            modelValue: value.value,
            'onUpdate:modelValue': (next) => {
              value.value = next as string
            },
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })

    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    const option = document.querySelectorAll<HTMLElement>('[role="option"]')[1]
    expect(option).toBeDefined()
    option!.click()
    await nextTick()
    await nextTick()

    expect(value.value).toBe('b')
    expect(wrapper.find('[data-iris-select-trigger]').text()).toContain('Banana')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('trigger announces a listbox popup (not the popover default dialog)', () => {
    const wrapper = mount(IrisSelect, { props: { items, modelValue: null }, attachTo: host })
    expect(wrapper.find('[data-iris-select-trigger]').attributes('aria-haspopup')).toBe('listbox')
  })

  it('opens the dropdown on trigger click', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null },
      attachTo: host,
    })
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('renders the IrisList with the same items + modelValue when open', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: 'b' },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    // Selected option ("Banana", value 'b') should be marked aria-selected
    // when the listbox is rendered with the same modelValue.
    const selected = document.querySelector('[role="option"][aria-selected="true"]')
    expect(selected?.textContent?.trim()).toBe('Banana')
  })

  it('reflects updated v-model in the trigger label', async () => {
    const value = ref<string | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisSelect, {
            items,
            modelValue: value.value,
            'onUpdate:modelValue': (v) => (value.value = v as string),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    value.value = 'c'
    await nextTick()
    expect(wrapper.text()).toContain('Cherry')
  })

  it('disabled trigger renders with disabled attribute', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, disabled: true },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-select-trigger]').attributes('disabled')).toBeDefined()
  })

  it('reflects invalid state with aria-invalid', () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, invalid: true },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-select-trigger]').attributes('aria-invalid')).toBe('true')
  })

  describe('keyboard navigation in listbox', () => {
    it('ArrowDown moves tabindex to next option', async () => {
      const wrapper = mount(IrisSelect, {
        props: { items, modelValue: null, placeholder: 'Pick', teleport: false },
        attachTo: host,
      })
      await wrapper.find('[data-iris-select-trigger]').trigger('click')
      await nextTick()

      const opts = wrapper.findAll('[role="option"]')
      // ArrowDown native event
      wrapper
        .find('[role="listbox"]')
        .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await nextTick()
      expect(opts[1]!.attributes('tabindex')).toBe('0')
    })

    it('End + Enter selects last item via update:modelValue emit', async () => {
      // Use uncontrolled mode (no modelValue) so emit updates internal state
      const wrapper = mount(IrisSelect, {
        props: { items, placeholder: 'Pick', teleport: false },
        attachTo: host,
      })
      await wrapper.find('[data-iris-select-trigger]').trigger('click')
      await nextTick()

      const listbox = wrapper.find('[role="listbox"]')
      // First navigate with native events
      listbox.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      await nextTick()
      // Verify End worked - last option should be active
      const opts = wrapper.findAll('[role="option"]')
      expect(opts[2]!.attributes('tabindex')).toBe('0')

      // Now try Enter - emits update:modelValue in uncontrolled mode
      listbox.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await nextTick()

      // Verify the emit happened with the expected value ('c' = last item)
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted![emitted!.length - 1]).toEqual(['c'])
    })
  })
})

describe('IrisSelect virtual listbox', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  const makeItems = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ value: i, label: `Option ${i}` }))
  const ROW_HEIGHT = 36
  const listboxEl = (w: ReturnType<typeof mount>) =>
    w.element.querySelector('[role="listbox"]') as HTMLElement
  const opts = (w: ReturnType<typeof mount>) =>
    Array.from(w.element.querySelectorAll('[role="option"]')) as HTMLElement[]
  const spacers = (w: ReturnType<typeof mount>) =>
    Array.from(w.element.querySelectorAll('[data-iris-select-spacer]')) as HTMLElement[]
  const indexOf = (el: HTMLElement) => parseInt(el.getAttribute('data-iris-list-index') ?? '-1', 10)

  it('A1: virtual off (default) — all options, no spacers', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    expect(opts(wrapper).length).toBe(3)
    expect(spacers(wrapper).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items, modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    expect(opts(wrapper).length).toBe(3)
    const sp = spacers(wrapper)
    expect(sp.length).toBe(2)
    expect(sp[0]!.getAttribute('data-iris-select-spacer-type')).toBe('top')
    expect(sp[1]!.getAttribute('data-iris-select-spacer-type')).toBe('bottom')
    expect(sp[0]!.getAttribute('role')).toBe('presentation')
    expect(
      parseFloat(sp[0]!.style.height) +
        opts(wrapper).length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(3 * ROW_HEIGHT)
    expect(opts(wrapper)[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(opts(wrapper)[0]!.getAttribute('aria-posinset')).toBe('1')
    expect(opts(wrapper)[2]!.getAttribute('aria-posinset')).toBe('3')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered, spacer invariant', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items: makeItems(10_000), modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    const rendered = opts(wrapper)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThan(60)
    expect(indexOf(rendered[0]!)).toBe(0)
    for (let i = 1; i < rendered.length; i++) {
      expect(indexOf(rendered[i]!)).toBe(indexOf(rendered[i - 1]!) + 1)
    }
    const sp = spacers(wrapper)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) +
        rendered.length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(360_000)
  })

  it('A2: items shrink re-windows and clamps scroll to 0', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items: makeItems(10_000), modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    const lb = listboxEl(wrapper)
    lb.scrollTop = 1000
    lb.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(indexOf(opts(wrapper)[0]!)).toBeGreaterThan(0)
    await wrapper.setProps({ items: makeItems(3) })
    await nextTick()
    await nextTick()
    expect(lb.scrollTop).toBe(0)
    expect(indexOf(opts(wrapper)[0]!)).toBe(0)
  })

  it('A3: open with value at index 9999 — scrolls the active option into view', async () => {
    const wrapper = mount(IrisSelect, {
      props: {
        items: makeItems(10_000),
        modelValue: 9999,
        virtual: true,
        teleport: false,
      },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    await nextTick()
    const lb = listboxEl(wrapper)
    expect(lb.scrollTop).toBe(359_760)
    const deep = wrapper.element.querySelector('[data-iris-list-index="9999"]') as HTMLElement
    expect(deep).not.toBeNull()
    expect(deep.getAttribute('aria-posinset')).toBe('10000')
    expect(deep.getAttribute('tabindex')).toBe('0')
  })

  it('A3: reopen after a deep session with no value resets to top', async () => {
    const wrapper = mount(IrisSelect, {
      props: {
        items: makeItems(10_000),
        modelValue: 9999,
        virtual: true,
        teleport: false,
      },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    expect(listboxEl(wrapper).scrollTop).toBe(359_760)
    await wrapper.find('[data-iris-select-trigger]').trigger('click') // close
    await nextTick()
    expect(wrapper.element.querySelector('[role="listbox"]')).toBeNull()
    await wrapper.setProps({ modelValue: null })
    await wrapper.find('[data-iris-select-trigger]').trigger('click') // reopen
    await nextTick()
    await nextTick()
    expect(listboxEl(wrapper).scrollTop).toBe(0)
    expect(indexOf(opts(wrapper)[0]!)).toBe(0)
  })

  it('A4: End scrolls the last option into view (maxScroll)', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items: makeItems(10_000), modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    listboxEl(wrapper).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(listboxEl(wrapper).scrollTop).toBe(359_760)
    const last = wrapper.element.querySelector('[data-iris-list-index="9999"]') as HTMLElement
    expect(last).not.toBeNull()
    expect(last.getAttribute('tabindex')).toBe('0')
  })

  it('A4: wheel scroll drives the window — nav then re-scrolls', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items: makeItems(10_000), modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    const lb = listboxEl(wrapper)
    lb.scrollTop = 1000
    lb.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(indexOf(opts(wrapper)[0]!)).toBe(23) // floor((1000 − 4×36)/36)
    lb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(listboxEl(wrapper).scrollTop).toBe(36)
  })

  it('A5: empty state with virtual — no options, no spacers', async () => {
    const wrapper = mount(IrisSelect, {
      props: { items: [], modelValue: null, virtual: true, teleport: false },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    expect(opts(wrapper).length).toBe(0)
    expect(spacers(wrapper).length).toBe(0)
    expect(wrapper.element.querySelector('[data-iris-list-state="empty"]')).not.toBeNull()
  })

  it('A5: disabled options render and ignore clicks in both modes', async () => {
    const wrapper = mount(IrisSelect, {
      props: {
        items: [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana', disabled: true },
          { value: 'c', label: 'Cherry' },
        ],
        modelValue: null,
        virtual: true,
        teleport: false,
      },
      attachTo: host,
    })
    await wrapper.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    await nextTick()
    const disabled = opts(wrapper).find((o) => o.getAttribute('aria-disabled') === 'true')
    expect(disabled).toBeDefined()
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.element.querySelector('[role="listbox"]')).not.toBeNull()
  })
})
