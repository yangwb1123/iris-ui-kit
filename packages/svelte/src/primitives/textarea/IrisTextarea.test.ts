import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisTextarea from './IrisTextarea.svelte'

describe('IrisTextarea', () => {
  it('renders a textarea element', () => {
    const { container } = render(IrisTextarea, { props: { value: 'hello' } })
    const ta = container.querySelector('textarea')
    expect(ta).toBeTruthy()
  })

  it('reflects size attribute', () => {
    const { container } = render(IrisTextarea, { props: { size: 'sm' } })
    expect(container.querySelector('[data-iris-textarea-size="sm"]')).not.toBeNull()
  })

  it('fires onchange when typed', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTextarea, { props: { value: '', onchange } })
    const ta = container.querySelector('textarea')!
    await fireEvent.input(ta, { target: { value: 'abc' } })
    flushSync()
    expect(onchange).toHaveBeenCalledWith('abc')
  })

  it('sets aria-invalid when invalid', () => {
    const { container } = render(IrisTextarea, { props: { invalid: true } })
    expect(container.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true')
  })
})
