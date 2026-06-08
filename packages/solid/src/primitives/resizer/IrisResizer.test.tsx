import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisResizer } from './IrisResizer'

afterEach(cleanup)

describe('IrisResizer', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelector('[data-iris-resizer]')).not.toBeNull()
  })

  it('renders children content', () => {
    const { getByText } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Resizable content</div>
      </IrisResizer>
    ))
    expect(getByText('Resizable content')).toBeTruthy()
  })

  it('renders handles by default', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(8)
  })

  it('only renders specified handles', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }} handles={['bottom-right']}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(1)
    expect(container.querySelector('[data-iris-resizer-handle="bottom-right"]')).not.toBeNull()
  })

  it('applies correct dimensions from value prop', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 300, height: 200 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    const el = container.querySelector('[data-iris-resizer]') as HTMLElement
    expect(el.style.width).toBe('300px')
    expect(el.style.height).toBe('200px')
  })
})
