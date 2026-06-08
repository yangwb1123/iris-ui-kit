import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisResizer from './IrisResizer.svelte'

afterEach(cleanup)

describe('IrisResizer', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisResizer, { props: { value: { width: 200, height: 150 } } })
    expect(container).toBeTruthy()
  })

  it('renders the wrapper with correct size', () => {
    const { container } = render(IrisResizer, { props: { value: { width: 300, height: 200 } } })
    const el = container.querySelector('[data-iris-resizer]') as HTMLElement
    expect(el.style.width).toBe('300px')
    expect(el.style.height).toBe('200px')
  })

  it('renders handle elements', () => {
    const { container } = render(IrisResizer, {
      props: { value: { width: 200, height: 150 }, handles: ['bottom-right', 'right'] },
    })
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(2)
  })
})
