import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisBackTop } from './BackTop'

afterEach(() => cleanup())

describe('@iris-ui/react IrisBackTop', () => {
  it('is hidden until the target scrolls past the threshold', () => {
    const target = document.createElement('div')
    const { container } = render(<IrisBackTop target={() => target} visibilityHeight={400} />)
    expect(container.querySelector('[data-iris-back-top]')).toBeNull()
    target.scrollTop = 500
    fireEvent.scroll(target)
    expect(container.querySelector('[data-iris-back-top]')).not.toBeNull()
  })

  it('hides again when scrolled back above the threshold', () => {
    const target = document.createElement('div')
    target.scrollTop = 500
    const { container } = render(<IrisBackTop target={() => target} visibilityHeight={400} />)
    fireEvent.scroll(target)
    expect(container.querySelector('[data-iris-back-top]')).not.toBeNull()
    target.scrollTop = 0
    fireEvent.scroll(target)
    expect(container.querySelector('[data-iris-back-top]')).toBeNull()
  })

  it('scrolls the target to top on click', () => {
    const target = document.createElement('div')
    const scrollTo = vi.fn()
    ;(target as unknown as { scrollTo: unknown }).scrollTo = scrollTo
    target.scrollTop = 500
    const { container } = render(<IrisBackTop target={() => target} />)
    fireEvent.scroll(target)
    fireEvent.click(container.querySelector('[data-iris-back-top]')!)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  it('renders custom content and an accessible label', () => {
    const target = document.createElement('div')
    target.scrollTop = 500
    const { container } = render(<IrisBackTop target={() => target}>TOP</IrisBackTop>)
    fireEvent.scroll(target)
    const btn = container.querySelector('[data-iris-back-top]')!
    expect(btn.textContent).toBe('TOP')
    expect(btn.getAttribute('aria-label')).toBe('Back to top')
  })
})
