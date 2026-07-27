import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisSpinner } from './Spinner'
import { __SPINNER_STYLE_ID, __resetSpinnerStyles } from './styles'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisSpinner', () => {
  beforeEach(() => __resetSpinnerStyles())
  afterEach(() => __resetSpinnerStyles())

  it('renders an SVG circle', () => {
    const { container } = render(<IrisSpinner />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('default size is 18px', () => {
    const { container } = render(<IrisSpinner />)
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('18')
  })

  it('sm/lg map to 14/24', () => {
    const { container, rerender } = render(<IrisSpinner size="sm" />)
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('14')
    rerender(<IrisSpinner size="lg" />)
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('24')
  })

  it('numeric size applied', () => {
    const { container } = render(<IrisSpinner size={40} />)
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('40')
  })

  it('color prop applied as SVG color', () => {
    const { container } = render(<IrisSpinner color="red" />)
    expect(container.querySelector('svg')!.getAttribute('style')).toContain('color: red')
  })

  it('role="status" + aria-live polite', () => {
    const { container } = render(<IrisSpinner />)
    const wrap = container.querySelector('[data-iris-spinner-wrap]')!
    expect(wrap.getAttribute('role')).toBe('status')
    expect(wrap.getAttribute('aria-live')).toBe('polite')
  })

  it('sr-only label by default', () => {
    const { container } = render(<IrisSpinner />)
    expect(container.textContent).toBe('Loading')
  })

  it('blank label omits text', () => {
    const { container } = render(<IrisSpinner label="" />)
    expect(container.textContent).toBe('')
  })

  it('installs the stylesheet exactly once', () => {
    render(<IrisSpinner />)
    render(<IrisSpinner />)
    render(<IrisSpinner />)
    expect(document.querySelectorAll(`#${__SPINNER_STYLE_ID}`)).toHaveLength(1)
  })

  it('strokeWidth defaults to ~12% but can be overridden', () => {
    const { container, rerender } = render(<IrisSpinner size={50} />)
    expect(container.querySelector('circle')!.getAttribute('stroke-width')).toBe('6')
    rerender(<IrisSpinner size={50} strokeWidth={2} />)
    expect(container.querySelector('circle')!.getAttribute('stroke-width')).toBe('2')
  })
})
