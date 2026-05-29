import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisToolbar } from './Toolbar'

const withButtons = (count: number, props: Record<string, unknown> = {}) =>
  mount(IrisToolbar, {
    props,
    attachTo: document.body,
    slots: {
      default: () =>
        Array.from({ length: count }, (_v, i) =>
          h('button', { key: i }, String.fromCharCode(65 + i)),
        ),
    },
  })

describe('IrisToolbar', () => {
  it('renders a role="toolbar" with the orientation', () => {
    const w = mount(IrisToolbar, {
      props: { ariaLabel: 'Text formatting' },
      slots: { default: () => [h('button', 'B'), h('button', 'I')] },
    })
    const tb = w.find('[role="toolbar"]')
    expect(tb.exists()).toBe(true)
    expect(tb.attributes('aria-orientation')).toBe('horizontal')
    expect(tb.attributes('aria-label')).toBe('Text formatting')
    w.unmount()
  })

  it('sets roving tabindex on mount (first item tabbable, rest -1)', () => {
    const w = withButtons(3)
    const btns = w.findAll('button')
    expect((btns[0]!.element as HTMLButtonElement).tabIndex).toBe(0)
    expect((btns[1]!.element as HTMLButtonElement).tabIndex).toBe(-1)
    expect((btns[2]!.element as HTMLButtonElement).tabIndex).toBe(-1)
    w.unmount()
  })

  it('ArrowRight moves focus and the tab stop to the next item', async () => {
    const w = withButtons(2)
    const btns = w.findAll('button')
    ;(btns[0]!.element as HTMLButtonElement).focus()
    await w.find('[role="toolbar"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(btns[1]!.element)
    expect((btns[1]!.element as HTMLButtonElement).tabIndex).toBe(0)
    expect((btns[0]!.element as HTMLButtonElement).tabIndex).toBe(-1)
    w.unmount()
  })

  it('ArrowRight wraps from the last item back to the first', async () => {
    const w = withButtons(2)
    const btns = w.findAll('button')
    ;(btns[1]!.element as HTMLButtonElement).focus()
    await w.find('[role="toolbar"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(btns[0]!.element)
    w.unmount()
  })

  it('uses Up/Down arrows when vertical', async () => {
    const w = withButtons(2, { orientation: 'vertical' })
    const tb = w.find('[role="toolbar"]')
    const btns = w.findAll('button')
    expect(tb.attributes('aria-orientation')).toBe('vertical')
    ;(btns[0]!.element as HTMLButtonElement).focus()
    await tb.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(btns[1]!.element)
    w.unmount()
  })

  it('Home and End jump to the first and last items', async () => {
    const w = withButtons(3)
    const tb = w.find('[role="toolbar"]')
    const btns = w.findAll('button')
    ;(btns[0]!.element as HTMLButtonElement).focus()
    await tb.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(btns[2]!.element)
    await tb.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(btns[0]!.element)
    w.unmount()
  })

  it('skips disabled items when assigning the initial tab stop', () => {
    const w = mount(IrisToolbar, {
      attachTo: document.body,
      slots: {
        default: () => [h('button', { disabled: true }, 'A'), h('button', 'B')],
      },
    })
    const btns = w.findAll('button')
    expect((btns[1]!.element as HTMLButtonElement).tabIndex).toBe(0)
    w.unmount()
  })
})
