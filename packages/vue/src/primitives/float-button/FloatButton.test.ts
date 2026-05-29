import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisFloatButton } from './FloatButton'

const main = (w: ReturnType<typeof mount>) => w.find('[data-iris-float-button]')

describe('IrisFloatButton', () => {
  it('renders a FAB with content and label', () => {
    const w = mount(IrisFloatButton, { props: { ariaLabel: 'Add' }, slots: { default: '+' } })
    expect(main(w).attributes('aria-label')).toBe('Add')
    expect(main(w).text()).toBe('+')
  })

  it('plain click emits click (no actions)', async () => {
    const w = mount(IrisFloatButton, { props: { ariaLabel: 'Add' } })
    await main(w).trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })

  it('with actions, click toggles the speed-dial menu', async () => {
    const w = mount(IrisFloatButton, {
      props: {
        actions: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ],
      },
    })
    expect(main(w).attributes('aria-haspopup')).toBe('menu')
    expect(w.find('[data-iris-float-button-actions]').exists()).toBe(false)
    await main(w).trigger('click')
    expect(w.findAll('[data-iris-float-button-action]').length).toBe(2)
    expect(main(w).attributes('aria-expanded')).toBe('true')
  })

  it('selecting an action runs it and closes', async () => {
    const onA = vi.fn()
    const w = mount(IrisFloatButton, {
      props: { actions: [{ key: 'a', label: 'A', onClick: onA }] },
    })
    await main(w).trigger('click')
    await w.find('[data-iris-float-button-action]').trigger('click')
    expect(onA).toHaveBeenCalled()
    expect(w.find('[data-iris-float-button-actions]').exists()).toBe(false)
  })

  it('Escape closes the speed-dial', async () => {
    const w = mount(IrisFloatButton, { props: { actions: [{ key: 'a', label: 'A' }] } })
    await main(w).trigger('click')
    expect(w.find('[data-iris-float-button-actions]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('[data-iris-float-button-actions]').exists()).toBe(false)
  })

  it('uses a localized default label for the speed-dial trigger', () => {
    const w = mount(IrisFloatButton, { props: { actions: [{ key: 'a', label: 'A' }] } })
    expect(main(w).attributes('aria-label')).toBe('Actions')
  })
})
