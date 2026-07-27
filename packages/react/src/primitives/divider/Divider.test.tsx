import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisDivider } from './Divider'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisDivider', () => {
  it('renders an <hr> for plain horizontal', () => {
    const { container } = render(<IrisDivider />)
    expect(container.querySelector('[data-iris-divider]')!.tagName).toBe('HR')
  })

  it('vertical renders div with role separator', () => {
    const { container } = render(<IrisDivider orientation="vertical" />)
    const el = container.querySelector('[data-iris-divider]')!
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('role')).toBe('separator')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('label renders 3-column divider', () => {
    const { container } = render(<IrisDivider label="or" />)
    expect(container.querySelector('[data-iris-divider]')!.tagName).toBe('DIV')
    expect(container.querySelector('[data-iris-divider-label]')!.textContent).toBe('or')
    expect(container.querySelector('[data-iris-divider-line="before"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-divider-line="after"]')).not.toBeNull()
  })

  it('children win over label prop', () => {
    const { container } = render(<IrisDivider label="prop">child</IrisDivider>)
    expect(container.querySelector('[data-iris-divider-label]')!.textContent).toBe('child')
  })

  it('spacing sm/md/lg applies margins', () => {
    const { container, rerender } = render(<IrisDivider spacing="sm" />)
    expect(container.querySelector('[data-iris-divider]')!.getAttribute('style')).toContain(
      'margin: 8px 0',
    )
    rerender(<IrisDivider spacing="lg" />)
    expect(container.querySelector('[data-iris-divider]')!.getAttribute('style')).toContain(
      'margin: 24px 0',
    )
  })

  it('vertical applies horizontal margins', () => {
    const { container } = render(<IrisDivider orientation="vertical" spacing="sm" />)
    const style = container.querySelector('[data-iris-divider]')!.getAttribute('style') ?? ''
    expect(/margin:\s*0(px)?\s+8px/.test(style)).toBe(true)
  })
})
