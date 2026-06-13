import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisSelect from './IrisSelect.svelte'

afterEach(cleanup)

const items = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('IrisSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisSelect, { props: { items } })
    expect(container).toBeTruthy()
  })

  it('shows placeholder when no value', () => {
    const { container } = render(IrisSelect, { props: { items, placeholder: 'Pick one' } })
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent?.trim()).toContain(
      'Pick one',
    )
  })

  it('opens listbox on click', async () => {
    const { container } = render(IrisSelect, { props: { items } })
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    await fireEvent.click(trigger)
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('calls onValueChange when option clicked', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisSelect, { props: { items, onValueChange } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const opts = document.querySelectorAll('[data-iris-select-option]')
    await fireEvent.click(opts[1])
    expect(onValueChange).toHaveBeenCalledWith('banana')
  })

  describe('keyboard navigation', () => {
    const optionEls = () =>
      Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[]
    const listbox = () => document.querySelector('[data-iris-select-listbox]') as HTMLElement

    it('focuses the first option on open, ArrowDown moves to next, Enter selects it', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisSelect, { props: { items, onValueChange } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve() // flush the focusOnOpen microtask
      const options = optionEls()
      expect(document.activeElement).toBe(options[0])
      await fireEvent.keyDown(listbox(), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(options[1])
      await fireEvent.keyDown(options[1], { key: 'Enter' })
      expect(onValueChange).toHaveBeenCalledWith('banana')
    })

    it('End focuses the last option, Home the first', async () => {
      const { container } = render(IrisSelect, { props: { items } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      const options = optionEls()
      await fireEvent.keyDown(listbox(), { key: 'End' })
      expect(document.activeElement).toBe(options[2])
      await fireEvent.keyDown(listbox(), { key: 'Home' })
      expect(document.activeElement).toBe(options[0])
    })

    it('opens on selected value and focuses the selected option', async () => {
      const { container } = render(IrisSelect, { props: { items, value: 'cherry' } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      expect(document.activeElement).toBe(optionEls()[2])
    })
  })
})
