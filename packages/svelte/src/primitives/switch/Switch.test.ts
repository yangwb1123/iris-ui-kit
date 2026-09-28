import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterEach, describe, it, expect, vi } from 'vitest'
import IrisSwitch from './Switch.svelte'
import IrisSelect from '../select/IrisSelect.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisSwitch', () => {
  it('renders an input with role=switch', () => {
    const { container } = render(IrisSwitch)
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('checkbox')
    expect(input.getAttribute('role')).toBe('switch')
  })

  it('uncontrolled toggles internal state', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisSwitch, { props: { defaultChecked: true, onChange } })
    const input = container.querySelector('input')! as HTMLInputElement
    expect(input.checked).toBe(true)
    await fireEvent.click(input)
    flushSync()
    expect(onChange).toHaveBeenCalledWith(false, expect.anything())
    expect(input.checked).toBe(false)
  })

  it('controlled honors prop, ignores own state', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(false)
    await rerender({ checked: true })
    flushSync()
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('disabled blocks change', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisSwitch, { props: { disabled: true, onChange } })
    await fireEvent.click(container.querySelector('input')!)
    flushSync()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aria-checked reflects state', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('false')
    await rerender({ checked: true })
    flushSync()
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('true')
  })

  it('invalid → aria-invalid', () => {
    const { container } = render(IrisSwitch, { props: { invalid: true } })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(IrisSwitch, { props: { ariaDescribedby: 'hint' } })
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint')
  })

  it('data-state reflects checked', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'unchecked',
    )
    await rerender({ checked: true })
    flushSync()
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'checked',
    )
  })

  it('size flips data-iris-switch-size attr', () => {
    const { container } = render(IrisSwitch, { props: { size: 'lg' } })
    expect(
      container.querySelector('[data-iris-switch]')!.getAttribute('data-iris-switch-size'),
    ).toBe('lg')
  })

  it('uses logical inline styles in RTL and LTR', async () => {
    const previousDir = document.documentElement.getAttribute('dir')
    document.documentElement.setAttribute('dir', 'rtl')
    try {
      const switchView = render(IrisSwitch, { props: { checked: false } })
      const selectView = render(IrisSelect, {
        props: { items: [{ value: 'a', label: 'Alpha' }] },
      })

      const assertStyles = (thumbOffset: string) => {
        const thumb = switchView.container.querySelector(
          '[data-iris-switch] > span > span',
        ) as HTMLSpanElement
        const trigger = selectView.container.querySelector(
          '[data-iris-select-trigger]',
        ) as HTMLButtonElement
        const arrow = trigger.querySelector('svg') as SVGElement
        expect(thumb.style.getPropertyValue('inset-inline-start')).toBe(thumbOffset)
        expect(thumb.style.left).toBe('')
        expect(thumb.style.transition).toContain('inset-inline-start')
        expect(arrow.style.getPropertyValue('inset-inline-end')).toBe('8px')
        expect(arrow.style.right).toBe('')
        expect(trigger.style.getPropertyValue('padding-block')).toBe('var(--iris-padding-sm, 6px)')
        expect(trigger.style.getPropertyValue('padding-inline-start')).toBe(
          'var(--iris-padding-md, 12px)',
        )
        expect(trigger.style.getPropertyValue('padding-inline-end')).toBe(
          'var(--iris-space-xl, 24px)',
        )
      }

      assertStyles('2px')
      await switchView.rerender({ checked: true })
      flushSync()
      assertStyles('calc(36px - 16px - 2px)')
      document.documentElement.setAttribute('dir', 'ltr')
      await switchView.rerender({ checked: false })
      flushSync()
      assertStyles('2px')
    } finally {
      if (previousDir === null) document.documentElement.removeAttribute('dir')
      else document.documentElement.setAttribute('dir', previousDir)
    }
  })
})
