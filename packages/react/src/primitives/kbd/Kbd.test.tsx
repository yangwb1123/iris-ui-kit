import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisKbd } from './Kbd'

afterEach(() => cleanup())

describe('@iris-ui/react IrisKbd', () => {
  it('renders a single key', () => {
    const { container } = render(<IrisKbd keys="K" />)
    const keys = container.querySelectorAll('[data-iris-kbd-key]')
    expect(keys.length).toBe(1)
    expect(keys[0]!.textContent).toBe('K')
  })

  it('multiple keys with separator', () => {
    const { container } = render(<IrisKbd keys={['Ctrl', 'K']} />)
    expect(container.querySelectorAll('[data-iris-kbd-key]').length).toBe(2)
    expect(container.querySelectorAll('[data-iris-kbd-separator]').length).toBe(1)
    expect(container.querySelector('[data-iris-kbd-separator]')!.textContent).toBe('+')
  })

  it('custom separator', () => {
    const { container } = render(<IrisKbd keys={['⌘', 'K']} separator="·" />)
    expect(container.querySelector('[data-iris-kbd-separator]')!.textContent).toBe('·')
  })

  it('empty keys → null', () => {
    const { container } = render(<IrisKbd keys={[]} />)
    expect(container.querySelector('[data-iris-kbd-key]')).toBeNull()
  })

  it('children wins over keys', () => {
    const { container } = render(<IrisKbd keys="X">custom</IrisKbd>)
    expect(container.querySelector('[data-iris-kbd]')!.tagName).toBe('KBD')
    expect(container.textContent).toBe('custom')
  })

  it('size sm changes font size', () => {
    const { container } = render(<IrisKbd keys="K" size="sm" />)
    expect(container.querySelector('[data-iris-kbd]')!.getAttribute('style')).toContain('font-size: 10px')
  })
})
