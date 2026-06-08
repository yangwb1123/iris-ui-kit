import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisDragger } from './IrisDragger'

afterEach(cleanup)

describe('IrisDragger', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisDragger>
        <div>Drag me</div>
      </IrisDragger>
    ))
    expect(container.querySelector('[data-iris-dragger]')).not.toBeNull()
  })

  it('renders children', () => {
    const { getByText } = render(() => (
      <IrisDragger>
        <div>Drag content</div>
      </IrisDragger>
    ))
    expect(getByText('Drag content')).toBeTruthy()
  })

  it('renders at the provided position', () => {
    const { container } = render(() => (
      <IrisDragger value={{ x: 50, y: 100 }}>
        <div>Content</div>
      </IrisDragger>
    ))
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('50px')
    expect(el.style.transform).toContain('100px')
  })

  it('renders handle slot', () => {
    const { container } = render(() => (
      <IrisDragger handle={<span>Handle</span>}>
        <div>Content</div>
      </IrisDragger>
    ))
    expect(container.querySelector('[data-iris-dragger-handle]')).not.toBeNull()
  })
})
