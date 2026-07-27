import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisMasonry } from './Masonry'

afterEach(() => cleanup())

const root = (c: HTMLElement) => c.querySelector('[data-iris-masonry]') as HTMLElement
const items = (c: HTMLElement) => c.querySelectorAll('[data-iris-masonry-item]')

describe('@iris-ui-kit/react IrisMasonry', () => {
  it('wraps each child in an item', () => {
    const { container } = render(
      <IrisMasonry>
        <div>1</div>
        <div>2</div>
        <div>3</div>
      </IrisMasonry>,
    )
    expect(items(container).length).toBe(3)
    expect(items(container)[0].textContent).toBe('1')
  })

  it('applies the column count', () => {
    const { container } = render(
      <IrisMasonry columns={4}>
        <div>1</div>
      </IrisMasonry>,
    )
    expect(root(container).getAttribute('data-columns')).toBe('4')
  })

  it('applies the gap', () => {
    const { container } = render(
      <IrisMasonry gap={24}>
        <div>1</div>
      </IrisMasonry>,
    )
    expect(root(container).style.columnGap).toBe('24px')
  })
})
