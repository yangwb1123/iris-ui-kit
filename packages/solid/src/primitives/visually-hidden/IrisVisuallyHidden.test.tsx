import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisVisuallyHidden } from './IrisVisuallyHidden'

afterEach(cleanup)

describe('IrisVisuallyHidden', () => {
  it('renders children and is in the DOM', () => {
    const { getByText } = render(() => <IrisVisuallyHidden>Loading</IrisVisuallyHidden>)
    expect(getByText('Loading')).toBeTruthy()
  })

  it('applies sr-only style', () => {
    const { container } = render(() => <IrisVisuallyHidden>Hidden</IrisVisuallyHidden>)
    const el = container.querySelector('[data-iris-visually-hidden]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.position).toBe('absolute')
    expect(el.style.width).toBe('1px')
  })

  it('forwards extra attributes', () => {
    const { container } = render(() => (
      <IrisVisuallyHidden aria-live="polite">Live</IrisVisuallyHidden>
    ))
    const el = container.querySelector('[data-iris-visually-hidden]')
    expect(el?.getAttribute('aria-live')).toBe('polite')
  })
})
