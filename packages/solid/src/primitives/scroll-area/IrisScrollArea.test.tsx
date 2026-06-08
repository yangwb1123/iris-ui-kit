import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisScrollArea } from './IrisScrollArea'

afterEach(cleanup)

describe('IrisScrollArea', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisScrollArea>Content</IrisScrollArea>)
    expect(container.querySelector('[data-iris-scroll-area]')).not.toBeNull()
  })

  it('applies correct data-axis attribute', () => {
    const { container } = render(() => <IrisScrollArea axis="horizontal">Content</IrisScrollArea>)
    expect(container.querySelector('[data-axis="horizontal"]')).not.toBeNull()
  })

  it('is focusable (has tabIndex)', () => {
    const { container } = render(() => <IrisScrollArea>Content</IrisScrollArea>)
    const el = container.querySelector('[data-iris-scroll-area]') as HTMLElement
    expect(el.tabIndex).toBe(0)
  })

  it('renders children', () => {
    const { getByText } = render(() => <IrisScrollArea>Hello Scroll</IrisScrollArea>)
    expect(getByText('Hello Scroll')).toBeTruthy()
  })
})
