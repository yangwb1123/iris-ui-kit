import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisCheckbox from './IrisCheckbox.svelte'

describe('IrisCheckbox', () => {
  it('renders unchecked by default', () => {
    const { container } = render(IrisCheckbox)
    const label = container.querySelector('[data-iris-checkbox]')
    expect(label).toBeTruthy()
    expect(label!.getAttribute('data-state')).toBe('unchecked')
  })

  it('calls onchange when clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisCheckbox, { props: { onchange } })
    const input = container.querySelector('input[type="checkbox"]')!
    await fireEvent.click(input)
    flushSync()
    expect(onchange).toHaveBeenCalled()
  })

  it('shows indeterminate state', () => {
    const { container } = render(IrisCheckbox, { props: { value: 'indeterminate' } })
    const label = container.querySelector('[data-iris-checkbox]')
    expect(label!.getAttribute('data-state')).toBe('indeterminate')
  })
})
