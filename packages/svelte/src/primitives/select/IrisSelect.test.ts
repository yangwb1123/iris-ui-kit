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
})
