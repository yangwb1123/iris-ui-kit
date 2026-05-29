import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAffix } from './Affix'

afterEach(() => cleanup())

const rect = (top: number): DOMRect =>
  ({
    top,
    bottom: top + 40,
    left: 0,
    right: 0,
    width: 0,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

describe('@iris-ui/react IrisAffix', () => {
  it('renders its children', () => {
    const { container } = render(
      <IrisAffix>
        <div data-child="">Nav</div>
      </IrisAffix>,
    )
    expect(container.querySelector('[data-child]')?.textContent).toBe('Nav')
  })

  it('affixes / unaffixes based on the offset', () => {
    const { container } = render(
      <IrisAffix offsetTop={0}>
        <div>Nav</div>
      </IrisAffix>,
    )
    const ph = container.querySelector('[data-iris-affix]') as HTMLElement
    ph.getBoundingClientRect = () => rect(100)
    fireEvent.scroll(window)
    expect(ph.getAttribute('data-affixed')).toBeNull()
    ph.getBoundingClientRect = () => rect(-50)
    fireEvent.scroll(window)
    expect(ph.getAttribute('data-affixed')).toBe('true')
  })

  it('calls onChange when the affixed state flips', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IrisAffix offsetTop={0} onChange={onChange}>
        <div>Nav</div>
      </IrisAffix>,
    )
    const ph = container.querySelector('[data-iris-affix]') as HTMLElement
    ph.getBoundingClientRect = () => rect(100)
    fireEvent.scroll(window)
    onChange.mockClear()
    ph.getBoundingClientRect = () => rect(-50)
    fireEvent.scroll(window)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('pins the content with a fixed offset when affixed', () => {
    const { container } = render(
      <IrisAffix offsetTop={8}>
        <div>Nav</div>
      </IrisAffix>,
    )
    const ph = container.querySelector('[data-iris-affix]') as HTMLElement
    ph.getBoundingClientRect = () => rect(-50)
    fireEvent.scroll(window)
    const content = container.querySelector('[data-iris-affix-content]') as HTMLElement
    expect(content.style.position).toBe('fixed')
    expect(content.style.top).toBe('8px')
  })
})
