import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisKbd from './IrisKbd.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisKbd', () => {
  it('renders nothing when no keys and no children', () => {
    const { container } = render(IrisKbd)
    expect(container.querySelector('[data-iris-kbd]')).toBeNull()
  })

  it('renders individual key elements when keys array is provided', () => {
    const { container } = render(IrisKbd, { props: { keys: ['Ctrl', 'K'] } })
    const keyEls = container.querySelectorAll('[data-iris-kbd-key]')
    expect(keyEls).toHaveLength(2)
    expect(keyEls[0].textContent).toBe('Ctrl')
    expect(keyEls[1].textContent).toBe('K')
  })

  it('renders a separator between keys', () => {
    const { container } = render(IrisKbd, { props: { keys: ['Ctrl', 'K'] } })
    const sep = container.querySelector('[data-iris-kbd-separator]')
    expect(sep).not.toBeNull()
    expect(sep!.textContent).toBe('+')
  })

  it('renders a single key string as one key element', () => {
    const { container } = render(IrisKbd, { props: { keys: 'Enter' } })
    expect(container.querySelectorAll('[data-iris-kbd-key]')).toHaveLength(1)
  })
})
