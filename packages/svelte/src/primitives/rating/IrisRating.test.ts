import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisRating from './IrisRating.svelte'

describe('IrisRating', () => {
  it('renders 5 stars by default', () => {
    const { container } = render(IrisRating)
    const stars = container.querySelectorAll('[data-iris-rating-star]')
    expect(stars.length).toBe(5)
  })

  it('calls onchange when a star is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisRating, { props: { onchange } })
    const stars = container.querySelectorAll('[data-iris-rating-star]')
    await fireEvent.click(stars[2])
    flushSync()
    expect(onchange).toHaveBeenCalledWith(3)
  })

  it('does not call onchange in readonly mode', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisRating, { props: { readonly: true, onchange } })
    const stars = container.querySelectorAll('[data-iris-rating-star]')
    await fireEvent.click(stars[0])
    flushSync()
    expect(onchange).not.toHaveBeenCalled()
  })
})
