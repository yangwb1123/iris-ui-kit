import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisChip } from './Chip'

describe('IrisChip', () => {
  it('renders a <span> by default (non-clickable)', () => {
    const w = mount(IrisChip, { slots: { default: 'tag' } })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.find('[data-iris-chip-label]').text()).toBe('tag')
  })

  it('clickable=true renders a <button> and emits click', async () => {
    const onClick = vi.fn()
    const w = mount(IrisChip, {
      props: { clickable: true },
      slots: { default: 'tag' },
      attrs: { onClick },
    })
    expect(w.element.tagName).toBe('BUTTON')
    await w.trigger('click')
    expect(onClick).toHaveBeenCalled()
  })

  it('closable=true renders the X button', () => {
    const w = mount(IrisChip, { props: { closable: true }, slots: { default: 'tag' } })
    expect(w.find('[data-iris-chip-close]').exists()).toBe(true)
  })

  it('clicking close emits @close', async () => {
    const onClose = vi.fn()
    const w = mount(IrisChip, {
      props: { closable: true },
      slots: { default: 'tag' },
      attrs: { onClose },
    })
    await w.find('[data-iris-chip-close]').trigger('click')
    expect(onClose).toHaveBeenCalled()
  })

  it('close click does NOT bubble to the chip body when chip is clickable', async () => {
    const onClose = vi.fn()
    const onClick = vi.fn()
    const w = mount(IrisChip, {
      props: { closable: true, clickable: true },
      slots: { default: 'tag' },
      attrs: { onClose, onClick },
    })
    await w.find('[data-iris-chip-close]').trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled blocks both click + close', async () => {
    const onClose = vi.fn()
    const onClick = vi.fn()
    const w = mount(IrisChip, {
      props: { closable: true, clickable: true, disabled: true },
      slots: { default: 'tag' },
      attrs: { onClose, onClick },
    })
    await w.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    // Disabled close button doesn't fire click handlers either.
    await w.find('[data-iris-chip-close]').trigger('click')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders the icon slot when given', () => {
    const w = mount(IrisChip, { slots: { default: 'x', icon: '★' } })
    expect(w.find('[data-iris-chip-icon]').exists()).toBe(true)
    expect(w.find('[data-iris-chip-icon]').text()).toBe('★')
  })

  it('exposes data-iris-chip-{variant,tone,size}', () => {
    const w = mount(IrisChip, {
      props: { variant: 'solid', tone: 'success', size: 'sm' },
      slots: { default: 'x' },
    })
    expect(w.attributes('data-iris-chip-variant')).toBe('solid')
    expect(w.attributes('data-iris-chip-tone')).toBe('success')
    expect(w.attributes('data-iris-chip-size')).toBe('sm')
  })

  it('solid variant uses primary-foreground for text', () => {
    const w = mount(IrisChip, { props: { variant: 'solid', tone: 'primary' }, slots: { default: 'x' } })
    expect(w.attributes('style')).toContain('--iris-primary-foreground')
  })

  it('subtle variant uses color-mix', () => {
    const w = mount(IrisChip, { props: { variant: 'subtle', tone: 'warning' }, slots: { default: 'x' } })
    expect(w.attributes('style')).toContain('color-mix')
  })
})
