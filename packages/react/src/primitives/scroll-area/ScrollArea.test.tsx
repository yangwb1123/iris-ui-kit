import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisScrollArea } from './ScrollArea'

afterEach(() => cleanup())

const el = (c: HTMLElement) => c.querySelector('[data-iris-scroll-area]') as HTMLElement

describe('@iris-ui/react IrisScrollArea', () => {
  it('renders children', () => {
    const { container } = render(
      <IrisScrollArea>
        <p data-child="">Body</p>
      </IrisScrollArea>,
    )
    expect(container.querySelector('[data-child]')?.textContent).toBe('Body')
  })

  it('defaults to vertical scrolling', () => {
    const { container } = render(<IrisScrollArea>x</IrisScrollArea>)
    expect(el(container).getAttribute('data-axis')).toBe('vertical')
    expect(el(container).style.overflowY).toBe('auto')
    expect(el(container).style.overflowX).toBe('hidden')
  })

  it('horizontal axis scrolls on X', () => {
    const { container } = render(<IrisScrollArea axis="horizontal">x</IrisScrollArea>)
    expect(el(container).getAttribute('data-axis')).toBe('horizontal')
    expect(el(container).style.overflowX).toBe('auto')
  })

  it('applies a numeric maxHeight as px', () => {
    const { container } = render(<IrisScrollArea maxHeight={200}>x</IrisScrollArea>)
    expect(el(container).style.maxHeight).toBe('200px')
  })

  it('is keyboard-focusable', () => {
    const { container } = render(<IrisScrollArea>x</IrisScrollArea>)
    expect(el(container).getAttribute('tabindex')).toBe('0')
  })
})
