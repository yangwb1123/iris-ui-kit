import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisPagination from './IrisPagination.svelte'

describe('IrisPagination', () => {
  it('renders pagination nav', () => {
    const { container } = render(IrisPagination, { props: { total: 100 } })
    const nav = container.querySelector('[data-iris-pagination]')
    expect(nav).toBeTruthy()
  })

  it('calls onchange when a page button is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisPagination, { props: { total: 100, value: 1, onchange } })
    const nextBtn = container.querySelector('[data-iris-pagination-item="next"]')!
    await fireEvent.click(nextBtn)
    flushSync()
    expect(onchange).toHaveBeenCalledWith(2)
  })

  it('disables prev on first page', () => {
    const { container } = render(IrisPagination, { props: { total: 100, value: 1 } })
    const prevBtn = container.querySelector(
      '[data-iris-pagination-item="prev"]',
    ) as HTMLButtonElement
    expect(prevBtn.disabled).toBe(true)
  })
})
