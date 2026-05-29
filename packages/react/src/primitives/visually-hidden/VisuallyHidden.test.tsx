import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisVisuallyHidden } from './VisuallyHidden'

afterEach(() => cleanup())

const el = (c: HTMLElement) => c.querySelector('[data-iris-visually-hidden]') as HTMLElement

describe('@iris-ui/react IrisVisuallyHidden', () => {
  it('renders its children', () => {
    const { container } = render(<IrisVisuallyHidden>Loading</IrisVisuallyHidden>)
    expect(el(container).textContent).toBe('Loading')
  })

  it('applies the visually-hidden clip styles', () => {
    const { container } = render(<IrisVisuallyHidden>x</IrisVisuallyHidden>)
    expect(el(container).style.position).toBe('absolute')
    expect(el(container).style.overflow).toBe('hidden')
  })

  it('forwards attributes like aria-live and role', () => {
    const { container } = render(
      <IrisVisuallyHidden aria-live="polite" role="status">
        x
      </IrisVisuallyHidden>,
    )
    expect(el(container).getAttribute('aria-live')).toBe('polite')
    expect(el(container).getAttribute('role')).toBe('status')
  })
})
