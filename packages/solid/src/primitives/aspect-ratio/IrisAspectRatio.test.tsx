import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisAspectRatio } from './IrisAspectRatio'

afterEach(cleanup)

describe('IrisAspectRatio', () => {
  it('renders the wrapper and content layer', () => {
    const { container } = render(() => (
      <IrisAspectRatio>
        <img src="/img.png" alt="" />
      </IrisAspectRatio>
    ))
    expect(container.querySelector('[data-iris-aspect-ratio]')).not.toBeNull()
    expect(container.querySelector('[data-iris-aspect-ratio-content]')).not.toBeNull()
  })

  it('sets the data-ratio attribute', () => {
    const { container } = render(() => (
      <IrisAspectRatio ratio={4 / 3}>
        <div />
      </IrisAspectRatio>
    ))
    const el = container.querySelector('[data-iris-aspect-ratio]') as HTMLElement
    expect(el.getAttribute('data-ratio')).toBe(String(4 / 3))
  })

  it('defaults to 16/9', () => {
    const { container } = render(() => (
      <IrisAspectRatio>
        <div />
      </IrisAspectRatio>
    ))
    const el = container.querySelector('[data-iris-aspect-ratio]') as HTMLElement
    expect(el.getAttribute('data-ratio')).toBe(String(16 / 9))
  })

  it('renders children inside the content layer', () => {
    const { getByText } = render(() => (
      <IrisAspectRatio>
        <span>Video here</span>
      </IrisAspectRatio>
    ))
    expect(getByText('Video here')).toBeTruthy()
  })
})
