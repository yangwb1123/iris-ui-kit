import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisPagination } from './IrisPagination'

afterEach(cleanup)

describe('IrisPagination', () => {
  it('renders navigation', () => {
    const { container } = render(() => <IrisPagination total={100} />)
    expect(container.querySelector('[data-iris-pagination]')).not.toBeNull()
  })

  it('shows page buttons for 3 pages', () => {
    const { container } = render(() => <IrisPagination total={30} pageSize={10} />)
    const pages = container.querySelectorAll('[data-iris-pagination-item="page"]')
    expect(pages.length).toBe(3)
  })

  it('disables prev button on first page', () => {
    const { container } = render(() => <IrisPagination total={50} page={1} />)
    const prev = container.querySelector('[data-iris-pagination-item="prev"]') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
  })

  it('calls onChange when next is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisPagination total={50} page={1} onChange={onChange} />)
    const next = container.querySelector('[data-iris-pagination-item="next"]') as HTMLButtonElement
    fireEvent.click(next)
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('marks active page with aria-current', () => {
    const { container } = render(() => <IrisPagination total={50} page={2} pageSize={10} />)
    const active = container.querySelector('[data-iris-pagination-active="true"]')!
    expect(active.getAttribute('aria-current')).toBe('page')
  })

  it('moves aria-current to the clicked page in uncontrolled mode', () => {
    // Regression: page buttons render inside <For>, which only re-runs its
    // callback when an item's identity changes. getPageRange returns the same
    // page-number primitives when only the current page moves, so a plain
    // `active` boolean froze on the initial page (aria-current never followed an
    // uncontrolled click). `active` is now a thunk, so it re-evaluates reactively.
    const { container } = render(() => <IrisPagination defaultPage={1} total={30} pageSize={10} />)
    const pages = () =>
      Array.from(
        container.querySelectorAll('[data-iris-pagination-item="page"]'),
      ) as HTMLButtonElement[]
    expect(pages()[0].getAttribute('aria-current')).toBe('page')
    fireEvent.click(pages()[2]) // → page 3
    expect(pages()[2].getAttribute('aria-current')).toBe('page')
    expect(pages()[0].getAttribute('aria-current')).toBeNull()
  })
})
