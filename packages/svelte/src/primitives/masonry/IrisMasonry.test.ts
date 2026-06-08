import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisMasonry from './IrisMasonry.svelte'

afterEach(cleanup)

describe('IrisMasonry', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisMasonry)
    expect(container).toBeTruthy()
  })

  it('sets column-count style', () => {
    const { container } = render(IrisMasonry, { props: { columns: 4 } })
    const el = container.querySelector('[data-iris-masonry]') as HTMLElement
    expect(el.style.columnCount).toBe('4')
  })

  it('sets column-gap style', () => {
    const { container } = render(IrisMasonry, { props: { gap: 24 } })
    const el = container.querySelector('[data-iris-masonry]') as HTMLElement
    expect(el.style.columnGap).toBe('24px')
  })

  it('has data-columns attribute', () => {
    const { container } = render(IrisMasonry, { props: { columns: 3 } })
    expect(container.querySelector('[data-iris-masonry]')?.getAttribute('data-columns')).toBe('3')
  })
})
