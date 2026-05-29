import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSplitButton } from './SplitButton'

describe('IrisSplitButton', () => {
  it('renders the primary action; click emits click', async () => {
    const w = mount(IrisSplitButton, { slots: { default: 'Save' } })
    expect(w.find('[data-iris-split-button-main]').text()).toBe('Save')
    await w.find('[data-iris-split-button-main]').trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })

  it('renders a caret when actions are provided; click toggles the menu', async () => {
    const w = mount(IrisSplitButton, {
      props: { actions: [{ key: 'a', label: 'A' }] },
      slots: { default: 'Save' },
    })
    expect(w.find('[data-iris-split-button-trigger]').attributes('aria-haspopup')).toBe('menu')
    expect(w.find('[data-iris-split-button-menu]').exists()).toBe(false)
    await w.find('[data-iris-split-button-trigger]').trigger('click')
    expect(w.find('[data-iris-split-button-menu]').exists()).toBe(true)
  })

  it('renders no caret without actions', () => {
    const w = mount(IrisSplitButton, { slots: { default: 'Save' } })
    expect(w.find('[data-iris-split-button-trigger]').exists()).toBe(false)
  })

  it('selecting an action runs it and closes', async () => {
    const onA = vi.fn()
    const w = mount(IrisSplitButton, {
      props: { actions: [{ key: 'a', label: 'A', onClick: onA }] },
      slots: { default: 'Save' },
    })
    await w.find('[data-iris-split-button-trigger]').trigger('click')
    await w.find('[data-iris-split-button-item]').trigger('click')
    expect(onA).toHaveBeenCalled()
    expect(w.find('[data-iris-split-button-menu]').exists()).toBe(false)
  })

  it('disabled primary does nothing', async () => {
    const w = mount(IrisSplitButton, { props: { disabled: true }, slots: { default: 'Save' } })
    await w.find('[data-iris-split-button-main]').trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })
})
