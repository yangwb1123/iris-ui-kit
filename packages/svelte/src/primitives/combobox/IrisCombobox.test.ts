import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisCombobox from './IrisCombobox.svelte'

afterEach(cleanup)

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('IrisCombobox', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisCombobox, { props: { options } })
    expect(container).toBeTruthy()
  })

  it('opens on focus', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = container.querySelector('input')!
    await fireEvent.focus(input)
    expect(container.querySelector('[role="listbox"]')?.getAttribute('hidden')).toBeNull()
  })

  it('filters options on input', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = container.querySelector('input')!
    await fireEvent.focus(input)
    await fireEvent.input(input, { target: { value: 'ban' } })
    const opts = container.querySelectorAll('[data-iris-combobox-option]')
    expect(opts.length).toBe(1)
    expect(opts[0].textContent?.trim()).toBe('Banana')
  })

  it('calls onValueChange on option click', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisCombobox, { props: { options, onValueChange } })
    const input = container.querySelector('input')!
    await fireEvent.focus(input)
    const opts = container.querySelectorAll('[data-iris-combobox-option]')
    await fireEvent.click(opts[0])
    expect(onValueChange).toHaveBeenCalledWith('apple')
  })

  it('closes on Escape', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = container.querySelector('input')!
    await fireEvent.focus(input)
    expect(container.getAttribute('data-state')).not.toBe('closed')
    await fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('[data-iris-combobox]')?.getAttribute('data-state')).toBe(
      'closed',
    )
  })
})
