import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisPagination } from './Pagination'
import { getPageRange } from './types'
import { IrisI18nProvider } from '../../i18n'

afterEach(() => cleanup())

function pageButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-pagination-item=page]'),
  ) as HTMLButtonElement[]
}

function btn(kind: string): HTMLButtonElement {
  return document.querySelector(`[data-iris-pagination-item="${kind}"]`) as HTMLButtonElement
}

describe('@iris-ui/react getPageRange', () => {
  it('returns single page when total=1', () => {
    expect(getPageRange(1, 1)).toEqual([1])
  })

  it('returns [1..5] when total=5 (no ellipsis needed)', () => {
    expect(getPageRange(3, 5, 1)).toEqual([1, 2, 3, 4, 5])
  })

  it('inserts right ellipsis when current is near start', () => {
    expect(getPageRange(1, 20, 1)).toEqual([1, 2, 'ellipsis-right', 20])
  })

  it('inserts both ellipses when current is in middle', () => {
    expect(getPageRange(10, 20, 1)).toEqual([1, 'ellipsis-left', 9, 10, 11, 'ellipsis-right', 20])
  })

  it('inserts left ellipsis when current is near end', () => {
    expect(getPageRange(20, 20, 1)).toEqual([1, 'ellipsis-left', 19, 20])
  })
})

describe('@iris-ui/react IrisPagination', () => {
  it('renders prev/next + page buttons + aria-label="Pagination"', () => {
    const { container } = render(<IrisPagination total={50} value={1} />)
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination')
    expect(btn('prev')).not.toBeNull()
    expect(btn('next')).not.toBeNull()
    expect(pageButtons().length).toBeGreaterThan(0)
  })

  it('localizes labels via IrisI18nProvider', () => {
    const { container } = render(
      <IrisI18nProvider
        messages={{ 'pagination.label': 'Seitennummerierung', 'pagination.next': 'Weiter' }}
      >
        <IrisPagination total={50} value={1} />
      </IrisI18nProvider>,
    )
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Seitennummerierung')
    expect(btn('next')?.getAttribute('aria-label')).toBe('Weiter')
  })

  it('marks the current page with aria-current="page"', () => {
    render(<IrisPagination total={50} value={3} />)
    const active = document.querySelector('[data-iris-pagination-active=true]')
    expect(active).not.toBeNull()
    expect(active?.getAttribute('aria-current')).toBe('page')
    expect(active?.textContent).toBe('3')
  })

  it('prev disabled on first page', () => {
    render(<IrisPagination total={50} value={1} />)
    expect(btn('prev').disabled).toBe(true)
  })

  it('next disabled on last page', () => {
    render(<IrisPagination total={50} pageSize={10} value={5} />)
    expect(btn('next').disabled).toBe(true)
  })

  it('clicking a page button calls onValueChange', () => {
    const onChange = vi.fn()
    render(<IrisPagination total={50} value={1} onValueChange={onChange} />)
    const pages = pageButtons()
    const two = pages.find((b) => b.textContent === '2')!
    fireEvent.click(two)
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('clicking prev/next changes page', () => {
    const onChange = vi.fn()
    render(<IrisPagination total={50} value={2} onValueChange={onChange} />)
    fireEvent.click(btn('prev'))
    expect(onChange).toHaveBeenLastCalledWith(1)
    fireEvent.click(btn('next'))
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('uncontrolled mode advances internally', () => {
    const { container } = render(<IrisPagination total={50} defaultValue={1} />)
    fireEvent.click(btn('next'))
    expect(container.querySelector('[data-iris-pagination-active=true]')?.textContent).toBe('2')
  })

  it('disabled prop disables all buttons', () => {
    const onChange = vi.fn()
    render(<IrisPagination total={50} value={3} disabled onValueChange={onChange} />)
    const all = Array.from(
      document.querySelectorAll('[data-iris-pagination-item]'),
    ) as HTMLButtonElement[]
    expect(all.every((b) => b.disabled)).toBe(true)
    fireEvent.click(all[0]!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders ellipsis for large page counts', () => {
    render(<IrisPagination total={500} pageSize={10} value={10} />)
    expect(document.querySelector('[data-iris-pagination-ellipsis=left]')).not.toBeNull()
    expect(document.querySelector('[data-iris-pagination-ellipsis=right]')).not.toBeNull()
  })

  it('showFirstLast adds first and last buttons', () => {
    render(<IrisPagination total={50} value={3} showFirstLast />)
    expect(btn('first')).not.toBeNull()
    expect(btn('last')).not.toBeNull()
  })

  it('clicking already-active page does not fire onValueChange', () => {
    const onChange = vi.fn()
    render(<IrisPagination total={50} value={3} onValueChange={onChange} />)
    const active = document.querySelector('[data-iris-pagination-active=true]') as HTMLButtonElement
    fireEvent.click(active)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('size="sm" reflects on data attr', () => {
    render(<IrisPagination total={50} value={1} size="sm" />)
    expect(
      document.querySelector('[data-iris-pagination]')?.getAttribute('data-iris-pagination-size'),
    ).toBe('sm')
  })
})
