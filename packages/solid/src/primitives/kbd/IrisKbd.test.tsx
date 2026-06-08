import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisKbd } from './IrisKbd'

afterEach(cleanup)

describe('IrisKbd', () => {
  it('renders a <kbd> element with content', () => {
    const { container, getByText } = render(() => <IrisKbd>Ctrl</IrisKbd>)
    expect(container.querySelector('kbd[data-iris-kbd]')).not.toBeNull()
    expect(getByText('Ctrl')).toBeTruthy()
  })

  it('applies the size data attribute', () => {
    const { container } = render(() => <IrisKbd size="sm">K</IrisKbd>)
    expect(container.querySelector('[data-iris-kbd-size="sm"]')).not.toBeNull()
  })

  it('defaults to md size', () => {
    const { container } = render(() => <IrisKbd>Enter</IrisKbd>)
    expect(container.querySelector('[data-iris-kbd-size="md"]')).not.toBeNull()
  })
})
