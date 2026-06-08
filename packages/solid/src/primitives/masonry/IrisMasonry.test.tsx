import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisMasonry } from './IrisMasonry'

afterEach(cleanup)

describe('IrisMasonry', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisMasonry>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </IrisMasonry>
    ))
    expect(container.querySelector('[data-iris-masonry]')).not.toBeNull()
  })

  it('wraps children in masonry items', () => {
    const { container } = render(() => (
      <IrisMasonry>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </IrisMasonry>
    ))
    expect(container.querySelectorAll('[data-iris-masonry-item]').length).toBe(3)
  })

  it('applies column-count style', () => {
    const { container } = render(() => (
      <IrisMasonry columns={4}>
        <div>A</div>
      </IrisMasonry>
    ))
    const el = container.querySelector('[data-iris-masonry]') as HTMLElement
    expect(el.style.columnCount).toBe('4')
  })

  it('shows item content', () => {
    const { getByText } = render(() => (
      <IrisMasonry>
        <div>Hello masonry</div>
      </IrisMasonry>
    ))
    expect(getByText('Hello masonry')).toBeTruthy()
  })
})
