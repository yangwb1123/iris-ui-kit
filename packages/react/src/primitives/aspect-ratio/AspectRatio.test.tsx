import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisAspectRatio } from './AspectRatio'

afterEach(() => cleanup())

const box = (c: HTMLElement) => c.querySelector('[data-iris-aspect-ratio]') as HTMLElement

describe('@iris-ui-kit/react IrisAspectRatio', () => {
  it('applies the default 16/9 ratio', () => {
    const { container } = render(<IrisAspectRatio />)
    expect(box(container).getAttribute('data-ratio')).toBe(String(16 / 9))
  })

  it('applies a custom ratio', () => {
    const { container } = render(<IrisAspectRatio ratio={1.5} />)
    expect(box(container).getAttribute('data-ratio')).toBe('1.5')
  })

  it('renders children in the content layer', () => {
    const { container } = render(
      <IrisAspectRatio>
        <span data-child="">X</span>
      </IrisAspectRatio>,
    )
    expect(
      container.querySelector('[data-iris-aspect-ratio-content] [data-child]')?.textContent,
    ).toBe('X')
  })
})
